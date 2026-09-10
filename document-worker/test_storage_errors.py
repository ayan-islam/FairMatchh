"""Storage fault checks without writing to the local MinIO bucket."""
import asyncio
import unittest
from unittest.mock import patch
from fastapi import HTTPException
from minio.error import S3Error
from app import upload

class SyntheticRequest:
    async def stream(self):
        yield b"%PDF-test"

class StorageErrorsTests(unittest.TestCase):
    def test_full_drive_returns_actionable_error_without_success(self):
        full = S3Error(response=None, code="XMinioStorageFull", message="Disk threshold", resource="", request_id="", host_id="")
        with patch("app.parse_document", return_value={"text":"test"}), patch("app.storage.bucket_exists", return_value=True), patch("app.storage.put_object", side_effect=full):
            with self.assertRaises(HTTPException) as result:
                asyncio.run(upload("00000000-0000-4000-8000-000000000001",SyntheticRequest()))
        self.assertEqual(result.exception.status_code,507)
        self.assertIn("Free space",result.exception.detail)

if __name__ == "__main__": unittest.main()
