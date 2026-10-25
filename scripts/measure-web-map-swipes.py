import asyncio,json,os,time,collections,base64,argparse,statistics,csv
from pathlib import Path
from urllib.parse import urlparse,unquote
from playwright.async_api import async_playwright
parser=argparse.ArgumentParser(description='Compare high-speed touch swipes: individual DOM visuals vs shared canvas, with all stamps retained.')
parser.add_argument('--site-root',required=True,type=Path)
parser.add_argument('--catalogue',required=True,type=Path)
parser.add_argument('--output',required=True,type=Path)
parser.add_argument('--browser-executable')
parser.add_argument('--repeats',type=int,default=3)
args=parser.parse_args()
if args.repeats < 1:parser.error('--repeats must be positive')
if (args.output/'measurements.jsonl').exists():parser.error('Use a new output directory to keep measurements separate')
ROOT=args.output.resolve();ROOT.mkdir(parents=True,exist_ok=True)

async def main():
 catalogue=json.loads(args.catalogue.read_text());stamp=next(s for s in catalogue['stamps'] if s['number']==9);center=[stamp['latitude'],stamp['longitude']]
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=args.browser_executable or p.chromium.executable_path,headless=True,args=['--no-sandbox','--enable-gpu','--enable-unsafe-swiftshader','--use-angle=swiftshader'],proxy={'server':os.environ['HTTPS_PROXY']} if os.environ.get('HTTPS_PROXY') else None)
  context=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True)
  tileCache={}
  async def tiles(route):
   url=route.request.url
   if url not in tileCache:
    r=await route.fetch();tileCache[url]={'status':r.status,'headers':r.headers,'body':await r.body()}
   await route.fulfill(**tileCache[url])
  await context.route('https://tile.openstreetmap.org/**',tiles)
  async def local(route):
   path=unquote(urlparse(route.request.url).path)
   file=args.site_root/path.lstrip('/')
   if file.is_dir():file=file/'index.html'
   if not file.is_file() and not file.suffix:file=file.with_suffix('.html')
   await route.fulfill(path=str(file)) if file.is_file() else await route.fulfill(status=404)
  await context.route('https://www.harzer-wander-buddy.de/**',local)
  pages={};cdps={}
  for mode in ['dom','canvas']:
   page=await context.new_page();pages[mode]=page
   await page.add_init_script("""window.tasks=[];new PerformanceObserver(l=>window.tasks.push(...l.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});""")
   await page.goto('https://www.harzer-wander-buddy.de/preview/overview/app/map?mapPerf=1'+('&markerRenderer=dom' if mode=='dom' else ''),wait_until='domcontentloaded')
   await page.wait_for_function('!!window.__HWB_MAP_PERF__ && document.querySelectorAll(".leaflet-marker-icon").length>=222')
   await page.wait_for_timeout(1000)
   cdp=await context.new_cdp_session(page);cdps[mode]=cdp
   await cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
   await cdp.send('LayerTree.enable')
   page.layers=[]
   cdp.on('LayerTree.layerTreeDidChange',lambda e,page=page:setattr(page,'layers',e.get('layers',[])))
  results=[]
  for zoom in [2,8,12]:
   for repeat in range(args.repeats):
    for mode in (['dom','canvas'] if repeat%2==0 else ['canvas','dom']):
     page=pages[mode];cdp=cdps[mode]
     await page.bring_to_front()
     await page.evaluate('([center,z])=>{const m=window.__HWB_MAP_PERF__;m.stop();m.setView(center,z,{animate:false})}',[center,zoom]);await page.wait_for_timeout(1200)
     before=await page.evaluate("""() => ({zoom:window.__HWB_MAP_PERF__.getZoom(),parking:[...document.querySelectorAll('.hwb-css-marker__label')].filter(l=>l.textContent==='P').length,canvasRecords:document.querySelector('.hwb-marker-canvas')?.dataset.recordCount,draws:Number(document.querySelector('.hwb-marker-canvas')?.dataset.drawCount||0),nodes:document.querySelectorAll('*').length,filteredPins:document.querySelectorAll('.hwb-css-marker').length,pins:[...document.querySelectorAll('.hwb-css-marker__label')].filter(l=>/^\\d+$/.test(l.textContent)).length})""")
     if zoom==12:assert before['parking']>0,before
     if mode=='canvas':assert int(before['canvasRecords'])>=222,before
     traceDone=asyncio.get_running_loop().create_future()
     cdp.once('Tracing.tracingComplete',lambda e:traceDone.set_result(e))
     await cdp.send('Tracing.start',{'categories':'devtools.timeline,disabled-by-default-devtools.timeline,cc,benchmark,input,latencyInfo','transferMode':'ReturnAsStream'})
     await page.evaluate("""()=>{window.tasks=[];window.gaps=[];window.stopFrames=false;let last=performance.now();function frame(t){window.gaps.push(t-last);last=t;if(!window.stopFrames)requestAnimationFrame(frame)}requestAnimationFrame(frame)}""")
     duration=time.perf_counter()
     for i in range(8):
      reverse=i%2
      await cdp.send('Input.synthesizeScrollGesture',{'x':320 if reverse else 80,'y':250 if reverse else 470,'xDistance':240 if reverse else -240,'yDistance':-220 if reverse else 220,'speed':3500,'gestureSourceType':'touch','preventFling':False})
      await page.wait_for_timeout(350)
     elapsed=(time.perf_counter()-duration)*1000
     after=await page.evaluate("""()=>{window.stopFrames=true;const g=window.gaps.slice(1).sort((a,b)=>a-b);return {frames:g.length,p95:g[Math.floor(g.length*.95)],max:Math.max(...g),over50:g.filter(n=>n>50).length,longTasks:window.tasks,totalBlocking:window.tasks.reduce((a,b)=>a+Math.max(0,b-50),0),draws:Number(document.querySelector('.hwb-marker-canvas')?.dataset.drawCount||0),center:window.__HWB_MAP_PERF__.getCenter()}}""")
     await cdp.send('Tracing.end');event=await traceDone
     stream=event['stream'];chunks=[]
     while True:
      chunk=await cdp.send('IO.read',{'handle':stream});chunks.append(base64.b64decode(chunk['data']).decode() if chunk.get('base64Encoded') else chunk['data'])
      if chunk.get('eof'):break
     await cdp.send('IO.close',{'handle':stream})
     trace=json.loads(''.join(chunks))['traceEvents'];times=collections.Counter();counts=collections.Counter()
     for e in trace:
      counts[e['name']]+=1
      if e.get('ph')=='X':times[e['name']]+=e.get('dur',0)/1000
     if repeat==0 and zoom==8:(ROOT/(mode+'-trace.json')).write_text(json.dumps(trace))
     interesting={k:{'count':counts[k],'ms':round(times[k],2)} for k in counts if k in ['Paint','RasterTask','PrePaint','Layerize','UpdateLayerTree','DrawFrame','CompositeLayers','Commit'] or 'EventLatency' in k or 'GestureScrollUpdate' in k}
     active={};latency=collections.defaultdict(list);presented=[]
     for event in trace:
      if event['name'] not in ['EventLatency','PipelineReporter']:continue
      key=(event['pid'],event['name'],str(event.get('id2',event.get('id'))))
      if event['ph']=='b':active[key]=event
      if event['ph']=='e' and key in active:
       begin=active.pop(key);duration=(event['ts']-begin['ts'])/1000
       if event['name']=='EventLatency':latency[begin.get('args',{}).get('event_latency',{}).get('event_type','unknown')].append(duration)
       else:presented.append({'durationMs':duration,'state':begin.get('args',{}).get('frame_reporter',{}).get('state')})
     result={'latencyMs':dict(latency),'presentation':presented,'renderer':mode,'zoom':zoom,'repeat':repeat,'elapsedMs':round(elapsed),'before':before,'after':after,'layerCount':len(page.layers),'drawingLayers':sum(1 for l in page.layers if l.get('drawsContent')),'trace':interesting}
     if repeat==0:await page.screenshot(path=str(ROOT/f'{mode}-z{zoom}.png'),scale='css')
     results.append(result)
     with (ROOT/'measurements.jsonl').open('a') as output:output.write(json.dumps(result)+'\n')
     print(json.dumps({k:v for k,v in result.items() if k not in ['presentation','latencyMs']}),flush=True)
  for mode,page in pages.items():
   await page.evaluate('([center,z])=>window.__HWB_MAP_PERF__.setView(center,z,{animate:false})',[center,8]);await page.wait_for_timeout(500)
   await page.screenshot(path=str(ROOT/(mode+'-overview.png')),scale='css')
  rows=[]
  for mode in ['dom','canvas']:
   for zoom in [2,8,12]:
    selected=[r for r in results if r['renderer']==mode and r['zoom']==zoom]
    lat=sorted(v for r in selected for v in r['latencyMs'].get('TOUCH_MOVED',[]))
    release=sorted(v for r in selected for v in r['latencyMs'].get('TOUCH_RELEASED',[]))
    rows.append({'renderer':mode,'zoom':zoom,'samples':len(selected),'touchMoveP95Ms':lat[int(len(lat)*.95)] if lat else None,'touchReleaseP95Ms':release[int(len(release)*.95)] if release else None,'touchReleaseMaxMs':max(release) if release else None,'touchMoveMaxMs':max(lat) if lat else None,'worstFrameMs':max(r['after']['max'] for r in selected),'worstTbtMs':max(r['after']['totalBlocking'] for r in selected),'medianDrawingLayers':statistics.median(r['drawingLayers'] for r in selected),'parkingAtStart':selected[0]['before']['parking']})
  (ROOT/'summary.json').write_text(json.dumps(rows,indent=2))
  with (ROOT/'summary.csv').open('w') as output:
   writer=csv.DictWriter(output,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
  await browser.close()
asyncio.run(main())
