window.SFAIPrintingAssistant={
 mode:'demand',eventId:'',budget:600,windowDays:365,recommendations:[],plan:[],
 money(v){return new Intl.NumberFormat('en-CA',{style:'currency',currency:window.SF.state.business.currency||'CAD'}).format(Number(v||0))},
 ensure(){
  const sf=window.SF;
  sf.state.printingAssistantPlans=Array.isArray(sf.state.printingAssistantPlans)?sf.state.printingAssistantPlans:[];
  sf.state.printingAssistantSettings=sf.state.printingAssistantSettings&&typeof sf.state.printingAssistantSettings==='object'?sf.state.printingAssistantSettings:{};
  const s=sf.state.printingAssistantSettings;
  if(s.mode)this.mode=s.mode;if(s.eventId!==undefined)this.eventId=s.eventId;if(Number(s.budget)>0)this.budget=Number(s.budget);if(Number(s.windowDays)>0)this.windowDays=Number(s.windowDays);
 },
 tpl(id){return window.SF.state.inventoryProductTemplates.find(t=>String(t.id)===String(id))},
 art(id){return window.SF.artworkById(id)},
 event(id){return window.SF.state.salesEvents.find(e=>String(e.id)===String(id))},
 itemProductId(i){return String(i.productTemplateId||i.templateId||i.inventoryTemplateId||'')},
 estimatedCost(t){
  const direct=Number(t?.unitCost??t?.cost??t?.productionCost??0);if(direct>0)return direct;
  const price=Number(t?.price||0);return price>0?price*.35:0;
 },
 collect(){
  const sf=window.SF,now=Date.now(),cutoff=now-(this.windowDays*86400000),txs=sf.state.salesTransactions||[],items=sf.state.salesTransactionItems||[];
  const txMap=new Map(txs.map(t=>[String(t.id),t])),selected=this.event(this.eventId),stats=new Map();
  const keyFor=(a,p)=>`${a}::${p}`;
  const ensure=(artId,tplId,title,product)=>{const k=keyFor(artId,tplId);if(!stats.has(k))stats.set(k,{key:k,artworkId:artId,templateId:tplId,title,product,units:0,revenue:0,recentUnits:0,eventUnits:0,eventCount:new Set(),lastSale:0});return stats.get(k)};
  items.forEach(i=>{
   const tx=txMap.get(String(i.transactionId))||{},d=new Date(tx.soldAt||tx.createdAt||i.soldAt||0).getTime(),q=Math.max(1,Number(i.quantity||1));
   const artId=String(i.artworkId||''),tplId=this.itemProductId(i),title=i.artworkTitle||this.art(artId)?.title||'Unknown artwork',product=i.productName||this.tpl(tplId)?.name||'Unspecified product';
   if(!artId)return;const s=ensure(artId,tplId,title,product);s.units+=q;s.revenue+=Number(i.actualPriceAtSale??i.actualPrice??i.soldPrice??0)*q;if(d>=cutoff)s.recentUnits+=q;if(d>s.lastSale)s.lastSale=d;
   if(tx.eventId)s.eventCount.add(String(tx.eventId));
   if(selected&&String(tx.eventId)===String(selected.id))s.eventUnits+=q;
   else if(selected){const e=this.event(tx.eventId);if(e&&String(e.name||'').trim().toLowerCase()===String(selected.name||'').trim().toLowerCase())s.eventUnits+=q}
  });
  const invMap=new Map();(sf.state.inventoryItems||[]).forEach(i=>{const k=keyFor(String(i.artworkId||''),String(i.templateId||''));invMap.set(k,(invMap.get(k)||0)+Number(i.quantity||0));if(!stats.has(k)&&i.artworkId){const a=this.art(i.artworkId),t=this.tpl(i.templateId);ensure(String(i.artworkId),String(i.templateId),a?.title||i.artworkTitle||'Untitled artwork',t?.name||'Product')}});
  const activeEvents=Math.max(1,new Set(txs.map(t=>t.eventId).filter(Boolean)).size||1),rows=[];
  stats.forEach(s=>{
   const t=this.tpl(s.templateId),onHand=invMap.get(s.key)||0,low=Number((sf.state.inventoryItems||[]).find(i=>String(i.artworkId)===s.artworkId&&String(i.templateId)===s.templateId)?.lowThreshold??t?.lowThreshold??0),restock=Math.max(1,Number(t?.defaultRestock||1));
   const perEvent=s.units/activeEvents,eventDemand=selected?s.eventUnits:0,recentWeight=s.recentUnits*1.5,eventWeight=eventDemand*2.2,stockGap=Math.max(0,low+1-onHand),baseDemand=Math.max(perEvent,s.recentUnits/Math.max(1,this.windowDays/90),eventDemand);
   let qty=Math.max(stockGap,Math.ceil(baseDemand*1.25-onHand));if(s.units===0&&stockGap===0)qty=0;if(qty>0)qty=Math.max(qty,Math.min(restock,Math.max(1,stockGap)));
   const sellPrice=Number(t?.price||0)||(s.units?s.revenue/s.units:0),cost=this.estimatedCost(t),margin=Math.max(0,sellPrice-cost),score=(recentWeight+eventWeight+s.units*.5+stockGap*4+(onHand===0&&s.units>0?5:0)+(margin>0?Math.min(5,margin/25):0));
   const confidence=Math.max(20,Math.min(96,Math.round(25+Math.min(35,s.units*4)+Math.min(20,s.recentUnits*5)+Math.min(16,s.eventCount.size*4))));
   const reasons=[];if(onHand===0&&s.units>0)reasons.push('currently out of stock');else if(onHand<=low)reasons.push(`on hand (${onHand}) is at or below the warning level (${low})`);if(s.recentUnits)reasons.push(`${s.recentUnits} sold in the selected analysis window`);if(eventDemand)reasons.push(`${eventDemand} sold at this event or matching event title`);if(s.units)reasons.push(`${s.units} lifetime recorded sales`);if(!s.units)reasons.push('inventory warning only; no sales history yet');
   rows.push({...s,onHand,low,restock,qty,sellPrice,cost,margin,score,confidence,reasons,estimatedCost:!Number(t?.unitCost??t?.cost??t?.productionCost??0)});
  });
  let recs=rows.filter(r=>r.qty>0).sort((a,b)=>b.score-a.score);
  if(this.mode==='profit')recs.sort((a,b)=>(b.margin*b.confidence)-(a.margin*a.confidence)||b.score-a.score);
  if(this.mode==='budget'){
   let remaining=Math.max(0,Number(this.budget||0));recs=recs.map(r=>{const affordable=r.cost>0?Math.floor(remaining/r.cost):r.qty;const qty=Math.max(0,Math.min(r.qty,affordable));remaining-=qty*r.cost;return {...r,qty}}).filter(r=>r.qty>0);
  }
  this.recommendations=recs;return recs;
 },
 render(){
  this.ensure();const sf=window.SF;const events=[...(sf.state.salesEvents||[])].sort((a,b)=>new Date(b.date)-new Date(a.date));const recs=this.collect();
  const totalUnits=recs.reduce((n,r)=>n+r.qty,0),cost=recs.reduce((n,r)=>n+r.qty*r.cost,0),retail=recs.reduce((n,r)=>n+r.qty*r.sellPrice,0),profit=retail-cost;
  sf.$('workspace').innerHTML=`<div class="print-ai-shell"><header class="print-ai-hero"><div><div class="section-kicker">AI PRINTING ASSISTANT</div><h2>Your next print order, distilled from the evidence.</h2><p>StudioFlow weighs recorded sales, current stock, low-stock warnings, product margins, recent demand, and event history. Every recommendation includes a transparent explanation.</p></div><button class="button primary" id="aiRefresh">↻ Recalculate</button></header>
  <section class="card print-ai-controls"><div><label>Planning mode</label><select id="aiMode"><option value="demand" ${this.mode==='demand'?'selected':''}>Demand & restock balance</option><option value="profit" ${this.mode==='profit'?'selected':''}>Maximize expected profit</option><option value="budget" ${this.mode==='budget'?'selected':''}>Stay within a printing budget</option></select></div><div><label>Upcoming event</label><select id="aiEvent"><option value="">General sales plan</option>${events.map(e=>`<option value="${e.id}" ${String(e.id)===String(this.eventId)?'selected':''}>${sf.esc(e.name)} · ${sf.esc(e.date||'')}</option>`).join('')}</select></div><div><label>Sales history window</label><select id="aiWindow">${[[90,'90 days'],[180,'6 months'],[365,'12 months'],[730,'2 years'],[3650,'All recorded history']].map(x=>`<option value="${x[0]}" ${Number(this.windowDays)===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></div><div class="${this.mode==='budget'?'':'is-dim'}"><label>Printing budget</label><div class="money-input"><b>$</b><input id="aiBudget" type="number" min="0" step="25" value="${Number(this.budget||0)}" ${this.mode==='budget'?'':'disabled'}></div></div></section>
  <section class="print-ai-kpis"><div><span>Recommended units</span><b>${totalUnits}</b></div><div><span>Estimated production</span><b>${this.money(cost)}</b></div><div><span>Potential retail value</span><b>${this.money(retail)}</b></div><div><span>Potential gross margin</span><b>${this.money(profit)}</b></div></section>
  <section class="card print-ai-list"><div class="toolbar"><div><h3>Recommended Print List</h3><p>${this.eventId?`Tailored to ${sf.esc(this.event(this.eventId)?.name||'the selected event')}.`:'Built from all recorded sales and inventory.'} Cost figures marked estimated use 35% of the market price until a production cost is entered.</p></div><button class="button secondary" id="aiSavePlan" ${recs.length?'':'disabled'}>Save Print Plan</button></div>
  ${recs.length?`<div class="print-ai-table"><div class="header"><span>Artwork & product</span><span>On hand</span><span>Sold</span><span>Print</span><span>Confidence</span><span>Estimated cost</span><span></span></div>${recs.map((r,i)=>`<div class="print-ai-row"><span><b>${sf.esc(r.title)}</b><small>${sf.esc(r.product)}</small></span><span>${r.onHand}</span><span>${r.units}</span><span class="print-ai-qty">${r.qty}</span><span><i class="confidence-pill">${r.confidence}%</i></span><span>${this.money(r.qty*r.cost)}${r.estimatedCost?'<small> estimated</small>':''}</span><span><button class="mini-edit" data-ai-why="${i}">Why?</button></span></div>`).join('')}</div>`:'<div class="empty-state roomy"><b>No immediate printing recommendation.</b><br>Your current recorded stock is above warning levels, or StudioFlow needs more sales and inventory data.</div>'}</section>
  <section class="card print-ai-guidance"><h3>How the assistant is thinking</h3><div class="print-ai-guidance-grid"><div><b>Demand</b><p>Lifetime sales, recent sales velocity, and performance at the selected event.</p></div><div><b>Inventory</b><p>Current stock compared with your editable low-stock warning and default restock quantity.</p></div><div><b>Profit</b><p>Market price less entered production cost. Missing costs are conservatively estimated and labelled.</p></div><div><b>Confidence</b><p>Higher when StudioFlow has more sales, more events, and recent evidence for the exact artwork and format.</p></div></div></section></div>`;
  sf.$('aiMode').onchange=e=>{this.mode=e.target.value;this.saveSettings();this.render()};sf.$('aiEvent').onchange=e=>{this.eventId=e.target.value;this.saveSettings();this.render()};sf.$('aiWindow').onchange=e=>{this.windowDays=Number(e.target.value);this.saveSettings();this.render()};if(sf.$('aiBudget'))sf.$('aiBudget').onchange=e=>{this.budget=Math.max(0,Number(e.target.value)||0);this.saveSettings();this.render()};sf.$('aiRefresh').onclick=()=>this.render();sf.$('aiSavePlan').onclick=()=>this.savePlan();document.querySelectorAll('[data-ai-why]').forEach(b=>b.onclick=()=>this.why(Number(b.dataset.aiWhy)));
 },
 saveSettings(){const sf=window.SF;sf.state.printingAssistantSettings={mode:this.mode,eventId:this.eventId,budget:this.budget,windowDays:this.windowDays};sf.persist()},
 savePlan(){const sf=window.SF,recs=this.recommendations;if(!recs.length)return;const selected=this.event(this.eventId),plan={id:sf.makeId('PRINTPLAN'),name:`${selected?.name||'General'} Print Plan · ${new Date().toLocaleDateString()}`,eventId:this.eventId||'',mode:this.mode,budget:this.mode==='budget'?this.budget:null,createdAt:new Date().toISOString(),status:'planned',items:recs.map(r=>({artworkId:r.artworkId,artworkTitle:r.title,templateId:r.templateId,productName:r.product,quantity:r.qty,estimatedUnitCost:r.cost,estimatedRetail:r.sellPrice,confidence:r.confidence}))};sf.state.printingAssistantPlans.push(plan);sf.logActivity(`Saved AI Printing Assistant plan: ${plan.name}`);sf.persist();alert(`Saved “${plan.name}” with ${plan.items.reduce((n,x)=>n+x.quantity,0)} recommended units.`)},
 why(index){const sf=window.SF,r=this.recommendations[index];if(!r)return;const estimated=r.estimatedCost?'StudioFlow is estimating production cost at 35% of the market price because no unit cost is stored for this product.':'The production cost comes from the product record.';sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card print-ai-why"><div class="section-kicker">WHY THIS RECOMMENDATION?</div><h2>${sf.esc(r.title)}</h2><h3>${sf.esc(r.product)}</h3><div class="why-quantity"><b>${r.qty}</b><span>recommended to print</span></div><ul>${r.reasons.map(x=>`<li>${sf.esc(x)}</li>`).join('')}</ul><div class="why-math"><div><span>On hand</span><b>${r.onHand}</b></div><div><span>Low warning</span><b>${r.low}</b></div><div><span>Recorded sold</span><b>${r.units}</b></div><div><span>Confidence</span><b>${r.confidence}%</b></div><div><span>Estimated unit cost</span><b>${this.money(r.cost)}</b></div><div><span>Expected unit margin</span><b>${this.money(r.margin)}</b></div></div><p class="muted">${sf.esc(estimated)}</p><div class="row-actions"><button class="button primary" id="aiWhyClose">Close</button></div></div></div>`;sf.$('aiWhyClose').onclick=()=>sf.closeModal()}
};
