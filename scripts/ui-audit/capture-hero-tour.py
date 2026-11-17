"""Focused before/after capture against the locally served build; no storage export."""
import asyncio,json,re,sys
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/design/screenshots/hero-tour-followup'/sys.argv[1]
OUT.mkdir(parents=True,exist_ok=True)
BASE='http://localhost:4004/app/rnweb'
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/workspace/android-flow/playwright/chromium-1208/chrome-linux64/chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  c=await b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
  await c.route('**/app.harzer-wander-buddy.de/**',lambda r:r.abort())
  page=await c.new_page(); errors=[]; checks=[]
  page.on('pageerror',lambda e:errors.append(re.sub(r'https?://\S+', '<url>',str(e)))); page.on('response',lambda r: print('HTTP',r.status,r.url.split('?')[0],flush=True) if r.status>=400 else None)
  async def shot(name):
   await page.evaluate('document.fonts.ready'); await page.wait_for_timeout(700)
   await page.screenshot(path=str(OUT/(name+'.png')))
  await page.goto(BASE+'/',wait_until='networkidle'); await page.get_by_test_id('stamp-progress-hero').wait_for(); await shot('hero-guest-390')
  await page.goto(BASE+'/login',wait_until='networkidle')
  async with c.expect_page() as popup: await page.get_by_role('button',name='Anmelden',exact=True).click()
  auth=await popup.value; await auth.wait_for_load_state('domcontentloaded')
  notes=(ROOT/'AGENTS.md').read_text()
  for field,label in [('username','Nutzername:'),('password','Passwort:')]:
   value=next(line.split('`')[1] for line in notes.splitlines() if label in line)
   await auth.locator('input[name="'+field+'"]').fill(value)
  await auth.get_by_role('button',name='Continue',exact=True).click()
  await page.wait_for_function("location.pathname.endsWith('/onboarding') || document.body.innerText.includes('Gruppe')",timeout=90000)
  await page.wait_for_timeout(1800)
  if 'onboarding' in page.url:
   await page.get_by_role('button',name='Los geht’s',exact=True).click()
   await page.get_by_role('textbox',name='Dein Anzeigename',exact=True).fill('Wanderbuddy Test')
   await page.get_by_role('button',name='Weiter',exact=True).click()
   await page.get_by_role('radio',name='Bär',exact=True).click()
   await page.get_by_role('button',name='Weiter',exact=True).click()
   await page.get_by_role('button',name='Ohne Standort weiter',exact=True).click()
   await page.get_by_role('button',name='Zu den Stempelstellen',exact=True).click()
  await page.get_by_test_id('stamp-progress-hero').wait_for(); await shot('hero-signed-390')
  await page.set_viewport_size({'width':1440,'height':900}); await shot('hero-signed-1440')
  await page.set_viewport_size({'width':390,'height':844})
  await page.goto(BASE+'/tours',wait_until='networkidle')
  await page.get_by_role('button',name='Neue Tour planen',exact=True).click()
  await page.get_by_role('button',name='Ersten Stempel wählen').click()
  search=page.get_by_role('textbox',name='Tourpunkte suchen').last
  await search.fill('Brocken'); await page.wait_for_timeout(1400); await shot('tour-empty')
  checks.append({'state':'empty','hintVisible':await page.get_by_test_id('tour-map-instruction').last.is_visible()})
  await page.get_by_text('#1 · Brocken – Gipfelblick',exact=True).last.click(); await shot('tour-selected')
  checks.append({'state':'selected','hintCount':await page.get_by_test_id('tour-map-instruction').count()})
  await page.get_by_text('Zur Tour hinzufügen',exact=True).last.click(); await page.wait_for_timeout(1000); await shot('tour-added')
  checks.append({'state':'added','hintCount':await page.get_by_test_id('tour-map-instruction').count()})
  original_map=await page.locator('.leaflet-container').last.element_handle()
  original_input=await page.get_by_role('textbox',name='Tourpunkte suchen').last.element_handle()
  await page.keyboard.press('Escape'); await page.wait_for_timeout(600)
  await page.get_by_text('Aktuelle Reihenfolge',exact=True).scroll_into_view_if_needed(); await shot('tour-sequence')
  await page.get_by_role('textbox',name='Tourpunkte suchen').last.fill('Froschfelsen'); await page.wait_for_timeout(1600); await shot('tour-search-next')
  checks.append({'state':'search-next','hintCount':await page.get_by_test_id('tour-map-instruction').count(),'pins':await page.locator('.leaflet-marker-icon').evaluate_all('(els)=>els.map(e=>e.getAttribute("aria-label"))')})
  if sys.argv[1] != 'before':
   assert checks[0]['hintVisible']
   assert all(check['hintCount'] == 0 for check in checks[1:])
   assert await original_map.evaluate('(el)=>el.isConnected'), 'Fullscreen remounted the map'
   assert await original_input.evaluate('(el)=>el.isConnected'), 'Fullscreen remounted the search input'
   assert await page.get_by_role('textbox',name='Tourpunkte suchen').last.input_value() == 'Froschfelsen'
   assert await page.get_by_role('button',name='Tourkarte im Vollbild schließen').count() == 1
   await page.get_by_text('#4 · Froschfelsen',exact=True).last.wait_for()
   checks.append({'state':'reopen-search','sameMapAndInput':True,'query':'Froschfelsen','matchingTargetVisible':True})
   await page.get_by_role('textbox',name='Tourpunkte suchen').last.fill('Brocken')
   await page.get_by_text('#1 · Brocken – Gipfelblick',exact=True).last.click()
   await page.get_by_text('Aus Tour entfernen',exact=True).last.click()
   await page.locator('.leaflet-container').last.click(position={'x':40,'y':300})
   await page.get_by_test_id('tour-map-instruction').last.wait_for()
   await shot('tour-reset-empty')
   checks.append({'state':'last-point-removed-and-deselected','hintVisible':True})
   assert not errors, errors
  (OUT/'checks.json').write_text(json.dumps({'checks':checks,'pageErrors':errors},ensure_ascii=False,indent=2))
  await b.close()
asyncio.run(main())
