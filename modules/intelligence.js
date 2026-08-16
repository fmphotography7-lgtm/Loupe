/* StudioFlow — Intelligence surfaces (g85)
   The last three pieces of 4.0. No new maths engine: everything reads SFSalesRollup (history) and
   SFForecast (recommendations). Three places it shows up:

     1. STOCK FLAGS      — Business Intelligence page, catalogue-wide
     2. INTELLIGENCE TAB — inside the artwork editor, one photograph at a time
     3. RECOMMENDATIONS  — Home Dashboard card, opening into Production Plan

   All three attach by WRAPPING the existing render functions, the way sales-rollup.js already
   reaches Business Intelligence. Nothing is cut into dashboard.js's or artworks.js's template
   literals, so if this module were deleted the app would be exactly as it was.

   On thresholds: Kirk rejected "Business Health gauges" from the 4.0 spec because invented
   thresholds read back as insight. The flags below are the same shape of thing, so they are built
   the opposite way round -- every flag states the RAW NUMBERS first ("18 on the shelf, sells about
   4 a year"), the label second, and the thresholds are named and editable. The number is the
   finding; the label is only shorthand for it. */
window.SFIntel = {
  DEFAULTS:{slowMonths:24,overYears:3,shortMonths:6},
  settings(){
    const F=window.SFForecast;
    const s=F?F.settings():(window.SF.state.forecastSettings=window.SF.state.forecastSettings||{});
    for(const k in this.DEFAULTS)if(s[k]==null)s[k]=this.DEFAULTS[k];
    return s;
  },
  R(){return window.SFSalesRollup;},
  F(){return window.SFForecast;},
  money(v){return this.R()?this.R().money(v):`$${Number(v||0).toFixed(2)}`;},

  /* Recency-weighted units per YEAR. Every year from the first sale to now is an observation,
     including the ones with no sales -- the same correction made to the event forecast in g84.
     Dropping the empty years is what makes a piece that sold once in 2019 look like a steady
     seller. */
  annualRate(rowsForKey){
    const F=this.F(),cfg=this.settings();
    if(!rowsForKey.length)return {rate:0,years:0,lastSold:'',units:0};
    const byYear={};let units=0,lastSold='';
    for(const r of rowsForKey){
      const y=Number(String(r.date).slice(0,4));if(!y)continue;
      byYear[y]=(byYear[y]||0)+(Number(r.qty)||0);
      units+=Number(r.qty)||0;
      if(!lastSold||r.date>lastSold)lastSold=r.date;
    }
    const ys=Object.keys(byYear).map(Number);
    if(!ys.length)return {rate:0,years:0,lastSold,units};
    const first=Math.min(...ys),now=new Date().getFullYear();
    let wSum=0,wQty=0;
    for(let y=first;y<=now;y++){
      const w=F?F.weightFor(`${y}-07-01`,cfg.halfLifeYears||3):1;
      wSum+=w;wQty+=w*(byYear[y]||0);
    }
    return {rate:wSum?wQty/wSum:0,years:now-first+1,lastSold,units};
  },

  monthsSince(dateStr){
    const d=new Date(dateStr);if(isNaN(d))return null;
    return (Date.now()-d.getTime())/(30.44*24*3600*1000);
  },

  /* One row per photograph + product that has stock OR history. Pieces with stock and no sales
     have to come from inventoryItems, since they appear nowhere in the sales rows. */
  stockFlags(){
    const R=this.R(),F=this.F(),cfg=this.settings();
    if(!R||!F)return [];
    const rows=R.rows()||[],byKey={};
    const titles={};
    for(const r of rows){
      if(r.artworkId&&r.artworkTitle)titles[r.artworkId]=r.artworkTitle;
      const k=`${r.artworkId||r.artworkTitle}|${r.productKey}`;
      (byKey[k]=byKey[k]||{artworkId:r.artworkId||'',title:r.artworkTitle||'(untitled)',
        productKey:r.productKey,product:r.product,templateId:r.templateId,rows:[]}).rows.push(r);
    }
    // Stock that has never sold.
    const tpls=window.SF.state.inventoryProductTemplates||[];
    for(const i of (window.SF.state.inventoryItems||[])){
      const qty=Number(i.quantity??i.qty??i.onHand??0)||0;
      if(qty<=0||!i.artworkId)continue;
      const t=tpls.find(x=>String(x.id)===String(i.templateId));
      const pk=R.productKey(t,t&&t.name);
      const k=`${i.artworkId}|${pk}`;
      if(!byKey[k])byKey[k]={artworkId:i.artworkId,title:titles[i.artworkId]||i.artworkTitle||this.titleFor(i.artworkId),
        productKey:pk,product:(t&&t.name)||'Unknown product',templateId:i.templateId,rows:[]};
    }
    const out=[];
    for(const k in byKey){
      const c=byKey[k];
      const stock=F.stockFor(c.artworkId,c.productKey);
      const a=this.annualRate(c.rows);
      const cover=a.rate>0?stock/a.rate:(stock>0?Infinity:0);
      const months=a.lastSold?this.monthsSince(a.lastSold):null;
      let flag='',why='';
      const per=Math.round(a.rate*10)/10;
      if(stock>0&&!a.units){
        flag='never sold';
        why=`${stock} on the shelf and none has ever sold.`;
      }else if(stock>0&&months!=null&&months>=cfg.slowMonths){
        flag='slow';
        why=`${stock} on the shelf; nothing sold since ${String(a.lastSold).slice(0,10)} (${Math.round(months)} months). Slow is anything past ${cfg.slowMonths} months.`;
      }else if(stock>0&&cover>=cfg.overYears){
        flag='over-stocked';
        why=`${stock} on the shelf, selling about ${per} a year — roughly ${cover===Infinity?'more than you will sell':`${Math.round(cover*10)/10} years'`} worth. Over-stocked is anything past ${cfg.overYears} years.`;
      }else if(a.rate>=2&&stock>0&&cover*12<=cfg.shortMonths){
        flag='running short';
        why=`Only ${stock} left and it sells about ${per} a year — about ${Math.round(cover*12)} months' worth. Short is anything under ${cfg.shortMonths} months.`;
      }else if(a.rate>=2&&stock===0){
        flag='running short';
        why=`None on the shelf and it sells about ${per} a year.`;
      }
      if(!flag)continue;
      out.push({artworkId:c.artworkId,title:c.title,product:c.product,templateId:c.templateId,
        category:F.categoryFor(c.templateId,c.product),
        stock,rate:per,cover,lastSold:a.lastSold,units:a.units,flag,why,
        value:stock*(this.unitValue(c.rows)||0)});
    }
    const order={'running short':0,'never sold':1,'over-stocked':2,'slow':3};
    return out.sort((x,y)=>order[x.flag]-order[y.flag]||y.value-x.value||x.title.localeCompare(y.title));
  },
  unitValue(rows){
    if(!rows||!rows.length)return 0;
    const u=rows.reduce((n,r)=>n+r.qty,0);
    return u?rows.reduce((n,r)=>n+r.revenue,0)/u:0;
  },
  titleFor(artworkId){
    const sf=window.SF;
    const a=(sf.state.artworks||[]).find(x=>String(x.id)===String(artworkId)||String(x.artworkId)===String(artworkId));
    return (a&&a.title)||artworkId||'(untitled)';
  },

  flagsHtml(list,opts){
    const sf=window.SF,o=opts||{};
    if(!list.length)return `<p class="muted">Nothing flagged${o.piece?' for this piece':''} — every product with stock is selling at a rate its shelf can support.</p>`;
    const groups={};list.forEach(r=>{(groups[r.flag]=groups[r.flag]||[]).push(r);});
    const blurb={'running short':'Selling faster than the shelf can cover.',
      'over-stocked':'More on the shelf than the history supports.',
      'slow':'Sitting there, not moving.',
      'never sold':'Made, but never bought.'};
    return Object.keys(blurb).filter(f=>groups[f]).map(f=>`<div class="card fc-block">
      <div class="fc-block-head"><b>${f.charAt(0).toUpperCase()+f.slice(1)} <span class="flag-dot flag-${f.replace(/ /g,'-')}"></span></b>
        <span class="badge">${groups[f].length}</span></div>
      <p class="muted" style="margin:0 0 6px">${blurb[f]}</p>
      <div class="commerce-table"><table><thead><tr>${o.piece?'':'<th>Photograph</th>'}<th>Product</th><th>Stock</th><th>Per year</th><th></th></tr></thead><tbody>
      ${groups[f].map(r=>`<tr>${o.piece?'':`<td>${sf.esc(r.title)}</td>`}<td>${sf.esc(r.product)}</td><td>${r.stock}</td><td>${r.rate}</td>
        <td><button class="button secondary intel-why" data-why="${sf.esc(r.why)}">Why?</button></td></tr>`).join('')}
      </tbody></table></div></div>`).join('');
  },
  bindWhy(scope){
    (scope||document).querySelectorAll('.intel-why').forEach(b=>b.onclick=()=>alert(b.dataset.why));
  },

  /* ------------------------------------------------------- per-piece report */
  pieceReport(artworkId){
    const R=this.R(),F=this.F();
    if(!R)return null;
    const all=R.rows()||[];
    const mine=all.filter(r=>String(r.artworkId)===String(artworkId));
    const units=mine.reduce((n,r)=>n+r.qty,0);
    const revenue=mine.reduce((n,r)=>n+r.revenue,0);
    const cost=mine.reduce((n,r)=>n+(r.cost||0),0);
    const estimated=mine.some(r=>!r.revenueExact);
    const dates=mine.map(r=>r.date).filter(Boolean).sort();
    const roll=(keyFn,labelFn)=>{
      const m={};
      mine.forEach(r=>{const k=keyFn(r);if(!k)return;(m[k]=m[k]||{label:labelFn(r),units:0,revenue:0}).units+=r.qty;m[k].revenue+=r.revenue;});
      return Object.entries(m).map(([k,v])=>Object.assign({key:k},v)).sort((a,b)=>b.units-a.units);
    };
    const byProduct=roll(r=>r.productKey,r=>r.product);
    byProduct.forEach(p=>{p.stock=F?F.stockFor(artworkId,p.key):0;});
    const byMarket=roll(r=>r.seriesName||r.source,r=>r.seriesName||r.source||'Direct');
    const flags=this.stockFlags().filter(f=>String(f.artworkId)===String(artworkId));
    // What the next event would ask for, if there is one to plan against.
    let next=null;
    if(F&&F.plannable){
      const ev=(F.plannable()||[])[0];
      if(ev){
        const plan=F.planForEvent(ev);
        if(plan&&plan.rows){
          const rows=plan.rows.filter(r=>String(r.artworkId)===String(artworkId));
          if(rows.length)next={event:ev,rows};
        }
      }
    }
    return {units,revenue,cost,estimated,first:dates[0]||'',last:dates[dates.length-1]||'',
      byProduct,byMarket,flags,next};
  },
  pieceHtml(artworkId){
    const sf=window.SF,rep=this.pieceReport(artworkId);
    if(!rep)return '<p class="muted">The sales rollup is not loaded.</p>';
    if(!rep.units&&!rep.flags.length)
      return '<p class="muted">No sales are recorded for this photograph yet. Once it sells, this tab shows what it sells as, where it sells, and what to print for the next market.</p>';
    const margin=rep.revenue-rep.cost;
    const tbl=(list,head,extra)=>`<div class="commerce-table"><table><thead><tr><th>${head}</th><th>Units</th><th>Revenue</th>${extra?`<th>${extra}</th>`:''}</tr></thead><tbody>
      ${list.map(r=>`<tr><td>${sf.esc(r.label)}</td><td>${r.units}</td><td>${this.money(r.revenue)}</td>${extra?`<td>${r.stock}</td>`:''}</tr>`).join('')}</tbody></table></div>`;
    return `<div class="intel-kpis">
        <div><span>Units sold</span><b>${rep.units}</b></div>
        <div><span>Revenue</span><b>${this.money(rep.revenue)}</b></div>
        <div><span>Cost of goods</span><b>${this.money(rep.cost)}</b></div>
        <div><span>Margin</span><b>${this.money(margin)}</b></div>
      </div>
      <p class="muted">${rep.first?`First sold ${String(rep.first).slice(0,10)}, most recently ${String(rep.last).slice(0,10)}.`:''}
        ${rep.estimated?'Some revenue is apportioned from whole-receipt market sales; unit counts are exact.':''}</p>
      ${rep.next?`<div class="card fc-block"><div class="fc-block-head"><b>For ${sf.esc(rep.next.event.name||rep.next.event.title)}</b>
        <span class="badge">${rep.next.rows.reduce((n,r)=>n+r.recommend,0)} to print</span></div>
        <div class="commerce-table"><table><thead><tr><th>Product</th><th>Have</th><th>Print</th></tr></thead><tbody>
        ${rep.next.rows.map(r=>`<tr><td>${sf.esc(r.product)}</td><td>${r.inputs.stock}</td><td><b>${r.recommend||'—'}</b></td></tr>`).join('')}
        </tbody></table></div></div>`:''}
      <h3>What it sells as</h3>${rep.byProduct.length?tbl(rep.byProduct,'Product','In stock'):'<p class="muted">—</p>'}
      <h3>Where it sells</h3>${rep.byMarket.length?tbl(rep.byMarket,'Market or channel'):'<p class="muted">—</p>'}
      <h3>Stock flags</h3>${this.flagsHtml(rep.flags,{piece:true})}`;
  }
};

