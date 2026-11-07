from aiohttp import web
from pathlib import Path
import sys
root=Path(sys.argv[1]); port=int(sys.argv[2])
async def serve(request):
 path=request.match_info['path']
 f=root/path
 if f.is_dir(): f=f/'index.html'
 if not f.is_file():
  f=root/(path+'.html')
 if not f.is_file():
  parts=path.split('/')
  if len(parts)>1 and parts[0] in ['stamps','parking','tours','profile']:
   f=root/parts[0]/('[userId].html' if parts[0]=='profile' else '[id].html')
 if not f.is_file(): f=root/'index.html'
 return web.FileResponse(f)
app=web.Application();app.router.add_get('/app/rnweb/{path:.*}',serve)
web.run_app(app,host='127.0.0.1',port=port,access_log=None)
