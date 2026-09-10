"""Read a previously saved JUnit decision through a fresh backend process.

Uses only fairmatch_test_* databases and does not change real applications.
"""
import base64
import json
import socket
import subprocess
import time
import urllib.request
from pathlib import Path
from pymongo import MongoClient

root = Path(__file__).resolve().parent.parent
client = MongoClient('mongodb://127.0.0.1:27018/?replicaSet=fairmatch-rs')
found = []
for database in client.list_database_names():
    if database.startswith('fairmatch_test_'):
        for record in client[database].applications.find(
            {'stage': 'Shortlisted', 'stageChangedAt': {'$exists': True}},
            {'_id': 1, 'stageReason': 1, 'stageChangedAt': 1}
        ):
            found.append((record['stageChangedAt'], database, record))
assert found, 'Run the backend JUnit tests first.'
_, database, record = max(found, key=lambda item: item[0])
with socket.socket() as probe:
    assert probe.connect_ex(('127.0.0.1', 8081)) != 0, 'Verification port 8081 is occupied.'

with (root / 'logs/stage-restart-server.log').open('w') as log:
    process = subprocess.Popen([
        str(root / 'tools/jdk-21.0.8+9/bin/java.exe'), '-jar',
        str(root / 'backend/target/fairmatch-backend-0.1.0.jar'),
        '--server.port=8081', '--fairmatch.seed=false',
        f'--spring.data.mongodb.uri=mongodb://127.0.0.1:27018/{database}?replicaSet=fairmatch-rs'
    ], stdout=log, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW)
    try:
        ready = False
        for attempt in range(40):
            try:
                with urllib.request.urlopen('http://127.0.0.1:8081/actuator/health', timeout=2) as response:
                    ready = json.load(response)['status'] == 'UP'
                if ready:
                    break
            except OSError:
                pass
            time.sleep(0.5)
        assert ready, 'Fresh backend failed to start.'
        authorization = base64.b64encode(b'recruiter:LocalTestEmployer!2026').decode()
        request = urllib.request.Request('http://127.0.0.1:8081/api/employer/applications', headers={'Authorization': 'Basic ' + authorization})
        with urllib.request.urlopen(request, timeout=10) as response:
            saved = next(item for item in json.load(response) if item['id'] == record['_id'])
        assert saved['stage'] == 'Shortlisted'
        assert saved['stageReason'] == record['stageReason']
        result = 'PASS: a fresh Spring Boot process read the saved Shortlisted stage and reason from the isolated test database.'
        (root / 'logs/stage-restart-result.txt').write_text(result, encoding='utf-8')
        print(result)
    finally:
        process.terminate()
        process.wait(timeout=15)
