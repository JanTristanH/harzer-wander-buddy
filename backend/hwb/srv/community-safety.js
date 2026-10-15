const cds = require('@sap/cds');
async function blockedUserIds(req) {
  const rows = await cds.tx(req).run(cds.ql.SELECT.from('hwb.db.UserBlocks')
    .where({ fromUser: req.user.id }).or({ toUser: req.user.id }));
  return rows.map(row => row.fromUser === req.user.id ? row.toUser : row.fromUser);
}
async function visibleUserIds(req, ids) {
  const blocked = new Set(await blockedUserIds(req));
  return ids.filter(id => !blocked.has(id));
}
function registerCommunitySafety(service) {
  const { SELECT, INSERT, DELETE, UPDATE } = cds.ql;
  async function validateTarget(req) {
    const id = req.data.targetUser?.trim();
    if (!id || id === req.user.id || id.length > 255) return req.reject(400, 'Bitte wähle ein anderes Profil.');
    if (!await cds.tx(req).run(SELECT.one.from('hwb.db.ExternalUsers').where({ ID: id }))) {
      return req.reject(404, 'Profil nicht gefunden.');
    }
    return id;
  }
  service.on('moderateReportedUser', async req => {
    if (!req.user.is('admin')) return req.reject(403, 'Administrator access required');
    const tx = cds.tx(req);
    const report = await tx.run(SELECT.one.from('hwb.db.ContentReports').where({ ID: req.data.reportId }));
    if (!report) return req.reject(404, 'Meldung nicht gefunden.');
    await tx.run(UPDATE('hwb.db.ExternalUsers').set({ name: 'Profil moderiert', picture: null,
      contentRestricted: true }).where({ ID: report.targetUser }));
    await tx.run(UPDATE('hwb.db.Tours').set({ name: 'Tour moderiert' }).where({ createdBy: report.targetUser }));
    await tx.run(DELETE.from('hwb.db.Attachments_local').where({ createdBy: report.targetUser }));
    await tx.run(UPDATE('hwb.db.ContentReports').set({ status: 'resolved' }).where({ ID: report.ID }));
    require('./auth-utils').clearExternalUserCaches(report.targetUser);
    return 'Profilbild und Namen entfernt; weitere Veröffentlichungen dieses Kontos sind gesperrt.';
  });
  service.before(['CREATE', 'UPDATE'], ['Users', 'Tours', 'Attachments'], async req => {
    if (req.user.is('admin')) return;
    const user = await cds.tx(req).run(SELECT.one.from('hwb.db.ExternalUsers').columns('contentRestricted').where({ ID: req.user.id }));
    if (user?.contentRestricted && (req.target.name !== 'api.Users' || 'name' in req.data || 'picture' in req.data)) {
      req.reject(403, 'Veröffentlichungen wurden nach einer Moderationsprüfung eingeschränkt. Bitte kontaktiere den Support.');
    }
  });
  service.on('reportUser' , async req => {
    const targetUser = await validateTarget(req);
    const reason = req.data.reason?.trim();
    if (!reason || reason.length > 2000) return req.reject(400, 'Bitte beschreibe den Inhalt und den Grund (maximal 2000 Zeichen).');
    const cutoff = new Date(Date.now() - 86400000).toISOString();
    const reports = await cds.tx(req).run(SELECT.from('hwb.db.ContentReports').columns('ID')
      .where({ createdBy: req.user.id }).and('createdAt >', cutoff).limit(20));
    if (reports.length >= 20) return req.reject(429, 'Du hast heute bereits viele Meldungen gesendet. Bitte kontaktiere den Support.');
    await cds.tx(req).run(INSERT.into('hwb.db.ContentReports').entries({
      ID: cds.utils.uuid(), targetUser, reason, status: 'open', createdBy: req.user.id,
      createdAt: new Date().toISOString()
    }));
    return 'Deine Meldung wurde gespeichert und wird vom Betreiber geprüft.';
  });
  service.on('blockUser', async req => {
    const targetUser = await validateTarget(req);
    const tx = cds.tx(req);
    const existing = await tx.run(SELECT.one.from('hwb.db.UserBlocks')
      .where({ fromUser: req.user.id, toUser: targetUser }));
    if (!existing) await tx.run(INSERT.into('hwb.db.UserBlocks').entries({
      fromUser: req.user.id, toUser: targetUser, createdAt: new Date().toISOString()
    }));
    for (const name of ['PendingFriendshipRequests', 'Friendships']) {
      await tx.run(DELETE.from(`hwb.db.${name}`).where({ fromUser_ID: req.user.id, toUser_ID: targetUser })
        .or({ fromUser_ID: targetUser, toUser_ID: req.user.id }));
    }
    return 'Profil blockiert. Freundschaften und Stempelberechtigungen wurden entfernt.';
  });
  service.on('unblockUser', async req => {
    await cds.tx(req).run(DELETE.from('hwb.db.UserBlocks').where({ fromUser: req.user.id, toUser: req.data.targetUser }));
    return 'Blockierung aufgehoben.';
  });
  // Apply to the query, before custom/generic handlers, including direct key reads.
  const ownerField = { Users: 'ID', Tours: 'createdBy', Stampings: 'createdBy', Attachments: 'createdBy' };
  for (const [entity, field] of Object.entries(ownerField)) service.before('READ', entity, async req => {
    const ids = await blockedUserIds(req);
    if (ids.length) req.query.where({ [field]: { 'not in': ids } });
  });
  service.before('CREATE', ['Stampings', 'StampNotes', 'Tours', 'Attachments'], req => {
    req.data.createdBy = req.user.id;
  });
  service.before('UPDATE', ['Stampings', 'StampNotes', 'Tours', 'Attachments'], req => {
    if ('createdBy' in req.data && req.data.createdBy !== req.user.id) req.reject(400, 'Die Urheberschaft kann nicht geändert werden.');
  });
  service.before('UPDATE', 'Friendships', req => {
    const forbidden = ['fromUser_ID', 'toUser_ID', 'fromUser', 'toUser', 'status', 'createdBy'];
    if (forbidden.some(key => key in req.data)) req.reject(400, 'Verbindungsdaten können nur über die Freundschaftsfunktionen geändert werden.');
  });
  service.before('CREATE', 'Friendships' , async req => {
    const ids = await blockedUserIds(req);
    const target = req.data.toUser_ID || req.data.toUser?.ID;
    if (ids.includes(target)) req.reject(403, 'Diese Verbindung ist blockiert.');
  });
  service.before(['getUsersProgress', 'getStampFriendVisits', 'stampForGroup'], async req => {
    const csv = typeof req.data.sGroupUserIds === 'string' ? req.data.sGroupUserIds.split(',') : [];
    const ids = [...csv, ...(Array.isArray(req.data.userIds) ? req.data.userIds : [])].map(id => String(id).trim());
    if ((await visibleUserIds(req, ids)).length !== ids.length) req.reject(403, 'Diese Verbindung ist blockiert.');
  });
}
module.exports = { registerCommunitySafety, visibleUserIds };
