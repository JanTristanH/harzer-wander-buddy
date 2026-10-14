const cds = require('@sap/cds');
const { SETTINGS, PROFILE, IMAGE_TYPES, optimizeImage } = require('./image-processing');
const { registerImageCache } = require('./image-cache');
const { SELECT, UPDATE } = cds.ql;

module.exports = function registerAttachmentImages(service) {
  const cache = registerImageCache(service);
  service.before(['CREATE', 'UPDATE'], 'Attachments', async req => {
    if (req.data.content == null) return;
    const id = req.data.ID || req.params?.[0]?.ID;
    const existing = id ? await SELECT.one.from('hwb.db.Attachments_local')
      .columns('mimeType', 'filename').where({ ID: id }) : null;
    const mimeType = (req.data.mimeType || existing?.mimeType || '').split(';')[0].toLowerCase();
    req.data.compressionProfile = null;
    if (!IMAGE_TYPES.includes(mimeType)) return;
    try {
      const optimized = await optimizeImage(req.data.content, req.data.filename || existing?.filename);
      req.data.content = optimized.content;
      if (optimized.changed) {
        req.data.mimeType = optimized.mimeType;
        req.data.filename = optimized.filename;
      }
      req.data.compressionProfile = PROFILE;
    } catch (error) {
      req.reject(error.statusCode || 400, 'Image cannot be processed (maximum 20 MiB / 40 megapixels).');
    }
  });

  service.on('compressExistingImages', async req => {
    if (!req.user.is('admin')) return req.reject(403, 'Admin role required');
    const limit = req.data.batchSize ?? 10;
    const afterId = req.data.afterId || '';
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) return req.reject(400, 'batchSize must be between 1 and 50');
    if (afterId && !/^[0-9a-f-]{36}$/i.test(afterId)) return req.reject(400, 'afterId must be a UUID');
    const entity = 'hwb.db.Attachments_local';
    // Select metadata only; load at most one image at a time.
    const candidates = await SELECT.from(entity).columns('ID')
      .where({ mimeType: { in: IMAGE_TYPES }, ID: { '>': afterId } })
      .and`(compressionProfile is null or compressionProfile != ${PROFILE})`
      .and({ content: { '!=': null } })
      .orderBy('ID').limit(limit + 1);
    const result = {
      processed: 0, compressed: 0, skipped: 0, failed: 0,
      bytesBefore: 0, bytesAfter: 0, bytesSaved: 0,
      nextAfterId: null, hasMore: candidates.length > limit,
      maxDimension: SETTINGS.maxDimension, quality: SETTINGS.quality,
      failedIds: [],
    };
    for (const candidate of candidates.slice(0, limit)) {
      result.nextAfterId = candidate.ID;
      // Lock each row while transforming, so a concurrent upload cannot be overwritten.
      const row = await SELECT.one.from(entity).columns('ID', 'content', 'mimeType', 'filename', 'compressionProfile')
        .where({ ID: candidate.ID }).forUpdate();
      if (!row || row.compressionProfile === PROFILE || !row.content) { result.skipped++; continue; }
      let optimized;
      try {
        optimized = await optimizeImage(row.content, row.filename);
      } catch {
        result.failed++;
        result.failedIds.push(candidate.ID);
        continue;
      }
      const changes = { compressionProfile: PROFILE };
      if (optimized.changed) Object.assign(changes, {
        content: optimized.content, mimeType: optimized.mimeType, filename: optimized.filename,
      });
      await UPDATE(entity).set(changes).where({ ID: row.ID });
      result.processed++;
      result.bytesBefore += optimized.before;
      result.bytesAfter += optimized.content.length;
      if (optimized.changed) result.compressed++;
      else result.skipped++;
    }
    result.bytesSaved = result.bytesBefore - result.bytesAfter;
    req.on('succeeded', () => cache.clear());
    return result;
  });
};
