/* ============================================================
   design-panel.js — STUDIO MODE ONLY
   ------------------------------------------------------------
   A live editor for colour and type. It changes the page as you
   move the controls, then hands you the result two ways:

     Copy settings      — paste into StudioFlow's Theme card
     Download overrides — a file for the site folder that the
                          export can never overwrite

   Nothing here is loaded for visitors: the panel only builds
   itself when studio mode is on.
   ============================================================ */
(function () {
  "use strict";

  var PALETTES = [
    { name: "Frozen Moments Classic", ink: "#14171a", inkSoft: "#3d444b", paper: "#faf9f7", paper2: "#f0eeea", line: "#dcd8d1", accent: "#2f5d62" },
    { name: "Charcoal Studio",        ink: "#101214", inkSoft: "#4a5158", paper: "#f4f4f2", paper2: "#e7e7e4", line: "#d3d3cf", accent: "#3b6ea5" },
    { name: "Gallery White",          ink: "#1a1a1a", inkSoft: "#565656", paper: "#ffffff", paper2: "#f4f4f4", line: "#e2e2e2", accent: "#8a6a4a" },
    { name: "West Coast",             ink: "#16211f", inkSoft: "#3f524e", paper: "#f7f8f6", paper2: "#eaeee9", line: "#d6ded8", accent: "#4a7c59" },
    { name: "Deep Slate",             ink: "#0f1419", inkSoft: "#47535e", paper: "#f6f7f8", paper2: "#e9ecef", line: "#d5dade", accent: "#b98b4e" }
  ];

  var FONTS = [
    "Playfair Display", "DM Sans", "Lora", "Cormorant Garamond", "EB Garamond",
    "Libre Baskerville", "Montserrat", "Inter", "Work Sans", "Source Sans 3",
    "Oswald", "Bebas Neue", "Spectral", "Crimson Pro", "Karla", "Manrope"
  ];

  /* Every colour row offers these first, then a custom picker. Named so it is
     obvious what you are choosing, not just a row of unlabelled squares. */
  var PICKS = [
    { name: "White",        hex: "#ffffff" },
    { name: "Off white",    hex: "#faf9f7" },
    { name: "Light grey",   hex: "#f0eeea" },
    { name: "Mid grey",     hex: "#8a9099" },
    { name: "Soft white",   hex: "#e9e7e3" },
    { name: "Charcoal",     hex: "#22262b" },
    { name: "Near black",   hex: "#14171a" },
    { name: "Teal",         hex: "#2f5d62" },
    { name: "Moss",         hex: "#4a5d3a" },
    { name: "Brass",        hex: "#b98b4e" },
    { name: "Sand",         hex: "#8a6a4a" },
    { name: "Slate blue",   hex: "#3b6ea5" }
  ];

  var TEXT_SIZES = [
    { label: "Small",      value: "0.9rem" },
    { label: "Normal",     value: "1rem" },
    { label: "Large",      value: "1.2rem" },
    { label: "Extra large", value: "1.45rem" }
  ];
  var HEADING_SIZES = [
    { label: "Small",      value: "1.8rem" },
    { label: "Medium",     value: "2.6rem" },
    { label: "Large",      value: "3.4rem" },
    { label: "Extra large", value: "4.2rem" }
  ];

  var SWATCHES = [
    ["paper",   "Background",     "The page itself"],
    ["paper2",  "Panels",         "Alternating bands and cards"],
    ["ink",     "Text & dark",    "Body text, dark sections, the header when dark"],
    ["inkSoft", "Secondary text", "Descriptions and captions"],
    ["line",    "Borders",        "Hairlines and dividers"],
    ["accent",  "Accent",         "Buttons, links, small caps labels"]
  ];

  var SECTIONS = [
    { key: "about",  label: "About the artist",  hint: "The dark panel with your portrait" },
    { key: "seeIt",  label: "\u201cSee it. Size it.\u201d", hint: "The band above the services", type: true }
  ];

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function studioOn() {
    try { return window.localStorage.getItem("fm-studio") === "1"; } catch (e) { return false; }
  }
  function theme() { return (window.FM && window.FM.theme) || {}; }
  function sections() {
    window.FM.sections = window.FM.sections || {};
    return window.FM.sections;
  }
  function repaint() {
    if (window.FMInit) window.FMInit();
  }

  /* ---------- the file the export never touches ---------- */
  function overridesText() {
    var t = theme(), s = sections();
    var lines = [
      "/* overrides.js — written by the design panel on " + new Date().toLocaleString() + ".",
      "   The export never overwrites this file. Delete a line to fall back",
      "   to whatever StudioFlow exported. */",
      "",
      "FM.theme = Object.assign(FM.theme || {}, " + JSON.stringify({
        ink: t.ink, inkSoft: t.inkSoft, paper: t.paper, paper2: t.paper2,
        line: t.line, accent: t.accent, headingFont: t.headingFont,
        bodyFont: t.bodyFont, header: t.header, heroTransparent: t.heroTransparent
      }, null, 2) + ");",
      ""
    ];
    SECTIONS.forEach(function (sec) {
      var v = s[sec.key];
      if (!v) return;
      lines.push("FM.sections = FM.sections || {};");
      lines.push("FM.sections." + sec.key + " = Object.assign(FM.sections." + sec.key + " || {}, " +
        JSON.stringify(v, null, 2) + ");");
      lines.push("");
    });
    var heroes = (window.FM.services || []).map(function (svc) {
      var focus = "";
      try { focus = window.localStorage.getItem("fm-focus:service:" + svc.id) || ""; } catch (e) {}
      var h = svc.hero || {};
      if (!h.height && !focus) return null;
      return { id: svc.id, height: h.height || "standard", focus: focus || h.focus || "" };
    }).filter(Boolean);
    if (heroes.length) {
      lines.push("/* Hero box height and which part of the picture shows. */");
      lines.push("(" + JSON.stringify(heroes) + ").forEach(function(h){");
      lines.push("  var s = (FM.services||[]).filter(function(x){return x.id===h.id;})[0];");
      lines.push("  if (!s) return; s.hero = s.hero || {};");
      lines.push("  s.hero.height = h.height; if (h.focus) s.hero.focus = h.focus;");
      lines.push("});");
      lines.push("");
    }
    var homeFocus = "";
    try { homeFocus = window.localStorage.getItem("fm-focus:home-hero") || ""; } catch (e) {}
    if (homeFocus) {
      lines.push("FM.brand.heroFocus = " + JSON.stringify(homeFocus) + ";");
      lines.push("");
    }
    if (window.FM.customFonts && window.FM.customFonts.length) {
      lines.push("/* Put these font files in the site folder beside index.html. */");
      lines.push("FM.customFonts = " + JSON.stringify(window.FM.customFonts, null, 2) + ";");
      lines.push("");
    }
    return lines.join("\n");
  }

  function download(name, text) {
    var blob = new Blob([text], { type: "text/javascript" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- controls ---------- */
  /* A colour row: a clear label saying what it controls, the current value shown
     by name, a grid of named picks, and a custom picker for anything else. */
  function colourRow(label, hint, get, set) {
    var row = el("div", "dp-row");
    var head = el("div", "dp-row-head");
    head.innerHTML = "<b>" + label + "</b>" + (hint ? "<small>" + hint + "</small>" : "");
    var now = el("span", "dp-now");
    head.appendChild(now);
    row.appendChild(head);

    var grid = el("div", "dp-picks");
    var picker = el("input", "dp-custom");
    picker.type = "color";
    picker.title = "Any other colour";
    var clear = el("button", "dp-clear", "reset");
    clear.type = "button";

    function label_of(v) {
      if (!v) return "not set";
      var m = PICKS.filter(function (p) { return p.hex.toLowerCase() === String(v).toLowerCase(); })[0];
      return m ? m.name : v;
    }
    function refresh() {
      var v = get() || "";
      now.innerHTML = v ? '<i style="background:' + v + '"></i>' + label_of(v) : "not set";
      if (/^#[0-9a-f]{6}$/i.test(v)) picker.value = v;
      Array.prototype.forEach.call(grid.children, function (b) {
        b.setAttribute("aria-pressed", String((b.dataset.hex || "").toLowerCase() === String(v).toLowerCase()));
      });
    }
    function apply(v) { set(v); refresh(); repaint(); }

    PICKS.forEach(function (p) {
      var b = el("button", "dp-pick");
      b.type = "button";
      b.dataset.hex = p.hex;
      b.title = p.name;
      b.innerHTML = '<i style="background:' + p.hex + '"></i><span>' + p.name + "</span>";
      b.addEventListener("click", function () { apply(p.hex); });
      grid.appendChild(b);
    });
    picker.addEventListener("input", function () { apply(picker.value); });
    clear.addEventListener("click", function () { apply(""); });

    row.appendChild(grid);
    var foot = el("div", "dp-custom-row");
    foot.appendChild(el("span", "dp-custom-label", "Any other colour"));
    foot.appendChild(picker);
    foot.appendChild(clear);
    row.appendChild(foot);

    refresh();
    return row;
  }

  /* Size, chosen by how it should read rather than by a number. */
  function sizeRow(label, hint, presets, get, set) {
    var row = el("div", "dp-row");
    row.innerHTML = '<div class="dp-row-head"><b>' + label + "</b>" +
      (hint ? "<small>" + hint + "</small>" : "") + "</div>";
    var wrap = el("div", "dp-sizes");
    var current = get() || "";
    presets.forEach(function (p) {
      var b = el("button", "dp-size", p.label);
      b.type = "button";
      b.setAttribute("aria-pressed", String(p.value === current));
      b.addEventListener("click", function () {
        set(p.value);
        Array.prototype.forEach.call(wrap.children, function (o) {
          o.setAttribute("aria-pressed", String(o === b));
        });
        repaint();
      });
      wrap.appendChild(b);
    });
    var reset = el("button", "dp-size", "Default");
    reset.type = "button";
    reset.setAttribute("aria-pressed", String(!current));
    reset.addEventListener("click", function () {
      set("");
      Array.prototype.forEach.call(wrap.children, function (o) {
        o.setAttribute("aria-pressed", String(o === reset));
      });
      repaint();
    });
    wrap.appendChild(reset);
    row.appendChild(wrap);
    return row;
  }

  function fontRow(label, get, set) {
    var row = el("div", "dp-row");
    row.innerHTML = '<div class="dp-row-head"><b>' + label + "</b></div>";
    var sel = el("select", "dp-font");
    var current = get() || "";
    var all = FONTS.slice();
    (window.FM.customFonts || []).forEach(function (f) { if (all.indexOf(f.family) < 0) all.push(f.family); });
    if (current && all.indexOf(current) < 0) all.unshift(current);
    all.forEach(function (f) {
      var o = el("option", null, f);
      o.value = f;
      o.style.fontFamily = '"' + f + '"';
      if (f === current) o.selected = true;
      sel.appendChild(o);
    });
    var other = el("option", null, "Other\u2026");
    other.value = "__other";
    sel.appendChild(other);

    var sample = el("p", "dp-sample", "Frozen Moments \u2014 ABCDEFG 0123");
    sample.style.fontFamily = '"' + current + '"';

    sel.addEventListener("change", function () {
      if (sel.value === "__other") {
        var name = window.prompt("Google Fonts family name, spelled exactly as they write it:");
        if (!name) { sel.value = get() || FONTS[0]; return; }
        set(name.trim());
      } else {
        set(sel.value);
      }
      sample.style.fontFamily = '"' + get() + '"';
      repaint();
    });
    row.appendChild(sel);
    row.appendChild(sample);
    return row;
  }

  /* ---------- build ---------- */
  function build() {
    if (document.getElementById("fm-design")) return;

    var btn = el("button", "dp-open", "Design");
    btn.id = "fm-design-open";
    btn.type = "button";
    document.body.appendChild(btn);

    var panel = el("aside", "dp");
    panel.id = "fm-design";
    panel.innerHTML =
      '<header><b>Design</b><span class="dp-ver">template v' +
        (window.FMTemplateVersion || "?") +
        '</span><button type="button" class="dp-close" aria-label="Close">\u2715</button></header>' +
      '<p class="dp-note">Changes show immediately. Nothing is saved until you download the overrides file or paste the settings into StudioFlow.</p>' +
      '<div class="dp-body"></div>' +
      '<footer>' +
        '<button type="button" class="dp-btn" id="dpCopy">Copy settings</button>' +
        '<button type="button" class="dp-btn primary" id="dpSave">Download overrides.js</button>' +
      "</footer>";
    document.body.appendChild(panel);

    var body = panel.querySelector(".dp-body");

    /* palettes */
    body.appendChild(el("h4", null, "Palette"));
    var pal = el("div", "dp-palettes");
    PALETTES.forEach(function (p) {
      var b = el("button", "dp-pal");
      b.type = "button";
      b.title = p.name;
      b.innerHTML = '<span class="dp-chips">' +
        ["paper", "paper2", "accent", "ink"].map(function (k) {
          return '<i style="background:' + p[k] + '"></i>';
        }).join("") + "</span><span>" + p.name + "</span>";
      b.addEventListener("click", function () {
        ["ink", "inkSoft", "paper", "paper2", "line", "accent"].forEach(function (k) { theme()[k] = p[k]; });
        rebuildBody();
        repaint();
      });
      pal.appendChild(b);
    });
    body.appendChild(pal);

    rebuildBody();

    function rebuildBody() {
      /* keep the palette block, rebuild everything under it */
      while (body.children.length > 2) body.removeChild(body.lastChild);

      body.appendChild(el("h4", null, "Colours"));
      SWATCHES.forEach(function (sw) {
        body.appendChild(colourRow(sw[1], sw[2],
          function () { return theme()[sw[0]]; },
          function (v) { theme()[sw[0]] = v; }));
      });

      body.appendChild(el("h4", null, "Header"));
      var hdr = el("div", "dp-row");
      hdr.innerHTML = '<div class="dp-row-head"><b>Bar colour</b><small>Dark gives you the charcoal header</small></div>';
      var sel = el("select", "dp-font");
      ["light", "dark"].forEach(function (v) {
        var o = el("option", null, v === "dark" ? "Dark charcoal" : "Light");
        o.value = v;
        if ((theme().header || "light") === v) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener("change", function () { theme().header = sel.value; repaint(); });
      hdr.appendChild(sel);
      var tr = el("label", "dp-check");
      tr.innerHTML = '<input type="checkbox"' + (theme().heroTransparent ? " checked" : "") +
        "> Float see-through over the home page photo";
      tr.querySelector("input").addEventListener("change", function (e) {
        theme().heroTransparent = e.target.checked; repaint();
      });
      hdr.appendChild(tr);
      body.appendChild(hdr);

      body.appendChild(el("h4", null, "Type"));
      body.appendChild(fontRow("Headings",
        function () { return theme().headingFont; },
        function (v) { theme().headingFont = v; }));
      body.appendChild(fontRow("Body text",
        function () { return theme().bodyFont; },
        function (v) { theme().bodyFont = v; }));

      var up = el("div", "dp-row");
      up.innerHTML = '<div class="dp-row-head"><b>Your own font</b>' +
        "<small>Preview it here, then put the file beside index.html to publish it</small></div>" +
        '<label class="dp-upload">Choose a font file<input type="file" accept=".otf,.ttf,.woff,.woff2" hidden></label>' +
        '<p class="dp-uploaded"></p>';
      up.querySelector("input").addEventListener("change", function (e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        var family = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
        var r = new FileReader();
        r.onload = function () {
          var st = document.createElement("style");
          st.textContent = '@font-face{font-family:"' + family + '";src:url(' + r.result + ');font-display:block}';
          document.head.appendChild(st);
          window.FM.customFonts = (window.FM.customFonts || []).concat([{ family: family, file: f.name }]);
          up.querySelector(".dp-uploaded").textContent =
            '"' + family + '" is available in the lists above. Put ' + f.name + " beside index.html before publishing.";
          rebuildBody();
        };
        r.readAsDataURL(f);
      });
      body.appendChild(up);

      body.appendChild(el("h4", null, "Sections"));
      body.appendChild(el("p", "dp-hint",
        "Each block on the home page can have its own colours and type. " +
        "Leave anything unset and it follows the theme above."));

      SECTIONS.forEach(function (sec) {
        var box = el("div", "dp-section");
        box.appendChild(el("p", "dp-section-name", "<b>" + sec.label + "</b><small>" + sec.hint + "</small>"));
        var get = function (k) { return (sections()[sec.key] || {})[k]; };
        var set = function (k, v) {
          sections()[sec.key] = sections()[sec.key] || {};
          sections()[sec.key][k] = v;
        };
        box.appendChild(colourRow("Background", "The panel behind everything",
          function () { return get("background"); }, function (v) { set("background", v); }));
        box.appendChild(colourRow("Text", "Heading and paragraph colour",
          function () { return get("colour"); }, function (v) { set("colour", v); }));
        box.appendChild(colourRow("Small caps label", "The little line above the heading",
          function () { return get("eyebrowColour"); }, function (v) { set("eyebrowColour", v); }));

        if (sec.type) {
          box.appendChild(fontRow("Heading font",
            function () { return get("headingFont"); }, function (v) { set("headingFont", v); }));
          box.appendChild(sizeRow("Heading size", "How large the heading reads", HEADING_SIZES,
            function () { return get("headingSize"); }, function (v) { set("headingSize", v); }));
          box.appendChild(fontRow("Body font",
            function () { return get("bodyFont"); }, function (v) { set("bodyFont", v); }));
          box.appendChild(sizeRow("Body size", "The paragraph under the heading", TEXT_SIZES,
            function () { return get("bodySize"); }, function (v) { set("bodySize", v); }));
        }
        body.appendChild(box);
      });

      /* hero boxes, per service */
      body.appendChild(el("h4", null, "Service heroes"));
      body.appendChild(el("p", "dp-hint",
        "How tall the picture box is on each service page. Drag the picture itself " +
        "on the page to choose which part shows. \u201cWhole picture\u201d fits the " +
        "entire photograph in \u2014 use it for a room shot that must not be cropped."));
      (window.FM.services || []).forEach(function (svc) {
        var box = el("div", "dp-section");
        box.appendChild(el("p", "dp-section-name", "<b>" + (svc.short || svc.name) + "</b>"));
        svc.hero = svc.hero || {};
        var wrap = el("div", "dp-sizes");
        [["short", "Short"], ["standard", "Standard"], ["tall", "Tall"], ["full", "Whole picture"]]
          .forEach(function (h) {
            var b = el("button", "dp-size", h[1]);
            b.type = "button";
            b.setAttribute("aria-pressed", String((svc.hero.height || "standard") === h[0]));
            b.addEventListener("click", function () {
              svc.hero.height = h[0];
              Array.prototype.forEach.call(wrap.children, function (o) {
                o.setAttribute("aria-pressed", String(o === b));
              });
              repaint();
            });
            wrap.appendChild(b);
          });
        box.appendChild(wrap);
        var reset = el("button", "dp-size", "Recentre the picture");
        reset.type = "button";
        reset.style.marginTop = ".4rem";
        reset.addEventListener("click", function () {
          try { window.localStorage.removeItem("fm-focus:service:" + svc.id); } catch (e) {}
          svc.hero.focus = "";
          repaint();
        });
        box.appendChild(reset);
        body.appendChild(box);
      });

      /* one colour across every section at once */
      body.appendChild(el("h4", null, "All sections at once"));
      var all = el("div", "dp-section");
      all.appendChild(el("p", "dp-hint", "Sets the same colour on every section above."));
      all.appendChild(colourRow("Background everywhere", "",
        function () {
          var vals = SECTIONS.map(function (s2) { return (sections()[s2.key] || {}).background || ""; });
          return vals.every(function (v) { return v === vals[0]; }) ? vals[0] : "";
        },
        function (v) {
          SECTIONS.forEach(function (s2) {
            sections()[s2.key] = sections()[s2.key] || {};
            sections()[s2.key].background = v;
          });
        }));
      all.appendChild(colourRow("Text everywhere", "",
        function () {
          var vals = SECTIONS.map(function (s2) { return (sections()[s2.key] || {}).colour || ""; });
          return vals.every(function (v) { return v === vals[0]; }) ? vals[0] : "";
        },
        function (v) {
          SECTIONS.forEach(function (s2) {
            sections()[s2.key] = sections()[s2.key] || {};
            sections()[s2.key].colour = v;
          });
        }));
      body.appendChild(all);
    }

    btn.addEventListener("click", function () { panel.classList.add("on"); });
    panel.querySelector(".dp-close").addEventListener("click", function () { panel.classList.remove("on"); });

    panel.querySelector("#dpSave").addEventListener("click", function () {
      download("overrides.js", overridesText());
    });
    panel.querySelector("#dpCopy").addEventListener("click", function () {
      var t = theme();
      var text = SWATCHES.map(function (s) { return s[1] + ": " + (t[s[0]] || "not set"); }).join("\n") +
        "\nHeadings: " + (t.headingFont || "") + "\nBody: " + (t.bodyFont || "") +
        "\nHeader: " + (t.header || "light");
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      var b = panel.querySelector("#dpCopy");
      b.textContent = "Copied";
      setTimeout(function () { b.textContent = "Copy settings"; }, 1600);
    });
  }

  function sync() {
    var on = studioOn();
    var existing = document.getElementById("fm-design");
    if (on && !existing) build();
    if (!on && existing) {
      existing.remove();
      var b = document.getElementById("fm-design-open");
      if (b) b.remove();
    }
  }

  document.addEventListener("DOMContentLoaded", sync);
  window.FMDesignSync = sync;
})();
