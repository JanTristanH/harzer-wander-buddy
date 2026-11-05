"""Capture the real RN-Web app against a local dev-basic CAP server."""
import base64
import json
import os
from pathlib import Path
import urllib.request

from playwright.sync_api import sync_playwright

ORIGIN = 'http://localhost:4004'
OUTPUT = Path(__file__).parent
USERNAME = os.environ['HWB_TEST_USERNAME']
PASSWORD = os.environ['HWB_TEST_PASSWORD']
AUTH = 'Basic ' + base64.b64encode(f'{USERNAME}:{PASSWORD}'.encode()).decode()
LOCAL = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def api(path, data=None, method=None):
    request = urllib.request.Request(
        f'{ORIGIN}/odata/v4/api/{path}',
        data=json.dumps(data).encode() if data is not None else None,
        headers={'Authorization': AUTH, 'Content-Type': 'application/json'}, method=method,
    )
    with LOCAL.open(request) as response:
        content = response.read()
        return json.loads(content) if content else None


# Only the local test backend is used. No browser storage or tokens are saved.
leg = api("TravelTimes?$filter=travelMode%20eq%20'walk'&$top=1")['value'][0]
stamp = api(f"Stampboxes?$filter=ID%20eq%20{leg['fromPoi']}&$top=1")['value'][0]
profile = api('getCurrentUser()')
api(f"Users('{profile['ID']}')", {'onboardingCompleted': True}, 'PATCH')
name = 'Webtest – Tour im Harz'
tour = api('Tours', {'name': name, 'idListTravelTimes': leg['ID']})
saved = api('updateTourByPOIList', {'TourID': tour['ID'], 'POIList': f"{leg['fromPoi']};{leg['toPoi']}"})
assert saved['path'][0]['travelTime']['positionString'] == leg['positionString']

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
        args=['--no-sandbox', '--enable-unsafe-swiftshader'],
    )
    try:
        page = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1, locale='de-DE')
        page.add_init_script("localStorage.setItem('@hwb:map-style','standard')")

        # In the managed environment, use Python's current CA trust and inherited
        # HTTPS proxy for public map resources. TLS verification stays enabled.
        def public_resource(route):
            url = route.request.url
            if not (url.startswith('https://tiles.openfreemap.org/') or
                    url in {stamp.get('heroImageUrl'), stamp.get('image')}):
                route.abort()
                return
            try:
                request = urllib.request.Request(url, headers={
                    'User-Agent': 'HarzerWanderBuddy/1.8 (https://github.com/JanTristanH/harzer-wander-buddy)',
                })
                with urllib.request.urlopen(request, timeout=20) as response:
                    route.fulfill(status=response.status, body=response.read(), headers={
                        'content-type': response.headers.get('Content-Type', 'application/octet-stream'),
                        'access-control-allow-origin': response.headers.get('Access-Control-Allow-Origin', '*'),
                    })
            except Exception:
                route.abort()

        page.route('https://**/*', public_resource)
        page.goto(f'{ORIGIN}/app/rnweb/login')
        page.get_by_placeholder('Nutzername').fill(USERNAME)
        page.get_by_placeholder('Passwort', exact=True).fill(PASSWORD)
        page.get_by_role('button', name='Anmelden', exact=True).click()
        page.get_by_text('Touren', exact=True).last.click()
        page.get_by_text(name, exact=True).first.click()
        page.get_by_role('button', name='Aktionen', exact=True).wait_for(timeout=60000)
        page.wait_for_timeout(2000)
        assert page.locator('.leaflet-overlay-pane path').count() > 0
        page.screenshot(path=str(OUTPUT / '01-gpx-export.png'))
        page.get_by_role('button', name='Aktionen', exact=True).click()
        page.get_by_role('button', name='Tour als GPX exportieren').wait_for()
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUTPUT / '02-actions-menu.png'))
        with page.expect_download() as event:
            page.get_by_role('button', name='Tour als GPX exportieren').click()
        download = event.value
        assert download.suggested_filename.endswith('.gpx')
        content = Path(download.path()).read_text()
        assert '<trkpt lat=' in content and 'http://www.topografix.com/GPX/1/1' in content
        page.get_by_text('Bearbeiten', exact=True).click()
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUTPUT / '03-edit-route.png'))
        marker = page.locator(f'.leaflet-marker-icon[title$={json.dumps(stamp["name"], ensure_ascii=False)}]').first
        bounds = marker.bounding_box()
        page.mouse.click(bounds['x'] + 24, bounds['y'] + 20)
        page.wait_for_timeout(500)
        selected = page.locator('.leaflet-marker-icon[aria-pressed="true"]')
        assert selected.count() == 1
        page.screenshot(path=str(OUTPUT / '04-selected-marker.png'))
        bounds = selected.bounding_box()
        corner = {'x': bounds['x'] + 2, 'y': bounds['y'] + bounds['height'] - 3}
        assert not page.evaluate("p => !!document.elementFromPoint(p.x, p.y).closest('.leaflet-marker-icon')", corner)
        page.mouse.click(corner['x'], corner['y'])
        page.wait_for_timeout(300)
        assert page.locator('.leaflet-marker-icon[aria-pressed="true"]').count() == 0
        page.screenshot(path=str(OUTPUT / '05-dismissed-marker.png'))
        print('Real route, GPX menu/download and transparent-corner deselection verified.')
    finally:
        browser.close()
