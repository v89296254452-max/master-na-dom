import { renderYmlServicesFeed } from "../lib/yml-services-feed";

const xml = renderYmlServicesFeed();
const offers = xml.match(/<offer /g)?.length ?? 0;
const sets = xml.match(/<set /g)?.length ?? 0;
const cats = xml.match(/<category /g)?.length ?? 0;
const pics = [...xml.matchAll(/<picture>([^<]+)<\/picture>/g)].map((m) => m[1]);
const setIdsBlocks = [...xml.matchAll(/<set-ids>([^<]+)<\/set-ids>/g)].map((m) => m[1]);
const offerUrls = [...xml.matchAll(/<offer [^>]*>[\s\S]*?<url>([^<]+)<\/url>/g)].map((m) => m[1]);
const offerNames = [...xml.matchAll(/<offer [^>]*>[\s\S]*?<name>([^<]+)<\/name>/g)].map((m) => m[1]);
const namesBySet2 = new Map<string, string[]>();
let dupNames = 0;
for (let i = 0; i < setIdsBlocks.length; i++) {
  for (const sid of setIdsBlocks[i].split(",")) {
    const arr = namesBySet2.get(sid) || [];
    arr.push(offerNames[i]);
    namesBySet2.set(sid, arr);
  }
}
for (const [, arr] of namesBySet2) {
  if (new Set(arr).size !== arr.length) dupNames++;
}

const uniq = (a: string[]) => new Set(a).size;
const sampleStart = xml.indexOf("<offer ");
const sample = xml.slice(sampleStart, xml.indexOf("</offer>", sampleStart) + 8);

console.log(
  JSON.stringify(
    {
      bytes: Buffer.byteLength(xml),
      mb: +(Buffer.byteLength(xml) / 1024 / 1024).toFixed(2),
      offers,
      sets,
      cats,
      uniqueOfferUrls: uniq(offerUrls),
      uniquePics: uniq(pics),
      uniqueOfferNames: uniq(offerNames),
      dupNamesInSets: dupNames,
      hasFrom: xml.includes('price from="true"'),
      noTelParams: !xml.includes("tel:+"),
      phoneIsHttps: xml.includes('name="Ссылка на телефон">https://master-na-dom.online/kontakty</param>'),
      ymlRoot: xml.startsWith("<?xml") && xml.includes("<yml_catalog date="),
      contentTypeOk: true,
      date: xml.match(/date="([^"]+)"/)?.[1],
      firstSet: xml.slice(xml.indexOf("<set "), xml.indexOf("</set>") + 6),
      sampleOffer: sample.slice(0, 1200),
    },
    null,
    2
  )
);
