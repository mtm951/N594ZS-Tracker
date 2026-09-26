// ---------- V5.19.32 FILTER-AWARE PURCHASE METRIC DRILL-DOWNS ----------
(function(){
  if(window.__n594zsPurchaseMetricDrilldowns)return;
  window.__n594zsPurchaseMetricDrilldowns=true;

  const metricTypes=['lines','invoices','vendors','spend','unknown','items'];
  let drillType='lines',scope=null,vendorDrillVendor='';

  function safe(v){return typeof esc==='function'?esc(v):String(v??'')}
  function money(v){return typeof fmtMoney==='function'?fmtMoney(v):('$'+Number(v||0).toFixed(2))}
  function lineTotal(p){return typeof purchaseLineTotal==='function'?purchaseLineTotal(p):Number(p?.qty||0)*Number(p?.unitPrice||0)}
  function norm(v){return String(v??'').trim().toLowerCase()}
  function enc(v){return encodeURIComponent(String(v??''))}
  function no(x){return String(x?.invoice||x?.id||'')}
  function date(x){return x?.invoiceDate||x?.shipDate||''}
  function scopeData(){return scope||window.purchaseCurrentSummary()}
  function matchedPurchaseForInvoice(id){return scopeData().selected.filter(p=>String(p.invoice||'')===String(id))}
  function scopeHeader(){
    const s=scopeData();
    return s.active?'Filtered purchases · '+s.lines+' matching line items':'All purchase history';
  }
  function searchBox(placeholder){
    return '<div class="controls" style="margin:10px 0 12px"><input id="purchaseMetricSearch" type="search" placeholder="'+safe(placeholder)+'" oninput="renderPurchaseMetricDrilldown()"></div>';
  }
  function openShell(title,subtitle,body,actions=''){
    openModal(modalHeader(title,subtitle)+body+(actions?'<div class="modal-actions">'+actions+'</div>':''),true);
  }
  function invoiceNote(r){
    const notes=[];
    if(r.allocated)notes.push('Proportionally allocated');
    if(r.sourceOnly)notes.push('Invoice only · no captured item rows');
    if(r.estimated)notes.push('Owner-paid order estimate · final total not verified');
    if(r.sourcePartial)notes.push('Partial source line capture');
    return notes.length?'<div class="task-note">'+safe(notes.join(' · '))+'</div>':'';
  }
  window.openPurchaseInvoiceFromMetric=function(id){
    const inv=(Array.isArray(db?.invoices)?db.invoices:[]).find(x=>no(x)===String(id));
    if(!inv)return;
    const items=(Array.isArray(db?.purchases)?db.purchases:[]).filter(p=>String(p.invoice||'')===String(id));
    if(items.length)return openInvoiceGroup(id);
    const cost=purchaseInvoiceEconomicCost(inv);
    openShell('Invoice / Order '+id,'Source totals · no captured purchase item rows',
      '<div class="notice">This invoice has a stored total but no individually captured item lines. It is included in broad vendor/date invoice totals and excluded from item-only searches.</div>'+
      '<div class="summary-strip">'+
      '<div class="summary-cell"><div class="lab">Vendor</div><div class="val">'+safe(inv.vendor||'Unknown')+'</div></div>'+
      '<div class="summary-cell"><div class="lab">Date</div><div class="val">'+safe(date(inv)||'Unknown')+'</div></div>'+
      '<div class="summary-cell"><div class="lab">Recorded invoice cost</div><div class="val">'+money(cost)+'</div></div></div>'+
      (inv.totalIsQuotedEstimate?'<div class="notice">Order acknowledgment estimate: final settled amount is not documented.</div>':'')+
      (inv.notes?'<div class="detail-card"><h3>Source notes</h3><p>'+safe(inv.notes)+'</p></div>':'')+
      '<div class="detail-card"><h3>Source files</h3><div id="attachments-purchase-invoice-'+safe(id)+'"></div></div>',
      '<button class="secondary" onclick="closeModal()">Close</button>');
    if(typeof renderAttachments==='function')renderAttachments('purchase-invoice',String(id));
  };
  function metricTileSetup(){
    const page=document.getElementById('page-purchases');if(!page)return;
    const tiles=[...page.querySelectorAll('.purchase-metrics > div')];
    if(tiles.length<metricTypes.length)return;
    tiles.slice(0,metricTypes.length).forEach((tile,i)=>{
      const type=metricTypes[i];
      tile.classList.add('purchase-metric-drill');
      tile.setAttribute('role','button');tile.setAttribute('tabindex','0');
      tile.setAttribute('aria-label','Open matching '+(tile.querySelector('span')?.textContent||'purchase metric')+' details');
      tile.title='Click to view matching '+(tile.querySelector('span')?.textContent||'purchase metric');
      tile.onclick=()=>openPurchaseMetricDrilldown(type);
      tile.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPurchaseMetricDrilldown(type)}};
    });
  }
  window.openPurchaseMetricDrilldown=function(type){
    // Capture the exact screen scope at click time. A cloud refresh or a search
    // inside the modal must never silently switch this detail view to all history.
    scope=window.purchaseCurrentSummary();
    drillType=metricTypes.includes(type)?type:'lines';
    const s=scope;
    if(drillType==='lines'||drillType==='items'){
      const title=drillType==='items'?'Filtered Item Subtotal':'Purchase Line Items';
      const subtitle=drillType==='items'?money(s.itemSubtotal)+' across '+s.lines+' matching lines':scopeHeader();
      openShell(title,subtitle,'<div class="notice" style="margin-bottom:10px">Item subtotals are before invoice-level tax, shipping, discounts and refunds. Unpriced lines are omitted from their subtotal.</div>'+searchBox('Search matching descriptions, part numbers, vendor, invoice…')+'<div id="purchaseMetricBody"></div>');
    }else if(drillType==='invoices'){
      openShell('Invoices / Order Records',s.invoices+' invoices within your current filters',searchBox('Search the matching invoice records…')+'<div id="purchaseMetricBody"></div>');
    }else if(drillType==='vendors'){
      openShell('Purchase Vendors',s.vendors+' vendors within your current filters',searchBox('Search the matching vendors…')+'<div id="purchaseMetricBody"></div>');
    }else if(drillType==='spend'){
      const note='Invoice-based cost counts each invoice once, includes tax/shipping when recorded, treats gift cards and rewards as payment, and deducts recorded refunds. Narrow item filters allocate shared invoice costs by item price. Mixed personal/aircraft invoices exclude known personal items.';
      openShell('Actual Invoiced Spend',money(s.spend)+' · '+s.invoices+' selected invoice / order records','<div class="notice" style="margin-bottom:10px">'+safe(note)+'</div>'+searchBox('Search the matching invoice records…')+'<div id="purchaseMetricBody"></div>');
    }else{
      openShell('Disposition Unknown',s.unknown+' matching purchases still need reconciliation',searchBox('Search unresolved matching purchases…')+'<div id="purchaseMetricBody"></div>','<button class="secondary" onclick="closeModal()">Close</button>');
    }
    renderPurchaseMetricDrilldown();
  };
  window.renderPurchaseMetricDrilldown=function(){
    const box=document.getElementById('purchaseMetricBody');if(!box)return;
    const s=scopeData(),q=norm(document.getElementById('purchaseMetricSearch')?.value||'');
    if(drillType==='lines'||drillType==='items'||drillType==='unknown'){
      const items=s.selected.filter(p=>drillType!=='unknown'||p.disposition==='Unknown')
        .filter(p=>!q||norm([p.description,p.pn,p.vendor,p.seller,p.invoice,p.order,p.disposition,p.system,p.notes].join(' ')).includes(q))
        .sort((a,b)=>String(b.shipDate||'').localeCompare(String(a.shipDate||'')));
      const subtotal=items.reduce((sum,p)=>sum+(p.priceKnown===false?0:lineTotal(p)),0);
      box.innerHTML='<div class="tiny muted" style="margin-bottom:8px">'+items.length+' matching line item(s)'+(drillType==='items'?' · '+money(subtotal)+' gross item subtotal':'')+'</div>'+
        '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Vendor</th><th>Part / material</th><th>Invoice</th><th>Disposition</th><th>Gross line total</th></tr></thead><tbody>'+
        items.map(p=>'<tr class="click-row" data-purchase-id="'+safe(p.id)+'"><td>'+safe(p.shipDate||'—')+'</td><td><b>'+safe(p.vendor||'—')+'</b></td><td><b>'+safe(p.pn||'No PN')+'</b><div class="task-note">'+safe(p.description||'')+'</div></td><td>'+safe(p.invoice||'—')+'</td><td>'+pill(p.disposition)+'</td><td>'+(p.priceKnown===false?'Not shown':money(lineTotal(p)))+'</td></tr>').join('')+
        '</tbody></table></div>';
      box.querySelectorAll('[data-purchase-id]').forEach(el=>el.addEventListener('click',()=>openPurchaseDetail(el.dataset.purchaseId)));
      return;
    }
    if(drillType==='vendors'){
      const vendors=[...new Set(s.selected.map(p=>p.vendor).filter(Boolean))].map(v=>{
        const lines=s.selected.filter(p=>p.vendor===v);
        const vScope=purchaseFilteredFinancialSummary(db.purchases,db.invoices,lines,{...s.filters,vendor:v});
        return {vendor:v,summary:vScope};
      }).filter(x=>!q||norm(x.vendor).includes(q))
        .sort((a,b)=>b.summary.spend-a.summary.spend||b.summary.lines-a.summary.lines||a.vendor.localeCompare(b.vendor));
      box.innerHTML='<div class="table-wrap"><table><thead><tr><th>Vendor</th><th>Matching lines</th><th>Invoices</th><th>Invoice-backed cost</th></tr></thead><tbody>'+
        vendors.map(v=>'<tr class="click-row" data-vendor="'+enc(v.vendor)+'"><td><b>'+safe(v.vendor)+'</b></td><td>'+v.summary.lines+'</td><td>'+v.summary.invoices+'</td><td>'+money(v.summary.spend)+'</td></tr>').join('')+
        '</tbody></table></div>';
      box.querySelectorAll('[data-vendor]').forEach(el=>el.addEventListener('click',()=>openPurchaseVendorDrilldown(decodeURIComponent(el.dataset.vendor))));
      return;
    }
    const rows=[...s.invoiceRows].filter(r=>!q||norm([no(r.invoice),r.invoice.vendor,r.invoice.seller,date(r.invoice),r.invoice.order,...matchedPurchaseForInvoice(r.id).map(p=>p.description)].join(' ')).includes(q))
      .sort((a,b)=>drillType==='spend'?b.cost-a.cost:String(date(b.invoice)).localeCompare(String(date(a.invoice))));
    const total=rows.reduce((n,r)=>n+r.cost,0);
    box.innerHTML='<div class="tiny muted" style="margin-bottom:8px">'+rows.length+' matching invoice / order record(s) · '+money(total)+' invoice-backed cost</div>'+
      '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Vendor</th><th>Invoice / order</th><th>Matching lines</th><th>Selected cost</th></tr></thead><tbody>'+
      rows.map(r=>{
        const inv=r.invoice,linked=matchedPurchaseForInvoice(r.id);
        return '<tr class="click-row" data-invoice="'+enc(r.id)+'"><td>'+safe(date(inv)||'—')+'</td><td><b>'+safe(inv.vendor||linked[0]?.vendor||'—')+'</b></td><td><b>'+safe(r.id||'—')+'</b>'+invoiceNote(r)+'</td><td>'+linked.length+'</td><td><b>'+money(r.cost)+'</b>'+(r.allocated?'<div class="task-note">Original invoice cost '+money(r.fullCost)+'</div>':'')+'</td></tr>';
      }).join('')+'</tbody></table></div>';
    box.querySelectorAll('[data-invoice]').forEach(el=>el.addEventListener('click',()=>openPurchaseInvoiceFromMetric(decodeURIComponent(el.dataset.invoice))));
  };
  window.openPurchaseVendorDrilldown=function(vendor){
    vendorDrillVendor=String(vendor||'');
    const s=scopeData(),lines=s.selected.filter(p=>p.vendor===vendorDrillVendor);
    const vScope=purchaseFilteredFinancialSummary(db.purchases,db.invoices,lines,{...s.filters,vendor:vendorDrillVendor});
    const invoices=vScope.invoiceRows.sort((a,b)=>String(date(b.invoice)).localeCompare(String(date(a.invoice))));
    openShell(vendorDrillVendor,scopeHeader(),'<div class="summary-strip">'+
      '<div class="summary-cell"><div class="lab">Matching lines</div><div class="val">'+lines.length+'</div></div>'+
      '<div class="summary-cell"><div class="lab">Invoices</div><div class="val">'+vScope.invoices+'</div></div>'+
      '<div class="summary-cell"><div class="lab">Invoice-backed cost</div><div class="val">'+money(vScope.spend)+'</div></div>'+
      '<div class="summary-cell"><div class="lab">Gross item subtotal</div><div class="val">'+money(vScope.itemSubtotal)+'</div></div></div>'+
      '<div class="detail-card"><h3>Matching invoices</h3>'+
      (invoices.map(r=>'<div class="kv click-row" data-invoice="'+enc(r.id)+'"><div><b>'+safe(r.id)+'</b><div class="task-note">'+safe(date(r.invoice)||'Unknown date')+'</div>'+invoiceNote(r)+'</div><b>'+money(r.cost)+'</b></div>').join('')||'<div class="empty">No invoice records in this scope.</div>')+'</div>'+
      '<div class="detail-card"><h3>Matching purchase lines</h3>'+lines.sort((a,b)=>String(b.shipDate||'').localeCompare(String(a.shipDate||''))).map(p=>'<div class="kv click-row" data-purchase-id="'+safe(p.id)+'"><div><b>'+safe(p.pn||'No PN')+' • '+safe(p.description||'Purchase')+'</b><div class="task-note">'+safe(p.shipDate||'Unknown date')+' • '+safe(p.disposition||'Unknown')+'</div></div><b>'+(p.priceKnown===false?'Not shown':money(lineTotal(p)))+'</b></div>').join('')+'</div>',
      '<button class="secondary" onclick="openPurchaseMetricDrilldown(\'vendors\')">← Vendors</button><button class="secondary" onclick="closeModal()">Close</button>');
    const box=document.getElementById('modalBox');
    box?.querySelectorAll('[data-invoice]').forEach(el=>el.addEventListener('click',()=>openPurchaseInvoiceFromMetric(decodeURIComponent(el.dataset.invoice))));
    box?.querySelectorAll('[data-purchase-id]').forEach(el=>el.addEventListener('click',()=>openPurchaseDetail(el.dataset.purchaseId)));
  };
  const renderBase=window.renderPurchases;
  window.renderPurchases=function(){renderBase();metricTileSetup()};
  if(!document.getElementById('purchaseMetricDrillStyle')){
    const style=document.createElement('style');style.id='purchaseMetricDrillStyle';
    style.textContent='.purchase-metrics>div.purchase-metric-drill{cursor:pointer;position:relative;transition:transform .12s ease,border-color .12s ease,background .12s ease}.purchase-metrics>div.purchase-metric-drill:hover{border-color:#8fb7d7;background:#f7fbff;transform:translateY(-1px)}.purchase-metrics>div.purchase-metric-drill:focus{outline:3px solid rgba(30,115,180,.22);outline-offset:2px}.purchase-metrics>div.purchase-metric-drill:after{content:"View ›";display:block;font-size:10px;font-weight:700;opacity:.48;margin-top:5px}.purchase-date-filter{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;white-space:nowrap}.purchase-date-filter input{min-width:126px}.purchase-clear-filter{white-space:nowrap}.purchase-controls{grid-template-columns:minmax(180px,2fr) repeat(4,minmax(120px,1fr));}.modal-box #purchaseMetricBody .search-result{width:100%;text-align:left;margin-bottom:6px}@media(max-width:1200px){.purchase-controls{grid-template-columns:repeat(3,minmax(0,1fr))}.purchase-controls #purchaseSearch{grid-column:1/-1}}@media(max-width:600px){.purchase-controls{grid-template-columns:1fr}.purchase-controls #purchaseSearch{grid-column:auto}}';
    document.head.appendChild(style);
  }
  if(document.getElementById('page-purchases')?.classList.contains('active'))metricTileSetup();
})();
