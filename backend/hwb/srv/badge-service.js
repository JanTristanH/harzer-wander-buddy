const cds = require('@sap/cds');
const { buildAlbum, sanitizeSelection } = require('./badge-catalog');
const { loadThemeBadgeRules } = require('./theme-badge-rules');

module.exports = function registerBadgeService(service) {
  const { BadgeProfiles, Stampboxes, Stampings } = cds.entities('hwb.db');
  async function load(userId) {
    const [stamps, visits, stored] = await Promise.all([
      SELECT.from(Stampboxes).columns('ID', 'number', 'name', 'stampKind', 'catalogKey'),
      SELECT.from(Stampings)
        .columns('stamp_ID', 'visitedAt')
        .where({ createdBy: userId }),
      SELECT.one.from(BadgeProfiles).where({ userId }),
    ]);
    const entries = buildAlbum(stamps, visits, await loadThemeBadgeRules(stamps));
    const previous = {
      featured: stored ? JSON.parse(stored.featured || '[]') : [],
      title: stored?.title || '',
      frame: stored?.frame || '',
    };
    const selection = sanitizeSelection(previous, entries);
    const changed = JSON.stringify(previous) !== JSON.stringify(selection);
    if (changed)
      await UPDATE(BadgeProfiles)
        .set({
          featured: JSON.stringify(selection.featured),
          title: selection.title,
          frame: selection.frame,
          selectionChanged: true,
        })
        .where({ userId });
    return {
      entries,
      selection,
      selectionChanged: changed || !!stored?.selectionChanged,
    };
  }
  service.on('getBadgeAlbum', async (req) => {
    const userId = req.data.userId || req.user.id;
    const album = await load(userId);
    // Other profiles expose only their owner's active selection.
    if (userId !== req.user.id) {
      album.entries = album.entries.filter(
        (e) =>
          album.selection.featured.includes(e.id) ||
          e.id === album.selection.frame ||
          e.titles.some((t) => t.id === album.selection.title)
      );
      album.selectionChanged = false;
    }
    return JSON.stringify(album);
  });
  service.on('saveBadgeProfile', async (req) => {
    const { entries } = await load(req.user.id);
    const input = {
      featured: req.data.featured ?? [],
      title: req.data.title ?? '',
      frame: req.data.frame ?? '',
    };
    if (
      !Array.isArray(input.featured) ||
      input.featured.length > 3 ||
      new Set(input.featured).size !== input.featured.length
    )
      return req.reject(
        400,
        'Wähle höchstens drei unterschiedliche Abzeichen.'
      );
    const valid = sanitizeSelection(input, entries);
    if (JSON.stringify(valid) !== JSON.stringify(input))
      return req.reject(
        400,
        'Titel, Rahmen und Abzeichen müssen freigeschaltet sein.'
      );
    await UPSERT.into(BadgeProfiles).entries({
      userId: req.user.id,
      featured: JSON.stringify(valid.featured),
      title: valid.title,
      frame: valid.frame,
      selectionChanged: false,
    });
    return JSON.stringify({
      entries,
      selection: valid,
      selectionChanged: false,
    });
  });
  // Revoke active selections at the moment a visit is removed/corrected, even if
  // the user earns the achievement again before opening their profile.
  service.before(['UPDATE', 'DELETE'], 'Stampings', async (req) => {
    const id = req.data.ID || req.params?.[0]?.ID;
    if (!id) return;
    const visit = await SELECT.one
      .from(Stampings)
      .columns('createdBy')
      .where({ ID: id });
    req._badgeOwner = visit?.createdBy;
  });
  service.after(['UPDATE', 'DELETE'], 'Stampings', async (_, req) => {
    if (req._badgeOwner) await load(req._badgeOwner);
  });
};
