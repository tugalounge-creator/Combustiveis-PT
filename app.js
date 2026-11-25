function attachBaseLayers(targetMap) {
  var osmUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  var satUrl = "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";
  var streets = L.tileLayer(osmUrl, { attribution: "© OpenStreetMap", maxZoom: 19 });
  var satelliteHybrid = L.tileLayer(satUrl, { attribution: "Satélite", maxZoom: 20 });

  streets.addTo(targetMap);

  var PillControl = L.Control.extend({
    options: { position: "topright" },
    onAdd: function() {
      var wrap = L.DomUtil.create("div");
      wrap.style.cssText = "display:inline-flex;background:#ffffff;border-radius:999px;padding:2px;box-shadow:0 2px 8px rgba(0,0,0,0.28);border:1px solid #cbd5e1;overflow:hidden;";
      L.DomEvent.disableClickPropagation(wrap);

      var btnMap = L.DomUtil.create("button", "", wrap);
      btnMap.type = "button";
      btnMap.textContent = "Mapa";

      var btnSat = L.DomUtil.create("button", "", wrap);
      btnSat.type = "button";
      btnSat.textContent = "Satélite";

      function setActive(isSat) {
        var base = "border:none;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;line-height:1.2;transition:all 0.15s;";
        btnMap.style.cssText = base + (!isSat ? "background:#0f4c81;color:#ffffff;" : "background:transparent;color:#0f172a;");
        btnSat.style.cssText = base + (isSat ? "background:#0f4c81;color:#ffffff;" : "background:transparent;color:#0f172a;");
        if (isSat) {
          if (targetMap.hasLayer(streets)) targetMap.removeLayer(streets);
          if (!targetMap.hasLayer(satelliteHybrid)) satelliteHybrid.addTo(targetMap);
        } else {
          if (targetMap.hasLayer(satelliteHybrid)) targetMap.removeLayer(satelliteHybrid);
          if (!targetMap.hasLayer(streets)) streets.addTo(targetMap);
        }
      }

      btnMap.onclick = function() { setActive(false); };
      btnSat.onclick = function() { setActive(true); };
      setActive(false);
      return wrap;
    }
  });

  targetMap.addControl(new PillControl());
}

var curFuel = "gasoleo", lastLat = null, lastLon = null, allStations = [], map = null, markersLayer = null, chartInst = null;
var lastRouteData = null, rankingLoadedForFuel = null;
var routeMap = null, routeLayer = null, userPin = null;

var LOW_COST_BRANDS = [
  "PRIO", "INTERMARCHÉ", "INTERMARCHE", "AUCHAN", "E.LECLERC", "ELECLERC",
  "PINGO DOCE", "CONTINENTE", "ALVES BANDEIRA", "REDE ENERGIA", "OZ ENERGIA", "BXPRESS"
];

var ALL_PT_LOCATIONS = [
  "Abrantes","Águeda","Aguiar da Beira","Alandroal","Albergaria-a-Velha","Albufeira","Alcácer do Sal","Alcanena","Alcobaça","Alcochete","Alcoutim","Alenquer","Alfândega da Fé","Alijó","Aljezur","Aljustrel","Almada","Almancil","Almeida","Almeirim","Almodôvar","Alpiarça","Alter do Chão","Alvaiázere","Alvito","Amadora","Amarante","Amares","Anadia","Angra do Heroísmo","Ansião","Arcos de Valdevez","Arganil","Armamar","Arouca","Arraiolos","Arronches","Arruda dos Vinhos","Aveiro","Avis","Azambuja",
  "Baião","Barcelos","Barrancos","Barreiro","Batalha","Beja","Belmonte","Benavente","Bombarral","Borba","Boticas","Braga","Bragança",
  "Cabeceiras de Basto","Cadaval","Caldas da Rainha","Calheta (Açores)","Calheta (Madeira)","Câmara de Lobos","Caminha","Campo Maior","Cantanhede","Carrazeda de Ansiães","Carregal do Sal","Cartaxo","Cascais","Castanheira de Pera","Castelo Branco","Castelo de Paiva","Castelo de Vide","Castro Daire","Castro Marim","Castro Verde","Celorico da Beira","Celorico de Basto","Chamusca","Chaves","Cinfães","Coimbra","Condeixa-a-Nova","Constância","Coruche","Corvo","Covilhã","Crato","Cuba",
  "Elvas","Entroncamento","Espinho","Esposende","Estarreja","Estremoz","Évora",
  "Fafe","Faro","Fátima","Felgueiras","Ferreira do Alentejo","Ferreira do Zêzere","Figueira da Foz","Figueira de Castelo Rodrigo","Figueiró dos Vinhos","Fornos de Algodres","Freixo de Espada à Cinta","Fronteira","Funchal","Fundão",
  "Gavião","Góis","Golegã","Gondomar","Gouveia","Grândola","Guarda","Guimarães",
  "Horta",
  "Idanha-a-Nova","Ílhavo",
  "Lagoa (Algarve)","Lagoa (Açores)","Lagos","Lajes das Flores","Lajes do Pico","Lamego","Leiria","Lisboa","Loulé","Loures","Lourinhã","Lousã","Lousada",
  "Mação","Macedo de Cavaleiros","Machico","Madalena","Mafra","Maia","Mangualde","Manteigas","Marco de Canaveses","Marinha Grande","Marvão","Matosinhos","Mealhada","Mêda","Melgaço","Mértola","Mesão Frio","Mira","Miranda do Corvo","Miranda do Douro","Mirandela","Mogadouro","Moimenta da Beira","Moita","Monção","Monchique","Mondim de Basto","Monforte","Montalegre","Montemor-o-Novo","Montemor-o-Velho","Montijo","Mora","Mortágua","Moura","Mourão","Murça","Murtosa",
  "Nazaré","Nelas","Nisa","Nordeste",
  "Óbidos","Odemira","Odivelas","Oeiras","Oleiros","Olhão","Oliveira de Azeméis","Oliveira de Frades","Oliveira do Bairro","Oliveira do Hospital","Ourém","Ourique","Ovar",
  "Paços de Ferreira","Palmela","Pampilhosa da Serra","Paredes","Paredes de Coura","Pedrógão Grande","Penacova","Penafiel","Penalva do Castelo","Penamacor","Penedono","Penela","Peniche","Peso da Régua","Pinhel","Pombal","Ponta Delgada","Ponta do Sol","Ponte da Barca","Ponte de Lima","Ponte de Sor","Portalegre","Portel","Portimão","Porto","Porto de Mós","Porto Moniz","Porto Santo","Póvoa de Lanhoso","Póvoa de Varzim","Povoação","Praia da Vitória","Proença-a-Nova",
  "Quarteira",
  "Redondo","Reguengos de Monsaraz","Resende","Ribeira Brava","Ribeira de Pena","Ribeira Grande","Rio Maior",
  "Sabrosa","Sabugal","Salvaterra de Magos","Santa Comba Dão","Santa Cruz","Santa Cruz da Graciosa","Santa Cruz das Flores","Santa Maria da Feira","Santa Marta de Penaguião","Santana","Santarém","Santiago do Cacém","Santo Tirso","São Brás de Alportel","São João da Madeira","São João da Pesqueira","São Pedro do Sul","São Roque do Pico","São Vicente","Sardoal","Sátão","Seia","Seixal","Sernancelhe","Serpa","Sertã","Sesimbra","Setúbal","Sever do Vouga","Silves","Sines","Sintra","Sobral de Monte Agraço","Soure","Sousel",
  "Tábua","Tabuaço","Tarouca","Tavira","Terras de Bouro","Tomar","Tondela","Torre de Moncorvo","Torres Novas","Torres Vedras","Trancoso","Trofa",
  "Vagos","Vale de Cambra","Valença","Valongo","Valpaços","Velas","Vendas Novas","Viana do Alentejo","Viana do Castelo","Vidigueira","Vieira do Minho","Vila de Rei","Vila do Bispo","Vila do Conde","Vila do Porto","Vila Flor","Vila Franca de Xira","Vila Franca do Campo","Vila Nova da Barquinha","Vila Nova de Cerveira","Vila Nova de Famalicão","Vila Nova de Foz Côa","Vila Nova de Gaia","Vila Nova de Paiva","Vila Nova de Poiares","Vila Pouca de Aguiar","Vila Real","Vila Real de Santo António","Vila Velha de Ródão","Vila Verde","Vila Viçosa","Vilamoura","Vimioso","Vinhais","Viseu","Vizela","Vouzela"
];

function initRouteMap() {
  if (routeMap || typeof L === "undefined" || !document.getElementById("route-map")) return;
  routeMap = L.map("route-map").setView(L.latLng(38.0, -8.3), 7);
  attachBaseLayers(routeMap);
  routeLayer = L.layerGroup().addTo(routeMap);
}

