"""Open recovered stores on isolated loopback ports and verify actual records and CV downloads."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import time
from minio import Minio
from pymongo import MongoClient
from pymongo.errors import AutoReconnect
from backup_store import ROOT, MANIFEST, database_inventory, digest_file, listening, safe_name


def rehearse(recovery):
    recovery = recovery.resolve()
    if recovery == ROOT or recovery.is_relative_to(ROOT / "data"):
        raise ValueError("Rehearsal requires a separate restored folder.")
    manifest = json.loads((recovery / MANIFEST).read_text(encoding="utf-8"))
    # This must be a fresh extraction. Starting MongoDB/MinIO changes their physical store files.
    for name, expected in manifest["files"].items():
        path = recovery.joinpath(*safe_name(name).parts)
        if path.is_symlink() or path.is_junction() or not path.resolve().is_relative_to(recovery):
            raise ValueError("Recovery contains an unsafe path.")
        if digest_file(path) != expected["sha256"]:
            raise ValueError("Recovery was modified or already rehearsed. Restore into another new folder first.")
    if any(listening(port) for port in (27019, 9010, 9011)):
        raise RuntimeError("Rehearsal ports 27019/9010/9011 must be free; no process was stopped.")
    config = dict(line.split("=", 1) for line in (recovery / "data/document-worker.properties").read_text().splitlines() if "=" in line)
    env = dict(os.environ, MINIO_ROOT_USER=config["access"], MINIO_ROOT_PASSWORD=config["secret"])
    mongo_exe = Path(os.environ["LOCALAPPDATA"]) / "Programs/MongoDB/Server/8.0/bin/mongod.exe"
    processes = []
    with (recovery / "rehearsal-services.log").open("w") as log:
        try:
            processes.append(subprocess.Popen([str(mongo_exe), "--bind_ip", "127.0.0.1", "--port", "27019", "--dbpath", str(recovery / "data/mongo"), "--setParameter", "ttlMonitorEnabled=false"], stdout=log, stderr=log, creationflags=subprocess.CREATE_NO_WINDOW))
            processes.append(subprocess.Popen([str(ROOT / "tools/minio.exe"), "server", str(recovery / "data/minio"), "--address", "127.0.0.1:9010", "--console-address", "127.0.0.1:9011"], env=env, stdout=log, stderr=log, creationflags=subprocess.CREATE_NO_WINDOW))
            storage = Minio("127.0.0.1:9010", access_key=config["access"], secret_key=config["secret"], secure=False)
            with MongoClient("mongodb://127.0.0.1:27019/?directConnection=true", serverSelectionTimeoutMS=1000) as client:
                for _ in range(50):
                    try:
                        client.admin.command("ping")
                        storage.list_buckets()
                        break
                    except Exception:
                        if any(process.poll() is not None for process in processes):
                            raise RuntimeError("A recovered service failed. Read rehearsal-services.log.")
                        time.sleep(.5)
                else: raise RuntimeError("Recovered services did not become ready.")
                actual = database_inventory(27019)
                if actual != manifest["databases"]:
                    raise AssertionError("Recovered collection counts/content differ from the checkpoint inventory.")
                documents = {}
                synthetic_metadata = 0
                for database in actual:
                    for document in client[database].candidate_documents.find():
                        # Privacy unit fixtures intentionally contain metadata without a real upload.
                        # Only those explicitly named test databases may omit the actual file schema.
                        if database.startswith("fairmatch_privacy_test_") and "bytes" not in document:
                            synthetic_metadata += 1
                            continue
                        documents[f"cv/{document['_id']}.pdf"] = document["bytes"]
                    for document in client[database].organization_documents.find():
                        documents[f"business/{document['_id']}.pdf"] = document["bytes"]
                for reference, expected_size in documents.items():
                    response = storage.get_object("fairmatch-documents", reference)
                    try: data = response.read(8 * 1024**2 + 1)
                    finally: response.close(); response.release_conn()
                    if len(data) != expected_size or not data.startswith(b"%PDF-"):
                        raise AssertionError("Recovered CV does not match its saved metadata.")
                # Indexes are also part of the cold store, not reconstructed from a lossy JSON export.
                indexes = sum(len(client[db][collection].index_information()) for db, collections in actual.items() for collection in collections)
                result = {"passed": True, "recoveryFolder": str(recovery), "databases": len(actual),
                          "collections": sum(len(value) for value in actual.values()), "indexesReadable": indexes,
                          "privatePdfsDownloaded": len(documents), "syntheticMetadataFixturesWithoutUploads": synthetic_metadata,
                          "liveInstallationModified": False,
                          "checks": ["All archived file checksums matched before startup", "Recovered MongoDB records match every checkpoint collection hash/count", "Restored MinIO serves each referenced PDF", "Separate ports; no live database writes"]}
                (ROOT / "logs/backup-restore-result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
                print(json.dumps(result, indent=2))
        finally:
            if processes and processes[0].poll() is None:
                try:
                    with MongoClient("mongodb://127.0.0.1:27019/?directConnection=true", serverSelectionTimeoutMS=1000) as client:
                        client.admin.command("shutdown", force=True)
                except AutoReconnect: pass
                except Exception: pass
            for process in processes:
                if process.poll() is None:
                    try: process.wait(timeout=5)
                    except subprocess.TimeoutExpired: process.terminate(); process.wait(timeout=10)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("recovery", type=Path)
    rehearse(parser.parse_args().recovery)
