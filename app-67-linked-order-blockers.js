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
  const projectOrders=p=>rows(db.orders).filter(o=>same(o.projectId,p.id)&&o.status!=='Cancelled');
  const availableOrders=p=>rows(db.orders).filter(o=>o.status!=='Cancelled'&&numeric(o.qty)>0)
    .sort((a,b)=>(same(b.projectId,p.id)?1:0)-(same(a.projectId,p.id)?1:0)||
      String(a.item||'').localeCompare(String(b.item||'')));
  const deps=b=>rows(b.dependencies).length?b.dependencies:
    (b.orderId!=null?[{orderId:b.orderId,requiredQty:b.requiredQty}]:[]);
  const mode=b=>b?.mode==='any'?'any':'all';
  const waiting=p=>rows(p?.orderBlockers).filter(b=>b.status==='waiting'&&b.holdsProject!==false);
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
    return d.length>0&&(mode(blocker)==='any'?
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
  function saveGroup(projectId,blockerId,description,dependencyMode,dependencies,holds,moveLegacy){
    if(pending())throw new Error('An atomic inventory transaction is pending. Sync or review it first.');
    if(!['all','any'].includes(dependencyMode))throw new Error('Choose ALL or ANY.');
    const note=String(description||'').trim();
    if(!note)throw new Error('Describe what is being held up.');
    if(!Array.isArray(dependencies)||!dependencies.length||dependencies.length>20)
      throw new Error('Select between 1 and 20 required orders.');
    const normalized=dependencies.map(dep=>({
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
          throw new Error('Required quantity for '+order.item+' must be above zero and cannot exceed ordered quantity.');
        if(ids.has(String(d.orderId)))throw new Error('Select each order once within a blocker. The same order can support other blockers.');
        ids.add(String(d.orderId));
      }
      const existing=blockerId==null?null:rows(p.orderBlockers).find(b=>same(b.id,blockerId));
      if(blockerId!=null&&(!existing||existing.status!=='waiting'))
        throw new Error('Only an existing waiting blocker can be edited.');
      if(moveLegacy&&(!String(p.blockers||'').trim()||blockerId!=null))
        throw new Error('The existing free-text blocker changed. Reopen the project.');
      const id=existing?.id??uid();
      tx.update('project',projectId,d=>{
        d.orderBlockers=rows(d.orderBlockers);
        let b;
        if(existing){
          b=d.orderBlockers.find(x=>same(x.id,id));
          b.description=note;b.mode=dependencyMode;b.dependencies=normalized;
          delete b.orderId;delete b.requiredQty;
          b.holdsProject=!!holds;
          d.updates=rows(d.updates);
          d.updates.push({id:uid(),date:today(),text:'Updated order blocker: '+note+
            ' ('+dependencyMode.toUpperCase()+' of '+normalized.length+' orders).'});
        }else{
          b={id,description:note,mode:dependencyMode,dependencies:normalized,
            holdsProject:!!holds,status:'waiting',linkedDate:today(),
            resolvedAt:null,resolvedDate:null,resolvedBy:null,receiptUpdateId:null};
          d.orderBlockers.push(b);
          d.updates=rows(d.updates);
          d.updates.push({id:uid(),date:today(),text:'Linked order blocker: '+note+
            ' ('+dependencyMode.toUpperCase()+' of '+normalized.length+' orders).'});
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
        const changed=resolve(d,b,'existing-receipt',today(),null,null,tx);
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

  function orderOptionHTML(p,selected){
    return availableOrders(p).map(o=>{
      const owner=rows(db.projects).find(x=>same(x.id,o.projectId));
      const prefix=same(o.projectId,p.id)?'This project':'Shared: '+(owner?.title||'Unassigned');
      return '<option value="'+esc(o.id)+'" '+(same(o.id,selected)?'selected':'')+'>'+
        esc(prefix+' • '+o.item+' ('+received(o)+'/'+numeric(o.qty)+' received)')+'</option>';
    }).join('');
  }
  let editingProjectId=null,editingBlockerId=null,editRows=[];
  const dom=id=>document.getElementById(id);
  function dependencyRow(p,entry,index){
    const options=orderOptionHTML(p,entry.orderId);
    const o=findOrder(entry.orderId)||availableOrders(p)[0];
    return '<div class="detail-card lob-dependency" data-index="'+index+'" style="padding:10px;margin:7px 0">'+
      '<div class="section-tools"><b>Required order '+(index+1)+'</b>'+
      '<button class="icon-btn" type="button" onclick="removeBlockerDependency('+index+')"'+
      (editRows.length===1?' disabled title="Keep at least one order"':'')+'>Remove</button></div>'+
      '<div class="form-grid"><div class="full"><label>Order</label>'+
      '<select id="lobOrder'+index+'" onchange="linkedOrderBlockerOrderChanged('+index+')">'+options+'</select></div>'+
      '<div><label>Required quantity</label><input id="lobQty'+index+'" type="number" min="0.000001" step="any" max="'+numeric(o?.qty)+'" value="'+esc(entry.requiredQty)+'"></div>'+
      '<div class="full small muted" id="lobHint'+index+'"></div></div></div>';
  }
  function renderRows(){
    const p=projectById(editingProjectId),box=dom('lobDependencies');
    if(!p||!box)return;
    box.innerHTML=editRows.map((entry,i)=>dependencyRow(p,entry,i)).join('');
    for(let i=0;i<editRows.length;i++)window.linkedOrderBlockerOrderChanged(i,false);
  }
  function captureRows(){
    editRows=editRows.map((entry,i)=>({
      orderId:dom('lobOrder'+i)?.value??entry.orderId,
      requiredQty:dom('lobQty'+i)?.value??entry.requiredQty
    }));
  }
  window.addBlockerDependency=function(){
    if(editRows.length>=20)return alert('Up to 20 orders per blocker.');
    captureRows();
    const p=projectById(editingProjectId),orders=p&&availableOrders(p);
    const chosen=orders?.find(o=>!editRows.some(d=>same(d.orderId,o.id)));
    if(!chosen)return alert('No additional orders are available. Create the required order first.');
    editRows.push({orderId:chosen.id,requiredQty:chosen.qty});
    renderRows();
  };
  window.removeBlockerDependency=function(index){
    if(editRows.length<=1)return;
    captureRows();
    editRows.splice(index,1);renderRows();
  };
  window.linkedOrderBlockerOrderChanged=function(index,reset=true){
    const select=dom('lobOrder'+index),qty=dom('lobQty'+index);
    const o=select&&findOrder(select.value);
    if(!o||!qty)return;
    qty.max=String(numeric(o.qty));
    if(reset)qty.value=String(numeric(o.qty));
    const hint=dom('lobHint'+index);
    if(hint)hint.textContent=received(o)+' of '+numeric(o.qty)+' received'+
      (received(o)>=numeric(qty.value)&&numeric(qty.value)>0?' • already satisfies this requirement':'');
  };
  window.saveLinkedOrderBlocker=function(projectId){
    captureRows();
    const note=dom('lobDescription')?.value||'';
    const dependencyMode=dom('lobMode')?.value||'all';
    const holds=!!dom('lobHolds')?.checked;
    const moveLegacy=!!dom('lobMoveLegacy')?.checked;
    try{
      const result=saveGroup(Number(projectId),editingBlockerId,note,dependencyMode,editRows,holds,moveLegacy);
      window.openProjectDetail(Number(projectId));
      toast('Order dependencies saved.','good');
      return result;
    }catch(e){alert('Order blocker was not saved: '+e.message);return null;}
  };
  window.openLinkedOrderBlockerModal=function(projectId,blockerId=null){
    const p=projectById(Number(projectId));if(!p)return;
    const orders=availableOrders(p);
    if(!orders.length)return alert('Create an order first, then link it to this project blocker.');
    const existing=blockerId==null?null:rows(p.orderBlockers).find(b=>same(b.id,blockerId));
    if(blockerId!=null&&(!existing||existing.status!=='waiting'))
      return alert('Only waiting blockers may be edited. Create a new blocker if needed.');
    editingProjectId=Number(p.id);editingBlockerId=blockerId;
    editRows=existing?deps(existing).map(d=>({...d})):
      [{orderId:orders[0].id,requiredQty:orders[0].qty}];
    const legacy=String(p.blockers||'').trim();
    openModal(modalHeader(existing?'Edit order blocker':'New order blocker',p.title)+
      '<div class="notice">One order may unblock several jobs. A blocker may depend on ALL of its orders, or ANY one alternative. The original order retains its inventory and purchase associations.</div>'+
      '<div class="form-grid" style="margin-top:12px">'+
      '<div class="full"><label>What is being held up?</label><textarea id="lobDescription" rows="3">'+
      esc(existing?.description||legacy||'Waiting for parts')+'</textarea></div>'+
      '<div class="full"><label>When is this blocker resolved?</label>'+
      '<select id="lobMode"><option value="all" '+(mode(existing)==='all'?'selected':'')+'>ALL required orders received</option>'+
      '<option value="any" '+(mode(existing)==='any'?'selected':'')+'>ANY ONE required order received</option></select></div>'+
      '<div class="full" id="lobDependencies"></div>'+
      '<div class="full"><button class="btn secondary" type="button" onclick="addBlockerDependency()">+ Add another order</button></div>'+
      '<div class="full"><label><input id="lobHolds" type="checkbox" style="width:auto;margin-right:8px" '+
      (existing?.holdsProject===false?'':'checked')+'> Keep project held until this requirement is met</label></div>'+
      (!existing&&legacy?'<div class="full"><label><input id="lobMoveLegacy" type="checkbox" style="width:auto;margin-right:8px"> Existing free-text blocker refers ONLY to these selected orders. Archive and clear it.</label><small>Leave unchecked if you are also waiting on unrelated work or parts.</small></div>':'')+
      '</div><div class="modal-actions"><button class="secondary" onclick="openProjectDetail('+Number(p.id)+')">Cancel</button>'+
      '<button class="primary" onclick="saveLinkedOrderBlocker('+Number(p.id)+')">Save blocker</button></div>',true);
    renderRows();
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
        d.updates.push({id:uid(),date:today(),text:'Removed order blocker: '+current.description});
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
      detail:outstanding.map(b=>b.description+' ('+mode(b).toUpperCase()+')').join(' • ')};
    return {...result,issues:[...result.issues,issue],
      warnings:[...result.warnings,issue],ready:false};
  };
  function card(p){
    const all=rows(p.orderBlockers),orders=projectOrders(p),legacy=String(p.blockers||'').trim();
    const prompt=legacy&&orders.length===1&&!all.length&&numeric(orders[0].qty)>0&&
      received(orders[0])+1e-9>=numeric(orders[0].qty)
      ?'<div class="notice" style="margin:9px 0">Your linked order is already received. Confirm the old note refers only to it to resolve the blocker.</div>'+
       '<button class="btn success" onclick="resolveExistingLinkedOrderBlocker('+Number(p.id)+')">Resolve from Received Order</button>':'';
    const items=all.map(b=>{
      const d=deps(b),done=b.status==='resolved';
      const met=d.filter(x=>satisfied(x)).length;
      return '<div class="detail-card" style="padding:11px;margin:9px 0;background:var(--surface, #fff)">'+
        '<div class="section-tools"><div><b>'+esc(b.description)+'</b><div class="tiny muted">'+
        (mode(b)==='any'?'ANY ONE':'ALL')+' • '+met+'/'+d.length+' requirements currently met'+
        (done?' • Resolved '+esc(b.resolvedDate||''):' • Waiting')+
        '</div></div><span class="mini-badge">'+(done?'Resolved':'Waiting')+'</span></div>'+
        d.map(x=>{
          const o=findOrder(x.orderId),got=o?received(o):0,ok=satisfied(x);
          return '<div class="kv" style="padding:7px 0"><div>'+
            (o?'<button class="linkbtn" onclick="openOrderDetail('+Number(o.id)+')">'+esc(o.item)+'</button>':
              '<b>Linked order missing</b>')+
            '<div class="task-note">'+esc(got)+' / '+esc(x.requiredQty)+' required'+
            (ok?' • Ready':' • Waiting')+'</div></div>'+
            '<span class="mini-badge">'+(ok?'Received':'Outstanding')+'</span></div>';
        }).join('')+
        (!done?'<div class="action-row" style="margin-top:8px"><button class="icon-btn" onclick="openLinkedOrderBlockerModal('+
          Number(p.id)+','+Number(b.id)+')">Edit requirements</button>'+
          '<button class="icon-btn" onclick="removeLinkedOrderBlocker('+Number(p.id)+','+Number(b.id)+')">Remove</button></div>':'')+
        '</div>';
    }).join('');
    return '<div class="detail-card" id="projectOrderBlockersCard">'+
      '<div class="section-tools"><div><h3>Order-linked Blockers</h3><div class="tiny muted">Reuse orders across projects and blockers; ALL or ANY conditions.</div></div>'+
      '<button class="icon-btn" onclick="openLinkedOrderBlockerModal('+Number(p.id)+')">+ Link Blocker</button></div>'+
      (all.length?items:'<div class="muted small">No order dependencies linked yet.</div>')+
      prompt+'</div>';
  }
  const detailBase=window.openProjectDetail;
  window.openProjectDetail=function(id){
    detailBase(id);
    const p=projectById(Number(id)),box=dom('modalBox');
    if(!p||!box||box.querySelector('#projectOrderBlockersCard'))return;
    const right=box.querySelector('.detail-grid > div:nth-child(2)');
    if(!right)return;
    const old=[...right.querySelectorAll('.detail-card')].find(el=>
      el.querySelector('h3')?.textContent?.trim()==='Blocker / What Is Holding It Up');
    if(old)old.insertAdjacentHTML('afterend',card(p));
    else right.insertAdjacentHTML('afterbegin',card(p));
  };
})();
