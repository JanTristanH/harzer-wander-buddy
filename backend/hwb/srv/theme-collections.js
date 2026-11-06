const cds = require('@sap/cds');
const { evaluate, stampIdentity } = require('./badge-catalog');
const { collectionRule } = require('./theme-badge-rules');
const { SELECT, INSERT, UPDATE, DELETE } = cds.ql;
const collectionEntity = 'hwb.db.ThemeCollections';
const linkEntity = 'hwb.db.ThemeStampLinks';
const stampEntity = 'hwb.db.Stampboxes';
const trim = value => typeof value === 'string' ? value.trim() : '';

function sourceUrl(value, req) {
  const text = trim(value);
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
  } catch { req.reject(400, 'sourceUrl must be an HTTPS source reference'); }
  if (text.length > 2048) req.reject(400, 'sourceUrl is too long');
  return text;
}

module.exports = function registerThemeCollections(service) {
  service.on('createSpecialStamp', async req => {
    if (!req.user.is('admin')) return req.reject(403, 'Admin role required');
    const data = req.data;
    const catalogKey = trim(data.catalogKey);
    const number = trim(data.number);
    const name = trim(data.name);
    if (!/^[a-z0-9][a-z0-9._:-]{2,159}$/.test(catalogKey)) return req.reject(400, 'catalogKey must be a stable, namespaced lowercase key');
    if (!name || name.length > 255 || !number || number.length > 40 || (/^\d+$/.test(number) && Number(number) >= 1 && Number(number) <= 222)) {
      return req.reject(400, 'Name and special stamp label required; regular HWN numbers 1–222 are reserved');
    }
    if (!Number.isFinite(data.latitude) || Math.abs(data.latitude) > 90 || !Number.isFinite(data.longitude) || Math.abs(data.longitude) > 180) return req.reject(400, 'Valid coordinates required');
    if (data.validFrom && data.validTo && Date.parse(data.validFrom) > Date.parse(data.validTo)) return req.reject(400, 'Invalid validity interval');
    const reference = sourceUrl(data.sourceUrl, req);
    if (await SELECT.one.from(stampEntity).where({ catalogKey })) return req.reject(409, 'catalogKey already exists; reuse this stamp ID for another theme');
    const ID = cds.utils.uuid();
    const stamp = { ID, catalogKey, number, name, stampKind: 'special', sourceUrl: reference,
      latitude: data.latitude, longitude: data.longitude, validFrom: data.validFrom ?? null, validTo: data.validTo ?? null,
      orderBy: number.padStart(3, '0') };
    await INSERT.into(stampEntity).entries(stamp);
    return stamp;
  });

  // Explicit action is the only writer: no generic/deep CRUD bypass for publication validation.
  service.on('saveThemeCollection', async req => {
    if (!req.user.is('admin')) return req.reject(403, 'Admin role required');
    const data = req.data;
    const existing = data.ID ? await SELECT.one.from(collectionEntity).where({ ID: data.ID }).forUpdate() : null;
    if (data.ID && !existing) return req.reject(404, 'Theme collection not found');
    if (existing && existing.revision !== data.revision) return req.reject(409, 'Theme collection changed; reload its current revision');
    const code = trim(data.code), edition = trim(data.edition), name = trim(data.name);
    if (!/^[a-z0-9][a-z0-9-]{1,99}$/.test(code) || !edition || edition.length > 80 || !name || name.length > 255 || !['booklet', 'trail'].includes(data.kind)) return req.reject(400, 'Valid code, edition, name and kind required');
    const badgeId = trim(data.badgeId) || null;
    if (badgeId && !['goethe', 'witch', 'border', 'steiger'].includes(badgeId)) return req.reject(400, 'Only existing theme badge IDs may be linked');
    if (badgeId && data.published) {
      const other = await SELECT.one.from(collectionEntity).where({ badgeId, published: true });
      if (other && other.ID !== existing?.ID) return req.reject(409, 'Only one published edition may control a badge');
    }
    const entries = data.entries ?? [];
    if (!Array.isArray(entries) || entries.length > 500 || entries.some(entry => !entry.stampId || typeof entry.required !== 'boolean')) return req.reject(400, 'At most 500 stamp entries with an explicit required flag allowed');
    const ids = entries.map(entry => entry.stampId.toLowerCase());
    if (new Set(ids).size !== ids.length) return req.reject(400, 'A stamp may only occur once per edition');
    const stamps = ids.length ? await SELECT.from(stampEntity).columns('ID').where({ ID: { in: ids } }) : [];
    if (stamps.length !== ids.length) return req.reject(400, 'Unknown stamp ID; create or resolve the stamp before assigning it');
    const expectedStampCount = data.expectedStampCount;
    const minimumOptionalCount = data.minimumOptionalCount ?? 0;
    const regularVisitTarget = data.regularVisitTarget ?? 0;
    if (((data.published || expectedStampCount != null) && (!Number.isInteger(expectedStampCount) || expectedStampCount < 1 || expectedStampCount > 500)) ||
      !Number.isInteger(minimumOptionalCount) || minimumOptionalCount < 0 || minimumOptionalCount > entries.filter(entry => !entry.required).length ||
      !Number.isInteger(regularVisitTarget) || regularVisitTarget < 0 || regularVisitTarget > 222) return req.reject(400, 'Invalid counts or impossible optional requirement');
    if (expectedStampCount != null && entries.length > expectedStampCount) return req.reject(400, 'Too many stamps for expectedStampCount');
    if (typeof data.published !== 'boolean') return req.reject(400, 'Explicit published flag required');
    if (data.published && (ids.length !== expectedStampCount || !data.reviewedAt || entries.every(entry => !entry.required) && minimumOptionalCount === 0)) {
      return req.reject(400, 'Published editions require a complete mapping, review date and non-empty collection goal');
    }
    const duplicate = await SELECT.one.from(collectionEntity).where({ code, edition });
    if (duplicate && duplicate.ID !== existing?.ID) return req.reject(409, 'This code and edition already exist');
    const row = { ID: existing?.ID ?? cds.utils.uuid(), code, edition, name, kind: data.kind,
      sourceUrl: sourceUrl(data.sourceUrl, req), reviewedAt: data.reviewedAt ?? null,
      rulesNote: trim(data.rulesNote), expectedStampCount, minimumOptionalCount, regularVisitTarget,
      badgeId, activeBadgeId: data.published ? badgeId : null, published: data.published, revision: (existing?.revision ?? 0) + 1 };
    if (row.rulesNote.length > 2048) return req.reject(400, 'rulesNote is too long');
    // CAP request transaction rolls back the entire replacement if any write fails.
    if (existing) await UPDATE(collectionEntity).set(row).where({ ID: row.ID });
    else await INSERT.into(collectionEntity).entries(row);
    await DELETE.from(linkEntity).where({ collection_ID: row.ID });
    if (entries.length) await INSERT.into(linkEntity).entries(entries.map((entry, index) => ({
      collection_ID: row.ID, stamp_ID: entry.stampId.toLowerCase(), position: index + 1, required: entry.required,
    })));
    return row;
  });

  service.on('getThemeMappingReport', async req => {
    if (!req.user.is('admin')) return req.reject(403, 'Admin role required');
    const collections = await SELECT.from(collectionEntity);
    const links = await SELECT.from(linkEntity);
    const specials = await SELECT.from(stampEntity).columns('ID', 'number', 'name', 'catalogKey').where({ stampKind: 'special' });
    const mapped = new Set(links.map(link => link.stamp_ID));
    return JSON.stringify({
      collections: collections.map(collection => ({ ID: collection.ID, name: collection.name,
        edition: collection.edition, published: collection.published, expectedStampCount: collection.expectedStampCount,
        mappedCount: links.filter(link => link.collection_ID === collection.ID).length })),
      unassignedSpecialStamps: specials.filter(stamp => !mapped.has(stamp.ID)),
    });
  });

  service.on('getThemeCatalog', async req => {
    const collections = await SELECT.from(collectionEntity).where({ published: true }).orderBy('name', 'edition');
    if (!collections.length) return [];
    const links = await SELECT.from(linkEntity).where({ collection_ID: { in: collections.map(item => item.ID) } }).orderBy('position');
    const stamps = await SELECT.from(stampEntity).columns('ID', 'number', 'name', 'stampKind', 'catalogKey');
    const stampById = new Map(stamps.map(stamp => [stamp.ID, stamp]));
    // Always personal progress; no caller-supplied user ID and no friend-history exposure.
    const visits = await SELECT.from('hwb.db.Stampings').columns('stamp_ID').where({ createdBy: req.user.id });
    const visitedIdentities = new Set(visits.map(visit => stampById.get(visit.stamp_ID)).filter(Boolean).map(stampIdentity));
    const regularVisited = evaluate({ threshold: 222 }, visitedIdentities).progress[0].current;
    const numbers = new Set([...visitedIdentities]);
    return collections.map(collection => {
      const members = links.filter(link => link.collection_ID === collection.ID).map(link => {
        const stamp = stampById.get(link.stamp_ID);
        return { stampId: link.stamp_ID, number: stamp?.number ?? '', name: stamp?.name ?? 'Stempelstelle nicht verfügbar',
          stampKind: stamp && /^\d+$/.test(stampIdentity(stamp)) && Number(stampIdentity(stamp)) >= 1 && Number(stampIdentity(stamp)) <= 222 ? 'regular' : 'special', required: link.required, visited: Boolean(stamp && visitedIdentities.has(stampIdentity(stamp))) };
      });
      const requiredCount = members.filter(stamp => stamp.required).length;
      const requiredCollected = members.filter(stamp => stamp.required && stamp.visited).length;
      const optionalCollected = members.filter(stamp => !stamp.required && stamp.visited).length;
      return { ...collection, stamps: members, collectedCount: requiredCollected + optionalCollected,
        requiredCount, requiredCollected, optionalCollected, regularVisited,
        complete: evaluate(collectionRule(collection, links.filter(link => link.collection_ID === collection.ID), stampById), numbers).unlocked };
    });
  });
};
