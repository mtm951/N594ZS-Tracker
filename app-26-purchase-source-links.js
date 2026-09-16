// ---------- V4.5 PURCHASE SOURCE / REORDER POLISH ----------

function purchasePriceKnown(p){return p?.priceKnown!==false}

// Make source documents that do not expose line pricing explicit instead of displaying a misleading $0.00.
const renderPurchaseRowsSourceBase=renderPurchaseRows;
renderPurchaseRows=function(){
  renderPurchaseRowsSourceBase();
  const table=document.querySelector('#purchaseRows table');if(!table)return;
  if(purchaseViewMode==='transactions'){
    table.querySelectorAll('tbody tr.click-row').forEach(row=>{
      const m=/openPurchaseDetail\('([^']+)'\)/.exec(row.getAttribute('onclick')||'');if(!m)return;
      const p=db.purchases.find(x=>String(x.id)===m[1]);if(!p||purchasePriceKnown(p))return;
      // Current transaction columns after v4.4: Date, Vendor, PN, Description, Qty, Unit, Invoice, Disposition, Total.
      if(row.children[5])row.children[5].innerHTML='<span class="muted">Not shown</span>';
      if(row.children[8])row.children[8].innerHTML='<span class="muted">—</span>';
    });
  }else{
    table.querySelectorAll('tbody tr.click-row').forEach(row=>{
      const pn=row.querySelector('td b')?.textContent?.trim();if(!pn||pn==='No PN')return;
      const items=db.purchases.filter(x=>x.pn===pn);if(!items.length||items.some(purchasePriceKnown))return;
      if(row.children[4])row.children[4].innerHTML='<span class="muted">Not shown</span>';
      if(row.children[5])row.children[5].innerHTML='<span class="muted">—</span>';
    });
  }
};

const openPurchaseDetailSourceBase=openPurchaseDetail;
openPurchaseDetail=function(id){
  openPurchaseDetailSourceBase(id);
  const p=db.purchases.find(x=>String(x.id)===String(id)),modal=document.getElementById('modalBox');if(!p||!modal)return;
  if(!purchasePriceKnown(p)){
    [...modal.querySelectorAll('.summary-cell')].forEach(cell=>{
      const lab=cell.querySelector('.lab')?.textContent?.trim();
      if(lab==='Unit price')cell.querySelector('.val').textContent='Not shown';
      if(lab==='Line total')cell.querySelector('.val').textContent='—';
    });
  }
  if(p.productUrl){
    const cards=[...modal.querySelectorAll('.detail-card')],actions=cards.find(c=>c.textContent.includes('Links / Actions'));
    if(actions&&!actions.querySelector('[data-vendor-product]')){
      const b=document.createElement('button');b.className='secondary';b.dataset.vendorProduct='1';b.textContent='Open Vendor Product';b.addEventListener('click',()=>window.open(p.productUrl,'_blank','noopener'));
      const row=actions.querySelector('.action-row')||actions;row.appendChild(b);
    }
  }
};

const openInvoiceGroupSourceBase=openInvoiceGroup;
openInvoiceGroup=function(invoice){
  openInvoiceGroupSourceBase(invoice);
  const x=invoiceRecord?.(invoice),modal=document.getElementById('modalBox');if(!x||!modal)return;
  const source=[];
  if(x.poNumber)source.push(`<div class="kv"><span>P.O. / payment ref</span><b>${esc(x.poNumber)}</b></div>`);
  if(x.shippingMethod)source.push(`<div class="kv"><span>Shipping</span><b>${esc(x.shippingMethod)}</b></div>`);
  if(x.tracking)source.push(`<div class="kv"><span>Tracking</span><b>${esc(x.tracking)}</b></div>`);
  if(source.length||x.sourceUrl){
    const card=document.createElement('div');card.className='detail-card';card.innerHTML=`<div class="section-tools"><h3>Vendor Source</h3>${x.sourceUrl?'<button class="secondary" data-open-source>Open Original Order</button>':''}</div>${source.join('')}`;
    if(x.sourceUrl)card.querySelector('[data-open-source]')?.addEventListener('click',()=>window.open(x.sourceUrl,'_blank','noopener'));
    modal.appendChild(card);
  }
};

// Preserve the exact vendor product page when creating a reorder from purchase history.
const createReorderFromPurchaseSourceBase=createReorderFromPurchase;
createReorderFromPurchase=function(id){
  const p=db.purchases.find(x=>String(x.id)===String(id)),before=new Set(db.orders.map(x=>String(x.id)));
  createReorderFromPurchaseSourceBase(id);
  const created=db.orders.find(x=>!before.has(String(x.id)));
  if(created&&p?.productUrl){created.url=p.productUrl;saveDB('Reorder linked to original vendor product.');openOrderDetail(created.id)}
};
