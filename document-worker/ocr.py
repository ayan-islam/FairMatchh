"""Local-only English/Bangla OCR with bounded page size and execution time."""
from io import BytesIO
from pathlib import Path
import math
import os
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
LOCAL_EXECUTABLE = ROOT / "tools/tesseract/tesseract.exe"
EXECUTABLE = LOCAL_EXECUTABLE if LOCAL_EXECUTABLE.is_file() else Path(os.environ.get("PROGRAMFILES", "C:/Program Files")) / "Tesseract-OCR/tesseract.exe"
MODELS = ROOT / "tools/tesseract/tessdata"

def available():
    return EXECUTABLE.is_file() and all((MODELS / (language + ".traineddata")).is_file() for language in ("eng", "ben"))

def recognize(data: bytes, page_index: int, deadline: float) -> str:
    if not available():
        raise RuntimeError("English/Bangla OCR is not installed on this computer")
    if deadline - time.monotonic() < 1:
        raise TimeoutError("OCR time budget was reached")
    import pypdfium2 as pdfium
    document = pdfium.PdfDocument(data)
    try:
        page = document[page_index]
        try:
            width, height = page.get_size()
            if width <= 0 or height <= 0 or not math.isfinite(width * height):
                raise ValueError("Invalid PDF page dimensions")
            scale = min(200 / 72, math.sqrt(4_000_000 / (width * height)))
            bitmap = page.render(scale=scale)
            try:
                picture = bitmap.to_pil()
                try:
                    encoded = BytesIO(); picture.save(encoded, format="PNG")
                finally:
                    picture.close()
            finally:
                bitmap.close()
        finally:
            page.close()
    finally:
        document.close()
    timeout = min(8, deadline - time.monotonic())
    if timeout < .25:
        raise TimeoutError("OCR time budget was reached")
    environment = os.environ.copy(); environment["OMP_THREAD_LIMIT"] = "1"
    result = subprocess.run([str(EXECUTABLE), "stdin", "stdout", "--tessdata-dir", str(MODELS), "-l", "eng+ben", "--oem", "1", "--psm", "3"],
        input=encoded.getvalue(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout, check=True,
        env=environment, creationflags=subprocess.CREATE_NO_WINDOW if os.name=="nt" else 0)
    return result.stdout.decode("utf-8", errors="replace")
