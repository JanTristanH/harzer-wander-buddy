// Run from backend/hwb. The --profile memory database is discarded on exit.
const { createRequire } = require('node:module');
const path = require('node:path');
// Match the web test client without depending on an untracked backend .env.
const webConfig = require('../../app/app.json').expo.extra;
process.env.ISSUER_BASE_URL ||= `https://${webConfig.auth0Domain}/`;
process.env.AUDIENCE ||= webConfig.auth0Audience;
const cds = createRequire(path.join(process.cwd(), 'package.json'))('@sap/cds');
cds.on('served', async () => {
 const db = await cds.connect.to('db');
 const names = ['Brocken – Gipfelblick', 'Langenberg mit Aussicht auf das Ilsetal', 'Jungfernklippe', 'Froschfelsen', 'Ilsefälle', 'Bremer Hütte', 'Stempelsbuche', 'Plessenburg'];
 const rows = names.map((name,i)=>({ID:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,number:String(i+1),orderBy:String(i+1).padStart(3,'0'),name,description:'Lokale UI-Testdaten: Waldwege und weite Ausblicke im Harz. Keine geprüfte Tourenempfehlung.',latitude:51.80+i*.01,longitude:10.61+i*.012,validFrom:'2020-01-01T00:00:00Z',validTo:'2099-12-31T00:00:00Z'}));
 await db.run(cds.ql.INSERT.into('hwb.db.Stampboxes').entries(rows));
 await db.run(cds.ql.INSERT.into('hwb.db.ParkingSpots').entries({ID:'00000000-0000-4000-9000-000000000001',name:'Wanderparkplatz (UI-Testdaten)',description:'Synthetischer Parkplatz für die lokale Layoutprüfung.',latitude:51.82,longitude:10.65}));
 console.log('UI audit: 8 synthetic stamps and 1 parking spot seeded into memory only.');
 // Populate richer UI states only when explicitly requested for this local process.
 // These are fictional database fixtures; no invitations leave the memory backend.
 if (process.env.HWB_UI_RICH_FIXTURES === '1') {
  const seeded = new Map();
  const seedBuddies = async (userId) => {
   const { randomUUID } = require('node:crypto');
   const friendIds = ['ui-audit-nora', 'ui-audit-luca', 'ui-audit-ida'];
   for (const [i, id] of friendIds.entries()) {
    const existing = await db.run(cds.ql.SELECT.one.from('hwb.db.ExternalUsers').where({ ID: id }));
    if (!existing) await db.run(cds.ql.INSERT.into('hwb.db.ExternalUsers').entries({
     ID: id, sub: id, name: ['UI-Test Nora', 'UI-Test Luca', 'UI-Test Ida'][i], onboardingCompleted: true,
    }));
   }
   await db.run(cds.ql.INSERT.into('hwb.db.Friendships').entries([
    { ID: randomUUID(), fromUser_ID: userId, toUser_ID: friendIds[0], createdBy: userId, status: 'accepted', isAllowedToStampForFriend: true },
    { ID: randomUUID(), fromUser_ID: friendIds[0], toUser_ID: userId, createdBy: friendIds[0], status: 'accepted', isAllowedToStampForFriend: true },
   ]));
   const outgoingId = randomUUID();
   await db.run(cds.ql.INSERT.into('hwb.db.Friendships').entries({
    ID: outgoingId, fromUser_ID: friendIds[1], toUser_ID: userId, createdBy: friendIds[1], status: 'pending',
   }));
   await db.run(cds.ql.INSERT.into('hwb.db.PendingFriendshipRequests').entries({
    ID: randomUUID(), fromUser_ID: userId, toUser_ID: friendIds[1], outgoingFriendship_ID: outgoingId,
   }));
  };
  cds.services.api.before('*', async (req) => {
   const userId = req.user.id;
   if (!userId || userId === 'anonymous') return;
   if (!seeded.has(userId)) seeded.set(userId, seedBuddies(userId));
   await seeded.get(userId);
  });
 }
});
cds.exec('--profile','memory');
