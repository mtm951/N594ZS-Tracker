import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Production order/project/view/dependency modules run against disposable
// fixtures only. No database, GitHub Pages or aircraft data is modified.
const source=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const original=()=>({
  parts:[{id:1,name:'TEST LED',stockQty:0,status:'On Hand',unit:'ea',linkedProjectIds:[10],receiptHistory:[]}],
  orders:[{id:21,item:'TEST LED',projectId:10,partId:1,qty:4,receivedQty:0,
    linkedProjectIds:[],status:'Ordered',unit:'ea',unitPrice:10,shipping:0,tax:0,updates:[]}],
  projects:[
    {id:10,title:'TEST — Annunciator Installation',system:'Electrical',status:'Open',percent:0,priority:'Medium',partsUsed:[],updates:[],orderBlockers:[],blockers:'',summary:'',nextStep:''},
    {id:20,title:'TEST — Second Panel',system:'Electrical',status:'Open',percent:0,priority:'Medium',partsUsed:[],updates:[],orderBlockers:[],blockers:'',summary:'',nextStep:''},
    {id:30,title:'TEST — Alternative Panel',system:'Electrical',status:'Open',percent:0,priority:'Medium',partsUsed:[],updates:[],orderBlockers:[],blockers:'',summary:'',nextStep:''}
  ],
  logs:[],docs:[],checklists:[],settings:{showCosts:true,currency:'USD'}
});
function harness(db=original()){
  const nodes={},alerts=[],dialog=[],saves=[];
  const field=(value='')=>({value,innerHTML:'',style:{},dataset:{},closest:()=>null});
  nodes.olAddProject=field('');nodes.olPrimaryProject=field('');
  nodes.orderRows=field();nodes.projectRows=field();
  const doc={
    getElementById:id=>nodes[id]||null,
    createElement:()=>({textContent:'',id:'',style:{},classList:{add(){},remove(){}},setAttribute(){}}),
    addEventListener(){},head:{appendChild(){}},querySelectorAll:()=>[]
  };
  let nextId=100;
  const ctx={
    window:null,db,document:doc,console,JSON,Date,Map,Set,Number,String,Math,Boolean,Array,Promise,Error,structuredClone,
    RECORD_ARRAYS:{part:'parts',order:'orders',project:'projects',log:'logs'},
    arr:x=>Array.isArray(x)?x:[],num:x=>Number(x)||0,uid:()=>++nextId,today:()=> '2026-09-24',
    partById:id=>db.parts.find(p=>Number(p.id)===Number(id)),
    projectById:id=>db.projects.find(p=>Number(p.id)===Number(id)),
    orderById:id=>db.orders.find(o=>Number(o.id)===Number(id)),
    projectName:id=>db.projects.find(p=>Number(p.id)===Number(id))?.title||'Unlinked',
    partName:id=>db.parts.find(p=>Number(p.id)===Number(id))?.name||'Unlinked',
    selectedNumber:id=>Number(nodes[id]?.value)||null,
    val:id=>String(nodes[id]?.value??''),
    isClosedOrder:o=>['Received','Cancelled'].includes(o.status),
    orderTotal:o=>Number(o.qty)*Number(o.unitPrice||0)+Number(o.shipping||0)+Number(o.tax||0),
    projectCost:p=>db.orders.filter(o=>Number(o.projectId)===p.id)
      .reduce((sum,o)=>sum+Number(o.qty)*Number(o.unitPrice||0),0),
    consumedCost:()=>0,partAvailable:p=>p.stockQty,partConsumedQty:()=>0,isURL:()=>false,
    fmtMoney:n=>'$'+Number(n||0).toFixed(2),pill:x=>String(x??''),
    esc:x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
    modalHeader:()=>'',systemOptions:()=>'',partOptions:()=>'',field:()=>'',textareaField:()=>'',partOnOrderQty:()=>4,
    projectOptions:current=>'<option value="">— No linked project —</option>'+
      db.projects.map(p=>'<option value="'+p.id+'"'+(p.id===current?' selected':'')+'>'+p.title+'</option>').join(''),
    orderSystemName:()=>'',trackerRecordMatchesSystem:()=>true,
    openModal:html=>{dialog.push(html)},renderAttachments:()=>{},closeModal:()=>{},renderAll:()=>{},
    saveDB:message=>saves.push(message),confirm:()=>true,alert:message=>alerts.push(String(message)),toast:()=>{},
    currentDetail:null
  };
  ctx.window=ctx;
  vm.createContext(ctx);
  for(const module of ['app-17a-data-store.js','app-08-orders.js','app-06-projects.js','app-05-views.js','app-67-linked-order-blockers.js']){
    vm.runInContext(source(module),ctx,{filename:module});
  }
  return {db,ctx,nodes,alerts,dialog,saves,html:()=>dialog.at(-1)||''};
}

