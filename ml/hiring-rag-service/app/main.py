import json
import logging
import math
import os
import re
import threading
import time
from pathlib import Path
from typing import Any, Optional, Union

import httpx
from fastapi import FastAPI, HTTPException
from kafka import KafkaConsumer, KafkaProducer
from llama_index.core import Settings, SimpleDirectoryReader, VectorStoreIndex
from llama_index.core.readers.base import BaseReader
from llama_index.core.schema import Document
from llama_index.core.vector_stores import MetadataFilter, MetadataFilters
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.llms.ollama import Ollama
from llama_index.vector_stores.chroma import ChromaVectorStore
from pydantic import BaseModel, Field
from sentence_transformers import CrossEncoder
import uvicorn

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Hiring RAG Service",
    description="Combined resume parsing, indexing, ranking, and explanation service.",
    version="1.0.0",
)

SERVICE_PORT = int(os.getenv("SERVICE_PORT", "8090"))
OCR_LANGUAGE = os.getenv("OCR_LANGUAGE", "eng")
OCR_DPI = int(os.getenv("OCR_DPI", "300"))
RESUME_STORAGE_ROOT = Path(os.getenv("RESUME_STORAGE_ROOT", "./data")).resolve()
CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_db")
CHROMA_COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_NAME", "hiring_resumes")
DEFAULT_RETRIEVAL_TOP_K = int(os.getenv("RETRIEVAL_TOP_K", "30"))
MAX_ANALYSIS_PROMPT_CHARS = int(os.getenv("MAX_ANALYSIS_PROMPT_CHARS", "12000"))
MAX_JOB_DESCRIPTION_CHARS = int(os.getenv("MAX_JOB_DESCRIPTION_CHARS", "2500"))
MAX_ANALYSIS_EXCERPT_CHARS = int(os.getenv("MAX_ANALYSIS_EXCERPT_CHARS", "1200"))
MIN_ANALYSIS_EXCERPT_CHARS = int(os.getenv("MIN_ANALYSIS_EXCERPT_CHARS", "120"))
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b-instruct-q4_K_M")
RAG_LLM_PROVIDER = os.getenv("RAG_LLM_PROVIDER", os.getenv("LLM_PROVIDER", "groq")).lower().strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_API_URL = os.getenv("GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions")
RAG_USE_CROSS_ENCODER = os.getenv(
    "RAG_USE_CROSS_ENCODER",
    "false" if RAG_LLM_PROVIDER == "groq" else "true",
).lower() == "true"
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "BAAI/bge-small-en-v1.5")
CROSS_ENCODER_MODEL = os.getenv("CROSS_ENCODER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")
JOBS_SERVICE_URL = os.getenv("JOBS_SERVICE_URL", "http://jobs-service:8083").rstrip("/")
KAFKA_ENABLED = os.getenv("KAFKA_ENABLED", "true").lower() == "true"
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")

APPLICATION_SUBMITTED_TOPIC = os.getenv("APPLICATION_SUBMITTED_TOPIC", "application.submitted")
RESUME_PARSE_COMPLETED_TOPIC = os.getenv("RESUME_PARSE_COMPLETED_TOPIC", "resume.parse.completed")
JOB_RANK_REQUEST_TOPIC = os.getenv("JOB_RANK_REQUEST_TOPIC", "job.rank.request")
JOB_RANK_RESULT_TOPIC = os.getenv("JOB_RANK_RESULT_TOPIC", "job.rank.result")

IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff")

EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PHONE_RE = re.compile(
    r"(?<!\w)(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?!\w)"
)
URL_RE = re.compile(r"\b(?:https?://|www\.)\S+|\b(?:linkedin|github)\.com/\S+", re.IGNORECASE)
ADDRESS_RE = re.compile(
    r"\b\d{1,6}\s+[A-Z0-9 .'\-]+\s+"
    r"(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Drive|Dr\.?|Court|Ct\.?|Way|Place|Pl\.?)\b",
    re.IGNORECASE,
)
SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
FIELD_SEPARATOR_RE = r"(?:\s*:\s*|\s+)"
NAME_FIELD_RE = re.compile(rf"(?im)^\s*(?:[mn]ame|candidate){FIELD_SEPARATOR_RE}.+$")
EMAIL_FIELD_RE = re.compile(rf"(?im)^\s*(?:email|e-mail){FIELD_SEPARATOR_RE}.+$")
PHONE_FIELD_RE = re.compile(rf"(?im)^\s*(?:phone|mobile|cell){FIELD_SEPARATOR_RE}.+$")
URL_FIELD_RE = re.compile(
    rf"(?im)^\s*(?:linkedin|github|portfolio|website){FIELD_SEPARATOR_RE}.+$"
)
ADDRESS_FIELD_RE = re.compile(rf"(?im)^\s*(?:address|location){FIELD_SEPARATOR_RE}.+$")
NON_NAME_TERMS = {
    "analyst",
    "curriculum",
    "data",
    "designer",
    "developer",
    "education",
    "engineer",
    "experience",
    "lead",
    "manager",
    "principal",
    "product",
    "project",
    "resume",
    "senior",
    "skills",
    "software",
    "summary",
    "vitae",
}

