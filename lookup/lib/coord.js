const cheerio = require("cheerio");
const cookie = require("cookie");
const debug = require("debug")("gc-lookup");
const request = require("superagent");

const update = require("./update");
const { daysAgo } = require("./util");

async function fetch(gc) {
  debug("Fetch %s (with auth)", gc);
  const res = await request
    .get(`https://www.geocaching.com/geocache/${gc}`)
    .set("Cookie", await authCookie());
  if (!res.ok) {
    throw new Error(`Failed to fetch ${gc}: Status ${res.status}`);
  }
  return res.text;
}

function parse(html) {
  $ = cheerio.load(html);
  const raw = $("#uxLatLon").text();
  const m = raw.match(/^([NS]) (\d+)° (\d+\.\d+) ([EW]) (\d+)° (\d+\.\d+)$/);
  if (m == null) {
    throw new Error(`Failed to parse ${raw}`);
  }
  const [_, ns, latDeg, latMin, ew, lonDeg, lonMin] = m;
  const lon =
    (ns == "N" ? +1 : -1) * parseInt(latDeg) + parseFloat(latMin) / 60;
  const lat =
    (ew == "E" ? +1 : -1) * parseInt(lonDeg) + parseFloat(lonMin) / 60;
  return { lon, lat };
}

function parseCookies(result) {
  const header = result.header["set-cookie"];
  if (!header) {
    return {};
  }
  return header.map(cookie.parse).reduce((acc, x) => Object.assign(acc, x), {});
}

let authCookieCache = null;

async function authCookie() {
  if (authCookieCache) {
    return authCookieCache;
  }

  debug("Logging in");

  const rvt = "__RequestVerificationToken";
  const loginForm = await request("https://www.geocaching.com/account/login");
  debug("Login GET %d", loginForm.status);

  const firstVerificationToken = parseCookies(loginForm)[rvt];
  const html = cheerio.load(loginForm.text);
  const secondVerificationToken = html(`input[name='${rvt}']`).val();

  const username = process.env.GC_USERNAME;
  const password = process.env.GC_PASSWORD;

  const login = await request
    .post("https://www.geocaching.com/account/login")
    .type("form")
    .redirects(0)
    .ok(res => res.status < 400)
    .set("Cookie", cookie.serialize(rvt, firstVerificationToken))
    .send({
      [rvt]: secondVerificationToken,
      Username: username,
      Password: password
    });

  debug("Login POST %d", login.status);

  const authValue = parseCookies(login).gspkauth;

  authCookieCache = cookie.serialize("gspkauth", authValue);
  return authCookieCache;
}

async function processCoords(collection) {
  if (!process.env.GC_USERNAME || !process.env.GC_PASSWORD) {
    debug("Skipping coordinate update. Missing GC_USERNAME and GC_PASSWORD");
    return;
  }

  debug("Updating coordinates");
  const fresh = false;
  const query = fresh
    ? {}
    : {
        parsed: { premium: false },
        $or: [
          { coord: { $exists: false } },
          { coord_date: { $lt: daysAgo(60) } }
        ]
      };
  await update(
    collection,
    query,
    async doc => {
      return {
        coord: parse(await fetch(doc.gc)),
        coord_date: new Date()
      };
    },
    5
  );
}

module.exports = processCoords;
