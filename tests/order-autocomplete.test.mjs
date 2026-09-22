import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// The production autocomplete uses the same inventory objects and IDs as Orders.
// These fixtures never touch Supabase or the user's aircraft inventory.
const source=fs.readFileSync(new URL('../app-08-orders.js',import.meta.url),'utf8');
const parts=[
  {id:21,name:'AN-5 Fuel Fitting',partNo:'AN816-5D',system:'Fuel',vendor:'Aircraft Spruce',unit:'ea',unitCost:12,url:'https://example.test/an5'},
  {id:22,name:'AN-5 Elbow',partNo:'AN822-5D',system:'Fuel',vendor:'Another supplier',unit:'ea',unitCost:19,url:''},
  {id:30,name:'DG17 Clamp',partNo:'DG17',system:'Cooling',vendor:'Aircraft Spruce',unit:'ea',unitCost:5,url:''}
];
const nodes={};
function input(value=''){
  const attributes={};
  return {
    value,dataset:{},attributes,focus(){},
    setAttribute(k,v){attributes[k]=String(v)},
    removeAttribute(k){delete attributes[k]}
  };
}
for(const id of ['orItem','orPart','orUnit','orVendor','orPrice','orUrl','orSystem']){
  nodes[id]=input(id==='orUnit'?'ea':'');
}
nodes.orItemSuggestions={
  hidden:true,innerHTML:'',
  querySelectorAll(){
    return [...this.innerHTML.matchAll(/data-part-id="(\d+)"/g)].map((match,i)=>{
      const id=match[1],attrs={};
      return {id:'order-suggest-'+id,dataset:{partId:id},classList:{toggle(){}},setAttribute(k,v){attrs[k]=v},attributes:attrs};
    });
  }
};
let opened='';
const ctx={
  console,document:{getElementById:id=>nodes[id]||null,addEventListener:()=>{}},
  window:null,db:{parts,orders:[],projects:[]},
  arr:value=>Array.isArray(value)?value:[],
  esc:x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
  partById:id=>parts.find(p=>p.id===Number(id)),
  partName:id=>parts.find(p=>p.id===Number(id))?.name||'',
  selectedNumber:id=>nodes[id]?.value?Number(nodes[id].value):null,
  val:id=>String(nodes[id]?.value||''),
  modalHeader:()=>'',projectOptions:()=>'',partOptions:()=>'',systemOptions:()=>'',field:()=>'',textareaField:()=>'',openModal:html=>{opened=html}
};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'app-08-orders.js'});

// The new-order modal offers live inventory suggestions without requiring
// users to open a separate giant Linked Inventory Part dropdown.
ctx.openOrderModal();
assert.match(opened,/id="orItemSuggestions"/);
assert.match(opened,/oninput="orderItemTyped\(\)"/);
assert.match(opened,/aria-autocomplete="list"/);
assert.match(opened,/type="search"/);

// Match name AND part number; don't suggest unrelated inventory.
nodes.orItem.value='an-5';
ctx.renderOrderItemSuggestions();
assert.equal(nodes.orItemSuggestions.hidden,false);
assert.match(nodes.orItemSuggestions.innerHTML,/AN-5 Fuel Fitting/);
assert.match(nodes.orItemSuggestions.innerHTML,/AN-5 Elbow/);
assert.doesNotMatch(nodes.orItemSuggestions.innerHTML,/DG17 Clamp/);

// Clicking a suggestion links the SAME EXISTING record and prefills metadata.
// No order or new part is created merely by choosing a suggestion.
ctx.chooseOrderItemSuggestion(21);
assert.equal(nodes.orItem.value,'AN-5 Fuel Fitting');
assert.equal(nodes.orPart.value,'21');
assert.equal(nodes.orVendor.value,'Aircraft Spruce');
assert.equal(nodes.orUnit.value,'ea');
assert.equal(String(nodes.orPrice.value),'12');
assert.equal(nodes.orUrl.value,'https://example.test/an5');
assert.equal(nodes.orSystem.value,'Fuel');
assert.equal(nodes.orItemSuggestions.hidden,true);
assert.equal(ctx.db.parts.length,3);
assert.equal(ctx.db.orders.length,0);

// If the user edits an AUTO-selected label into a custom description,
// clear only that autocomplete link rather than crediting the wrong part.
nodes.orItem.value='Different custom tubing';
ctx.orderItemTyped();
assert.equal(nodes.orPart.value,'');
assert.equal(nodes.orItem.dataset.autoPartId,undefined);

// Editing the description of an existing manually linked order must NOT
// silently clear the user's explicitly chosen inventory part.
nodes.orPart.value='22';
nodes.orItem.value='Custom order package';
ctx.orderItemTyped();
assert.equal(nodes.orPart.value,'22');

// Native keyboard paths must work as well as tapping suggestions.
nodes.orItem.value='AN-5';
ctx.renderOrderItemSuggestions();
let prevented=0,stopped=0;
ctx.orderItemSuggestionKeys({key:'ArrowDown',preventDefault(){prevented++},stopPropagation(){stopped++}});
ctx.orderItemSuggestionKeys({key:'Enter',preventDefault(){prevented++},stopPropagation(){stopped++}});
assert.equal(nodes.orPart.value,'22');
assert.equal(nodes.orItem.value,'AN-5 Elbow');
assert.equal(prevented,2);
nodes.orItem.value='AN-5';
ctx.renderOrderItemSuggestions();
ctx.orderItemSuggestionKeys({key:'Escape',preventDefault(){prevented++},stopPropagation(){stopped++}});
assert.equal(nodes.orItemSuggestions.hidden,true);
assert.equal(stopped,1);

console.log('order autocomplete UI and keyboard regression tests passed');
