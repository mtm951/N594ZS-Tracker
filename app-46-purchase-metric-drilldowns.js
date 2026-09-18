// ---------- V5.5.1 PURCHASE METRIC DRILL-DOWNS ----------
(function(){
  if(window.__n594zsPurchaseMetricDrilldowns)return;
  window.__n594zsPurchaseMetricDrilldowns=true;

  const metricTypes=['lines','invoices','vendors','spend','unknown'];
  let drillType='lines';
  let vendorDrillVendor='';

  function safe(v){return typeof esc==='function'?esc(v):String(v??'')}
  function money(v){return typeof fmtMoney==='function'?fmtMoney(v):('$'+Number(v||0).toFixed(2))}
  function lineTotal(p){return typeof purchaseLineTotal==='function'?purchaseLineTotal(p):Number(p?.qty||0)*Number(p?.unitPrice||0)}
  function allPurchases(){return Array.isArray(db?.purchases)?db.purchases:[]}
  function allInvoices(){return Array.isArray(db?.invoices)?db.invoices:[]}
  function norm(v){return String(v??'').trim().toLowerCase()}
  function enc(v){return encodeURIComponent(String(v??''))}
  function invItems(invoice){return allPurchases().filter(p=>String(p.invoice||'')===String(invoice||''))}
  function invoiceVendor(x){
    if(x?.vendor)return x.vendor;
    const first=invItems(x?.invoice||x?.id)[0];
    return first?.vendor||'Unknown vendor';
  }
  function invoiceDate(x){
    if(x?.invoiceDate)return x.invoiceDate;
    const first=invItems(x?.invoice||x?.id)[0];
    return first?.shipDate||'';
  }
  function invoiceNo(x){return String(x?.invoice||x?.id||'')}
  function uniqueInvoicesForPurchases(rows){
    return new Set(rows.map(p=>String(p.invoice||'')).filter(Boolean)).size;
  }
  function invoiceSpendForVendor(vendor){
    return allInvoices().filter(x=>invoiceVendor(x)===vendor).reduce((s,x)=>s+Number(x.total||0),0);
  }

  function metricTileSetup(){
    const page=document.getElementById('page-purchases');if(!page)return;
    const tiles=[...page.querySelectorAll('.purchase-metrics > div')];
    if(tiles.length<5)return;
    tiles.slice(0,5).forEach((tile,i)=>{
      const type=metricTypes[i];
      tile.classList.add('purchase-metric-drill');
      tile.setAttribute('role','button');
      tile.setAttribute('tabindex','0');
      tile.setAttribute('aria-label','Open '+(tile.querySelector('span')?.textContent||'purchase metric')+' details');
      tile.title='Click to view details';
      tile.onclick=()=>openPurchaseMetricDrilldown(type);
      tile.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPurchaseMetricDrilldown(type)}};
    });
  }

  function searchBox(placeholder){
    return '<div class="controls" style="margin:10px 0 12px"><input id="purchaseMetricSearch" type="search" placeholder="'+safe(placeholder)+'" oninput="renderPurchaseMetricDrilldown()"></div>';
  }
  function openShell(title,subtitle,body,actions=''){
    openModal(modalHeader(title,subtitle)+body+(actions?'<div class="modal-actions">'+actions+'</div>':''),true);
  }

  window.openPurchaseMetricDrilldown=function(type){
    drillType=metricTypes.includes(type)?type:'lines';
    if(drillType==='lines'){
      openShell('Purchase Line Items',allPurchases().length+' recorded purchase line items',searchBox('Search description, PN, vendor, invoice, disposition…')+'<div id="purchaseMetricBody"></div>');
      renderPurchaseMetricDrilldown();
    }else if(drillType==='invoices'){
      openShell('Invoices / Order Records',allInvoices().length+' matched invoice and order records',searchBox('Search invoice, vendor, date…')+'<div id="purchaseMetricBody"></div>');
      renderPurchaseMetricDrilldown();
    }else if(drillType==='vendors'){
      openShell('Purchase Vendors',purchaseVendorCount()+' vendors in purchase history',searchBox('Search vendors…')+'<div id="purchaseMetricBody"></div>');
      renderPurchaseMetricDrilldown();
    }else if(drillType==='spend'){
      openShell('Actual Invoiced Spend',money(purchaseInvoiceSpend())+' across '+allInvoices().length+' invoice / order records','<div class="notice" style="margin-bottom:12px">This total is built from the stored invoice/order totals, so freight, tax, discounts and other invoice-level adjustments are represented when recorded.</div>'+searchBox('Search invoice, vendor, date…')+'<div id="purchaseMetricBody"></div>');
      renderPurchaseMetricDrilldown();
    }else{
      const rows=allPurchases().filter(p=>p.disposition==='Unknown');
      openShell('Disposition Unknown',rows.length+' purchase line'+(rows.length===1?'':'s')+' still need reconciliation',searchBox('Search unresolved purchases…')+'<div id="purchaseMetricBody"></div>','<button class="secondary" onclick="closeModal()">Close</button><button class="primary" onclick="openPurchaseReconcile()">Start Reconcile</button>');
      renderPurchaseMetricDrilldown();
    }
  };

  window.renderPurchaseMetricDrilldown=function(){
    const box=document.getElementById('purchaseMetricBody');if(!box)return;
    const q=norm(document.getElementById('purchaseMetricSearch')?.value||'');
    if(drillType==='lines'){
      const rows=[...allPurchases()].filter(p=>!q||norm([p.description,p.pn,p.vendor,p.seller,p.invoice,p.order,p.disposition,p.system].join(' ')).includes(q)).sort((a,b)=>String(b.shipDate||'').localeCompare(String(a.shipDate||'')));
      box.innerHTML='<div class="tiny muted" style="margin-bottom:8px">'+rows.length+' matching line item'+(rows.length===1?'':'s')+'</div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Vendor</th><th>Part / material</th><th>Invoice</th><th>Disposition</th><th>Total</th></tr></thead><tbody>'+rows.map(p=>'<tr class="click-row" data-purchase-id="'+safe(p.id)+'"><td>'+safe(p.shipDate||'—')+'</td><td><b>'+safe(p.vendor||'—')+'</b></td><td><b>'+safe(p.pn||'No PN')+'</b><div class="task-note">'+safe(p.description||'')+'</div></td><td>'+safe(p.invoice||'—')+'</td><td>'+pill(p.disposition)+'</td><td>'+money(lineTotal(p))+'</td></tr>').join('')+'</tbody></table></div>';
      box.querySelectorAll('[data-purchase-id]').forEach(el=>el.addEventListener('click',()=>openPurchaseDetail(el.dataset.purchaseId)));
      return;
    }
    if(drillType==='unknown'){
      const rows=allPurchases().filter(p=>p.disposition==='Unknown').filter(p=>!q||norm([p.description,p.pn,p.vendor,p.invoice,p.order,p.system].join(' ')).includes(q)).sort((a,b)=>String(b.shipDate||'').localeCompare(String(a.shipDate||'')));
      box.innerHTML=rows.map(p=>'<button class="search-result" type="button" data-purchase-id="'+safe(p.id)+'"><span class="mini-badge">Unknown</span><b>'+safe(p.pn||p.description||'Purchase')+'</b><small>'+safe(p.vendor||'Vendor')+' • '+safe(p.shipDate||'Unknown date')+' • Invoice '+safe(p.invoice||'—')+' • '+money(lineTotal(p))+'</small></button>').join('')||'<div class="empty">Nothing unresolved.</div>';
      box.querySelectorAll('[data-purchase-id]').forEach(el=>el.addEventListener('click',()=>openPurchaseDetail(el.dataset.purchaseId)));
      return;
    }
    if(drillType==='vendors'){
      const vendors=[...new Set(allPurchases().map(p=>p.vendor).filter(Boolean))].map(v=>{
        const lines=allPurchases().filter(p=>p.vendor===v);
        return {vendor:v,lines:lines.length,invoices:uniqueInvoicesForPurchases(lines),invoiceSpend:invoiceSpendForVendor(v),lineSpend:lines.reduce((s,p)=>s+lineTotal(p),0)};
      }).filter(x=>!q||norm(x.vendor).includes(q)).sort((a,b)=>b.invoiceSpend-a.invoiceSpend||b.lines-a.lines||a.vendor.localeCompare(b.vendor));
      box.innerHTML='<div class="table-wrap"><table><thead><tr><th>Vendor</th><th>Line items</th><th>Invoices</th><th>Actual invoice spend</th></tr></thead><tbody>'+vendors.map(v=>'<tr class="click-row" data-vendor="'+enc(v.vendor)+'"><td><b>'+safe(v.vendor)+'</b></td><td>'+v.lines+'</td><td>'+v.invoices+'</td><td>'+money(v.invoiceSpend)+'</td></tr>').join('')+'</tbody></table></div>';
      box.querySelectorAll('[data-vendor]').forEach(el=>el.addEventListener('click',()=>openPurchaseVendorDrilldown(decodeURIComponent(el.dataset.vendor))));
      return;
    }
    const rows=[...allInvoices()].filter(x=>!q||norm([invoiceNo(x),invoiceVendor(x),x.seller,invoiceDate(x),x.order].join(' ')).includes(q)).sort((a,b)=>drillType==='spend'?(Number(b.total||0)-Number(a.total||0)):String(invoiceDate(b)).localeCompare(String(invoiceDate(a))));
    const total=rows.reduce((s,x)=>s+Number(x.total||0),0);
    box.innerHTML='<div class="tiny muted" style="margin-bottom:8px">'+rows.length+' matching invoice / order record'+(rows.length===1?'':'s')+(q?' • '+money(total)+' matching spend':'')+'</div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Vendor</th><th>Invoice / order</th><th>Line items</th><th>Total</th></tr></thead><tbody>'+rows.map(x=>{const no=invoiceNo(x),items=invItems(no);return '<tr class="click-row" data-invoice="'+enc(no)+'"><td>'+safe(invoiceDate(x)||'—')+'</td><td><b>'+safe(invoiceVendor(x))+'</b>'+(x.seller&&x.seller!==invoiceVendor(x)?'<div class="task-note">'+safe(x.seller)+'</div>':'')+'</td><td><b>'+safe(no||'—')+'</b></td><td>'+items.length+'</td><td><b>'+money(x.total)+'</b></td></tr>'}).join('')+'</tbody></table></div>';
    box.querySelectorAll('[data-invoice]').forEach(el=>el.addEventListener('click',()=>openInvoiceGroup(decodeURIComponent(el.dataset.invoice))));
  };

  window.openPurchaseVendorDrilldown=function(vendor){
    vendorDrillVendor=String(vendor||'');
    const lines=allPurchases().filter(p=>p.vendor===vendorDrillVendor);
    const invoiceNos=[...new Set(lines.map(p=>String(p.invoice||'')).filter(Boolean))];
    const invoices=allInvoices().filter(x=>invoiceNos.includes(invoiceNo(x))||invoiceVendor(x)===vendorDrillVendor).sort((a,b)=>String(invoiceDate(b)).localeCompare(String(invoiceDate(a))));
    const actual=invoices.reduce((s,x)=>s+Number(x.total||0),0),lineSpend=lines.reduce((s,p)=>s+lineTotal(p),0);
    openShell(vendorDrillVendor,'Vendor purchase history','<div class="summary-strip"><div class="summary-cell"><div class="lab">Line items</div><div class="val">'+lines.length+'</div></div><div class="summary-cell"><div class="lab">Invoices</div><div class="val">'+invoiceNos.length+'</div></div><div class="summary-cell"><div class="lab">Invoice spend</div><div class="val">'+money(actual)+'</div></div><div class="summary-cell"><div class="lab">Line subtotal</div><div class="val">'+money(lineSpend)+'</div></div></div><div class="detail-card"><h3>Invoices / Orders</h3>'+(invoices.map(x=>'<div class="kv click-row" data-invoice="'+enc(invoiceNo(x))+'"><div><b>'+safe(invoiceNo(x))+'</b><div class="task-note">'+safe(invoiceDate(x)||'Unknown date')+'</div></div><b>'+money(x.total)+'</b></div>').join('')||'<div class="empty">No matched invoice records.</div>')+'</div><div class="detail-card"><h3>Purchase Line Items</h3>'+lines.sort((a,b)=>String(b.shipDate||'').localeCompare(String(a.shipDate||''))).map(p=>'<div class="kv click-row" data-purchase-id="'+safe(p.id)+'"><div><b>'+safe(p.pn||'No PN')+' • '+safe(p.description||'Purchase')+'</b><div class="task-note">'+safe(p.shipDate||'Unknown date')+' • '+safe(p.disposition||'Unknown')+'</div></div><b>'+money(lineTotal(p))+'</b></div>').join('')+'</div>','<button class="secondary" onclick="openPurchaseMetricDrilldown(\'vendors\')">← Vendors</button><button class="secondary" onclick="closeModal()">Close</button>');
    const box=document.getElementById('modalBox');
    box?.querySelectorAll('[data-invoice]').forEach(el=>el.addEventListener('click',()=>openInvoiceGroup(decodeURIComponent(el.dataset.invoice))));
    box?.querySelectorAll('[data-purchase-id]').forEach(el=>el.addEventListener('click',()=>openPurchaseDetail(el.dataset.purchaseId)));
  };

  const renderBase=window.renderPurchases;
  window.renderPurchases=function(){
    renderBase();
    metricTileSetup();
  };

  if(!document.getElementById('purchaseMetricDrillStyle')){
    const s=document.createElement('style');s.id='purchaseMetricDrillStyle';
    s.textContent='.purchase-metrics>div.purchase-metric-drill{cursor:pointer;position:relative;transition:transform .12s ease,border-color .12s ease,background .12s ease}.purchase-metrics>div.purchase-metric-drill:hover{border-color:#8fb7d7;background:#f7fbff;transform:translateY(-1px)}.purchase-metrics>div.purchase-metric-drill:focus{outline:3px solid rgba(30,115,180,.22);outline-offset:2px}.purchase-metrics>div.purchase-metric-drill:after{content:"View ›";display:block;font-size:10px;font-weight:700;opacity:.48;margin-top:5px}.modal-box #purchaseMetricBody .search-result{width:100%;text-align:left;margin-bottom:6px}';
    document.head.appendChild(s);
  }
  if(document.getElementById('page-purchases')?.classList.contains('active'))metricTileSetup();
})();