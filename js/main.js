/* AUDI RS4 B7 — TRACKER & TRIBUTE
   Plain JS, no modules, no fetch. Data arrives via window.RS4_DATA (js/data.js). */

(function () {
  "use strict";

  var DATA = window.RS4_DATA || null;
  var MARKET = DATA && DATA.market ? DATA.market : null;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /* ---------- helpers ---------- */

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    if (s === null || s === undefined) { return ""; }
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtInt(n) {
    if (typeof n !== "number" || !isFinite(n)) { return "—"; }
    return n.toLocaleString("en-GB");
  }

  function fmtGBP(n) {
    if (typeof n !== "number" || !isFinite(n)) { return "—"; }
    return "£" + n.toLocaleString("en-GB");
  }

  function fmtDate(iso) {
    if (!iso) { return "—"; }
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return String(iso); }
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  function fmtStamp(iso) {
    if (!iso) { return "—"; }
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return String(iso); }
    var hh = String(d.getHours());
    var mm = String(d.getMinutes());
    if (hh.length < 2) { hh = "0" + hh; }
    if (mm.length < 2) { mm = "0" + mm; }
    return "generated " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear() + " · " + hh + ":" + mm;
  }

  function daysLabel(n) {
    var d = (typeof n === "number" && isFinite(n)) ? Math.max(1, n) : 1;
    return "≥" + d + "d";
  }

  /* ---------- tabs ---------- */

  var TAB_IDS = ["legend", "blueprint", "viewer360", "lineage", "gallery", "fifm"];
  var trendDrawn = false;

  function activateTab(id, scroll) {
    if (TAB_IDS.indexOf(id) === -1) { id = "legend"; }
    TAB_IDS.forEach(function (t) {
      var tab = $("tab-" + t);
      var pane = $(t);
      var on = (t === id);
      if (tab) {
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.tabIndex = on ? 0 : -1;
      }
      if (pane) { pane.hidden = !on; }
    });
    if (id === "fifm") { drawTrend(); trendDrawn = true; }
    if (scroll) { window.scrollTo(0, 0); }
  }

  function currentHashTab() {
    var h = (location.hash || "").replace("#", "");
    return TAB_IDS.indexOf(h) !== -1 ? h : "legend";
  }

  TAB_IDS.forEach(function (t) {
    var tab = $("tab-" + t);
    if (!tab) { return; }
    tab.addEventListener("click", function () {
      if (currentHashTab() === t) { activateTab(t, true); }
      else { location.hash = t; }
    });
  });

  window.addEventListener("hashchange", function () {
    activateTab(currentHashTab(), true);
  });

  // arrow-key roving focus on the tablist
  var tablist = document.querySelector(".tabs");
  if (tablist) {
    tablist.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") { return; }
      var tabs = TAB_IDS.map(function (t) { return $("tab-" + t); });
      var idx = tabs.indexOf(document.activeElement);
      if (idx === -1) { return; }
      e.preventDefault();
      var next = e.key === "ArrowRight" ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
      tabs[next].focus();
    });
  }

  /* ---------- blueprint hotspots ---------- */

  var stage = $("bpStage");
  var wrap = $("bpWrap");
  var leader = $("bpLeader");
  var leaderLine = $("bpLeaderLine");
  var openHotspot = null;
  var closeTimer = null;

  function closeCallout() {
    if (!openHotspot) { return; }
    var card = $(openHotspot.getAttribute("aria-controls"));
    if (card) { card.hidden = true; }
    openHotspot.setAttribute("aria-expanded", "false");
    openHotspot = null;
    if (leader) { leader.classList.remove("on"); }
  }

  // narrow screens render the callout as a fixed bottom sheet (see CSS);
  // skip the absolute-positioning + leader-line maths entirely there
  function isNarrow() {
    return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
  }

  function openCallout(hs) {
    if (openHotspot === hs) { return; }
    closeCallout();
    var card = $(hs.getAttribute("aria-controls"));
    if (!card || !wrap || !stage) { return; }
    openHotspot = hs;
    hs.setAttribute("aria-expanded", "true");
    card.hidden = false;

    if (isNarrow()) {
      // bottom sheet: CSS handles placement, clear any stale inline coords
      card.style.left = "";
      card.style.top = "";
      if (leader) { leader.classList.remove("on"); }
      return;
    }

    // hotspot centre relative to the wrap
    var wr = wrap.getBoundingClientRect();
    var hr = hs.getBoundingClientRect();
    var hx = hr.left - wr.left + hr.width / 2;
    var hy = hr.top - wr.top + hr.height / 2;

    var cw = card.offsetWidth;
    var ch = card.offsetHeight;
    var ww = wrap.clientWidth;
    var wh = wrap.clientHeight;

    var x = hx + 30;
    if (x + cw > ww - 8) { x = hx - 30 - cw; }
    if (x < 8) { x = Math.max(8, Math.min((ww - cw) / 2, ww - cw - 8)); }
    var y = hy - ch / 2;
    if (y < 8) { y = 8; }
    if (y + ch > wh - 8) { y = wh - ch - 8; }
    card.style.left = x + "px";
    card.style.top = y + "px";

    // leader line (drawn in stage coordinates)
    if (leader && leaderLine) {
      var sr = stage.getBoundingClientRect();
      var sx = hr.left - sr.left + hr.width / 2;
      var sy = hr.top - sr.top + hr.height / 2;
      var cr = card.getBoundingClientRect();
      // wait a frame so the card has its final rect
      requestAnimationFrame(function () {
        cr = card.getBoundingClientRect();
        var tx = (cr.left + cr.width / 2) - sr.left;
        var ty = (cr.top + cr.height / 2) - sr.top;
        // clamp target to stage box so the line stays tidy
        tx = Math.max(0, Math.min(tx, sr.width));
        ty = Math.max(0, Math.min(ty, sr.height));
        leaderLine.setAttribute("x1", sx);
        leaderLine.setAttribute("y1", sy);
        leaderLine.setAttribute("x2", tx);
        leaderLine.setAttribute("y2", ty);
        leader.classList.add("on");
      });
    }
  }

  var hotspots = Array.prototype.slice.call(document.querySelectorAll(".hotspot"));
  var isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);

  hotspots.forEach(function (hs) {
    hs.addEventListener("click", function (e) {
      e.stopPropagation();
      if (openHotspot === hs) { closeCallout(); } else { openCallout(hs); }
    });
    if (!isTouch) {
      hs.addEventListener("mouseenter", function () {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        openCallout(hs);
      });
      hs.addEventListener("mouseleave", function () {
        closeTimer = setTimeout(function () {
          if (openHotspot === hs) { closeCallout(); }
        }, 350);
      });
    }
    hs.addEventListener("focus", function () { openCallout(hs); });
  });

  // keep the callout open while the pointer is over it
  document.querySelectorAll(".callout").forEach(function (card) {
    card.addEventListener("mouseenter", function () {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    });
    card.addEventListener("mouseleave", function () {
      closeTimer = setTimeout(closeCallout, 250);
    });
  });

  document.addEventListener("click", function (e) {
    if (openHotspot && !e.target.closest(".callout") && !e.target.closest(".hotspot")) {
      closeCallout();
    }
  });

  // parts schedule rows focus their hotspot
  document.querySelectorAll(".bp-schedule tbody tr").forEach(function (tr) {
    tr.addEventListener("click", function () {
      var hs = $(tr.getAttribute("data-hs"));
      if (hs) { hs.focus(); openCallout(hs); }
    });
  });

  /* ---------- gallery + lightbox ---------- */

  var listings = MARKET && MARKET.listings ? MARKET.listings : [];
  var galleryGrid = $("galleryGrid");
  var lightbox = $("lightbox");
  var lbImg = $("lbImg");
  var lbCaption = $("lbCaption");
  var lbIndex = 0;

  function galleryCaption(l) {
    return esc(l.year) + " " + esc(l.title) + " · " + esc(l.price_text) + " · " + esc(l.location);
  }

  if (galleryGrid && listings.length) {
    var gHtml = listings.map(function (l, i) {
      return '<button class="g-item" data-idx="' + i + '" aria-label="View larger: ' + galleryCaption(l) + '">' +
        '<img src="' + esc(l.image) + '" alt="' + esc(l.year) + " " + esc(l.title) + " for sale in " + esc(l.location) + '" loading="lazy">' +
        '<span class="g-cap"><span>' + esc(l.year) + " · " + esc(l.mileage_text) + '</span><span class="g-price">' + esc(l.price_text) + "</span></span>" +
        "</button>";
    }).join("");
    galleryGrid.innerHTML = gHtml;

    galleryGrid.addEventListener("click", function (e) {
      var btn = e.target.closest(".g-item");
      if (!btn) { return; }
      openLightbox(parseInt(btn.getAttribute("data-idx"), 10) || 0);
    });
  }

  function openLightbox(i) {
    if (!lightbox || !listings.length) { return; }
    lbIndex = ((i % listings.length) + listings.length) % listings.length;
    var l = listings[lbIndex];
    lbImg.src = l.image;
    lbImg.alt = l.year + " " + l.title + " for sale in " + l.location;
    lbCaption.innerHTML = galleryCaption(l) +
      '<br><a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">View the advert ↗</a>';
    lightbox.hidden = false;
    $("lbClose").focus();
  }

  function closeLightbox() {
    if (lightbox) { lightbox.hidden = true; }
  }

  if (lightbox) {
    $("lbClose").addEventListener("click", closeLightbox);
    $("lbPrev").addEventListener("click", function () { openLightbox(lbIndex - 1); });
    $("lbNext").addEventListener("click", function () { openLightbox(lbIndex + 1); });
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) { closeLightbox(); }
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeLightbox();
      closeCallout();
      hidePop();
    }
    if (lightbox && !lightbox.hidden) {
      if (e.key === "ArrowLeft") { openLightbox(lbIndex - 1); }
      if (e.key === "ArrowRight") { openLightbox(lbIndex + 1); }
    }
  });

  /* ---------- FIFM: KPIs ---------- */

  function shortStamp(iso) {
    if (!iso) { return "—"; }
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return String(iso); }
    var hh = String(d.getHours());
    var mm = String(d.getMinutes());
    if (hh.length < 2) { hh = "0" + hh; }
    if (mm.length < 2) { mm = "0" + mm; }
    return d.getDate() + " " + MONTHS[d.getMonth()] + " · " + hh + ":" + mm;
  }

  var kpiBand = $("kpiBand");
  if (kpiBand && MARKET) {
    var kpis = [
      { val: fmtInt(MARKET.total_live), cap: "live now", blue: false },
      { val: fmtGBP(MARKET.floor_price), cap: "floor", blue: true },
      { val: fmtGBP(MARKET.ceiling_price), cap: "ceiling", blue: true },
      { val: fmtInt(MARKET.lowest_mileage) + " mi", cap: "lowest mileage", blue: false },
      { val: fmtInt(MARKET.days_tracked), cap: "days tracked", blue: false },
      { val: shortStamp(DATA ? DATA.generated_at : null), cap: "generated", blue: false }
    ];
    kpiBand.innerHTML = kpis.map(function (k) {
      return '<div class="kpi"><span class="kpi-val' + (k.blue ? " blue" : "") + '">' + k.val + '</span><span class="kpi-cap">' + k.cap + "</span></div>";
    }).join("");
  }

  var searchLabelEl = $("fifmSearchLabel");
  if (searchLabelEl && DATA) { searchLabelEl.textContent = DATA.search_label || ""; }
  var genStamp = $("genStamp");
  if (genStamp && DATA) { genStamp.textContent = fmtStamp(DATA.generated_at); }

  /* ---------- FIFM: trend chart ---------- */

  function drawTrend() {
    var cv = $("trendCanvas");
    if (!cv || !MARKET) { return; }
    // CSS keeps the canvas at width:100%; measure its own content width so the
    // bitmap never exceeds the panel (padding included) and ratchets the layout.
    var W = cv.clientWidth;
    if (W < 50) { return; } // panel hidden or unmeasured
    var H = 280;
    var dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.height = H + "px";
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var t = MARKET.trend || [];
    var note = $("chartNote");
    if (!t.length) {
      if (note) { note.hidden = false; note.textContent = "No trend data yet."; }
      return;
    }

    var padL = 64, padR = 20, padT = 16, padB = 42;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;

    var minP = Infinity, maxP = -Infinity, maxLive = 1;
    t.forEach(function (d) {
      if (typeof d.floor === "number") { minP = Math.min(minP, d.floor); }
      if (typeof d.ceiling === "number") { maxP = Math.max(maxP, d.ceiling); }
      if (typeof d.live === "number") { maxLive = Math.max(maxLive, d.live); }
    });
    if (!isFinite(minP) || !isFinite(maxP)) { minP = 0; maxP = 1; }
    var span = Math.max(maxP - minP, 1);
    minP -= span * 0.08;
    maxP += span * 0.08;

    function x(i) {
      return t.length === 1 ? padL + plotW / 2 : padL + plotW * i / (t.length - 1);
    }
    function y(p) {
      return padT + plotH * (1 - (p - minP) / (maxP - minP));
    }

    var mono = '11px ui-monospace, Menlo, monospace';

    // horizontal gridlines + £ labels
    ctx.font = mono;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    var steps = 4;
    for (var g = 0; g <= steps; g++) {
      var pv = minP + (maxP - minP) * g / steps;
      var gy = y(pv);
      ctx.strokeStyle = "rgba(201,204,209,0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(W - padR, gy);
      ctx.stroke();
      ctx.fillStyle = "#8f939a";
      ctx.fillText("£" + Math.round(pv / 100) / 10 + "k", padL - 8, gy);
    }

    // live-count bar underlay
    var barW = Math.min(38, plotW / t.length * 0.5);
    t.forEach(function (d, i) {
      if (typeof d.live !== "number") { return; }
      var bh = (d.live / maxLive) * plotH * 0.3;
      ctx.fillStyle = "rgba(201,204,209,0.13)";
      ctx.fillRect(x(i) - barW / 2, padT + plotH - bh, barW, bh);
      ctx.fillStyle = "rgba(201,204,209,0.55)";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(String(d.live), x(i), padT + plotH - bh - 3);
    });

    // date labels
    ctx.fillStyle = "#8f939a";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    var every = Math.max(1, Math.ceil(t.length / 8));
    t.forEach(function (d, i) {
      if (i % every !== 0 && i !== t.length - 1) { return; }
      var dd = new Date(d.date);
      var lbl = isNaN(dd.getTime()) ? String(d.date) : dd.getDate() + " " + MONTHS[dd.getMonth()];
      ctx.fillText(lbl, x(i), padT + plotH + 10);
    });

    // price series
    var series = [
      { key: "floor", colour: "#8f939a", r: 3 },
      { key: "ceiling", colour: "#c9ccd1", r: 3 },
      { key: "median", colour: "#4a80e8", r: 4 }
    ];
    series.forEach(function (s) {
      var pts = [];
      t.forEach(function (d, i) {
        if (typeof d[s.key] === "number") { pts.push([x(i), y(d[s.key])]); }
      });
      if (pts.length > 1) {
        ctx.strokeStyle = s.colour;
        ctx.lineWidth = s.key === "median" ? 2 : 1.25;
        ctx.beginPath();
        pts.forEach(function (p, i) {
          if (i === 0) { ctx.moveTo(p[0], p[1]); } else { ctx.lineTo(p[0], p[1]); }
        });
        ctx.stroke();
      }
      ctx.fillStyle = s.colour;
      pts.forEach(function (p) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], s.r, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // single-point annotation
    if (note) {
      if (t.length === 1) {
        note.hidden = false;
        note.textContent = "Day 1 of tracking — " + fmtDate(t[0].date) + ". The lines begin tomorrow.";
      } else {
        note.hidden = true;
      }
    }
  }

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    if (resizeTimer) { clearTimeout(resizeTimer); }
    resizeTimer = setTimeout(function () {
      var fifm = $("fifm");
      if (fifm && !fifm.hidden) { drawTrend(); }
    }, 150);
  });

  /* ---------- FIFM: ranked rows ---------- */

  function chipsHtml(l) {
    var out = "";
    (l.keyword_hits || []).forEach(function (h) {
      out += '<span class="chip">' + esc(h) + "</span>";
    });
    (l.keyword_flags || []).forEach(function (f) {
      out += '<span class="chip flag">' + esc(f) + "</span>";
    });
    return out;
  }

  var rowsEl = $("fifmRows");
  if (rowsEl && listings.length) {
    var rc = $("rankCount");
    if (rc) { rc.textContent = listings.length + " live · ranked by keeper score"; }

    rowsEl.innerHTML = listings.map(function (l, i) {
      var scoreCls = (typeof l.score === "number" && l.score < 0) ? "fr-score neg" : "fr-score";
      var scoreVal = (typeof l.score === "number") ? l.score : 0;
      return '<a class="fifm-row" data-idx="' + i + '" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="fr-rank">' + esc(l.rank) + "</span>" +
        '<img class="fr-thumb" src="' + esc(l.image) + '" alt="" loading="lazy">' +
        '<span class="fr-title">' +
          '<span class="t1"><span class="yr">' + esc(l.year) + "</span>" + esc(l.title) + "</span>" +
          '<span class="t2">' + esc(l.subtitle) + "</span>" +
          '<span class="fr-chips">' + chipsHtml(l) + "</span>" +
        "</span>" +
        '<span class="fr-price">' + esc(l.price_text) + "</span>" +
        '<span class="fr-miles">' + esc(l.mileage_text) + "</span>" +
        '<span class="fr-loc">' + esc(l.location) + "</span>" +
        '<span class="fr-seller">' + esc(String(l.seller_type || "").toUpperCase()) + "</span>" +
        '<span class="fr-days" title="Tracked lower bound · first seen ' + esc(fmtDate(l.first_seen)) + '">' + daysLabel(l.days_listed) + "</span>" +
        '<span class="' + scoreCls + '">★ ' + scoreVal + "</span>" +
        "</a>";
    }).join("");

    // pointer: click anywhere on the row opens the advert (anchor covers middle-click)
    // touch: first tap toggles the preview sheet; the preview carries the advert link
    rowsEl.addEventListener("click", function (e) {
      var row = e.target.closest(".fifm-row");
      if (!row) { return; }
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) { return; }
      var l = listings[parseInt(row.getAttribute("data-idx"), 10)];
      if (!l) { return; }
      if (isTouch) {
        e.preventDefault();
        if (popRow === row && pop && !pop.hidden) { hidePop(); }
        else { showPop(row, l, true); }
        return;
      }
      e.preventDefault();
      if (l.url) { window.open(l.url, "_blank", "noopener"); }
    });
  }

  /* ---------- FIFM: quick-preview popover ---------- */

  var pop = $("fifmPop");

  function sparklineSvg(hist) {
    var w = 268, h = 44, pad = 8;
    if (!hist || !hist.length) { return ""; }
    if (hist.length === 1) {
      return '<svg viewBox="0 0 ' + w + " " + h + '" aria-hidden="true">' +
        '<line x1="' + pad + '" y1="' + (h / 2) + '" x2="' + (w - pad) + '" y2="' + (h / 2) + '" stroke="rgba(201,204,209,0.2)" stroke-dasharray="3 4"/>' +
        '<circle cx="' + (w / 2) + '" cy="' + (h / 2) + '" r="3.5" fill="#4a80e8"/>' +
        '<text x="' + (w / 2 + 10) + '" y="' + (h / 2 + 4) + '" font-family="ui-monospace,Menlo,monospace" font-size="10" fill="#8f939a">' + esc(fmtGBP(hist[0].price)) + " · day 1</text>" +
        "</svg>";
    }
    var min = Infinity, max = -Infinity;
    hist.forEach(function (p) { min = Math.min(min, p.price); max = Math.max(max, p.price); });
    var span = Math.max(max - min, 1);
    var pts = hist.map(function (p, i) {
      var px = pad + (w - pad * 2) * i / (hist.length - 1);
      var py = pad + (h - pad * 2) * (1 - (p.price - min) / span);
      return px.toFixed(1) + "," + py.toFixed(1);
    }).join(" ");
    return '<svg viewBox="0 0 ' + w + " " + h + '" aria-hidden="true">' +
      '<polyline points="' + pts + '" fill="none" stroke="#4a80e8" stroke-width="1.5"/>' +
      "</svg>";
  }

  var popRow = null;

  function showPop(row, l, touch) {
    if (!pop) { return; }
    var grab = (l.attention_grabber !== null && l.attention_grabber !== undefined && String(l.attention_grabber).length)
      ? '<div class="pop-grab">' + esc(l.attention_grabber) + "</div>" : "";
    // on touch the pop is the only way to reach the advert, so carry a link
    var link = touch
      ? '<a class="pop-cta" href="' + esc(l.url) + '" target="_blank" rel="noopener">View the advert &rarr;</a>'
      : "";
    pop.innerHTML =
      '<img src="' + esc(l.image) + '" alt="">' +
      '<div class="pop-body">' +
        '<div class="pop-title">' + esc(l.year) + " " + esc(l.title) + " · " + esc(l.price_text) + "</div>" +
        grab +
        '<div class="pop-chips">' + chipsHtml(l) + "</div>" +
        '<div class="pop-spark">' + sparklineSvg(l.price_history) + "</div>" +
        '<div class="pop-meta">first seen ' + esc(fmtDate(l.first_seen)) + " · " + esc(l.mileage_text) + " · " + esc(l.seller_type) + "</div>" +
        link +
      "</div>";
    pop.hidden = false;
    popRow = row;
    pop.classList.toggle("pop-touch", !!touch);

    if (touch) {
      // centred sheet, positioned by CSS — clear any prior inline coords
      pop.style.left = "";
      pop.style.top = "";
      return;
    }

    var r = row.getBoundingClientRect();
    var pw = 300;
    var ph = pop.offsetHeight || 320;
    var vx = window.innerWidth;
    var vy = window.innerHeight;
    var left = r.right + 14;
    if (left + pw > vx - 10) { left = r.left - pw - 14; }
    if (left < 10) { left = Math.max(10, vx - pw - 10); }
    var top = r.top + r.height / 2 - ph / 2;
    top = Math.max(10, Math.min(top, vy - ph - 10));
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }

  function hidePop() {
    if (pop) { pop.hidden = true; pop.classList.remove("pop-touch"); }
    popRow = null;
  }

  if (rowsEl && pop && !isTouch) {
    rowsEl.addEventListener("mouseover", function (e) {
      var row = e.target.closest(".fifm-row");
      if (!row) { return; }
      var l = listings[parseInt(row.getAttribute("data-idx"), 10)];
      if (l) { showPop(row, l); }
    });
    rowsEl.addEventListener("mouseout", function (e) {
      var row = e.target.closest(".fifm-row");
      if (row && !row.contains(e.relatedTarget)) { hidePop(); }
    });
    rowsEl.addEventListener("focusin", function (e) {
      var row = e.target.closest(".fifm-row");
      if (!row) { return; }
      var l = listings[parseInt(row.getAttribute("data-idx"), 10)];
      if (l) { showPop(row, l); }
    });
    rowsEl.addEventListener("focusout", function (e) {
      if (!e.relatedTarget || !e.relatedTarget.closest(".fifm-row")) { hidePop(); }
    });
    window.addEventListener("scroll", hidePop, { passive: true });
  }

  // touch: tap outside the pop (and outside a row) closes it
  if (isTouch && pop) {
    document.addEventListener("click", function (e) {
      if (pop.hidden) { return; }
      if (e.target.closest("#fifmPop") || e.target.closest(".fifm-row")) { return; }
      hidePop();
    });
  }

  /* ---------- FIFM: gone from market ---------- */

  var goneEl = $("goneRows");
  if (goneEl && MARKET) {
    var gone = MARKET.gone || [];
    if (!gone.length) {
      goneEl.innerHTML = '<div class="gone-empty">Nothing has left the market since tracking began — day 1.</div>';
    } else {
      goneEl.innerHTML = gone.map(function (l) {
        return '<div class="gone-row">' +
          '<img class="fr-thumb" src="' + esc(l.image) + '" alt="" loading="lazy">' +
          '<span class="fr-title">' +
            '<span class="t1"><span class="yr">' + esc(l.year) + "</span>" + esc(l.title) + "</span>" +
            '<span class="gone-meta">removed ' + esc(fmtDate(l.removed_date)) + " · " + fmtInt(l.days_on_market) + " days on market · " + esc(l.location) + "</span>" +
          "</span>" +
          '<span class="fr-price">' + esc(l.price_text) + "</span>" +
        "</div>";
      }).join("");
    }
  }

  /* ---------- FIFM capstone: the one for you + daily one-pager ---------- */

  function townOf(l) {
    return String(l.location || "").replace(/\s*\(.*?\)\s*$/, "");
  }

  // "why it wins" line, built from the winner's keyword hits (with a couple of
  // friendly rewrites) plus its keeper-flag standing
  function whyItWins(l) {
    var map = {
      "wingbacks": "Recaro wingbacks",
      "bucket seats": "bucket seats",
      "recaro": "Recaro seats",
      "flat bottom": "flat-bottomed wheel",
      "sports seat": "sports seats"
    };
    var reasons = [];
    (l.keyword_hits || []).forEach(function (h) {
      var r = map[h] || h;
      if (reasons.indexOf(r) === -1) { reasons.push(r); }
    });
    if (l.paint && (l.paint.name === "Sprint Blue" || l.paint.name === "Misano Red")) {
      reasons.push("the poster " + l.paint.name.toLowerCase() + " spec");
    }
    if (!(l.keyword_flags && l.keyword_flags.length)) {
      reasons.push("lowest keeper-flags");
    }
    if (!reasons.length) { reasons.push("cleanest history on the board today"); }
    return reasons.slice(0, 4).join(" · ");
  }

  function pickTopCar() {
    if (!listings.length) { return null; }
    if (DATA && DATA.top_pick_id) {
      var byId = listings.filter(function (l) { return l.advert_id === DATA.top_pick_id; })[0];
      if (byId) { return byId; }
    }
    return listings[0];
  }

  var heroPick = $("heroPick");
  if (heroPick) {
    var top = pickTopCar();
    if (!top) {
      heroPick.innerHTML = '<div class="cap-empty">No live car to recommend today — the board is empty. Check back after the 08:45 refresh.</div>';
    } else {
      var picHero = (top.images_hires && top.images_hires.length) ? top.images_hires[0] : top.image;
      var scoreVal = (typeof top.score === "number") ? top.score : 0;
      heroPick.innerHTML =
        '<div class="hp-photo">' +
          '<img src="' + esc(picHero) + '" alt="' + esc(top.year) + " Audi RS4 B7 in " + esc(top.paint ? top.paint.name : "") + ", the top recommended car, for sale in " + esc(townOf(top)) + '">' +
          '<span class="hp-badge">RANK ' + esc(top.rank) + " · ★ " + scoreVal + "</span>" +
        "</div>" +
        '<div class="hp-body">' +
          '<p class="kicker">Pick of the market this morning</p>' +
          '<h3 class="hp-title"><span class="yr">' + esc(top.year) + "</span> " + esc(top.title) + " " + esc(top.subtitle) + "</h3>" +
          '<p class="hp-price">' + esc(top.price_text) + "</p>" +
          '<p class="hp-why"><span class="hp-why-lab">Why it wins</span>' + esc(whyItWins(top)) + "</p>" +
          '<p class="hp-meta mono">' + esc(top.mileage_text) + " · " + esc(townOf(top)) + " · " + esc(String(top.seller_type || "")) + "</p>" +
          '<a class="hp-cta" href="' + esc(top.url) + '" target="_blank" rel="noopener">View the advert &rarr;</a>' +
        "</div>";
    }
  }

  var onePager = $("onePager");
  if (onePager) {
    var report = DATA ? DATA.report : null;
    if (report && report.pdf) {
      var previewHtml = report.preview
        ? '<img src="' + esc(report.preview) + '" alt="Preview of today’s RS4 B7 daily market one-pager">'
        : '<div class="op-noprev mono">PDF ready · no preview image</div>';
      onePager.innerHTML =
        '<p class="kicker">Your daily one-pager</p>' +
        '<div class="op-paper">' + previewHtml + "</div>" +
        '<div class="op-body">' +
          '<a class="op-cta" href="' + esc(report.pdf) + '" download>Download today’s report (PDF) &darr;</a>' +
          '<p class="op-updated mono">Updated ' + esc(fmtDate(report.updated)) + "</p>" +
          '<p class="op-note">Generated every morning at 08:45 and delivered to WhatsApp.</p>' +
        "</div>";
    } else {
      onePager.innerHTML =
        '<p class="kicker">Your daily one-pager</p>' +
        '<div class="op-placeholder">' +
          '<p class="op-ph-title mono">Today’s report is being generated</p>' +
          '<p class="op-ph-line">Check back after 08:45.</p>' +
        "</div>";
    }
  }

  /* ---------- hero: hi-res selection ---------- */

  function pickHeroListing() {
    var best = null;
    listings.forEach(function (l) {
      if (l.paint && l.paint.name === "Sprint Blue" && l.images_hires && l.images_hires.length) {
        if (!best || (l.score || 0) > (best.score || 0)) { best = l; }
      }
    });
    if (!best) {
      listings.forEach(function (l) { if (l.rank === 1) { best = l; } });
    }
    return best || listings[0] || null;
  }

  var heroImg = $("heroImg");
  if (heroImg && listings.length) {
    var heroL = pickHeroListing();
    if (heroL && heroL.images_hires && heroL.images_hires.length) {
      var heroSrcs = heroL.images_hires.concat([heroL.image]);
      var heroIdx = 0;
      heroImg.addEventListener("error", function () {
        heroIdx += 1;
        if (heroIdx < heroSrcs.length) { heroImg.src = heroSrcs[heroIdx]; }
      });
      heroImg.src = heroSrcs[0];
      var paintName = heroL.paint ? heroL.paint.name : "";
      heroImg.alt = "A " + (paintName ? paintName + " " : "") + "Audi RS4 B7 saloon, hi-res advert photograph, front three-quarter view";
      var heroCredit = $("heroCredit");
      if (heroCredit) {
        heroCredit.textContent = (paintName || "RS4") + " saloon · a live advert this morning, " + townOf(heroL);
      }
    }
  }

  /* ---------- paint toggle ---------- */

  var CLASSIC_PAINTS = [
    { name: "Misano Red", hex: "#b01526" },
    { name: "Phantom Black", hex: "#0b0d10" },
    { name: "Avus Silver", hex: "#c9ccd1" }
  ];

  function paintGroup(name) {
    var n = name.toLowerCase();
    if (n.indexOf("blue") !== -1) { return 0; }
    if (n.indexOf("red") !== -1) { return 1; }
    if (n.indexOf("black") !== -1) { return 2; }
    if (n.indexOf("silver") !== -1 || n.indexOf("grey") !== -1 || n.indexOf("gray") !== -1) { return 3; }
    return 4;
  }

  function buildPaintList() {
    var byName = {};
    var order = [];
    listings.forEach(function (l) {
      if (!l.paint || !l.paint.name) { return; }
      if (!byName[l.paint.name]) {
        byName[l.paint.name] = { name: l.paint.name, hex: l.paint.hex, live: 0 };
        order.push(byName[l.paint.name]);
      }
      byName[l.paint.name].live += 1;
    });
    // classic catalogue colours with no live car — skip any whose final word
    // ("Red" / "Black" / "Silver") already appears in a live paint name
    CLASSIC_PAINTS.forEach(function (c) {
      var lastWord = c.name.split(" ").pop().toLowerCase();
      var clash = order.some(function (p) {
        return p.name.toLowerCase().split(" ").indexOf(lastWord) !== -1;
      });
      if (!clash && !byName[c.name]) {
        byName[c.name] = { name: c.name, hex: c.hex, live: 0 };
        order.push(byName[c.name]);
      }
    });
    order.sort(function (a, b) {
      var g = paintGroup(a.name) - paintGroup(b.name);
      if (g !== 0) { return g; }
      return b.live - a.live; // livelier colours first within a group
    });
    return order;
  }

  function photosForPaint(name) {
    var cars = listings.filter(function (l) {
      return l.paint && l.paint.name === name && l.images_hires && l.images_hires.length;
    });
    cars.sort(function (a, b) { return (a.rank || 99) - (b.rank || 99); });
    var out = [];
    if (!cars.length) { return out; }
    if (cars.length >= 3) {
      cars.slice(0, 3).forEach(function (c) {
        out.push({ src: c.images_hires[0], l: c, angle: 0 });
      });
    } else {
      var i = 0;
      while (out.length < 3) {
        var c = cars[i % cars.length];
        var angle = Math.floor(out.length / cars.length);
        if (!c.images_hires[angle]) { break; }
        out.push({ src: c.images_hires[angle], l: c, angle: angle });
        i += 1;
      }
    }
    return out;
  }

  function figureHtml(p, paintName) {
    var town = townOf(p.l);
    var cap = "Live advert: " + esc(p.l.mileage_text) + ", " + esc(town) + "." +
      (p.angle > 0 ? " Another angle of the same car." : "");
    return "<figure>" +
      '<img src="' + esc(p.src) + '" alt="' + esc(p.l.year) + " Audi RS4 B7 in " + esc(paintName) + ", for sale in " + esc(town) + '" loading="lazy">' +
      "<figcaption>" + cap + "</figcaption>" +
      "</figure>";
  }

  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var figuresEl = $("designFigures");
  var paintChipsEl = $("paintChips");
  var paintCaptionEl = $("paintCaption");
  var currentPaint = { name: "Sprint Blue", hex: "#1757c2" };

  function setPaintVar(hex) {
    document.documentElement.style.setProperty("--paint", hex);
  }

  function swapFigures(paint) {
    if (!figuresEl) { return; }
    var photos = photosForPaint(paint.name);
    if (!photos.length) { return; } // catalogue colour — keep current photos
    var html = photos.map(function (p) { return figureHtml(p, paint.name); }).join("");
    if (reducedMotion) {
      figuresEl.innerHTML = html;
      return;
    }
    figuresEl.classList.add("swapping");
    setTimeout(function () {
      figuresEl.innerHTML = html;
      requestAnimationFrame(function () { figuresEl.classList.remove("swapping"); });
    }, 400);
  }

  function paintCaption(paint) {
    if (!paintCaptionEl) { return; }
    if (paint.live > 0) {
      paintCaptionEl.textContent = paint.live + " live car" + (paint.live === 1 ? "" : "s") + " in " + paint.name + " today";
    } else {
      paintCaptionEl.textContent = "No live example today — showing catalogue colour";
    }
  }

  function selectPaint(paint, instant) {
    currentPaint = paint;
    setPaintVar(paint.hex);
    paintCaption(paint);
    if (paintChipsEl) {
      Array.prototype.slice.call(paintChipsEl.querySelectorAll(".paint-chip")).forEach(function (b) {
        var on = b.getAttribute("data-name") === paint.name;
        b.setAttribute("aria-checked", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
      });
    }
    if (instant && figuresEl) {
      var photos = photosForPaint(paint.name);
      if (photos.length) {
        figuresEl.innerHTML = photos.map(function (p) { return figureHtml(p, paint.name); }).join("");
      }
    } else {
      swapFigures(paint);
    }
    applyPaintToModel(paint.hex);
  }

  var PAINTS = buildPaintList();

  if (paintChipsEl && PAINTS.length) {
    paintChipsEl.innerHTML = PAINTS.map(function (p) {
      return '<button class="paint-chip" role="radio" aria-checked="false" tabindex="-1"' +
        ' data-name="' + esc(p.name) + '" data-hex="' + esc(p.hex) + '"' +
        ' style="--c:' + esc(p.hex) + '">' +
        '<span class="pc-dot" aria-hidden="true"></span>' +
        '<span class="pc-name">' + esc(p.name) + "</span>" +
        "</button>";
    }).join("");

    paintChipsEl.addEventListener("click", function (e) {
      var btn = e.target.closest(".paint-chip");
      if (!btn) { return; }
      var p = PAINTS.filter(function (x) { return x.name === btn.getAttribute("data-name"); })[0];
      if (p) { selectPaint(p, false); btn.focus(); }
    });

    // radiogroup arrow-key behaviour: focus moves and selects
    paintChipsEl.addEventListener("keydown", function (e) {
      var keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
      if (keys.indexOf(e.key) === -1) { return; }
      e.preventDefault();
      var chips = Array.prototype.slice.call(paintChipsEl.querySelectorAll(".paint-chip"));
      var idx = chips.indexOf(document.activeElement);
      if (idx === -1) { idx = 0; }
      var fwd = (e.key === "ArrowRight" || e.key === "ArrowDown");
      var next = (idx + (fwd ? 1 : -1) + chips.length) % chips.length;
      var p = PAINTS.filter(function (x) { return x.name === chips[next].getAttribute("data-name"); })[0];
      if (p) { selectPaint(p, false); }
      chips[next].focus();
    });

    var defaultPaint = PAINTS.filter(function (p) { return p.name === "Sprint Blue"; })[0] || PAINTS[0];
    selectPaint(defaultPaint, true);
  }

  /* ---------- 360° viewer ---------- */

  var modelViewer = $("rs4Model");
  var studioFallback = $("studioFallback");
  var modelReady = false;

  function hexToRGBA(hex) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
    var n = parseInt(h, 16);
    if (isNaN(n)) { return [1, 1, 1, 1]; }
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
  }

  // best-effort count of primitives associated with a material: model-viewer
  // keeps them in a Symbol-keyed Set (correlatedObjects); fall back to 0
  function primCount(mat) {
    try {
      var syms = Object.getOwnPropertySymbols(mat);
      for (var i = 0; i < syms.length; i++) {
        var v = mat[syms[i]];
        if (v && typeof v.size === "number") { return v.size; }
      }
    } catch (err) { /* internal shape changed — fine */ }
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
        var candidates = mats.filter(function (m) { return !exclRe.test(m.name || ""); });
        if (candidates.length) {
          candidates.sort(function (a, b) { return primCount(b) - primCount(a); });
          targets = [candidates[0]];
        }
      }
      var rgba = hexToRGBA(hex);
      targets.forEach(function (m) {
        var pbr = m.pbrMetallicRoughness;
        if (!pbr) { return; }
        pbr.setBaseColorFactor(rgba);
        if (typeof pbr.setMetallicFactor === "function") { pbr.setMetallicFactor(0.8); }
        if (typeof pbr.setRoughnessFactor === "function") { pbr.setRoughnessFactor(0.35); }
      });
    } catch (err) { /* keep the viewer alive even if the material API shifts */ }
  }

  // graceful degradation: the fallback panel is visible by default and only
  // hides when the model genuinely loads. This covers all three failure
  // modes — module blocked (file://), element never defined, GLB 404 —
  // without needing to distinguish them.
  if (modelViewer) {
    modelViewer.addEventListener("load", function () {
      modelReady = true;
      if (studioFallback) { studioFallback.hidden = true; }
      applyPaintToModel(currentPaint.hex);
    });
    modelViewer.addEventListener("error", function () {
      modelReady = false;
      if (studioFallback) { studioFallback.hidden = false; }
    });
  }

  var creditEl = $("modelCredit");
  if (creditEl && typeof window.RS4_MODEL_CREDIT === "string") {
    creditEl.textContent = window.RS4_MODEL_CREDIT;
  }

  /* ---------- boot ---------- */

  activateTab(currentHashTab(), false);

})();
