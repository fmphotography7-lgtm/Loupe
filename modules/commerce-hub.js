window.SFCommerceHub={
  _reportReceipts:false,
  /* g103: a receipt is either a data URL (records made before g103) or an absolute path on disk
     (made after). The app runs from a file:// origin, so a local path renders directly once
     encoded. */
  receiptSrc(v){
    const raw=String(v||'');
    if(!raw) return '';
    if(/^data:/i.test(raw)||/^file:\/\//i.test(raw)) return raw;
    return 'file:///'+raw.replace(/\\/g,'/').replace(/^\/+/,'').split('/').map(encodeURIComponent).join('/');
  },
  /* RECEIPT APPENDIX. The report's Business Expenses section is a category summary -- one line per
     category. That is what a tax return needs, but not what an accountant asks for when they query
     a figure: they want the receipt. This appends the photographs at the end, each captioned with
     date, payee, category and amount, so the summary stays clean and the evidence sits behind it.
     Off by default, because it can add a lot of pages. */
  receiptsForYear(year){
    const sf=window.SF, y=String(year);
    return (sf.state.businessTransactions||[])
      .filter(t=>t&&t.direction==='out'&&String(t.date||'').slice(0,4)===y&&t.receiptImage)
      .sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  },
  receiptAppendix(year){
    if(!this._reportReceipts) return '';
    const sf=window.SF, list=this.receiptsForYear(year);
    if(!list.length) return `<section class="report-section report-appendix"><h3>Appendix \u2014 Receipts</h3>
      <p class="muted">No receipt photographs are attached to ${year} expenses.</p></section>`;
    return `<section class="report-section report-appendix"><h3>Appendix \u2014 Receipts</h3>
      <p class="muted">${list.length} receipt${list.length===1?'':'s'} attached to ${year} expenses, in date order.</p>
      <div class="receipt-grid">${list.map(t=>`<figure class="receipt-item">
        <img src="${this.receiptSrc(t.receiptImage)}" alt="">
        <figcaption>${sf.esc(String(t.date||'').slice(0,10))} \u00b7 ${sf.esc(t.payee||'\u2014')}<br>
          ${sf.esc(t.type||'Uncategorised')} \u00b7 ${this.money(Number(t.amount)||0)}</figcaption>
      </figure>`).join('')}</div></section>`;
  },
 tab:'register',
 tabs:[['register','Sales Register'],['transactions','Transactions'],['customers','Customers'],['services','Services'],['expenses','Expenses'],['calendar','Calendar'],['overview','Marketing'],['summary','Event Summary']],
 money(n){return new Intl.NumberFormat('en-CA',{style:'currency',currency:window.SF.state.business.currency||'CAD'}).format(Number(n||0))},
 ensure(){const s=window.SF.state;['customers','serviceJobs','salesSources','salesEvents','salesTransactions','salesTransactionItems','businessTransactions','quotes','giftCertificates'].forEach(k=>s[k]=Array.isArray(s[k])?s[k]:[])},
 render(){this.ensure();const sf=window.SF;if(!this.tabs.some(x=>x[0]===this.tab))this.tab='register';sf.$('workspace').innerHTML=`<div class="commerce-shell"><header class="commerce-head"><div><div class="section-kicker">STUDIOFLOW 11.4.5</div><h2>Sales & Orders</h2><p class="muted">Sales, customers, services, expenses, events and business performance now live in one workspace.</p></div><button class="button primary" id="addBusinessTransaction">＋ Business Expense/Deposit</button></header><nav class="commerce-tabs sales-master-tabs">${this.tabs.map(([id,label])=>`<button data-commerce-tab="${id}" class="${this.tab===id?'active':''}">${label}</button>`).join('')}</nav><div id="commerceBody"></div></div>`;document.querySelectorAll('[data-commerce-tab]').forEach(b=>b.onclick=()=>{this.tab=b.dataset.commerceTab;document.querySelectorAll('[data-commerce-tab]').forEach(x=>x.classList.toggle('active',x.dataset.commerceTab===this.tab));this.draw()});sf.$('addBusinessTransaction').onclick=()=>this.openBusinessTransaction();this.draw()},
 draw(){const f={overview:()=>this.overview(),register:()=>this.register(),events:()=>this.events(),transactions:()=>this.transactions(),summary:()=>this.summary(),customers:()=>this.customers(),services:()=>this.services(),expenses:()=>this.expenses(),calendar:()=>this.calendar()};(f[this.tab]||f.overview)()},
 customerName(id,fallback='Walk-in / Not Saved'){return window.SF.state.customers.find(c=>c.id===id)?.name||fallback},
 // For a sale with no saved customer, showing "Walk-in / Not Saved" throws away real information
 // when the sale is linked to a market/show — the actual event name is far more useful. Falls back
 // to the generic label only when there's truly no customer AND no linked event.
 saleAttribution(t){
   const sf=window.SF;
   if(t.customerId)return this.customerName(t.customerId,t.customerName||'');
   const hasRealCustomerName=t.customerName&&!/^(walk-in|not saved)/i.test(t.customerName);
   if(hasRealCustomerName)return t.customerName;
   const ev=(sf.state.salesEvents||[]).find(e=>String(e.id)===String(t.eventId));
   if(ev)return ev.name;
   return t.customerName||'Walk-in / Not Saved';
 },
 revenueData(){const s=window.SF.state,art=s.salesTransactions.reduce((n,t)=>n+Number(t.total||0),0),service=s.serviceJobs.reduce((n,j)=>n+Number(j.revenue||0),0),deposits=s.businessTransactions.filter(x=>x.type==='Deposit').reduce((n,x)=>n+Number(x.amount||0),0),refunds=s.businessTransactions.filter(x=>x.type==='Refund').reduce((n,x)=>n+Number(x.amount||0),0),expenses=s.businessTransactions.filter(x=>['Expense','Material Purchase'].includes(x.type)).reduce((n,x)=>n+Number(x.amount||0),0);return {art,service,deposits,refunds,expenses,total:art+service+deposits-refunds}},
 overview(){const sf=window.SF,s=sf.state,r=this.revenueData(),byEvent={},bySource={},byService={};s.salesTransactions.forEach(t=>{const e=s.salesEvents.find(x=>x.id===t.eventId)?.name||'No Event';byEvent[e]=(byEvent[e]||0)+Number(t.total||0);const src=t.saleSource||'Direct';bySource[src]=(bySource[src]||0)+Number(t.total||0)});s.serviceJobs.forEach(j=>{const k=j.type||'Other';byService[k]=(byService[k]||0)+Number(j.revenue||0)});const outstanding=s.salesTransactions.reduce((n,t)=>n+Math.max(0,Number(t.total||0)-Number(t.amountPaid??t.total??0)),0)+s.serviceJobs.reduce((n,j)=>n+Math.max(0,Number(j.revenue||0)-Number(j.amountPaid||0)),0),quotes=s.quotes.filter(q=>!['Accepted','Declined','Expired'].includes(q.status)).reduce((n,q)=>n+Number(q.amount||0),0);sf.$('commerceBody').innerHTML=`<div class="commerce-kpis revenue-kpis"><div><b>${this.money(r.total)}</b><span>Total Business Revenue</span></div><div><b>${this.money(r.art)}</b><span>Artwork Revenue</span></div><div><b>${this.money(r.service)}</b><span>Service Revenue</span></div><div><b>${this.money(r.deposits)}</b><span>Deposits</span></div><div><b>${this.money(outstanding)}</b><span>Outstanding Balances</span></div><div><b>${this.money(quotes)}</b><span>Outstanding Quotes</span></div></div><div class="marketing-grid"><section class="card"><h3>Revenue by Event</h3>${this.summaryRows(byEvent)}</section><section class="card"><h3>Revenue by Sales Source</h3>${this.summaryRows(bySource)}</section><section class="card"><h3>Revenue by Service Type</h3>${this.summaryRows(byService)}</section><section class="card"><h3>Financial Engine</h3><div class="summary-line"><span>Refunds</span><b>${this.money(r.refunds)}</b></div><div class="summary-line"><span>Expenses & Material Purchases</span><b>${this.money(r.expenses)}</b></div><div class="summary-line"><span>Gift Certificates</span><b>${this.money(s.giftCertificates.reduce((n,g)=>n+Number(g.balance||0),0))}</b></div></section></div>`},
 summaryRows(obj){const e=Object.entries(obj).sort((a,b)=>b[1]-a[1]);return e.length?e.map(([k,v])=>`<div class="summary-line"><span>${window.SF.esc(k)}</span><b>${this.money(v)}</b></div>`).join(''):'<div class="empty-state">No data recorded yet.</div>'},
 register(){const sf=window.SF,tx=[...sf.state.salesTransactions].sort((a,b)=>new Date(b.soldAt||b.createdAt)-new Date(a.soldAt||a.createdAt));sf.$('commerceBody').innerHTML=`<section class="card"><div class="commerce-toolbar"><div><h3>Sales Register</h3><p class="muted">Record a sale -- add real items and it opens fulfillment automatically, tied to actual artwork and inventory.</p></div><button class="button primary" id="newSale">＋ Record Sale</button></div>${this.transactionTable(tx.slice(0,30))}</section>`;sf.$('newSale').onclick=()=>this.openSale();document.querySelectorAll('[data-edit-sale]').forEach(b=>b.onclick=()=>this.openSale(b.dataset.editSale));document.querySelectorAll('[data-delete-sale]').forEach(b=>b.onclick=()=>this.deleteSaleTransaction(b.dataset.deleteSale))},
 transactionTable(tx){const sf=window.SF;const isPositiveStatus=s=>/paid in full|completed|received/i.test(String(s||''));return `<div class="commerce-table"><div class="commerce-row header"><span>Date</span><span>Customer</span><span>Source</span><span>Status</span><span>Total</span><span></span></div>${tx.length?tx.map(t=>`<div class="commerce-row"><span>${new Date(t.soldAt||t.createdAt||Date.now()).toLocaleDateString()}</span><span>${sf.esc(this.saleAttribution(t))}</span><span>${sf.esc(t.saleSource||'Direct')}</span><span><b class="${isPositiveStatus(t.orderStatus)?'payment-paid':''}">${sf.esc(t.orderStatus||'Completed')}</b></span><span><b>${this.money(t.total)}</b></span><span class="row-actions"><button data-edit-sale="${t.id}">Edit</button><button class="mini-edit danger" data-delete-sale="${t.id}">Delete</button></span></div>`).join(''):'<div class="empty-state roomy">No sales recorded yet.</div>'}</div>`},
 deleteSaleTransaction(id){
  const sf=window.SF, C=this;
  const t=sf.state.salesTransactions.find(x=>x.id===id);
  if(!t)return;
  const linkedOrder=sf.state.websiteOrders.find(o=>o.manualSaleTransactionId===id||o.salesTransactionId===id);
  const label=`${this.saleAttribution(t)} · ${this.money(t.total)}`;
  const warning=linkedOrder
   ? `<p class="muted">This sale has a linked fulfillment order (${sf.esc(linkedOrder.orderNumber||linkedOrder.id)}). Deleting the sale will also delete that order and its items. This cannot be undone.</p>`
   : `<p class="muted">This removes the sale record. This cannot be undone.</p>`;
  sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card"><h2>Delete this sale?</h2><p class="muted">${sf.esc(label)}</p>${warning}<div class="row-actions"><button class="button secondary" id="delSaleCancel">Cancel</button><button class="button danger" id="delSaleConfirm">Delete Permanently</button></div></div></div>`;
  sf.$('delSaleCancel').onclick=()=>sf.closeModal();
  sf.$('delSaleConfirm').onclick=async()=>{
   sf.state.salesTransactions=sf.state.salesTransactions.filter(x=>x.id!==id);
   if(linkedOrder){
    sf.state.websiteOrders=sf.state.websiteOrders.filter(x=>x.id!==linkedOrder.id);
    sf.state.websiteOrderItems=sf.state.websiteOrderItems.filter(i=>i.orderId!==linkedOrder.id);
    sf.state.productionQueue=(sf.state.productionQueue||[]).filter(x=>x.orderId!==linkedOrder.id);
   }
   sf.logActivity(`Deleted sale ${label}${linkedOrder?' and its linked order':''}`);
   await sf.persist();
   sf.closeModal();
   C.draw();
  };
 },
 events(){const sf=window.SF,today=new Date().toISOString().slice(0,10),all=[...sf.state.salesEvents],upcoming=all.filter(x=>(x.endDate||x.date||'')>=today&&x.status!=='finished').sort((a,b)=>String(a.date).localeCompare(String(b.date))),past=all.filter(x=>!upcoming.includes(x)).sort((a,b)=>String(b.date).localeCompare(String(a.date))),card=x=>`<article class="customer-card event-card"><h3>${sf.esc(x.name)}</h3><p>${sf.esc(x.type||'Event')}<br>${x.date?new Date(x.date+'T12:00:00').toLocaleDateString():'No date'}${x.endDate&&x.endDate!==x.date?` – ${new Date(x.endDate+'T12:00:00').toLocaleDateString()}`:''}</p><div><b>${this.money(sf.state.salesTransactions.filter(t=>t.eventId===x.id).reduce((n,t)=>n+Number(t.total||0),0))}</b><span>event revenue</span></div><button data-edit-event="${x.id}">Edit Event</button></article>`;sf.$('commerceBody').innerHTML=`<section class="card"><div class="commerce-toolbar"><div><h3>Upcoming Events</h3><p class="muted">Add weddings, markets, exhibitions and multi-day shows here.</p></div><button class="button primary" id="newEvent">＋ New Event</button></div><div class="customer-grid">${upcoming.length?upcoming.map(card).join(''):'<div class="empty-state roomy">No upcoming events. Add your next wedding or art show.</div>'}</div></section><section class="card"><h3>Past Events</h3><div class="customer-grid">${past.length?past.map(card).join(''):'<div class="empty-state">No past events yet.</div>'}</div></section>`;sf.$('newEvent').onclick=()=>this.openEvent();document.querySelectorAll('[data-edit-event]').forEach(b=>b.onclick=()=>this.openEvent(b.dataset.editEvent))},
 transactions(){const sf=window.SF,all=[...sf.state.businessTransactions.map(x=>({...x,date:x.date||x.createdAt,displayType:x.type,displayAmount:x.amount})),...sf.state.salesTransactions.map(x=>({...x,date:x.soldAt||x.createdAt,displayType:'Artwork Sale',displayAmount:x.total})),...sf.state.serviceJobs.map(x=>({...x,date:x.date,displayType:'Service Sale',displayAmount:x.revenue}))].sort((a,b)=>new Date(b.date)-new Date(a.date));const isPositiveStatus=s=>/paid in full|completed|received/i.test(String(s||''));sf.$('commerceBody').innerHTML=`<section class="card"><div class="commerce-toolbar"><div><h3>All Business Transactions</h3><p class="muted">The unified financial stream, without deleting legacy module records.</p></div><button class="button primary" id="newAnyTx">＋ Add Transaction</button></div><div class="commerce-table has-receipts"><div class="commerce-row header"><span>Date</span><span>Type</span><span>Customer / Payee</span><span>Status</span><span>Amount</span><span>Receipt</span><span></span></div>${all.length?all.map(x=>`<div class="commerce-row"><span>${new Date(x.date||Date.now()).toLocaleDateString()}</span><span><b>${sf.esc(x.displayType)}</b></span><span>${sf.esc(x.displayType==='Artwork Sale'?this.saleAttribution(x):this.customerName(x.customerId,x.customerName||x.payee||'—'))}</span><span class="${isPositiveStatus(x.status||x.orderStatus)?'payment-paid':''}">${sf.esc(x.status||x.orderStatus||'Recorded')}</span><span><b>${this.money(x.displayAmount)}</b></span><span></span></div>`).join(''):'<div class="empty-state roomy">No transactions recorded yet.</div>'}</div></section>`;sf.$('newAnyTx').onclick=()=>this.openBusinessTransaction()},
 summary(){const sf=window.SF;const events=sf.state.salesEvents.map(e=>{const tx=sf.state.salesTransactions.filter(t=>t.eventId===e.id);return {e,count:tx.length,revenue:tx.reduce((n,t)=>n+Number(t.total||0),0)}}).sort((a,b)=>b.revenue-a.revenue);sf.$('commerceBody').innerHTML=`<section class="card"><h3>Event Summary</h3><div class="commerce-table"><div class="commerce-row header"><span>Event</span><span>Date</span><span>Transactions</span><span>Status</span><span>Revenue</span><span></span></div>${events.length?events.map(x=>`<div class="commerce-row"><span><b>${sf.esc(x.e.name)}</b></span><span>${sf.esc(x.e.date||'')}</span><span>${x.count}</span><span>${sf.esc(x.e.status||'open')}</span><span><b>${this.money(x.revenue)}</b></span><span></span></div>`).join(''):'<div class="empty-state roomy">Create an event to see its summary.</div>'}</div></section>`},
 customers(){const sf=window.SF;sf.$('commerceBody').innerHTML=`<section class="card"><div class="commerce-toolbar"><div><h3>Customer Directory</h3><p class="muted">Only customers explicitly saved to the directory appear here.</p></div><button class="button primary" id="newCustomer">＋ Add Customer</button></div><div class="customer-grid">${sf.state.customers.length?sf.state.customers.map(c=>`<article class="customer-card"><h3>${sf.esc(c.name)}</h3><p>${sf.esc(c.company||'')}<br>${sf.esc(c.email||'No email')}<br>${sf.esc(c.phone||'No phone')}</p><div><b>${this.money(sf.state.salesTransactions.filter(t=>t.customerId===c.id).reduce((n,t)=>n+Number(t.total||0),0)+sf.state.serviceJobs.filter(j=>j.customerId===c.id).reduce((n,j)=>n+Number(j.revenue||0),0))}</b><span>lifetime value</span></div><button data-edit-customer="${c.id}">Edit Customer</button></article>`).join(''):'<div class="empty-state roomy">No saved customers yet.</div>'}</div></section>`;sf.$('newCustomer').onclick=()=>this.openCustomer();document.querySelectorAll('[data-edit-customer]').forEach(b=>b.onclick=()=>this.openCustomer(b.dataset.editCustomer))},
 services(){const sf=window.SF,j=[...sf.state.serviceJobs].sort((a,b)=>String(b.date).localeCompare(String(a.date)));sf.$('commerceBody').innerHTML=`<div class="commerce-kpis"><div><b>${j.length}</b><span>Service Jobs</span></div><div><b>${this.money(j.reduce((n,x)=>n+Number(x.revenue||0),0))}</b><span>Service Revenue</span></div><div><b>${this.money(j.reduce((n,x)=>n+Number(x.revenue||0)-Number(x.expenses||0)-Number(x.mileageExpense||0),0))}</b><span>Estimated Profit</span></div><div><b>${j.reduce((n,x)=>n+Number(x.hours||0),0).toFixed(1)}</b><span>Hours</span></div></div><section class="card"><div class="commerce-toolbar"><div><h3>Services</h3><p class="muted">Individual, company, saved and not-saved customer workflows.</p></div><button class="button primary" id="newService">＋ Add Service Job</button></div><div class="commerce-table service"><div class="commerce-row header"><span>Date</span><span>Service</span><span>Customer</span><span>Status</span><span>Revenue</span><span></span></div>${j.length?j.map(x=>`<div class="commerce-row"><span>${x.date?new Date(x.date+'T12:00:00').toLocaleDateString():'—'}</span><span><b>${sf.esc(x.type||'Service')}</b></span><span>${sf.esc(this.customerName(x.customerId,x.customerName||x.company||'Not Saved'))}</span><span>${sf.esc(x.status||'Booked')}</span><span><b>${this.money(x.revenue)}</b></span><span><button data-edit-service="${x.id}">Edit</button></span></div>`).join(''):'<div class="empty-state roomy">No service jobs recorded yet.</div>'}</div></section>`;sf.$('newService').onclick=()=>this.openService();document.querySelectorAll('[data-edit-service]').forEach(b=>b.onclick=()=>this.openService(b.dataset.editService))},
 customerWorkflow(prefix,mode='walkin',selected=''){const sf=window.SF,isService=prefix==='job';return `<div class="customer-workflow"><label>Customer option<select id="${prefix}CustomerMode">${isService?`<option value="existing" ${mode==='existing'?'selected':''}>Existing Customer</option><option value="individual" ${mode==='individual'||mode==='new'?'selected':''}>Individual</option><option value="company" ${mode==='company'?'selected':''}>Company</option><option value="walkin" ${mode==='walkin'?'selected':''}>Not Saved</option>`:`<option value="existing" ${mode==='existing'?'selected':''}>Existing Customer</option><option value="new" ${mode==='new'?'selected':''}>New Customer</option><option value="walkin" ${mode==='walkin'?'selected':''}>Walk-in / Not Saved</option>`}</select></label><div id="${prefix}ExistingWrap"><label>Customer<select id="${prefix}Existing"><option value="">Select customer</option>${sf.state.customers.map(c=>`<option value="${c.id}" ${c.id===selected?'selected':''}>${sf.esc(c.name)}</option>`).join('')}</select></label></div><div id="${prefix}NewWrap" class="form-grid"><label>Name<input id="${prefix}Name"></label><label>Company<input id="${prefix}Company"></label><label>Phone<input id="${prefix}Phone"></label><label>Email<input id="${prefix}Email" type="email"></label><label class="checkline span2"><input id="${prefix}SaveCustomer" type="checkbox" checked> Save to Customer Directory</label></div></div>`},
 bindCustomerWorkflow(prefix){const sf=window.SF,draw=()=>{const m=sf.$(`${prefix}CustomerMode`).value;sf.$(`${prefix}ExistingWrap`).style.display=m==='existing'?'block':'none';sf.$(`${prefix}NewWrap`).style.display=['new','individual','company'].includes(m)?'grid':'none'};sf.$(`${prefix}CustomerMode`).onchange=draw;draw()},
 resolveCustomer(prefix){const sf=window.SF,m=sf.$(`${prefix}CustomerMode`).value;if(m==='existing')return {customerId:sf.$(`${prefix}Existing`).value,customerName:this.customerName(sf.$(`${prefix}Existing`).value,'')};if(m==='walkin')return {customerId:'',customerName:prefix==='job'?'Not Saved':'Walk-in / Not Saved'};const data={name:sf.$(`${prefix}Name`).value.trim(),company:sf.$(`${prefix}Company`).value.trim(),phone:sf.$(`${prefix}Phone`).value.trim(),email:sf.$(`${prefix}Email`).value.trim()};if(sf.$(`${prefix}SaveCustomer`).checked&&data.name){const c={id:sf.makeId('CUS'),...data,createdAt:new Date().toISOString()};sf.state.customers.push(c);return {customerId:c.id,customerName:c.name}}return {customerId:'',customerName:data.name||data.company||'Not Saved',customerCompany:data.company,customerPhone:data.phone,customerEmail:data.email}},
 openSale(id=''){
  const sf=window.SF,t=sf.state.salesTransactions.find(x=>x.id===id)||{};
  const catalog=sf.artworkCatalog?sf.artworkCatalog():[];
  const templates=sf.state.inventoryProductTemplates||[];
  this._draftSaleLines=this._draftSaleLines||[];
  const lineRow=(l,i)=>`<div class="pw-batch-line"><span>${l.qty} × ${sf.esc(l.artworkTitle)} — ${sf.esc(l.templateName)}</span><button data-remove-sale-line="${i}" class="button danger">Remove</button></div>`;
  sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><form class="modal-card wide" id="saleForm"><h2>${id?'Edit Sale':'Record Sale'}</h2><p class="muted">This is a real sale, tied to real artwork and inventory -- saving opens the same fulfillment workspace used for website orders, so it's produced and accounted for exactly the same way.</p>${this.customerWorkflow('sale',t.customerId?'existing':'walkin',t.customerId)}<div class="form-grid"><label>Date<input id="saleDate" type="datetime-local" value="${(t.soldAt||new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString()).slice(0,16)}"></label><label>Sales Source<input id="saleSource" value="${sf.esc(t.saleSource||'In-Person')}"></label><label>Event<select id="saleEvent"><option value="">No event</option>${sf.state.salesEvents.map(e=>`<option value="${e.id}" ${e.id===t.eventId?'selected':''}>${sf.esc(e.name)}</option>`).join('')}</select></label></div>
  <h3>Items Sold</h3><p class="muted">Select the actual artwork, or "Other / Client Print" for a portrait-session print that isn't in the catalogue.</p>
  <div class="form-grid"><label>Artwork<select id="saleLineArt"><option value="">-- Select --</option>${catalog.map(a=>`<option value="${sf.esc(a.id||a.artworkId)}">${sf.esc(a.title||'Untitled')}</option>`).join('')}<option value="__custom__">Other / Client Print (not in catalogue)</option></select></label><label>Product<select id="saleLineTemplate">${templates.map(tp=>`<option value="${tp.id}">${sf.esc(tp.name)}</option>`).join('')}</select></label><label>Quantity<input id="saleLineQty" type="number" min="1" value="1"></label></div>
  <button type="button" class="button secondary" id="addSaleLine">＋ Add Item</button>
  <div id="saleLines" class="pw-batch-lines">${this._draftSaleLines.map(lineRow).join('')||'<div class="empty-state">No items added yet.</div>'}</div>
  <div class="form-grid"><label>Total Revenue<input id="saleTotal" type="number" min="0" step=".01" value="${Number(t.total||0)}" required></label><label>Deposit / Amount Paid<input id="salePaid" type="number" min="0" step=".01" value="${Number(t.amountPaid??t.total??0)}"></label><label>Status<select id="saleStatus">${['Quote','Pending','Deposit Paid','Completed','Refunded'].map(x=>`<option ${x===(t.orderStatus||'Completed')?'selected':''}>${x}</option>`).join('')}</select></label></div>
  <label>Notes<textarea id="saleNotes">${sf.esc(t.notes||'')}</textarea></label><div class="row-actions"><button type="button" class="button secondary" id="saleCancel">Cancel</button><button class="button primary">${this._draftSaleLines.length?'Save & Open Fulfillment':'Save Sale'}</button></div></form></div>`;
  this.bindCustomerWorkflow('sale');
  sf.$('addSaleLine').onclick=()=>{
   const artId=sf.$('saleLineArt').value, tplId=sf.$('saleLineTemplate').value, qty=Math.max(1,Number(sf.$('saleLineQty').value)||1);
   if(!artId||!tplId)return alert('Select both an artwork (or Other/Client Print) and a product.');
   const art=artId==='__custom__'?null:catalog.find(a=>String(a.id||a.artworkId)===artId);
   const tpl=templates.find(tp=>tp.id===tplId);
   this._draftSaleLines.push({artworkId:artId,artworkTitle:artId==='__custom__'?'Other / Client Print':(art?.title||'Untitled'),templateId:tplId,templateName:tpl?.name||'Product',qty});
   this.openSale(id);
  };
  document.querySelectorAll('[data-remove-sale-line]').forEach(b=>b.onclick=()=>{this._draftSaleLines.splice(Number(b.dataset.removeSaleLine),1);this.openSale(id)});
  sf.$('saleCancel').onclick=()=>{this._draftSaleLines=[];sf.closeModal()};
  sf.$('saleForm').onsubmit=async e=>{
   e.preventDefault();
   const c=this.resolveCustomer('sale');
   const total=Number(sf.$('saleTotal').value)||0, paid=Number(sf.$('salePaid').value)||0;
   const rec={...t,id:t.id||sf.makeId('TX'),...c,eventId:sf.$('saleEvent').value,soldAt:new Date(sf.$('saleDate').value).toISOString(),saleSource:sf.$('saleSource').value.trim()||'In-Person',total,amountPaid:paid,orderStatus:sf.$('saleStatus').value,notes:sf.$('saleNotes').value.trim(),updatedAt:new Date().toISOString(),createdAt:t.createdAt||new Date().toISOString()};
   const i=sf.state.salesTransactions.findIndex(x=>x.id===rec.id);if(i>=0)sf.state.salesTransactions[i]=rec;else sf.state.salesTransactions.push(rec);
   if(this._draftSaleLines.length){
    // Real items sold -- create a manual order and hand it straight to Production Workspace,
    // reusing its already-built fulfillment flow (Existing Inventory vs Produce New, recipe
    // consumption, packaging) instead of duplicating any of that logic here.
    const order={id:sf.makeId('WEB-ORD'),orderNumber:`SALE-${rec.id.slice(-6)}`,source:this.customerName(c.customerId,c.customerName)+' (In-Person Sale)',customerId:c.customerId,customerName:c.customerName,orderDate:rec.soldAt,status:'Pending',paymentState:paid>=total&&total>0?'PAID':paid>0?'PARTIALLY_PAID':'AUTHORIZED',total,inventoryDeducted:false,manualSaleTransactionId:rec.id,createdAt:new Date().toISOString()};
    sf.state.websiteOrders.push(order);
    this._draftSaleLines.forEach(l=>{
     sf.state.websiteOrderItems.push({id:sf.makeId('WEB-LINE'),orderId:order.id,productName:l.templateName,artworkId:l.artworkId,quantity:l.qty,createdAt:new Date().toISOString()});
    });
    this._draftSaleLines=[];
    sf.logActivity(`Recorded sale and created a fulfillment order (${order.orderNumber})`);
    await sf.persist();
    sf.closeModal();
    window.SFProductionWorkspace.render(order.id);
    return;
   }
   sf.logActivity(`${id?'Updated':'Recorded'} sale ${this.money(rec.total)} (no items -- revenue only)`);
   await sf.persist();sf.closeModal();this.draw();
  };
 },

 calendar(){const sf=window.SF,today=new Date(),events=[...sf.state.salesEvents.map(x=>({id:x.id,name:x.name,date:x.date,endDate:x.endDate,type:x.type||'Event'})),...sf.state.serviceJobs.filter(x=>x.date).map(x=>({id:x.id,name:`${x.type||'Service'} · ${this.customerName(x.customerId,x.customerName||x.company||'Client')}`,date:x.date,endDate:x.endDate||x.date,type:'Service'}))].sort((a,b)=>String(a.date).localeCompare(String(b.date)));const badge=x=>{const d=Math.ceil((new Date(x.date+'T12:00:00')-today)/86400000);return d<=3?'urgent':d<=7?'soon':'future'};sf.$('commerceBody').innerHTML=`<section class="card"><div class="commerce-toolbar"><div><h3>Business Calendar</h3><p class="muted">Service bookings, art shows, markets and other events appear here automatically.</p></div><button class="button primary" id="calendarAddEvent">＋ Add Event</button></div><div class="calendar-list">${events.length?events.map(x=>`<article class="calendar-item ${badge(x)}"><div><b>${sf.esc(x.name)}</b><small>${sf.esc(x.type)}</small></div><strong>${new Date(x.date+'T12:00:00').toLocaleDateString()}</strong></article>`).join(''):'<div class="empty-state roomy">No scheduled events yet.</div>'}</div></section>`;sf.$('calendarAddEvent').onclick=()=>this.openEvent()},
 openService(id=''){const sf=window.SF,j=sf.state.serviceJobs.find(x=>x.id===id)||{};sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><form class="modal-card wide" id="serviceForm"><h2>${id?'Edit Service Job':'Add Service Job'}</h2>${this.customerWorkflow('job',j.customerId?'existing':'new',j.customerId)}<div class="form-grid"><label>Service Type<input id="jobType" value="${sf.esc(j.type||'')}"></label><label>Date<input id="jobDate" type="date" value="${j.date||new Date().toISOString().slice(0,10)}"></label><label>Referral Source<input id="jobReferral" value="${sf.esc(j.referralSource||'')}"></label><label>Hours<input id="jobHours" type="number" min="0" step=".25" value="${Number(j.hours||0)}"></label><label>Mileage<input id="jobMileage" type="number" min="0" step=".1" value="${Number(j.mileage||0)}"></label><label>Expenses<input id="jobExpenses" type="number" min="0" step=".01" value="${Number(j.expenses||0)}"></label><label>Revenue<input id="jobRevenue" type="number" min="0" step=".01" value="${Number(j.revenue||0)}"></label><label>Deposit already paid<input id="jobPaid" type="number" min="0" step=".01" value="${Number(j.amountPaid||0)}"></label><label>Status<select id="jobStatus">${['Quote','Inquiry','Booked','Deposit Paid','In Progress','Completed','Paid in Full','Cancelled'].map(x=>`<option ${x===(j.status||'Booked')?'selected':''}>${x}</option>`).join('')}</select></label></div><section class="service-payments-box"><div class="commerce-toolbar"><div><h3>Payments</h3><p class="muted">Add final or instalment payments. The balance and Paid in Full status update automatically.</p></div><button type="button" class="button secondary" id="jobAddPayment">＋ Add Payment</button></div><div id="jobPaymentRows">${(j.payments||[]).map(p=>`<div class="service-payment-row"><input data-pay-date type="date" value="${p.date||new Date().toISOString().slice(0,10)}"><input data-pay-amount type="number" min="0" step=".01" value="${Number(p.amount||0)}" placeholder="Amount"><input data-pay-note value="${sf.esc(p.note||'')}" placeholder="Final payment, instalment..."><button type="button" class="button danger remove-service-payment">Remove</button></div>`).join('')}</div><div class="service-payment-summary">Paid: <b id="jobPaidTotal">$0.00</b> · Balance: <b id="jobBalance">$0.00</b></div></section><label>Notes<textarea id="jobNotes">${sf.esc(j.notes||'')}</textarea></label><div class="row-actions"><button type="button" class="button secondary" id="jobCancel">Cancel</button><button class="button primary">Save Service Job</button></div></form></div>`;this.bindCustomerWorkflow('job');const wirePayments=()=>{document.querySelectorAll('.remove-service-payment').forEach(b=>b.onclick=()=>{b.closest('.service-payment-row').remove();updatePaymentSummary()});document.querySelectorAll('[data-pay-amount]').forEach(i=>i.oninput=updatePaymentSummary)};const updatePaymentSummary=()=>{const deposit=Number(sf.$('jobPaid').value)||0,payments=[...document.querySelectorAll('[data-pay-amount]')].reduce((n,i)=>n+(Number(i.value)||0),0),revenue=Number(sf.$('jobRevenue').value)||0,total=deposit+payments;sf.$('jobPaidTotal').textContent=this.money(total);sf.$('jobBalance').textContent=this.money(Math.max(0,revenue-total))};sf.$('jobAddPayment').onclick=()=>{sf.$('jobPaymentRows').insertAdjacentHTML('beforeend',`<div class="service-payment-row"><input data-pay-date type="date" value="${new Date().toISOString().slice(0,10)}"><input data-pay-amount type="number" min="0" step=".01" placeholder="Amount"><input data-pay-note placeholder="Final payment, instalment..."><button type="button" class="button danger remove-service-payment">Remove</button></div>`);wirePayments();updatePaymentSummary()};sf.$('jobPaid').oninput=updatePaymentSummary;sf.$('jobRevenue').oninput=updatePaymentSummary;wirePayments();updatePaymentSummary();sf.$('jobCancel').onclick=()=>sf.closeModal();sf.$('serviceForm').onsubmit=async e=>{e.preventDefault();const c=this.resolveCustomer('job'),rec={...j,id:j.id||sf.makeId('JOB'),...c,type:sf.$('jobType').value.trim()||'Photography Service',date:sf.$('jobDate').value,referralSource:sf.$('jobReferral').value.trim(),hours:Number(sf.$('jobHours').value)||0,mileage:Number(sf.$('jobMileage').value)||0,expenses:Number(sf.$('jobExpenses').value)||0,revenue:Number(sf.$('jobRevenue').value)||0,amountPaid:Number(sf.$('jobPaid').value)||0,payments:[...document.querySelectorAll('.service-payment-row')].map(r=>({date:r.querySelector('[data-pay-date]').value,amount:Number(r.querySelector('[data-pay-amount]').value)||0,note:r.querySelector('[data-pay-note]').value.trim()})).filter(p=>p.amount>0),status:((Number(sf.$('jobPaid').value)||0)+[...document.querySelectorAll('[data-pay-amount]')].reduce((n,i)=>n+(Number(i.value)||0),0))>=(Number(sf.$('jobRevenue').value)||0)&&Number(sf.$('jobRevenue').value)>0?'Paid in Full':sf.$('jobStatus').value,notes:sf.$('jobNotes').value.trim(),updatedAt:new Date().toISOString(),createdAt:j.createdAt||new Date().toISOString()};const i=sf.state.serviceJobs.findIndex(x=>x.id===rec.id);if(i>=0)sf.state.serviceJobs[i]=rec;else sf.state.serviceJobs.push(rec);sf.logActivity(`${id?'Updated':'Recorded'} service job ${rec.type}`);await sf.persist();sf.closeModal();this.draw()}},
 openCustomer(id=''){const sf=window.SF,c=sf.state.customers.find(x=>x.id===id)||{};sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><form class="modal-card" id="customerForm"><h2>${id?'Edit Customer':'Add Customer'}</h2><label>Name<input id="cName" value="${sf.esc(c.name||'')}" required></label><label>Company<input id="cCompany" value="${sf.esc(c.company||'')}"></label><label>Phone<input id="cPhone" value="${sf.esc(c.phone||'')}"></label><label>Email<input id="cEmail" type="email" value="${sf.esc(c.email||'')}"></label><label>Billing address <small class="muted">\u2014 one line each, as it should read on an invoice</small><textarea id="cAddress" rows="3" placeholder="633 9 Ave Wainwright&#10;AB, T9W 1B3">${sf.esc(c.address||'')}</textarea></label><div class="row-actions"><button type="button" class="button secondary" id="cCancel">Cancel</button><button class="button primary">Save Customer</button></div></form></div>`;sf.$('cCancel').onclick=()=>sf.closeModal();sf.$('customerForm').onsubmit=async e=>{e.preventDefault();const rec={...c,id:c.id||sf.makeId('CUS'),name:sf.$('cName').value.trim(),company:sf.$('cCompany').value.trim(),phone:sf.$('cPhone').value.trim(),email:sf.$('cEmail').value.trim(),address:(sf.$('cAddress')?.value||'').trim(),createdAt:c.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};const i=sf.state.customers.findIndex(x=>x.id===rec.id);if(i>=0)sf.state.customers[i]=rec;else sf.state.customers.push(rec);await sf.persist();sf.closeModal();this.draw()}},
 openEvent(id=''){const sf=window.SF,e=sf.state.salesEvents.find(x=>x.id===id)||{};sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><form class="modal-card" id="eventForm"><h2>${id?'Edit Event':'New Event'}</h2><label>Event Name<input id="eventName" value="${sf.esc(e.name||'')}" required></label><label>Type<input id="eventType" value="${sf.esc(e.type||'Outdoor Market')}"></label><label>Date<input id="eventDate" type="date" value="${e.date||new Date().toISOString().slice(0,10)}"></label><div class="grid2"><label>Reminder date<input id="eventReminderDate" type="date" value="${e.reminderDate||''}"></label><label>Reminder note<input id="eventReminderNote" value="${sf.esc(e.reminderNote||'')}" placeholder="Prepare entry files"></label></div><label>Status<select id="eventStatus"><option value="open" ${e.status!=='finished'?'selected':''}>Open</option><option value="finished" ${e.status==='finished'?'selected':''}>Finished</option></select></label><label>Notes<textarea id="eventNotes">${sf.esc(e.notes||'')}</textarea></label><div class="row-actions"><button type="button" class="button secondary" id="eventCancel">Cancel</button><button class="button primary">Save Event</button></div></form></div>`;sf.$('eventCancel').onclick=()=>sf.closeModal();sf.$('eventForm').onsubmit=async ev=>{ev.preventDefault();const rec={...e,id:e.id||sf.makeId('EVT'),name:sf.$('eventName').value.trim(),type:sf.$('eventType').value.trim(),date:sf.$('eventDate').value,status:sf.$('eventStatus').value,notes:sf.$('eventNotes').value.trim(),updatedAt:new Date().toISOString(),createdAt:e.createdAt||new Date().toISOString()};const i=sf.state.salesEvents.findIndex(x=>x.id===rec.id);if(i>=0)sf.state.salesEvents[i]=rec;else sf.state.salesEvents.push(rec);await sf.persist();sf.closeModal();this.draw()}},
 openBusinessTransaction(defaultType=''){const sf=window.SF;sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><form class="modal-card" id="businessTxForm"><h2>Business Expense/Deposit</h2><label>Type<select id="btType">${['Deposit','Refund','Expense','Equipment','Travel','Accommodation','Meals','Parking','Booth Fee','Software','Insurance','Material Purchase','Gift Certificate'].map(x=>`<option ${x===defaultType?'selected':''}>${x}</option>`).join('')}</select></label><label>Date<input id="btDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>Customer / Payee<input id="btParty"></label><label>Project Type<select id="btProjectType"><option>General Business</option><option>Service Job</option><option>Art Project</option><option>Art Show / Market</option></select></label><label id="btJobLinkLabel" hidden>Link to Existing Service Job<select id="btJobLink"><option value="">-- Select the job this applies to --</option>${sf.state.serviceJobs.map(j=>`<option value="${j.id}">${sf.esc(j.customerName||'Client')} · ${sf.esc(j.type||'Service')} · ${j.date||''}</option>`).join('')}</select></label><label>Project / Job Name<input id="btProjectName" placeholder="Optional trip, gig, show or artwork"></label><label>Amount<input id="btAmount" type="number" min="0" step=".01" required></label><label>Status<select id="btStatus"><option>Recorded</option><option>Pending</option><option>Completed</option></select></label><label>Notes<textarea id="btNotes"></textarea></label><div class="expense-receipt"><button type="button" class="button secondary" id="btReceiptBtn">＋ Receipt Photo</button><span class="expense-receipt-preview" id="btReceiptPreview"></span><input type="hidden" id="btReceipt"></div><div class="row-actions"><button type="button" class="button secondary" id="btCancel">Cancel</button><button class="button primary">Save Transaction</button></div></form></div>`;
  const toggleJobLink=()=>{sf.$('btJobLinkLabel').hidden=sf.$('btProjectType').value!=='Service Job'};
  sf.$('btProjectType').onchange=toggleJobLink; toggleJobLink();
  sf.$('btCancel').onclick=()=>sf.closeModal();sf.$('btReceiptBtn').onclick=async()=>{const file=await sf.api.openImage();if(!file)return;sf.$('btReceipt').value=file.data||'';sf.$('btReceiptPreview').innerHTML=`<img src="${file.data}" class="expense-receipt-thumb">`;sf.$('btReceiptBtn').textContent='Change Photo'};sf.$('businessTxForm').onsubmit=async e=>{e.preventDefault();const type=sf.$('btType').value,jobId=sf.$('btJobLink').hidden===false?sf.$('btJobLink').value:'',job=jobId?sf.state.serviceJobs.find(j=>j.id===jobId):null,rec={id:sf.makeId('BTX'),type,date:sf.$('btDate').value,payee:job?(job.customerName||sf.$('btParty').value.trim()):sf.$('btParty').value.trim(),amount:Number(sf.$('btAmount').value)||0,projectType:sf.$('btProjectType').value,projectName:job?`${job.type||'Service'} · ${job.customerName||''}`:sf.$('btProjectName').value.trim(),serviceJobId:jobId||'',status:sf.$('btStatus').value,notes:sf.$('btNotes').value.trim(),receiptImage:sf.$('btReceipt')?.value||'',direction:['Refund','Expense','Equipment','Travel','Accommodation','Meals','Parking','Booth Fee','Software','Insurance','Material Purchase'].includes(type)?'out':'in',createdAt:new Date().toISOString()};sf.state.businessTransactions.push(rec);
   if(job){
     if(type==='Deposit'){
       // A deposit tied to a job also becomes a real payment against that job, so its own
       // balance/paid-in-full status stays accurate -- not just a disconnected log entry.
       job.payments=Array.isArray(job.payments)?job.payments:[];
       job.payments.push({date:rec.date,amount:rec.amount,note:`Deposit recorded ${new Date().toLocaleDateString()}`});
       const paidTotal=Number(job.amountPaid||0)+job.payments.reduce((n,p)=>n+Number(p.amount||0),0);
       if(Number(job.revenue||0)>0&&paidTotal>=Number(job.revenue||0))job.status='Paid in Full';
     }else if(rec.direction==='out'){
       // An expense tied to a job adds to that job's own tracked expense total, giving a real
       // per-event/per-service cost picture rather than only a business-wide log.
       job.expenses=Number(job.expenses||0)+rec.amount;
     }
   }
   if(type==='Gift Certificate')sf.state.giftCertificates.push({id:sf.makeId('GFT'),issuedTransactionId:rec.id,customerName:rec.payee,originalAmount:rec.amount,balance:rec.amount,status:'Active',createdAt:rec.createdAt});sf.logActivity(`Recorded ${type.toLowerCase()} ${this.money(rec.amount)}${job?` · linked to ${job.customerName||'job'}`:''}`);await sf.persist();sf.closeModal();this.draw()}}
};


/* StudioFlow 11.0.1 business workflow refinements */
Object.assign(window.SFCommerceHub,{
 ensure(){const s=window.SF.state;['customers','serviceJobs','salesSources','salesEvents','salesTransactions','salesTransactionItems','businessTransactions','quotes','giftCertificates','expenseSessions'].forEach(k=>s[k]=Array.isArray(s[k])?s[k]:[])},
 periodFigures(year=new Date().getFullYear(),month=null){const s=window.SF.state,inPeriod=d=>{if(!d)return false;const x=new Date(d);return x.getFullYear()===year&&(month===null||x.getMonth()===month)},eventAllowed=t=>{const e=s.salesEvents.find(x=>x.id===t.eventId);return !e||e.includeInReports!==false};const art=s.salesTransactions.filter(t=>inPeriod(t.soldAt||t.createdAt)&&eventAllowed(t)).reduce((n,t)=>n+Number(t.total||0),0),service=s.serviceJobs.filter(j=>inPeriod(j.date)).reduce((n,j)=>n+Number(j.revenue||0),0),other=s.businessTransactions.filter(x=>inPeriod(x.date||x.createdAt)&&x.direction==='in'&&x.type!=='Deposit').reduce((n,x)=>n+Number(x.amount||0),0),expenses=s.businessTransactions.filter(x=>inPeriod(x.date||x.createdAt)&&(x.direction==='out'||['Expense','Equipment','Travel','Accommodation','Meals','Parking','Booth Fee','Software','Insurance','Material Purchase'].includes(x.type))).reduce((n,x)=>n+Number(x.amount||0),0);return{revenue:art+service+other,art,service,other,expenses,profit:art+service+other-expenses}},
 overview(){const sf=window.SF,now=new Date(),m=this.periodFigures(now.getFullYear(),now.getMonth()),y=this.periodFigures(now.getFullYear());sf.$('commerceBody').innerHTML=`<div class="commerce-kpis revenue-kpis"><div><b>${this.money(m.revenue)}</b><span>This Month Sales</span></div><div><b>${this.money(y.revenue)}</b><span>${now.getFullYear()} Sales</span></div><div><b>${this.money(y.expenses)}</b><span>${now.getFullYear()} Expenses</span></div><div><b>${this.money(y.profit)}</b><span>${now.getFullYear()} Net</span></div></div><section class="card"><div class="commerce-toolbar"><div><h3>Annual Business Summary</h3><p class="muted">Historical markets marked reference-only are excluded from current reports.</p></div><div class="report-actions"><select id="reportYear">${Array.from({length:8},(_,i)=>now.getFullYear()-i).map(v=>`<option>${v}</option>`).join('')}</select><button class="button primary" id="printAnnualReport">View Year-End Report</button></div></div></section>`;sf.$('printAnnualReport').onclick=()=>this.printAnnualSummary(Number(sf.$('reportYear').value))},
 events(){const sf=window.SF,today=new Date().toISOString().slice(0,10),all=[...sf.state.salesEvents],upcoming=all.filter(x=>(x.endDate||x.date||'')>=today&&x.status!=='finished').sort((a,b)=>String(a.date).localeCompare(String(b.date))),past=all.filter(x=>!upcoming.includes(x)).sort((a,b)=>String(b.date).localeCompare(String(a.date))),card=x=>`<article class="customer-card event-card"><h3>${sf.esc(x.name)}</h3><p>${sf.esc(x.type||'Event')}<br>${x.date?new Date(x.date+'T12:00:00').toLocaleDateString():'No date'}</p><span class="market-mode ${x.includeInReports===false?'':'live'}">${x.includeInReports===false?'Historical reference':'Included in reports'}</span><div><b>${this.money(sf.state.salesTransactions.filter(t=>t.eventId===x.id).reduce((n,t)=>n+Number(t.total||0),0))}</b><span>event revenue</span></div><button data-edit-event="${x.id}">Edit Event</button></article>`;sf.$('commerceBody').innerHTML=`<section class="card"><div class="commerce-toolbar"><div><h3>Art Markets, Shows & Events</h3><p class="muted">Add live or historical markets, then enter their sales through Sales Register and select the event.</p></div><button class="button primary" id="newEvent">＋ New Market / Event</button></div><div class="customer-grid">${upcoming.length?upcoming.map(card).join(''):'<div class="empty-state roomy">No upcoming events.</div>'}</div></section><section class="card"><h3>Past & Historical Events</h3><div class="customer-grid">${past.length?past.map(card).join(''):'<div class="empty-state">No past events yet.</div>'}</div></section>`;sf.$('newEvent').onclick=()=>this.openEvent();document.querySelectorAll('[data-edit-event]').forEach(b=>b.onclick=()=>this.openEvent(b.dataset.editEvent))},
 openEvent(id=''){const sf=window.SF,e=sf.state.salesEvents.find(x=>x.id===id)||{};sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><form class="modal-card" id="eventForm"><h2>${id?'Edit Market / Event':'New Market / Event'}</h2><label>Event Name<input id="eventName" value="${sf.esc(e.name||'')}" required></label><label>Type<select id="eventType">${['Outdoor Market','Indoor Market','Art Show','Gallery Exhibition','Wedding','Service Booking','Other'].map(x=>`<option ${x===(e.type||'Outdoor Market')?'selected':''}>${x}</option>`).join('')}</select></label><label>Date<input id="eventDate" type="date" value="${e.date||new Date().toISOString().slice(0,10)}"></label><div class="grid2"><label>Reminder date<input id="eventReminderDate" type="date" value="${e.reminderDate||''}"></label><label>Reminder note<input id="eventReminderNote" value="${sf.esc(e.reminderNote||'')}" placeholder="Prepare entry files"></label></div><label>Status<select id="eventStatus"><option value="open" ${e.status!=='finished'?'selected':''}>Open</option><option value="finished" ${e.status==='finished'?'selected':''}>Finished</option></select></label><label class="checkline"><input id="eventInclude" type="checkbox" ${e.includeInReports===false?'':'checked'}> Include this event's sales in annual and monthly business totals</label><p class="muted">Turn this off when entering historical market data for image-sales analysis only.</p><label>Notes<textarea id="eventNotes">${sf.esc(e.notes||'')}</textarea></label><div class="row-actions"><button type="button" class="button secondary" id="eventCancel">Cancel</button><button class="button primary">Save Event</button></div></form></div>`;sf.$('eventCancel').onclick=()=>sf.closeModal();sf.$('eventForm').onsubmit=async ev=>{ev.preventDefault();const rec={...e,id:e.id||sf.makeId('EVT'),name:sf.$('eventName').value.trim(),type:sf.$('eventType').value,date:sf.$('eventDate').value,status:sf.$('eventStatus').value,includeInReports:sf.$('eventInclude').checked,notes:sf.$('eventNotes').value.trim(),updatedAt:new Date().toISOString(),createdAt:e.createdAt||new Date().toISOString()};const i=sf.state.salesEvents.findIndex(x=>x.id===rec.id);if(i>=0)sf.state.salesEvents[i]=rec;else sf.state.salesEvents.push(rec);await sf.persist();sf.closeModal();this.draw()}},
 async importExpensifyPdf(){
  const sf=window.SF;
  sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card"><h2>Reading PDF...</h2><p class="muted">Parsing the report and pulling out receipt photos. This can take a few seconds.</p></div></div>`;
  const result=await sf.api.parseExpensifyPdf();
  if(result?.cancelled){sf.closeModal();return}
  if(!result?.ok){
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card"><h2>Couldn't read that PDF</h2><p class="danger-text">${sf.esc(result?.error||'Unknown error')}</p><p class="muted">This can happen if the file isn't a standard Expensify export, or is password protected. You can still add these expenses manually using Add Expense Group.</p><div class="row-actions"><button class="button primary" id="impClose">Close</button></div></div></div>`;
    sf.$('impClose').onclick=()=>sf.closeModal();
    return;
  }
  if(!result.lineItems.length){
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card wide"><h2>No expenses found</h2><p class="muted">The PDF opened fine, but nothing matched the expected Expensify layout -- it may be a different export format, or the same format read slightly differently. You can still add these expenses manually using Add Expense Group.</p>${result.rawTextSample?`<p class="muted">If you can, copy the text below and send it to me -- it's exactly what was read from your PDF, and it'll show precisely what needs adjusting rather than another guess.</p><textarea readonly id="impRawText" class="import-raw-text">${sf.esc(result.rawTextSample)}</textarea><div class="row-actions"><button type="button" class="button secondary" id="impCopyText">Copy Text</button></div>`:''}<div class="row-actions"><button class="button primary" id="impClose">Close</button></div></div></div>`;
    if(sf.$('impCopyText'))sf.$('impCopyText').onclick=()=>{
      const ta=sf.$('impRawText');
      ta.select();
      try{
        navigator.clipboard.writeText(ta.value);
        sf.$('impCopyText').textContent='Copied!';
        setTimeout(()=>{if(sf.$('impCopyText'))sf.$('impCopyText').textContent='Copy Text'},1500);
      }catch{
        document.execCommand('copy');
      }
    };
    sf.$('impClose').onclick=()=>sf.closeModal();
    return;
  }
  this.renderImportReview(result);
 },
 renderImportReview(result){
  const sf=window.SF;
  const jobs=sf.state.serviceJobs||[];
  const categoryOptions=['Meals','Gas / Fuel','Accommodation','Ferry / Flight','Parking','Equipment','Supplies','Booth Fee','Material Purchase','Travel','Other'];
  const mapCategory=c=>{const n=String(c||'').toLowerCase();if(n.includes('meal')||n.includes('entertain'))return 'Meals';if(n.includes('travel')||n.includes('ferry')||n.includes('flight'))return 'Ferry / Flight';if(n.includes('gas')||n.includes('fuel'))return 'Gas / Fuel';if(n.includes('park'))return 'Parking';if(n.includes('accommod')||n.includes('hotel'))return 'Accommodation';return 'Other'};
  const row=(it,i)=>`<div class="expense-line import-review-row" data-idx="${i}">
    ${it.receiptImage?`<img class="expense-receipt-thumb" src="${this.receiptSrc(it.receiptImage)}">`:'<span class="muted small">No photo</span>'}
    <label>Date<input data-f-date value="${sf.esc(it.date)}"></label>
    <label>Merchant<input data-f-merchant value="${sf.esc(it.merchant)}"></label>
    <label>Description<input data-f-desc value="${sf.esc(it.description)}"></label>
    <label>Category<select data-f-category>${categoryOptions.map(c=>`<option ${c===mapCategory(it.category)?'selected':''}>${c}</option>`).join('')}</select></label>
    <label>Amount<input data-f-amount type="number" min="0" step=".01" value="${it.amount}"></label>
    <button type="button" class="button danger" data-remove-import-row>×</button>
  </div>`;
  sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card wide"><h2>Review Import -- ${sf.esc(result.reportName)}</h2><p class="muted">Found ${result.lineItems.length} expense(s) totalling ${this.money(result.total)} from ${sf.esc(result.sourceFile)}. Nothing is saved yet -- review and adjust anything below, then confirm.</p>
    <div class="form-grid"><label>Assigned To<select id="impAssignment">${['Photo Expedition','Wedding','Portrait Shoot','Dance Shoot','Real Estate','Art Market / Show','Inventory / Materials','Service','Other'].map(x=>`<option>${x}</option>`).join('')}</select></label><label>Project / Job Name<input id="impProject" value="${sf.esc(result.reportName)}"></label></div>
    <label>Link to Service Job <small class="muted">(optional -- so this expense report shows up alongside that job's revenue)</small><select id="impJobLink"><option value="">Not linked to a specific job</option>${jobs.map(j=>`<option value="${j.id}">${sf.esc(j.type||'Service')} · ${sf.esc(j.customerName||'')} · ${j.date||''}</option>`).join('')}</select></label>
    <div id="impRows">${result.lineItems.map(row).join('')}</div>
    <div class="row-actions"><button type="button" class="button secondary" id="impCancel">Cancel -- Don't Import</button><button class="button primary" id="impConfirm">Import ${result.lineItems.length} Expense(s)</button></div>
  </div></div>`;
  sf.$('impCancel').onclick=()=>sf.closeModal();
  document.querySelectorAll('[data-remove-import-row]').forEach(b=>b.onclick=()=>b.closest('.import-review-row').remove());
  sf.$('impConfirm').onclick=async()=>{
   const rows=[...sf.$('impRows').querySelectorAll('.import-review-row')];
   if(!rows.length)return alert('Nothing left to import.');
   const jobId=sf.$('impJobLink').value,job=jobId?jobs.find(j=>j.id===jobId):null;
   const items=rows.map((r,i)=>{
    const idx=Number(r.dataset.idx);
    return {
     description:`${r.querySelector('[data-f-merchant]').value.trim()}${r.querySelector('[data-f-desc]').value.trim()?' -- '+r.querySelector('[data-f-desc]').value.trim():''}`,
     category:r.querySelector('[data-f-category]').value,
     amount:Number(r.querySelector('[data-f-amount]').value)||0,
     receiptImage:result.lineItems[idx]?.receiptImage||'',
     date:r.querySelector('[data-f-date]').value.trim(),
    };
   }).filter(x=>x.amount>0);
   const parsedDate=new Date(items[0]?.date);
   const session={id:sf.makeId('EXPGRP'),assignmentType:sf.$('impAssignment').value,name:sf.$('impProject').value.trim()||'Imported Expenses',date:isNaN(parsedDate)?new Date().toISOString().slice(0,10):parsedDate.toISOString().slice(0,10),serviceJobId:jobId||'',items:items.map(i=>({category:i.category,description:i.description,amount:i.amount,receiptImage:i.receiptImage})),notes:`Imported from ${result.sourceFile}`,createdAt:new Date().toISOString()};
   sf.state.expenseSessions.push(session);
   items.forEach(i=>{
    const d=new Date(i.date);
    sf.state.businessTransactions.push({id:sf.makeId('BTX'),type:i.category,date:isNaN(d)?session.date:d.toISOString().slice(0,10),payee:i.description,amount:i.amount,projectType:session.assignmentType,projectName:session.name,expenseSessionId:session.id,serviceJobId:jobId||'',receiptImage:i.receiptImage,status:'Recorded',direction:'out',createdAt:session.createdAt});
   });
   if(job){job.expenses=Number(job.expenses||0)+items.reduce((n,i)=>n+i.amount,0)}
   sf.logActivity(`Imported ${items.length} expense(s) from ${result.sourceFile}${job?` (linked to ${job.type})`:''}`);
   await sf.persist();
   sf.closeModal();
   alert(`Imported ${items.length} expense(s) into "${session.name}".`);
   this.draw();
  };
 },
 openExpenseSession(){const sf=window.SF;const jobs=sf.state.serviceJobs||[];sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><form class="modal-card wide" id="expenseSessionForm"><h2>Add Project Expense Group</h2><div class="form-grid"><label>Assigned To<select id="expenseAssignment">${['Service','Photo Expedition','Wedding','Portrait Shoot','Dance Shoot','Real Estate','Art Market / Show','Inventory / Materials','Other'].map(x=>`<option>${x}</option>`).join('')}</select></label><label>Project / Job Name<input id="expenseProject" required placeholder="Dance competition, Tofino expedition, client name..."></label><label>Date<input id="expenseDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label></div><label>Link to Service Job <small class="muted">(optional -- for clarity, so this expense group shows up alongside that job's revenue)</small><select id="expenseJobLink"><option value="">Not linked to a specific job</option>${jobs.map(j=>`<option value="${j.id}">${sf.esc(j.type||'Service')} · ${sf.esc(j.customerName||'')} · ${j.date||''}</option>`).join('')}</select></label><div class="toolbar"><h3>Expenses</h3><button type="button" class="button secondary" id="addExpenseLine">＋ Add Line</button></div><div id="expenseLines" class="expense-lines"></div><label>Notes<textarea id="expenseNotes"></textarea></label><div class="row-actions"><button type="button" class="button secondary" id="expenseCancel">Cancel</button><button class="button primary">Save Expense Group</button></div></form></div>`;const host=sf.$('expenseLines'),add=(cat='Meals',desc='',amount='')=>{const row=document.createElement('div');row.className='expense-line';row.innerHTML=`<label>Category<select data-exp-category>${['Meals','Gas / Fuel','Accommodation','Ferry / Flight','Parking','Equipment','Supplies','Booth Fee','Material Purchase','Other'].map(x=>`<option ${x===cat?'selected':''}>${x}</option>`).join('')}</select></label><label>Description<input data-exp-desc value="${sf.esc(desc)}"></label><label>Amount<input data-exp-amount type="number" min="0" step=".01" value="${amount}"></label><div class="expense-receipt"><button type="button" class="button secondary expense-receipt-btn" data-attach-receipt>＋ Receipt Photo</button><span class="expense-receipt-preview"></span><input type="hidden" data-exp-receipt></div><button type="button" class="button secondary">×</button>`;
   row.querySelector('[data-attach-receipt]').onclick=async()=>{const file=await sf.api.openImage();if(!file)return;/* g103: store the PATH, not the bytes. file:openImage already copies the chosen file into
   StudioFlow's managed images folder and hands back storedPath, so the receipt is on disk
   either way -- the only question was whether a second base64 copy also went into the
   database. It did, and the database is already past 100MB with images inline; a few
   hundred phone photos of receipts a year would have made every save measurably slower.
   Falls back to the data URL if a build ever returns no path, so nothing is ever lost. */
row.querySelector('[data-exp-receipt]').value=file.storedPath||file.data;const preview=row.querySelector('.expense-receipt-preview');preview.innerHTML=`<img src="${file.data}" class="expense-receipt-thumb">`;row.querySelector('[data-attach-receipt]').textContent='Change Photo'};
   row.querySelector('button:last-child').onclick=()=>row.remove();host.appendChild(row)};add();add('Gas / Fuel');add('Accommodation');sf.$('addExpenseLine').onclick=()=>add('Other');sf.$('expenseCancel').onclick=()=>sf.closeModal();sf.$('expenseSessionForm').onsubmit=async e=>{e.preventDefault();const jobId=sf.$('expenseJobLink').value,job=jobId?jobs.find(j=>j.id===jobId):null;const items=[...host.querySelectorAll('.expense-line')].map(r=>({category:r.querySelector('[data-exp-category]').value,description:r.querySelector('[data-exp-desc]').value.trim(),amount:Number(r.querySelector('[data-exp-amount]').value)||0,receiptImage:r.querySelector('[data-exp-receipt]').value||''})).filter(x=>x.amount>0),session={id:sf.makeId('EXPGRP'),assignmentType:sf.$('expenseAssignment').value,name:sf.$('expenseProject').value.trim(),date:sf.$('expenseDate').value,serviceJobId:jobId||'',items,notes:sf.$('expenseNotes').value.trim(),createdAt:new Date().toISOString()};sf.state.expenseSessions.push(session);items.forEach(i=>sf.state.businessTransactions.push({id:sf.makeId('BTX'),type:i.category,date:session.date,payee:i.description,amount:i.amount,projectType:session.assignmentType,projectName:session.name,expenseSessionId:session.id,serviceJobId:jobId||'',receiptImage:i.receiptImage,status:'Recorded',direction:'out',createdAt:session.createdAt}));if(job){job.expenses=Number(job.expenses||0)+items.reduce((n,i)=>n+i.amount,0)}sf.logActivity(`Recorded ${items.length} expenses for ${session.name}${job?` (linked to ${job.type})`:''}`);await sf.persist();sf.closeModal();this.draw()}},
 printAnnualSummary(year){const sf=window.SF,f=this.periodFigures(year),M=v=>this.money(v);const inYear=d=>{const x=new Date(d);return !isNaN(x)&&x.getFullYear()===year};
    const byCategory={};sf.state.businessTransactions.filter(x=>inYear(x.date||x.createdAt)&&(x.direction==='out'||['Expense','Equipment','Travel','Accommodation','Meals','Parking','Booth Fee','Software','Insurance','Material Purchase'].includes(x.type))).forEach(x=>{const k=x.type||'Expense';byCategory[k]=(byCategory[k]||0)+Number(x.amount||0)});
    const jobs=sf.state.serviceJobs.filter(j=>inYear(j.date)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));const jobCost=j=>Number(j.expenses||0)+Number(j.mileageExpense||0);const serviceCosts=jobs.reduce((n,j)=>n+jobCost(j),0);const serviceRevenue=jobs.reduce((n,j)=>n+Number(j.revenue||0),0);
    const byEvent={};sf.state.salesTransactions.filter(t=>inYear(t.soldAt||t.createdAt)).forEach(t=>{const e=sf.state.salesEvents.find(x=>x.id===t.eventId);if(e&&e.includeInReports===false)return;const name=(e&&e.name)||t.saleSource||'Direct / Website';byEvent[name]=(byEvent[name]||0)+Number(t.total||0)});
    const totalSales=f.revenue,totalBusinessExpenses=f.expenses,totalExpenses=totalBusinessExpenses+serviceCosts,net=totalSales-totalExpenses;
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop report-backdrop"><section class="modal-card annual-report" id="annualReport">
      <div class="no-print report-toolbar"><span class="report-live-pill">● Live preview — updates as the year goes</span><div class="row-actions"><label>Year&nbsp;<select id="reportYearSel">${Array.from({length:8},(_,i)=>new Date().getFullYear()-i).map(v=>`<option ${v===year?'selected':''}>${v}</option>`).join('')}</select></label><label class="report-appendix-toggle"><input type="checkbox" id="reportReceipts" ${this._reportReceipts?'checked':''}> Receipt appendix</label><button class="button secondary" id="closeReport">Close</button><button class="button primary" id="doPrint">Print / Save PDF</button></div></div>
      <header class="report-head"><h1>${sf.esc(sf.state.business.name||'StudioFlow Business')}</h1><h2>${year} Year-End Report</h2><p>Prepared ${new Date().toLocaleDateString()} · figures update automatically until you print at year end</p></header>
      <h3>Sales</h3><table class="report-table">${Object.entries(byEvent).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td>${sf.esc(k)}</td><td class="num">${M(v)}</td></tr>`).join('')}<tr class="report-subtotal"><th>Artwork &amp; market sales</th><th class="num">${M(f.art)}</th></tr><tr class="report-subtotal"><th>Photography services</th><th class="num">${M(f.service)}</th></tr>${f.other?`<tr class="report-subtotal"><th>Other business income</th><th class="num">${M(f.other)}</th></tr>`:''}<tr class="report-total"><th>Total sales</th><th class="num">${M(totalSales)}</th></tr></table>
      <h3>Photography Services &amp; Their Expenses</h3><table class="report-table service-report"><tr><th>Date</th><th>Service</th><th>Customer</th><th class="num">Revenue</th><th class="num">Expenses</th><th class="num">Net</th></tr>${jobs.length?jobs.map(j=>`<tr><td>${j.date||''}</td><td>${sf.esc(j.type||'Service')}</td><td>${sf.esc(this.customerName(j.customerId,j.customerName||j.company||'—'))}</td><td class="num">${M(j.revenue)}</td><td class="num">${M(jobCost(j))}</td><td class="num">${M(Number(j.revenue||0)-jobCost(j))}</td></tr>`).join(''):'<tr><td colspan="6">No service jobs recorded this year.</td></tr>'}<tr class="report-total"><th colspan="3">Service totals</th><th class="num">${M(serviceRevenue)}</th><th class="num">${M(serviceCosts)}</th><th class="num">${M(serviceRevenue-serviceCosts)}</th></tr></table>
      <h3>Business Expenses</h3><table class="report-table">${Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td>${sf.esc(k)}</td><td class="num">${M(v)}</td></tr>`).join('')||'<tr><td>No business expenses recorded</td><td class="num">$0.00</td></tr>'}<tr class="report-subtotal"><th>Business expenses subtotal</th><th class="num">${M(totalBusinessExpenses)}</th></tr><tr><td>Service direct costs (from the services table above)</td><td class="num">${M(serviceCosts)}</td></tr><tr class="report-total"><th>Total expenses</th><th class="num">${M(totalExpenses)}</th></tr></table>
      <table class="report-table report-grand"><tr class="report-total"><th>TOTAL SALES</th><th class="num">${M(totalSales)}</th></tr><tr class="report-total"><th>TOTAL EXPENSES</th><th class="num">${M(totalExpenses)}</th></tr><tr class="report-net"><th>NET BUSINESS INCOME</th><th class="num">${M(net)}</th></tr></table>
      <p class="report-foot"><small>Internal business record — confirm tax classifications and deductible amounts with your accountant. "Service direct costs" are the per-job expenses entered on each service job; if the same cost was also logged as a business expense it will appear in both sections.</small></p>
      ${this.receiptAppendix(year)}
    </section></div>`;
    sf.$('closeReport').onclick=()=>sf.closeModal();
    /* Re-render the report so the appendix appears or disappears; the year select already does
       exactly this, so reuse its path rather than toggling display. */
    if(sf.$('reportReceipts'))sf.$('reportReceipts').onchange=e=>{
      this._reportReceipts=e.target.checked;
      this.printAnnualSummary(Number(sf.$('reportYearSel').value)||year);
    };sf.$('doPrint').onclick=()=>window.print();sf.$('reportYearSel').onchange=e=>this.printAnnualSummary(Number(e.target.value))}
});


/* StudioFlow 11.3.0 final cull and business calendar refinements */
Object.assign(window.SFCommerceHub,{
 services(){const sf=window.SF,j=[...sf.state.serviceJobs].sort((a,b)=>String(b.date).localeCompare(String(a.date)));sf.$('commerceBody').innerHTML=`<section class="card"><div class="commerce-toolbar"><div><h3>Services</h3><p class="muted">Single-day and multi-day service jobs, with full edit and delete controls.</p></div><button class="button primary" id="newService">＋ Add Service Job</button></div><div class="commerce-table service"><div class="commerce-row header"><span>Dates</span><span>Service</span><span>Customer</span><span>Status</span><span>Revenue</span><span></span></div>${j.length?j.map(x=>`<div class="commerce-row"><span>${x.date?new Date(x.date+'T12:00:00').toLocaleDateString():'—'}${x.endDate&&x.endDate!==x.date?` – ${new Date(x.endDate+'T12:00:00').toLocaleDateString()}`:''}</span><span><b>${sf.esc(x.type||'Service')}</b></span><span>${sf.esc(this.customerName(x.customerId,x.customerName||x.company||'Not Saved'))}</span><span>${sf.esc(x.status||'Booked')}</span><span><b>${this.money(x.revenue)}</b>${(()=>{const c=this.jobCosts(x);return c.total?`<br><small class="muted">less ${this.money(c.total)} costs \u2192 ${this.money(this.jobProfit(x))} profit</small>`:''})()}</span><span class="row-actions compact"><button data-edit-service="${x.id}">Edit</button><button class="danger" data-delete-service="${x.id}">Delete</button></span></div>`).join(''):'<div class="empty-state roomy">No service jobs recorded yet.</div>'}</div></section>`;sf.$('newService').onclick=()=>this.openService();document.querySelectorAll('[data-edit-service]').forEach(b=>b.onclick=()=>this.openService(b.dataset.editService));document.querySelectorAll('[data-delete-service]').forEach(b=>b.onclick=async()=>{const job=sf.state.serviceJobs.find(x=>x.id===b.dataset.deleteService);if(job&&confirm(`Delete ${job.type||'this service job'}?`)){sf.state.serviceJobs=sf.state.serviceJobs.filter(x=>x.id!==job.id);await sf.persist();this.services()}})},
 openService(id=''){const sf=window.SF,j=sf.state.serviceJobs.find(x=>x.id===id)||{};sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><form class="modal-card wide" id="serviceForm"><h2>${id?'Edit Service Job':'Add Service Job'}</h2>${this.customerWorkflow('job',j.customerId?'existing':'new',j.customerId)}<div class="form-grid"><label>Service Type<input id="jobType" value="${sf.esc(j.type||'')}"></label><label>Start Date<input id="jobDate" type="date" value="${j.date||new Date().toISOString().slice(0,10)}"></label><label>End Date<input id="jobEndDate" type="date" value="${j.endDate||j.date||new Date().toISOString().slice(0,10)}"></label><label>Calendar colour<input id="jobColour" type="color" value="${j.colour||'#3d86c6'}"></label><label>Availability<select id="jobAvailability"><option value="blocking" ${j.availability!=='passive'?'selected':''}>Unavailable / blocks bookings</option><option value="passive" ${j.availability==='passive'?'selected':''}>Available / does not block bookings</option></select></label><label>Referral Source<input id="jobReferral" value="${sf.esc(j.referralSource||'')}"></label><label>Hours<input id="jobHours" type="number" min="0" step=".25" value="${Number(j.hours||0)}"></label><label>Mileage<input id="jobMileage" type="number" min="0" step=".1" value="${Number(j.mileage||0)}"></label><label>Expenses<input id="jobExpenses" type="number" min="0" step=".01" value="${Number(j.expenses||0)}"></label><label>Revenue<input id="jobRevenue" type="number" min="0" step=".01" value="${Number(j.revenue||0)}"></label><label>Deposit already paid<input id="jobPaid" type="number" min="0" step=".01" value="${Number(j.amountPaid||0)}"></label><label>Status<select id="jobStatus">${['Quote','Inquiry','Booked','Deposit Paid','In Progress','Completed','Paid in Full','Cancelled'].map(x=>`<option ${x===(j.status||'Booked')?'selected':''}>${x}</option>`).join('')}</select></label></div><section class="service-payments-box"><div class="commerce-toolbar"><div><h3>Payments</h3><p class="muted">Add final or instalment payments. The balance and Paid in Full status update automatically.</p></div><button type="button" class="button secondary" id="jobAddPayment">＋ Add Payment</button></div><div id="jobPaymentRows">${(j.payments||[]).map(p=>`<div class="service-payment-row"><input data-pay-date type="date" value="${p.date||new Date().toISOString().slice(0,10)}"><input data-pay-amount type="number" min="0" step=".01" value="${Number(p.amount||0)}" placeholder="Amount"><input data-pay-note value="${sf.esc(p.note||'')}" placeholder="Final payment, instalment..."><button type="button" class="button danger remove-service-payment">Remove</button></div>`).join('')}</div><div class="service-payment-summary">Paid: <b id="jobPaidTotal">$0.00</b> · Balance: <b id="jobBalance">$0.00</b></div></section><label>Notes<textarea id="jobNotes">${sf.esc(j.notes||'')}</textarea></label><div class="row-actions"><button type="button" class="button secondary" id="jobCancel">Cancel</button>${id?'<button type="button" class="button danger" id="jobDelete">Delete Job</button>':''}<button class="button primary">Save Service Job</button></div></form></div>`;this.bindCustomerWorkflow('job');const wirePayments=()=>{document.querySelectorAll('.remove-service-payment').forEach(b=>b.onclick=()=>{b.closest('.service-payment-row').remove();updatePaymentSummary()});document.querySelectorAll('[data-pay-amount]').forEach(i=>i.oninput=updatePaymentSummary)};const updatePaymentSummary=()=>{const deposit=Number(sf.$('jobPaid').value)||0,payments=[...document.querySelectorAll('[data-pay-amount]')].reduce((n,i)=>n+(Number(i.value)||0),0),revenue=Number(sf.$('jobRevenue').value)||0,total=deposit+payments;sf.$('jobPaidTotal').textContent=this.money(total);sf.$('jobBalance').textContent=this.money(Math.max(0,revenue-total))};sf.$('jobAddPayment').onclick=()=>{sf.$('jobPaymentRows').insertAdjacentHTML('beforeend',`<div class="service-payment-row"><input data-pay-date type="date" value="${new Date().toISOString().slice(0,10)}"><input data-pay-amount type="number" min="0" step=".01" placeholder="Amount"><input data-pay-note placeholder="Final payment, instalment..."><button type="button" class="button danger remove-service-payment">Remove</button></div>`);wirePayments();updatePaymentSummary()};sf.$('jobPaid').oninput=updatePaymentSummary;sf.$('jobRevenue').oninput=updatePaymentSummary;wirePayments();updatePaymentSummary();sf.$('jobCancel').onclick=()=>sf.closeModal();if(sf.$('jobDelete'))sf.$('jobDelete').onclick=async()=>{if(confirm('Delete this service job?')){sf.state.serviceJobs=sf.state.serviceJobs.filter(x=>x.id!==id);await sf.persist();sf.closeModal();this.draw()}};sf.$('serviceForm').onsubmit=async e=>{e.preventDefault();const c=this.resolveCustomer('job'),start=sf.$('jobDate').value,end=sf.$('jobEndDate').value||start;if(end<start)return alert('End date cannot be before the start date.');const rec={...j,id:j.id||sf.makeId('JOB'),...c,type:sf.$('jobType').value.trim()||'Photography Service',date:start,endDate:end,colour:sf.$('jobColour').value,availability:sf.$('jobAvailability').value,referralSource:sf.$('jobReferral').value.trim(),hours:Number(sf.$('jobHours').value)||0,mileage:Number(sf.$('jobMileage').value)||0,expenses:Number(sf.$('jobExpenses').value)||0,revenue:Number(sf.$('jobRevenue').value)||0,amountPaid:Number(sf.$('jobPaid').value)||0,payments:[...document.querySelectorAll('.service-payment-row')].map(r=>({date:r.querySelector('[data-pay-date]').value,amount:Number(r.querySelector('[data-pay-amount]').value)||0,note:r.querySelector('[data-pay-note]').value.trim()})).filter(p=>p.amount>0),status:((Number(sf.$('jobPaid').value)||0)+[...document.querySelectorAll('[data-pay-amount]')].reduce((n,i)=>n+(Number(i.value)||0),0))>=(Number(sf.$('jobRevenue').value)||0)&&Number(sf.$('jobRevenue').value)>0?'Paid in Full':sf.$('jobStatus').value,notes:sf.$('jobNotes').value.trim(),updatedAt:new Date().toISOString(),createdAt:j.createdAt||new Date().toISOString()};const i=sf.state.serviceJobs.findIndex(x=>x.id===rec.id);if(i>=0)sf.state.serviceJobs[i]=rec;else sf.state.serviceJobs.push(rec);await sf.persist();sf.closeModal();this.draw()}},
 openEvent(id=''){const sf=window.SF,e=sf.state.salesEvents.find(x=>x.id===id)||{};sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><form class="modal-card" id="eventForm"><h2>${id?'Edit Calendar Event':'New Calendar Event'}</h2><label>Event Name<input id="eventName" value="${sf.esc(e.name||'')}" required></label><label>Type<select id="eventType">${['Outdoor Market','Indoor Market','Art Show','Gallery Exhibition','Wedding','Service Booking','Contest Deadline','Award Submission','Reminder','Personal','Other'].map(x=>`<option ${x===(e.type||'Other')?'selected':''}>${x}</option>`).join('')}</select></label><div class="grid2"><label>Start Date<input id="eventDate" type="date" value="${e.date||new Date().toISOString().slice(0,10)}"></label><label>End Date<input id="eventEndDate" type="date" value="${e.endDate||e.date||new Date().toISOString().slice(0,10)}"></label></div><div class="grid2"><label>Colour<input id="eventColour" type="color" value="${e.colour||'#c95353'}"></label><label>Calendar display<select id="eventAvailability"><option value="blocking" ${e.availability!=='passive'?'selected':''}>Solid · unavailable</option><option value="passive" ${e.availability==='passive'?'selected':''}>Opaque · still available</option></select></label></div><div class="grid2"><label>Reminder date<input id="eventReminderDate" type="date" value="${e.reminderDate||''}"></label><label>Reminder note<input id="eventReminderNote" value="${sf.esc(e.reminderNote||'')}" placeholder="Prepare entry files"></label></div><label>Status<select id="eventStatus"><option value="open" ${e.status!=='finished'?'selected':''}>Open</option><option value="finished" ${e.status==='finished'?'selected':''}>Finished</option></select></label><label class="checkline"><input id="eventInclude" type="checkbox" ${e.includeInReports===false?'':'checked'}> Include this event's sales in business totals</label><label>Notes<textarea id="eventNotes">${sf.esc(e.notes||'')}</textarea></label><div class="row-actions"><button type="button" class="button secondary" id="eventCancel">Cancel</button>${id?'<button type="button" class="button danger" id="eventDelete">Delete Event</button>':''}<button class="button primary">Save Event</button></div></form></div>`;sf.$('eventCancel').onclick=()=>sf.closeModal();if(sf.$('eventDelete'))sf.$('eventDelete').onclick=async()=>{if(confirm('Delete this event?')){sf.state.salesEvents=sf.state.salesEvents.filter(x=>x.id!==id);await sf.persist();sf.closeModal();this.draw()}};sf.$('eventForm').onsubmit=async ev=>{ev.preventDefault();const start=sf.$('eventDate').value,end=sf.$('eventEndDate').value||start;if(end<start)return alert('End date cannot be before the start date.');const rec={...e,id:e.id||sf.makeId('EVT'),name:sf.$('eventName').value.trim(),type:sf.$('eventType').value,date:start,endDate:end,colour:sf.$('eventColour').value,availability:sf.$('eventAvailability').value,reminderDate:sf.$('eventReminderDate').value,reminderNote:sf.$('eventReminderNote').value.trim(),status:sf.$('eventStatus').value,includeInReports:sf.$('eventInclude').checked,notes:sf.$('eventNotes').value.trim(),updatedAt:new Date().toISOString(),createdAt:e.createdAt||new Date().toISOString()};const i=sf.state.salesEvents.findIndex(x=>x.id===rec.id);if(i>=0)sf.state.salesEvents[i]=rec;else sf.state.salesEvents.push(rec);await sf.persist();sf.closeModal();this.draw()}},
 calendar(){const sf=window.SF,events=[...sf.state.salesEvents.map(x=>({...x,source:'event'})),...sf.state.serviceJobs.filter(x=>x.date).map(x=>({...x,name:`${x.type||'Service'} · ${this.customerName(x.customerId,x.customerName||x.company||'Client')}`,type:'Service',source:'service'}))].sort((a,b)=>String(a.date).localeCompare(String(b.date)));sf.$('commerceBody').innerHTML=`<section class="card"><div class="commerce-toolbar"><div><h3>Business Calendar</h3><p class="muted">Solid events block availability. Opaque events remain visible while leaving you available for other bookings.</p></div><div><button class="button primary" id="calendarAddEvent">＋ Add Event</button><button class="button secondary" id="calendarAddService">＋ Add Service</button></div></div><div class="calendar-list">${events.length?events.map(x=>`<article class="calendar-item custom-calendar-item" style="--event-color:${x.colour||'#547a9c'};--event-opacity:${x.availability==='passive'?'.35':'1'}"><div><b>${sf.esc(x.name)}</b><small>${sf.esc(x.type)} · ${x.availability==='passive'?'Available':'Unavailable'}</small></div><strong>${new Date(x.date+'T12:00:00').toLocaleDateString()}${x.endDate&&x.endDate!==x.date?` – ${new Date(x.endDate+'T12:00:00').toLocaleDateString()}`:''}</strong><button data-edit-cal="${x.source}:${x.id}">Edit</button></article>`).join(''):'<div class="empty-state roomy">No scheduled events yet.</div>'}</div></section>`;sf.$('calendarAddEvent').onclick=()=>this.openEvent();sf.$('calendarAddService').onclick=()=>this.openService();document.querySelectorAll('[data-edit-cal]').forEach(b=>b.onclick=()=>{const [kind,id]=b.dataset.editCal.split(':');kind==='service'?this.openService(id):this.openEvent(id)})}
});

/* StudioFlow 11.3.2 · clearer service balances and general calendar entry */
(function(){
 const C=window.SFCommerceHub;if(!C)return;
 const originalServices=C.services.bind(C);
 C.services=function(){originalServices();const sf=window.SF;document.querySelectorAll('[data-edit-service]').forEach(btn=>{const job=sf.state.serviceJobs.find(x=>x.id===btn.dataset.editService),row=btn.closest('.commerce-row');if(!job||!row)return;const paid=Number(job.amountPaid||0)+(job.payments||[]).reduce((n,p)=>n+Number(p.amount||0),0),balance=Math.max(0,Number(job.revenue||0)-paid),statusCell=row.children[3];if(statusCell)statusCell.innerHTML=balance<=0&&Number(job.revenue||0)>0?'<b class="payment-paid">Paid in Full</b>':`<b class="payment-due">Balance Due ${C.money(balance)}</b>`})};
 const originalOpenEvent=C.openEvent.bind(C);
 C.openEvent=function(id=''){originalOpenEvent(id);const type=window.SF.$('eventType');if(type){const current=type.value,options=['Photography Competition','Contest Deadline','Award Submission','Application Deadline','Meeting','Delivery / Pickup','Print Deadline','Reminder','Personal','Vacation','Outdoor Market','Indoor Market','Art Show','Gallery Exhibition','Wedding','Service Booking','Other'];type.innerHTML=options.map(x=>`<option ${x===current?'selected':''}>${x}</option>`).join('')}};
 const originalCalendar=C.calendar.bind(C);
 C.calendar=function(){originalCalendar();const b=window.SF.$('calendarAddEvent');if(b)b.textContent='＋ Add Reminder / Event'};
})();

/* StudioFlow 11.4.1 · Website order fulfillment foundation */
(function(){
 const C=window.SFCommerceHub;if(!C)return;
 const ensureWebsite=()=>{const s=window.SF.state;s.websiteOrders=Array.isArray(s.websiteOrders)?s.websiteOrders:[];s.websiteOrderItems=Array.isArray(s.websiteOrderItems)?s.websiteOrderItems:[]};
 if(!C.tabs.some(x=>x[0]==='website'))C.tabs.splice(1,0,['website','Website Orders']);
 const escCsv=v=>String(v??'').trim();
 const parseCSV=text=>{const rows=[];let row=[],cell='',quote=false;for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];if(ch==='"'&&quote&&next==='"'){cell+='"';i++;continue}if(ch==='"'){quote=!quote;continue}if(ch===','&&!quote){row.push(cell);cell='';continue}if((ch==='\n'||ch==='\r')&&!quote){if(ch==='\r'&&next==='\n')i++;row.push(cell);cell='';if(row.some(x=>String(x).trim()))rows.push(row);row=[];continue}cell+=ch}row.push(cell);if(row.some(x=>String(x).trim()))rows.push(row);if(rows.length<2)return[];const heads=rows.shift().map(h=>String(h).trim());return rows.map(r=>Object.fromEntries(heads.map((h,i)=>[h,r[i]??''])))};
 const pick=(o,names)=>{for(const n of names){const k=Object.keys(o).find(x=>x.toLowerCase()===n.toLowerCase());if(k&&o[k]!==undefined&&o[k]!=='')return o[k]}return''};
 C.websiteOrders=function(){ensureWebsite();const sf=window.SF,orders=[...sf.state.websiteOrders].sort((a,b)=>new Date(b.createdAt||b.orderDate)-new Date(a.createdAt||a.orderDate)),itemsFor=id=>sf.state.websiteOrderItems.filter(i=>i.orderId===id),statusClass=s=>s==='Fulfilled'?'success':s==='Cancelled'?'danger':'gold';sf.$('commerceBody').innerHTML=`<section class="card"><div class="commerce-toolbar"><div><div class="section-kicker">SQUARESPACE · FULFILLMENT</div><h3>Website Orders</h3><p class="muted">Import Squarespace order CSV files. Inventory stays unchanged until you mark an order Fulfilled.</p></div><button class="button primary" id="importWebsiteOrders">Import Order CSV</button></div><div class="notice"><b>Inventory rule:</b> Pending, Processing and Shipped orders do not change stock. Stock is deducted once, and only once, when the order becomes <b>Fulfilled</b>.</div><div class="commerce-table website-orders-table"><div class="commerce-row header"><span>Order</span><span>Customer</span><span>Items</span><span>Status</span><span>Total</span><span></span></div>${orders.length?orders.map(o=>{const lines=itemsFor(o.id),count=lines.reduce((n,x)=>n+Number(x.quantity||0),0);return `<div class="commerce-row"><span><b>${sf.esc(o.orderNumber||o.id)}</b><small>${new Date(o.orderDate||o.createdAt).toLocaleDateString()}</small></span><span>${sf.esc(o.customerName||'Website customer')}</span><span>${count}</span><span><i class="stock-pill ${statusClass(o.status)}">${sf.esc(o.status||'Pending')}</i></span><span><b>${C.money(o.total)}</b></span><span><button class="mini-edit" data-view-web-order="${o.id}">Open</button></span></div>`}).join(''):'<div class="empty-state roomy">No website orders imported yet.</div>'}</div></section>`;sf.$('importWebsiteOrders').onclick=()=>C.importWebsiteOrders();document.querySelectorAll('[data-view-web-order]').forEach(b=>b.onclick=()=>C.openWebsiteOrder(b.dataset.viewWebOrder))};
 C.importWebsiteOrders=async function(){ensureWebsite();const sf=window.SF;let file;try{file=await sf.api.openText?.({extensions:['csv'],name:'Squarespace Order CSV'})}catch(e){sf.logError(e,'Import website orders')}if(!file)return;let rows;try{rows=parseCSV(file.text||file)}catch(e){return alert('The order CSV could not be read.')}if(!rows.length)return alert('No order rows were found.');let created=0,linesAdded=0;for(const r of rows){const number=escCsv(pick(r,['Order Number','Order #','Order ID','Order Id','Order']));if(!number)continue;let order=sf.state.websiteOrders.find(o=>String(o.orderNumber)===number);if(!order){const rawPayStatus=escCsv(pick(r,['Payment Status','Financial Status','Fulfillment Payment Status']))||'';const payMap={'PAID':'PAID','PAID IN FULL':'PAID','PARTIALLY_PAID':'PARTIALLY_PAID','PARTIALLY REFUNDED':'PARTIALLY_PAID','REFUNDED':'REFUNDED','AUTHORIZED':'AUTHORIZED','PENDING':'AUTHORIZED'};order={id:sf.makeId('WEB-ORD'),orderNumber:number,source:'Squarespace',customerName:escCsv(pick(r,['Customer Name','Billing Name','Shipping Name','Name']))||'Website customer',email:escCsv(pick(r,['Email','Customer Email'])),orderDate:escCsv(pick(r,['Order Date','Created At','Date']))||new Date().toISOString(),status:'Pending',paymentState:payMap[rawPayStatus.toUpperCase()]||(rawPayStatus?rawPayStatus.toUpperCase():''),total:Number(pick(r,['Order Total','Total','Grand Total'])||0),inventoryDeducted:false,createdAt:new Date().toISOString()};sf.state.websiteOrders.push(order);created++}const sku=escCsv(pick(r,['SKU','Variant SKU','Product SKU'])),qty=Math.max(1,Number(pick(r,['Quantity','Qty'])||1)),title=escCsv(pick(r,['Product Name','Product','Item','Line Item Name'])),variant=escCsv(pick(r,['Variant','Variant Name','Options']));const exists=sf.state.websiteOrderItems.find(i=>i.orderId===order.id&&i.sku===sku&&i.productName===title&&i.variant===variant);if(!exists){sf.state.websiteOrderItems.push({id:sf.makeId('WEB-LINE'),orderId:order.id,sku,productName:title,variant,quantity:qty,unitPrice:Number(pick(r,['Unit Price','Price'])||0),createdAt:new Date().toISOString()});linesAdded++}}sf.logActivity(`Imported ${created} website orders and ${linesAdded} order items`);await sf.persist();alert(`Import complete: ${created} new orders and ${linesAdded} order items.`);C.websiteOrders()};
 C.openWebsiteOrder=function(id){ensureWebsite();const sf=window.SF,o=sf.state.websiteOrders.find(x=>x.id===id);if(!o)return;const lines=sf.state.websiteOrderItems.filter(i=>i.orderId===id),match=i=>sf.state.inventoryItems.find(x=>String(x.sku||'').trim().toLowerCase()===String(i.sku||'').trim().toLowerCase());sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card wide"><div class="commerce-toolbar"><div><div class="section-kicker">WEBSITE ORDER</div><h2>${sf.esc(o.orderNumber||o.id)}</h2><p class="muted">${sf.esc(o.customerName||'Website customer')} · ${new Date(o.orderDate||o.createdAt).toLocaleString()}</p></div><i class="stock-pill ${o.status==='Fulfilled'?'success':'gold'}">${sf.esc(o.status||'Pending')}</i></div><div class="inventory-table"><div class="inventory-row inventory-header"><span>Product</span><span>Variant</span><span>SKU</span><span>Qty</span><span>Inventory match</span><span></span><span></span></div>${lines.map(i=>{const inv=match(i);return `<div class="inventory-row"><span><b>${sf.esc(i.productName||'Website item')}</b></span><span>${sf.esc(i.variant||'')}</span><span class="mono">${sf.esc(i.sku||'No SKU')}</span><span>${Number(i.quantity||1)}</span><span><b>${inv?`${sf.esc(inv.artworkTitle||inv.name||'Matched')} · ${Number(inv.quantity||0)} on hand`:'No match'}</b></span><span></span><span></span></div>`}).join('')}</div><div class="notice">${o.inventoryDeducted?'Inventory has already been deducted for this order.':'Inventory has not been changed.'}</div><div class="row-actions"><button class="button secondary" id="closeWebsiteOrder">Close</button>${o.status!=='Fulfilled'?'<button class="button primary" id="fulfillWebsiteOrder">Mark Fulfilled & Deduct Inventory</button>':'<button class="button secondary" disabled>Fulfilled</button>'}</div></div></div>`;sf.$('closeWebsiteOrder').onclick=()=>sf.closeModal();const btn=sf.$('fulfillWebsiteOrder');if(btn)btn.onclick=async()=>{const missing=lines.filter(i=>!match(i));if(missing.length&&!confirm(`${missing.length} item line(s) have no matching inventory SKU and will not be deducted. Continue?`))return;if(o.inventoryDeducted)return alert('Inventory was already deducted for this order.');for(const line of lines){const inv=match(line);if(!inv)continue;inv.quantity=Math.max(0,Number(inv.quantity||0)-Number(line.quantity||1));inv.currentOnHand=inv.quantity;inv.updatedAt=new Date().toISOString()}o.status='Fulfilled';o.fulfilledAt=new Date().toISOString();o.inventoryDeducted=true;o.updatedAt=new Date().toISOString();sf.logActivity(`Fulfilled website order ${o.orderNumber} · inventory deducted`);await sf.persist();sf.closeModal();C.websiteOrders()}};
 const oldDraw=C.draw.bind(C);C.draw=function(){if(this.tab==='website')return this.websiteOrders();return oldDraw()};
})();

/* StudioFlow 11.4.2 · Live Squarespace connection, automatic order checks, and production flags */
(function(){
 const C=window.SFCommerceHub;if(!C)return;
 const originalEnsure=C.ensure.bind(C);
 C.ensure=function(){originalEnsure();const s=window.SF.state;s.websiteOrders=Array.isArray(s.websiteOrders)?s.websiteOrders:[];s.websiteOrderItems=Array.isArray(s.websiteOrderItems)?s.websiteOrderItems:[];s.websiteProducts=Array.isArray(s.websiteProducts)?s.websiteProducts:[];s.websiteInventory=Array.isArray(s.websiteInventory)?s.websiteInventory:[];s.productionQueue=Array.isArray(s.productionQueue)?s.productionQueue:[];s.squarespace=s.squarespace&&typeof s.squarespace==='object'?s.squarespace:{};s.squarespace.autoSync=s.squarespace.autoSync!==false;s.squarespace.syncMinutes=Math.max(2,Number(s.squarespace.syncMinutes||5));};
 const lineVariant=line=>(line.variantOptions||[]).map(x=>`${x.optionName}: ${x.value}`).join(' · ')||line.variant||'';
 const moneyValue=v=>Number(v?.value??v??0)||0;
 C.connectionClass=function(){const s=window.SF.state.squarespace||{};return s.connectionStatus==='Connected'?'success':s.connectionStatus==='Checking'?'gold':'danger'};
 C.pendingWebsiteOrders=function(){return (window.SF.state.websiteOrders||[]).filter(o=>!['Fulfilled','Cancelled'].includes(o.status||'Pending'))};
 C.newWebsiteOrders=function(){return (window.SF.state.websiteOrders||[]).filter(o=>o.isNew===true&&!['Fulfilled','Cancelled'].includes(o.status||'Pending'))};
 C.refreshOrderAttention=function(){
   const sf=window.SF;if(!sf?.state)return;const fresh=this.newWebsiteOrders().length,pending=this.pendingWebsiteOrders().length;
   document.querySelectorAll('[data-commerce-tab="website"]').forEach(b=>{b.classList.toggle('order-alert',fresh>0);b.classList.toggle('order-pending',!fresh&&pending>0)});
   document.querySelectorAll('[data-page="Sales & Orders"]').forEach(b=>{b.classList.toggle('order-alert',fresh>0);b.classList.toggle('order-pending',!fresh&&pending>0)});
 };
 C.saveConnection=async function(){const sf=window.SF,key=sf.$('sqApiKey')?.value.trim();if(!key)return alert('Enter your Squarespace API key.');const r=await sf.api.squarespaceSaveCredentials({apiKey:key});if(!r?.ok)return alert(r?.error||'Could not save the API key.');sf.$('sqApiKey').value='';alert('Squarespace API key saved securely on this computer.');};
 C.testConnection=async function(){const sf=window.SF,key=sf.$('sqApiKey')?.value.trim();sf.state.squarespace.connectionStatus='Checking';this.websiteOrders();const r=await sf.api.squarespaceTest({apiKey:key||undefined});if(!r?.ok){sf.state.squarespace.connectionStatus='Connection Error';sf.state.squarespace.lastError=r?.error||'Connection failed';await sf.persist();this.websiteOrders();return alert(`Squarespace connection failed: ${sf.state.squarespace.lastError}`)}sf.state.squarespace={...sf.state.squarespace,connectionStatus:'Connected',website:r.website,lastConnectedAt:new Date().toISOString(),lastError:''};await sf.persist();this.websiteOrders();alert(`Connected to ${r.website?.title||'your Squarespace website'}.`);};
 C.syncProducts=async function(silent=false){const sf=window.SF;const r=await sf.api.squarespaceSyncProducts();if(!r?.ok){sf.state.squarespace.connectionStatus='Connection Error';sf.state.squarespace.lastError=r?.error||'Product sync failed';await sf.persist();if(!silent)alert(sf.state.squarespace.lastError);return r}sf.state.websiteProducts=r.products||[];sf.state.websiteInventory=r.inventory||[];sf.state.squarespace.connectionStatus='Connected';sf.state.squarespace.lastProductSync=r.syncedAt;sf.state.squarespace.lastError='';sf.logActivity(`Synced ${sf.state.websiteProducts.length} Squarespace products`);await sf.persist();if(!silent)alert(`Product sync complete: ${sf.state.websiteProducts.length} products and ${sf.state.websiteInventory.length} inventory variants.`);return r};
 C.upsertLiveOrders=function(remoteOrders){const sf=window.SF;let created=0,updated=0;for(const ro of remoteOrders||[]){let o=sf.state.websiteOrders.find(x=>String(x.squarespaceId||x.id)===String(ro.id)||String(x.orderNumber)===String(ro.orderNumber));const isNew=!o;if(!o){o={id:sf.makeId('WEB-ORD'),squarespaceId:ro.id,source:'Squarespace',createdAt:new Date().toISOString(),inventoryDeducted:false,isNew:true};sf.state.websiteOrders.push(o);created++}else updated++;
     Object.assign(o,{squarespaceId:ro.id,orderNumber:ro.orderNumber||o.orderNumber,customerName:[ro.shippingAddress?.firstName,ro.shippingAddress?.lastName].filter(Boolean).join(' ')||[ro.billingAddress?.firstName,ro.billingAddress?.lastName].filter(Boolean).join(' ')||o.customerName||'Website customer',email:ro.customerEmail||o.email||'',orderDate:ro.createdOn||o.orderDate||o.createdAt,modifiedOn:ro.modifiedOn||o.modifiedOn,status:ro.fulfillmentStatus==='FULFILLED'?'Fulfilled':ro.fulfillmentStatus==='CANCELED'?'Cancelled':(o.status==='Processing'||o.status==='Print Required'?'Processing':'Pending'),paymentState:ro.paymentState||o.paymentState,total:moneyValue(ro.grandTotal),subtotal:moneyValue(ro.subtotal),shippingTotal:moneyValue(ro.shippingTotal),taxTotal:moneyValue(ro.taxTotal),testMode:ro.testmode===true,shippingAddress:ro.shippingAddress||o.shippingAddress,remoteFulfillmentStatus:ro.fulfillmentStatus||'',/* g170 — KEEP THE DISCOUNT LINES. Squarespace returns them on every order and this upsert threw them away. They are the ONLY thing on a Squarespace order that can identify which hotel a sale came from: checkout pages do not support code injection, so nothing can quietly attach a venue code. A per-venue discount code is the one mechanism that reliably reaches the order record. */discountLines:Array.isArray(ro.discountLines)?ro.discountLines:(o.discountLines||[]),discountTotal:moneyValue(ro.discountTotal)||o.discountTotal||0,isNew:isNew?true:o.isNew});
     sf.state.websiteOrderItems=sf.state.websiteOrderItems.filter(i=>i.orderId!==o.id);
     for(const line of ro.lineItems||[])sf.state.websiteOrderItems.push({id:sf.makeId('WEB-LINE'),orderId:o.id,squarespaceLineId:line.id,productId:line.productId,variantId:line.variantId,sku:line.sku||'',productName:line.productName||line.title||'Website item',variant:lineVariant(line),quantity:Number(line.quantity||1),unitPrice:moneyValue(line.unitPricePaid),imageUrl:line.imageUrl||'',createdAt:new Date().toISOString()});
   }return{created,updated};};
 C.syncOrders=async function(silent=false){const sf=window.SF;sf.state.squarespace.connectionStatus='Checking';this.refreshOrderAttention();const after=sf.state.squarespace.lastOrderSync?new Date(new Date(sf.state.squarespace.lastOrderSync).getTime()-120000).toISOString():new Date(Date.now()-90*86400000).toISOString();const r=await sf.api.squarespaceSyncOrders({modifiedAfter:after,modifiedBefore:new Date().toISOString(),paymentStates:'AUTHORIZED,PAID,PARTIALLY_PAID,REFUNDED'});if(!r?.ok){sf.state.squarespace.connectionStatus='Connection Error';sf.state.squarespace.lastError=r?.error||'Order sync failed';await sf.persist();this.refreshOrderAttention();if(!silent)alert(sf.state.squarespace.lastError);return r}const changes=this.upsertLiveOrders(r.orders||[]);sf.state.squarespace.connectionStatus='Connected';sf.state.squarespace.lastOrderSync=r.syncedAt;sf.state.squarespace.lastError='';if(changes.created){sf.logActivity(`Found ${changes.created} new Squarespace order${changes.created===1?'':'s'}`);const newest=sf.state.websiteOrders.filter(o=>o.isNew).slice(-changes.created);if(window.SFWebsiteUpdates){if(changes.created===1&&newest[0])window.SFWebsiteUpdates.notify('New Website Order Received',`Order #${newest[0].orderNumber} · ${newest[0].customerName||'Website customer'} · $${Number(newest[0].total||0).toFixed(2)}`);else window.SFWebsiteUpdates.notify(`${changes.created} New Website Orders Received`,'Open Sales & Orders to review them.')}}await sf.persist();this.refreshOrderAttention();if(this.tab==='website')this.websiteOrders();if(!silent)alert(changes.created?`${changes.created} new order${changes.created===1?'':'s'} found.`:'Squarespace is up to date. No new orders.');return r};
 C.orderNeed=function(line){const sf=window.SF,sku=String(line.sku||'').trim().toLowerCase(),inv=sf.state.inventoryItems.find(x=>String(x.sku||'').trim().toLowerCase()===sku),qty=Number(line.quantity||1),onHand=Number(inv?.quantity??inv?.currentOnHand??0);return{inv,onHand,needsProduction:!inv||onHand<qty}};
 C.createProductionTasks=function(order){const sf=window.SF,lines=sf.state.websiteOrderItems.filter(i=>i.orderId===order.id);for(const line of lines){const need=this.orderNeed(line);if(!need.needsProduction)continue;const exists=sf.state.productionQueue.find(x=>x.orderId===order.id&&x.orderItemId===line.id&&!['Completed','Cancelled'].includes(x.status));if(!exists)sf.state.productionQueue.push({id:sf.makeId('PROD'),orderId:order.id,orderNumber:order.orderNumber,orderItemId:line.id,artworkTitle:line.productName,product:line.variant||line.productName,sku:line.sku,quantity:Math.max(1,Number(line.quantity||1)-need.onHand),status:'Print Required',priority:'High',source:'Website Order',createdAt:new Date().toISOString()});}order.status='Processing';order.isNew=false;};
C.paymentLabel=function(o){
  const state=String(o.paymentState||'').toUpperCase();
  if(state==='PAID')return['Paid','success'];
  if(state==='PARTIALLY_PAID')return['Partially Paid','gold'];
  if(state==='REFUNDED')return['Refunded','gold'];
  if(state==='AUTHORIZED')return['Authorized','gold'];
  if(!state)return['Unknown','gold'];
  return[state,'gold'];
};
 C.websiteOrders=function(){this.ensure();const sf=window.SF,orders=[...sf.state.websiteOrders].sort((a,b)=>new Date(b.orderDate||b.createdAt)-new Date(a.orderDate||a.createdAt)),itemsFor=id=>sf.state.websiteOrderItems.filter(i=>i.orderId===id),fresh=this.newWebsiteOrders().length,pending=this.pendingWebsiteOrders().length,sq=sf.state.squarespace||{},site=sq.website||{};sf.$('commerceBody').innerHTML=`<section class="card squarespace-connection-card"><div class="commerce-toolbar"><div><div class="section-kicker">LIVE WEBSITE CONNECTION</div><h3>Squarespace ${sq.connectionStatus==='Connected'?'✓ Connected':'Disconnected'}</h3><p class="muted">StudioFlow checks for paid website orders when it opens and every ${Number(sq.syncMinutes||5)} minutes while running.</p></div><i class="stock-pill ${this.connectionClass()}">${sf.esc(sq.connectionStatus||'Not Connected')}</i></div><div class="connection-grid"><label>Squarespace API Key<input id="sqApiKey" type="password" placeholder="Paste API key to connect or replace saved key"></label><label>Automatic checks<select id="sqAutoSync"><option value="yes" ${sq.autoSync!==false?'selected':''}>On</option><option value="no" ${sq.autoSync===false?'selected':''}>Off</option></select></label><label>Check every<select id="sqSyncMinutes"><option value="15" ${Number(sq.syncMinutes||15)===15?'selected':''}>15 minutes</option><option value="30" ${Number(sq.syncMinutes)===30?'selected':''}>30 minutes</option><option value="60" ${Number(sq.syncMinutes)===60?'selected':''}>1 hour</option><option value="0" ${Number(sq.syncMinutes)===0?'selected':''}>Manual only</option></select></label></div><div class="row-actions"><button class="button secondary" id="saveSqConnection">Save Key</button><button class="button secondary" id="testSqConnection">Test Connection</button><button class="button secondary" id="syncSqProducts">Sync Products</button><button class="button primary" id="checkSqOrders">Check for Orders Now</button>${sq.connectionStatus==='Connected'?'<button class="button danger" id="disconnectSq">Disconnect</button>':''}</div><div class="connection-meta">${site.title?`<b>${sf.esc(site.title)}</b> · ${sf.esc(site.url||'')} · ${sf.esc(site.currency||'')}`:'No website details loaded yet.'}${sq.lastOrderSync?`<br>Last successful order check: ${new Date(sq.lastOrderSync).toLocaleString()}`:'<br>Last successful order check: Never'}${sq.lastProductSync?`<br>Last successful product sync: ${new Date(sq.lastProductSync).toLocaleString()}`:''}${sq.lastError?`<br><span class="danger-text">${sf.esc(sq.lastError)}</span>`:''}</div></section><section class="card"><div class="commerce-toolbar"><div><div class="section-kicker">DEVELOPER TOOLS</div><h3>Simulate a Website Order</h3><p class="muted">Creates a realistic test order without touching your live Squarespace store — useful for testing Production Workspace and inventory without a real sale.</p></div></div><div class="row-actions"><button class="button secondary" data-sim-order="Art Card">Art Card</button><button class="button secondary" data-sim-order="Framed Print">Framed Print</button><button class="button secondary" data-sim-order="Canvas">Canvas</button><button class="button secondary" data-sim-order="Multiple Items">Multiple Items</button></div></section><section class="card"><div class="commerce-toolbar"><div><div class="section-kicker">SQUARESPACE · FULFILLMENT</div><h3>Website Orders</h3><p class="muted">${fresh?`${fresh} new order${fresh===1?'':'s'} need review.`:pending?`${pending} order${pending===1?'':'s'} awaiting production or fulfillment.`:'No active website orders.'}</p></div><button class="button secondary" id="importWebsiteOrders">Import Order CSV</button></div><div class="notice"><b>Inventory rule:</b> StudioFlow warns when no finished print is in stock and creates a <b>Print Required</b> task. Inventory is deducted only when the order is fulfilled.</div><div class="commerce-table website-orders-table"><div class="commerce-row header"><span>Order</span><span>Customer</span><span>Items</span><span>Fulfillment</span><span>Payment</span><span>Total</span><span></span></div>${orders.length?orders.map(o=>{const lines=itemsFor(o.id),count=lines.reduce((n,x)=>n+Number(x.quantity||0),0),needs=lines.some(i=>C.orderNeed(i).needsProduction),pay=C.paymentLabel(o);return `<div class="commerce-row ${o.isNew?'new-order-row':''}"><span><b>${sf.esc(o.orderNumber||o.id)}</b><small>${new Date(o.orderDate||o.createdAt).toLocaleDateString()}${o.testMode?' · TEST':''}</small></span><span>${sf.esc(o.customerName||'Website customer')}</span><span>${count}${needs?' · Print required':''}</span><span><i class="stock-pill ${o.status==='Fulfilled'?'success':o.isNew?'success':'gold'}">${sf.esc(o.isNew?'New Order':o.status||'Pending')}</i></span><span><i class="stock-pill ${pay[1]}">${sf.esc(pay[0])}</i></span><span><b>${C.money(o.total)}</b></span><span><button class="mini-edit" data-view-web-order="${o.id}">Open</button></span></div>`}).join(''):'<div class="empty-state roomy">No website orders have been found yet.</div>'}</div></section>`;
   sf.$('saveSqConnection').onclick=()=>C.saveConnection();sf.$('testSqConnection').onclick=()=>C.testConnection();sf.$('syncSqProducts').onclick=()=>C.syncProducts();sf.$('checkSqOrders').onclick=()=>C.syncOrders();sf.$('importWebsiteOrders').onclick=()=>C.importWebsiteOrders();sf.$('sqAutoSync').onchange=async e=>{sq.autoSync=e.target.value==='yes';await sf.persist();C.startAutoSync()};sf.$('sqSyncMinutes').onchange=async e=>{sq.syncMinutes=Number(e.target.value);await sf.persist();C.startAutoSync()};document.querySelectorAll('[data-view-web-order]').forEach(b=>b.onclick=()=>C.openWebsiteOrder(b.dataset.viewWebOrder));const disc=sf.$('disconnectSq');if(disc)disc.onclick=async()=>{if(!confirm('Disconnect from Squarespace? Automatic order checking will stop until you reconnect.'))return;sq.connectionStatus='Not Connected';sq.apiKey='';clearInterval(C._sqTimer);await sf.persist();C.websiteOrders()};document.querySelectorAll('[data-sim-order]').forEach(b=>b.onclick=async()=>{window.SFWebsiteUpdates.simulateOrder(b.dataset.simOrder);await sf.persist();C.refreshOrderAttention();C.websiteOrders()});this.refreshOrderAttention();};
 C.openWebsiteOrder=function(id){this.ensure();const sf=window.SF,o=sf.state.websiteOrders.find(x=>x.id===id);if(!o)return;o.isNew=false;const lines=sf.state.websiteOrderItems.filter(i=>i.orderId===id),pay=C.paymentLabel(o);sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card wide"><div class="commerce-toolbar"><div><div class="section-kicker">WEBSITE ORDER</div><h2>${sf.esc(o.orderNumber||o.id)}</h2><p class="muted">${sf.esc(o.customerName||'Website customer')} · ${new Date(o.orderDate||o.createdAt).toLocaleString()}</p></div><div class="row-actions"><i class="stock-pill ${o.status==='Fulfilled'?'success':'gold'}">${sf.esc(o.status||'Pending')}</i><i class="stock-pill ${pay[1]}">${sf.esc(pay[0])}</i></div></div><div class="inventory-table"><div class="inventory-row inventory-header"><span>Artwork</span><span>Product</span><span>SKU</span><span>Qty</span><span>Availability</span><span></span><span></span></div>${lines.map(i=>{const need=C.orderNeed(i);return `<div class="inventory-row"><span><b>${sf.esc(i.productName||'Website item')}</b></span><span>${sf.esc(i.variant||'Standard')}</span><span class="mono">${sf.esc(i.sku||'No SKU')}</span><span>${Number(i.quantity||1)}</span><span><b>${need.needsProduction?`Print required · ${need.onHand} ready`:`${need.onHand} ready in inventory`}</b></span><span></span><span></span></div>`}).join('')}</div><div class="notice">${o.inventoryDeducted?'Inventory has already been deducted for this order.':'Reviewing the order does not change inventory. Missing finished stock can be sent to the Production Queue.'}</div><div class="row-actions"><button class="button secondary" id="closeWebsiteOrder">Close</button>${o.status!=='Fulfilled'?'<button class="button secondary" id="sendToProduction">Create Print Tasks</button><button class="button primary" id="fulfillWebsiteOrder">Mark Fulfilled & Deduct Available Inventory</button>':'<button class="button secondary" disabled>Fulfilled</button>'}</div></div></div>`;sf.$('closeWebsiteOrder').onclick=async()=>{await sf.persist();sf.closeModal();C.websiteOrders()};const prod=sf.$('sendToProduction');if(prod)prod.onclick=async()=>{C.createProductionTasks(o);sf.logActivity(`Created production tasks for website order ${o.orderNumber}`);await sf.persist();sf.closeModal();C.websiteOrders()};const btn=sf.$('fulfillWebsiteOrder');if(btn)btn.onclick=async()=>{if(o.inventoryDeducted)return alert('Inventory was already deducted for this order.');if(o.testMode){o.status='Fulfilled';o.fulfilledAt=new Date().toISOString();o.inventoryDeducted=true;o.isNew=false;o.updatedAt=new Date().toISOString();sf.logActivity(`Fulfilled TEST order ${o.orderNumber} — no real inventory or revenue was affected`);await sf.persist();sf.closeModal();C.websiteOrders();return}for(const line of lines){const need=C.orderNeed(line),inv=need.inv;if(!inv)continue;const used=Math.min(Number(inv.quantity??inv.currentOnHand??0),Number(line.quantity||1));inv.quantity=Math.max(0,Number(inv.quantity??inv.currentOnHand??0)-used);inv.currentOnHand=inv.quantity;inv.updatedAt=new Date().toISOString()}o.status='Fulfilled';o.fulfilledAt=new Date().toISOString();o.inventoryDeducted=true;o.isNew=false;o.updatedAt=new Date().toISOString();sf.state.productionQueue.filter(x=>x.orderId===o.id).forEach(x=>x.status='Completed');
    // Fulfilling a website order previously never created a record in salesTransactions -- the only
    // place the Sales & Orders transaction list and revenue figures actually read from -- so a
    // completed, paid website sale silently never showed up as revenue anywhere. Fix: create it here,
    // once, guarded against re-fulfillment ever creating a duplicate.
    if(!o.salesTransactionId){
      sf.state.salesTransactions=Array.isArray(sf.state.salesTransactions)?sf.state.salesTransactions:[];
      const payState=String(o.paymentState||'').toUpperCase();
      const txn={id:sf.makeId('SALE'),customerId:o.customerId||'',customerName:o.customerName||'Website customer',saleSource:'Website',websiteOrderId:o.id,total:Number(o.total||0),soldAt:o.fulfilledAt,orderStatus:payState==='PAID'?'Paid in Full':payState==='PARTIALLY_PAID'?'Partially Paid':payState||'Completed',createdAt:new Date().toISOString()};
      sf.state.salesTransactions.push(txn);
      o.salesTransactionId=txn.id;
    }
    sf.logActivity(`Fulfilled website order ${o.orderNumber} · available inventory deducted`);await sf.persist();sf.closeModal();C.websiteOrders()}};
 C.startAutoSync=function(){clearInterval(C._sqTimer);const sf=window.SF;if(!sf?.state?.squarespace?.autoSync)return;const mins=Number(sf.state.squarespace.syncMinutes||15);if(mins<=0)return;C._sqTimer=setInterval(()=>C.syncOrders(true),Math.max(2,mins)*60000)};
 const previousDraw=C.draw.bind(C);C.draw=function(){const out=previousDraw();setTimeout(()=>this.refreshOrderAttention(),0);return out};
 const oldBuild=window.SF.buildNavigation.bind(window.SF);window.SF.buildNavigation=function(){oldBuild();setTimeout(()=>C.refreshOrderAttention(),0)};
 window.addEventListener('studioflow-ready',async()=>{C.startAutoSync();try{const status=await window.SF.api.squarespaceCredentialStatus();if(status?.configured)setTimeout(()=>C.syncOrders(true),1200)}catch{}});
})();

