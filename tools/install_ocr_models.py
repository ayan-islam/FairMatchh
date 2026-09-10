"""Download version-pinned official Tesseract fast models and record SHA-256 checksums."""
from pathlib import Path
import hashlib, json, urllib.request

ROOT=Path(__file__).resolve().parents[1]
folder=ROOT/'tools/tesseract/tessdata';folder.mkdir(parents=True,exist_ok=True)
def read(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'FairMatch-local-setup'}),timeout=90) as response:return response.read()
commit='87416418657359cb625c412a48b6e1d6d41c29bd'
manifest={'repository':'https://github.com/tesseract-ocr/tessdata_fast','commit':commit,'files':{}}
for language in ('eng','ben'):
    name=language+'.traineddata'
    data=read(f'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/{commit}/{name}')
    if len(data)<100000:raise RuntimeError('Downloaded model is unexpectedly small')
    (folder/name).write_bytes(data)
    manifest['files'][name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
    print('Downloaded pinned model',name,len(data),'bytes')
(ROOT/'document-worker/ocr-models.json').write_text(json.dumps(manifest,indent=2))
