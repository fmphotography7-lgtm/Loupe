/* h102 — theme editor + free-form news posts, exercised without Electron or a DOM.
   Same shim approach as h95w: build() only reads window.SF. Assertions are on the returned
   catalogue, never on source text (the g91/g93/g100 lesson — a string assertion can match my own
   comment, and it did, twice). */
const fs = require('fs'), path = require('path'), vm = require('vm');

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) pass++;
  else { fail++; console.log('FAIL ' + label + (extra ? ' :: ' + extra : '')); }
};

const today = new Date();
const future = new Date(today.getTime() + 86400000 * 30).toISOString().slice(0, 10);
const state = {
  business: { name: 'Frozen Moments Photography' },
  galleries: [{ id: 'GAL-1', name: 'West Coast Landscapes' }],
  productTemplates: [{ id: 'luster', name: 'Luster Paper', sizes: ['11 x 14'] }],
  pricing: { standard: { luster: { '11 x 14': 95 } }, addOns: [] },
  inventoryProductTemplates: [],
  artworks: [
    { id: 'FMP-1', artworkId: 'FMP-1', title: 'Fairy Lake', galleryId: 'GAL-1',
      image: 'data:image/png;base64,AAA', products: [{ mediumId: 'luster', size: '11 x 14', price: 95 }] }
  ],
  salesEvents: [
    { id: 'E1', name: 'Moss Street Market', marketEvent: true, date: future, endDate: future, notes: 'Come by' },
    { id: 'E2', name: 'Sooke Fine Arts', marketEvent: true, date: future, endDate: future, notes: '' }
  ],
  websiteExport: {}
};
const SF = {
  state,
  esc: x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  artworkCatalog: () => state.artworks,
  artworkInGallery: (a, g) => String(a.galleryId || '') === String(g.id),
  makeId: p => p + '-' + Math.random().toString(36).slice(2, 8),
  skuFor: () => 'SKU',
  titleKey: t => String(t || '').toLowerCase(),
  $: () => null, persist: async () => {}, goTo() {}
};
const SFPricing = { priceFor: (a, m, s) => Number(state.pricing.standard?.[m]?.[s] || 0) };
const SFLimitedEditions = { editionSize: () => 0, soldCount: () => 0 };

const sandbox = { window: { SF, SFPricing, SFLimitedEditions }, document: { querySelectorAll: () => [] }, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modules', 'website-export.js'), 'utf8'), sandbox);
const X = sandbox.window.SFWebsiteExport;

/* ---------------- theme ---------------- */
X.settings();
const w = state.websiteExport;
ok('theme is seeded rather than left empty', !!w.theme && !!w.theme.ink);
ok('seed matches what the template already ships', w.theme.headingFont === 'Playfair Display' && w.theme.bodyFont === 'DM Sans');
ok('header defaults to light', w.theme.header === 'light');
ok('newsPosts starts as an empty array, not undefined', Array.isArray(w.newsPosts) && w.newsPosts.length === 0);

let out = X.build([]);
ok('theme reaches the catalogue', !!out.catalogue.theme);
ok('every key the template reads is present',
  ['ink', 'inkSoft', 'paper', 'paper2', 'line', 'accent', 'headingFont', 'bodyFont', 'radius', 'header', 'heroTransparent']
    .every(k => k in out.catalogue.theme));
ok('the emitted theme is a COPY, so later edits do not mutate the last export',
  out.catalogue.theme !== w.theme);

w.theme.accent = '#b07d42';
w.theme.header = 'dark';
w.theme.heroTransparent = false;
out = X.build([]);
ok('an edited accent is carried through', out.catalogue.theme.accent === '#b07d42');
ok('a dark header is carried through', out.catalogue.theme.header === 'dark');
ok('a false checkbox survives (not lost as falsy)', out.catalogue.theme.heroTransparent === false);

ok('presets exist and are named', Array.isArray(X.THEME_PRESETS) && X.THEME_PRESETS.length >= 3);
ok('every preset is complete, so picking one never leaves a blank field',
  X.THEME_PRESETS.every(p => ['ink', 'inkSoft', 'paper', 'paper2', 'line', 'accent', 'headingFont', 'bodyFont', 'radius', 'header'].every(k => p[k])));
ok('every preset colour is a valid hex',
  X.THEME_PRESETS.every(p => ['ink', 'inkSoft', 'paper', 'paper2', 'line', 'accent'].every(k => /^#[0-9a-f]{6}$/i.test(p[k]))));
ok('at least one preset uses the dark header', X.THEME_PRESETS.some(p => p.header === 'dark'));

/* ---------------- news posts ---------------- */
ok('with no posts, the markets still come through on their own', out.catalogue.news.length === 2);

w.newsPosts = [
  { id: 'p1', title: 'Online course', when: 'October 2026', blurb: 'Six weeks', picture: { name: 'c.jpg', path: '/tmp/c.jpg' }, link: 'https://example.com', pinned: false },
  { id: 'p2', title: 'Award', when: '2026', blurb: '', picture: '', link: '', pinned: true },
  { id: 'p3', title: '', when: '', blurb: 'no title so it should be dropped', picture: '', link: '', pinned: false }
];
out = X.build([]);
const news = out.catalogue.news;
ok('a post with no title is dropped rather than shipping blank', !news.some(n => !n.title));
ok('posts and markets are merged', news.length === 4, 'got ' + news.length);
ok('a pinned post comes first', news[0].title === 'Award');
ok('market events sort ahead of unpinned posts', news[1].title === 'Moss Street Market');
ok('a post carries its own link through', news.find(n => n.title === 'Online course').link === 'https://example.com');
ok('a post picture is queued for writing at export',
  !!news.find(n => n.title === 'Online course')._pictureSource);
ok('a post with no picture queues nothing', !news.find(n => n.title === 'Award')._pictureSource);
ok('the report counts his own posts separately', out.report.counts.newsPosts === 2);

/* order among unpinned posts follows his arrangement */
w.newsPosts = [
  { id: 'a', title: 'Second', when: '', blurb: '', picture: '', link: '', pinned: false },
  { id: 'b', title: 'First', when: '', blurb: '', picture: '', link: '', pinned: true }
];
out = X.build([]);
ok('re-ordering is respected via pinning', out.catalogue.news[0].title === 'First');

/* the six-item cap */
w.newsPosts = Array.from({ length: 9 }, (_, i) => ({ id: 'x' + i, title: 'Post ' + i, when: '', blurb: '', picture: '', link: '', pinned: false }));
out = X.build([]);
ok('the combined list is capped at six', out.catalogue.news.length === 6, 'got ' + out.catalogue.news.length);
ok('the cap keeps the market events rather than crowding them out',
  out.catalogue.news.some(n => n.title === 'Moss Street Market'));

console.log(fail ? `\nFAILED ${fail}, passed ${pass}\n` : `\nPASSED ${pass}/${pass} checks\n`);
process.exit(fail ? 1 : 0);
