"""Private local document adapter: Java owns authorization; MinIO owns file bytes."""
from pathlib import Path
from io import BytesIO
import hmac
import os
import subprocess
import sys
import uuid
import json
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool
from minio import Minio
from minio.error import S3Error

ROOT = Path(__file__).resolve().parents[1]
CONFIG = dict(line.split("=", 1) for line in (ROOT / "data/document-worker.properties").read_text().splitlines() if "=" in line)
BUCKET = os.getenv("FAIRMATCH_DOCUMENT_BUCKET", "fairmatch-documents")
storage = Minio("127.0.0.1:9000", access_key=CONFIG["access"], secret_key=CONFIG["secret"], secure=False)
app = FastAPI(title="FairMatch private document worker", docs_url=None, redoc_url=None, openapi_url=None)
MAX_BYTES = 8 * 1024 * 1024

def authenticated(request: Request):
    if not hmac.compare_digest(request.headers.get("x-worker-key", ""), CONFIG["key"]):
        raise HTTPException(401, "Worker authentication required")

def object_key(document_id: str):
    try:
        return f"cv/{uuid.UUID(document_id)}.pdf"
    except ValueError:
        raise HTTPException(400, "Invalid document reference")

def business_key(document_id: str):
    return object_key(document_id).replace("cv/", "business/", 1)

@app.put("/business-documents/{document_id}", dependencies=[Depends(authenticated)])
async def upload_business(document_id: str, request: Request):
    key = business_key(document_id)
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > MAX_BYTES:
            raise HTTPException(413, "PDF exceeds 8 MB")
    # Reuse the bounded PDF validator; extracted text is neither returned nor saved for business files.
    await run_in_threadpool(parse_document, bytes(data))
    try:
        if not storage.bucket_exists(BUCKET): storage.make_bucket(BUCKET)
        storage.put_object(BUCKET, key, BytesIO(data), len(data), content_type="application/pdf")
    except S3Error as error:
        raise HTTPException(507 if error.code == "XMinioStorageFull" else 503, "Private document storage unavailable")
    return {"stored": True}

@app.get("/business-documents/{document_id}", dependencies=[Depends(authenticated)])
def download_business(document_id: str):
    try:
        response = storage.get_object(BUCKET, business_key(document_id))
        try: return Response(response.read(MAX_BYTES + 1), media_type="application/pdf")
        finally: response.close(); response.release_conn()
    except S3Error as error:
        raise HTTPException(404 if error.code == "NoSuchKey" else 503, "Private document unavailable")

@app.delete("/business-documents/{document_id}", dependencies=[Depends(authenticated)])
def delete_business(document_id: str):
    try: storage.remove_object(BUCKET, business_key(document_id))
    except S3Error: raise HTTPException(503, "Private document deletion unavailable")
    return {"deleted": True}

@app.get("/health")
def health():
    try:
        storage.bucket_exists(BUCKET)
    except Exception:
        raise HTTPException(503, "Object storage is unavailable")
    return {"status": "UP"}

def parse_document(data: bytes, force_ocr: bool = False):
    if not data.startswith(b"%PDF-"):
        raise HTTPException(422, "Upload a valid PDF document")
    # Parsing happens in a disposable process, so a slow or broken PDF cannot hold the API forever.
    try:
        parsed = subprocess.run([sys.executable, str(Path(__file__).with_name("extract_text.py")), *(["--ocr"] if force_ocr else [])], input=bytes(data), stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=25, check=True)
        result = json.loads(parsed.stdout.decode("utf-8"))
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError, ValueError):
        raise HTTPException(422, "Could not read this PDF. Use an unencrypted PDF of at most 10 pages or enter your profile manually.")
    result["status"] = "Needs confirmation" if len(result["text"].strip()) >= 30 else "Needs manual entry"
    return result

@app.put("/documents/{document_id}", dependencies=[Depends(authenticated)])
async def upload(document_id: str, request: Request):
    key = object_key(document_id)
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > MAX_BYTES:
            raise HTTPException(413, "PDF exceeds 8 MB")
    result = await run_in_threadpool(parse_document, bytes(data))
    try:
        if not storage.bucket_exists(BUCKET):
            storage.make_bucket(BUCKET)
        storage.put_object(BUCKET, key, BytesIO(data), len(data), content_type="application/pdf")
    except S3Error as error:
        if error.code == "XMinioStorageFull":
            raise HTTPException(507, "CV storage is full. Free space on the drive containing FairMatch data and try again.")
        raise HTTPException(503, "Document storage is unavailable. Try again.")
    return result

@app.post("/documents/{document_id}/extraction", dependencies=[Depends(authenticated)])
def reextract(document_id: str, ocr: bool = False):
    try:
        response = storage.get_object(BUCKET, object_key(document_id))
        try:
            data = response.read(MAX_BYTES + 1)
        finally:
            response.close()
            response.release_conn()
    except S3Error as error:
        raise HTTPException(404 if error.code == "NoSuchKey" else 503, "Document is unavailable")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "PDF exceeds 8 MB")
    return parse_document(data, ocr)

@app.get("/documents/{document_id}", dependencies=[Depends(authenticated)])
def download(document_id: str):
    try:
        response = storage.get_object(BUCKET, object_key(document_id))
        try:
            return Response(response.read(MAX_BYTES + 1), media_type="application/pdf")
        finally:
            response.close()
            response.release_conn()
    except S3Error as error:
        raise HTTPException(404 if error.code == "NoSuchKey" else 503, "Document is unavailable")

@app.delete("/documents/{document_id}", dependencies=[Depends(authenticated)])
def delete(document_id: str):
    try:
        storage.remove_object(BUCKET, object_key(document_id))
    except S3Error:
        raise HTTPException(503, "Could not remove document from storage")
    return {"deleted": True}
