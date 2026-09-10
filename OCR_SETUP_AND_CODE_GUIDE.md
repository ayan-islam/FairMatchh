# FairMatch: local English and Bangla CV OCR

The installed project can now read image-only PDF pages using real Tesseract OCR. Processing stays on this laptop. No external AI account, API key or payment is needed to read a CV.

## How to demonstrate it

1. Start `START_FAIRMATCH.cmd` and sign in as a candidate.
2. Open Documents and upload a PDF CV, up to 8 MB and ten pages. Pages with fewer than 60 embedded text characters automatically use OCR.
3. Review the page text and its warnings. Suggestions only come from recognized section headings.
4. Open a suggestion's source, copy it into the editable form and correct any reading errors.
5. Check the confirmation box and save. Reload Profile to show the saved fields.
6. For an existing CV with broken embedded text, choose **Read with OCR**. This rereads the original PDF. Your confirmed profile and submitted applications remain unchanged.

Use your own CV for the demonstration. The synthetic English/Bangla PDFs in `document-worker/tests/fixtures` are for development tests and are not added to the main application database.

## Explain the code to your teacher

The browser sends an authenticated request to Java. `DocumentController.java` checks that the document belongs to the signed-in candidate. Java asks the internal FastAPI worker to read the private MinIO object; the browser cannot call that worker without its internal key.

`document-worker/extract_text.py` first reads embedded PDF text with pypdf. For a scanned page, `ocr.py` renders it with pypdfium2 and passes PNG bytes to Tesseract using the English and Bengali models. `Read with OCR` requests this process even when the PDF already contains text. OCR output is marked `tesseract-eng-ben`; normal text is marked `embedded-text`.

The extractor recognizes headings and proposes verbatim text with page numbers and source offsets. It returns extraction version 3. Java stores that metadata in MongoDB. The original PDF stays private in MinIO. The frontend highlights the source and lets the candidate edit or ignore each suggestion. Only the separate confirmation endpoint saves profile fields.

This is document transcription, not a qualification check or hiring model. OCR can misread letters, especially Bangla joined characters, and unfamiliar headings or multi-column layouts can produce poor section boundaries. The test Bangla scan read useful words but misread one heading; the application keeps the original output and shows a warning rather than silently inventing a correction. A candidate must check the original PDF.

## Processing limits

- PDF: 8 MB, one to ten pages, unencrypted.
- Rendering: at most four million pixels per page, up to 200 DPI.
- Tesseract: one CPU thread, at most eight seconds per page within a twenty-second OCR budget.
- Disposable parser: twenty-five-second timeout. A timed-out OCR page retains any embedded text and shows a manual-entry warning.
- Returned content: 6,000 characters per page and a 24,000-character content budget, with explicit truncation warnings.

## Installed dependencies

Tesseract 5.4.0 is installed at `C:\Program Files\Tesseract-OCR\tesseract.exe`. The worker also supports a project-local executable at `tools\tesseract\tesseract.exe`. The `eng.traineddata` and `ben.traineddata` files are stored in `tools\tesseract\tessdata`.

`document-worker/ocr-models.json` records the official model repository revision, downloaded sizes and SHA-256 checksums. Python dependencies are pinned in `document-worker/requirements.txt`.

To restore on another Windows computer, install Python 3.12 and Tesseract, then run these commands from the FairMatch project folder in PowerShell:

```powershell
winget install --id UB-Mannheim.TesseractOCR --exact --source winget
py -3.12 -m venv document-worker\.venv
.\document-worker\.venv\Scripts\python.exe -m pip install -r document-worker\requirements.txt
.\document-worker\.venv\Scripts\python.exe tools\install_ocr_models.py
.\START_FAIRMATCH.cmd
```

The installer needs internet. Reading CVs after installation does not. If OCR is unavailable, readable embedded PDF text still works and image-only pages offer manual entry.

## Verification

Ten Python tests pass, including actual English and Bangla image-only PDFs, source spans, missing OCR, timeout fallback and invalid PDF limits. The backend integration test also exercises forced OCR through the authenticated Java endpoint, denies another candidate access and verifies that an already confirmed profile is unchanged. These checks use synthetic fixtures and isolated test databases.

Run Python tests from the project folder:

```powershell
Set-Location document-worker
.\.venv\Scripts\python.exe -m unittest -v test_extraction
```

The two real OCR tests are explicitly skipped when OCR dependencies are absent; a skipped run does not verify OCR. This laptop's verification ran all ten tests without skips.

## Primary references

- Official Tesseract installation guidance: https://tesseract-ocr.github.io/tessdoc/Installation.html
- Official language models: https://github.com/tesseract-ocr/tessdata_fast
- Language/model documentation: https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html
