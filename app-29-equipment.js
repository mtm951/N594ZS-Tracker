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
    e.inventoryPartId=e.inventoryPartId||null;
    e.invoice=e.invoice||'';
    e.airframeHoursAtInstall=e.airframeHoursAtInstall??'';
    e.engineHoursAtInstall=e.engineHoursAtInstall??'';
    e.notes=e.notes||'';
    e.linkedProjectIds=arr(e.linkedProjectIds).map(Number).filter(Boolean);
    e.history=arr(e.history).map(h=>({...h,id:Number(h.id)||uid(),date:h.date||'',action:h.action||'Note',hours:h.hours??'',notes:h.notes||''}));
  });
  arr(db.parts).forEach(p=>{p.purchaseIds=arr(p.purchaseIds).map(String);p.equipmentId=p.equipmentId||null});
  arr(db.invoices).forEach(x=>{x.purchaseIds=arr(x.purchaseIds).map(String)});
};
normalizeDB();

let equipmentSort={key:'system',dir:'asc'};
let equipmentMetricFilter='all';
function equipmentById(id){return db.equipment.find(x=>Number(x.id)===Number(id))}
function equipmentPurchase(e){return e?.purchaseId?db.purchases.find(p=>String(p.id)===String(e.purchaseId)):null}
function equipmentDisplayModel(e){return [e.manufacturer,e.model].filter(Boolean).join(' ')||'—'}

