'use strict';
// v5.19.25 — Explicit project blockers linked to actual order quantities.
// Loaded after the existing project, order, and atomic-outbox modules. A
// legacy free-text blocker is NEVER guessed at, erased, or silently migrated.
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
  const projectOrders=p=>rows(db.orders).filter(o=>same(o.projectId,p.id)&&o.status!=='Cancelled');
  const waiting=p=>rows(p.orderBlockers).filter(b=>b.status==='waiting'&&b.holdsProject!==false);
  const isHeld=status=>status==='Held Up'||status==='Blocked';
  const pending=()=>!!window.atomicReceiptOutbox?.hasPending?.();

  function finishIfReady(p){
    if(p.orderBlockerHeld===true&&p.status!=='Done'&&!waiting(p).length&&!String(p.blockers||'').trim()){
      if(isHeld(p.status))p.status='In Progress';
      p.orderBlockerHeld=false;
    }
  }
  function resolution(p,b,order,source,date,receiptUpdateId=null){
    if(b.status!=='waiting'||received(order)+1e-9<numeric(b.requiredQty))return false;
    b.status='resolved';
    b.resolvedAt=new Date().toISOString();
    b.resolvedDate=date||today();
    b.resolvedBy=source;
    b.receiptUpdateId=receiptUpdateId;
    b.receivedQtyAtResolution=received(order);
    p.updates=rows(p.updates);
    p.updates.push({id:uid(),date:b.resolvedDate,
      text:'Order blocker resolved: '+b.description+' — '+order.item+
        ' ('+received(order)+' of '+order.qty+' '+(order.unit||'ea')+' received).'});
    finishIfReady(p);
    return true;
  }
  // Called in the SAME trackerStore batch as the original Part/Order receipt.
  // The pre-existing atomic outbox already snapshots Project records, so
  // opt-in atomic receipt covers the project resolution in the same RPC.
  const baseReceipt=window.applyOrderReceipt;
  if(typeof baseReceipt!=='function')throw new Error('Order receipt handler must load before linked blockers.');
  window.applyOrderReceipt=function(tx,orderId,qty,date){
    const applied=baseReceipt(tx,orderId,qty,date);
    if(!(applied>0))return applied;
    const order=tx.read('order',orderId);
    if(!order)return applied;
    const last=rows(order.updates).at(-1);
    for(const current of rows(db.projects)){
      if(!rows(current.orderBlockers).some(b=>same(b.orderId,orderId)&&b.status==='waiting'&&
          received(order)+1e-9>=numeric(b.requiredQty)))continue;
      tx.update('project',current.id,p=>{
        for(const b of rows(p.orderBlockers)){
          if(same(b.orderId,orderId))resolution(p,b,order,'receipt',date||today(),last?.id??null);
        }
      });
    }
    return applied;
  };

  function saveLink(projectId,orderId,description,requiredQty,holdsProject,moveLegacyText){
    if(pending())throw new Error('An atomic inventory transaction is pending. Sync or review it before changing project blockers.');
    const qty=Number(requiredQty);
    if(!Number.isFinite(qty)||qty<=0)throw new Error('Required quantity must be positive.');
    return trackerStore.batch(tx=>{
      const o=tx.read('order',orderId),p=tx.read('project',projectId);
      if(!o||!p||!same(o.projectId,p.id)||o.status==='Cancelled')
        throw new Error('Select an active order explicitly linked to this project.');
      if(qty>numeric(o.qty)+1e-9)throw new Error('Required quantity exceeds the ordered quantity.');
      if(rows(p.orderBlockers).some(b=>same(b.orderId,o.id)))
        throw new Error('This order is already linked to a blocker in this project.');
      if(moveLegacyText&&!String(p.blockers||'').trim())
        throw new Error('The existing text blocker has changed. Reopen the project first.');
      const note=String(description||'').trim();
      if(!note)throw new Error('Describe what this order is holding up.');
      const linked={id:uid(),orderId:o.id,description:note,requiredQty:qty,
        holdsProject:!!holdsProject,status:'waiting',linkedDate:today(),
        resolvedAt:null,resolvedDate:null,resolvedBy:null,receiptUpdateId:null};
      tx.update('project',projectId,d=>{
        d.orderBlockers=rows(d.orderBlockers);
        d.orderBlockers.push(linked);
        d.updates=rows(d.updates);
        d.updates.push({id:uid(),date:today(),text:'Linked order blocker: '+note+
          ' — '+o.item+' (need '+qty+' '+(o.unit||'ea')+').'});
        if(moveLegacyText){
          const prior=String(d.blockers||'');
          d.updates.push({id:uid(),date:today(),text:'Prior free-text blocker archived: '+prior});
          d.blockers='';
        }
        if(holdsProject&&d.status!=='Done'){
          d.orderBlockerHeld=true;
          if(!isHeld(d.status))d.status='Blocked';
        }
        // This is an existing receipt, not a new stock movement. Never
        // credit Part stock or change the Order when linking it retroactively.
        resolution(d,linked,o,'existing-receipt',today());
      });
      return linked.id;
    },{message:'Order-linked project blocker saved.'});
  }
  window.linkOrderBlockerForProject=saveLink;
  window.saveLinkedOrderBlocker=function(projectId){
    const orderId=Number(document.getElementById('lobOrder')?.value);
    const description=document.getElementById('lobDescription')?.value||'';
    const qty=document.getElementById('lobQuantity')?.value;
    const holds=!!document.getElementById('lobHolds')?.checked;
    const move=!!document.getElementById('lobMoveLegacy')?.checked;
    try{
      const id=saveLink(Number(projectId),orderId,description,qty,holds,move);
      window.openProjectDetail(Number(projectId));
      toast('Linked order blocker saved.','good');
      return id;
    }catch(e){alert('Order blocker was not saved: '+e.message);return null;}
  };
  window.openLinkedOrderBlockerModal=function(projectId){
    const p=projectById(Number(projectId));if(!p)return;
    const orders=projectOrders(p).filter(o=>!rows(p.orderBlockers).some(b=>same(b.orderId,o.id)));
    if(!orders.length)return alert('Link an active order to this project first. Each order may have one blocker.');
    const first=orders[0];
    const text=String(p.blockers||'').trim();
    const orderOptions=orders.map(o=>'<option value="'+esc(o.id)+'">'+esc(o.item)+
      ' — '+received(o)+'/'+numeric(o.qty)+' received</option>').join('');
    openModal(modalHeader('Link order to project blocker',p.title)+
      '<div class="notice">Only explicitly linked order quantities resolve blockers. Previously received items are recognized without receiving them again.</div>'+
      '<div class="form-grid" style="margin-top:12px">'+
      '<div class="full"><label>Order holding up the work</label><select id="lobOrder" onchange="linkedOrderBlockerOrderChanged()">'+orderOptions+'</select></div>'+
      '<div><label>Quantity required before work can resume</label><input id="lobQuantity" type="number" step="any" min="0.000001" max="'+numeric(first.qty)+'" value="'+numeric(first.qty)+'"></div>'+
      '<div class="full"><label>What is held up?</label><textarea id="lobDescription" rows="3">'+esc(text||('Waiting for '+first.item))+'</textarea></div>'+
      '<div class="full"><label><input id="lobHolds" type="checkbox" style="width:auto;margin-right:8px" checked> Keep this project held until the required quantity arrives</label></div>'+
      (text?'<div class="full"><label><input id="lobMoveLegacy" type="checkbox" style="width:auto;margin-right:8px"> This existing free-text blocker refers ONLY to this order. Archive it and clear the old blocker field.</label><small>If other reasons remain, leave this unchecked and edit the old note separately.</small></div>':'')+
      '<div class="full" id="lobReceiptHint"></div></div>'+
      '<div class="modal-actions"><button class="secondary" onclick="openProjectDetail('+Number(p.id)+')">Cancel</button>'+
      '<button class="primary" onclick="saveLinkedOrderBlocker('+Number(p.id)+')">Link Order</button></div>');
    window.linkedOrderBlockerOrderChanged();
  };
  window.linkedOrderBlockerOrderChanged=function(){
    const sel=document.getElementById('lobOrder'),qty=document.getElementById('lobQuantity');
    if(!sel||!qty)return;
    const o=rows(db.orders).find(x=>same(x.id,sel.value));if(!o)return;
    qty.max=String(numeric(o.qty));qty.value=String(numeric(o.qty));
    const hint=document.getElementById('lobReceiptHint');
    if(hint)hint.innerHTML=received(o)>=numeric(o.qty)&&numeric(o.qty)>0
      ?'<div class="notice">Already received. This blocker will be resolved immediately when linked. No stock will be received again.</div>'
      :'<div class="muted small">'+received(o)+' of '+numeric(o.qty)+' received; later partial receipts will be evaluated automatically.</div>';
  };
  // A single already-received linked order and one legacy text note is an
  // unambiguous one-click MIGRATION CANDIDATE, but still requires user consent.
  window.resolveExistingLinkedOrderBlocker=function(projectId){
    const p=projectById(Number(projectId));if(!p||!String(p.blockers||'').trim())return;
    const orders=projectOrders(p);
    if(orders.length!==1||!(received(orders[0])>=numeric(orders[0].qty))||
       numeric(orders[0].qty)<=0||rows(p.orderBlockers).length)
      return alert('Choose the matching order with Link Order instead.');
    if(!confirm('Confirm that the existing blocker note refers ONLY to '+orders[0].item+
      '. Archive that note, link the already-received order, and move this project out of Held Up if nothing else is blocking it?'))
      return;
    try{
      saveLink(p.id,orders[0].id,String(p.blockers),numeric(orders[0].qty),true,true);
      window.openProjectDetail(p.id);
      toast('The received order resolved the project blocker. No inventory was changed.','good');
    }catch(e){alert('Existing blocker was not changed: '+e.message);}
  };
  // Include structured blockers in the existing closeout check, without
  // treating historical/resolved blockers as outstanding.
  const baseAudit=window.projectCloseoutAudit;
  if(typeof baseAudit==='function')window.projectCloseoutAudit=function(p){
    const result=baseAudit(p);
    const outstanding=p?waiting(p):[];
    if(!outstanding.length)return result;
    const issue={severity:'warning',label:'Order-linked blockers still outstanding',
      detail:outstanding.map(b=>b.description).join(' • ')};
    return {...result,issues:[...result.issues,issue],warnings:[...result.warnings,issue],ready:false};
  };

  function card(p){
    const blockers=rows(p.orderBlockers),orders=projectOrders(p),legacy=String(p.blockers||'').trim();
    const prompt=legacy&&orders.length===1&&!blockers.length&&numeric(orders[0].qty)>0&&
      received(orders[0])>=numeric(orders[0].qty)
      ?'<div class="notice" style="margin:9px 0">One linked order is already received. You can explicitly archive the old blocker note and unblock this project.</div>'+
        '<button class="btn success" onclick="resolveExistingLinkedOrderBlocker('+Number(p.id)+')">Resolve from Received Order</button>'
      :'';
    return '<div class="detail-card" id="projectOrderBlockersCard">'+
      '<div class="section-tools"><div><h3>Order-linked Blockers</h3><div class="tiny muted">Resolve automatically when the required quantity is received.</div></div>'+
      '<button class="icon-btn" onclick="openLinkedOrderBlockerModal('+Number(p.id)+')">+ Link Order</button></div>'+
      (blockers.length?blockers.map(b=>{
        const o=rows(db.orders).find(x=>same(x.id,b.orderId));
        const achieved=o?received(o):0,done=b.status==='resolved';
        return '<div class="kv" style="align-items:flex-start"><div><b>'+esc(b.description)+'</b>'+
          '<div class="task-note">'+esc(o?.item||'Linked order missing')+' • '+esc(achieved)+' / '+esc(b.requiredQty)+' required'+
          (done?' • Resolved '+esc(b.resolvedDate||''):' • Waiting')+'</div></div>'+
          '<span class="mini-badge">'+(done?'Resolved':'Waiting')+'</span></div>';
      }).join(''):'<div class="muted small">No orders linked to project blockers yet.</div>')+
      prompt+'</div>';
  }
  const detailBase=window.openProjectDetail;
  window.openProjectDetail=function(id){
    detailBase(id);
    const p=projectById(Number(id)),box=document.getElementById('modalBox');
    if(!p||!box||box.querySelector('#projectOrderBlockersCard'))return;
    const right=box.querySelector('.detail-grid > div:nth-child(2)');
    if(!right)return;
    const old=[...right.querySelectorAll('.detail-card')].find(el=>
      el.querySelector('h3')?.textContent?.trim()==='Blocker / What Is Holding It Up');
    if(old)old.insertAdjacentHTML('afterend',card(p));
    else right.insertAdjacentHTML('afterbegin',card(p));
  };
})();