// Add multiple related projects to a single canonical Order. No order or
// inventory rows may be copied, and the Part is merely tagged, not credited.
{
  const h=harness(),{ctx,db,nodes}=h;
  ctx.openOrderDetail(21);
  assert.match(h.html(),/Linked Projects/);
  assert.match(h.html(),/\+ Add/);
  assert.match(h.html(),/Manage/);
  assert.match(h.html(),/TEST — Annunciator Installation/);
  ctx.openOrderProjectLinkModal(21);
  assert.match(h.html(),/Add another project/);
  assert.match(h.html(),/Change primary project/);
  nodes.olAddProject.value='20';ctx.addOrderProjectLink(21);
  nodes.olAddProject.value='30';ctx.addOrderProjectLink(21);
  assert.deepEqual(ctx.orderProjectIds(db.orders[0]),[10,20,30]);
  assert.equal(db.orders.length,1);
  assert.equal(db.parts[0].stockQty,0);
  assert.deepEqual(db.parts[0].linkedProjectIds,[10,20,30]);
  assert.equal(h.saves.length,2);
  assert.match(h.html(),/TEST — Second Panel/);
  assert.match(h.html(),/Make primary/);
  nodes.olAddProject.value='20';ctx.addOrderProjectLink(21);
  assert.equal(h.alerts.length,1);
  assert.equal(h.saves.length,2,'duplicate project link caused a write');
  ctx.openOrderDetail(21);
  assert.match(h.html(),/Linked Projects \(3\)/);
  assert.match(h.html(),/TEST — Alternative Panel/);
  assert.equal(ctx.projectCost(db.projects[0]),40);
  assert.equal(ctx.projectCost(db.projects[1]),0,'shared order duplicated cost');

  ctx.openProjectDetail(20);
  assert.match(h.html(),/TEST LED/);
  assert.match(h.html(),/Shared order/);
  assert.ok(ctx.projectCloseoutAudit(db.projects[1]).warnings.some(w=>w.label==='Open orders remain'));
  ctx.renderOrderRows();
  assert.match(nodes.orderRows.innerHTML,/TEST — Annunciator Installation, TEST — Second Panel, TEST — Alternative Panel/);
  nodes.orderSearch= {value:'Second Panel'};
  ctx.renderOrderRows();
  assert.match(nodes.orderRows.innerHTML,/TEST LED/,'search should match secondary projects');
  nodes.orderSearch.value='';

  ctx.makePrimaryOrderProjectLink(21,20);
  assert.equal(db.orders[0].projectId,20);
  assert.deepEqual(ctx.orderProjectIds(db.orders[0]),[20,30,10]);
  assert.equal(ctx.projectCost(db.projects[1]),40);
  assert.equal(ctx.projectCost(db.projects[0]),0);
  nodes.olPrimaryProject.value='30';ctx.saveOrderProjectLink(21);
  assert.equal(db.orders[0].projectId,30);
  assert.deepEqual(ctx.orderProjectIds(db.orders[0]),[30,10]);
  ctx.removeOrderProjectLink(21,10);
  assert.deepEqual(ctx.orderProjectIds(db.orders[0]),[30]);
  ctx.removeOrderProjectLink(21,30);
  assert.deepEqual(ctx.orderProjectIds(db.orders[0]),[]);
  assert.equal(db.orders[0].projectId,null);
  assert.equal(db.parts[0].stockQty,0);
  assert.equal(db.orders.length,1);
}

