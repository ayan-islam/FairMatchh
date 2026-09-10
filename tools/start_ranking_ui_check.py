"""Create isolated ranking UI fixtures; keep the student's jobs and assessments untouched."""
from pathlib import Path
import json,os,socket,subprocess,time,urllib.request,uuid
ROOT=Path(__file__).resolve().parents[1]
for port in (8081,3001):
 with socket.socket() as sock:
  if sock.connect_ex(('127.0.0.1',port))==0:raise RuntimeError('QA port already occupied')
database='fairmatch_ranking_ui_test_'+uuid.uuid4().hex
args=[str(ROOT/'tools/jdk-21.0.8+9/bin/java.exe'),'-jar',str(ROOT/'backend/target/fairmatch-backend-0.1.0.jar'),'--server.port=8081',f'--spring.data.mongodb.uri=mongodb://127.0.0.1:27018/{database}?replicaSet=fairmatch-rs','--fairmatch.seed=false','--fairmatch.bootstrap.demo-enabled=true','--fairmatch.mail.dispatch=false']
backend=subprocess.Popen(args,cwd=ROOT/'backend',stdout=(ROOT/'logs/ranking-ui-api.log').open('w'),stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
for _ in range(100):
 try:urllib.request.urlopen('http://127.0.0.1:8081/actuator/health',timeout=1);break
 except Exception:
  if backend.poll() is not None:raise RuntimeError('QA API failed')
  time.sleep(.4)
else:raise RuntimeError('QA API did not become ready')
def call(path,body,token=None):
 headers={'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 req=urllib.request.Request('http://127.0.0.1:8081/api/'+path,data=json.dumps(body).encode(),headers=headers)
 return json.load(urllib.request.urlopen(req))
token=call('public/auth/login',{'username':'recruiter','password':'LocalTestEmployer!2026'})['token']
from datetime import date,timedelta
job=call('employer/jobs',{'title':'Ranking browser check','department':'CSE','location':'Dhaka','workplace':'On-site','salary':'BDT 40000','description':'Build and test reliable Java backend services with an engineering team.','requirements':['Develop Java APIs','Test persistent application data'],'status':'Active','closes':str(date.today()+timedelta(days=20)),'noFeeConfirmed':True},token)
ids=[]
for number in range(3):
 candidate=call('public/auth/register',{'username':f'ranking_candidate_{number}','password':'TestPassword!123','name':'Synthetic ranking applicant','contact':f'ranking-{number}@example.test','role':'CANDIDATE','organizationName':''})['token']
 app=call('candidate/jobs/'+job['id']+'/applications',{'name':'unused','contact':'unused@example.test','role':'Engineer','experience':'Built Java APIs and tested persistent application data.','education':'BSc in CSE','skills':['Java','Testing'],'example':'Created integration tests and verified saved records survived a complete application restart.','availability':'30 days','location':'Dhaka','consent':True,'evidenceConfirmed':True,'finalConsent':True},candidate)
 ids.append(app['id'])
env=os.environ.copy();env['BACKEND_URL']='http://127.0.0.1:8081'
frontend=subprocess.Popen([str(Path(os.environ['PROGRAMFILES'])/'nodejs/node.exe'),str(ROOT/'frontend/node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3001'],env=env,cwd=ROOT/'frontend',stdout=(ROOT/'logs/ranking-ui-frontend.log').open('w'),stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
state={'database':database,'backendPid':backend.pid,'frontendPid':frontend.pid,'jobId':job['id'],'applicationIds':ids}
(ROOT/'logs/ranking-ui-state.json').write_text(json.dumps(state,indent=2));print(json.dumps(state))
