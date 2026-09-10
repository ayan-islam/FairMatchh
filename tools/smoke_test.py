"""Exercise the two real features through the Next.js API proxy. Adds labelled demo records."""
import base64, json, urllib.request, urllib.error, uuid
from datetime import date, timedelta
from pathlib import Path

BASE='http://127.0.0.1:3000/api/'
auth=base64.b64encode(b'recruiter:LocalTestEmployer!2026').decode()
checks=[]
def call(path, method='GET', body=None, employer=False, expected=200):
    headers={'Content-Type':'application/json'}
    if employer: headers['Authorization']='Basic '+auth
    req=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=20) as response: code=response.status; data=response.read()
    except urllib.error.HTTPError as error: code=error.code;data=error.read()
    assert code==expected, (path,code,data.decode())
    checks.append(f'{method} {path}: {code}')
    return json.loads(data) if data else None

call('employer/jobs',expected=401)
job=dict(title='Quality Assistant - classroom demo',department='Quality',location='Dhaka, Bangladesh',workplace='On-site',salary='BDT 25,000 - 30,000 monthly',description='Inspect garment quality, record findings and coordinate corrections with production.',requirements=['Quality inspection experience','Basic spreadsheet ability'],status='Active',closes=str(date.today()+timedelta(days=30)),noFeeConfirmed=True)
saved=call('employer/jobs','POST',job,True,201)
job_id=saved['id']
assert any(j['id']==job_id for j in call('public/jobs'))
candidate=dict(name='Demo Candidate',contact=f'classroom-{uuid.uuid4().hex[:8]}@example.com',role='Quality Assistant',experience='I inspected garments and maintained a daily spreadsheet of quality findings.',education='Diploma in Textile Engineering',skills=['Quality inspection','Microsoft Excel'],example='I identified repeated stitching defects and worked with production to correct them before shipment.',availability='30 days',location='Dhaka',consent=True,evidenceConfirmed=True,finalConsent=True)
receipt=call(f'public/jobs/{job_id}/applications','POST',candidate,expected=201)
blind=next(a for a in call('employer/applications',employer=True) if a['id']==receipt['id'])
assert 'name' not in blind and 'contact' not in blind and 'normalizedContact' not in blind
assert candidate['name'] not in json.dumps(blind)
assert blind['evidence']==candidate['experience']
call(f'public/jobs/{job_id}/applications','POST',candidate,expected=409)
assert call(f'public/jobs/{job_id}')['applications']==1
job['status']='Closed'
call(f'employer/jobs/{job_id}','PUT',job,True)
call(f'public/jobs/{job_id}/applications','POST',candidate,expected=404)
job['status']='Active'
call(f'employer/jobs/{job_id}','PUT',job,True)
assert any(a['reference']==receipt['id'] for a in call('employer/audit',employer=True))
result={'result':'PASS','jobId':job_id,'applicationId':receipt['id'],'checks':checks,'identityFieldsOmitted':True,'applicationCount':1}
output=Path(__file__).resolve().parent.parent/'logs/smoke-test.json'
output.write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
