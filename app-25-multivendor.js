// ---------- V4.4 MULTI-VENDOR PURCHASE POLISH ----------

function purchaseInvoiceSpend(){return arr(db.invoices).reduce((s,x)=>s+num(x.total),0)}
function purchaseVendorCount(){return new Set(arr(db.purchases).map(x=>x.vendor).filter(Boolean)).size}


// Filters remain local UI state; reading purchase data never mutates cloud records.
const purchaseSavedFilters={search:'',vendor:'',disposition:'',system:'',from:'',to:''};
const PURCHASE_FILTER_SESSION_KEY='n594zs_purchase_filters_v1';
try{
  const cached=JSON.parse(sessionStorage.getItem(PURCHASE_FILTER_SESSION_KEY)||'null');
  if(cached&&typeof cached==='object')for(const key of Object.keys(purchaseSavedFilters))
    if(typeof cached[key]==='string')purchaseSavedFilters[key]=cached[key];
}catch(e){console.warn('Purchase filter session restore unavailable',e)}
function purchasePersistFilterSession(){
  try{sessionStorage.setItem(PURCHASE_FILTER_SESSION_KEY,JSON.stringify(purchaseSavedFilters))}
  catch(e){console.warn('Purchase filter session save unavailable',e)}
}
function purchaseReadFilters(){
  if(!document.querySelector('#page-purchases .purchase-controls'))return {...purchaseSavedFilters};
  return {
    search:val('purchaseSearch')||'',vendor:val('purchaseVendor')||'',
    disposition:val('purchaseDisposition')||'',system:val('purchaseSystem')||'',
    from:val('purchaseFrom')||'',to:val('purchaseTo')||''
  };
}
function purchaseRememberFilters(){
  Object.assign(purchaseSavedFilters,purchaseReadFilters());
  purchasePersistFilterSession();
  return {...purchaseSavedFilters};
}
function purchaseFilterActive(filters){
  return Object.values(filters).some(v=>!!String(v||'').trim());
}
function purchaseFilterDate(p){
  return purchaseDateISO(p?.shipDate||p?.orderDate||'');
}
function purchaseInvoiceEconomicCost(invoice){
  // Gift cards and reward points are PAYMENT, not a reduction in aircraft cost.
  // Normal invoice discounts are already in total. Refunds DO reduce net cost.
  const n=x=>Number.isFinite(Number(x))?Number(x):0;
  return Math.round(Math.max(0,n(invoice.total)+n(invoice.giftCardApplied)+n(invoice.rewardsPoints)-n(invoice.refundTotal))*100)/100;
}
function purchaseFilteredFinancialSummary(allPurchases,allInvoices,matching,filters={}){
  const purchases=Array.isArray(allPurchases)?allPurchases:[];
  const invoices=Array.isArray(allInvoices)?allInvoices:[];
  const selected=Array.isArray(matching)?matching:[];
  const lineSpecific=!!(filters.search||filters.disposition||filters.system);
  const active=purchaseFilterActive(filters);
  const sum=lines=>lines.reduce((s,p)=>s+(p.priceKnown===false?0:purchaseLineTotal(p)),0);
  const money=x=>Math.round((Number(x)||0)*100)/100;
  const linked=new Map(),selectedByInvoice=new Map(),invoiceByNo=new Map();
  const invoiceNo=x=>String(x?.invoice||x?.id||'');
  for(const inv of invoices)if(invoiceNo(inv))invoiceByNo.set(invoiceNo(inv),inv);
  for(const p of purchases){
    const id=String(p.invoice||'');if(!id)continue;
    if(!linked.has(id))linked.set(id,[]);
    linked.get(id).push(p);
  }
  for(const p of selected){
    const id=String(p.invoice||'');if(!id)continue;
    if(!selectedByInvoice.has(id))selectedByInvoice.set(id,[]);
    selectedByInvoice.get(id).push(p);
  }
  const dateAllowed=x=>{
    const date=purchaseDateISO(x.invoiceDate||'');
    return (!filters.from||date>=filters.from)&&(!filters.to||date<=filters.to);
  };
  const invoiceRows=[];
  for(const inv of invoices){
    const id=invoiceNo(inv),allLines=linked.get(id)||[],selectedLines=selectedByInvoice.get(id)||[];
    const hasSelected=selectedLines.length>0;
    const standaloneAllowed=!lineSpecific&&allLines.length===0&&
      (!filters.vendor||String(inv.vendor||'')===String(filters.vendor))&&dateAllowed(inv);
    if(!hasSelected&&!(standaloneAllowed||(!active&&allLines.length===0)))continue;
    const fullCost=purchaseInvoiceEconomicCost(inv);
    const rawSubtotal=Number(inv.subtotal);
    const denominator=Number.isFinite(rawSubtotal)&&rawSubtotal>0?rawSubtotal:sum(allLines);
    const aircraftSubtotal=inv.aircraftLineSubtotal===undefined?denominator:Number(inv.aircraftLineSubtotal);
    const matchingSubtotal=sum(selectedLines);
    let share=1;
    if(hasSelected){
      // Vendor/date alone selects an INVOICE (including uncaptured source lines).
      // Search, system or disposition selects ITEMS and apportions the whole cost
      // from the invoice's original pre-tax line subtotal.
      share=lineSpecific?(denominator>0?matchingSubtotal/denominator:0):
        denominator>0?Math.max(0,aircraftSubtotal)/denominator:1;
      // A vendor filter may select only part of a multi-vendor invoice.
      if(!lineSpecific&&selectedLines.length<allLines.length&&denominator>0)
        share=matchingSubtotal/denominator;
    }else if(standaloneAllowed&&inv.aircraftLineSubtotal!==undefined&&denominator>0){
      share=Math.max(0,aircraftSubtotal)/denominator;
    }
    share=Math.max(0,Math.min(1,share));
    const cost=money(fullCost*share);
    invoiceRows.push({invoice:inv,id,cost,fullCost,share,
      allocated:share<0.999999,sourceOnly:!hasSelected,
      estimated:inv.totalIsQuotedEstimate===true||inv.totalIsQuotedEstimate==='true',
      sourcePartial:!!inv.partialItems,selectedLineCount:selectedLines.length});
  }
  const uninvoiced=selected.filter(p=>!invoiceByNo.has(String(p.invoice||'')));
  return {
    selected,invoiceRows,active,lineSpecific,filters:{...filters},
    lines:selected.length,invoices:invoiceRows.length,
    vendors:new Set(selected.map(p=>p.vendor).filter(Boolean)).size,
    spend:money(invoiceRows.reduce((s,x)=>s+x.cost,0)),
    itemSubtotal:money(sum(selected)),unknown:selected.filter(p=>p.disposition==='Unknown').length,
    unpriced:selected.filter(p=>p.priceKnown===false).length,
    unbilledCount:uninvoiced.length,unbilledSubtotal:money(sum(uninvoiced)),
    allocatedInvoices:invoiceRows.filter(x=>x.allocated).length,
    sourceOnlyInvoices:invoiceRows.filter(x=>x.sourceOnly).length,
    quotedInvoices:invoiceRows.filter(x=>x.estimated).length,
    uncapturedInvoices:invoiceRows.filter(x=>x.sourcePartial).length
  };
}
function purchaseCurrentSummary(){
  const filters=purchaseReadFilters();
  return purchaseFilteredFinancialSummary(db.purchases,db.invoices,
    db.purchases.filter(purchaseMatches),filters);
}
window.purchaseFilteredFinancialSummary=purchaseFilteredFinancialSummary;
window.purchaseCurrentSummary=purchaseCurrentSummary;

