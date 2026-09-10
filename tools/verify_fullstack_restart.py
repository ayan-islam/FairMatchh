"""Restart the packaged API against isolated JUnit data; never modify the student's database."""
import json
import subprocess
import time
import urllib.request
from pathlib import Path
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[1]
mongo = MongoClient("mongodb://127.0.0.1:27018/?replicaSet=fairmatch-rs")
databases = [n for n in mongo.list_database_names() if n.startswith("fairmatch_platform_test_")]
def newest(name):
    item = mongo[name].audit_events.find_one(sort=[("at", -1)])
    return item["at"].timestamp() if item else 0
database = max(databases, key=newest)
db = mongo[database]
BASE = "http://127.0.0.1:8081/api/"
log = (ROOT / "logs/fullstack-restart-server.log").open("w")

def start():
    process = subprocess.Popen([str(ROOT / "tools/jdk-21.0.8+9/bin/java.exe"), "-jar", str(ROOT / "backend/target/fairmatch-backend-0.1.0.jar"), "--server.port=8081", f"--spring.data.mongodb.uri=mongodb://127.0.0.1:27018/{database}?replicaSet=fairmatch-rs", "--fairmatch.seed=false"], cwd=ROOT / "backend", stdout=log, stderr=log, creationflags=subprocess.CREATE_NO_WINDOW)
    for _ in range(80):
        try:
            urllib.request.urlopen("http://127.0.0.1:8081/actuator/health", timeout=1)
            return process
        except Exception:
            if process.poll() is not None:
                raise RuntimeError("QA server failed; see restart-server log")
            time.sleep(.5)
    process.terminate()
    raise RuntimeError("QA server startup timed out")

def call(path, token=None, method="GET", body=None):
    headers={"Content-Type":"application/json"}
    if token: headers["Authorization"]="Bearer "+token
    request=urllib.request.Request(BASE+path, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=40) as response: return json.load(response)

def login(username,password): return call("public/auth/login", method="POST",body={"username":username,"password":password})["token"]
process=start()
document=None
token=None
try:
    application=db.applications.find_one({"ownerId":{"$ne":None}})
    account=db.accounts.find_one({"_id":application["ownerId"]})
    token=login(account["username"],"TestPassword!123")
    employer=login("recruiter","LocalTestEmployer!2026")
    before={p:call(p,token) for p in ["candidate/profile","candidate/applications","candidate/interviews","account/notifications","account/cases"]}
    org_before=call("employer/organization",employer)
    jobs_before=call("employer/jobs",employer)
    collections=["profiles","application_drafts","applications","application_messages","interviews","notifications","support_cases","fairness_reviews"]
    stored_before={name:list(db[name].find().sort("_id",1)) for name in collections}
    # Upload a synthetic document, then verify both metadata and object bytes after API restart.
    pdf=(ROOT / "backend/src/test/resources/test-resume.pdf").read_bytes()
    boundary="FairMatchRestartBoundary"
    payload=(f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"restart-fixture.pdf\"\r\nContent-Type: application/pdf\r\n\r\n".encode()+pdf+f"\r\n--{boundary}--\r\n".encode())
    request=urllib.request.Request(BASE+"candidate/documents",data=payload,headers={"Authorization":"Bearer "+token,"Content-Type":"multipart/form-data; boundary="+boundary})
    with urllib.request.urlopen(request,timeout=40) as response: document=json.load(response)
    process.terminate();process.wait(timeout=15)
    process=start()
    for path, expected in before.items(): assert call(path,token)==expected,path
    assert call("employer/organization",employer)==org_before
    assert call("employer/jobs",employer)==jobs_before
    for name,expected in stored_before.items(): assert list(db[name].find().sort("_id",1))==expected,name
    documents=call("candidate/documents",token)
    assert any(d["id"]==document["id"] and "Java APIs" in d["text"] for d in documents)
    request=urllib.request.Request(BASE+"candidate/documents/"+document["id"]+"/file",headers={"Authorization":"Bearer "+token})
    with urllib.request.urlopen(request) as response: assert response.read()==pdf
    call("candidate/documents/"+document["id"],token,"DELETE")
    document=None
    result={"passed":True,"database":database,"checks":["JWT remains valid after API restart","profile, applications, interviews, inbox and cases unchanged","organization and jobs unchanged","PDF metadata and MinIO bytes survive API restart"],"user_database_modified":False}
    (ROOT / "logs/fullstack-restart-result.json").write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))
finally:
    if document and token and process.poll() is None:
        try:call("candidate/documents/"+document["id"],token,"DELETE")
        except Exception:pass
    process.terminate();process.wait(timeout=15);log.close();mongo.close()
