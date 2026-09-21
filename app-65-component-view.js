'use strict';
// ---------- V5.18 UNIFIED COMPONENT VIEW ----------
// Presents one real-world component across equipment, purchase, invoice,
// inventory, projects, maintenance, documents and work history without
// collapsing those underlying records into one overloaded record type.

(function(){
  if(window.__n594zsUnifiedComponentViewInstalled)return;
  window.__n594zsUnifiedComponentViewInstalled=true;

  function A(v){return Array.isArray(v)?v:[]}
  function N(v){const n=Number(v);return Number.isFinite(n)?n:0}
  function byPurchaseId(id){return A(db.purchases).find(p=>String(p.id)===String(id))||null}
  function invoiceFor(p){return p&&p.invoice&&typeof invoiceRecord==='function'?invoiceRecord(p.invoice):null}

  function context(type,id){
    let equipment=null,purchase=null,part=null;
    if(type==='equipment'){
      equipment=typeof equipmentById==='function'?equipmentById(Number(id)):null;
      purchase=equipment?.purchaseId?byPurchaseId(equipment.purchaseId):null;
      part=equipment?.inventoryPartId&&typeof partById==='function'?partById(Number(equipment.inventoryPartId)):null;
    }else if(type==='purchase'){
      purchase=byPurchaseId(id);
      equipment=purchase&&typeof purchaseEquipmentRecord==='function'?purchaseEquipmentRecord(purchase):null;
      part=purchase&&typeof purchasePartRecord==='function'?purchasePartRecord(purchase):null;
    }else if(type==='part'){
      part=typeof partById==='function'?partById(Number(id)):null;
      equipment=part?.equipmentId&&typeof equipmentById==='function'?equipmentById(Number(part.equipmentId)):null;
      purchase=equipment?.purchaseId?byPurchaseId(equipment.purchaseId):A(db.purchases).find(p=>String(p.inventoryPartId||'')===String(part?.id))||null;
    }
    if(!equipment&&purchase&&purchase.equipmentId&&typeof equipmentById==='function')equipment=equipmentById(Number(purchase.equipmentId));
    if(!part&&purchase&&purchase.inventoryPartId&&typeof partById==='function')part=partById(Number(purchase.inventoryPartId));
    if(!purchase&&equipment?.purchaseId)purchase=byPurchaseId(equipment.purchaseId);
    return {equipment,purchase,part,invoice:invoiceFor(purchase)};
  }

  function titleFor(c){return c.equipment?.name||c.part?.name||c.purchase?.description||'Component'}
  function systemFor(c){return c.equipment?.system||c.part?.system||c.purchase?.system||'General'}
  function statusFor(c){return c.equipment?.status||c.purchase?.disposition||c.part?.status||'Verify'}
  function projectIdsFor(c){
    const ids=new Set();
    A(c.equipment?.linkedProjectIds).forEach(x=>ids.add(Number(x)));
    A(c.part?.linkedProjectIds).forEach(x=>ids.add(Number(x)));
    if(c.purchase?.projectId)ids.add(Number(c.purchase.projectId));
    if(c.part)A(db.projects).forEach(p=>{if(A(p.partsUsed).some(x=>Number(x.partId)===Number(c.part.id)))ids.add(Number(p.id))});
    return [...ids].filter(Boolean);
  }
  function projectsFor(c){return projectIdsFor(c).map(id=>projectById(id)).filter(Boolean)}
  function logsFor(c){
    const pids=new Set(projectIdsFor(c));
    return A(db.logs).filter(l=>{
      if(c.part&&A(l.consumedParts).some(x=>Number(x.partId)===Number(c.part.id)))return true;
      return A(l.projectIds).some(id=>pids.has(Number(id)));
    }).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  }
  function documentsFor(c){
    const pids=new Set(projectIdsFor(c));
    return A(db.docs).filter(d=>(c.part&&A(d.linkedPartIds).some(id=>Number(id)===Number(c.part.id)))||A(d.linkedProjectIds).some(id=>pids.has(Number(id))));
  }
  function maintenanceFor(c){
    const sys=systemFor(c);
    return A(db.maintenance).filter(m=>String(m.system||'').toLowerCase()===String(sys||'').toLowerCase());
  }
  function acquisitionCost(c){
    if(c.invoice&&N(c.invoice.total)>0)return N(c.invoice.total);
    if(c.purchase)return N(c.purchase.qty)*N(c.purchase.unitPrice);
    return N(c.equipment?.purchasePrice);
  }
  function sourceButton(label,onclick){return `<button class="secondary" onclick="${onclick}">${esc(label)}</button>`}

  window.openComponentView=function(type,id){
    const c=context(type,id);if(!c.equipment&&!c.purchase&&!c.part)return;
    const title=titleFor(c),system=systemFor(c),status=statusFor(c),projects=projectsFor(c),logs=logsFor(c),docs=documentsFor(c),maint=maintenanceFor(c);
    const onHand=c.part&&typeof partAvailable==='function'?partAvailable(c.part):null;
    const onOrder=c.part&&typeof partOnOrderQty==='function'?partOnOrderQty(c.part.id):0;
    const used=c.part&&typeof partConsumedQty==='function'?partConsumedQty(c.part.id):0;
    const cost=acquisitionCost(c);
    const invoiceNo=c.invoice?.invoice||c.purchase?.invoice||'';
    const equipmentHistory=A(c.equipment?.history).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));

    openModal(`${modalHeader(title,`${system} • unified component record`)}
      <div class="summary-strip component-summary">
        <div class="summary-cell"><div class="lab">Status</div><div class="val">${pill(status)}</div></div>
        <div class="summary-cell"><div class="lab">System</div><div class="val component-small-val">${esc(system)}</div></div>
        <div class="summary-cell"><div class="lab">On hand</div><div class="val">${c.part?(onHand===null?'—':esc(onHand+' '+(c.part.unit||'ea'))):'—'}</div></div>
        <div class="summary-cell"><div class="lab">Acquisition</div><div class="val">${db.settings.showCosts?fmtMoney(cost):'Hidden'}</div></div>
      </div>

      <div class="component-source-strip">
        <span class="${c.purchase?'linked':'missing'}">Purchase ${c.purchase?'✓':'—'}</span>
        <span class="${c.invoice?'linked':'missing'}">Invoice ${c.invoice?'✓':'—'}</span>
        <span class="${c.part?'linked':'missing'}">Inventory ${c.part?'✓':'—'}</span>
        <span class="${c.equipment?'linked':'missing'}">Equipment ${c.equipment?'✓':'—'}</span>
      </div>

      <div class="detail-grid component-grid"><div>
        <div class="detail-card">
          <div class="section-tools"><div><h3>Component Identity</h3><div class="tiny muted">Lifecycle identity and current aircraft state.</div></div>${c.equipment?'<button class="icon-btn" onclick="openEquipmentModal('+c.equipment.id+')">Edit</button>':''}</div>
          <div class="kv"><span>Name</span><b>${esc(title)}</b></div>
          <div class="kv"><span>Manufacturer / model</span><b>${esc([c.equipment?.manufacturer,c.equipment?.model].filter(Boolean).join(' ')||'Not recorded')}</b></div>
          <div class="kv"><span>Part number</span><b>${esc(c.equipment?.partNo||c.part?.partNo||c.purchase?.pn||'Not recorded')}</b></div>
          <div class="kv"><span>Serial number</span><b>${esc(c.equipment?.serialNo||'Not recorded')}</b></div>
          <div class="kv"><span>Location</span><b>${esc(c.equipment?.location||c.part?.location||c.purchase?.location||'Not recorded')}</b></div>
          ${c.equipment?.notes?`<div class="detail-section"><label>Notes / provenance</label><div class="detail-text">${esc(c.equipment.notes)}</div></div>`:''}
        </div>

        <div class="detail-card">
          <div class="section-tools"><div><h3>Acquisition & Source</h3><div class="tiny muted">Purchase and invoice remain separate source records.</div></div></div>
          ${c.purchase?`<div class="kv click-row" onclick="openPurchaseDetail('${esc(c.purchase.id)}')"><span>Purchase</span><b>${esc(c.purchase.vendor||c.purchase.seller||'Vendor')} • ${esc(c.purchase.shipDate||'date not recorded')}</b></div><div class="kv"><span>Purchase line</span><b>${db.settings.showCosts?fmtMoney(N(c.purchase.qty)*N(c.purchase.unitPrice)):'Hidden'}</b></div>`:'<div class="empty">No linked purchase record.</div>'}
          ${c.invoice?`<div class="kv click-row" onclick="openInvoiceGroup('${esc(c.invoice.invoice||c.invoice.id)}')"><span>Invoice / receipt</span><b>#${esc(c.invoice.invoice||c.invoice.id)} • ${db.settings.showCosts?fmtMoney(c.invoice.total):'Hidden'}</b></div><div class="kv"><span>Freight / other</span><b>${db.settings.showCosts?fmtMoney(N(c.invoice.freight)+N(c.invoice.miscCharge)+N(c.invoice.tax)):'Hidden'}</b></div>`:(invoiceNo?`<div class="kv"><span>Invoice / reference</span><b>${esc(invoiceNo)}</b></div>`:'')}
          ${c.purchase?.notes?`<div class="detail-section"><label>Purchase notes</label><div class="detail-text">${esc(c.purchase.notes)}</div></div>`:''}
        </div>

        <div class="detail-card">
          <div class="section-tools"><div><h3>Inventory / Physical State</h3><div class="tiny muted">Actual physical availability is calculated from inventory inflows minus logged use.</div></div></div>
          ${c.part?`<div class="kv click-row" onclick="openPartDetail(${c.part.id})"><span>Inventory record</span><b>${esc(c.part.name)}</b></div>
            <div class="component-inventory-grid"><div><span>Recorded stock</span><b>${esc((c.part.stockQty===''?'—':c.part.stockQty)+' '+(c.part.unit||''))}</b></div><div><span>Used</span><b>${esc(used+' '+(c.part.unit||''))}</b></div><div><span>Available</span><b>${onHand===null?'—':esc(onHand+' '+(c.part.unit||''))}</b></div><div><span>On order</span><b>${esc(onOrder+' '+(c.part.unit||''))}</b></div></div>`
            :'<div class="empty">No inventory record is linked to this component.</div>'}
        </div>

        <div class="detail-card">
          <div class="section-tools"><h3>Projects</h3></div>
          ${projects.length?projects.map(p=>`<div class="kv click-row" onclick="openProjectDetail(${p.id})"><div><b>${esc(p.title)}</b><div class="task-note">${esc(p.nextStep||p.summary||'')}</div></div>${pill(p.status)}</div>`).join(''):'<div class="empty">No linked projects.</div>'}
        </div>
      </div><div>
        <div class="detail-card">
          <div class="section-tools"><h3>Work & Component History</h3></div>
          ${logs.length?logs.slice(0,12).map(l=>`<div class="kv click-row" onclick="openLogDetail(${l.id})"><div><b>${esc(l.date||'—')} • ${esc(l.work||'Work entry')}</b><div class="task-note">${esc(l.observations||l.notes||'')}</div></div><span>Open ›</span></div>`).join(''):''}
          ${equipmentHistory.length?equipmentHistory.slice(0,8).map(h=>`<div class="kv"><div><b>${esc(h.date||'—')} • ${esc(h.action||'History')}</b><div class="task-note">${esc(h.notes||'')}</div></div><span>${esc(h.hours||'')}</span></div>`).join(''):''}
          ${!logs.length&&!equipmentHistory.length?'<div class="empty">No linked work or component-history entries yet.</div>':''}
        </div>

        <div class="detail-card">
          <div class="section-tools"><div><h3>Maintenance Context</h3><div class="tiny muted">System-level maintenance that may apply to this component.</div></div></div>
          ${maint.length?maint.map(m=>{const d=maintenanceDueInfo(m);return `<div class="kv click-row" onclick="openMaintenanceDetail(${m.id})"><div><b>${esc(m.title)}</b><div class="task-note">${esc(m.basis||m.notes||'')}</div></div>${pill(d.status)}</div>`}).join(''):'<div class="empty">No maintenance items use this system category.</div>'}
        </div>

        <div class="detail-card">
          <div class="section-tools"><h3>Related Documents</h3></div>
          ${docs.length?docs.slice(0,12).map(d=>`<div class="kv click-row" onclick="openDocumentDetail(${d.id})"><div><b>${esc(d.name)}</b><div class="task-note">${esc(d.type||d.publisher||'Document')}</div></div><span>Open ›</span></div>`).join(''):'<div class="empty">No documents are directly linked through this component or its projects.</div>'}
        </div>

        <div class="detail-card">
          <div class="section-tools"><div><h3>Source Records & Files</h3><div class="tiny muted">One component view; original records remain independently editable and auditable.</div></div></div>
          <div class="action-row component-actions">
            ${c.equipment?sourceButton('Equipment record',`openEquipmentSourceDetail(${c.equipment.id})`):''}
            ${c.purchase?sourceButton('Purchase record',`openPurchaseDetail('${esc(c.purchase.id)}')`):''}
            ${c.part?sourceButton('Inventory record',`openPartDetail(${c.part.id})`):''}
            ${c.invoice?sourceButton('Invoice / receipt',`openInvoiceGroup('${esc(c.invoice.invoice||c.invoice.id)}')`):''}
          </div>
          ${c.equipment?`<div class="detail-section"><div class="section-tools"><label>Component files</label><button class="icon-btn" onclick="chooseAttachments('equipment',${c.equipment.id})">+ Upload</button></div><div id="attachments-equipment-${c.equipment.id}"><div class="muted tiny">Loading…</div></div></div>`:''}
          ${c.part?`<div class="detail-section"><div class="section-tools"><label>Part / spec files</label><button class="icon-btn" onclick="chooseAttachments('part',${c.part.id})">+ Upload</button></div><div id="attachments-part-${c.part.id}"><div class="muted tiny">Loading…</div></div></div>`:''}
        </div>
      </div></div>
    `,true);

    if(c.equipment&&typeof renderAttachments==='function')renderAttachments('equipment',c.equipment.id);
    if(c.part&&typeof renderAttachments==='function')renderAttachments('part',c.part.id);
  };

  const equipmentSourceDetail=window.openEquipmentDetail;
  window.openEquipmentSourceDetail=function(id){return equipmentSourceDetail(Number(id))};

  if(!document.getElementById('unifiedComponentStyle')){
    const s=document.createElement('style');s.id='unifiedComponentStyle';s.textContent=`
      .component-summary{margin-bottom:10px}.component-small-val{font-size:13px!important;line-height:1.25}
      .component-source-strip{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 12px}.component-source-strip span{font-size:10px;font-weight:850;border-radius:999px;padding:5px 9px;border:1px solid #dbe5ec}.component-source-strip .linked{background:#eef8f1;color:#2e6c44;border-color:#cce6d4}.component-source-strip .missing{background:#f6f8fa;color:#7b8993}
      .component-inventory-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:10px}.component-inventory-grid>div{border:1px solid #e2e9ee;background:#f8fbfd;border-radius:8px;padding:9px}.component-inventory-grid span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:800}.component-inventory-grid b{display:block;margin-top:3px;font-size:13px}
      .component-actions{flex-wrap:wrap}.component-grid>.detail-card{min-width:0}
      @media(max-width:700px){.component-inventory-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.component-source-strip{gap:5px}}
    `;document.head.appendChild(s);
  }
})();