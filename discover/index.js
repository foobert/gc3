const util = require("util");
const assert = require("assert");
const _ = require("lodash");
const kafka = require("kafka-node");
const request = require("superagent");

function toTile(lat, lon) {
  const zoom = 11;
  const latRad = lat * Math.PI / 180;
  const n = Math.pow(2, zoom);
  const xtile = parseInt((lon + 180.0) / 360.0 * n);
  const ytile = parseInt(
    (1.0 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
      2.0 *
      n
  );
  return { x: xtile, y: ytile, z: zoom };
}

function toCoordinates(tile) {
  const n = Math.pow(2, tile.z);
  const lon = tile.x / n * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * tile.y / n)));
  const lat = latRad / Math.PI * 180;
  return { lat, lon };
}

function toBoundingBox(tile) {
  const topLeft = toCoordinates(tile);
  const bottomRight = toCoordinates({
    x: tile.x + 1,
    y: tile.y + 1,
    z: tile.z
  });
  return [topLeft, bottomRight];
}

function toTiles(a, b) {
  const tileA = toTile(a.lat, a.lon);
  const tileB = toTile(b.lat, b.lon);

  assert(tileA.z, tileB.z, "Zoom level must match");

  const topLeft = {
    x: Math.min(tileA.x, tileB.x),
    y: Math.min(tileA.y, tileB.y)
  };
  const bottomRight = {
    x: Math.max(tileA.x, tileB.x),
    y: Math.max(tileA.y, tileB.y)
  };
  const z = tileA.z;

  let tiles = [];
  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    for (let y = topLeft.y; y <= bottomRight.y; y++) {
      tiles.push({ x, y, z });
    }
  }
  return tiles;
}

async function fetchTile(tile) {
  const number = Math.floor(Math.random() * 4) + 1;
  const server = `https://tiles0${number}.geocaching.com/`;

  const res = await request
    .get(`${server}/map.info`)
    .accept("json")
    .query({ x: tile.x, y: tile.y, z: tile.z });

  if (!res.ok) {
    throw new Error("Unable to fetch tile");
  }

  let datas = _.values(res.body.data);
  let flat = _.flatMap(datas, data => data.map(d => d.i));
  let gcs = _.uniq(flat);

  return gcs;
}

function connect() {
  const client = new kafka.KafkaClient({ kafkaHost: "localhost:9092" });
  const producer = new kafka.Producer(client, {});

  producer.on("error", error);

  return new Promise((resolve, reject) => {
    producer.on("ready", () => resolve({ client, producer }));
    producer.on("error", reject);
  });
}

function error(err) {
  if (err) {
    console.log(err);
  }
}

async function main() {
  let { client, producer } = await connect();

  // ugh
  let close = util.promisify(client.close).bind(client);
  let send = util.promisify(producer.send).bind(producer);

  let tiles = toTiles({ lat: 51, lon: 12 }, { lat: 51, lon: 12 });
  for (let tile of tiles) {
    let gcs = await fetchTile(tile);
    let bbox = toBoundingBox(tile);
    let messages = gcs.map(gc => JSON.stringify({ gc, tile, bbox }));

    console.log(
      "x: " + tile.x,
      "y: " + tile.y,
      "z: " + tile.z,
      "gcs: " + gcs.length
    );

    await send([{ topic: "foo", messages }]);
  }
  await close();
}
main();