function linkBlank(v){return v===undefined||v===null||v===''}
function setLinkValue(obj,key,value){
  if(!obj||value===undefined||value===null||value==='')return false;
  if(String(obj[key]??'')===String(value))return false;
  obj[key]=value;return true;
}
function setLinkValueIfBlank(obj,key,value){
  if(!obj||!linkBlank(obj[key])||value===undefined||value===null||value==='')return false;
  obj[key]=value;return true;
}
function addLinkId(obj,key,value){
  if(!obj||value===undefined||value===null||value==='')return false;
  obj[key]=arr(obj[key]).map(String);
  const id=String(value);if(obj[key].includes(id))return false;
  obj[key].push(id);return true;
}
function addLinkedProject(record,projectId){
  if(!record||!projectId)return false;
  record.linkedProjectIds=arr(record.linkedProjectIds).map(Number).filter(Boolean);
  const id=Number(projectId);if(!id||record.linkedProjectIds.includes(id))return false;
  record.linkedProjectIds.push(id);return true;
}
function purchaseInvoiceRecord(p){return p?.invoice?arr(db.invoices).find(x=>String(x.invoice||x.id||'')===String(p.invoice)):null}
function purchasePartRecord(p){
  if(!p)return null;
  if(p.inventoryPartId){const hit=partById(Number(p.inventoryPartId));if(hit)return hit}
  const byPurchase=arr(db.parts).find(x=>arr(x.purchaseIds).map(String).includes(String(p.id)));if(byPurchase)return byPurchase;
  if(p.pn){
    const hits=arr(db.parts).filter(x=>x.partNo&&String(x.partNo).toLowerCase()===String(p.pn).toLowerCase());
    if(hits.length===1)return hits[0];
  }
  return null;
}
function purchaseEquipmentRecord(p){
  if(!p)return null;
  if(p.equipmentId){const hit=equipmentById(Number(p.equipmentId));if(hit)return hit}
  return arr(db.equipment).find(x=>String(x.purchaseId||'')===String(p.id))||null;
}
function purchaseInventoryQty(p){
  if(!p)return 0;
  if(p.disposition==='Installed')return 0;
  if(p.remainingQty!==''&&p.remainingQty!==null&&p.remainingQty!==undefined)return Math.max(0,num(p.remainingQty));
  return Math.max(0,num(p.qty));
}
function createPartForPurchase(p){
  const installed=p.disposition==='Installed',qty=purchaseInventoryQty(p);
  const part={
    id:uid(),name:p.description||p.pn||'Purchased component',partNo:p.pn||'',system:p.system||'General',unit:'ea',
    stockQty:installed?0:qty,minQty:'',status:installed?'Installed':'On Hand',vendor:p.vendor||'',url:'',unitCost:p.unitPrice||'',
    location:p.location||(installed?'Installed':'On hand'),purchaseDate:p.shipDate||'',
    notes:'Linked automatically from purchase'+(p.invoice?' invoice '+p.invoice:'')+'.',
    linkedProjectIds:p.projectId?[Number(p.projectId)]:[],updates:[],inventoryAdjustments:[],
    partType:installed?'Installed Component':'Inventory',purchaseIds:[String(p.id)],equipmentId:null
  };
  db.parts.push(part);
  p.inventoryPartId=part.id;p.inventoryApplied=true;
  if(p.disposition==='On Hand'&&p.remainingQty==='')p.remainingQty=qty;
  if(installed)p.remainingQty=0;
  return part;
}
function createEquipmentForPurchase(p,part){
  const status=p.disposition==='Installed'?'Installed':p.disposition==='On Hand'?'On Hand':'Verify';
  const e={
    id:nextNumericId(db.equipment,900),name:p.description||p.pn||'Tracked component',system:p.system||'General',category:'Component',
    manufacturer:'',model:'',partNo:p.pn||'',serialNo:'',status,location:p.location||(status==='Installed'?'Installed':'On hand'),
    purchaseDate:p.shipDate||'',installDate:'',vendor:p.vendor||'',purchasePrice:num(p.qty)*num(p.unitPrice),
    purchaseId:String(p.id),inventoryPartId:part?.id||null,invoice:p.invoice||p.order||'',
    airframeHoursAtInstall:'',engineHoursAtInstall:'',notes:'Created automatically from linked purchase history.',
    linkedProjectIds:p.projectId?[Number(p.projectId)]:[],history:[]
  };
  db.equipment.push(e);
  p.equipmentId=e.id;p.trackAsEquipment=true;
  if(part)part.equipmentId=e.id;
  return e;
}
function reconcilePurchaseLinks(p,options={}){
  if(!p)return {changed:false,part:null,equipment:null,invoice:null};
  let changed=false;
  p.equipmentId=p.equipmentId||null;p.trackAsEquipment=!!(p.trackAsEquipment||p.equipmentId);
  const inv=purchaseInvoiceRecord(p);
  if(inv)changed=addLinkId(inv,'purchaseIds',p.id)||changed;

  let part=purchasePartRecord(p);
  const shouldCreatePart=!!(options.forceInventory||options.createPart);
  if(!part&&shouldCreatePart){part=createPartForPurchase(p);changed=true}
  if(part){
    changed=setLinkValue(p,'inventoryPartId',part.id)||changed;
    changed=addLinkId(part,'purchaseIds',p.id)||changed;
    changed=addLinkedProject(part,p.projectId)||changed;
    changed=setLinkValueIfBlank(part,'system',p.system)||changed;
    changed=setLinkValueIfBlank(part,'vendor',p.vendor)||changed;
    changed=setLinkValueIfBlank(part,'purchaseDate',p.shipDate)||changed;
    changed=setLinkValueIfBlank(part,'location',p.location)||changed;
    if(!p.inventoryApplied&&(options.forceInventory||options.createPart)){
      if(p.disposition==='Installed'){p.inventoryApplied=true;p.remainingQty=0;changed=true}
      else {
        const qty=purchaseInventoryQty(p);
        if(qty>0){part.stockQty=(part.stockQty===''?0:num(part.stockQty))+qty;p.inventoryApplied=true;if(p.remainingQty==='')p.remainingQty=qty;changed=true}
      }
    }
  }

  let eq=purchaseEquipmentRecord(p);
  const shouldCreateEquipment=!!(options.createEquipment||p.trackAsEquipment);
  if(!eq&&shouldCreateEquipment){eq=createEquipmentForPurchase(p,part);changed=true}
  if(eq){
    changed=setLinkValue(p,'equipmentId',eq.id)||changed;
    if(!p.trackAsEquipment){p.trackAsEquipment=true;changed=true}
    changed=setLinkValue(eq,'purchaseId',p.id)||changed;
    if(part){
      changed=setLinkValue(eq,'inventoryPartId',part.id)||changed;
      changed=setLinkValue(part,'equipmentId',eq.id)||changed;
    }
    changed=addLinkedProject(eq,p.projectId)||changed;
    changed=setLinkValueIfBlank(eq,'name',p.description||p.pn)||changed;
    changed=setLinkValueIfBlank(eq,'system',p.system)||changed;
    changed=setLinkValueIfBlank(eq,'partNo',p.pn)||changed;
    changed=setLinkValueIfBlank(eq,'vendor',p.vendor)||changed;
    changed=setLinkValueIfBlank(eq,'purchaseDate',p.shipDate)||changed;
    changed=setLinkValueIfBlank(eq,'invoice',p.invoice||p.order)||changed;
    changed=setLinkValueIfBlank(eq,'purchasePrice',num(p.qty)*num(p.unitPrice))||changed;
    changed=setLinkValueIfBlank(eq,'location',p.location)||changed;
  }
  return {changed,part,equipment:eq,invoice:inv};
}
window.reconcilePurchaseLinks=reconcilePurchaseLinks;

