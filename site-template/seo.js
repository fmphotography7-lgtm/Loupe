/* ============================================================
   seo.js — descriptions, sharing cards and structured data
   ------------------------------------------------------------
   Two audiences, both fed from the same catalogue:

   SEARCH ENGINES want a real title and description per page, a
   canonical URL, and structured data describing what the thing
   actually is (a product, a service, a business, a person).

   AI ASSISTANTS want the same structured data plus prose they can
   quote. They read the rendered page, so what matters most is that
   the facts are IN the page rather than implied by a photograph.

   IMPORTANT LIMIT, stated plainly rather than buried: this runs in
   the browser. Google executes JavaScript and will see it. Most
   other crawlers -- including several AI ones -- read the HTML as
   delivered and will not. The durable fix is the export writing a
   real HTML file per artwork; see the note in SEO-NOTES.txt.
   ============================================================ */
(function () {
  "use strict";
  var FM = window.FM || {};

  function el(tag, attrs) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function meta(nameOrProp, value, isProperty) {
    if (!value) return;
    var sel = (isProperty ? '[property="' : '[name="') + nameOrProp + '"]';
    var tag = document.head.querySelector("meta" + sel);
    if (!tag) {
      tag = el("meta", isProperty ? { property: nameOrProp } : { name: nameOrProp });
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", value);
  }
  function link(rel, href) {
    if (!href) return;
    var tag = document.head.querySelector('link[rel="' + rel + '"]');
    if (!tag) { tag = el("link", { rel: rel }); document.head.appendChild(tag); }
    tag.setAttribute("href", href);
  }
  function absolute(path) {
    var base = (FM.site && FM.site.url) || "";
    if (!base) return path || "";
    if (!path) return base;
    if (/^https?:/i.test(path)) return path;
    return base.replace(/\/$/, "") + "/" + String(path).replace(/^\//, "");
  }
  function trim(text, n) {
    var t = String(text || "").replace(/\s+/g, " ").trim();
    if (t.length <= n) return t;
    return t.slice(0, n - 1).replace(/[\s,;:.\-]+\S*$/, "") + "\u2026";
  }
  function jsonld(id, data) {
    var old = document.getElementById(id);
    if (old) old.remove();
    var s = document.createElement("script");
    s.type = "application/ld+json";
    s.id = id;
    s.textContent = JSON.stringify(data);
    document.head.appendChild(s);
  }

  /* ---------- the business itself, on every page ---------- */
  function business() {
    var b = FM.brand || {}, site = FM.site || {};
    var data = {
      "@context": "https://schema.org",
      "@type": ["ProfessionalService", "Photograph" === "" ? "" : "LocalBusiness"].filter(Boolean),
      name: b.name,
      description: b.tagline,
      url: absolute(""),
      image: absolute(b.hero || b.logo),
      logo: absolute(b.logo),
      email: b.email || undefined,
      telephone: b.phone || undefined,
      priceRange: site.priceRange || "$$",
      areaServed: site.areaServed || "Vancouver Island, British Columbia",
      knowsAbout: ["fine art photography", "wedding photography", "portrait photography",
                   "real estate photography", "product photography", "event photography"],
      sameAs: [b.instagram, b.facebook, site.googleBusiness, site.googleMaps].filter(Boolean),
      /* hasMap ties this page to the Google Business Profile listing. Google
         matches on name + address + phone as well, so those must agree with the
         profile EXACTLY -- a different phone format is a different business. */
      hasMap: site.googleMaps || undefined
    };
    if (site.address) {
      data.address = {
        "@type": "PostalAddress",
        addressLocality: site.address.city || "Victoria",
        addressRegion: site.address.region || "BC",
        addressCountry: site.address.country || "CA",
        streetAddress: site.address.street || undefined,
        postalCode: site.address.postalCode || undefined
      };
    }
    if (site.geo) {
      data.geo = { "@type": "GeoCoordinates", latitude: site.geo.lat, longitude: site.geo.lng };
    }
    if (site.openingHours) data.openingHours = site.openingHours;
    jsonld("ld-business", data);
  }

  /* ---------- one artwork ---------- */
  function artworkData(a) {
    var prices = (a.variants || []).map(function (v) { return v.price; }).filter(function (p) { return p > 0; });
    var low = Math.min.apply(null, prices), high = Math.max.apply(null, prices);
    var closed = a.limited && a.edition && a.edition.remaining === 0;
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      name: a.title,
      description: a.blurb || ((FM.brand || {}).name + " fine art photograph, printed to order."),
      image: absolute(a.image),
      sku: a.id,
      brand: { "@type": "Brand", name: (FM.brand || {}).name },
      category: "Fine Art Photography Print",
      offers: prices.length ? {
        "@type": "AggregateOffer",
        priceCurrency: (FM.site && FM.site.currency) || "CAD",
        lowPrice: low, highPrice: high, offerCount: (a.variants || []).length,
        availability: closed ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
        seller: { "@type": "Organization", name: (FM.brand || {}).name }
      } : undefined
    };
  }

  function crumbs(list) {
    jsonld("ld-crumbs", {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: list.map(function (c, i) {
        return { "@type": "ListItem", position: i + 1, name: c.name, item: absolute(c.url) };
      })
    });
  }

  /* ---------- per page ---------- */
  function describe(opts) {
    var b = FM.brand || {};
    var title = opts.title;
    var full = opts.exactTitle ? title : title + " \u2014 " + (b.name || "");
    document.title = full;
    meta("description", trim(opts.description, 158));
    link("canonical", absolute(opts.path));
    meta("og:title", full, true);
    meta("og:description", trim(opts.description, 158), true);
    meta("og:type", opts.type || "website", true);
    meta("og:url", absolute(opts.path), true);
    meta("og:site_name", b.name, true);
    meta("og:image", absolute(opts.image || b.hero || b.logo), true);
    meta("twitter:card", "summary_large_image");
    meta("twitter:title", full);
    meta("twitter:description", trim(opts.description, 158));
    meta("twitter:image", absolute(opts.image || b.hero || b.logo));
  }

  function param(name) {
    var want = String(name).toLowerCase(), found = null;
    new URLSearchParams(location.search).forEach(function (v, k) {
      if (found === null && String(k).toLowerCase() === want) found = v;
    });
    return found;
  }
  function byId(list, id) {
    return (list || []).filter(function (x) {
      return String(x.id).toLowerCase() === String(id || "").toLowerCase();
    })[0];
  }

  function run() {
    if (!FM.brand) return;
    var b = FM.brand;
    var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();

    /* pages that must never be indexed */
    if (page === "client.html" || page === "cart.html" || page === "art.html") {
      meta("robots", "noindex, nofollow");
      return;
    }
    business();

    if (page === "" || page === "index.html") {
      describe({
        title: b.name, exactTitle: true, path: "",
        description: b.tagline || "Fine art photography prints and photography services in Victoria, British Columbia."
      });
      jsonld("ld-person", {
        "@context": "https://schema.org", "@type": "Person",
        name: b.artistName || "Kirk Buckland",
        jobTitle: "Photographer",
        worksFor: { "@type": "Organization", name: b.name },
        url: absolute(""), image: absolute(b.portrait),
        knowsAbout: ["fine art photography", "wedding photography", "landscape photography"]
      });
      return;
    }

    if (page === "product.html") {
      var a = byId(FM.artworks, param("id")) || (FM.artworks || [])[0];
      if (!a) return;
      var gal = byId(FM.galleries, a.gallery) || {};
      describe({
        title: a.title + " \u2014 fine art print",
        path: "product.html?id=" + encodeURIComponent(a.id),
        type: "product", image: a.image,
        description: (a.blurb ? a.blurb + " " : "") +
          "A " + (gal.name || "fine art") + " photograph by " + b.name +
          ", printed to order on archival paper, canvas or metal in Victoria, BC."
      });
      jsonld("ld-product", artworkData(a));
      crumbs([{ name: "Home", url: "" },
              { name: "Fine Art Prints", url: "galleries.html" },
              { name: gal.name || "Collection", url: "gallery.html?id=" + a.gallery },
              { name: a.title, url: "product.html?id=" + a.id }]);
      return;
    }

    if (page === "gallery.html") {
      var g = byId(FM.galleries, param("id")) || (FM.galleries || [])[0];
      if (!g) return;
      var pieces = (FM.artworks || []).filter(function (x) {
        return String(x.gallery).toLowerCase() === String(g.id).toLowerCase();
      });
      describe({
        title: g.name + " \u2014 fine art photography prints",
        path: "gallery.html?id=" + encodeURIComponent(g.id),
        image: g.cover,
        description: (g.intro || g.blurb || "") + " " + pieces.length +
          " photographs by " + b.name + ", printed to order in Victoria, BC."
      });
      jsonld("ld-collection", {
        "@context": "https://schema.org", "@type": "CollectionPage",
        name: g.name, description: g.intro || g.blurb,
        url: absolute("gallery.html?id=" + g.id),
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: pieces.length,
          itemListElement: pieces.slice(0, 60).map(function (p, i) {
            return { "@type": "ListItem", position: i + 1,
                     url: absolute("product.html?id=" + p.id), name: p.title };
          })
        }
      });
      return;
    }

    if (page === "service.html") {
      var s = byId(FM.services, param("id")) || (FM.services || [])[0];
      if (!s) return;
      describe({
        title: s.name + " \u2014 Victoria, BC",
        path: "service.html?id=" + encodeURIComponent(s.id),
        image: (s.hero && s.hero.image) || s.image,
        description: (s.blurb || "") + " " + (s.detail || "")
      });
      var pk = ((s.blocks || []).filter(function (x) { return x.type === "packages"; })[0] || {}).items || [];
      jsonld("ld-service", {
        "@context": "https://schema.org", "@type": "Service",
        serviceType: s.name,
        name: s.name,
        description: s.detail || s.blurb,
        provider: { "@type": "ProfessionalService", name: b.name, telephone: b.phone, email: b.email },
        areaServed: (FM.site && FM.site.areaServed) || "Vancouver Island, British Columbia",
        url: absolute("service.html?id=" + s.id),
        hasOfferCatalog: pk.length ? {
          "@type": "OfferCatalog", name: s.name + " packages",
          itemListElement: pk.map(function (p) {
            return {
              "@type": "Offer", name: p.name,
              price: typeof p.price === "number" ? p.price : undefined,
              priceCurrency: (FM.site && FM.site.currency) || "CAD",
              description: p.blurb || (p.bullets || []).join(", ")
            };
          })
        } : undefined
      });
      return;
    }

    if (page === "services.html") {
      describe({ title: "Photography Services \u2014 Victoria, BC", path: "services.html",
        description: "Wedding, portrait, real estate, product and event photography across Vancouver Island by " + b.name + "." });
      return;
    }
    if (page === "galleries.html") {
      describe({ title: "Fine Art Photography Prints", path: "galleries.html",
        description: "Four collections of fine art photography by " + b.name + " \u2014 West Coast landscapes, wildlife, world images and limited editions, printed to order in Victoria, BC." });
      return;
    }
    if (page === "store.html") {
      describe({ title: "Buy Fine Art Prints", path: "store.html",
        description: "Every available photograph, printed to order on archival paper, canvas or metal. Choose your size and finish." });
      return;
    }
    if (page === "contact.html") {
      describe({ title: "Get in Touch", path: "contact.html",
        description: "Enquire about a photography session or a fine art print. Based in Victoria, BC, available across Vancouver Island." });
      return;
    }
    if (page === "tools.html") {
      describe({ title: "Free Tools for Photographers", path: "tools.html",
        description: "Free tools built by a working photographer \u2014 no account, nothing uploaded." });
      var t = (FM.downloads || [])[0];
      if (t) {
        jsonld("ld-app", {
          "@context": "https://schema.org", "@type": "SoftwareApplication",
          name: t.name, description: t.tagline || t.body,
          applicationCategory: "MultimediaApplication",
          operatingSystem: "Any (web browser)",
          offers: { "@type": "Offer", price: 0, priceCurrency: (FM.site && FM.site.currency) || "CAD" },
          author: { "@type": "Organization", name: b.name }
        });
      }
      return;
    }
  }

  document.addEventListener("DOMContentLoaded", run);
  window.FMSeo = { run: run };
})();