/* StudioFlow 11.4.2 · Permanent expense deletion */
(function(){const C=window.SFCommerceHub;if(!C)return;C.expenses=function(){const sf=window.SF,items=[...sf.state.businessTransactions].filter(x=>x.direction==='out'||['Expense','Material Purchase','Equipment','Travel','Accommodation','Meals','Parking','Booth Fee','Software','Insurance'].includes(x.type)).sort((a,b)=>String(b.date).localeCompare(String(a.date))),total=items.reduce((n,x)=>n+Number(x.amount||0),0);
  sf.$('commerceBody').innerHTML=`<div class="commerce-kpis"><div><b>${this.money(total)}</b><span>Total Recorded Expenses</span></div><div><b>${(sf.state.expenseSessions||[]).length}</b><span>Expense Groups</span></div><div><b>${this.money(items.filter(x=>new Date(x.date).getFullYear()===new Date().getFullYear()).reduce((n,x)=>n+Number(x.amount||0),0))}</b><span>This Year</span></div><div><b>${this.money(items.filter(x=>x.type==='Material Purchase').reduce((n,x)=>n+Number(x.amount||0),0))}</b><span>Supply Costs</span></div></div>
  <section class="card"><div class="commerce-toolbar"><div><h3>Grouped Project Expenses</h3><p class="muted">Enter meals, gas, accommodation and other costs together and attach them to one job or expedition. Test entries and mistakes can be deleted permanently, along with everything in that group.</p></div><div class="row-actions"><button class="button secondary" id="importExpensifyPdf">Import Expensify PDF</button><button class="button primary" id="newExpenseSession">＋ Add Expense Group</button></div></div><div class="commerce-table"><div class="commerce-row header"><span>Date</span><span>Assigned To</span><span>Project / Job</span><span>Entries</span><span>Total</span><span></span></div>${(sf.state.expenseSessions||[]).length?sf.state.expenseSessions.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(x=>`<div class="commerce-row"><span>${new Date(x.date+'T12:00:00').toLocaleDateString()}</span><span><b>${sf.esc(x.assignmentType)}</b></span><span>${sf.esc(x.name)}</span><span>${x.items.length}</span><span><b>${this.money(x.items.reduce((n,i)=>n+Number(i.amount||0),0))}</b></span><span><button class="button danger compact" data-delete-expense-group="${x.id}">Delete</button></span></div>`).join(''):'<div class="empty-state roomy">No grouped expenses recorded yet.</div>'}</div></section>
  <section class="card"><div class="commerce-toolbar"><div><h3>Individual Business Expenses</h3><p class="muted">Equipment, software, insurance and other one-off business costs not tied to a specific project.</p></div><button class="button primary" id="newExpense">＋ Add Expense</button></div><div class="commerce-table"><div class="commerce-row header"><span>Date</span><span>Category</span><span>Project / Job</span><span>Payee</span><span>Amount</span><span></span></div>${items.filter(x=>!x.expenseSessionId).length?items.filter(x=>!x.expenseSessionId).map(x=>`<div class="commerce-row"><span>${x.date?new Date(x.date+'T12:00:00').toLocaleDateString():'—'}</span><span><b>${sf.esc(x.type)}</b></span><span>${sf.esc(x.projectName||x.projectType||'General Business')}</span><span>${sf.esc(x.payee||'—')}</span><span><b>${this.money(x.amount)}</b></span><span>${x.receiptImage?`<img src="${this.receiptSrc(x.receiptImage)}" class="expense-receipt-thumb" data-tx-receipt="${x.id}" title="Click to see it full size">`:''}<button class="button secondary compact" data-tx-addreceipt="${x.id}">${x.receiptImage?'Replace':'\uff0b Receipt'}</button></span><span><button class="button danger compact" data-delete-expense="${x.id}">Delete</button></span></div>`).join(''):'<div class="empty-state roomy">No individual expenses recorded yet.</div>'}</div></section>`;
  sf.$('newExpense').onclick=()=>this.openBusinessTransaction('Expense');
  sf.$('newExpenseSession').onclick=()=>this.openExpenseSession();
  sf.$('importExpensifyPdf').onclick=()=>this.importExpensifyPdf();
  document.querySelectorAll('[data-delete-expense]').forEach(b=>b.onclick=async()=>{const x=sf.state.businessTransactions.find(t=>t.id===b.dataset.deleteExpense);if(!x||!confirm(`Delete this ${x.type.toLowerCase()} permanently? It will be removed from all totals.`))return;sf.state.businessTransactions=sf.state.businessTransactions.filter(t=>t.id!==x.id);sf.logActivity(`Deleted ${x.type.toLowerCase()} ${C.money(x.amount)}`);await sf.persist();C.expenses()});
  document.querySelectorAll('[data-delete-expense-group]').forEach(b=>b.onclick=async()=>{const g=sf.state.expenseSessions.find(s=>s.id===b.dataset.deleteExpenseGroup);if(!g||!confirm(`Delete "${g.name}" and all ${g.items.length} expense(s) in it permanently? This cannot be undone.`))return;sf.state.expenseSessions=sf.state.expenseSessions.filter(s=>s.id!==g.id);sf.state.businessTransactions=sf.state.businessTransactions.filter(t=>t.expenseSessionId!==g.id);sf.logActivity(`Deleted expense group: ${g.name}`);await sf.persist();C.expenses()});
};})();

