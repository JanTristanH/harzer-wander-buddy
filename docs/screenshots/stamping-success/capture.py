# Requires a fresh isolated fixture server with seven own regular visits.
# Credentials are read from AGENTS.md and held only for this test session.
from playwright.sync_api import sync_playwright
from pathlib import Path
import re
root=Path(__file__).resolve().parents[3]
instructions=(root/'AGENTS.md').read_text()
user=re.search(r'Nutzername: `([^`]+)`',instructions).group(1)
password=re.search(r'Passwort: `([^`]+)`',instructions).group(1)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
 errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.on('console',lambda msg: print('CONSOLE',msg.text) if msg.type=='error' else None)
 page.goto('http://localhost:4004/login')
 page.get_by_placeholder('Nutzername').fill(user)
 page.get_by_placeholder('Passwort').fill(password)
 page.get_by_text('Anmelden',exact=True).click()
 page.wait_for_timeout(3000)
 import csv
 stamps=list(csv.DictReader((root/'backend/hwb/db/doNotDeploy-data/hwb.db.Stampboxes.csv').read_text().splitlines(),delimiter=','));stamp=next(s for s in stamps if s['number']=='8')
 page.get_by_placeholder('Suche nach Nummer oder Ort').fill(stamp['name'])
 page.get_by_test_id('stamp-list-item-'+stamp['ID']).click()
 page.get_by_text('Besuch stempeln',exact=True).wait_for(timeout=30000)
 page.get_by_text('Besuch stempeln',exact=True).click()
 card=page.get_by_test_id('stamping-success-card')
 card.wait_for(timeout=30000)
 page.get_by_text('Bronze freigeschaltet!',exact=True).wait_for()
 page.get_by_text('7 → 8 reguläre Stempel',exact=True).wait_for()
 page.screenshot(path=str(root/'docs/screenshots/stamping-success/milestone.png'))
 page.get_by_role('button',name='Erfolg schließen').click()
 page.get_by_text('Erneut stempeln',exact=True).click()
 page.get_by_text('Besuch festgehalten',exact=True).wait_for()
 page.get_by_text('8 → 8 reguläre Stempel',exact=True).wait_for()
 page.screenshot(path=str(root/'docs/screenshots/stamping-success/repeat.png'))
 page.get_by_role('button',name='Weiter entdecken').click()
 page.go_back()
 next_stamp=next(s for s in stamps if s['number']=='9')
 page.get_by_placeholder('Suche nach Nummer oder Ort').fill(next_stamp['name'])
 page.get_by_test_id('stamp-list-item-'+next_stamp['ID']).click()
 page.get_by_text('Besuch stempeln',exact=True).click()
 page.get_by_text('8 → 9 reguläre Stempel',exact=True).wait_for()
 page.screenshot(path=str(root/'docs/screenshots/stamping-success/normal.png'))
 assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
 print('PASS: milestone 7→8, repeat 8→8, normal 8→9, no horizontal overflow.')
 assert not errors,errors
 browser.close()
