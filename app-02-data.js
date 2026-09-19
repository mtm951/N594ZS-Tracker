function migrateV2(v2){
  const out=clone(SEED);
  if(v2.aircraft) out.aircraft={...out.aircraft,...v2.aircraft};
  if(Array.isArray(v2.maintenance)) out.projects=v2.maintenance.map(x=>({
    id:x.id||uid(),title:x.title||'Untitled project',system:x.system||'General',priority:x.priority||'Medium',status:x.status||'Open',trigger:x.trigger||'',percent:x.status==='Done'?100:0,
    summary:x.notes||'',plan:x.detailNotes||x.notes||'',nextStep:'',blockers:'',
    partsUsed:arr(x.partsUsed).map(p=>({id:p.id||uid(),partId:p.partId||null,name:p.name||'',qty:num(p.qty)||1,unit:p.unit||'ea',unitCost:p.unitCost||p.cost||'',notes:p.notes||''})),updates:arr(x.updates)
  }));
  if(Array.isArray(v2.parts)) out.parts=v2.parts.map(p=>({id:p.id||uid(),name:p.name||'Part',partNo:p.partNo||'',system:p.system||'General',unit:p.unit||'ea',stockQty:Number.isFinite(Number(p.qty))?Number(p.qty):'',minQty:'',status:p.status||'On Hand',vendor:p.vendor||p.source||'',url:p.url||'',unitCost:p.unitCost||p.cost||'',location:p.location||'',purchaseDate:p.purchaseDate||'',notes:p.notes||'',linkedProjectIds:arr(p.linkedProjectIds),updates:arr(p.updates)}));
  if(Array.isArray(v2.logs)) out.logs=v2.logs.map(l=>({id:l.id||uid(),date:l.date||today(),airframeHours:l.airframeHours||l.hours||'',engineHours:l.engineHours||'',laborHours:l.laborHours||'',system:l.system||'General',projectIds:arr(l.projectIds),work:l.work||'',observations:l.observations||'',blockers:l.blockers||'',nextStep:l.nextStep||l.follow||'',consumedParts:arr(l.consumedParts),otherCost:l.otherCost||'',notes:l.notes||''}));
  if(Array.isArray(v2.docs)) out.docs=v2.docs.map(d=>({id:d.id||uid(),name:d.name||'Document',type:d.type||'',revision:d.revision||'',issueDate:d.issueDate||'',system:d.system||'',publisher:d.publisher||'',location:d.location||'',notes:d.notes||'',linkedProjectIds:arr(d.linkedProjectIds),linkedPartIds:arr(d.linkedPartIds),linkedLogIds:arr(d.linkedLogIds),updates:arr(d.updates)}));
  if(Array.isArray(v2.checklists)) out.checklists=v2.checklists.map(c=>({id:c.id||uid(),name:c.name||'Checklist',purpose:c.purpose||'',system:c.system||'',trigger:c.trigger||'',projectId:c.projectId||null,notes:c.notes||'',items:arr(c.items).map(i=>({id:i.id||uid(),text:i.text||'',done:!!i.done,note:i.note||''}))}));
  if(v2.settings) out.settings={...out.settings,...v2.settings};
  const derived=[];
  out.projects.forEach(p=>arr(v2.maintenance?.find(x=>x.id===p.id)?.toOrder).forEach(o=>derived.push({id:o.id||uid(),item:o.name||'Order item',partId:o.partId||null,projectId:p.id,qty:num(o.qty)||1,unit:o.unit||'ea',vendor:o.vendor||'',url:o.url||'',unitPrice:o.unitPrice||o.cost||'',shipping:'',tax:'',status:o.status||'Need to Order',orderedDate:'',eta:'',receivedDate:'',tracking:'',blockerReason:'',notes:o.notes||'',updates:[],inventoryApplied:false})));
  out.orders=derived;
  return out;
}

function loadDB(){
  try{
    const raw=localStorage.getItem(DB_KEY); if(raw) return JSON.parse(raw);
    const old=localStorage.getItem(OLD_DB_KEY); if(old) return migrateV2(JSON.parse(old));
  }catch(e){console.warn('Could not load local data',e)}
  return clone(SEED);
}
let db=loadDB();
let currentPage='dashboard';
let currentDetail=null;
let objectUrls=[];

function normalizeDB(){
  db.version=3;
  db.aircraft={...clone(SEED.aircraft),...(db.aircraft||{})};
  db.projects=arr(db.projects);db.parts=arr(db.parts);db.orders=arr(db.orders);db.logs=arr(db.logs);db.docs=arr(db.docs);db.checklists=arr(db.checklists);db.systems=arr(db.systems);db.settings={...clone(SEED.settings),...(db.settings||{})};
  db.projects.forEach(x=>{x.partsUsed=arr(x.partsUsed);x.updates=arr(x.updates);x.percent=Math.max(0,Math.min(100,num(x.percent)));x.summary=x.summary||'';x.plan=x.plan||'';x.nextStep=x.nextStep||'';x.blockers=x.blockers||''});
  db.parts.forEach(x=>{x.linkedProjectIds=arr(x.linkedProjectIds);x.updates=arr(x.updates);if(x.stockQty===undefined)x.stockQty='';if(x.minQty===undefined)x.minQty='';x.partNo=x.partNo||'';x.vendor=x.vendor||'';x.url=x.url||'';x.location=x.location||'';x.purchaseDate=x.purchaseDate||''});
  db.orders.forEach(x=>{x.updates=arr(x.updates);x.partId=x.partId||null;x.projectId=x.projectId||null;x.system=x.system||'';x.inventoryApplied=!!x.inventoryApplied;x.blockerReason=x.blockerReason||''});
  db.logs.forEach(x=>{x.projectIds=arr(x.projectIds);x.consumedParts=arr(x.consumedParts);x.observations=x.observations||'';x.blockers=x.blockers||'';x.nextStep=x.nextStep||'';x.notes=x.notes||''});
  db.docs.forEach(x=>{x.linkedProjectIds=arr(x.linkedProjectIds);x.linkedPartIds=arr(x.linkedPartIds);x.linkedLogIds=arr(x.linkedLogIds);x.updates=arr(x.updates);x.revision=x.revision||'';x.issueDate=x.issueDate||'';x.system=x.system||'';x.publisher=x.publisher||'';x.notes=x.notes||''});
  db.checklists.forEach(c=>{c.items=arr(c.items);c.purpose=c.purpose||'';c.system=c.system||'';c.trigger=c.trigger||'';c.notes=c.notes||'';c.projectId=c.projectId||null;c.items.forEach(i=>{i.note=i.note||''})});
}
normalizeDB();
