const csv = require("csv-string");
const debug = require("debug")("gc-gpx");
const mongo = require("mongodb");

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

async function main() {
  const url = "mongodb://localhost:27017";
  const client = await mongo.MongoClient.connect(url);
  const db = client.db("gc");
  const collection = db.collection("gcs");

  const cursor = collection.find({
    "parsed.premium": false,
    coord: { $exists: true }
  });

  while (await cursor.hasNext()) {
    let doc = await cursor.next();
    const line = csv.stringify([
      doc.coord.lon,
      doc.coord.lat,
      title(doc),
      description(doc)
    ]);
    console.log(line);
  }

  await client.close();
}

main();
