/* StudioFlow — Production Forecast (g81)
   Turns recorded history into a quantity to print, and shows its working.

   Kirk does TWO markets and a couple of art shows a year, so the signal is the EVENT, not the
   calendar month: July doesn't sell more, Moss Street does, and it happens in July. Weighting by
   season as well would count the same market twice, so seasonality is deliberately not modelled.
   Every occurrence of a market is matched by SFSalesRollup.seriesName(), which strips the year, so
   eight years of "Moss Street" roll up as eight occurrences of one venue.

   Nothing here decides anything on its own: every number a recommendation is built from is kept on
   the row as `inputs`, and the Why? panel is a rendering of exactly those values. If the maths and
   the explanation ever disagree, the explanation is the bug. */
window.SFForecast = {
  DEFAULTS:{safetyPct:25,halfLifeYears:3,thinBelow:2,websiteDays:60},
  /* g85: this used to do Object.assign({},DEFAULTS,existing) and hand back a BRAND NEW object on
     every call, replacing state.forecastSettings each time. Values carried forward so it looked
     harmless, but anything holding the returned object was writing to a detached copy. Fill the
     gaps in place instead, so the object's identity is stable. */
  settings(){
    const s=window.SF.state;
    const cur=(s.forecastSettings&&typeof s.forecastSettings==='object')?s.forecastSettings:{};
    for(const k in this.DEFAULTS)if(cur[k]==null)cur[k]=this.DEFAULTS[k];
    s.forecastSettings=cur;
    return cur;
  },
  rollup(){return window.SFSalesRollup;},
  /* g84: this read s.marketEvents||s.events, and NEITHER collection exists -- every event in the
     app lives in state.salesEvents (markets-shows.js writes it, sales-rollup.js reads it). So
     upcoming() was always empty and the page only ever showed projected dates. It looked fine
     because Kirk had nothing booked; the moment he booked a real market it would still have been
     ignored. Cancelled events are dropped -- there is nothing to plan for. */
  events(){
    const s=window.SF.state;
    return (s.salesEvents||s.marketEvents||s.events||[])
      .filter(e=>e&&(e.name||e.title)&&!e.cancelled);
  },
  eventDate(e){return e.startDate||e.date||e.endDate||'';},
  upcoming(){
    const today=new Date().toISOString().slice(0,10);
    return this.events().filter(e=>this.eventDate(e)&&this.eventDate(e)>=today)
      .sort((a,b)=>String(this.eventDate(a)).localeCompare(String(this.eventDate(b))));
  },
  // Real dated events first; failing that, each past market series projected to its next
  // anniversary so planning is possible in the long gap between shows.
  projected(){
    const R=this.rollup();
    if(!R||!R.rows)return [];
    const seen={};
    for(const r of (R.rows()||[])){
      if(!r.seriesName||!r.date)continue;
      if(!seen[r.seriesName]||r.date>seen[r.seriesName])seen[r.seriesName]=r.date;
    }
    const today=new Date();
    return Object.entries(seen).map(([series,last])=>{
      const d=new Date(last);
      if(isNaN(d))return null;
      const next=new Date(d);
      next.setFullYear(today.getFullYear());
      if(next<today)next.setFullYear(today.getFullYear()+1);
      return {id:`proj:${series}`,name:series,startDate:next.toISOString().slice(0,10),projected:true};
    }).filter(Boolean).sort((a,b)=>a.startDate.localeCompare(b.startDate));
  },
  plannable(){
    const real=this.upcoming();
    if(real.length)return real;
    return this.projected();
  },
  // The template's own category when it has one; otherwise read it off the product name, so a
  // hastily-made template still lands in the right block instead of "Other".
  money(v){ const n=Number(v)||0; return '$'+n.toFixed(2); },

  /* g147 — "PRINT SIX" IS ONLY HALF A DECISION.
     The plan has always said what to print and never whether he can. This turns the plan into
     material requirements through MaterialsService.requirementsFor(), merged across products —
     mat board used by three sizes is ONE shortage, not three — and compared against what is on
     the shelf. Products with no recipe are NAMED rather than silently costing nothing, because a
     total that quietly excludes half the run is worse than no total. */
  materialsCard(rows){
    const sf=window.SF, M=window.MaterialsService;
    if(!M||!M.requirementsFor)return '';
    const items=(rows||[]).filter(r=>r.recommend>0)
      .map(r=>({templateId:r.templateId,qty:r.recommend,name:`${r.product}`}));
    if(!items.length)return '';
    let req;
    try{ req=M.requirementsFor(items); }
    catch(e){ return `<div class="card"><h3>Materials</h3><p class="muted">The material list could not be worked out (${sf.esc(e.message)}).</p></div>`; }
    const short=req.rows.filter(r=>r.short>0);
    const fmt=n=>Number(n)%1?Number(n).toFixed(2):String(n);
    return `<div class="card"><div class="toolbar"><div><h3 style="margin:0">What this run needs</h3>
      <p class="muted">${req.rows.length?`${req.rows.length} material(s) across the whole plan.`:'No recipes cover this plan yet.'}
      ${short.length?`<b class="danger-text">You are short on ${short.length} of them.</b>`:req.rows.length?'You have enough of everything.':''}</p></div></div>
      ${req.rows.length?`<div class="commerce-table"><table>
        <thead><tr><th>Material</th><th>Needed</th><th>On hand</th><th>Short</th><th>Used by</th></tr></thead>
        <tbody>${req.rows.map(r=>`<tr${r.short>0?' class="fc-short"':''}>
          <td>${sf.esc(r.name)}</td>
          <td>${fmt(r.need)} ${sf.esc(r.unit)}</td>
          <td>${fmt(r.onHand)}</td>
          <td>${r.short>0?`<b class="danger-text">${fmt(r.short)}</b>`:'\u2014'}</td>
          <td class="muted">${sf.esc(r.usedBy.slice(0,3).join(', '))}${r.usedBy.length>3?` +${r.usedBy.length-3}`:''}</td>
        </tr>`).join('')}</tbody></table></div>`:''}
      ${req.noRecipe.length?`<p class="help">No recipe yet for: ${sf.esc(req.noRecipe.slice(0,8).join(', '))}${req.noRecipe.length>8?` and ${req.noRecipe.length-8} more`:''}.
        Those are not counted above \u2014 build their recipes under Materials &amp; Sheet Cutting to include them.</p>`:''}
    </div>`;
  },

  categoryFor(templateId,productName){
    const t=(window.SF.state.inventoryProductTemplates||[]).find(x=>String(x.id)===String(templateId));
    const explicit=String(t&&t.category||'').trim();
    if(explicit)return explicit;
    const n=String(productName||'').toLowerCase();
    if(/art\s*card|\bcard\b/.test(n))return 'Art Cards';
    if(/coaster/.test(n))return 'Coasters';
    if(/canvas/.test(n))return 'Canvas';
    if(/frame|framed/.test(n))return 'Framed Prints';
    if(/magnet/.test(n))return 'Magnets';
    if(/print|paper|luster|metallic/.test(n))return 'Prints';
    return 'Other';
  },
  // Stock for one photograph in one product, not the product overall -- 6 art cards in total is
  // meaningless if none of them are the image being planned.
  stockFor(artworkId,productKey){
    const R=this.rollup();
    const ids=new Set(R.templateIdsFor(productKey));
    return (window.SF.state.inventoryItems||[])
      .filter(i=>ids.has(String(i.templateId))&&String(i.artworkId||'')===String(artworkId))
      .reduce((n,i)=>n+(Number(i.quantity??i.qty??i.onHand??0)||0),0);
  },
  // 0.5 at one half-life, so a sale three years ago counts half as much as one this year.
  weightFor(dateStr,halfLifeYears){
    const then=new Date(dateStr);
    if(isNaN(then))return 0.25;
    const years=Math.max(0,(Date.now()-then.getTime())/(365.25*24*3600*1000));
    return Math.pow(0.5,years/Math.max(0.25,halfLifeYears));
  },
  /* The plan for one upcoming event. For every image+product ever sold at this venue:
       expected  = recency-weighted AVERAGE of units sold per past occurrence (not the total)
       website   = weighted average of website units in the run-up window, since those must be
                   printed too even though they don't go in the market box
       safety    = safetyPct of expected, rounded up
       recommend = expected + website + safety - what is already on the shelf                    */
  planForEvent(event){
    const R=this.rollup(),cfg=this.settings();
    if(!R||!R.rows)return {blocked:'The sales rollup is not loaded, so nothing can be forecast yet.'};
    const rows=R.rows()||[];
    if(!rows.length)return {blocked:'No sales have been recorded yet, so there is nothing to forecast from.'};
    const series=R.seriesName(event.name||event.title||'');
    const evDate=this.eventDate(event);
    const past=rows.filter(r=>r.seriesName===series&&r.date&&r.date<evDate);
    const occurrences=[...new Set(past.map(r=>r.eventId||r.date.slice(0,4)))];
    if(!past.length)return {series,occurrences:0,rows:[],
      note:`No previous sales are recorded for ${series||'this event'}, so StudioFlow has nothing to base a recommendation on. It will have something to work with after this one.`};
    /* g84: every occurrence of this venue, with its date -- the DENOMINATOR.
       Before this, the average was taken only over the occurrences where a given image+product
       actually sold, so a canvas that sold once in three years read as "1 per market" instead of
       "1 every three markets", and the plan asked Kirk to print two. A market he attended and
       sold none at is real evidence of nothing selling, and it belongs in the average as a zero. */
    const occIndex={};
    for(const r of past){
      const occ=r.eventId||r.date.slice(0,4);
      if(!occIndex[occ]||r.date>occIndex[occ])occIndex[occ]=r.date;
    }
    const allOccs=Object.keys(occIndex);
    // Units per occurrence, per image+product.
    const combos={};
    const keyOf=r=>`${r.artworkId||r.artworkTitle}|||${r.templateId||r.product}`;
    for(const r of past){
      const k=keyOf(r);
      const c=combos[k]=combos[k]||{artworkId:r.artworkId||'',title:r.artworkTitle||'(untitled)',
        templateId:r.templateId||'',product:r.product||'(unknown product)',perOcc:{},dates:{}};
      const occ=r.eventId||r.date.slice(0,4);
      c.perOcc[occ]=(c.perOcc[occ]||0)+(Number(r.qty)||0);
      if(!c.dates[occ]||r.date>c.dates[occ])c.dates[occ]=r.date;
    }
    // Website demand in the run-up to the same point in previous years.
    const webUnits={};
    for(const r of rows){
      if(!/website/i.test(String(r.source||'')))continue;
      const k=keyOf(r);
      const d=new Date(r.date);if(isNaN(d))continue;
      const ev=new Date(evDate);if(isNaN(ev))continue;
      // Same window (websiteDays before the event) in whatever year the sale happened.
      const anniversary=new Date(d.getFullYear(),ev.getMonth(),ev.getDate());
      const gap=(anniversary-d)/(24*3600*1000);
      if(gap<0||gap>cfg.websiteDays)continue;
      (webUnits[k]=webUnits[k]||[]).push({qty:Number(r.qty)||0,date:r.date});
    }
    const out=[];
    for(const [k,c] of Object.entries(combos)){
      const occs=Object.keys(c.perOcc);            // occurrences where it actually sold
      let wSum=0,wQty=0;const detail=[];
      for(const occ of allOccs){
        const when=c.dates[occ]||occIndex[occ];
        const units=c.perOcc[occ]||0;
        const w=this.weightFor(when,cfg.halfLifeYears);
        wSum+=w;wQty+=w*units;
        detail.push({occ,when,units,weight:Math.round(w*100)/100});
      }
      const expected=wSum?wQty/wSum:0;
      const web=webUnits[k]||[];
      let webSum=0,webW=0;
      for(const x of web){const w=this.weightFor(x.date,cfg.halfLifeYears);webW+=w;webSum+=w*x.qty;}
      const website=webW?webSum/webW:0;
      const stock=this.stockFor(c.artworkId,R.productKey(
        (window.SF.state.inventoryProductTemplates||[]).find(t=>String(t.id)===String(c.templateId)),c.product));
      const safety=Math.ceil(expected*(cfg.safetyPct/100));
      const recommend=Math.max(0,Math.ceil(expected+website+safety-stock));
      detail.sort((a,b)=>String(b.when).localeCompare(String(a.when)));
      out.push({
        artworkId:c.artworkId,title:c.title,templateId:c.templateId,product:c.product,
        category:this.categoryFor(c.templateId,c.product),
        /* g147 — WHAT THE PLAN COSTS. The number was always available: recipes are keyed to
           inventoryProductTemplates and `templateId` here IS one, so no join is needed (unlike the
           Pricing page, which had to match a medium to a product — see g145). unitCost is 0 when
           that product has no recipe yet, and the page says which ones those are rather than
           quietly totalling an incomplete figure. */
        unitCost:Math.round((window.MaterialsService?.recipeCost?.(c.templateId)||0)*100)/100,
        hasRecipe:!!window.MaterialsService?.hasRecipe?.(c.templateId),
        recommend,thin:occs.length<cfg.thinBelow,
        inputs:{
          series,occurrences:allOccs.length,soldIn:occs.length,detail,
          expected:Math.round(expected*10)/10,
          website:Math.round(website*10)/10,
          websiteDays:cfg.websiteDays,
          safety,safetyPct:cfg.safetyPct,halfLifeYears:cfg.halfLifeYears,stock
        }
      });
    }
    out.sort((a,b)=>b.recommend-a.recommend||a.title.localeCompare(b.title)||a.product.localeCompare(b.product));
    return {series,occurrences:occurrences.length,rows:out};
  },
  // The Why? text is built from the SAME object the recommendation was computed from.
  whyText(row){
    const i=row.inputs,L=[];
    L.push(`${row.title} — ${row.product}`);
    L.push('');
    L.push(`Past ${i.series} sales (most recent first) — sold at ${i.soldIn} of ${i.occurrences}:`);
    i.detail.forEach(d=>L.push(`   ${String(d.when).slice(0,10)}: ${d.units} sold   (counted at ${Math.round(d.weight*100)}% — older years count less)`));
    L.push('');
    L.push(`Recency-weighted average per event: ${i.expected}   (a market where it sold none counts as a zero)`);
    if(i.website)L.push(`Website sales in the ${i.websiteDays} days before the event: ${i.website}`);
    L.push(`Safety stock at ${i.safetyPct}%: ${i.safety}`);
    L.push(`Already on the shelf: ${i.stock}`);
    L.push('');
    L.push(`${i.expected} + ${i.website||0} + ${i.safety} − ${i.stock} = recommend ${row.recommend}`);
    if(row.thin)L.push('',`⚠ It has only sold at ${i.soldIn} past market, so this is a weak signal — treat it as a starting point, not a forecast.`);
    L.push('','Half-life is '+i.halfLifeYears+' years: a sale that long ago counts half as much as one today. Change that, the safety percentage or the website window under Recommendation Settings.');
    return L.join('\n');
  }
};

