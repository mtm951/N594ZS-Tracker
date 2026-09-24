// ---------- ORDERS ----------
// The original projectId remains the PRIMARY for cost attribution and older
// integrations. linkedProjectIds stores additional associations only; it
// does not duplicate an order, stock receipt, reservation, or purchase.
function orderProjectIds(o){
  const ids=[o?.projectId,...arr(o?.linkedProjectIds)].map(Number).filter(id=>Number.isSafeInteger(id)&&id>0);
  return [...new Set(ids)];
}
function orderLinkedToProject(o,projectId){return orderProjectIds(o).includes(Number(projectId))}
function orderProjectSummary(o){
  const ids=orderProjectIds(o);
  return ids.length?ids.map(id=>projectName(id)).join(', '):'—';
}
function orderProjectLinksHTML(o,id){
  const linked=orderProjectIds(o);
  const entries=linked.map((pid,index)=>{
    const project=projectById(pid);
    return '<div class="kv" style="gap:8px;align-items:center">'+
      '<button class="linkbtn" onclick="openProjectDetail('+pid+')" title="Open project">'+esc(project?.title||'Missing project')+'</button>'+
      '<span class="task-note">'+(index===0?'Primary':'Related')+'</span>'+
      '<button class="icon-btn" onclick="removeOrderProjectLink('+Number(id)+','+pid+')" title="Remove this association">Remove</button></div>';
  }).join('');
  return '<div class="detail-card" id="orderLinkedProjectsCard">'+
    '<div class="section-tools"><h3>Linked Projects'+(linked.length?' ('+linked.length+')':'')+'</h3>'+
    '<div class="action-row"><button class="icon-btn" onclick="openOrderProjectLinkModal('+Number(id)+')">+ Add</button>'+
    '<button class="icon-btn" onclick="openOrderProjectLinkModal('+Number(id)+')">Manage</button></div></div>'+
    (entries||'<div class="muted">No project linked. Select + Add to associate this order with a project.</div>')+
    '<div class="tiny muted" style="margin-top:8px">One physical order and receipt. Only the primary project receives this order\'s cost allocation; related projects share the reference.</div></div>';
}
function orderGroupKey(o){const ref=String(o?.tracking||'').trim().toLowerCase();return ref?`ref:${ref}`:`single:${o?.id}`}
function orderReceivedQty(o){if(o?.receivedQty!==undefined&&o?.receivedQty!=='')return Math.min(num(o.qty),Math.max(0,num(o.receivedQty)));if(o?.inventoryAppliedQty!==undefined&&o?.inventoryAppliedQty!=='')return Math.min(num(o.qty),Math.max(0,num(o.inventoryAppliedQty)));return o?.inventoryApplied?num(o.qty):0}
function orderRemainingQty(o){return Math.max(0,num(o?.qty)-orderReceivedQty(o))}
function orderGroupItems(key){return db.orders.filter(o=>orderGroupKey(o)===key)}
function openOrderModal(id=null,projectId=null,partId=null){
  const draft=id?orderById(id):{item:partId?partName(partId):'',partId:partId||null,projectId:projectId||null,system:'',qty:1,unit:partId?(partById(partId)?.unit||'ea'):'ea',vendor:partId?(partById(partId)?.vendor||''):'',url:partId?(partById(partId)?.url||''):'',unitPrice:partId?(partById(partId)?.unitCost||''):'',shipping:'',tax:'',status:'Need to Order',orderedDate:'',eta:'',receivedDate:'',tracking:'',blockerReason:'',notes:''};
  const inherited=typeof inferredOrderSystem==='function'?inferredOrderSystem(draft):'';
  const o=draft;
  openModal(`${modalHeader(id?'Edit Order':'New Order')}<div class="form-grid"><div class="full order-item-autocomplete"><label for="orItem">Item / order description</label><input id="orItem" type="search" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="orItemSuggestions" placeholder="Type to search existing inventory or enter a new item…" value="${esc(o.item)}" onfocus="renderOrderItemSuggestions()" oninput="orderItemTyped()" onkeydown="orderItemSuggestionKeys(event)"><div id="orItemSuggestions" class="order-item-suggestions" role="listbox" hidden></div><small class="order-item-help">Select an existing part to link its inventory record automatically, or enter a custom description.</small></div><div><label>Primary project (cost attribution)</label><select id="orProject">${projectOptions(o.projectId)}</select><small>Manage additional linked projects from the order details after saving.</small></div><div><label>Linked inventory part</label><select id="orPart" onchange="prefillOrderFromPart();hideOrderItemSuggestions()">${partOptions(o.partId)}</select></div><div><label>System</label><select id="orSystem">${systemOptions(o.system||inherited)}</select><small>${o.system?'Directly assigned':inherited?`Currently inherited from linked record: ${esc(inherited)}`:'Assign directly or link a project/part'}</small></div>${field('Quantity','orQty',o.qty,'number','step="any" min="0"')}${field('Unit','orUnit',o.unit||'ea')}${field('Vendor','orVendor',o.vendor)}${field('Unit price','orPrice',o.unitPrice,'number','step="0.01" min="0"')}${field('Shipping','orShipping',o.shipping,'number','step="0.01" min="0"')}${field('Tax','orTax',o.tax,'number','step="0.01" min="0"')}<div><label>Status</label><select id="orStatus">${['Need to Order','Quoted','Ordered','Backordered','Received','Cancelled'].map(x=>`<option ${o.status===x?'selected':''}>${x}</option>`).join('')}</select></div>${field('Ordered date','orOrdered',o.orderedDate,'date')}${field('ETA','orEta',o.eta,'date')}${field('Received date','orReceived',o.receivedDate,'date')}${field('Tracking / reference','orTracking',o.tracking)}<div class="full"><label>Vendor / product URL</label><input id="orUrl" value="${esc(o.url)}"></div>${textareaField('Blocker / why this order matters','orBlocker',o.blockerReason)}${textareaField('Order notes','orNotes',o.notes)}</div><div class="modal-actions"><button class="btn secondary" onclick="closeModal()">Cancel</button>${id?`<button class="btn danger" onclick="deleteOrder(${id})">Delete</button>`:''}<button class="btn primary" onclick="saveOrder(${id||'null'})">Save Order</button></div>`);
}
function prefillOrderFromPart(){const p=partById(selectedNumber('orPart'));if(!p)return;if(!val('orItem'))document.getElementById('orItem').value=p.name;document.getElementById('orUnit').value=p.unit||'ea';if(!val('orVendor'))document.getElementById('orVendor').value=p.vendor||'';if(!val('orPrice'))document.getElementById('orPrice').value=p.unitCost??'';if(!val('orUrl'))document.getElementById('orUrl').value=p.url||'';if(!val('orSystem'))document.getElementById('orSystem').value=p.system||''}
// Autocomplete deliberately leaves the description editable. Selecting a hit
// links its EXISTING inventory part; typing freeform creates no inventory record.
let orderItemSuggestionActive=0;
function orderItemMatches(q){
  if(!q)return [];
  const text=String(q).toLowerCase();
  const rank=p=>{
    const name=String(p.name||'').toLowerCase(),pn=String(p.partNo||'').toLowerCase();
    return name.startsWith(text)?0:pn.startsWith(text)?1:name.includes(text)?2:3;
  };
  return arr(db.parts).filter(p=>[p.name,p.partNo,p.vendor,p.system]
    .some(v=>String(v||'').toLowerCase().includes(text)))
    .sort((a,b)=>rank(a)-rank(b)||String(a.name||'').localeCompare(String(b.name||'')))
    .slice(0,8);
}
function hideOrderItemSuggestions(){
  const box=document.getElementById('orItemSuggestions'),input=document.getElementById('orItem');
  if(box){box.hidden=true;box.innerHTML=''}
  if(input){input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant')}
}
function renderOrderItemSuggestions(){
  const input=document.getElementById('orItem'),box=document.getElementById('orItemSuggestions');
  if(!input||!box)return;
  const q=input.value.trim(),matches=orderItemMatches(q);
  if(!q){hideOrderItemSuggestions();return}
  if(!matches.length){
    box.innerHTML='<div class="order-item-no-match">No matching part. You can enter a new item.</div>';
    box.hidden=q.length<2;input.setAttribute('aria-expanded',String(!box.hidden));
    input.removeAttribute('aria-activedescendant');
    return;
  }
  orderItemSuggestionActive=0;
  box.innerHTML=matches.map((p,i)=>
    `<button type="button" role="option" aria-selected="${i===0}" class="order-item-suggestion${i===0?' active':''}" id="order-suggest-${p.id}" data-part-id="${esc(p.id)}" onclick="chooseOrderItemSuggestion(${Number(p.id)})"><b>${esc(p.name)}${p.partNo?' • '+esc(p.partNo):''}</b><small>${esc(p.system||'General')}${p.vendor?' • '+esc(p.vendor):''} • Link existing inventory</small></button>`
  ).join('');
  box.hidden=false;input.setAttribute('aria-expanded','true');
  input.setAttribute('aria-activedescendant','order-suggest-'+matches[0].id);
}
function orderItemTyped(){
  const input=document.getElementById('orItem'),linked=document.getElementById('orPart');
  if(input?.dataset.autoPartId&&input.value.trim()!==input.dataset.autoPartName){
    if(linked&&linked.value===input.dataset.autoPartId)linked.value='';
    delete input.dataset.autoPartId;
    delete input.dataset.autoPartName;
  }
  renderOrderItemSuggestions();
}
function chooseOrderItemSuggestion(id){
  const p=partById(Number(id)),input=document.getElementById('orItem'),linked=document.getElementById('orPart');
  if(!p||!input||!linked)return;
  input.value=p.name;
  input.dataset.autoPartId=String(p.id);
  input.dataset.autoPartName=p.name;
  linked.value=String(p.id);
  prefillOrderFromPart();
  hideOrderItemSuggestions();
}
function orderItemSuggestionKeys(event){
  const box=document.getElementById('orItemSuggestions'),input=document.getElementById('orItem');
  if(!box||box.hidden)return;
  const buttons=[...box.querySelectorAll('[data-part-id]')];
  if(event.key==='Escape'){
    event.preventDefault();event.stopPropagation();hideOrderItemSuggestions();return;
  }
  if(!buttons.length)return;
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault();
    orderItemSuggestionActive=(orderItemSuggestionActive+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
    buttons.forEach((b,i)=>{b.classList.toggle('active',i===orderItemSuggestionActive);b.setAttribute('aria-selected',String(i===orderItemSuggestionActive))});
    input?.setAttribute('aria-activedescendant',buttons[orderItemSuggestionActive].id);
    return;
  }
  if(event.key==='Enter'){
    event.preventDefault();chooseOrderItemSuggestion(Number(buttons[orderItemSuggestionActive].dataset.partId));
  }
}
document.addEventListener('click',e=>{
  const box=document.getElementById('orItemSuggestions');
  if(box&&!e.target.closest?.('.order-item-autocomplete'))hideOrderItemSuggestions();
});

function saveOrder(id){
  const o={item:val('orItem'),projectId:selectedNumber('orProject'),partId:selectedNumber('orPart'),system:val('orSystem'),qty:num(val('orQty'))||1,unit:val('orUnit')||'ea',vendor:val('orVendor'),url:val('orUrl'),unitPrice:val('orPrice'),shipping:val('orShipping'),tax:val('orTax'),status:val('orStatus'),orderedDate:val('orOrdered'),eta:val('orEta'),receivedDate:val('orReceived'),tracking:val('orTracking'),blockerReason:val('orBlocker'),notes:val('orNotes')};
  if(!o.item)return alert('Order item is required.');

  if(id){
    trackerStore.update('order',id,draft=>{Object.assign(draft,o);draft.linkedProjectIds=arr(draft.linkedProjectIds).map(Number).filter(pid=>pid>0&&pid!==Number(draft.projectId));if(!draft.projectId&&draft.linkedProjectIds.length)draft.projectId=draft.linkedProjectIds.shift();},{persist:false});
  }else{
    const newId=uid();
    trackerStore.write('order',newId,{id:newId,...o,linkedProjectIds:[],updates:[],inventoryApplied:false},{persist:false});
  }

  const savedOrder=id?orderById(id):db.orders[db.orders.length-1];
  if(savedOrder?.partId){const p=partById(savedOrder.partId);if(p){p.linkedProjectIds=arr(p.linkedProjectIds);for(const pid of orderProjectIds(savedOrder))if(!p.linkedProjectIds.some(x=>Number(x)===pid))p.linkedProjectIds.push(pid)}}

  closeModal();
  trackerStore.commit(id?'Order updated.':'Order added.');
}
function deleteOrder(id){if(!confirm('Delete this order record?'))return;db.orders=db.orders.filter(x=>x.id!==id);closeModal();saveDB('Order deleted.')}
function openCreatePartFromOrder(orderId){
  const o=orderById(orderId);if(!o)return;
  const status=o.status==='Backordered'?'Backordered':'Order';
  openModal(`${modalHeader('Create Inventory Part','Linked to this order with zero on hand')}<div class="notice" style="margin-bottom:12px">The ordered quantity remains separate from inventory until you mark the order received.</div><div class="form-grid"><div class="full"><label>Part / material name</label><input id="opName" value="${esc(o.item)}"></div>${field('Part number / specification','opPN','')}<div><label>System</label><select id="opSystem">${systemOptions('General')}</select></div>${field('Unit','opUnit',o.unit||'ea')}<div><label>Status</label><select id="opStatus">${['Order','Backordered'].map(x=>`<option ${status===x?'selected':''}>${x}</option>`).join('')}</select></div>${field('Vendor / source','opVendor',o.vendor)}${field('Unit price','opCost',o.unitPrice,'number','step="0.01" min="0"')}<div class="full"><label>Product / vendor URL</label><input id="opUrl" value="${esc(o.url||'')}"></div>${field('Storage location after receipt','opLocation','')}${textareaField('Notes / specifications','opNotes',`Created from order ${o.tracking||o.item}. Quantity on order: ${o.qty} ${o.unit||'ea'}.`)}</div><div class="modal-actions"><button class="btn secondary" onclick="openOrderDetail(${orderId})">Cancel</button><button class="btn primary" onclick="savePartFromOrder(${orderId})">Create & Link Part</button></div>`);
}
function savePartFromOrder(orderId){
  const o=orderById(orderId);if(!o)return;
  const name=val('opName').trim();if(!name)return alert('Part name is required.');
  const pid=uid();
  db.parts.push({id:pid,name,partNo:val('opPN').trim(),system:val('opSystem')||'General',unit:val('opUnit')||o.unit||'ea',stockQty:0,minQty:'',status:val('opStatus')||'Order',vendor:val('opVendor'),url:val('opUrl'),unitCost:val('opCost'),location:val('opLocation'),purchaseDate:'',notes:val('opNotes'),linkedProjectIds:orderProjectIds(o),updates:[]});
  o.partId=pid;
  saveDB('Inventory part created with zero on hand and linked to the order.');
  openOrderDetail(orderId);
}
function openOrderProjectLinkModal(orderId){
  const o=orderById(orderId);if(!o)return;
  const linked=orderProjectIds(o);
  const rowsHTML=linked.map((id,i)=>'<div class="kv" style="gap:8px"><div><b>'+esc(projectName(id))+'</b><div class="tiny muted">'+(i===0?'Primary • full order cost attributed here':'Related • no duplicate stock or cost')+'</div></div>'+
    '<div class="action-row">'+(i===0?'':'<button class="icon-btn" onclick="makePrimaryOrderProjectLink('+Number(orderId)+','+id+')">Make primary</button>')+
    '<button class="icon-btn" onclick="removeOrderProjectLink('+Number(orderId)+','+id+')">Remove</button></div></div>').join('');
  openModal(modalHeader('Manage Linked Projects',o.item)+
    '<div class="notice">Associate one order with multiple projects without copying the order or receiving its parts twice. The primary project owns its cost attribution; related projects can reference the same order.</div>'+
    '<div class="detail-card" style="margin-top:12px"><h3>Current links</h3>'+(rowsHTML||'<div class="muted">No projects linked.</div>')+'</div>'+
    '<div class="form-grid" style="margin-top:12px"><div class="full"><label>Add another project</label><select id="olAddProject">'+projectOptions(null)+'</select></div>'+
    '<div class="full"><button class="btn primary" onclick="addOrderProjectLink('+Number(orderId)+')">+ Add Project</button></div>'+
    '<div class="full"><label>Change primary project</label><select id="olPrimaryProject">'+projectOptions(o.projectId)+'</select>'+
    '<small>Changing primary replaces that primary link and moves the order\'s project cost attribution. Other related links remain. Selecting No linked project promotes the next related project if one exists.</small></div></div>'+
    '<div class="modal-actions"><button class="btn secondary" onclick="openOrderDetail('+Number(orderId)+')">Done</button>'+
    '<button class="btn primary" onclick="saveOrderProjectLink('+Number(orderId)+')">Change Primary</button></div>',true);
}
function commitOrderProjectLinks(orderId,change,message){
  if(window.atomicReceiptOutbox?.hasPending?.())throw new Error('Finish or review the pending atomic inventory transaction before changing order links.');
  return trackerStore.batch(tx=>{
    const before=tx.read('order',orderId);if(!before)throw new Error('Order no longer exists.');
    const result=tx.update('order',orderId,d=>{
      change(d);
      const links=orderProjectIds(d);
      d.projectId=links[0]??null;
      d.linkedProjectIds=links.slice(1);
    });
    // Preserve existing primary-order behavior: tag the linked Part with
    // project associations, but NEVER reserve or credit inventory here.
    const part=result.partId?tx.read('part',result.partId):null;
    if(part){
      const missing=orderProjectIds(result).filter(pid=>!arr(part.linkedProjectIds).some(id=>Number(id)===pid));
      if(missing.length)tx.update('part',part.id,d=>{d.linkedProjectIds=[...arr(d.linkedProjectIds),...missing]});
    }
    return result;
  },{message});
}
function addOrderProjectLink(orderId){
  const pid=selectedNumber('olAddProject');
  if(!pid||!projectById(pid))return alert('Select a valid project to add.');
  const o=orderById(orderId);if(!o)return;
  if(orderLinkedToProject(o,pid))return alert('This project is already linked to the order.');
  try{commitOrderProjectLinks(orderId,d=>{if(d.projectId)d.linkedProjectIds=[...arr(d.linkedProjectIds),pid];else d.projectId=pid;},'Project added to order.');
      openOrderProjectLinkModal(orderId);}
  catch(e){alert('Project link was not saved: '+e.message)}
}
function saveOrderProjectLink(orderId){
  const pid=selectedNumber('olPrimaryProject');
  if(pid&&!projectById(pid))return alert('The selected project no longer exists.');
  try{commitOrderProjectLinks(orderId,d=>{
    d.linkedProjectIds=arr(d.linkedProjectIds).filter(x=>Number(x)!==pid);
    d.projectId=pid||null;
  },'Primary project updated.');openOrderProjectLinkModal(orderId);}
  catch(e){alert('Primary project was not changed: '+e.message)}
}
function makePrimaryOrderProjectLink(orderId,pid){
  const o=orderById(orderId);if(!o||!orderLinkedToProject(o,pid)||Number(o.projectId)===Number(pid))return;
  if(!confirm('Make '+projectName(pid)+' the primary project? The order\'s full cost attribution will move there; its previous primary remains a related project.'))return;
  try{commitOrderProjectLinks(orderId,d=>{
    d.linkedProjectIds=[...arr(d.linkedProjectIds).filter(x=>Number(x)!==Number(pid)),...(d.projectId?[d.projectId]:[])];
    d.projectId=pid;
  },'Primary project changed.');openOrderProjectLinkModal(orderId);}
  catch(e){alert('Primary project was not changed: '+e.message)}
}
function removeOrderProjectLink(orderId,pid){
  const o=orderById(orderId);if(!o||!orderLinkedToProject(o,pid))return;
  const primary=Number(o.projectId)===Number(pid);
  const extras=arr(o.linkedProjectIds).filter(x=>Number(x)!==Number(pid));
  const text=primary?(extras.length?'Removing the primary project will promote the next related project and move cost attribution to it. Continue?':'Remove the only linked project? The order will no longer have project cost attribution.'):
    'Remove '+projectName(pid)+' from this order? This does not remove existing project blockers or part assignments.';
  const project=projectById(pid);
  const relatedBlockers=arr(project?.orderBlockers).filter(b=>b.status==='waiting'&&
    (Number(b.orderId)===Number(orderId)||arr(b.dependencies).some(dep=>Number(dep.orderId)===Number(orderId))));
  const warning=relatedBlockers.length?'\nThis project still has '+relatedBlockers.length+' waiting blocker dependency'+(relatedBlockers.length===1?'':'ies')+' on this order. Removing the link will NOT delete or resolve the blocker. Review it separately.':'';
  if(!confirm(text+warning))return;
  try{commitOrderProjectLinks(orderId,d=>{
    const remaining=orderProjectIds(d).filter(x=>Number(x)!==Number(pid));
    d.projectId=remaining[0]??null;d.linkedProjectIds=remaining.slice(1);
  },'Project link removed.');openOrderProjectLinkModal(orderId);}
  catch(e){alert('Project link was not removed: '+e.message)}
}
function openOrderPartLinkModal(orderId){
  const o=orderById(orderId);if(!o)return;
  openModal(`${modalHeader(o.partId?'Change Linked Part':'Link Inventory Part',o.item)}<div class="notice">Choose the inventory item that should receive this order. Stock is not increased until quantity is received.</div><div class="form-grid" style="margin-top:12px"><div class="full"><label>Inventory part</label><select id="olPart">${partOptions(o.partId)}</select></div></div><div class="modal-actions"><button class="btn secondary" onclick="openOrderDetail(${orderId})">Cancel</button>${o.partId?'':`<button class="btn secondary" onclick="openCreatePartFromOrder(${orderId})">Create New Part</button>`}<button class="btn primary" onclick="saveOrderPartLink(${orderId})">Save Part Link</button></div>`);
}
function saveOrderPartLink(orderId){
  const o=orderById(orderId);if(!o)return;
  const partId=selectedNumber('olPart');o.partId=partId;
  if(partId){const p=partById(partId);if(p){p.linkedProjectIds=arr(p.linkedProjectIds);for(const pid of orderProjectIds(o))if(!p.linkedProjectIds.some(x=>Number(x)===pid))p.linkedProjectIds.push(pid)}}
  closeModal();saveDB(partId?'Order linked to inventory part.':'Inventory part link removed.');setTimeout(()=>openOrderDetail(orderId),50);
}
function applyOrderReceipt(tx,orderId,qty,receiptDate=''){
  const o=tx.read('order',orderId);
  if(!o)throw new Error('Order is no longer available.');
  const remaining=orderRemainingQty(o),amount=Math.min(remaining,Math.max(0,num(qty)));
  if(!amount)return 0;
  // Keep an immutable receipt event on the affected Part, not only on the
  // Order: the inventory audit survives changing or deleting that order.
  // The shared ID links it to the existing Order Updates timeline.
  const updateId=uid(),date=receiptDate||today(),receivedAt=new Date().toISOString();
  if(o.partId){
    tx.update('part',o.partId,p=>{
      p.stockQty=(p.stockQty===''?0:num(p.stockQty))+amount;
      if(['Order','Backordered','Need'].includes(p.status)&&amount>=remaining)p.status='On Hand';
      p.receiptHistory=arr(p.receiptHistory);
      p.receiptHistory.push({
        id:updateId,orderUpdateId:updateId,orderId:o.id,date,receivedAt,
        qty:amount,unit:o.unit||p.unit||'ea',item:o.item||p.name||'',
        vendor:o.vendor||'',tracking:o.tracking||''
      });
    });
  }
  tx.update('order',orderId,draft=>{
    draft.receivedQty=orderReceivedQty(draft)+amount;
    draft.inventoryAppliedQty=draft.receivedQty;
    draft.inventoryApplied=draft.receivedQty>=num(draft.qty);
    if(draft.inventoryApplied){draft.status='Received';draft.receivedDate=draft.receivedDate||today()}
    else if(!['Ordered','Backordered','Shipped'].includes(draft.status))draft.status='Ordered';
    if(receiptDate)draft.receivedDate=receiptDate;
    draft.updates=arr(draft.updates);
    draft.updates.push({id:updateId,date,text:`Received ${amount} ${draft.unit||'ea'}${draft.inventoryApplied?' (line complete)':' (partial receipt)'}.`});
  });
  return amount;
}
function openReceiveOrderModal(id){const o=orderById(id);if(!o)return;const remaining=orderRemainingQty(o);if(!remaining)return receiveOrder(id);const noPartWarning=o.partId?'':'<div class="warning" style="margin-top:10px"><b>No linked inventory Part.</b> This receipt updates the Order only and will not increase stock. For atomic Order + Part testing, cancel and link or create a test Part first. Linking afterward does not credit earlier receipts.</div>';openModal(`${modalHeader('Receive Order Item',o.item)}<div class="notice" data-receipt-editor="single">${esc(orderReceivedQty(o)+' of '+o.qty+' '+(o.unit||'ea'))} already received. ${esc(remaining+' '+(o.unit||'ea'))} remaining.</div>${noPartWarning}<div class="form-grid" style="margin-top:12px">${field('Quantity received now','orReceiveQty',remaining,'number',`step="any" inputmode="decimal" min="0.000001" max="${remaining}"`)}${field('Received date','orReceiveDate',today(),'date')}</div><div class="modal-actions"><button class="btn secondary" onclick="openOrderDetail(${id})">Cancel</button><button class="btn success" onclick="savePartialOrderReceipt(${id})">Receive</button></div>`)}
// v5.19.13: receipt updates use the scoped trackerStore transaction, not
// captured live db rows. Cloud sync remains async until the new atomic RPC
// is integrated with a durable browser-side operation queue.
function runOrderReceiptBatch(work,message){
  try{
    // Explicit per-device opt-in. All ordinary receipts continue through the
    // existing tested local batch until atomic receipt testing is enabled.
    if(window.atomicReceiptOutbox?.shouldHandle())return window.atomicReceiptOutbox.stage(work,message);
    return trackerStore.batch(work,{message});
  }
  catch(error){
    console.error('Order receipt failed',error);
    alert('Receipt could not be completed. Review the order and cloud sync status before retrying: '+error.message);
    return null;
  }
}
function validateOrderReceiptPart(o){
  if(o.partId&&!partById(o.partId))throw new Error('Linked inventory part is missing for '+o.item+'.');
}
function savePartialOrderReceipt(id){
  const o=orderById(id);if(!o)return;
  const qty=num(val('orReceiveQty')),remaining=orderRemainingQty(o);
  if(!(qty>0)||qty>remaining)return alert(`Enter a quantity from 0 to ${remaining}.`);
  const date=val('orReceiveDate');
  const applied=runOrderReceiptBatch(tx=>{
    validateOrderReceiptPart(o);
    return applyOrderReceipt(tx,id,qty,date);
  },o.partId?'Receipt saved and inventory increased.':'Receipt saved.');
  if(applied===null)return;
  closeModal();setTimeout(()=>openOrderDetail(id),50);
}
function receiveOrder(id){
  const o=orderById(id);if(!o)return;
  const remaining=orderRemainingQty(o);
  if(!remaining){
    const result=runOrderReceiptBatch(tx=>{
      tx.update('order',id,draft=>{
        draft.status='Received';draft.inventoryApplied=true;draft.receivedDate=draft.receivedDate||today();
      });
      return true;
    },'Order marked received. Inventory had already been applied.');
    if(result!==null)openOrderDetail(id);
    return;
  }
  openReceiveOrderModal(id);
}
function receiveOrderGroup(key){
  const items=orderGroupItems(key).filter(o=>orderRemainingQty(o)>0&&!isClosedOrder(o));
  if(!items.length)return alert('This order has no remaining quantity to receive.');
  const label=items[0].tracking||items[0].vendor||'this order';
  if(!confirm(`Receive all ${items.length} remaining line item${items.length===1?'':'s'} for ${label}? Linked inventory quantities will be increased.`))return;
  const expectedTotal=items.reduce((n,o)=>n+orderRemainingQty(o),0);
  const total=runOrderReceiptBatch(tx=>{
    let applied=0;
    for(const o of items){
      validateOrderReceiptPart(o);
      applied+=applyOrderReceipt(tx,o.id,orderRemainingQty(o));
    }
    return applied;
  },`${label} received. ${expectedTotal} total units were processed.`);
  if(total!==null)renderOrders();
}
function receiveOrderGroupFor(orderId){const o=orderById(orderId);if(o)receiveOrderGroup(orderGroupKey(o))}
function openReceiveOrderGroupModal(orderId){
  const first=orderById(orderId);if(!first)return;
  const items=orderGroupItems(orderGroupKey(first)).filter(o=>orderRemainingQty(o)>0&&!isClosedOrder(o));if(!items.length)return alert('This order has no remaining quantity to receive.');
  const label=first.tracking||first.vendor||'Order';
  const rows=items.map(o=>`<div class="group-receipt-row"><div><b>${esc(o.item)}</b><div class="task-note">${esc(orderReceivedQty(o)+' received • '+orderRemainingQty(o)+' '+(o.unit||'ea')+' remaining')}${o.partId?'':' • No inventory part linked'}</div></div><div><label>Received now</label><input id="ogr-${o.id}" type="number" step="any" min="0" max="${orderRemainingQty(o)}" value="0" inputmode="decimal"><small>${esc(o.unit||'ea')}</small></div></div>`).join('');
  openModal(`${modalHeader('Receive Part of Order',label)}<div class="notice">Enter only the quantities that arrived today. Anything left at zero remains on order.</div><div class="group-receipt-list" data-receipt-editor="group">${rows}</div><div class="form-grid"><div>${field('Received date','ogrDate',today(),'date')}</div></div><div class="modal-actions"><button class="btn secondary" onclick="closeModal()">Cancel</button><button class="btn success" onclick="saveOrderGroupReceipt(${orderId})">Receive Selected Items</button></div>`,true);
}
function saveOrderGroupReceipt(orderId){
  const first=orderById(orderId);if(!first)return;
  const items=orderGroupItems(orderGroupKey(first)).filter(o=>orderRemainingQty(o)>0&&!isClosedOrder(o));
  // Validate every row before touching inventory. Previously a bad second row
  // could leave the first row modified in memory without saving.
  const plan=[];
  for(const o of items){
    const raw=document.getElementById(`ogr-${o.id}`)?.value??'0';
    const qty=Number(raw),remaining=orderRemainingQty(o);
    if(!Number.isFinite(qty)||qty<0||qty>remaining)
      return alert(`Enter a quantity from 0 to ${remaining} for ${o.item}.`);
    if(qty>0)plan.push({o,qty});
  }
  if(!plan.length)return alert('Enter a received quantity for at least one item.');
  const date=val('ogrDate');
  const total=plan.reduce((sum,row)=>sum+row.qty,0);
  const result=runOrderReceiptBatch(tx=>{
    for(const {o,qty} of plan){
      validateOrderReceiptPart(o);
      applyOrderReceipt(tx,o.id,qty,date);
    }
    return total;
  },`Partial receipt saved for ${first.tracking||first.vendor||'order'}: ${total} total units across ${plan.length} line${plan.length===1?'':'s'}.`);
  if(result===null)return;
  closeModal();renderOrders();
}
function openOrderDetail(id){
  const o=orderById(id);if(!o)return;currentDetail={type:'order',id};
  const p=o.partId?partById(o.partId):null,pr=o.projectId?projectById(o.projectId):null;
  openModal(`${modalHeader(o.item,`${o.vendor||'No vendor'} • ${o.status}`)}<div class="summary-strip"><div class="summary-cell"><div class="lab">Status</div><div class="val">${pill(o.status)}</div></div><div class="summary-cell"><div class="lab">Ordered</div><div class="val">${esc(o.qty)} ${esc(o.unit||'')}</div></div><div class="summary-cell"><div class="lab">Received</div><div class="val">${esc(orderReceivedQty(o))} ${esc(o.unit||'')}</div></div><div class="summary-cell"><div class="lab">Remaining</div><div class="val">${esc(orderRemainingQty(o))} ${esc(o.unit||'')}</div></div><div class="summary-cell"><div class="lab">ETA</div><div class="val">${esc(o.eta||'—')}</div></div><div class="summary-cell"><div class="lab">Total</div><div class="val">${db.settings.showCosts?fmtMoney(orderTotal(o)):'Hidden'}</div></div></div>
  <div class="detail-grid"><div><div class="detail-card"><div class="section-tools"><h3>Order Details</h3><button class="icon-btn" onclick="openOrderModal(${id})">Edit</button></div><div class="grid"><div class="span-6"><div class="kv"><span>Vendor</span><b>${esc(o.vendor||'—')}</b></div><div class="kv"><span>Unit price</span><b>${db.settings.showCosts?fmtMoney(o.unitPrice):'Hidden'}</b></div><div class="kv"><span>Shipping</span><b>${db.settings.showCosts?fmtMoney(o.shipping):'Hidden'}</b></div><div class="kv"><span>Tax</span><b>${db.settings.showCosts?fmtMoney(o.tax):'Hidden'}</b></div></div><div class="span-6"><div class="kv"><span>Ordered</span><b>${esc(o.orderedDate||'—')}</b></div><div class="kv"><span>Received</span><b>${esc(o.receivedDate||'—')}</b></div><div class="kv"><span>Tracking / ref.</span><b>${esc(o.tracking||'—')}</b></div><div class="kv"><span>Inventory applied</span><b>${o.inventoryApplied?'Yes':'No'}</b></div></div></div>${o.blockerReason?`<div class="detail-section"><label>Why this order matters / blocker</label><div class="danger-note">${esc(o.blockerReason)}</div></div>`:''}<div class="detail-section"><label>Notes</label><div class="detail-text">${esc(o.notes||'No notes.')}</div></div>${isURL(o.url)?`<button class="btn secondary" style="margin-top:10px" onclick="window.open('${esc(o.url)}','_blank')">Open Vendor / Product Page</button>`:''}</div>
  <div class="detail-card"><div class="section-tools"><h3>Files / Order Screenshots / Invoice</h3><button class="icon-btn" onclick="chooseAttachments('order',${id})">+ Upload</button></div><div class="attach-drop" onclick="chooseAttachments('order',${id})" ondragover="event.preventDefault()" ondrop="handleEntityDrop(event,'order',${id})">Drop order screenshots, invoices, receipts or tracking documents here</div><div id="attachments-order-${id}"></div></div></div>
  <div><div class="detail-card"><div class="section-tools"><h3>Aircraft System</h3><button class="icon-btn" onclick="openOrderModal(${id})">Change</button></div><div class="kv"><span>${esc(typeof orderSystemName==='function'?(orderSystemName(o)||'Unassigned'):(o.system||pr?.system||p?.system||'Unassigned'))}</span><b>${o.system?'Directly assigned':'Inherited from linked record'}</b></div></div>${orderProjectLinksHTML(o,id)}<div class="detail-card entity-link-card ${p?'':'entity-link-empty'}" onclick="${p?`openPartDetail(${p.id})`:`openOrderPartLinkModal(${id})`}"><div class="section-tools"><h3>Linked Part</h3><button class="icon-btn" onclick="event.stopPropagation();openOrderPartLinkModal(${id})">${p?'Change':'+ Link'}</button></div>${p?`<div class="kv"><span>${esc(p.name)}</span><span>${pill(p.status)}<br><small>${esc((typeof partOnOrderQty==='function'?partOnOrderQty(p.id):0)+' '+(p.unit||'ea'))} on order</small></span></div>`:'<div class="muted">No inventory part linked. Click anywhere in this card to choose or create one.</div>'}</div><div class="detail-card"><div class="section-tools"><h3>Order Updates</h3><button class="icon-btn" onclick="addEntityUpdate('order',${id})">+ Update</button></div>${o.updates.length?`<div class="timeline">${[...o.updates].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(u=>`<div class="timeline-item"><div class="timeline-date">${esc(u.date)}</div><div class="timeline-body">${esc(u.text)}</div></div>`).join('')}</div>`:'<div class="muted">No updates.</div>'}</div>${o.status!=='Received'&&o.status!=='Cancelled'?`<div class="detail-card"><button class="btn success" onclick="receiveOrder(${id})">Receive ${orderRemainingQty(o)} ${esc(o.unit||'ea')}${o.partId?' into Inventory':''}</button>${o.partId?'':'<div class="tiny muted" style="margin-top:8px">Link or create an inventory part first if this item should increase inventory.</div>'}</div>`:''}</div></div>`,true);renderAttachments('order',id)
}
