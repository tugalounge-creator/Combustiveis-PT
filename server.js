const __memCache = new Map();
const __origFetch = global.fetch;

const __stooqMap = {
  "BZ=F": "cb.f",
  "CL=F": "cl.f",
  "EURUSD=X": "eurusd",
  "PSI20.LS": "^psi20",
  "^STOXX50E": "^sx5e",
  "^GDAXI": "^dax",
  "^IBEX": "^ibex",
  "^FCHI": "^cac",
  "^FTSE": "^ukx",
  "^GSPC": "^spx",
  "^IXIC": "^ndq",
  "^DJI": "^dji",
  "^N225": "^nkx",
  "^HSI": "^hsi",
  "^BVSP": "^bvsp",
  "GC=F": "xauusd",
  "SI=F": "xagusd",
  "NG=F": "ng.f",
  "HG=F": "hg.f",
  "ZW=F": "zw.f",
  "KC=F": "kc.f"
};

async function __fetchStooqHistory(sym) {
  const sq = __stooqMap[sym];
  if (!sq) return null;
  try {
    const r = await __origFetch(`https://stooq.com/q/d/l/?s=${encodeURIComponent(sq)}&i=d`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(4500)
    });
    if (!r.ok) return null;
    const lines = (await r.text()).trim().split(/\r?\n/).slice(1).filter(Boolean).slice(-120);
    const ts = [];
    const cl = [];
    for (const ln of lines) {
      const c = ln.split(",");
      const t = Math.floor(new Date((c[0] || "") + "T16:00:00Z").getTime() / 1000);
      const v = parseFloat(c[4]);
      if (!isNaN(t) && !isNaN(v) && v > 0) {
        ts.push(t);
        cl.push(v);
      }
    }
    if (cl.length < 2) return null;
    return JSON.stringify({
      chart: {
        result: [{
          meta: {
            regularMarketPrice: cl[cl.length - 1],
            chartPreviousClose: cl[cl.length - 2],
            previousClose: cl[cl.length - 2]
          },
          timestamp: ts,
          indicators: { quote: [{ close: cl }] }
        }]
      }
    });
  } catch (e) {
    return null;
  }
}

global.fetch = async function(urlInput, opts) {
  const u = String(urlInput || "");
  if (!u.includes("yahoo.com")) return __origFetch(urlInput, opts);
  const key = u.replace(/([?&])_=[^&]+(&|$)/, "$1").replace(/[?&]$/, "");
  const headers = Object.assign({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/json,*/*"
  }, (opts && opts.headers) || {});
  try {
    const res = await __origFetch(u, Object.assign({}, opts || {}, {
      headers,
      signal: AbortSignal.timeout(4000)
    }));
    if (res.ok) {
      const txt = await res.text();
      if (txt && txt.includes("timestamp") && txt.includes("close")) {
        __memCache.set(key, txt);
        return new Response(txt, { status: 200, headers: { "Content-Type": "application/json" } });
      }
    }
  } catch (e) {}
  const m = u.match(/\/chart\/([^?]+)/);
  const stooq = await __fetchStooqHistory((m && m[1]) ? decodeURIComponent(m[1]) : "");
  if (stooq) {
    __memCache.set(key, stooq);
    return new Response(stooq, { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (__memCache.has(key)) {
    return new Response(__memCache.get(key), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return new Response('{"chart":{"result":[]}}', { status: 200, headers: { "Content-Type": "application/json" } });
};

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 3000;
const HISTORY_FILE = path.join(__dirname, "history-data.json");
const VALID_FUELS = new Set(["gasoleo", "gasoleo_esp", "gasolina95", "gasolina98", "gpl"]);

const DGEG_FUEL_MAP = {
  gasoleo: "2101",
  gasoleo_esp: "2105",
  gasolina95: "3201",
  gasolina98: "3205",
  gpl: "1120"
};

const cache = {
  market: { data: null, ts: 0 },
  postos: {},
  national: {},
  news: {}
};

function fetchRaw(targetUrl, extraHeaders) {
  return new Promise((resolve, reject) => {
    const req = https.get(targetUrl, {
      headers: Object.assign({
        "User-Agent": "CombustiveisPTPro/2.1 (https://localhost)",
        "Accept": "application/json, text/plain, */*"
      }, extraHeaders || {}),
      timeout: 12000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const nextUrl = new URL(res.headers.location, targetUrl).toString();
        return fetchRaw(nextUrl, extraHeaders).then(resolve).catch(reject);
      }
      if (res.statusCode && res.statusCode >= 400) {
        return reject(new Error("HTTP " + res.statusCode));
      }
      let raw = "";
      res.on("data", chunk => { raw += chunk; });
      res.on("end", () => resolve(raw));
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
  });
}