function drawRouteOnMap(d) {
  initRouteMap();
  if (!routeMap || !routeLayer || !d) return;
  routeLayer.clearLayers();
  var boundsR = L.latLngBounds();

  var pts = [];
  if (Array.isArray(d.poly)) {
    d.poly.forEach(function(pt) {
      var la = Array.isArray(pt) ? Number(pt[0]) : Number(pt.lat);
      var lo = Array.isArray(pt) ? Number(pt[1]) : Number(pt.lon);
      if (isFinite(la) && isFinite(lo) && la !== 0 && lo !== 0) {
        pts.push(L.latLng(la, lo));
      }
    });
  }

  if (pts.length < 2 && d.origin && d.dest) {
    pts = [L.latLng(d.origin.lat, d.origin.lon), L.latLng(d.dest.lat, d.dest.lon)];
  }
  if (pts.length >= 2) {
    L.polyline(pts, { color: "#0f4c81", weight: 5, opacity: 0.9 }).addTo(routeLayer);
    pts.forEach(function(ll) { boundsR.extend(ll); });
  }

  if (d.origin && isFinite(d.origin.lat)) {
    L.marker(L.latLng(d.origin.lat, d.origin.lon)).bindPopup("<strong>Origem</strong>").addTo(routeLayer);
    boundsR.extend(L.latLng(d.origin.lat, d.origin.lon));
  }
  if (d.dest && isFinite(d.dest.lat)) {
    L.marker(L.latLng(d.dest.lat, d.dest.lon)).bindPopup("<strong>Destino</strong>").addTo(routeLayer);
    boundsR.extend(L.latLng(d.dest.lat, d.dest.lon));
  }

  (d.postos || []).forEach(function(p) {
    var pLat = Number(String(p.Latitude || "").trim().replace(",", "."));
    var pLon = Number(String(p.Longitude || "").trim().replace(",", "."));
    if (isFinite(pLat) && isFinite(pLon)) {
      var pIcon = L.divIcon({
        className: "",
        html: '<div class="price-pin" style="background:#15803d;">' + escapeHtml(p.Preco || "") + '</div>',
        iconSize: L.point(64, 24)
      });
      L.marker(L.latLng(pLat, pLon), { icon: pIcon })
        .bindPopup("<strong>" + escapeHtml(p.Nome || "Posto") + "</strong><br>" + escapeHtml(p.Preco || "") + " €/L (Desvio: " + Number(p.detourKm || 0).toFixed(1).replace(".", ",") + " km)")
        .addTo(routeLayer);
      boundsR.extend(L.latLng(pLat, pLon));
    }
  });

  setTimeout(function() {
    routeMap.invalidateSize();
    if (boundsR.isValid()) routeMap.fitBounds(boundsR, { padding: L.point(25, 25) });
  }, 150);
}

function fmt(v, d) {
  return Number(v || 0).toFixed(d || 3).replace(".", ",") + " €";
}

function parsePrice(val) {
  var num = parseFloat(String(val || "").replace("€", "").replace(",",".").trim());
  return isFinite(num) ? num : NaN;
}

function escapeHtml(str) {
  var q = String.fromCharCode(34);
  var amp = String.fromCharCode(38);
  return String(str || "")
    .replace(/&/g, amp + "amp;")
    .replace(/</g, amp + "lt;")
    .replace(/>/g, amp + "gt;")
    .replace(new RegExp(q, "g"), amp + "quot;")
    .replace(/'/g, amp + "#39;");
}

function getDiscount() {
  var el = document.getElementById("cardDiscount");
  return el ? (parseFloat(el.value) || 0) : 0;
}

function isHighwayStation(p) {
  var txt = ((p.Nome || "") + " " + (p.Morada || "") + " " + (p.Localidade || "")).toUpperCase();
  return /\bA[0-9]{1,2}\b/.test(txt) ||
    txt.indexOf("AUTOESTRADA") !== -1 ||
    txt.indexOf("AUTO-ESTRADA") !== -1 ||
    txt.indexOf("ÁREA DE SERVIÇO") !== -1 ||
    txt.indexOf("AREA DE SERVICO") !== -1;
}

function isLowCostStation(p) {
  var brand = String(p.Marca || "").toUpperCase();
  return LOW_COST_BRANDS.some(function(b) { return brand.indexOf(b) !== -1; });
}

function getSunTimes(lat, lon, date) {
  var rad = Math.PI / 180;
  var start = new Date(date.getFullYear(), 0, 0);
  var dayOfYear = Math.floor((date - start) / 86400000);
  var lngHour = lon / 15;

  function calcTime(isSunrise) {
    var t = dayOfYear + ((isSunrise ? 6 : 18) - lngHour) / 24;
    var M = (0.9856 * t) - 3.289;
    var L = (M + (1.916 * Math.sin(M * rad)) + (0.020 * Math.sin(2 * M * rad)) + 282.634) % 360;
    if (L < 0) L += 360;
    var RA = (Math.atan(0.91764 * Math.tan(L * rad)) / rad) % 360;
    if (RA < 0) RA += 360;
    RA = (RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90)) / 15;
    var sinDec = 0.39782 * Math.sin(L * rad);
    var cosDec = Math.cos(Math.asin(sinDec));
    var cosH = (Math.cos(90.833 * rad) - (sinDec * Math.sin(lat * rad))) / (cosDec * Math.cos(lat * rad));
    if (cosH > 1 || cosH < -1) return null;
    var H = (isSunrise ? (360 - Math.acos(cosH) / rad) : (Math.acos(cosH) / rad)) / 15;
    var T = H + RA - (0.06571 * t) - 6.622;
    var UT = (T - lngHour) % 24;
    if (UT < 0) UT += 24;
    var res = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0));
    res.setUTCMinutes(Math.round(UT * 60));
    return res;
  }

  return { sunrise: calcTime(true), sunset: calcTime(false) };
}

function isNightBySun() {
  var lat = lastLat !== null ? lastLat : 37.0715;
  var lon = lastLon !== null ? lastLon : -8.1005;
  var now = new Date();
  var sun = getSunTimes(lat, lon, now);
  if (!sun.sunrise || !sun.sunset) {
    var h = now.getHours();
    return h >= 19 || h < 7;
  }
  return now < sun.sunrise || now >= sun.sunset;
}

function applyTheme(dark) {
  document.body.classList.toggle("dark-mode", dark);
  var btn = document.getElementById("btn-theme");
  if (btn) btn.textContent = dark ? "Modo Claro (Auto Sol)" : "Modo Escuro (Auto Sol)";
}

function initDarkMode() {
  var manual = JSON.parse(localStorage.getItem("theme_manual") || "null");
  var nightNow = isNightBySun();
  if (manual && manual.nightState === nightNow) {
    applyTheme(manual.dark);
  } else {
    localStorage.removeItem("theme_manual");
    applyTheme(nightNow);
  }
}

function toggleTheme() {
  var next = !document.body.classList.contains("dark-mode");
  localStorage.setItem("theme_manual", JSON.stringify({ dark: next, nightState: isNightBySun() }));
  applyTheme(next);
}

setInterval(initDarkMode, 60000);

function initMap() {
  if (map || typeof L === "undefined" || !document.getElementById("map")) return;
  map = L.map("map").setView(L.latLng(37.0715, -8.1005), 12);
  attachBaseLayers(map);
  markersLayer = L.layerGroup().addTo(map);
}

function calc() {
  var r = +document.getElementById("refinedUsdTon").value || 0;
  var fx = +document.getElementById("eurUsd").value || 1;
  var d = +document.getElementById("density").value || 0.8;
  var bio = +document.getElementById("biofuel").value || 0;
  var marg = +document.getElementById("margin").value || 0;
  var isp = +document.getElementById("isp").value || 0;
  var carb = +document.getElementById("carbon").value || 0;
  var vat = (+document.getElementById("vat").value || 0) / 100;
  var disc = getDiscount();

  var prod = (r / fx) / (1000 / d);
  var tIsp = isp + carb;
  var sub = prod + bio + marg + tIsp;
  var vAmt = sub * vat;
  var tot = Math.max(0, (sub + vAmt) - disc);
  var tTax = tIsp + vAmt;

  document.getElementById("final-price").textContent = fmt(tot) + "/L";
  document.getElementById("tax-weight").textContent = "Carga fiscal: " + (tot > 0 ? (tTax / (sub + vAmt) * 100) : 0).toFixed(1).replace(".", ",") + "%";
  document.getElementById("tripPrice").value = tot.toFixed(3);
  calcTrip();

  var cur = +document.getElementById("currentPumpPrice").value || 0;
  var tnk = +document.getElementById("tankSize").value || 50;
  var el = document.getElementById("weekly-diff");
  var alertBadge = document.getElementById("monday-alert-pill");

  if (cur > 0) {
    var df = (sub + vAmt) - cur;
    var tDf = df * tnk;
    var k = df > 0.0005 ? "+" : "";
    el.textContent = k + df.toFixed(3).replace(".", ",") + " €/L (" + k + tDf.toFixed(2).replace(".", ",") + " € / " + tnk + "L)";
    el.className = df > 0.002 ? "up" : (df < -0.002 ? "down" : "neutral");

    if (alertBadge) {
      if (df > 0.010) {
        alertBadge.textContent = "▲ Sobe seg. (" + k + df.toFixed(3).replace(".", ",") + " €) — Abasteça antes";
        alertBadge.className = "badge-pill badge-alert-up";
      } else if (df < -0.010) {
        alertBadge.textContent = "▼ Desce seg. (" + k + df.toFixed(3).replace(".", ",") + " €) — Aguarde";
        alertBadge.className = "badge-pill badge-alert-down";
      } else {
        alertBadge.textContent = "• Estável seg. (" + k + df.toFixed(3).replace(".", ",") + " €)";
        alertBadge.className = "badge-pill";
      }
    }
  }

  if (lastRouteData) renderRouteStations(lastRouteData);

  var simView = document.getElementById("view-simulador");
  if (simView && simView.classList.contains("active")) loadHistory();
}

function est() {
  var b = +document.getElementById("brentUsd").value || 0;
  var c = +document.getElementById("crackSpread").value || 0;
  var d = +document.getElementById("density").value || 0.8;
  document.getElementById("refinedUsdTon").value = Math.max(0, Math.round((b + c) * ((1000 / d) / 158.987)));
  calc();
}

function calcTrip() {
  var dist = +document.getElementById("tripDist").value || 0;
  var cons = +document.getElementById("tripCons").value || 0;
  var pr = +document.getElementById("tripPrice").value || 0;
  var liters = (dist / 100) * cons;
  document.getElementById("kpi-liters").textContent = liters.toFixed(1).replace(".", ",") + " L";
  document.getElementById("kpi-cost").textContent = fmt(liters * pr, 2);
  document.getElementById("kpi-100km").textContent = fmt(cons * pr, 2);
}

