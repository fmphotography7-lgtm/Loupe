/* StudioFlow 11.6.1 · Market & Art Show Net Revenue Accounting */
(function(){
 const sf=window.SF, BI=window.SFBusinessIntelligence, C=window.SFCommerceHub;
 if(!sf)return;
 const num=v=>Number(v||0);
 const dateOf=x=>String(x?.date||x?.soldAt||x?.createdAt||'').slice(0,10);
 const eventFor=t=>(sf.state.salesEvents||[]).find(e=>String(e.id)===String(t.eventId));
 const isMarketEvent=e=>!!e&&(e.marketEvent||/Market|Show|Gallery|Exhibition/i.test(e.type||''));
 const eventFees=e=>(e?.fees||[]).reduce((n,f)=>n+num(f.amount),0);
 const txCommission=(t,e)=>{
  if(!e||t.commissionExempt===true)return 0;
  if(t.commissionAmount!==undefined)return num(t.commissionAmount);
  const pct=t.commissionPercent===undefined?num(e.commissionPercent):num(t.commissionPercent);
  return num(t.total)*(pct/100);
 };

 if(BI){
  BI.collect=function(){
   const s=sf.state,rows=[];
   (s.websiteOrders||[]).forEach(o=>rows.push({channel:'Website',date:this.dateOf(o),gross:num(o.total),revenue:num(o.total),cost:num(o.cost||o.materialCost),customer:o.customerName||'Website customer',label:o.orderNumber||'Website order'}));
   (s.serviceJobs||[]).forEach(j=>rows.push({channel:'Services',date:this.dateOf(j),gross:num(j.revenue),revenue:num(j.revenue),cost:num(j.expenses)+num(j.mileageExpense),customer:j.customerName||'Client',label:j.type||'Service'}));
   const txItems=s.salesTransactionItems||[];
   (s.salesTransactions||[]).forEach(t=>{
    const its=(t.lineItems||[]).length?t.lineItems:txItems.filter(i=>String(i.transactionId)===String(t.id));
    const productCost=its.reduce((n,i)=>n+num(i.unitCost||i.cost)*num(i.qty||i.quantity||1),0);
    const gross=num(t.total)||its.reduce((n,i)=>n+num(i.actualPriceAtSale||i.soldPrice)*num(i.qty||i.quantity||1),0);
    const e=eventFor(t),commission=isMarketEvent(e)?txCommission(t,e):0;
    rows.push({channel:'Markets & Shows',date:this.dateOf(t),gross,revenue:gross-commission,cost:productCost+commission,productCost,commission,fees:0,customer:t.customerName||'Market customer',label:t.eventName||e?.name||'Market sale',eventId:t.eventId});
   });
   (s.marketSales||[]).forEach(m=>{if(m.transactionId)return;const gross=num(m.total||m.revenue),e=eventFor(m),commission=isMarketEvent(e)?txCommission(m,e):num(m.commissionAmount);rows.push({channel:'Markets & Shows',date:this.dateOf(m),gross,revenue:gross-commission,cost:num(m.cost)+commission,commission,fees:0,customer:m.customerName||'Market customer',label:m.eventName||m.marketName||e?.name||'Market sale',eventId:m.eventId})});
   (s.salesEvents||[]).filter(isMarketEvent).forEach(e=>{const fees=eventFees(e);if(fees>0)rows.push({channel:'Markets & Shows',date:dateOf(e),gross:0,revenue:-fees,cost:fees,fees,commission:0,customer:'',label:`${e.name||'Market / Show'} event fees`,eventId:e.id,costOnly:true})});
   (s.businessTransactions||[]).forEach(t=>{const kind=String(t.type||t.kind||'').toLowerCase();if(kind.includes('expense'))rows.push({channel:'Other',date:this.dateOf(t),gross:0,revenue:0,cost:num(t.amount),customer:'',label:t.category||'Business expense'});else if(kind.includes('income')||kind.includes('revenue'))rows.push({channel:'Other',date:this.dateOf(t),gross:num(t.amount),revenue:num(t.amount),cost:0,customer:t.customerName||'',label:t.category||'Other income'})});
   return rows.filter(r=>this.inPeriod(r.date)&&(this.channel==='all'||r.channel===this.channel));
  };
  BI.render=function(){
   const s=sf.state,rows=this.collect(),gross=rows.reduce((n,r)=>n+num(r.gross??r.revenue),0),netRevenue=rows.reduce((n,r)=>n+num(r.revenue),0),cost=rows.reduce((n,r)=>n+num(r.cost),0),profit=gross-cost,orders=rows.filter(r=>num(r.gross??r.revenue)>0),aov=orders.length?gross/orders.length:0;
   const byChannel={},byMonth={},byCustomer={};rows.forEach(r=>{const g=num(r.gross??r.revenue);byChannel[r.channel]=byChannel[r.channel]||{gross:0,net:0,cost:0,count:0};byChannel[r.channel].gross+=g;byChannel[r.channel].net+=num(r.revenue);byChannel[r.channel].cost+=num(r.cost);byChannel[r.channel].count+=g>0?1:0;const mk=r.date?r.date.slice(0,7):'Unknown';byMonth[mk]=byMonth[mk]||{gross:0,net:0,cost:0};byMonth[mk].gross+=g;byMonth[mk].net+=num(r.revenue);byMonth[mk].cost+=num(r.cost);if(r.customer)byCustomer[r.customer]=(byCustomer[r.customer]||0)+g});
   const channels=Object.entries(byChannel).sort((a,b)=>b[1].gross-a[1].gross),months=Object.entries(byMonth).filter(x=>x[0]!=='Unknown').sort((a,b)=>a[0].localeCompare(b[0])).slice(-12),customers=Object.entries(byCustomer).sort((a,b)=>b[1]-a[1]).slice(0,8),maxMonth=Math.max(1,...months.map(x=>Math.max(x[1].gross,x[1].cost)));
   const inventoryValue=(s.inventoryItems||[]).reduce((n,i)=>n+num(i.currentOnHand??i.quantity)*num(i.unitCost||i.costPerUnit),0),lowStock=(s.inventoryItems||[]).filter(i=>num(i.currentOnHand??i.quantity)<=num(i.lowStockWarning??i.lowStock)).length;
   const completed=(s.productionQueue||[]).filter(x=>x.status==='Completed'&&x.createdAt&&x.completedAt),turnaround=completed.length?completed.reduce((n,x)=>n+(new Date(x.completedAt)-new Date(x.createdAt))/86400000,0)/completed.length:0,web=s.websiteAnalytics||{},margin=gross?profit/gross*100:0;
   sf.$('workspace').innerHTML=`<div class="bi-1160 page-stack"><section class="dashboard-hero"><div><div class="section-kicker">BUSINESS INTELLIGENCE · 11.6.1</div><h2>Your business, translated into signals.</h2><p>Market and art-show fees and commissions now flow through every monthly and annual total.</p></div><div class="bi-filters"><select id="biPeriod"><option value="year" ${this.period==='year'?'selected':''}>Year</option><option value="month" ${this.period==='month'?'selected':''}>Month</option><option value="all" ${this.period==='all'?'selected':''}>All Time</option></select><select id="biYear">${Array.from({length:7},(_,i)=>new Date().getFullYear()-5+i).map(y=>`<option ${y===Number(this.year)?'selected':''}>${y}</option>`).join('')}</select><select id="biChannel"><option value="all">All Channels</option>${['Website','Services','Markets & Shows','Other'].map(c=>`<option ${this.channel===c?'selected':''}>${c}</option>`).join('')}</select></div></section>
   <section class="bi-kpis bi-kpis-1160"><div><span>Gross Revenue</span><b>${this.money(gross)}</b></div><div><span>Net Revenue</span><b>${this.money(netRevenue)}</b><small>after market fees & commission</small></div><div><span>Expenses & Cost</span><b>${this.money(cost)}</b></div><div><span>Profit</span><b>${this.money(profit)}</b><small>${margin.toFixed(1)}% margin</small></div><div><span>Average Sale</span><b>${this.money(aov)}</b></div><div><span>Inventory Value</span><b>${this.money(inventoryValue)}</b></div></section>
   <div class="bi-1160-grid"><section class="card"><h3>Revenue Trend</h3><div class="bi-month-chart">${months.length?months.map(([m,v])=>`<div class="bi-month-col"><div class="bi-month-bars"><i style="height:${Math.max(3,v.net/maxMonth*100)}%" title="Net revenue ${this.money(v.net)}"></i><em style="height:${Math.max(2,v.cost/maxMonth*100)}%" title="Costs ${this.money(v.cost)}"></em></div><span>${new Date(m+'-01T12:00:00').toLocaleDateString(undefined,{month:'short'})}</span></div>`).join(''):'<div class="empty-state">Enter sales and service values to build the trend.</div>'}</div></section><section class="card"><h3>Sales by Channel</h3>${channels.length?channels.map(([name,v])=>`<div class="bi-channel-row"><span><b>${sf.esc(name)}</b><small>${v.count} transactions · ${this.money(v.gross)} gross</small></span><strong>${this.money(v.net)} net</strong><i>${this.money(v.gross-v.cost)} profit</i></div>`).join(''):'<div class="empty-state">No revenue in this period.</div>'}</section></div>
   <div class="bi-1160-grid"><section class="card"><h3>Customer Value</h3>${customers.length?customers.map(([name,value],i)=>`<div class="bi-rank-row"><span>${i+1}. ${sf.esc(name)}</span><b>${this.money(value)}</b></div>`).join(''):'<div class="empty-state">Link customers to services and orders to calculate lifetime value.</div>'}</section><section class="card"><h3>Operational Health</h3><div class="analytics-metrics"><div><span>Low-stock warnings</span><b>${lowStock}</b></div><div><span>Production turnaround</span><b>${turnaround?turnaround.toFixed(1)+' days':'Not enough data'}</b></div><div><span>Service bookings</span><b>${(s.serviceJobs||[]).filter(x=>this.inPeriod(this.dateOf(x))).length}</b></div><div><span>Market events</span><b>${(s.salesEvents||[]).filter(x=>isMarketEvent(x)&&this.inPeriod(this.dateOf(x))).length}</b></div></div></section></div>
   <section class="card"><div class="commerce-toolbar"><div><div class="section-kicker">WEBSITE ANALYTICS</div><h3>Squarespace / GA4 Snapshot</h3></div><button class="button secondary" id="biWebsite">Open Website Connection</button></div><div class="website-kpis"><div><span>Visitors</span><b>${num(web.visitors).toLocaleString()}</b></div><div><span>Page Views</span><b>${num(web.pageViews).toLocaleString()}</b></div><div><span>Bounce Rate</span><b>${num(web.bounceRate).toFixed(1)}%</b></div><div><span>Orders</span><b>${num(web.orders)}</b></div><div><span>Website Revenue</span><b>${this.money(web.revenue)}</b></div></div><p class="muted">Google Analytics 4 remains the recommended live-data source. StudioFlow displays imported analytics without inventing traffic.</p></section></div>`;
   sf.$('biPeriod').onchange=e=>{this.period=e.target.value;this.render()};sf.$('biYear').onchange=e=>{this.year=+e.target.value;this.render()};sf.$('biChannel').onchange=e=>{this.channel=e.target.value;this.render()};sf.$('biWebsite').onclick=()=>sf.goTo('Website Connection');
  };
 }

 if(C){
  C.periodFigures=function(year=new Date().getFullYear(),month=null){
   const s=sf.state,inPeriod=d=>{if(!d)return false;const x=new Date(d);return x.getFullYear()===year&&(month===null||x.getMonth()===month)},eventAllowed=t=>{const e=(s.salesEvents||[]).find(x=>x.id===t.eventId);return !e||e.includeInReports!==false};
   const tx=(s.salesTransactions||[]).filter(t=>inPeriod(t.soldAt||t.createdAt)&&eventAllowed(t)),artGross=tx.reduce((n,t)=>n+num(t.total),0),commission=tx.reduce((n,t)=>{const e=eventFor(t);return n+(isMarketEvent(e)?txCommission(t,e):0)},0);
   const feeEvents=(s.salesEvents||[]).filter(e=>isMarketEvent(e)&&e.includeInReports!==false&&inPeriod(e.date||e.createdAt)),fees=feeEvents.reduce((n,e)=>n+eventFees(e),0),service=(s.serviceJobs||[]).filter(j=>inPeriod(j.date)).reduce((n,j)=>n+num(j.revenue),0),other=(s.businessTransactions||[]).filter(x=>inPeriod(x.date||x.createdAt)&&x.direction==='in'&&x.type!=='Deposit'&&!x.linkedAwardEventId).reduce((n,x)=>n+num(x.amount),0),award=(s.businessTransactions||[]).filter(x=>inPeriod(x.date||x.createdAt)&&x.direction==='in'&&x.linkedAwardEventId).reduce((n,x)=>n+num(x.amount),0),expenses=(s.businessTransactions||[]).filter(x=>inPeriod(x.date||x.createdAt)&&(x.direction==='out'||['Expense','Equipment','Travel','Accommodation','Meals','Parking','Booth Fee','Software','Insurance','Material Purchase'].includes(x.type))).reduce((n,x)=>n+num(x.amount),0);
   const artNet=artGross-commission-fees,revenue=artNet+service+other+award;
   return {revenue,grossRevenue:artGross+service+other+award,art:artNet,artGross,service,other:other+award,expenses,marketFees:fees,marketCommission:commission,profit:revenue-expenses};
  };
 }
})();