_producer: Optional[KafkaProducer] = None
_producer_lock = threading.Lock()
_parse_statuses: dict[str, dict[str, Any]] = {}
_rag_lock = threading.RLock()
_embedding_model_ready = False
_ollama_llm_ready = False
_ranker: Optional[CrossEncoder] = None
_vector_store: Optional[ChromaVectorStore] = None
_index: Optional[VectorStoreIndex] = None


class IndexResumeRequest(BaseModel):
    job_id: str = Field(..., min_length=1)
    resume_id: str = Field(..., min_length=1)
    file_path: str = Field(..., min_length=1)
    candidate_id: Optional[str] = None


class RankRequest(BaseModel):
    job_id: str = Field(..., min_length=1)
    job_description: str = Field(..., min_length=1)
    top_k: int = Field(default=10, ge=1, le=50)
    retrieval_top_k: int = Field(default=DEFAULT_RETRIEVAL_TOP_K, ge=1, le=200)


class ExplainRequest(BaseModel):
    job_description: str = Field(..., min_length=1)
    resume_id: str = Field(..., min_length=1)
    content: Optional[str] = Field(default=None, min_length=1)
    candidate_id: Optional[str] = None
    job_id: Optional[str] = None
    file_path: Optional[str] = None


class ParseRequest(BaseModel):
    applicationId: str = Field(..., min_length=1)
    filePath: str = Field(..., min_length=1)
    jobId: Optional[str] = None
    candidateId: Optional[str] = None


class ParseResponse(BaseModel):
    status: str
    parsedJsonUrl: str
    parseConfidence: Optional[float] = None


class ParseStatusResponse(BaseModel):
    applicationId: str
    status: str
    parseConfidence: Optional[float] = None
    chunkCount: Optional[int] = None


def _ocr_page_to_text(page, *, full: bool = True) -> str:
    text_page = page.get_textpage_ocr(
        language=OCR_LANGUAGE,
        dpi=OCR_DPI,
        full=full,
    )
    return text_page.extractText().strip()


class OCRPDFReader(BaseReader):
    """Extract selectable PDF text, falling back to OCR for scanned pages."""

    def load_data(
        self,
        file_path: Union[Path, str],
        metadata: bool = True,
        extra_info: Optional[dict] = None,
    ) -> list[Document]:
        import fitz

        pdf = fitz.open(file_path)
        base_metadata = dict(extra_info or {}) if metadata else {}
        base_metadata["total_pages"] = len(pdf)
        base_metadata["file_path"] = str(file_path)

        documents = []
        for page in pdf:
            text = page.get_text().strip()
            parser = "pdf_text"

            if len(text) < 30:
                ocr_text = _ocr_page_to_text(page, full=True)
                if len(ocr_text) > len(text):
                    text = ocr_text
                    parser = "pdf_ocr"

            documents.append(
                Document(
                    text=text,
                    metadata=dict(
                        base_metadata,
                        page_number=page.number + 1,
                        parser=parser,
                    ),
                )
            )

        return documents


class OCRImageReader(BaseReader):
    """OCR standalone image files into text documents."""

    def load_data(self, file: Path, extra_info: Optional[dict] = None) -> list[Document]:
        import fitz

        pixmap = fitz.Pixmap(str(file))
        if pixmap.alpha:
            pixmap = fitz.Pixmap(pixmap, 0)

        pdf = fitz.open()
        page = pdf.new_page(width=pixmap.width, height=pixmap.height)
        page.insert_image(page.rect, pixmap=pixmap)
        text = _ocr_page_to_text(page, full=True)

        return [
            Document(
                text=text,
                metadata=dict(
                    extra_info or {},
                    file_path=str(file),
                    parser="image_ocr",
                ),
            )
        ]


def _candidate_name(text: str) -> Optional[str]:
    for raw_line in text.splitlines()[:8]:
        line = raw_line.strip(" -\t")
        if not line:
            continue

        name_match = re.match(rf"(?i)^(?:[mn]ame|candidate){FIELD_SEPARATOR_RE}(.+)$", line)
        if name_match:
            return name_match.group(1).strip()

        words = re.findall(r"[A-Za-z][A-Za-z'\-]*", line)
        lower_words = {word.lower() for word in words}
        if 2 <= len(words) <= 4 and not lower_words.intersection(NON_NAME_TERMS):
            return " ".join(words)

    return None