function buildNavButtons(p, includeMapFocus) {
  var la = Number(String(p.Latitude || "").trim().replace(",", "."));
  var lo = Number(String(p.Longitude || "").trim().replace(",", "."));
  if (!isFinite(la) || !isFinite(lo) || la === 0 || lo === 0) return "";

  var latStr = la.toFixed(6);
  var lonStr = lo.toFixed(6);
  var titleEnc = encodeURIComponent((p.Nome || "Posto") + " (" + (p.Preco || "") + "/L)");

  var html = '<div class="nav-btns">' +
    '<button type="button" class="nav-link nav-gmaps" onclick="openNav(\'gmaps\',' + la + ',' + lo + ')">Google Maps</button>' +
    '<button type="button" class="nav-link nav-waze" onclick="openNav(\'waze\',' + la + ',' + lo + ')">Waze</button>';
  if (includeMapFocus) {
    html += '<button type="button" class="nav-link nav-map" onclick="focusPin(' + latStr + ',' + lonStr + ')">Centrar Mapa</button>';
  }
  html += '<button type="button" class="nav-link nav-share" onclick="shareStation(\'' + titleEnc + '\',' + latStr + ',' + lonStr + ')">Partilhar</button></div>';
  return html;
}

function shareStation(titleEnc, lat, lon) {
  var title = decodeURIComponent(titleEnc);
  var gmapsUrl = "https://www.google.com/maps/search/?api=1&query=" + lat + "," + lon;
  var text = title + " — " + gmapsUrl;
  if (navigator.share) {
    navigator.share({ title: title, text: title, url: gmapsUrl }).catch(function() {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() {
      alert("Link do posto copiado para a área de transferência!");
    });
  }
}

function renderRouteStations(d) {
  var st = document.getElementById("route-status");
  var list = document.getElementById("route-stations-list");
  list.innerHTML = "";
  drawRouteOnMap(d);

  var disc = getDiscount();
  var refPrice = (+document.getElementById("currentPumpPrice").value || +document.getElementById("tripPrice").value || 2.00) - disc;
  var refillL = +document.getElementById("tripRefillLiters").value || 45;
  var cons = +document.getElementById("tripCons").value || 5.8;

  if (!d || !Array.isArray(d.postos) || !d.postos.length) {
    st.textContent = "Rota de " + Number(d && d.distKm || 0).toFixed(1).replace(".", ",") + " km calculada. Sem postos DGEG encontrados no corredor.";
    return;
  }

  st.textContent = "Rota de " + Number(d.distKm).toFixed(1).replace(".", ",") + " km — Comparação com referência (" + fmt(refPrice) + "/L) para abastecer " + refillL + " L:";

  var enriched = d.postos.map(function(p) {
    var pVal = parsePrice(p.Preco);
    if (isNaN(pVal)) return null;
    var grossSave = (refPrice - pVal) * refillL;
    var detourKm = Number(p.detourKm || 0);
    var detourCost = ((detourKm / 100) * cons) * pVal;
    var netSave = grossSave - detourCost;
    return { p: p, pVal: pVal, grossSave: grossSave, detourKm: detourKm, detourCost: detourCost, netSave: netSave };
  }).filter(Boolean).sort(function(a, b) { return b.netSave - a.netSave; });

  enriched.forEach(function(item) {
    var p = item.p;
    var worthIt = item.netSave > 0.25;
    var badgeBg = worthIt ? "#dcfce7" : "#fee2e2";
    var badgeCol = worthIt ? "#15803d" : "#b91c1c";
    var verdict = worthIt
      ? "✓ VALE A PENA DESVIAR (+" + item.netSave.toFixed(2).replace(".", ",") + " € líquidos)"
      : "✕ NÃO COMPENSA DESVIAR (" + item.netSave.toFixed(2).replace(".", ",") + " €)";

    var nav = buildNavButtons(p, false);
    var div = document.createElement("div");
    div.className = "station-item" + (worthIt ? " best-choice" : "");
    div.innerHTML = "<div><strong>" + escapeHtml(p.Nome || "Posto") + "</strong> (" + escapeHtml(p.Marca || "") + ") " +
      "<span style='background:" + badgeBg + ";color:" + badgeCol + ";padding:2px 7px;border-radius:4px;font-size:0.72rem;font-weight:700;'>" + escapeHtml(verdict) + "</span>" +
      "<br><small style='color:var(--muted);'>" + escapeHtml(p.Morada || "") + " - " + escapeHtml(p.Localidade || p.Municipio || "") +
      " — Desvio ida/volta: <strong>" + item.detourKm.toFixed(1).replace(".", ",") + " km</strong> (custo desvio: " + item.detourCost.toFixed(2).replace(".", ",") + " € | poupança bomba: " + item.grossSave.toFixed(2).replace(".", ",") + " €)</small>" +
      nav + "</div><div style='font-weight:800;color:" + badgeCol + ";font-size:1.2rem;'>" + escapeHtml(p.Preco || "") + "/L</div>";
    list.appendChild(div);
  });
}

function planRoute() {
  var orig = document.getElementById("routeOrigin").value.trim();
  var dest = document.getElementById("routeDest").value.trim();
  var st = document.getElementById("route-status");
  var list = document.getElementById("route-stations-list");
  var btn = document.getElementById("btn-calc-route");
  if (!orig || !dest) return;

  st.textContent = "A calcular rota de " + orig + " para " + dest + " e a verificar postos...";
  list.innerHTML = "";
  if (btn) btn.disabled = true;

  fetch("/api/route?tipo=" + encodeURIComponent(curFuel) + "&origem=" + encodeURIComponent(orig) + "&destino=" + encodeURIComponent(dest))
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (!d || !d.ok) {
        st.textContent = (d && d.error) ? d.error : "Erro ao calcular rota.";
        return;
      }
      lastRouteData = d;
      document.getElementById("tripDist").value = d.distKm;
      calcTrip();
      renderRouteStations(d);
    })
    .catch(function() {
      st.textContent = "Erro de ligação ao calcular a rota.";
    })
    .finally(function() {
      if (btn) btn.disabled = false;
    });
}

function renderStations() {
  initMap();
  var list = document.getElementById("station-list");
  var st = document.getElementById("postos-status");
  var brand = document.getElementById("brandFilter").value;
  var onlyLowCost = document.getElementById("filterLowCost") && document.getElementById("filterLowCost").checked;
  var noHighway = document.getElementById("filterNoHighway") && document.getElementById("filterNoHighway").checked;

  list.innerHTML = "";
  if (markersLayer) markersLayer.clearLayers();

  var filtered = allStations.filter(function(p) {
    if (brand && (p.Marca || "") !== brand) return false;
    if (onlyLowCost && !isLowCostStation(p)) return false;
    if (noHighway && isHighwayStation(p)) return false;
    return true;
  });

  if (!filtered.length) {
    st.textContent = "Sem postos para os filtros selecionados.";
    return;
  }
  st.textContent = filtered.length + " postos encontrados";

  var validPrices = filtered.map(function(p) { return parsePrice(p.Preco); }).filter(function(v) { return !isNaN(v); });
  var minP = validPrices.length ? Math.min.apply(null, validPrices) : 0;
  var maxP = validPrices.length ? Math.max.apply(null, validPrices) : minP;
  var bounds = map ? L.latLngBounds() : null;

  filtered.forEach(function(p, idx) {
    var pVal = parsePrice(p.Preco);
    var color = "#475569";
    var symbol = "•";
    if (!isNaN(pVal)) {
      if (maxP === minP || pVal <= minP + (maxP - minP) * 0.33) {
        color = "#15803d";
        symbol = "▼";
      } else if (pVal <= minP + (maxP - minP) * 0.66) {
        color = "#d97706";
        symbol = "●";
      } else {
        color = "#b91c1c";
        symbol = "▲";
      }
    }

    var la = Number(String(p.Latitude || "").trim().replace(",", "."));
    var lo = Number(String(p.Longitude || "").trim().replace(",", "."));
    var ok = isFinite(la) && isFinite(lo) && la !== 0 && lo !== 0;
    var nav = buildNavButtons(p, true);

    if (ok && map && markersLayer) {
      var icon = L.divIcon({
        className: "",
        html: '<div class="price-pin" style="background:' + color + ';">' + symbol + ' ' + escapeHtml(p.Preco || "") + '</div>',
        iconSize: L.point(64, 24)
      });
      var popupHtml = "<strong>" + escapeHtml(p.Nome || "Posto") + "</strong> (" + escapeHtml(p.Marca || "") + ")<br>" +
        "<strong style='color:" + color + ";'>" + escapeHtml(p.Preco || "") + "/L</strong><br>" +
        "<small>" + escapeHtml(p.Morada || "") + "</small>" + nav;
      L.marker(L.latLng(la, lo), { icon: icon }).bindPopup(popupHtml).addTo(markersLayer);
      bounds.extend(L.latLng(la, lo));
    }

    var dtRaw = String(p.DataAtualizacao || p.Data || "").trim();
    var dtInfo = dtRaw ? " — Preço DGEG: <strong>" + escapeHtml(dtRaw) + "</strong>" : "";
    var dist = typeof p.dist === "number" ? " — a " + p.dist.toFixed(1).replace(".", ",") + " km" : "";
    var badge = idx === 0 ? " <span style='background:#dcfce7;color:#15803d;padding:2px 6px;border-radius:4px;font-size:0.7rem;font-weight:700;'>MAIS BARATO</span>" : "";

    var div = document.createElement("div");
    div.className = "station-item" + (idx === 0 ? " best-choice" : "");
    div.innerHTML = "<div><strong>" + escapeHtml(p.Nome || "Posto") + "</strong> (" + escapeHtml(p.Marca || "") + ")" + badge +
      "<br><small style='color:var(--muted);'>" + escapeHtml(p.Morada || "") + " - " + escapeHtml(p.Localidade || p.Municipio || "") + dist + dtInfo + "</small>" +
      nav + "</div><div style='font-weight:800;color:" + color + ";font-size:1.2rem;'>" + escapeHtml(p.Preco || "") + "/L</div>";
    list.appendChild(div);
  });

  if (map && bounds && bounds.isValid()) {
    setTimeout(function() {
      map.invalidateSize();
      map.fitBounds(bounds, { maxZoom: 14 });
    }, 100);
  }
}

