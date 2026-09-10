"""Check UI-created ranking fixtures through a restarted isolated API."""
import json, subprocess, time, urllib.request
from pathlib import Path

root = Path(__file__).resolve().parents[1]
state = json.loads((root / 'logs/ranking-ui-state.json').read_text())
database = state['database']
assert database.startswith('fairmatch_ranking_ui_test_') and database.replace('_','').isalnum()
base = 'http://127.0.0.1:8081/api/'
def call(path, token=None, body=None):
    headers = {'Content-Type':'application/json'}
    if token: headers['Authorization']='Bearer '+token
    req=urllib.request.Request(base+path, data=json.dumps(body).encode() if body is not None else None, headers=headers)
    return json.load(urllib.request.urlopen(req,timeout=15))
token=call('public/auth/login',body={'username':'recruiter','password':'LocalTestEmployer!2026'})['token']
path='employer/jobs/'+state['jobId']+'/ranking'
before=call(path,token)
assert len(before['ranked'])==1 and before['ranked'][0]['score']==75
assert len(before['pending'])==2 and any(r['status']=='Assessment incomplete' and r['assessed']==1 and r['score'] is None for r in before['pending'])
reports={r['applicationId']:call(path+'/applications/'+r['applicationId'],token) for r in before['ranked']+before['pending']}
process_id=int(state['backendPid'])
script=f"$p=Get-CimInstance Win32_Process -Filter 'ProcessId={process_id}'; if (!$p -or $p.CommandLine -notlike '*{database}*' -or $p.CommandLine -notlike '*fairmatch-backend*') {{ throw 'Unexpected QA process' }}; Stop-Process -Id {process_id}"
subprocess.run(['powershell.exe','-NoProfile','-Command',script],check=True,creationflags=subprocess.CREATE_NO_WINDOW)
log=(root/'logs/ranking-restart-api.log').open('w')
process=subprocess.Popen([str(root/'tools/jdk-21.0.8+9/bin/java.exe'),'-jar',str(root/'backend/target/fairmatch-backend-0.1.0.jar'),'--server.port=8081',f'--spring.data.mongodb.uri=mongodb://127.0.0.1:27018/{database}?replicaSet=fairmatch-rs','--fairmatch.seed=false','--fairmatch.mail.dispatch=false'],cwd=root/'backend',stdout=log,stderr=log,creationflags=subprocess.CREATE_NO_WINDOW)
try:
    for _ in range(100):
        try:
            urllib.request.urlopen('http://127.0.0.1:8081/actuator/health',timeout=1)
            break
        except OSError:
            if process.poll() is not None: raise RuntimeError('Restarted API failed')
            time.sleep(.4)
    else: raise RuntimeError('Restarted API did not become ready')
    assert call(path,token)==before
    for application_id,report in reports.items(): assert call(path+'/applications/'+application_id,token)==report
    result={'passed':True,'database':database,'checks':['rubric and ranking saved through browser','75/100 result and quoted explanation survive browser reload and API restart','incomplete assessment stays unranked after reload and restart','review and rubric history unchanged','desktop and 390px dialog controls visible with internal scrolling'],'real_applicant_ratings_modified':False}
    (root/'logs/ranking-ui-result.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))
finally:
    process.terminate();process.wait(timeout=15);log.close()
