const { SELECT } = require('@sap/cds').ql;
const { stampIdentity } = require('./badge-catalog');

function collectionRule(collection, links, stampById) {
  const required = [], pool = [];
  for (const link of links) {
    const stamp = stampById.get(link.stamp_ID);
    (link.required ? required : pool).push(stamp ? stampIdentity(stamp) : `missing:${link.stamp_ID}`);
  }
  // A removed/corrupt reference can never silently relax a published goal.
  if (links.length !== collection.expectedStampCount) required.push(`missing:${collection.ID}`);
  return { id: collection.badgeId || collection.ID, required, pool: pool.length ? pool : undefined, poolLabel: 'Wahlstempel', poolCount: collection.minimumOptionalCount,
    threshold: collection.regularVisitTarget || undefined,
    condition: `${required.length} Pflichtstellen${collection.minimumOptionalCount ? ` und ${collection.minimumOptionalCount} Wahlstempel` : ''}${collection.regularVisitTarget ? ` sowie ${collection.regularVisitTarget} reguläre HWN-Stempel` : ''}. Ausgabe: ${collection.edition}.` };
}

async function loadThemeBadgeRules(stamps) {
  const collections = await SELECT.from('hwb.db.ThemeCollections').where({ published: true });
  const relevant = collections.filter(collection => collection.badgeId);
  if (!relevant.length) return {};
  const links = await SELECT.from('hwb.db.ThemeStampLinks').where({ collection_ID: { in: relevant.map(collection => collection.ID) } }).orderBy('position');
  const byId = new Map(stamps.map(stamp => [stamp.ID, stamp]));
  return Object.fromEntries(relevant.map(collection => [collection.badgeId,
    collectionRule(collection, links.filter(link => link.collection_ID === collection.ID), byId)]));
}
module.exports = { collectionRule, loadThemeBadgeRules };