function openNav(app, lat, lon) {
  var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  var url = app === "waze"
    ? "https://www.waze.com/ul?ll=" + lat + "," + lon + "&navigate=yes"
    : "https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lon + "&travelmode=driving";
  if (isMobile) {
    window.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function focusPin(lat, lon) {
  if (map) {
    map.setView(L.latLng(lat, lon), 16);
    window.scrollTo({ top: 180, behavior: "smooth" });
  }
}

function populateBrands() {
  var selB = document.getElementById("brandFilter");
  var prev = selB.value;
  var brands = {};
  allStations.forEach(function(p) { if (p.Marca) brands[p.Marca] = true; });
  selB.innerHTML = '<option value="">Todas as marcas</option>';
  Object.keys(brands).sort().forEach(function(b) {
    var o = document.createElement("option");
    o.value = b;
    o.textContent = b;
    selB.appendChild(o);
  });
  selB.value = prev;
}

function handlePostos(d) {
  if (!d || !d.ok) {
    document.getElementById("postos-status").textContent = (d && d.error) ? d.error : "Erro DGEG";
    return;
  }
  allStations = Array.isArray(d.postos) ? d.postos : [];
  populateBrands();
  renderStations();
}

function searchLocal() {
  lastLat = null;
  lastLon = null;
  var loc = document.getElementById("localInput").value.trim();
  var r = document.getElementById("radiusSelect").value;
  document.getElementById("postos-status").textContent = "A pesquisar " + loc + "...";
  fetch("/api/postos?tipo=" + encodeURIComponent(curFuel) + "&local=" + encodeURIComponent(loc) + "&raio=" + encodeURIComponent(r))
    .then(function(res) { return res.json(); })
    .then(handlePostos)
    .catch(function() {
      document.getElementById("postos-status").textContent = "Erro de ligação ao pesquisar postos.";
    });
}

function showUserPin(lat, lon) {
  if (!map || typeof L === "undefined") return;
  if (userPin) map.removeLayer(userPin);
  var myIcon = L.divIcon({
    className: "",
    html: '<div style="width:18px;height:18px;background:#2563eb;border:3px solid #ffffff;border-radius:50%;box-shadow:0 0 0 4px rgba(37,99,235,0.35);"></div>',
    iconSize: L.point(18, 18),
    iconAnchor: L.point(9, 9)
  });
  userPin = L.marker(L.latLng(lat, lon), { icon: myIcon, zIndexOffset: 1000 })
    .bindPopup("<strong>A Minha Localização</strong>")
    .addTo(map);
}

function fetchCoords(lat, lon) {
  lastLat = lat;
  lastLon = lon;
  showUserPin(lat, lon);
  var r = document.getElementById("radiusSelect").value;
  document.getElementById("postos-status").textContent = "A pesquisar num raio de " + r + " km...";
  fetch("/api/postos?tipo=" + curFuel + "&lat=" + lat + "&lon=" + lon + "&raio=" + r)
    .then(function(res) { return res.json(); })
    .then(handlePostos);
}

function searchGPS() {
  var st = document.getElementById("postos-status");
  if (!navigator.geolocation) {
    fetchCoords(37.0715, -8.1005);
    return;
  }
  st.textContent = "A obter GPS...";
  navigator.geolocation.getCurrentPosition(
    function(pos) { fetchCoords(pos.coords.latitude, pos.coords.longitude); },
    function() {
      st.textContent = "GPS indisponível — a usar centro de Quarteira";
      fetchCoords(37.0715, -8.1005);
    },
    { timeout: 5000 }
  );
}

function renderRankingCardList(containerId, stations, isCheapest) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  if (!Array.isArray(stations) || !stations.length) {
    container.innerHTML = "<p class='status-msg'>Sem dados disponíveis.</p>";
    return;
  }
  stations.forEach(function(p, idx) {
    var div = document.createElement("div");
    div.className = "station-item " + (isCheapest ? "best-choice" : "expensive-choice");
    var color = isCheapest ? "var(--green)" : "var(--red)";
    var rankClass = isCheapest ? "rank-cheap" : "rank-exp";
    var nav = buildNavButtons(p, false);
    div.innerHTML =
      "<div><span class='rank-num " + rankClass + "'>" + (idx + 1) + "º</span>" +
      "<strong>" + escapeHtml(p.Nome || "Posto") + "</strong> (" + escapeHtml(p.Marca || "") + ")" +
      "<br><small style='color:var(--muted);'>" + escapeHtml(p.Municipio || "") + " — " + escapeHtml(p.Distrito || "") +
      (p.Morada ? " — " + escapeHtml(p.Morada) : "") + "</small>" + nav +
      "</div><div style='font-weight:800;color:" + color + ";font-size:1.15rem;'>" + escapeHtml(p.Preco || "") + "/L</div>";
    container.appendChild(div);
  });
}

function loadRanking(keepDistrict) {
  var st = document.getElementById("ranking-status");
  var scopeSel = document.getElementById("rankingScope");
  var distSel = document.getElementById("rankingDistrict");
  var concSel = document.getElementById("rankingConcelho");

  var scope = scopeSel ? scopeSel.value : "all";
  var distrito = keepDistrict && distSel ? distSel.value : "";
  var concelho = keepDistrict && concSel ? concSel.value : "";

  if (st) st.textContent = "A carregar ranking nacional DGEG...";

  var qs = "/api/ranking?tipo=" + encodeURIComponent(curFuel) +
    "&scope=" + encodeURIComponent(scope) +
    "&distrito=" + encodeURIComponent(distrito) +
    "&concelho=" + encodeURIComponent(concelho);

  fetch(qs)
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (!d || !d.ok) {
        if (st) st.textContent = (d && d.error) ? d.error : "Erro ao carregar ranking.";
        return;
      }
      rankingLoadedForFuel = curFuel;
      if (st) st.textContent = d.totalNational + " postos nacionais analisados";

      renderRankingCardList("top10-cheapest", d.topCheapest, true);
      renderRankingCardList("top10-expensive", d.topExpensive, false);

      if (distSel && Array.isArray(d.distritos)) {
        distSel.innerHTML = "";
        d.distritos.forEach(function(dist) {
          var opt = document.createElement("option");
          opt.value = dist;
          opt.textContent = dist;
          distSel.appendChild(opt);
        });
        if (d.selectedDistrito) distSel.value = d.selectedDistrito;
      }

      if (concSel && Array.isArray(d.concelhos)) {
        var prevConc = concelho;
        concSel.innerHTML = '<option value="">Todos os concelhos</option>';
        d.concelhos.forEach(function(c) {
          var opt = document.createElement("option");
          opt.value = c;
          opt.textContent = c;
          concSel.appendChild(opt);
        });
        if (prevConc && d.concelhos.indexOf(prevConc) !== -1) {
          concSel.value = prevConc;
        }
      }

      var regCount = document.getElementById("region-count");
      if (regCount) regCount.textContent = (d.regionStations ? d.regionStations.length : 0) + " postos listados";
      renderRankingCardList("region-stations-list", d.regionStations || [], true);
    })
    .catch(function() {
      if (st) st.textContent = "Erro de ligação ao carregar o ranking.";
    });
}

function loadHistory() {
  fetch("/api/history?tipo=" + encodeURIComponent(curFuel))
    .then(function(r) { return r.json(); })
    .then(function(rows) {
      if (typeof Chart === "undefined" || !Array.isArray(rows)) return;
      var ctx = document.getElementById("historyChart").getContext("2d");
      if (chartInst) chartInst.destroy();

      var nextEst = parseFloat(document.getElementById("final-price").textContent.replace(",", ".")) || 0;
      var labels = rows.map(function(x) { return String(x.date || "").slice(5); });
      var pumpSeries = rows.map(function(x) { return x.pump; });
      var estSeries = rows.map(function(x) { return x.estimated; });

      if (nextEst > 0) {
        labels.push("Próx. Seg (Prev.)");
        pumpSeries.push(null);
        estSeries.push(+nextEst.toFixed(3));
      }

      var lastPump = pumpSeries.length > 1 ? pumpSeries[pumpSeries.length - 2] : nextEst;
      var trendColor = nextEst > lastPump + 0.002 ? "#b91c1c" : (nextEst < lastPump - 0.002 ? "#15803d" : "#0f4c81");

      chartInst = new Chart(ctx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            { label: "Histórico DGEG 6 Meses (€/L)", data: pumpSeries, borderColor: "#0f4c81", backgroundColor: "rgba(15,76,129,0.10)", tension: 0.3, fill: true, pointRadius: 3 },
            { label: "Estimativa & Tendência Próx. Semana (€/L)", data: estSeries, borderColor: trendColor, backgroundColor: trendColor, borderDash: [6, 4], tension: 0.3, pointRadius: estSeries.map(function(_, idx) { return idx === estSeries.length - 1 ? 7 : 2; }), pointHoverRadius: 8 }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { mode: "index", intersect: false } } }
      });
    });
}

function saveHistory() {
  var estVal = parseFloat(document.getElementById("final-price").textContent.replace(",", ".")) || 0;
  var pumpVal = +document.getElementById("currentPumpPrice").value || estVal;
  fetch("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipo: curFuel, estimated: +estVal.toFixed(3), pump: +pumpVal.toFixed(3) })
  }).then(loadHistory);
}


function syncDgegAveragePrice() {
  fetch("/api/dgeg-average?tipo=" + encodeURIComponent(curFuel) + "&t=" + Date.now())
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (!d || !d.ok || typeof d.average !== "number" || d.average <= 0) return;
      var curInp = document.getElementById("currentPumpPrice");
      if (curInp && Number(curInp.value) !== d.average) {
        curInp.value = d.average.toFixed(3);
        if (typeof calc === "function") calc();
      }
      var lbl = document.getElementById("dgeg-avg-live-info");
      if (lbl) {
        lbl.textContent = "Média real DGEG Continente (" + d.count + " postos): " + d.average.toFixed(3).replace(".", ",") + " €/L";
      }
    })
    .catch(function() {});
}

