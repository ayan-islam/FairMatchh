import hashlib
import json
from pathlib import Path
import stat
import tempfile
import unittest
from zipfile import ZipFile, ZipInfo
from backup_store import MANIFEST, restore, validate


class BackupSafetyTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.backup = self.root / "backup.zip"

    def tearDown(self):
        self.temp.cleanup()

    def archive(self, name="data/mongo/test.wt", content=b"test database bytes", stored=None, extra=None, symlink=False):
        manifest = {"format": "fairmatch-cold-backup-v1", "files": {
            name: {"bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}}}
        with ZipFile(self.backup, "w") as archive:
            entry = ZipInfo(name)
            if symlink: entry.external_attr = (stat.S_IFLNK | 0o777) << 16
            archive.writestr(entry, content if stored is None else stored)
            archive.writestr(MANIFEST, json.dumps(manifest))
            if extra: archive.writestr(extra, b"unlisted")

    def test_roundtrip_includes_hidden_object_metadata_and_keys(self):
        names = {"data/minio/.minio.sys/format.json": b"object store metadata", "data/jwt.key": b"synthetic test key"}
        manifest = {"format": "fairmatch-cold-backup-v1", "files": {n: {"bytes": len(v), "sha256": hashlib.sha256(v).hexdigest()} for n, v in names.items()}}
        with ZipFile(self.backup, "w") as archive:
            for name, value in names.items(): archive.writestr(name, value)
            archive.writestr(MANIFEST, json.dumps(manifest))
        destination = self.root / "recovery"
        restore(self.backup, destination)
        for name, value in names.items(): self.assertEqual((destination / name).read_bytes(), value)

    def test_corrupt_bytes_rejected_before_output_created(self):
        self.archive(content=b"saved", stored=b"wrong")
        destination = self.root / "recovery"
        with self.assertRaises(ValueError): restore(self.backup, destination)
        self.assertFalse(destination.exists())

    def test_unsafe_paths_cannot_escape_recovery(self):
        for name in ("data/../../outside", "/data/file", "data/C:/file", "data/..\\outside", "other/file", "data/./file", "data/NUL.txt", "data/file.", "data/file ", "data/CON"):
            with self.subTest(name=name):
                self.archive(name=name)
                with self.assertRaises(ValueError): validate(self.backup)

    def test_existing_recovery_or_live_folder_never_overwritten(self):
        self.archive()
        destination = self.root / "existing"
        destination.mkdir()
        original = destination / "important.txt"
        original.write_text("keep this")
        with self.assertRaises(ValueError): restore(self.backup, destination)
        self.assertEqual(original.read_text(), "keep this")

    def test_unlisted_payload_rejected(self):
        self.archive(extra="data/unexpected")
        with self.assertRaises(ValueError): validate(self.backup)

    def test_windows_case_aliases_rejected(self):
        self.archive(extra="data/MONGO/TEST.WT")
        with self.assertRaises(ValueError): validate(self.backup)

    def test_symlink_rejected(self):
        self.archive(symlink=True)
        with self.assertRaises(ValueError): validate(self.backup)

    def test_duplicate_entries_rejected(self):
        import warnings
        self.archive()
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            with ZipFile(self.backup, "a") as archive: archive.writestr("data/mongo/test.wt", b"duplicate")
        with self.assertRaises(ValueError): validate(self.backup)


if __name__ == "__main__": unittest.main()
