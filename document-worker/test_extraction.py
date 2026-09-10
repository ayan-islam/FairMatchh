"""Deterministic extraction checks using generated PDF fixtures, not personal CVs."""
import unittest
from unittest.mock import patch
from pathlib import Path
from io import BytesIO
from pypdf import PdfWriter
from extract_text import extract, suggestions
from ocr import available

class ExtractionTests(unittest.TestCase):
    def page(self, text, number=1):
        return {"number": number, "text": text, "method": "embedded-text", "truncated": False}

    def test_sections_have_exact_page_sources_and_stop_at_contact(self):
        text = "CV\nWork Experience\nBuilt Java APIs\nEducation\nBSc in CSE\nContact\nprivate@example.test\nSkills: Java, SQL\n"
        page = self.page(text, 2)
        result = suggestions([page])
        self.assertEqual([s["field"] for s in result], ["experience", "education", "skills"])
        self.assertEqual(result[1]["value"], "BSc in CSE")
        for item in result:
            self.assertEqual(item["page"], 2)
            self.assertEqual(item["value"], text[item["start"]:item["end"]])
            self.assertNotIn("private@example.test", item["value"])

    def test_unlabelled_claims_are_not_inferred_as_qualifications(self):
        self.assertEqual(suggestions([self.page("A person who enjoys Java and dreams of being an engineer")]), [])

    def test_bangla_headings_preserve_unicode_source(self):
        text = "শিক্ষাগত যোগ্যতা\nকম্পিউটার সায়েন্স\nদক্ষতা\nপাইথন\n"
        result = suggestions([self.page(text)])
        self.assertEqual([s["field"] for s in result], ["education", "skills"])
        for item in result:
            self.assertEqual(item["value"], text[item["start"]:item["end"]])

    def test_page_boundaries_and_field_limits_are_explicit(self):
        result = suggestions([self.page("Education\n"+"A"*1500), self.page("This page has no section heading", 2)])
        self.assertEqual(len(result), 1)
        self.assertEqual(len(result[0]["value"]), 1000)
        self.assertEqual(result[0]["end"]-result[0]["start"], 1000)

    def test_blank_scan_is_kept_with_manual_entry_warning(self):
        writer = PdfWriter();writer.add_blank_page(width=300,height=300)
        stream = BytesIO();writer.write(stream)
        result = extract(stream.getvalue())
        self.assertEqual(result["extractionVersion"],3)
        self.assertEqual(len(result["pages"]),1)
        self.assertFalse(result["suggestions"])
        self.assertIn("manual entry",result["warnings"][0])

    def test_encrypted_overlong_empty_and_invalid_pdfs_are_rejected(self):
        for count, encrypted in [(11,False),(1,True),(0,False)]:
            writer=PdfWriter()
            for _ in range(count):writer.add_blank_page(width=300,height=300)
            if encrypted:writer.encrypt("test-only")
            stream=BytesIO();writer.write(stream)
            with self.assertRaises(ValueError):extract(stream.getvalue())
        with self.assertRaises(Exception):extract(b"not a pdf")

    def scan(self, language):
        return (Path(__file__).parent / "tests/fixtures" / (language + ".pdf")).read_bytes()

    @unittest.skipUnless(available(), "Install the documented English/Bangla OCR dependencies")
    def test_real_english_scan_has_verbatim_ocr_sources(self):
        result = extract(self.scan("english"))
        self.assertEqual(result["pages"][0]["method"], "tesseract-eng-ben")
        self.assertIn("Software Engineer", result["text"])
        self.assertEqual([s["field"] for s in result["suggestions"]], ["role", "education", "skills"])
        for item in result["suggestions"]:
            self.assertEqual(item["value"], result["pages"][0]["text"][item["start"]:item["end"]])
        self.assertIn("OCR may misread", result["warnings"][0])

    @unittest.skipUnless(available(), "Install the documented English/Bangla OCR dependencies")
    def test_real_bangla_scan_preserves_readable_unicode_with_warning(self):
        result = extract(self.scan("bangla"))
        self.assertEqual(result["pages"][0]["method"], "tesseract-eng-ben")
        self.assertIn("কম্পিউটার বিজ্ঞান", result["text"])
        self.assertIn("বাংলা ভাষা", result["text"])
        self.assertTrue(result["warnings"])
        # OCR is imperfect; unknown/misread headings must never become invented skills.
        for item in result["suggestions"]:
            self.assertEqual(item["value"], result["pages"][0]["text"][item["start"]:item["end"]])

    def test_unavailable_ocr_returns_manual_entry_without_inventing_text(self):
        with patch("extract_text.ocr_available", return_value=False):
            result = extract(self.scan("english"))
        self.assertEqual(result["text"], "")
        self.assertEqual(result["suggestions"], [])
        self.assertTrue(any("unavailable" in w for w in result["warnings"]))

    def test_ocr_timeout_preserves_manual_entry_and_does_not_abort_document(self):
        with patch("extract_text.ocr_available", return_value=True), patch("extract_text.recognize", side_effect=TimeoutError):
            result = extract(self.scan("english"))
        self.assertEqual(len(result["pages"]), 1)
        self.assertEqual(result["suggestions"], [])
        self.assertTrue(any("processing limits" in w for w in result["warnings"]))

if __name__ == "__main__": unittest.main()