function purchaseRefreshMetricTiles(){
  const page=document.getElementById('page-purchases');if(!page)return;
  const tiles=[...page.querySelectorAll('.purchase-metrics > div')];
  if(tiles.length<6)return;
  const s=purchaseCurrentSummary();
  const vals=[
    [s.lines,'Line items'],[s.invoices,'Invoice / order records'],
    [s.vendors,'Vendors'],[fmtMoney(s.spend),'Actual invoiced spend'],
    [s.unknown,'Disposition unknown'],[fmtMoney(s.itemSubtotal),'Item subtotal']
  ];
  vals.forEach(([v,label],i)=>{
    const tile=tiles[i];
    let b=tile.querySelector('b'),span=tile.querySelector('span');
    if(b)b.textContent=v;
    if(span)span.textContent=label;
    tile.title=i===3?'Click for the selected invoices and any proportional allocations':
      'Click for matching purchase records';
  });
  const note=page.querySelector('#purchaseScopeSummary');
  if(note){
    const parts=[s.active?'Filtered totals — '+s.lines+' matching purchase lines.':'All purchase history.'];
    if(s.lineSpecific&&s.allocatedInvoices)parts.push(s.allocatedInvoices+' invoice(s) allocated proportionally for matching items.');
    else if(s.allocatedInvoices)parts.push(s.allocatedInvoices+' mixed / partial invoice(s) allocated.');
    if(s.unbilledCount)parts.push(s.unbilledCount+' line(s) without matched invoice totals; '+fmtMoney(s.unbilledSubtotal)+' in item subtotals only.');
    if(s.sourceOnlyInvoices)parts.push(s.sourceOnlyInvoices+' invoice-only record(s) have no item rows on this page.');
    if(s.quotedInvoices)parts.push(s.quotedInvoices+' owner-paid order estimate(s), final totals not verified.');
    if(s.unpriced)parts.push(s.unpriced+' line(s) without verified item pricing.');
    note.textContent=parts.join(' ');
  }
}
window.purchaseRefreshMetricTiles=purchaseRefreshMetricTiles;
window.purchaseClearFilters=function(){
  for(const id of ['purchaseSearch','purchaseVendor','purchaseDisposition','purchaseSystem','purchaseFrom','purchaseTo']){
    const el=document.getElementById(id);if(el)el.value='';
  }
  Object.keys(purchaseSavedFilters).forEach(k=>purchaseSavedFilters[k]='');
  purchasePersistFilterSession();
  renderPurchaseRows();
};

