// ---------- V4.8 MAJOR COMPONENTS / INSTALLED EQUIPMENT ----------

if(!NAV.some(x=>x[0]==='equipment')){
  const i=NAV.findIndex(x=>x[0]==='aircraft');
  NAV.splice(i<0?1:i+1,0,['equipment','Equipment']);
}

RECORD_ARRAYS.equipment='equipment';
SYNC_RECORD_TYPES.add('equipment');
SEED.equipment=SEED.equipment||[];

const blankCloudDBEquipmentBase=blankCloudDB;
blankCloudDB=function(){const out=blankCloudDBEquipmentBase();out.equipment=[];return out};

const normalizeDBEquipmentBase=normalizeDB;
normalizeDB=function(){
  normalizeDBEquipmentBase();
  db.equipment=arr(db.equipment);
  db.equipment.forEach(e=>{
    e.id=Number(e.id)||nextNumericId(db.equipment,900);
    e.name=e.name||'Installed equipment';
    e.system=e.system||'General';
    e.category=e.category||'Component';
    e.manufacturer=e.manufacturer||'';
    e.model=e.model||'';
    e.partNo=e.partNo||'';
    e.serialNo=e.serialNo||'';
    e.status=e.status||'Installed';
    e.location=e.location||'Installed';
    e.purchaseDate=e.purchaseDate||'';
    e.installDate=e.installDate||'';
    e.vendor=e.vendor||'';
    e.purchasePrice=(e.purchasePrice===''||e.purchasePrice===null||e.purchasePrice===undefined)?'':Number(e.purchasePrice)||0;
    e.purchaseId=e.purchaseId||'';
    e.invoice=e.invoice||'';
    e.airframeHoursAtInstall=e.airframeHoursAtInstall??'';
    e.engineHoursAtInstall=e.engineHoursAtInstall??'';
    e.notes=e.notes||'';
    e.linkedProjectIds=arr(e.linkedProjectIds).map(Number).filter(Boolean);
    e.history=arr(e.history).map(h=>({...h,id:Number(h.id)||uid(),date:h.date||'',action:h.action||'Note',hours:h.hours??'',notes:h.notes||''}));
  });
};
normalizeDB();

let equipmentSort={key:'system',dir:'asc'};
let equipmentMetricFilter='all';
function equipmentById(id){return db.equipment.find(x=>Number(x.id)===Number(id))}
function equipmentPurchase(e){return e?.purchaseId?db.purchases.find(p=>String(p.id)===String(e.purchaseId)):null}
function equipmentDisplayModel(e){return [e.manufacturer,e.model].filter(Boolean).join(' ')||'—'}
function equipmentMissingDocs(e){return !e.serialNo||!e.purchaseDate||e.purchasePrice===''||e.purchasePrice===null}
function equipmentSortVal(e,key){
  if(key==='cost')return e.purchasePrice===''?null:Number(e.purchasePrice)||0;
  if(key==='purchaseDate'||key==='installDate')return e[key]||'';
  return String(e[key]??'').toLowerCase();
}
function setEquipmentSort(key){if(equipmentSort.key===key)equipmentSort.dir=equipmentSort.dir==='asc'?'desc':'asc';else equipmentSort={key,dir:'asc'};renderEquipmentRows()}
function equipmentSortHead(label,key){const active=equipmentSort.key===key;return `<th class="purchase-sortable" onclick="setEquipmentSort('${key}')" title="Click to sort">${esc(label)} <span class="purchase-sort-arrow">${active?(equipmentSort.dir==='asc'?'▲':'▼'):'↕'}</span></th>`}
function setEquipmentMetricFilter(key){
  equipmentMetricFilter=(equipmentMetricFilter===key&&key!=='all')?'all':key;
  renderEquipmentRows();
}
function refreshEquipmentMetricButtons(){
  document.querySelectorAll('#page-equipment .equipment-metric').forEach(btn=>{
    const active=btn.dataset.metric===equipmentMetricFilter;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',active?'true':'false');
  });
}