// Changing the primary through the normal Order editor preserves unrelated
// secondary links. Removing a project promotes the next association and
// leaves the original Order, its receipt quantities and parts unchanged.
{
  const h=harness(),{ctx,db,nodes}=h;
  db.orders[0].linkedProjectIds=[20,30];
  ctx.deleteProject(10);
  assert.equal(db.projects.length,2);
  assert.equal(db.orders[0].projectId,20);
  assert.deepEqual(ctx.orderProjectIds(db.orders[0]),[20,30]);
  assert.equal(db.orders[0].receivedQty,0);
  assert.equal(db.parts[0].stockQty,0);

  // Edits to the standard single primary dropdown cannot drop related links.
  const elements={orItem:{value:'TEST LED'},orProject:{value:'30'},orPart:{value:'1'},
    orSystem:{value:'Electrical'},orQty:{value:'4'},orUnit:{value:'ea'},orVendor:{value:''},
    orUrl:{value:''},orPrice:{value:'10'},orShipping:{value:'0'},orTax:{value:'0'},
    orStatus:{value:'Ordered'},orOrdered:{value:''},orEta:{value:''},
    orReceived:{value:''},orTracking:{value:''},orBlocker:{value:''},orNotes:{value:''}};
  Object.assign(nodes,elements);
  ctx.saveOrder(21);
  assert.equal(db.orders[0].projectId,30);
  assert.deepEqual(ctx.orderProjectIds(db.orders[0]),[30]);
  assert.equal(db.orders[0].receivedQty,0);
}

// A separate project may explicitly block on an order linked as "related".
// One receipt resolves both projects' independent blockers but credits stock
// once, even though two project views show the same Order.
{
  const h=harness(),{ctx,db,nodes}=h;
  nodes.olAddProject.value='20';ctx.addOrderProjectLink(21);
  db.projects[0].blockers='';db.projects[1].blockers='';
  const first=ctx.saveMultiOrderBlocker(10,null,'First project needs 2 LEDs','all',
    [{orderId:21,requiredQty:2}],true,false);
  const second=ctx.saveMultiOrderBlocker(20,null,'Second project needs 2 LEDs','all',
    [{orderId:21,requiredQty:2}],true,false);
  assert.equal(db.projects[0].status,'Blocked');
  assert.equal(db.projects[1].status,'Blocked');
  ctx.trackerStore.batch(tx=>ctx.applyOrderReceipt(tx,21,1,'2026-09-24'),{message:'Received one'});
  assert.equal(db.projects[0].status,'Blocked');
  assert.equal(db.projects[1].status,'Blocked');
  ctx.trackerStore.batch(tx=>ctx.applyOrderReceipt(tx,21,1,'2026-09-24'),{message:'Received another'});
  assert.equal(db.projects[0].status,'In Progress');
  assert.equal(db.projects[1].status,'In Progress');
  assert.equal(db.projects[0].orderBlockers.find(b=>b.id===first).status,'resolved');
  assert.equal(db.projects[1].orderBlockers.find(b=>b.id===second).status,'resolved');
  assert.equal(db.orders[0].receivedQty,2);
  assert.equal(db.parts[0].stockQty,2);
  assert.equal(db.orders.length,1);
}

// Do not alter relationships while an atomic receipt is unresolved.
{
  const h=harness(),{ctx,db,nodes}=h;
  ctx.atomicReceiptOutbox={hasPending:()=>true};
  nodes.olAddProject.value='20';
  ctx.addOrderProjectLink(21);
  assert.deepEqual(ctx.orderProjectIds(db.orders[0]),[10]);
  assert.equal(h.saves.length,0);
  assert.match(h.alerts[0],/pending atomic inventory transaction/);
}

console.log('Order multiple project links, UI, ownership, shared blocker and inventory tests passed');
