"""Cold local-store backups. Archives include private data and keys; never upload them publicly."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath, PureWindowsPath
import shutil
import socket
import stat
import sys
import time
from datetime import datetime, timezone
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = "backup-manifest.json"
MAX_FILES = 100_000
MAX_TOTAL = 100 * 1024**3


def digest_file(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def database_inventory(port=27018):
    from pymongo import MongoClient
    from bson import json_util
    with MongoClient(f"mongodb://127.0.0.1:{port}/?directConnection=true", serverSelectionTimeoutMS=5000) as client:
        result = {}
        for name in sorted(client.list_database_names()):
            if name in {"admin", "config", "local"}:
                continue
            collections = {}
            for collection in sorted(client[name].list_collection_names()):
                checksum, count = hashlib.sha256(), 0
                for record in client[name][collection].find().sort("_id", 1):
                    checksum.update(json_util.dumps(record, sort_keys=True, json_options=json_util.CANONICAL_JSON_OPTIONS).encode("utf-8") + b"\n")
                    count += 1
                collections[collection] = {"count": count, "sha256": checksum.hexdigest()}
            result[name] = collections
        return result


def prepare(snapshot=None):
    from pymongo import MongoClient
    from pymongo.errors import AutoReconnect
    if snapshot is not None:
        snapshot.write_text(json.dumps(database_inventory(), indent=2), encoding="utf-8")
    with MongoClient("mongodb://127.0.0.1:27018/?directConnection=true", serverSelectionTimeoutMS=5000) as client:
        try:
            # MongoDB checkpoints and closes its files. Never copy a running WiredTiger store.
            client.admin.command("shutdown", force=True, timeoutSecs=15)
        except AutoReconnect:
            pass  # The server closes the connection when shutdown succeeds; check the port below.
    for _ in range(60):
        if not listening(27018):
            return
        time.sleep(.5)
    raise RuntimeError("MongoDB did not shut down; backup cancelled.")


def listening(port):
    with socket.socket() as sock:
        sock.settimeout(.25)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def safe_name(name):
    path = PurePosixPath(name)
    if (not isinstance(name, str) or "\\" in name or ":" in name or path.is_absolute()
            or any(part in {"", ".", ".."} for part in name.split("/"))
            or len(path.parts) < 2 or path.parts[0] != "data"
            or any(part.endswith((".", " ")) or PureWindowsPath(part).is_reserved()
                   or any(ord(char) < 32 for char in part) for part in path.parts)):
        raise ValueError("Archive has an unsafe file path.")
    return path


def manifest_for(archive):
    infos = archive.infolist()
    names = [entry.filename for entry in infos]
    if len(names) != len({name.casefold() for name in names}) or len(names) > MAX_FILES or MANIFEST not in names:
        raise ValueError("Duplicate/missing entries or too many files in backup.")
    if archive.getinfo(MANIFEST).file_size > 32 * 1024**2:
        raise ValueError("Backup manifest is too large.")
    manifest = json.loads(archive.read(MANIFEST))
    files = manifest.get("files", {})
    if manifest.get("format") != "fairmatch-cold-backup-v1" or not isinstance(files, dict) or not files:
        raise ValueError("This is not a supported FairMatch backup.")
    if set(names) != set(files) | {MANIFEST}:
        raise ValueError("Backup entries do not match its manifest.")
    total = 0
    for name, expected in files.items():
        safe_name(name)
        entry = archive.getinfo(name)
        if entry.is_dir() or stat.S_ISLNK(entry.external_attr >> 16) or entry.flag_bits & 1:
            raise ValueError("Unsupported archive entry.")
        if entry.file_size != expected["bytes"] or entry.file_size < 0:
            raise ValueError("Backup size mismatch.")
        total += entry.file_size
    if total > MAX_TOTAL:
        raise ValueError("Backup exceeds the 100 GB restore limit.")
    return manifest, total


def validate(path):
    with ZipFile(path) as archive:
        manifest, total = manifest_for(archive)
        for name, expected in manifest["files"].items():
            with archive.open(name) as stream:
                if hashlib.file_digest(stream, "sha256").hexdigest() != expected["sha256"]:
                    raise ValueError(f"Backup checksum failed: {name}")
    return manifest, total


def create(destination, snapshot):
    if any(listening(port) for port in (3000, 8080, 8090, 9000, 27018)):
        raise RuntimeError("FairMatch must be stopped by BACKUP_FAIRMATCH.ps1 before copying data.")
    source = (ROOT / "data").resolve()
    destination = destination.resolve()
    if destination.is_relative_to(source):
        raise ValueError("Save backups outside the live data directory.")
    destination.mkdir(parents=True, exist_ok=True)
    files = sorted(path for path in source.rglob("*") if path.is_file())
    # Reject links/junctions rather than following them outside the intended data directory.
    for path in [source, *source.rglob("*")]:
        if path.is_symlink() or path.is_junction() or not path.resolve().is_relative_to(source):
            raise ValueError("Backup source contains a link or junction; backup stopped.")
    total = sum(path.stat().st_size for path in files)
    if len(files) >= MAX_FILES or total > MAX_TOTAL:
        raise ValueError("Local store exceeds backup limits.")
    if shutil.disk_usage(destination).free < total + 256 * 1024**2:
        raise RuntimeError("Not enough free space for a verified backup.")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    final = destination / f"FairMatch-{timestamp}.zip"
    partial = final.with_suffix(".partial")
    manifest = {"format": "fairmatch-cold-backup-v1", "createdAt": timestamp,
                "mongoMajor": 8, "private": True, "files": {},
                "databases": json.loads(snapshot.read_text(encoding="utf-8"))}
    with ZipFile(partial, "x", compression=ZIP_DEFLATED, compresslevel=3) as archive:
        for path in files:
            name = "data/" + path.relative_to(source).as_posix()
            manifest["files"][name] = {"bytes": path.stat().st_size, "sha256": digest_file(path)}
            archive.write(path, name)
        archive.writestr(MANIFEST, json.dumps(manifest, indent=2))
    validate(partial)
    partial.rename(final)
    (ROOT / "logs/last-backup.json").write_text(json.dumps({"path": str(final), "createdAt": timestamp,
        "files": len(files), "uncompressedBytes": total, "verified": True}, indent=2), encoding="utf-8")
    print(f"Verified backup: {final}")


def restore(backup, destination):
    destination = destination.resolve()
    if destination.exists():
        raise ValueError("Recovery folder already exists. Choose a new folder; existing data is never overwritten.")
    if destination.is_relative_to((ROOT / "data").resolve()):
        raise ValueError("Recovery folder must be outside the live data directory.")
    if not destination.parent.is_dir():
        raise ValueError("The recovery folder's parent directory must already exist.")
    manifest, total = validate(backup)  # Verify everything before creating any output.
    if shutil.disk_usage(destination.parent).free < total + 256 * 1024**2:
        raise RuntimeError("Not enough free space to restore this backup.")
    destination.mkdir()  # No exist_ok: a concurrent creation is a failure, never an overwrite.
    with ZipFile(backup) as archive:
        for name, expected in manifest["files"].items():
            target = destination.joinpath(*safe_name(name).parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(name) as source, target.open("xb") as output:
                shutil.copyfileobj(source, output, length=1024 * 1024)
            if digest_file(target) != expected["sha256"]:
                raise ValueError("Restored file checksum mismatch. Do not use this incomplete recovery folder.")
    (destination / MANIFEST).write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (destination / "RECOVERY_README.txt").write_text(
        "Verified FairMatch data recovery. The original installation was not changed.\n"
        "This folder contains private data, password hashes and service keys. Keep it private.\n"
        "See BACKUP_AND_RECOVERY_GUIDE.md in the original project for activation instructions.\n"
        "Use the same project build and MongoDB 8.0 to rehearse before replacing an installation.\n", encoding="utf-8")
    print(f"Verified recovery folder: {destination}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("prepare"); p.add_argument("snapshot", type=Path)
    sub.add_parser("shutdown")
    p = sub.add_parser("create"); p.add_argument("destination", type=Path); p.add_argument("snapshot", type=Path)
    p = sub.add_parser("verify"); p.add_argument("backup", type=Path)
    p = sub.add_parser("restore"); p.add_argument("backup", type=Path); p.add_argument("destination", type=Path)
    args = parser.parse_args()
    if args.command == "prepare": prepare(args.snapshot)
    elif args.command == "shutdown": prepare()
    elif args.command == "create": create(args.destination, args.snapshot)
    elif args.command == "verify":
        manifest, total = validate(args.backup)
        print(f"Backup verified: {len(manifest['files'])} files, {total} bytes.")
    elif args.command == "restore": restore(args.backup, args.destination)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Backup/recovery stopped: {error}", file=sys.stderr)
        sys.exit(1)