function renderEquipment(){
  const page=document.getElementById('page-equipment');if(!page)return;
  const installed=db.equipment.filter(e=>e.status==='Installed').length;
  const cost=db.equipment.reduce((s,e)=>s+(e.purchasePrice===''?0:num(e.purchasePrice)),0);
  const missing=db.equipment.filter(e=>equipmentMissingDocs(e)).length;
  page.innerHTML=`<div class="grid">
    <div class="card span-12 equipment-page-card"><div class="toolbar equipment-toolbar"><div><h1>Major Components / Installed Equipment</h1><div class="muted">Equipment provenance for N594ZS: what is installed, where it came from, what it cost, serial/part numbers, installation history, linked purchases and supporting files.</div></div><div class="action-row equipment-actions"><button class="equipment-action secondary" onclick="openEquipmentFromPurchase()">+ From Purchase</button><button class="equipment-action primary" onclick="openEquipmentModal()">+ Add Equipment</button></div></div>
      <div class="summary-strip equipment-summary">
        <button class="equipment-metric" data-metric="all" aria-pressed="${equipmentMetricFilter==='all'}" onclick="setEquipmentMetricFilter('all')" title="Show all equipment">
          <span class="equipment-metric-label">Tracked components</span><b class="equipment-metric-value">${db.equipment.length}</b><small>Show all →</small>
        </button>
        <button class="equipment-metric" data-metric="installed" aria-pressed="${equipmentMetricFilter==='installed'}" onclick="setEquipmentMetricFilter('installed')" title="Show installed equipment">
          <span class="equipment-metric-label">Installed</span><b class="equipment-metric-value">${installed}</b><small>Filter installed →</small>
        </button>
        <button class="equipment-metric equipment-metric-cost" data-metric="cost" aria-pressed="${equipmentMetricFilter==='cost'}" onclick="setEquipmentMetricFilter('cost')" title="Show records with acquisition cost documented">
          <span class="equipment-metric-label">Documented acquisition cost</span><b class="equipment-metric-value">${db.settings.showCosts?fmtMoney(cost):'Hidden'}</b><small>Show costed records →</small>
        </button>
        <button class="equipment-metric" data-metric="missing" aria-pressed="${equipmentMetricFilter==='missing'}" onclick="setEquipmentMetricFilter('missing')" title="Show records that need details">
          <span class="equipment-metric-label">Records needing details</span><b class="equipment-metric-value">${missing}</b><small>Review missing info →</small>
        </button>
      </div>
      <div class="controls" style="margin-top:12px"><input id="equipmentSearch" placeholder="Search equipment, model, PN, SN, vendor…" oninput="renderEquipmentRows()"><select id="equipmentSystem" onchange="renderEquipmentRows()">${trackerSystemFilterOptions('')}</select><select id="equipmentStatus" onchange="renderEquipmentRows()"><option value="">All statuses</option>${unique(db.equipment.map(e=>e.status).filter(Boolean)).sort().map(s=>`<option>${esc(s)}</option>`).join('')}</select></div>
      <div class="table-wrap" style="margin-top:11px"><table><thead><tr>${equipmentSortHead('Equipment','name')}${equipmentSortHead('System','system')}${equipmentSortHead('Manufacturer / model','manufacturer')}<th>PN / SN</th>${equipmentSortHead('Status','status')}${equipmentSortHead('Purchased','purchaseDate')}${equipmentSortHead('Installed','installDate')}${equipmentSortHead('Cost','cost')}<th></th></tr></thead><tbody id="equipmentRows"></tbody></table></div>
    </div>
  </div>`;
  renderEquipmentRows();
}

