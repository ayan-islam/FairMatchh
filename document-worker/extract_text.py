"""Extract page evidence and verbatim section suggestions; never infer qualifications."""
import sys
import json
import re
import time
import subprocess
from io import BytesIO
from pypdf import PdfReader
from ocr import recognize, available as ocr_available

MAX_BYTES = 8 * 1024 * 1024
MAX_TEXT = 24000
HEADINGS = {
    "education": {"education", "academic qualifications", "academic qualification", "academic background", "educational qualifications", "educational qualification", "শিক্ষাগত যোগ্যতা", "শিক্ষা"},
    "experience": {"experience", "work experience", "professional experience", "employment history", "career history", "কর্ম অভিজ্ঞতা", "কাজের অভিজ্ঞতা", "অভিজ্ঞতা"},
    "skills": {"skills", "technical skills", "key skills", "professional skills", "দক্ষতা", "প্রযুক্তিগত দক্ষতা"},
    "role": {"current position", "current role", "job title", "বর্তমান পদ"},
}
STOP_HEADINGS = {"references", "reference", "personal information", "personal details", "contact", "contact information", "languages", "interests", "hobbies", "declaration", "objective", "career objective", "summary", "professional summary", "projects", "certifications", "awards", "রেফারেন্স", "ব্যক্তিগত তথ্য", "যোগাযোগ", "ভাষা"}
LIMITS = {"role": 160, "education": 1000, "experience": 6000, "skills": 1800}

def normalize_heading(line: str) -> str:
    return re.sub(r"\s+", " ", line.strip().strip(":：")).casefold()

def suggestions(pages: list[dict]) -> list[dict]:
    """Only a recognized heading starts a suggestion. Source offsets refer to returned page text."""
    result = []
    for page in pages:
        active = None
        start = None
        end = None
        offset = 0
        def flush():
            if active is not None and start is not None and end is not None and end > start:
                value = page["text"][start:end]
                result.append({"field": active, "value": value[:LIMITS[active]], "page": page["number"], "start": start, "end": min(end, start + LIMITS[active]), "method": "section-heading"})
        for raw in page["text"].splitlines(keepends=True):
            line = raw.strip()
            heading = normalize_heading(line)
            kind = next((field for field, names in HEADINGS.items() if heading in names), None)
            # Some CVs place the heading and content on one line: 'Skills: Java, SQL'.
            inline = re.match(r"^([^:：]{1,60})[:：]\s*(.+)$", line)
            inline_kind = next((field for field,names in HEADINGS.items() if inline and normalize_heading(inline.group(1)) in names), None)
            if kind or inline_kind or heading in STOP_HEADINGS:
                flush()
                active = kind or inline_kind
                start = end = None
                if inline_kind:
                    start = offset + raw.index(inline.group(2))
                    end = start + len(inline.group(2))
            elif active and line:
                if start is None:
                    start = offset + len(raw) - len(raw.lstrip())
                end = offset + len(raw.rstrip())
            offset += len(raw)
        flush()
    return result[:40]

def extract(data: bytes, force_ocr: bool = False) -> dict:
    if len(data) > MAX_BYTES:
        raise ValueError("PDF exceeds 8 MB")
    reader = PdfReader(BytesIO(data))
    if reader.is_encrypted or not 1 <= len(reader.pages) <= 10:
        raise ValueError("Use an unencrypted PDF of one to ten pages")
    pages = []
    warnings = []
    remaining = MAX_TEXT
    deadline = time.monotonic() + 20
    for number, page in enumerate(reader.pages, 1):
        raw = (page.extract_text() or "").replace("\x00", "")
        method = "embedded-text"
        if (force_ocr or len(raw.strip()) < 60) and page.get_contents() is not None:
            if ocr_available():
                try:
                    recognized = recognize(data, number - 1, deadline)
                    if recognized.strip():
                        raw = recognized; method = "tesseract-eng-ben"
                        warnings.append(f"Page {number}: OCR may misread words or reading order. Compare it with the original PDF before confirming.")
                except (RuntimeError, ValueError, TimeoutError, subprocess.SubprocessError):
                    warnings.append(f"Page {number}: OCR could not finish within the processing limits. Check the original and enter missing details manually.")
            else:
                warnings.append(f"Page {number}: local English/Bangla OCR is unavailable. Install the documented OCR dependencies or enter details manually.")
        text = raw[:min(6000, remaining)]
        remaining -= len(text)
        truncated = len(text) < len(raw)
        pages.append({"number": number, "text": text, "method": method, "truncated": truncated})
        if truncated:
            warnings.append(f"Page {number}: text shortened to the extraction limit. Check the original PDF.")
        if len(text.strip()) < 30:
            warnings.append(f"Page {number}: little readable text. Check the original PDF and use manual entry if needed.")
    return {"text": "\n\n".join(p["text"] for p in pages), "pages": pages,
            "suggestions": suggestions(pages), "warnings": warnings, "extractionVersion": 3}

if __name__ == "__main__":
    sys.stdout.buffer.write(json.dumps(extract(sys.stdin.buffer.read(MAX_BYTES + 1), "--ocr" in sys.argv), ensure_ascii=False).encode("utf-8"))