async function fetchJson(targetUrl, extraHeaders) {
  return JSON.parse(await fetchRaw(targetUrl, extraHeaders));
}

function parseDgegPrice(val) {
  const num = parseFloat(String(val || "").replace("€", "").replace(",", ".").trim());
  return (isFinite(num) && num > 0.2 && num < 6.0) ? num : NaN;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getDefault6MonthsHistory() {
  const dates = [
    "2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22", "2026-06-29",
    "2026-07-06", "2026-07-13", "2026-07-20", "2026-07-27",
    "2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31",
    "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28",
    "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26",
    "2026-11-02", "2026-11-09", "2026-11-16"
  ];
  const base = {
    gasoleo:     [1.765, 1.778, 1.792, 1.805, 1.812, 1.825, 1.838, 1.845, 1.852, 1.868, 1.880, 1.895, 1.912, 1.930, 1.948, 1.965, 1.982, 1.998, 2.015, 2.032, 2.045, 2.059, 2.069, 2.085, 2.078],
    gasoleo_esp: [1.875, 1.888, 1.902, 1.915, 1.922, 1.935, 1.948, 1.955, 1.962, 1.978, 1.990, 2.005, 2.022, 2.040, 2.058, 2.075, 2.092, 2.108, 2.125, 2.142, 2.155, 2.169, 2.179, 2.195, 2.189],
    gasolina95:  [1.695, 1.708, 1.718, 1.729, 1.735, 1.748, 1.758, 1.765, 1.772, 1.785, 1.795, 1.808, 1.820, 1.832, 1.845, 1.858, 1.869, 1.878, 1.888, 1.895, 1.899, 1.905, 1.912, 1.919, 1.909],
    gasolina98:  [1.855, 1.868, 1.878, 1.889, 1.895, 1.908, 1.918, 1.925, 1.932, 1.945, 1.955, 1.968, 1.980, 1.992, 2.005, 2.018, 2.029, 2.038, 2.048, 2.055, 2.059, 2.065, 2.072, 2.079, 2.069],
    gpl:         [0.865, 0.870, 0.875, 0.880, 0.885, 0.890, 0.895, 0.900, 0.905, 0.910, 0.915, 0.920, 0.925, 0.930, 0.935, 0.940, 0.945, 0.950, 0.954, 0.958, 0.961, 0.964, 0.966, 0.971, 0.969]
  };
  const out = {};
  Object.keys(base).forEach(k => {
    out[k] = dates.map((d, i) => ({
      date: d,
      pump: base[k][i],
      estimated: +(base[k][i] - 0.004).toFixed(3)
    }));
  });
  return out;
}

function readHistory() {
  const def = getDefault6MonthsHistory();
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const saved = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
      Object.keys(def).forEach(k => {
        if (!Array.isArray(saved[k]) || saved[k].length < 10) {
          const extra = Array.isArray(saved[k]) ? saved[k].filter(x => x && x.date > "2026-11-16") : [];
          saved[k] = def[k].concat(extra);
        }
      });
      return saved;
    }
  } catch (e) {}
  return def;
}

function writeHistory(data) {
  const tmpFile = HISTORY_FILE + ".tmp";
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmpFile, HISTORY_FILE);
}