def anonymize_resume_text(text: str) -> str:
    candidate_name = _candidate_name(text)

    anonymized = NAME_FIELD_RE.sub("Name: [NAME]", text)
    if candidate_name:
        anonymized = re.sub(re.escape(candidate_name), "[NAME]", anonymized, flags=re.IGNORECASE)

    anonymized = EMAIL_FIELD_RE.sub("Email: [EMAIL]", anonymized)
    anonymized = PHONE_FIELD_RE.sub("Phone: [PHONE]", anonymized)
    anonymized = URL_FIELD_RE.sub("Profile: [URL]", anonymized)
    anonymized = ADDRESS_FIELD_RE.sub("Address: [ADDRESS]", anonymized)
    anonymized = EMAIL_RE.sub("[EMAIL]", anonymized)
    anonymized = PHONE_RE.sub("[PHONE]", anonymized)
    anonymized = URL_RE.sub("[URL]", anonymized)
    anonymized = ADDRESS_RE.sub("[ADDRESS]", anonymized)
    anonymized = SSN_RE.sub("[SSN]", anonymized)
    return anonymized


def resolve_resume_path(file_path: str) -> Path:
    requested_path = Path(file_path)

    candidate_paths = [requested_path]
    if not requested_path.is_absolute():
        candidate_paths = [RESUME_STORAGE_ROOT / requested_path]
        parts = requested_path.parts
        if len(parts) >= 2 and parts[0] == "data" and parts[1] == "storage":
            candidate_paths.insert(0, RESUME_STORAGE_ROOT / Path(*parts[2:]))
        if len(parts) >= 3 and parts[0] == "app" and parts[1] == "data" and parts[2] == "storage":
            candidate_paths.insert(0, RESUME_STORAGE_ROOT / Path(*parts[3:]))

    resolved_path = None
    for candidate_path in candidate_paths:
        candidate_resolved = candidate_path.resolve()
        try:
            candidate_resolved.relative_to(RESUME_STORAGE_ROOT)
        except ValueError:
            continue
        if candidate_resolved.is_file():
            resolved_path = candidate_resolved
            break

    if resolved_path is None:
        requested_path = candidate_paths[0]
        resolved_path = requested_path.resolve()

    try:
        resolved_path.relative_to(RESUME_STORAGE_ROOT)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"file_path must be under RESUME_STORAGE_ROOT: {RESUME_STORAGE_ROOT}",
        )

    if not resolved_path.is_file():
        raise HTTPException(status_code=404, detail=f"Resume file not found: {resolved_path}")

    return resolved_path


def load_resume_documents(file_path: Path) -> list[Document]:
    documents = SimpleDirectoryReader(
        input_files=[str(file_path)],
        file_extractor=file_extractor,
        raise_on_error=True,
    ).load_data()

    if not documents:
        raise HTTPException(status_code=400, detail="No text could be extracted from resume")

    return documents


def load_anonymized_resume_content(file_path: Path) -> str:
    documents = load_resume_documents(file_path)
    return "\n\n".join(
        anonymize_resume_text(document.get_content())
        for document in documents
        if document.get_content().strip()
    )


def prepare_resume_documents(
    documents: list[Document],
    request: IndexResumeRequest,
    file_path: Path,
) -> list[Document]:
    candidate_id = request.candidate_id or request.resume_id
    source_type = file_path.suffix.lower().lstrip(".") or "unknown"

    for index_number, document in enumerate(documents, start=1):
        existing_metadata = dict(document.metadata or {})
        safe_metadata = {
            "job_id": request.job_id,
            "resume_id": request.resume_id,
            "candidate_id": candidate_id,
            "source_type": source_type,
            "parser": existing_metadata.get("parser", "text"),
        }
        if existing_metadata.get("page_number"):
            safe_metadata["page_number"] = existing_metadata["page_number"]

        document.id_ = f"{request.resume_id}:{index_number}"
        document.set_content(anonymize_resume_text(document.get_content()))
        document.metadata = safe_metadata
        document.excluded_embed_metadata_keys = []
        document.excluded_llm_metadata_keys = []

    return documents


def _metadata_where(*conditions: dict[str, Any]) -> dict[str, Any]:
    if len(conditions) == 1:
        return conditions[0]
    return {"$and": list(conditions)}


def delete_indexed_resume(resume_id: str) -> None:
    get_vector_store().client.delete(where={"resume_id": {"$eq": resume_id}})


def count_indexed_chunks(resume_id: str) -> int:
    result = get_vector_store().client.get(where={"resume_id": {"$eq": resume_id}})
    return len(result.get("ids", []))


def get_indexed_chunks(resume_id: str, job_id: Optional[str] = None) -> list[dict[str, Any]]:
    where = {"resume_id": {"$eq": resume_id}}
    if job_id:
        where = _metadata_where(where, {"job_id": {"$eq": job_id}})

    try:
        result = get_vector_store().client.get(where=where, include=["documents", "metadatas"])
    except Exception:
        logger.exception("Chroma filtered get failed; retrying by resume_id only")
        result = get_vector_store().client.get(
            where={"resume_id": {"$eq": resume_id}},
            include=["documents", "metadatas"],
        )

    documents = result.get("documents") or []
    metadatas = result.get("metadatas") or []
    chunks = []
    for content, metadata in zip(documents, metadatas):
        metadata = metadata or {}
        if job_id and metadata.get("job_id") != job_id:
            continue
        chunks.append({"content": content or "", "metadata": metadata})
    return chunks