function sel(t) {
  curFuel = t;
  ["gasoleo", "gasoleo_esp", "gasolina95", "gasolina98", "gpl"].forEach(function(id) {
    var b = document.getElementById("btn-" + id);
    if (!b) return;
    b.classList.remove("active");
    b.setAttribute("aria-selected", "false");
  });
  var activeBtn = document.getElementById("btn-" + t);
  if (activeBtn) {
    activeBtn.classList.add("active");
    activeBtn.setAttribute("aria-selected", "true");
  }

  var n = "Gasóleo Simples", d = 0.835, b = 0.115, m = 0.195, i = 0.365, c = 0.242, k = 38, p = 2.078;
  if (t === "gasoleo_esp") { n = "Gasóleo Especial"; m = 0.285; p = 2.189; }
  else if (t === "gasolina95") { n = "Gasolina 95"; d = 0.745; b = 0.085; m = 0.190; i = 0.465; c = 0.220; k = 14; p = 1.909; }
  else if (t === "gasolina98") { n = "Gasolina 98"; d = 0.750; b = 0.085; m = 0.265; i = 0.465; c = 0.220; k = 22; p = 2.069; }
  else if (t === "gpl") { n = "GPL Auto"; d = 0.540; b = 0.000; m = 0.220; i = 0.155; c = 0.095; k = -22; p = 0.969; }

  document.getElementById("fuel-label").textContent = n + " — Preço Estimado";
  document.getElementById("density").value = d;
  document.getElementById("biofuel").value = b;
  document.getElementById("margin").value = m;
  document.getElementById("isp").value = i;
  document.getElementById("carbon").value = c;
  document.getElementById("crackSpread").value = k;
  document.getElementById("currentPumpPrice").value = p;
  est();

  if (lastLat !== null) fetchCoords(lastLat, lastLon); else searchLocal();
  loadHistory();
  if (lastRouteData) planRoute();
  syncDgegAveragePrice();

  var rankView = document.getElementById("view-ranking");
  if (rankView && rankView.classList.contains("active")) {
    loadRanking(true);
  }
}

function sync() {
  var clk = document.getElementById("brent-header-clock");
  var st = document.getElementById("brent-status");
  if (clk) clk.textContent = "A atualizar...";

  fetch("/api/market?force=1&t=" + Date.now())
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (!d || !d.ok) return;
      document.getElementById("brentUsd").value = Number(d.brent).toFixed(2);
      document.getElementById("eurUsd").value = Number(d.eurUsd).toFixed(4);
      var hora = new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      document.getElementById("brent-pill").textContent = "Brent (" + (d.fonte || "Ao vivo") + "): " + Number(d.brent).toFixed(2) + " $";
      if (clk) {
        clk.textContent = "Atualizado às " + hora + " (" + d.fxDate + ")";
        clk.style.color = "var(--green)";
      }
      if (st) st.textContent = "Brent: " + Number(d.brent).toFixed(2) + " $ — Câmbio (" + d.fxDate + "): " + Number(d.eurUsd).toFixed(4) + " (" + hora + ")";
      est();
      if (typeof renderBrentLiveTicker === "function") renderBrentLiveTicker();
    })
    .catch(function() {
      if (clk) {
        clk.textContent = "Falha ao atualizar mercado";
        clk.style.color = "var(--red)";
      }
    });
}

function normText(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function setupInstantAutocomplete() {
  var oldBox = document.getElementById("pt-ac-dropdown");
  if (oldBox) oldBox.remove();

  var box = document.createElement("div");
  box.id = "pt-ac-dropdown";
  box.style.cssText = "position:absolute;z-index:9999;background:#ffffff;color:#0f172a;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,0.18);max-height:240px;overflow-y:auto;display:none;font-size:0.9rem;";
  document.body.appendChild(box);

  var remoteTimer = null;
  function hideBox() { box.style.display = "none"; }

  function renderDropdown(inp, items) {
    if (!items.length || document.activeElement !== inp) { hideBox(); return; }
    var rect = inp.getBoundingClientRect();
    box.style.left = (rect.left + window.scrollX) + "px";
    box.style.top = (rect.bottom + window.scrollY + 3) + "px";
    box.style.width = rect.width + "px";
    box.innerHTML = "";

    items.slice(0, 12).forEach(function(m) {
      var row = document.createElement("div");
      row.textContent = m;
      row.style.cssText = "padding:8px 12px;cursor:pointer;border-bottom:1px solid #f1f5f9;";
      row.onmouseenter = function() { row.style.background = "#e0f2fe"; };
      row.onmouseleave = function() { row.style.background = "#ffffff"; };
      row.onmousedown = function(e) {
        e.preventDefault();
        inp.value = m;
        hideBox();
        if (inp.id === "localInput" && typeof searchLocal === "function") searchLocal();
      };
      box.appendChild(row);
    });
    box.style.display = "block";
  }

  function showMatches(inp) {
    var raw = inp.value.trim();
    var q = normText(raw);
    if (!q) { hideBox(); return; }

    var starts = [], contains = [];
    ALL_PT_LOCATIONS.forEach(function(loc) {
      var n = normText(loc);
      if (n.indexOf(q) === 0) starts.push(loc);
      else if (n.indexOf(q) !== -1) contains.push(loc);
    });
    var localMatches = starts.concat(contains);
    renderDropdown(inp, localMatches);

    if (raw.length >= 2) {
      clearTimeout(remoteTimer);
      remoteTimer = setTimeout(function() {
        fetch("/api/suggest?q=" + encodeURIComponent(raw))
          .then(function(r) { return r.json(); })
          .then(function(remoteList) {
            if (!Array.isArray(remoteList) || !remoteList.length) return;
            var merged = localMatches.slice();
            var seen = {};
            merged.forEach(function(x) { seen[normText(x)] = true; });
            remoteList.forEach(function(item) {
              var k = normText(item);
              if (!seen[k]) { seen[k] = true; merged.push(item); }
            });
            renderDropdown(inp, merged);
          }).catch(function() {});
      }, 250);
    }
  }

  ["localInput", "routeOrigin", "routeDest"].forEach(function(id) {
    var inp = document.getElementById(id);
    if (!inp) return;
    inp.removeAttribute("list");
    inp.setAttribute("autocomplete", "off");
    inp.addEventListener("input", function() { showMatches(inp); });
    inp.addEventListener("focus", function() { showMatches(inp); });
    inp.addEventListener("blur", function() { setTimeout(hideBox, 150); });
  });
}

document.querySelectorAll(".nav-btn").forEach(function(btn) {
  btn.onclick = function() {
    document.querySelectorAll(".nav-btn").forEach(function(b) {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".view-section").forEach(function(s) { s.classList.remove("active"); });
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    var target = btn.getAttribute("data-view");
    document.getElementById(target).classList.add("active");
    if (target === "view-mapa") {
      initMap();
      if (map) setTimeout(function() { map.invalidateSize(); }, 100);
    }
    if (target === "view-simulador") {
      loadHistory();
      renderBrentLiveTicker();
      renderMarketsWidget(false);
      renderCommoditiesWidget(false);
      renderFuelNews(false);
    }
    if (target === "view-viagens") {
      initRouteMap();
      if (routeMap) setTimeout(function() { routeMap.invalidateSize(); }, 100);
    }
    if (target === "view-ranking" && rankingLoadedForFuel !== curFuel) loadRanking(true);
  };
});

["gasoleo", "gasoleo_esp", "gasolina95", "gasolina98", "gpl"].forEach(function(id) {
  var el = document.getElementById("btn-" + id);
  if (el) el.onclick = function() { sel(id); };
});
document.getElementById("btn-sync").onclick = sync;
document.getElementById("btn-sync-top").onclick = sync;
var btnTheme = document.getElementById("btn-theme");
if (btnTheme) btnTheme.onclick = toggleTheme;

document.getElementById("btn-search").onclick = searchLocal;
document.getElementById("btn-gps").onclick = searchGPS;
var btnHist = document.getElementById("btn-save-hist");
if (btnHist) btnHist.onclick = saveHistory;
document.getElementById("localInput").onchange = searchLocal;
document.getElementById("brandFilter").onchange = renderStations;

var fLow = document.getElementById("filterLowCost");
if (fLow) fLow.onchange = renderStations;
var fHwy = document.getElementById("filterNoHighway");
if (fHwy) fHwy.onchange = renderStations;

document.getElementById("radiusSelect").onchange = function() {
  if (lastLat !== null) fetchCoords(lastLat, lastLon); else searchLocal();
};
["brentUsd", "crackSpread", "density"].forEach(function(id) {
  document.getElementById(id).oninput = est;
});
["refinedUsdTon", "eurUsd", "biofuel", "margin", "isp", "carbon", "currentPumpPrice", "tankSize", "cardDiscount"].forEach(function(id) {
  var el = document.getElementById(id);
  if (el) el.oninput = calc;
});
["tripDist", "tripCons", "tripPrice", "tripRefillLiters"].forEach(function(id) {
  var el = document.getElementById(id);
  if (el) el.oninput = function() {
    calcTrip();
    if (lastRouteData) renderRouteStations(lastRouteData);
  };
});
document.getElementById("vat").onchange = calc;

var btnRoute = document.getElementById("btn-calc-route");
if (btnRoute) btnRoute.onclick = planRoute;

var rScope = document.getElementById("rankingScope");
if (rScope) rScope.onchange = function() { loadRanking(true); };
var rDist = document.getElementById("rankingDistrict");
if (rDist) rDist.onchange = function() {
  var cSel = document.getElementById("rankingConcelho");
  if (cSel) cSel.value = "";
  loadRanking(true);
};
var rConc = document.getElementById("rankingConcelho");
if (rConc) rConc.onchange = function() { loadRanking(true); };

var curTvSymbol = "BZ=F";
var curTvRange = "1d";
var liveTickerChart = null;
var curMktTab = "eu";
var cachedIndices = null;
var curMktSym = "PSI20.LS";
var curMktName = "PSI — Portugal";
var curMktRange = "1d";
var mktChartInst = null;
var curCommSym = "GC=F";
var curCommName = "Ouro (USD/oz)";
var curCommRange = "1d";
var commChartInst = null;
var cachedComms = null;

function switchTvSymbol(sym) {
  curTvSymbol = (sym === "FX:EURUSD" || sym === "EURUSD=X") ? "EURUSD=X" : "BZ=F";
  var b1 = document.getElementById("btn-tv-brent");
  var b2 = document.getElementById("btn-tv-eurusd");
  if (b1 && b2) {
    b1.className = curTvSymbol === "BZ=F" ? "btn-primary" : "";
    b2.className = curTvSymbol === "EURUSD=X" ? "btn-primary" : "";
  }
  renderBrentLiveTicker();
}

function setTvRange(rng) {
  curTvRange = rng;
  renderBrentLiveTicker();
}

function buildInteractiveChartConfig(d, range, labelName, unitSuffix, decPlaces, isDark) {
  var firstP = d.points[0].v;
  var lastP = d.price || d.points[d.points.length - 1].v;
  var baseP = (range === "1d" && d.prevClose) ? d.prevClose : firstP;
  var diff = lastP - baseP;
  var pct = baseP ? (diff / baseP) * 100 : 0;
  var up = diff >= 0;
  var col = up ? "#16a34a" : "#dc2626";
  var bgBadge = up ? (isDark ? "rgba(22,163,74,0.22)" : "#dcfce7") : (isDark ? "rgba(220,38,38,0.22)" : "#fee2e2");

  var vals = d.points.map(function(pt) { return pt.v; });
  var minV = Math.min.apply(null, vals);
  var maxV = Math.max.apply(null, vals);

  var labels = d.points.map(function(pt) {
    var dt = new Date(pt.t);
    return range === "1d"
      ? dt.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
      : dt.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: (range === "5y" || range === "max") ? "2-digit" : undefined });
  });

  var crosshairPlugin = {
    id: "customCrosshair",
    afterDatasetsDraw: function(chart) {
      if (chart.tooltip && chart.tooltip._active && chart.tooltip._active.length) {
        var activePoint = chart.tooltip._active[0];
        var ctx = chart.ctx;
        var x = activePoint.element.x;
        var y = activePoint.element.y;
        var topY = chart.scales.y.top;
        var bottomY = chart.scales.y.bottom;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, topY);
        ctx.lineTo(x, bottomY);
        ctx.lineWidth = 1;
        ctx.strokeStyle = isDark ? "rgba(148,163,184,0.45)" : "rgba(100,116,139,0.45)";
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  var config = {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: labelName,
        data: vals,
        borderColor: col,
        backgroundColor: up ? "rgba(22,163,74,0.12)" : "rgba(220,38,38,0.12)",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHitRadius: 22,
        fill: true,
        tension: 0.2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          mode: "index",
          intersect: false,
          backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.96)",
          titleColor: isDark ? "#94a3b8" : "#64748b",
          bodyColor: isDark ? "#f8fafc" : "#0f172a",
          borderColor: col,
          borderWidth: 1.5,
          padding: 10,
          displayColors: false,
          titleFont: { size: 11, weight: "600" },
          bodyFont: { size: 14, weight: "800" },
          callbacks: {
            title: function(items) {
              if (!items.length) return "";
              var idx = items[0].dataIndex;
              var rawTs = d.points[idx] ? d.points[idx].t : null;
              if (!rawTs) return items[0].label;
              var dt = new Date(rawTs);
              return range === "1d"
                ? dt.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }) + " às " + dt.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
                : dt.toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
            },
            label: function(ctx) {
              var val = ctx.parsed.y;
              var vDiff = val - baseP;
              var vPct = baseP ? (vDiff / baseP) * 100 : 0;
              var sign = vDiff >= 0 ? "+" : "";
              return Number(val).toLocaleString("pt-PT", { minimumFractionDigits: decPlaces, maximumFractionDigits: decPlaces }) +
                unitSuffix + "  (" + sign + vPct.toFixed(2).replace(".", ",") + "%)";
            }
          }
        }
      },
      scales: {
        x: { ticks: { maxTicksLimit: 7, color: isDark ? "#94a3b8" : "#64748b" }, grid: { display: false } },
        y: { ticks: { color: isDark ? "#94a3b8" : "#64748b" }, grid: { color: isDark ? "rgba(148,163,184,0.12)" : "rgba(100,116,139,0.12)" } }
      }
    },
    plugins: [crosshairPlugin]
  };

  return {
    config: config,
    lastP: lastP,
    diff: diff,
    pct: pct,
    up: up,
    col: col,
    bgBadge: bgBadge,
    minV: minV,
    maxV: maxV
  };
}