function renderEquipmentRows(){
  const box=document.getElementById('equipmentRows');if(!box)return;
  const q=(val('equipmentSearch')||'').toLowerCase(),sys=val('equipmentSystem'),status=val('equipmentStatus');
  let rows=db.equipment.filter(e=>(!q||[e.name,e.system,e.category,e.manufacturer,e.model,e.partNo,e.serialNo,e.vendor,e.invoice,e.notes].join(' ').toLowerCase().includes(q))&&trackerRecordMatchesSystem(e,sys,'equipment')&&(!status||e.status===status)&&(equipmentMetricFilter==='all'||(equipmentMetricFilter==='installed'&&e.status==='Installed')||(equipmentMetricFilter==='cost'&&e.purchasePrice!==''&&e.purchasePrice!==null&&e.purchasePrice!==undefined)||(equipmentMetricFilter==='missing'&&equipmentMissingDocs(e))));
  const {key,dir}=equipmentSort;
  rows.sort((a,b)=>{const av=equipmentSortVal(a,key),bv=equipmentSortVal(b,key);if(av===null&&bv===null)return 0;if(av===null)return 1;if(bv===null)return -1;const m=dir==='asc'?1:-1;if(typeof av==='number'&&typeof bv==='number')return (av-bv)*m;return String(av).localeCompare(String(bv),undefined,{numeric:true,sensitivity:'base'})*m});
  box.innerHTML=rows.map(e=>`<tr class="click-row" onclick="openEquipmentDetail(${e.id})"><td><b>${esc(e.name)}</b><div class="task-note">${esc(e.category||'')}</div></td><td>${esc(e.system)}</td><td>${esc(equipmentDisplayModel(e))}</td><td><div>${esc(e.partNo||'—')}</div><div class="tiny muted">SN: ${esc(e.serialNo||'not recorded')}</div></td><td>${pill(e.status)}</td><td>${esc(e.purchaseDate||'—')}</td><td>${esc(e.installDate||'—')}</td><td>${db.settings.showCosts?fmtMoney(e.purchasePrice):'Hidden'}</td><td><button class="icon-btn" onclick="event.stopPropagation();openEquipmentModal(${e.id})">Edit</button></td></tr>`).join('')||'<tr><td colspan="9" class="empty">No matching equipment records.</td></tr>';
  refreshEquipmentMetricButtons();
}