/* 1. STOCK FLAGS on Business Intelligence. Second wrapper on the same render -- sales-rollup.js
      already added one, and wrapping again simply runs after it. */
(function(){
  const BI=window.SFBusinessIntelligence;if(!BI)return;
  const orig=BI.render;
  BI.render=function(){
    orig.call(this);
    try{ window.SFIntel._paintFlags(); }
    catch(e){ console.warn('Stock flags could not be added:',e); }
  };
  window.SFIntel._paintFlags=function(){
    const sf=window.SF,shell=sf.$('workspace');
    if(!shell||document.getElementById('intelFlagsHost'))return;
    const host=document.createElement('div');
    host.id='intelFlagsHost';
    const target=shell.firstElementChild||shell;
    target.appendChild(host);
    const I=window.SFIntel,list=I.stockFlags();
    const short=list.filter(f=>f.flag==='running short').length;
    const idle=list.filter(f=>f.flag!=='running short').reduce((n,f)=>n+f.value,0);
    /* g127: the consolidated view goes ABOVE the stock flags, and the four long lists it replaces
       are folded into a details block rather than deleted — the detail is still occasionally the
       thing he needs, it just should not be the first thing he reads. */
    const pieces=document.createElement('div');
    pieces.innerHTML=`<section class="card rollup-card"><header class="rollup-head"><div><h2>Every photograph</h2>
      <p class="muted">One row per picture: what it sells as, how much of it, and what it made.
      Popularity is relative to your own best seller \u2014 there is no absolute scale on which a
      number of art cards is "four stars".</p></div></header>
      ${I.piecesTable()}</section>`;
    target.appendChild(pieces);
    try{
      const olds=target.querySelectorAll('.rollup-lines, .rollup-grid, .rollup-mix');
      if(olds.length){
        const fold=document.createElement('details');
        fold.className='card';
        fold.innerHTML='<summary><b>The detailed breakdowns</b> \u2014 by image and size, by product, by piece, by market, and the format mix</summary>';
        olds.forEach(o=>fold.appendChild(o));
        target.appendChild(fold);
      }
    }catch(e){ console.warn('Could not fold the detailed lists:',e); }

    host.innerHTML=`<section class="card rollup-card"><header class="rollup-head"><div><h2>Stock flags</h2>
      <p class="muted">What the same sales history says about what is on the shelf right now.
      Every flag states its own numbers — the label is only shorthand for them, and the thresholds
      are yours to change under Recommendation Settings on the Production Plan.</p></div>
      <div class="rollup-total"><b>${list.length}</b><small class="muted">flagged${short?` · ${short} running short`:''}</small></div></header>
      ${idle>0?`<p class="muted rollup-note">About ${I.money(idle)} of stock is flagged slow, over-stocked or never sold — money already spent, sitting in a box.</p>`:''}
      <div class="fc-columns">${I.flagsHtml(list.filter(f=>f.flag!=='never sold'))}</div>
      <h3 style="margin-top:16px">Printed but never sold</h3>
      ${I.neverSoldTable()}</section>`;
    I.bindWhy(host);
  };
})();

