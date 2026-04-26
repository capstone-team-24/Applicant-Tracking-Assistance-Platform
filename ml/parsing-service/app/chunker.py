"""Split resume text into overlapping chunks with section inference."""

import logging
import re
import uuid
from typing import List

logger = logging.getLogger(__name__)

# Keywords used to infer which resume section a chunk belongs to.
_SECTION_KEYWORDS: dict[str, list[str]] = {
    "experience": [
        "experience", "employment", "work history", "professional background",
        "responsibilities", "accomplishments",
    ],
    "education": [
        "education", "academic", "university", "college", "bachelor",
        "master", "degree", "gpa", "graduated",
    ],
    "skills": [
        "skills", "technical skills", "competencies", "proficiencies",
        "programming languages", "tools",
    ],
    "summary": [
        "summary", "objective", "profile", "about me", "overview",
    ],
    "projects": [
        "projects", "portfolio", "open source", "personal project",
    ],
    "certifications": [
        "certifications", "certificates", "certified", "accreditation",
    ],
}


def _infer_section(text: str) -> str:
    """Return the most likely section label for a chunk of text.

    The inference is based on keyword frequency.  If no keywords match,
    ``"general"`` is returned.
    """
    lower = text.lower()
    best_section = "general"
    best_score = 0

    for section, keywords in _SECTION_KEYWORDS.items():
        score = sum(lower.count(kw) for kw in keywords)
        if score > best_score:
            best_score = score
            best_section = section

    return best_section


def chunk_text(
    text: str,
    chunk_size: int = 1000,
    overlap: int = 200,
) -> List[dict]:
    """Split *text* into overlapping chunks of approximately *chunk_size*
    characters.

    Each returned dict contains:
    - ``chunk_id``: a unique UUID string
    - ``text``: the chunk content
    - ``section``: the inferred resume section
    - ``start_pos``: character start offset in the original text
    - ``end_pos``: character end offset in the original text

    The algorithm tries to break on paragraph boundaries (double newlines)
    when possible, falling back to sentence boundaries, then word boundaries,
    and finally hard character cuts.
    """
    if not text:
        return []

    text_length = len(text)
    chunks: List[dict] = []
    start = 0

    while start < text_length:
        end = min(start + chunk_size, text_length)

        # Try to find a natural break point near the end of the window
        if end < text_length:
            end = _find_break_point(text, start, end, chunk_size)

        chunk_text_str = text[start:end].strip()
        if chunk_text_str:
            chunks.append({
                "chunk_id": str(uuid.uuid4()),
                "text": chunk_text_str,
                "section": _infer_section(chunk_text_str),
                "start_pos": start,
                "end_pos": end,
            })

        # Advance by (chunk_size - overlap) but at least 1 character to avoid
        # infinite loops on very small overlap values.
        step = max(end - start - overlap, 1)
        start = start + step

    logger.info(
        "Chunked %d characters into %d chunks (size=%d, overlap=%d).",
        text_length, len(chunks), chunk_size, overlap,
    )
    return chunks


def _find_break_point(text: str, start: int, end: int, chunk_size: int) -> int:
    """Find the best break point in *text[start:end]*.

    Preference order:
    1. Paragraph boundary (double newline)
    2. Single newline
    3. Sentence boundary (period/question-mark/exclamation followed by space)
    4. Word boundary (space)
    5. Hard cut at *end*
    """
    window = text[start:end]
    search_start = max(0, len(window) - int(chunk_size * 0.3))

    # 1. Paragraph boundary
    idx = window.rfind("\n\n", search_start)
    if idx != -1:
        return start + idx + 2  # include the double newline

    # 2. Single newline
    idx = window.rfind("\n", search_start)
    if idx != -1:
        return start + idx + 1

    # 3. Sentence boundary
    sentence_end = -1
    for match in re.finditer(r"[.!?]\s", window[search_start:]):
        sentence_end = search_start + match.end()
    if sentence_end != -1:
        return start + sentence_end

    # 4. Word boundary
    idx = window.rfind(" ", search_start)
    if idx != -1:
        return start + idx + 1

    # 5. Hard cut
    return end
