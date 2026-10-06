/* BENJI’S CAR DASHBOARD — AUDI RS4 B7
   Plain JS, no modules, no fetch. Market data arrives as window.RS4_DATA
   (js/data.js, generated daily by build_data.py; schema unchanged).
   Everything market-related is computed here from that object: no market
   figure is written into the HTML. */

(function () {
  "use strict";

  var DATA = window.RS4_DATA || null;
  var M = DATA && DATA.market ? DATA.market : null;
  var L = M && M.listings ? M.listings : [];
  var GONE = M && M.gone ? M.gone : [];
  var TREND = M && M.trend ? M.trend : [];
  var N = L.length;
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var RM = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var MINUS = "−";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* ------------------------------------------------------------ helpers */

  function $(id) { return document.getElementById(id); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    if (s === null || s === undefined) { return ""; }
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function isNum(n) { return typeof n === "number" && isFinite(n); }
  function fmtInt(n) { return isNum(n) ? n.toLocaleString("en-GB") : "—"; }
  function fmtGBP(n) { return isNum(n) ? "£" + Math.round(n).toLocaleString("en-GB") : "—"; }
  function fmtSigned(n, money) {
    if (!isNum(n)) { return "—"; }
    var a = Math.abs(Math.round(n));
    var body = money ? "£" + a.toLocaleString("en-GB") : a.toLocaleString("en-GB");
    if (n > 0) { return "+" + body; }
    if (n < 0) { return MINUS + body; }
    return body;
  }
  function score(n) { return isNum(n) ? (n > 0 ? "+" + n : n < 0 ? MINUS + Math.abs(n) : "0") : "0"; }
  function isoParts(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(iso || ""));
    if (!m) { return null; }
    return { y: +m[1], mo: +m[2], d: +m[3], hh: m[4] || null, mm: m[5] || null };
  }
  function fmtDate(iso, noYear) {
    var p = isoParts(iso);
    if (!p) { return iso ? String(iso) : "—"; }
    return p.d + " " + MON[p.mo - 1] + (noYear ? "" : " " + p.y);
  }
  /* "18–19 Aug" within a month, "12 Jul–19 Aug" across months */
  function fmtRange(a, b) {
    var pa = isoParts(a), pb = isoParts(b);
    if (!pa || !pb || a === b) { return fmtDate(a, true); }
    return pa.mo === pb.mo && pa.y === pb.y ? pa.d + "–" + pb.d + " " + MON[pb.mo - 1] : fmtDate(a, true) + "–" + fmtDate(b, true);
  }
  function dayNum(iso) {
    var p = isoParts(iso);
    return p ? Date.UTC(p.y, p.mo - 1, p.d) / 86400000 : null;
  }
  function town(l) { return String(l.location || "").replace(/\s*\(.*?\)\s*$/, ""); }
  function dist(l) {
    var m = /\(([\d,]+)\s*miles?\)/i.exec(String(l.location || ""));
    return m ? m[1] + " mi away" : "";
  }
  function bodyOf(l) {
    var s = String(l.subtitle || "").toLowerCase();
    if (/avant|estate|5dr/.test(s)) { return "Avant"; }
    if (/cabrio|convertible|2dr/.test(s)) { return "Cabriolet"; }
    if (/4dr|saloon/.test(s)) { return "saloon"; }
    return "";
  }
  function paintName(l) { return l.paint && l.paint.name ? l.paint.name : ""; }
  function uniq(a) { var o = []; a.forEach(function (x) { if (o.indexOf(x) === -1) { o.push(x); } }); return o; }
  function scrollToEl(el) {
    if (!el) { return; }
    el.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" });
  }
  function svgEl(tag, attrs, text) {
    var e = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) { e.textContent = text; }
    return e;
  }
  function median(arr) {
    var a = arr.filter(isNum).slice().sort(function (x, y) { return x - y; });
    if (!a.length) { return null; }
    var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  /* ------------------------------------------------------------ freshness */

  var GEN = DATA ? DATA.generated_at : null;
  var genDate = GEN ? new Date(GEN) : null;
  var ageMs = genDate && !isNaN(genDate.getTime()) ? Date.now() - genDate.getTime() : null;
  var FROZEN = ageMs !== null && ageMs > 24 * 3600 * 1000;
  var gp = isoParts(GEN);
  var GEN_DAY = gp ? fmtDate(GEN) : "unknown date";
  var GEN_TIME = gp && gp.hh ? gp.hh + ":" + gp.mm : "";
  var GEN_SHORT = gp ? fmtDate(GEN, true) : "";

  function ageText() {
    if (ageMs === null) { return "age unknown"; }
    var h = ageMs / 3600000;
    if (h < 1) { return "updated " + Math.max(1, Math.round(h * 60)) + " min ago"; }
    if (h < 24) { return "updated " + Math.round(h) + " h ago"; }
    var d = Math.floor(h / 24);
    return "frozen at build · " + d + (d === 1 ? " day" : " days") + " old";
  }

  function ageShort() {
    if (ageMs === null) { return "age unknown"; }
    var h = ageMs / 3600000;
    if (h < 1) { return Math.max(1, Math.round(h * 60)) + " min old"; }
    if (h < 24) { return Math.round(h) + " h old"; }
    return "frozen";
  }

  if (FROZEN) { document.documentElement.classList.add("is-frozen"); }

  $$("[data-asof]").forEach(function (el) {
    var v = el.getAttribute("data-asof");
    if (!DATA) { el.textContent = "market data not loaded"; return; }
    var when = GEN_DAY + (GEN_TIME ? ", " + GEN_TIME : "");
    var age = '<span class="age">' + esc(ageText()) + "</span>";
    if (v === "plain") { el.innerHTML = esc(when) + " · " + age; }
    else if (v === "day") { el.innerHTML = esc(GEN_DAY) + ' <span class="age">' + esc(ageShort()) + "</span>"; }
    else if (v === "mini") { el.innerHTML = esc(GEN_DAY) + ' · <span class="age">' + esc(ageShort()) + "</span>"; }
    else if (v === "rail") { el.innerHTML = "Market " + esc(when) + "<br>" + age; }
    else if (v === "long") { el.innerHTML = "Market as of " + esc(when) + " · " + age; }
    else { el.innerHTML = "as of " + esc(GEN_DAY) + " · " + age; }
  });

  /* ------------------------------------------------------------ reading each advert against the stations */

  var SUSP_RE = /coilover|lowered|air ?ride|air suspension|aftermarket suspension|modified suspension|stance/i;
  var ENG_RE = /remap|supercharg/i;
  var CAT_RE = /^cat [a-z]$|salvage/i;
  var EXH_RE = /milltek|capristo/gi;
  var BRAKE_RE = /brake|ceramic|brembo/i;
  var SIG = ["Sprint Blue", "Misano Red"];

  function plural(word) { return /s$/.test(word) ? word : word + "s"; }

  function assess(l) {
    var hits = (l.keyword_hits || []).map(function (h) { return String(h).toLowerCase(); });
    var flags = (l.keyword_flags || []).map(function (f) { return String(f).toLowerCase(); });
    var head = String(l.attention_grabber || "");
    var a = {};

    var susp = uniq(flags.filter(function (f) { return SUSP_RE.test(f); }).map(function (f) { return f === "coilover" ? "coilovers" : f; }));
    a.drc = susp.length ? { s: "flag", t: susp.join(", "), say: susp.join(", ") + " named: DRC likely gone" }
                        : { s: "unk", t: "—", say: "not mentioned: check stance and weeps" };

    var mi = l.mileage;
    if (!isNum(mi)) { a.carbon = { s: "unk", t: "mileage unknown", say: "mileage unknown" }; }
    else if (mi < 60000) { a.carbon = { s: "ok", t: "before window", say: "before the 60,000–100,000 mi window" }; }
    else if (mi <= 100000) { a.carbon = { s: "warn", t: "in window", say: "inside the 60,000–100,000 mi window" }; }
    else { a.carbon = { s: "warn", t: "past window", say: "past 100,000 mi: ask for the clean invoice" }; }
    if (/carbon clean/i.test(head)) { a.carbon.t += " · clean claimed"; a.carbon.say += "; headline claims a carbon clean"; }

    var seats = [];
    hits.forEach(function (h) {
      if (/wingback/.test(h)) { seats.push("wingbacks"); }
      else if (/bucket/.test(h)) { seats.push("buckets"); }
      else if (/recaro/.test(h)) { seats.push("Recaro"); }
      else if (/sports seat/.test(h)) { seats.push("sports seats"); }
    });
    seats = uniq(seats);
    a.seats = seats.length ? { s: "ok", t: seats.slice(0, 2).join(" · "), say: seats.join(", ") + " named: check bolsters" }
                           : { s: "unk", t: "—", say: "not mentioned" };

    var wheel = hits.some(function (h) { return /flat/.test(h); });
    a.wheel = wheel ? { s: "ok", t: "named", say: "named in the advert" } : { s: "unk", t: "—", say: "not mentioned" };

    var exh = uniq((head.match(EXH_RE) || []).map(function (x) { return x.charAt(0).toUpperCase() + x.slice(1).toLowerCase(); }));
    a.exhaust = exh.length ? { s: "warn", t: exh.join(" · "), say: exh.join(", ") + " in the headline: aftermarket, not original" }
                           : { s: "unk", t: "—", say: "nothing in the headline" };

    var eng = uniq(flags.filter(function (f) { return ENG_RE.test(f); }));
    a.engine = eng.length ? { s: "flag", t: eng.join(", "), say: eng.join(", ") + " named: ask for the supporting history" }
                          : { s: "unk", t: "—", say: "no remap named" };

    var cat = uniq(flags.filter(function (f) { return CAT_RE.test(f); }).map(function (f) { return f.replace(/^cat /, "Cat ").replace(/^salvage$/, "salvage"); }));
    cat = cat.map(function (c) { return c.replace(/Cat ([a-z])/, function (m0, x) { return "Cat " + x.toUpperCase(); }); });
    a.cat = cat.length ? { s: "flag", t: cat.join(" · "), say: cat.join(", ") + " named: insurance category" }
                       : { s: "unk", t: "—", say: "no category named" };

    var pn = paintName(l);
    a.paint = !pn ? { s: "unk", t: "not stated", say: "paint not detected" }
      : SIG.indexOf(pn) !== -1 ? { s: "ok", t: pn, say: pn + ": signature colour", hex: l.paint.hex }
      : { s: "warn", t: pn, say: pn, hex: l.paint.hex };

    a.flagged = a.drc.s === "flag" || a.engine.s === "flag" || a.cat.s === "flag";
    return a;
  }

  var A = L.map(assess);

  var FILTERS = {
    drc: { label: "suspension changed", fl: true, test: function (a) { return a.drc.s === "flag"; } },
    carbon: { label: "past 70,000 mi", fl: false, test: function (a, l) { return isNum(l.mileage) && l.mileage > 70000; } },
    seats: { label: "buckets named", fl: false, test: function (a) { return a.seats.s === "ok"; } },
    wheel: { label: "wheel named", fl: false, test: function (a) { return a.wheel.s === "ok"; } },
    exhaust: { label: "aftermarket exhaust", fl: false, test: function (a) { return a.exhaust.s !== "unk"; } },
    engine: { label: "remap named", fl: true, test: function (a) { return a.engine.s === "flag"; } },
    cat: { label: "Cat-marked", fl: true, test: function (a) { return a.cat.s === "flag"; } },
    paint: { label: "signature paint", fl: false, test: function (a) { return a.paint.s === "ok"; } }
  };
  function count(key) {
    var f = FILTERS[key]; var c = 0;
    L.forEach(function (l, i) { if (f.test(A[i], l)) { c += 1; } });
    return c;
  }
  var C = {};
  Object.keys(FILTERS).forEach(function (k) { C[k] = count(k); });
  var under60 = L.filter(function (l) { return isNum(l.mileage) && l.mileage < 60000; }).length;
  var inWin = L.filter(function (l) { return isNum(l.mileage) && l.mileage >= 60000 && l.mileage <= 100000; }).length;
  var past100 = L.filter(function (l) { return isNum(l.mileage) && l.mileage > 100000; }).length;
  var wings = L.filter(function (l, i) { return /wingback/.test(A[i].seats.t); }).length;
  var brakesHead = L.filter(function (l) { return BRAKE_RE.test(String(l.attention_grabber || "")); }).length;
  var flaggedN = A.filter(function (a) { return a.flagged; }).length;

  var last = TREND.length ? TREND[TREND.length - 1] : null;
  var prev = TREND.length > 1 ? TREND[TREND.length - 2] : null;
  var MEDIAN = last && isNum(last.median) ? last.median : median(L.map(function (l) { return l.price; }));
  var lowestMi = M && isNum(M.lowest_mileage) ? M.lowest_mileage : null;

  function pickTop() {
    if (!N) { return -1; }
    if (DATA && DATA.top_pick_id) {
      for (var i = 0; i < N; i++) { if (L[i].advert_id === DATA.top_pick_id) { return i; } }
    }
    return 0;
  }
  var TOP = pickTop();

  function carName(l) {
    var b = bodyOf(l);
    return esc(l.year) + (b ? " " + b : " RS4") + (paintName(l) ? " · " + esc(paintName(l)) : "");
  }

  /* ------------------------------------------------------------ route: scroll-spy, bottom bar, sheet */

  var STOPS = ["file", "identification", "provenance", "walkround", "faults", "fifm", "verdict", "evidence"];
  var STOP_NAMES = ["File", "Identification", "Provenance", "Walk-round", "Known faults", "FIFM! forecourt", "The one for you", "Evidence"];
  var route = $("route");
  var routeBtn = $("routeBtn");
  var stopLis = $$("#stops > li");
  var current = 0;

  function setStop(idx) {
    current = idx;
    stopLis.forEach(function (li, i) {
      li.classList.toggle("passed", i < idx);
      li.classList.toggle("here", i === idx);
      var a = li.querySelector("a.stop");
      if (a) { if (i === idx) { a.setAttribute("aria-current", "location"); } else { a.removeAttribute("aria-current"); } }
    });
    var here = $("barHere");
    if (here) { here.textContent = idx + " · " + STOP_NAMES[idx]; }
    var bp = $("barPrev"), bn = $("barNext");
    if (bp) {
      bp.href = "#" + STOPS[Math.max(0, idx - 1)];
      bp.setAttribute("aria-disabled", idx === 0 ? "true" : "false");
    }
    if (bn) {
      bn.href = "#" + STOPS[Math.min(STOPS.length - 1, idx + 1)];
      bn.setAttribute("aria-disabled", idx === STOPS.length - 1 ? "true" : "false");
    }
  }

  /* where the reader is: the last section whose top has passed 38% of the viewport */
  var SECS = STOPS.map(function (id) { return $(id); });
  function spySections() {
    var line = window.innerHeight * 0.38, idx = 0;
    SECS.forEach(function (el, i) { if (el && el.getBoundingClientRect().top <= line) { idx = i; } });
    if (idx !== current || !stopLis[idx].classList.contains("here")) { setStop(idx); }
  }
  setStop(0);

  function closeRoute() {
    if (!route) { return; }
    route.classList.remove("open");
    if (routeBtn) { routeBtn.setAttribute("aria-expanded", "false"); }
  }
  if (routeBtn && route) {
    routeBtn.addEventListener("click", function () {
      var open = !route.classList.contains("open");
      route.classList.toggle("open", open);
      routeBtn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) { var a = route.querySelector("li.here a.stop") || route.querySelector("a.stop"); if (a) { a.focus(); } }
    });
    route.addEventListener("click", function (e) { if (e.target.closest("a")) { closeRoute(); } });
  }

  /* route scan lines */
  $$("[data-scan='live']").forEach(function (el) {
    el.textContent = N ? N + " for sale · from " + fmtGBP(M.floor_price) : "no data";
  });
  $$("[data-scan='pick']").forEach(function (el) {
    el.textContent = TOP !== -1 ? L[TOP].price_text + " · " + town(L[TOP]) : "no pick";
  });

  /* ------------------------------------------------------------ 0 · the hunt */

  var hunt = $("huntList");
  if (hunt && M) {
    var rows = [];
    rows.push(["For sale", '<b>' + fmtInt(M.total_live) + "</b>"]);
    rows.push(["Asking", fmtGBP(M.floor_price) + "–" + fmtGBP(M.ceiling_price) + ' <small>median ' + fmtGBP(MEDIAN) + "</small>"]);
    rows.push(["Under 60,000 mi", "<b>" + under60 + "</b>" + (isNum(lowestMi) ? ' <small>lowest ' + fmtInt(lowestMi) + " mi</small>" : "")]);
    if (TOP !== -1) {
      var t = L[TOP];
      rows.push(["Top of the list", '<a href="#verdict">' + carName(t) + "\u00a0·\u00a0" + esc(t.price_text) + "</a> <small>" + esc(t.mileage_text) + " · " + esc(town(t)) + "</small>", "pickrow"]);
    }
    hunt.innerHTML = rows.map(function (r) {
      return '<div class="hrow' + (r[2] ? " " + r[2] : "") + '"><dt>' + r[0] + "</dt><dd>" + r[1] + "</dd></div>";
    }).join("");
  }

  /* ------------------------------------------------------------ 1 · paint chips + turntable */

  var chipsEl = $("chips");
  var paintSay = $("paintSay");
  var modelViewer = $("rs4Model");
  var modelReady = false;
  var currentHex = "#1e56c8";

  function familyWord(name) { return name.split(" ").pop(); }
  function paintMatches(name) {
    var exact = [], generic = [];
    var fam = familyWord(name);
    L.forEach(function (l, i) {
      var p = paintName(l);
      if (p === name) { exact.push(i); }
      else if (p === fam) { generic.push(i); }
    });
    return { exact: exact, generic: generic, fam: fam };
  }

  function primCount(mat) {
    try {
      var syms = Object.getOwnPropertySymbols(mat);
      for (var i = 0; i < syms.length; i++) {
        var v = mat[syms[i]];
        if (v && typeof v.size === "number") { return v.size; }
      }
    } catch (err) { /* internal shape changed */ }
    return 0;
  }
  function applyPaintToModel(hex) {
    if (!modelReady || !modelViewer || !modelViewer.model || !modelViewer.model.materials) { return; }
    try {
      var mats = Array.prototype.slice.call(modelViewer.model.materials);
      var nameRe = /paint|body|car(?!pet)|exterior|shell|lack/i;
      var exclRe = /glass|window|tyre|tire|wheel|rim|light|chrome|interior|black/i;
      var targets = mats.filter(function (m) { return nameRe.test(m.name || ""); });
      if (!targets.length) {
        var cands = mats.filter(function (m) { return !exclRe.test(m.name || ""); });
        if (cands.length) { cands.sort(function (a, b) { return primCount(b) - primCount(a); }); targets = [cands[0]]; }
      }
      targets.forEach(function (m) {
        var pbr = m.pbrMetallicRoughness;
        if (!pbr) { return; }
        /* pass the CSS hex string: model-viewer converts sRGB to the linear factor glTF
           expects. An array of 0–1 sRGB values is read as linear and renders far too light. */
        pbr.setBaseColorFactor(hex);
        if (typeof pbr.setMetallicFactor === "function") { pbr.setMetallicFactor(0.55); }
        if (typeof pbr.setRoughnessFactor === "function") { pbr.setRoughnessFactor(0.28); }
      });
    } catch (err) { /* keep the viewer alive if the material API shifts */ }
  }

  function markContact(indices) {
    var set = {};
    indices.forEach(function (i) { set[i] = true; });
    $$("#contact > li").forEach(function (li) {
      var i = +li.getAttribute("data-idx");
      li.classList.toggle("hit", !!set[i]);
      li.classList.toggle("miss", indices.length > 0 && !set[i]);
    });
  }

  function selectPaint(btn, announce) {
    if (!chipsEl || !btn) { return; }
    $$(".chip", chipsEl).forEach(function (b) {
      var on = b === btn;
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    var name = btn.getAttribute("data-name");
    var hex = (btn.style.getPropertyValue("--c") || "").trim() || "#888";
    currentHex = hex;
    document.documentElement.style.setProperty("--paint", hex);
    applyPaintToModel(hex);
    var m = paintMatches(name);
    var use = m.exact.length ? m.exact : m.generic;
    if (announce !== false) { markContact(use); }
    if (paintSay && announce !== false) {
      if (!M) { paintSay.textContent = name + " selected."; return; }
      var txt;
      if (m.exact.length) {
        txt = m.exact.length + " advert" + (m.exact.length === 1 ? "" : "s") + " named " + name + " on " + GEN_DAY + ".";
      } else if (m.generic.length) {
        txt = "None named " + name + " on " + GEN_DAY + "; " + m.generic.length + " say only “" + m.fam + "”, marked on the contact sheet.";
      } else {
        txt = "None named " + name + " on " + GEN_DAY + ". The model shows the colour.";
      }
      paintSay.innerHTML = esc(txt) + (use.length ? ' <a href="#gallery">Contact sheet</a>' : "");
    }
  }

  if (chipsEl) {
    $$(".chip", chipsEl).forEach(function (b) {
      var name = b.getAttribute("data-name");
      var m = paintMatches(name);
      var ct = b.querySelector("[data-count]");
      if (ct && M) {
        ct.textContent = m.exact.length + " named" + (m.generic.length ? ", " + m.generic.length + " “" + m.fam + "”" : "");
      }
    });
    chipsEl.addEventListener("click", function (e) {
      var b = e.target.closest(".chip");
      if (b) { selectPaint(b); b.focus(); }
    });
    chipsEl.addEventListener("keydown", function (e) {
      var keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
      if (keys.indexOf(e.key) === -1) { return; }
      e.preventDefault();
      var chips = $$(".chip", chipsEl);
      var idx = chips.indexOf(document.activeElement);
      if (idx === -1) { idx = 0; }
      var fwd = e.key === "ArrowRight" || e.key === "ArrowDown";
      var next = chips[(idx + (fwd ? 1 : -1) + chips.length) % chips.length];
      selectPaint(next);
      next.focus();
    });
  }

  /* turntable states, on #ttStage[data-state]:
     wait → loading (progress) → ready; or still (file://, no WebGL, timeout) / error.
     The still render stays visible in every state except ready. */
  var ttStage = $("ttStage"), ttMsg = $("ttMsg"), ttBar = $("ttBar");
  function ttState(state, msg) {
    if (!ttStage) { return; }
    ttStage.setAttribute("data-state", state);
    if (ttMsg && msg) { ttMsg.textContent = msg; }
  }
  function webglOK() {
    try {
      var c = document.createElement("canvas");
      var gl = window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"));
      if (!gl) { return false; }
      var lose = gl.getExtension("WEBGL_lose_context");   /* release the probe context */
      if (lose) { lose.loseContext(); }
      return true;
    } catch (err) { return false; }
  }
  if (modelViewer && ttStage) {
    if (location.protocol === "file:") {
      ttState("still", "Still image. Browsers block the 3D viewer on file://. Serve the folder over http to turn the car.");
    } else if (!webglOK()) {
      ttState("still", "Still image. WebGL is off in this browser, so the car cannot turn.");
    } else {
      /* the viewer is an ES module: load it only where it can run, so file:// and
         WebGL-off browsers get the still image without module or WebGL errors */
      var mvScript = document.createElement("script");
      mvScript.type = "module";
      mvScript.src = "vendor/model-viewer.min.js";
      mvScript.addEventListener("error", function () {
        ttState("still", "Still image. The 3D viewer script did not load: vendor/model-viewer.min.js.");
      });
      document.head.appendChild(mvScript);
      ttState("wait", "Still image · the turntable loads when this section is in view");
      modelViewer.addEventListener("progress", function (e) {
        if (modelReady) { return; }
        var p = e.detail && isNum(e.detail.totalProgress) ? e.detail.totalProgress : 0;
        ttState("loading", "Loading the turntable · 2.9 MB · " + Math.round(p * 100) + "%");
        if (ttBar) { ttBar.style.width = Math.round(p * 100) + "%"; }
      });
      modelViewer.addEventListener("load", function () {
        modelReady = true;
        applyPaintToModel(currentHex);
        requestAnimationFrame(function () { requestAnimationFrame(function () { ttState("ready", ""); }); });
      });
      modelViewer.addEventListener("error", function () {
        if (modelReady) { return; }
        ttState("error", "Still image. The model file did not load: assets/rs4_model/rs4.glb.");
      });
      if ("IntersectionObserver" in window) {
        var ttSeen = false;
        var ttIO = new IntersectionObserver(function (en) {
          if (!en[0].isIntersecting || ttSeen) { return; }
          ttSeen = true;
          ttIO.disconnect();
          setTimeout(function () {
            /* only when nothing has arrived at all; a slow download keeps its progress line */
            if (modelReady || ttStage.getAttribute("data-state") !== "wait") { return; }
            var defined = !!(window.customElements && customElements.get("model-viewer"));
            ttState("still", defined ? "Still image. The model has not loaded after 30 s." : "Still image. The 3D viewer script did not run.");
          }, 30000);
        });
        ttIO.observe(ttStage);
      }
    }
  }
  var creditEl = $("modelCredit");
  if (creditEl && typeof window.RS4_MODEL_CREDIT === "string") { creditEl.textContent = window.RS4_MODEL_CREDIT; }

  /* ------------------------------------------------------------ 2 · lineage compare */

  var GENS = {
    RS2: { ps: 315, eng: "2.2 turbo I5", bodies: 1, manual: true, v8: false, saloon: false },
    B5: { ps: 380, eng: "2.7 biturbo V6", bodies: 1, manual: true, v8: false, saloon: false },
    B7: { ps: 420, eng: "4.2 atmospheric V8", bodies: 3, manual: true, v8: true, saloon: true },
    B8: { ps: 450, eng: "4.2 atmospheric V8", bodies: 1, manual: false, v8: true, saloon: false },
    B9: { ps: 450, eng: "2.9 twin-turbo V6", bodies: 1, manual: false, v8: false, saloon: false }
  };
  var compareEl = $("compare");
  function compareGen(g) {
    $$("#linTable tbody tr").forEach(function (tr) { tr.classList.toggle("sel", tr.getAttribute("data-gen") === g); });
    if (!compareEl) { return; }
    var b7 = GENS.B7, o = GENS[g];
    if (!o) { return; }
    if (g === "B7") {
      compareEl.innerHTML = "<b>B7.</b> The only row with all three marks. " +
        (N ? N + ' for sale on ' + esc(GEN_DAY) + ': <a href="#fifm">the forecourt</a>.' : "");
      return;
    }
    var parts = [];
    var d = b7.ps - o.ps;
    parts.push("B7 " + (d >= 0 ? "+" : MINUS) + Math.abs(d) + " PS against " + g);
    parts.push(o.eng + " → " + b7.eng);
    if (o.manual !== b7.manual) { parts.push(o.manual ? "both manual" : g + " has no manual"); } else { parts.push("both manual"); }
    parts.push(o.bodies + " body → " + b7.bodies + " bodies");
    if (!o.saloon) { parts.push("no " + g + " saloon"); }
    compareEl.innerHTML = "<b>" + esc(g) + " against B7.</b> " + esc(parts.join(" · ")) + ".";
  }
  $$("#linTable tbody tr").forEach(function (tr) {
    tr.addEventListener("click", function () { compareGen(tr.getAttribute("data-gen")); });
  });
  compareGen("B7");

  /* ------------------------------------------------------------ 3 · walk-round: hotspots, tag, leader, station spy */

  var ST = {
    1: ["Engine bay", "BNS V8 · 420 PS at 7,800 rpm"],
    2: ["Front brakes", "365 mm discs · Brembo eight-piston"],
    3: ["Box flares", "1,816 mm across the front wings"],
    4: ["Flat-bottomed wheel", N ? C.wheel + " of " + N + " adverts name it, " + GEN_SHORT : "credited as Audi’s first: reputed"],
    5: ["Wingback buckets", N ? C.seats + " of " + N + " adverts name buckets, " + GEN_SHORT : "fitment disputed"],
    6: ["Torsen T3", "40:60 front:rear · bias ratio 4:1"],
    7: ["DRC dampers", "−30 mm" + (N ? " · " + C.drc + " of " + N + " adverts name coilovers, " + GEN_SHORT : "")],
    8: ["Twin oval tips", "2 oval tips; the S4 has 4 round"]
  };

  var stage = $("bpStage");
  var tag = $("tag");
  var leader = $("leader");
  var leaderLine = $("leaderLine");
  var hotspots = $$(".hs");
  var hoverCapable = !!(window.matchMedia && window.matchMedia("(hover: hover)").matches);

  /* the drawing's parts and leaders for one station: red pen while previewed or selected */
  function markParts(n, cls) {
    $$(".bp-part, .bp-lead g").forEach(function (g) { g.classList.toggle(cls, n !== null && g.getAttribute("data-st") === String(n)); });
    if (cls === "hov") {
      /* one station in red pen at a time: a preview steps the scroll selection back */
      var bp = $("bp");
      if (bp) { bp.classList.toggle("pv", n !== null); }
      hotspots.forEach(function (h) { h.classList.toggle("tg", n !== null && h.getAttribute("data-st") === String(n)); });
    }
  }
  /* when the pointer leaves a balloon or a parts row, fall back to whatever holds keyboard focus */
  function previewFromFocus() {
    var a = document.activeElement, li = a && a.closest ? a.closest("#schedule li") : null;
    var n = a && a.classList && a.classList.contains("hs") ? a.getAttribute("data-st") : (li ? li.getAttribute("data-st") : null);
    markParts(n, "hov");
  }
  function showTag(hs) {
    if (!tag || !stage) { return; }
    var n = hs.getAttribute("data-st");
    markParts(n, "hov");
    var d = ST[n];
    tag.innerHTML = '<div class="tg-n">Station ' + n + "</div>" +
      '<div class="tg-t">' + esc(d[0]) + "</div>" +
      '<div class="tg-v">' + esc(d[1]) + "</div>" +
      '<div class="tg-go">select for the station sheet</div>';
    tag.hidden = false;
    var sr = stage.getBoundingClientRect();
    var hr = hs.getBoundingClientRect();
    var hx = hr.left - sr.left + hr.width / 2;
    var hy = hr.top - sr.top + hr.height / 2;
    var tw = tag.offsetWidth, th = tag.offsetHeight;
    var x = hx + 34;
    if (x + tw > sr.width - 6) { x = hx - 34 - tw; }
    if (x < 6) { x = 6; }
    var y = hy < sr.height / 2 ? hy + 28 : hy - 28 - th;
    y = Math.max(4, Math.min(y, sr.height - th - 4));
    tag.style.left = x + "px";
    tag.style.top = y + "px";
    if (leader && leaderLine) {
      var tx = x + (x > hx ? 0 : tw);
      var ty = Math.max(y, Math.min(hy, y + th));
      leaderLine.setAttribute("x1", hx); leaderLine.setAttribute("y1", hy);
      leaderLine.setAttribute("x2", tx); leaderLine.setAttribute("y2", ty);
      leader.hidden = false;
    }
  }
  function hideTag() {
    markParts(null, "hov");
    if (tag) { tag.hidden = true; }
    if (leader) { leader.hidden = true; }
  }
  function goStation(n) {
    var st = $("st-" + n);
    if (!st) { return; }
    hideTag();
    scrollToEl(st);
    var h = st.querySelector("h3");
    if (h) { h.setAttribute("tabindex", "-1"); setTimeout(function () { h.focus({ preventScroll: true }); }, RM ? 0 : 450); }
  }

  hotspots.forEach(function (hs) {
    if (hoverCapable) {
      hs.addEventListener("mouseenter", function () { showTag(hs); });
      hs.addEventListener("mouseleave", function () { if (document.activeElement === hs) { showTag(hs); } else { hideTag(); previewFromFocus(); } });
    }
    hs.addEventListener("focus", function () { showTag(hs); });
    hs.addEventListener("blur", hideTag);
    hs.addEventListener("click", function () { goStation(hs.getAttribute("data-st")); });
  });

  function setStation(n) {
    hotspots.forEach(function (h) { h.classList.toggle("on", h.getAttribute("data-st") === String(n)); });
    $$("#schedule li").forEach(function (li) { li.classList.toggle("on", li.getAttribute("data-st") === String(n)); });
    markParts(n, "on");
    $$(".station").forEach(function (s) { s.classList.toggle("on", s.getAttribute("data-st") === String(n)); });
    $$(".minicar a").forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-st") === String(n)); });
  }
  var STATIONS = $$(".station");
  var currentSt = null;
  function spyStations() {
    var line = window.innerHeight * 0.4, n = null;
    STATIONS.forEach(function (s) { var r = s.getBoundingClientRect(); if (r.top <= line && r.bottom > 0) { n = s.getAttribute("data-st"); } });
    var walk = $("walkround");
    if (walk) { var wr = walk.getBoundingClientRect(); if (wr.bottom < 0 || wr.top > window.innerHeight) { n = null; } }
    if (n !== currentSt) { currentSt = n; setStation(n); }
  }
  var spyQueued = false;
  function spy() {
    if (spyQueued) { return; }
    spyQueued = true;
    setTimeout(function () { spyQueued = false; spySections(); spyStations(); }, 60);
  }
  window.addEventListener("scroll", spy, { passive: true });
  window.addEventListener("resize", spy);
  window.addEventListener("hashchange", spy);
  spy();

  $$("#schedule li").forEach(function (li) {
    var a = li.querySelector("a");
    if (!a) { return; }
    var n = li.getAttribute("data-st");
    a.addEventListener("click", function (e) {
      e.preventDefault();
      goStation(n);
    });
    /* a parts-list row previews its part on the drawing, as the balloon does */
    a.addEventListener("mouseenter", function () { markParts(n, "hov"); });
    a.addEventListener("mouseleave", previewFromFocus);
    a.addEventListener("focus", function () { markParts(n, "hov"); });
    a.addEventListener("blur", function () { markParts(null, "hov"); });
  });

  $$("[data-locate]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      var n = a.getAttribute("data-locate");
      var bp = $("bp");
      scrollToEl(bp);
      setStation(n);
      var hs = $("hs-" + n);
      if (hs) { setTimeout(function () { hs.focus({ preventScroll: true }); }, RM ? 0 : 450); }
    });
  });

  /* station scan blocks and schedule cells that depend on the market */
  function fillScanBlock(key, big, line) {
    var el = document.querySelector("[data-scanblock='" + key + "']");
    if (!el || !N) { return; }
    el.innerHTML = '<span class="big">' + big + '</span><span class="unit">of ' + N + ' adverts</span><span class="cmp"><span>' + esc(line) + "</span><span>" + esc("as of " + GEN_DAY) + "</span></span>";
  }
  fillScanBlock("wheel", C.wheel, "name the flat-bottomed wheel");
  fillScanBlock("seats", C.seats, "name buckets, wingbacks or Recaros");

  /* station market lines: the spec's consequence on the forecourt */
  function showBtn(key, text) {
    if (!C[key]) { return ""; }
    return '<button type="button" class="linkish" data-goto-filter="' + key + '">' + esc(text || ("show " + C[key])) + "</button>";
  }
  var MKT = {
    engine: function () {
      return "<p><span class=\"" + (C.engine ? "fl" : "") + "\">" + C.engine + " of " + N + "</span> name a remap. " +
        past100 + " past 100,000 mi; " + inWin + " inside the carbon window; " + under60 + " under 60,000.</p>" +
        '<div class="acts">' + showBtn("engine") + showBtn("carbon", "show " + C.carbon + " past 70,000") + "</div>";
    },
    brakes: function () { return "<p>" + brakesHead + " of " + N + " headlines mention brakes. Not scored: a viewing check.</p>"; },
    body: function () {
      return "<p><span class=\"" + (C.cat ? "fl" : "") + "\">" + C.cat + " of " + N + "</span> name an insurance category; " + C.paint + " are Sprint Blue or Misano Red.</p>" +
        '<div class="acts">' + showBtn("cat") + showBtn("paint") + "</div>";
    },
    wheel: function () {
      return "<p>" + C.wheel + " of " + N + " name it; each mention scores +1.</p>" + '<div class="acts">' + showBtn("wheel") + "</div>";
    },
    seats: function () {
      return "<p>" + C.seats + " of " + N + " name buckets or Recaros; " + wings + " say wingbacks.</p>" + '<div class="acts">' + showBtn("seats") + "</div>";
    },
    torsen: function () { return "<p>No advert data on the differential. Not scored.</p>"; },
    drc: function () {
      return "<p><span class=\"" + (C.drc ? "fl" : "") + "\">" + C.drc + " of " + N + "</span> name coilovers. The other " + (N - C.drc) +
        " are silent on suspension: check in person.</p>" + '<div class="acts">' + showBtn("drc") + "</div>";
    },
    exhaust: function () {
      return "<p>" + C.exhaust + " of " + N + " headlines name Milltek or Capristo. Headline only.</p>" + '<div class="acts">' + showBtn("exhaust") + "</div>";
    }
  };
  $$("[data-mkt]").forEach(function (el) {
    var k = el.getAttribute("data-mkt");
    if (!N) { el.innerHTML = '<div class="mk-h"><span>On the forecourt</span></div><p>Market data not loaded.</p>'; return; }
    el.innerHTML = '<div class="mk-h"><span>Forecourt</span><span class="stamp">' +
      esc(GEN_DAY) + ' · <span class="age">' + esc(ageShort()) + "</span></span></div>" + (MKT[k] ? MKT[k]() : "");
  });

  /* ------------------------------------------------------------ 4 · mileage line */

  function laneLayout(xs, minGap) {
    var lanes = [];
    var order = xs.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) { return a.x - b.x; });
    var out = [];
    order.forEach(function (o) {
      var lane = 0;
      while (lanes[lane] !== undefined && o.x - lanes[lane] < minGap) { lane += 1; }
      lanes[lane] = o.x;
      out[o.i] = lane;
    });
    return { lane: out, count: lanes.length };
  }

  function drawMileage() {
    var svg = $("mileSvg");
    if (!svg) { return; }
    var W = svg.clientWidth || svg.parentNode.clientWidth || 800;
    var maxMi = 160000;
    L.forEach(function (l) { if (isNum(l.mileage) && l.mileage > maxMi) { maxMi = Math.ceil(l.mileage / 20000) * 20000; } });
    var padL = 4, padR = 4;
    var plotW = W - padL - padR;
    function x(mi) { return padL + plotW * mi / maxMi; }
    var xs = L.map(function (l) { return isNum(l.mileage) ? x(l.mileage) : -100; });
    var lay = laneLayout(xs, 15);
    var bandsTop = 8;
    var rowH = 22;
    var carsTop = bandsTop + rowH * 3 + 14;
    /* dots stack upwards from the axis; tick labels sit directly under it */
    var ay = carsTop + Math.max(1, lay.count) * 16 + 4;
    var H = ay + 22;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("height", H);
    while (svg.firstChild) { svg.removeChild(svg.firstChild); }

    var g = svg.appendChild(svgEl("g", { "class": "job" }));
    // job 01 window
    g.appendChild(svgEl("rect", { x: x(60000), y: bandsTop, width: x(100000) - x(60000), height: rowH - 6, fill: "#e1dacb" }));
    g.appendChild(svgEl("text", { x: x(60000) + 6, y: bandsTop + 12 }, "job 01 carbon window"));
    // invoice expected
    var y2 = bandsTop + rowH + 8;
    g.appendChild(svgEl("line", { x1: x(70000), y1: y2, x2: x(maxMi), y2: y2, stroke: "#b42318", "stroke-width": 1.5, "stroke-dasharray": "5 3" }));
    g.appendChild(svgEl("line", { x1: x(70000), y1: y2 - 5, x2: x(70000), y2: y2 + 5, stroke: "#b42318", "stroke-width": 1.5 }));
    g.appendChild(svgEl("text", { x: x(70000) + 6, y: y2 - 4, fill: "#b42318", style: "fill:#b42318" }, "invoice expected past 70,000"));
    // 40k rhythm
    var y3 = bandsTop + rowH * 2 + 10;
    for (var k = 40000; k <= maxMi; k += 40000) {
      g.appendChild(svgEl("line", { x1: x(k), y1: y3 - 5, x2: x(k), y2: y3 + 5, stroke: "#45484e", "stroke-width": 1.2 }));
    }
    g.appendChild(svgEl("line", { x1: x(0), y1: y3, x2: x(maxMi), y2: y3, stroke: "#a99f8a", "stroke-width": 1, "stroke-dasharray": "2 3" }));
    g.appendChild(svgEl("text", { x: x(40000) + 6, y: y3 - 6 }, "every ≈40,000: clutch; decarb"));

    // axis
    svg.appendChild(svgEl("line", { x1: x(0), y1: ay, x2: x(maxMi), y2: ay, stroke: "#17191d", "stroke-width": 1 }));
    for (var t = 0; t <= maxMi; t += 20000) {
      svg.appendChild(svgEl("line", { x1: x(t), y1: ay, x2: x(t), y2: ay + 4, stroke: "#17191d", "stroke-width": 1 }));
      if (t % 40000 === 0 || W > 700) {
        svg.appendChild(svgEl("text", { x: x(t), y: ay + 16, "text-anchor": t === 0 ? "start" : t === maxMi ? "end" : "middle" }, t === 0 ? "0 mi" : (t / 1000) + "k"));
      }
    }
    // cars
    L.forEach(function (l, i) {
      if (!isNum(l.mileage)) { return; }
      var cy = ay - 10 - lay.lane[i] * 16;
      var dot = svgEl("g", { "class": "dot" + (A[i].flagged ? " f" : ""), tabindex: "0", role: "link",
        "aria-label": "Rank " + l.rank + ", " + fmtInt(l.mileage) + " miles, " + l.price_text + ", " + town(l) + ". Find on the forecourt." });
      dot.appendChild(svgEl("line", { x1: x(l.mileage), y1: ay, x2: x(l.mileage), y2: cy, stroke: "#d2cab9", "stroke-width": 1 }));
      dot.appendChild(svgEl("circle", { cx: x(l.mileage), cy: cy, r: 5.5 }));
      dot.addEventListener("click", function () { goToCar(i); });
      dot.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goToCar(i); } });
      svg.appendChild(dot);
    });
  }

  /* ------------------------------------------------------------ 4 · viewing checklist (this browser only) */

  var PPI_KEY = "rs4b7-ppi-v1";
  function ppiLoad() { try { return JSON.parse(localStorage.getItem(PPI_KEY) || "{}") || {}; } catch (e) { return {}; } }
  function ppiSave(o) { try { localStorage.setItem(PPI_KEY, JSON.stringify(o)); } catch (e) { /* storage blocked */ } }
  var ppiState = ppiLoad();
  var ppiBoxes = $$("#ppi input[type=checkbox]");
  function ppiCount() {
    var c = ppiBoxes.filter(function (b) { return b.checked; }).length;
    var el = $("ppiCount");
    if (el) { el.textContent = c + " of " + ppiBoxes.length + " ticked"; }
  }
  ppiBoxes.forEach(function (b) {
    b.checked = !!ppiState[b.getAttribute("data-k")];
    b.addEventListener("change", function () {
      ppiState[b.getAttribute("data-k")] = b.checked;
      ppiSave(ppiState);
      ppiCount();
    });
  });
  ppiCount();
  var ppiReset = $("ppiReset");
  if (ppiReset) {
    ppiReset.addEventListener("click", function () {
      ppiState = {}; ppiSave(ppiState);
      ppiBoxes.forEach(function (b) { b.checked = false; });
      ppiCount();
    });
  }

  /* ------------------------------------------------------------ 5 · ledger */

  var searchLabel = $("searchLabel");
  if (searchLabel && DATA && DATA.search_label) { searchLabel.textContent = "Find It For Me · " + DATA.search_label; }

  var ledger = $("ledger");
  if (ledger && M) {
    var lr = [];
    function cmpPrev(key, money) {
      if (!prev || !last || !isNum(prev[key]) || !isNum(last[key])) { return ""; }
      var d = last[key] - prev[key];
      return "<span>" + esc(fmtDate(prev.date, true)) + ": " + (money ? fmtGBP(prev[key]) : fmtInt(prev[key])) + (d === 0 ? ", unchanged" : ", " + fmtSigned(d, money)) + "</span>";
    }
    var evoS3 = ' <a class="src" href="#src-3">S3</a>';
    lr.push(["For sale", fmtInt(M.total_live), (last ? "<span>last run: +" + fmtInt(last.new) + " new, " + fmtInt(last.removed) + " gone</span><span>" + fmtInt(last.price_changed) + " price changes</span>" : "")]);
    lr.push(["Floor", fmtGBP(M.floor_price), cmpPrev("floor", true) + "<span>evo: leggy cars from ≈£14,000" + evoS3 + "</span>"]);
    lr.push(["Tracker median", fmtGBP(MEDIAN), cmpPrev("median", true)]);
    lr.push(["Ceiling", fmtGBP(M.ceiling_price), cmpPrev("ceiling", true) + "<span>evo: the best beyond £30,000" + evoS3 + "</span>"]);
    lr.push(["Under 60,000 mi", String(under60), (isNum(lowestMi) ? "<span>lowest " + fmtInt(lowestMi) + " mi</span>" : "") + "<span>evo’s £25,000+ band assumes under 60,000" + evoS3 + "</span>"]);
    ledger.innerHTML = lr.map(function (r) {
      return '<div class="lg"><dt>' + r[0] + '</dt><dd class="v">' + r[1] + '</dd><dd class="c">' + r[2] + "</dd></div>";
    }).join("");
  }

  /* ------------------------------------------------------------ 5 · scatter: price against mileage */

  function drawScatter() {
    var svg = $("scatterSvg");
    if (!svg || !N) { return; }
    var W = svg.clientWidth || svg.parentNode.clientWidth || 600;
    var H = W < 520 ? 240 : 270;
    var padL = 46, padR = 70, padT = 10, padB = 28;
    var pw = W - padL - padR, ph = H - padT - padB;
    var maxMi = 160000;
    L.forEach(function (l) { if (isNum(l.mileage) && l.mileage > maxMi) { maxMi = Math.ceil(l.mileage / 20000) * 20000; } });
    var lo = Math.min(10000, M.floor_price || 10000), hi = Math.max(32000, M.ceiling_price || 30000);
    lo = Math.floor((lo - 2000) / 5000) * 5000; hi = Math.ceil((hi + 2000) / 5000) * 5000;
    function x(mi) { return padL + pw * mi / maxMi; }
    function y(p) { return padT + ph * (1 - (p - lo) / (hi - lo)); }
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("height", H);
    while (svg.firstChild) { svg.removeChild(svg.firstChild); }
    // evo box: £25k+ for sub-60k
    svg.appendChild(svgEl("rect", { x: x(0), y: y(Math.min(hi, 35000)), width: x(60000) - x(0), height: y(25000) - y(Math.min(hi, 35000)), fill: "#e1dacb" }));
    svg.appendChild(svgEl("text", { x: x(0) + 4, y: y(25000) - 5 }, "evo: £25k+, sub-60k"));
    [14000, 25000, 30000].forEach(function (p) {
      if (p < lo || p > hi) { return; }
      svg.appendChild(svgEl("line", { x1: padL, y1: y(p), x2: padL + pw, y2: y(p), stroke: "#625f58", "stroke-dasharray": "3 3", "stroke-width": 1 }));
      svg.appendChild(svgEl("text", { x: padL + pw + 4, y: y(p) + 3.5 }, "£" + p / 1000 + "k" + (p === 14000 ? " leggy" : p === 30000 ? " best" : "")));
    });
    svg.appendChild(svgEl("line", { x1: x(60000), y1: padT, x2: x(60000), y2: padT + ph, stroke: "#625f58", "stroke-dasharray": "3 3", "stroke-width": 1 }));
    // axes
    svg.appendChild(svgEl("line", { x1: padL, y1: padT + ph, x2: padL + pw, y2: padT + ph, stroke: "#17191d" }));
    svg.appendChild(svgEl("line", { x1: padL, y1: padT, x2: padL, y2: padT + ph, stroke: "#17191d" }));
    for (var t = 0; t <= maxMi; t += 40000) {
      svg.appendChild(svgEl("text", { x: x(t), y: H - 8, "text-anchor": t === 0 ? "start" : t === maxMi ? "end" : "middle" }, t === 0 ? "0" : t === maxMi ? t / 1000 + "k mi" : t / 1000 + "k"));
    }
    for (var p = lo; p <= hi; p += 5000) {
      svg.appendChild(svgEl("text", { x: padL - 6, y: y(p) + 3.5, "text-anchor": "end" }, "£" + p / 1000 + "k"));
    }
    if (isNum(MEDIAN)) {
      svg.appendChild(svgEl("line", { x1: padL, y1: y(MEDIAN), x2: padL + pw, y2: y(MEDIAN), stroke: "#17191d", "stroke-width": 1.4 }));
      svg.appendChild(svgEl("text", { x: padL + pw + 4, y: y(MEDIAN) + 3.5, style: "fill:#17191d;font-weight:700" }, "median"));
    }
    /* rank labels: try four positions round each dot, keep the first that clears every dot,
       every earlier label and the plot edge; drop the label if none does (the dot stays). */
    var boxes = [{ x0: x(0) + 2, y0: y(25000) - 16, x1: x(0) + 4 + 19 * 6, y1: y(25000) - 2 }];  /* the evo box label */
    L.forEach(function (l, i) {
      if (!isNum(l.mileage) || !isNum(l.price)) { return; }
      var rr = i === TOP ? 9 : 6.5;
      boxes.push({ x0: x(l.mileage) - rr, y0: y(l.price) - rr, x1: x(l.mileage) + rr, y1: y(l.price) + rr });
    });
    function clear(b) {
      if (b.x0 < padL + 1 || b.x1 > padL + pw - 1 || b.y0 < padT) { return false; }
      return !boxes.some(function (o) { return b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0; });
    }
    function labelSpot(cx, cy, txt) {
      var w = txt.length * 5.6 + 1, tries = [[8, -4, "start"], [-8, -4, "end"], [8, 12, "start"], [-8, 12, "end"]];
      for (var k = 0; k < tries.length; k++) {
        var t = tries[k], bx0 = t[2] === "start" ? cx + t[0] : cx + t[0] - w;
        var b = { x0: bx0, y0: cy + t[1] - 9, x1: bx0 + w, y1: cy + t[1] + 1 };
        if (clear(b)) { boxes.push(b); return { x: cx + t[0], y: cy + t[1], a: t[2] }; }
      }
      return null;
    }
    var order = L.map(function (l, i) { return i; }).sort(function (a, b) { return (L[a].rank || 99) - (L[b].rank || 99); });
    var spots = {};
    order.forEach(function (i) {
      var l = L[i];
      if (!isNum(l.mileage) || !isNum(l.price)) { return; }
      spots[i] = labelSpot(x(l.mileage), y(l.price), String(l.rank));
    });
    L.forEach(function (l, i) {
      if (!isNum(l.mileage) || !isNum(l.price)) { return; }
      var g = svgEl("g", { "class": "pt", tabindex: "0", role: "link",
        "aria-label": "Rank " + l.rank + ": " + l.price_text + ", " + fmtInt(l.mileage) + " miles, " + town(l) + ". Find on the forecourt." });
      g.appendChild(svgEl("circle", { cx: x(l.mileage), cy: y(l.price), r: i === TOP ? 7 : 5.5,
        fill: A[i].flagged ? "#b42318" : "#f4f1ea", stroke: A[i].flagged ? "#b42318" : "#17191d", "stroke-width": i === TOP ? 2.5 : 1.4 }));
      var sp = spots[i];
      if (sp) { g.appendChild(svgEl("text", { x: sp.x, y: sp.y, "text-anchor": sp.a, style: "font-size:9px;fill:#17191d" }, String(l.rank))); }
      g.addEventListener("click", function () { goToCar(i); });
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goToCar(i); } });
      svg.appendChild(g);
    });
  }

  /* ------------------------------------------------------------ 5 · trend, time-proportional */

  function drawTrend() {
    var svg = $("trendSvg");
    var note = $("trendNote");
    if (!svg || !TREND.length) { if (note) { note.textContent = "No tracked runs in this copy."; } return; }
    var W = svg.clientWidth || svg.parentNode.clientWidth || 600;
    var H = W < 520 ? 200 : 220;
    var padL = 46, padR = 70, padT = 22, padB = 26;
    var pw = W - padL - padR, ph = H - padT - padB;
    var days = TREND.map(function (d) { return dayNum(d.date); });
    var d0 = days[0], d1 = days[days.length - 1];
    var span = Math.max(d1 - d0, 1);
    var lo = Infinity, hi = -Infinity;
    TREND.forEach(function (d) { if (isNum(d.floor)) { lo = Math.min(lo, d.floor); } if (isNum(d.ceiling)) { hi = Math.max(hi, d.ceiling); } });
    lo = Math.min(lo, 14000); hi = Math.max(hi, 30000);
    lo = Math.floor((lo - 2000) / 5000) * 5000; hi = Math.ceil((hi + 2000) / 5000) * 5000;
    function x(i) { return TREND.length === 1 ? padL + pw / 2 : padL + pw * (days[i] - d0) / span; }
    function y(p) { return padT + ph * (1 - (p - lo) / (hi - lo)); }
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("height", H);
    while (svg.firstChild) { svg.removeChild(svg.firstChild); }

    // gaps between runs
    var gaps = [];
    for (var gI = 1; gI < TREND.length; gI++) {
      var gd = days[gI] - days[gI - 1];
      if (gd > 3) {
        svg.appendChild(svgEl("rect", { x: x(gI - 1) + 6, y: padT, width: Math.max(0, x(gI) - x(gI - 1) - 12), height: ph, fill: "none", stroke: "#a99f8a", "stroke-dasharray": "2 4" }));
        gaps.push({ cx: (x(gI - 1) + x(gI)) / 2, d: gd });
      }
    }
    [14000, 25000, 30000].forEach(function (p) {
      if (p < lo || p > hi) { return; }
      svg.appendChild(svgEl("line", { x1: padL, y1: y(p), x2: padL + pw, y2: y(p), stroke: "#625f58", "stroke-dasharray": "3 3" }));
      svg.appendChild(svgEl("text", { x: padL + pw + 4, y: y(p) + 3.5 }, "evo £" + p / 1000 + "k"));
    });
    for (var p = lo; p <= hi; p += 5000) {
      svg.appendChild(svgEl("text", { x: padL - 6, y: y(p) + 3.5, "text-anchor": "end" }, "£" + p / 1000 + "k"));
    }
    svg.appendChild(svgEl("line", { x1: padL, y1: padT + ph, x2: padL + pw, y2: padT + ph, stroke: "#17191d" }));
    // band floor→ceiling
    if (TREND.length > 1) {
      var top = [], bot = [];
      TREND.forEach(function (d, i) {
        if (isNum(d.ceiling)) { top.push(x(i) + "," + y(d.ceiling)); }
        if (isNum(d.floor)) { bot.unshift(x(i) + "," + y(d.floor)); }
      });
      svg.appendChild(svgEl("polygon", { points: top.concat(bot).join(" "), fill: "#e1dacb" }));
      var med = TREND.map(function (d, i) { return isNum(d.median) ? x(i) + "," + y(d.median) : null; }).filter(Boolean);
      svg.appendChild(svgEl("polyline", { points: med.join(" "), fill: "none", stroke: "#17191d", "stroke-width": 2 }));
    }
    gaps.forEach(function (g) {
      svg.appendChild(svgEl("text", { x: g.cx, y: padT + ph - 8, "text-anchor": "middle", style: "fill:#17191d" }, "no runs for " + g.d + " days"));
    });
    TREND.forEach(function (d, i) {
      ["floor", "ceiling"].forEach(function (k) {
        if (isNum(d[k])) { svg.appendChild(svgEl("circle", { cx: x(i), cy: y(d[k]), r: 2.5, fill: "#45484e" })); }
      });
      if (isNum(d.median)) { svg.appendChild(svgEl("circle", { cx: x(i), cy: y(d.median), r: 4, fill: "#17191d" })); }
    });
    /* runs closer than 40 px share one date label and one live count, so 18 and 19 Aug read as "18–19 Aug" */
    var clusters = [];
    TREND.forEach(function (d, i) {
      var c = clusters[clusters.length - 1];
      if (c && x(i) - x(c[c.length - 1]) < 40) { c.push(i); } else { clusters.push([i]); }
    });
    clusters.forEach(function (c, ci) {
      var a = c[0], b = c[c.length - 1];
      var anchor = ci === 0 ? "start" : ci === clusters.length - 1 ? "end" : "middle";
      var tx = anchor === "start" ? x(a) : anchor === "end" ? x(b) : (x(a) + x(b)) / 2;
      var lives = uniq(c.map(function (i) { return TREND[i].live; }).filter(isNum));
      if (lives.length) { svg.appendChild(svgEl("text", { x: tx, y: padT - 8, "text-anchor": anchor, style: "fill:#17191d" }, lives.join("/") + (ci === 0 ? " live" : ""))); }
      svg.appendChild(svgEl("text", { x: tx, y: H - 8, "text-anchor": anchor }, fmtRange(TREND[a].date, TREND[b].date)));
    });
    if (note) {
      var bits = [];
      bits.push(TREND.length + " runs, spaced by date");
      if (gaps.length) { bits.push("longest gap " + Math.max.apply(null, gaps.map(function (g) { return g.d; })) + " days"); }
      note.textContent = bits.join(" · ") + ".";
    }
  }

  /* ------------------------------------------------------------ 5 · keeper-test filters */

  var activeFilter = null;
  var filterOrigin = null;
  function applyFilter() {
    var shown = 0;
    $$("#mxList > li").forEach(function (li) {
      var i = +li.getAttribute("data-idx");
      var ok = !activeFilter || FILTERS[activeFilter].test(A[i], L[i]);
      li.classList.toggle("dim", !ok);
      if (ok) { shown += 1; }
    });
    $$("[data-fbtn] .fbtn").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-f") === activeFilter ? "true" : "false"); });
    var say = $("filterSay");
    if (say) {
      if (!activeFilter) { say.innerHTML = N ? "Showing all " + N + ", as of " + esc(GEN_DAY) + "." : ""; }
      else {
        say.innerHTML = "Showing " + shown + " of " + N + ": " + esc(FILTERS[activeFilter].label) + ". " +
          '<button type="button" class="linkish" id="clearFilter">show all</button>' +
          (filterOrigin ? ' · <a href="#' + esc(filterOrigin) + '">back to ' + esc(filterOrigin.replace("st-", "station ")) + "</a>" : "");
        var cf = $("clearFilter");
        if (cf) { cf.addEventListener("click", function () { activeFilter = null; filterOrigin = null; applyFilter(); }); }
      }
    }
  }
  function setFilter(key, origin) {
    if (key && FILTERS[key] && !C[key]) { return; }
    activeFilter = activeFilter === key && !origin ? null : key;
    filterOrigin = origin || null;
    applyFilter();
  }
  $$("[data-fbtn]").forEach(function (td) {
    var k = td.getAttribute("data-fbtn");
    if (!N || !FILTERS[k]) { td.textContent = N ? "" : "no data"; return; }
    td.innerHTML = '<button type="button" class="fbtn' + (FILTERS[k].fl ? " fl" : "") + '" data-f="' + k + '" aria-pressed="false"' + (C[k] ? "" : " disabled") + ">" +
      C[k] + " of " + N + "</button>";
    td.querySelector("button").addEventListener("click", function () { setFilter(k); });
  });
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-goto-filter]");
    if (!b) { return; }
    var st = b.closest(".station");
    setFilter(b.getAttribute("data-goto-filter"), st ? st.id : null);
    scrollToEl($("mx"));
  });

  /* ------------------------------------------------------------ 5 · ranked entries */

  function cell(label, r) {
    if (r.s === "unk") { return '<span class="cell s-unk" role="img" aria-label="' + label + ': ' + esc(r.say) + '"></span>'; }
    var sw = r.hex ? '<span class="sw" style="background:' + esc(r.hex) + '"></span>' : "";
    return '<span class="cell s-' + r.s + '"><span class="cl">' + label + "</span>" + sw + esc(r.t) + "</span>";
  }
  function sparkline(hist, w, h) {
    w = w || 300; h = h || 44;
    var pad = 6;
    if (!hist || !hist.length) { return ""; }
    if (hist.length === 1) {
      return '<svg viewBox="0 0 ' + w + " " + h + '" aria-hidden="true"><line x1="' + pad + '" y1="' + h / 2 + '" x2="' + (w - pad) + '" y2="' + h / 2 + '" stroke="#d2cab9" stroke-dasharray="3 4"/>' +
        '<circle cx="' + (pad + 4) + '" cy="' + h / 2 + '" r="3.5" fill="#17191d"/><text x="' + (pad + 14) + '" y="' + (h / 2 - 6) + '" font-family="ui-monospace,Menlo,monospace" font-size="10" fill="#45484e">' +
        esc(fmtGBP(hist[0].price)) + " · one price seen</text></svg>";
    }
    var mn = Infinity, mx = -Infinity;
    hist.forEach(function (p) { mn = Math.min(mn, p.price); mx = Math.max(mx, p.price); });
    var sp = Math.max(mx - mn, 1);
    var d0 = dayNum(hist[0].date), d1 = dayNum(hist[hist.length - 1].date), ds = Math.max(d1 - d0, 1);
    var pts = hist.map(function (p) {
      var px = pad + (w - pad * 2) * (dayNum(p.date) - d0) / ds;
      var py = pad + (h - pad * 2) * (1 - (p.price - mn) / sp);
      return px.toFixed(1) + "," + py.toFixed(1);
    });
    return '<svg viewBox="0 0 ' + w + " " + h + '" aria-hidden="true"><polyline points="' + pts.join(" ") + '" fill="none" stroke="#17191d" stroke-width="1.5"/>' +
      pts.map(function (p) { var xy = p.split(","); return '<circle cx="' + xy[0] + '" cy="' + xy[1] + '" r="2.5" fill="#17191d"/>'; }).join("") + "</svg>";
  }

  var mxList = $("mxList");
  var MAXMI_BAR = 160000;
  L.forEach(function (l) { if (isNum(l.mileage) && l.mileage > MAXMI_BAR) { MAXMI_BAR = Math.ceil(l.mileage / 20000) * 20000; } });

  function entryHtml(l, i) {
    var a = A[i];
    var delta = isNum(l.price) && isNum(MEDIAN) ? l.price - MEDIAN : null;
    var body = bodyOf(l);
    var listed = isNum(l.days_listed) && l.days_listed > 0 ? "≥" + l.days_listed + " d" : "new this run";
    var sub = [esc(l.seller_type || ""), esc(town(l)) + (dist(l) ? ", " + esc(dist(l).replace(" away", "")) : ""), listed].filter(Boolean).join(" · ");
    var miPct = isNum(l.mileage) ? Math.min(100, l.mileage / MAXMI_BAR * 100) : null;
    var winL = 60000 / MAXMI_BAR * 100, winW = 40000 / MAXMI_BAR * 100;
    var sc = isNum(l.score) ? l.score : 0;

    return '<li class="mx-item" id="car-' + esc(l.advert_id) + '" data-idx="' + i + '">' +
      '<div class="mx-row">' +
        '<span class="rk">' + esc(l.rank) + "</span>" +
        '<img class="th" src="' + esc(l.image) + '" alt="" loading="lazy">' +
        '<div class="car"><a class="go" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + carName(l) + "</a>" +
          '<span class="sub">' + sub + "</span></div>" +
        '<span class="pr"><b>' + esc(l.price_text) + "</b><small>" + (delta === null ? "" : fmtSigned(delta, true)) + "</small></span>" +
        '<span class="mi"><b>' + fmtInt(l.mileage) + " mi</b><small>" + esc(a.carbon.t) + "</small>" +
          (miPct === null ? "" : '<span class="mbar" aria-hidden="true"><s style="left:' + winL.toFixed(1) + "%;width:" + winW.toFixed(1) + '%"></s><i style="left:' + miPct.toFixed(1) + '%"></i></span>') + "</span>" +
        '<span class="cells">' +
          cell("DRC", a.drc) + cell("Seats", a.seats) + cell("Wheel", a.wheel) + cell("Exhaust", a.exhaust) +
          cell("Engine", a.engine) + cell("History", a.cat) +
        "</span>" +
        '<span class="sc' + (sc < 0 ? " neg" : "") + '" title="tracker score">' + score(sc) + "</span>" +
        '<button type="button" class="more" aria-expanded="false" aria-controls="ev-' + i + '" aria-label="Evidence file for rank ' + esc(l.rank) + '">file</button>' +
      "</div>" +
      '<div class="mx-ev" id="ev-' + i + '" hidden></div>' +
      "</li>";
  }

  /* the evidence file for one advert, built when first opened */
  function evHtml(i) {
    var l = L[i], a = A[i];
    var sc = isNum(l.score) ? l.score : 0;
    var hits = l.keyword_hits || [], flags = l.keyword_flags || [];
    var hist = l.price_history || [];
    var changes = hist.length > 1 ? fmtSigned(hist[hist.length - 1].price - hist[0].price, true) + " since first seen" : "no price change seen";
    var stLines = [
      ["DRC", "st-7", a.drc], ["Carbon", "job-1", a.carbon], ["Seats", "st-5", a.seats], ["Wheel", "st-4", a.wheel],
      ["Exhaust", "st-8", a.exhaust], ["Engine", "st-1", a.engine], ["History", "st-3", a.cat], ["Paint", "identification", a.paint]
    ].map(function (r) {
      return '<li class="' + (r[2].s === "flag" ? "f" : "") + '"><a href="#' + r[1] + '">' + r[0] + "</a>: " + esc(r[2].say) + "</li>";
    }).join("");
    return "<div>" + (l.attention_grabber ? "<h4>Headline</h4><p><q>" + esc(l.attention_grabber) + "</q></p>" : "") + "<h4>Station read-out</h4><ul>" + stLines + "</ul></div>" +
      "<div><h4>Tracker record</h4><ul>" +
        '<li class="mono">score ' + score(sc) + " = " + hits.length + " positive − " + flags.length + " red flag" + (flags.length === 1 ? "" : "s") + "</li>" +
        '<li class="mono">positive: ' + (hits.length ? esc(hits.join(", ")) : "none") + "</li>" +
        '<li class="mono">red flags: ' + (flags.length ? esc(flags.join(", ")) : "none") + "</li>" +
        '<li class="mono">first seen ' + esc(fmtDate(l.first_seen)) + " · " + changes + "</li>" +
        '<li class="mono">as of ' + esc(GEN_DAY) + " · " + esc(ageText()) + "</li>" +
      "</ul>" +
      '<div class="spark">' + sparkline(hist) + "</div>" +
      '<p><a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">Open the advert</a> · <button type="button" class="linkish" data-photos="' + i + '">photographs</button></p>' +
      "</div>";
  }

  if (mxList) {
    if (!N) { mxList.innerHTML = '<li class="mx-item"><div class="mx-row"><span></span><span></span><div class="car">No live adverts in this copy.</div></div></li>'; }
    else { mxList.innerHTML = L.map(entryHtml).join(""); }

    mxList.addEventListener("click", function (e) {
      var tog = e.target.closest(".more");
      if (tog) {
        e.preventDefault();
        var ev = $(tog.getAttribute("aria-controls"));
        var open = ev && ev.hidden;
        if (ev && open && !ev.firstChild) { ev.innerHTML = evHtml(+tog.closest(".mx-item").getAttribute("data-idx")); }
        if (ev) { ev.hidden = !open; }
        $$('[aria-controls="' + tog.getAttribute("aria-controls") + '"]', mxList).forEach(function (b) { b.setAttribute("aria-expanded", open ? "true" : "false"); });
        hidePop();
        return;
      }
      var ph = e.target.closest("[data-photos]");
      if (ph) { openLightbox(+ph.getAttribute("data-photos"), 0); return; }
      var go = e.target.closest("a.go");
      if (go && isTouch && !(e.metaKey || e.ctrlKey || e.shiftKey)) {
        var li = go.closest(".mx-item");
        var i = +li.getAttribute("data-idx");
        if (!(popFor === i && pop && !pop.hidden)) { e.preventDefault(); showPop(li.querySelector(".mx-row"), i, true); }
      }
    });
  }

  /* hover preview */
  var pop = $("pop");
  var popFor = -1;
  var isTouch = !hoverCapable;

  function showPop(row, i, touch) {
    if (!pop) { return; }
    var l = L[i], a = A[i];
    var flagsTxt = [a.drc, a.engine, a.cat].filter(function (r) { return r.s === "flag"; }).map(function (r) { return r.t; });
    pop.innerHTML = '<img src="' + esc(l.image) + '" alt="">' +
      '<div class="pb"><div class="pt">' + carName(l) + " · " + esc(l.price_text) + "</div>" +
      (l.attention_grabber ? "<q>" + esc(l.attention_grabber) + "</q>" : "") +
      '<div class="ps">' + sparkline(l.price_history, 300, 40) + "</div>" +
      '<div class="pm">' + esc(l.mileage_text) + " · " + esc(a.carbon.t) + " · first seen " + esc(fmtDate(l.first_seen, true)) + "</div>" +
      (flagsTxt.length ? '<div class="pm" style="color:#b42318">flags: ' + esc(flagsTxt.join(", ")) + "</div>" : "") +
      (touch ? '<a class="pc" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">Open the advert</a>' : '<div class="pm">select to open the advert</div>') +
      "</div>";
    pop.hidden = false;
    pop.classList.toggle("touch", !!touch);
    popFor = i;
    if (touch) { pop.style.left = ""; pop.style.top = ""; return; }
    var r = row.getBoundingClientRect();
    var pw = 300, ph = pop.offsetHeight || 340;
    var left = r.right - pw - 60;
    var thumb = row.querySelector(".th");
    if (thumb) { var tr = thumb.getBoundingClientRect(); left = tr.right + 260; }
    if (left + pw > window.innerWidth - 10) { left = window.innerWidth - pw - 10; }
    var top = r.bottom + 8;
    if (top + ph > window.innerHeight - 10) { top = r.top - ph - 8; }
    if (top < 10) { top = 10; }
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }
  function hidePop() {
    if (pop) { pop.hidden = true; pop.classList.remove("touch"); }
    popFor = -1;
  }
  if (mxList && pop && !isTouch) {
    mxList.addEventListener("mouseover", function (e) {
      var row = e.target.closest(".mx-row");
      if (!row || e.target.closest(".more")) { return; }
      var i = +row.parentNode.getAttribute("data-idx");
      if (popFor !== i && L[i]) { showPop(row, i); }
    });
    mxList.addEventListener("mouseout", function (e) {
      var row = e.target.closest(".mx-row");
      if (row && !row.contains(e.relatedTarget)) { hidePop(); }
    });
    mxList.addEventListener("focusin", function (e) {
      var go = e.target.closest("a.go");
      if (!go) { return; }
      var li = go.closest(".mx-item");
      showPop(li.querySelector(".mx-row"), +li.getAttribute("data-idx"));
    });
    mxList.addEventListener("focusout", function (e) {
      if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest("a.go")) { hidePop(); }
    });
    window.addEventListener("scroll", hidePop, { passive: true });
  }
  if (isTouch && pop) {
    document.addEventListener("click", function (e) {
      if (pop.hidden) { return; }
      if (e.target.closest("#pop") || e.target.closest("a.go")) { return; }
      hidePop();
    });
  }

  function goToCar(i) {
    var l = L[i];
    if (!l) { return; }
    var li = $("car-" + l.advert_id);
    if (!li) { return; }
    if (li.classList.contains("dim")) { activeFilter = null; filterOrigin = null; applyFilter(); }
    scrollToEl(li);
    li.classList.add("flash");
    setTimeout(function () { li.classList.remove("flash"); }, 1800);
    var go = li.querySelector("a.go");
    if (go) { setTimeout(function () { go.focus({ preventScroll: true }); }, RM ? 0 : 500); }
  }

  applyFilter();

  /* ------------------------------------------------------------ 5 · contact sheet */

  var contact = $("contact");
  if (contact) {
    if (!N) { contact.innerHTML = "<li>No photographs in this copy.</li>"; }
    else {
      contact.innerHTML = L.map(function (l, i) {
        return '<li data-idx="' + i + '"><button type="button" aria-label="Photographs of rank ' + esc(l.rank) + ", " + esc(l.year) + " " + esc(paintName(l)) + ", " + esc(l.price_text) + ", " + esc(town(l)) + '">' +
          '<img src="' + esc(l.image) + '" alt="" loading="lazy">' +
          '<span class="fr"><b>' + esc(l.rank) + "</b><span>" + esc(l.price_text) + "</span></span>" +
          '<span class="fr"><span>' + fmtInt(l.mileage) + " mi</span></span>" +
          "</button></li>";
      }).join("");
      contact.addEventListener("click", function (e) {
        var b = e.target.closest("button");
        if (!b) { return; }
        openLightbox(+b.parentNode.getAttribute("data-idx"), 0);
      });
    }
  }

  /* ------------------------------------------------------------ lightbox */

  var lb = $("lb"), lbImg = $("lbImg"), lbCap = $("lbCap");
  var lbCar = 0, lbPic = 0;
  function photosOf(i) {
    var l = L[i];
    if (!l) { return []; }
    return (l.images_hires && l.images_hires.length) ? l.images_hires : (l.image ? [l.image] : []);
  }
  function renderLb() {
    var l = L[lbCar];
    var ph = photosOf(lbCar);
    if (!l || !ph.length) { return; }
    lbImg.src = ph[lbPic];
    lbImg.alt = l.year + " Audi RS4 B7" + (paintName(l) ? " in " + paintName(l) : "") + ", for sale in " + town(l) + ": seller’s photograph " + (lbPic + 1) + " of " + ph.length;
    lbCap.innerHTML = "<span>Rank " + esc(l.rank) + " · " + carName(l) + " · " + esc(l.price_text) + " · " + esc(l.mileage_text) + " · " + esc(town(l)) + " · photo " + (lbPic + 1) + " of " + ph.length + "</span>" +
      '<span><a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">Open the advert</a> · <button type="button" class="linkish" id="lbFind">find on the forecourt</button></span>';
    var f = $("lbFind");
    if (f) { f.addEventListener("click", function () { closeLb(); goToCar(lbCar); }); }
  }
  function stepLb(dir) {
    var ph = photosOf(lbCar);
    lbPic += dir;
    if (lbPic >= ph.length) { lbCar = (lbCar + 1) % N; lbPic = 0; }
    else if (lbPic < 0) { lbCar = (lbCar - 1 + N) % N; lbPic = photosOf(lbCar).length - 1; }
    renderLb();
  }
  function openLightbox(i, p) {
    if (!lb || !N) { return; }
    lbCar = i; lbPic = p || 0;
    renderLb();
    hidePop();
    if (typeof lb.showModal === "function") { if (!lb.open) { lb.showModal(); } } else { lb.setAttribute("open", ""); }
    var x = $("lbClose"); if (x) { x.focus(); }
  }
  function closeLb() { if (!lb) { return; } if (typeof lb.close === "function" && lb.open) { lb.close(); } else { lb.removeAttribute("open"); } }
  if (lb) {
    $("lbClose").addEventListener("click", closeLb);
    $("lbPrev").addEventListener("click", function () { stepLb(-1); });
    $("lbNext").addEventListener("click", function () { stepLb(1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) { closeLb(); } });
    lb.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); stepLb(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); stepLb(1); }
    });
  }

  /* ------------------------------------------------------------ 5 · gone from the market */

  var goneT = $("goneT");
  if (goneT) {
    if (!GONE.length) {
      goneT.innerHTML = '<tbody><tr><td>Nothing has left the search since tracking began.</td></tr></tbody>';
    } else {
      goneT.innerHTML = '<thead><tr><th scope="col"><span class="vh">Photograph</span></th><th scope="col">Car</th><th scope="col">Last price</th><th scope="col">Seen → gone by</th><th scope="col">Days listed</th></tr></thead><tbody>' +
        GONE.map(function (g) {
          var fs = dayNum(g.first_seen), ls = dayNum(g.last_seen), rd = dayNum(g.removed_date);
          var gap = (ls !== null && rd !== null && rd - ls > 1);
          var lowB = (ls !== null && fs !== null) ? ls - fs : null;
          var daysTxt = gap ? (lowB !== null ? lowB + "–" : "≤") + fmtInt(g.days_on_market) + " d" : fmtInt(g.days_on_market) + " d";
          var seen = (g.last_seen ? fmtRange(g.first_seen, g.last_seen) : fmtDate(g.first_seen, true)) + " → " + fmtDate(g.removed_date, true);
          return "<tr>" +
            '<td class="gi"><img src="' + esc(g.image) + '" alt="" loading="lazy"></td>' +
            "<td>" + carName(g) + ", " + esc(town(g)) + "</td>" +
            '<td class="gp">' + esc(g.price_text) + "</td>" +
            '<td class="gc">' + esc(seen) + "</td>" +
            '<td title="' + (gap ? "removed between runs: range runs from last seen to the run that noticed" : "") + '">' + esc(daysTxt) + "</td>" +
            "</tr>";
        }).join("") + "</tbody>";
    }
  }

  /* ------------------------------------------------------------ 6 · the one for you */

  function evoBand(p) {
    if (!isNum(p)) { return ""; }
    if (p < 14000) { return "below evo’s ≈£14,000 entry point for leggy cars"; }
    if (p < 25000) { return "inside evo’s £14,000–£25,000 band"; }
    if (p < 30000) { return "inside evo’s £25,000+ band, which assumes under 60,000 mi"; }
    return "in evo’s £30,000+ band for the best cars";
  }
  function whyItWins(l, a) {
    var r = [];
    if (a.seats.s === "ok") { r.push(a.seats.t.replace(/ · /g, " and ") + " named"); }
    if (a.wheel.s === "ok") { r.push("Flat-bottomed wheel named"); }
    if (a.paint.s === "ok") { r.push(a.paint.t + ", a signature colour"); }
    if (!a.flagged) { r.push("No coilovers, remap or insurance category named"); }
    if (!r.length) { r.push("Highest tracker score on the board"); }
    return r.map(function (s) { return s.charAt(0).toUpperCase() + s.slice(1); });
  }
  function viewingChecks(l, a) {
    var c = [];
    if (isNum(l.mileage) && l.mileage > 70000) { c.push(["Carbon", "Ask for the carbon-clean invoice. Without it, budget £500–£1,000 (job 01).", false]); }
    else if (isNum(l.mileage) && l.mileage >= 60000) { c.push(["Carbon", "Inside the 60,000–100,000 mi window: cold start, listen to the idle (job 01).", false]); }
    if (a.drc.s === "flag") { c.push(["DRC", "Advert names " + a.drc.t + ": DRC likely removed. Originality lost; price it in.", true]); }
    else { c.push(["DRC", "Not mentioned. Check the stance is square and look for weeps on a lift (job 02).", false]); }
    if (a.seats.s === "ok") { c.push(["Seats", "Buckets named: check the driver’s outer bolster and the armrest catch.", false]); }
    if (a.engine.s === "flag") { c.push(["Engine", "Remap named: ask for the supporting history.", true]); }
    if (a.cat.s === "flag") { c.push(["History", a.cat.t + " named: HPI check, and price it.", true]); }
    if (a.exhaust.s !== "unk") { c.push(["Exhaust", a.exhaust.t + " in the headline: aftermarket, not original.", false]); }
    c.push(["Oil", "Read the oil-level history; cold start for smoke (job 03).", false]);
    c.push(["Clutch", "Bite point and judder; ask about track use.", false]);
    return c;
  }

  var one = $("one");
  if (one && TOP !== -1) {
    var tl = L[TOP], ta = A[TOP];
    var hero = (tl.images_hires && tl.images_hires.length) ? tl.images_hires[0] : tl.image;
    var dlt = isNum(tl.price) && isNum(MEDIAN) ? tl.price - MEDIAN : null;
    var checks = viewingChecks(tl, ta).map(function (c) { return '<li class="kv' + (c[2] ? " f" : "") + '"><span class="k">' + c[0] + "</span><span>" + esc(c[1]) + "</span></li>"; }).join("");
    var why = whyItWins(tl, ta).map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("");
    one.innerHTML =
      '<figure class="one-photo"><button type="button" id="onePhotos" aria-label="All photographs of this car"><img src="' + esc(hero) + '" alt="' + esc(tl.year) + " Audi RS4 B7" + (paintName(tl) ? " in " + esc(paintName(tl)) : "") + ", the top-ranked car, for sale in " + esc(town(tl)) + '"></button>' +
        "<figcaption>Seller’s photograph · " + esc(town(tl)) + "</figcaption></figure>" +
      '<div class="one-head">' +
        "<h3>" + carName(tl) + "</h3>" +
        '<p class="rkline">Rank ' + esc(tl.rank) + " of " + N + " · score " + score(tl.score) + " · as of " + esc(GEN_DAY) + "</p>" +
        '<p class="price">' + esc(tl.price_text) + "</p>" +
        '<p class="vs">' + (dlt === null ? "" : "<span>" + fmtSigned(dlt, true) + " against the tracker median of " + fmtGBP(MEDIAN) + "</span>") +
          "<span>" + esc(evoBand(tl.price)) + "</span>" +
          "<span>" + esc(tl.mileage_text) + " · " + esc(tl.seller_type || "") + " · " + esc(town(tl)) + (dist(tl) ? ", " + esc(dist(tl)) : "") + "</span></p>" +
      "</div>" +
      '<div class="one-band">' +
        "<div><h4>Why it ranks first</h4><ul>" + why + "</ul></div>" +
        "<div><h4>At the viewing</h4><ul>" + checks + "</ul></div>" +
        '<a class="cta" href="' + esc(tl.url) + '" target="_blank" rel="noopener noreferrer">View the advert →</a>' +
      "</div>";
    var op = $("onePhotos");
    if (op) { op.addEventListener("click", function () { openLightbox(TOP, 0); }); }
  } else if (one && DATA) {
    one.innerHTML = '<div class="one-body"><p>No live car to recommend in this copy. The board is empty.</p></div>';
  }

  var pagerBody = $("pagerBody");
  if (pagerBody && DATA) {
    var rep = DATA.report;
    if (rep && rep.pdf) {
      /* rep.updated is the day data.js was built, not the day the PDF was rendered, so the
         page does not date the sheet; the sheet prints its own date at the head. */
      pagerBody.innerHTML =
        '<div class="sheet">' + (rep.preview ? '<img src="' + esc(rep.preview) + '" alt="Preview of the most recent RS4 B7 market one-pager, first page" loading="lazy">' : '<div class="noprev">PDF ready · no preview image</div>') + "</div>" +
        '<a class="cta ghost" href="' + esc(rep.pdf) + '" download>Download the one-pager (PDF) ↓</a>' +
        '<span class="stamp">Latest sheet rendered; its own date is printed at the top.</span>' +
        "<p>Generated as a PDF. WhatsApp delivery is not active.</p>";
    } else {
      pagerBody.innerHTML = "<p>No one-pager PDF in this copy.</p>";
    }
  }

  /* ------------------------------------------------------------ 7 · evidence: where each source is used */

  $$("#srcs > li").forEach(function (li) {
    var id = li.id;
    var used = li.querySelector(".used");
    if (!used) { return; }
    var seen = [], links = [];
    $$('a.src[href="#' + id + '"]').forEach(function (a) {
      if (a.closest("#srcs")) { return; }
      var st = a.closest(".station");
      var sec = a.closest("section.sec");
      var key, label;
      if (st) { key = st.id; label = "§3." + st.getAttribute("data-st"); }
      else if (a.closest("#job-1, #job-2, #job-3, #job-4")) { var j = a.closest("tr"); key = j.id; label = j.id.replace("job-", "J0"); }
      else if (sec) { key = sec.id; label = "§" + STOPS.indexOf(sec.id); }
      if (key && seen.indexOf(key) === -1) { seen.push(key); links.push('<a href="#' + key + '">' + esc(label) + "</a>"); }
    });
    if (id === "src-m1") { ["fifm", "verdict"].forEach(function (k) { if (seen.indexOf(k) === -1) { links.push('<a href="#' + k + '">§' + STOPS.indexOf(k) + "</a>"); } }); }
    used.innerHTML = links.length ? links.join(" ") : "listed for completeness";
    if (!links.length) { used.classList.add("none"); }
  });

  /* ------------------------------------------------------------ keyboard + resize */

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { hidePop(); hideTag(); closeRoute(); }
  });

  function drawAll() { drawMileage(); drawScatter(); drawTrend(); }
  drawAll();
  var rt = null;
  window.addEventListener("resize", function () {
    if (rt) { clearTimeout(rt); }
    rt = setTimeout(drawAll, 150);
  });

  /* default paint after the contact sheet exists */
  if (chipsEl) {
    var def = chipsEl.querySelector('.chip[data-name="Sprint Blue"]') || chipsEl.querySelector(".chip");
    selectPaint(def, false);
  }

})();