/* StudioFlow 11.4.3 · Production & Fulfillment */
(function(){
 const C=window.SFCommerceHub;if(!C)return;
 if(!C.tabs.some(x=>x[0]==='production'))C.tabs.splice(2,0,['production','Production']);
 const oldDraw=C.draw.bind(C);
 C.draw=function(){
   if(this.tab==='production')return this.production();
   return oldDraw();
 };
 C.productionCounts=function(){
   this.ensure();const q=window.SF.state.productionQueue||[];
   return {
     print:q.filter(x=>x.status==='Print Required').reduce((n,x)=>n+Number(x.quantity||1),0),
     frame:q.filter(x=>x.status==='Frame Required').reduce((n,x)=>n+Number(x.quantity||1),0),
     ready:q.filter(x=>['Ready to Ship','Ready for Pickup'].includes(x.status)).reduce((n,x)=>n+Number(x.quantity||1),0),
     active:q.filter(x=>!['Completed','Cancelled'].includes(x.status)).length,
     completedToday:q.filter(x=>x.status==='Completed'&&String(x.completedAt||'').slice(0,10)===new Date().toISOString().slice(0,10)).length
   };
 };
 C.production=function(){
   this.ensure();const sf=window.SF,q=[...sf.state.productionQueue].filter(x=>!['Completed','Cancelled'].includes(x.status)),counts=this.productionCounts();
   const groups=['Print Required','Frame Required','Ready to Ship','Ready for Pickup'];
   const nextStatus=s=>s==='Print Required'?'Frame Required':s==='Frame Required'?'Ready to Ship':s==='Ready to Ship'||s==='Ready for Pickup'?'Completed':'Completed';
   const nextLabel=s=>s==='Print Required'?'Printing Complete':s==='Frame Required'?'Framing Complete':s==='Ready to Ship'?'Mark Shipped':s==='Ready for Pickup'?'Mark Picked Up':'Complete';
   const card=x=>`<article class="production-task"><div class="production-task-main"><div><span class="production-priority ${String(x.priority||'Normal').toLowerCase()}">${sf.esc(x.priority||'Normal')}</span><h4>${sf.esc(x.artworkTitle||'Production Item')}</h4><p>${sf.esc(x.product||'Standard product')}${x.paperFinish?` · ${sf.esc(x.paperFinish)}`:''}</p><small>${sf.esc(x.source||'Manual')} ${x.orderNumber?`· Order ${sf.esc(x.orderNumber)}`:''}${x.sku?` · ${sf.esc(x.sku)}`:''}</small></div><strong class="production-qty">×${Number(x.quantity||1)}</strong></div><div class="row-actions compact-actions"><button class="button secondary compact" data-prod-edit="${x.id}">Edit</button><button class="button danger compact" data-prod-delete="${x.id}">Delete</button><button class="button primary compact" data-prod-next="${x.id}" data-next-status="${nextStatus(x.status)}">${nextLabel(x.status)}</button></div></article>`;
   // Fulfillment folded in here rather than a separate tab -- it's not separate data, just an
   // order-level view of the same production queue: orders whose tasks have all reached a
   // finished state, ready for the final packing/shipping/pickup step.
   const fulfillOrders=[...sf.state.websiteOrders].filter(o=>!['Fulfilled','Cancelled'].includes(o.status||'Pending')).filter(o=>{const tasks=sf.state.productionQueue.filter(t=>t.orderId===o.id);return tasks.length&&!tasks.some(t=>!['Completed','Cancelled','Ready to Ship','Ready for Pickup'].includes(t.status))}).sort((a,b)=>new Date(a.orderDate||a.createdAt)-new Date(b.orderDate||b.createdAt));
   const fulfillCard=o=>`<article class="production-task"><div class="production-task-main"><div><h4>${sf.esc(o.orderNumber||o.id)}</h4><p>${sf.esc(o.customerName||'Website customer')}</p><small>${sf.esc(o.deliveryMethod||'Shipping / Pickup')}</small></div><strong class="production-qty">${C.money(o.total)}</strong></div><div class="row-actions compact-actions"><button class="button primary compact" data-view-web-order="${o.id}">Open &amp; Fulfill</button></div></article>`;
   sf.$('commerceBody').innerHTML=`<div class="commerce-kpis production-kpis"><div><b>${counts.print}</b><span>Print Required</span></div><div><b>${counts.frame}</b><span>Frame Required</span></div><div><b>${counts.ready}</b><span>Ready to Deliver</span></div><div><b>${counts.completedToday}</b><span>Completed Today</span></div></div><section class="card"><div class="commerce-toolbar"><div><div class="section-kicker">PRODUCTION WORKFLOW</div><h3>Production</h3><p class="muted">Jobs move from printing to framing, then shipping or pickup. Inventory is not deducted here.</p></div><button class="button primary" id="addProductionTask">＋ Add Production Task</button></div></section><div class="production-board">${groups.map(status=>{const items=q.filter(x=>x.status===status);return `<section class="production-column"><header><h3>${status}</h3><b>${items.reduce((n,x)=>n+Number(x.quantity||1),0)}</b></header><div class="production-list">${items.length?items.map(card).join(''):`<div class="empty-state">Nothing waiting here.</div>`}</div></section>`}).join('')}</div><div class="production-board fulfill-board"><section class="production-column"><header><h3>Ready to Fulfill</h3><b>${fulfillOrders.length}</b></header><div class="production-list">${fulfillOrders.length?fulfillOrders.map(fulfillCard).join(''):'<div class="empty-state">Nothing waiting here.</div>'}</div></section></div>`;
   sf.$('addProductionTask').onclick=()=>this.openProductionTask();
   document.querySelectorAll('[data-prod-next]').forEach(b=>b.onclick=async()=>{const x=sf.state.productionQueue.find(t=>t.id===b.dataset.prodNext);if(!x)return;x.status=b.dataset.nextStatus;x.updatedAt=new Date().toISOString();if(x.status==='Completed')x.completedAt=x.updatedAt;const order=sf.state.websiteOrders.find(o=>o.id===x.orderId);if(order&&x.status==='Completed'){const remaining=sf.state.productionQueue.some(t=>t.orderId===order.id&&!['Completed','Cancelled'].includes(t.status));if(!remaining&&order.status!=='Fulfilled')order.status='Ready to Fulfill'}sf.logActivity(`${x.artworkTitle||'Production item'} moved to ${x.status}`);await sf.persist();C.production();C.refreshOrderAttention()});
   document.querySelectorAll('[data-prod-edit]').forEach(b=>b.onclick=()=>C.openProductionTask(b.dataset.prodEdit));
   document.querySelectorAll('[data-prod-delete]').forEach(b=>b.onclick=async()=>{const x=sf.state.productionQueue.find(t=>t.id===b.dataset.prodDelete);if(!x||!confirm(`Delete production task for ${x.artworkTitle||'this item'}?`))return;sf.state.productionQueue=sf.state.productionQueue.filter(t=>t.id!==x.id);sf.logActivity(`Deleted production task for ${x.artworkTitle||'Production Item'}`);await sf.persist();C.production();C.refreshOrderAttention()});
   document.querySelectorAll('[data-view-web-order]').forEach(b=>b.onclick=()=>C.openWebsiteOrder(b.dataset.viewWebOrder));
   this.refreshOrderAttention();
 };
 C.openProductionTask=function(id){
   const sf=window.SF,x=id?sf.state.productionQueue.find(t=>t.id===id):null;
   const templates=(sf.state.inventoryProductTemplates||[]).filter(t=>t.active!==false).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
   const selectedTemplate=x?.productTemplateId||templates.find(t=>String(t.name||'')===String(x?.product||''))?.id||'';
   const productOptions=[...templates.map(t=>`<option value="${sf.esc(t.id)}" ${String(selectedTemplate)===String(t.id)?'selected':''}>${sf.esc(t.name||'Product')}</option>`),`<option value="PAPER_PRINT" ${x?.product==='Paper Print'?'selected':''}>Paper Print</option>`,`<option value="CUSTOM" ${x&&!selectedTemplate&&x.product!=='Paper Print'?'selected':''}>Other / Custom</option>`].join('');
   sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card"><div class="section-kicker">PRODUCTION TASK</div><h2>${x?'Edit Task':'New Task'}</h2><div class="form-grid"><label>Artwork / Item<input id="prodArtwork" value="${sf.esc(x?.artworkTitle||'')}"></label><label>Product / Presentation<select id="prodProductTemplate"><option value="">Select a product</option>${productOptions}</select></label><label id="prodCustomWrap" style="display:none">Custom Product<input id="prodCustomProduct" value="${sf.esc(x&&!selectedTemplate&&x.product!=='Paper Print'?x.product:'')}"></label><label id="prodPaperFinishWrap" style="display:none">Paper Finish<select id="prodPaperFinish"><option value="Standard Luster" ${x?.paperFinish!=='Metallic Luster'?'selected':''}>Standard Luster</option><option value="Metallic Luster" ${x?.paperFinish==='Metallic Luster'?'selected':''}>Metallic Luster</option></select></label><label>Quantity<input id="prodQty" type="number" min="1" value="${Number(x?.quantity||1)}"></label><label>Source<select id="prodSource">${['Website Order','Gallery Restock','Market Restock','Inventory Restock','Manual'].map(v=>`<option ${x?.source===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Status<select id="prodStatus">${['Print Required','Frame Required','Ready to Ship','Ready for Pickup','Completed','Cancelled'].map(v=>`<option ${x?.status===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Priority<select id="prodPriority">${['Normal','High','Urgent'].map(v=>`<option ${x?.priority===v?'selected':''}>${v}</option>`).join('')}</select></label></div><div class="row-actions"><button class="button secondary" id="cancelProdTask">Cancel</button>${x?'<button class="button danger" id="deleteProdTask">Delete</button>':''}<button class="button primary" id="saveProdTask">Save Task</button></div></div></div>`;
   const productSelect=sf.$('prodProductTemplate'),paperWrap=sf.$('prodPaperFinishWrap'),customWrap=sf.$('prodCustomWrap');
   const updateProductFields=()=>{const value=productSelect.value,t=templates.find(v=>String(v.id)===String(value)),isPaper=value==='PAPER_PRINT'||(t&&String(t.category||'').toLowerCase()==='print'&&!/art card/i.test(t.name||''));paperWrap.style.display=isPaper?'':'none';customWrap.style.display=value==='CUSTOM'?'':'none'};
   productSelect.onchange=updateProductFields;updateProductFields();
   sf.$('cancelProdTask').onclick=()=>sf.closeModal();
   if(x)sf.$('deleteProdTask').onclick=async()=>{if(!confirm('Delete this production task?'))return;sf.state.productionQueue=sf.state.productionQueue.filter(t=>t.id!==x.id);sf.logActivity(`Deleted production task for ${x.artworkTitle||'Production Item'}`);await sf.persist();sf.closeModal();C.production();C.refreshOrderAttention()};
   sf.$('saveProdTask').onclick=async()=>{const choice=productSelect.value,t=templates.find(v=>String(v.id)===String(choice));if(!choice)return alert('Choose a product or presentation.');const product=choice==='CUSTOM'?(sf.$('prodCustomProduct').value.trim()||'Custom product'):choice==='PAPER_PRINT'?'Paper Print':t?.name||'Standard product';const isPaper=choice==='PAPER_PRINT'||(t&&String(t.category||'').toLowerCase()==='print'&&!/art card/i.test(t.name||''));const target=x||{id:sf.makeId('PROD'),createdAt:new Date().toISOString()};Object.assign(target,{artworkTitle:sf.$('prodArtwork').value.trim()||'Production Item',product,productTemplateId:t?.id||'',paperFinish:isPaper?sf.$('prodPaperFinish').value:'',quantity:Math.max(1,Number(sf.$('prodQty').value||1)),source:sf.$('prodSource').value,status:sf.$('prodStatus').value,priority:sf.$('prodPriority').value,updatedAt:new Date().toISOString()});if(!x)sf.state.productionQueue.push(target);if(target.status==='Completed'&&!target.completedAt)target.completedAt=new Date().toISOString();sf.logActivity(`${x?'Updated':'Added'} production task for ${target.artworkTitle}`);await sf.persist();sf.closeModal();C.production();C.refreshOrderAttention()};
 };
 // Fulfillment's job is now the "Ready to Fulfill" section inside production() above -- no longer
 // a separate function, since it was never separate data to begin with.
 const oldRefresh=C.refreshOrderAttention.bind(C);
 C.refreshOrderAttention=function(){
   oldRefresh();const fresh=this.newWebsiteOrders().length,pending=this.pendingWebsiteOrders().length,prod=this.productionCounts().active;
   const apply=(el,count,tone)=>{if(!el)return;let badge=el.querySelector('.sf-count-badge');if(!badge){badge=document.createElement('span');badge.className='sf-count-badge';el.appendChild(badge)}badge.textContent=count||'';badge.classList.toggle('green',tone==='green');badge.classList.toggle('yellow',tone==='yellow');badge.hidden=!count};
   document.querySelectorAll('[data-page="Sales & Orders"]').forEach(el=>apply(el,fresh||pending,fresh?'green':'yellow'));
   document.querySelectorAll('[data-commerce-tab="website"]').forEach(el=>apply(el,fresh||pending,fresh?'green':'yellow'));
   document.querySelectorAll('[data-commerce-tab="production"]').forEach(el=>apply(el,prod,'yellow'));
 };
 const priorCreate=C.createProductionTasks.bind(C);
 C.createProductionTasks=function(order){priorCreate(order);for(const t of window.SF.state.productionQueue.filter(x=>x.orderId===order.id&&!['Completed','Cancelled'].includes(x.status))){if(!t.deliveryMethod)t.deliveryMethod='Shipping';}this.refreshOrderAttention()};
})();

