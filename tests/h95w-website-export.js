/* h94 — Website Export build(), exercised without Electron or a DOM.
   build() only reads window.SF, so a small shim is enough. Assertions are on the
   returned object, never on source text (the g91/g93 lesson: a string assertion
   can match my own comment). */
const fs = require('fs'), path = require('path'), vm = require('vm');

let pass = 0, fail = 0;
const ok = (label, cond, extra) => { if (cond) { pass++; } else { fail++; console.log('FAIL ' + label + (extra ? ' :: ' + extra : '')); } };

/* ---------- a workspace shaped like Kirk's ---------- */
const state = {
  business: { name: 'Frozen Moments Photography', logo: 'logo.png' },
  galleries: [
    { id: 'GAL-1', name: 'West Coast Landscapes', description: 'Coast' },
    { id: 'GAL-2', name: 'Wildlife', description: 'Patience' },
    { id: 'GAL-3', name: 'Limited Edition Prints', description: 'Numbered' }
  ],
  productTemplates: [
    { id: 'luster', name: 'Luster Paper', sizes: ['11 x 14', '13 x 19'] },
    { id: 'luster-mat', name: 'Luster Paper + Mat', sizes: ['11 x 14', '13 x 19'] },
    { id: 'canvas', name: 'Canvas', sizes: ['16 x 24', '24 x 36'] },
    { id: 'metal', name: 'Metal', sizes: ['16 x 24'] },
    { id: 'orphan-mat', name: 'Pearl Paper - Matted', sizes: ['11 x 14'] }
  ],
  pricing: {
    standard: {
      luster: { '11 x 14': 95, '13 x 19': 135 },
      'luster-mat': { '11 x 14': 125, '13 x 19': 175 },
      canvas: { '16 x 24': 295, '24 x 36': 520 },
      metal: { '16 x 24': 340 },
      'orphan-mat': { '11 x 14': 110 }
    },
    addOns: [
      { id: 'ADDON-1', name: 'Floating Frame', mediumId: 'canvas', colors: ['Black', 'White'],
        sizePrices: [{ size: '16 x 24', price: 100 }, { size: '24 x 36', price: 70 }], websiteEnabled: true },
      { id: 'ADDON-2', name: 'Nothing Priced', mediumId: 'canvas', sizePrices: [], websiteEnabled: true },
      { id: 'ADDON-3', name: 'Hidden', mediumId: 'canvas', sizePrices: [{ size: '16 x 24', price: 10 }], websiteEnabled: false }
    ]
  },
  artworks: [
    { id: 'FMP-0001', artworkId: 'FMP-0001', title: 'Shannon Falls', galleryId: 'GAL-1', image: 'data:image/jpeg;base64,AAA',
      products: [ { mediumId: 'luster', size: '11 x 14' }, { mediumId: 'luster-mat', size: '11 x 14' },
                  { mediumId: 'canvas', size: '24 x 36' } ] },
    { id: 'FMP-0002', artworkId: 'FMP-0002', title: 'Tree Frog', galleryId: 'GAL-2', image: 'https://cdn/x.jpg',
      products: [ { mediumId: 'luster', size: '13 x 19' } ] },
    { id: 'FMP-0003', artworkId: 'FMP-0003', title: 'No Picture', galleryId: 'GAL-1',
      products: [ { mediumId: 'luster', size: '11 x 14' } ] },
    { id: 'FMP-0004', artworkId: 'FMP-0004', title: 'Homeless', image: 'data:image/jpeg;base64,BBB',
      products: [ { mediumId: 'luster', size: '11 x 14' } ] },
    { id: 'FMP-0005', artworkId: 'FMP-0005', title: 'Unpriced', galleryId: 'GAL-1', image: 'data:image/jpeg;base64,CCC',
      products: [ { mediumId: 'canvas', size: '99 x 99' } ] },
    { id: 'FMP-0006', artworkId: 'FMP-0006', title: 'Edition Piece', galleryId: 'GAL-3', image: 'data:image/jpeg;base64,DDD',
      isLimitedEdition: true, editionSize: 25,
      products: [ { mediumId: 'canvas', size: '16 x 24' } ] }
  ],
  salesEvents: [
    { id: 'E1', name: 'Future Market', marketEvent: true, date: '2099-07-01', endDate: '2099-07-01', notes: 'On the Gorge' },
    { id: 'E2', name: 'Cancelled One', marketEvent: true, date: '2099-08-01', cancelled: true },
    { id: 'E3', name: 'Old Market', marketEvent: true, date: '2001-07-01', endDate: '2001-07-02' },
    { id: 'E4', name: 'A Wedding', marketEvent: false, date: '2099-09-01' }
  ]
};

