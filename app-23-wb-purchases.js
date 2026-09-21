// ---------- V4.2 WEIGHT & BALANCE + PURCHASE HISTORY ----------

// Navigation
if(!NAV.some(x=>x[0]==='weightbalance')){const i=NAV.findIndex(x=>x[0]==='aircraft');NAV.splice(i<0?1:i+1,0,['weightbalance','W&B'])}
if(!NAV.some(x=>x[0]==='purchases')){const i=NAV.findIndex(x=>x[0]==='orders');NAV.splice(i<0?NAV.length:i+1,0,['purchases','Purchases'])}

// Purchases participate in record-level sync.
RECORD_ARRAYS.purchase='purchases';
SYNC_RECORD_TYPES.add('purchase');
SEED.purchases=SEED.purchases||[];
const blankCloudDBWbPurchasesBase=blankCloudDB;
blankCloudDB=function(){const out=blankCloudDBWbPurchasesBase();out.purchases=[];return out};

const WB_DEFAULT={
  maxGross:1050,forwardLimit:10.2,aftLimit:16.0,mac:51.1,fuelLbsPerGallon:6,fuelMaxGallons:12,
  stations:{pilot:18.3,passenger:18.3,fuel:16.5,cargo:40.5},
  activeConfigId:'current-912',
  configurations:[
    {id:'2018-582',label:'2018 / 582 configuration',effectiveDate:'2018-06-21',emptyWeight:523,emptyMoment:6399,emptyCg:12.2351816444,status:'historical',notes:'SkyStar W&B sheet dated 6/21/2018. Scale-table moments total 6,399 in-lb; sheet reports EWCG rounded to 12.2 in.'},
    {id:'current-912',label:'Current / 912 configuration',effectiveDate:'',emptyWeight:'',emptyMoment:'',emptyCg:'',status:'current',notes:'Pending final post-912 weighing.'}
  ],
  scenarios:[]
};
function wbDefaults(){return clone(WB_DEFAULT)}
function purchaseSystem(desc,pn=''){
  const s=`${pn} ${desc}`.toLowerCase();
  if(/wire|connector|terminal|sub-d|switch|breaker|fuse|relay|sleeve|spiral wrap|heat shrink|battery|electrical/.test(s))return 'Electrical';
  if(/probe|cht|egt|whelen|light|antenna|avion|instrument|pitot|static/.test(s))return 'Avionics / Instruments';
  if(/fuel|hose|tube|tubing|flare|fitting|npt|an[ -]?\d|valve|gascolator|filter/.test(s))return 'Fuel';
  if(/rotax|spark plug|oil|loctite 648|filter wrench/.test(s))return 'Engine';
  if(/poly.?fiber|poly.?tak|mek|fabric|aerothane|poly.?spray/.test(s))return 'Fabric / Airframe';
  if(/tire|wheel|brake|tailwheel|bearing/.test(s))return 'Landing Gear';
  if(/coolant|radiator|heater hose/.test(s))return 'Cooling';
  if(/prop|propeller/.test(s))return 'Propeller';
  if(/exhaust|muffler/.test(s))return 'Exhaust';
  if(/bolt|nut|washer|cotter|screw|rivet|clamp|adel|hardware/.test(s))return 'Hardware';
  if(/tool|drill|reamer|anti-seize|catalog/.test(s))return 'Tools / Supplies';
  return 'General';
}
const normalizeDBWbPurchasesBase=normalizeDB;
normalizeDB=function(){
  normalizeDBWbPurchasesBase();
  db.purchases=arr(db.purchases);
  db.purchases.forEach(p=>{
    p.vendor=p.vendor||'Aircraft Spruce';p.order=String(p.order||'');p.invoice=String(p.invoice||'');p.shipDate=p.shipDate||'';p.pn=p.pn||'';p.description=p.description||'Purchase item';
    p.qty=Number(p.qty)||0;p.unitPrice=Number(p.unitPrice)||0;p.disposition=p.disposition||'Unknown';if(p.remainingQty===undefined)p.remainingQty='';p.location=p.location||'';p.projectId=p.projectId||null;
    p.system=p.system||purchaseSystem(p.description,p.pn);p.notes=p.notes||'';p.source=p.source||'Purchase history';p.sourceKey=p.sourceKey||'';p.inventoryPartId=p.inventoryPartId||null;p.inventoryApplied=!!p.inventoryApplied;p.equipmentId=p.equipmentId||null;p.trackAsEquipment=!!(p.trackAsEquipment||p.equipmentId);
  });
  const existing=db.aircraft.wb||{},defaults=wbDefaults();
  db.aircraft.wb={...defaults,...existing,stations:{...defaults.stations,...(existing.stations||{})}};
  const byId=new Map(arr(existing.configurations).map(x=>[x.id,x]));
  db.aircraft.wb.configurations=defaults.configurations.map(x=>({...x,...(byId.get(x.id)||{})}));
  for(const x of arr(existing.configurations))if(!db.aircraft.wb.configurations.some(y=>y.id===x.id))db.aircraft.wb.configurations.push(x);
  db.aircraft.wb.scenarios=arr(existing.scenarios);
};
normalizeDB();