def get_indexed_resume_content(resume_id: str, job_id: Optional[str] = None) -> str:
    return "\n\n".join(chunk["content"] for chunk in get_indexed_chunks(resume_id, job_id))


def score_to_probability(score: float) -> float:
    return 1 / (1 + math.exp(-score))


def score_resume_contents(job_description: str, contents: list[str]) -> list[float]:
    if not contents:
        return []

    if not RAG_USE_CROSS_ENCODER:
        return lexical_match_scores(job_description, contents)

    pairs = [[job_description, content] for content in contents]
    scores = get_ranker().predict(pairs)
    return [score_to_probability(float(score)) for score in scores]


def lexical_match_scores(job_description: str, contents: list[str]) -> list[float]:
    job_terms = set(re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]{2,}", job_description.lower()))
    if not job_terms:
        return [0.0 for _ in contents]

    scores = []
    for content in contents:
        content_terms = set(re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]{2,}", content.lower()))
        overlap = job_terms.intersection(content_terms)
        scores.append(round(min(len(overlap) / len(job_terms), 1.0), 4))
    return scores


def compact_text(text: str, max_chars: int) -> str:
    normalized = re.sub(r"\s+", " ", text).strip()
    if len(normalized) <= max_chars:
        return normalized
    return normalized[: max_chars - 3].rstrip() + "..."


def analysis_excerpt_budget(candidate_count: int, job_description: str) -> int:
    if candidate_count <= 0:
        return MAX_ANALYSIS_EXCERPT_CHARS

    base_prompt_overhead = 3000
    available = (
        MAX_ANALYSIS_PROMPT_CHARS
        - min(len(job_description), MAX_JOB_DESCRIPTION_CHARS)
        - base_prompt_overhead
    )
    return max(
        MIN_ANALYSIS_EXCERPT_CHARS,
        min(MAX_ANALYSIS_EXCERPT_CHARS, available // candidate_count),
    )


def parse_llm_json_response(response: str) -> Any:
    text = response.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        parsed = json.loads(text[start : end + 1])

    return parsed


def normalize_candidate_analyses(parsed: Any) -> dict[str, dict[str, Any]]:
    if isinstance(parsed, list):
        rows = parsed
    elif isinstance(parsed, dict):
        rows = parsed.get("results") or parsed.get("matches") or parsed.get("candidates") or []
    else:
        return {}

    if not isinstance(rows, list):
        return {}

    analyses = {}
    for row in rows:
        if not isinstance(row, dict):
            continue

        resume_id = str(row.get("resume_id", "")).strip()
        if not resume_id:
            continue

        strengths = row.get("strengths", [])
        if not isinstance(strengths, list):
            strengths = []

        analyses[resume_id] = {
            "summary": str(row.get("summary", "")).strip(),
            "strengths": [
                str(strength).strip()
                for strength in strengths[:2]
                if str(strength).strip()
            ],
            "gap": str(row.get("gap", "")).strip(),
            "recommendation": str(row.get("recommendation", "")).strip(),
        }

    return analyses


def complete_llm(prompt: str) -> str:
    if RAG_LLM_PROVIDER in {"ollama", "local"}:
        ensure_ollama_llm()
        return str(Settings.llm.complete(prompt))

    if RAG_LLM_PROVIDER == "groq":
        if not GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY must be set when RAG_LLM_PROVIDER=groq")

        response = httpx.post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": GROQ_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 1200,
            },
            timeout=60.0,
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

    raise RuntimeError(
        "Unsupported RAG_LLM_PROVIDER. Use 'groq' for online inference or 'ollama' for local inference."
    )


def ensure_ollama_llm() -> None:
    global _ollama_llm_ready
    if _ollama_llm_ready:
        return

    with _rag_lock:
        if _ollama_llm_ready:
            return
        Settings.llm = Ollama(
            model=OLLAMA_MODEL,
            base_url=OLLAMA_BASE_URL,
            request_timeout=60.0,
            context_window=4096,
            additional_kwargs={"num_ctx": 4096},
        )
        _ollama_llm_ready = True


def ensure_embedding_model() -> None:
    global _embedding_model_ready
    if _embedding_model_ready:
        return

    with _rag_lock:
        if _embedding_model_ready:
            return
        logger.info("Loading embedding model: %s", EMBEDDING_MODEL_NAME)
        Settings.embed_model = HuggingFaceEmbedding(model_name=EMBEDDING_MODEL_NAME)
        _embedding_model_ready = True


def get_ranker() -> CrossEncoder:
    global _ranker
    if _ranker is not None:
        return _ranker

    with _rag_lock:
        if _ranker is None:
            logger.info("Loading cross encoder model: %s", CROSS_ENCODER_MODEL)
            _ranker = CrossEncoder(CROSS_ENCODER_MODEL)
        return _ranker


