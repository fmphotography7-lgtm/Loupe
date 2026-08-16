/* StudioFlow 11.6.0 · Business Intelligence, Analytics and Colour Swatches */
(function(){
 const sf=window.SF;
 if(!sf)return;

 function colourName(label,input){
  const text=[...label.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent.trim()).filter(Boolean).join(' ');
  return text||input.getAttribute('aria-label')||input.id||'Choose colour';
 }
 function decorateColourInputs(root=document){
  root.querySelectorAll('input[type="color"]:not([data-sf-swatch])').forEach(input=>{
   input.dataset.sfSwatch='1';
   const label=input.closest('label');
   if(label){
    const name=colourName(label,input).replace(/\s+/g,' ').trim();
    label.classList.add('sf-colour-swatch-label');
    label.title=name;
    input.title=name;
    input.setAttribute('aria-label',name);
    [...label.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).forEach(n=>n.textContent='');
   }
   const sync=()=>input.style.setProperty('--sf-picked-colour',input.value||'#4f8fc8');
   input.addEventListener('input',sync);input.addEventListener('change',sync);sync();
  });
 }
 const observer=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)decorateColourInputs(n)})));
 window.addEventListener('studioflow-ready',()=>{decorateColourInputs();observer.observe(document.body,{childList:true,subtree:true})},{once:true});

 const BI=window.SFBusinessIntelligence||{};
 BI.period='year';BI.year=new Date().getFullYear();BI.channel='all';
 BI.money=function(v){return new Intl.NumberFormat('en-CA',{style:'currency',currency:sf.state.business?.currency||'CAD'}).format(Number(v||0))};
 BI.dateOf=function(x){return String(x?.date||x?.soldAt||x?.orderDate||x?.createdAt||'').slice(0,10)};
 BI.inPeriod=function(date){if(!date)return false;const d=new Date(`${date}T12:00:00`);if(isNaN(d))return false;if(this.period==='all')return true;if(this.period==='year')return d.getFullYear()===Number(this.year);if(this.period==='month')return d.getFullYear()===Number(this.year)&&d.getMonth()===Number(this.month||new Date().getMonth());return true};
 BI.collect=function(){
  const s=sf.state, rows=[];
  (s.websiteOrders||[]).forEach(o=>rows.push({channel:'Website',date:this.dateOf(o),revenue:+o.total||0,cost:+o.cost||+o.materialCost||0,customer:o.customerName||'Website customer',label:o.orderNumber||'Website order'}));
  (s.serviceJobs||[]).forEach(j=>rows.push({channel:'Services',date:this.dateOf(j),revenue:+j.revenue||0,cost:+j.expenses||0,customer:j.customerName||'Client',label:j.type||'Service'}));
  const txItems=s.salesTransactionItems||[], txMap=new Map((s.salesTransactions||[]).map(t=>[String(t.id),t]));
  (s.salesTransactions||[]).forEach(t=>{const its=txItems.filter(i=>String(i.transactionId)===String(t.id));const cost=its.reduce((n,i)=>n+(+i.unitCost||+i.cost||0)*(+i.quantity||1),0);rows.push({channel:'Markets & Shows',date:this.dateOf(t),revenue:+t.total||its.reduce((n,i)=>n+(+i.actualPriceAtSale||+i.soldPrice||0)*(+i.quantity||1),0),cost,customer:t.customerName||'Market customer',label:t.eventName||'Market sale'})});
  (s.marketSales||[]).forEach(m=>{if(m.transactionId)return;rows.push({channel:'Markets & Shows',date:this.dateOf(m),revenue:+m.total||+m.revenue||0,cost:+m.cost||0,customer:m.customerName||'Market customer',label:m.eventName||m.marketName||'Market sale'})});
  (s.businessTransactions||[]).forEach(t=>{const kind=String(t.type||t.kind||'').toLowerCase();if(kind.includes('expense'))rows.push({channel:'Other',date:this.dateOf(t),revenue:0,cost:+t.amount||0,customer:'',label:t.category||'Business expense'});else if(kind.includes('income')||kind.includes('revenue'))rows.push({channel:'Other',date:this.dateOf(t),revenue:+t.amount||0,cost:0,customer:t.customerName||'',label:t.category||'Other income'})});
  return rows.filter(r=>this.inPeriod(r.date)&&(this.channel==='all'||r.channel===this.channel));
 };
 BI.render=function(){
  const s=sf.state,rows=this.collect(),revenue=rows.reduce((n,r)=>n+r.revenue,0),cost=rows.reduce((n,r)=>n+r.cost,0),profit=revenue-cost,orders=rows.filter(r=>r.revenue>0),aov=orders.length?revenue/orders.length:0;
  const byChannel={},byMonth={},byCustomer={};rows.forEach(r=>{byChannel[r.channel]=byChannel[r.channel]||{revenue:0,cost:0,count:0};byChannel[r.channel].revenue+=r.revenue;byChannel[r.channel].cost+=r.cost;byChannel[r.channel].count+=r.revenue>0?1:0;const mk=r.date?r.date.slice(0,7):'Unknown';byMonth[mk]=byMonth[mk]||{revenue:0,cost:0};byMonth[mk].revenue+=r.revenue;byMonth[mk].cost+=r.cost;if(r.customer){byCustomer[r.customer]=(byCustomer[r.customer]||0)+r.revenue}});
  const channels=Object.entries(byChannel).sort((a,b)=>b[1].revenue-a[1].revenue),months=Object.entries(byMonth).filter(x=>x[0]!=='Unknown').sort((a,b)=>a[0].localeCompare(b[0])).slice(-12),customers=Object.entries(byCustomer).sort((a,b)=>b[1]-a[1]).slice(0,8),maxMonth=Math.max(1,...months.map(x=>x[1].revenue));
  const inventoryValue=(s.inventoryItems||[]).reduce((n,i)=>n+(+i.currentOnHand||+i.quantity||0)*(+i.unitCost||+i.costPerUnit||0),0),lowStock=(s.inventoryItems||[]).filter(i=>(+i.currentOnHand||+i.quantity||0)<=(+i.lowStockWarning||+i.lowStock||0)).length;
  const completed=(s.productionQueue||[]).filter(x=>x.status==='Completed'&&x.createdAt&&x.completedAt),turnaround=completed.length?completed.reduce((n,x)=>n+(new Date(x.completedAt)-new Date(x.createdAt))/86400000,0)/completed.length:0;
  const web=s.websiteAnalytics||{},margin=revenue?profit/revenue*100:0;
  sf.$('workspace').innerHTML=`<div class="bi-1160 page-stack"><section class="dashboard-hero"><div><div class="section-kicker">BUSINESS INTELLIGENCE · 11.6.0</div><h2>Your business, translated into signals.</h2><p>Revenue, profit, channels, services, markets, customers, inventory and website performance in one cockpit.</p></div><div class="bi-filters"><select id="biPeriod"><option value="year" ${this.period==='year'?'selected':''}>Year</option><option value="month" ${this.period==='month'?'selected':''}>Month</option><option value="all" ${this.period==='all'?'selected':''}>All Time</option></select><select id="biYear">${Array.from({length:7},(_,i)=>new Date().getFullYear()-5+i).map(y=>`<option ${y===Number(this.year)?'selected':''}>${y}</option>`).join('')}</select><select id="biChannel"><option value="all">All Channels</option>${['Website','Services','Markets & Shows','Other'].map(c=>`<option ${this.channel===c?'selected':''}>${c}</option>`).join('')}</select></div></section>
  <section class="bi-kpis bi-kpis-1160"><div><span>Revenue</span><b>${this.money(revenue)}</b></div><div><span>Expenses & Cost</span><b>${this.money(cost)}</b></div><div><span>Profit</span><b>${this.money(profit)}</b><small>${margin.toFixed(1)}% margin</small></div><div><span>Average Sale</span><b>${this.money(aov)}</b></div><div><span>Transactions</span><b>${orders.length}</b></div><div><span>Inventory Value</span><b>${this.money(inventoryValue)}</b></div></section>
  <div class="bi-1160-grid"><section class="card"><h3>Revenue Trend</h3><div class="bi-month-chart">${months.length?months.map(([m,v])=>`<div class="bi-month-col"><div class="bi-month-bars"><i style="height:${Math.max(3,v.revenue/maxMonth*100)}%" title="Revenue ${this.money(v.revenue)}"></i><em style="height:${Math.max(2,v.cost/maxMonth*100)}%" title="Cost ${this.money(v.cost)}"></em></div><span>${new Date(m+'-01T12:00:00').toLocaleDateString(undefined,{month:'short'})}</span></div>`).join(''):'<div class="empty-state">Enter sales and service values to build the trend.</div>'}</div></section><section class="card"><h3>Sales by Channel</h3>${channels.length?channels.map(([name,v])=>`<div class="bi-channel-row"><span><b>${sf.esc(name)}</b><small>${v.count} transactions</small></span><strong>${this.money(v.revenue)}</strong><i>${this.money(v.revenue-v.cost)} profit</i></div>`).join(''):'<div class="empty-state">No revenue in this period.</div>'}</section></div>
  <div class="bi-1160-grid"><section class="card"><h3>Customer Value</h3>${customers.length?customers.map(([name,value],i)=>`<div class="bi-rank-row"><span>${i+1}. ${sf.esc(name)}</span><b>${this.money(value)}</b></div>`).join(''):'<div class="empty-state">Link customers to services and orders to calculate lifetime value.</div>'}</section><section class="card"><h3>Operational Health</h3><div class="analytics-metrics"><div><span>Low-stock warnings</span><b>${lowStock}</b></div><div><span>Production turnaround</span><b>${turnaround?turnaround.toFixed(1)+' days':'Not enough data'}</b></div><div><span>Service bookings</span><b>${(s.serviceJobs||[]).filter(x=>this.inPeriod(this.dateOf(x))).length}</b></div><div><span>Market events</span><b>${(s.salesEvents||[]).filter(x=>this.inPeriod(this.dateOf(x))).length}</b></div></div></section></div>
  <section class="card"><div class="commerce-toolbar"><div><div class="section-kicker">WEBSITE ANALYTICS</div><h3>Squarespace / GA4 Snapshot</h3></div><button class="button secondary" id="biWebsite">Open Website Connection</button></div><div class="website-kpis"><div><span>Visitors</span><b>${Number(web.visitors||0).toLocaleString()}</b></div><div><span>Page Views</span><b>${Number(web.pageViews||0).toLocaleString()}</b></div><div><span>Bounce Rate</span><b>${Number(web.bounceRate||0).toFixed(1)}%</b></div><div><span>Orders</span><b>${Number(web.orders||0)}</b></div><div><span>Website Revenue</span><b>${this.money(web.revenue||0)}</b></div></div><p class="muted">Google Analytics 4 integration remains the recommended live-data source. StudioFlow displays imported analytics without inventing traffic.</p></section></div>`;
  sf.$('biPeriod').onchange=e=>{this.period=e.target.value;this.render()};sf.$('biYear').onchange=e=>{this.year=+e.target.value;this.render()};sf.$('biChannel').onchange=e=>{this.channel=e.target.value;this.render()};sf.$('biWebsite').onclick=()=>sf.goTo('Website Connection');decorateColourInputs();
 };
 window.SFBusinessIntelligence=BI;
})();