window.trackPurchaseAsEquipment=function(id){
  const p=arr(db.purchases).find(x=>String(x.id)===String(id));if(!p)return;
  p.trackAsEquipment=true;
  const out=reconcilePurchaseLinks(p,{createPart:['On Hand','Installed'].includes(p.disposition),createEquipment:true});
  saveDB(out.changed?'Purchase linked to equipment.':'Equipment link already current.');
  setTimeout(()=>openPurchaseDetail(p.id),0);
};

window.reconcileTrackerRecordLinks=function(options={}){
  let changed=false;
  arr(db.equipment).forEach(e=>{
    if(!e.purchaseId)return;
    const p=arr(db.purchases).find(x=>String(x.id)===String(e.purchaseId));if(!p)return;
    changed=setLinkValue(p,'equipmentId',e.id)||changed;
    if(!p.trackAsEquipment){p.trackAsEquipment=true;changed=true}
    if(e.inventoryPartId)changed=setLinkValue(p,'inventoryPartId',e.inventoryPartId)||changed;
  });
  arr(db.purchases).forEach(p=>{
    const createPart=!!(p.inventoryApplied||(p.trackAsEquipment&&['On Hand','Installed'].includes(p.disposition)));
    const out=reconcilePurchaseLinks(p,{createPart,createEquipment:!!p.trackAsEquipment});
    changed=out.changed||changed;
  });
  if(changed&&options.persist){
    try{
      if(typeof persistBrowserData==='function')Promise.resolve(persistBrowserData(db,{quiet:true})).catch(()=>{});
      else localStorage.setItem(DB_KEY,JSON.stringify(db));
    }catch(_e){}
    try{if(typeof queueCloudSave==='function')queueCloudSave()}catch(_e){}
  }
  return changed;
};
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
      ${field('Category','eqCategory',e.category)}<div><label>Status</label><select id="eqStatus">${['Installed','On Hand','Spare','Removed','Replaced','Planned','Verify'].map(s=>`<option ${e.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
      ${field('Manufacturer','eqManufacturer',e.manufacturer)}${field('Model','eqModel',e.model)}
      ${field('Part number','eqPartNo',e.partNo)}${field('Serial number','eqSerialNo',e.serialNo)}
      ${field('Purchase date','eqPurchaseDate',e.purchaseDate,'date')}${field('Install date','eqInstallDate',e.installDate,'date')}
      ${field('Vendor / source','eqVendor',e.vendor)}${field('Purchase price','eqPurchasePrice',e.purchasePrice,'number','min="0" step="0.01"')}
      ${field('Invoice / order','eqInvoice',e.invoice)}${field('Location','eqLocation',e.location)}
      ${field('Airframe hours at install','eqAfHours',e.airframeHoursAtInstall,'number','min="0" step="0.1"')}${field('Engine hours at install','eqEngHours',e.engineHoursAtInstall,'number','min="0" step="0.1"')}
      ${textareaField('Notes / provenance','eqNotes',e.notes)}
    </div>
    <div class="modal-actions">${id?`<button class="danger" onclick="deleteEquipment(${e.id})">Move to Trash</button>`:''}<button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" id="saveEquipmentBtn">Save Equipment</button></div>`,true);
  const saveBtn=document.getElementById('saveEquipmentBtn');
  if(saveBtn)saveBtn.addEventListener('click',()=>saveEquipment(id,String(e.purchaseId||'')),{once:true});
}

