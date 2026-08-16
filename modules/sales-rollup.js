/* StudioFlow 3.9.0 g59 · Sales history rollup
   Sales live in TWO places and nothing joins them:
     - Markets & Shows receipt builder writes tx.lineItems (this is how Kirk records market sales)
     - The sales engine / commerce hub writes flat state.salesTransactionItems
   Business Intelligence only ever read the second one, so every market sale was invisible to it.
   This module normalises both into one row shape and rolls them up. Nothing is re-entered --
   it is a read-side fix. */
window.SFSalesRollup={
 money(v){return new Intl.NumberFormat('en-CA',{style:'currency',currency:window.SF.state.business?.currency||'CAD'}).format(Number(v||0))},
 num(v){return Number(v)||0},
 tpl(id){return (window.SF.state.inventoryProductTemplates||[]).find(t=>String(t.id)===String(id))||null},
 // Two templates can describe the same real product ("9 × 13" with a multiplication sign and
 // "9 x 13" with a letter). They have different ids, so sales split across them and neither half
 // predicts anything. Group on a normalised key instead of the id, and the split stops mattering.
 productKey(t,fallbackName){
  const src=t?`${t.name||''} ${t.size||''} ${t.presentation||t.category||''}`:String(fallbackName||'');
  return src.toLowerCase().replace(/[\u00d7\u2715\u2716]/g,'x').replace(/[^a-z0-9]+/g,' ').trim()||'unknown';
 },
 // Every template that resolves to the same product, so stock is summed across duplicates too.
 templateIdsFor(key){
  return (window.SF.state.inventoryProductTemplates||[]).filter(t=>this.productKey(t)===key).map(t=>String(t.id));
 },
 event(id){return (window.SF.state.salesEvents||[]).find(e=>String(e.id)===String(id))||null},
 // Strip any year so every occurrence of a market rolls up as one venue.
 seriesName(name){
  return String(name||'').replace(/\b(?:19|20)\d{2}\b/g,' ').replace(/['\u2019]\d{2}\b/g,' ')
   .replace(/\s*[-\u2013\u2014\u00b7,]\s*$/,'').replace(/\s+/g,' ').trim();
 },
 // One flat row per unit-line sold, from whichever format it was stored in.
 rows(){
  const sf=window.SF,out=[];
  const txs=sf.state.salesTransactions||[];
  const flat=sf.state.salesTransactionItems||[];
  const flatByTx=new Map();
  flat.forEach(i=>{
   const k=String(i.transactionId||i.saleId||i.txId||'');
   if(!flatByTx.has(k))flatByTx.set(k,[]);
   flatByTx.get(k).push(i);
  });
  txs.forEach(t=>{
   const ev=this.event(t.eventId);
   const date=t.soldAt||t.date||ev?.date||t.createdAt||'';
   const eventName=t.eventName||ev?.name||'';
   const lines=(t.lineItems&&t.lineItems.length)?t.lineItems:(flatByTx.get(String(t.id))||[]);
   if(!lines.length)return;
   // Market receipts store the money at the receipt level, not per line, so apportion the
   // transaction total across its lines -- weighted by each product's list price where we have
   // one, otherwise evenly by quantity. Units are exact; revenue on these rows is an estimate.
   const enriched=lines.map(li=>{
    const p=this.tpl(li.templateId)||{};
    const qty=Math.max(1,this.num(li.qty??li.quantity??1));
    const direct=this.num(li.actualPriceAtSale??li.actualPrice??li.soldPrice??li.unitPrice??0);
    return {li,p,qty,direct,weight:qty*(this.num(p.price)||1)};
   });
   const declared=enriched.reduce((n,x)=>n+x.direct*x.qty,0);
   const total=this.num(t.total??t.amountPaid??0);
   const weightSum=enriched.reduce((n,x)=>n+x.weight,0)||1;
   enriched.forEach(x=>{
    const exact=x.direct>0;
    const revenue=exact?x.direct*x.qty:(total>0?total*(x.weight/weightSum):0);
    out.push({
     date,
     year:String(date).slice(0,4),
     eventId:t.eventId||'',
     eventName,
     seriesName:this.seriesName(eventName),
     source:t.saleSource||(t.eventId?'Market':'Direct'),
     artworkId:x.li.artworkId||'',
     artworkTitle:x.li.artworkTitle||x.li.title||'Untitled',
     templateId:x.li.templateId||'',
     productKey:this.productKey(x.p&&x.p.id?x.p:null,x.p.name||x.li.productName),
     product:x.p.name||x.li.productName||'Unknown product',
     size:x.p.size||'',
     category:x.p.category||'',
     presentation:x.p.presentation||'',
     qty:x.qty,
     revenue,
     revenueExact:exact||declared>0,
     cost:this.num(x.li.unitCost)*x.qty
    });
   });
  });
  return out.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 },
 // Group rows and total them. keyFn returns the grouping key; labelFn the display label.
 group(rows,keyFn,labelFn){
  const map=new Map();
  rows.forEach(r=>{
   const k=keyFn(r);
   if(k===''||k==null)return;
   if(!map.has(k))map.set(k,{key:k,label:labelFn?labelFn(r):k,qty:0,revenue:0,cost:0,last:'',rows:0});
   const g=map.get(k);
   g.qty+=r.qty;g.revenue+=r.revenue;g.cost+=r.cost;g.rows++;
   if(String(r.date)>String(g.last))g.last=r.date;
  });
  return [...map.values()].sort((a,b)=>b.qty-a.qty||b.revenue-a.revenue);
 },
 stockFor(key){
  const ids=new Set(this.templateIdsFor(key));
  const items=(window.SF.state.inventoryItems||[]).filter(i=>ids.has(String(i.templateId)));
  return items.reduce((n,i)=>n+(Number(i.quantity??i.qty??i.onHand??0)||0),0);
 },
 table(groups,extra){
  const sf=window.SF;
  if(!groups.length)return '<p class="muted">Nothing recorded yet.</p>';
  const max=groups[0].qty||1;
  return `<div class="commerce-table"><div class="commerce-row commerce-header"><span>Product</span><span>Units</span><span>Revenue</span><span>${extra||'Last sold'}</span></div>${
   groups.map(g=>`<div class="commerce-row"><span>${sf.esc(g.label)}<div class="rollup-bar" style="width:${Math.round((g.qty/max)*100)}%"></div></span><span><b>${g.qty}</b></span><span>${this.money(g.revenue)}</span><span>${extra==='In stock'?this.stockFor(g.key):extra==='Cost of goods'?this.money(g.cost):(g.last?new Date(String(g.last)+'T12:00:00').toLocaleDateString():'—')}</span></div>`).join('')
  }</div>`;
 },
 // Rough physical size of a product, used only to rank formats small→large so we can spot an
 // image that sells briskly at the bottom of the range and has never been offered at the top.
 areaOf(key){
  const t=(window.SF.state.inventoryProductTemplates||[]).find(x=>this.productKey(x)===key);
  const m=String(t?.size||t?.name||'').match(/(\d+(?:\.\d+)?)\s*[x\u00d7]\s*(\d+(?:\.\d+)?)/i);
  return m?Number(m[1])*Number(m[2]):0;
 },
 // Which image sells in which format. The two separate rankings can't answer this: an image with
 // 40 card sales and an image with 40 sales spread across canvas are the same number and utterly
 // different printing decisions.
 formatMix(rows){
  const products=this.group(rows,r=>r.productKey,r=>r.product||'Unknown product').slice(0,8);
  const images=this.group(rows,r=>r.artworkId,r=>r.artworkTitle);
  const cell=new Map();
  rows.forEach(r=>{
   const k=`${r.artworkId}|${r.productKey}`;
   cell.set(k,(cell.get(k)||0)+r.qty);
  });
  const ranked=[...products].sort((a,b)=>this.areaOf(a.key)-this.areaOf(b.key));
  const largest=ranked.filter(p=>this.areaOf(p.key)>0).slice(-Math.max(1,Math.ceil(ranked.length/3))).map(p=>p.key);
  const notes=images.map(img=>{
   const sold=products.filter(p=>cell.get(`${img.key}|${p.key}`));
   const big=largest.filter(k=>cell.get(`${img.key}|${k}`));
   if(img.qty>=5&&largest.length&&!big.length)return {label:img.label,text:`sells well but has never sold in a large format — worth testing large`};
   if(sold.length>=3)return {label:img.label,text:`sells across ${sold.length} formats — bring it in everything`};
   return null;
  }).filter(Boolean).slice(0,6);
  return {products,images,cell,notes};
 },
 formatMixTable(rows){
  const sf=window.SF,{products,images,cell,notes}=this.formatMix(rows);
  if(!products.length||!images.length)return '';
  const head=products.map(p=>`<th>${sf.esc(p.label)}</th>`).join('');
  const body=images.slice(0,25).map(img=>`<tr><th scope="row">${sf.esc(img.label)}</th>${
   products.map(p=>{const n=cell.get(`${img.key}|${p.key}`)||0;return `<td class="${n?'mix-has':'mix-none'}">${n||'·'}</td>`}).join('')
  }<td class="mix-total"><b>${img.qty}</b></td></tr>`).join('');
  return `<section class="rollup-lines"><h3>Format mix per image</h3><p class="muted">Which photograph sells in which format. A row that's all in one column is a one-format image; a row spread across columns is one to bring in everything.</p>
   <div class="mix-scroll"><table class="mix-table"><thead><tr><th>Image</th>${head}<th>Total</th></tr></thead><tbody>${body}</tbody></table></div>
   ${notes.length?`<ul class="mix-notes">${notes.map(n=>`<li><b>${sf.esc(n.label)}</b> — ${sf.esc(n.text)}</li>`).join('')}</ul><p class="muted mix-caveat">These are observations about what has already happened, not forecasts. Recency weighting and stock levels come next, and that's when they become recommendations.</p>`:''}
  </section>`;
 },
 render(host){
  const sf=window.SF,rows=this.rows();
  if(!host)return;
  const units=rows.reduce((n,r)=>n+r.qty,0),revenue=rows.reduce((n,r)=>n+r.revenue,0);
  const estimated=rows.some(r=>!r.revenueExact);
  const years=[...new Set(rows.map(r=>r.year).filter(Boolean))].sort();
  const byProduct=this.group(rows,r=>r.productKey,r=>r.product||'Unknown product');
  const byArtwork=this.group(rows,r=>r.artworkId,r=>r.artworkTitle);
  const byMarket=this.group(rows,r=>r.seriesName,r=>r.seriesName);
  // The real unit of decision: this image, at this size, on this material. Everything else is a
  // slice of it. Cost of goods comes straight off the sale lines' unit cost.
  const byLine=this.group(rows,r=>`${r.artworkId}|${r.productKey}`,r=>{
   const bits=[r.size,r.presentation||r.category].filter(Boolean).join(' \u00b7 ');
   return `${r.artworkTitle}${bits?` \u2014 ${bits}`:` \u2014 ${r.product}`}`;
  });
  host.innerHTML=`<section class="card rollup-card"><header class="rollup-head"><div><h2>Sales History</h2><p class="muted">Every sale from both the market register and the sales engine, rolled up together. ${rows.length?`${units} unit${units===1?'':'s'} across ${rows.length} line${rows.length===1?'':'s'}${years.length?`, ${years[0]}–${years[years.length-1]}`:''}.`:'No sales recorded yet — this fills in as you enter them.'}</p></div><div class="rollup-total"><b>${this.money(revenue)}</b><small class="muted">${estimated?'revenue partly estimated':'revenue'}</small></div></header>
  ${estimated?'<p class="muted rollup-note">Market receipts record the money for the whole receipt rather than line by line, so revenue on those is apportioned across the products sold. Unit counts are exact either way — and units are what the print projection runs on.</p>':''}
  <section class="rollup-lines"><h3>By image, size and material</h3><p class="muted">The line you actually print and pack — which photograph, at which size, on which material, and what it cost you to make.</p>${this.table(byLine,'Cost of goods')}</section>
  ${this.formatMixTable(rows)}
  <div class="rollup-grid">
   <div><h3>By product</h3><p class="muted">What you actually print and pack.</p>${this.table(byProduct,'In stock')}</div>
   <div><h3>By piece</h3><p class="muted">Which images earn their wall space.</p>${this.table(byArtwork)}</div>
   <div><h3>By market</h3><p class="muted">Every year of a market counted together.</p>${this.table(byMarket)}</div>
  </div></section>`;
 }
};

/* Surface it on the Business Intelligence page, which until now could not see market sales. */
(function(){
 const BI=window.SFBusinessIntelligence;if(!BI)return;
 const orig=BI.render;
 BI.render=function(){
  orig.call(this);
  const sf=window.SF,shell=sf.$('workspace');
  if(!shell||document.getElementById('salesRollupHost'))return;
  const host=document.createElement('div');
  host.id='salesRollupHost';
  const target=shell.firstElementChild||shell;
  target.appendChild?target.appendChild(host):shell.appendChild(host);
  window.SFSalesRollup.render(host);
 };
})();