/* StudioFlow 11.4.5 · Live connection report, product mapping, and first-order test readiness */
(function(){
 const C=window.SFCommerceHub;if(!C)return;
 const priorEnsure=C.ensure.bind(C);
 C.ensure=function(){
   priorEnsure();
   const s=window.SF.state;
   s.websiteProductMappings=s.websiteProductMappings&&typeof s.websiteProductMappings==='object'?s.websiteProductMappings:{};
   s.squarespace=s.squarespace&&typeof s.squarespace==='object'?s.squarespace:{};
 };
 // Product Mapping is not a permanent tab -- it's a background process. It only becomes reachable
 // when the connection report below shows something genuinely needs review; the 'mapping' render
 // target still exists for that link to open, it's just not in the always-visible tab list.
 C.liveVariants=function(){
   const out=[];
   const add=(product,variant)=>{
     const options=variant?.variantOptions||variant?.options||[];
     const arrayOptionText=Array.isArray(options)?options.map(x=>x?.value||x?.optionValue||x?.name||'').filter(Boolean).join(' · '):String(options||'');
     // Squarespace's real v2 API structure stores each variant's option values as an `attributes`
     // object keyed by attribute name (e.g. {"Material":"Art Card","Size":"5 x 7"}), not an array --
     // confirmed directly against a real Squarespace product CSV export. This was the actual cause
     // of most variants never being found: arrayOptionText was empty for nearly every product,
     // silently falling through to a generic label that never matched any real search.
     const attrOptionText=variant?.attributes&&typeof variant.attributes==='object'?Object.values(variant.attributes).filter(Boolean).join(' · '):'';
     const optionText=attrOptionText||arrayOptionText;
     out.push({
       productId:String(product?.id||product?.productId||''),
       variantId:String(variant?.id||variant?.variantId||''),
       title:product?.name||product?.title||variant?.productName||'Website product',
       variant:optionText||variant?.name||variant?.title||'Standard',
       sku:String(variant?.sku||variant?.variantSku||''),
       price:Number(variant?.pricing?.basePrice?.value??variant?.price?.value??variant?.price??0)||0,
       raw:variant
     });
   };
   for(const p of window.SF.state.websiteProducts||[]){
     const variants=p.variants||p.variantAttributes||p.items||[];
     if(Array.isArray(variants)&&variants.length)variants.forEach(v=>add(p,v));else add(p,p);
   }
   return out;
 };
 C.inventoryChoices=function(){
   const sf=window.SF,rows=[];
   for(const x of sf.state.inventoryItems||[])rows.push({id:String(x.id),sku:String(x.sku||''),label:[x.artworkTitle||x.name||'Inventory item',x.productName||x.product||x.presentation||x.size].filter(Boolean).join(' · '),qty:Number(x.quantity??x.currentOnHand??0)});
   return rows.sort((a,b)=>a.label.localeCompare(b.label));
 };
 C.mappingKey=function(v){return String(v.variantId||v.sku||`${v.productId}:${v.variant}`).trim()};
 C.autoInventoryMatch=function(v){
   const choices=this.inventoryChoices(),sku=String(v.sku||'').trim().toLowerCase();
   if(sku){const exact=choices.find(x=>String(x.sku||'').trim().toLowerCase()===sku);if(exact)return exact;}
   const map=window.SF.state.websiteProductMappings||{},id=map[this.mappingKey(v)];
   return choices.find(x=>String(x.id)===String(id))||null;
 };
 C.connectionReportMarkup=function(){
   const sf=window.SF,sq=sf.state.squarespace||{},stats=this.mappingStats(),pending=this.pendingWebsiteOrders().length,warnings=(sf.state.inventoryItems||[]).filter(x=>Number(x.quantity??x.currentOnHand??0)<=Number(x.lowStockThreshold??x.lowStockWarning??0)).length;
   return `<section class="card connection-report"><div class="commerce-toolbar"><div><div class="section-kicker">CONNECTION REPORT</div><h3>${sq.connectionStatus==='Connected'?'Squarespace Connected ✓':'Squarespace Connection'}</h3></div>${stats.unmatched>0?`<button class="button secondary" id="openProductMapping">${stats.unmatched} variant${stats.unmatched===1?'':'s'} need review</button>`:''}</div><div class="commerce-kpis compact-kpis"><div><b>${stats.products}</b><span>Website Products</span></div><div><b>${stats.matched}</b><span>Matched Variants</span></div><div><b>${stats.unmatched}</b><span>Unmatched Variants</span></div><div><b>${pending}</b><span>Pending Orders</span></div><div><b>${warnings}</b><span>Inventory Warnings</span></div></div><div class="connection-meta">Last product sync: ${sq.lastProductSync?new Date(sq.lastProductSync).toLocaleString():'Not synced yet'}<br>Last order check: ${sq.lastOrderSync?new Date(sq.lastOrderSync).toLocaleString():'Not checked yet'}</div></section>`;
 };
 const priorWebsite=C.websiteOrders.bind(C);
 C.websiteOrders=function(){
   priorWebsite();
   const body=window.SF.$('commerceBody');if(!body)return;
   body.insertAdjacentHTML('afterbegin',this.connectionReportMarkup());
   const btn=window.SF.$('openProductMapping');if(btn)btn.onclick=()=>{C.tab='mapping';C.render()};
 };
 // productMapping's render is defined later (Smart Catalog Interpreter) -- this block still owns
 // the helpers that feed it (mappingKey, autoInventoryMatch base, liveVariants, inventoryChoices,
 // connectionReportMarkup, orderNeed base).
 const priorDraw=C.draw.bind(C);
 C.draw=function(){if(this.tab==='mapping')return this.productMapping();return priorDraw()};
 const oldOrderNeed=C.orderNeed.bind(C);
 C.orderNeed=function(line){
   const base=oldOrderNeed(line);if(base.inv)return base;
   const sf=window.SF,key=String(line.variantId||line.sku||`${line.productId||''}:${line.variant||''}`).trim(),mappedId=sf.state.websiteProductMappings?.[key],inv=(sf.state.inventoryItems||[]).find(x=>String(x.id)===String(mappedId));
   if(!inv)return base;const qty=Number(line.quantity||1),onHand=Number(inv.quantity??inv.currentOnHand??0);return{inv,onHand,needsProduction:onHand<qty};
 };
 const priorTest=C.testConnection.bind(C);
 C.testConnection=async function(){const r=await priorTest();return r};
})();

