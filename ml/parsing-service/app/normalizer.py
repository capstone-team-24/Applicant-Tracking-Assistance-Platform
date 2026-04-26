"""Normalize and extract structured information from resume text.

Provides skill canonicalization, contact-info extraction (regex-based), and
date normalisation helpers.
"""

import logging
import re
from datetime import datetime
from typing import List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Canonical skills mapping (~30 common variations)
# ---------------------------------------------------------------------------

SKILLS_MAP: dict[str, str] = {
    # Languages
    "js": "JavaScript",
    "javascript": "JavaScript",
    "ts": "TypeScript",
    "typescript": "TypeScript",
    "py": "Python",
    "python": "Python",
    "python3": "Python",
    "java": "Java",
    "golang": "Go",
    "go": "Go",
    "c#": "C#",
    "csharp": "C#",
    "c++": "C++",
    "cpp": "C++",
    "rb": "Ruby",
    "ruby": "Ruby",
    "rust": "Rust",
    "sql": "SQL",
    "bash": "Bash",
    "shell": "Bash",
    # Frontend
    "react": "React",
    "react.js": "React",
    "reactjs": "React",
    "vue": "Vue.js",
    "vue.js": "Vue.js",
    "vuejs": "Vue.js",
    "angular": "Angular",
    "angularjs": "Angular",
    "next.js": "Next.js",
    "nextjs": "Next.js",
    "html": "HTML",
    "html5": "HTML",
    "css": "CSS",
    "css3": "CSS",
    "tailwind": "Tailwind CSS",
    "tailwindcss": "Tailwind CSS",
    "tailwind css": "Tailwind CSS",
    # Backend
    "node": "Node.js",
    "node.js": "Node.js",
    "nodejs": "Node.js",
    "express": "Express",
    "express.js": "Express",
    "expressjs": "Express",
    "django": "Django",
    "flask": "Flask",
    "fastapi": "FastAPI",
    "spring": "Spring Boot",
    "spring boot": "Spring Boot",
    "springboot": "Spring Boot",
    # Data / ML
    "tensorflow": "TensorFlow",
    "tf": "TensorFlow",
    "pytorch": "PyTorch",
    "torch": "PyTorch",
    "pandas": "Pandas",
    "numpy": "NumPy",
    "scikit-learn": "Scikit-learn",
    "sklearn": "Scikit-learn",
    # Databases
    "postgres": "PostgreSQL",
    "postgresql": "PostgreSQL",
    "mysql": "MySQL",
    "mongo": "MongoDB",
    "mongodb": "MongoDB",
    "redis": "Redis",
    "elasticsearch": "Elasticsearch",
    # DevOps / Cloud
    "aws": "AWS",
    "amazon web services": "AWS",
    "gcp": "Google Cloud",
    "google cloud": "Google Cloud",
    "azure": "Azure",
    "docker": "Docker",
    "k8s": "Kubernetes",
    "kubernetes": "Kubernetes",
    "terraform": "Terraform",
    "jenkins": "Jenkins",
    "git": "Git",
    "github": "GitHub",
    "gitlab": "GitLab",
    "ci/cd": "CI/CD",
    "cicd": "CI/CD",
}

# Pre-compile a lookup keyed by lowercase token for fast matching
_SKILLS_LOOKUP: dict[str, str] = {k.lower(): v for k, v in SKILLS_MAP.items()}

# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
_PHONE_RE = re.compile(
    r"(?:\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}"
)
_NAME_RE = re.compile(r"^([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)")