function openEquipmentModal(id=null,prefill=null){
  const existing=id?equipmentById(id):null;
  const e=existing||prefill||{id:null,name:'',system:'',category:'Component',manufacturer:'',model:'',partNo:'',serialNo:'',status:'Installed',location:'Installed',purchaseDate:'',installDate:'',vendor:'',purchasePrice:'',purchaseId:'',invoice:'',airframeHoursAtInstall:'',engineHoursAtInstall:'',notes:'',linkedProjectIds:[],history:[]};
  openModal(`${modalHeader(id?'Edit Equipment':'Add Equipment',e.name||'Major component / installed equipment')}
    <div class="form-grid">
      ${field('Equipment / component','eqName',e.name,'text','required')}${field('System','eqSystem',e.system)}
      ${field('Category','eqCategory',e.category)}<div><label>Status</label><select id="eqStatus">${['Installed','Spare','Removed','Replaced','Planned','Verify'].map(s=>`<option ${e.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
      ${field('Manufacturer','eqManufacturer',e.manufacturer)}${field('Model','eqModel',e.model)}
      ${field('Part number','eqPartNo',e.partNo)}${field('Serial number','eqSerialNo',e.serialNo)}
      ${field('Purchase date','eqPurchaseDate',e.purchaseDate,'date')}${field('Install date','eqInstallDate',e.installDate,'date')}
      ${field('Vendor / source','eqVendor',e.vendor)}${field('Purchase price','eqPurchasePrice',e.purchasePrice,'number','min="0" step="0.01"')}
      ${field('Invoice / order','eqInvoice',e.invoice)}${field('Location','eqLocation',e.location)}
      ${field('Airframe hours at install','eqAfHours',e.airframeHoursAtInstall,'number','min="0" step="0.1"')}${field('Engine hours at install','eqEngHours',e.engineHoursAtInstall,'number','min="0" step="0.1"')}
      ${textareaField('Notes / provenance','eqNotes',e.notes)}
    </div>
    <div class="modal-actions">${id?`<button class="danger" onclick="deleteEquipment(${e.id})">Move to Trash</button>`:''}<button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="saveEquipment(${id||'null'},${JSON.stringify(String(e.purchaseId||''))})">Save Equipment</button></div>`,true);
}

function saveEquipment(id,purchaseId=''){
  const old=id?equipmentById(id):null;
  const obj={
    ...(old||{}),id:id||nextNumericId(db.equipment,900),name:val('eqName')||'Installed equipment',system:val('eqSystem')||'General',category:val('eqCategory')||'Component',status:val('eqStatus')||'Installed',manufacturer:val('eqManufacturer'),model:val('eqModel'),partNo:val('eqPartNo'),serialNo:val('eqSerialNo'),purchaseDate:val('eqPurchaseDate'),installDate:val('eqInstallDate'),vendor:val('eqVendor'),purchasePrice:val('eqPurchasePrice'),invoice:val('eqInvoice'),location:val('eqLocation')||'Installed',airframeHoursAtInstall:val('eqAfHours'),engineHoursAtInstall:val('eqEngHours'),notes:val('eqNotes'),purchaseId:purchaseId||old?.purchaseId||'',linkedProjectIds:arr(old?.linkedProjectIds),history:arr(old?.history)
  };
  const i=db.equipment.findIndex(x=>Number(x.id)===Number(id));if(i>=0)db.equipment[i]=obj;else db.equipment.push(obj);
  closeModal();saveDB('Equipment record saved.');
}
function deleteEquipment(id){if(!confirm('Move this equipment record to Trash? Purchase history and attached receipts are not deleted.'))return;db.equipment=db.equipment.filter(e=>Number(e.id)!==Number(id));closeModal();saveDB('Equipment record moved to Trash.')}

function openEquipmentFromPurchase(){
  const used=new Set(db.equipment.map(e=>String(e.purchaseId||'')).filter(Boolean));
  const candidates=[...db.purchases].filter(p=>!used.has(String(p.id))).sort((a,b)=>(b.shipDate||'').localeCompare(a.shipDate||''));
  openModal(`${modalHeader('Add Equipment from Purchase','Turn a historical purchase into an installed-equipment record without retyping it.')}
    <div class="form-grid"><div class="full"><label>Purchase</label><select id="eqPurchasePick"><option value="">— Select purchase —</option>${candidates.map(p=>`<option value="${esc(p.id)}">${esc(p.shipDate||'No date')} • ${esc(p.vendor||'Vendor')} • ${esc(p.description||'Purchase')} • ${fmtMoney(num(p.qty)*num(p.unitPrice))}</option>`).join('')}</select></div></div>
    <div class="modal-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="promotePurchaseToEquipment()">Continue</button></div>`,true);
}
function promotePurchaseToEquipment(){
  const id=val('eqPurchasePick'),p=db.purchases.find(x=>String(x.id)===String(id));if(!p)return alert('Choose a purchase.');
  closeModal();
  openEquipmentModal(null,{id:null,name:p.description||'Installed equipment',system:p.system||'General',category:'Component',manufacturer:p.vendor||'',model:'',partNo:p.pn||'',serialNo:'',status:p.disposition==='Installed'?'Installed':'Verify',location:p.disposition==='Installed'?'Installed':'',purchaseDate:p.shipDate||'',installDate:'',vendor:p.vendor||'',purchasePrice:p.priceKnown===false?'':num(p.qty)*num(p.unitPrice),purchaseId:p.id,invoice:p.invoice||p.order||'',airframeHoursAtInstall:'',engineHoursAtInstall:'',notes:`Created from purchase history${p.seller?' • seller: '+p.seller:''}. ${p.notes||''}`.trim(),linkedProjectIds:p.projectId?[Number(p.projectId)]:[],history:[]});
}

async function openEquipmentDetail(id){
  const e=equipmentById(id);if(!e)return;currentDetail={type:'equipment',id:e.id};
  const p=equipmentPurchase(e),maint=db.maintenance.filter(m=>m.system===e.system),projects=e.linkedProjectIds.map(projectById).filter(Boolean);
  openModal(`${modalHeader(e.name,`${e.system} • ${e.category}`)}
    <div class="detail-grid">
      <div class="detail-card"><div class="section-tools"><h3>Identity & status</h3><button class="icon-btn" onclick="openEquipmentModal(${e.id})">Edit</button></div>
        <div class="kv"><span>Status</span><b>${pill(e.status)}</b></div><div class="kv"><span>Manufacturer / model</span><b>${esc(equipmentDisplayModel(e))}</b></div><div class="kv"><span>Part number</span><b>${esc(e.partNo||'Not recorded')}</b></div><div class="kv"><span>Serial number</span><b>${esc(e.serialNo||'Not recorded')}</b></div><div class="kv"><span>Location</span><b>${esc(e.location||'—')}</b></div>
      </div>
      <div class="detail-card"><h3>Acquisition & installation</h3><div class="kv"><span>Vendor / source</span><b>${esc(e.vendor||'Not recorded')}</b></div><div class="kv"><span>Purchase date</span><b>${esc(e.purchaseDate||'Not recorded')}</b></div><div class="kv"><span>Purchase price</span><b>${db.settings.showCosts?fmtMoney(e.purchasePrice):'Hidden'}</b></div><div class="kv"><span>Invoice / order</span><b>${esc(e.invoice||'Not recorded')}</b></div><div class="kv"><span>Install date</span><b>${esc(e.installDate||'Not recorded')}</b></div><div class="kv"><span>Hours at install</span><b>${esc(e.airframeHoursAtInstall||'—')} AF / ${esc(e.engineHoursAtInstall||'—')} ENG</b></div>${p?`<div class="action-row" style="margin-top:10px"><button class="secondary" onclick="openPurchaseDetail('${esc(p.id)}')">Open linked purchase</button></div>`:''}</div>
      <div class="detail-card"><h3>Notes / provenance</h3><div class="detail-text">${esc(e.notes||'No notes yet.')}</div><div class="task-meta" style="margin-top:10px">${projects.map(p=>`<span class="mini-badge click-row" onclick="openProjectDetail(${p.id})">${esc(p.title)}</span>`).join('')||'<span class="muted small">No linked projects.</span>'}</div></div>
      <div class="detail-card"><div class="section-tools"><h3>Maintenance context</h3><button class="icon-btn" onclick="navTo('maintenance')">Open Maintenance</button></div>${maint.length?maint.map(m=>{const d=maintenanceDueInfo(m);return `<div class="kv"><span>${esc(m.title)}</span><b>${pill(d.status)}</b></div>`}).join(''):'<div class="empty">No recurring maintenance items currently use this system category.</div>'}</div>
      <div class="detail-card full"><div class="section-tools"><h3>Component history</h3><button class="primary" onclick="openEquipmentHistoryModal(${e.id})">+ Add History</button></div>${e.history.length?`<div class="table-wrap"><table><thead><tr><th>Date</th><th>Action</th><th>Hours</th><th>Notes</th></tr></thead><tbody>${[...e.history].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(h=>`<tr><td>${esc(h.date||'—')}</td><td>${esc(h.action)}</td><td>${esc(h.hours||'—')}</td><td>${esc(h.notes||'')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No installation/service/replacement history entries yet.</div>'}</div>
      <div class="detail-card full"><div class="section-tools"><h3>Photos, receipts & records</h3><button class="primary" onclick="chooseAttachments('equipment',${e.id})">+ Upload Files</button></div><div class="upload-drop" ondragover="event.preventDefault()" ondrop="handleEntityDrop(event,'equipment',${e.id})" onclick="chooseAttachments('equipment',${e.id})"><b>Drop files here</b><span>receipts, serial-number photos, manuals, installation photos, warranty records</span></div><div id="attachments-equipment-${e.id}"><div class="empty">Loading files…</div></div></div>
    </div>`,true);
  renderAttachments('equipment',e.id);
}
function openEquipmentHistoryModal(id){
  const e=equipmentById(id);if(!e)return;
  openModal(`${modalHeader('Add Equipment History',e.name)}<div class="form-grid">${field('Date','eqHistDate',today(),'date')}<div><label>Action</label><select id="eqHistAction">${['Installed','Serviced','Inspected','Removed','Reinstalled','Replaced','Repaired','Note'].map(s=>`<option>${s}</option>`).join('')}</select></div>${field('Hours','eqHistHours','','number','min="0" step="0.1"')}${textareaField('Notes','eqHistNotes','')}</div><div class="modal-actions"><button class="secondary" onclick="openEquipmentDetail(${e.id})">Cancel</button><button class="primary" onclick="saveEquipmentHistory(${e.id})">Add Entry</button></div>`,true);
}
function saveEquipmentHistory(id){const e=equipmentById(id);if(!e)return;e.history.push({id:uid(),date:val('eqHistDate'),action:val('eqHistAction')||'Note',hours:val('eqHistHours'),notes:val('eqHistNotes')});closeModal();saveDB('Equipment history updated.');setTimeout(()=>openEquipmentDetail(id),50)}


if(!document.getElementById('equipmentPolishStyle')){
  const equipmentStyle=document.createElement('style');
  equipmentStyle.id='equipmentPolishStyle';
  equipmentStyle.textContent=`
    #page-equipment .equipment-toolbar{align-items:flex-start}
    #page-equipment .equipment-actions{gap:8px}
    #page-equipment .equipment-action{appearance:none;border-radius:8px;padding:9px 12px;font-weight:800;cursor:pointer;transition:background .12s,border-color .12s,transform .12s}
    #page-equipment .equipment-action.secondary{background:#edf3f8;color:#264864;border:1px solid #ccd9e4}
    #page-equipment .equipment-action.primary{background:var(--blue);color:#fff;border:1px solid var(--blue)}
    #page-equipment .equipment-action:hover{transform:translateY(-1px)}
    #page-equipment .equipment-action.secondary:hover{background:#e4eef6;border-color:#adc5d8}
    #page-equipment .equipment-summary{grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:8px;margin-bottom:2px}
    #page-equipment .equipment-metric{appearance:none;position:relative;width:100%;overflow:hidden;background:linear-gradient(180deg,#fbfdff,#f5f8fb);border:1px solid #d9e4ec;border-radius:11px;padding:11px 13px 10px;min-height:86px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:3px;text-align:left;color:inherit;cursor:pointer;box-shadow:0 2px 8px rgba(22,49,74,.035);transition:background .12s,border-color .12s,transform .12s,box-shadow .12s}
    #page-equipment .equipment-metric:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:#c8d7e3;transition:background .12s}
    #page-equipment .equipment-metric-label{display:block;font-size:9px;line-height:1.2;text-transform:uppercase;letter-spacing:.055em;font-weight:900;color:#667e90}
    #page-equipment .equipment-metric-value{display:block;font-size:21px;line-height:1.08;color:#17324c;overflow-wrap:anywhere;margin-top:1px;font-variant-numeric:tabular-nums}
    #page-equipment .equipment-metric small{display:block;margin-top:3px;font-size:9px;line-height:1.2;color:#7a8d9d;font-weight:700}
    #page-equipment .equipment-metric-cost .equipment-metric-value{font-size:19px}
    #page-equipment .equipment-metric:hover{background:#eef6fc;border-color:#a4c4dd;transform:translateY(-1px);box-shadow:0 6px 16px rgba(22,49,74,.08)}
    #page-equipment .equipment-metric:hover:before{background:#74a7d1}
    #page-equipment .equipment-metric.active{background:#e9f4fc;border-color:#72a9d5;box-shadow:inset 0 0 0 1px rgba(45,127,209,.07),0 4px 12px rgba(45,127,209,.07)}
    #page-equipment .equipment-metric.active:before{background:var(--blue)}
    #page-equipment .equipment-metric.active .equipment-metric-value{color:var(--blue)}
    #page-equipment .equipment-metric.active small{color:#46789f}
    #page-equipment .equipment-metric:focus-visible{outline:3px solid rgba(45,127,209,.16);outline-offset:2px}
    @media(max-width:900px){
      #page-equipment .equipment-summary{grid-template-columns:repeat(2,minmax(0,1fr))}
    }
    @media(max-width:700px){
      #page-equipment .equipment-actions{width:100%;display:grid;grid-template-columns:1fr 1fr}
      #page-equipment .equipment-action{width:100%;min-height:44px}
      #page-equipment .equipment-summary{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      #page-equipment .equipment-metric{min-height:76px;padding:9px 10px 8px}
      #page-equipment .equipment-metric-value{font-size:19px}
      #page-equipment .equipment-metric-cost .equipment-metric-value{font-size:17px}
      #page-equipment .equipment-metric-label{font-size:8px}
      #page-equipment .equipment-metric small{font-size:8px}
    }
  `;
  document.head.appendChild(equipmentStyle);
}

// Equipment page rendering is coordinated centrally by app-61-performance.

const reopenDetailEquipmentBase=typeof reopenDetail==='function'?reopenDetail:null;
reopenDetail=function(type,id){if(type==='equipment')return openEquipmentDetail(Number(id));if(reopenDetailEquipmentBase)return reopenDetailEquipmentBase(type,id)};
