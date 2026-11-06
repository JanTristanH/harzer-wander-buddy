const assert = require("node:assert/strict");
const { test } = require("node:test");
const cds = require("@sap/cds/lib");
const { parseOfficialNotices, SOURCE_URL } = require("../srv/official-notices");
const stampId = "b8124910-ce23-420a-a555-16a606ff1111";
const secondId = "b8124910-ce23-420a-a555-16a606ff2222";
const stamps = [{ ID: stampId, number: "12", name: "Achtermannshöhe" }];
const page = (entries) =>
  `<h2>Aktuell gemeldete Defekte</h2><h4>Numerische Stempelstellen</h4><ul>${entries.map((e) => `<li>${e}</li>`).join("")}</ul><h3>Defekt melden</h3><ul><li>HWN 1 Not a report</li></ul>`;
let html = page(["HWN 12 Achtermannshöhe"]);
let failFetch = false;
require("node-fetch");
require.cache[require.resolve("node-fetch")].exports = async (url) => {
  assert.equal(url, SOURCE_URL);
  if (failFetch) throw new Error("network failure");
  return {
    ok: true,
    headers: new Map([["content-type", "text/html"]]),
    text: async () => html,
  };
};
cds.env.requires.auth = {
  kind: "mocked",
  users: {
    alice: { password: "pass", roles: ["authenticated-user"] },
    admin: { password: "pass", roles: ["authenticated-user", "admin"] },
  },
};
const server = cds.test("serve", "all", "--in-memory");
async function request(path, user = "alice", data, method) {
  const response = await fetch(`${server.url}/odata/v4/${path}`, {
    method: method || (data ? "POST" : "GET"),
    headers: {
      accept: "application/json",
      ...(user
        ? {
            authorization: `Basic ${Buffer.from(`${user}:pass`).toString("base64")}`,
          }
        : {}),
      ...(data ? { "content-type": "application/json" } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

test("parser distinguishes defects, closures and relocations; rejects unexpected pages", () => {
  const result = parseOfficialNotices(
    page([
      "HWN 12 Achtermannshöhe",
      "Stempelstelle 146 – Großes Wehr ist nicht zu erreichen.",
      "Die Stempelstelle HWN 99 wurde versetzt.",
      "Feen\u00adhöhe",
    ]),
    [...stamps, { ID: secondId, number: "S1", name: "Feenhöhe" }],
  );
  assert.equal(result.length, 4);
  assert.equal(result[0].stamp_ID, stampId);
  assert.equal(result[1].kind, "closure");
  assert.equal(result[1].stamp_ID, null);
  assert.equal(result[2].kind, "info");
  assert.equal(result[3].stamp_ID, secondId);
  assert.equal(
    parseOfficialNotices(page(["HWN 12 Achtermannshöhe"]), [
      ...stamps,
      ...stamps,
    ])[0].stamp_ID,
    null,
  );
  assert.equal(
    parseOfficialNotices(page(["HWN 12 und HWN 13: Weg gesperrt"]), stamps)[0]
      .stamp_ID,
    null,
  );
  assert.throws(() => parseOfficialNotices("<h1>Access denied</h1>", stamps));
  assert.throws(() => parseOfficialNotices(page([]), stamps));
});

test("moderation, privacy, authorization and official reconciliation", async () => {
  const db = await cds.connect.to("db");
  await INSERT.into(db.entities("hwb.db").Stampboxes).entries([
    ...stamps,
    {
      ID: secondId,
      number: "146",
      name: "Großes Wehr",
      latitude: 51.75,
      longitude: 10.54,
    },
  ]);
  for (const action of ["syncOfficialNotices", "reviewStampNotice"]) {
    const denied = await request(
      `api/${action}`,
      "alice",
      action === "syncOfficialNotices"
        ? { preview: true }
        : { noticeId: stampId, status: "approved" },
    );
    assert.equal(denied.status, 403, JSON.stringify(denied.body));
  }
  assert.equal((await request("api/StampNotices")).status, 403);
  assert.equal(
    (
      await request("api/reportStampNotice", null, {
        stampId,
        kind: "defect",
        message: "Testmeldung mit Text",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("api/reportStampNotice", "alice", {
        stampId,
        kind: "defect",
        message: "kurz",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("api/reportStampNotice", "alice", {
        stampId: "b8124910-ce23-420a-a555-16a606ff9999",
        kind: "defect",
        message: "Stempelkasten fehlt vor Ort.",
      })
    ).status,
    404,
  );
  const created = await request("api/reportStampNotice", "alice", {
    stampId,
    kind: "closure",
    message: "Der Zugang ist durch umgestürzte Bäume versperrt.",
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const ID = created.body.value;
  const readPublic = async () => {
    const res = await request(
      `public/Stampboxes(${stampId})?$select=ID,activeNotices`,
      null,
    );
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return JSON.parse(res.body.activeNotices);
  };
  assert.deepEqual(await readPublic(), []);
  assert.equal(
    (await request("api/StampNotices", "admin", { ID, status: "approved" }))
      .status,
    405,
  );
  assert.equal(
    (
      await request("api/reviewStampNotice", "admin", {
        noticeId: ID,
        status: "approved",
      })
    ).status,
    200,
  );
  const published = await readPublic();
  assert.equal(published.length, 1);
  assert.equal(published[0].source, "community");
  const neighbors = await request(
    `api/NeighborsStampStamp?$filter=ID eq ${secondId}&$expand=neighborStamp($select=ID,activeNotices)`,
  );
  assert.equal(neighbors.status, 200, JSON.stringify(neighbors.body));
  assert.equal(
    JSON.parse(neighbors.body.value[0].neighborStamp.activeNotices).length,
    1,
  );

  assert.equal("createdBy" in published[0], false);
  assert.equal("reviewedBy" in published[0], false);
  const privateData = await request("api/StampNotices?$expand=stamp", "admin");
  assert.equal(privateData.status, 200, JSON.stringify(privateData.body));
  assert.equal(privateData.body.value[0].stamp.name, "Achtermannshöhe");
  const authenticated = await request(
    `api/Stampboxes?$filter=ID eq ${stampId}&$select=ID,activeNotices`,
  );
  assert.equal(authenticated.status, 200, JSON.stringify(authenticated.body));
  assert.equal(JSON.parse(authenticated.body.value[0].activeNotices).length, 1);
  assert.equal(
    (
      await request("api/reviewStampNotice", "admin", {
        noticeId: ID,
        status: "rejected",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("api/reviewStampNotice", "admin", {
        noticeId: ID,
        status: "resolved",
      })
    ).status,
    200,
  );
  assert.deepEqual(await readPublic(), []);
  let result = await request("api/syncOfficialNotices", "admin", {
    preview: true,
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(JSON.parse(result.body.value).matched.length, 1);
  assert.deepEqual(await readPublic(), []);
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await request("api/syncOfficialNotices", "admin", { preview: false }))
        .status,
      200,
    );
  assert.equal((await readPublic()).length, 1, "repeated sync is idempotent");
  failFetch = true;
  assert.equal(
    (await request("api/syncOfficialNotices", "admin", { preview: false }))
      .status,
    502,
  );
  assert.equal((await readPublic()).length, 1);
  failFetch = false;
  html = "<h1>Unexpected redesign</h1>";
  assert.equal(
    (await request("api/syncOfficialNotices", "admin", { preview: false }))
      .status,
    502,
  );
  assert.equal((await readPublic()).length, 1);
  html = page(["HWN 13 Unbekannte Stempelstelle"]);
  result = await request("api/syncOfficialNotices", "admin", {
    preview: false,
  });
  assert.equal(JSON.parse(result.body.value).unmatched.length, 1);
  assert.equal(
    (await readPublic()).length,
    1,
    "unmatched entries preserve existing warnings",
  );
  html = page(["HWN 12 Achtermannshöhe – Stempel fehlt"]);
  assert.equal(
    (await request("api/syncOfficialNotices", "admin", { preview: false }))
      .status,
    200,
  );
  assert.equal(
    (await readPublic()).length,
    1,
    "replaced official warning is resolved",
  );
});