# Common date patterns
_DATE_PATTERNS = [
    # January 2021, Jan 2021
    (re.compile(r"\b([A-Z][a-z]+)\s+(\d{4})\b"), "%B %Y"),
    (re.compile(r"\b([A-Z][a-z]{2})\s+(\d{4})\b"), "%b %Y"),
    # 01/2021, 1/2021
    (re.compile(r"\b(\d{1,2})/(\d{4})\b"), "%m/%Y"),
    # 2021-01-15
    (re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b"), "%Y-%m-%d"),
    # 01/15/2021
    (re.compile(r"\b(\d{2})/(\d{2})/(\d{4})\b"), "%m/%d/%Y"),
]

# Section header keywords (case-insensitive)
_SECTION_HEADERS = [
    "summary", "objective", "profile",
    "experience", "employment", "work history",
    "education", "academic",
    "skills", "technical skills", "competencies",
    "certifications", "certificates",
    "projects",
    "awards", "honors",
    "publications",
    "languages",
    "references",
]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def normalize_skills(text: str) -> List[str]:
    """Extract skill tokens from *text* and return their canonical forms.

    The function tokenizes the input, tries multi-word matches first, then
    single-word matches, and returns a deduplicated list of canonical skill
    names.
    """
    found: dict[str, str] = {}  # canonical -> canonical (preserves order)

    lower_text = text.lower()

    # 1. Try multi-word matches (sorted longest-first so we match greedily)
    for raw, canonical in sorted(_SKILLS_LOOKUP.items(), key=lambda kv: -len(kv[0])):
        if " " not in raw and "." not in raw and "/" not in raw:
            continue  # handled in single-word pass
        if raw in lower_text:
            found[canonical] = canonical

    # 2. Single-word / token matches
    tokens = re.findall(r"[a-zA-Z0-9#+.]+", lower_text)
    for token in tokens:
        canonical = _SKILLS_LOOKUP.get(token)
        if canonical:
            found[canonical] = canonical

    return list(found.keys())


def extract_structured_data(text: str) -> dict:
    """Parse *text* into a structured dict with contact info, skills,
    education, and employment history.
    """
    lines = text.strip().splitlines()

    name = _extract_name(lines)
    email = _extract_email(text)
    phone = _extract_phone(text)
    skills = normalize_skills(text)

    sections = _split_into_sections(lines)

    education = _extract_education(sections)
    employment = _extract_employment(sections)

    return {
        "name": name,
        "email": email,
        "phone": phone,
        "skills": skills,
        "education": education,
        "employment": employment,
        "raw_sections": {k: v for k, v in sections.items()},
    }


def normalize_dates(text: str) -> str:
    """Attempt to convert recognizable date substrings in *text* to ISO-8601
    format (``YYYY-MM-DD`` or ``YYYY-MM``).  Unrecognized portions are left
    unchanged.
    """
    result = text

    # Full dates first (most specific patterns)
    for pattern, fmt in _DATE_PATTERNS:
        def _replacer(match: re.Match, _fmt: str = fmt) -> str:
            try:
                dt = datetime.strptime(match.group(0), _fmt)
                if "%d" in _fmt:
                    return dt.strftime("%Y-%m-%d")
                return dt.strftime("%Y-%m")
            except ValueError:
                return match.group(0)
        result = pattern.sub(_replacer, result)

    return result


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _extract_name(lines: list[str]) -> Optional[str]:
    """Heuristically grab the candidate's name from the first few lines."""
    for line in lines[:5]:
        line = line.strip()
        if not line:
            continue
        match = _NAME_RE.match(line)
        if match:
            return match.group(1).strip()
    # Fallback: return the first non-empty line if it looks name-like
    for line in lines[:3]:
        stripped = line.strip()
        if stripped and len(stripped.split()) <= 5 and not _EMAIL_RE.search(stripped):
            return stripped
    return None


def _extract_email(text: str) -> Optional[str]:
    match = _EMAIL_RE.search(text)
    return match.group(0) if match else None


def _extract_phone(text: str) -> Optional[str]:
    match = _PHONE_RE.search(text)
    return match.group(0).strip() if match else None


def _split_into_sections(lines: list[str]) -> dict[str, list[str]]:
    """Split the resume lines into named sections based on header keywords."""
    sections: dict[str, list[str]] = {}
    current_section = "header"
    sections[current_section] = []

    for line in lines:
        stripped = line.strip().lower()
        matched_section = None
        for header in _SECTION_HEADERS:
            # A section header is typically a line that starts with the
            # keyword and is relatively short.
            if stripped.startswith(header) and len(stripped) < len(header) + 20:
                matched_section = header
                break
        if matched_section:
            current_section = matched_section
            if current_section not in sections:
                sections[current_section] = []
        else:
            sections.setdefault(current_section, []).append(line)

    # Strip empty leading/trailing lines from each section
    for key in sections:
        while sections[key] and not sections[key][0].strip():
            sections[key].pop(0)
        while sections[key] and not sections[key][-1].strip():
            sections[key].pop()

    return sections


def _extract_education(sections: dict[str, list[str]]) -> list[dict]:
    """Pull structured education entries from the education section."""
    edu_lines = sections.get("education", []) or sections.get("academic", [])
    if not edu_lines:
        return []

    entries: list[dict] = []
    current_entry: dict = {}
    for line in edu_lines:
        stripped = line.strip()
        if not stripped:
            if current_entry:
                entries.append(current_entry)
                current_entry = {}
            continue

        # Heuristic: lines with a year are likely degree/institution lines
        year_match = re.search(r"\b(19|20)\d{2}\b", stripped)
        if year_match and "institution" not in current_entry:
            current_entry["institution"] = stripped
            current_entry["year"] = year_match.group(0)
        elif "degree" not in current_entry:
            current_entry["degree"] = stripped
        else:
            current_entry.setdefault("details", []).append(stripped)

    if current_entry:
        entries.append(current_entry)

    return entries


def _extract_employment(sections: dict[str, list[str]]) -> list[dict]:
    """Pull structured employment entries from the experience section."""
    exp_lines = (
        sections.get("experience", [])
        or sections.get("employment", [])
        or sections.get("work history", [])
    )
    if not exp_lines:
        return []

    entries: list[dict] = []
    current_entry: dict = {}

    for line in exp_lines:
        stripped = line.strip()
        if not stripped:
            if current_entry:
                entries.append(current_entry)
                current_entry = {}
            continue

        # Lines containing a date range are likely position headers
        date_range_match = re.search(
            r"((?:January|February|March|April|May|June|July|August|September|"
            r"October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|"
            r"Nov|Dec)\s+\d{4})\s*[-\u2013]\s*(Present|(?:January|February|"
            r"March|April|May|June|July|August|September|October|November|"
            r"December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})",
            stripped,
            re.IGNORECASE,
        )

        if date_range_match and "title" not in current_entry:
            current_entry["title"] = stripped
            current_entry["start_date"] = date_range_match.group(1)
            current_entry["end_date"] = date_range_match.group(2)
        elif stripped.startswith("- ") or stripped.startswith("* "):
            current_entry.setdefault("bullets", []).append(stripped.lstrip("-* ").strip())
        elif "title" not in current_entry:
            current_entry["title"] = stripped
        else:
            current_entry.setdefault("details", []).append(stripped)

    if current_entry:
        entries.append(current_entry)

    return entries