function saveEquipment(id,purchaseId=''){
  const old=id?equipmentById(id):null;
  const obj={
    ...(old||{}),id:id||nextNumericId(db.equipment,900),name:val('eqName')||'Installed equipment',system:val('eqSystem')||'General',category:val('eqCategory')||'Component',status:val('eqStatus')||'Installed',manufacturer:val('eqManufacturer'),model:val('eqModel'),partNo:val('eqPartNo'),serialNo:val('eqSerialNo'),purchaseDate:val('eqPurchaseDate'),installDate:val('eqInstallDate'),vendor:val('eqVendor'),purchasePrice:val('eqPurchasePrice'),invoice:val('eqInvoice'),location:val('eqLocation')||'Installed',airframeHoursAtInstall:val('eqAfHours'),engineHoursAtInstall:val('eqEngHours'),notes:val('eqNotes'),purchaseId:purchaseId||old?.purchaseId||'',inventoryPartId:old?.inventoryPartId||null,linkedProjectIds:arr(old?.linkedProjectIds),history:arr(old?.history)
  };
  const i=db.equipment.findIndex(x=>Number(x.id)===Number(id));if(i>=0)db.equipment[i]=obj;else db.equipment.push(obj);
  if(obj.purchaseId){
    const p=arr(db.purchases).find(x=>String(x.id)===String(obj.purchaseId));
    if(p){
      p.trackAsEquipment=true;p.equipmentId=obj.id;
      reconcilePurchaseLinks(p,{createPart:['On Hand','Installed'].includes(p.disposition),createEquipment:false});
    }
  }
  if(obj.inventoryPartId){
    const part=partById(Number(obj.inventoryPartId));if(part)part.equipmentId=obj.id;
  }
  closeModal();saveDB('Equipment record saved.');
}
function deleteEquipment(id){
  if(!confirm('Move this equipment record to Trash? Purchase history and attached receipts are not deleted.'))return;
  const e=equipmentById(id);
  if(e?.purchaseId){
    const p=arr(db.purchases).find(x=>String(x.id)===String(e.purchaseId));
    if(p){p.equipmentId=null;p.trackAsEquipment=false}
  }
  if(e?.inventoryPartId){
    const part=partById(Number(e.inventoryPartId));if(part&&Number(part.equipmentId)===Number(id))part.equipmentId=null;
  }
  db.equipment=db.equipment.filter(x=>Number(x.id)!==Number(id));closeModal();saveDB('Equipment record moved to Trash.');
}

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
  openEquipmentModal(null,{id:null,name:p.description||'Tracked component',system:p.system||'General',category:'Component',manufacturer:'',model:'',partNo:p.pn||'',serialNo:'',status:p.disposition==='Installed'?'Installed':p.disposition==='On Hand'?'On Hand':'Verify',location:p.location||(p.disposition==='Installed'?'Installed':p.disposition==='On Hand'?'On hand':''),purchaseDate:p.shipDate||'',installDate:'',vendor:p.vendor||'',purchasePrice:p.priceKnown===false?'':num(p.qty)*num(p.unitPrice),purchaseId:p.id,inventoryPartId:p.inventoryPartId||null,invoice:p.invoice||p.order||'',airframeHoursAtInstall:'',engineHoursAtInstall:'',notes:`Created from purchase history${p.seller?' • seller: '+p.seller:''}. ${p.notes||''}`.trim(),linkedProjectIds:p.projectId?[Number(p.projectId)]:[],history:[]});
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