function renderRangeButtonsHtml(currentRange, fnName, isDark) {
  var ranges = [
    { id: "1d", label: "1D" },
    { id: "5d", label: "1S" },
    { id: "1mo", label: "1M" },
    { id: "3mo", label: "3M" },
    { id: "1y", label: "1A" },
    { id: "5y", label: "5A" }
  ];
  return ranges.map(function(r) {
    var active = r.id === currentRange;
    var st = active
      ? "background:#0f4c81;color:#fff;border:none;border-radius:6px;padding:4px 9px;font-size:0.75rem;font-weight:700;cursor:pointer;"
      : "background:transparent;color:" + (isDark ? "#cbd5e1" : "#334155") + ";border:1px solid " + (isDark ? "#475569" : "#cbd5e1") + ";border-radius:6px;padding:4px 9px;font-size:0.75rem;cursor:pointer;";
    return '<button type="button" style="' + st + '" onclick="' + fnName + '(\'' + r.id + '\')">' + r.label + '</button>';
  }).join("");
}

function renderBrentLiveTicker() {
  var box = document.getElementById("brent-live-widget");
  if (!box) return;
  box.style.height = "auto";
  var isDark = document.body.classList.contains("dark-mode");
  var btnsHtml = renderRangeButtonsHtml(curTvRange, "setTvRange", isDark);

  box.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">' +
      '<div id="live-ticker-quote" style="font-size:1.15rem;font-weight:800;">A carregar cotação...</div>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;">' + btnsHtml + '</div>' +
    '</div>' +
    '<div style="height:280px;width:100%;"><canvas id="live-ticker-canvas"></canvas></div>' +
    '<div id="live-ticker-minmax" style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--muted);margin-top:6px;"></div>';

  fetch("/api/chart?sym=" + encodeURIComponent(curTvSymbol) + "&range=" + encodeURIComponent(curTvRange))
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var qEl = document.getElementById("live-ticker-quote");
      var mmEl = document.getElementById("live-ticker-minmax");
      var cvs = document.getElementById("live-ticker-canvas");
      if (!qEl || !cvs || !d || !Array.isArray(d.points) || !d.points.length) {
        if (qEl) qEl.textContent = "Sem dados disponíveis para este período.";
        return;
      }
      var unit = curTvSymbol === "EURUSD=X" ? " USD" : " $/barril";
      var dec = curTvSymbol === "EURUSD=X" ? 4 : 2;
      var labelName = curTvSymbol === "EURUSD=X" ? "EUR / USD" : "Petróleo Brent";
      var built = buildInteractiveChartConfig(d, curTvRange, labelName, unit, dec, isDark);

      qEl.innerHTML =
        Number(built.lastP).toLocaleString("pt-PT", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + unit +
        ' <span style="display:inline-block;background:' + built.bgBadge + ';color:' + built.col + ';padding:2px 8px;border-radius:999px;font-size:0.82rem;font-weight:700;margin-left:6px;vertical-align:middle;">' +
        (built.up ? "▲ +" : "▼ ") + built.diff.toLocaleString("pt-PT", { minimumFractionDigits: dec, maximumFractionDigits: dec }) +
        ' (' + (built.up ? "+" : "") + built.pct.toFixed(2).replace(".", ",") + '%)</span>';

      if (curTvSymbol === "BZ=F" && isFinite(built.lastP) && built.lastP > 0) {
        var bInput = document.getElementById("brentUsd");
        var bPill = document.getElementById("brent-pill");
        if (bInput && Number(bInput.value) !== Number(Number(built.lastP).toFixed(2))) {
          bInput.value = Number(built.lastP).toFixed(2);
          if (bPill) bPill.textContent = "Brent (Yahoo): " + Number(built.lastP).toFixed(2) + " $";
          if (typeof est === "function") est();
        }
      }

      if (mmEl) {
        mmEl.innerHTML =
          '<span>Mínimo período: <strong>' + Number(built.minV).toLocaleString("pt-PT", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + unit + '</strong></span>' +
          '<span>Máximo período: <strong>' + Number(built.maxV).toLocaleString("pt-PT", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + unit + '</strong></span>';
      }

      if (liveTickerChart) liveTickerChart.destroy();
      if (typeof Chart !== "undefined") {
        liveTickerChart = new Chart(cvs.getContext("2d"), built.config);
      }
    }).catch(function() {});
}

function setMktTab(tab) {
  curMktTab = tab;
  renderMarketsWidget(false);
}

function onMktDrop(selEl) {
  if (!selEl) return;
  curMktSym = selEl.value;
  var opt = selEl.options[selEl.selectedIndex];
  curMktName = opt ? (opt.getAttribute("data-t") || opt.textContent) : curMktSym;
  drawMktChart();
}

function setMktRange(rng) {
  curMktRange = rng;
  drawMktChart();
}

function drawMktChart() {
  var area = document.getElementById("mkt-chart-area");
  if (!area) return;
  var isDark = document.body.classList.contains("dark-mode");
  var btns = renderRangeButtonsHtml(curMktRange, "setMktRange", isDark);

  area.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">' +
      '<div>' +
        '<strong style="font-size:1rem;display:block;">' + escapeHtml(curMktName) + '</strong>' +
        '<div id="mkt-live-quote" style="font-size:1.15rem;font-weight:800;margin-top:2px;">A carregar cotação...</div>' +
      '</div>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;">' + btns + '</div>' +
    '</div>' +
    '<div style="height:280px;width:100%;"><canvas id="mkt-detail-canvas"></canvas></div>' +
    '<div id="mkt-minmax-bar" style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--muted);margin-top:6px;"></div>';

  fetch("/api/chart?sym=" + encodeURIComponent(curMktSym) + "&range=" + encodeURIComponent(curMktRange))
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var cvs = document.getElementById("mkt-detail-canvas");
      var qEl = document.getElementById("mkt-live-quote");
      var mmEl = document.getElementById("mkt-minmax-bar");
      if (!cvs || !d || !Array.isArray(d.points) || !d.points.length) {
        if (qEl) qEl.textContent = "Sem dados disponíveis para este período.";
        return;
      }
      var built = buildInteractiveChartConfig(d, curMktRange, curMktName, " pts", 2, isDark);

      if (qEl) {
        qEl.innerHTML =
          Number(built.lastP).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' pts' +
          ' <span style="display:inline-block;background:' + built.bgBadge + ';color:' + built.col + ';padding:2px 8px;border-radius:999px;font-size:0.82rem;font-weight:700;margin-left:6px;vertical-align:middle;">' +
          (built.up ? "▲ +" : "▼ ") + built.diff.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
          ' (' + (built.up ? "+" : "") + built.pct.toFixed(2).replace(".", ",") + '%)</span>';
      }

      if (mmEl) {
        mmEl.innerHTML =
          '<span>Mínimo período: <strong>' + Number(built.minV).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' pts</strong></span>' +
          '<span>Máximo período: <strong>' + Number(built.maxV).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' pts</strong></span>';
      }

      if (mktChartInst) mktChartInst.destroy();
      if (typeof Chart !== "undefined") {
        mktChartInst = new Chart(cvs.getContext("2d"), built.config);
      }
    }).catch(function() {});
}

