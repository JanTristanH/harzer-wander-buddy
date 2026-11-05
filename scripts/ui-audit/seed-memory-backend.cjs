// Run from backend/hwb. The --profile memory database is discarded on exit.
const { createRequire } = require('node:module');
const path = require('node:path');
const cds = createRequire(path.join(process.cwd(), 'package.json'))('@sap/cds');
cds.on('served', async () => {
 const db = await cds.connect.to('db');
 const names = ['Brocken – Gipfelblick', 'Langenberg mit Aussicht auf das Ilsetal', 'Jungfernklippe', 'Froschfelsen', 'Ilsefälle', 'Bremer Hütte', 'Stempelsbuche', 'Plessenburg'];
 const rows = names.map((name,i)=>({ID:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,number:String(i+1),orderBy:String(i+1).padStart(3,'0'),name,description:'Lokale UI-Testdaten: Waldwege und weite Ausblicke im Harz. Keine geprüfte Tourenempfehlung.',latitude:51.80+i*.01,longitude:10.61+i*.012,validFrom:'2020-01-01T00:00:00Z',validTo:'2099-12-31T00:00:00Z'}));
 await db.run(cds.ql.INSERT.into('hwb.db.Stampboxes').entries(rows));
 await db.run(cds.ql.INSERT.into('hwb.db.ParkingSpots').entries({ID:'00000000-0000-4000-9000-000000000001',name:'Wanderparkplatz (UI-Testdaten)',description:'Synthetischer Parkplatz für die lokale Layoutprüfung.',latitude:51.82,longitude:10.65}));
 console.log('UI audit: 8 synthetic stamps and 1 parking spot seeded into memory only.');
});
cds.exec('--profile','memory');