const purchaseMatchesVendorBase=purchaseMatches;
purchaseMatches=function(p){
  if(!purchaseMatchesVendorBase(p))return false;
  const f=purchaseReadFilters();
  if(f.vendor&&p.vendor!==f.vendor)return false;
  const date=purchaseFilterDate(p);
  return (!f.from||date>=f.from)&&(!f.to||date<=f.to);
};

const renderPurchasesVendorBase=renderPurchases;
renderPurchases=function(){
  const previous=purchaseReadFilters();
  renderPurchasesVendorBase();
  const page=document.getElementById('page-purchases');if(!page)return;
  const controls=page.querySelector('.purchase-controls');if(!controls)return;
  const vendors=[...new Set(arr(db.purchases).map(x=>x.vendor).filter(Boolean))].sort();
  const sel=document.createElement('select');sel.id='purchaseVendor';
  sel.setAttribute('aria-label','Filter purchases by vendor');
  sel.onchange=renderPurchaseRows;
  sel.innerHTML=`<option value="">All vendors</option>${vendors.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}`;
  const segmented=controls.querySelector('.segmented');
  controls.insertBefore(sel,segmented||null);
  for(const [id,label] of [['purchaseFrom','From'],['purchaseTo','To']]){
    const wrap=document.createElement('label');
    wrap.className='purchase-date-filter';
    wrap.textContent=label+' ';
    const input=document.createElement('input');input.type='date';input.id=id;
    input.setAttribute('aria-label',label+' purchase date');
    input.onchange=renderPurchaseRows;
    wrap.appendChild(input);
    controls.insertBefore(wrap,segmented||null);
  }
  const clear=document.createElement('button');clear.type='button';clear.className='secondary purchase-clear-filter';
  clear.textContent='Show all';clear.onclick=window.purchaseClearFilters;controls.insertBefore(clear,segmented||null);
  const note=document.createElement('div');note.id='purchaseScopeSummary';note.className='tiny muted';
  note.setAttribute('aria-live','polite');note.style.margin='-3px 0 12px';
  page.querySelector('.purchase-metrics')?.insertAdjacentElement('afterend',note);
  for(const [id,key] of [['purchaseSearch','search'],['purchaseVendor','vendor'],
    ['purchaseDisposition','disposition'],['purchaseSystem','system'],
    ['purchaseFrom','from'],['purchaseTo','to']]){
    const el=document.getElementById(id);if(el)el.value=previous[key]||'';
  }
  Object.assign(purchaseSavedFilters,previous);
  renderPurchaseRows();
};


const renderPurchaseRowsVendorBase=renderPurchaseRows;
renderPurchaseRows=function(){
  renderPurchaseRowsVendorBase();
  purchaseRememberFilters();
  purchaseRefreshMetricTiles();
  if(purchaseViewMode!=='transactions')return;
  const table=document.querySelector('#purchaseRows table');if(!table)return;
  const head=table.querySelector('thead tr');if(head&&!head.querySelector('[data-vendor-col]')){
    const th=document.createElement('th');th.dataset.vendorCol='1';th.textContent='Vendor';
    const first=head.children[0];first.after(th);
  }
  table.querySelectorAll('tbody tr.click-row').forEach(row=>{
    if(row.querySelector('[data-vendor-col]'))return;
    const m=/openPurchaseDetail\('([^']+)'\)/.exec(row.getAttribute('onclick')||'');if(!m)return;
    const p=db.purchases.find(x=>String(x.id)===m[1]);if(!p)return;
    const td=document.createElement('td');td.dataset.vendorCol='1';td.textContent=p.vendor||'—';
    row.children[0]?.after(td);
  });
};

const openInvoiceGroupVendorBase=openInvoiceGroup;
openInvoiceGroup=function(invoice){
  openInvoiceGroupVendorBase(invoice);
  const x=invoiceRecord?.(invoice);if(!x)return;
  const modal=document.getElementById('modalBox'),card=modal?.querySelector('.invoice-source-card');if(!card)return;
  const extra=[];
  if(num(x.miscCharge))extra.push(`<div><span>${num(x.miscCharge)<0?'Discount / adjustment':'Misc. charge'}</span><b>${fmtMoney(x.miscCharge)}</b></div>`);
  if(num(x.paidWithOrder))extra.push(`<div><span>Paid with order</span><b>${fmtMoney(x.paidWithOrder)}</b></div>`);
  if(extra.length){const grid=card.querySelector('.invoice-total-grid');extra.forEach(html=>grid?.insertAdjacentHTML('beforeend',html))}
  if(x.partialItems)card.insertAdjacentHTML('beforeend',`<div class="danger-note" style="margin-top:10px"><b>Partial line-item capture.</b> ${esc(x.notes||'The source document did not expose every product row.')} Invoice/order totals are preserved.</div>`);
  else if(x.notes)card.insertAdjacentHTML('beforeend',`<div class="notice" style="margin-top:10px">${esc(x.notes)}</div>`);
};

// Purchase rendering after cloud refresh is coordinated centrally by app-61-performance.
