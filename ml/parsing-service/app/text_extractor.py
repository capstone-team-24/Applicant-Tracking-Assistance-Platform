"""Extract raw text from resume files (PDF, DOCX, TXT).

When DEMO_MODE is enabled and the requested file does not exist on disk, a
realistic sample resume text is returned so the rest of the pipeline can be
exercised without real documents.
"""

import logging
import os
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Sample resume used in DEMO_MODE when the real file is missing
# ---------------------------------------------------------------------------

SAMPLE_RESUME_TEXT = """
John A. Smith
Email: john.smith@email.com | Phone: (555) 123-4567
123 Main Street, San Francisco, CA 94102
LinkedIn: linkedin.com/in/johnsmith | GitHub: github.com/johnsmith

SUMMARY
Experienced Full-Stack Software Engineer with 7+ years of expertise in building
scalable web applications and microservices. Proficient in Python, JavaScript,
TypeScript, React, and cloud-native architectures. Strong background in agile
development, CI/CD, and cross-functional team leadership.

SKILLS
Programming Languages: Python, JavaScript, TypeScript, Java, Go, SQL, Bash
Frontend: React, Next.js, Vue.js, Angular, HTML5, CSS3, Tailwind CSS
Backend: FastAPI, Django, Flask, Node.js, Express, Spring Boot
Databases: PostgreSQL, MySQL, MongoDB, Redis, Elasticsearch, Weaviate
Cloud & DevOps: AWS (EC2, S3, Lambda, ECS), Docker, Kubernetes, Terraform,
    GitHub Actions, Jenkins, CircleCI
Tools: Git, Jira, Confluence, Figma, Postman, Grafana, Prometheus

EXPERIENCE
Senior Software Engineer | Acme Corp, San Francisco, CA
January 2021 - Present
- Designed and implemented a microservices architecture serving 2M+ daily
  active users, reducing average API response time by 40%.
- Led migration from monolithic Django application to event-driven services
  using RabbitMQ and FastAPI, improving deployment frequency from weekly to
  multiple times per day.
- Built a real-time analytics dashboard with React and D3.js, enabling
  product managers to make data-driven decisions.
- Mentored a team of 4 junior engineers through code reviews and pair
  programming sessions.

Software Engineer | TechStart Inc, Austin, TX
June 2018 - December 2020
- Developed RESTful APIs in Python/Flask serving 500k requests/day with
  99.9% uptime.
- Implemented Elasticsearch-powered full-text search, reducing query times
  from 2s to 50ms.
- Created automated CI/CD pipelines with GitHub Actions, cutting release
  cycle time by 60%.
- Collaborated with UX team to build accessible React components following
  WCAG 2.1 guidelines.

Junior Developer | WebAgency LLC, Austin, TX
August 2016 - May 2018
- Built responsive web applications using React and Vue.js for 15+ client
  projects.
- Developed server-side rendering solutions with Next.js, improving SEO
  scores by 35%.
- Wrote unit and integration tests with pytest and Jest, achieving 90%+
  code coverage.

EDUCATION
Bachelor of Science in Computer Science
University of Texas at Austin | Graduated May 2016
GPA: 3.7/4.0 | Dean's List (6 semesters)

CERTIFICATIONS
- AWS Certified Solutions Architect - Associate (2023)
- Certified Kubernetes Administrator (CKA) (2022)

PROJECTS
- OpenSource Contributor: Contributed 20+ PRs to popular open-source
  projects including FastAPI and React Query.
- Personal Blog Engine: Built a JAMstack blog with Next.js, MDX, and
  Vercel, averaging 10k monthly visitors.
""".strip()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_text(file_path: str) -> str:
    """Return the plain-text content of a resume file.

    Supports PDF (with OCR fallback), DOCX, and plain-text files.  In
    DEMO_MODE, if the file does not exist, a sample resume is returned.
    """
    path = Path(file_path)

    if not path.exists():
        if settings.DEMO_MODE:
            logger.warning(
                "File not found at %s -- DEMO_MODE active, returning sample resume.",
                file_path,
            )
            return SAMPLE_RESUME_TEXT
        raise FileNotFoundError(f"Resume file not found: {file_path}")

    extension = path.suffix.lower()

    if extension == ".pdf":
        return _extract_from_pdf(path)
    elif extension == ".docx":
        return _extract_from_docx(path)
    elif extension == ".txt":
        return _extract_from_txt(path)
    else:
        logger.warning("Unsupported file extension '%s', attempting plain-text read.", extension)
        return _extract_from_txt(path)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _extract_from_pdf(path: Path) -> str:
    """Extract text from a PDF.  Fall back to OCR for scanned pages."""
    import pdfplumber

    text_parts: list[str] = []

    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            text_parts.append(page_text)

    full_text = "\n".join(text_parts).strip()

    # If the extracted text is very short relative to the number of pages,
    # the PDF is likely scanned -- try OCR.
    if len(full_text) < 100:
        logger.info("PDF text is sparse (%d chars); attempting OCR.", len(full_text))
        full_text = _ocr_pdf(path)

    return full_text


def _ocr_pdf(path: Path) -> str:
    """Run Tesseract OCR on each page image of a PDF."""
    try:
        import pytesseract
        from PIL import Image
        import pdfplumber

        ocr_parts: list[str] = []
        with pdfplumber.open(str(path)) as pdf:
            for page in pdf.pages:
                page_image = page.to_image(resolution=300)
                # pdfplumber's PageImage wraps a PIL Image
                pil_image: Image.Image = page_image.original
                page_text = pytesseract.image_to_string(pil_image)
                ocr_parts.append(page_text)

        return "\n".join(ocr_parts).strip()
    except Exception as exc:
        logger.error("OCR failed for %s: %s", path, exc)
        if settings.DEMO_MODE:
            logger.info("Returning sample resume text as OCR fallback in DEMO_MODE.")
            return SAMPLE_RESUME_TEXT
        raise


def _extract_from_docx(path: Path) -> str:
    """Extract text from a DOCX file using python-docx."""
    from docx import Document

    doc = Document(str(path))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


def _extract_from_txt(path: Path) -> str:
    """Read a plain-text file."""
    return path.read_text(encoding="utf-8", errors="replace").strip()
