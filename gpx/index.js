const debug = require("debug")("gc-gpx");
const mongo = require("mongodb");
const xml2js = require("xml2js");

function code(doc) {
  return doc.gc.substr(2);
}

function name(doc) {
  return clean(doc.parsed.name);
}

function type(doc) {
  switch (doc.parsed.type) {
    case "Traditional Geocache":
      return "T";
    case "Multi-cache":
      return "M";
    case "EarthCache":
      return "E";
    // TODO letterbox
    // TODO wherigo
    default:
      return "?";
  }
}

function size(doc) {
  return doc.parsed.size[0].toUpperCase();
}

function skill(doc) {
  return `${doc.parsed.difficulty.toFixed(1)}/${doc.parsed.terrain.toFixed(1)}`;
}

function clean(str) {
  return str
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "AE")
    .replace(/Ö/g, "OE")
    .replace(/Ü/g, "UE")
    .replace(/ß/g, "ss")
    .replace(/ {2,}/g, " ")
    .replace(/[^a-zA-Z0-9;:?!,.-=_\/@$%*+()<> |\n]/g, "")
    .trim();
}

function hint(doc) {
  return clean(doc.parsed.hint || "");
}

function title(doc) {
  return `${code(doc)} ${size(doc)}${type(doc)} ${skill(doc)}`;
}

function description(doc) {
  const h = hint(doc);
  return `${code(doc)} ${name(doc)}${h.length > 0 ? "\n" : ""}${h}`.substr(
    0,
    100
  );
}

async function generate(collection, type) {
  const cursor = collection.find({
    coord: { $exists: true },
    "parsed.premium": false,
    "parsed.type": type
  });

  console.log('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
  console.log(
    '<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'
  );
  console.log(
    'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd"'
  );
  console.log('version="1.1" creator="cachecache">');

  const builder = new xml2js.Builder({
    headless: true,
    renderOpts: { pretty: false }
  });

  while (await cursor.hasNext()) {
    let doc = await cursor.next();
    const line = builder.buildObject({
      wpt: {
        $: {
          lat: doc.coord.lat,
          lon: doc.coord.lon
        },
        name: title(doc),
        cmt: description(doc),
        type: "Geocache"
      }
    });
    console.log(line);
  }
  console.log("</gpx>");
}

async function main() {
  const url = process.env["GC_DB_URI"] || "mongodb://localhost:27017";
  const client = await mongo.MongoClient.connect(url);
  const db = client.db("gc");
  const collection = db.collection("gcs");

  await generate(collection, process.argv[2]);

  await client.close();
}

main();
