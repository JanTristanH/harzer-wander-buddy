"""Render a previously downloaded synthetic-free map pack with all remote traffic blocked.
This validates real tile/style compatibility on WebGL, not native file:// behavior.
"""
import argparse
import functools
import http.server
import json
from pathlib import Path
import tempfile
import threading
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('pack_directory', type=Path)
parser.add_argument('--screenshot', type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
pack = args.pack_directory.resolve()
assert (pack / 'complete.json').is_file(), 'Only complete map packs may be tested'
manifest = json.loads((pack / 'complete.json').read_text())
style = json.loads((pack / 'style.json').read_text())
assert 'https:' not in json.dumps(style), 'Offline style contains a remote dependency'

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

with tempfile.TemporaryDirectory(prefix='hwb-offline-render-') as directory:
    public = Path(directory)
    (public / 'pack').symlink_to(pack, target_is_directory=True)
    for name in ['maplibre-gl.js', 'maplibre-gl.css']:
        (public / name).symlink_to(root / 'app/node_modules/maplibre-gl/dist' / name)
    handler = functools.partial(QuietHandler, directory=directory)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    origin = f'http://127.0.0.1:{server.server_port}'
    threading.Thread(target=server.serve_forever, daemon=True).start()
    # Only the browser harness substitutes loopback HTTP for the native file URI.
    style['glyphs'] = origin + '/pack/fonts/{fontstack}/{range}.pbf'
    style['sources']['terrain']['tiles'] = [origin + '/pack/{z}/{x}/{y}.pbf']
    west, south, east, north = manifest['bounds']
    (public / 'index.html').write_text('''<!doctype html><html lang="de"><meta charset="utf-8">
<link rel="stylesheet" href="/maplibre-gl.css"><style>
body{margin:0}#map{width:390px;height:844px}.label{position:absolute;top:12px;left:12px;right:12px;z-index:2;padding:10px;background:#f2f6e9;color:#214d36;border-radius:12px;font:14px system-ui}
</style><div id="map"></div><div class="label">Echte Offline-Kartendaten · Webprüfung<br>Keine native Flugmodus-Abnahme</div><script src="/maplibre-gl.js"></script><script>
window.mapErrors=[];window.map=new maplibregl.Map({container:'map',style:''' + json.dumps(style) + ",center:" + json.dumps([(west+east)/2, (south+north)/2]) + ''',zoom:13.5,maxBounds:''' + json.dumps(manifest['bounds']) + ''',preserveDrawingBuffer:true});
map.on('error',e=>window.mapErrors.push(e.error.message));
</script></html>''')
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            page = browser.new_page(viewport={'width':390, 'height':844})
            blocked = []
            def route(request_route):
                if request_route.request.url.startswith(origin + '/'):
                    request_route.continue_()
                else:
                    blocked.append(request_route.request.url)
                    request_route.abort()
            page.route('**/*', route)
            page.goto(origin + '/index.html')
            page.wait_for_function("window.map && map.loaded() && map.isSourceLoaded('terrain')", timeout=60000)
            counts = page.evaluate("Object.fromEntries(['walking-paths','place-names','peaks','water'].map(id=>[id,map.queryRenderedFeatures({layers:[id]}).length]))")
            errors = page.evaluate('window.mapErrors')
            assert not errors, errors
            assert counts['walking-paths'] > 0, counts
            assert counts['place-names'] > 0 or counts['peaks'] > 0, counts
            assert not blocked, blocked
            args.screenshot.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(args.screenshot))
            print(json.dumps({'renderedFeatures':counts,'mapErrors':errors,'remoteRequests':len(blocked),'screenshot':str(args.screenshot)}))
            browser.close()
    finally:
        server.shutdown()