function isContinentalStationSync(p) {
  const islands = new Set([
    "ilha da madeira", "ilha de porto santo", "ilha de sao miguel", "ilha terceira",
    "ilha do faial", "ilha do pico", "ilha de sao jorge", "ilha graciosa",
    "ilha das flores", "ilha de santa maria", "ilha do corvo",
    "regiao autonoma da madeira", "regiao autonoma dos acores"
  ]);
  const dNorm = String(p.Distrito || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return Boolean(dNorm) &&
    !islands.has(dNorm) &&
    !dNorm.includes("ilha") &&
    !dNorm.includes("acores") &&
    !dNorm.includes("madeira");
}

async function getContinentalAveragePrice(tipo) {
  const safeTipo = VALID_FUELS.has(tipo) ? tipo : "gasoleo";
  const all = await fetchNationalDgegList(safeTipo);
  const cont = all.filter(isContinentalStationSync);
  const pool = cont.length > 50 ? cont : all;
  const prices = pool.map(p => parseDgegPrice(p.Preco)).filter(v => !isNaN(v));
  if (!prices.length) {
    return { ok: false, tipo: safeTipo, average: null, count: 0 };
  }
  const sum = prices.reduce((acc, v) => acc + v, 0);
  const avg = +(sum / prices.length).toFixed(3);
  return { ok: true, tipo: safeTipo, average: avg, count: prices.length };
}

async function getMarketData(forceRefresh) {
  const now = Date.now();
  if (!forceRefresh && cache.market.data && (now - cache.market.ts) < 30000) {
    return cache.market.data;
  }
  let brent = 92.20;
  let eurUsd = 1.0992;
  let fxDate = new Date().toISOString().slice(0, 10);
  let fonte = "Reserva";
  let aoVivo = false;

  let fxLive = false;
  try {
    const hFxLive = "https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=1m&range=1d";
    const fxY = await fetchJson(hFxLive);
    const metaFx = fxY && fxY.chart && fxY.chart.result && fxY.chart.result[0] && fxY.chart.result[0].meta;
    if (metaFx && metaFx.regularMarketPrice && metaFx.regularMarketPrice > 0.5) {
      eurUsd = metaFx.regularMarketPrice;
      fxDate = "Forex ao vivo";
      fxLive = true;
    }
  } catch (e) {}

  if (!fxLive) {
    try {
      const hFx = "https://api.frankfurter.app/latest?from=EUR&to=USD";
      const fxRes = await fetchJson(hFx);
      if (fxRes && fxRes.rates && fxRes.rates.USD) {
        eurUsd = fxRes.rates.USD;
        fxDate = fxRes.date || fxDate;
      }
    } catch (e) {}
  }

  try {
    const hYahoo = "https://query1.finance.yahoo.com/v8/finance/chart/BZ=F?interval=1m&range=1d";
    const yRes = await fetchJson(hYahoo);
    const meta = yRes && yRes.chart && yRes.chart.result && yRes.chart.result[0] && yRes.chart.result[0].meta;
    if (meta && meta.regularMarketPrice && meta.regularMarketPrice > 10) {
      brent = meta.regularMarketPrice;
      fonte = "Yahoo";
      aoVivo = true;
    }
  } catch (e) {}

  if (!aoVivo) {
    try {
      const hCnbc = "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=@LCO.1&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json";
      const rawCnbc = await fetchRaw(hCnbc);
      const mc = rawCnbc.match(/"last"\s*:\s*"([0-9.]+)"/);
      if (mc && mc[1] && parseFloat(mc[1]) > 10) {
        brent = parseFloat(mc[1]);
        fonte = "CNBC";
        aoVivo = true;
      }
    } catch (e) {}
  }

  if (!aoVivo) {
    try {
      const hStooq = "https://stooq.com/q/l/?s=cb.f&f=sd2t2ohlcv&h&e=csv";
      const csv = await fetchRaw(hStooq);
      const linhas = csv.trim().split(/\r?\n/);
      if (linhas.length > 1) {
        const val = parseFloat(linhas[1].split(",")[6]);
        if (!isNaN(val) && val > 10) {
          brent = val;
          fonte = "Stooq";
          aoVivo = true;
        }
      }
    } catch (e) {}
  }

  const result = { ok: true, brent, eurUsd, fxDate, fonte, aoVivo };
  cache.market = { data: result, ts: now };
  return result;
}

const CITY_COORDS = {
  "quarteira": { lat: 37.0715, lon: -8.1005 },
  "vilamoura": { lat: 37.0885, lon: -8.1220 },
  "loule": { lat: 37.1378, lon: -8.0235 },
  "almancil": { lat: 37.0867, lon: -8.0315 },
  "faro": { lat: 37.0194, lon: -7.9304 },
  "albufeira": { lat: 37.0891, lon: -8.2479 },
  "olhao": { lat: 37.0260, lon: -7.8411 },
  "tavira": { lat: 37.1273, lon: -7.6486 },
  "portimao": { lat: 37.1386, lon: -8.5378 },
  "lagos": { lat: 37.1028, lon: -8.6730 },
  "silves": { lat: 37.1883, lon: -8.4384 },
  "lagoa": { lat: 37.1353, lon: -8.4525 },
  "lisboa": { lat: 38.7223, lon: -9.1393 },
  "porto": { lat: 41.1579, lon: -8.6291 },
  "coimbra": { lat: 40.2033, lon: -8.4103 },
  "braga": { lat: 41.5454, lon: -8.4265 },
  "setubal": { lat: 38.5244, lon: -8.8882 },
  "aveiro": { lat: 40.6405, lon: -8.6538 },
  "leiria": { lat: 39.7436, lon: -8.8071 },
  "evora": { lat: 38.5714, lon: -7.9135 }
};

async function geocodeCity(cityName) {
  const key = String(cityName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (!key) return null;
  if (CITY_COORDS[key]) return CITY_COORDS[key];
  try {
    const q = encodeURIComponent(cityName + ", Portugal");
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
    const res = await fetchJson(nomUrl, { "Accept-Language": "pt-PT,pt;q=0.9" });
    if (Array.isArray(res) && res.length > 0) {
      const lat = parseFloat(res[0].lat);
      const lon = parseFloat(res[0].lon);
      if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
    }
  } catch (e) {}
  return null;
}

async function fetchNationalDgegList(tipo) {
  const safeTipo = VALID_FUELS.has(tipo) ? tipo : "gasoleo";
  const codComb = DGEG_FUEL_MAP[safeTipo];
  const now = Date.now();
  if (cache.national[codComb] && (now - cache.national[codComb].ts) < 900000) {
    return cache.national[codComb].lista;
  }
  const dgegUrl = `https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb/PesquisarPostos?idsTiposComb=${codComb}&idMarca=&idTipoPosto=&idDistrito=&idsMunicipios=&qtdPorPagina=3500&pagina=1`;
  const json = await fetchJson(dgegUrl, { "Referer": "https://dgeg.gov.pt" });
  const rawList = Array.isArray(json && json.resultado) ? json.resultado : [];
  const cleanList = rawList.filter(p => !isNaN(parseDgegPrice(p.Preco)));
  cache.national[codComb] = { lista: cleanList, ts: now };
  return cleanList;
}

async function getSuggestions(query) {
  const q = String(query || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (q.length < 2) return [];
  try {
    const all = await fetchNationalDgegList("gasoleo");
    const seen = new Set();
    const matches = [];
    for (const p of all) {
      for (const candidate of [p.Municipio, p.Localidade]) {
        const clean = String(candidate || "").trim();
        if (!clean) continue;
        const norm = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        if (!seen.has(norm) && norm.includes(q)) {
          seen.add(norm);
          matches.push(clean);
        }
      }
      if (matches.length >= 15) break;
    }
    return matches.sort((a, b) => a.localeCompare(b, "pt")).slice(0, 10);
  } catch (e) {
    return [];
  }
}

async function getPostosDgeg(tipo, local, lat, lon, raio) {
  const safeTipo = VALID_FUELS.has(tipo) ? tipo : "gasoleo";
  const codComb = DGEG_FUEL_MAP[safeTipo];
  const maxKm = (!isNaN(raio) && raio > 0) ? Math.min(raio, 250) : 15;
  const cacheKey = `${codComb}_${String(local || "").toLowerCase()}_${lat ?? ""}_${lon ?? ""}_${maxKm}`;
  const now = Date.now();
  if (cache.postos[cacheKey] && (now - cache.postos[cacheKey].ts) < 900000) {
    return cache.postos[cacheKey].data;
  }

  try {
    let lista = await fetchNationalDgegList(safeTipo);
    let centerLat = lat;
    let centerLon = lon;

    if ((centerLat === null || isNaN(centerLat)) && local) {
      const coords = await geocodeCity(local);
      if (coords) {
        centerLat = coords.lat;
        centerLon = coords.lon;
      }
    }

    if (centerLat !== null && centerLon !== null && !isNaN(centerLat) && !isNaN(centerLon)) {
      lista = lista.map(p => {
        const pLat = parseFloat(String(p.Latitude || "").replace(",", "."));
        const pLon = parseFloat(String(p.Longitude || "").replace(",", "."));
        const dist = (!isNaN(pLat) && !isNaN(pLon)) ? haversineKm(centerLat, centerLon, pLat, pLon) : 9999;
        return Object.assign({}, p, { dist });
      }).filter(p => p.dist <= maxKm);
    } else if (local) {
      const q = local.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      lista = lista.filter(p => {
        const muni = String(p.Municipio || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const loc = String(p.Localidade || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const mor = String(p.Morada || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return muni.includes(q) || loc.includes(q) || mor.includes(q);
      });
    }

    lista.sort((a, b) => (parseDgegPrice(a.Preco) || 99) - (parseDgegPrice(b.Preco) || 99));
    const payload = { ok: true, postos: lista.slice(0, 60) };
    cache.postos[cacheKey] = { data: payload, ts: now };
    return payload;
  } catch (err) {
    return { ok: false, error: "Erro ao contactar a DGEG.", postos: [] };
  }
}

async function getRankingDgeg(tipo, distrito, concelho, scope) {
  try {
    const all = await fetchNationalDgegList(tipo);
    const scopedList = scope === "continente" ? all.filter(isContinentalStationSync) : all;

    const sortedAsc = scopedList.slice().sort((a, b) => parseDgegPrice(a.Preco) - parseDgegPrice(b.Preco));
    const topCheapest = sortedAsc.slice(0, 10);
    const topExpensive = sortedAsc.slice(-10).reverse();

    const districtMap = {};
    all.forEach(p => {
      const distName = String(p.Distrito || "").trim();
      const muniName = String(p.Municipio || "").trim();
      if (!distName) return;
      if (!districtMap[distName]) districtMap[distName] = new Set();
      if (muniName) districtMap[distName].add(muniName);
    });

    const distritos = Object.keys(districtMap).sort((a, b) => a.localeCompare(b, "pt"));
    const selectedDist = distrito && districtMap[distrito] ? distrito : (distritos[0] || "");
    const concelhos = selectedDist ? Array.from(districtMap[selectedDist]).sort((a, b) => a.localeCompare(b, "pt")) : [];

    let filteredRegion = all;
    if (selectedDist) {
      filteredRegion = filteredRegion.filter(p => String(p.Distrito || "").trim() === selectedDist);
    }
    if (concelho) {
      filteredRegion = filteredRegion.filter(p => String(p.Municipio || "").trim() === concelho);
    }
    filteredRegion = filteredRegion.slice().sort((a, b) => parseDgegPrice(a.Preco) - parseDgegPrice(b.Preco));

    return {
      ok: true,
      totalNational: all.length,
      topCheapest,
      topExpensive,
      distritos,
      selectedDistrito: selectedDist,
      concelhos,
      regionStations: filteredRegion.slice(0, 80)
    };
  } catch (err) {
    return { ok: false, error: "Erro ao obter ranking nacional da DGEG." };
  }
}

function pointToSegmentDistKm(pLat, pLon, aLat, aLon, bLat, bLon) {
  const toRad = d => d * Math.PI / 180;
  const kx = 111.32 * Math.cos(toRad((aLat + bLat) / 2));
  const ky = 110.57;
  const px = (pLon - aLon) * kx;
  const py = (pLat - aLat) * ky;
  const bx = (bLon - aLon) * kx;
  const by = (bLat - aLat) * ky;
  const len2 = bx * bx + by * by;
  const t = len2 > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / len2)) : 0;
  const dx = px - t * bx;
  const dy = py - t * by;
  return Math.sqrt(dx * dx + dy * dy);
}

async function getRouteStations(tipo, origem, destino) {
  try {
    const c1 = await geocodeCity(origem);
    const c2 = await geocodeCity(destino);
    if (!c1 || !c2) return { ok: false, error: "Não foi possível localizar a origem ou o destino." };

    let distKm = haversineKm(c1.lat, c1.lon, c2.lat, c2.lon) * 1.22;
    let poly = [{ lat: c1.lat, lon: c1.lon }, { lat: c2.lat, lon: c2.lon }];

    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${c1.lon},${c1.lat};${c2.lon},${c2.lat}?overview=simplified&geometries=geojson`;
      const rData = await fetchJson(osrmUrl);
      if (rData && rData.routes && rData.routes.length > 0) {
        distKm = rData.routes[0].distance / 1000;
        const coords = rData.routes[0].geometry && rData.routes[0].geometry.coordinates;
        if (Array.isArray(coords) && coords.length > 1) {
          poly = coords.map(pt => ({ lat: Number(pt[1]), lon: Number(pt[0]) }));
        }
      }
    } catch (e) {}

    const all = await getPostosDgeg(tipo, "", (c1.lat + c2.lat) / 2, (c1.lon + c2.lon) / 2, Math.max(80, Math.min(250, distKm * 0.65)));
    const candidatos = (all.postos || []).map(p => {
      const pLat = parseFloat(String(p.Latitude || "").replace(",", "."));
      const pLon = parseFloat(String(p.Longitude || "").replace(",", "."));
      let minCorridorKm = 999;
      if (!isNaN(pLat) && !isNaN(pLon)) {
        for (let i = 0; i < poly.length - 1; i++) {
          const dSeg = pointToSegmentDistKm(pLat, pLon, poly[i].lat, poly[i].lon, poly[i + 1].lat, poly[i + 1].lon);
          if (dSeg < minCorridorKm) minCorridorKm = dSeg;
        }
      }
      const detourRoundTripKm = +(minCorridorKm * 2.4).toFixed(1);
      return Object.assign({}, p, { corridorKm: +minCorridorKm.toFixed(1), detourKm: detourRoundTripKm });
    }).filter(p => p.detourKm <= 5.0);

    candidatos.sort((a, b) => (parseDgegPrice(a.Preco) || 99) - (parseDgegPrice(b.Preco) || 99));
    return { ok: true, distKm: +distKm.toFixed(1), origin: c1, dest: c2, poly, postos: candidatos.slice(0, 10) };
  } catch (err) {
    return { ok: false, error: "Erro interno ao calcular rota." };
  }
}

const FAVICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0f4c81"/><text x="32" y="44" font-size="34" text-anchor="middle" fill="#ffffff">⛽</text></svg>';

function decodeXmlEntities(str) {
  return String(str || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/'/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRssItems(xml, maxItems) {
  const items = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < (maxItems || 10)) {
    const block = match[1];
    const titleM = block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const linkM = block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i);
    const pubDateM = block.match(/<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i);
    const sourceM = block.match(/<source\b[^>]*>([\s\S]*?)<\/source>/i);

    let title = decodeXmlEntities(titleM ? titleM[1] : "");
    const link = decodeXmlEntities(linkM ? linkM[1] : "");
    const pubDate = decodeXmlEntities(pubDateM ? pubDateM[1] : "");
    let source = decodeXmlEntities(sourceM ? sourceM[1] : "");

    if (!source && title.includes(" - ")) {
      const idx = title.lastIndexOf(" - ");
      source = title.slice(idx + 3).trim();
      title = title.slice(0, idx).trim();
    }
    if (title && link) {
      const parsedDate = pubDate ? new Date(pubDate) : new Date();
      items.push({
        title,
        link,
        source: source || "Notícias",
        pubDate: isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString()
      });
    }
  }
  return items;
}

async function getFuelNews(cat, forceRefresh) {
  const safeCat = cat === "intl" ? "intl" : "pt";
  const now = Date.now();
  if (!forceRefresh && cache.news[safeCat] && (now - cache.news[safeCat].ts) < 900000) {
    return cache.news[safeCat].data;
  }

  const rssUrls = safeCat === "intl"
    ? [
        "https://news.google.com/rss/search?q=Brent+crude+oil+OR+OPEC+OR+diesel+refining+margin&hl=en-US&gl=US&ceid=US:en",
        "https://news.google.com/rss/search?q=petr%C3%B3leo+Brent+OPEP+refina%C3%A7%C3%A3o&hl=pt-PT&gl=PT&ceid=PT:pt-150"
      ]
    : [
        "https://news.google.com/rss/search?q=pre%C3%A7os+combust%C3%ADveis+Portugal+gas%C3%B3leo+gasolina+DGEG&hl=pt-PT&gl=PT&ceid=PT:pt-150",
        "https://news.google.com/rss/search?q=petr%C3%B3leo+Brent+combust%C3%ADveis+Portugal&hl=pt-PT&gl=PT&ceid=PT:pt-150"
      ];

  let collected = [];
  for (const u of rssUrls) {
    try {
      const xml = await fetchRaw(u, { "Accept": "application/rss+xml, application/xml, text/xml, */*" });
      const parsed = parseRssItems(xml, 10);
      collected = collected.concat(parsed);
      if (collected.length >= 8) break;
    } catch (e) {}
  }

  const seen = new Set();
  const unique = [];
  for (const it of collected) {
    const key = it.title.toLowerCase().slice(0, 60);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(it);
    }
    if (unique.length >= 10) break;
  }

  unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  const payload = { ok: true, category: safeCat, items: unique };
  cache.news[safeCat] = { data: payload, ts: now };
  return payload;
}

async function fetchQuoteWithFallback(sym) {
  const yHost = "https://query1.finance.yahoo.com";
  const attempts = [
    `${yHost}/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=5m`,
    `${yHost}/v8/finance/chart/${encodeURIComponent(sym)}?range=5d&interval=1h`,
    `${yHost}/v8/finance/chart/${encodeURIComponent(sym)}?range=1mo&interval=1d`
  ];
  for (const u of attempts) {
    try {
      const d = await fetchJson(u);
      const r0 = d && d.chart && Array.isArray(d.chart.result) ? d.chart.result[0] : null;
      const m = r0 && r0.meta;
      const ts = (r0 && r0.timestamp) || [];
      const q0 = (r0 && r0.indicators && Array.isArray(r0.indicators.quote)) ? r0.indicators.quote[0] : null;
      const closes = (q0 && q0.close) || [];
      const validCloses = closes.filter(v => v != null && isFinite(v));
      const p = (m && isFinite(m.regularMarketPrice) && m.regularMarketPrice > 0)
        ? Number(m.regularMarketPrice)
        : (validCloses.length ? Number(validCloses[validCloses.length - 1]) : null);
      const prev = (m && isFinite(m.chartPreviousClose) && m.chartPreviousClose > 0)
        ? Number(m.chartPreviousClose)
        : ((m && isFinite(m.previousClose) && m.previousClose > 0)
            ? Number(m.previousClose)
            : (validCloses.length > 1 ? Number(validCloses[0]) : null));
      if (p && isFinite(p) && p > 0) {
        const chg = (prev && prev > 0) ? (((p - prev) / prev) * 100) : 0;
        const points = [];
        for (let i = 0; i < ts.length; i++) {
          const val = closes[i];
          if (val != null && isFinite(val)) {
            points.push({ t: ts[i] * 1000, v: +Number(val).toFixed(4) });
          }
        }
        return { price: p, prevClose: prev, changePct: +chg.toFixed(2), points };
      }
    } catch (e) {}
  }
  return { price: null, prevClose: null, changePct: 0, points: [] };
}

const server = http.createServer(async (req, res) => {
  const _u = new URL(req.url, "http://localhost");
  const pathname = _u.pathname;
  const query = _u.searchParams;

  if (pathname === "/api/commodities") {
    const list = [
      { name: "Ouro (USD/oz)", sym: "GC=F" },
      { name: "Prata (USD/oz)", sym: "SI=F" },
      { name: "Petróleo WTI (USD/barril)", sym: "CL=F" },
      { name: "Petróleo Brent (USD/barril)", sym: "BZ=F" },
      { name: "Gás Natural (USD/MMBtu)", sym: "NG=F" },
      { name: "Cobre (USD/lb)", sym: "HG=F" },
      { name: "Trigo (USc/bushel)", sym: "ZW=F" },
      { name: "Café (USc/lb)", sym: "KC=F" }
    ];
    const results = await Promise.all(list.map(async item => {
      const q = await fetchQuoteWithFallback(item.sym);
      return Object.assign({}, item, { price: q.price, changePct: q.changePct });
    }));
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(results));
  }

  if (pathname === "/api/chart") {
    const sym = String(query.get("sym") || "BZ=F");
    const rng = String(query.get("range") || "1d");
    const intvMap = { "1d": "5m", "5d": "15m", "1mo": "1h", "3mo": "1d", "1y": "1d", "5y": "1wk", "max": "1mo" };
    const interval = intvMap[rng] || "1d";
    try {
      const yHost = "https://query1.finance.yahoo.com";
      const chartUrl = `${yHost}/v8/finance/chart/${encodeURIComponent(sym)}?range=${encodeURIComponent(rng)}&interval=${encodeURIComponent(interval)}`;
      const data = await fetchJson(chartUrl);
      const res0 = data && data.chart && Array.isArray(data.chart.result) ? data.chart.result[0] : null;
      const ts = (res0 && res0.timestamp) || [];
      const q0 = (res0 && res0.indicators && Array.isArray(res0.indicators.quote)) ? res0.indicators.quote[0] : null;
      const closes = (q0 && q0.close) || [];
      const meta = (res0 && res0.meta) || {};
      const points = [];
      for (let i = 0; i < ts.length; i++) {
        const val = closes[i];
        if (val != null && isFinite(val)) {
          points.push({ t: ts[i] * 1000, v: +Number(val).toFixed(4) });
        }
      }
      if (points.length > 0) {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({
          ok: true,
          price: meta.regularMarketPrice || points[points.length - 1].v,
          prevClose: meta.chartPreviousClose || meta.previousClose || null,
          points
        }));
      }
      const fb = await fetchQuoteWithFallback(sym);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({
        ok: fb.points.length > 0,
        price: fb.price,
        prevClose: fb.prevClose,
        points: fb.points
      }));
    } catch (e) {
      const fb = await fetchQuoteWithFallback(sym);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({
        ok: fb.points.length > 0,
        price: fb.price,
        prevClose: fb.prevClose,
        points: fb.points
      }));
    }
  }

  if (pathname === "/api/indices") {
    const list = [
      { group: "eu", name: "PSI — Portugal", sym: "PSI20.LS" },
      { group: "eu", name: "EURO STOXX 50", sym: "^STOXX50E" },
      { group: "eu", name: "DAX 40 — Alemanha", sym: "^GDAXI" },
      { group: "eu", name: "CAC 40 — França", sym: "^FCHI" },
      { group: "eu", name: "IBEX 35 — Espanha", sym: "^IBEX" },
      { group: "eu", name: "FTSE 100 — Reino Unido", sym: "^FTSE" },
      { group: "world", name: "S&P 500 — EUA", sym: "^GSPC" },
      { group: "world", name: "Nasdaq 100 — EUA", sym: "^IXIC" },
      { group: "world", name: "Dow Jones 30 — EUA", sym: "^DJI" },
      { group: "world", name: "Nikkei 225 — Japão", sym: "^N225" },
      { group: "world", name: "Hang Seng — Hong Kong", sym: "^HSI" },
      { group: "world", name: "Ibovespa — Brasil", sym: "^BVSP" }
    ];
    const results = await Promise.all(list.map(async item => {
      const q = await fetchQuoteWithFallback(item.sym);
      return Object.assign({}, item, { price: q.price, changePct: q.changePct });
    }));
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(results));
  }

  if (pathname === "/api/news") {
    const data = await getFuelNews(query.get("cat") || "pt", Boolean(query.get("force")));
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(data));
  }

  if (pathname === "/api/dgeg-average") {
    const avgData = await getContinentalAveragePrice(query.get("tipo") || "gasoleo");
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(avgData));
  }

  if (pathname === "/api/market") {
    const data = await getMarketData(Boolean(query.get("t") || query.get("force")));
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(data));
  }

  if (pathname === "/api/suggest") {
    const list = await getSuggestions(query.get("q") || "");
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(list));
  }

  if (pathname === "/api/postos") {
    const tipo = query.get("tipo") || "gasoleo";
    const local = query.get("local") || "";
    const latRaw = query.get("lat");
    const lonRaw = query.get("lon");
    const raioRaw = query.get("raio");
    const data = await getPostosDgeg(
      tipo,
      local,
      latRaw !== null && latRaw !== "" ? parseFloat(latRaw) : null,
      lonRaw !== null && lonRaw !== "" ? parseFloat(lonRaw) : null,
      raioRaw !== null && raioRaw !== "" ? parseFloat(raioRaw) : 15
    );
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(data));
  }

  if (pathname === "/api/ranking") {
    const data = await getRankingDgeg(
      query.get("tipo") || "gasoleo",
      query.get("distrito") || "",
      query.get("concelho") || "",
      query.get("scope") || "all"
    );
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(data));
  }

  if (pathname === "/api/route") {
    const dataRoute = await getRouteStations(
      query.get("tipo") || "gasoleo",
      query.get("origem") || "Quarteira",
      query.get("destino") || "Lisboa"
    );
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(dataRoute));
  }

  if (pathname === "/api/history") {
    const hist = readHistory();
    const key = VALID_FUELS.has(query.get("tipo")) ? query.get("tipo") : "gasoleo";

    if (req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify(hist[key] || []));
    }

    if (req.method === "POST") {
      let body = "";
      req.on("data", chunk => {
        body += chunk;
        if (body.length > 10000) req.destroy();
      });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          const targetKey = VALID_FUELS.has(parsed.tipo) ? parsed.tipo : key;
          const estNum = Number(parsed.estimated);
          const pumpNum = Number(parsed.pump);
          if (!isFinite(estNum) || !isFinite(pumpNum) || estNum <= 0 || pumpNum <= 0) {
            res.writeHead(400, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ ok: false, error: "Valores inválidos" }));
          }
          if (!hist[targetKey]) hist[targetKey] = [];
          const today = new Date().toISOString().slice(0, 10);
          const idx = hist[targetKey].findIndex(i => i.date === today);
          const entry = { date: today, estimated: +estNum.toFixed(3), pump: +pumpNum.toFixed(3) };
          if (idx >= 0) hist[targetKey][idx] = entry;
          else hist[targetKey].push(entry);
          writeHistory(hist);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false }));
        }
      });
      return;
    }
  }

  if (pathname === "/favicon.ico") {
    res.writeHead(200, { "Content-Type": "image/svg+xml" });
    return res.end(FAVICON_SVG);
  }

  const staticMap = {
    "/": { file: "simulador-combustiveis-pt.html", type: "text/html; charset=utf-8" },
    "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
    "/app.js": { file: "app.js", type: "application/javascript; charset=utf-8" },
    "/manifest.json": { file: "manifest.json", type: "application/manifest+json; charset=utf-8" },
    "/sw.js": { file: "sw.js", type: "application/javascript; charset=utf-8" }
  };

  if (staticMap[pathname]) {
    const filePath = path.join(__dirname, staticMap[pathname].file);
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { "Content-Type": staticMap[pathname].type });
      return fs.createReadStream(filePath).pipe(res);
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("404");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor Combustíveis PT Pro ativo em http://localhost:${PORT}`);
});