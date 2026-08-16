/* ============================================================
   site.js — all shared behaviour
   Pages declare what they are with data attributes; everything
   else is rendered from catalogue.js.
   ============================================================ */
(function () {
  "use strict";
  var FM = window.FM || {};

  /* Which template is running. A stale template is the single most common
     cause of "I changed it and nothing happened" -- the export copies these
     files from StudioFlow, so the app can be up to date while the copied
     template is months old. Printed to the console on every page and shown
     in the design panel. */
  var TEMPLATE_VERSION = 32;
  window.FMTemplateVersion = TEMPLATE_VERSION;
  try { console.info("Frozen Moments site template v" + TEMPLATE_VERSION); } catch (e) {}
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var money = function (n) { return "$" + Number(n).toFixed(2).replace(/\.00$/, ""); };

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  /* Parameter names are matched CASE-INSENSITIVELY. A QR code encodes uppercase
     roughly 40% more densely than mixed case, so a printed label may well carry
     ?H=…&ID=…  — and a label screwed to a hotel wall cannot be corrected later.
     A miss here would silently drop the venue attribution and cost a hotel its
     commission, so this is deliberately forgiving. */
  function param(name) {
    var qs = window.__FMQ != null ? window.__FMQ : location.search;
    var want = String(name).toLowerCase();
    var found = null;
    new URLSearchParams(qs).forEach(function (value, key) {
      if (found === null && String(key).toLowerCase() === want) found = value;
    });
    return found;
  }
  function go(href) {
    if (window.__FMGO) window.__FMGO(href); else location.href = href;
  }
  /* Sizes arrive off a printed label and out of a database typed by hand:
     "24 x 36", "24X36", "24 × 36" are one size. Fold before comparing. */
  function sameSize(a, b) {
    var f = function (v) {
      return String(v == null ? "" : v).toLowerCase()
        .replace(/[\u00d7\u2715]/g, "x").replace(/\s+/g, "").trim();
    };
    return f(a) === f(b) && f(a) !== "";
  }

  function sameId(a, b) {
    return String(a == null ? "" : a).trim().toLowerCase() ===
           String(b == null ? "" : b).trim().toLowerCase();
  }
  function artById(id) { return (FM.artworks || []).filter(function (a) { return sameId(a.id, id); })[0]; }
  function mediumById(id) { return (FM.mediums || []).filter(function (m) { return m.id === id; })[0]; }
  function galleryById(id) { return (FM.galleries || []).filter(function (g) { return sameId(g.id, id); })[0]; }
  function serviceById(id) { return (FM.services || []).filter(function (s) { return sameId(s.id, id); })[0]; }
  function artFor(gid) { return (FM.artworks || []).filter(function (a) { return a.gallery === gid; }); }
  function areaOf(size) {
    var p = String(size).toLowerCase().split(/\s*[x×]\s*/);
    return (parseFloat(p[0]) || 0) * (parseFloat(p[1]) || 0);
  }
  function dims(size) {
    var p = String(size).toLowerCase().split(/\s*[x×]\s*/);
    return { a: parseFloat(p[0]) || 0, b: parseFloat(p[1]) || 0 };
  }
  function editionLine(a) {
    var low = (FM.editionLowAt == null ? 8 : FM.editionLowAt);
    var e = a.edition || {};
    if (e.remaining === 0) return "Edition closed";
    if (e.remaining > 0 && e.remaining < low) return "Only " + e.remaining + " of " + e.size + " left";
    return "Limited edition of " + e.size;
  }

  function lowestPrice(a) {
    return (a.variants || []).reduce(function (m, v) { return m == null || v.price < m ? v.price : m; }, null);
  }

  /* ============================================================
     THEME
     Applied before anything renders. Every value in FM.theme maps to a
     CSS custom property the stylesheet already reads, so a theme change
     is a data change -- no stylesheet edit, no rebuild.
     ============================================================ */
  /* Google Fonts are fetched once per family, whether a theme or a section asked. */
  var fontsLoaded = {};
  function loadFonts(list) {
    (list || []).filter(Boolean).forEach(function (f) {
      var key = f.toLowerCase();
      if (fontsLoaded[key]) return;
      fontsLoaded[key] = true;
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=" +
        f.replace(/ /g, "+") + ":wght@400;500;600&display=swap";
      document.head.appendChild(link);
    });
  }

  /* Section colours live in FM.sections and are applied as custom properties,
     so the design panel can change them live without a re-render. */
  function applySections() {
    var sec = FM.sections || {};
    var about = document.querySelector(".about-section");
    if (about) {
      var ab = sec.about || {};
      about.style.setProperty("--ab-bg", ab.background || "");
      about.style.setProperty("--ab-fg", ab.colour || "");
      about.style.setProperty("--ab-eyebrow", ab.eyebrowColour || "");
      about.style.setProperty("--ab-heading-font", ab.headingFont ? '"' + ab.headingFont + '", Georgia, serif' : "");
      about.style.setProperty("--ab-heading-size", ab.headingSize || "");
      about.style.setProperty("--ab-body-font", ab.bodyFont ? '"' + ab.bodyFont + '", system-ui, sans-serif' : "");
      about.style.setProperty("--ab-body-size", ab.bodySize || "");
      loadFonts([ab.headingFont, ab.bodyFont]);
    }
    var band = document.querySelector(".feature-band");
    if (band) {
      var si = sec.seeIt || {};
      band.style.setProperty("--fb-bg", si.background || "");
      band.style.setProperty("--fb-fg", si.colour || "");
      band.style.setProperty("--fb-eyebrow", si.eyebrowColour || "");
      if (si.headingFont) band.style.setProperty("--fb-heading-font", '"' + si.headingFont + '", Georgia, serif');
      if (si.headingSize) band.style.setProperty("--fb-heading-size", si.headingSize);
      if (si.bodyFont) band.style.setProperty("--fb-body-font", '"' + si.bodyFont + '", system-ui, sans-serif');
      if (si.bodySize) band.style.setProperty("--fb-body-size", si.bodySize);
      loadFonts([si.headingFont, si.bodyFont]);
    }
    /* any other section that wants a colour can be named here */
    (sec.blocks || []).forEach(function (b) {
      var el2 = document.querySelector(b.selector);
      if (!el2) return;
      if (b.background) el2.style.background = b.background;
      if (b.colour) el2.style.color = b.colour;
    });
  }

  function applyTheme() {
    var t = FM.theme;
    if (!t) return;
    var root = document.documentElement.style;
    var map = {
      ink: "--ink", inkSoft: "--ink-soft", paper: "--paper", paper2: "--paper-2",
      line: "--line", accent: "--accent", radius: "--radius", fmBlue: "--fm-blue"
    };
    Object.keys(map).forEach(function (k) { if (t[k]) root.setProperty(map[k], t[k]); });
    if (t.headingFont) root.setProperty("--font-display", '"' + t.headingFont + '", Georgia, serif');
    if (t.bodyFont) root.setProperty("--font-body", '"' + t.bodyFont + '", system-ui, sans-serif');

    loadFonts([t.headingFont, t.bodyFont]);
    document.body.classList.toggle("theme-dark-header", t.header === "dark");
  }

  /* ============================================================
     IMAGE PROTECTION
     A deterrent, not a lock. It stops the casual save -- right-click,
     drag-to-desktop, long-press on a phone -- which is most of what
     actually happens. Anyone determined can still get the file, and
     no amount of code changes that (see the notes in the README).
     Studio mode turns it off so you can work normally on your own site.
     ============================================================ */
  function protectImages() {
    var cfg = FM.security || {};
    var on = cfg.protectImages !== false && !Studio.on();
    document.body.classList.toggle("protect-images", on);
    if (!on || document.body.dataset.protected) return;
    document.body.dataset.protected = "1";

    document.addEventListener("contextmenu", function (e) {
      if (Studio.on()) return;
      if (e.target.closest("img, .work-img, .art-card, .mount, .stage-art, .room-stage, .svc-shot, .gallery-banner, .split-card, .hub-img, .pk-img")) {
        e.preventDefault();
        toast(cfg.message || "These photographs are copyright " + ((FM.brand || {}).name || "") +
          ". Get in touch if you'd like to use one.");
      }
    });
    document.addEventListener("dragstart", function (e) {
      if (!Studio.on() && e.target.tagName === "IMG") e.preventDefault();
    });
  }

  var toastTimer = null;
  function toast(text) {
    var box = document.getElementById("fm-toast");
    if (!box) {
      box = document.createElement("div");
      box.id = "fm-toast";
      document.body.appendChild(box);
    }
    box.textContent = text;
    box.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.classList.remove("on"); }, 3200);
  }

  /* ---------- studio mode ----------
     Room-render slots are empty until a render exists for that piece. A customer
     should never see an empty slot or an upload button; the owner needs to see
     both. ?studio=1 turns it on and it sticks, ?studio=0 turns it off. */
  var Studio = {
    on: function () {
      try {
        var q = new URLSearchParams(location.search).get("studio");
        if (q === "1") window.localStorage.setItem("fm-studio", "1");
        if (q === "0") window.localStorage.removeItem("fm-studio");
        return window.localStorage.getItem("fm-studio") === "1";
      } catch (e) { return false; }
    },
    rooms: function (id) {
      try { return JSON.parse(window.localStorage.getItem("fm-studio-rooms:" + id) || "[]"); }
      catch (e) { return []; }
    },
    addRoom: function (id, dataUrl) {
      try {
        var list = Studio.rooms(id);
        list.push(dataUrl);
        window.localStorage.setItem("fm-studio-rooms:" + id, JSON.stringify(list));
        return true;
      } catch (e) { return false; }
    },
    clearRooms: function (id) {
      try { window.localStorage.removeItem("fm-studio-rooms:" + id); } catch (e) {}
    }
  };
  window.FMStudio = Studio;

  /* ============================================================
     VENUE ATTRIBUTION
     A QR label on a hotel wall carries ?h=<venue-code>. Kirk pays that
     hotel 20% of anything sold off their walls, so the code has to
     survive the whole journey -- scan, browse four other pieces, cart,
     checkout -- and land on the order. A variable on the landing page
     is not enough; it is stored, with an expiry, and a later scan at a
     different property replaces it.
     ============================================================ */
  var VENUE_DAYS = 30;
  var Venue = {
    capture: function () {
      var code = param("h");
      if (!code) return Venue.current();
      var rec = { code: String(code).trim().toLowerCase(),
                  at: Date.now(),
                  until: Date.now() + VENUE_DAYS * 864e5 };
      try { window.localStorage.setItem("fm-venue", JSON.stringify(rec)); } catch (e) {}
      Venue.memory = rec;
      return rec;
    },
    current: function () {
      var rec = Venue.memory;
      if (!rec) {
        try { rec = JSON.parse(window.localStorage.getItem("fm-venue") || "null"); } catch (e) { rec = null; }
      }
      if (!rec || !rec.code) return null;
      if (rec.until && Date.now() > rec.until) {         /* stale attribution is worse than none */
        try { window.localStorage.removeItem("fm-venue"); } catch (e) {}
        Venue.memory = null;
        return null;
      }
      Venue.memory = rec;
      return rec;
    },
    code: function () { var r = Venue.current(); return r ? r.code : ""; },
    /* the code is a slug; the readable name only exists if the export sent one */
    name: function () {
      var c = Venue.code();
      if (!c) return "";
      var v = (FM.venues || []).filter(function (x) { return sameId(x.code, c); })[0];
      return v ? v.name : "";
    }
  };
  window.FMVenue = Venue;

  /* ---------- cart ---------- */
  var memoryCart = [];
  var Cart = {
    read: function () {
      try { var r = window.localStorage.getItem("fm-cart"); return r ? JSON.parse(r) : []; }
      catch (e) { return memoryCart; }
    },
    write: function (items) {
      memoryCart = items;
      try { window.localStorage.setItem("fm-cart", JSON.stringify(items)); } catch (e) {}
      Cart.paintCount();
    },
    add: function (i) { var it = Cart.read(); it.push(i); Cart.write(it); },
    removeAt: function (i) { var it = Cart.read(); it.splice(i, 1); Cart.write(it); },
    total: function () { return Cart.read().reduce(function (s, i) { return s + i.unit * i.qty; }, 0); },
    count: function () { return Cart.read().reduce(function (s, i) { return s + i.qty; }, 0); },
    paintCount: function () { $$(".cart-count").forEach(function (n) { n.textContent = Cart.count(); }); }
  };
  window.FMCart = Cart;

  /* ============================================================
     SHARED HEADER — built once, with real dropdown menus
     ============================================================ */
  function initHeader() {
    var hdr = $("#siteHeader");
    if (!hdr) return;
    var b = FM.brand || {};

    if (!hdr.dataset.built) {
      var galleryLinks = (FM.galleries || []).map(function (g) {
        return '<a href="gallery.html?id=' + g.id + '">' + g.name + "</a>";
      }).join("");
      var serviceLinks = (FM.services || []).map(function (s) {
        return '<a href="service.html?id=' + s.id + '">' + s.name + "</a>";
      }).join("");

      hdr.innerHTML =
        '<a class="brand" href="index.html">' +
          (b.logo ? '<img class="brand-logo" src="' + b.logo + '" alt="' + (b.name || "") + '">'
                  : '<span class="brand-mark">FM</span>') +
        "</a>" +
        '<button class="menu-toggle" aria-expanded="false" aria-label="Toggle menu">Menu</button>' +
        '<nav class="nav">' +
          '<a href="index.html#news">News</a>' +
          '<div class="drop"><button class="drop-toggle" aria-expanded="false">Fine Art Prints</button>' +
            '<div class="drop-menu">' + galleryLinks +
              '<a class="drop-all" href="galleries.html">All four collections</a>' +
            "</div></div>" +
          '<div class="drop"><button class="drop-toggle" aria-expanded="false">Services</button>' +
            '<div class="drop-menu">' + serviceLinks +
              '<a class="drop-all" href="services.html">All services</a>' +
            "</div></div>" +
          ((FM.downloads || []).length ? '<a href="tools.html">Free Tools</a>' : "") +
          ((FM.clientGalleries && FM.clientGalleries.showLink) ? '<a href="client.html">Client Gallery</a>' : "") +
          '<a href="index.html#about">About</a>' +
          '<a href="contact.html">Contact</a>' +
          '<a class="cart-pill in-nav" href="cart.html">Cart <b class="cart-count">0</b></a>' +
          '<a class="button button-small" href="contact.html">Get in touch</a>' +
        "</nav>" +
        '<a class="cart-pill on-bar" href="cart.html" aria-label="Cart">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6">' +
          '<path d="M4 5h2l2 10h9l2-7H7"/><circle cx="9" cy="19" r="1.2"/><circle cx="17" cy="19" r="1.2"/></svg>' +
          '<b class="cart-count">0</b></a>';
      hdr.dataset.built = "1";

      var toggle = $(".menu-toggle", hdr), nav = $(".nav", hdr);
      toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(open));
      });
      $$(".drop-toggle", hdr).forEach(function (t) {
        t.addEventListener("click", function (e) {
          e.stopPropagation();
          var d = t.parentNode, was = d.classList.contains("open");
          $$(".drop", hdr).forEach(function (o) { o.classList.remove("open"); });
          d.classList.toggle("open", !was);
          t.setAttribute("aria-expanded", String(!was));
        });
      });
      document.addEventListener("click", function () {
        $$(".drop", hdr).forEach(function (o) { o.classList.remove("open"); });
      });
      hdr.addEventListener("click", function (e) {
        if (e.target.closest("a")) nav.classList.remove("open");
      });
    }
    var wantsDark = FM.theme && FM.theme.header === "dark";
    var overHero = !(FM.theme && FM.theme.heroTransparent === false);
    hdr.classList.toggle("solid-dark", !!wantsDark);
    hdr.classList.toggle("on-dark", (overHero && document.body.dataset.dark === "1") ||
      (overHero && (($(".view.active") || {}).dataset || {}).dark === "1"));
    Cart.paintCount();
  }

  /* ============================================================
     HOME
     ============================================================ */
  function initHome() {
    var hero = $("#heroImg");
    if (!hero) return;
    var b = FM.brand || {};
    if (b.hero) hero.src = b.hero;
    hero.style.objectPosition = focusOf("home-hero", b.heroFocus);
    makeImageDraggable(hero, "home-hero");
    var portrait = $("#portraitImg");
    if (portrait) {
      if (b.portrait) portrait.src = b.portrait;
      else { var box = portrait.closest(".about-image"); if (box) box.hidden = true; }
    }
    if ($("#tagline")) $("#tagline").textContent = b.tagline || "";

    var news = $("#newsGrid");
    if (news && !news.dataset.done) {
      (FM.news || []).forEach(function (n) {
        var c = el("article", "news-card");
        c.innerHTML = '<img loading="lazy" src="' + n.image + '" alt="">' +
          '<div class="news-body"><p class="when">' + n.when + "</p><h3>" + n.title +
          "</h3><p>" + n.blurb + "</p></div>";
        news.appendChild(c);
      });
      if (!(FM.news || []).length) news.appendChild(el("p", "empty", "No shows on the calendar just now."));
      news.dataset.done = "1";
    }

    var strip = $("#galleryStrip");
    if (strip && !strip.dataset.done) {
      (FM.galleries || []).forEach(function (g) {
        var a = el("a", "gallery-card");
        a.href = "gallery.html?id=" + g.id;
        a.innerHTML = '<img loading="lazy" src="' + (g.cover || "") + '" alt="">' +
          "<span><b>" + g.name + "</b><small>" + (g.blurb || "") + "</small></span>";
        strip.appendChild(a);
      });
      strip.dataset.done = "1";
    }

    /* the two doors: shop, or hire */
    var cards = $("#splitCards");
    if (cards && !cards.dataset.done) {
      var defs = (b.cards) || {};
      var pair = [
        { key: "fineArt", href: "galleries.html", small: "Shop",
          headline: "Fine Art Prints Gallery",
          sub: "Paper, canvas and metal, sized and finished to order" },
        { key: "services", href: "services.html", small: "Hire",
          headline: "Photography Services",
          sub: "Weddings, portraits, real estate, product and events" }
      ];
      pair.forEach(function (c) {
        var d = defs[c.key] || {};
        var a = el("a", "split-card");
        a.href = d.href || c.href;
        a.innerHTML =
          (d.image ? '<img src="' + d.image + '" alt="">' : '<span class="split-blank"></span>') +
          "<span><small>" + (d.small || c.small) + "</small><b>" + (d.headline || c.headline) + "</b>" +
          "<em>" + (d.sub || c.sub) + "</em></span>";
        cards.appendChild(a);
      });
      cards.dataset.done = "1";
    }

    /* "See it. Size it." — image, wording and type all come from data */
    var band = $("#seeItBand");
    if (band) {
      var sec = (FM.sections || {}).seeIt || {};
      $("#seeItEyebrow").textContent = sec.eyebrow || "A more confident way to buy art";
      $("#seeItHeading").textContent = sec.heading || "See it. Size it. Make it yours.";
      $("#seeItBody").textContent = sec.body ||
        "Choose the material, the dimensions, and whether you want a mat or a floating frame. The price updates as you go, and you can see the finished piece against a wall before you order.";
      $("#seeItCta").textContent = sec.ctaLabel || "Start with an image";
      $("#seeItCta").href = sec.ctaHref || "galleries.html";
      $("#seeItImage").src = sec.image || "";
      $("#seeItImage").alt = sec.imageAlt || "";
      applySections();
    }

    applySections();

    var svc = $("#homeServices");
    if (svc && !svc.dataset.done) { paintServiceTiles(svc); svc.dataset.done = "1"; }

    var ca = $("#contactActions");
    if (ca && !ca.dataset.done) {
      if (b.email) ca.innerHTML += '<a class="button" href="mailto:' + b.email + '">' + b.email + "</a>";
      if (b.phone) ca.innerHTML += '<a class="button button-ghost" href="tel:' + b.phone.replace(/[^0-9+]/g, "") + '">' + b.phone + "</a>";
      if (b.instagram) ca.innerHTML += '<a class="button button-ghost" target="_blank" rel="noopener" href="' + b.instagram + '">Instagram</a>';
      ca.dataset.done = "1";
    }
  }

  /* ============================================================
     GALLERIES HUB — the four collections
     ============================================================ */
  function initGalleriesHub() {
    var wrap = $("#galleryHub");
    if (!wrap || wrap.dataset.done) return;
    (FM.galleries || []).forEach(function (g, i) {
      var count = artFor(g.id).length;
      var a = el("a", "hub-card");
      a.href = "gallery.html?id=" + g.id;
      a.style.setProperty("--accent", g.accent || "var(--accent)");
      a.innerHTML =
        '<div class="hub-img"><img loading="lazy" src="' + (g.cover || "") + '" alt=""></div>' +
        '<div class="hub-body">' +
          '<span class="hub-num">' + ("0" + (i + 1)) + "</span>" +
          "<h2>" + g.name + "</h2>" +
          "<p>" + (g.intro || g.blurb || "") + "</p>" +
          '<span class="hub-meta">' + count + (count === 1 ? " image" : " images") + " &middot; View collection &rarr;</span>" +
        "</div>";
      wrap.appendChild(a);
    });
    wrap.dataset.done = "1";
  }

  /* ============================================================
     ONE GALLERY — four different layouts
     ============================================================ */
  function initGallery() {
    var page = $("#galleryPage");
    if (!page) return;
    var g = galleryById(param("id")) || (FM.galleries || [])[0];
    if (!g) return;
    var list = artFor(g.id);

    page.style.setProperty("--accent", g.accent || "#2f5d62");
    page.dataset.layout = g.layout || "plates";
    $("#gTitle").textContent = g.name;
    $("#gIntro").textContent = g.intro || g.blurb || "";
    $("#gCount").textContent = list.length + (list.length === 1 ? " image" : " images");
    document.title = g.name + " — Frozen Moments Photography";

    var band = $("#gBand");
    if (band) {
      band.style.backgroundImage = "url(" + (g.cover || "") + ")";
      band.style.backgroundPosition = focusOf("gallery:" + g.id, g.focus);
      makeDraggable(band, "gallery:" + g.id);
    }

    var wrap = $("#gWorks");
    wrap.className = "works works-" + (g.layout || "plates");
    wrap.innerHTML = "";
    if (!list.length) { wrap.appendChild(el("p", "empty", "Nothing in this collection yet.")); }

    list.forEach(function (a, i) {
      var card = el("a", "work");
      card.href = "product.html?id=" + encodeURIComponent(a.id);
      card.innerHTML =
        '<div class="work-img"><img loading="lazy" src="' + (a.thumb || a.image) + '" alt="' + a.title + '"></div>' +
        '<div class="work-cap"><span class="work-no">' + ("0" + (i + 1)) + "</span>" +
        "<h3>" + a.title + "</h3>" +
        "<p>" + (a.blurb || "") + "</p>" +
        '<span class="work-price">From ' + money(lowestPrice(a)) + "</span>" +
        (a.limited && a.edition ? '<span class="work-edition">' + editionLine(a) + "</span>" : "") + "</div>";
      wrap.appendChild(card);
    });

    var others = $("#gOthers");
    if (others) {
      others.innerHTML = "";
      (FM.galleries || []).filter(function (o) { return o.id !== g.id; }).forEach(function (o) {
        var a = el("a", "other-card");
        a.href = "gallery.html?id=" + o.id;
        a.innerHTML = '<img loading="lazy" src="' + (o.cover || "") + '" alt=""><span>' + o.name + "</span>";
        others.appendChild(a);
      });
    }
  }

  /* ============================================================
     SERVICES — tiles with the name over the picture
     ============================================================ */
  function paintServiceTiles(wrap) {
    wrap.innerHTML = "";
    (FM.services || []).forEach(function (s) {
      var a = el("a", "svc-tile");
      a.href = "service.html?id=" + s.id;
      a.innerHTML =
        (s.image ? '<img loading="lazy" src="' + s.image + '" alt="">' : '<span class="svc-blank"></span>') +
        '<span class="svc-label"><b>' + (s.short || s.name) + "</b><em>" + (s.blurb || "") + "</em></span>";
      wrap.appendChild(a);
    });
  }
  function initServicesHub() {
    var wrap = $("#svcGrid");
    if (!wrap || wrap.dataset.done) return;
    paintServiceTiles(wrap);
    wrap.dataset.done = "1";
  }
  function initService() {
    var page = $("#servicePage");
    if (!page) return;
    var s = serviceById(param("id")) || (FM.services || [])[0];
    if (!s) return;

    document.title = s.name + " \u2014 Frozen Moments Photography";
    var hero = s.hero || {};
    var heroEl = $("#sHero");
    heroEl.style.backgroundImage = "url(" + (hero.image || s.image || "") + ")";
    /* A wide room shot needs the whole frame; a portrait can crop. Height is
       per service, and the focal point decides which part survives the crop. */
    heroEl.dataset.height = hero.height || "standard";
    heroEl.style.backgroundPosition = focusOf("service:" + s.id, hero.focus);
    makeDraggable(heroEl, "service:" + s.id);
    $("#sHeroInner").className = "s-hero-inner " + (hero.align === "bottom-left" ? "at-bottom" : "");
    $("#sTitle").textContent = hero.headline || s.name;
    $("#sBlurb").textContent = hero.sub || s.blurb || "";

    var acts = $("#sHeroActions");
    acts.innerHTML = "";
    if (hero.cta) {
      var a = el("a", "button");
      a.href = hero.cta.href || enquiryLink(s);
      a.textContent = hero.cta.label;
      acts.appendChild(a);
    }

    /* ---- blocks ---- */
    var host = $("#sBlocks");
    host.innerHTML = "";
    var blocks = blocksFor(s);
    blocks.forEach(function (b) { host.appendChild(renderBlock(b, s)); });

    var more = $("#sOthers");
    more.innerHTML = "";
    (FM.services || []).filter(function (o) { return o.id !== s.id; }).forEach(function (o) {
      var a2 = el("a", "other-card");
      a2.href = "service.html?id=" + o.id;
      a2.innerHTML = '<img loading="lazy" src="' + (o.image || "") + '" alt=""><span>' + (o.short || o.name) + "</span>";
      more.appendChild(a2);
    });
  }

  /* A price may arrive as a number from StudioFlow or as text written by hand
     ("From $1,725", "$95 / half hour"). Numbers get formatted; text is left alone. */
  function priceLabel(v) {
    if (v == null || v === "") return "";
    if (typeof v === "number") return "$" + v.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return String(v);
  }

  function enquiryLink(s, pkg) {
    return "contact.html?about=" + encodeURIComponent(s.name) +
      (pkg ? "&package=" + encodeURIComponent(pkg) : "");
  }

  /* Which blocks a service page shows.
     StudioFlow's export currently sends blocks:[{packages}] only, so anything
     else it wrote -- the gallery, the description -- would never appear if we
     simply took that list as final. Instead the list is COMPLETED: whatever it
     sent is kept in its order, and anything the service clearly has but has no
     block for is added. A service with no blocks at all still gets a page. */
  function blocksFor(s) {
    var given = Array.isArray(s.blocks) ? s.blocks.slice() : [];
    var has = function (type) {
      return given.some(function (b) { return b && b.type === type; });
    };

    /* description above the packages, if nothing already says it */
    if (s.detail && !has("text")) {
      given.unshift({ type: "text", body: s.detail });
    }
    /* the gallery he uploaded in StudioFlow */
    if ((s.gallery || []).length && !has("gallery")) {
      given.push({ type: "gallery", title: "Recent work",
                   heading: "A few from this kind of shoot." });
    }
    /* and a way to actually get in touch */
    if (!has("form")) {
      given.push({ type: "form", heading: "Tell me what you have in mind.",
                   body: "No obligation \u2014 I answer everything myself." });
    }
    return given;
  }

  function renderBlock(b, s) {
    var sec = el("section", "s-block s-" + b.type);

    if (b.type === "text") {
      sec.className += " section";
      sec.innerHTML =
        (b.heading ? "<h2>" + b.heading + "</h2>" : "") +
        (b.body ? '<p class="lead">' + b.body + "</p>" : "");
      if (b.cta) {
        var a = el("a", "button");
        a.href = b.cta.href || enquiryLink(s);
        a.textContent = b.cta.label || "Get started";
        sec.appendChild(a);
      }
      return sec;
    }

    /* packages: picture beside a centred name, price and inclusions */
    if (b.type === "packages") {
      sec.className += " section";
      sec.innerHTML = b.title ? '<div class="section-heading"><h2>' + b.title + "</h2>" +
        (b.intro ? "<p class=\"lead\">" + b.intro + "</p>" : "") + "</div>" : "";
      var list = el("div", "packages");
      (b.items || []).forEach(function (p) {
        var card = el("article", "package" + (p.image ? "" : " no-image") + (p.popular ? " is-popular" : ""));
        card.innerHTML =
          (p.image ? '<div class="pk-img"><img loading="lazy" src="' + p.image + '" alt=""></div>' : "") +
          '<div class="pk-body">' +
            (p.popular ? '<span class="pk-badge"><b>Most</b><i>Popular</i></span>' : "") +
            "<h3>" + p.name + "</h3>" +
            (p.price ? '<p class="pk-price">' + priceLabel(p.price) + "</p>" : "") +
            (p.blurb ? '<p class="pk-blurb">' + p.blurb + "</p>" : "") +
            ((p.bullets || []).length ? '<ul class="pk-list">' +
              p.bullets.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>" : "") +
          "</div>";
        var a = el("a", "button pk-cta");
        a.href = (p.cta && p.cta.href) || enquiryLink(s, p.name);
        a.textContent = (p.cta && p.cta.label) || "Book Now";
        card.querySelector(".pk-body").appendChild(a);
        list.appendChild(card);
      });
      sec.appendChild(list);
      return sec;
    }

    /* a plain list of extras and what they cost */
    if (b.type === "pricelist") {
      sec.className += " section";
      sec.innerHTML = (b.title ? "<h2>" + b.title + "</h2>" : "") +
        '<div class="pricelist">' + (b.rows || []).map(function (r) {
          return "<div><span>" + r.label + "</span><b>" + priceLabel(r.price) + "</b></div>";
        }).join("") + "</div>";
      return sec;
    }

    /* picture one side, words the other */
    if (b.type === "feature") {
      sec.className += " feature-split" + (b.align === "right" ? " flip" : "");
      sec.innerHTML =
        '<div class="fs-img"><img loading="lazy" src="' + (b.image || "") + '" alt=""></div>' +
        '<div class="fs-copy">' +
          (b.heading ? "<h2>" + b.heading + "</h2>" : "") +
          (b.body ? "<p>" + b.body + "</p>" : "") +
        "</div>";
      if (b.cta) {
        var a2 = el("a", "button");
        a2.href = b.cta.href || enquiryLink(s);
        a2.textContent = b.cta.label;
        sec.querySelector(".fs-copy").appendChild(a2);
      }
      return sec;
    }

    if (b.type === "gallery") {
      sec.className += " section";
      var shots = (b.images && b.images.length) ? b.images : (s.gallery || []);
      if (!shots.length) { sec.hidden = true; return sec; }
      sec.innerHTML = '<div class="section-heading"><p class="eyebrow dark">' +
        (b.title || "Recent work") + '</p><h2>' + (b.heading || "A few from this kind of shoot.") + "</h2></div>" +
        '<div class="svc-shots">' + shots.map(function (g) {
          var full = g.full || g.thumb || g, thumb = g.thumb || g.full || g;
          return '<a class="svc-shot" href="' + full + '" target="_blank" rel="noopener">' +
            '<img loading="lazy" src="' + thumb + '" alt=""></a>';
        }).join("") + "</div>";
      return sec;
    }

    if (b.type === "form") {
      sec.className += " contact-section";
      sec.innerHTML =
        '<p class="eyebrow">' + (b.eyebrow || "No obligation") + "</p>" +
        "<h2>" + (b.heading || "Tell me about it.") + "</h2>" +
        '<p class="contact-lead">' + (b.body || "") + "</p>";
      var wrap = el("div", "contact-actions");
      var a3 = el("a", "button");
      a3.href = b.href || enquiryLink(s);
      a3.textContent = b.label || "Start the conversation";
      wrap.appendChild(a3);
      sec.appendChild(wrap);
      return sec;
    }

    sec.hidden = true;
    return sec;
  }

  /* ============================================================
     FOCAL POINT
     A picture cropped into a wide box loses its top and bottom. Rather than
     guess, studio mode lets the picture be dragged inside the box and the
     position is remembered per image.
     ============================================================ */
  function focusOf(key, fallback) {
    try {
      var saved = window.localStorage.getItem("fm-focus:" + key);
      if (saved) return saved;
    } catch (e) {}
    return fallback || "center 50%";
  }

  function makeDraggable(node, key) {
    if (!node || node.dataset.dragKey === key) return;
    node.dataset.dragKey = key;
    if (node.dataset.dragWired) { refreshDragUI(node); return; }
    node.dataset.dragWired = "1";

    var drag = null;
    node.addEventListener("pointerdown", function (e) {
      if (!Studio.on()) return;
      if (e.target.closest("a, button")) return;
      var pos = (node.style.backgroundPosition || "50% 50%").split(/\s+/);
      drag = {
        x: parseFloat(pos[0]) || 50, y: parseFloat(pos[1]) || 50,
        sx: e.clientX, sy: e.clientY,
        w: node.clientWidth || 1, h: node.clientHeight || 1
      };
      node.setPointerCapture(e.pointerId);
      node.classList.add("dragging");
      e.preventDefault();
    });
    node.addEventListener("pointermove", function (e) {
      if (!drag) return;
      /* moving the pointer right should move the picture right, which means
         decreasing the background-position percentage */
      var nx = Math.max(0, Math.min(100, drag.x - ((e.clientX - drag.sx) / drag.w) * 100));
      var ny = Math.max(0, Math.min(100, drag.y - ((e.clientY - drag.sy) / drag.h) * 100));
      node.style.backgroundPosition = nx.toFixed(1) + "% " + ny.toFixed(1) + "%";
    });
    var end = function () {
      if (!drag) return;
      drag = null;
      node.classList.remove("dragging");
      try { window.localStorage.setItem("fm-focus:" + node.dataset.dragKey, node.style.backgroundPosition); } catch (e) {}
      toast("Position saved for this preview. Download overrides.js from the Design panel to keep it.");
    };
    node.addEventListener("pointerup", end);
    node.addEventListener("pointercancel", end);
    refreshDragUI(node);
  }

  /* Same idea for an <img> that is cropped by object-fit rather than a
     background. Kept separate because the property differs. */
  function makeImageDraggable(img, key) {
    if (!img || img.dataset.dragWired) { if (img) refreshDragUI(img); return; }
    img.dataset.dragWired = "1";
    img.dataset.dragKey = key;
    var drag = null;
    img.addEventListener("pointerdown", function (e) {
      if (!Studio.on()) return;
      var pos = (img.style.objectPosition || "50% 50%").split(/\s+/);
      drag = { x: parseFloat(pos[0]) || 50, y: parseFloat(pos[1]) || 50,
               sx: e.clientX, sy: e.clientY, w: img.clientWidth || 1, h: img.clientHeight || 1 };
      img.setPointerCapture(e.pointerId);
      img.classList.add("dragging");
      e.preventDefault();
    });
    img.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var nx = Math.max(0, Math.min(100, drag.x - ((e.clientX - drag.sx) / drag.w) * 100));
      var ny = Math.max(0, Math.min(100, drag.y - ((e.clientY - drag.sy) / drag.h) * 100));
      img.style.objectPosition = nx.toFixed(1) + "% " + ny.toFixed(1) + "%";
    });
    var end = function () {
      if (!drag) return;
      drag = null;
      img.classList.remove("dragging");
      try { window.localStorage.setItem("fm-focus:" + key, img.style.objectPosition); } catch (e) {}
      toast("Position saved for this preview. Download overrides.js from the Design panel to keep it.");
    };
    img.addEventListener("pointerup", end);
    img.addEventListener("pointercancel", end);
    refreshDragUI(img);
  }

  function refreshDragUI(node) {
    node.classList.toggle("can-drag", Studio.on());
  }

  /* ============================================================
     FREE TOOLS — apps given away, with a tip jar rather than a price
     ============================================================ */
  function initTools() {
    var wrap = $("#toolsList");
    if (!wrap || wrap.dataset.done) return;
    var tools = FM.downloads || [];
    var page = (FM.toolsPage || {});
    if (page.eyebrow) $("#toolsEyebrow").textContent = page.eyebrow;
    if (page.title) $("#toolsTitle").textContent = page.title;
    if (page.intro) $("#toolsIntro").textContent = page.intro;

    if (!tools.length) {
      wrap.innerHTML = '<div class="page-head wide"><p class="empty">Nothing here just yet.</p></div>';
      wrap.dataset.done = "1";
      return;
    }

    tools.forEach(function (t) {
      var sec = el("section", "tool");
      var links = (t.downloads || []).map(function (d) {
        return '<a class="button' + (d.primary ? "" : " button-ghost") + '" href="' + d.href + '"' +
          (d.newTab === false ? "" : ' target="_blank" rel="noopener"') + ">" + d.label + "</a>" +
          (d.note ? '<span class="dl-note">' + d.note + "</span>" : "");
      }).join("");

      sec.innerHTML =
        '<div class="tool-shot">' +
          (t.image ? '<img loading="lazy" src="' + t.image + '" alt="">' : '<span class="tool-blank"></span>') +
        "</div>" +
        '<div class="tool-copy">' +
          (t.kicker ? '<p class="eyebrow dark">' + t.kicker + "</p>" : "") +
          "<h2>" + t.name + "</h2>" +
          (t.tagline ? '<p class="lead">' + t.tagline + "</p>" : "") +
          (t.body ? "<p>" + t.body + "</p>" : "") +
          ((t.points || []).length ? "<ul class=\"tool-points\">" +
            t.points.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>" : "") +
          '<div class="tool-actions">' + links + "</div>" +
          (t.price ? '<p class="tool-price">' + t.price + "</p>" : "") +
          (t.supportUrl ? '<p class="tool-support"><a href="' + t.supportUrl +
            '" target="_blank" rel="noopener">' + (t.supportLabel || "Buy me a coffee") +
            " &rarr;</a>" + (t.supportNote ? '<span>' + t.supportNote + "</span>" : "") + "</p>" : "") +
        "</div>";
      wrap.appendChild(sec);
    });
    wrap.dataset.done = "1";
  }

  /* ============================================================
     /art — where a QR label lands
     ============================================================ */
  function initArt() {
    var page = $("#artProduct");
    if (!page) return;

    Venue.capture();
    var art = artById(param("id"));

    /* a sold-out edition is not a dead end: point at the open edition of the
       same picture if there is one, otherwise the collection, plus a waitlist */
    var closed = art && art.limited && art.edition && art.edition.remaining === 0;

    var bar = $("#venueBar");
    if (bar) {
      var name = Venue.name(), code = Venue.code();
      bar.hidden = !code;
      if (code) {
        bar.innerHTML = '<span>' + (name
          ? "You scanned this at <b>" + name + "</b>."
          : "Thanks for scanning.") +
          " Anything you order is credited to them.</span>";
      }
    }

    if (art && !closed) {
      $("#artFallback").hidden = true;
      page.hidden = false;
      return;                      /* initProduct renders it — same ?id= param */
    }

    /* fall back to something useful rather than a 404 */
    page.hidden = true;
    var fb = $("#artFallback");
    fb.hidden = false;

    if (closed) {
      var twin = art.openEditionId ? artById(art.openEditionId) : null;
      $("#artFallbackKicker").textContent = "Edition closed";
      $("#artFallbackTitle").textContent = art.title + " is sold out.";
      $("#artFallbackIntro").innerHTML =
        "All " + art.edition.size + " prints in this edition have gone, and it will not be reprinted. " +
        (twin
          ? 'The same photograph is available as an open edition &mdash; <a class="text-link" href="product.html?id=' +
            encodeURIComponent(twin.id) + '">see it here</a>.'
          : "") +
        ' <a class="text-link" href="contact.html?about=' + encodeURIComponent("A fine art print") +
        "&package=" + encodeURIComponent("Waitlist: " + art.title) +
        '">Join the waitlist</a> and I\'ll tell you when something similar is released.';
    } else if (param("id")) {
      $("#artFallbackKicker").textContent = "Fine Art Prints";
      $("#artFallbackTitle").textContent = "That piece isn't listed just now.";
      $("#artFallbackIntro").textContent =
        "It may have been retired or renamed. Here is everything currently available.";
    }
    initStore();                   /* fills #artGrid and the filters */
  }

  /* ============================================================
     CONTACT
     The form composes a complete email today. When the site is hosted and
     the server function exists, only the send step changes -- everything
     that gathers the enquiry stays exactly as it is.
     ============================================================ */
  function initContact() {
    var form = $("#contactForm");
    if (!form) return;
    var b = FM.brand || {};

    var direct = $("#contactDirect");
    if (direct && !direct.dataset.done) {
      var bits = [];
      if (b.email) bits.push('<a class="button" href="mailto:' + b.email + '">' + b.email + "</a>");
      if (b.phone) bits.push('<a class="button button-ghost" href="tel:' + b.phone.replace(/[^0-9+]/g, "") + '">' + b.phone + "</a>");
      if (b.instagram) bits.push('<a class="button button-ghost" target="_blank" rel="noopener" href="' + b.instagram + '">Instagram</a>');
      direct.innerHTML = bits.join("");
      direct.dataset.done = "1";
    }
    if ($("#contactLocation")) $("#contactLocation").textContent = b.location || "";

    var subject = $("#cSubject");
    if (subject && !subject.dataset.done) {
      var options = (FM.services || []).map(function (s2) { return s2.name; });
      options.push("A fine art print", "Something else");
      subject.innerHTML = options.map(function (o) { return "<option>" + o + "</option>"; }).join("");
      var pkg = param("package");
      var pre = param("about");
      if (pre) {
        var match = options.filter(function (o) { return o.toLowerCase().indexOf(pre.toLowerCase()) >= 0; })[0];
        if (match) subject.value = match;
      }
      if (pkg && !$("#cMessage").value) {
        $("#cMessage").value = "I'd like to book the " + pkg + ". ";
      }
      subject.dataset.done = "1";
      subject.addEventListener("change", dateRelevance);
    }
    function dateRelevance() {
      var v = String(subject.value || "").toLowerCase();
      $("#cDateRow").hidden = v.indexOf("print") >= 0;
    }
    dateRelevance();

    if (!form.dataset.wired) {
      $("#cSend").addEventListener("click", function () {
        var name = $("#cName").value.trim();
        var email = $("#cEmail").value.trim();
        var message = $("#cMessage").value.trim();
        if (!name || !email || !message) {
          $("#cNote").textContent = "Please add your name, your email and a note before sending.";
          $("#cNote").classList.add("warn");
          return;
        }
        var lines = [
          "Name: " + name,
          "Email: " + email,
          $("#cPhone").value.trim() ? "Phone: " + $("#cPhone").value.trim() : "",
          "About: " + subject.value,
          (!$("#cDateRow").hidden && $("#cDate").value) ? "Date: " + $("#cDate").value : "",
          $("#cWhere").value.trim() ? "Where: " + $("#cWhere").value.trim() : "",
          "", message
        ].filter(function (x) { return x !== ""; });

        var href = "mailto:" + (b.email || "") +
          "?subject=" + encodeURIComponent("Enquiry \u2014 " + subject.value + " \u2014 " + name) +
          "&body=" + encodeURIComponent(lines.join("\n"));
        window.location.href = href;
        $("#cNote").classList.remove("warn");
        $("#cNote").textContent = "Your email app should have opened with the enquiry ready to send.";
      });
      form.dataset.wired = "1";
    }
  }

  /* ============================================================
     STORE (everything, with filters) — still useful as "all work"
     ============================================================ */
  function initStore() {
    var grid = $("#artGrid");
    if (!grid) return;
    var bar = $("#filterBar");
    var current = param("gallery") || "all";

    function paint() {
      grid.innerHTML = "";
      var list = (FM.artworks || []).filter(function (a) { return current === "all" || a.gallery === current; });
      if (!list.length) grid.appendChild(el("p", "empty", "Nothing here yet."));
      list.forEach(function (a) {
        var c = el("a", "art-card");
        c.href = "product.html?id=" + encodeURIComponent(a.id);
        c.innerHTML = '<div class="frame"><img loading="lazy" alt="' + a.title + '" src="' + (a.thumb || a.image) + '"></div>' +
          "<h3>" + a.title + "</h3>" +
          '<p class="meta">' + (galleryById(a.gallery) || {}).name + " — from " + money(lowestPrice(a)) + "</p>" +
          ((a.rooms || []).length ? '<p class="card-rooms">' + a.rooms.length +
            " room view" + (a.rooms.length === 1 ? "" : "s") + "</p>" : "");
        grid.appendChild(c);
      });
      $$(".filter", bar).forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.gallery === current)); });
    }
    if (bar && !bar.dataset.done) {
      var mk = function (id, label) {
        var b = el("button", "filter", label);
        b.type = "button"; b.dataset.gallery = id;
        b.addEventListener("click", function () { current = id; paint(); });
        return b;
      };
      bar.appendChild(mk("all", "All work"));
      (FM.galleries || []).forEach(function (g) { bar.appendChild(mk(g.id, g.name)); });
      bar.dataset.done = "1";
    }
    paint();
  }

  /* ============================================================
     PRODUCT — configurator, true-scale mount, room views
     ============================================================ */
  function initProduct() {
    var root = $("#config");
    if (!root) return;
    var art = artById(param("id")) || (FM.artworks || [])[0];
    if (!art) return;

    /* real-world dimensions of the finishing, in inches */
    var MAT_IN = 2.5, BEVEL_IN = 0.14, FRAME_IN = 1.0, GAP_IN = 0.4, BARE_IN = 0.12;

    var state = { size: null, mediumId: null, addOns: {}, colours: {}, custom: {} };

    /* ---------- what the label said ----------
       A guest is standing in front of one finished piece. The label knows
       which one, so the page should arrive already set to it rather than
       asking them to rebuild it from memory two feet away.

       Every value is matched against the catalogue and DROPPED IF IT DOES NOT
       EXIST. Mediums get renamed and printed labels cannot be recalled, so a
       stale label must fall back to the ordinary unselected page -- never to
       "the first" or "the cheapest". Someone looking at a $900 framed canvas
       being quietly shown a $180 print is worse than someone choosing for
       themselves. */
    var preset = { applied: [], asked: false };
    (function readLabel() {
      var wantMedium = param("m"), wantSize = param("s"), wantFinish = param("f");
      preset.asked = !!(wantMedium || wantSize || wantFinish);
      if (!preset.asked) return;

      var variants = art.variants || [];

      if (wantMedium) {
        var med = mediumById(wantMedium);
        /* the medium must exist AND this piece must actually be made in it */
        if (med && variants.some(function (v) { return sameId(v.mediumId, wantMedium); })) {
          state.mediumId = med.id;
          preset.applied.push((med.name || med.id).toLowerCase());
        }
      }

      if (wantSize) {
        /* a size only counts if it exists IN THE CHOSEN MEDIUM -- a 9 x 13
           that is only made as a luster print is not a canvas option */
        var hit = variants.filter(function (v) {
          return sameSize(v.size, wantSize) &&
                 (!state.mediumId || sameId(v.mediumId, state.mediumId));
        })[0];
        if (hit) {
          state.size = hit.size;
          preset.applied.unshift(hit.size);
        }
      }

      /* f=frame:white,mat  — add-ons, each optionally with a colour */
      if (wantFinish && state.mediumId && state.size) {
        String(wantFinish).split(",").forEach(function (part) {
          var bits = part.split(":");
          var id = (bits[0] || "").trim(), colour = (bits[1] || "").trim();
          if (!id) return;
          var ao = (FM.addOns || []).filter(function (x) {
            return sameId(x.id, id) &&
                   (mediumById(state.mediumId).allows || []).indexOf(x.id) >= 0 &&
                   x.price && x.price[state.size] != null;
          })[0];
          if (!ao) return;                       /* unknown or not offered here */
          state.addOns[ao.id] = true;
          var label = ao.name.toLowerCase();
          if (colour) {
            var c = (ao.colours || []).filter(function (x) {
              return sameId(x.name.replace(/\s+/g, "-"), colour) || sameId(x.name, colour);
            })[0];
            if (c && !c.surcharge) {             /* never auto-request a custom colour */
              state.colours[ao.id] = c.name;
              label = c.name.toLowerCase() + " " + label;
            }
          }
          preset.applied.push(label);
        });
      }

      /* an add-on is meaningless without the piece it sits on */
      if (!state.mediumId) { state.addOns = {}; state.colours = {}; }
    })();

    /* A colour entry carrying a surcharge is a REQUEST, not a swatch -- the customer
       types the colour they want and it is confirmed before printing. */
    function swatchColours(ao) { return (ao.colours || []).filter(function (c) { return !c.surcharge; }); }
    function requestColour(ao) { return (ao.colours || []).filter(function (c) { return c.surcharge; })[0] || null; }

    var sizes = [];
    (art.variants || []).forEach(function (v) { if (sizes.indexOf(v.size) < 0) sizes.push(v.size); });
    sizes.sort(function (a, b) { return areaOf(a) - areaOf(b); });

    function mediumsForSize(s) { return (art.variants || []).filter(function (v) { return v.size === s; }); }
    function variant() {
      return (art.variants || []).filter(function (v) { return v.size === state.size && v.mediumId === state.mediumId; })[0];
    }
    function addOnsAvailable() {
      var m = mediumById(state.mediumId);
      if (!m) return [];
      return (FM.addOns || []).filter(function (ao) {
        return (m.allows || []).indexOf(ao.id) >= 0 && ao.price && ao.price[state.size] != null;
      });
    }
    function colourOf(ao) {
      var list = swatchColours(ao);
      var picked = state.colours[ao.id];
      return list.filter(function (c) { return c.name === picked; })[0] || list[0] || null;
    }
    function customOn(ao) { return !!(state.custom[ao.id] && requestColour(ao)); }
    function customText(ao) { return String((state.custom[ao.id] || {}).text || '').trim(); }
    function addOnCost() {
      return addOnsAvailable().reduce(function (s, ao) {
        if (!state.addOns[ao.id]) return s;
        var req = customOn(ao) ? requestColour(ao) : null;
        return s + ao.price[state.size] + ((req && req.surcharge) || 0);
      }, 0);
    }
    function unitPrice() { var v = variant(); return v ? v.price + addOnCost() : 0; }
    function printInches() {
      var d = state.size ? dims(state.size) : { a: 4, b: 5 };
      var long = Math.max(d.a, d.b), short = Math.min(d.a, d.b);
      return art.orientation === "portrait" ? { w: short, h: long } : { w: long, h: short };
    }

    /* ---------- the mount: everything drawn to the print's real scale ---------- */
    function paintMount() {
      var img = $("#stageImg"), mount = $("#mount");
      if (!img || !img.clientWidth) return;
      var inches = printInches();
      var ppi = img.clientWidth / inches.w;

      var matOn = !!state.addOns.mat, frameOn = !!state.addOns.frame;
      var matAo = (FM.addOns || []).filter(function (a) { return a.id === "mat"; })[0];
      var matCol = matOn && matAo ? colourOf(matAo) : null;
      var matCustom = matOn && matAo && customOn(matAo);
      var frameAo = (FM.addOns || []).filter(function (a) { return a.id === "frame"; })[0];
      var frameCol = frameOn && frameAo ? colourOf(frameAo) : null;

      var mat = $("#pfMat"), bevel = $("#pfBevel"), gap = $("#pfGap"), frame = $("#pfFrame");

      /* mat: a real mat sits on top of the print, with a bevel-cut window */
      mat.style.padding = (matOn ? MAT_IN * ppi : BARE_IN * ppi) + "px";
      mat.style.background = matCustom ? "#e9e5dc" : (matOn && matCol ? matCol.hex : "#ffffff");
      mat.classList.toggle("has-mat", matOn);

      /* the bevel is the exposed white core of the board — white even on a black mat */
      bevel.style.borderWidth = (matOn ? Math.max(1.5, BEVEL_IN * ppi) : 0) + "px";
      bevel.classList.toggle("on", matOn);

      /* floating frame: canvas sits inside the frame with a shadowed gap around it */
      gap.style.padding = (frameOn ? GAP_IN * ppi : 0) + "px";
      gap.classList.toggle("on", frameOn);
      frame.style.borderWidth = (frameOn ? FRAME_IN * ppi : 0) + "px";
      frame.style.borderColor = frameCol ? frameCol.hex : "#1c1c1c";
      frame.classList.toggle("on", frameOn);

      mount.classList.toggle("portrait", art.orientation === "portrait");

      var bits = [];
      if (state.size) bits.push(state.size + " inches");
      if (state.mediumId) bits.push((mediumById(state.mediumId) || {}).name);
      if (matOn) {
        bits.push(matCustom
          ? (customText(matAo) ? 'custom mat (' + customText(matAo) + ', to be confirmed)' : 'custom colour mat, to be confirmed')
          : ((matCol ? matCol.name.toLowerCase() : 'white') + ' mat'));
      }
      if (frameOn && frameCol) bits.push(frameCol.name.toLowerCase() + " floating frame");
      $("#mountCaption").textContent = bits.length ? bits.join(" · ") + " — shown to scale" : "";
    }

    /* ---------- room views ---------- */
    var studio = Studio.on();
    var exported = (art.rooms || []).slice();
    var previews = studio ? Studio.rooms(art.id) : [];
    var rooms = exported.concat(previews);
    var room = { index: 0, scale: 100 };

    function paintStrip() {
      var strip = $("#roomStrip");
      strip.innerHTML = "";
      rooms.forEach(function (src, i) {
        var b = el("button", "room-thumb");
        b.type = "button";
        b.style.backgroundImage = "url(" + src + ")";
        b.setAttribute("aria-label", "Room view " + (i + 1));
        b.setAttribute("aria-pressed", String(room.index === i));
        b.addEventListener("click", function () { room.index = i; paintRoom(); });
        strip.appendChild(b);
      });
      if (!rooms.length) strip.appendChild(el("p", "strip-empty", "No room views for this piece yet — add one, or place it yourself."));
    }

    function paintRoom() {
      var stage = $("#roomStage"), bg = $("#roomBg");
      if (!stage) return;
      var panel = $("#roomPanel"), slot = $("#roomSlot");

      /* Nothing to show and not the owner: the whole panel stays out of the page. */
      if (!rooms.length && !studio) { if (panel) panel.hidden = true; return; }
      if (panel) panel.hidden = false;

      /* Owner, no render yet: an empty slot with an upload, and nothing else. */
      if (!rooms.length && studio) {
        if (slot) {
          slot.hidden = false;
          slot.innerHTML =
            '<p><b>Room render slot</b></p>' +
            "<p>No render for " + art.title + " yet. Customers see nothing here until there is one.</p>" +
            '<label class="slot-upload">Upload a render<input type="file" id="slotUpload" accept="image/*" hidden></label>';
          slot.querySelector("#slotUpload").addEventListener("change", function (e) {
            var f = e.target.files && e.target.files[0];
            if (!f) return;
            var r = new FileReader();
            r.onload = function () {
              if (!Studio.addRoom(art.id, r.result)) {
                alert("That image was too large for a local preview. It will still work once the export writes it as a file \u2014 this preview store is limited.");
                return;
              }
              previews = Studio.rooms(art.id);
              rooms = exported.concat(previews);
              room.mode = "ai"; room.index = rooms.length - 1;
              paintRoom();
            };
            r.readAsDataURL(f);
          });
        }
        stage.hidden = true;
        $("#roomStrip").innerHTML = "";
        $("#roomSizeControls").hidden = true;
        $("#roomCaption").textContent = "";
        return;
      }
      if (slot) { slot.hidden = true; slot.innerHTML = ""; }
      stage.hidden = false;
      $("#roomSizeControls").hidden = false;
      $("#roomAdd").hidden = !studio;

      stage.style.maxWidth = room.scale + "%";
      $("#roomScaleOut").textContent = room.scale + "%";

      var i = Math.min(room.index, rooms.length - 1);
      bg.src = rooms[i];
      $("#roomHint").hidden = true;
      $("#roomCaption").textContent = (i >= exported.length)
        ? "Local preview only \u2014 this render lives in this browser. Put the file where the StudioFlow export can find it to publish it."
        : (art.title + " in a room.");
      paintStrip();
    }

    function initRoomOnce() {
      var stage = $("#roomStage");
      if (!stage || stage.dataset.done) return;
      stage.dataset.done = "1";

      $("#roomScale").addEventListener("input", function (e) {
        room.scale = parseInt(e.target.value, 10) || 100;
        paintRoom();
      });
      $("#roomUpload").addEventListener("change", function (e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function () {
          if (studio) {
            if (!Studio.addRoom(art.id, r.result)) { alert("That image was too large for a local preview."); return; }
            previews = Studio.rooms(art.id);
            rooms = exported.concat(previews);
          } else {
            rooms.push(r.result);
          }
          room.index = rooms.length - 1;
          paintRoom();
        };
        r.readAsDataURL(f);
      });
      var repaint = function () { paintMount(); };
      window.addEventListener("resize", repaint);
      window.addEventListener("orientationchange", function () { setTimeout(repaint, 250); });
      $("#stageImg").addEventListener("load", paintMount);
    }

    /* ---------- the choices ---------- */
    function paint() {
      var sizeBox = $("#sizeOpts");
      sizeBox.innerHTML = "";
      sizes.forEach(function (s) {
        var low = mediumsForSize(s).reduce(function (m, v) { return m == null || v.price < m ? v.price : m; }, null);
        var b = el("button", "opt", "<b>" + s + '</b><span class="price-hint">from ' + money(low) + "</span>");
        b.type = "button";
        b.setAttribute("aria-pressed", String(state.size === s));
        b.addEventListener("click", function () {
          state.size = s;
          if (!mediumsForSize(s).some(function (v) { return v.mediumId === state.mediumId; })) state.mediumId = null;
          state.addOns = {}; state.colours = {}; paint();
        });
        sizeBox.appendChild(b);
      });
      $("#sizeChosen").textContent = state.size || "";

      var medStep = $("#stepMedium"), medBox = $("#mediumOpts");
      medBox.innerHTML = "";
      medStep.hidden = !state.size;
      if (state.size) {
        mediumsForSize(state.size).sort(function (a, b) { return a.price - b.price; }).forEach(function (v) {
          var m = mediumById(v.mediumId) || { name: v.mediumId, blurb: "" };
          var b = el("button", "opt opt-wide", "<b>" + m.name + " · " + money(v.price) + "</b><small>" + (m.blurb || "") + "</small>");
          b.type = "button";
          b.setAttribute("aria-pressed", String(state.mediumId === v.mediumId));
          b.addEventListener("click", function () {
            state.mediumId = v.mediumId; state.addOns = {}; state.colours = {}; paint();
          });
          medBox.appendChild(b);
        });
      }
      $("#mediumChosen").textContent = state.mediumId ? (mediumById(state.mediumId) || {}).name : "";

      var addStep = $("#stepAddons"), addBox = $("#addonOpts");
      var avail = state.mediumId ? addOnsAvailable() : [];
      addBox.innerHTML = "";
      addStep.hidden = !avail.length;
      avail.forEach(function (ao) {
        var on = !!state.addOns[ao.id];
        var row = el("label", "addon");
        row.innerHTML = '<input type="checkbox"' + (on ? " checked" : "") + ">" +
          "<span><b>" + ao.name + "</b><small>" + ao.note + "</small></span>" +
          '<span class="cost">+ ' + money(ao.price[state.size]) + "</span>";
        row.querySelector("input").addEventListener("change", function (e) {
          state.addOns[ao.id] = e.target.checked;
          if (e.target.checked && ao.colours && !state.colours[ao.id]) state.colours[ao.id] = ao.colours[0].name;
          paint();
        });
        addBox.appendChild(row);

        if (ao.colours && ao.colours.length && on) {
          var list = swatchColours(ao), picked = colourOf(ao), req = requestColour(ao);
          if (list.length) {
            var sw = el("div", "swatches");
            list.forEach(function (c) {
              var b2 = el("button", "swatch");
              b2.type = "button"; b2.title = c.name; b2.style.background = c.hex;
              b2.setAttribute("aria-label", ao.name + ": " + c.name);
              b2.setAttribute("aria-pressed", String(!customOn(ao) && picked && picked.name === c.name));
              b2.addEventListener("click", function () {
                state.colours[ao.id] = c.name;
                state.custom[ao.id] = null;
                paint();
              });
              sw.appendChild(b2);
            });
            addBox.appendChild(sw);
            if (!customOn(ao) && picked) addBox.appendChild(el("p", "swatch-note", picked.name));
          }

          /* custom colour is a request, not a stocked option */
          if (req) {
            var wrap = el("div", "custom-colour" + (customOn(ao) ? " on" : ""));
            wrap.innerHTML =
              '<label class="custom-head"><input type="checkbox"' + (customOn(ao) ? " checked" : "") + ">" +
              "<span><b>Custom colour " + ao.name.toLowerCase() + "</b>" +
              "<small>" + (req.note || "Subject to availability.") + "</small></span>" +
              '<span class="cost">+ ' + money(req.surcharge) + "</span></label>" +
              (customOn(ao)
                ? '<input class="custom-input" type="text" placeholder="Which colour would you like?" value="' +
                  customText(ao).replace(/"/g, "&quot;") + '">'
                : "");
            wrap.querySelector('input[type=checkbox]').addEventListener("change", function (e) {
              state.custom[ao.id] = e.target.checked ? { text: customText(ao) } : null;
              paint();
            });
            var ci = wrap.querySelector(".custom-input");
            if (ci) {
              ci.addEventListener("input", function (e) {
                state.custom[ao.id] = { text: e.target.value };
                paintMount();
                var line = $("#customLine-" + ao.id);
                if (line) line.textContent = e.target.value.trim() ? "Custom colour: " + e.target.value.trim() : "Custom colour \u2014 to be confirmed";
              });
              ci.addEventListener("blur", paint);
            }
            addBox.appendChild(wrap);
          }
        }
      });

      var v = variant(), sum = $("#summaryLines");
      sum.innerHTML = "";
      if (v) {
        sum.appendChild(el("div", "line", "<span>" + (mediumById(v.mediumId) || {}).name + " · " + v.size + "</span><span>" + money(v.price) + "</span>"));
        addOnsAvailable().forEach(function (ao) {
          if (!state.addOns[ao.id]) return;
          var c = colourOf(ao), req = customOn(ao) ? requestColour(ao) : null;
          sum.appendChild(el("div", "line", "<span>" + ao.name + (!req && c ? " (" + c.name + ")" : "") + "</span><span>" + money(ao.price[state.size]) + "</span>"));
          if (req) {
            var row = el("div", "line");
            row.innerHTML = '<span id="customLine-' + ao.id + '">' +
              (customText(ao) ? "Custom colour: " + customText(ao) : "Custom colour \u2014 to be confirmed") +
              "</span><span>" + money(req.surcharge) + "</span>";
            sum.appendChild(row);
          }
        });
      }
      $("#totalPrice").textContent = v ? money(unitPrice()) : "—";
      $("#addBtn").disabled = !v;
      $("#addBtn").textContent = v ? "Add to cart" : "Choose a size and material";

      paintMount();
      paintRoom();
    }

    $("#artTitle").textContent = art.title;
    $("#artId").textContent = art.id;
    $("#artBlurb").textContent = art.blurb || "";
    var fromLabel = $("#artFromLabel");
    if (fromLabel) {
      fromLabel.hidden = !preset.applied.length;
      if (preset.applied.length) {
        fromLabel.textContent = "Set up as the piece you scanned \u2014 " +
          preset.applied.join(", ") + ". Change anything you like.";
      } else if (preset.asked) {
        /* the label asked for something the catalogue no longer has */
        fromLabel.hidden = false;
        fromLabel.textContent = "Choose a size and finish below.";
      }
    }
    var ed = $("#artEdition");
    if (ed) {
      ed.hidden = !(art.limited && art.edition);
      if (art.limited && art.edition) {
        /* Kirk's rule: a count only helps once it is low. "22 of 25 left"
           reads as unwanted, so above the threshold say only the run size. */
        var low = (FM.editionLowAt == null ? 8 : FM.editionLowAt);
        var e = art.edition;
        ed.textContent = e.remaining > 0 && e.remaining < low
          ? "Limited edition of " + e.size + " \u2014 only " + e.remaining +
            " left. Once the edition closes it is not reprinted."
          : "Limited edition of " + e.size + ". Once the edition closes it is not reprinted.";
        ed.classList.toggle("urgent", e.remaining > 0 && e.remaining < low);
      }
    }
    $("#stageImg").src = art.image;
    $("#stageImg").alt = art.title;
    $("#artGalleryLink").textContent = (galleryById(art.gallery) || {}).name || "";
    $("#artGalleryLink").href = "gallery.html?id=" + art.gallery;
    document.title = art.title + " — Frozen Moments Photography";

    if (!root.dataset.wired) {
      $("#addBtn").addEventListener("click", function () {
        var v = variant();
        if (!v) return;
        var chosen = [];
        addOnsAvailable().forEach(function (ao) {
          if (!state.addOns[ao.id]) return;
          var c = colourOf(ao), req = customOn(ao) ? requestColour(ao) : null;
          chosen.push({
            id: ao.id, name: ao.name,
            price: ao.price[state.size] + ((req && req.surcharge) || 0),
            colour: req ? ("Custom: " + (customText(ao) || "colour to be confirmed")) : (c ? c.name : null),
            custom: !!req, request: req ? customText(ao) : ""
          });
        });
        Cart.add({
          artId: art.id, title: art.title, image: art.image, size: state.size,
          mediumId: state.mediumId, mediumName: (mediumById(state.mediumId) || {}).name,
          addOns: chosen, unit: unitPrice(), qty: 1,
          sku: v.sku || null, sqVariantId: v.sqVariantId || null,
          venue: Venue.code() || null
        });
        go("cart.html");
      });
      root.dataset.wired = "1";
    }
    initRoomOnce();
    paint();
    setTimeout(paintMount, 60);
  }

  /* ============================================================
     CART
     ============================================================ */
  function initCart() {
    var list = $("#cartList");
    if (!list) return;
    function paint() {
      var items = Cart.read();
      list.innerHTML = "";
      if (!items.length) {
        list.appendChild(el("p", "empty", 'Your cart is empty. <a class="text-link" href="galleries.html">Browse the collections</a>'));
        $("#cartFoot").hidden = true;
        return;
      }
      $("#cartFoot").hidden = false;
      items.forEach(function (it, i) {
        var extras = it.addOns.map(function (a) { return a.name + (a.colour ? " (" + a.colour + ")" : ""); }).join(", ");
        var row = el("div", "cart-row");
        row.innerHTML = '<img src="' + it.image + '" alt="">' +
          "<div><b>" + it.title + "</b><div class=\"spec\">" + it.mediumName + " · " + it.size +
          (extras ? " · " + extras : "") + "</div></div>" +
          '<div style="text-align:right"><div>' + money(it.unit * it.qty) + "</div></div>";
        var rm = el("button", "remove", "Remove");
        rm.type = "button";
        rm.addEventListener("click", function () { Cart.removeAt(i); paint(); });
        row.lastChild.appendChild(rm);
        list.appendChild(row);
      });
      $("#cartTotal").textContent = money(Cart.total());
      var vcode = Venue.code(), vname = Venue.name();
      var note = $("#cartVenue");
      if (note) {
        note.hidden = !vcode;
        if (vcode) note.textContent = "Credited to " + (vname || vcode) + ".";
      }
    }
    if (!list.dataset.wired) {
      $("#checkoutBtn").addEventListener("click", function () {
        /* The venue rides with the order. When the real checkout exists this is
           what goes into the payment metadata; the server must read it from here
           and not trust anything else the browser sends about price. */
        var payload = { items: Cart.read(), venue: Venue.code() || null };
        if (window.FMCheckout) { window.FMCheckout(payload); return; }
        window.open((FM.brand || {}).squarespaceStore || "#", "_blank", "noopener");
      });
      list.dataset.wired = "1";
    }
    paint();
  }

  window.FMInit = function () {
    applyTheme();
    applySections();
    protectImages();
    if (window.FMDesignSync) window.FMDesignSync();
    initHeader(); initHome(); initGalleriesHub(); initGallery();
    initServicesHub(); initService(); initTools(); initArt(); initContact(); initStore(); initProduct(); initCart();
  };
  document.addEventListener("DOMContentLoaded", window.FMInit);
})();
