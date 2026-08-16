/* StudioFlow — Market Pack List (g84)
   The second framing of ONE engine, not a second engine. Every number here comes out of
   SFForecast.planForEvent(); this module only re-asks the question.

     Production Plan  — weeks before  — "what do I need to PRINT?"   expected + website + safety − stock
     Pack List        — night before  — "what goes in the van?"      expected + safety, against the shelf

   Two deliberate differences from the print number, both explained in the Why? panel:
     1. Website demand is EXCLUDED. Those orders ship from home; they must be printed but they
        never travel to the market, so counting them here would have Kirk carrying boxes he
        cannot sell at the booth.
     2. Safety is applied once and rounded once (ceil(expected × (1+pct))) rather than rounded up
        to a whole item and then added. On a photograph selling 0.3 canvases a market, add-then-
        round asks him to carry two canvases; round-once asks for one. Printing a spare card is
        nearly free and it keeps, so the Production Plan's generosity is right there and wrong here.

   The same rule as the forecast engine holds: the explanation is a pure rendering of the values
   the recommendation was computed from. If they ever disagree, the explanation is the bug. */
window.SFPackList = {
  selectedEventId:'',

  // A market stand is more than prints. None of this comes from sales history, so it is a plain
  // editable checklist -- seeded once, then it is Kirk's.
  KIT_SEED:[
    'Canopy / tent + weights','Tables + covers','Grid walls or panels + hooks','Print browser bins',
    'Art card rack','Easels / display stands','Banner + price signage','Business cards',
    'Float / cash box','Card reader + charged phone','Receipt book + pens',
    'Bags, tissue, backing boards','Bubble wrap + sleeves','Tape, zip ties, scissors',
    'Level + picture hooks','Chair','Water + snacks','Sunscreen + hat','First aid kit','Wagon / dolly'
  ],

  fc(){return window.SFForecast;},

  // Nothing is written into core.js's loader, so normalise on read the way SFForecast.settings does.
  store(){
    const s=window.SF.state;
    if(!s.packLists||typeof s.packLists!=='object')s.packLists={};
    if(!Array.isArray(s.packKit)||!s.packKit.length)s.packKit=this.KIT_SEED.slice();
    return s;
  },
  sheet(eventId){
    const s=this.store(),k=String(eventId||'');
    if(!s.packLists[k]||typeof s.packLists[k]!=='object')s.packLists[k]={checked:{},kit:{}};
    const sh=s.packLists[k];
    if(!sh.checked||typeof sh.checked!=='object')sh.checked={};
    if(!sh.kit||typeof sh.kit!=='object')sh.kit={};
    return sh;
  },

  /* The database carries the images inline and runs past 100MB, so a save on every tick would
     stall the app mid-pack. Ticks are held in memory and flushed once the ticking stops. */
  _t:null,
  saveSoon(){
    clearTimeout(this._t);
    this._t=setTimeout(()=>{this._t=null;window.SF.persist();},1500);
  },
  saveNow(){clearTimeout(this._t);this._t=null;return window.SF.persist();},

  // Pure function of the forecast row's own inputs -- no new history is read here.
  packRow(row){
    const i=row.inputs;
    const raw=i.expected*(1+(i.safetyPct||0)/100);
    const target=Math.max(0,Math.ceil(raw-1e-9));
    const have=Math.max(0,Number(i.stock)||0);
    return {target,have,take:Math.min(have,target),short:Math.max(0,target-have),
            spare:Math.max(0,have-target),raw:Math.round(raw*10)/10};
  },

  packFor(event){
    const F=this.fc();
    if(!F)return {blocked:'The forecast engine is not loaded, so a pack list cannot be built.'};
    const plan=F.planForEvent(event);
    if(plan.blocked||!plan.rows)return plan;
    const rows=plan.rows.map((r,idx)=>{
      const p=this.packRow(r);
      return Object.assign({},r,p,{_i:idx,key:`${r.artworkId||r.title}|${r.templateId||r.product}`});
    }).filter(r=>r.target>0||r.have>0)
      .sort((a,b)=>b.target-a.target||b.have-a.have||a.title.localeCompare(b.title));
    return {series:plan.series,occurrences:plan.occurrences,note:plan.note,rows};
  },

  whyText(r){
    const i=r.inputs,L=[];
    L.push(`${r.title} — ${r.product}`);
    L.push('');
    L.push(`Past ${i.series} sales (most recent first) — sold at ${i.soldIn} of ${i.occurrences}:`);
    i.detail.forEach(d=>L.push(`   ${String(d.when).slice(0,10)}: ${d.units} sold   (counted at ${Math.round(d.weight*100)}% — older years count less)`));
    L.push('');
    L.push(`Recency-weighted average per event: ${i.expected}   (a market where it sold none counts as a zero)`);
    L.push(`Safety stock at ${i.safetyPct}%: ${i.expected} × ${(1+i.safetyPct/100).toFixed(2)} = ${r.raw}`);
    L.push(`Rounded up, take: ${r.target}`);
    L.push(`On the shelf: ${r.have}`);
    L.push('');
    if(r.short&&!r.take)L.push(`You have none on the shelf — print ${r.short} before the market.`);
    else if(r.short)L.push(`You are ${r.short} short — pack the ${r.take} you have and print ${r.short} more.`);
    else if(r.spare)L.push(`Pack ${r.target}. You have ${r.spare} more than that; the rest can stay home.`);
    else L.push(`Pack all ${r.take}.`);
    if(i.website)L.push('',`Not counted here: about ${i.website} of these sell through the website in the ${i.websiteDays} days around this date. Those ship from home, so they need printing but they do not go in the van. The Production Plan includes them.`);
    if(r.thin)L.push('',`⚠ It has only sold at ${i.soldIn} past market, so this is a weak signal — a starting point, not a forecast.`);
    L.push('',`Half-life is ${i.halfLifeYears} years: a sale that long ago counts half as much as one today. Change that or the safety percentage under Recommendation Settings on the Production Plan.`);
    return L.join('\n');
  },

  /* ---------------------------------------------------------------- page */
  render(){
    const sf=window.SF,F=this.fc();
    if(!F){sf.$('workspace').innerHTML='<div class="page-stack"><div class="card"><h2>Pack List</h2><p class="muted">The forecast engine did not load.</p></div></div>';return;}
    const up=F.plannable();
    if(!up.length){
      sf.$('workspace').innerHTML=`<div class="page-stack"><div class="card"><h2>Pack List</h2>
        <p class="muted">Nothing to pack for yet. StudioFlow needs either a dated event under Markets &amp; Shows, or sales history from a market it can project forward.</p></div></div>`;
      return;
    }
    if(!up.some(e=>String(e.id)===String(this.selectedEventId)))this.selectedEventId=String(up[0].id);
    const event=up.find(e=>String(e.id)===String(this.selectedEventId));
    const pack=this.packFor(event);
    this._pack=pack;this._event=event;
    const sh=this.sheet(this.selectedEventId);
    const opts=up.map(e=>`<option value="${sf.esc(e.id)}" ${String(e.id)===String(this.selectedEventId)?'selected':''}>${sf.esc(e.name||e.title)} · ${sf.esc(String(F.eventDate(e)).slice(0,10))}</option>`).join('');

    let body='';
    if(pack.blocked)body=`<p class="muted">${sf.esc(pack.blocked)}</p>`;
    else if(!pack.rows||!pack.rows.length)body=`<p class="muted">${sf.esc(pack.note||'Nothing to pack for this event yet.')}</p>`;
    else{
      const byCat={};
      pack.rows.forEach(r=>{(byCat[r.category]=byCat[r.category]||[]).push(r);});
      const cats=Object.entries(byCat).sort((a,b)=>
        b[1].reduce((n,r)=>n+r.target,0)-a[1].reduce((n,r)=>n+r.target,0)||a[0].localeCompare(b[0]));
      const block=([cat,list])=>{
        const sub=list.reduce((n,r)=>n+r.take,0),shortSub=list.reduce((n,r)=>n+r.short,0);
        return `<div class="card fc-block"><div class="fc-block-head"><b>${sf.esc(cat)}</b>
          <span class="badge">${sub} to pack${shortSub?` · ${shortSub} short`:''}</span></div>
        <div class="commerce-table"><table><thead><tr><th></th><th>Photograph</th><th>Product</th><th>Take</th><th>Have</th><th></th></tr></thead><tbody>
        ${list.map(r=>`<tr class="pack-row${sh.checked[r.key]?' packed':''}${r.target?'':' muted'}" data-key="${sf.esc(r.key)}">
          <td><input type="checkbox" class="pack-tick" data-key="${sf.esc(r.key)}" ${sh.checked[r.key]?'checked':''}></td>
          <td>${sf.esc(r.title)}${r.thin?' <span class="badge">thin</span>':''}</td>
          <td>${sf.esc(r.product)}</td>
          <td><b>${r.take||'—'}</b>${r.short?` <span class="pack-short">+${r.short} to print</span>`:''}${!r.target&&r.have?' <span class="pack-opt">optional</span>':''}</td>
          <td>${r.have}</td>
          <td><button class="button secondary pack-why" data-i="${r._i}">Why?</button></td></tr>`).join('')}
        </tbody></table></div></div>`;
      };
      const take=pack.rows.reduce((n,r)=>n+r.take,0);
      const short=pack.rows.reduce((n,r)=>n+r.short,0);
      body=`<p class="muted">Based on <b>${pack.occurrences}</b> previous occurrence(s) of <b>${sf.esc(pack.series)}</b>.${event.projected?` <b>This date is projected</b> from when this market last ran — it isn't on your calendar yet.`:''}</p>
      <p class="muted"><b>${take}</b> item(s) to pack across ${cats.length} categor${cats.length===1?'y':'ies'}.${short?` <b class="pack-short">${short}</b> more still to print — see the Production Plan.`:''}
      Website orders aren't counted here: they ship from home rather than travelling to the booth.</p>
      <div class="fc-columns">${cats.map(block).join('')}</div>`;
    }

    const kit=this.store().packKit;
    const kitHtml=`<div class="card"><div class="fc-block-head"><b>Stand &amp; kit</b>
        <span class="badge">${kit.filter(k=>sh.kit[k]).length} / ${kit.length}</span></div>
      <p class="muted">Not from sales history — this is your own list. It stays the same for every market; the ticks reset per event.</p>
      <div class="pack-kit">${kit.map((k,i)=>`<label class="pack-kit-item${sh.kit[k]?' packed':''}">
        <input type="checkbox" class="kit-tick" data-kit="${sf.esc(k)}" ${sh.kit[k]?'checked':''}>
        <span>${sf.esc(k)}</span><button class="pack-kit-del" data-kitdel="${i}" title="Remove">✕</button></label>`).join('')}</div>
      <div class="row-actions" style="margin-top:10px"><input id="pkNewKit" placeholder="Add something to the kit list" style="flex:1;min-width:200px">
        <button class="button secondary" id="pkAddKit">Add</button></div></div>`;

    sf.$('workspace').innerHTML=`<div class="page-stack"><div class="card">
      <div class="toolbar"><h2 style="margin:0">Pack List</h2>
        <div class="row-actions"><select id="pkEvent">${opts}</select>
          <button class="button secondary" id="pkPrint">Print</button>
          <button class="button secondary" id="pkReset">Reset ticks</button>
          <button class="button secondary" id="pkPlan">Production Plan</button></div></div>
      ${body}
    </div>${kitHtml}</div>`;

    sf.$('pkEvent').onchange=e=>{this.saveNow();this.selectedEventId=e.target.value;this.render();};
    sf.$('pkPlan').onclick=()=>{this.saveNow();if(F)F.selectedEventId=this.selectedEventId;sf.goTo('Production Plan');};
    sf.$('pkPrint').onclick=()=>this.printSheet();
    sf.$('pkReset').onclick=async()=>{
      const s=this.sheet(this.selectedEventId);s.checked={};s.kit={};
      await this.saveNow();this.render();
    };
    // Ticking updates the row in place: a full re-render here would throw away the scroll
    // position halfway down a long list, which is exactly when it gets used.
    document.querySelectorAll('.pack-tick').forEach(cb=>cb.onchange=()=>{
      const s=this.sheet(this.selectedEventId),k=cb.dataset.key;
      if(cb.checked)s.checked[k]=true;else delete s.checked[k];
      const tr=cb.closest('tr');if(tr)tr.classList.toggle('packed',cb.checked);
      this.saveSoon();
    });
    document.querySelectorAll('.kit-tick').forEach(cb=>cb.onchange=()=>{
      const s=this.sheet(this.selectedEventId),k=cb.dataset.kit;
      if(cb.checked)s.kit[k]=true;else delete s.kit[k];
      const l=cb.closest('label');if(l)l.classList.toggle('packed',cb.checked);
      this.saveSoon();
    });
    document.querySelectorAll('.pack-why').forEach(b=>b.onclick=()=>alert(this.whyText(this._pack.rows.find(r=>r._i===Number(b.dataset.i)))));
    const add=async()=>{
      const v=String(sf.$('pkNewKit').value||'').trim();if(!v)return;
      const s=this.store();if(!s.packKit.includes(v))s.packKit.push(v);
      await this.saveNow();this.render();
    };
    sf.$('pkAddKit').onclick=add;
    sf.$('pkNewKit').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add();}};
    document.querySelectorAll('[data-kitdel]').forEach(b=>b.onclick=async()=>{
      const s=this.store();s.packKit.splice(Number(b.dataset.kitdel),1);
      await this.saveNow();this.render();
    });
  },

  /* Prints through the same route as the Year-End Report: the existing @media print rule hides
     everything except #modalRoot, so the sheet is rendered there rather than styled out of the
     dark app chrome. */
  printSheet(){
    const sf=window.SF,F=this.fc(),pack=this._pack,event=this._event;
    if(!pack||!pack.rows)return;
    const sh=this.sheet(this.selectedEventId);
    const byCat={};
    pack.rows.forEach(r=>{(byCat[r.category]=byCat[r.category]||[]).push(r);});
    const cats=Object.entries(byCat).sort((a,b)=>
      b[1].reduce((n,r)=>n+r.target,0)-a[1].reduce((n,r)=>n+r.target,0)||a[0].localeCompare(b[0]));
    const kit=this.store().packKit;
    const when=String(F.eventDate(event)||'').slice(0,10);
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="pack-sheet">
      <div class="no-print" style="text-align:right;margin-bottom:10px">
        <button class="button secondary" id="pkClose">Close</button></div>
      <h1>Pack List</h1>
      <p class="pack-sheet-sub">${sf.esc(event.name||event.title||'')}${when?` · ${sf.esc(when)}`:''}${event.projected?' (projected date)':''}
        — printed ${new Date().toLocaleDateString()}</p>
      ${cats.map(([cat,list])=>`<h2>${sf.esc(cat)}</h2>
        <table><thead><tr><th style="width:28px"></th><th>Photograph</th><th>Product</th><th style="width:70px">Take</th><th style="width:110px">Packed</th></tr></thead><tbody>
        ${list.map(r=>`<tr><td>${sh.checked[r.key]?'✓':'☐'}</td><td>${sf.esc(r.title)}</td><td>${sf.esc(r.product)}</td>
          <td><b>${r.take||'—'}</b>${r.short?` (+${r.short} to print)`:''}</td><td></td></tr>`).join('')}
        </tbody></table>`).join('')}
      <h2>Stand &amp; kit</h2>
      <table><tbody>${kit.map(k=>`<tr><td style="width:28px">${sh.kit[k]?'✓':'☐'}</td><td>${sf.esc(k)}</td></tr>`).join('')}</tbody></table>
    </div></div>`;
    sf.$('pkClose').onclick=()=>sf.closeModal();
    /* g130: this sheet is printed before every market, so its paper belongs in the same ledger as
       everything else. Rows are counted rather than guessed at one page — a long pack list runs to
       two or three sheets and the estimate is prefilled, not assumed. */
    const rowCount=(pack.rows||[]).length+(this.store().packKit||[]).length;
    setTimeout(()=>{
      window.SFPrintLog?.printAndLog({
        label:`Pack list \u2014 ${event.name||event.title||'market'}`,
        sheets:Math.max(1,Math.ceil(rowCount/34)),
        areaPerSheet:48, coverage:'Light', media:'Plain paper', source:'pack-list'
      });
    },120);
  }
};
