// ---------- V4.4 MULTI-VENDOR PURCHASE POLISH ----------

function purchaseInvoiceSpend(){return arr(db.invoices).reduce((s,x)=>s+num(x.total),0)}
function purchaseVendorCount(){return new Set(arr(db.purchases).map(x=>x.vendor).filter(Boolean)).size}

const purchaseMatchesVendorBase=purchaseMatches;
purchaseMatches=function(p){
  if(!purchaseMatchesVendorBase(p))return false;
  const vendor=val('purchaseVendor');
  return !vendor||p.vendor===vendor;
};

const renderPurchasesVendorBase=renderPurchases;
renderPurchases=function(){
  renderPurchasesVendorBase();
  const page=document.getElementById('page-purchases');if(!page)return;
  const controls=page.querySelector('.purchase-controls');
  if(controls&&!document.getElementById('purchaseVendor')){
    const vendors=[...new Set(arr(db.purchases).map(x=>x.vendor).filter(Boolean))].sort();
    const sel=document.createElement('select');sel.id='purchaseVendor';sel.onchange=renderPurchaseRows;
    sel.innerHTML=`<option value="">All vendors</option>${vendors.map(x=>`<option>${esc(x)}</option>`).join('')}`;
    const segmented=controls.querySelector('.segmented');controls.insertBefore(sel,segmented||null);
  }
  const metrics=[...page.querySelectorAll('.purchase-metrics > div')];
  if(metrics.length>=5){
    metrics[0].innerHTML=`<b>${db.purchases.length}</b><span>Line items</span>`;
    metrics[1].innerHTML=`<b>${db.invoices.length}</b><span>Invoice / order records</span>`;
    metrics[2].innerHTML=`<b>${purchaseVendorCount()}</b><span>Vendors</span>`;
    metrics[3].innerHTML=`<b>${fmtMoney(purchaseInvoiceSpend())}</b><span>Actual invoiced spend</span>`;
    metrics[4].innerHTML=`<b>${db.purchases.filter(x=>x.disposition==='Unknown').length}</b><span>Disposition unknown</span>`;
  }
  renderPurchaseRows();
};

const renderPurchaseRowsVendorBase=renderPurchaseRows;
renderPurchaseRows=function(){
  renderPurchaseRowsVendorBase();
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