function renderMarketsWidget(forceFetch) {
  var box = document.getElementById("markets-live-widget");
  if (!box) return;
  box.style.height = "auto";
  var dk = document.body.classList.contains("dark-mode");

  function drawList(rows) {
    var fl = (Array.isArray(rows) ? rows : []).filter(function(r) { return r.group === curMktTab; });
    if (fl.length && !fl.some(function(x) { return x.sym === curMktSym; })) {
      curMktSym = fl[0].sym;
      curMktName = fl[0].name;
    }
    var opts = fl.map(function(x) {
      return '<option value="' + escapeHtml(x.sym) + '" data-t="' + escapeHtml(x.name) + '"' + (x.sym === curMktSym ? " selected" : "") + '>' +
        escapeHtml(x.name) + " - " + (x.price ? Number(x.price).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-") +
        " (" + (x.changePct >= 0 ? "+" : "") + Number(x.changePct || 0).toFixed(2).replace(".", ",") + "%)</option>";
    }).join("");

    box.innerHTML =
      '<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">' +
        '<button type="button" class="' + (curMktTab === "eu" ? "btn-primary" : "btn-small") + '" onclick="setMktTab(\'eu\')">Europa (Portugal 1.º)</button>' +
        '<button type="button" class="' + (curMktTab === "world" ? "btn-primary" : "btn-small") + '" onclick="setMktTab(\'world\')">Bolsas Mundiais</button>' +
      '</div>' +
      '<select style="width:100%;padding:8px;border-radius:8px;margin-bottom:10px;background:' + (dk ? "#0f172a" : "#fff") + ';color:' + (dk ? "#f8fafc" : "#0f172a") + ';border:1px solid #475569;font-weight:600;" onchange="onMktDrop(this)">' + opts + '</select>' +
      '<div id="mkt-chart-area"></div>';

    drawMktChart();
  }

  if (cachedIndices && !forceFetch) {
    drawList(cachedIndices);
    return;
  }

  fetch("/api/indices")
    .then(function(r) { return r.json(); })
    .then(function(rows) {
      cachedIndices = rows;
      drawList(rows);
    })
    .catch(function() {
      box.innerHTML = "<p class='status-msg'>Não foi possível carregar os índices bolsistas.</p>";
    });
}

function selectCommodity(sym, name) {
  curCommSym = sym;
  curCommName = name;
  renderCommoditiesWidget(false);
}

function setCommRange(rng) {
  curCommRange = rng;
  drawCommChart();
}

function drawCommChart() {
  var area = document.getElementById("comm-chart-area");
  if (!area) return;
  var isDark = document.body.classList.contains("dark-mode");
  var btns = renderRangeButtonsHtml(curCommRange, "setCommRange", isDark);

  area.innerHTML =
    '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">' +
        '<div>' +
          '<strong style="font-size:1rem;display:block;">' + escapeHtml(curCommName) + '</strong>' +
          '<div id="comm-live-quote" style="font-size:1.15rem;font-weight:800;margin-top:2px;">A carregar cotação...</div>' +
        '</div>' +
        '<div style="display:flex;gap:4px;flex-wrap:wrap;">' + btns + '</div>' +
      '</div>' +
      '<div style="height:260px;width:100%;"><canvas id="comm-detail-canvas"></canvas></div>' +
      '<div id="comm-minmax-bar" style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--muted);margin-top:6px;"></div>' +
    '</div>';

  fetch("/api/chart?sym=" + encodeURIComponent(curCommSym) + "&range=" + encodeURIComponent(curCommRange))
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var cvs = document.getElementById("comm-detail-canvas");
      var qEl = document.getElementById("comm-live-quote");
      var mmEl = document.getElementById("comm-minmax-bar");
      if (!cvs || !d || !Array.isArray(d.points) || !d.points.length) {
        if (qEl) qEl.textContent = "Sem dados disponíveis para este período.";
        return;
      }
      var built = buildInteractiveChartConfig(d, curCommRange, curCommName, "", 2, isDark);

      if (qEl) {
        qEl.innerHTML =
          Number(built.lastP).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
          ' <span style="display:inline-block;background:' + built.bgBadge + ';color:' + built.col + ';padding:2px 8px;border-radius:999px;font-size:0.82rem;font-weight:700;margin-left:6px;vertical-align:middle;">' +
          (built.up ? "▲ +" : "▼ ") + built.diff.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
          ' (' + (built.up ? "+" : "") + built.pct.toFixed(2).replace(".", ",") + '%)</span>';
      }

      if (mmEl) {
        mmEl.innerHTML =
          '<span>Mínimo período: <strong>' + Number(built.minV).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</strong></span>' +
          '<span>Máximo período: <strong>' + Number(built.maxV).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</strong></span>';
      }

      if (commChartInst) commChartInst.destroy();
      if (typeof Chart !== "undefined") {
        commChartInst = new Chart(cvs.getContext("2d"), built.config);
      }
    }).catch(function() {});
}

function renderCommoditiesWidget(forceFetch) {
  var box = document.getElementById("commodities-live-widget");
  if (!box) return;

  function drawCards(rows) {
    if (!Array.isArray(rows) || !rows.length) {
      box.innerHTML = "<p class='status-msg'>Sem dados de commodities disponíveis.</p>";
      return;
    }
    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;">';
    rows.forEach(function(item) {
      var up = (item.changePct || 0) >= 0;
      var col = up ? "var(--green)" : "var(--red)";
      var active = item.sym === curCommSym;
      var borderStyle = active ? "border:2px solid var(--primary);background:var(--primary-light);" : "";
      var priceStr = item.price ? Number(item.price).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "--";
      html += '<div class="kpi-box" role="button" tabindex="0" style="text-align:left;cursor:pointer;transition:transform 0.12s;' + borderStyle + '" onclick="selectCommodity(\'' + escapeHtml(item.sym) + '\',\'' + escapeHtml(item.name) + '\')">' +
        '<div class="kpi-lbl" style="display:flex;justify-content:space-between;"><span>' + escapeHtml(item.name) + '</span><span>📈</span></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:4px;">' +
          '<strong style="font-size:1.05rem;">' + priceStr + '</strong>' +
          '<span style="font-size:0.8rem;font-weight:700;color:' + col + ';">' + (up ? "▲ +" : "▼ ") + Number(item.changePct || 0).toFixed(2).replace(".", ",") + '%</span>' +
        '</div>' +
      '</div>';
    });
    html += '</div><div id="comm-chart-area"></div>';
    box.innerHTML = html;
    drawCommChart();
  }

  if (cachedComms && !forceFetch) {
    drawCards(cachedComms);
    return;
  }

  fetch("/api/commodities")
    .then(function(r) { return r.json(); })
    .then(function(rows) {
      cachedComms = rows;
      drawCards(rows);
    })
    .catch(function() {
      box.innerHTML = "<p class='status-msg'>Não foi possível carregar as commodities.</p>";
    });
}

function refreshMarketsAndComms() {
  cachedIndices = null;
  cachedComms = null;
  renderBrentLiveTicker();
  renderMarketsWidget(true);
  renderCommoditiesWidget(true);
}

window.addEventListener("DOMContentLoaded", function() {
  initDarkMode();
  setupInstantAutocomplete();
  initMap();
  est();
  sync();
  syncDgegAveragePrice();
  searchLocal();
});
// Atualiza automaticamente os índices, commodities e cotações a cada 2 minutos (120 000 ms)
setInterval(function() {
  var simView = document.getElementById("view-simulador");
  if (simView && simView.classList.contains("active")) {
    refreshMarketsAndComms();
  }
}, 120000);

var curNewsTab = "pt";
var cachedNews = {};

function formatRelativeTimePt(isoStr) {
  var dt = new Date(isoStr);
  if (isNaN(dt.getTime())) return "";
  var diffSec = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 1000));
  if (diffSec < 60) return "agora mesmo";
  var diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return "há " + diffMin + (diffMin === 1 ? " minuto" : " minutos");
  var diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return "há " + diffH + (diffH === 1 ? " hora" : " horas");
  var diffD = Math.floor(diffH / 24);
  if (diffD < 7) return "há " + diffD + (diffD === 1 ? " dia" : " dias");
  return dt.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

function setNewsTab(tab) {
  curNewsTab = tab === "intl" ? "intl" : "pt";
  var bPt = document.getElementById("btn-news-pt");
  var bIntl = document.getElementById("btn-news-intl");
  if (bPt && bIntl) {
    bPt.className = curNewsTab === "pt" ? "btn-primary" : "btn-small";
    bIntl.className = curNewsTab === "intl" ? "btn-primary" : "btn-small";
  }
  renderFuelNews(false);
}

