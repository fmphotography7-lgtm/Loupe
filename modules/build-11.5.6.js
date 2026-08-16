/* StudioFlow 11.5.6 · Service Scheduling & Dashboard Calendar Navigation */
(() => {
 const C=window.SFCommerceHub,D=window.SFDashboard;
 if(!C||!D)return;

 C.allCalendarEvents=function(){
  const sf=window.SF;
  const saved=(sf.state.salesEvents||[]).map(x=>({...x,source:'event'}));
  const services=(sf.state.serviceJobs||[]).filter(x=>x.date).map(x=>({...x,
   name:`${x.type||'Service'} · ${this.customerName(x.customerId,x.customerName||x.company||'Client')}`,
   type:x.type||'Portrait',
   availabilityType:x.availabilityType||({blocking:'fully',passive:'display'}[x.availability]||'fully'),
   source:'service'
  }));
  return [...saved,...services].filter(x=>x.date).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 };

 C.openService=function(id=''){
  const sf=window.SF,j=(sf.state.serviceJobs||[]).find(x=>x.id===id)||{},today=new Date().toISOString().slice(0,10);
  const availability=j.availabilityType||({blocking:'fully',passive:'display'}[j.availability]||'fully');
  sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><form class="modal-card wide calendar-event-form" id="serviceForm">
   <div class="modal-title-row"><div><div class="section-kicker">SERVICE BOOKING</div><h2>${id?'Edit Service Job':'Add Service Job'}</h2></div><span id="jobDurationPreview" class="duration-pill"></span></div>
   ${this.customerWorkflow('job',j.customerId?'existing':'new',j.customerId)}
   <section class="event-form-section"><h3>Schedule</h3><div class="form-grid">
    <label>Service Type<input id="jobType" value="${sf.esc(j.type||'')}" placeholder="Wedding, portrait, real estate..." required></label>
    <label>Start Date<input id="jobDate" type="date" value="${j.date||today}" required></label>
    <label>End Date<input id="jobEndDate" type="date" value="${j.endDate||j.date||today}" required></label>
    <label>Start Time<input id="jobStartTime" type="time" value="${j.startTime||'09:00'}" required></label>
    <label>End Time<input id="jobEndTime" type="time" value="${j.endTime||'10:00'}"></label>
    <label>Availability<select id="jobAvailabilityType"><option value="fully" ${availability==='fully'?'selected':''}>Fully Booked</option><option value="partial" ${availability==='partial'?'selected':''}>Partially Busy</option><option value="display" ${availability==='display'?'selected':''}>Display Only</option><option value="available" ${availability==='available'?'selected':''}>Available</option></select></label>
    <label>Calendar Colour<input id="jobColour" type="color" value="${j.colour||'#3d86c6'}"></label>
    <label>Travel Before (minutes)<input id="jobTravelBefore" type="number" min="0" step="15" value="${Number(j.travelBefore||0)}"></label>
    <label>Travel After (minutes)<input id="jobTravelAfter" type="number" min="0" step="15" value="${Number(j.travelAfter||0)}"></label>
   </div></section>
   <section class="event-form-section"><h3>Venue & Address</h3><div class="form-grid">
    <label>Venue Name<input id="jobVenue" value="${sf.esc(j.venueName||'')}"></label>
    <label>Street Address<input id="jobStreet" value="${sf.esc(j.streetAddress||j.address||'')}"></label>
    <label>City<input id="jobCity" value="${sf.esc(j.city||'')}"></label>
    <label>Province<input id="jobProvince" value="${sf.esc(j.province||'BC')}"></label>
    <label>Postal Code<input id="jobPostal" value="${sf.esc(j.postalCode||'')}"></label>
    <label>Referral Source<input id="jobReferral" value="${sf.esc(j.referralSource||'')}"></label>
   </div><div class="row-actions"><button type="button" class="button secondary" id="jobMaps">Open in Google Maps</button></div></section>
   <section class="event-form-section"><h3>Business Details</h3><div class="form-grid">
    <label>Hours<input id="jobHours" type="number" min="0" step=".25" value="${Number(j.hours||0)}"></label>
    <label>Mileage<input id="jobMileage" type="number" min="0" step=".1" value="${Number(j.mileage||0)}"></label>
    <label>Expenses<input id="jobExpenses" type="number" min="0" step=".01" value="${Number(j.expenses||0)}"></label>
    <label>Revenue<input id="jobRevenue" type="number" min="0" step=".01" value="${Number(j.revenue||0)}"></label>
    <label>Deposit already paid<input id="jobPaid" type="number" min="0" step=".01" value="${Number(j.amountPaid||0)}"></label>
    <label>Status<select id="jobStatus">${['Quote','Inquiry','Booked','Deposit Paid','In Progress','Completed','Paid in Full','Cancelled'].map(x=>`<option ${x===(j.status||'Booked')?'selected':''}>${x}</option>`).join('')}</select></label>
   </div></section>
   <section class="service-payments-box"><div class="commerce-toolbar"><div><h3>Payments</h3><p class="muted">Add final or instalment payments. Balance and Paid in Full update automatically.</p></div><button type="button" class="button secondary" id="jobAddPayment">＋ Add Payment</button></div><div id="jobPaymentRows">${(j.payments||[]).map(p=>`<div class="service-payment-row"><input data-pay-date type="date" value="${p.date||today}"><input data-pay-amount type="number" min="0" step=".01" value="${Number(p.amount||0)}" placeholder="Amount"><input data-pay-note value="${sf.esc(p.note||'')}" placeholder="Final payment, instalment..."><button type="button" class="button danger remove-service-payment">Remove</button></div>`).join('')}</div><div class="service-payment-summary">Paid: <b id="jobPaidTotal">$0.00</b> · Balance: <b id="jobBalance">$0.00</b></div></section>
   <label>Notes<textarea id="jobNotes" rows="4">${sf.esc(j.notes||'')}</textarea></label>
   <div class="row-actions"><button type="button" class="button secondary" id="jobCancel">Cancel</button>${id?'<button type="button" class="button danger" id="jobDelete">Delete Job</button>':''}<button class="button primary">Save Service Job</button></div>
  </form></div>`;
  this.bindCustomerWorkflow('job');
  const address=()=>[sf.$('jobVenue').value,sf.$('jobStreet').value,sf.$('jobCity').value,sf.$('jobProvince').value,sf.$('jobPostal').value].filter(Boolean).join(', ');
  const preview=()=>{const temp={date:sf.$('jobDate').value,endDate:sf.$('jobEndDate').value,startTime:sf.$('jobStartTime').value,endTime:sf.$('jobEndTime').value};sf.$('jobDurationPreview').textContent=this.eventDuration?.(temp)||'Scheduled'};
  ['jobDate','jobEndDate','jobStartTime','jobEndTime'].forEach(k=>sf.$(k).oninput=preview);preview();
  const updatePaymentSummary=()=>{const deposit=Number(sf.$('jobPaid').value)||0,payments=[...document.querySelectorAll('[data-pay-amount]')].reduce((n,i)=>n+(Number(i.value)||0),0),revenue=Number(sf.$('jobRevenue').value)||0,total=deposit+payments;sf.$('jobPaidTotal').textContent=this.money(total);sf.$('jobBalance').textContent=this.money(Math.max(0,revenue-total))};
  const wirePayments=()=>{document.querySelectorAll('.remove-service-payment').forEach(b=>b.onclick=()=>{b.closest('.service-payment-row').remove();updatePaymentSummary()});document.querySelectorAll('[data-pay-amount]').forEach(i=>i.oninput=updatePaymentSummary)};
  sf.$('jobAddPayment').onclick=()=>{sf.$('jobPaymentRows').insertAdjacentHTML('beforeend',`<div class="service-payment-row"><input data-pay-date type="date" value="${today}"><input data-pay-amount type="number" min="0" step=".01" placeholder="Amount"><input data-pay-note placeholder="Final payment, instalment..."><button type="button" class="button danger remove-service-payment">Remove</button></div>`);wirePayments();updatePaymentSummary()};
  sf.$('jobPaid').oninput=updatePaymentSummary;sf.$('jobRevenue').oninput=updatePaymentSummary;wirePayments();updatePaymentSummary();
  sf.$('jobMaps').onclick=()=>{const q=address();if(!q)return alert('Enter a venue or address first.');sf.api.openExternal?.(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`)};
  sf.$('jobCancel').onclick=()=>sf.closeModal();
  if(sf.$('jobDelete'))sf.$('jobDelete').onclick=async()=>{if(confirm('Delete this service job?')){sf.state.serviceJobs=sf.state.serviceJobs.filter(x=>x.id!==id);await sf.persist();sf.closeModal();this.draw()}};
  sf.$('serviceForm').onsubmit=async ev=>{ev.preventDefault();const c=this.resolveCustomer('job'),start=sf.$('jobDate').value,end=sf.$('jobEndDate').value||start,startTime=sf.$('jobStartTime').value,endTime=sf.$('jobEndTime').value;if(end<start)return alert('End date cannot be before the start date.');if(start===end&&endTime&&startTime&&endTime<startTime)return alert('End time cannot be before the start time.');const availabilityType=sf.$('jobAvailabilityType').value,payments=[...document.querySelectorAll('.service-payment-row')].map(r=>({date:r.querySelector('[data-pay-date]').value,amount:Number(r.querySelector('[data-pay-amount]').value)||0,note:r.querySelector('[data-pay-note]').value.trim()})).filter(p=>p.amount>0),paid=(Number(sf.$('jobPaid').value)||0)+payments.reduce((n,p)=>n+p.amount,0),revenue=Number(sf.$('jobRevenue').value)||0;const rec={...j,id:j.id||sf.makeId('JOB'),...c,type:sf.$('jobType').value.trim()||'Photography Service',date:start,endDate:end,startTime,endTime,availabilityType,availability:['display','available'].includes(availabilityType)?'passive':'blocking',colour:sf.$('jobColour').value,travelBefore:Number(sf.$('jobTravelBefore').value)||0,travelAfter:Number(sf.$('jobTravelAfter').value)||0,venueName:sf.$('jobVenue').value.trim(),streetAddress:sf.$('jobStreet').value.trim(),address:sf.$('jobStreet').value.trim(),city:sf.$('jobCity').value.trim(),province:sf.$('jobProvince').value.trim(),postalCode:sf.$('jobPostal').value.trim(),referralSource:sf.$('jobReferral').value.trim(),hours:Number(sf.$('jobHours').value)||0,mileage:Number(sf.$('jobMileage').value)||0,expenses:Number(sf.$('jobExpenses').value)||0,revenue,amountPaid:Number(sf.$('jobPaid').value)||0,payments,status:paid>=revenue&&revenue>0?'Paid in Full':sf.$('jobStatus').value,notes:sf.$('jobNotes').value.trim(),updatedAt:new Date().toISOString(),createdAt:j.createdAt||new Date().toISOString()};const i=sf.state.serviceJobs.findIndex(x=>x.id===rec.id);if(i>=0)sf.state.serviceJobs[i]=rec;else sf.state.serviceJobs.push(rec);sf.logActivity?.(`${id?'Updated':'Recorded'} service booking ${rec.type} for ${rec.date} at ${rec.startTime}`);await sf.persist();sf.closeModal();this.draw()};
 };

 const originalServices=C.services.bind(C);
 C.services=function(){originalServices();const sf=window.SF;document.querySelectorAll('[data-edit-service]').forEach(btn=>{const job=sf.state.serviceJobs.find(x=>x.id===btn.dataset.editService),row=btn.closest('.commerce-row');if(!job||!row)return;const dateCell=row.children[0],serviceCell=row.children[1];if(dateCell)dateCell.innerHTML=`${job.date?new Date(job.date+'T12:00:00').toLocaleDateString():'—'}${job.endDate&&job.endDate!==job.date?` – ${new Date(job.endDate+'T12:00:00').toLocaleDateString()}`:''}${job.startTime?`<small>${C.formatTime?.(job.startTime)||job.startTime}${job.endTime?` – ${C.formatTime?.(job.endTime)||job.endTime}`:''}</small>`:''}`;const location=[job.venueName,job.city].filter(Boolean).join(' · ');if(serviceCell&&location)serviceCell.innerHTML+=`<small>${sf.esc(location)}</small>`})};

 D.dashboardMonth=D.dashboardMonth||new Date(new Date().getFullYear(),new Date().getMonth(),1);
 D.monthCalendar=function(displayMonth,events){const y=displayMonth.getFullYear(),m=displayMonth.getMonth(),first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),lead=first.getDay(),cells=[],today=new Date(),todayKey=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;for(let i=0;i<lead;i++)cells.push('<div class="dash-cal-cell muted-cell"></div>');for(let d=1;d<=days;d++){const key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,dayEvents=events.filter(e=>{const start=e.date||'',end=e.endDate||start;return key>=start&&key<=end});cells.push(`<div class="dash-cal-cell ${key===todayKey?'today':''}"><b>${d}</b>${dayEvents.slice(0,3).map(e=>`<span class="dash-cal-event ${e.availability==='passive'?'passive':'blocking'}" title="${window.SF.esc(e.name)}">${window.SF.esc(e.name)}${e.startTime?` · ${C.formatTime?.(e.startTime)||e.startTime}`:''}</span>`).join('')}${dayEvents.length>3?`<small>+${dayEvents.length-3} more</small>`:''}</div>`)}return `<div class="dash-calendar"><div class="dash-cal-head"><div><h3>${displayMonth.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h3><strong>Today: ${today.toLocaleDateString()}</strong></div><div class="dashboard-month-nav"><button type="button" id="dashCalPrev" title="Previous month">‹</button><button type="button" id="dashCalToday">Today</button><button type="button" id="dashCalNext" title="Next month">›</button></div></div><div class="dash-cal-week">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<span>${x}</span>`).join('')}</div><div class="dash-cal-grid">${cells.join('')}</div></div>`};
 const baseRender=D.render.bind(D);
 D.render=function(){baseRender();const sf=window.SF,host=document.querySelector('.dashboard-full-calendar');if(!host)return;const events=[...(sf.state.salesEvents||[]),...(sf.state.serviceJobs||[]).filter(x=>x.date).map(x=>({name:`${x.type||'Service'} · ${x.customerName||'Client'}`,date:x.date,endDate:x.endDate||x.date,startTime:x.startTime,availability:x.availability||'blocking',colour:x.colour||'#547a9c'}))];host.innerHTML=D.monthCalendar(D.dashboardMonth,events);const move=n=>{D.dashboardMonth=new Date(D.dashboardMonth.getFullYear(),D.dashboardMonth.getMonth()+n,1);D.render()};sf.$('dashCalPrev').onclick=e=>{e.stopPropagation();move(-1)};sf.$('dashCalNext').onclick=e=>{e.stopPropagation();move(1)};sf.$('dashCalToday').onclick=e=>{e.stopPropagation();D.dashboardMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);D.render()};host.onclick=e=>{if(e.target.closest('.dashboard-month-nav'))return;sf.goTo('Sales & Orders');setTimeout(()=>{C.tab='calendar';C.render()},0)}};
})();