// ---------- WEIGHT & BALANCE ----------
let wbSelectedConfigId=null;
function wbData(){return db.aircraft.wb}
function wbConfig(id=null){const wb=wbData(),wanted=id||wbSelectedConfigId||wb.activeConfigId;return wb.configurations.find(x=>x.id===wanted)||wb.configurations[0]}
function wbConfigReady(c){return Number(c?.emptyWeight)>0&&(Number(c?.emptyMoment)>0||Number(c?.emptyCg)>0)}
function wbMomentForConfig(c){const w=Number(c?.emptyWeight)||0,m=Number(c?.emptyMoment)||0,cg=Number(c?.emptyCg)||0;return m>0?m:w*cg}
function wbCgForConfig(c){const w=Number(c?.emptyWeight)||0,m=wbMomentForConfig(c);return w>0?m/w:0}
function wbLoadValues(){return {pilot:num(val('wbPilot')),passenger:num(val('wbPassenger')),fuelGal:num(val('wbFuelGal')),cargo:num(val('wbCargo'))}}
function wbCalculate(values=wbLoadValues(),config=wbConfig()){
  const wb=wbData(),s=wb.stations,w=Number(config?.emptyWeight)||0,m=wbMomentForConfig(config);
  const fuelLb=values.fuelGal*Number(wb.fuelLbsPerGallon||6);
  const added=values.pilot+values.passenger+fuelLb+values.cargo;
  const totalWeight=w+added,totalMoment=m+values.pilot*num(s.pilot)+values.passenger*num(s.passenger)+fuelLb*num(s.fuel)+values.cargo*num(s.cargo),cg=totalWeight?totalMoment/totalWeight:0;
  const grossMargin=num(wb.maxGross)-totalWeight,fwdMargin=cg-num(wb.forwardLimit),aftMargin=num(wb.aftLimit)-cg;
  const fuelOver=values.fuelGal>num(wb.fuelMaxGallons);
  return {totalWeight,totalMoment,cg,grossMargin,fwdMargin,aftMargin,fuelLb,fuelOver,inWeight:grossMargin>=-0.0001,inCg:fwdMargin>=-0.0001&&aftMargin>=-0.0001,ready:wbConfigReady(config)};
}
function wbStatusHTML(r){if(!r.ready)return '<span class="wb-status pending">CURRENT EMPTY W&B NEEDED</span>';if(r.inWeight&&r.inCg&&!r.fuelOver)return '<span class="wb-status good">WITHIN ENTERED LIMITS</span>';return '<span class="wb-status bad">OUTSIDE ENTERED LIMITS</span>'}
function renderWeightBalance(){
  const page=document.getElementById('page-weightbalance');if(!page)return;const wb=wbData();if(!wbSelectedConfigId)wbSelectedConfigId=wb.activeConfigId;const c=wbConfig();
  page.innerHTML=`<div class="grid wb-page">
    <div class="card span-8"><div class="toolbar"><div><h1>Weight & Balance</h1><div class="muted">N594ZS-specific loading calculator using the stations and limits from the aircraft W&B data.</div></div><button class="secondary" onclick="openWBSetup()">Edit W&B Setup</button></div>
      <div class="wb-source-note"><b>Source baseline:</b> SkyStar W&B sheet dated 6/21/2018. Max gross 1,050 lb; flight CG 10.2–16.0 in; pilot/passenger 18.3 in; fuel 16.5 in; cargo 40.5 in. The 2018 empty condition is historical. Use a new empty weight/moment after the 912 installation for current loading decisions.</div>
      <div class="form-grid wb-inputs">
        <div class="full"><label>Empty-aircraft configuration</label><div class="action-row"><select id="wbCfgSelect" onchange="wbSelectedConfigId=this.value;renderWeightBalance()">${wb.configurations.map(x=>`<option value="${esc(x.id)}" ${c?.id===x.id?'selected':''}>${esc(x.label)}${wbConfigReady(x)?` • ${Number(x.emptyWeight).toFixed(1)} lb / ${wbCgForConfig(x).toFixed(2)} in`:' • pending'}</option>`).join('')}</select><button class="icon-btn" onclick="openWBConfig('${esc(c?.id||'')}')">Edit Configuration</button></div></div>
        ${field('Pilot (lb)','wbPilot','0','number','min="0" step="0.1" oninput="updateWBCalculation()"')}
        ${field('Passenger (lb)','wbPassenger','0','number','min="0" step="0.1" oninput="updateWBCalculation()"')}
        ${field(`Fuel (gal, ${num(wb.fuelLbsPerGallon).toFixed(1)} lb/gal)`,'wbFuelGal','0','number',`min="0" step="0.1" max="${esc(wb.fuelMaxGallons)}" oninput="updateWBCalculation()"`)}
        ${field('Cargo (lb)','wbCargo','0','number','min="0" step="0.1" oninput="updateWBCalculation()"')}
      </div>
      <div id="wbResults"></div>
      <div class="action-row wb-actions"><button class="primary" onclick="saveWBScenario()">Save Loading Scenario</button><button class="secondary" onclick="clearWBInputs()">Clear Loading</button></div>
    </div>
    <div class="card span-4"><div class="section-head"><h2>Saved Scenarios</h2><span class="mini-badge">${wb.scenarios.length}</span></div><div id="wbScenarioList">${renderWBScenariosHTML()}</div></div>
  </div>`;
  updateWBCalculation();
}
function renderWBScenariosHTML(){const rows=wbData().scenarios;return rows.length?rows.map(s=>`<div class="wb-scenario click-row" onclick="loadWBScenario('${esc(s.id)}')"><div><b>${esc(s.name||'Scenario')}</b><small>${esc(s.configLabel||'')} • ${num(s.pilot)} pilot • ${num(s.passenger)} pax • ${num(s.fuelGal)} gal • ${num(s.cargo)} cargo</small></div><button class="icon-btn" onclick="event.stopPropagation();deleteWBScenario('${esc(s.id)}')">✕</button></div>`).join(''):'<div class="empty">Save common loads such as Solo Local, Passenger, or Camping.</div>'}
function updateWBCalculation(){
  const box=document.getElementById('wbResults');if(!box)return;const c=wbConfig(),r=wbCalculate(),wb=wbData();
  if(!r.ready){box.innerHTML=`<div class="wb-no-config"><b>${esc(c?.label||'Current configuration')} is not ready.</b><span>Enter the post-912 empty weight and moment/CG after the aircraft is weighed, or select the 2018 historical configuration to explore the calculator.</span><button class="primary" onclick="openWBConfig('${esc(c?.id||'current-912')}')">Enter Empty W&B</button></div>`;return;}
  const cgPct=Math.max(0,Math.min(100,(r.cg-num(wb.forwardLimit))/(num(wb.aftLimit)-num(wb.forwardLimit))*100));
  const wtPct=Math.max(0,Math.min(100,r.totalWeight/num(wb.maxGross)*100));
  const maxCargo=calculateMaxCargo();
  const warnings=[];if(!r.inWeight)warnings.push(`${Math.abs(r.grossMargin).toFixed(1)} lb over max gross`);if(r.fwdMargin<0)warnings.push(`${Math.abs(r.fwdMargin).toFixed(2)} in forward of limit`);if(r.aftMargin<0)warnings.push(`${Math.abs(r.aftMargin).toFixed(2)} in aft of limit`);if(r.fuelOver)warnings.push(`fuel entry exceeds configured ${num(wb.fuelMaxGallons).toFixed(1)} gal maximum`);
  box.innerHTML=`<div class="wb-result-head">${wbStatusHTML(r)}<span class="muted small">${warnings.length?esc(warnings.join(' • ')):'Based on the currently entered aircraft data and loading.'}</span></div>
    <div class="wb-metrics"><div><span>Total weight</span><b>${r.totalWeight.toFixed(1)} lb</b><small>${r.grossMargin>=0?`${r.grossMargin.toFixed(1)} lb below gross`:`${Math.abs(r.grossMargin).toFixed(1)} lb over gross`}</small></div><div><span>Loaded CG</span><b>${r.cg.toFixed(2)} in</b><small>${r.fwdMargin.toFixed(2)} in from fwd • ${r.aftMargin.toFixed(2)} in from aft</small></div><div><span>Total moment</span><b>${Math.round(r.totalMoment).toLocaleString()} in-lb</b><small>Fuel ${r.fuelLb.toFixed(1)} lb</small></div><div><span>Max cargo from this load</span><b>${maxCargo.max.toFixed(1)} lb</b><small>limited by ${esc(maxCargo.limiter)}</small></div></div>
    <div class="wb-bars"><label>Gross weight <span>${r.totalWeight.toFixed(1)} / ${num(wb.maxGross).toFixed(0)} lb</span></label><div class="wb-weight-bar"><i style="width:${wtPct}%" class="${r.inWeight?'':'bad'}"></i></div><label>CG position <span>${num(wb.forwardLimit).toFixed(1)} ← ${r.cg.toFixed(2)} → ${num(wb.aftLimit).toFixed(1)} in</span></label><div class="wb-cg-gauge"><div class="wb-envelope"></div><i style="left:${cgPct}%" class="${r.inCg?'':'bad'}"></i></div></div>`;
}
function calculateMaxCargo(){
  const wb=wbData(),c=wbConfig(),v=wbLoadValues(),s=wb.stations;if(!wbConfigReady(c))return {max:0,limiter:'empty W&B pending'};
  const fuel=v.fuelGal*num(wb.fuelLbsPerGallon),baseW=num(c.emptyWeight)+v.pilot+v.passenger+fuel,baseM=wbMomentForConfig(c)+v.pilot*num(s.pilot)+v.passenger*num(s.passenger)+fuel*num(s.fuel);
  const gross=Math.max(0,num(wb.maxGross)-baseW);let cg=Infinity;if(num(s.cargo)>num(wb.aftLimit))cg=(num(wb.aftLimit)*baseW-baseM)/(num(s.cargo)-num(wb.aftLimit));if(!Number.isFinite(cg))cg=gross;cg=Math.max(0,cg);
  return gross<=cg?{max:gross,limiter:'max gross weight'}:{max:cg,limiter:'aft CG limit'};
}
function openWBSetup(){const w=wbData(),s=w.stations;openModal(`${modalHeader('W&B Setup','Aircraft-specific limits and station arms')}<div class="form-grid">${field('Max gross (lb)','wbsGross',w.maxGross,'number','step="0.1"')}${field('Forward CG limit (in)','wbsFwd',w.forwardLimit,'number','step="0.01"')}${field('Aft CG limit (in)','wbsAft',w.aftLimit,'number','step="0.01"')}${field('Mean aerodynamic chord (in)','wbsMac',w.mac,'number','step="0.01"')}${field('Pilot arm (in)','wbsPilot',s.pilot,'number','step="0.01"')}${field('Passenger arm (in)','wbsPax',s.passenger,'number','step="0.01"')}${field('Fuel arm (in)','wbsFuel',s.fuel,'number','step="0.01"')}${field('Cargo arm (in)','wbsCargo',s.cargo,'number','step="0.01"')}${field('Fuel density (lb/gal)','wbsDensity',w.fuelLbsPerGallon,'number','step="0.01"')}${field('Configured fuel capacity (gal)','wbsFuelMax',w.fuelMaxGallons,'number','step="0.1"')}</div><div class="notice" style="margin-top:12px">These values are calculator inputs, not an approval or airworthiness determination. Keep them matched to the current aircraft W&B records.</div><div class="modal-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="saveWBSetup()">Save Setup</button></div>`)}
function saveWBSetup(){const w=wbData();Object.assign(w,{maxGross:num(val('wbsGross')),forwardLimit:num(val('wbsFwd')),aftLimit:num(val('wbsAft')),mac:num(val('wbsMac')),fuelLbsPerGallon:num(val('wbsDensity')),fuelMaxGallons:num(val('wbsFuelMax'))});Object.assign(w.stations,{pilot:num(val('wbsPilot')),passenger:num(val('wbsPax')),fuel:num(val('wbsFuel')),cargo:num(val('wbsCargo'))});closeModal();saveDB('W&B setup updated.');renderWeightBalance()}
function openWBConfig(id){const c=wbConfig(id)||{id:crypto.randomUUID(),label:'New configuration',effectiveDate:'',emptyWeight:'',emptyMoment:'',emptyCg:'',status:'historical',notes:''};openModal(`${modalHeader('Empty Aircraft Configuration',c.label)}<div class="form-grid">${field('Configuration name','wbcLabel',c.label)}${field('Effective date','wbcDate',c.effectiveDate,'date')}${field('Empty weight (lb)','wbcWeight',c.emptyWeight,'number','step="0.1"')}${field('Empty moment (in-lb)','wbcMoment',c.emptyMoment,'number','step="0.1"')}${field('Empty CG (in)','wbcCg',c.emptyCg,'number','step="0.001"')}<div><label>Status</label><select id="wbcStatus"><option value="current" ${c.status==='current'?'selected':''}>Current</option><option value="historical" ${c.status==='historical'?'selected':''}>Historical</option></select></div>${textareaField('Notes / source','wbcNotes',c.notes||'')}</div><div class="notice" style="margin-top:12px">Enter either moment or CG with the empty weight. If both are entered, the moment is used for calculations.</div><div class="modal-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="saveWBConfig('${esc(c.id)}')">Save Configuration</button></div>`)}
function saveWBConfig(id){const wb=wbData(),weight=num(val('wbcWeight')),cg=num(val('wbcCg'));let moment=num(val('wbcMoment'));if(!moment&&weight&&cg)moment=weight*cg;const obj={id,label:val('wbcLabel').trim()||'Aircraft configuration',effectiveDate:val('wbcDate'),emptyWeight:weight||'',emptyMoment:moment||'',emptyCg:weight&&moment?moment/weight:(cg||''),status:val('wbcStatus')||'historical',notes:val('wbcNotes')};const i=wb.configurations.findIndex(x=>x.id===id);if(i>=0)wb.configurations[i]=obj;else wb.configurations.push(obj);if(obj.status==='current')wb.activeConfigId=obj.id;wbSelectedConfigId=obj.id;closeModal();saveDB('Empty W&B configuration saved.');renderWeightBalance()}
function saveWBScenario(){const c=wbConfig();if(!c)return;const name=prompt('Scenario name:','Solo Local');if(!name)return;const v=wbLoadValues();wbData().scenarios.push({id:crypto.randomUUID(),name:name.trim(),configId:c.id,configLabel:c.label,...v,createdAt:new Date().toISOString()});saveDB('Loading scenario saved.');renderWeightBalance()}
function loadWBScenario(id){const s=wbData().scenarios.find(x=>x.id===id);if(!s)return;wbSelectedConfigId=s.configId||wbData().activeConfigId;renderWeightBalance();setControl('wbPilot',s.pilot);setControl('wbPassenger',s.passenger);setControl('wbFuelGal',s.fuelGal);setControl('wbCargo',s.cargo);updateWBCalculation()}
function deleteWBScenario(id){if(!confirm('Delete this saved loading scenario?'))return;wbData().scenarios=wbData().scenarios.filter(x=>x.id!==id);saveDB('Loading scenario deleted.');renderWeightBalance()}
function clearWBInputs(){['wbPilot','wbPassenger','wbFuelGal','wbCargo'].forEach(id=>setControl(id,0));updateWBCalculation()}