/* 2. INTELLIGENCE TAB in the artwork editor. Injected after the modal is built rather than cut
      into artworks.js's 10KB template literal, and only for a piece that already exists -- a
      brand-new artwork has no history to report. */
(function(){
  const A=window.SFArtworks;if(!A||!A.openEditor)return;
  const orig=A.openEditor;
  A.openEditor=function(id){
    const r=orig.apply(this,arguments);
    try{
      const modal=document.querySelector('.artwork-modal');
      const web=document.getElementById('tab-website');
      const tabs=modal&&modal.querySelector('.tabs');
      if(!modal||!web||!tabs||document.getElementById('tab-intel'))return r;
      const artId=(document.getElementById('artId')||{}).value||'';
      if(!artId)return r;                     // new piece: nothing to report yet
      tabs.insertAdjacentHTML('beforeend','<button class="tab" data-tab="intel">Intelligence</button>');
      web.insertAdjacentHTML('afterend',`<div id="tab-intel" class="tab-panel intel-panel">${window.SFIntel.pieceHtml(artId)}</div>`);
      // The original bound its handlers before this button existed, so rebind them all.
      modal.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
        modal.querySelectorAll('.tab,.tab-panel').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        const p=document.getElementById(`tab-${b.dataset.tab}`);if(p)p.classList.add('active');
      });
      window.SFIntel.bindWhy(modal);
    }catch(e){console.warn('Intelligence tab could not be added:',e);}
    return r;
  };
})();

