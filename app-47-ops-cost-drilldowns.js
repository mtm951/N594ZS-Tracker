// ---------- V5.5.3 AIRCRAFT OPS COST DRILL-DOWNS ----------
(function(){
  if(window.__n594zsOpsCostDrilldowns)return;
  window.__n594zsOpsCostDrilldowns=true;

  const A=v=>Array.isArray(v)?v:[], T=v=>String(v??''), E=v=>typeof esc==='function'?esc(v):T(v);
  const M=v=>typeof fmtMoney==='function'?fmtMoney(v):('$'+Number(v||0).toFixed(2));
  const N=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
  const known=p=>typeof purchasePriceKnown==='function'?purchasePriceKnown(p):(p?.unitPrice!==''&&p?.unitPrice!==null&&p?.unitPrice!==undefined&&Number.isFinite(Number(p.unitPrice)));
  const lineTotal=p=>N(p?.qty)*N(p?.unitPrice);
  const invoiceNo=x=>T(x?.invoice||x?.id);
  const invoiceIds=()=>new Set(A(db?.invoices).map(invoiceNo).filter(Boolean));
  const invoiceItems=no=>A(db?.purchases).filter(p=>T(p.invoice)===T(no));
  const unmatchedPurchases=()=>{const ids=invoiceIds();return A(db?.purchases).filter(p=>!ids.has(T(p.invoice))&&known(p))};

  function clickable(el,fn){
    if(!el||el.dataset.opsCostClickable==='1')return;
    el.dataset.opsCostClickable='1';el.classList.add('ops-cost-clickable');el.tabIndex=0;el.setAttribute('role','button');el.title='Click to view details';
    el.addEventListener('click',fn);
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn()}});
  }

  function enhance(){
    const box=document.getElementById('opsContent');
    if(!box||!box.querySelector('h2')||!/^Cost Accounting$/i.test(box.querySelector('h2')?.textContent?.trim()||''))return;

    const hero=[...box.querySelectorAll('.cost-hero > div')];
    if(hero[0])clickable(hero[0],()=>openOpsCostDrilldown('canonical'));
    if(hero[1])clickable(hero[1],()=>openOpsCostDrilldown('invoices'));
    if(hero[2])clickable(hero[2],()=>openOpsCostDrilldown('unmatched'));

    const breakdownKinds={
      'Shipping in invoice records':'shipping',
      'Tax in invoice records':'tax',
      'Adjustments / discounts recorded':'adjustments',
      'Installed-equipment acquisition values':'equipment',
      'Returned purchase lines':'returned',
      'Project material-use total':'projects'
    };
    box.querySelectorAll('.cost-breakdown .kv').forEach(row=>{
      const label=row.querySelector('span')?.textContent?.trim()||'';
      const kind=breakdownKinds[label];if(kind)clickable(row,()=>openOpsCostDrilldown(kind));
    });

    const panels=[...box.querySelectorAll('.ops-panel')];
    const vendorPanel=panels.find(p=>p.querySelector('h3')?.textContent?.trim()==='Spend by vendor');
    vendorPanel?.querySelectorAll('.cost-list > div:not(.empty)').forEach(row=>{
      const key=row.querySelector('span')?.textContent?.trim()||'';
      if(key)clickable(row,()=>openOpsCostDrilldown('vendor',key));
    });
    const systemPanel=panels.find(p=>p.querySelector('h3')?.textContent?.trim()==='Parts spend by system');
    systemPanel?.querySelectorAll('.cost-list > div:not(.empty)').forEach(row=>{
      const key=row.querySelector('span')?.textContent?.trim()||'';
      if(key)clickable(row,()=>openOpsCostDrilldown('system',key));
    });
  }

  function invoiceRows(rows,valueFn=x=>N(x.total)){
    if(!rows.length)return '<div class="empty">No matching invoice / order records.</div>';
    return '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Vendor</th><th>Invoice / order</th><th>Items</th><th>Amount</th></tr></thead><tbody>'+
      rows.map(x=>'<tr class="click-row" data-cost-invoice="'+encodeURIComponent(invoiceNo(x))+'"><td>'+E(x.invoiceDate||'—')+'</td><td><b>'+E(x.vendor||'Unknown vendor')+'</b></td><td>'+E(invoiceNo(x)||'—')+'</td><td>'+invoiceItems(invoiceNo(x)).length+'</td><td><b>'+M(valueFn(x))+'</b></td></tr>').join('')+
      '</tbody></table></div>';
  }
  function purchaseRows(rows){
    if(!rows.length)return '<div class="empty">No matching purchase lines.</div>';
    return '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Vendor</th><th>Part / material</th><th>Qty</th><th>Disposition</th><th>Line total</th></tr></thead><tbody>'+
      rows.map(p=>'<tr class="click-row" data-cost-purchase="'+E(p.id)+'"><td>'+E(p.shipDate||'—')+'</td><td>'+E(p.vendor||'—')+'</td><td><b>'+E(p.pn||'No PN')+'</b><div class="task-note">'+E(p.description||'')+'</div></td><td>'+E(p.qty)+'</td><td>'+(typeof pill==='function'?pill(p.disposition||'Unknown'):E(p.disposition||'Unknown'))+'</td><td><b>'+M(lineTotal(p))+'</b></td></tr>').join('')+
      '</tbody></table></div>';
  }
  function equipmentRows(rows){
    if(!rows.length)return '<div class="empty">No equipment acquisition values recorded.</div>';
    return '<div class="table-wrap"><table><thead><tr><th>Equipment</th><th>Vendor</th><th>Date</th><th>Acquisition value</th></tr></thead><tbody>'+
      rows.map(e=>'<tr class="click-row" data-cost-equipment="'+E(e.id)+'"><td><b>'+E(e.name||'Equipment')+'</b></td><td>'+E(e.vendor||'—')+'</td><td>'+E(e.purchaseDate||'—')+'</td><td><b>'+M(e.purchasePrice)+'</b></td></tr>').join('')+
      '</tbody></table></div>';
  }
  function projectRows(rows){
    if(!rows.length)return '<div class="empty">No project material-use values recorded.</div>';
    return '<div class="table-wrap"><table><thead><tr><th>Project</th><th>System</th><th>Status</th><th>Material-use total</th></tr></thead><tbody>'+
      rows.map(p=>'<tr class="click-row" data-cost-project="'+E(p.id)+'"><td><b>'+E(p.title||p.id)+'</b></td><td>'+E(p.system||'General')+'</td><td>'+E(p.status||'')+'</td><td><b>'+M(projectCost(p))+'</b></td></tr>').join('')+
      '</tbody></table></div>';
  }

  function bindModal(){
    const modal=document.getElementById('modalBox');if(!modal)return;
    modal.querySelectorAll('[data-cost-invoice]').forEach(el=>el.addEventListener('click',()=>openInvoiceGroup(decodeURIComponent(el.dataset.costInvoice))));
    modal.querySelectorAll('[data-cost-purchase]').forEach(el=>el.addEventListener('click',()=>openPurchaseDetail(el.dataset.costPurchase)));
    modal.querySelectorAll('[data-cost-equipment]').forEach(el=>el.addEventListener('click',()=>openEquipmentDetail(Number(el.dataset.costEquipment))));
    modal.querySelectorAll('[data-cost-project]').forEach(el=>el.addEventListener('click',()=>openProjectDetail(Number(el.dataset.costProject))));
  }

  window.openOpsCostDrilldown=function(kind,key=''){
    const invoices=A(db?.invoices), purchases=A(db?.purchases);
    let title='Cost Detail',subtitle='',body='',total=0;

    if(kind==='vendor'){
      const inv=invoices.filter(x=>(x.vendor||'Unknown vendor')===key);
      const unmatched=unmatchedPurchases().filter(p=>(p.vendor||'Unknown vendor')===key);
      total=inv.reduce((s,x)=>s+N(x.total),0)+unmatched.reduce((s,p)=>s+lineTotal(p),0);
      title=key;subtitle='Vendor spend • '+M(total);
      body='<div class="detail-card"><h3>Invoice / Order Totals</h3>'+invoiceRows(inv)+'</div><div class="detail-card"><h3>Purchase Lines Not Represented by an Invoice Record</h3>'+purchaseRows(unmatched)+'</div>';
    }else if(kind==='system'){
      const rows=purchases.filter(p=>(p.system||'General')===key&&known(p)).sort((a,b)=>T(b.shipDate).localeCompare(T(a.shipDate)));
      total=rows.reduce((s,p)=>s+lineTotal(p),0);
      title=key;subtitle='Parts spend by system • '+M(total);
      body='<div class="notice" style="margin-bottom:12px">Merchandise line-item spend only; shipping and tax remain at the invoice level.</div>'+purchaseRows(rows);
    }else if(kind==='invoices'){
      total=invoices.reduce((s,x)=>s+N(x.total),0);title='Actual Invoice / Order Totals';subtitle=invoices.length+' records • '+M(total);body=invoiceRows([...invoices].sort((a,b)=>T(b.invoiceDate).localeCompare(T(a.invoiceDate))));
    }else if(kind==='unmatched'){
      const rows=unmatchedPurchases().sort((a,b)=>T(b.shipDate).localeCompare(T(a.shipDate)));total=rows.reduce((s,p)=>s+lineTotal(p),0);title='Unmatched Purchase-Line Spend';subtitle=rows.length+' lines • '+M(total);body=purchaseRows(rows);
    }else if(kind==='canonical'){
      const unmatched=unmatchedPurchases(),invTotal=invoices.reduce((s,x)=>s+N(x.total),0),unmatchedTotal=unmatched.reduce((s,p)=>s+lineTotal(p),0);
      total=invTotal+unmatchedTotal;title='Canonical Recorded Purchase Spend';subtitle=M(total);
      body='<div class="summary-strip"><div class="summary-cell"><div class="lab">Invoice totals</div><div class="val">'+M(invTotal)+'</div></div><div class="summary-cell"><div class="lab">Unmatched lines</div><div class="val">'+M(unmatchedTotal)+'</div></div><div class="summary-cell"><div class="lab">Canonical total</div><div class="val">'+M(total)+'</div></div></div><div class="detail-card"><h3>Invoices / Orders</h3>'+invoiceRows([...invoices].sort((a,b)=>T(b.invoiceDate).localeCompare(T(a.invoiceDate))))+'</div><div class="detail-card"><h3>Purchase Lines Without an Invoice Record</h3>'+purchaseRows(unmatched)+'</div>';
    }else if(kind==='shipping'){
      const rows=invoices.filter(x=>N(x.freight)!==0).sort((a,b)=>N(b.freight)-N(a.freight));total=rows.reduce((s,x)=>s+N(x.freight),0);title='Shipping in Invoice Records';subtitle=M(total);body=invoiceRows(rows,x=>N(x.freight));
    }else if(kind==='tax'){
      const rows=invoices.filter(x=>N(x.tax)!==0).sort((a,b)=>N(b.tax)-N(a.tax));total=rows.reduce((s,x)=>s+N(x.tax),0);title='Tax in Invoice Records';subtitle=M(total);body=invoiceRows(rows,x=>N(x.tax));
    }else if(kind==='adjustments'){
      const rows=invoices.filter(x=>N(x.miscCharge)!==0||N(x.discount)!==0).sort((a,b)=>Math.abs(N(b.miscCharge)+N(b.discount))-Math.abs(N(a.miscCharge)+N(a.discount)));total=rows.reduce((s,x)=>s+N(x.miscCharge)+N(x.discount),0);title='Adjustments / Discounts Recorded';subtitle=M(total);body=invoiceRows(rows,x=>N(x.miscCharge)+N(x.discount));
    }else if(kind==='equipment'){
      const rows=A(db?.equipment).filter(e=>e.purchasePrice!==''&&e.purchasePrice!==null&&e.purchasePrice!==undefined).sort((a,b)=>N(b.purchasePrice)-N(a.purchasePrice));total=rows.reduce((s,e)=>s+N(e.purchasePrice),0);title='Installed-Equipment Acquisition Values';subtitle=M(total);body='<div class="notice" style="margin-bottom:12px">Alternate equipment-value view. Do not add this to canonical purchase spend.</div>'+equipmentRows(rows);
    }else if(kind==='returned'){
      const rows=purchases.filter(p=>p.disposition==='Returned').sort((a,b)=>T(b.shipDate).localeCompare(T(a.shipDate)));title='Returned Purchase Lines';subtitle=rows.length+' returned line'+(rows.length===1?'':'s');body='<div class="notice" style="margin-bottom:12px">A returned disposition does not automatically reduce cash spend unless a refund or credit is also recorded.</div>'+purchaseRows(rows);
    }else if(kind==='projects'){
      const rows=A(db?.projects).filter(p=>typeof projectCost==='function'&&projectCost(p)>0).sort((a,b)=>projectCost(b)-projectCost(a));total=rows.reduce((s,p)=>s+projectCost(p),0);title='Project Material-Use Total';subtitle=M(total);body='<div class="notice" style="margin-bottom:12px">Alternate project-use view of parts already represented elsewhere; do not add this to purchase spend.</div>'+projectRows(rows);
    }
    openModal(modalHeader(title,subtitle)+body+'<div class="modal-actions"><button class="secondary" onclick="closeModal()">Close</button></div>',true);
    bindModal();
  };

  const style=document.createElement('style');style.id='opsCostDrillStyle';
  style.textContent='#page-ops .ops-cost-clickable{cursor:pointer;transition:background .12s ease,border-color .12s ease,transform .12s ease}#page-ops .ops-cost-clickable:hover{background:#f7fbff;transform:translateY(-1px)}#page-ops .ops-cost-clickable:focus{outline:3px solid rgba(30,115,180,.22);outline-offset:2px}#page-ops .cost-list .ops-cost-clickable:after,#page-ops .cost-breakdown .ops-cost-clickable:after{content:"›";margin-left:8px;opacity:.38;font-weight:800}#page-ops .cost-hero .ops-cost-clickable:after{content:"View details ›";display:block;font-size:10px;font-weight:700;opacity:.5;margin-top:5px}';
  document.head.appendChild(style);

  const observer=new MutationObserver(()=>enhance());
  const page=document.getElementById('page-ops');if(page)observer.observe(page,{childList:true,subtree:true});
  window.addEventListener('load',enhance);
  setTimeout(enhance,200);
  setTimeout(enhance,1200);
})();