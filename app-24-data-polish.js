// ---------- V4.2 W&B / PURCHASE POLISH ----------

// Refine automatic purchase categorization: generic AN/MS hardware should not be mistaken for fuel-system parts.
purchaseSystem=function(desc,pn=''){
  const s=`${pn} ${desc}`.toLowerCase();
  // Specific assemblies win over generic material words such as "wire".
  // Example: "PROP BOLT ... DRILLED HEAD FOR SAFETY WIRE" is Propeller, not Electrical.
  if(/prop bolt|propeller|\bprop\b/.test(s))return 'Propeller';
  if(/wire|connector|terminal|sub-d|switch|breaker|fuse|relay|solder sleeve|spiral wrap|heat shrink|battery|electrical|expando|expandable slv/.test(s))return 'Electrical';
  if(/probe|cht|egt|whelen|light|antenna|avion|instrument|pitot|static|sender/.test(s))return 'Avionics / Instruments';
  if(/rotax|spark plug|oil vent|oil filter|loctite 648|filter wrench/.test(s))return 'Engine';
  if(/poly.?fiber|poly.?tak|\bmek\b|fabric|aerothane|poly.?spray/.test(s))return 'Fabric / Airframe';
  if(/tire|wheel|brake|tailwheel|hydraulic fluid|bearing/.test(s))return 'Landing Gear';
  if(/coolant|radiator|heater hose/.test(s))return 'Cooling';
  if(/exhaust|muffler/.test(s))return 'Exhaust';
  if(/fuel|super flex|hose adapter|nylon reducer|3003-0 tube|\btube\b|tubing|flare|\bfitting|npt|valve|gascolator|fuel filter|an818|an819|an833|an924|an929|an913/.test(s))return 'Fuel';
  if(/bolt|nut|washer|cotter|screw|rivet|clamp|camloc|grommet|an3-|an4-|an6-|an7-|an960|an970|an310|an365|an742|ms21919|ms24665|hardware/.test(s))return 'Hardware';
  if(/tool|drill|reamer|anti-seize|catalog|scotch brite|handee/.test(s))return 'Tools / Supplies';
  return 'General';
};

// Reclassify CSV-derived lines with the refined rules. Manual edits remain untouched.
for(const p of arr(db.purchases))if(p.source==='Aircraft Spruce CSV'&&!p.systemManual)p.system=purchaseSystem(p.description,p.pn);

// Aircraft page should never imply the old 582 empty W&B is the current 912 empty condition.
const renderAircraftWbPolishBase=renderAircraft;
renderAircraft=function(){
  renderAircraftWbPolishBase();
  const page=document.getElementById('page-aircraft');if(!page||!db.aircraft.wb)return;
  const wb=db.aircraft.wb,current=wb.configurations?.find(x=>x.id===wb.activeConfigId),ready=wbConfigReady(current),historical=wb.configurations?.find(x=>x.id==='2018-582');
  const kvs=[...page.querySelectorAll('.kv')];
  for(const kv of kvs){const label=kv.querySelector('span')?.textContent?.trim(),b=kv.querySelector('b');if(!b)continue;
    if(label==='Empty weight')b.innerHTML=ready?`${Number(current.emptyWeight).toFixed(1)} lb <div class="tiny muted">${esc(current.label)}</div>`:`Pending post-912 weighing${historical?`<div class="tiny muted">2018 / 582 historical: ${Number(historical.emptyWeight).toFixed(0)} lb</div>`:''}`;
    if(label==='Empty CG')b.innerHTML=ready?`${wbCgForConfig(current).toFixed(2)} in <div class="tiny muted">${esc(current.label)}</div>`:`Pending post-912 weighing${historical?`<div class="tiny muted">2018 / 582 historical: ${wbCgForConfig(historical).toFixed(2)} in</div>`:''}`;
  }
  const card=page.querySelector('.card.span-8');if(card){const note=document.createElement('div');note.className=ready?'notice':'danger-note';note.style.marginTop='12px';note.innerHTML=ready?`<b>Current W&B:</b> ${Number(current.emptyWeight).toFixed(1)} lb at ${wbCgForConfig(current).toFixed(2)} in. <button class="linkbtn" onclick="navTo('weightbalance')">Open loading calculator →</button>`:`<b>Current 912 empty W&B is pending final weighing.</b> The 523 lb / 12.2 in values are retained only as the 2018 historical configuration. <button class="linkbtn" onclick="navTo('weightbalance')">Open W&B →</button>`;card.appendChild(note)}
};

