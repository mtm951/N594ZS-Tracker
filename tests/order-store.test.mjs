import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const storeSource=fs.readFileSync(new URL('../app-17a-data-store.js',import.meta.url),'utf8');
const orderSource=fs.readFileSync(new URL('../app-08-orders.js',import.meta.url),'utf8');

function makeHarness(values={}){
  let nextId=1000;
  const saves=[],snapshots=[],alerts=[];
  const db={
    orders:[{
      id:501,
      item:'EarthX warning light',
      projectId:109,
      partId:206,
      system:'Electrical',
      qty:5,
      unit:'ea',
      vendor:'Aircraft Spruce',
      url:'https://example.test/light',
      unitPrice:'29.50',
      shipping:'7.00',
      tax:'0',
      status:'Ordered',
      orderedDate:'2026-09-19',
      eta:'2026-09-24',
      receivedDate:'2026-09-20',
      tracking:'18374415',
      blockerReason:'Needed before first start',
      notes:'Existing note',
      receivedQty:2,
      inventoryAppliedQty:2,
      inventoryApplied:false,
      updates:[{id:1,date:'2026-09-20',text:'Received 2 ea (partial receipt).'}],
      customMetadata:{source:'test'}
    }],
    parts:[{
      id:206,
      name:'EarthX warning light',
      stockQty:2,
      linkedProjectIds:[109],
      status:'On Hand'
    },{
      id:300,
      name:'AN fitting',
      stockQty:4,
      linkedProjectIds:[],
      status:'On Hand'
    }],
    projects:[{id:109,title:'Electrical final inspection'}],
    logs:[],docs:[],checklists:[],settings:{showCosts:true}
  };

  const context={
    console,JSON,Object,Array,String,Number,Boolean,Map,Set,Error,Date,Math,Promise,
    structuredClone,
    window:null,
    document:{getElementById:()=>null},
    RECORD_ARRAYS:{order:'orders'},
    db,
    arr:v=>Array.isArray(v)?v:[],
    num:v=>Number(v)||0,
    uid:()=>++nextId,
    today:()=> '2026-09-21',
    val:id=>String(values[id]??''),
    selectedNumber:id=>{
      const raw=values[id];
      if(raw===undefined||raw===null||raw==='')return null;
      const n=Number(raw);return Number.isFinite(n)?n:null;
    },
    saveDB:message=>{saves.push(message);snapshots.push(structuredClone(db));},
    alert:message=>alerts.push(message),
    confirm:()=>true,
    closeModal:()=>{},
    openModal:()=>{},
    modalHeader:()=>'',field:()=>'',textareaField:()=>'',projectOptions:()=>'',partOptions:()=>'',systemOptions:()=>'',esc:x=>String(x??''),
    orderById:id=>db.orders.find(x=>String(x.id)===String(id)),
    partById:id=>db.parts.find(x=>String(x.id)===String(id)),
    projectById:id=>db.projects.find(x=>String(x.id)===String(id)),
    partName:id=>db.parts.find(x=>String(x.id)===String(id))?.name||'',
    pill:x=>String(x??''),fmtMoney:x=>String(x??''),orderTotal:()=>0,isURL:()=>false,isClosedOrder:()=>false,
    chooseAttachments:()=>{},handleEntityDrop:()=>{},renderAttachments:()=>Promise.resolve(),
    addEntityUpdate:()=>{},openProjectDetail:()=>{},openPartDetail:()=>{},renderOrders:()=>{},
    currentDetail:null
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(storeSource,context,{filename:'app-17a-data-store.js'});
  vm.runInContext(orderSource,context,{filename:'app-08-orders.js'});
  return {context,db,saves,snapshots,alerts};
}

// Ordinary order edit goes through trackerStore but preserves receipt/inventory history fields.
{
  const h=makeHarness({
    orItem:'EarthX 5MM12 warning light',
    orProject:'109',
    orPart:'206',
    orSystem:'Electrical',
    orQty:'6',
    orUnit:'ea',
    orVendor:'Aircraft Spruce',
    orUrl:'https://example.test/new-light',
    orPrice:'31.00',
    orShipping:'8.00',
    orTax:'1.50',
    orStatus:'Backordered',
    orOrdered:'2026-09-19',
    orEta:'2026-09-27',
    orReceived:'2026-09-20',
    orTracking:'18374415',
    orBlocker:'Needed before first start',
    orNotes:'Updated note'
  });
  h.context.saveOrder(501);

  const o=h.db.orders[0],part=h.db.parts[0];
  assert.equal(o.item,'EarthX 5MM12 warning light');
  assert.equal(o.qty,6);
  assert.equal(o.status,'Backordered');
  assert.equal(o.receivedQty,2,'ordinary edit changed received quantity');
  assert.equal(o.inventoryAppliedQty,2,'ordinary edit changed applied inventory quantity');
  assert.equal(o.inventoryApplied,false,'ordinary edit changed inventory-applied state');
  assert.deepEqual(o.updates,[{id:1,date:'2026-09-20',text:'Received 2 ea (partial receipt).'}]);
  assert.equal(o.customMetadata.source,'test');
  assert.equal(part.stockQty,2,'ordinary order edit changed physical inventory');
  assert.deepEqual(h.saves,['Order updated.']);
}

// A new order can link a part/project, but it must not receive inventory merely by being created.
// The one commit happens after the cross-record relationship is updated.
{
  const h=makeHarness({
    orItem:'AN-5 fuel fitting',
    orProject:'109',
    orPart:'300',
    orSystem:'Fuel',
    orQty:'3',
    orUnit:'ea',
    orVendor:'Aircraft Spruce',
    orUrl:'',
    orPrice:'12.00',
    orShipping:'5.00',
    orTax:'0',
    orStatus:'Ordered',
    orOrdered:'2026-09-21',
    orEta:'2026-09-25',
    orReceived:'',
    orTracking:'TEST-ORDER',
    orBlocker:'',
    orNotes:'For return line'
  });
  h.context.saveOrder(null);

  assert.equal(h.db.orders.length,2);
  const o=h.db.orders[1],part=h.db.parts[1];
  assert.equal(o.id,1001);
  assert.equal(o.item,'AN-5 fuel fitting');
  assert.equal(o.partId,300);
  assert.equal(o.projectId,109);
  assert.equal(o.inventoryApplied,false);
  assert.deepEqual(o.updates,[]);
  assert.equal(part.stockQty,4,'creating an order increased physical inventory');
  assert.deepEqual(part.linkedProjectIds,[109],'order creation did not preserve part/project relationship');
  assert.deepEqual(h.saves,['Order added.']);
  assert.deepEqual(h.snapshots[0].parts[1].linkedProjectIds,[109],'relationship update happened after persistence');
}

// Changing ordinary order fields never invokes the receipt engine implicitly.
{
  const h=makeHarness({
    orItem:'EarthX warning light',
    orProject:'109',
    orPart:'206',
    orSystem:'Electrical',
    orQty:'5',
    orUnit:'ea',
    orVendor:'Aircraft Spruce',
    orUrl:'',
    orPrice:'29.50',
    orShipping:'7.00',
    orTax:'0',
    orStatus:'Received',
    orOrdered:'2026-09-19',
    orEta:'2026-09-24',
    orReceived:'2026-09-21',
    orTracking:'18374415',
    orBlocker:'',
    orNotes:'Status edited only'
  });
  h.context.saveOrder(501);

  const o=h.db.orders[0],part=h.db.parts[0];
  assert.equal(o.status,'Received');
  assert.equal(o.receivedQty,2);
  assert.equal(o.inventoryApplied,false);
  assert.equal(part.stockQty,2);
  assert.equal(o.updates.length,1);
  assert.deepEqual(h.saves,['Order updated.']);
}

// Existing validation still blocks an empty item description.
{
  const h=makeHarness({
    orItem:'',orProject:'109',orPart:'206',orSystem:'Electrical',orQty:'1',
    orUnit:'ea',orVendor:'',orUrl:'',orPrice:'',orShipping:'',orTax:'',
    orStatus:'Ordered',orOrdered:'',orEta:'',orReceived:'',orTracking:'',
    orBlocker:'',orNotes:''
  });
  const before=structuredClone(h.db);
  h.context.saveOrder(501);
  assert.deepEqual(h.db,before);
  assert.equal(h.saves.length,0);
  assert.equal(h.alerts.length,1);
}

console.log('order tracker-store regression tests passed');