/* Page: pick an upcoming event, see what to print, ask Why? about any line. Recommendations are
   never applied to inventory -- printing is a decision, and StudioFlow's job is to argue for a
   number, not to act on it. */
Object.assign(window.SFForecast,{
  selectedEventId:'',
  render(){
    const sf=window.SF;
    const up=this.plannable();
    const cfg=this.settings();
    if(!up.length){
      sf.$('workspace').innerHTML=`<div class="page-stack"><div class="card"><h2>Production Plan</h2>
        <p class="muted">Nothing to plan for yet. StudioFlow needs either a dated event under Markets &amp; Shows, or sales history from a market it can project forward.</p></div></div>`;
      return;
    }
    if(!up.some(e=>String(e.id)===String(this.selectedEventId)))this.selectedEventId=String(up[0].id);
    const event=up.find(e=>String(e.id)===String(this.selectedEventId));
    const plan=this.planForEvent(event);
    this._plan=plan;
    const opts=up.map(e=>`<option value="${sf.esc(e.id)}" ${String(e.id)===String(this.selectedEventId)?'selected':''}>${sf.esc(e.name||e.title)} · ${sf.esc(String(this.eventDate(e)).slice(0,10))}</option>`).join('');
    let body='';
    if(plan.blocked)body=`<p class="muted">${sf.esc(plan.blocked)}</p>`;
    else if(!plan.rows||!plan.rows.length)body=`<p class="muted">${sf.esc(plan.note||'Nothing to recommend for this event yet.')}</p>`;
    else{
      const total=plan.rows.reduce((n,r)=>n+r.recommend,0);
      const costTotal=plan.rows.reduce((n,r)=>n+(r.hasRecipe?r.unitCost*r.recommend:0),0);
      const costed=plan.rows.some(r=>r.recommend&&r.hasRecipe);
      const uncosted=plan.rows.filter(r=>r.recommend&&!r.hasRecipe).length;
      // Grouped into blocks by category and laid out in two columns -- one long table meant
      // hunting for every art card line individually.
      const byCat={};
      plan.rows.forEach((r,i)=>{r._i=i;(byCat[r.category]=byCat[r.category]||[]).push(r);});
      const cats=Object.entries(byCat).sort((a,b)=>
        b[1].reduce((n,r)=>n+r.recommend,0)-a[1].reduce((n,r)=>n+r.recommend,0)||a[0].localeCompare(b[0]));
      const block=([cat,list])=>{
        const sub=list.reduce((n,r)=>n+r.recommend,0);
        const subCost=list.reduce((n,r)=>n+(r.hasRecipe?r.unitCost*r.recommend:0),0);
        return `<div class="card fc-block"><div class="fc-block-head"><b>${sf.esc(cat)}</b><span class="badge">${sub} to print${subCost?` \u00b7 ${this.money(subCost)}`:''}</span></div>
        <div class="commerce-table"><table><thead><tr><th>Photograph</th><th>Product</th><th>Have</th><th>Avg</th><th>Print</th><th>Materials</th><th></th></tr></thead><tbody>
        ${list.map(r=>`<tr${r.recommend?'':' class="muted"'}>
          <td>${sf.esc(r.title)}${r.thin?' <span class="badge">thin</span>':''}</td>
          <td>${sf.esc(r.product)}</td>
          <td>${r.inputs.stock}</td>
          <td>${r.inputs.expected}</td>
          <td><b>${r.recommend||'—'}</b></td>
          <td>${r.recommend?(r.hasRecipe?this.money(r.unitCost*r.recommend):'<span class="muted">no recipe</span>'):'—'}</td>
          <td><button class="button secondary fc-why" data-i="${r._i}">Why?</button></td></tr>`).join('')}
        </tbody></table></div></div>`;
      };
      body=`<p class="muted">Based on <b>${plan.occurrences}</b> previous occurrence(s) of <b>${sf.esc(plan.series)}</b>. Recent years count for more; nothing here changes your inventory.${event.projected?` <b>This date is projected</b> from when this market last ran — it isn't on your calendar yet, so treat it as a planning view.`:''}</p>
      <p class="muted">Total to print: <b>${total}</b> item(s) across ${cats.length} categor${cats.length===1?'y':'ies'}${
        costed?` \u00b7 materials <b>${this.money(costTotal)}</b>${uncosted?` (${uncosted} row(s) have no recipe and are not counted)`:''}`:''}.</p>
      <div class="fc-columns">${cats.map(block).join('')}</div>
      ${this.materialsCard(plan.rows)}`;
    }
    sf.$('workspace').innerHTML=`<div class="page-stack"><div class="card">
      <div class="toolbar"><h2 style="margin:0">Production Plan</h2>
        <div class="row-actions"><select id="fcEvent">${opts}</select><button class="button secondary" id="fcPack">Pack List</button><button class="button secondary" id="fcSettings">Recommendation Settings</button></div></div>
      ${body}
    </div></div>`;
    sf.$('fcEvent').onchange=e=>{this.selectedEventId=e.target.value;this.render()};
    sf.$('fcSettings').onclick=()=>this.openSettings();
    // Same event, other question -- carry the selection so he doesn't re-pick it.
    sf.$('fcPack').onclick=()=>{if(window.SFPackList)window.SFPackList.selectedEventId=this.selectedEventId;sf.goTo('Pack List');};
    document.querySelectorAll('.fc-why').forEach(b=>b.onclick=()=>alert(this.whyText(this._plan.rows[Number(b.dataset.i)])));
  },
  openSettings(){
    const sf=window.SF,cfg=this.settings();
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card"><h2>Recommendation Settings</h2>
      <p class="muted">These are the assumptions the Why? panel names. Change one and every recommendation updates.</p>
      <label>Safety stock %<input id="fcSafety" type="number" min="0" max="200" value="${cfg.safetyPct}"></label>
      <label>Half-life in years <small class="muted">— how fast older sales stop counting</small><input id="fcHalf" type="number" min="0.5" max="10" step="0.5" value="${cfg.halfLifeYears}"></label>
      <label>Website window (days before the event)<input id="fcWeb" type="number" min="0" max="365" value="${cfg.websiteDays}"></label>
      <p class="muted" style="margin:14px 0 4px"><b>Stock flags</b> — the thresholds named on the Business Intelligence flags.</p>
      <label>Slow after (months with no sale)<input id="fcSlow" type="number" min="1" max="120" value="${cfg.slowMonths??24}"></label>
      <label>Over-stocked past (years of cover)<input id="fcOver" type="number" min="0.5" max="20" step="0.5" value="${cfg.overYears??3}"></label>
      <label>Running short under (months of cover)<input id="fcShort" type="number" min="1" max="36" value="${cfg.shortMonths??6}"></label>
      <div class="row-actions"><button class="button secondary" id="fcCancel">Cancel</button><button class="button primary" id="fcSave">Save</button></div>
    </div></div>`;
    sf.$('fcCancel').onclick=()=>sf.closeModal();
    sf.$('fcSave').onclick=async()=>{
      const s=this.settings();
      s.safetyPct=Math.max(0,Number(sf.$('fcSafety').value)||0);
      s.halfLifeYears=Math.max(0.5,Number(sf.$('fcHalf').value)||3);
      s.websiteDays=Math.max(0,Number(sf.$('fcWeb').value)||0);
      s.slowMonths=Math.max(1,Number(sf.$('fcSlow').value)||24);
      s.overYears=Math.max(0.5,Number(sf.$('fcOver').value)||3);
      s.shortMonths=Math.max(1,Number(sf.$('fcShort').value)||6);
      await sf.persist();sf.closeModal();this.render();
    };
  }
});
