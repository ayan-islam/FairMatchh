"""Run a browser rehearsal against synthetic accounts in a separate MongoDB database."""
from pathlib import Path
import json, os, shutil, socket, subprocess, sys, time, urllib.request, uuid

ROOT = Path(__file__).resolve().parents[1]
for port in (8081, 3001):
    with socket.socket() as sock:
        if sock.connect_ex(('127.0.0.1', port)) == 0:
            raise RuntimeError('QA port is already occupied; no service was stopped')
resume = '--resume' in sys.argv
previous = json.loads((ROOT/'logs/team-ui-state.json').read_text()) if resume else None
database = previous['database'] if previous else 'fairmatch_team_ui_test_' + uuid.uuid4().hex
args = [str(ROOT/'tools/jdk-21.0.8+9/bin/java.exe'), '-jar', str(ROOT/'backend/target/fairmatch-backend-0.1.0.jar'),
        '--server.port=8081', f'--spring.data.mongodb.uri=mongodb://127.0.0.1:27018/{database}?replicaSet=fairmatch-rs',
        '--fairmatch.seed=false', '--fairmatch.bootstrap.demo-enabled=false', '--fairmatch.bootstrap.admin-enabled=false', '--fairmatch.mail.dispatch=false']
backend = subprocess.Popen(args, cwd=ROOT/'backend', stdout=(ROOT/'logs/team-ui-api.log').open('w'), stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW)
def ready(url):
    for _ in range(120):
        try:
            with urllib.request.urlopen(url, timeout=2):
                return
        except Exception:
            time.sleep(.5)
    raise RuntimeError('QA service did not become ready: ' + url)
ready('http://127.0.0.1:8081/actuator/health')
if not resume:
    req = urllib.request.Request('http://127.0.0.1:8081/api/public/auth/register', data=json.dumps({
        'username': 'team_ui_owner', 'password': 'SyntheticTeam!123', 'contact': 'team-owner@example.test',
        'name': 'Synthetic Team Owner', 'role': 'EMPLOYER', 'organizationName': 'Synthetic Team Organization'}).encode(), headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req) as response:
        owner = json.load(response)['user']
env = os.environ.copy(); env['BACKEND_URL'] = 'http://127.0.0.1:8081'
frontend = subprocess.Popen([shutil.which('node.exe'), str(ROOT/'frontend/node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3001'], env=env, cwd=ROOT/'frontend', stdout=(ROOT/'logs/team-ui-frontend.log').open('w'), stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW)
state = {'database': database, 'backendPid': backend.pid, 'frontendPid': frontend.pid,
         'ownerId': previous['ownerId'] if previous else owner['id'],
         'organizationId': previous['organizationId'] if previous else owner['organizationId']}
(ROOT/'logs/team-ui-state.json').write_text(json.dumps(state, indent=2))
ready('http://127.0.0.1:3001')
print(json.dumps(state))
