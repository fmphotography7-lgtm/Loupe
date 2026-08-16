/* ============================================================
   client-gallery.js
   ------------------------------------------------------------
   WHAT "PASSWORD PROTECTED" MEANS HERE, honestly:

   A static site has no server to check a password against, so the
   usual approach -- compare a typed string to one sitting in the
   JavaScript -- is theatre. Anyone can read the script.

   This does something real instead. The list of photographs in a
   gallery is ENCRYPTED (AES-GCM, key stretched from the passphrase
   with PBKDF2). Without the passphrase you cannot learn the
   filenames, and the files themselves live under an unguessable
   random folder name. Getting in without the passphrase means
   guessing a 256-bit key or a 128-bit folder name.

   What it still cannot do: stop a client who HAS the passphrase
   from passing it on. Nothing client-side can. If that matters for
   a particular job, the gallery needs the server function -- the
   same one the checkout will use.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var el = function (t, c, h) {
    var n = document.createElement(t);
    if (c) n.className = c;
    if (h != null) n.innerHTML = h;
    return n;
  };

  var state = { token: null, manifest: null, index: 0 };

  function param(name) {
    var want = String(name).toLowerCase(), found = null;
    new URLSearchParams(location.search).forEach(function (v, k) {
      if (found === null && String(k).toLowerCase() === want) found = v;
    });
    return found;
  }

  /* ---------- crypto ---------- */
  function b64ToBytes(b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function unlock(passphrase, blob) {
    var enc = new TextEncoder();
    var salt = b64ToBytes(blob.salt);
    var iv = b64ToBytes(blob.iv);
    var data = b64ToBytes(blob.data);

    var base = await crypto.subtle.importKey(
      "raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    var key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: blob.iterations || 250000, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);

    /* A wrong passphrase fails the GCM tag check and throws — there is no
       "compare the password" step to skip past. */
    var plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data);
    return JSON.parse(new TextDecoder().decode(plain));
  }

  /* remembering an opened gallery, so a client is not retyping it all week */
  function remember(token, manifest) {
    try {
      window.sessionStorage.setItem("fm-cg:" + token, JSON.stringify({
        manifest: manifest, until: Date.now() + 12 * 3600e3
      }));
    } catch (e) {}
  }
  function recall(token) {
    try {
      var rec = JSON.parse(window.sessionStorage.getItem("fm-cg:" + token) || "null");
      if (!rec || Date.now() > rec.until) return null;
      return rec.manifest;
    } catch (e) { return null; }
  }
  function forget(token) {
    try { window.sessionStorage.removeItem("fm-cg:" + token); } catch (e) {}
  }

  /* ---------- rendering ---------- */
  function show(which) {
    ["#clientGate", "#clientMissing", "#clientGallery"].forEach(function (sel) {
      var n = $(sel);
      if (n) n.hidden = sel !== which;
    });
  }

  function paint(m) {
    state.manifest = m;
    $("#cgTitle").textContent = m.title || "Your gallery";
    $("#cgIntro").textContent = m.intro || "";
    if (m.kicker) $("#cgKicker").textContent = m.kicker;

    var bits = [];
    bits.push(m.images.length + (m.images.length === 1 ? " photograph" : " photographs"));
    if (m.shotOn) bits.push(m.shotOn);
    if (m.expires) bits.push("available until " + m.expires);
    $("#cgMeta").textContent = bits.join(" \u00b7 ");

    $("#cgNote").textContent = m.note ||
      "Download whatever you like \u2014 these are yours. The full-size files are best for printing; " +
      "the smaller ones suit email and social media.";

    var grid = $("#cgGrid");
    grid.innerHTML = "";
    m.images.forEach(function (img, i) {
      var base = (m.path || "") + img.file;
      var card = el("figure", "cg-item");
      card.innerHTML =
        '<button class="cg-open" data-i="' + i + '">' +
          '<img loading="lazy" src="' + (m.path || "") + (img.thumb || img.file) + '" alt="">' +
        "</button>" +
        '<figcaption><span>' + (img.name || img.file) + "</span>" +
        '<a class="cg-dl" href="' + base + '" download>Download</a></figcaption>';
      grid.appendChild(card);
    });

    grid.querySelectorAll(".cg-open").forEach(function (b) {
      b.addEventListener("click", function () { openViewer(Number(b.dataset.i)); });
    });

    /* a client gallery is FOR downloading, so the site-wide right-click
       protection is deliberately switched off inside it */
    document.body.classList.remove("protect-images");

    show("#clientGallery");
  }

  /* ---------- viewer ---------- */
  function openViewer(i) {
    var m = state.manifest;
    if (!m || !m.images[i]) return;
    state.index = i;
    var img = m.images[i], base = (m.path || "") + img.file;
    $("#cgViewerImg").src = (m.path || "") + (img.large || img.file);
    $("#cgViewerCaption").textContent = (i + 1) + " of " + m.images.length +
      (img.name ? " \u00b7 " + img.name : "");
    $("#cgViewerDownload").href = base;
    $("#cgViewer").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function step(d) {
    var m = state.manifest;
    if (!m) return;
    openViewer((state.index + d + m.images.length) % m.images.length);
  }
  function closeViewer() {
    $("#cgViewer").hidden = true;
    document.body.style.overflow = "";
  }

  /* ---------- downloads ----------
     A browser will not hand over a folder, and zipping hundreds of full-size
     files in the page would exhaust memory on a phone. So "download all"
     triggers the files one at a time, spaced out, and says so plainly. */
  async function downloadAll() {
    var m = state.manifest;
    if (!m) return;
    var btn = $("#cgDownloadAll");
    btn.disabled = true;
    for (var i = 0; i < m.images.length; i++) {
      btn.textContent = "Downloading " + (i + 1) + " of " + m.images.length + "\u2026";
      var a = document.createElement("a");
      a.href = (m.path || "") + m.images[i].file;
      a.download = m.images[i].name || m.images[i].file;
      document.body.appendChild(a);
      a.click();
      a.remove();
      await new Promise(function (r) { setTimeout(r, 400); });
    }
    btn.textContent = "Download all";
    btn.disabled = false;
  }

  /* ---------- boot ---------- */
  async function start() {
    if (!$("#clientGate")) return;                 /* not this page */
    var token = param("g");
    state.token = token;

    if (!token) { show("#clientMissing"); return; }

    var cached = recall(token);
    if (cached) { paint(cached); return; }

    /* the encrypted manifest sits beside the gallery, named by its token */
    var blob = null;
    try {
      var res = await fetch("client-galleries/" + encodeURIComponent(token) + ".json", { cache: "no-store" });
      if (res.ok) blob = await res.json();
    } catch (e) {}

    if (!blob) {
      show("#clientGate");
      $("#gateTitle").textContent = "This gallery isn't here.";
      $("#gateIntro").textContent =
        "The link may have expired, or the gallery may have been taken down. Get in touch and I'll sort it out.";
      $("#gatePass").hidden = true;
      $("#gateGo").hidden = true;
      return;
    }

    if (blob.title) $("#gateTitle").textContent = blob.title;
    if (blob.hint) $("#gateIntro").textContent = blob.hint;
    show("#clientGate");
    $("#gatePass").focus();

    async function attempt() {
      var pass = $("#gatePass").value;
      if (!pass) return;
      var err = $("#gateError");
      err.hidden = true;
      $("#gateGo").disabled = true;
      $("#gateGo").textContent = "Opening\u2026";
      try {
        var manifest = await unlock(pass, blob);
        remember(token, manifest);
        paint(manifest);
      } catch (e) {
        err.hidden = false;
        err.textContent = "That passphrase doesn't open this gallery. Check for a stray space, and mind the capitals.";
        $("#gatePass").select();
      }
      $("#gateGo").disabled = false;
      $("#gateGo").textContent = "Open the gallery";
    }

    $("#gateGo").addEventListener("click", attempt);
    $("#gatePass").addEventListener("keydown", function (e) {
      if (e.key === "Enter") attempt();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    start();
    var v = $("#cgViewer");
    if (!v) return;
    $("#cgClose").addEventListener("click", closeViewer);
    $("#cgPrev").addEventListener("click", function () { step(-1); });
    $("#cgNext").addEventListener("click", function () { step(1); });
    v.addEventListener("click", function (e) { if (e.target === v) closeViewer(); });
    document.addEventListener("keydown", function (e) {
      if (v.hidden) return;
      if (e.key === "Escape") closeViewer();
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    });
    var dl = $("#cgDownloadAll");
    if (dl) dl.addEventListener("click", downloadAll);
    var lock = $("#cgLock");
    if (lock) lock.addEventListener("click", function () {
      forget(state.token);
      location.reload();
    });
  });
})();