/* g127: the Home Dashboard's Production Recommendations card was REMOVED at Kirk's request.
   The same numbers live on the Production Plan and Pack List, one click away in the nav, and the
   dashboard had grown long enough that a second copy was noise rather than a shortcut. Deleted
   rather than hidden — a card nobody wants should not sit there costing a render every visit. */


/* StudioFlow g127 — ONE PIECE PER ROW.
   ====================================
   Business Intelligence had grown four long lists — by image+size+material, by product, by piece,
   by market — plus a separate format-mix matrix. Kirk reads down them looking for one thing: how
   is this photograph doing, and in what does it sell. So this is that, as a single table.

   A row per photograph: the picture, a popularity rating, a column per product category showing
   units, then its own units and revenue. A totals row underneath answers "what did I sell and what
   did it make" without adding anything up by hand.

   STARS ARE RELATIVE, and the header says so. There is no absolute scale on which 40 art cards is
   "four stars" — it only means anything against his other work, so five stars is his best seller
   and the rest are ranked against it. An invented absolute threshold would be exactly the kind of
   number he rejected from the 4.0 spec. */
Object.assign(window.SFIntel, {
  piecesTable(){
    const R=this.R(), F=this.F(), sf=window.SF;
    if(!R) return '<p class="muted">The sales rollup is not loaded.</p>';
    const rows=R.rows()||[];
    if(!rows.length) return '<p class="muted">No sales recorded yet.</p>';

    const cats=[], byPiece={};
    for(const r of rows){
      const cat=F?F.categoryFor(r.templateId,r.product):(r.category||'Other');
      if(!cats.includes(cat))cats.push(cat);
      const key=r.artworkId||r.artworkTitle||'(untitled)';
      const p=byPiece[key]||(byPiece[key]={id:r.artworkId||'',title:r.artworkTitle||'(untitled)',
        units:0,revenue:0,cost:0,cells:{}});
      p.units+=r.qty; p.revenue+=r.revenue; p.cost+=r.cost||0;
      p.cells[cat]=(p.cells[cat]||0)+r.qty;
    }
    cats.sort((a,b)=>a.localeCompare(b));
    const pieces=Object.values(byPiece).sort((a,b)=>b.units-a.units||b.revenue-a.revenue);
    const best=pieces[0]?pieces[0].units:0;
    const stars=u=>{
      if(!best) return 0;
      return Math.max(1,Math.round((u/best)*5));      // relative to his own best seller
    };
    const idx=sf.imageIndex?sf.imageIndex():null;
    const cat=sf.artworkCatalog?sf.artworkCatalog():[];
    /* g130: guarded. This ran sf.titleKey unconditionally, and a missing helper threw inside the
       BI wrapper's try/catch — which meant the whole Stock flags card silently vanished rather
       than one thumbnail being blank. A missing picture must never cost a section. */
    const key=t=>{ try{ return sf.titleKey?sf.titleKey(t):String(t||'').toLowerCase(); }catch(_){ return ''; } };
    const imgFor=p=>{
      try{
        const a=cat.find(x=>String(x.id)===String(p.id)||String(x.artworkId)===String(p.id)
          ||(key(x.title)&&key(x.title)===key(p.title)));
        return a&&sf.artworkImage?sf.artworkImage(a,idx):'';
      }catch(_){ return ''; }
    };

    const totals={units:0,revenue:0,cost:0,cells:{}};
    pieces.forEach(p=>{
      totals.units+=p.units; totals.revenue+=p.revenue; totals.cost+=p.cost;
      cats.forEach(c=>{ if(p.cells[c])totals.cells[c]=(totals.cells[c]||0)+p.cells[c]; });
    });

    return `<div class="commerce-table intel-pieces"><table>
      <thead><tr><th></th><th>Photograph</th>
        <th title="Relative to your best seller \u2014 five stars is the piece that sells most">Popularity</th>
        ${cats.map(c=>`<th>${sf.esc(c)}</th>`).join('')}
        <th>Units</th><th>Revenue</th></tr></thead>
      <tbody>${pieces.map(p=>{
        const src=imgFor(p);
        const n=stars(p.units);
        return `<tr>
          <td>${src?`<img class="intel-thumb" src="${sf.esc(src)}" alt="" loading="lazy">`:'<span class="intel-thumb blank"></span>'}</td>
          <td>${sf.esc(p.title)}</td>
          <td><span class="intel-stars" title="${p.units} unit(s)">${'\u2605'.repeat(n)}<span class="dim">${'\u2605'.repeat(5-n)}</span></span></td>
          ${cats.map(c=>`<td>${p.cells[c]||'<span class="muted">\u2014</span>'}</td>`).join('')}
          <td><b>${p.units}</b></td><td>${this.money(p.revenue)}</td></tr>`;
      }).join('')}</tbody>
      <tfoot><tr><td></td><td><b>Everything</b></td><td></td>
        ${cats.map(c=>`<td><b>${totals.cells[c]||0}</b></td>`).join('')}
        <td><b>${totals.units}</b></td><td><b>${this.money(totals.revenue)}</b></td></tr></tfoot>
    </table></div>
    <p class="muted">${pieces.length} photograph(s) \u00b7 <b>${totals.units}</b> item(s) sold \u00b7
      <b>${this.money(totals.revenue)}</b> revenue${totals.cost?` \u00b7 ${this.money(totals.revenue-totals.cost)} after cost of goods`:''}.</p>`;
  },

  /* "Never sold" as a table of PRINTS, not a list of lines: which photograph, which size, how many
     are sitting there. Kirk asked for it by print size because that is the decision — whether to
     stop printing that size, not whether to stop printing the picture. */
  neverSoldTable(){
    const sf=window.SF, F=this.F();
    const list=this.stockFlags().filter(f=>f.flag==='never sold');
    if(!list.length) return '<p class="muted">Nothing on the shelf is unsold \u2014 every product with stock has sold at least once.</p>';
    const byPiece={};
    list.forEach(f=>{
      const p=byPiece[f.title]||(byPiece[f.title]={title:f.title,rows:[],units:0,value:0});
      p.rows.push(f); p.units+=f.stock; p.value+=f.value||0;
    });
    const pieces=Object.values(byPiece).sort((a,b)=>b.units-a.units);
    return `<div class="commerce-table"><table>
      <thead><tr><th>Photograph</th><th>Printed as</th><th>On the shelf</th></tr></thead>
      <tbody>${pieces.map(p=>p.rows.map((r,i)=>`<tr>
        <td>${i===0?`<b>${sf.esc(p.title)}</b>`:''}</td>
        <td>${sf.esc(r.product)}</td>
        <td>${r.stock}</td></tr>`).join('')).join('')}</tbody>
      <tfoot><tr><td><b>${pieces.length} photograph(s)</b></td><td></td>
        <td><b>${pieces.reduce((n,p)=>n+p.units,0)}</b></td></tr></tfoot>
    </table></div>
    <p class="muted">These are printed and have never sold. Grouped by photograph so you can see
    whether it is the picture that isn't selling or only one size of it.</p>`;
  }
});
