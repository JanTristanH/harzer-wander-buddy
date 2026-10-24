const cds = require("@sap/cds");
const fetch = require("node-fetch");
const { randomUUID } = require("node:crypto");
const { SOURCE_URL, parseOfficialNotices } = require("./official-notices");

async function attachActiveNotices(result) {
  const rows = (Array.isArray(result) ? result : [result]).filter(
    (row) => row?.ID,
  );
  if (!rows.length) return;
  const { StampNotices } = cds.entities("hwb.db");
  const notices = await SELECT.from(StampNotices)
    .columns(
      "ID",
      "stamp_ID",
      "kind",
      "message",
      "source",
      "sourceUrl",
      "checkedAt",
      "reviewedAt",
    )
    .where({ stamp_ID: { in: rows.map((row) => row.ID) }, status: "approved" })
    .orderBy("createdAt desc");
  for (const row of rows)
    row.activeNotices = JSON.stringify(
      notices.filter((n) => n.stamp_ID === row.ID),
    );
}
function register(service) {
  service.after("READ", "Stampboxes", attachActiveNotices);
  service.after(
    "READ",
    ["NeighborsStampStamp", "NeighborsParkingStamp"],
    async (result) => {
      const rows = Array.isArray(result) ? result : [result];
      await attachActiveNotices(
        rows.map((row) => row?.neighborStamp).filter(Boolean),
      );
    },
  );
  service.on("reportStampNotice", async (req) => {
    const { stampId, kind } = req.data;
    const message =
      typeof req.data.message === "string" ? req.data.message.trim() : "";
    if (
      !["closure", "defect", "info"].includes(kind) ||
      message.length < 10 ||
      message.length > 2000
    )
      return req.reject(
        400,
        "Bitte eine Kategorie und eine Beschreibung mit 10 bis 2000 Zeichen angeben.",
      );
    const { Stampboxes, StampNotices } = cds.entities("hwb.db");
    if (!(await SELECT.one.from(Stampboxes).where({ ID: stampId })))
      return req.reject(404, "Stempelstelle nicht gefunden.");
    const pending = await SELECT.from(StampNotices).where({
      createdBy: req.user.id,
      status: "pending",
    });
    if (pending.length >= 10)
      return req.reject(
        429,
        "Es sind bereits zehn Meldungen von dir in Prüfung.",
      );
    const ID = randomUUID();
    await INSERT.into(StampNotices).entries({
      ID,
      stamp_ID: stampId,
      kind,
      message,
      status: "pending",
      source: "community",
      createdBy: req.user.id,
    });
    return ID;
  });
  service.on("reviewStampNotice", async (req) => {
    const { noticeId, status } = req.data;
    if (!["approved", "rejected", "resolved"].includes(status))
      return req.reject(400, "Ungültiger Status.");
    const { StampNotices } = cds.entities("hwb.db");
    const notice = await SELECT.one
      .from(StampNotices)
      .where({ ID: noticeId })
      .forUpdate();
    if (!notice) return req.reject(404, "Meldung nicht gefunden.");
    if (notice.source === "official")
      return req.reject(
        400,
        "Offizielle Meldungen werden über die Synchronisierung gepflegt.",
      );
    const allowed =
      notice.status === "pending"
        ? ["approved", "rejected"]
        : notice.status === "approved"
          ? ["resolved"]
          : [];
    if (!allowed.includes(status))
      return req.reject(
        409,
        "Diese Meldung wurde bereits bearbeitet. Bitte aktualisieren.",
      );
    await UPDATE(StampNotices)
      .set({
        status,
        reviewedAt: new Date().toISOString(),
        reviewedBy: req.user.id,
      })
      .where({ ID: noticeId });
    return status;
  });
  service.on("syncOfficialNotices", async (req) => {
    let entries;
    const { Stampboxes, StampNotices, NoticeSyncState } =
      cds.entities("hwb.db");
    if (req.data.preview === false) {
      // Serialize imports; the seed row is created with the normal database deployment.
      const state = await SELECT.one
        .from(NoticeSyncState)
        .where({ ID: "official" })
        .forUpdate();
      if (!state)
        return req.reject(
          503,
          "Bitte zuerst die Datenbankmigration für Meldungen ausführen.",
        );
    }
    try {
      const response = await fetch(SOURCE_URL, {
        timeout: 15000,
        size: 2 * 1024 * 1024,
        redirect: "error",
      });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("text/html")
      )
        throw new Error("Quelle nicht verfügbar.");
      entries = parseOfficialNotices(
        await response.text(),
        await SELECT.from(Stampboxes).columns("ID", "number", "name"),
      );
    } catch (error) {
      cds
        .log("stamp-notices")
        .warn("Official notice import failed", error.message);
      return req.reject(
        502,
        "Die offizielle Quelle konnte nicht sicher gelesen werden. Bestehende Hinweise bleiben erhalten.",
      );
    }
    const unmatched = entries.filter((e) => !e.stamp_ID);
    const matched = entries.filter((e) => e.stamp_ID);
    const checkedAt = new Date().toISOString();
    if (req.data.preview !== false)
      return JSON.stringify({
        preview: true,
        sourceUrl: SOURCE_URL,
        checkedAt,
        matched,
        unmatched,
      });
    const previous = await SELECT.from(StampNotices).where({
      source: "official",
    });
    for (const entry of matched) {
      const old = previous.find(
        (n) => n.sourceKey === entry.sourceKey && n.stamp_ID === entry.stamp_ID,
      );
      const data = {
        stamp_ID: entry.stamp_ID,
        kind: entry.kind,
        message: entry.message,
        status: "approved",
        source: "official",
        sourceUrl: SOURCE_URL,
        sourceKey: entry.sourceKey,
        checkedAt,
      };
      if (old) await UPDATE(StampNotices).set(data).where({ ID: old.ID });
      else
        await INSERT.into(StampNotices).entries({ ID: randomUUID(), ...data });
    }
    // Unmatched entries can indicate renaming/relocation: keep prior warnings in that case.
    if (!unmatched.length) {
      for (const old of previous.filter(
        (n) =>
          n.status === "approved" &&
          !matched.some(
            (e) => e.sourceKey === n.sourceKey && e.stamp_ID === n.stamp_ID,
          ),
      ))
        await UPDATE(StampNotices)
          .set({ status: "resolved", checkedAt })
          .where({ ID: old.ID });
    }
    await UPDATE(NoticeSyncState).set({ checkedAt }).where({ ID: "official" });
    return JSON.stringify({
      preview: false,
      sourceUrl: SOURCE_URL,
      checkedAt,
      matched,
      unmatched,
      retainedPrevious: unmatched.length > 0,
    });
  });
}
module.exports = { register, attachActiveNotices };