const SF = {
  state,
  esc: v => String(v == null ? '' : v),
  persist: async () => {},
  logActivity() {}, logError() {},
  titleKey: t => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
  artworkCatalog: () => state.artworks,
  imageIndex: () => new Map(),
  artworkImage: (a) => a.image || a.imagePath || a.imageData || '',
  artworkInGallery: (a, g) => String(a.galleryId || '') === String(g.id)
};
const SFPricing = {
  priceFor(artwork, mediumId, size) { return Number(state.pricing.standard?.[mediumId]?.[size] || 0); }
};
const SFLimitedEditions = { editionSize: a => Number(a.editionSize || 0), soldCount: () => 4 };

const sandbox = { window: { SF, SFPricing, SFLimitedEditions }, document: { querySelectorAll: () => [] }, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modules', 'website-export.js'), 'utf8'), sandbox);
const X = sandbox.window.SFWebsiteExport;
ok('module registers', !!X);

const rooms = [{ name: 'FMP-0001-livingroom.jpg', path: '/tmp/a.jpg' },
               { name: 'FMP-0001 second.png', path: '/tmp/b.png' },
               { name: 'no-id-here.jpg', path: '/tmp/c.jpg' }];
const { catalogue: cat, report } = X.build(rooms);

/* ---------- matted mediums fold into a mat add-on ---------- */
const mediumIds = cat.mediums.map(m => m.id);
ok('matted template is not its own medium', mediumIds.indexOf('luster-mat') < 0, mediumIds.join(','));
ok('base medium survives', mediumIds.indexOf('luster') >= 0);
ok('matted fold reported', report.folds.some(f => /Luster Paper \+ Mat/.test(f)), JSON.stringify(report.folds));
ok('orphan matted medium kept', mediumIds.indexOf('orphan-mat') >= 0);
ok('orphan is explained', report.skipped.some(s => /Pearl Paper/.test(s)), JSON.stringify(report.skipped));

const mat = cat.addOns.find(a => a.id === 'mat');
ok('mat add-on exists', !!mat);
ok('mat price is the difference', mat && mat.price['11 x 14'] === 30, mat && JSON.stringify(mat.price));
ok('mat price per size differs', mat && mat.price['13 x 19'] === 40, mat && JSON.stringify(mat.price));
ok('mat applies to its base medium', mat && mat.appliesTo.indexOf('luster') >= 0);
ok('mat offers white and black', mat && mat.colours.length >= 2 && mat.colours[0].name === 'White');
ok('custom mat colour carries a surcharge', mat && mat.colours.some(c => c.surcharge > 0));
ok('luster allows a mat', (cat.mediums.find(m => m.id === 'luster') || {}).allows.indexOf('mat') >= 0);
ok('canvas does not allow a mat', (cat.mediums.find(m => m.id === 'canvas') || {}).allows.indexOf('mat') < 0);

/* ---------- add-ons out of pricing.addOns ---------- */
const frame = cat.addOns.find(a => a.name === 'Floating Frame');
ok('floating frame exported', !!frame);
ok('frame prices per size', frame && frame.price['16 x 24'] === 100 && frame.price['24 x 36'] === 70);
ok('frame applies to canvas', frame && frame.appliesTo.indexOf('canvas') >= 0);
ok('frame colours carried', frame && frame.colours.length === 2);
ok('canvas allows the frame', (cat.mediums.find(m => m.id === 'canvas') || {}).allows.length === 1);
ok('unpriced add-on skipped', !cat.addOns.some(a => a.name === 'Nothing Priced'));
ok('unpriced add-on reported', report.skipped.some(s => /Nothing Priced/.test(s)));
ok('website-disabled add-on skipped', !cat.addOns.some(a => a.name === 'Hidden'));

/* ---------- artworks ---------- */
const titles = cat.artworks.map(a => a.title);
ok('publishable pieces exported', titles.indexOf('Shannon Falls') >= 0 && titles.indexOf('Tree Frog') >= 0);
ok('piece with no image excluded', titles.indexOf('No Picture') < 0);
ok('no-image piece reported', report.noImage.indexOf('No Picture') >= 0);
ok('piece with no gallery excluded', titles.indexOf('Homeless') < 0);
ok('no-gallery piece reported', report.noGallery.indexOf('Homeless') >= 0);
ok('piece with no priced size excluded', titles.indexOf('Unpriced') < 0);
ok('unpriced piece reported', report.noPrice.indexOf('Unpriced') >= 0);

const shannon = cat.artworks.find(a => a.title === 'Shannon Falls');
ok('matted product did not become a variant', shannon.variants.filter(v => v.mediumId === 'luster-mat').length === 0);
ok('matted product folded onto the base', shannon.variants.filter(v => v.mediumId === 'luster' && v.size === '11 x 14').length === 1,
   JSON.stringify(shannon.variants));
ok('variant carries the standard price', shannon.variants.find(v => v.mediumId === 'luster').price === 95);
ok('canvas variant present', shannon.variants.some(v => v.mediumId === 'canvas' && v.price === 520));
ok('source image held for the writer', !!shannon._source);

/* ---------- limited editions ---------- */
const edition = cat.artworks.find(a => a.title === 'Edition Piece');
ok('limited edition flagged', edition && edition.limited === true);
ok('edition remaining computed', edition && edition.edition.remaining === 21, edition && JSON.stringify(edition.edition));

/* ---------- room images ---------- */
ok('room images matched by file id', shannon.rooms.length === 2, JSON.stringify(shannon.rooms));
ok('unmatched room image ignored', cat.artworks.every(a => a.rooms.every(r => /FMP-0001/.test(r.name))));
ok('piece with no room images has none', (cat.artworks.find(a => a.title === 'Tree Frog') || {}).rooms.length === 0);

/* ---------- galleries ---------- */
ok('every gallery exported', cat.galleries.length === 3);
ok('galleries get different layouts', new Set(cat.galleries.map(g => g.layout)).size === 3,
   cat.galleries.map(g => g.layout).join(','));
ok('galleries get accents', cat.galleries.every(g => /^#/.test(g.accent)));
ok('gallery slug built from the name', cat.galleries[0].slug === 'west-coast-landscapes');

/* ---------- news ---------- */
const newsTitles = cat.news.map(n => n.title);
ok('future market included', newsTitles.indexOf('Future Market') >= 0);
ok('cancelled event excluded', newsTitles.indexOf('Cancelled One') < 0);
ok('past event excluded', newsTitles.indexOf('Old Market') < 0);
ok('non-market event excluded', newsTitles.indexOf('A Wedding') < 0);
ok('event notes become the blurb', (cat.news[0] || {}).blurb === 'On the Gorge');

/* ---------- brand and services ---------- */
ok('business name carried', cat.brand.name === 'Frozen Moments Photography');
ok('five services seeded', cat.services.length === 5);
ok('counts reported', report.counts.artworks === cat.artworks.length && report.counts.variants > 0);

/* ---------- the JSON actually serialises ---------- */
let text = '';
try { text = JSON.stringify(cat); } catch (e) {}
ok('catalogue serialises', text.length > 500);
ok('no circular refs or undefined keys', text.indexOf('undefined') < 0);

console.log((fail ? 'FAILED ' : 'PASSED ') + pass + '/' + (pass + fail) + ' checks');
process.exit(fail ? 1 : 0);
