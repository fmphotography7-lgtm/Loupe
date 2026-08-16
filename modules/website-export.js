/* ============================================================================
   StudioFlow 4.0 g94 · WEBSITE EXPORT  (window.SFWebsiteExport)

   Turns the workspace into a finished static website: template files copied from
   site-template/, a generated catalogue.js, and real image files decoded out of
   the database.

   TWO TRANSFORMATIONS ARE DELIBERATE AND VISIBLE, never silent:

   1. MATTED MEDIUMS FOLD INTO A MAT ADD-ON. StudioFlow models "Luster Paper" and
      "Luster Paper + Mat" as two separate productTemplates. The store Kirk asked
      for works the other way round -- choose a material, then tick a mat -- so the
      matted template is folded into its base and the price difference becomes the
      mat's per-size price. Every fold is listed in the report. A matted template
      with no base sibling is left alone as its own medium.

   2. FLOATING FRAME COMES STRAIGHT ACROSS as an add-on, because state.pricing.addOns
      already has exactly that shape: per-size prices and colour options.

   WHAT IS NOT IN STUDIOFLOW AND HAS TO LIVE HERE: the services copy, the brand
   tagline, hero and portrait images, and the room renders. Room projects store a
   recipe (scene + placement), not a picture, and AI renders are deliberately never
   persisted -- so room images are picked up from a folder on disk, matched to a
   piece by its file id in the filename (FMP-0076-livingroom.jpg).
   ============================================================================ */
