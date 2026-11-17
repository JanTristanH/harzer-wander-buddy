const { load } = require("cheerio");
const { createHash } = require("node:crypto");
const SOURCE_URL = "https://www.harzer-wandernadel.de/defektmeldungen/";

function normalize(text) {
  return text
    .normalize("NFKC")
    .replace(/[\u00ad\u200b]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function nameKey(text) {
  return normalize(text)
    .toLocaleLowerCase("de")
    .replace(/[^\p{L}\p{N}]/gu, "");
}
function parseOfficialNotices(html, stamps) {
  const $ = load(html);
  $("script, style, nav, footer, form").remove();
  let active = false;
  let foundHeading = false;
  let sectionKind = "defect";
  const entries = [];
  $("h1,h2,h3,h4,li,p").each((_, element) => {
    const text = normalize($(element).text());
    if (
      /^h[1-4]$/.test(element.tagName) &&
      /^Aktuell gemeldete Defekte$/i.test(text)
    ) {
      active = foundHeading = true;
      return;
    }
    if (/^Defekt melden$/i.test(text) || /^Auf dieser Seite/.test(text))
      active = false;
    if (
      /^h[1-4]$/.test(element.tagName) &&
      /Weitere wichtige Informationen/i.test(text)
    )
      sectionKind = "info";
    if (
      !active ||
      element.tagName !== "li" ||
      $(element).find("li").length ||
      !text
    )
      return;
    if (text.length > 2000)
      throw new Error("Quelleneintrag ist unerwartet lang.");
    if ($(element).find('a[href^="#"]').length) return;
    const numbers = [
      ...new Set(
        [
          ...text.matchAll(
            /\b(?:HWN|Stempelstelle(?:\s+Nummer)?)\s+(\d{1,3})\b/gi,
          ),
        ].map((match) => Number(match[1])),
      ),
    ];
    const candidates =
      numbers.length > 1
        ? []
        : numbers.length === 1
          ? stamps.filter(
              (s) =>
                /^\d+$/.test(s.number || "") && Number(s.number) === numbers[0],
            )
          : stamps.filter((s) => nameKey(s.name) === nameKey(text));
    const kind = /sperr|nicht (?:zu )?erreich|entfällt|gesperrt|gefahr/i.test(
      text,
    )
      ? "closure"
      : /versetzt|zutritt|standort/i.test(text)
        ? "info"
        : sectionKind;
    const sourceKey = createHash("sha256").update(text).digest("hex");
    if (!entries.some((e) => e.sourceKey === sourceKey))
      entries.push({
        sourceKey,
        kind,
        message: text,
        stamp_ID: candidates.length === 1 ? candidates[0].ID : null,
        stampName: candidates.length === 1 ? candidates[0].name : null,
      });
  });
  // A redesign, challenge page or empty result must never clear existing warnings.
  if (!foundHeading || !entries.length)
    throw new Error(
      "Quellenseite nicht sicher erkannt; bestehende Hinweise bleiben erhalten.",
    );
  return entries;
}
module.exports = { SOURCE_URL, parseOfficialNotices };