// Keep purchase disposition and physical Parts inventory tied together.
function purchaseRemainingQty(p){return p.remainingQty===''?num(p.qty):num(p.remainingQty)}
function ensurePurchaseInInventory(p,qty=purchaseRemainingQty(p)){
  if(!p||qty<=0)return null;
  if(p.inventoryApplied&&p.inventoryPartId)return partById(Number(p.inventoryPartId));
  let part=p.inventoryPartId?partById(Number(p.inventoryPartId)):null;
  if(!part&&p.pn)part=db.parts.find(x=>x.partNo&&x.partNo.toLowerCase()===p.pn.toLowerCase());
  if(!part&&!p.pn)part=db.parts.find(x=>x.name&&p.description&&x.name.toLowerCase()===p.description.toLowerCase());
  if(!part){
    part={id:uid(),name:p.description||p.pn||'Purchased part',description:p.description||'',partNo:p.pn||'',system:p.system||'General',partType:'Inventory',unit:'ea',stockQty:0,minQty:'',status:'On Hand',vendor:p.vendor||'',url:p.productUrl||p.sourceUrl||'',unitCost:p.unitPrice||'',location:p.location||'',purchaseDate:p.shipDate||'',notes:`Created from purchase history${p.invoice?` invoice ${p.invoice}`:''}.`,linkedProjectIds:p.projectId?[Number(p.projectId)]:[],updates:[]};
    db.parts.push(part);
  }
  part.stockQty=(part.stockQty===''?0:num(part.stockQty))+qty;
  part.status='On Hand';
  if(!part.vendor&&p.vendor)part.vendor=p.vendor;
  if(!part.location&&p.location)part.location=p.location;
  part.linkedProjectIds=arr(part.linkedProjectIds);
  if(p.projectId&&!part.linkedProjectIds.includes(Number(p.projectId)))part.linkedProjectIds.push(Number(p.projectId));
  p.inventoryPartId=part.id;p.inventoryApplied=true;p.disposition='On Hand';p.remainingQty=qty;
  return part;
}
applyPurchaseToInventory=function(id){
  const p=db.purchases.find(x=>String(x.id)===String(id));if(!p)return;
  if(p.inventoryApplied)return toast('This purchase is already linked to inventory.','good');
  const qty=purchaseRemainingQty(p);if(qty<=0)return alert('Set a positive remaining quantity before adding this purchase to inventory.');
  ensurePurchaseInInventory(p,qty);saveDB(`${qty} added to inventory.`);openPurchaseDetail(id);
};

// One-at-a-time reconciliation flow for historical purchase records.
const renderPurchasesReconcileBase=renderPurchases;
renderPurchases=function(){
  renderPurchasesReconcileBase();
  const toolbar=document.querySelector('#page-purchases .toolbar .action-row');if(toolbar&&!toolbar.querySelector('[data-reconcile]')){const unknown=db.purchases.filter(x=>x.disposition==='Unknown').length;toolbar.insertAdjacentHTML('afterbegin',`<button class="secondary" data-reconcile onclick="openPurchaseReconcile()">Reconcile (${unknown})</button>`)}
};
function openPurchaseReconcile(startId=null){
  let rows=db.purchases.filter(x=>x.disposition==='Unknown').sort((a,b)=>(b.shipDate||'').localeCompare(a.shipDate||''));
  if(startId){const i=rows.findIndex(x=>String(x.id)===String(startId));if(i>0)rows=[...rows.slice(i),...rows.slice(0,i)]}
  const p=rows[0];if(!p){toast('Purchase history is fully reconciled.','good');renderPurchases();return}
  const remaining=rows.length;
  openModal(`${modalHeader('Reconcile Purchase',`${remaining} historical line${remaining===1?'':'s'} still unknown`)}<div class="detail-card"><div class="kv"><span>Date</span><b>${esc(p.shipDate||'Unknown')}</b></div><div class="kv"><span>Invoice</span><b>${esc(p.invoice||'—')}</b></div><div class="kv"><span>Part number</span><b>${esc(p.pn||'—')}</b></div><div class="detail-section"><label>Description</label><div class="detail-text"><b>${esc(p.description)}</b></div></div><div class="kv"><span>Purchased</span><b>${p.qty} @ ${fmtMoney(p.unitPrice)}</b></div><div class="kv"><span>System</span><b>${esc(p.system||'General')}</b></div></div><div class="notice" style="margin-top:10px">Choose what happened to this purchase. If some or all of it is still physically on hand, enter the quantity below. Choosing <b>On Hand</b> now creates or updates the matching Parts inventory record automatically.</div><div style="margin-top:10px"><label>Quantity still on hand</label><input id="reconcileRemaining" type="number" min="0" step="any" value="${esc(p.qty)}"></div><div class="modal-actions" style="flex-wrap:wrap"><button class="secondary" onclick="skipPurchaseReconcile('${esc(p.id)}')">Skip</button><button onclick="setPurchaseDisposition('${esc(p.id)}','Returned')">Returned</button><button onclick="setPurchaseDisposition('${esc(p.id)}','Sold')">Sold</button><button onclick="setPurchaseDisposition('${esc(p.id)}','Consumed')">Consumed</button><button onclick="setPurchaseDisposition('${esc(p.id)}','Installed')">Installed</button><button class="primary" onclick="setPurchaseDisposition('${esc(p.id)}','On Hand')">On Hand</button></div>`);
}
function setPurchaseDisposition(id,disposition){
  const p=db.purchases.find(x=>String(x.id)===String(id));if(!p)return;
  if(disposition==='On Hand'){
    const qty=val('reconcileRemaining')===''?num(p.qty):num(val('reconcileRemaining'));
    if(qty<=0)return alert('Enter the quantity that is still on hand.');
    p.disposition='On Hand';p.remainingQty=qty;ensurePurchaseInInventory(p,qty);
  }else{
    p.disposition=disposition;p.remainingQty=0;
  }
  saveDB();openPurchaseReconcile();
}
function skipPurchaseReconcile(id){const rows=db.purchases.filter(x=>x.disposition==='Unknown').sort((a,b)=>(b.shipDate||'').localeCompare(a.shipDate||''));const i=rows.findIndex(x=>String(x.id)===String(id)),next=rows[(i+1)%rows.length];if(!next||String(next.id)===String(id)){closeModal();return}openPurchaseReconcile(next.id)}

// Ensure post-load rendering picks up the corrected historical categories and W&B annotation.
const renderAllDataPolishBase=renderAll;
renderAll=function(){for(const p of arr(db.purchases))if(p.source==='Aircraft Spruce CSV'&&!p.systemManual)p.system=purchaseSystem(p.description,p.pn);renderAllDataPolishBase()};