/* StudioFlow 11.4.6 · Smart Squarespace Catalog Interpreter */
(function(){
 const C=window.SFCommerceHub;if(!C)return;
 const text=v=>String(v??'').trim();
 const norm=v=>text(v).toLowerCase().replace(/[×]/g,'x').replace(/[^a-z0-9.]+/g,' ').replace(/\s+/g,' ').trim();
 const sizeNorm=v=>text(v).toLowerCase().replace(/[×]/g,'x').replace(/\s+/g,'').replace(/inches|inch|in\.?/g,'').replace(/[^0-9x.]/g,'');
 const aliases=[
   [/art\s*card|greeting\s*card|card\b/i,'Art Card'],
   [/metallic.*luster|metallic.*paper/i,'Metallic Luster'],
   [/standard.*luster|luster.*paper|lustre.*paper|photo\s*paper/i,'Luster Paper'],
   [/canvas/i,'Canvas'],
   [/metal\b|aluminum|aluminium/i,'Metal'],
   [/framed|frame\b/i,'Framed Print'],
   [/paper\b|print\b/i,'Paper Print']
 ];
 C.deepPairs=function(obj){
   const pairs=[];const seen=new Set();
   const walk=(v,key='',depth=0)=>{if(depth>5||v==null)return;if(typeof v==='object'){if(seen.has(v))return;seen.add(v);if(Array.isArray(v)){v.forEach(x=>walk(x,key,depth+1));return;}for(const [k,x] of Object.entries(v)){if(['value','optionValue','selectedValue','name','label','title'].includes(k)&&typeof x!=='object')pairs.push([key||k,text(x)]);walk(x,k,depth+1)}}else if(key&&text(v))pairs.push([key,text(v)])};
   walk(obj);return pairs.filter(([,v])=>v);
 };
 C.interpretVariant=function(v){
   const sf=window.SF,raw=v.raw||{},pairs=this.deepPairs(raw),all=[v.variant,v.title,v.sku,...pairs.flat()].filter(Boolean).join(' | ');
   const byKey=re=>pairs.find(([k])=>re.test(k))?.[1]||'';
   const artwork=(sf.artworkCatalog?.()||sf.state.artworks||[]).find(a=>norm(a.title||a.name)===norm(v.title))||null;
   let size=byKey(/size|dimension/i);if(!size){const m=all.match(/\b\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?\b/i);size=m?m[0].replace(/×/g,' x '):'';}
   let product=byKey(/material|medium|product.?type|presentation|format/i);if(!product){const hit=aliases.find(([re])=>re.test(all));product=hit?hit[1]:'';}else{const hit=aliases.find(([re])=>re.test(product));product=hit?hit[1]:product;}
   const finish=byKey(/finish|paper/i)||(/metallic/i.test(all)?'Metallic':/luster|lustre/i.test(all)?'Standard Luster':'');
   const mat=byKey(/mat|mount/i)||((all.match(/(bright white|warm white|off white|charcoal|black|white)\s+mat/i)||[])[0]||'');
   const frame=byKey(/frame|moulding|molding/i)||((all.match(/(black|white|walnut|oak|charcoal|grey|gray)\s+frame/i)||[])[0]||'');
   const template=(sf.state.inventoryProductTemplates||[]).find(t=>{
     const hay=norm([t.name,t.category,t.presentation,t.size].filter(Boolean).join(' '));
     const productOK=!product||hay.includes(norm(product))||norm(product).includes(hay);
     const sizeOK=!size||!t.size||sizeNorm(t.size)===sizeNorm(size);
     return productOK&&sizeOK;
   })||(sf.state.productTemplates||[]).find(t=>{
     const hay=norm([t.name,t.category].filter(Boolean).join(' '));return !product||hay.includes(norm(product))||norm(product).includes(hay)
   })||null;
   const inventory=(sf.state.inventoryItems||[]).find(i=>{
     const artOK=!artwork||String(i.artworkId||'')===String(artwork.artworkId||artwork.id)||norm(i.artworkTitle||i.name).startsWith(norm(artwork.title||artwork.name));
     const tplOK=!template||String(i.templateId||i.productTemplateId||'')===String(template.id)||norm([i.productName,i.product,i.presentation].join(' ')).includes(norm(template.name||template.category));
     const sizeOK=!size||!i.size||sizeNorm(i.size)===sizeNorm(size);
     return artOK&&tplOK&&sizeOK;
   })||null;
   const recognized=!!artwork&&!!product;
   return {artwork,product,size,finish,mat,frame,template,inventory,recognized,status:inventory?'Inventory Ready':recognized?'Production Ready':'Needs Review'};
 };
 const originalAuto=C.autoInventoryMatch.bind(C);
 C.autoInventoryMatch=function(v){return this.interpretVariant(v).inventory||originalAuto(v)};
 C.mappingStats=function(){const vars=this.liveVariants();let interpreted=0,inventory=0;for(const v of vars){const x=this.interpretVariant(v);if(x.recognized)interpreted++;if(x.inventory)inventory++;}return{products:(window.SF.state.websiteProducts||[]).length,variants:vars.length,matched:interpreted,inventory,unmatched:Math.max(0,vars.length-interpreted)}};
 C.productMapping=function(){
   this.ensure();const sf=window.SF,vars=this.liveVariants(),stats=this.mappingStats();
   const rows=vars.map(v=>({v,x:this.interpretVariant(v)}));
   const exceptions=rows.filter(r=>!r.x.recognized),ready=rows.length-exceptions.length;
   sf.$('commerceBody').innerHTML=`<div class="commerce-kpis"><div><b>${stats.products}</b><span>Website Products</span></div><div><b>${stats.variants}</b><span>Website Variants</span></div><div><b>${ready}</b><span>Interpreted</span></div><div><b>${exceptions.length}</b><span>Need Review</span></div></div><section class="card"><div class="commerce-toolbar"><div><div class="section-kicker">SMART CATALOG INTERPRETER</div><h3>Squarespace Product Definitions</h3><p class="muted">StudioFlow now separates the artwork from its presentation and reads product type, size, finish, mat and frame automatically. Manual inventory mapping is no longer required for normal website products.</p></div><div class="row-actions"><button class="button secondary" id="refreshMappingProducts">Sync Products</button><button class="button primary" id="saveCatalogDefinitions">Save Definitions</button></div></div><div class="notice"><b>${ready} of ${rows.length}</b> variants are understood. Only genuine exceptions appear as <b>Needs Review</b>.</div>${rows.length?`<div class="table-wrap"><table><thead><tr><th>Artwork</th><th>Presentation</th><th>Size / Options</th><th>Website SKU</th><th>Status</th></tr></thead><tbody>${rows.map(({v,x})=>`<tr><td><b>${sf.esc(x.artwork?.title||v.title)}</b>${x.artwork?'':'<small class="danger-text">Artwork title not found</small>'}</td><td><b>${sf.esc(x.product||'Unknown')}</b>${x.finish?`<small>${sf.esc(x.finish)}</small>`:''}</td><td>${sf.esc(x.size||v.variant||'Standard')}${x.mat?`<small>${sf.esc(x.mat)}</small>`:''}${x.frame?`<small>${sf.esc(x.frame)}</small>`:''}</td><td><code>${sf.esc(v.sku||'No SKU')}</code></td><td><i class="stock-pill ${x.recognized?'success':'gold'}">${sf.esc(x.status)}</i></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state roomy">No live Squarespace products have been synced yet.</div>'}</section>`;
   sf.$('refreshMappingProducts').onclick=async()=>{const r=await C.syncProducts();if(r?.ok)C.productMapping()};
   sf.$('saveCatalogDefinitions').onclick=async()=>{sf.state.websiteCatalogDefinitions={};rows.forEach(({v,x})=>{sf.state.websiteCatalogDefinitions[C.mappingKey(v)]={artworkId:x.artwork?.artworkId||x.artwork?.id||'',artworkTitle:x.artwork?.title||v.title,product:x.product,size:x.size,finish:x.finish,mat:x.mat,frame:x.frame,templateId:x.template?.id||'',inventoryId:x.inventory?.id||'',recognized:x.recognized,updatedAt:new Date().toISOString()}});sf.logActivity(`Interpreted ${ready} Squarespace variants; ${exceptions.length} need review`);await sf.persist();C.productMapping();alert(`Catalog definitions saved. ${ready} variants interpreted; ${exceptions.length} need review.`)};
 };
 const previousNeed=C.orderNeed.bind(C);
 C.orderNeed=function(line){
   const base=previousNeed(line);if(base.inv)return base;
   const candidate={productId:line.productId||'',variantId:line.variantId||'',title:line.productName||line.title||line.artworkTitle||'Website product',variant:line.variant||line.variantTitle||line.options||'',sku:line.sku||'',raw:line};
   const x=this.interpretVariant(candidate),qty=Number(line.quantity||1);if(x.inventory){const onHand=Number(x.inventory.quantity??x.inventory.currentOnHand??0);return{inv:x.inventory,onHand,needsProduction:onHand<qty,definition:x}}
   if(x.recognized)return{inv:null,onHand:0,needsProduction:true,definition:x};return base;
 };
})();

/* StudioFlow 11.4.7 · Business Automation Engine and connected Order Workspace */
(function(){
 const C=window.SFCommerceHub;if(!C)return;
 const esc=v=>window.SF.esc(v??'');
 const now=()=>new Date().toISOString();
 const addHistory=(o,text)=>{o.history=Array.isArray(o.history)?o.history:[];o.history.push({id:window.SF.makeId('HIST'),text,at:now()});};
 const statusRank={'New Website Order':0,'Received':0,'Reserved':1,'Printing':2,'Drying':3,'Framing':4,'Packaging':5,'Ready to Ship':6,'Ready for Pickup':6,'Completed':7,'Shipped':8,'Fulfilled':9,'Cancelled':10};
 const stageFor=o=>{
   const tasks=(window.SF.state.productionQueue||[]).filter(t=>t.orderId===o.id&&!['Cancelled'].includes(t.status));
   if(o.status==='Fulfilled')return 'Completed';
   if(o.fulfilledAt||o.shippedAt)return 'Shipped';
   if(!tasks.length)return o.isNew?'New Website Order':(o.status||'Received');
   return tasks.sort((a,b)=>(statusRank[b.status]??0)-(statusRank[a.status]??0))[0].status;
 };
 C.ensure1147=function(){
   this.ensure();const s=window.SF.state;
   s.orderNotes=Array.isArray(s.orderNotes)?s.orderNotes:[];
   s.analyticsEvents=Array.isArray(s.analyticsEvents)?s.analyticsEvents:[];
   for(const o of s.websiteOrders){
     o.priority=o.priority||'Normal';o.history=Array.isArray(o.history)?o.history:[];
     o.notes=o.notes||{production:'',customer:'',internal:'',qc:[]};
     o.payment=o.payment||{deposit:0,balance:Number(o.total||0),tax:0,shipping:0,refunds:0,history:[]};
     o.dueDate=o.dueDate||'';
   }
 };
 C.classifyProduct=function(line){
   const hay=`${line.productName||''} ${line.variant||''} ${line.sku||''}`.toLowerCase();
   if(/wedding|portrait|session|photography|event coverage|real estate|headshot|service/.test(hay))return 'Service';
   if(/download|digital file|digital/.test(hay))return 'Digital';
   if(/print|canvas|metal|frame|mat|card|artwork|luster|lustre/.test(hay))return 'Fine Art';
   return 'Unknown';
 };
 C.routeOrder=function(order){
   const sf=window.SF,lines=sf.state.websiteOrderItems.filter(i=>i.orderId===order.id);
   const classes=lines.map(x=>this.classifyProduct(x));
   if(classes.length&&classes.every(x=>x==='Service')){
     order.orderType='Service';order.status=order.status==='Pending'?'Booked':order.status;order.isNew=false;
     let customer=sf.state.customers.find(c=>String(c.email||'').toLowerCase()===String(order.email||'').toLowerCase());
     if(!customer){customer={id:sf.makeId('CUS'),name:order.customerName||'Website customer',email:order.email||'',createdAt:now()};sf.state.customers.push(customer)}
     for(const line of lines){if(!sf.state.serviceJobs.some(j=>j.orderItemId===line.id))sf.state.serviceJobs.push({id:sf.makeId('JOB'),orderId:order.id,orderItemId:line.id,customerId:customer.id,customerName:customer.name,type:line.productName||'Photography Service',revenue:Number(line.unitPrice||0)*Number(line.quantity||1),amountPaid:Number(order.total||0),status:'Booked',date:order.bookingDate||order.dueDate||'',createdAt:now()})}
     addHistory(order,'Service order routed to Business and Calendar');
   }else{
     order.orderType=classes.includes('Fine Art')?'Fine Art':'Unknown';
     this.createProductionTasks(order);
     for(const t of sf.state.productionQueue.filter(x=>x.orderId===order.id)){
       const line=lines.find(i=>i.id===t.orderItemId),def=line?this.orderNeed(line).definition:null;
       Object.assign(t,{artworkTitle:def?.artwork?.title||line?.productName||t.artworkTitle,productType:def?.product||t.product,size:def?.size||'',finish:def?.finish||'',mat:def?.mat||'',frame:def?.frame||'',dueDate:order.dueDate||'',priority:order.priority||'Normal',status:t.status||'Received'});
     }
     addHistory(order,'Artwork order routed to Production');
   }
   order.routedAt=now();
 };
 C.orderBuckets=function(){
   this.ensure1147();const orders=window.SF.state.websiteOrders||[];
   return {
     new:orders.filter(o=>o.isNew&&!['Fulfilled','Cancelled'].includes(o.status)),
     progress:orders.filter(o=>!o.isNew&&!['Fulfilled','Cancelled'].includes(o.status)&&!o.waitingOnCustomer),
     waiting:orders.filter(o=>o.waitingOnCustomer&&!['Fulfilled','Cancelled'].includes(o.status)),
     completed:orders.filter(o=>o.status==='Fulfilled'||o.status==='Completed'),
     archived:orders.filter(o=>o.archived)
   };
 };
 C.orders1147=function(){
   this.ensure1147();const sf=window.SF,b=this.orderBuckets(),all=[...b.new,...b.progress,...b.waiting];
   const row=o=>`<div class="order-list-row-wrap"><button class="order-list-row" data-open-order="${o.id}"><span><b>${esc(o.orderNumber||o.id)}</b><small>${new Date(o.orderDate||o.createdAt).toLocaleDateString()}</small></span><span>${esc(o.customerName||'Website customer')}</span><span>${esc(stageFor(o))}</span><span>${esc(o.priority||'Normal')}</span><span><b>${C.money(o.total)}</b></span></button><button class="mini-edit danger" data-quick-delete-order="${o.id}" title="Delete this order">Delete</button></div>`;
   // The Connection Report (Squarespace status, sync, and the conditional "needs review" link) lost
   // its home when the separate Website Orders tab was removed below -- nothing in the UI could
   // reach it anymore even though it still worked underneath. Surfacing it here since Orders is the
   // tab that's actually reachable; this is a stand-in home until the broader Website Dashboard
   // reorganization gives it a more permanent, purpose-built place.
   const connectionReport=this.connectionReportMarkup?this.connectionReportMarkup():'';
   sf.$('commerceBody').innerHTML=`<div class="orders-layout"><aside class="order-folders"><h3>Sales & Orders</h3>${[['new','New Website Orders'],['progress','In Progress'],['waiting','Waiting on Customer'],['completed','Completed'],['archived','Archived']].map(([k,l])=>`<button data-order-filter="${k}" class="${C.orderFilter===k?'active':''}"><span>${l}</span><b>${b[k].length}</b></button>`).join('')}</aside><section class="card order-inbox">${connectionReport}<div class="commerce-toolbar"><div><div class="section-kicker">BUSINESS AUTOMATION ENGINE</div><h3>${C.orderFilter?({new:'New Website Orders',progress:'In Progress',waiting:'Waiting on Customer',completed:'Completed',archived:'Archived'}[C.orderFilter]):'Active Orders'}</h3><p class="muted">Every order opens a connected workspace for production, fulfillment, customer, payment and history.</p></div><button class="button primary" id="routeUnrouted">Route New Orders</button></div><div class="order-list-head"><span>Order</span><span>Customer</span><span>Stage</span><span>Priority</span><span>Total</span></div><div class="order-list">${(C.orderFilter?b[C.orderFilter]:all).map(row).join('')||'<div class="empty-state roomy">No orders in this folder.</div>'}</div></section></div>`;
   document.querySelectorAll('[data-order-filter]').forEach(x=>x.onclick=()=>{C.orderFilter=x.dataset.orderFilter;C.orders1147()});
   document.querySelectorAll('[data-open-order]').forEach(x=>x.onclick=()=>C.openOrderWorkspace(x.dataset.openOrder));
   document.querySelectorAll('[data-quick-delete-order]').forEach(x=>x.onclick=async e=>{e.stopPropagation();if(window.SFProductionWorkspace)await window.SFProductionWorkspace.deleteOrder(x.dataset.quickDeleteOrder)});
   sf.$('routeUnrouted').onclick=async()=>{for(const o of b.new)C.routeOrder(o);sf.logActivity(`Automatically routed ${b.new.length} new website orders`);await sf.persist();C.orders1147();C.refreshOrderAttention()};
   const mapBtn=sf.$('openProductMapping');if(mapBtn)mapBtn.onclick=()=>{C.tab='website';C.draw()};
 };
 C.openOrderWorkspace=function(id){
   // Directly delegates to the Production Workspace, which has the real fulfillment flow
   // (Existing Inventory vs. Produce New, per-line recipes, Delete/Cancel Order). This used to be
   // its own separate, older order-detail view defined right here -- now removed in favour of one
   // single, unambiguous order-detail system rather than depending on a separate file's load-time
   // override to win.
   if(window.SFProductionWorkspace)return window.SFProductionWorkspace.render(id);
 };
 if(!C.tabs.some(x=>x[0]==='orders'))C.tabs.unshift(['orders','Orders']);
 const previousDraw=C.draw.bind(C);C.draw=function(){if(this.tab==='orders')return this.orders1147();return previousDraw()};
 const previousRender=C.render.bind(C);C.render=function(){if(!['orders','website','production','fulfillment'].includes(this.tab))this.tab='orders';previousRender();};
 const previousCreate=C.createProductionTasks.bind(C);C.createProductionTasks=function(order){previousCreate(order);if(!(order.history||[]).some(h=>h.text==='Inventory Reserved'))addHistory(order,'Inventory Reserved');};
})();

/* StudioFlow 11.4.8 · orders-only workspace refinement */
(function(){const C=window.SFCommerceHub;if(!C)return;C.tabs=C.tabs.filter(x=>x[0]!=='website');C.tab='orders';})();

/* StudioFlow 3.9.0 g53 · Editable expenses + remembered service colour/business */
(function(){
 const C=window.SFCommerceHub;if(!C)return;

 // ---- Grouped expense editing -------------------------------------------------------------
 // The original openExpenseSession only ever creates. Rather than duplicate its (large) modal,
 // we run it, then repopulate the fields from an existing group and swap the submit handler.
 const origSession=C.openExpenseSession;
 C.openExpenseSession=function(id=''){
  const sf=window.SF;
  origSession.call(this);
  if(!id)return;
  const g=(sf.state.expenseSessions||[]).find(s=>s.id===id);
  if(!g)return;
  const form=sf.$('expenseSessionForm'),host=sf.$('expenseLines');
  const heading=form.querySelector('h2');if(heading)heading.textContent='Edit Project Expense Group';
  const submit=form.querySelector('button.primary');if(submit)submit.textContent='Save Changes';
  sf.$('expenseAssignment').value=g.assignmentType||'Service';
  sf.$('expenseProject').value=g.name||'';
  sf.$('expenseDate').value=g.date||'';
  sf.$('expenseJobLink').value=g.serviceJobId||'';
  sf.$('expenseNotes').value=g.notes||'';
  // Reuse one of the blank rows the original built as a template, so the markup stays in one place.
  const proto=host.querySelector('.expense-line');
  if(proto){
   const wire=row=>{
    row.querySelector('[data-attach-receipt]').onclick=async()=>{
     const file=await sf.api.openImage();if(!file)return;
     row.querySelector('[data-exp-receipt]').value=file.data;
     row.querySelector('.expense-receipt-preview').innerHTML=`<img src="${file.data}" class="expense-receipt-thumb">`;
     row.querySelector('[data-attach-receipt]').textContent='Change Photo';
    };
    row.querySelector('button:last-child').onclick=()=>row.remove();
   };
   const blank=proto.cloneNode(true);
   host.innerHTML='';
   (g.items||[]).forEach(it=>{
    const row=blank.cloneNode(true);
    row.querySelector('[data-exp-category]').value=it.category||'Other';
    row.querySelector('[data-exp-desc]').value=it.description||'';
    row.querySelector('[data-exp-amount]').value=Number(it.amount||0);
    row.querySelector('[data-exp-receipt]').value=it.receiptImage||'';
    if(it.receiptImage){
     row.querySelector('.expense-receipt-preview').innerHTML=`<img src="${it.receiptImage}" class="expense-receipt-thumb">`;
     row.querySelector('[data-attach-receipt]').textContent='Change Photo';
    }
    wire(row);
    host.appendChild(row);
   });
   if(!host.querySelector('.expense-line')){const row=blank.cloneNode(true);wire(row);host.appendChild(row)}
  }
  form.onsubmit=async e=>{
   e.preventDefault();
   const jobs=sf.state.serviceJobs||[];
   const oldTotal=(g.items||[]).reduce((n,i)=>n+Number(i.amount||0),0);
   const oldJob=g.serviceJobId?jobs.find(j=>j.id===g.serviceJobId):null;
   const jobId=sf.$('expenseJobLink').value,job=jobId?jobs.find(j=>j.id===jobId):null;
   const items=[...host.querySelectorAll('.expense-line')].map(r=>({
    category:r.querySelector('[data-exp-category]').value,
    description:r.querySelector('[data-exp-desc]').value.trim(),
    amount:Number(r.querySelector('[data-exp-amount]').value)||0,
    receiptImage:r.querySelector('[data-exp-receipt]').value||''
   })).filter(x=>x.amount>0);
   if(!items.length&&!confirm('Every line is $0, so this group will end up empty. Save anyway?'))return;
   // Roll back whatever this group previously contributed before applying the new figures.
   if(oldJob)oldJob.expenses=Math.max(0,Number(oldJob.expenses||0)-oldTotal);
   sf.state.businessTransactions=sf.state.businessTransactions.filter(t=>t.expenseSessionId!==g.id);
   g.assignmentType=sf.$('expenseAssignment').value;
   g.name=sf.$('expenseProject').value.trim();
   g.date=sf.$('expenseDate').value;
   g.serviceJobId=jobId||'';
   g.notes=sf.$('expenseNotes').value.trim();
   g.items=items;
   g.updatedAt=new Date().toISOString();
   items.forEach(i=>sf.state.businessTransactions.push({
    id:sf.makeId('BTX'),type:i.category,date:g.date,payee:i.description,amount:i.amount,
    projectType:g.assignmentType,projectName:g.name,expenseSessionId:g.id,serviceJobId:jobId||'',
    receiptImage:i.receiptImage,status:'Recorded',direction:'out',createdAt:g.createdAt||g.updatedAt
   }));
   if(job)job.expenses=Number(job.expenses||0)+items.reduce((n,i)=>n+i.amount,0);
   sf.logActivity(`Edited expense group: ${g.name} (${items.length} line${items.length===1?'':'s'})`);
   await sf.persist();
   sf.closeModal();
   this.draw?this.draw():C.expenses();
  };
 };

 // ---- Individual expense editing ----------------------------------------------------------
 C.openExpenseEdit=function(txId){
  const sf=window.SF;
  const rec=(sf.state.businessTransactions||[]).find(t=>t.id===txId);
  if(!rec)return;
  this.openBusinessTransaction(rec.type||'Expense');
  const form=sf.$('businessTxForm');
  const heading=form.querySelector('h2');if(heading)heading.textContent='Edit Expense';
  const submit=form.querySelector('button.primary');if(submit)submit.textContent='Save Changes';
  sf.$('btType').value=rec.type||'Expense';
  sf.$('btDate').value=rec.date||'';
  sf.$('btParty').value=rec.payee||'';
  sf.$('btProjectType').value=rec.projectType||'General Business';
  sf.$('btProjectName').value=rec.projectName||'';
  sf.$('btAmount').value=Number(rec.amount||0);
  sf.$('btStatus').value=rec.status||'Recorded';
  sf.$('btNotes').value=rec.notes||'';
  sf.$('btProjectType').dispatchEvent(new Event('change'));
  if(rec.serviceJobId)sf.$('btJobLink').value=rec.serviceJobId;
  form.onsubmit=async e=>{
   e.preventDefault();
   const before=Number(rec.amount||0);
   const type=sf.$('btType').value;
   rec.type=type;
   rec.date=sf.$('btDate').value;
   rec.payee=sf.$('btParty').value.trim();
   rec.projectType=sf.$('btProjectType').value;
   rec.projectName=sf.$('btProjectName').value.trim();
   rec.amount=Number(sf.$('btAmount').value)||0;
   rec.status=sf.$('btStatus').value;
   rec.notes=sf.$('btNotes').value.trim();
   rec.direction=['Refund','Expense','Equipment','Travel','Accommodation','Meals','Parking','Booth Fee','Software','Insurance','Material Purchase'].includes(type)?'out':'in';
   rec.updatedAt=new Date().toISOString();
   // Keep a linked service job's running totals honest when the amount changes.
   const job=rec.serviceJobId?(sf.state.serviceJobs||[]).find(j=>j.id===rec.serviceJobId):null;
   if(job){
    const delta=rec.amount-before;
    if(rec.direction==='out')job.expenses=Math.max(0,Number(job.expenses||0)+delta);
    else if(type==='Deposit')job.amountPaid=Math.max(0,Number(job.amountPaid||0)+delta);
   }
   sf.logActivity(`Edited ${String(rec.type).toLowerCase()} ${C.money(rec.amount)}`);
   await sf.persist();
   sf.closeModal();
   C.expenses();
  };
 };

 // ---- Edit buttons on both expense lists ---------------------------------------------------
 const origExpenses=C.expenses;
 C.expenses=function(){
  origExpenses.call(this);
  const addEdit=(btn,handler)=>{
   const b=document.createElement('button');
   b.type='button';b.className='button secondary compact';b.textContent='Edit';
   b.onclick=handler;
   btn.parentNode.insertBefore(b,btn);
   btn.parentNode.insertBefore(document.createTextNode(' '),btn);
  };
  document.querySelectorAll('[data-delete-expense-group]').forEach(b=>{
   const id=b.dataset.deleteExpenseGroup;
   addEdit(b,()=>C.openExpenseSession(id));
  });
  /* ==========================================================================================
     g157 — A RECEIPT PHOTO CAN BE ADDED TO AN EXPENSE, AT ANY TIME.
     ==========================================================================================
     Kirk: "i was more concerned with adding a photo of a receipt to be saved for end of year and
     connecting it to that expense."

     The Year-End Report has had a RECEIPT APPENDIX since g103 — receiptsForYear() gathers every
     outbound transaction with a receiptImage and prints the photographs behind the summary, which
     is exactly what an accountant asks for. But the "\uff0b Record" form had NO receipt field at all,
     and an expense once saved could only be DELETED. So the appendix could only ever show receipts
     that arrived through a material purchase; a receipt for anything else had nowhere to live, and
     a slip found later meant deleting the expense and typing it again.

     Now the form takes a photo, and every row takes one afterwards. The thumbnail on the row is
     the point: at year end he can see at a glance which expenses still have no evidence behind
     them, rather than discovering it inside the printed report.
     ========================================================================================== */
  document.querySelectorAll('[data-tx-receipt]').forEach(im=>im.onclick=()=>{
    const sf=window.SF, src=im.getAttribute('src');
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop" id="txRcBack"><div class="modal-card receipt-viewer"><div class="row-actions" style="justify-content:flex-end"><button class="button secondary" id="txRcClose">Close</button></div><img src="${src}" alt="Receipt"></div></div>`;
    sf.$('txRcClose').onclick=()=>sf.closeModal();
    const back=sf.$('txRcBack'); if(back)back.onclick=e=>{if(e.target===back)sf.closeModal()};
  });
  document.querySelectorAll('[data-tx-addreceipt]').forEach(b=>b.onclick=async()=>{
    const sf=window.SF;
    const tx=(sf.state.businessTransactions||[]).find(t=>String(t.id)===String(b.dataset.txAddreceipt));
    if(!tx)return;
    const file=await sf.api.openImage();
    if(!file||!file.data)return;
    tx.receiptImage=file.data;
    tx.updatedAt=new Date().toISOString();
    /* A material purchase carries its OWN copy of the receipt, and the two are shown in different
       places — so the photo is written back to the purchase as well, or Materials would still say
       "none" for a slip he has just filed against the expense. */
    if(tx.materialPurchaseId){
      const buy=(sf.state.materialPurchases||[]).find(x=>String(x.id)===String(tx.materialPurchaseId));
      if(buy)buy.receiptImage=file.data;
    }
    await sf.persist();
    this.expenses();
  });

  document.querySelectorAll('[data-delete-expense]').forEach(b=>{
   const id=b.dataset.deleteExpense;
   addEdit(b,()=>C.openExpenseEdit(id));
  });
 };

 // ---- Remember calendar colour + business name for service jobs ----------------------------
 // A repeat client should keep the same colour on the calendar without Kirk re-picking it, and a
 // brand new job should start from the colour he used last rather than the built-in blue.
 const origService=C.openService;
 C.openService=function(id=''){
  const sf=window.SF;
  origService.call(this,id);
  sf.state.serviceDefaults=sf.state.serviceDefaults||{};
  const D=sf.state.serviceDefaults;
  D.byCustomer=D.byCustomer||{};
  D.byName=D.byName||{};
  const form=sf.$('serviceForm');if(!form)return;
  const colour=sf.$('jobColour'),existing=sf.$('jobExisting'),company=sf.$('jobCompany'),name=sf.$('jobName');
  const remembered=()=>{
   const cid=existing&&existing.value;
   if(cid&&D.byCustomer[cid])return D.byCustomer[cid];
   const label=String((company&&company.value)||(name&&name.value)||'').trim().toLowerCase();
   if(label&&D.byName[label])return D.byName[label];
   return '';
  };
  if(!id&&colour){
   const c=remembered()||D.lastColour||'';
   if(c)colour.value=c;
   if(company&&!company.value&&D.lastBusinessName)company.placeholder=D.lastBusinessName;
  }
  // Switching to a client we've seen before pulls their colour back in, unless it's been touched.
  let colourTouched=false;
  if(colour)colour.addEventListener('input',()=>{colourTouched=true});
  const syncColour=()=>{if(colourTouched||!colour)return;const c=remembered();if(c)colour.value=c};
  if(existing)existing.addEventListener('change',syncColour);
  if(company)company.addEventListener('blur',syncColour);
  if(name)name.addEventListener('blur',syncColour);
  // Runs alongside the original submit handler, so we capture the values as they are saved.
  form.addEventListener('submit',()=>{
   const c=colour&&colour.value;
   if(!c)return;
   D.lastColour=c;
   const cid=existing&&existing.value;
   if(cid)D.byCustomer[cid]=c;
   const label=String((company&&company.value)||(name&&name.value)||'').trim();
   if(label){D.byName[label.toLowerCase()]=c;D.lastBusinessName=label;}
  });
 };
})();

/* ============================================================================================
   g153 — EVERY EXPENSE TIED TO A JOB ACTUALLY COUNTS AGAINST IT.
   ============================================================================================
   Kirk: "If I create that job can I then add shipping as an expense tied to that work?… I would
   create a service and call it print work for Don then I can tie every expense and revenue I
   collect to that?"

   He COULD tie it. It did not COUNT. Two mechanisms existed and only one reached the profit:
     j.expenses                          a single number typed on the job — the only thing
                                         "Estimated Profit" ever subtracted
     businessTransactions with `jobId`   the Expenses tab already offers "Link to Existing Service
                                         Job", and that link fed nothing at all
   So recording postage the obvious way — as an expense, against the job — left the job's profit
   unchanged and overstated. Recording it the other way, typed into the job's Expenses box, kept it
   out of his expense records entirely, which is where his accountant needs it. Both routes were
   wrong in different directions, and neither said so.

   NOTE THIS IS APPENDED. commerce-hub.js defines services() twice and a later Object.assign wins;
   patching the first copy would have changed nothing on screen. Same family as the g149 font
   attribute — check what actually REACHES the page before assuming an edit landed.
   ============================================================================================ */
(function(){
  const C = window.SFCommerceHub; if (!C) return;

  /* The same test the Expenses tab itself uses, so the two can never disagree about what an
     expense is. Copied deliberately rather than approximated with a regex. */
  const EXPENSE_TYPES = ['Expense','Material Purchase','Equipment','Travel','Accommodation','Meals',
    'Parking','Booth Fee','Software','Insurance'];
  C.isExpenseTx = tx => !!tx && (tx.direction === 'out' || EXPENSE_TYPES.includes(tx.type));

  C.jobCosts = function(job){
    const s = window.SF.state, id = job && job.id;
    const typed = Number((job && job.expenses) || 0);
    const mileage = Number((job && job.mileageExpense) || 0);
    /* Only EXPENSES. A payment recorded against the job is revenue and must never be subtracted. */
    const linked = id ? (s.businessTransactions || []).filter(t =>
      String(t.jobId || '') === String(id) && C.isExpenseTx(t)) : [];
    const linkedTotal = linked.reduce((n, t) => n + (Number(t.amount) || 0), 0);
    /* printCostLog entries were ADDED to `typed` when the print run completed (g152), so they are
       shown for provenance and NOT added again — counting them twice is the obvious way to get
       this wrong. */
    const printed = Array.isArray(job && job.printCostLog) ? job.printCostLog : [];
    return { typed, mileage, linked, linkedTotal, printed,
      total: Math.round((typed + mileage + linkedTotal) * 100) / 100 };
  };
  C.jobProfit = function(job){ return Number((job && job.revenue) || 0) - C.jobCosts(job).total; };

  /* The job editor now shows what the total is MADE OF. An opaque number is what let a linked
     expense sit there for months looking as though it had been counted. */
  const openService = C.openService;
  C.openService = function(id){
    openService.call(this, id);
    try {
      const sf = window.SF, job = (sf.state.serviceJobs || []).find(x => x.id === id);
      if (!job || !id) return;
      const box = sf.$('jobExpenses'); if (!box) return;
      const c = C.jobCosts(job);
      const money = v => C.money ? C.money(v) : '$' + (Number(v) || 0).toFixed(2);
      const host = document.createElement('div');
      host.className = 'help';
      host.id = 'jobCostBreakdown';
      const rows = [];
      if (c.typed) rows.push(`Typed above: <b>${money(c.typed)}</b>`);
      c.printed.forEach(p => rows.push(`&nbsp;&nbsp;\u2937 includes ${sf.esc(p.label)}: ${money(p.amount)}`));
      if (c.mileage) rows.push(`Mileage: <b>${money(c.mileage)}</b>`);
      c.linked.forEach(t => rows.push(
        `${sf.esc(t.type || 'Expense')}${t.description ? ' \u2014 ' + sf.esc(t.description) : ''}
         ${t.date ? `<span class="muted">(${sf.esc(String(t.date).slice(0,10))})</span>` : ''}: <b>${money(t.amount)}</b>`));
      host.innerHTML = rows.length
        ? `<b>Costs against this job: ${money(c.total)}</b><br>${rows.join('<br>')}
           <br><span class="muted">Revenue ${money(job.revenue)} \u2212 costs ${money(c.total)} = <b>${money(C.jobProfit(job))}</b>.</span>
           <br><span class="muted">To add postage or anything else, use Expenses \u2192 \uff0b Record, set the project type to
           Service Job and link it here. It counts against this job and stays in your expense records \u2014
           typing it in the box above does neither.</span>`
        : `<span class="muted">No costs recorded against this job yet. Postage, outsourced printing and
           anything else belongs in Expenses \u2192 \uff0b Record, linked to this job \u2014 it then counts here AND
           stays in your expense records. The box above is a manual figure that does neither.</span>`;
      box.parentNode.parentNode.insertBefore(host, box.parentNode.nextSibling);
    } catch (e) { console.warn('Job cost breakdown could not be added:', e); }
  };
})();