window.SFWebsiteExport = {
  /* Starting points, not straitjackets: picking one fills the fields and he edits from there. */
  THEME_PRESETS: [
    { name: 'Frozen Moments Classic', ink: '#14171a', inkSoft: '#3d444b', paper: '#faf9f7',
      paper2: '#f0eeea', line: '#dcd8d1', accent: '#2f5d62',
      headingFont: 'Playfair Display', bodyFont: 'DM Sans', radius: '2px', header: 'light', heroTransparent: true },
    { name: 'Gallery White', ink: '#111111', inkSoft: '#5a5a5a', paper: '#ffffff',
      paper2: '#f4f4f4', line: '#e4e4e4', accent: '#111111',
      headingFont: 'Cormorant Garamond', bodyFont: 'Inter', radius: '0px', header: 'light', heroTransparent: false },
    { name: 'Charcoal Studio', ink: '#0f1113', inkSoft: '#454b52', paper: '#f7f7f5',
      paper2: '#ebebe7', line: '#d6d6d1', accent: '#b07d42',
      headingFont: 'Libre Baskerville', bodyFont: 'Source Sans 3', radius: '3px', header: 'dark', heroTransparent: true },
    { name: 'West Coast', ink: '#12211f', inkSoft: '#3a4d4a', paper: '#f8faf8',
      paper2: '#eaf0ed', line: '#d3ded9', accent: '#2f6f5e',
      headingFont: 'Fraunces', bodyFont: 'Karla', radius: '6px', header: 'dark', heroTransparent: true }
  ],
  busy: false,
  report: null,

  /* ---------- settings that have no home elsewhere in StudioFlow ---------- */
  /* Electron does not implement window.prompt — it returns undefined and the caller silently does
     nothing, which is exactly how the client-room path broke in g112. So: a real modal. */
  askForLink() {
    const sf = window.SF;
    return new Promise(resolve => {
      sf.$('modalRoot').innerHTML = `<div class="modal-backdrop"><div class="modal">
        <h3>Link to a download</h3>
        <p class="muted">Paste the address the button should open. For a GitHub release, open the
        release, right-click the attached file and copy the link \u2014 GitHub then counts every
        download for you.</p>
        <label>Address<input id="dlLinkUrl" placeholder="https://github.com/\u2026/releases/download/v1.0/loupe-single-file.html"></label>
        <label>Button label<input id="dlLinkLabel" placeholder="Download Loupe"></label>
        <div class="modal-footer">
          <button class="button secondary" id="dlLinkCancel">Cancel</button>
          <button class="button primary" id="dlLinkSave">Add it</button>
        </div></div></div>`;
      const done = v => { sf.closeModal(); resolve(v); };
      sf.$('dlLinkCancel').onclick = () => done('');
      sf.$('dlLinkSave').onclick = () => {
        const u = String(sf.$('dlLinkUrl').value || '').trim();
        if (!/^https?:\/\//i.test(u)) { sf.$('dlLinkUrl').focus(); return; }
        this._pendingLinkLabel = String(sf.$('dlLinkLabel').value || '').trim();
        done(u);
      };
      sf.$('dlLinkUrl').focus();
    });
  },

  settings() {
    const sf = window.SF, s = sf.state;
    s.websiteExport = s.websiteExport || {};
    const w = s.websiteExport;
    w.brand = w.brand || {};
    if (w.brand.tagline == null) w.brand.tagline = 'Capturing the beauty of nature, the emotion of life\u2019s milestones, and the moments that deserve to be remembered.';
    if (w.brand.email == null) w.brand.email = '';
    if (w.brand.phone == null) w.brand.phone = '';
    if (w.brand.location == null) w.brand.location = 'Victoria, British Columbia';
    if (w.brand.instagram == null) w.brand.instagram = '';
    if (w.brand.heroArtworkId == null) w.brand.heroArtworkId = '';
    if (w.brand.portrait == null) w.brand.portrait = '';
    if (w.brand.heroFile == null) w.brand.heroFile = '';

    /* ==========================================================================================
       g178 — THE FM.site BLOCK, which v27's seo.js has been reading and never receiving.
       ==========================================================================================
       seo.js asks for site.url, currency, priceRange, areaServed, address, geo, openingHours,
       googleBusiness and googleMaps. The export emitted NONE of them, so every canonical link,
       every Open Graph image and every LocalBusiness tag has been resolving against `undefined`
       and quietly doing nothing. Nothing looked broken: invalid or absent structured data is
       simply ignored, which is exactly why it went unnoticed.

       `site.url` is the one that matters most and the one that cannot be guessed — a canonical
       link has to be ABSOLUTE, and only Kirk knows the domain he is publishing to. It defaults to
       EMPTY rather than to fmphotography.ca: a wrong canonical pointing at a domain he does not
       control is worse than none, because it tells search engines the real page lives elsewhere.

       NAME, ADDRESS AND PHONE MUST MATCH HIS GOOGLE BUSINESS PROFILE CHARACTER FOR CHARACTER —
       a different phone format reads as a different business and the two stop reinforcing each
       other. So these are seeded from the brand block he already fills in, not invented here. */
    if (!w.site || typeof w.site !== 'object') w.site = {};
    if (w.site.url == null) w.site.url = '';
    if (w.site.currency == null) w.site.currency = 'CAD';
    if (w.site.priceRange == null) w.site.priceRange = '$$';
    if (w.site.areaServed == null) w.site.areaServed = 'Vancouver Island, British Columbia';
    if (!w.site.address || typeof w.site.address !== 'object') w.site.address = {};
    if (w.site.address.city == null) w.site.address.city = 'Victoria';
    if (w.site.address.region == null) w.site.address.region = 'BC';
    if (w.site.address.country == null) w.site.address.country = 'CA';
    if (w.site.googleBusiness == null) w.site.googleBusiness = '';
    if (w.site.googleMaps == null) w.site.googleMaps = '';
    /* g102 THEME — seeded from the values the template ships with, so the editor opens showing
       exactly what the site currently looks like rather than an arbitrary palette. The template
       already reads every one of these from catalogue.theme and maps them onto CSS custom
       properties, so changing a theme is a DATA change; no stylesheet is touched. */
    w.theme = w.theme || {};
    const themeSeed = { name: 'Frozen Moments Classic', ink: '#14171a', inkSoft: '#3d444b',
      paper: '#faf9f7', paper2: '#f0eeea', line: '#dcd8d1', accent: '#2f5d62',
      headingFont: 'Playfair Display', bodyFont: 'DM Sans', radius: '2px',
      /* g154: template v22 maps theme.fmBlue onto --fm-blue, the Book Now pill. Seeded with the
         value the stylesheet already falls back to, so the field opens showing what the site
         looks like today — the same rule the rest of this seed follows. A theme saved before
         this build simply has no fmBlue and the CSS fallback still applies. */
      fmBlue: '#8ecae6',
      header: 'light', heroTransparent: true };
    Object.keys(themeSeed).forEach(k => { if (w.theme[k] == null) w.theme[k] = themeSeed[k]; });
    /* g116: his OWN saved palettes, kept alongside the built-in ones. */
    if (!Array.isArray(w.themePresets)) w.themePresets = [];
    if (!w.galleryCovers || typeof w.galleryCovers !== 'object') w.galleryCovers = {};
    if (!w.galleryOrder) w.galleryOrder = 'sales';
    /* g119: template v13 reads brand.cards (the two home-page link cards) and sections.seeIt
       (the "see it, size it, make it yours" band). Both are pictures Kirk chooses, plus optional
       type settings for that one band. */
    if (!w.cards || typeof w.cards !== 'object') w.cards = { fineArt: '', services: '' };
    if (!w.seeIt || typeof w.seeIt !== 'object') w.seeIt = { picture: '', colour: '', headingSize: '', bodySize: '' };
    /* g146: the About panel. Kirk asked for a dark background and light text there twice, and the
       TEMPLATE has done it by default since v14 — but nothing in StudioFlow ever wrote
       sections.about, so the only way to change it was to hand-edit overrides.js. Seeded with the
       template's own defaults so the fields open showing what the site already looks like, the
       same rule the Theme card follows. */
    if (!w.about || typeof w.about !== 'object') w.about = { background: '#22262b', colour: '#e9e7e3', eyebrowColour: '', enabled: true };
    /* g131: free tools. The template's tools.html reads FM.downloads and only shows the nav link
       when there is something in it, so an empty list simply means no page — which is what he
       wants until Loupe is actually in. */
    if (!Array.isArray(w.downloads)) w.downloads = [];
    /* g136: where the giveaway files actually live, so the download count can be read back. */
    if (!w.github || typeof w.github !== 'object') w.github = { owner: '', repo: '' };
    if (!w.toolsPage || typeof w.toolsPage !== 'object') {
      w.toolsPage = { eyebrow: '', title: 'Free tools',
        intro: "Things I built for my own work, given away because they're more useful shared than kept." };
    }
    w.downloads.forEach((d, i) => {
      if (!d.id) d.id = 'dl' + i;
      if (!Array.isArray(d.files)) d.files = [];
    });
    if (!Array.isArray(w.newsPosts)) w.newsPosts = [];
    w.newsPosts.forEach(n => {
      if (n.pinned == null) n.pinned = false;
      if (n.picture == null) n.picture = '';
    });
    if (!Array.isArray(w.services) || !w.services.length) {
      w.services = [
        { id: 'wedding', name: 'Wedding Photography', short: 'Weddings', blurb: '', detail: '' },
        { id: 'portrait', name: 'Portrait Photography', short: 'Portraits', blurb: '', detail: '' },
        { id: 'real-estate', name: 'Real Estate Photography', short: 'Real Estate', blurb: '', detail: '' },
        { id: 'product', name: 'Product Photography', short: 'Product', blurb: '', detail: '' },
        { id: 'event', name: 'Event Photography', short: 'Events', blurb: '', detail: '' }
      ];
    }
    w.services.forEach(x => {
      if (x.picture == null) x.picture = '';        /* {name,path} once chosen */
      if (!Array.isArray(x.gallery)) x.gallery = [];
    });
    w.galleryLooks = w.galleryLooks || {};
    w.matColours = Array.isArray(w.matColours) && w.matColours.length ? w.matColours : [
      { name: 'White', hex: '#f6f4ef' },
      { name: 'Black', hex: '#17181b' },
      { name: 'Custom colour', hex: '#7d6a55', surcharge: 35, note: 'Subject to availability \u2014 I\u2019ll confirm the colour before printing' }
    ];
    if (w.folder == null) w.folder = '';
    if (w.roomFolder == null) w.roomFolder = '';
    return w;
  },

  LAYOUTS: [
    { id: 'fullbleed', name: 'Full bleed \u00b7 one image at a time' },
    { id: 'masonry', name: 'Masonry \u00b7 mixed heights' },
    { id: 'plates', name: 'Plates \u00b7 even grid, wide gutters' },
    { id: 'editorial', name: 'Editorial \u00b7 image beside text' }
  ],
  ACCENTS: ['#2f5d62', '#4a5d3a', '#8a6a4a', '#b98b4e'],

  /* ---------- helpers ---------- */
  slug(v) { return String(v || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); },
  normSize(v) { return String(v || '').toLowerCase().replace(/[\u00d7\u2715]/g, 'x').replace(/\s+/g, ''); },
  /* "Luster Paper + Mat", "Luster Paper - Matted", "Matted Luster Paper" all mean the same thing */
  isMatted(name) { return /(\+\s*mat\b|\bmatted\b|with\s+mat\b|-\s*mat\b)/i.test(String(name || '')); },
  baseName(name) {
    return String(name || '')
      .replace(/\s*[-+\u00b7]?\s*(matted|with\s+mat|\+\s*mat|mat)\s*$/i, '')
      .replace(/^\s*matted\s+/i, '')
      .trim();
  },

  templates() {
    const sf = window.SF;
    return (sf.state.productTemplates || []).filter(t => Array.isArray(t.sizes) && t.sizes.length);
  },
  priceOf(artwork, mediumId, size) {
    try { return Number(window.SFPricing.priceFor(artwork, mediumId, size) || 0); }
    catch (e) { return Number(window.SF.state.pricing?.standard?.[mediumId]?.[size] || 0); }
  },

  /* ------------------------------------------------------------------
     BUILD THE CATALOGUE
     Returns {catalogue, report} -- nothing is written here, so the page can
     show exactly what would happen before anyone commits to it.
     ------------------------------------------------------------------ */
  build(roomFiles) {
    const sf = window.SF, w = this.settings();
    const report = { folds: [], skipped: [], noImage: [], noGallery: [], noPrice: [], counts: {} };
    const templates = this.templates();

    /* --- mediums, with matted templates folded into their base --- */
    const byBase = new Map();
    templates.forEach(t => { if (!this.isMatted(t.name)) byBase.set(this.baseName(t.name).toLowerCase(), t); });

    const mediums = [], matPrice = {}, matAppliesTo = [], foldedInto = new Map();
    templates.forEach(t => {
      if (!this.isMatted(t.name)) { mediums.push(t); return; }
      const base = byBase.get(this.baseName(t.name).toLowerCase());
      if (!base) { mediums.push(t); report.skipped.push(`"${t.name}" stays its own material \u2014 no plain "${this.baseName(t.name)}" to fold it into.`); return; }
      foldedInto.set(t.id, base.id);
      if (matAppliesTo.indexOf(base.id) < 0) matAppliesTo.push(base.id);
      (t.sizes || []).forEach(size => {
        const matted = this.priceOf(null, t.id, size), plain = this.priceOf(null, base.id, size);
        const diff = Math.round((matted - plain) * 100) / 100;
        if (matted > 0 && plain > 0 && diff > 0 && matPrice[size] == null) matPrice[size] = diff;
      });
      report.folds.push(`${t.name} \u2192 ${base.name} + mat`);
    });

    /* --- add-ons: mat (derived) and whatever is in pricing.addOns (floating frame) --- */
    const addOns = [];
    if (Object.keys(matPrice).length) {
      addOns.push({ id: 'mat', name: 'Mat', note: 'Archival mat with a bevel-cut window, ready for a standard frame.',
                    appliesTo: matAppliesTo, colours: w.matColours, price: matPrice });
    }
    (sf.state.pricing?.addOns || []).forEach(a => {
      if (a.websiteEnabled === false) return;
      const sizePrices = Array.isArray(a.sizePrices) ? a.sizePrices.filter(x => x.size && Number(x.price) > 0) : [];
      if (!sizePrices.length) { report.skipped.push(`Add-on "${a.name}" has no priced sizes \u2014 not exported.`); return; }
      const price = {}; sizePrices.forEach(x => { price[x.size] = Number(x.price); });
      addOns.push({
        id: this.slug(a.name) || a.id, name: a.name,
        note: a.name + ' added to the finished piece.',
        appliesTo: [a.mediumId].filter(Boolean),
        colours: (a.colors || []).map(n => ({ name: n, hex: { Black: '#1c1c1c', White: '#f2f0ec', Espresso: '#4a3524' }[n] || '#1c1c1c' })),
        price
      });
    });

    const allows = {};
    mediums.forEach(m => { allows[m.id] = addOns.filter(ao => (ao.appliesTo || []).indexOf(m.id) >= 0).map(ao => ao.id); });

    /* --- galleries --- */
    const galleries = (sf.state.galleries || []).map((g, i) => {
      const look = w.galleryLooks[g.id] || {};
      return {
        id: g.id, name: g.name, slug: this.slug(g.name),
        blurb: g.description || '', intro: g.description || '',
        layout: look.layout || this.LAYOUTS[i % this.LAYOUTS.length].id,
        accent: look.accent || this.ACCENTS[i % this.ACCENTS.length],
        cover: ''
      };
    });

    /* --- artworks --- */
    const idx = sf.imageIndex ? sf.imageIndex() : null;
    const rooms = this.roomIndex(roomFiles);
    const artworks = [];
    (sf.state.artworks || []).forEach(a => {
      const id = String(a.artworkId || a.id || '');
      const gallery = (sf.state.galleries || []).find(g => sf.artworkInGallery(a, g));
      if (!gallery) { report.noGallery.push(a.title || id); return; }

      const image = sf.artworkImage ? sf.artworkImage(a, idx) : (a.image || a.imagePath || a.imageData || '');
      if (!image) { report.noImage.push(a.title || id); return; }

      /* every priced size this piece is offered in, with matted products folded onto the base */
      const seen = {}, variants = [];
      (a.products || []).forEach(p => {
        let mediumId = p.mediumId || (templates.find(t => t.name === p.medium) || {}).id || '';
        if (foldedInto.has(mediumId)) mediumId = foldedInto.get(mediumId);
        if (!mediumId || !p.size) return;
        if (!mediums.some(m => m.id === mediumId)) return;
        const key = mediumId + '|' + this.normSize(p.size);
        if (seen[key]) return;
        const price = this.priceOf(a, mediumId, p.size) || Number(p.price || 0);
        if (!(price > 0)) return;
        seen[key] = 1;
        variants.push({ mediumId, size: p.size, price,
                        sku: p.sku || null, sqVariantId: p.squarespaceVariantId || null });
      });
      if (!variants.length) { report.noPrice.push(a.title || id); return; }

      const le = a.isLimitedEdition ? this.editionInfo(a) : null;
      /* g171 — THE OPEN-EDITION TWIN. When a numbered edition sells out, the site offers the same
         photograph as an open edition rather than dead-ending on "sold out". A guest standing in a
         hotel corridor with their phone already out is the best-qualified buyer he will ever get,
         and sending them nowhere wastes that. Only meaningful on a limited edition, so it is
         omitted entirely elsewhere rather than exported empty. */
      const openTwin = le ? String(a.openEditionId || '').trim() : '';
      artworks.push({
        id, title: a.title || 'Untitled', gallery: gallery.id,
        orientation: 'landscape',            /* corrected from the real file at write time */
        image: '', _source: image,
        blurb: a.description || a.story || '',
        limited: !!le, edition: le, openEditionId: openTwin || undefined,
        rooms: rooms[id] ? rooms[id].slice() : [],
        variants
      });
    });

    /* g117 — GALLERY ORDER AND COVERS.
       Order: Kirk asked to lead each gallery with his best sellers. The sales rollup already knows
       units sold per piece, so rank by that and let anything unsold keep its existing order behind
       them. He can override per gallery with `galleryOrder`. Covers: a chosen file wins; otherwise
       the leading piece, which after the sort is his strongest seller rather than whatever
       happened to be first. */
    const unitsById = (() => {
      const m = {};
      try {
        (window.SFSalesRollup?.rows() || []).forEach(r => {
          if (!r.artworkId) return;
          m[String(r.artworkId)] = (m[String(r.artworkId)] || 0) + (Number(r.qty) || 0);
        });
      } catch (_) {}
      return m;
    })();
    if ((w.galleryOrder || 'sales') === 'sales') {
      artworks.sort((a, b) => (unitsById[String(b.id)] || 0) - (unitsById[String(a.id)] || 0));
    }
    galleries.forEach(g => {
      const chosen = (w.galleryCovers || {})[g.id];
      g._coverSource = (chosen && chosen.path) || chosen || '';
      const first = artworks.find(a => a.gallery === g.id);
      g._coverFrom = first ? first.id : '';
    });

    /* --- news, from the event calendar --- */
    const today = new Date().toISOString().slice(0, 10);
    const news = (sf.state.salesEvents || [])
      .filter(e => e.marketEvent && !e.cancelled && String(e.endDate || e.date || '') >= today)
      .sort((x, y) => String(x.date || '').localeCompare(String(y.date || '')))
      .slice(0, 6)
      .map(e => ({ title: e.name || 'Upcoming show', when: this.dateRange(e), blurb: e.notes || '',
                   image: '', link: '', pinned: false, _source: 'event' }));

    /* g102: his own posts (a course, an award, anything that isn't a market) merged with the
       generated market list. Pinned first, then events by date, then the rest in his order.
       Capped at six because the home page lays them out in a fixed band. */
    const posts = (w.newsPosts || [])
      .filter(n => String(n.title || '').trim())
      .map((n, i) => ({ title: n.title, when: n.when || '', blurb: n.blurb || '', image: '',
                        link: n.link || '', pinned: !!n.pinned, _order: i, _source: 'post',
                        _pictureSource: (n.picture && n.picture.path) || n.picture || '' }));
    const allNews = posts.concat(news)
      .sort((a, b) => (b.pinned - a.pinned) || (a._source === 'event' ? -1 : 1) - (b._source === 'event' ? -1 : 1) || ((a._order ?? 0) - (b._order ?? 0)))
      .slice(0, 6);

    const brand = {
      name: sf.state.business?.name || 'Frozen Moments Photography',
      logo: sf.state.business?.logo || '',
      tagline: w.brand.tagline, location: w.brand.location,
      email: w.brand.email, phone: w.brand.phone, instagram: w.brand.instagram,
      hero: '', portrait: '', defaultRoom: '',
      _heroFrom: w.brand.heroArtworkId || (artworks[0] || {}).id || '',
      _heroFileSource: (w.brand.heroFile && w.brand.heroFile.path) || w.brand.heroFile || '',
      _cardSources: {
        fineArt: (w.cards.fineArt && w.cards.fineArt.path) || w.cards.fineArt || '',
        services: (w.cards.services && w.cards.services.path) || w.cards.services || ''
      },
      _portraitSource: (w.brand.portrait && w.brand.portrait.path) || w.brand.portrait || ''
    };

    report.counts = {
      artworks: artworks.length, galleries: galleries.length,
      mediums: mediums.length, addOns: addOns.length, news: allNews.length,
      newsPosts: posts.length,
      variants: artworks.reduce((n, a) => n + a.variants.length, 0),
      rooms: artworks.reduce((n, a) => n + a.rooms.length, 0),
      servicePictures: w.services.reduce((n, x) => n + ((x.picture ? 1 : 0) + (x.gallery || []).length), 0)
    };

    return {
      report,
      catalogue: {
        brand, galleries, news: allNews,
        /* Trailing slash stripped so seo.js can join paths without producing '//'. */
        site: Object.assign({}, w.site, {
          url: String(w.site.url || '').trim().replace(/\/+$/, '')
        }), theme: Object.assign({}, w.theme),
        /* g171 — THE VENUE LIST, for v24's art.html.
           A QR label on a hotel wall carries ?h=<venue-code>. The site stores that code for 30
           days and rides it through to the order, which is what pays the hotel its 20%. It needs
           the list only to turn a slug into a readable name on the bar at the top of the page —
           "You're viewing this from Oak Bay Beach Hotel" reads very differently from
           "...from oak-bay-beach".
           SAME LIST THE LABELS USE (state.labelQR.properties), never a second one, or a venue
           renamed for a label would keep its old name on the website.
           ONLY code and name are sent. Commission rates and discount codes stay in StudioFlow —
           catalogue.js is public, and what he pays each hotel is nobody else's business. */
        /* g171 — WHEN A REMAINING COUNT STARTS SHOWING. Kirk's rule: never print how many are left
           on a LABEL, but let the site say so once it is genuinely scarce — "22 of 25 left" reads
           as unwanted, "only 4 left" reads as urgent. Default 8, his to change. */
        editionLowAt: Number(w.editionLowAt) > 0 ? Number(w.editionLowAt) : 8,
        venues: ((sf.state.labelQR && sf.state.labelQR.properties) || [])
          .filter(v => v && String(v.code || '').trim() && String(v.name || '').trim())
          .map(v => ({ code: String(v.code).trim().toLowerCase(), name: String(v.name).trim() })),
        toolsPage: Object.assign({}, w.toolsPage),
        downloads: (w.downloads || [])
          .filter(d => String(d.name || '').trim() && (d.files || []).length)
          .map(d => ({
            id: d.id, name: d.name, kicker: d.kicker || '', tagline: d.tagline || '',
            body: d.body || '', image: '',
            /* g132: v16's tools.html also reads points[], price, supportLabel and supportNote.
               Bullet points come one per line, like the service packages. */
            points: String(d.points || '').split('\n').map(x => x.trim()).filter(Boolean),
            price: d.price || '',
            supportUrl: d.supportUrl || '',
            supportLabel: d.supportUrl ? (d.supportLabel || 'Buy me a coffee') : '',
            supportNote: d.supportUrl ? (d.supportNote || '') : '',
            /* g137: a link already HAS its address and is passed straight through; only a chosen
               file needs copying and an href filled in afterwards. newTab on links, because a
               GitHub release should not navigate away from his site. */
            downloads: (d.files || []).map((f, n) => ({
              label: f.label || 'Download',
              href: f.href || '',
              newTab: !!f.href,
              primary: n === 0
            })),
            _pictureSource: (d.picture && d.picture.path) || d.picture || '',
            _fileSources: (d.files || []).map(f => f.href ? null : ({ name: f.name, path: f.path }))
          })),
        sections: {
          seeIt: Object.assign({}, {
            colour: w.seeIt.colour || undefined,
            headingSize: w.seeIt.headingSize || undefined,
            bodySize: w.seeIt.bodySize || undefined
          }),
          /* Only emitted when he has actually chosen colours. An empty object would still be
             harmless, but writing keys he never set makes the catalogue lie about what is his. */
          about: w.about.enabled === false ? {} : Object.assign({}, {
            background: w.about.background || undefined,
            colour: w.about.colour || undefined,
            eyebrowColour: w.about.eyebrowColour || undefined
          })
        },
        _seeItSource: (w.seeIt.picture && w.seeIt.picture.path) || w.seeIt.picture || '',
        services: w.services.map(x => ({
          id: x.id, name: x.name, short: x.short || x.name,
          blurb: x.blurb || '', detail: x.detail || '',
          image: '', gallery: [],
          _pictureSource: (x.picture && x.picture.path) || x.picture || '',
          /* g116: the template's service.html is a BLOCK HOST — it reads hero{} and blocks[].
             Build those here so packages and the hero come from StudioFlow rather than having to
             be hand-written into overrides.js. */
          hero: (x.heroPicture || x.heroHeadline || x.heroHeight || x.heroFocus != null) ? Object.assign({
            headline: x.heroHeadline || x.name || '',
            sub: x.blurb || '', align: 'bottom-left', image: ''
          },
            /* g155: both OMITTED unless he has set them. Template v21 defaults to standard and 50%,
               so writing them unconditionally would say nothing while making every service look
               deliberately configured — and would overwrite a focus he had dragged in studio mode
               on the site with a value he never chose here. */
            x.heroHeight && x.heroHeight !== 'standard' ? { height: x.heroHeight } : {},
            /* THE TEMPLATE WANTS A CSS BACKGROUND-POSITION STRING, not a number — focusOf() falls
               back to "center 50%" and the studio drag stores `node.style.backgroundPosition`
               verbatim. Emitting the bare number would have produced `background-position: 35`,
               which is invalid and silently ignored: the picture would have sat centred and this
               whole feature would have looked like it did nothing. Checked against site.js rather
               than assumed — the g113 lesson. */
            (Number(x.heroFocus) >= 0 && Number(x.heroFocus) <= 100 && Math.round(Number(x.heroFocus)) !== 50)
              ? { focus: 'center ' + Math.round(Number(x.heroFocus)) + '%' } : {}
          ) : null,
          _heroSource: (x.heroPicture && x.heroPicture.path) || x.heroPicture || '',
          blocks: (x.packages || []).filter(p => String(p.name || '').trim()).length ? [{
            type: 'packages',
            items: (x.packages || []).filter(p => String(p.name || '').trim()).map(p => {
              const item = {
                name: p.name, price: p.price, blurb: p.blurb || '',
                bullets: (p.bullets || []).slice(), image: '',
                cta: { label: 'Book this', href: 'contact.html?about=' + encodeURIComponent(x.name || '') }
              };
              /* g154: OMITTED when false rather than written as `popular:false`. The template
                 tests truthiness either way, but a catalogue that only carries the keys he
                 actually set stays readable — and a package predating this build behaves
                 exactly as it does now. */
              if (p.popular) item.popular = true;
              return item;
            })
          }] : [],
          _packageSources: (x.packages || []).filter(p => String(p.name || '').trim())
            .map(p => (p.picture && p.picture.path) || p.picture || ''),
          _gallerySources: (x.gallery || []).map(g => (g && g.path) || g).filter(Boolean)
        })),
        mediums: mediums.map(m => ({ id: m.id, name: m.name, blurb: m.blurb || '', allows: allows[m.id] || [] })),
        addOns, artworks
      }
    };
  },

  /* ==========================================================================================
     g178 — THE SITEMAP IS GENERATED, because a shipped one is wrong the moment a piece is added.
     ==========================================================================================
     v28 shipped sitemap.xml with 23 URLs frozen at the day it was written. Every artwork Kirk adds
     after that is absent from it, and every piece he removes stays in it pointing at nothing. A
     sitemap is a claim about what exists; a stale one is a wrong claim, and search engines act on
     it. So it is rebuilt from the catalogue at export, like catalogue.js itself.

     REQUIRES site.url. Without an absolute domain a sitemap cannot be written at all — the spec
     requires absolute URLs — so this returns null rather than emitting relative ones that would
     be silently discarded. The export says so instead of shipping a file that does nothing.

     CLIENT GALLERIES ARE NEVER LISTED. A sitemap is an invitation to crawl; robots.txt disallows
     those paths, and listing them here would be asking a crawler to fetch what the same site just
     asked it not to. Nor are cart or art pages, which have nothing to index. */
  /* ==========================================================================================
     g179 — A REAL PAGE PER PHOTOGRAPH.
     ==========================================================================================
     THE PROBLEM, and it is the largest one left in the site's search visibility: every photograph
     shares ONE address, `product.html?id=`. A search engine treats that as a single page, so 72
     photographs compete to be the same result — and the one it settles on is whichever happened to
     be indexed. There is no "Shannon Falls print" page to rank; there is one product page wearing
     72 different pictures depending on the query string.

     The second problem compounds it: everything seo.js writes is written BY JAVASCRIPT, in the
     browser. Google runs JS and sees it. A great many other crawlers — including several of the AI
     ones being courted in robots.txt — read the HTML exactly as delivered, which today is a
     placeholder title and an empty body.

     THE FIX IS A STATIC FILE PER PIECE: `prints/<slug>.html`, with the title, the description, the
     price and the JSON-LD ALREADY IN THE MARKUP before a line of script runs. It then redirects a
     human straight on to the real product page, so there is only ever one experience of the site
     and no second copy of the store to maintain.

     WHY A REDIRECT AND NOT A COPY OF THE PAGE. A duplicate would have to be kept in step with
     product.html for ever, and the first time they drift the crawler sees something the customer
     does not. The static page exists to be READ BY A CRAWLER and to hand a person onwards.
     `canonical` points at the static page itself, because that is the one in the sitemap and the
     one a crawler should keep.
     ========================================================================================== */
  printSlug(a) {
    /* Same convention the room images already use, so a piece has one slug everywhere. */
    return this.slug(String(a.title || a.id || 'print')) + '-' + String(a.id || '').toLowerCase();
  },

  /* g179 — JSON-LD GOES INSIDE A <script> ELEMENT, AND HTML DOES NOT CARE THAT IT IS JSON.
     JSON.stringify escapes quotes and backslashes; it does NOT escape `<`. So a description
     containing "</script>" CLOSES THE BLOCK EARLY and everything after it becomes live markup in
     the page. A title of A "quoted" <b>title</b> also lands raw in the structured data.
     Escaping `<` as \u003c is valid JSON, parses back to exactly the same string, and cannot
     terminate the element. `&` and line separators go too, for the same class of reason.
     Caught by a test that fed a piece a title and a description full of markup \u2014 the BODY was
     already escaped correctly, which is precisely why this would have been easy to miss. */
  jsonLd(obj) {
    return JSON.stringify(obj)
      .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  },

  /* One page. Kept deliberately small: a crawler wants words and structured data, not layout. */
  printPageHtml(cat, a) {
    const base = String((cat.site && cat.site.url) || '').trim().replace(/\/+$/, '');
    if (!base || !a || !a.id) return null;
    const esc = t => String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const brand = (cat.brand && cat.brand.name) || 'Frozen Moments Photography';
    const prices = (a.variants || []).map(v => Number(v.price)).filter(n => isFinite(n) && n > 0);
    const low = prices.length ? Math.min.apply(null, prices) : null;
    const high = prices.length ? Math.max.apply(null, prices) : null;
    const target = base + '/product.html?id=' + encodeURIComponent(a.id);
    const here = base + '/prints/' + this.printSlug(a) + '.html';
    const img = a.image ? base + '/' + String(a.image).replace(/^\/+/, '') : '';

    /* THE DESCRIPTION IS THE PART THAT ACTUALLY RANKS, and it is his words or nothing. A generated
       sentence padded with the title would be the same sentence on 72 pages, which is worse than a
       short one — search engines discount boilerplate, and an AI assistant quoting it would say
       nothing about the photograph. Where he has written nothing, the page says what is true:
       the title, the medium and the sizes. */
    const sizes = Array.from(new Set((a.variants || []).map(v => v.size).filter(Boolean)));
    const factual = [a.title, sizes.length ? 'Available in ' + sizes.join(', ') : '',
      a.limited && a.edition ? 'Limited edition of ' + a.edition.size : '']
      .filter(Boolean).join('. ');
    const blurb = String(a.blurb || '').trim();
    const desc = (blurb || factual || String(a.title || '')).slice(0, 300);

    const ld = {
      '@context': 'https://schema.org', '@type': 'Product',
      name: a.title || 'Print', description: desc, url: here,
      brand: { '@type': 'Brand', name: brand }
    };
    if (img) ld.image = img;
    if (low != null) {
      ld.offers = { '@type': 'AggregateOffer', priceCurrency: (cat.site && cat.site.currency) || 'CAD',
        lowPrice: low, highPrice: high, offerCount: prices.length,
        availability: 'https://schema.org/InStock', url: target };
    }
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(a.title)} \u2014 fine art print \u2014 ${esc(brand)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(here)}">
<meta property="og:type" content="product">
<meta property="og:title" content="${esc(a.title)}">
<meta property="og:description" content="${esc(desc)}">
${img ? `<meta property="og:image" content="${esc(img)}">` : ''}
<meta property="og:url" content="${esc(here)}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${this.jsonLd(ld)}</script>
<link rel="stylesheet" href="../styles.css">
</head>
<body>
<main class="print-static">
  <h1>${esc(a.title)}</h1>
  ${img ? `<img src="${esc(img)}" alt="${esc(a.title)}" width="1200">` : ''}
  <p>${esc(desc)}</p>
  ${low != null ? `<p>Prints from $${low}${high !== low ? ` to $${high}` : ''}.</p>` : ''}
  ${sizes.length ? `<p>Sizes: ${esc(sizes.join(', '))}</p>` : ''}
  <p><a href="${esc(target)}">View and order this print</a></p>
</main>
<script>location.replace(${JSON.stringify(target)});</script>
</body>
</html>`;
  },

  /* ==========================================================================================
     g180 — THE THEME CARD'S COLOUR AND FONT CONTROLS.
     ==========================================================================================
     Kirk: "a colour swatch with no label, no way to tell which is selected, and no font size,
     colour or typeface controls anywhere."

     He was right about all of it, though not for the reason the wording suggests. The labels DID
     exist \u2014 but a bare <input type="color"> is a small coloured square, and a small coloured square
     tells you nothing about WHICH of twelve house colours it is, whether it matches the one two
     rows up, or how to get back to it once changed. And the "font" controls were TEXT BOXES: you
     had to know a typeface's exact name and type it correctly, with no way to see the result.

     THE LOGIC IS LIFTED FROM `site-template/design-panel.js`, which already does this properly, so
     the two panels cannot drift apart: the same twelve named picks, the same rule that the current
     value is shown by NAME, the same "custom" as a last option rather than the default.
     ========================================================================================== */
  THEME_PICKS: [
    { name: 'White', hex: '#ffffff' }, { name: 'Off white', hex: '#faf9f7' },
    { name: 'Light grey', hex: '#f0eeea' }, { name: 'Mid grey', hex: '#8a9099' },
    { name: 'Soft white', hex: '#e9e7e3' }, { name: 'Charcoal', hex: '#22262b' },
    { name: 'Near black', hex: '#14171a' }, { name: 'Teal', hex: '#2f5d62' },
    { name: 'Moss', hex: '#4a5d3a' }, { name: 'Brass', hex: '#b98b4e' },
    { name: 'Sand', hex: '#8a6a4a' }, { name: 'Slate blue', hex: '#3b6ea5' }
  ],
  pickName(v) {
    const hit = this.THEME_PICKS.find(p => p.hex.toLowerCase() === String(v || '').toLowerCase());
    return hit ? hit.name : (v || 'not set');
  },
  /* label + what it is now, BY NAME + the house colours as pressable buttons + custom last. */
  colourRow(key, label, hint, value) {
    const sf = window.SF, v = String(value || '');
    const swatches = this.THEME_PICKS.map(p => {
      const on = p.hex.toLowerCase() === v.toLowerCase();
      return `<button type="button" class="th-pick${on ? ' on' : ''}" data-theme-pick="${key}"
        data-hex="${p.hex}" style="background:${p.hex}" title="${sf.esc(p.name)}"></button>`;
    }).join('');
    return `<div class="th-row">
      <div class="th-head"><b>${sf.esc(label)}</b>${hint ? `<small>${sf.esc(hint)}</small>` : ''}
        <span class="th-now"><i style="background:${sf.esc(v)}"></i>${sf.esc(this.pickName(v))}</span></div>
      <div class="th-picks">${swatches}
        <label class="th-custom">Custom<input type="color" data-theme="${key}" value="${sf.esc(v)}"></label>
      </div></div>`;
  },
  /* g183 — THE SAME NAMED-SWATCH ROW, for controls that are NOT theme keys.
     Kirk, again and rightly: "The colour choices for backgrounds are not clear that they are
     background colour choices or which one is active. these should not be pickers but just a
     swatch i can choose the colour from my theme choices and have one extra custom."
     g180 rebuilt the THEME card and stopped there — the About panel and the "See it" band kept
     their bare pickers, and those are precisely the BACKGROUND colours he means. Same rows here,
     keyed by element id so the existing save handlers keep working untouched. */
  colourRowFor(id, label, hint, value) {
    const sf = window.SF, v = String(value || '');
    const swatches = this.THEME_PICKS.map(p => {
      const on = p.hex.toLowerCase() === v.toLowerCase();
      return `<button type="button" class="th-pick${on ? ' on' : ''}" data-colour-for="${id}"
        data-hex="${p.hex}" style="background:${p.hex}" title="${sf.esc(p.name)}"></button>`;
    }).join('');
    return `<div class="th-row">
      <div class="th-head"><b>${sf.esc(label)}</b>${hint ? `<small>${sf.esc(hint)}</small>` : ''}
        <span class="th-now" data-colour-now="${id}"><i style="background:${sf.esc(v)}"></i>${sf.esc(this.pickName(v))}</span></div>
      <div class="th-picks">${swatches}
        <label class="th-custom">Custom<input type="color" id="${id}" value="${sf.esc(v)}"></label>
      </div></div>`;
  },
  /* A font dropdown for a control that is not a theme key. Blank means "follow the Theme card",
     which is the honest default for a section — it should not silently diverge from the site. */
  fontRowFor(id, label, hint, value, sample) {
    const sf = window.SF, v = String(value || '');
    const known = this.THEME_FONTS.find(f => f.name.toLowerCase() === v.toLowerCase());
    return `<div class="th-row">
      <div class="th-head"><b>${sf.esc(label)}</b>${hint ? `<small>${sf.esc(hint)}</small>` : ''}</div>
      <select class="th-font" id="${id}" data-font-for="${id}">
        <option value="">Follow the Theme card</option>
        ${v && !known ? `<option value="${sf.esc(v)}" selected>${sf.esc(v)} (yours)</option>` : ''}
        ${this.THEME_FONTS.map(f => `<option value="${sf.esc(f.name)}"
          ${known && known.name === f.name ? 'selected' : ''}
          style="font-family:${f.stack}">${sf.esc(f.name)}</option>`).join('')}
      </select>
      <div class="th-sample" data-font-sample="${id}"
        style="font-family:${sf.esc(known ? known.stack : (v || 'inherit'))}">${sf.esc(sample)}</div>
    </div>`;
  },
  sizeRowFor(id, label, value) {
    const sf = window.SF, v = String(value || '');
    const opts = [['', 'Theme default'], ['s', 'Small'], ['m', 'Normal'], ['l', 'Large'], ['xl', 'Extra large']];
    return `<div class="th-row"><div class="th-head"><b>${sf.esc(label)}</b></div>
      <div class="th-picks">${opts.map(([id2, name]) =>
        `<button type="button" class="th-size${v === id2 ? ' on' : ''}" data-size-for="${id}"
          data-val="${id2}">${name}</button>`).join('')}</div>
      <input type="hidden" id="${id}" value="${sf.esc(v)}"></div>`;
  },

  /* Each option is drawn IN ITS OWN TYPEFACE \u2014 the whole point of choosing one is seeing it. */
  THEME_FONTS: [
    { name: 'Playfair Display', stack: "'Playfair Display', Georgia, serif" },
    { name: 'Georgia', stack: 'Georgia, serif' },
    { name: 'Cormorant Garamond', stack: "'Cormorant Garamond', Georgia, serif" },
    { name: 'DM Sans', stack: "'DM Sans', system-ui, sans-serif" },
    { name: 'Inter', stack: "Inter, system-ui, sans-serif" },
    { name: 'Helvetica', stack: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
    { name: 'Montserrat', stack: "Montserrat, system-ui, sans-serif" },
    { name: 'Lato', stack: "Lato, system-ui, sans-serif" }
  ],
  fontRow(key, label, hint, value, sample) {
    const sf = window.SF, v = String(value || '');
    const known = this.THEME_FONTS.find(f => f.name.toLowerCase() === v.toLowerCase());
    const opts = this.THEME_FONTS.map(f =>
      `<option value="${sf.esc(f.name)}" ${known && known.name === f.name ? 'selected' : ''}
        style="font-family:${f.stack}">${sf.esc(f.name)}</option>`).join('');
    /* A font he typed himself is kept as its own option rather than silently swapped for the
       first in the list \u2014 losing a choice on open is worse than not offering it. */
    const custom = v && !known ? `<option value="${sf.esc(v)}" selected>${sf.esc(v)} (yours)</option>` : '';
    return `<div class="th-row">
      <div class="th-head"><b>${sf.esc(label)}</b>${hint ? `<small>${sf.esc(hint)}</small>` : ''}</div>
      <select class="th-font" data-theme="${key}">${custom}${opts}</select>
      <div class="th-sample" data-theme-sample="${key}"
        style="font-family:${sf.esc(known ? known.stack : (v || 'inherit'))}">${sf.esc(sample)}</div>
    </div>`;
  },
  /* Words, not a CSS length. "1.05rem" is not a size anyone chooses; "Large" is. */
  THEME_SIZES: [['s', 'Small'], ['m', 'Normal'], ['l', 'Large'], ['xl', 'Extra large']],
  sizeRow(key, label, value) {
    const sf = window.SF, v = String(value || 'm');
    return `<div class="th-row"><div class="th-head"><b>${sf.esc(label)}</b></div>
      <div class="th-picks">${this.THEME_SIZES.map(([id, name]) =>
        `<button type="button" class="th-size${v === id ? ' on' : ''}" data-theme-size="${key}"
          data-val="${id}">${name}</button>`).join('')}</div></div>`;
  },

  sitemapXml(cat, todayIso) {
    const base = String((cat.site && cat.site.url) || '').trim().replace(/\/+$/, '');
    if (!base) return null;
    const day = String(todayIso || new Date().toISOString()).slice(0, 10);
    const esc = u => String(u).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    const rows = [];
    const add = (path, freq, pri) => rows.push({ loc: base + path, freq, pri });

    add('/', 'weekly', '1.0');
    add('/galleries.html', 'monthly', '0.8');
    add('/store.html', 'weekly', '0.9');
    add('/services.html', 'monthly', '0.8');
    add('/contact.html', 'yearly', '0.5');
    if ((cat.downloads || []).length || (cat.toolsPage && cat.toolsPage.enabled)) {
      add('/tools.html', 'monthly', '0.6');
    }
    (cat.galleries || []).forEach(g => {
      if (g && g.slug) add('/gallery.html?g=' + encodeURIComponent(g.slug), 'monthly', '0.7');
    });
    (cat.services || []).forEach(sv => {
      if (sv && sv.slug) add('/service.html?s=' + encodeURIComponent(sv.slug), 'monthly', '0.8');
    });
    /* g179 — POINT AT THE STATIC PAGE, not the query-string one. A sitemap is what a crawler is
       asked to keep, and the whole reason `prints/<slug>.html` exists is that 72 photographs
       cannot all be `product.html`. Listing the old address would invite a crawler to index the
       one page this build exists to stop competing with itself. */
    (cat.artworks || []).forEach(a => {
      if (a && a.id) add('/prints/' + this.printSlug(a) + '.html', 'monthly', '0.6');
    });

    const body = rows.map(r =>
      `  <url>\n    <loc>${esc(r.loc)}</loc>\n    <lastmod>${day}</lastmod>\n` +
      `    <changefreq>${r.freq}</changefreq>\n    <priority>${r.pri}</priority>\n  </url>`
    ).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  },

  editionInfo(a) {
    try {
      const le = window.SFLimitedEditions;
      const size = le && le.editionSize ? le.editionSize(a) : Number(a.editionSize || 0);
      const sold = le && le.soldCount ? le.soldCount(a) : 0;
      if (!size) return null;
      return { size, sold, remaining: Math.max(0, size - sold) };
    } catch (e) { return null; }
  },

  dateRange(e) {
    const fmt = d => { try { return new Date(String(d) + 'T12:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }); } catch (x) { return d; } };
    if (e.endDate && e.endDate !== e.date) return fmt(e.date) + ' \u2013 ' + fmt(e.endDate);
    return fmt(e.date || '');
  },

  /* room images are matched to a piece by its file id appearing in the filename */
  roomIndex(files) {
    const map = {};
    (files || []).forEach(f => {
      const m = String(f.name || '').match(/([A-Za-z]{2,5}-?\d{3,6})/);
      if (!m) return;
      const id = m[1].toUpperCase().replace(/^([A-Za-z]+)(\d)/, '$1-$2');
      (map[id] = map[id] || []).push(f);
    });
    return map;
  },

  /* ------------------------------------------------------------------
     RENDER
     ------------------------------------------------------------------ */
  render() {
    const sf = window.SF, w = this.settings();
    let built;
    try { built = this.build(this._roomFiles); }
    catch (error) { sf.logError(error, 'Website Export build'); built = { report: { folds: [], skipped: [], noImage: [], noGallery: [], noPrice: [], counts: {} }, catalogue: null }; }
    const c = built.report.counts, cat = built.catalogue;

    const problem = (label, list) => list.length
      ? `<details class="export-problem"><summary>${list.length} ${label}</summary><ul>${list.slice(0, 60).map(x => `<li>${sf.esc(x)}</li>`).join('')}${list.length > 60 ? `<li>\u2026and ${list.length - 60} more</li>` : ''}</ul></details>` : '';

    sf.$('workspace').innerHTML = `<div class="page-stack">
      <section class="card">
        <div class="toolbar">
          <div>
            <div class="section-kicker">WEBSITE EXPORT</div>
            <h2>Build your website from this workspace</h2>
            <p class="muted">Writes a complete, self-contained site \u2014 pages, styles, catalogue and image files \u2014 into a folder you choose. Nothing is uploaded and nothing on Squarespace is touched.</p>
          </div>
          <div class="row-actions">
            <button class="button secondary" id="exRooms">Room Images Folder</button>
            <button class="button primary" id="exRun" ${this.busy ? 'disabled' : ''}>${this.busy ? 'Exporting\u2026' : 'Choose Folder & Export'}</button>
          </div>
        </div>
        <div class="export-figures">
          ${[['Photographs', c.artworks], ['Galleries', c.galleries], ['Materials', c.mediums],
             ['Priced variants', c.variants], ['Add-ons', c.addOns], ['Room images', c.rooms],
             ['Upcoming shows', c.news], ['Service pictures', c.servicePictures]].map(([k, v]) => `<div><b>${v == null ? 0 : v}</b><span>${k}</span></div>`).join('')}
        </div>
        ${w.folder ? `<p class="muted">Last exported to <b>${sf.esc(w.folder)}</b> \u2014 <a href="#" id="exOpen">open the folder</a></p>` : ''}
        ${this._roomFiles ? `<p class="muted">${this._roomFiles.length} room image${this._roomFiles.length === 1 ? '' : 's'} found in <b>${sf.esc(w.roomFolder)}</b>. Files are matched to a piece by its file id in the name, e.g. <code>FMP-0076-livingroom.jpg</code>.</p>` : ''}
        <div id="exProgress" class="export-progress" hidden></div>
      </section>

      <section class="card">
        <div class="toolbar"><div><h3>What will be exported</h3><p class="muted">Anything StudioFlow can't publish is listed here rather than quietly dropped.</p></div></div>
        ${built.report.folds.length ? `<div class="notice"><b>Matted materials folded into a mat add-on:</b><br>${built.report.folds.map(f => sf.esc(f)).join('<br>')}</div>` : ''}
        ${problem('photograph(s) with no image', built.report.noImage)}
        ${problem('photograph(s) not filed in a gallery', built.report.noGallery)}
        ${problem('photograph(s) with no priced size', built.report.noPrice)}
        ${built.report.skipped.length ? `<details class="export-problem"><summary>${built.report.skipped.length} note(s)</summary><ul>${built.report.skipped.map(x => `<li>${sf.esc(x)}</li>`).join('')}</ul></details>` : ''}
        ${!built.report.noImage.length && !built.report.noGallery.length && !built.report.noPrice.length ? '<div class="empty-state">Every photograph in the workspace is publishable.</div>' : ''}
      </section>

      <section class="card">
        <div class="toolbar"><div><h3>Gallery look</h3><p class="muted">Each collection gets its own layout on the site. Changing one here changes only that gallery.</p></div></div>
        <label>Order of pieces within each gallery
          <select id="exGalOrder">
            <option value="sales" ${w.galleryOrder === 'sales' ? 'selected' : ''}>Best sellers first</option>
            <option value="catalogue" ${w.galleryOrder === 'catalogue' ? 'selected' : ''}>The order they are in StudioFlow</option>
          </select></label>
        <div class="help">Best sellers first uses units actually sold, from your own sales history.</div>
        <div class="commerce-table"><div class="commerce-row header"><span>Gallery</span><span>Layout</span><span>Accent</span><span>Cover picture</span></div>
        ${(cat ? cat.galleries : []).map(g => `<div class="commerce-row">
          <span><b>${sf.esc(g.name)}</b></span>
          <span><select data-gal-layout="${g.id}">${this.LAYOUTS.map(l => `<option value="${l.id}" ${l.id === g.layout ? 'selected' : ''}>${l.name}</option>`).join('')}</select></span>
          <span><input type="color" data-gal-accent="${g.id}" value="${g.accent}"></span>
          <span><button class="button secondary" data-gal-cover="${g.id}">${(w.galleryCovers || {})[g.id] ? 'Change\u2026' : 'Choose\u2026'}</button>
            ${(w.galleryCovers || {})[g.id] ? `<button class="button secondary" data-gal-cover-clear="${g.id}">\u2715</button>` : ''}</span>
        </div>`).join('') || '<div class="empty-state">No galleries yet.</div>'}</div>
        <p class="muted">With no cover chosen, a gallery uses its leading piece \u2014 which, with best sellers first, is your strongest seller in that collection.</p>
      </section>

      <section class="card">
        <div class="toolbar"><div><h3>Site details</h3><p class="muted">These aren't stored anywhere else in StudioFlow, so they live here and are remembered.</p></div></div>
        <div class="form-grid">
          <label>Contact email<input id="exEmail" value="${sf.esc(w.brand.email)}"></label>
          <label>Phone<input id="exPhone" value="${sf.esc(w.brand.phone)}"></label>
          <label>Location<input id="exLocation" value="${sf.esc(w.brand.location)}"></label>
          <label>Site address <small class="muted">\u2014 where this site will live</small><input id="exSiteUrl" value="${sf.esc(w.site.url)}" placeholder="https://fmphotography.ca"><span class="help">Needed for sharing cards, canonical links and the sitemap. Until it is set several search tags do nothing and no sitemap is written \u2014 and a wrong address is worse than none, so leave it blank rather than guess.</span></label>
          <label>Google Business Profile <small class="muted">\u2014 the share link</small><input id="exGoogleBiz" value="${sf.esc(w.site.googleBusiness)}" placeholder="https://g.page/..."><span class="help">The name, phone and location above must match that listing character for character, or the two read as different businesses.</span></label>
          <label>Instagram URL<input id="exInstagram" value="${sf.esc(w.brand.instagram)}"></label>
          <label>Portrait of you</label>
          <div class="row-actions">
            <button class="button secondary" id="exPickPortrait">${w.brand.portrait ? 'Change photo…' : 'Choose photo…'}</button>
            ${w.brand.portrait ? '<button class="button secondary" id="exClearPortrait">Remove</button>' : ''}
          </div>
          <div class="help">${w.brand.portrait
            ? 'Using: <b>' + sf.esc((w.brand.portrait && w.brand.portrait.name) || w.brand.portrait) + '</b>'
            : 'No portrait chosen. Opens a normal file window \u2014 no need to know the filename.'}</div>
          <label>Hero photograph <small class="muted">\u2014 one of your pieces, or any file</small>
            <select id="exHero"><option value="">First in the catalogue</option>${(cat ? cat.artworks : []).map(a => `<option value="${sf.esc(a.id)}" ${a.id === w.brand.heroArtworkId ? 'selected' : ''}>${sf.esc(a.title)}</option>`).join('')}</select></label>
          <div class="row-actions">
            <button class="button secondary" id="exPickHero">${w.brand.heroFile ? 'Change hero file\u2026' : 'Use a file instead\u2026'}</button>
            ${w.brand.heroFile ? '<button class="button secondary" id="exClearHero">Back to a piece</button>' : ''}
          </div>
          <div class="help">${w.brand.heroFile
            ? 'Using file: <b>' + sf.esc((w.brand.heroFile && w.brand.heroFile.name) || w.brand.heroFile) + '</b> \u2014 this overrides the list above.'
            : 'Or pick any image from disk if the shot you want isn\u2019t a catalogued piece.'}</div>
        </div>
        <label>Tagline<textarea id="exTagline">${sf.esc(w.brand.tagline)}</textarea></label>

        <p class="muted" style="margin-top:14px"><b>Home page pictures</b></p>
        <div class="form-grid">
          <div><label>Fine Art Gallery card</label>
            <div class="row-actions"><button class="button secondary" id="exCardFineArt">${w.cards.fineArt ? 'Change\u2026' : 'Choose\u2026'}</button>
              ${w.cards.fineArt ? '<button class="button secondary" id="exCardFineArtClear">Remove</button>' : ''}</div>
            <div class="help">${w.cards.fineArt ? sf.esc((w.cards.fineArt && w.cards.fineArt.name) || w.cards.fineArt) : 'None chosen'}</div></div>
          <div><label>Photography Services card</label>
            <div class="row-actions"><button class="button secondary" id="exCardServices">${w.cards.services ? 'Change\u2026' : 'Choose\u2026'}</button>
              ${w.cards.services ? '<button class="button secondary" id="exCardServicesClear">Remove</button>' : ''}</div>
            <div class="help">${w.cards.services ? sf.esc((w.cards.services && w.cards.services.name) || w.cards.services) : 'None chosen'}</div></div>
        </div>

        <p class="muted" style="margin-top:14px"><b>"See it, size it, make it yours" band</b></p>
        <div class="row-actions">
          <button class="button secondary" id="exSeeItPic">${w.seeIt.picture ? 'Change picture\u2026' : 'Choose picture\u2026'}</button>
          ${w.seeIt.picture ? '<button class="button secondary" id="exSeeItClear">Remove</button>' : ''}
        </div>
        <div class="form-grid">
          </div>
        ${this.colourRowFor('exSeeItColour','Text colour','the words on this band',w.seeIt.colour || w.theme.ink || '#14171a')}
        ${this.colourRowFor('exSeeItBg','Background','the band behind them',w.seeIt.background || w.theme.paper2 || '#f0eeea')}
        ${this.fontRowFor('exSeeItHeadFont','Heading typeface','',w.seeIt.headingFont,'A more confident way to buy art')}
        ${this.sizeRowFor('exSeeItHeadSize','Heading size',w.seeIt.headingSize)}
        ${this.fontRowFor('exSeeItBodyFont','Body typeface','',w.seeIt.bodyFont,'See the piece on your own wall before you order it.')}
        ${this.sizeRowFor('exSeeItBodySize','Body size',w.seeIt.bodySize)}
        <div class="form-grid">

        <p class="muted" style="margin-top:14px"><b>\u201cAbout the artist\u201d panel</b></p>
        <div class="form-grid">
</div>
        ${this.colourRowFor('exAboutBg','Background','the panel behind the words',w.about.background || '#22262b')}
        ${this.colourRowFor('exAboutFg','Text','the words themselves',w.about.colour || '#e9e7e3')}
        ${this.colourRowFor('exAboutKick','\u201cABOUT THE ARTIST\u201d kicker','the small line above the heading',w.about.eyebrowColour || w.theme.accent || '#2f6fb0')}
        ${this.fontRowFor('exAboutHeadFont','Heading typeface','',w.about.headingFont,'About the artist')}
        ${this.sizeRowFor('exAboutHeadSize','Heading size',w.about.headingSize)}
        ${this.fontRowFor('exAboutBodyFont','Body typeface','',w.about.bodyFont,'Twenty-five years photographing the west coast.')}
        ${this.sizeRowFor('exAboutBodySize','Body size',w.about.bodySize)}
        <div class="form-grid">
        <label class="checkline"><input type="checkbox" id="exAboutOn" ${w.about.enabled === false ? '' : 'checked'}> Use these colours on the About panel</label>
        <div class="help">Your portrait is shown whole on this panel \u2014 it is never cropped to a shape.
        If the live site still shows a pale panel or half a photograph, that folder was exported from an
        older template: run the export again and it is replaced.</div>
        <div class="row-actions"><button class="button secondary" id="exSave">Save Site Details</button></div>
      </section>

      <section class="card">
        <div class="toolbar"><div><h3>Services</h3><p class="muted">The five service pages. StudioFlow has no record of these, so the words are yours to write.</p></div></div>
        ${w.services.map((s, i) => `<div class="export-service">
          <div class="form-grid">
            <label>Name<input data-svc="${i}" data-svc-field="name" value="${sf.esc(s.name)}"></label>
            <label>Short label<input data-svc="${i}" data-svc-field="short" value="${sf.esc(s.short || '')}"></label>
          </div>
          <label>One-line summary<input data-svc="${i}" data-svc-field="blurb" value="${sf.esc(s.blurb || '')}"></label>
          <label>Full description<textarea data-svc="${i}" data-svc-field="detail">${sf.esc(s.detail || '')}</textarea></label>

          <div class="form-grid">
            <div>
              <label>Tile picture <small class="muted">\u2014 the card on the services page</small></label>
              <div class="row-actions">
                <button class="button secondary" data-svc-pic="${i}">${s.picture ? 'Change\u2026' : 'Choose\u2026'}</button>
                ${s.picture ? `<button class="button secondary" data-svc-pic-clear="${i}">Remove</button>` : ''}
              </div>
              <div class="help">${s.picture ? sf.esc((s.picture && s.picture.name) || s.picture) : 'None chosen'}</div>
            </div>
            <div>
              <label>Hero picture <small class="muted">\u2014 the big image at the top of this page</small></label>
              <div class="row-actions">
                <button class="button secondary" data-svc-hero="${i}">${s.heroPicture ? 'Change\u2026' : 'Choose\u2026'}</button>
                ${s.heroPicture ? `<button class="button secondary" data-svc-hero-clear="${i}">Remove</button>` : ''}
              </div>
              <div class="help">${s.heroPicture ? sf.esc((s.heroPicture && s.heroPicture.name) || s.heroPicture) : 'None chosen \u2014 the tile picture is used instead'}</div>
            </div>
          </div>

          <!-- g155: the hero window, at the shape it will really be, with the picture inside it. -->
          <div class="hero-stage-wrap" data-hero-stage="${i}">
            <label>How this hero will look <small class="muted">\u2014 drag the picture to choose what shows</small></label>
            <div class="hero-stage he-${sf.esc(s.heroHeight || 'standard')}" data-hero-box="${i}">
              <div class="hero-stage-empty">${s.heroPicture || s.picture ? 'Loading the picture\u2026' : 'Choose a hero picture to see it here'}</div>
            </div>
            <div class="row-actions" style="margin-top:8px">
              ${[['short','Short'],['standard','Standard'],['tall','Tall'],['full','Whole picture']].map(h =>
                `<button class="button ${ (s.heroHeight || 'standard') === h[0] ? 'primary' : 'secondary'}" data-hero-h="${i}.${h[0]}">${h[1]}</button>`).join('')}
              <button class="button secondary" data-hero-centre="${i}">Recentre</button>
              <span class="help" data-hero-note="${i}"></span>
            </div>
          </div>
          <label>Headline over the hero<input data-svc="${i}" data-svc-field="heroHeadline" value="${sf.esc(s.heroHeadline || '')}" placeholder="e.g. Explore our packages"></label>

          <div class="export-subcard">
            <div class="toolbar"><b>Packages &amp; prices</b>
              <button class="button secondary" data-svc-pkg-add="${i}">Add a package</button></div>
            ${(s.packages || []).length ? (s.packages || []).map((pk, n) => `<div class="export-package">
              <div class="form-grid">
                <label>Name<input data-pkg="${i}.${n}" data-pkg-field="name" value="${sf.esc(pk.name || '')}"></label>
                <label>Price <small class="muted">\u2014 a number, or text like "From $1,725"</small><input data-pkg="${i}.${n}" data-pkg-field="price" value="${sf.esc(pk.price == null ? '' : pk.price)}"></label>
              </div>
              <label>Short description<input data-pkg="${i}.${n}" data-pkg-field="blurb" value="${sf.esc(pk.blurb || '')}"></label>
              <label>What's included <small class="muted">\u2014 one per line</small><textarea data-pkg="${i}.${n}" data-pkg-field="bullets" rows="3">${sf.esc((pk.bullets || []).join('\n'))}</textarea></label>
              <label class="checkline"><input type="checkbox" data-pkg="${i}.${n}" data-pkg-field="popular" ${pk.popular ? 'checked' : ''}> Show a <b>Most Popular</b> badge on this package</label>
              <div class="row-actions">
                <button class="button secondary" data-pkg-pic="${i}.${n}">${pk.picture ? 'Change picture\u2026' : 'Choose picture\u2026'}</button>
                ${pk.picture ? `<button class="button secondary" data-pkg-pic-clear="${i}.${n}">Remove picture</button>` : ''}
                <button class="button secondary" data-pkg-up="${i}.${n}" ${n === 0 ? 'disabled' : ''}>\u2191</button>
                <button class="button secondary" data-pkg-down="${i}.${n}" ${n === (s.packages.length - 1) ? 'disabled' : ''}>\u2193</button>
                <button class="button danger" data-pkg-del="${i}.${n}">Remove</button>
              </div>
              <div class="help">${pk.picture ? sf.esc((pk.picture && pk.picture.name) || pk.picture) : 'No picture'}</div>
            </div>`).join('') : '<p class="muted">No packages yet. Add one for each option you offer \u2014 they appear down this service\u2019s page with the picture beside the price.</p>'}
          </div>

          <div class="export-subcard">
            <div class="toolbar"><b>Gallery</b>
              <span class="badge">${(s.gallery || []).length} image(s)</span></div>
            <p class="muted">Recent work, shown at the bottom of this page. Add as many as you like \u2014 25 or more is fine; they are written at export, not stored in the database.</p>
            <div class="row-actions">
              <button class="button secondary" data-svc-gal="${i}">Add images\u2026</button>
              ${(s.gallery || []).length ? `<button class="button secondary" data-svc-gal-clear="${i}">Clear all</button>` : ''}
            </div>
            ${(s.gallery || []).length ? `<div class="export-gallery-list">${(s.gallery || []).map((g, n) =>
              `<span class="export-gallery-chip">${sf.esc((g && g.name) || g)}<button data-svc-gal-del="${i}.${n}" title="Remove">\u2715</button></span>`).join('')}</div>` : ''}
          </div>
        </div>`).join('')}
        <div class="row-actions"><button class="button secondary" id="exSaveServices">Save Services</button></div>
        <p class="muted">Pictures stay where they are on disk — StudioFlow remembers the path and copies a web-sized copy in at export, so the database doesn't grow.</p>
      </section>

      <section class="card">
        <div class="toolbar"><div><h3>Free tools</h3>
          <p class="muted">Things you give away \u2014 Loupe, a guide, anything downloadable. The
          Free Tools page and its nav link only appear once there is something here, so leaving this
          empty keeps them hidden.</p></div>
          <button class="button secondary" id="exAddTool">Add a tool</button></div>
        ${(w.downloads || []).length ? (w.downloads || []).map((d, i) => `<div class="export-service">
          <div class="form-grid">
            <label>Name<input data-dl="${i}" data-dl-field="name" value="${sf.esc(d.name || '')}" placeholder="Loupe"></label>
            <label>Kicker <small class="muted">\u2014 the small line above</small><input data-dl="${i}" data-dl-field="kicker" value="${sf.esc(d.kicker || '')}" placeholder="Free \u00b7 no account \u00b7 nothing uploaded"></label>
          </div>
          <label>One-line tagline<input data-dl="${i}" data-dl-field="tagline" value="${sf.esc(d.tagline || '')}"></label>
          <label>Description<textarea data-dl="${i}" data-dl-field="body" rows="3">${sf.esc(d.body || '')}</textarea></label>
          <label>Key points <small class="muted">\u2014 one per line</small><textarea data-dl="${i}" data-dl-field="points" rows="3" placeholder="Exposure, focus and composition, measured\nNothing leaves your device">${sf.esc(d.points || '')}</textarea></label>
          <div class="form-grid">
            <label>Price line<input data-dl="${i}" data-dl-field="price" value="${sf.esc(d.price || '')}" placeholder="Free, and staying free."></label>
            <label>Support link <small class="muted">\u2014 optional</small><input data-dl="${i}" data-dl-field="supportUrl" value="${sf.esc(d.supportUrl || '')}" placeholder="https://buymeacoffee.com/\u2026"></label>
          </div>
          <label>Support note <small class="muted">\u2014 the line under that link</small><input data-dl="${i}" data-dl-field="supportNote" value="${sf.esc(d.supportNote || '')}" placeholder="If it earns a place in how you work\u2026"></label>
          <div class="row-actions">
            <button class="button secondary" data-dl-pic="${i}">${d.picture ? 'Change picture\u2026' : 'Choose picture\u2026'}</button>
            <button class="button secondary" data-dl-files="${i}">Add a file\u2026</button>
            <button class="button secondary" data-dl-link="${i}">Add a link\u2026</button>
            <button class="button danger" data-dl-del="${i}">Remove</button>
          </div>
          ${(d.files || []).length ? `<div class="export-gallery-list">${(d.files || []).map((f, n) =>
            `<span class="export-gallery-chip">${f.href ? '\ud83d\udd17 ' : ''}${sf.esc(f.label || f.name)}<button data-dl-file-del="${i}.${n}" title="Remove">\u2715</button></span>`).join('')}</div>` : '<div class="help">Nothing yet \u2014 the tool will not appear on the site until a file or a link is added.</div>'}
          <div class="help">A <b>file</b> is copied into the exported site. A <b>link</b> points somewhere else \u2014 use one for a GitHub release, because GitHub counts every download and nothing on your page has to.</div>
        </div>`).join('') : '<p class="muted">Nothing offered yet.</p>'}
        <div class="row-actions" style="margin-top:10px"><button class="button secondary" id="exSaveTools">Save</button></div>

        <div class="export-subcard">
          <div class="toolbar"><b>How many people took it</b>
            <button class="button secondary" id="exCheckDownloads">Check now</button></div>
          <p class="muted">If the files are on a GitHub release, GitHub counts every download and
          reports it publicly \u2014 no tracking script, nothing for a browser to block. That is the
          reason for putting them there rather than on Squarespace, where downloads are invisible.</p>
          <div class="form-grid">
            <label>GitHub owner<input id="exGhOwner" value="${sf.esc(w.github.owner || '')}" placeholder="your GitHub username\u2026"></label>
            <label>Repository<input id="exGhRepo" value="${sf.esc(w.github.repo || '')}" placeholder="the repository name\u2026"></label>
          </div>
          <div id="exDownloadCounts" class="help">${w.github.owner && w.github.repo
            ? `Saved as <b>${sf.esc(w.github.owner)}/${sf.esc(w.github.repo)}</b>. Press Check now.`
            : 'Both boxes are still empty. Type into them, then press Check now.'}</div>
        </div>
      </section>

      <section class="card">
        <div class="toolbar"><div><h3>Theme</h3><p class="muted">Colours, fonts and header style for the whole site. The template reads every one of these as data and maps them onto its stylesheet, so nothing here edits CSS — pick a preset, then adjust.</p></div></div>
        <label>Start from a preset
          <select id="exThemePreset"><option value="">\u2014 keep current \u2014</option>
            ${(w.themePresets || []).length ? `<optgroup label="Yours">${(w.themePresets || []).map((p, i) =>
              `<option value="mine:${i}">${sf.esc(p.name)}</option>`).join('')}</optgroup>` : ''}
            <optgroup label="Built in">${this.THEME_PRESETS.map((p, i) =>
              `<option value="${i}">${sf.esc(p.name)}</option>`).join('')}</optgroup>
          </select></label>
        <div class="row-actions" style="margin-top:6px">
          <input id="exThemeName" placeholder="Name for these colours, e.g. Frozen Moments Classic" style="flex:1;min-width:220px">
          <button class="button secondary" id="exSaveTheme2">Save as a preset</button>
          ${(w.themePresets || []).length ? '<button class="button secondary" id="exDelTheme">Delete the selected one</button>' : ''}
        </div>
        <div class="help">Saving under a name that already exists replaces it \u2014 so you can adjust and re-save the same one.</div>
        <div class="form-grid">
          ${this.colourRow('ink','Text','the main words',w.theme.ink)}
          ${this.colourRow('inkSoft','Secondary text','captions and notes',w.theme.inkSoft)}
          ${this.colourRow('paper','Background','the page itself',w.theme.paper)}
          ${this.colourRow('paper2','Panels','cards and raised areas',w.theme.paper2)}
          ${this.colourRow('line','Borders','rules and edges',w.theme.line)}
          ${this.colourRow('accent','Accent','links and highlights',w.theme.accent)}
          ${this.colourRow('fmBlue','Book Now button','',w.theme.fmBlue || '#8ecae6')}
        </div>
        <div class="theme-fonts">
          ${this.fontRow('headingFont','Heading typeface','used for titles',w.theme.headingFont,'Shannon Falls')}
          ${this.fontRow('bodyFont','Body typeface','used for everything else',w.theme.bodyFont,'A long exposure at first light, the falls in full spring melt.')}
          ${this.sizeRow('textScale','Text size',w.theme.textScale)}
          <label>Corner radius <input data-theme="radius" value="${sf.esc(w.theme.radius)}" placeholder="2px"></label>
          <label>Header <select data-theme="header">
            <option value="light" ${w.theme.header === 'light' ? 'selected' : ''}>Light</option>
            <option value="dark" ${w.theme.header === 'dark' ? 'selected' : ''}>Dark charcoal</option>
          </select></label>
        </div>
        <label class="export-check"><input type="checkbox" data-theme="heroTransparent" ${w.theme.heroTransparent ? 'checked' : ''}> Header floats transparently over the home page hero</label>
        <p class="muted">Fonts are any family name from Google Fonts \u2014 the site loads whatever you name here. A name that doesn't exist there falls back to the system font rather than breaking the page.</p>
        <div class="row-actions"><button class="button secondary" id="exSaveTheme">Save Theme</button></div>
      </section>

      <section class="card">
        <div class="toolbar"><div><h3>News posts</h3><p class="muted">Anything that isn't a market or show \u2014 a course, an award, a new collection. Your markets are already pulled from the calendar; these are added alongside them, pinned ones first, six shown in total.</p></div>
          <button class="button secondary" id="exAddPost">Add a post</button></div>
        ${(w.newsPosts || []).length ? (w.newsPosts || []).map((n, i) => `<div class="export-service">
          <div class="form-grid">
            <label>Title<input data-post="${i}" data-post-field="title" value="${sf.esc(n.title || '')}"></label>
            <label>When <small class="muted">\u2014 free text</small><input data-post="${i}" data-post-field="when" value="${sf.esc(n.when || '')}" placeholder="October 2026"></label>
          </div>
          <label>Blurb<textarea data-post="${i}" data-post-field="blurb">${sf.esc(n.blurb || '')}</textarea></label>
          <label>Link <small class="muted">\u2014 optional</small><input data-post="${i}" data-post-field="link" value="${sf.esc(n.link || '')}" placeholder="https://\u2026"></label>
          <div class="row-actions">
            <button class="button secondary" data-post-pic="${i}">${n.picture ? 'Change picture' : 'Choose picture'}</button>
            ${n.picture ? `<button class="button secondary" data-post-pic-clear="${i}">Remove picture</button>` : ''}
            <label class="export-check"><input type="checkbox" data-post="${i}" data-post-field="pinned" ${n.pinned ? 'checked' : ''}> Pin to the top</label>
            <button class="button secondary" data-post-up="${i}" ${i === 0 ? 'disabled' : ''}>\u2191</button>
            <button class="button secondary" data-post-down="${i}" ${i === (w.newsPosts.length - 1) ? 'disabled' : ''}>\u2193</button>
            <button class="button danger" data-post-del="${i}">Remove</button>
          </div>
          <p class="muted">${n.picture ? 'Picture: ' + sf.esc((n.picture && n.picture.name) || n.picture) : 'No picture \u2014 the post will borrow an artwork thumbnail.'}</p>
        </div>`).join('') : '<p class="muted">No posts yet. Your upcoming markets still appear on the site on their own.</p>'}
        <div class="row-actions"><button class="button secondary" id="exSavePosts">Save Posts</button></div>
      </section>
    </div>`;

    /* ---- wiring ---- */
    const $ = id => sf.$(id);

    /* g102 theme + news wiring. Typed fields update in place and are committed on Save, matching
       how Services already behaves; re-rendering per keystroke would steal focus. */
    /* g113: portrait and hero are chosen through the normal file window now. Kirk's files are
       not descriptively named, so a list of filenames was useless — he needs to see the pictures.
       The picker returns PATHS, so nothing large enters the database. */
    /* g116 — SERVICE PICTURES, HERO, PACKAGES AND GALLERY.
       The handlers for the tile picture and gallery already existed, but the BUTTONS that trigger
       them were missing from the markup — which is why Kirk found no picker on any service, not
       just real estate. Rebuilt, and extended with a hero picture, package rows and an unlimited
       gallery. Every picture is a PATH; bytes are read at export. */
    const svcPick = async (idx, key, title, multiple) => {
      const picked = await window.studioflow.siteChoosePictures({ multiple: !!multiple, title });
      const list = (picked && (picked.files || picked)) || [];
      if (!list.length) return;
      const svc = w.services[idx]; if (!svc) return;
      if (multiple) { svc.gallery = (svc.gallery || []).concat(list); }
      else { svc[key] = list[0]; }
      await sf.persist(); this.render();
    };
    const pkgAt = (ref) => {
      const [a, b] = String(ref).split('.').map(Number);
      const svc = w.services[a]; if (!svc) return null;
      svc.packages = svc.packages || [];
      return { svc, i: b, pkg: svc.packages[b] };
    };
    const readServices = () => {
      document.querySelectorAll('[data-svc]').forEach(el => {
        const svc = w.services[Number(el.dataset.svc)], f = el.dataset.svcField;
        if (svc && f) svc[f] = el.value;
      });
      document.querySelectorAll('[data-pkg]').forEach(el => {
        const r = pkgAt(el.dataset.pkg), f = el.dataset.pkgField;
        if (!r || !r.pkg || !f) return;
        /* g154: a CHECKBOX carries its answer in .checked — `el.value` on a ticked box is the
           string "on", which would have stored a truthy value for BOTH states. The tick shares
           the [data-pkg] loop deliberately: g138's lesson is that any field outside the loop a
           Save handler iterates is silently discarded. */
        if (el.type === 'checkbox') r.pkg[f] = !!el.checked;
        else if (f === 'bullets') r.pkg.bullets = String(el.value || '').split('\n').map(x => x.trim()).filter(Boolean);
        else if (f === 'price') {
          const raw = String(el.value || '').trim();
          /* A bare number stays a number so the template formats it; anything else is his own
             wording ("From $1,725") and passes through untouched. */
          r.pkg.price = raw === '' ? '' : (/^\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw);
        }
        else r.pkg[f] = el.value;
      });
    };
    document.querySelectorAll('[data-svc-pic]').forEach(b => b.onclick = () => { readServices(); svcPick(Number(b.dataset.svcPic), 'picture', 'Choose the tile picture'); });
    document.querySelectorAll('[data-svc-pic-clear]').forEach(b => b.onclick = async () => { readServices(); w.services[Number(b.dataset.svcPicClear)].picture = ''; await sf.persist(); this.render(); });
    document.querySelectorAll('[data-svc-hero]').forEach(b => b.onclick = () => { readServices(); svcPick(Number(b.dataset.svcHero), 'heroPicture', 'Choose the hero picture'); });

    /* ==========================================================================================
       g155 — SEE THE PICTURE, SEE WHAT FITS, DRAG IT INTO PLACE.
       ==========================================================================================
       Kirk: "can i see the picture and what will fit in the window inside the export theme card
       and move it into place?" Until now this page listed FILENAMES; the crop could only be judged
       after an export, and hero.height / hero.focus existed only in the template's studio panel and
       overrides.js — outside StudioFlow entirely, so they were never backed up and never exported.

       THE PREVIEW BOX IS THE REAL SHAPE. Heights on the site are viewport-relative (short 36vh /
       standard 52vh / tall 72vh / full 88vh), so the box here is sized as that fraction of a 16:9
       window rather than a made-up rectangle. A preview whose proportions differ from the page
       teaches the wrong crop, which would be worse than no preview.

       "Whole picture" (full) uses background-size:contain exactly as the template does — the image
       is shown COMPLETE with space around it rather than cropped, so dragging does nothing there
       and the note says so instead of leaving him wondering why.

       Bytes come from site:previewImage, which decodes through the SAME aiReferenceBytes path the
       export writes with — so a picture that previews is one that will export, and a format that
       cannot be decoded is reported here rather than at export time.
       ========================================================================================== */
    const heroSrc = svc => (svc.heroPicture || svc.picture || null);
    const focusOf = svc => {
      const f = Number(svc.heroFocus);
      return isFinite(f) ? Math.max(0, Math.min(100, f)) : 50;
    };

    const paintHero = (i, meta) => {
      const box = document.querySelector(`[data-hero-box="${i}"]`);
      const svc = w.services[i];
      if (!box || !svc) return;
      const height = svc.heroHeight || 'standard';
      box.className = 'hero-stage he-' + height;
      if (meta && meta.dataUrl) {
        box.style.backgroundImage = `url("${meta.dataUrl}")`;
        box.style.backgroundSize = height === 'full' ? 'contain' : 'cover';
        box.style.backgroundPosition = `center ${focusOf(svc)}%`;
        box.style.backgroundRepeat = 'no-repeat';
        box.innerHTML = height === 'full' ? '' : '<span class="hero-stage-tip">Drag to move the picture</span>';
      }
      const note = document.querySelector(`[data-hero-note="${i}"]`);
      if (note) {
        if (!meta || !meta.dataUrl) note.textContent = '';
        else if (height === 'full') note.textContent = `The whole ${meta.width}\u00d7${meta.height} picture is shown, so there is nothing to crop.`;
        else note.textContent = `${meta.width}\u00d7${meta.height} \u00b7 showing ${focusOf(svc)}% down the picture.`;
      }
    };

    /* One fetch per service, cached on the service object for this render. Re-fetching on every
       repaint would put an IPC round trip behind every drag frame. */
    const heroMeta = {};
    const loadHero = async i => {
      const svc = w.services[i], src = svc && heroSrc(svc);
      const box = document.querySelector(`[data-hero-box="${i}"]`);
      if (!box) return;
      if (!src) { box.innerHTML = '<div class="hero-stage-empty">Choose a hero picture to see it here</div>'; return; }
      const key = (src && src.path) || src;
      try {
        const r = await sf.api.sitePreviewImage?.({ source: key, max: 900 });
        if (!r || !r.ok) {
          box.innerHTML = `<div class="hero-stage-empty">${sf.esc((r && r.error) || 'That picture could not be previewed.')}</div>`;
          return;
        }
        heroMeta[i] = r;
        paintHero(i, r);
      } catch (e) {
        box.innerHTML = '<div class="hero-stage-empty">That picture could not be previewed.</div>';
      }
    };

    document.querySelectorAll('[data-hero-h]').forEach(b => b.onclick = async () => {
      readServices();
      const [i, h] = b.dataset.heroH.split('.');
      const svc = w.services[Number(i)];
      if (!svc) return;
      svc.heroHeight = h;
      await sf.persist();
      this.render();
    });
    document.querySelectorAll('[data-hero-centre]').forEach(b => b.onclick = async () => {
      const i = Number(b.dataset.heroCentre), svc = w.services[i];
      if (!svc) return;
      svc.heroFocus = 50;
      paintHero(i, heroMeta[i]);
      await sf.persist();
    });

    /* DRAG. Pointer DOWN moves the picture down, which means showing a HIGHER percentage — the
       same direction the template's studio drag uses, so the two behave identically and a position
       set in one place still reads correctly in the other. */
    document.querySelectorAll('[data-hero-box]').forEach(box => {
      const i = Number(box.dataset.heroBox);
      let dragging = false, startY = 0, startFocus = 50;
      box.onpointerdown = e => {
        const svc = w.services[i];
        if (!svc || !heroMeta[i] || (svc.heroHeight || 'standard') === 'full') return;
        dragging = true; startY = e.clientY; startFocus = focusOf(svc);
        box.setPointerCapture?.(e.pointerId);
        box.classList.add('is-dragging');
        e.preventDefault();
      };
      box.onpointermove = e => {
        if (!dragging) return;
        const svc = w.services[i];
        const travel = Math.max(60, box.clientHeight);
        svc.heroFocus = Math.max(0, Math.min(100, startFocus - ((e.clientY - startY) / travel) * 100));
        paintHero(i, heroMeta[i]);
      };
      const stop = async e => {
        if (!dragging) return;
        dragging = false;
        try { box.releasePointerCapture?.(e.pointerId); } catch (_) {}
        box.classList.remove('is-dragging');
        const svc = w.services[i];
        if (svc) svc.heroFocus = Math.round(focusOf(svc));
        paintHero(i, heroMeta[i]);
        await sf.persist();
      };
      box.onpointerup = stop; box.onpointercancel = stop;
      loadHero(i);
    });
    document.querySelectorAll('[data-svc-hero-clear]').forEach(b => b.onclick = async () => { readServices(); w.services[Number(b.dataset.svcHeroClear)].heroPicture = ''; await sf.persist(); this.render(); });
    document.querySelectorAll('[data-svc-gal]').forEach(b => b.onclick = () => { readServices(); svcPick(Number(b.dataset.svcGal), 'gallery', 'Choose images for this page', true); });
    document.querySelectorAll('[data-svc-gal-clear]').forEach(b => b.onclick = async () => { readServices(); w.services[Number(b.dataset.svcGalClear)].gallery = []; await sf.persist(); this.render(); });
    document.querySelectorAll('[data-svc-gal-del]').forEach(b => b.onclick = async () => {
      readServices();
      const [a, n] = String(b.dataset.svcGalDel).split('.').map(Number);
      (w.services[a].gallery || []).splice(n, 1);
      await sf.persist(); this.render();
    });
    document.querySelectorAll('[data-svc-pkg-add]').forEach(b => b.onclick = async () => {
      readServices();
      const svc = w.services[Number(b.dataset.svcPkgAdd)];
      svc.packages = svc.packages || [];
      svc.packages.push({ name: '', price: '', blurb: '', bullets: [], picture: '' });
      await sf.persist(); this.render();
    });
    document.querySelectorAll('[data-pkg-pic]').forEach(b => b.onclick = async () => {
      readServices();
      const r = pkgAt(b.dataset.pkgPic); if (!r || !r.pkg) return;
      const picked = await window.studioflow.siteChoosePictures({ multiple: false, title: 'Choose the package picture' });
      const one = picked && (picked.files || picked)[0];
      if (!one) return;
      r.pkg.picture = one; await sf.persist(); this.render();
    });
    document.querySelectorAll('[data-pkg-pic-clear]').forEach(b => b.onclick = async () => {
      readServices(); const r = pkgAt(b.dataset.pkgPicClear); if (r && r.pkg) r.pkg.picture = '';
      await sf.persist(); this.render();
    });
    document.querySelectorAll('[data-pkg-del]').forEach(b => b.onclick = async () => {
      readServices(); const r = pkgAt(b.dataset.pkgDel); if (r) r.svc.packages.splice(r.i, 1);
      await sf.persist(); this.render();
    });
    const pkgMove = async (ref, delta) => {
      readServices(); const r = pkgAt(ref); if (!r) return;
      const to = r.i + delta; if (to < 0 || to >= r.svc.packages.length) return;
      const [x] = r.svc.packages.splice(r.i, 1); r.svc.packages.splice(to, 0, x);
      await sf.persist(); this.render();
    };
    document.querySelectorAll('[data-pkg-up]').forEach(b => b.onclick = () => pkgMove(b.dataset.pkgUp, -1));
    document.querySelectorAll('[data-pkg-down]').forEach(b => b.onclick = () => pkgMove(b.dataset.pkgDown, 1));

    /* g131 free-tools wiring. Files are stored as PATHS and copied at export, same as every other
       picture on this page — a zip has no business inside a 100MB database. */
    const readTools = () => {
      document.querySelectorAll('[data-dl]').forEach(el => {
        const d = w.downloads[Number(el.dataset.dl)], f = el.dataset.dlField;
        if (d && f) d[f] = el.value;
      });
      /* g139: these two were NOT read here, so pressing Save re-rendered the card and silently
         discarded whatever had been typed into them — which is why the count never appeared and
         "Both boxes are needed" came back on a form that looked filled in. */
      if ($('exGhOwner')) w.github.owner = $('exGhOwner').value.trim();
      if ($('exGhRepo')) w.github.repo = $('exGhRepo').value.trim();
    };
    ['exGhOwner', 'exGhRepo'].forEach(id => {
      const el = $(id); if (!el) return;
      el.onchange = async () => {
        w.github.owner = $('exGhOwner').value.trim();
        w.github.repo = $('exGhRepo').value.trim();
        await sf.persist();
      };
    });
    if ($('exCheckDownloads')) $('exCheckDownloads').onclick = async () => {
      w.github.owner = $('exGhOwner').value.trim();
      w.github.repo = $('exGhRepo').value.trim();
      await sf.persist();
      const host = $('exDownloadCounts');
      if (!w.github.owner || !w.github.repo) { host.textContent = 'Both boxes are needed.'; return; }
      host.textContent = 'Asking GitHub\u2026';
      const r = await window.studioflow.githubReleaseStats({ owner: w.github.owner, repo: w.github.repo });
      if (!r || !r.ok) { host.innerHTML = `<b>Couldn't check:</b> ${sf.esc((r && r.error) || 'no answer')}`; return; }
      if (!r.assets.length) {
        host.innerHTML = `That repository has ${r.releases} release(s) but no attached files yet.
          Attach the download to a release and the count appears here.`;
        return;
      }
      host.innerHTML = `<b>${r.total}</b> download(s) in total.<ul>${r.assets.map(a =>
        `<li>${sf.esc(a.name)} \u2014 <b>${a.count}</b>${a.release ? ` <span class="muted">(${sf.esc(a.release)})</span>` : ''}</li>`).join('')}</ul>
        <span class="muted">Counts the file being fetched. It does not include people who used the
        live version without downloading, and it will include the odd bot \u2014 treat it as a floor.</span>`;
    };

    if ($('exAddTool')) $('exAddTool').onclick = async () => {
      readTools();
      w.downloads.push({ id: 'dl' + Date.now().toString(36), name: '', kicker: '', tagline: '',
        body: '', supportUrl: '', picture: '', files: [] });
      await sf.persist(); this.render();
    };
    if ($('exSaveTools')) $('exSaveTools').onclick = async () => { readTools(); await sf.persist(); this.render(); };
    document.querySelectorAll('[data-dl-del]').forEach(b => b.onclick = async () => {
      readTools(); w.downloads.splice(Number(b.dataset.dlDel), 1);
      await sf.persist(); this.render();
    });
    document.querySelectorAll('[data-dl-pic]').forEach(b => b.onclick = async () => {
      readTools();
      const picked = await window.studioflow.siteChoosePictures({ multiple: false, title: 'Choose a picture for this tool' });
      const one = picked && (picked.files || picked)[0];
      if (!one) return;
      w.downloads[Number(b.dataset.dlPic)].picture = one;
      await sf.persist(); this.render();
    });
    document.querySelectorAll('[data-dl-files]').forEach(b => b.onclick = async () => {
      readTools();
      const files = await window.studioflow.siteChooseDownloads();
      if (!files || !files.length) return;
      const d = w.downloads[Number(b.dataset.dlFiles)];
      files.forEach(f => d.files.push({
        name: f.name, path: f.path, bytes: f.bytes,
        /* A sensible button label straight away; he can retype it. */
        label: /desktop|win/i.test(f.name) ? 'Download for Windows'
             : /web/i.test(f.name) ? 'Open in a browser' : 'Download'
      }));
      await sf.persist(); this.render();
    });
    document.querySelectorAll('[data-dl-link]').forEach(b => b.onclick = async () => {
      readTools();
      /* g137: a download can be a LINK as well as a file. A file gets copied into the site and is
         invisible to counting; a link can point at a GitHub release, which counts every fetch with
         no script on the page. That is the whole reason for offering both. */
      const d = w.downloads[Number(b.dataset.dlLink)];
      const url = await this.askForLink();
      if (!url) return;
      const label = this._pendingLinkLabel
        || (/github\.com\/.+\/releases/i.test(url) ? 'Download' : 'Open it');
      this._pendingLinkLabel = '';
      d.files.push({ label, href: url, name: url });
      await sf.persist(); this.render();
    });
    document.querySelectorAll('[data-dl-file-del]').forEach(b => b.onclick = async () => {
      readTools();
      const [a, n] = String(b.dataset.dlFileDel).split('.').map(Number);
      w.downloads[a].files.splice(n, 1);
      await sf.persist(); this.render();
    });

    const pickCard = async (key, title) => {
      const picked = await window.studioflow.siteChoosePictures({ multiple: false, title });
      const one = picked && (picked.files || picked)[0];
      if (!one) return;
      w.cards[key] = one; await sf.persist(); this.render();
    };
    if ($('exCardFineArt')) $('exCardFineArt').onclick = () => pickCard('fineArt', 'Choose the Fine Art Gallery card picture');
    if ($('exCardServices')) $('exCardServices').onclick = () => pickCard('services', 'Choose the Photography Services card picture');
    if ($('exCardFineArtClear')) $('exCardFineArtClear').onclick = async () => { w.cards.fineArt=''; await sf.persist(); this.render(); };
    if ($('exCardServicesClear')) $('exCardServicesClear').onclick = async () => { w.cards.services=''; await sf.persist(); this.render(); };
    if ($('exSeeItPic')) $('exSeeItPic').onclick = async () => {
      const picked = await window.studioflow.siteChoosePictures({ multiple: false, title: 'Choose the feature band picture' });
      const one = picked && (picked.files || picked)[0];
      if (!one) return;
      w.seeIt.picture = one; await sf.persist(); this.render();
    };
    if ($('exSeeItClear')) $('exSeeItClear').onclick = async () => { w.seeIt.picture=''; await sf.persist(); this.render(); };
    ['exAboutBg','exAboutFg','exAboutKick','exAboutOn'].forEach(id => {
      const el = $(id); if (!el) return;
      el.onchange = async () => {
        /* g183 — READ BACK EVERY NEW FIELD. A control that renders but is never read is the exact
         fault that lost the GitHub owner/repo boxes at g137: it looks saved, reopens blank, and
         nothing reports a problem. Each is guarded so an older card that lacks the element cannot
         throw and take the whole Save with it. */
      const val = id => { const el = $(id); return el ? String(el.value || '').trim() : null; };
      const put = (obj, key, id) => { const v = val(id); if (v !== null) obj[key] = v; };
      put(w.about, 'headingFont', 'exAboutHeadFont');
      put(w.about, 'headingSize', 'exAboutHeadSize');
      put(w.about, 'bodyFont',    'exAboutBodyFont');
      put(w.about, 'bodySize',    'exAboutBodySize');
      put(w.seeIt, 'background',  'exSeeItBg');
      put(w.seeIt, 'headingFont', 'exSeeItHeadFont');
      put(w.seeIt, 'bodyFont',    'exSeeItBodyFont');
      put(w.seeIt, 'bodySize',    'exSeeItBodySize');
      w.about.background = $('exAboutBg') ? $('exAboutBg').value : w.about.background;
        w.about.colour = $('exAboutFg') ? $('exAboutFg').value : w.about.colour;
        w.about.eyebrowColour = $('exAboutKick') ? $('exAboutKick').value : w.about.eyebrowColour;
        w.about.enabled = $('exAboutOn') ? !!$('exAboutOn').checked : true;
        await sf.persist();
      };
    });
    ['exSeeItColour','exSeeItHeadSize','exSeeItBodySize'].forEach(id => {
      const el = $(id); if (!el) return;
      el.onchange = async () => {
        w.seeIt.colour = $('exSeeItColour').value;
        w.seeIt.headingSize = $('exSeeItHeadSize').value.trim();
        w.seeIt.bodySize = $('exSeeItBodySize').value.trim();
        await sf.persist();
      };
    });

    const pickInto = async (key, title) => {
      const picked = await window.studioflow.siteChoosePictures({ multiple: false, title });
      const one = picked && (picked.files || picked)[0];
      if (!one) return;
      w.brand[key] = one;
      await sf.persist(); this.render();
    };
    if ($('exPickPortrait')) $('exPickPortrait').onclick = () => pickInto('portrait', 'Choose your portrait');
    if ($('exPickHero')) $('exPickHero').onclick = () => pickInto('heroFile', 'Choose the hero photograph');
    if ($('exClearPortrait')) $('exClearPortrait').onclick = async () => { w.brand.portrait=''; await sf.persist(); this.render(); };
    if ($('exClearHero')) $('exClearHero').onclick = async () => { w.brand.heroFile=''; await sf.persist(); this.render(); };

    document.querySelectorAll('[data-theme]').forEach(el => {
      el.onchange = () => {
        const k = el.dataset.theme;
        w.theme[k] = el.type === 'checkbox' ? el.checked : el.value;
        /* g180 — the sample line must follow the choice, or the dropdown is still just a list of
           names. Redrawn in place rather than by re-rendering the page, which would lose his
           scroll position halfway down a long panel. */
        if (k === 'headingFont' || k === 'bodyFont') {
          const s2 = document.querySelector(`[data-theme-sample="${k}"]`);
          const known = this.THEME_FONTS.find(f => f.name.toLowerCase() === String(el.value).toLowerCase());
          if (s2) s2.style.fontFamily = known ? known.stack : (el.value || 'inherit');
        }
      };
    });
    /* g180 — the house colours, as pressable buttons. The point of these over a picker is that he
       can SEE which is chosen and get back to it; so pressing one re-renders the row's outline
       and the "now" label, and the hidden picker keeps the same value so Custom starts from
       wherever he is rather than from black. */
    document.querySelectorAll('[data-theme-pick]').forEach(b => b.onclick = async () => {
      const k = b.dataset.themePick, hex = b.dataset.hex;
      w.theme[k] = hex;
      await sf.persist();
      this.render();
    });
    /* g183 — the id-keyed rows. These write into the same hidden input / colour input the existing
       save handlers already read, so nothing downstream changes: pressing a swatch is exactly the
       same as having picked that colour, and the row repaints in place rather than re-rendering
       the page, which would throw away his scroll position halfway down a long panel. */
    document.querySelectorAll('[data-colour-for]').forEach(b => b.onclick = () => {
      const id = b.dataset.colourFor, hex = b.dataset.hex;
      const input = document.getElementById(id);
      if (input) { input.value = hex; input.dispatchEvent(new Event('change', { bubbles: true })); }
      document.querySelectorAll(`[data-colour-for="${id}"]`).forEach(x =>
        x.classList.toggle('on', x.dataset.hex.toLowerCase() === hex.toLowerCase()));
      const now = document.querySelector(`[data-colour-now="${id}"]`);
      if (now) now.innerHTML = `<i style="background:${hex}"></i>${this.pickName(hex)}`;
    });
    /* The custom picker must keep the row honest too, or choosing a colour by hand leaves the
       swatch outline sitting on whichever one was last pressed. */
    document.querySelectorAll('[data-colour-now]').forEach(now => {
      const id = now.dataset.colourNow, input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('input', () => {
        const hex = input.value;
        now.innerHTML = `<i style="background:${hex}"></i>${this.pickName(hex)}`;
        document.querySelectorAll(`[data-colour-for="${id}"]`).forEach(x =>
          x.classList.toggle('on', x.dataset.hex.toLowerCase() === hex.toLowerCase()));
      });
    });
    document.querySelectorAll('[data-size-for]').forEach(b => b.onclick = () => {
      const id = b.dataset.sizeFor, val = b.dataset.val;
      const input = document.getElementById(id);
      if (input) { input.value = val; input.dispatchEvent(new Event('change', { bubbles: true })); }
      document.querySelectorAll(`[data-size-for="${id}"]`).forEach(x =>
        x.classList.toggle('on', x.dataset.val === val));
    });
    document.querySelectorAll('[data-font-for]').forEach(sel => sel.addEventListener('change', () => {
      const known = this.THEME_FONTS.find(f => f.name.toLowerCase() === String(sel.value).toLowerCase());
      const sample = document.querySelector(`[data-font-sample="${sel.dataset.fontFor}"]`);
      if (sample) sample.style.fontFamily = known ? known.stack : (sel.value || 'inherit');
    }));
    document.querySelectorAll('[data-theme-size]').forEach(b => b.onclick = async () => {
      w.theme[b.dataset.themeSize] = b.dataset.val;
      await sf.persist();
      this.render();
    });
    if ($('exThemePreset')) $('exThemePreset').onchange = async e => {
      const v = String(e.target.value || '');
      const p = v.startsWith('mine:')
        ? (w.themePresets || [])[Number(v.slice(5))]
        : this.THEME_PRESETS[Number(v)];
      if (!p) return;
      Object.assign(w.theme, p);
      await sf.persist();
      this.render();
    };
    const readTheme = () => {
      document.querySelectorAll('[data-theme]').forEach(el => {
        const k = el.dataset.theme;
        w.theme[k] = el.type === 'checkbox' ? el.checked : el.value;
      });
    };
    if ($('exSaveTheme2')) $('exSaveTheme2').onclick = async () => {
      readTheme();
      const name = String($('exThemeName').value || '').trim();
      if (!name) { $('exThemeName').focus(); return; }
      const saved = Object.assign({}, w.theme, { name });
      const at = (w.themePresets || []).findIndex(x => String(x.name).toLowerCase() === name.toLowerCase());
      if (at >= 0) w.themePresets[at] = saved; else w.themePresets.push(saved);
      await sf.persist(); this.render();
    };
    if ($('exDelTheme')) $('exDelTheme').onclick = async () => {
      const v = String($('exThemePreset').value || '');
      if (!v.startsWith('mine:')) { alert('Choose one of your own presets in the list first.'); return; }
      w.themePresets.splice(Number(v.slice(5)), 1);
      await sf.persist(); this.render();
    };
    if ($('exSaveTheme')) $('exSaveTheme').onclick = async () => {
      document.querySelectorAll('[data-theme]').forEach(el => {
        const k = el.dataset.theme;
        w.theme[k] = el.type === 'checkbox' ? el.checked : el.value;
      });
      await sf.persist();
      this.render();
    };

    const readPosts = () => {
      document.querySelectorAll('[data-post]').forEach(el => {
        const i = Number(el.dataset.post), f = el.dataset.postField;
        if (!w.newsPosts[i] || !f) return;
        w.newsPosts[i][f] = el.type === 'checkbox' ? el.checked : el.value;
      });
    };
    if ($('exAddPost')) $('exAddPost').onclick = async () => {
      readPosts();
      w.newsPosts.push({ id: 'post-' + Date.now().toString(36), title: '', when: '', blurb: '',
                         picture: '', link: '', pinned: false });
      await sf.persist(); this.render();
    };
    if ($('exSavePosts')) $('exSavePosts').onclick = async () => {
      readPosts(); await sf.persist(); this.render();
    };
    document.querySelectorAll('[data-post-del]').forEach(b => b.onclick = async () => {
      readPosts(); w.newsPosts.splice(Number(b.dataset.postDel), 1);
      await sf.persist(); this.render();
    });
    const move = (from, to) => {
      if (to < 0 || to >= w.newsPosts.length) return;
      const [x] = w.newsPosts.splice(from, 1); w.newsPosts.splice(to, 0, x);
    };
    document.querySelectorAll('[data-post-up]').forEach(b => b.onclick = async () => {
      readPosts(); const i = Number(b.dataset.postUp); move(i, i - 1);
      await sf.persist(); this.render();
    });
    document.querySelectorAll('[data-post-down]').forEach(b => b.onclick = async () => {
      readPosts(); const i = Number(b.dataset.postDown); move(i, i + 1);
      await sf.persist(); this.render();
    });
    document.querySelectorAll('[data-post-pic]').forEach(b => b.onclick = async () => {
      readPosts();
      /* Same picker the service covers use: it returns PATHS, so a full-size photo never lands in
         the database -- the bytes are read at export time. */
      const picked = await window.studioflow.siteChoosePictures({ multiple: false });
      const one = picked && (picked.files || picked)[0];
      if (!one) return;
      w.newsPosts[Number(b.dataset.postPic)].picture = one;
      await sf.persist(); this.render();
    });
    document.querySelectorAll('[data-post-pic-clear]').forEach(b => b.onclick = async () => {
      readPosts(); w.newsPosts[Number(b.dataset.postPicClear)].picture = '';
      await sf.persist(); this.render();
    });
    if (w.folder && $('exOpen')) $('exOpen').onclick = e => { e.preventDefault(); window.studioflow.siteOpenFolder(w.folder); };

    $('exRooms').onclick = async () => {
      const picked = await window.studioflow.siteChooseImageFolder();
      if (!picked) return;
      w.roomFolder = picked.folder;
      this._roomFiles = picked.files || [];
      await sf.persist();
      this.render();
    };

    if ($('exGalOrder')) $('exGalOrder').onchange = async e => {
      w.galleryOrder = e.target.value; await sf.persist();
    };
    document.querySelectorAll('[data-gal-cover]').forEach(b => b.onclick = async () => {
      const picked = await window.studioflow.siteChoosePictures({ multiple: false, title: 'Choose a cover for this gallery' });
      const one = picked && (picked.files || picked)[0];
      if (!one) return;
      w.galleryCovers[b.dataset.galCover] = one;
      await sf.persist(); this.render();
    });
    document.querySelectorAll('[data-gal-cover-clear]').forEach(b => b.onclick = async () => {
      delete w.galleryCovers[b.dataset.galCoverClear];
      await sf.persist(); this.render();
    });

    document.querySelectorAll('[data-gal-layout]').forEach(sel => sel.onchange = async () => {
      const id = sel.dataset.galLayout;
      w.galleryLooks[id] = w.galleryLooks[id] || {};
      w.galleryLooks[id].layout = sel.value;
      await sf.persist();
    });
    document.querySelectorAll('[data-gal-accent]').forEach(inp => inp.onchange = async () => {
      const id = inp.dataset.galAccent;
      w.galleryLooks[id] = w.galleryLooks[id] || {};
      w.galleryLooks[id].accent = inp.value;
      await sf.persist();
    });

    $('exSave').onclick = async () => {
      w.brand.email = $('exEmail').value.trim();
      w.brand.phone = $('exPhone').value.trim();
      w.brand.location = $('exLocation').value.trim();
      /* g178 — normalised HERE, once, so every consumer sees one shape rather than each
         stripping a trailing slash for itself. */
      if (!w.site || typeof w.site !== 'object') w.site = {};
      if ($('exSiteUrl')) w.site.url = $('exSiteUrl').value.trim().replace(/\/+$/, '');
      if ($('exGoogleBiz')) w.site.googleBusiness = $('exGoogleBiz').value.trim();
      w.brand.instagram = $('exInstagram').value.trim();
      w.brand.heroArtworkId = $('exHero').value;
      w.brand.portrait = w.brand.portrait;
      w.brand.tagline = $('exTagline').value.trim();
      await sf.persist();
      sf.logActivity('Website site details saved');
      this.render();
    };
    $('exSaveServices').onclick = async () => {
      document.querySelectorAll('[data-svc]').forEach(input => {
        const s = w.services[Number(input.dataset.svc)];
        if (s) s[input.dataset.svcField] = input.value.trim();
      });
      await sf.persist();
      sf.logActivity('Website services saved');
      this.render();
    };

    const saveServiceText = () => {
      document.querySelectorAll('[data-svc]').forEach(input => {
        const svc = w.services[Number(input.dataset.svc)];
        if (svc) svc[input.dataset.svcField] = input.value.trim();
      });
    };
    document.querySelectorAll('[data-svc-pic]').forEach(b => b.onclick = async () => {
      const picked = await window.studioflow.siteChoosePictures({ multiple: false, title: 'Choose the cover picture' });
      if (!picked || !picked.length) return;
      saveServiceText();
      w.services[Number(b.dataset.svcPic)].picture = picked[0];
      await sf.persist(); this.render();
    });
    document.querySelectorAll('[data-svc-pic-clear]').forEach(b => b.onclick = async () => {
      saveServiceText();
      w.services[Number(b.dataset.svcPicClear)].picture = '';
      await sf.persist(); this.render();
    });
    document.querySelectorAll('[data-svc-gal]').forEach(b => b.onclick = async () => {
      const picked = await window.studioflow.siteChoosePictures({ title: 'Choose images for this page' });
      if (!picked || !picked.length) return;
      saveServiceText();
      const svc = w.services[Number(b.dataset.svcGal)];
      svc.gallery = (svc.gallery || []).concat(picked);
      await sf.persist(); this.render();
    });
    document.querySelectorAll('[data-svc-gal-clear]').forEach(b => b.onclick = async () => {
      saveServiceText();
      w.services[Number(b.dataset.svcGalClear)].gallery = [];
      await sf.persist(); this.render();
    });

    $('exRun').onclick = () => this.run();
  },

  /* ------------------------------------------------------------------
     RUN THE EXPORT
     ------------------------------------------------------------------ */
  async run() {
    const sf = window.SF, w = this.settings();
    if (this.busy) return;

    const picked = await window.studioflow.siteChooseFolder();
    if (!picked) return;
    const folder = picked.folder;

    this.busy = true;
    const box = sf.$('exProgress');
    const say = (text, pct) => {
      if (!box) return;
      box.hidden = false;
      box.innerHTML = `<div class="export-bar"><i style="width:${Math.max(2, Math.min(100, pct || 0))}%"></i></div><p>${sf.esc(text)}</p>`;
    };
    const problems = [];

    try {
      say('Copying the site template\u2026', 3);
      const copied = await window.studioflow.siteCopyTemplate({ folder });
      if (!copied || !copied.ok) throw new Error(copied && copied.error ? copied.error : 'The template could not be copied.');

      const built = this.build(this._roomFiles);
      const cat = built.catalogue;

      /* --- images, one at a time so progress is real --- */
      const total = cat.artworks.length || 1;
      for (let i = 0; i < cat.artworks.length; i++) {
        const a = cat.artworks[i];
        say(`Writing image ${i + 1} of ${total} \u2014 ${a.title}`, 5 + (i / total) * 80);
        const result = await window.studioflow.siteWriteImage({ folder, slug: a.id + '-' + this.slug(a.title), source: a._source });
        if (result && result.ok) {
          a.image = result.files[0];
          a.thumb = result.files[1] || result.files[0];
          a.orientation = result.orientation || 'landscape';
        } else {
          problems.push(`${a.title}: ${(result && result.error) || 'image could not be written'}`);
          a.image = '';
        }
        delete a._source;

        /* room images for this piece */
        const out = [];
        for (let r = 0; r < (a.rooms || []).length; r++) {
          const file = a.rooms[r];
          const res = await window.studioflow.siteWriteImage({
            folder, slug: a.id + '-room-' + (r + 1), source: file.path,
            sizes: [{ suffix: '', width: 1600, quality: 82 }]
          });
          if (res && res.ok) out.push(res.files[0]);
          else problems.push(`${a.title} room image: ${(res && res.error) || 'could not be written'}`);
        }
        a.rooms = out;
      }

      /* service pictures */
      for (let i = 0; i < cat.services.length; i++) {
        const svc = cat.services[i];
        say('Writing pictures for ' + svc.name + '\u2026', 85);
        if (svc._pictureSource) {
          const res = await window.studioflow.siteWriteImage({
            folder, slug: 'service-' + svc.id, source: svc._pictureSource,
            sizes: [{ suffix: '', width: 1600, quality: 82 }]
          });
          if (res && res.ok) svc.image = res.files[0];
          else problems.push(`${svc.name} cover picture: ${(res && res.error) || 'could not be written'}`);
        }
        const gallery = [];
        for (let g = 0; g < svc._gallerySources.length; g++) {
          const res = await window.studioflow.siteWriteImage({
            folder, slug: 'service-' + svc.id + '-' + (g + 1), source: svc._gallerySources[g],
            sizes: [{ suffix: '', width: 1400, quality: 80 }, { suffix: '-thumb', width: 600, quality: 78 }]
          });
          if (res && res.ok) gallery.push({ full: res.files[0], thumb: res.files[1] || res.files[0] });
          else problems.push(`${svc.name} gallery image ${g + 1}: ${(res && res.error) || 'could not be written'}`);
        }
        svc.gallery = gallery;
        /* g116: hero and package pictures, written the same way as the cover. */
        if (svc._heroSource) {
          say('Writing the ' + svc.name + ' hero picture\u2026', 88);
          const hr = await window.studioflow.siteWriteImage({
            folder, slug: 'service-' + svc.id + '-hero', source: svc._heroSource,
            sizes: [{ suffix: '', width: 2000, quality: 84 }]
          });
          if (hr && hr.ok) { if (svc.hero) svc.hero.image = hr.files[0]; }
          else problems.push(`${svc.name} hero picture: ${(hr && hr.error) || 'could not be written'}`);
        }
        const pkgItems = (svc.blocks && svc.blocks[0] && svc.blocks[0].items) || [];
        for (let k = 0; k < (svc._packageSources || []).length; k++) {
          const srcPath = svc._packageSources[k];
          if (!srcPath || !pkgItems[k]) continue;
          say('Writing a ' + svc.name + ' package picture\u2026', 89);
          const pr = await window.studioflow.siteWriteImage({
            folder, slug: 'service-' + svc.id + '-pkg-' + (k + 1), source: srcPath,
            sizes: [{ suffix: '', width: 1100, quality: 84 }]
          });
          if (pr && pr.ok) pkgItems[k].image = pr.files[0];
          else problems.push(`${svc.name} package ${k + 1} picture: ${(pr && pr.error) || 'could not be written'}`);
        }
        delete svc._heroSource; delete svc._packageSources;
        delete svc._pictureSource; delete svc._gallerySources;
      }

      for (let i = 0; i < cat.news.length; i++) {
        const n = cat.news[i];
        if (!n._pictureSource) { delete n._pictureSource; continue; }
        say('Writing the picture for ' + n.title + '\u2026', 87);
        const res = await window.studioflow.siteWriteImage({
          folder, slug: 'news-' + this.slug(n.title || ('post-' + (i + 1))),
          source: n._pictureSource,
          sizes: [{ suffix: '', width: 1200, quality: 82 }]
        });
        if (res && res.ok) n.image = res.files[0];
        else problems.push(`News post "${n.title}": ${(res && res.error) || 'picture could not be written'}`);
        delete n._pictureSource;
      }

      /* pieces whose image failed are not publishable -- drop them rather than
         ship a site with broken pictures, and say so */
      const before = cat.artworks.length;
      cat.artworks = cat.artworks.filter(a => a.image);
      if (cat.artworks.length < before) problems.push(`${before - cat.artworks.length} piece(s) left out because their image could not be written.`);

      /* covers and brand images, resolved now that files exist */
      say('Finishing the catalogue\u2026', 90);
      const byId = {};
      cat.artworks.forEach(a => { byId[a.id] = a; });
      for (const g of cat.galleries) {
        if (g._coverSource) {                       /* g117: a chosen file beats the leading piece */
          say('Writing the ' + g.name + ' cover\u2026', 91);
          const cr = await window.studioflow.siteWriteImage({
            folder, slug: 'gallery-' + g.id + '-cover', source: g._coverSource,
            sizes: [{ suffix: '', width: 1800, quality: 84 }]
          });
          if (cr && cr.ok) g.cover = cr.files[0];
          else problems.push(`${g.name} cover: ${(cr && cr.error) || 'could not be written'}`);
        }
        if (!g.cover) {
          const from = byId[g._coverFrom] || cat.artworks.find(a => a.gallery === g.id);
          g.cover = from ? from.image : '';
        }
        delete g._coverFrom; delete g._coverSource;
      }
      /* g113: a chosen portrait or hero FILE is written like a service cover. Both are optional;
         if neither is set the old behaviour (hero from the catalogue, no portrait) is unchanged. */
      if (cat.brand._portraitSource) {
        say('Writing your portrait\u2026', 90);
        const r = await window.studioflow.siteWriteImage({
          folder, slug: 'portrait', source: cat.brand._portraitSource,
          sizes: [{ suffix: '', width: 900, quality: 84 }]
        });
        if (r && r.ok) cat.brand.portrait = r.files[0];
        else problems.push(`Portrait: ${(r && r.error) || 'could not be written'}`);
      }
      let heroFromFile = false;
      if (cat.brand._heroFileSource) {
        say('Writing the hero photograph\u2026', 92);
        const r = await window.studioflow.siteWriteImage({
          folder, slug: 'hero', source: cat.brand._heroFileSource,
          sizes: [{ suffix: '', width: 2000, quality: 84 }]
        });
        /* g117: this wrote brand.heroImage, but the template reads brand.hero — and the line
           below then overwrote it from the catalogue anyway. Kirk's chosen file was discarded
           twice over, which is why the home page kept showing the first piece. */
        if (r && r.ok) { cat.brand.hero = r.files[0]; heroFromFile = true; }
        else problems.push(`Hero photograph: ${(r && r.error) || 'could not be written'}`);
      }
      /* g119: the two home-page cards and the see-it band picture. */
      cat.brand.cards = cat.brand.cards || {};
      for (const key of ['fineArt', 'services']) {
        const src = (cat.brand._cardSources || {})[key];
        if (!src) continue;
        say('Writing the ' + key + ' card picture\u2026', 93);
        const cr = await window.studioflow.siteWriteImage({
          folder, slug: 'card-' + key, source: src,
          sizes: [{ suffix: '', width: 1400, quality: 84 }]
        });
        if (cr && cr.ok) cat.brand.cards[key] = Object.assign({}, cat.brand.cards[key], { image: cr.files[0] });
        else problems.push(`${key} card picture: ${(cr && cr.error) || 'could not be written'}`);
      }
      if (cat._seeItSource) {
        say('Writing the feature band picture\u2026', 94);
        const sr = await window.studioflow.siteWriteImage({
          folder, slug: 'see-it', source: cat._seeItSource,
          sizes: [{ suffix: '', width: 1200, quality: 84 }]
        });
        if (sr && sr.ok) cat.sections.seeIt.image = sr.files[0];
        else problems.push(`Feature band picture: ${(sr && sr.error) || 'could not be written'}`);
      }
      /* g131: copy the giveaway files and their picture, then fill in the hrefs. A tool whose files
         all failed to copy is REMOVED rather than shipped with dead buttons. */
      for (const d of (cat.downloads || [])) {
        if (d._pictureSource) {
          const pr = await window.studioflow.siteWriteImage({
            folder, slug: 'tool-' + d.id, source: d._pictureSource,
            sizes: [{ suffix: '', width: 1400, quality: 84 }]
          });
          if (pr && pr.ok) d.image = pr.files[0];
          else problems.push(`${d.name} picture: ${(pr && pr.error) || 'could not be written'}`);
        }
        for (let n = 0; n < (d._fileSources || []).length; n++) {
          const f = d._fileSources[n];
          if (!f) continue;                     /* a link: its href is already set */
          say('Copying ' + f.name + '\u2026', 95);
          const cr = await window.studioflow.siteCopyDownload({ folder, source: f.path, name: f.name });
          if (cr && cr.ok) { if (d.downloads[n]) d.downloads[n].href = cr.href; }
          else problems.push(`${d.name} \u2014 ${f.name}: ${(cr && cr.error) || 'could not be copied'}`);
        }
        d.downloads = (d.downloads || []).filter(x => x.href);
        delete d._pictureSource; delete d._fileSources;
      }
      const toolsBefore = (cat.downloads || []).length;   /* `before` is already taken in this scope */
      cat.downloads = (cat.downloads || []).filter(d => d.downloads.length);
      if (toolsBefore > cat.downloads.length) {
        problems.push(`${toolsBefore - cat.downloads.length} free tool(s) left off \u2014 none of their files could be copied.`);
      }
      delete cat._seeItSource; delete cat.brand._cardSources;
      delete cat.brand._portraitSource; delete cat.brand._heroFileSource;

      if (!heroFromFile) {
        const hero = byId[cat.brand._heroFrom] || cat.artworks[0];
        cat.brand.hero = hero ? hero.image : '';
      }
      delete cat.brand._heroFrom;
      cat.news.forEach((n, i) => {
        if (n.image) return;                       /* a post's own picture wins */
        const a = cat.artworks[i]; n.image = a ? (a.thumb || a.image) : '';
      });

      const text =
        '/* ============================================================\n' +
        '   catalogue.js \u2014 generated by StudioFlow on ' + new Date().toLocaleString() + '\n' +
        '   Do not hand-edit: the next export overwrites this file.\n' +
        '   Everything here comes from your workspace.\n' +
        '   ============================================================ */\n' +
        'window.FM = ' + JSON.stringify(cat, null, 2) + ';\n';

      const wrote = await window.studioflow.siteWriteText({ folder, name: 'catalogue.js', text });
      if (!wrote || !wrote.ok) throw new Error(wrote && wrote.error ? wrote.error : 'catalogue.js could not be written.');

      /* g178 — REWRITE sitemap.xml FROM THE CATALOGUE, overwriting the one copied from the
         template. The shipped file froze 23 URLs on the day it was written; anything added since
         is missing and anything removed still points at nothing. Failing to write it must not
         cost him the export, so it is reported as a problem rather than thrown. */
      try {
        const xml = this.sitemapXml(cat);
        if (!xml) {
          problems.push('sitemap.xml was not written: set the site address under Search visibility first \u2014 a sitemap has to use absolute links.');
        } else {
          const sm = await window.studioflow.siteWriteText({ folder, name: 'sitemap.xml', text: xml });
          if (!sm || !sm.ok) problems.push('sitemap.xml could not be written: ' + ((sm && sm.error) || 'unknown reason'));
        }
      } catch (error) {
        problems.push('sitemap.xml could not be built: ' + error.message);
      }

      /* g179 — A STATIC PAGE PER PHOTOGRAPH, written after the catalogue and before the galleries.
         Each is attempted on its own: one bad title must not cost him the other seventy-one, and
         none of it may cost him the export that has already succeeded. */
      try {
        const arts = (cat.artworks || []).filter(a => a && a.id);
        if (!(cat.site && cat.site.url)) {
          if (arts.length) problems.push('The per-photograph pages were not written: set the site address under Search visibility first \u2014 they need absolute links.');
        } else if (arts.length) {
          say('Writing a page per photograph\u2026', 94);
          let made = 0;
          for (const a of arts) {
            try {
              const html = this.printPageHtml(cat, a);
              if (!html) continue;
              const r = await window.studioflow.siteWriteText({
                folder, name: 'prints/' + this.printSlug(a) + '.html', text: html });
              if (r && r.ok) made++;
              else problems.push('Page for \u201c' + (a.title || a.id) + '\u201d could not be written: ' + ((r && r.error) || 'unknown reason'));
            } catch (err) {
              problems.push('Page for \u201c' + (a.title || a.id) + '\u201d could not be built: ' + err.message);
            }
          }
          /* Said as a count rather than silently: he should be able to see that 72 pages appeared. */
          if (made) report.printPages = made;
        }
      } catch (error) {
        problems.push('The per-photograph pages could not be written: ' + error.message);
      }

      /* g176 — CLIENT GALLERIES, sealed after the catalogue is safely written.
         Deliberately LAST: sealing is the slowest step (a full-size copy plus two resizes per
         picture, times a wedding's worth of images), and a failure here must not cost him the
         site export that already succeeded. Each gallery is attempted independently for the same
         reason. */
      let galleryResults = [];
      if (window.SFClientGalleries && (sf.state.clientGalleries || []).length) {
        say('Sealing client galleries\u2026', 96);
        try {
          galleryResults = await window.SFClientGalleries.buildAll(folder);
          galleryResults.filter(r => !r.ok).forEach(r =>
            problems.push(`Client gallery "${r.name}": ${r.error}`));
          galleryResults.filter(r => r.ok && r.skipped && r.skipped.length).forEach(r =>
            r.skipped.forEach(x => problems.push(`Client gallery "${r.name}": ${x.name} \u2014 ${x.why}`)));
        } catch (error) {
          problems.push('Client galleries could not be sealed: ' + error.message);
        }
      }
      this.galleryResults = galleryResults;

      w.folder = folder;
      w.lastExport = new Date().toISOString();
      await sf.persist();
      sf.logActivity(`Website exported: ${cat.artworks.length} pieces to ${folder}`);

      say(`Done \u2014 ${cat.artworks.length} photographs, ${cat.galleries.length} galleries written to ${folder}.`, 100);
      this.busy = false;
      this.report = problems;
      this.finish(folder, cat, problems);
    } catch (error) {
      this.busy = false;
      sf.logError(error, 'Website Export');
      say('Export failed: ' + error.message, 100);
      const btn = sf.$('exRun');
      if (btn) { btn.disabled = false; btn.textContent = 'Choose Folder & Export'; }
    }
  },

  finish(folder, cat, problems) {
    const sf = window.SF;
    sf.$('modalRoot').innerHTML = `<div class="modal-backdrop"><div class="modal-card">
      <h2>Website exported</h2>
      <p><b>${cat.artworks.length}</b> photographs across <b>${cat.galleries.length}</b> galleries, with
      <b>${cat.artworks.reduce((n, a) => n + a.variants.length, 0)}</b> priced variants.</p>
      <p class="muted">Written to <b>${sf.esc(folder)}</b>. Open <code>index.html</code> in a browser to look at it.</p>
      ${(this.galleryResults || []).filter(r => r.ok).length ? `<div class="cg-export-list">
        <h3>Client galleries</h3>
        ${this.galleryResults.filter(r => r.ok).map(r => `<p><b>${sf.esc(r.name)}</b> \u2014 ${r.count} picture(s)<br>
          <code>${sf.esc(r.link)}</code></p>`).join('')}
        <p class="help">The passphrase for each is on the <b>Client Galleries</b> page, with a
        ready-to-send message. It is not stored in the website and cannot be recovered from it.</p>
      </div>` : ''}
      ${problems.length ? `<details class="export-problem" open><summary>${problems.length} thing(s) didn't make it</summary><ul>${problems.map(p => `<li>${sf.esc(p)}</li>`).join('')}</ul></details>` : ''}
      <div class="row-actions">
        <button class="button secondary" id="exDone">Close</button>
        <button class="button primary" id="exOpenNow">Open the Folder</button>
      </div></div></div>`;
    sf.$('exDone').onclick = () => { sf.closeModal(); this.render(); };
    sf.$('exOpenNow').onclick = () => { window.studioflow.siteOpenFolder(folder); sf.closeModal(); this.render(); };
  }
};