// ---------- PURCHASES / INVENTORY HISTORY ----------
let purchaseViewMode='parts';
function purchaseLineTotal(p){return num(p.qty)*num(p.unitPrice)}
function purchaseLabel(p){return `${p.pn?`${p.pn} • `:''}${p.description||'Purchase item'}`}
function purchaseDateISO(s){if(!s)return '';if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);if(!m)return s;let y=Number(m[3]);if(y<100)y+=2000;return `${y}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`}
function purchaseStats(){const p=db.purchases,total=p.reduce((s,x)=>s+purchaseLineTotal(x),0),invoices=new Set(p.map(x=>x.invoice).filter(Boolean)).size,pns=new Set(p.map(x=>x.pn).filter(Boolean)).size,unknown=p.filter(x=>x.disposition==='Unknown').length;return {lines:p.length,total,invoices,pns,unknown}}
function purchaseGroups(){const m=new Map();for(const p of db.purchases){const key=p.pn||p.description;if(!m.has(key))m.set(key,{key,pn:p.pn,description:p.description,totalQty:0,spend:0,count:0,lastDate:'',lastPrice:0,systems:new Set(),items:[]});const g=m.get(key);g.totalQty+=num(p.qty);g.spend+=purchaseLineTotal(p);g.count++;g.items.push(p);g.systems.add(p.system);if((p.shipDate||'')>g.lastDate){g.lastDate=p.shipDate||'';g.lastPrice=num(p.unitPrice);g.description=p.description}}return [...m.values()]}
function renderPurchases(){
  const page=document.getElementById('page-purchases');if(!page)return;const s=purchaseStats();
  page.innerHTML=`<div class="card"><div class="toolbar"><div><h1>Purchases</h1><div class="muted">Purchase history, part-number memory, invoice files, inventory linkage and one-click reorder records.</div></div><div class="action-row"><button class="secondary" onclick="document.getElementById('purchaseImportFile').click()">Import Aircraft Spruce CSV</button><button class="primary" onclick="openPurchaseModal()">+ Add Purchase</button></div></div>
    <div class="purchase-metrics"><div><b>${s.lines}</b><span>Line items</span></div><div><b>${s.invoices}</b><span>Invoices</span></div><div><b>${s.pns}</b><span>Part numbers</span></div><div><b>${fmtMoney(s.total)}</b><span>Line-item subtotal</span></div><div><b>${s.unknown}</b><span>Disposition unknown</span></div></div>
    <div class="controls purchase-controls"><input id="purchaseSearch" placeholder="Search part number, description, invoice, order…" oninput="renderPurchaseRows()"><select id="purchaseDisposition" onchange="renderPurchaseRows()"><option value="">All dispositions</option>${['Unknown','On Hand','Installed','Consumed','Returned','Sold'].map(x=>`<option>${x}</option>`).join('')}</select><select id="purchaseSystem" onchange="renderPurchaseRows()">${trackerSystemFilterOptions('')}</select><div class="segmented"><button class="${purchaseViewMode==='parts'?'active':''}" onclick="purchaseViewMode='parts';renderPurchaseRows()">Part History</button><button class="${purchaseViewMode==='transactions'?'active':''}" onclick="purchaseViewMode='transactions';renderPurchaseRows()">Transactions</button></div></div>
    <div id="purchaseRows"></div></div>`;renderPurchaseRows();
}
function purchaseMatches(p){const q=(val('purchaseSearch')||'').trim().toLowerCase(),d=val('purchaseDisposition'),sys=val('purchaseSystem');if(d&&p.disposition!==d)return false;if(!trackerRecordMatchesSystem(p,sys,'purchases'))return false;if(!q)return true;return `${p.pn} ${p.description} ${p.invoice} ${p.order} ${p.vendor} ${p.system} ${p.notes}`.toLowerCase().includes(q)}
function renderPurchaseRows(){const box=document.getElementById('purchaseRows');if(!box)return;document.querySelectorAll('.segmented button').forEach((b,i)=>b.classList.toggle('active',(purchaseViewMode==='parts'?i===0:i===1)));
  if(purchaseViewMode==='parts'){
    const groups=purchaseGroups().filter(g=>g.items.some(purchaseMatches)).sort((a,b)=>(b.lastDate||'').localeCompare(a.lastDate||''));
    box.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Part / material</th><th>Total purchased</th><th>Purchases</th><th>Last bought</th><th>Last price</th><th>Total spend</th></tr></thead><tbody>${groups.map(g=>`<tr class="click-row" onclick="openPartPurchaseHistory('${esc(String(g.key)).replace(/'/g,"\\'")}')"><td><b>${esc(g.pn||'No PN')}</b><div class="task-note">${esc(g.description)}</div></td><td>${g.totalQty}</td><td>${g.count}</td><td>${esc(g.lastDate||'—')}</td><td>${fmtMoney(g.lastPrice)}</td><td>${fmtMoney(g.spend)}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">No matching purchase history.</td></tr>'}</tbody></table></div>`;
  }else{
    const rows=[...db.purchases].filter(purchaseMatches).sort((a,b)=>(b.shipDate||'').localeCompare(a.shipDate||'')||String(b.invoice).localeCompare(String(a.invoice)));
    box.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Date</th><th>PN</th><th>Description</th><th>Qty</th><th>Unit</th><th>Invoice</th><th>Disposition</th><th>Total</th></tr></thead><tbody>${rows.map(p=>`<tr class="click-row" onclick="openPurchaseDetail('${esc(p.id)}')"><td>${esc(p.shipDate||'—')}</td><td><b>${esc(p.pn||'—')}</b></td><td>${esc(p.description)}</td><td>${p.qty}</td><td>${fmtMoney(p.unitPrice)}</td><td><button class="linkbtn" onclick="event.stopPropagation();openInvoiceGroup('${esc(p.invoice)}')">${esc(p.invoice||'—')}</button></td><td>${pill(p.disposition)}</td><td>${fmtMoney(purchaseLineTotal(p))}</td></tr>`).join('')||'<tr><td colspan="8" class="empty">No matching purchases.</td></tr>'}</tbody></table></div>`;
  }
}
function openPartPurchaseHistory(key){const items=db.purchases.filter(p=>(p.pn||p.description)===key).sort((a,b)=>(b.shipDate||'').localeCompare(a.shipDate||''));if(!items.length)return;const first=items[0],qty=items.reduce((s,x)=>s+num(x.qty),0),spend=items.reduce((s,x)=>s+purchaseLineTotal(x),0);openModal(`${modalHeader(first.pn||'Purchase History',first.description)}<div class="summary-strip"><div class="summary-cell"><div class="lab">Purchased</div><div class="val">${qty}</div></div><div class="summary-cell"><div class="lab">Transactions</div><div class="val">${items.length}</div></div><div class="summary-cell"><div class="lab">Last price</div><div class="val">${fmtMoney(first.unitPrice)}</div></div><div class="summary-cell"><div class="lab">Total spend</div><div class="val">${fmtMoney(spend)}</div></div></div><div class="detail-card"><div class="section-tools"><h3>Purchase History</h3><button class="primary" onclick="createReorderFromPurchase('${esc(first.id)}')">Create Reorder</button></div>${items.map(p=>`<div class="kv click-row" onclick="openPurchaseDetail('${esc(p.id)}')"><div><b>${esc(p.shipDate||'Unknown date')} • Invoice ${esc(p.invoice||'—')}</b><div class="task-note">Qty ${p.qty} @ ${fmtMoney(p.unitPrice)} • ${esc(p.disposition)}</div></div><span>${fmtMoney(purchaseLineTotal(p))}</span></div>`).join('')}</div>`,true)}
function openPurchaseDetail(id){const p=db.purchases.find(x=>String(x.id)===String(id));if(!p)return;const linked=p.inventoryPartId?partById(Number(p.inventoryPartId)):null,pr=p.projectId?projectById(Number(p.projectId)):null,eq=p.equipmentId&&typeof equipmentById==='function'?equipmentById(Number(p.equipmentId)):(typeof equipmentById==='function'?db.equipment?.find(e=>String(e.purchaseId||'')===String(p.id)):null),inv=typeof invoiceRecord==='function'&&p.invoice?invoiceRecord(p.invoice):null;openModal(`${modalHeader(p.pn||'Purchase',p.description)}<div class="summary-strip"><div class="summary-cell"><div class="lab">Date</div><div class="val">${esc(p.shipDate||'—')}</div></div><div class="summary-cell"><div class="lab">Qty</div><div class="val">${p.qty}</div></div><div class="summary-cell"><div class="lab">Unit price</div><div class="val">${fmtMoney(p.unitPrice)}</div></div><div class="summary-cell"><div class="lab">Line total</div><div class="val">${fmtMoney(purchaseLineTotal(p))}</div></div></div><div class="detail-grid"><div><div class="detail-card"><div class="section-tools"><h3>Purchase Record</h3><button class="icon-btn" onclick="openPurchaseModal('${esc(p.id)}')">Edit</button></div><div class="kv"><span>Vendor</span><b>${esc(p.vendor)}</b></div><div class="kv"><span>Order</span><b>${esc(p.order||'—')}</b></div><div class="kv"><span>Invoice</span><button class="linkbtn" onclick="openInvoiceGroup('${esc(p.invoice)}')">${esc(p.invoice||'—')}</button></div><div class="kv"><span>System</span><b>${esc(p.system)}</b></div><div class="kv"><span>Disposition</span><b>${esc(p.disposition)}</b></div><div class="kv"><span>Qty remaining</span><b>${p.remainingQty===''?'Unknown':esc(p.remainingQty)}</b></div><div class="detail-section"><label>Notes</label><div class="detail-text">${esc(p.notes||'No notes.')}</div></div></div></div><div><div class="detail-card"><h3>Links / Actions</h3>${pr?`<div class="kv click-row" onclick="openProjectDetail(${pr.id})"><span>Project</span><b>${esc(pr.title)}</b></div>`:'<div class="kv"><span>Project</span><b>Not linked</b></div>'}${linked?`<div class="kv click-row" onclick="openPartDetail(${linked.id})"><span>Inventory / part</span><b>${esc(linked.name)}</b></div>`:'<div class="kv"><span>Inventory / part</span><b>Not linked</b></div>'}${eq?`<div class="kv click-row" onclick="openComponentView('equipment',${eq.id})"><span>Equipment / component</span><b>${esc(eq.name)}</b></div>`:`<div class="kv"><span>Equipment</span><b>${p.trackAsEquipment?'Link pending':'Not tracked as equipment'}</b></div>`}${inv?`<div class="kv"><span>Invoice record</span><b>${esc(inv.invoice||p.invoice)}</b></div>`:''}<div class="action-row" style="margin-top:12px"><button class="primary" onclick="createReorderFromPurchase('${esc(p.id)}')">Create Reorder</button><button class="secondary" onclick="applyPurchaseToInventory('${esc(p.id)}')" ${p.inventoryApplied?'disabled':''}>${p.inventoryApplied?'Inventory Linked':'Link Inventory'}</button>${!eq?`<button class="secondary" onclick="trackPurchaseAsEquipment('${esc(p.id)}')">Track as Equipment</button>`:''}</div></div></div></div>`,true)}
function openPurchaseModal(id=null){const p=id?db.purchases.find(x=>String(x.id)===String(id)):{id:null,vendor:'Aircraft Spruce',order:'',invoice:'',shipDate:today(),pn:'',description:'',qty:1,unitPrice:'',disposition:'Unknown',remainingQty:'',location:'',projectId:null,system:'General',notes:''};if(!p)return;openModal(`${modalHeader(id?'Edit Purchase':'Add Purchase')}<div class="form-grid">${field('Vendor','puVendor',p.vendor)}${field('Ship date','puDate',p.shipDate,'date')}${field('Order','puOrder',p.order)}${field('Invoice','puInvoice',p.invoice)}${field('Part number','puPN',p.pn)}${field('Quantity','puQty',p.qty,'number','step="any"')}${field('Unit price','puPrice',p.unitPrice,'number','step="0.01" min="0"')}<div><label>System</label><select id="puSystem">${systemOptions(p.system)}</select></div><div><label>Disposition</label><select id="puDisposition">${['Unknown','On Hand','Installed','Consumed','Returned','Sold'].map(x=>`<option ${p.disposition===x?'selected':''}>${x}</option>`).join('')}</select></div>${field('Quantity remaining','puRemaining',p.remainingQty,'number','step="any" min="0"')}${field('Storage / installed location','puLocation',p.location)}<div class="full"><label>Linked project</label><select id="puProject">${projectOptions(p.projectId)}</select></div>${textareaField('Description','puDescription',p.description)}${textareaField('Notes','puNotes',p.notes)}<div class="full"><label style="text-transform:none;letter-spacing:0;display:flex;align-items:flex-start;gap:9px;cursor:pointer"><input id="puTrackEquipment" type="checkbox" ${p.trackAsEquipment?'checked':''} style="width:auto;margin-top:3px"><span><b>Track as equipment / major component</b><small style="display:block;margin-top:3px;color:var(--muted);font-weight:600">Automatically links this purchase to its inventory/component and Equipment record. Use for engines, avionics, tanks, propellers and other lifecycle-tracked hardware.</small></span></label></div></div><div class="modal-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="savePurchase('${esc(p.id||'')}')">Save Purchase</button></div>`)}
function savePurchase(id){
  const old=id?db.purchases.find(x=>String(x.id)===String(id)):null,pn=val('puPN').trim(),description=val('puDescription').trim();
  if(!description&&!pn)return alert('Enter a description or part number.');
  const selectedSystem=val('puSystem')||purchaseSystem(description,pn);
  const obj={...(old||{}),id:old?.id||crypto.randomUUID(),vendor:val('puVendor').trim()||'Vendor',order:val('puOrder').trim(),invoice:val('puInvoice').trim(),shipDate:val('puDate'),pn,description:description||pn,qty:num(val('puQty'))||1,unitPrice:num(val('puPrice')),system:selectedSystem,systemManual:true,disposition:val('puDisposition')||'Unknown',remainingQty:val('puRemaining')===''?'':num(val('puRemaining')),location:val('puLocation'),projectId:selectedNumber('puProject'),notes:val('puNotes'),source:old?.source||'Manual',sourceKey:old?.sourceKey||'',inventoryPartId:old?.inventoryPartId||null,inventoryApplied:!!old?.inventoryApplied,equipmentId:old?.equipmentId||null,trackAsEquipment:!!document.getElementById('puTrackEquipment')?.checked};
  if(old)Object.assign(old,obj);else db.purchases.push(obj);
  if(typeof window.reconcilePurchaseLinks==='function')window.reconcilePurchaseLinks(obj,{createPart:['On Hand','Installed'].includes(obj.disposition)||obj.inventoryApplied,createEquipment:obj.trackAsEquipment});
  closeModal();saveDB(old?'Purchase updated.':'Purchase added.');renderPurchases();
}
function openInvoiceGroup(invoice){const items=db.purchases.filter(x=>String(x.invoice)===String(invoice));if(!items.length)return;const total=items.reduce((s,x)=>s+purchaseLineTotal(x),0),order=[...new Set(items.map(x=>x.order).filter(Boolean))].join(', ');openModal(`${modalHeader(`Invoice ${invoice}`,`${items[0].vendor||'Vendor'}${order?' • Order '+order:''}`)}<div class="summary-strip"><div class="summary-cell"><div class="lab">Ship date</div><div class="val">${esc(items[0].shipDate||'—')}</div></div><div class="summary-cell"><div class="lab">Line items</div><div class="val">${items.length}</div></div><div class="summary-cell"><div class="lab">Line subtotal</div><div class="val">${fmtMoney(total)}</div></div><div class="summary-cell"><div class="lab">Original invoice</div><div class="val">Attach below</div></div></div><div class="detail-card"><h3>Items</h3>${items.map(p=>`<div class="kv click-row" onclick="openPurchaseDetail('${esc(p.id)}')"><div><b>${esc(p.pn||'—')} • ${esc(p.description)}</b><div class="task-note">Qty ${p.qty} @ ${fmtMoney(p.unitPrice)}</div></div><span>${fmtMoney(purchaseLineTotal(p))}</span></div>`).join('')}</div>${/^\d+$/.test(String(invoice))?`<div class="detail-card"><div class="section-tools"><h3>Invoice PDF / Receipt</h3><button class="icon-btn" onclick="chooseAttachments('purchase-invoice',${Number(invoice)})">+ Upload Invoice</button></div><div class="attach-drop" onclick="chooseAttachments('purchase-invoice',${Number(invoice)})" ondragover="event.preventDefault()" ondrop="handleEntityDrop(event,'purchase-invoice',${Number(invoice)})">Drop the original invoice PDF, receipt or screenshot here</div><div id="attachments-purchase-invoice-${Number(invoice)}"></div></div>`:'<div class="notice">Invoice attachment is available for numeric invoice IDs.</div>'}`,true);if(/^\d+$/.test(String(invoice)))renderAttachments('purchase-invoice',Number(invoice))}
function createReorderFromPurchase(id){const p=db.purchases.find(x=>String(x.id)===String(id));if(!p)return;const part=p.inventoryPartId?partById(Number(p.inventoryPartId)):db.parts.find(x=>x.partNo&&p.pn&&x.partNo.toLowerCase()===p.pn.toLowerCase());const oid=uid();db.orders.push({id:oid,item:p.description||p.pn,partId:part?.id||null,projectId:p.projectId||null,system:p.system||part?.system||'',qty:1,unit:part?.unit||'ea',vendor:p.vendor||'Aircraft Spruce',url:part?.url||'',unitPrice:p.unitPrice||'',shipping:'',tax:'',status:'Need to Order',orderedDate:'',eta:'',receivedDate:'',tracking:'',blockerReason:'',notes:`Reorder from purchase history${p.pn?` • PN ${p.pn}`:''}${p.invoice?` • prior invoice ${p.invoice}`:''}. Verify current specification and price before ordering.`,updates:[],inventoryApplied:false});saveDB('Reorder created.');openOrderDetail(oid)}
function applyPurchaseToInventory(id){
  const p=db.purchases.find(x=>String(x.id)===String(id));if(!p||p.inventoryApplied)return;
  if(typeof window.reconcilePurchaseLinks==='function'){
    const qty=p.remainingQty===''?num(p.qty):num(p.remainingQty);
    if(qty<=0&&p.disposition!=='Installed')return alert('Set a positive remaining quantity before linking this purchase to inventory.');
    window.reconcilePurchaseLinks(p,{createPart:true,createEquipment:p.trackAsEquipment,forceInventory:true});
    saveDB('Purchase inventory link saved.');openPurchaseDetail(id);return;
  }
  const qty=p.remainingQty===''?num(p.qty):num(p.remainingQty);if(qty<=0)return alert('Set a positive remaining quantity before adding this purchase to inventory.');
  let part=db.parts.find(x=>p.pn&&x.partNo&&x.partNo.toLowerCase()===p.pn.toLowerCase());
  if(!part){part={id:uid(),name:p.description||p.pn||'Purchased part',partNo:p.pn||'',system:p.system||'General',unit:'ea',stockQty:0,minQty:'',status:'On Hand',vendor:p.vendor||'',url:'',unitCost:p.unitPrice||'',location:p.location||'',purchaseDate:p.shipDate||'',notes:`Created from purchase history${p.invoice?` invoice ${p.invoice}`:''}.`,linkedProjectIds:p.projectId?[Number(p.projectId)]:[],updates:[]};db.parts.push(part)}
  part.stockQty=(part.stockQty===''?0:num(part.stockQty))+qty;
  if(p.projectId&&!part.linkedProjectIds.includes(Number(p.projectId)))part.linkedProjectIds.push(Number(p.projectId));
  p.inventoryPartId=part.id;p.inventoryApplied=true;p.disposition='On Hand';p.remainingQty=qty;
  saveDB(`${qty} added to inventory.`);openPurchaseDetail(id);
}

// Browser-side Aircraft Spruce CSV importer for future exports.
function parseCSVText(text){const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(q){if(c==='"'&&n==='"'){cell+='"';i++}else if(c==='"')q=false;else cell+=c}else if(c==='"')q=true;else if(c===','){row.push(cell);cell=''}else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell=''}else cell+=c}if(cell.length||row.length){row.push(cell);rows.push(row)}return rows}
async function importPurchaseCSVFile(file){if(!file)return;const text=await file.text(),rows=parseCSVText(text);if(rows.length<2)return alert('CSV appears empty.');const headers=rows[0].map(x=>x.trim()),idx=Object.fromEntries(headers.map((x,i)=>[x.toLowerCase(),i]));for(const need of ['order','invoice','pn','description','quantity','price'])if(idx[need]===undefined)return alert(`CSV is missing the “${need}” column.`);const existing=new Set(db.purchases.map(x=>x.sourceKey).filter(Boolean));let added=0,skipped=0;for(const r of rows.slice(1)){if(!r.some(x=>String(x).trim()))continue;const order=String(r[idx.order]||'').trim(),invoice=String(r[idx.invoice]||'').trim(),shipDate=purchaseDateISO(String(r[idx['ship date']]||'').trim()),pn=String(r[idx.pn]||'').trim(),description=String(r[idx.description]||'').trim(),qty=num(r[idx.quantity]),price=num(r[idx.price]);const key=['Aircraft Spruce',order,invoice,shipDate,pn,description,qty,price].join('|');if(existing.has(key)){skipped++;continue}existing.add(key);db.purchases.push({id:crypto.randomUUID(),vendor:'Aircraft Spruce',order,invoice,shipDate,pn,description,qty,unitPrice:price,system:purchaseSystem(description,pn),disposition:'Unknown',remainingQty:'',location:'',projectId:null,notes:'',source:'Aircraft Spruce CSV',sourceKey:key,inventoryPartId:null,inventoryApplied:false});added++}if(added){saveDB(`${added} purchase line${added===1?'':'s'} imported.`);renderPurchases()}toast(`${added} imported • ${skipped} duplicate${skipped===1?'':'s'} skipped.`,'good')}

// Add purchases to global search without changing the underlying search engine.
const renderSearchPageWbPurchaseBase=renderSearchPage;
renderSearchPage=async function(q=''){
  await renderSearchPageWbPurchaseBase(q);const term=(q||document.getElementById('globalSearchInput')?.value||'').trim().toLowerCase(),box=document.querySelector('#page-search .search-results');if(!term||!box)return;
  db.purchases.filter(x=>`${x.pn} ${x.description} ${x.invoice} ${x.order} ${x.vendor} ${x.notes}`.toLowerCase().includes(term)).slice(0,40).forEach(p=>box.insertAdjacentHTML('beforeend',`<button class="search-result" onclick="openPurchaseDetail('${esc(p.id)}')"><span class="mini-badge">Purchase</span><b>${esc(purchaseLabel(p))}</b><small>${esc(p.shipDate||'')} • Invoice ${esc(p.invoice||'—')} • ${fmtMoney(p.unitPrice)}</small></button>`));
  const count=box.querySelectorAll('.search-result').length,sub=document.querySelector('#page-search .toolbar .muted');if(sub)sub.textContent=`${count} result${count===1?'':'s'} for “${term}”`;if(count)box.querySelectorAll('.empty').forEach(x=>x.remove());
};

// Page rendering/navigation is coordinated centrally by app-61-performance.

const purchaseImportInput=document.getElementById('purchaseImportFile');if(purchaseImportInput)purchaseImportInput.addEventListener('change',async e=>{const f=e.target.files?.[0];e.target.value='';try{await importPurchaseCSVFile(f)}catch(err){alert('Could not import purchase CSV: '+err.message)}});
