'use strict';
// v5.19.26 — Explicit many-to-many order dependencies with ALL / ANY.
// Existing v5.19.25 single-order blockers are read unchanged. Never infer
// relationships from a project's free-text blocker, and never credit stock
// merely because a previously received order is linked.
(function(){
  if(window.__n594zsLinkedOrderBlockersInstalled)return;
  window.__n594zsLinkedOrderBlockersInstalled=true;

  const rows=x=>Array.isArray(x)?x:[];
  const same=(a,b)=>String(a??'')===String(b??'');
  const numeric=x=>Number.isFinite(Number(x))?Number(x):0;
  const received=o=>{
    if(typeof window.orderReceivedQty==='function')return window.orderReceivedQty(o);
    if(o?.receivedQty!==undefined&&o.receivedQty!=='')return numeric(o.receivedQty);
    if(o?.inventoryAppliedQty!==undefined&&o.inventoryAppliedQty!=='')return numeric(o.inventoryAppliedQty);
    return o?.inventoryApplied?numeric(o.qty):0;
  };
  const belongs=(o,id)=>typeof window.orderLinkedToProject==='function'?orderLinkedToProject(o,id):
    same(o.projectId,id)||rows(o.linkedProjectIds).some(pid=>same(pid,id));
  const projectOrders=p=>rows(db.orders).filter(o=>belongs(o,p.id)&&o.status!=='Cancelled');
  const availableOrders=p=>rows(db.orders).filter(o=>o.status!=='Cancelled'&&numeric(o.qty)>0)
    .sort((a,b)=>(belongs(b,p.id)?1:0)-(belongs(a,p.id)?1:0)||
      String(a.item||'').localeCompare(String(b.item||'')));
  const deps=b=>rows(b.dependencies).length?b.dependencies:
    (b.orderId!=null?[{orderId:b.orderId,requiredQty:b.requiredQty}]:[]);
  const mode=b=>b?.mode==='any'?'any':'all';
  const waiting=p=>rows(p?.orderBlockers).filter(b=>b.status==='waiting'&&b.holdsProject!==false);
  const isManual=b=>b?.kind==='manual';
  const isHeld=s=>s==='Held Up'||s==='Blocked';
  const pending=()=>!!window.atomicReceiptOutbox?.hasPending?.();
  const findOrder=(id,tx)=>tx?.read('order',id)||
    rows(db.orders).find(o=>same(o.id,id))||null;
  const orderName=id=>findOrder(id)?.item||'Missing order';
  const satisfied=(dep,tx)=>{
    const o=findOrder(dep.orderId,tx);
    return !!o&&o.status!=='Cancelled'&&numeric(dep.requiredQty)>0&&
      received(o)+1e-9>=numeric(dep.requiredQty);
  };
  function ready(blocker,tx){
    const d=deps(blocker);
    return !isManual(blocker)&&d.length>0&&(mode(blocker)==='any'?
      d.some(item=>satisfied(item,tx)):d.every(item=>satisfied(item,tx)));
  }
  function finishIfReady(p){
    if(p.orderBlockerHeld===true&&p.status!=='Done'&&!waiting(p).length&&
       !String(p.blockers||'').trim()){
      if(isHeld(p.status))p.status='In Progress';
      p.orderBlockerHeld=false;
    }
  }
  function resolve(p,b,source,date,receiptOrderId=null,receiptUpdateId=null,tx=null){
    if(b.status!=='waiting'||!ready(b,tx))return false;
    const all=deps(b),met=all.filter(d=>satisfied(d,tx));
    b.status='resolved';
    b.resolvedAt=new Date().toISOString();
    b.resolvedDate=date||today();
    b.resolvedBy=source;
    b.receiptOrderId=receiptOrderId;
    b.receiptUpdateId=receiptUpdateId;
    b.receivedQtyAtResolution=receiptOrderId==null?null:received(findOrder(receiptOrderId,tx));
    b.satisfiedOrderIds=met.map(d=>d.orderId);
    p.updates=rows(p.updates);
    p.updates.push({id:uid(),date:b.resolvedDate,
      text:'Order blocker resolved: '+b.description+' ('+mode(b).toUpperCase()+
        ' requirement; '+met.map(d=>orderName(d.orderId)).join(', ')+
        (source==='existing-receipt'?'; already received':'; receipt')+').'});
    return true;
  }
  // Wrap the original order receipt INSIDE its existing scoped transaction.
  // An order may satisfy several independent blockers across many projects.
  const baseReceipt=window.applyOrderReceipt;
  if(typeof baseReceipt!=='function')throw new Error('Order receipt must load before linked blockers.');
  window.applyOrderReceipt=function(tx,orderId,qty,date){
    const applied=baseReceipt(tx,orderId,qty,date);
    if(!(applied>0))return applied;
    const order=tx.read('order',orderId);
    if(!order)return applied;
    const last=rows(order.updates).at(-1);
    for(const current of rows(db.projects)){
      const project=tx.read('project',current.id);
      if(!project||!rows(project.orderBlockers).some(b=>b.status==='waiting'&&
         deps(b).some(d=>same(d.orderId,orderId))&&ready(b,tx)))continue;
      tx.update('project',current.id,p=>{
        let changed=false;
        for(const b of rows(p.orderBlockers)){
          if(deps(b).some(d=>same(d.orderId,orderId)))
            changed=resolve(p,b,'receipt',date||today(),orderId,last?.id??null,tx)||changed;
        }
        if(changed)finishIfReady(p);
      });
    }
    return applied;
  };

  // A new blocker may reference any existing non-cancelled order, including
  // one formally assigned to another project. We do NOT alter that order's
  // original project, purchase attribution, stock or receipt history.
  function saveGroup(projectId,blockerId,description,dependencyMode,dependencies,holds,moveLegacy,manual=false){
    if(pending())throw new Error('An atomic inventory transaction is pending. Sync or review it first.');
    if(!manual&&!['all','any'].includes(dependencyMode))throw new Error('Choose ALL or ANY.');
    const note=String(description||'').trim();
    if(!note)throw new Error('Describe what is being held up.');
    if(!manual&&(!Array.isArray(dependencies)||!dependencies.length||dependencies.length>20))
      throw new Error('Select between 1 and 20 required orders.');
    const normalized=(manual?[]:dependencies).map(dep=>({
      orderId:Number(dep.orderId),requiredQty:Number(dep.requiredQty)
    }));
    return trackerStore.batch(tx=>{
      const p=tx.read('project',projectId);
      if(!p)throw new Error('Project no longer exists.');
      if(p.status==='Done')throw new Error('Reopen the completed project before linking active blockers.');
      const ids=new Set();
      for(const d of normalized){
        const order=tx.read('order',d.orderId);
        if(!order||order.status==='Cancelled')throw new Error('Selected order is missing or cancelled.');
        if(!Number.isFinite(d.requiredQty)||d.requiredQty<=0||
           d.requiredQty>numeric(order.qty)+1e-9)
          throw new Error('Required quantity exceeds the ordered quantity or is invalid for '+order.item+'.');
        if(ids.has(String(d.orderId)))throw new Error('Select each order once within a blocker. The same order can support other blockers.');
        ids.add(String(d.orderId));
      }
      const existing=blockerId==null?null:rows(p.orderBlockers).find(b=>same(b.id,blockerId));
      if(blockerId!=null&&(!existing||existing.status!=='waiting'))
        throw new Error('Only an existing waiting blocker can be edited.');
      if(moveLegacy&&(!String(p.blockers||'').trim()||blockerId!=null))
        throw new Error('The existing free-text blocker changed. Reopen the project.');
      // Several blockers may use the same description, provided they refer
      // to different orders. Prevent an accidental duplicate of the SAME
      // manual issue or of the same described order requirement.
      if(!existing&&rows(p.orderBlockers).some(b=>b.status==='waiting'&&
          String(b.description||'').trim().toLowerCase()===note.toLowerCase()&&
          (manual?isManual(b):!isManual(b)&&deps(b).length===normalized.length&&
            deps(b).every(d=>normalized.some(n=>same(n.orderId,d.orderId)&&numeric(n.requiredQty)===numeric(d.requiredQty))))))
        throw new Error('That exact blocker is already waiting in this project. Edit the existing blocker instead.');
      const id=existing?.id??uid();
      tx.update('project',projectId,d=>{
        d.orderBlockers=rows(d.orderBlockers);
        let b;
        if(existing){
          b=d.orderBlockers.find(x=>same(x.id,id));
          b.description=note;b.mode=manual?'all':dependencyMode;b.dependencies=normalized;
          b.kind=manual?'manual':'order';
          delete b.orderId;delete b.requiredQty;
          b.holdsProject=!!holds;
          d.updates=rows(d.updates);
          d.updates.push({id:uid(),date:today(),text:'Updated '+(manual?'manual':'order')+' blocker: '+note+
            (manual?'.':' ('+dependencyMode.toUpperCase()+' of '+normalized.length+' orders).')});
        }else{
          b={id,description:note,kind:manual?'manual':'order',mode:manual?'all':dependencyMode,dependencies:normalized,
            holdsProject:!!holds,status:'waiting',linkedDate:today(),
            resolvedAt:null,resolvedDate:null,resolvedBy:null,receiptUpdateId:null};
          d.orderBlockers.push(b);
          d.updates=rows(d.updates);
          d.updates.push({id:uid(),date:today(),text:'Added '+(manual?'manual':'order')+' blocker: '+note+
            (manual?'.':' ('+dependencyMode.toUpperCase()+' of '+normalized.length+' orders).')});
        }
        if(moveLegacy){
          const old=String(d.blockers);
          d.updates.push({id:uid(),date:today(),text:'Prior free-text blocker archived: '+old});
          d.blockers='';
        }
        if(holds){
          d.orderBlockerHeld=true;
          if(!isHeld(d.status))d.status='Blocked';
        }
        // A dependency may already be satisfied; record a resolution once,
        // without calling receiveOrder or changing stock.
        const changed=!manual&&resolve(d,b,'existing-receipt',today(),null,null,tx);
        if(changed||!waiting(d).length)finishIfReady(d);
      });
      return id;
    },{message:blockerId==null?'Order-linked blocker saved.':'Order-linked blocker updated.'});
  }
  // Preserve the previous public API for existing one-order integrations.
  window.linkOrderBlockerForProject=function(projectId,orderId,description,requiredQty,holds,moveLegacy){
    return saveGroup(projectId,null,description,'all',[{orderId,requiredQty}],holds,moveLegacy);
  };
  window.saveMultiOrderBlocker=saveGroup;

  // The order picker belongs to the current PROJECT, not the global Orders
  // table. Cross-project orders are available only after an explicit opt-in.
  // The item name leads every option; the owner project is just context.
  // One independent blocker normally has ONE Order. Typing in this input
  // shows matching actual Order items, not a native dropdown full of other
  // project titles. An order can be chosen for any number of projects.
  function blockerOrderMatches(projectId,query='',limit=10){
    const p=projectById(Number(projectId));
    if(!p)return [];
    const text=String(query||'').trim().toLowerCase();
    const list=availableOrders(p);
    const hits=text?list.filter(o=>[o.item,o.vendor,o.tracking,
      projectName(o.projectId),...rows(o.linkedProjectIds).map(projectName)]
        .some(t=>String(t||'').toLowerCase().includes(text))):
      list.filter(o=>belongs(o,p.id));
    return hits.sort((a,b)=>
      Number(belongs(b,p.id))-Number(belongs(a,p.id))||
      Number(String(b.item||'').toLowerCase().startsWith(text))-
        Number(String(a.item||'').toLowerCase().startsWith(text))||
      String(a.item||'').localeCompare(String(b.item||''))).slice(0,limit);
  }
  window.blockerOrderMatches=blockerOrderMatches;
  let editingProjectId=null,editingBlockerId=null,editRows=[],legacyGroup=false;
  let activeSuggestionIndex=[];
  const dom=id=>document.getElementById(id);
  function selectedOrderCaption(o,p){
    return '<b>'+esc(o.item||'Unnamed order')+'</b>'+
      '<div class="tiny muted">'+esc(received(o))+' of '+esc(o.qty)+' received'+
      (belongs(o,p.id)?' • Linked to this project':
        ' • Shared from '+esc(projectName(o.projectId)))+
      (o.tracking?' • '+esc(o.tracking):'')+'</div>';
  }
  function dependencyRow(p,entry,index){
    const o=findOrder(entry.orderId);
    return '<div class="detail-card lob-dependency" style="padding:12px;margin:7px 0">'+
      (legacyGroup?'<div class="section-tools"><b>Order '+(index+1)+'</b>'+
        '<button class="icon-btn" type="button" onclick="removeBlockerDependency('+index+')"'+
        (editRows.length===1?' disabled':'')+'>Remove</button></div>':'')+
      '<div class="form-grid">'+
      '<div class="full"><label>Search for the order blocking this project</label>'+
      '<input id="lobSearch'+index+'" type="search" autocomplete="off" role="combobox"'+
      ' aria-autocomplete="list" aria-expanded="false" aria-controls="lobSuggestions'+index+'"'+
      ' placeholder="Type an item name, vendor or order number…"'+
      ' value="'+esc(entry.search??o?.item??'')+'"'+
      ' onfocus="searchBlockerOrders('+index+')"'+
      ' oninput="searchBlockerOrders('+index+')"'+
      ' onkeydown="blockerOrderSearchKeys(event,'+index+')">'+
      '<div id="lobSuggestions'+index+'" role="listbox" class="order-item-suggestions"'+
      ' style="max-height:235px;overflow-y:auto" hidden></div>'+
      '<div id="lobSelected'+index+'" class="notice" style="margin-top:8px;'+(o?'':'display:none')+'">'+
      (o?selectedOrderCaption(o,p):'')+'</div>'+
      '<small>Start typing to see matching orders. This project’s orders appear first;'+
      ' select an order from another project only when you actually share it.</small></div>'+
      '<div><label>Quantity required to clear this blocker</label>'+
      '<input id="lobQty'+index+'" type="number" min="0.000001" step="any"'+
      (o?' max="'+numeric(o.qty)+'"':'')+' value="'+esc(entry.requiredQty??'')+'">'+
      '<div class="tiny muted" id="lobHint'+index+'">'+
      (o?esc(received(o))+' of '+esc(o.qty)+' received':'Choose an order above')+'</div></div>'+
      '</div></div>';
  }
  function renderRows(){
    const p=projectById(editingProjectId),container=dom('lobDependencies');
    if(!p||!container)return;
    container.innerHTML=editRows.map((entry,i)=>dependencyRow(p,entry,i)).join('');
    activeSuggestionIndex=editRows.map(()=>0);
  }
  function captureRows(){
    editRows=editRows.map((entry,i)=>{
      const search=dom('lobSearch'+i)?.value??entry.search??'';
      const o=findOrder(entry.orderId);
      const chosen=o&&search.trim()===String(o.item||'').trim();
      return {...entry,orderId:chosen?o.id:null,search,
        requiredQty:dom('lobQty'+i)?.value??entry.requiredQty};
    });
  }
  function suggestionHTML(p,query,index){
    const hits=blockerOrderMatches(p.id,query,12);
    if(!hits.length)return '<div class="order-item-no-match">'+
      (query?'No matching order. Try its item name or order number.':
        'No orders are linked to this project. Type to find an order from another project.')+'</div>';
    return hits.map((o,i)=>
      '<button type="button" class="order-item-suggestion'+(i===activeSuggestionIndex[index]?' active':'')+
      '" role="option" aria-selected="'+(i===activeSuggestionIndex[index])+'"'+
      ' data-blocker-order="'+esc(o.id)+'" onclick="chooseBlockerOrder('+index+','+Number(o.id)+')">'+
      '<b>'+esc(o.item||'Unnamed order')+'</b>'+
      '<small>'+esc(received(o))+'/'+esc(o.qty)+' received • '+
      (belongs(o,p.id)?'This project':'From '+esc(projectName(o.projectId)))+
      ' • '+esc(o.tracking||'#'+o.id)+'</small></button>'
    ).join('');
  }
  window.searchBlockerOrders=function(index){
    const p=projectById(editingProjectId),input=dom('lobSearch'+index),
      list=dom('lobSuggestions'+index),selected=dom('lobSelected'+index);
    if(!p||!input||!list||!editRows[index])return;
    const query=input.value.trim(),original=findOrder(editRows[index].orderId);
    if(original&&query!==String(original.item||'').trim()){
      editRows[index].orderId=null;
      if(selected)selected.style.display='none';
      const qty=dom('lobQty'+index);
      if(qty){qty.value='';qty.removeAttribute?.('max');}
    }
    editRows[index].search=input.value;
    activeSuggestionIndex[index]=0;
    list.innerHTML=suggestionHTML(p,query,index);
    list.hidden=false;
    input.setAttribute?.('aria-expanded','true');
  };
  window.chooseBlockerOrder=function(index,orderId){
    const p=projectById(editingProjectId),o=findOrder(orderId),
      entry=editRows[index],input=dom('lobSearch'+index);
    if(!p||!o||o.status==='Cancelled'||!entry)return;
    const old=entry.orderId,prior=Number(dom('lobQty'+index)?.value??entry.requiredQty);
    entry.orderId=o.id;entry.search=String(o.item||'');
    entry.requiredQty=(!same(old,o.id)||!(prior>0&&prior<=numeric(o.qty)))?numeric(o.qty):prior;
    if(input){input.value=entry.search;input.setAttribute?.('aria-expanded','false');}
    const selected=dom('lobSelected'+index);
    if(selected){selected.innerHTML=selectedOrderCaption(o,p);selected.style.display='block';}
    const qty=dom('lobQty'+index);
    if(qty){qty.max=String(numeric(o.qty));qty.value=String(entry.requiredQty);}
    const hint=dom('lobHint'+index);
    if(hint)hint.textContent=received(o)+' of '+numeric(o.qty)+' received';
    const list=dom('lobSuggestions'+index);if(list){list.hidden=true;list.innerHTML='';}
    const note=dom('lobDescription');
    if(note&&(!note.value.trim()||note.dataset?.autofill==='1')){
      note.value='Waiting for '+o.item;
      if(note.dataset)note.dataset.autofill='1';
    }
  };
  window.blockerOrderSearchKeys=function(event,index){
    const list=dom('lobSuggestions'+index);
    if(!list||list.hidden)return;
    const hits=[...list.querySelectorAll('[data-blocker-order]')];
    if(event.key==='Escape'){event.preventDefault();list.hidden=true;dom('lobSearch'+index)?.setAttribute?.('aria-expanded','false');return;}
    if(!hits.length)return;
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();
      const next=(activeSuggestionIndex[index]+(event.key==='ArrowDown'?1:-1)+hits.length)%hits.length;
      activeSuggestionIndex[index]=next;
      hits.forEach((el,i)=>{el.classList.toggle('active',i===next);el.setAttribute('aria-selected',String(i===next));});
      return;
    }
    if(event.key==='Enter'){
      event.preventDefault();
      const id=Number(hits[activeSuggestionIndex[index]]?.dataset?.blockerOrder);
      if(id)window.chooseBlockerOrder(index,id);
    }
  };
  window.addBlockerDependency=function(){
    if(!legacyGroup)return;
    if(editRows.length>=20)return alert('Up to 20 orders per blocker.');
    captureRows();
    editRows.push({orderId:null,requiredQty:'',search:''});
    renderRows();
  };
  window.removeBlockerDependency=function(index){
    if(!legacyGroup||editRows.length<=1)return;
    captureRows();editRows.splice(index,1);renderRows();
  };
  window.blockerTypeChanged=function(){
    const manual=dom('lobType')?.value==='manual';
    const section=dom('lobOrderSection');
    if(section)section.style.display=manual?'none':'block';
  };
  window.saveLinkedOrderBlocker=function(projectId){
    const manual=dom('lobType')?.value==='manual';
    if(!manual)captureRows();
    const note=dom('lobDescription')?.value||'';
    const oldBlocker=rows(projectById(Number(projectId))?.orderBlockers).find(b=>same(b.id,editingBlockerId));
    if(manual&&oldBlocker&&!isManual(oldBlocker)&&deps(oldBlocker).length>1&&
      !confirm('Replace this combined order blocker with a manual issue? Its existing order dependencies will be archived in earlier updates but no longer tracked here.'))return null;
    const holds=!!dom('lobHolds')?.checked;
    const moveLegacy=!!dom('lobMoveLegacy')?.checked;
    const dependencyMode=legacyGroup?(dom('lobMode')?.value||'all'):'all';
    try{
      if(!manual&&editRows.some(d=>!d.orderId||!findOrder(d.orderId)))
        throw new Error('Choose a suggested order for this blocker. Typing alone does not select an order.');
      const result=saveGroup(Number(projectId),editingBlockerId,note,dependencyMode,
        manual?[]:editRows.map(d=>({orderId:d.orderId,requiredQty:d.requiredQty})),
        holds,moveLegacy,manual);
      window.openProjectDetail(Number(projectId));
      toast('Project blocker saved.','good');
      return result;
    }catch(e){alert('Blocker was not saved: '+e.message);return null;}
  };
  window.openLinkedOrderBlockerModal=function(projectId,blockerId=null){
    const p=projectById(Number(projectId));if(!p)return;
    const existing=blockerId==null?null:rows(p.orderBlockers).find(b=>same(b.id,blockerId));
    if(blockerId!=null&&(!existing||existing.status!=='waiting'))
      return alert('Only waiting blockers may be edited. Add another blocker instead.');
    editingProjectId=Number(p.id);editingBlockerId=blockerId;
    legacyGroup=!!existing&&deps(existing).length>1;
    const manual=isManual(existing);
    editRows=existing&&!manual?deps(existing).map(d=>({
      ...d,search:findOrder(d.orderId)?.item||''})):
      [{orderId:null,requiredQty:'',search:''}];
    const legacy=String(p.blockers||'').trim();
    openModal(modalHeader(existing?'Edit blocker':'Add project blocker',p.title)+
      '<div class="notice">Add a separate blocker for each issue or delivery. Any Order may block several projects; you can find it by typing its item name here.</div>'+
      '<div class="form-grid" style="margin-top:12px">'+
      '<div class="full"><label>What is holding up this project?</label><textarea id="lobDescription" rows="3"'+
      ' oninput="this.dataset.autofill=0">'+
      esc(existing?.description||'')+'</textarea></div>'+
      '<div class="full"><label>Blocker type</label><select id="lobType" onchange="blockerTypeChanged()">'+
      '<option value="order"'+(manual?'':' selected')+'>Waiting for an order</option>'+
      '<option value="manual"'+(manual?' selected':'')+'>Other issue — resolve manually</option></select></div>'+
      '<div class="full" id="lobOrderSection" style="'+(manual?'display:none':'display:block')+'">'+
      (legacyGroup?'<div class="notice" style="margin-bottom:10px">This existing blocker already depends on several orders. Edit the orders below or create separate blockers for future needs.</div>'+
        '<label>Existing combined requirement</label><select id="lobMode">'+
        '<option value="all"'+(mode(existing)==='all'?' selected':'')+'>ALL required orders</option>'+
        '<option value="any"'+(mode(existing)==='any'?' selected':'')+'>ANY ONE required order</option></select>':'')+
      '<div id="lobDependencies"></div>'+
      (legacyGroup?'<button class="btn secondary" type="button" onclick="addBlockerDependency()">+ Add order to this existing group</button>':'')+
      '</div>'+
      '<div class="full"><label><input id="lobHolds" type="checkbox" style="width:auto;margin-right:8px"'+
      (existing?.holdsProject===false?'':' checked')+'> Hold project until this blocker is resolved</label></div>'+
      (!existing&&legacy?'<div class="full"><label><input id="lobMoveLegacy" type="checkbox" style="width:auto;margin-right:8px"> The existing free-text blocker refers ONLY to this issue. Archive it and clear the old note.</label></div>':'')+
      '</div><div class="modal-actions"><button class="secondary" onclick="openProjectDetail('+Number(p.id)+')">Cancel</button>'+
      '<button class="primary" onclick="saveLinkedOrderBlocker('+Number(p.id)+')">Save blocker</button></div>',true);
    renderRows();
  };
  window.resolveManualProjectBlocker=function(projectId,blockerId){
    const p=projectById(Number(projectId)),entry=rows(p?.orderBlockers)
      .find(x=>same(x.id,blockerId));
    if(!p||!entry||!isManual(entry)||entry.status!=='waiting')return;
    if(pending())return alert('Sync or review the pending atomic inventory transaction first.');
    if(!confirm('Mark "'+entry.description+'" resolved? This does not record a part receipt.'))return;
    try{
      trackerStore.batch(tx=>tx.update('project',p.id,draft=>{
        const blocker=rows(draft.orderBlockers).find(x=>same(x.id,blockerId));
        if(!blocker||!isManual(blocker)||blocker.status!=='waiting')
          throw new Error('The manual blocker has changed; reopen this project.');
        blocker.status='resolved';blocker.resolvedDate=today();
        blocker.resolvedAt=new Date().toISOString();
        blocker.resolvedBy='manual';
        draft.updates=rows(draft.updates);
        draft.updates.push({id:uid(),date:today(),
          text:'Manual blocker resolved: '+blocker.description});
        finishIfReady(draft);
      }),{message:'Manual project blocker resolved.'});
      window.openProjectDetail(p.id);
    }catch(e){alert('Blocker was not resolved: '+e.message);}
  };
  window.removeLinkedOrderBlocker=function(projectId,blockerId){
    const p=projectById(Number(projectId)),b=rows(p?.orderBlockers).find(x=>same(x.id,blockerId));
    if(!p||!b||b.status!=='waiting')return;
    if(pending())return alert('Sync or review the pending atomic transaction first.');
    if(!confirm('Remove this waiting blocker? A removal event remains in the project history.'))return;
    try{
      trackerStore.batch(tx=>tx.update('project',p.id,d=>{
        const current=d.orderBlockers.find(x=>same(x.id,blockerId));
        if(!current||current.status!=='waiting')throw new Error('Blocker changed; refresh.');
        d.orderBlockers=d.orderBlockers.filter(x=>!same(x.id,blockerId));
        d.updates=rows(d.updates);
        d.updates.push({id:uid(),date:today(),text:'Removed '+(isManual(current)?'manual':'order')+' blocker: '+current.description});
        finishIfReady(d);
      }),{message:'Waiting order blocker removed.'});
      window.openProjectDetail(p.id);
    }catch(e){alert('Could not remove blocker: '+e.message);}
  };
  // Preserve the v5.19.25 one-click migration for existing projects with one
  // completed order and one old text blocker. This is always opt-in.
  window.resolveExistingLinkedOrderBlocker=function(projectId){
    const p=projectById(Number(projectId));
    if(!p||!String(p.blockers||'').trim())return;
    const orders=projectOrders(p);
    if(orders.length!==1||received(orders[0])+1e-9<numeric(orders[0].qty)||
       numeric(orders[0].qty)<=0||rows(p.orderBlockers).length)
      return alert('Choose the relevant orders with + Link Blocker.');
    if(!confirm('Confirm that the existing blocker note refers ONLY to '+orders[0].item+
      '. Archive it and clear the blocker without receiving the order again?'))return;
    try{
      saveGroup(p.id,null,String(p.blockers),'all',
        [{orderId:orders[0].id,requiredQty:numeric(orders[0].qty)}],true,true);
      window.openProjectDetail(p.id);
      toast('Previously received order resolved the blocker. Inventory unchanged.','good');
    }catch(e){alert('Existing blocker was not changed: '+e.message);}
  };
  const baseAudit=window.projectCloseoutAudit;
  if(typeof baseAudit==='function')window.projectCloseoutAudit=function(p){
    const result=baseAudit(p),outstanding=waiting(p);
    if(!outstanding.length)return result;
    const issue={severity:'warning',label:'Outstanding order dependencies',
      detail:outstanding.map(b=>b.description+(isManual(b)?' (MANUAL)':' ('+mode(b).toUpperCase()+')')).join(' • ')};
    return {...result,issues:[...result.issues,issue],
      warnings:[...result.warnings,issue],ready:false};
  };
  function card(p){
    const all=rows(p.orderBlockers),orders=projectOrders(p),
      legacy=String(p.blockers||'').trim();
    const prompt=legacy&&orders.length===1&&!all.length&&numeric(orders[0].qty)>0&&
      received(orders[0])+1e-9>=numeric(orders[0].qty)
      ?'<div class="notice" style="margin:9px 0">An order linked to this project is already received. Confirm that your old blocker note refers only to it to resolve that note.</div>'+
       '<button class="btn success" onclick="resolveExistingLinkedOrderBlocker('+Number(p.id)+')">Resolve from Received Order</button>':'';
    const items=all.map(b=>{
      const d=deps(b),done=b.status==='resolved',manual=isManual(b);
      const met=d.filter(x=>satisfied(x)).length;
      const status=done?'Resolved':manual?'Manual issue':'Waiting for order';
      return '<div class="detail-card" style="padding:11px;margin:9px 0;background:var(--surface, #fff)">'+
        '<div class="section-tools"><div><b>'+esc(b.description)+'</b><div class="tiny muted">'+
        (manual?'Manually resolved when the issue is addressed':
          d.length===1?'Waiting for 1 ordered item':
          (mode(b)==='any'?'ANY ONE':'ALL')+' • '+met+'/'+d.length+' requirements met')+
        (done?' • Resolved '+esc(b.resolvedDate||''):'')+
        '</div></div><span class="mini-badge">'+status+'</span></div>'+
        (!manual?d.map(x=>{
          const o=findOrder(x.orderId),got=o?received(o):0,ok=satisfied(x);
          return '<div class="kv" style="padding:7px 0"><div>'+
            (o?'<button class="linkbtn" onclick="openOrderDetail('+Number(o.id)+')">'+esc(o.item)+'</button>':
              '<b>Linked order missing</b>')+
            '<div class="task-note">'+esc(got)+' / '+esc(x.requiredQty)+' required'+
            (ok?' • Received':' • Waiting')+'</div></div>'+
            '<span class="mini-badge">'+(ok?'Ready':'Outstanding')+'</span></div>';
        }).join(''):'')+
        (!done?'<div class="action-row" style="margin-top:8px">'+
          (manual?'<button class="btn success" onclick="resolveManualProjectBlocker('+
            Number(p.id)+','+Number(b.id)+')">Mark resolved</button>':'')+
          '<button class="icon-btn" onclick="openLinkedOrderBlockerModal('+
          Number(p.id)+','+Number(b.id)+')">Edit</button>'+
          '<button class="icon-btn" onclick="removeLinkedOrderBlocker('+
          Number(p.id)+','+Number(b.id)+')">Remove</button></div>':'')+
        '</div>';
    }).join('');
    return '<div class="detail-card" id="projectOrderBlockersCard">'+
      '<div class="section-tools"><div><h3>Project Blockers</h3>'+
      '<div class="tiny muted">Several independent blockers per project. An order can block more than one project.</div></div>'+
      '<button class="icon-btn" onclick="openLinkedOrderBlockerModal('+Number(p.id)+')">+ Add Blocker</button></div>'+
      (legacy?'<div class="notice" style="margin:10px 0"><b>Additional older blocker note</b><div style="margin:6px 0">'+esc(legacy)+'</div>'+
        '<button class="icon-btn" onclick="openProjectModal('+Number(p.id)+')">Edit older note</button></div>':'')+
      (all.length?items:'<div class="muted small">No tracked blockers yet.</div>')+prompt+'</div>';
  }
  // Reverse lookup is derived from explicit Project records. Sharing an
  // order as a blocker never changes the order's cost attribution, inventory,
  // project assignment or received quantity.
  function blockingProjectsForOrder(orderId){
    return rows(db.projects).flatMap(p=>rows(p.orderBlockers)
      .filter(b=>!isManual(b)&&deps(b).some(d=>same(d.orderId,orderId)))
      .map(b=>({projectId:p.id,projectTitle:p.title,blockerId:b.id,
        description:b.description,status:b.status})));
  }
  window.blockingProjectsForOrder=blockingProjectsForOrder;
  const orderDetailBase=window.openOrderDetail;
  if(typeof orderDetailBase==='function')window.openOrderDetail=function(id){
    orderDetailBase(id);
    const box=dom('modalBox'),related=blockingProjectsForOrder(id);
    if(!box||!related.length||box.querySelector('#orderBlockingProjectsCard'))return;
    const right=box.querySelector('.detail-grid > div:nth-child(2)');
    if(!right)return;
    const html='<div class="detail-card" id="orderBlockingProjectsCard">'+
      '<h3>Projects blocked by this order</h3>'+
      '<div class="tiny muted" style="margin-bottom:8px">One order may block several projects. These are references, not additional stock reservations or duplicate costs.</div>'+
      related.map(x=>'<div class="kv"><div>'+
        '<button class="linkbtn" onclick="openProjectDetail('+Number(x.projectId)+')">'+esc(x.projectTitle)+'</button>'+
        '<div class="tiny muted">'+esc(x.description)+'</div></div>'+
        '<span class="mini-badge">'+esc(x.status==='resolved'?'Resolved':'Waiting')+'</span></div>').join('')+
      '</div>';
    right.insertAdjacentHTML('afterbegin',html);
  };
  const detailBase=window.openProjectDetail;
  window.openProjectDetail=function(id){
    detailBase(id);
    const p=projectById(Number(id)),box=dom('modalBox');
    if(!p||!box||box.querySelector('#projectOrderBlockersCard'))return;
    const right=box.querySelector('.detail-grid > div:nth-child(2)');
    if(!right)return;
    const old=[...right.querySelectorAll('.detail-card')].find(el=>
      el.querySelector('h3')?.textContent?.trim()==='Blocker / What Is Holding It Up');
    if(old){old.insertAdjacentHTML('afterend',card(p));old.remove();}
    else right.insertAdjacentHTML('afterbegin',card(p));
  };
})();