def get_vector_store() -> ChromaVectorStore:
    global _vector_store
    if _vector_store is not None:
        return _vector_store

    with _rag_lock:
        if _vector_store is None:
            Path(CHROMA_DB_PATH).mkdir(parents=True, exist_ok=True)
            _vector_store = ChromaVectorStore.from_params(
                collection_name=CHROMA_COLLECTION_NAME,
                persist_dir=CHROMA_DB_PATH,
            )
        return _vector_store


def get_index() -> VectorStoreIndex:
    global _index
    if _index is not None:
        return _index

    with _rag_lock:
        if _index is None:
            ensure_embedding_model()
            _index = VectorStoreIndex.from_vector_store(get_vector_store())
        return _index


def mock_candidate_analyses(candidates: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    analyses = {}
    for candidate in candidates:
        score = candidate.get("score", 0.0)
        if score >= 0.7:
            recommendation = "strong_match"
        elif score >= 0.4:
            recommendation = "possible_match"
        else:
            recommendation = "weak_match"

        analyses[candidate["resume_id"]] = {
            "summary": "Deterministic explanation generated without an LLM provider.",
            "strengths": ["Resume content was indexed successfully", "Ranking model returned a comparable match score"],
            "gap": "Configure Groq or Ollama for a richer natural-language explanation.",
            "recommendation": recommendation,
        }
    return analyses


def analyze_ranked_candidates(
    job_description: str,
    candidates: list[dict[str, Any]],
) -> tuple[dict[str, dict[str, Any]], Optional[str]]:
    if not candidates:
        return {}, None

    if RAG_LLM_PROVIDER in {"mock", "none", "disabled"}:
        return mock_candidate_analyses(candidates), None

    prompt_candidates = [
        {
            "resume_id": candidate["resume_id"],
            "candidate_id": candidate["candidate_id"],
            "score": round(candidate["score"], 4),
            "resume_excerpt": candidate["excerpt"],
        }
        for candidate in candidates
    ]
    prompt = (
        "You are evaluating resume matches for one job posting.\n"
        "Return ONLY valid JSON. Do not use markdown or add text outside JSON.\n"
        "Return exactly one result for each candidate, preserving resume_id and candidate_id.\n"
        "The score is computed by the ranking model; explain why that score fits the job match.\n"
        "Use this JSON schema:\n"
        '{"results":[{"resume_id":"string","candidate_id":"string",'
        '"summary":"short match analysis","strengths":["strength 1","strength 2"],'
        '"gap":"one potential gap","recommendation":"strong_match | possible_match | weak_match"}]}\n\n'
        f"Job description:\n{compact_text(job_description, MAX_JOB_DESCRIPTION_CHARS)}\n\n"
        f"Candidates JSON:\n{json.dumps(prompt_candidates, ensure_ascii=True)}"
    )

    try:
        parsed = parse_llm_json_response(complete_llm(prompt))
        return normalize_candidate_analyses(parsed), None
    except Exception as exc:
        return {}, f"candidate_analysis_failed: {exc}"


def rank_indexed_applications(
    job_id: str,
    job_description: str,
    application_ids: list[str],
) -> list[dict[str, Any]]:
    results = []
    for application_id in application_ids:
        chunks = get_indexed_chunks(application_id, job_id)
        contents = [chunk["content"] for chunk in chunks if chunk["content"]]
        scores = score_resume_contents(job_description, contents)

        scored_chunks = []
        for index_number, chunk in enumerate(chunks):
            score = scores[index_number] if index_number < len(scores) else 0.0
            scored_chunks.append(
                {
                    "score": round(score, 4),
                    "content": chunk["content"],
                    "page_number": chunk["metadata"].get("page_number"),
                    "parser": chunk["metadata"].get("parser"),
                }
            )

        top_chunks = sorted(scored_chunks, key=lambda chunk: chunk["score"], reverse=True)[:3]
        candidate_id = application_id
        if chunks:
            candidate_id = str(chunks[0]["metadata"].get("candidate_id") or application_id)

        results.append(
            {
                "resume_id": application_id,
                "candidate_id": candidate_id,
                "score": max(scores) if scores else 0.0,
                "content": "\n\n".join(chunk["content"] for chunk in top_chunks),
                "top_chunks": top_chunks,
            }
        )

    return sorted(results, key=lambda row: row["score"], reverse=True)


def normalize_rank_applications(payload: dict[str, Any]) -> list[dict[str, Optional[str]]]:
    raw_applications = payload.get("applications") or []
    applications = []

    if isinstance(raw_applications, list):
        for item in raw_applications:
            if not isinstance(item, dict):
                continue
            application_id = str(item.get("applicationId") or item.get("application_id") or "")
            if not application_id:
                continue
            candidate_id = item.get("candidateAuthUserId") or item.get("candidate_id")
            file_path = item.get("filePath") or item.get("file_path")
            applications.append(
                {
                    "application_id": application_id,
                    "candidate_id": str(candidate_id) if candidate_id else None,
                    "file_path": str(file_path) if file_path else None,
                }
            )

    if applications:
        return applications

    return [
        {"application_id": str(value), "candidate_id": None, "file_path": None}
        for value in payload.get("applicationIds") or []
        if value
    ]


def ensure_rank_inputs_indexed(job_id: str, applications: list[dict[str, Optional[str]]]) -> int:
    indexed_count = 0
    for application in applications:
        application_id = application["application_id"]
        if get_indexed_chunks(application_id, job_id):
            indexed_count += 1
            continue

        file_path = application.get("file_path")
        if not file_path:
            logger.warning("No filePath available to index application %s for ranking", application_id)
            continue

        try:
            result = index_resume(
                IndexResumeRequest(
                    job_id=job_id,
                    resume_id=application_id,
                    candidate_id=application.get("candidate_id") or application_id,
                    file_path=file_path,
                )
            )
            if int(result.get("chunks_indexed") or 0) > 0:
                indexed_count += 1
            logger.info(
                "Indexed missing resume for ranking applicationId=%s chunks=%s",
                application_id,
                result.get("chunks_indexed"),
            )
        except Exception:
            logger.exception("Failed to index application %s during ranking", application_id)

    return indexed_count


def fetch_job_description(job_id: str) -> str:
    try:
        response = httpx.get(f"{JOBS_SERVICE_URL}/api/v1/jobs/{job_id}", timeout=10.0)
        response.raise_for_status()
        data = response.json()
        parts = []
        if data.get("title"):
            parts.append(f"Title: {data['title']}")
        if data.get("description"):
            parts.append(str(data["description"]))
        if data.get("requirements"):
            parts.append(f"Requirements: {data['requirements']}")
        skills = data.get("skills") or []
        if skills:
            parts.append("Skills: " + ", ".join(str(skill) for skill in skills))
        if parts:
            return "\n\n".join(parts)
    except Exception as exc:
        logger.warning("Could not fetch job description for job %s: %s", job_id, exc)

    return f"Job {job_id}"


def _bootstrap_servers() -> list[str]:
    return [server.strip() for server in KAFKA_BOOTSTRAP_SERVERS.split(",") if server.strip()]


def _ensure_producer() -> KafkaProducer:
    global _producer
    with _producer_lock:
        if _producer is None:
            _producer = KafkaProducer(
                bootstrap_servers=_bootstrap_servers(),
                value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
            )
        return _producer


def publish_kafka_event(
    topic: str,
    key: str,
    payload: dict[str, Any],
    type_id: Optional[str] = None,
) -> None:
    try:
        producer = _ensure_producer()
        headers = []
        if type_id:
            headers.append(("__TypeId__", type_id.encode("utf-8")))

        producer.send(
            topic=topic,
            key=key.encode("utf-8"),
            value=payload,
            headers=headers or None,
        )
        producer.flush()
        logger.info("Published Kafka event topic=%s key=%s", topic, key)
    except Exception:
        logger.exception("Failed to publish Kafka event topic=%s key=%s", topic, key)


def _decode_kafka_message(message) -> dict[str, Any]:
    if isinstance(message.value, bytes):
        return json.loads(message.value.decode("utf-8"))
    if isinstance(message.value, str):
        return json.loads(message.value)
    if isinstance(message.value, dict):
        return message.value
    raise ValueError(f"Unsupported Kafka value type: {type(message.value)!r}")


def handle_application_submitted(payload: dict[str, Any]) -> None:
    application_id = str(payload.get("applicationId") or payload.get("application_id") or "")
    job_id = str(payload.get("jobId") or payload.get("job_id") or "")
    candidate_id = payload.get("candidateAuthUserId") or payload.get("candidate_id")
    file_path = payload.get("filePath") or payload.get("file_path")

    if not application_id or not job_id or not file_path:
        logger.warning("Ignoring malformed application.submitted payload: %s", payload)
        return

    try:
        result = index_resume(
            IndexResumeRequest(
                job_id=job_id,
                resume_id=application_id,
                candidate_id=str(candidate_id) if candidate_id else None,
                file_path=str(file_path),
            )
        )
        _parse_statuses[application_id] = {
            "status": "COMPLETED",
            "parseConfidence": None,
            "chunkCount": result.get("chunks_indexed"),
        }
        publish_kafka_event(
            RESUME_PARSE_COMPLETED_TOPIC,
            "resume.parse.completed",
            {
                "applicationId": application_id,
                "status": "COMPLETED",
                "parseConfidence": None,
                "chunkCount": result.get("chunks_indexed"),
            },
        )
    except Exception as exc:
        logger.exception("Failed to index submitted application %s", application_id)
        _parse_statuses[application_id] = {
            "status": "FAILED",
            "parseConfidence": None,
            "chunkCount": 0,
            "error": str(exc),
        }
        publish_kafka_event(
            RESUME_PARSE_COMPLETED_TOPIC,
            "resume.parse.completed",
            {
                "applicationId": application_id,
                "status": "FAILED",
                "error": str(exc),
            },
        )


def handle_rank_request(payload: dict[str, Any]) -> None:
    ranking_job_id = str(payload.get("rankingJobId") or "")
    job_id = str(payload.get("jobId") or "")
    applications = normalize_rank_applications(payload)
    application_ids = [application["application_id"] for application in applications]

    if not ranking_job_id or not job_id or not application_ids:
        logger.warning("Ignoring malformed job.rank.request payload: %s", payload)
        return

    try:
        job_description = fetch_job_description(job_id)
        indexed_count = ensure_rank_inputs_indexed(job_id, applications)
        ranked = rank_indexed_applications(job_id, job_description, application_ids)
        ranked_with_content = sum(1 for row in ranked if row.get("content"))
        if ranked_with_content <= 0:
            raise ValueError("No indexed resume content found for requested applications")

        rankings = [
            {
                "applicationId": row["resume_id"],
                "compositeScore": round(row["score"] * 100, 2),
                "rankingPosition": index_number,
            }
            for index_number, row in enumerate(ranked, start=1)
        ]
        publish_kafka_event(
            JOB_RANK_RESULT_TOPIC,
            "job.rank.result",
            {
                "rankingJobId": ranking_job_id,
                "jobId": job_id,
                "status": "COMPLETED",
                "rankings": rankings,
                "metadata": {
                    "candidateCount": len(rankings),
                    "indexedCandidateCount": indexed_count,
                    "rankedCandidateCount": ranked_with_content,
                    "requestedCandidateCount": len(application_ids),
                    "topApplicationId": rankings[0]["applicationId"] if rankings else None,
                    "scoringScale": "0-100",
                    "service": "hiring-rag-service",
                },
            },
            type_id="com.ats.jobs.dto.RankResultEvent",
        )
    except Exception as exc:
        logger.exception("Ranking failed for rankingJobId=%s", ranking_job_id)
        publish_kafka_event(
            JOB_RANK_RESULT_TOPIC,
            "job.rank.result",
            {
                "rankingJobId": ranking_job_id,
                "jobId": job_id,
                "status": "FAILED",
                "rankings": [],
                "metadata": {"error": str(exc), "service": "hiring-rag-service"},
            },
            type_id="com.ats.jobs.dto.RankResultEvent",
        )


def consume_topic(topic: str, group_id: str, handler) -> None:
    while True:
        try:
            consumer = KafkaConsumer(
                topic,
                bootstrap_servers=_bootstrap_servers(),
                group_id=group_id,
                auto_offset_reset="latest",
                enable_auto_commit=True,
            )
            logger.info("Kafka consumer started topic=%s group=%s", topic, group_id)
            for message in consumer:
                try:
                    handler(_decode_kafka_message(message))
                except Exception:
                    logger.exception("Failed to process Kafka message from topic=%s", topic)
        except Exception as exc:
            logger.warning("Kafka consumer unavailable for topic=%s: %s", topic, exc)
            time.sleep(5)


def start_kafka_consumers() -> None:
    if not KAFKA_ENABLED:
        logger.info("Kafka consumers disabled by KAFKA_ENABLED=false")
        return

    consumers = [
        (
            APPLICATION_SUBMITTED_TOPIC,
            "hiring-rag-parse-group",
            handle_application_submitted,
        ),
        (
            JOB_RANK_REQUEST_TOPIC,
            "hiring-rag-rank-group",
            handle_rank_request,
        ),
    ]
    for topic, group_id, handler in consumers:
        thread = threading.Thread(
            target=consume_topic,
            args=(topic, group_id, handler),
            daemon=True,
            name=f"kafka-{topic}",
        )
        thread.start()


file_extractor = {".pdf": OCRPDFReader(), **{ext: OCRImageReader() for ext in IMAGE_EXTENSIONS}}

RESUME_STORAGE_ROOT.mkdir(parents=True, exist_ok=True)


@app.on_event("startup")
def startup() -> None:
    start_kafka_consumers()


@app.get("/")
def root():
    return {
        "status": "Hiring RAG is online",
        "vector_store": "chroma",
        "indexed_chunks": get_vector_store().client.count(),
        "resume_storage_root": str(RESUME_STORAGE_ROOT),
        "llm_provider": RAG_LLM_PROVIDER,
        "cross_encoder_enabled": RAG_USE_CROSS_ENCODER,
        "ollama_base_url": OLLAMA_BASE_URL,
        "ollama_model": OLLAMA_MODEL,
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/index-resume")
def index_resume(request: IndexResumeRequest):
    file_path = resolve_resume_path(request.file_path)
    documents = prepare_resume_documents(
        load_resume_documents(file_path),
        request,
        file_path,
    )

    delete_indexed_resume(request.resume_id)
    for document in documents:
        get_index().insert(document)

    return {
        "status": "indexed",
        "job_id": request.job_id,
        "resume_id": request.resume_id,
        "candidate_id": request.candidate_id or request.resume_id,
        "documents_indexed": len(documents),
        "chunks_indexed": count_indexed_chunks(request.resume_id),
    }


@app.post("/parse", response_model=ParseResponse)
def parse_resume(request: ParseRequest):
    job_id = request.jobId or "unknown"
    result = index_resume(
        IndexResumeRequest(
            job_id=job_id,
            resume_id=request.applicationId,
            candidate_id=request.candidateId or request.applicationId,
            file_path=request.filePath,
        )
    )
    _parse_statuses[request.applicationId] = {
        "status": "COMPLETED",
        "parseConfidence": None,
        "chunkCount": result.get("chunks_indexed"),
    }
    return ParseResponse(
        status="COMPLETED",
        parsedJsonUrl=f"/parse/{request.applicationId}/status",
        parseConfidence=None,
    )


@app.get("/parse/{application_id}/status", response_model=ParseStatusResponse)
def get_parse_status(application_id: str):
    status = _parse_statuses.get(application_id)
    if not status:
        chunk_count = count_indexed_chunks(application_id)
        if chunk_count <= 0:
            raise HTTPException(status_code=404, detail="Parse result not found.")
        status = {"status": "COMPLETED", "parseConfidence": None, "chunkCount": chunk_count}

    return ParseStatusResponse(
        applicationId=application_id,
        status=status.get("status", "UNKNOWN"),
        parseConfidence=status.get("parseConfidence"),
        chunkCount=status.get("chunkCount"),
    )


@app.post("/rank")
def rank_resume(request: RankRequest):
    filters = MetadataFilters(
        filters=[MetadataFilter(key="job_id", value=request.job_id)]
    )
    retriever = get_index().as_retriever(
        similarity_top_k=request.retrieval_top_k,
        filters=filters,
    )
    nodes = retriever.retrieve(request.job_description)

    if not nodes:
        return {
            "query": request.job_description,
            "job_id": request.job_id,
            "matches": [],
            "message": "No indexed resume content found for this job.",
        }

    contents = [node.node.get_content() for node in nodes]
    scores = score_resume_contents(request.job_description, contents)

    candidates = {}
    for i, node in enumerate(nodes):
        probability = scores[i]
        content = contents[i]
        metadata = node.node.metadata or {}
        resume_id = metadata.get("resume_id", "unknown")
        candidate_id = metadata.get("candidate_id", resume_id)

        candidate = candidates.setdefault(
            resume_id,
            {
                "resume_id": resume_id,
                "candidate_id": candidate_id,
                "score": 0.0,
                "chunks": [],
            },
        )
        candidate["score"] = max(candidate["score"], probability)
        candidate["chunks"].append(
            {
                "score": round(probability, 4),
                "content": content,
                "page_number": metadata.get("page_number"),
                "parser": metadata.get("parser"),
            }
        )

    ranked_candidates = sorted(
        candidates.values(),
        key=lambda candidate: candidate["score"],
        reverse=True,
    )[: request.top_k]

    results = []
    for candidate in ranked_candidates:
        top_chunks = sorted(
            candidate["chunks"],
            key=lambda chunk: chunk["score"],
            reverse=True,
        )[:3]
        content = "\n\n".join(chunk["content"] for chunk in top_chunks)

        results.append(
            {
                "resume_id": candidate["resume_id"],
                "candidate_id": candidate["candidate_id"],
                "score": round(candidate["score"], 4),
                "content": content,
                "top_chunks": top_chunks,
            }
        )

    response = {
        "query": request.job_description,
        "job_id": request.job_id,
        "retrieved_chunks": len(nodes),
        "matched_resumes": len(candidates),
        "matches": results,
    }

    return response


@app.post("/explain")
def explain_resume(request: ExplainRequest):
    content = request.content or get_indexed_resume_content(request.resume_id, request.job_id)

    if not content and request.file_path:
        content = load_anonymized_resume_content(resolve_resume_path(request.file_path))

    if not content:
        raise HTTPException(
            status_code=404,
            detail="No indexed resume content found for this application.",
        )

    score = score_resume_contents(request.job_description, [content])[0]
    analysis_candidates = [
        {
            "resume_id": request.resume_id,
            "candidate_id": request.candidate_id or request.resume_id,
            "score": score,
            "excerpt": compact_text(content, MAX_ANALYSIS_EXCERPT_CHARS),
        }
    ]

    analyses, analysis_error = analyze_ranked_candidates(
        request.job_description,
        analysis_candidates,
    )

    response = {
        "job_description": request.job_description,
        "resume_id": request.resume_id,
        "candidate_id": request.candidate_id or request.resume_id,
        "score": round(score, 4),
        "analysis": analyses.get(request.resume_id),
    }
    if analysis_error:
        response["analysis_error"] = analysis_error

    return response


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=SERVICE_PORT)