function renderFuelNews(forceFetch) {
  var box = document.getElementById("fuel-news-list");
  if (!box) return;

  function drawItems(items) {
    if (!Array.isArray(items) || !items.length) {
      box.innerHTML = "<p class='status-msg'>Sem notícias recentes disponíveis neste momento.</p>";
      return;
    }
    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:10px;">';
    items.forEach(function(it) {
      var rel = formatRelativeTimePt(it.pubDate);
      html +=
        '<a href="' + escapeHtml(it.link) + '" target="_blank" rel="noopener noreferrer" ' +
        'style="display:flex;flex-direction:column;justify-content:space-between;padding:12px;border-radius:10px;border:1px solid var(--border);background:var(--card-bg, transparent);text-decoration:none;color:inherit;transition:border-color 0.15s, transform 0.12s;" ' +
        'onmouseenter="this.style.borderColor=\'var(--primary)\'" onmouseleave="this.style.borderColor=\'var(--border)\'">' +
          '<div style="font-weight:700;font-size:0.93rem;line-height:1.35;margin-bottom:8px;">' + escapeHtml(it.title) + '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;font-size:0.76rem;color:var(--muted);gap:8px;">' +
            '<span style="font-weight:600;color:var(--primary);">' + escapeHtml(it.source || "Notícias") + '</span>' +
            '<span>' + escapeHtml(rel) + ' ↗</span>' +
          '</div>' +
        '</a>';
    });
    html += '</div>';
    box.innerHTML = html;
  }

  if (cachedNews[curNewsTab] && !forceFetch) {
    drawItems(cachedNews[curNewsTab]);
    return;
  }

  box.innerHTML = "<p class='status-msg'>A carregar notícias...</p>";
  var qs = "/api/news?cat=" + encodeURIComponent(curNewsTab) + (forceFetch ? "&force=1&t=" + Date.now() : "");
  fetch(qs)
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (!d || !d.ok) {
        box.innerHTML = "<p class='status-msg'>Não foi possível carregar as notícias.</p>";
        return;
      }
      cachedNews[curNewsTab] = d.items || [];
      drawItems(cachedNews[curNewsTab]);
    })
    .catch(function() {
      box.innerHTML = "<p class='status-msg'>Erro de ligação ao carregar as notícias.</p>";
    });
}

// === AUTO_REFRESH_2MIN ===
(function() {
  var origFetch = window.fetch;
  window.fetch = function(url, opts) {
    if (typeof url === "string" && url.indexOf("/api/") === 0) {
      url += (url.indexOf("?") >= 0 ? "&" : "?") + "_t=" + Date.now();
      opts = Object.assign({ cache: "no-store" }, opts || {});
    }
    return origFetch.call(this, url, opts);
  };

  function refreshAllEvery2Min() {
    var nowStr = new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    document.querySelectorAll("header span, header small, #last-updated, #header-updated").forEach(function(el) {
      if (el.textContent && el.textContent.indexOf("Atualizado") >= 0) {
        el.textContent = "Atualizado Ã s " + nowStr;
      }
    });
    if (typeof cachedIndices !== "undefined") cachedIndices = null;
    if (typeof cachedComms !== "undefined") cachedComms = null;
    if (typeof fetchLiveBrentAndFx === "function") fetchLiveBrentAndFx();
    if (typeof renderBrentLiveTicker === "function") renderBrentLiveTicker();
    if (typeof renderMarketsWidget === "function") renderMarketsWidget(true);
    if (typeof renderCommoditiesWidget === "function") renderCommoditiesWidget(true);
    if (typeof renderNewsWidget === "function") renderNewsWidget(true);
    if (typeof renderDgegWeeklyChart === "function") renderDgegWeeklyChart();
  }

  setInterval(refreshAllEvery2Min, 120000);
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      if (reg && (reg.installing || reg.waiting || reg.active)) {
        reg.update().catch(() => {});
      }
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    } catch (_) {}
  });
}

// --- Auto-localizacao (GPS -> ultima localizacao guardada) ---
(function initAutoLocationAndInstall() {
  const LAST_LOC_KEY = "combustiveis_last_location";

  function findLocationInput() {
    return (
      document.querySelector('input[placeholder*="Concelho"], input[placeholder*="Localidade"], input[id*="concelho"], input[id*="localidade"], input[name*="concelho"], input[name*="localidade"]') ||
      Array.from(document.querySelectorAll('input[type="text"], input:not([type])')).find((el) => {
        const labelText = (el.closest("div, label")?.innerText || "").toLowerCase();
        return labelText.includes("concelho") || labelText.includes("localidade");
      }) ||
      null
    );
  }

  function findSearchButton(inputEl) {
    const scope = inputEl ? (inputEl.closest("form, div.row, div.controls, div") || document) : document;
    return (
      Array.from(scope.querySelectorAll("button")).find((b) => /pesquisar/i.test(b.textContent || "")) ||
      Array.from(document.querySelectorAll("button")).find((b) => /pesquisar/i.test(b.textContent || "")) ||
      null
    );
  }

  function saveLastLocation(val) {
    const clean = String(val || "").trim();
    if (!clean) return;
    try {
      localStorage.setItem(LAST_LOC_KEY, JSON.stringify({ name: clean, savedAt: Date.now() }));
    } catch (_) {}
  }

  function getLastLocation() {
    try {
      const raw = localStorage.getItem(LAST_LOC_KEY);
      if (!raw) return "";
      const parsed = JSON.parse(raw);
      return typeof parsed === "string" ? parsed : (parsed?.name || "");
    } catch (_) {
      return "";
    }
  }

  function applyLocation(locName, shouldSearch = true) {
    const clean = String(locName || "").trim();
    const inputEl = findLocationInput();
    if (!clean || !inputEl) return;
    inputEl.value = clean;
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));
    saveLastLocation(clean);

    if (shouldSearch) {
      const btn = findSearchButton(inputEl);
      if (btn) setTimeout(() => btn.click(), 150);
    }
  }

  async function reverseGeocode(lat, lon) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=10&addressdetails=1`;
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!res.ok) return "";
      const data = await res.json();
      const addr = data?.address || {};
      return addr.city || addr.town || addr.village || addr.municipality || addr.county || "";
    } catch (_) {
      return "";
    }
  }

  function wireLocationPersistence() {
    const inputEl = findLocationInput();
    if (inputEl && !inputEl.dataset.locPersistBound) {
      inputEl.dataset.locPersistBound = "1";
      if (inputEl.value && inputEl.value.trim()) {
        saveLastLocation(inputEl.value.trim());
      }
      inputEl.addEventListener("change", () => saveLastLocation(inputEl.value));
    }
    const btn = findSearchButton(inputEl);
    if (btn && !btn.dataset.locSearchBound) {
      btn.dataset.locSearchBound = "1";
      btn.addEventListener("click", () => {
        const cur = findLocationInput();
        if (cur?.value?.trim()) saveLastLocation(cur.value.trim());
      });
    }
  }

  function runAutoLocation() {
    wireLocationPersistence();
    const saved = getLastLocation();
    const inputEl = findLocationInput();
    const initialValue = (inputEl?.value || "").trim() || saved;

    if (!navigator.geolocation) {
      if (saved) applyLocation(saved, false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords || {};
        if (typeof latitude === "number" && typeof longitude === "number") {
          const place = await reverseGeocode(latitude, longitude);
          if (place) {
            applyLocation(place, true);
            return;
          }
        }
        if (saved) applyLocation(saved, false);
      },
      () => {
        // Sem localizacao ligada ou permissao negada -> usa ultima localizacao guardada
        if (saved && (!inputEl || inputEl.value.trim() !== saved)) {
          applyLocation(saved, false);
        } else if (initialValue) {
          saveLastLocation(initialValue);
        }
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
    );
  }

  // --- Botao "Baixar App" (PWA) no lugar de "Atualizar Brent" ---
  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    ensureInstallButton();
  });

  function findAtualizarBrentButton() {
    return Array.from(document.querySelectorAll("button, a")).find((el) =>
      /atualizar\s*brent/i.test((el.textContent || "").trim())
    ) || null;
  }

  function ensureInstallButton() {
    const existing = document.getElementById("btnBaixarAppPwa");
    const brentBtn = findAtualizarBrentButton();

    const btn = existing || document.createElement("button");
    btn.id = "btnBaixarAppPwa";
    btn.type = "button";
    btn.textContent = "Baixar App";

    if (brentBtn && brentBtn.className) {
      btn.className = brentBtn.className;
    } else {
      btn.style.cssText = [
        "padding:8px 14px",
        "border-radius:8px",
        "border:1px solid rgba(255,255,255,0.22)",
        "background:#0ea5e9",
        "color:#ffffff",
        "font-weight:600",
        "font-size:13px",
        "line-height:1.2",
        "cursor:pointer",
        "display:inline-flex",
        "align-items:center",
        "justify-content:center",
        "box-shadow:0 2px 8px rgba(0,0,0,0.25)"
      ].join(";");
    }

    if (!btn.dataset.pwaClickBound) {
      btn.dataset.pwaClickBound = "1";
      btn.addEventListener("click", async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          await deferredPrompt.userChoice.catch(() => {});
          deferredPrompt = null;
          return;
        }
        const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
        if (isIos) {
          alert("No iPhone/iPad: toca em Partilhar e depois em 'Adicionar ao Ecra Principal'.");
        } else {
          alert("Para instalar a app, abre o menu do navegador e escolhe 'Instalar aplicacao' ou 'Adicionar ao ecra inicial'.");
        }
      });
    }

    if (brentBtn) {
      brentBtn.replaceWith(btn);
    } else if (!existing) {
      const headerTarget =
        document.querySelector("header") ||
        document.querySelector(".topbar, .navbar, .header") ||
        document.body;
      headerTarget.appendChild(btn);
    }
  });

    document.body.appendChild(btn);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      ensureInstallButton();
      setTimeout(runAutoLocation, 400);
    });
  } else {
    ensureInstallButton();
    setTimeout(runAutoLocation, 400);
  }
})();