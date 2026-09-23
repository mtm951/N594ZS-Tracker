// ---------- V5.3 INVENTORY TRANSACTIONS / RESERVE->USE / QUICK ADD 2.0 ----------
// Adds auditable manual adjustments on top of existing purchase inflows and work-log outflows.
// Physical stock continues to be reduced only by work-log consumption, preventing project records
// from double-counting inventory.
(function(){
  if(window.__n594zsV53InventoryWorkflowInstalled)return;
  window.__n594zsV53InventoryWorkflowInstalled=true;

  var style=document.createElement('style');
  style.textContent=`
    .assigned-part-row{grid-template-columns:minmax(0,1fr) auto auto!important}
    .assigned-use-btn{align-self:center;white-space:nowrap;padding:7px 11px}
    .project-parts-workspace{overflow:hidden;padding:0!important}.project-parts-head{padding:14px 15px 11px;background:#fbfcfd;border-bottom:1px solid #e6edf2}.project-parts-head .action-row{flex-wrap:wrap;justify-content:flex-end}.project-parts-summary{display:flex;gap:7px;flex-wrap:wrap;padding:9px 15px;background:#f6f9fb;border-bottom:1px solid #e8eef2}.project-parts-summary span{font-size:10px;color:#687b89;border:1px solid #dce5eb;background:#fff;border-radius:999px;padding:5px 8px}.project-parts-summary b{color:#19364f}.project-parts-list{display:grid}.project-part-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(190px,.7fr) auto;gap:11px;align-items:center;padding:11px 15px;border-bottom:1px solid #edf1f4}.project-part-row:last-child{border-bottom:0}.project-part-row:hover{background:#fbfdfe}.project-part-title{font-size:12px;font-weight:850;color:#18334b}.project-part-qty{display:grid;gap:4px;justify-items:start}.project-part-qty small{font-size:9px;line-height:1.3;color:var(--muted)}.project-part-stage{display:inline-flex;align-items:center;border-radius:999px;padding:4px 8px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}.project-part-stage.assigned{background:#edf3f7;color:#4f6879}.project-part-stage.reserved{background:#fff2cf;color:#805f18}.project-part-stage.used{background:#e4f3e8;color:#2b7143}.project-part-actions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}.project-part-actions button{white-space:nowrap;padding:6px 9px}.custom-used{background:#fafcfa}
    .inv-adjust-row{display:grid;grid-template-columns:86px minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #edf1f4;font-size:12px}
    .inv-adjust-row:last-child{border-bottom:0}.inv-adjust-pos{color:#21754a}.inv-adjust-neg{color:#984039}.inv-adjust-delta{font-weight:900;white-space:nowrap}.inv-ledger-note{margin-top:8px;padding:8px 10px;border-radius:7px;background:#f8fbfd;border:1px solid #e1e9ef}
    .reservation-actions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}.quick-use-list{display:grid;gap:8px;margin-top:10px}.quick-use-item{width:100%;text-align:left;border:1px solid #d7e2e9;border-radius:9px;background:#fff;padding:11px;cursor:pointer;color:#17324c}.quick-use-item:hover{background:#f6fafc}.quick-use-item b{display:block}.quick-use-item small{display:block;color:#6e7f8e;margin-top:4px}.quick-use-qty{float:right;font-weight:900;color:#865b11}
    @media(max-width:760px){.inv-adjust-row{grid-template-columns:72px minmax(0,1fr) auto}.inv-adjust-row .inv-reverse{grid-column:2/-1;justify-self:start}.reservation-actions{grid-column:1/-1;justify-content:flex-start}.project-part-row{grid-template-columns:1fr;gap:7px}.project-part-actions{justify-content:flex-start}.project-parts-head{align-items:flex-start;gap:10px}.project-parts-head .action-row{justify-content:flex-start}}
  `;
  document.head.appendChild(style);

  // ----- Normalization / persistent adjustment ledger -----
  var normalizeBase=window.normalizeDB;
  window.normalizeDB=function(){
    normalizeBase();
    (db.parts||[]).forEach(function(p){
      p.inventoryAdjustments=arr(p.inventoryAdjustments).map(function(a){return {
        ...a,id:a.id||uid(),date:a.date||today(),delta:num(a.delta),reason:a.reason||'Adjustment',notes:a.notes||'',reverses:a.reverses||null
      }});
    });
  };
  window.normalizeDB();

  window.inventoryAdjustmentTotal=function(partId){
    var p=partById(Number(partId));if(!p)return 0;
    return arr(p.inventoryAdjustments).reduce(function(s,a){return s+num(a.delta)},0);
  };

  // stockQty remains the received/opening quantity. Work logs are physical outflows.
  // Manual corrections/scrap/returns live in inventoryAdjustments.
  window.partAvailable=function(p){
    if(!p)return null;
    var hasBase=!(p.stockQty===''||p.stockQty===null||p.stockQty===undefined);
    var adj=arr(p.inventoryAdjustments).reduce(function(s,a){return s+num(a.delta)},0);
    if(!hasBase&&!adj)return null;
    return num(p.stockQty)+adj-partConsumedQty(p.id);
  };

  var movementBase=window.partMovementRows;
  window.partMovementRows=function(part){
    var rows=typeof movementBase==='function'?movementBase(part):[];
    arr(part.inventoryAdjustments).forEach(function(a){
      rows.push({date:a.date||'',kind:'ADJUST',desc:(a.reason||'Inventory adjustment')+(a.notes?' • '+a.notes:''),qty:num(a.delta),unit:part.unit||'ea'});
    });

    // New receipts are written onto the affected Part in the same local
    // trackerStore batch that credits stock. Their audit survives Order edits
    // or deletion. Never add them to stockQty a second time here.
    arr(part.receiptHistory).forEach(function(r){
      if(!(num(r.qty)>0))return;
      var desc='Order receipt • '+(r.item||part.name||'Part')+
        (r.vendor?' • '+r.vendor:'')+(r.tracking?' • Ref '+r.tracking:'');
      rows.push({date:r.date||'',kind:'RECEIPT',desc,qty:num(r.qty),unit:r.unit||part.unit||'ea'});
    });

    // Older receipts only have automatically generated Order Updates text.
    // Display them without migrating or crediting stock again. A structured
    // event on ANY Part takes precedence so a later order re-link cannot
    // reproduce one receipt in two different parts' histories.
    var structuredUpdateIds=new Set();
    arr(db.parts).forEach(function(p){
      arr(p.receiptHistory).forEach(function(r){
        if(r.orderUpdateId!==undefined&&r.orderUpdateId!==null)structuredUpdateIds.add(String(r.orderUpdateId));
      });
    });
    arr(db.orders).forEach(function(o){
      if(String(o.partId??'')!==String(part.id))return;
      arr(o.updates).forEach(function(u){
        if(u.id!==undefined&&u.id!==null&&structuredUpdateIds.has(String(u.id)))return;
        var match=/^Received\s+(\d+(?:\.\d+)?)\s+(.+?)\s+\((?:line complete|partial receipt)\)\.$/.exec(String(u.text||''));
        if(!match)return;
        var qty=Number(match[1]);
        if(!Number.isFinite(qty)||qty<=0)return;
        var desc='Earlier order receipt • '+(o.item||part.name||'Part')+
          (o.vendor?' • '+o.vendor:'')+(o.tracking?' • Ref '+o.tracking:'')+
          ' • Historical part link inferred';
        rows.push({date:u.date||o.receivedDate||'',kind:'RECEIPT',desc,qty,unit:match[2]||part.unit||'ea'});
      });
    });
    return rows.sort(function(a,b){return (b.date||'9999').localeCompare(a.date||'9999')});
  };

  function adjustmentHistoryHTML(p){
    var rows=[...arr(p.inventoryAdjustments)].sort(function(a,b){return (b.date||'').localeCompare(a.date||'')});
    return `<div class="detail-section" id="manualInventoryAdjustments"><div class="section-tools"><label style="margin:0">Manual inventory adjustments</label><button class="icon-btn" onclick="openInventoryAdjustmentModal(${p.id})">+ Adjust</button></div>${rows.length?rows.map(function(a){var d=num(a.delta);return `<div class="inv-adjust-row"><span>${esc(a.date||'')}</span><span><b>${esc(a.reason||'Adjustment')}</b>${a.notes?`<div class="task-note">${esc(a.notes)}</div>`:''}</span><span class="inv-adjust-delta ${d>=0?'inv-adjust-pos':'inv-adjust-neg'}">${d>0?'+':''}${esc(d)} ${esc(p.unit||'ea')}</span><button class="icon-btn inv-reverse" onclick="reverseInventoryAdjustment(${p.id},${JSON.stringify(a.id)})">Reverse</button></div>`}).join(''):'<div class="muted small">No manual adjustments. Linked purchases, order receipts and work-log usage appear in the movement history above.</div>'}<div class="tiny muted inv-ledger-note">On hand = recorded stock (including Orders-tab receipts) + manual adjustments − work-log consumption. Project reservations affect Free inventory but do not change physical On Hand until they are used.</div></div>`;
  }

  function decoratePartInventory(partId){
    var p=partById(Number(partId)),card=document.getElementById('smartPartInventory');if(!p||!card)return;
    if(!card.querySelector('#inventoryAdjustButton')){
      var h=card.querySelector('h3');if(h)h.insertAdjacentHTML('afterend',`<div class="action-row" style="margin:-2px 0 8px"><button class="icon-btn" id="inventoryAdjustButton" onclick="openInventoryAdjustmentModal(${p.id})">± Adjust Inventory</button></div>`);
    }
    if(!card.querySelector('#manualInventoryAdjustments'))card.insertAdjacentHTML('beforeend',adjustmentHistoryHTML(p));
  }

  var openPartDetailBase=window.openPartDetail;
  window.openPartDetail=function(id){openPartDetailBase(id);decoratePartInventory(Number(id))};

  window.openInventoryAdjustmentModal=function(partId){
    var p=partById(Number(partId));if(!p)return;
    var on=partAvailable(p);
    openModal(`${modalHeader('Adjust Inventory',p.name)}<div class="notice" style="margin-bottom:12px">Current calculated on hand: <b>${on===null?'—':esc(on+' '+(p.unit||'ea'))}</b>. Enter a positive change to add stock or a negative change to remove stock.</div><div class="form-grid">${field('Date','iaDate',today(),'date')}${field('Quantity change (+ / −)','iaDelta','','number','step="any"')}<div class="full"><label>Reason</label><select id="iaReason"><option>Count correction</option><option>Returned to stock</option><option>Found / recovered</option><option>Scrapped / damaged</option><option>Lost / missing</option><option>Other adjustment</option></select></div>${textareaField('Notes','iaNotes','')}</div><div class="modal-actions"><button class="btn secondary" onclick="openPartDetail(${p.id})">Cancel</button><button class="btn primary" onclick="saveInventoryAdjustment(${p.id})">Save Adjustment</button></div>`);
  };

  window.saveInventoryAdjustment=function(partId){
    var p=partById(Number(partId));if(!p)return;
    var delta=Number(val('iaDelta'));if(!Number.isFinite(delta)||delta===0)return alert('Enter a non-zero quantity change.');
    if(delta<0){var on=partAvailable(p);if(on!==null&&on+delta<0&&!confirm('This adjustment will make calculated inventory negative. Save it anyway?'))return;}
    p.inventoryAdjustments=arr(p.inventoryAdjustments);p.inventoryAdjustments.push({id:uid(),date:val('iaDate')||today(),delta:delta,reason:val('iaReason')||'Adjustment',notes:val('iaNotes')||''});
    saveDB('Inventory adjustment recorded.');openPartDetail(p.id);
  };

  window.reverseInventoryAdjustment=function(partId,adjustmentId){
    var p=partById(Number(partId));if(!p)return;var a=arr(p.inventoryAdjustments).find(function(x){return String(x.id)===String(adjustmentId)});if(!a)return;
    if(!confirm('Reverse this adjustment with an equal and opposite transaction?'))return;
    p.inventoryAdjustments.push({id:uid(),date:today(),delta:-num(a.delta),reason:'Reversal',notes:`Reverses ${a.reason||'adjustment'} from ${a.date||'unknown date'}`,reverses:a.id});
    saveDB('Inventory adjustment reversed.');openPartDetail(p.id);
  };

  // ----- Reserved -> Used workflow -----
  window.plannedPartsHTML=function(projectId){
    var p=projectById(Number(projectId));if(!p)return '';
    var rows=arr(p.plannedParts);
    return `<div class="detail-card" id="projectPlannedPartsCard"><div class="section-tools"><div><h3>Planned / Reserved Parts</h3><div class="tiny muted">Reserved reduces Free inventory. Use creates the physical work-log consumption and releases the reservation.</div></div><button class="icon-btn" onclick="openReservePartModal(${p.id})">+ Reserve Part</button></div>${rows.length?rows.map(function(x){var part=x.partId?partById(x.partId):null,free=part?partFreeQty(part):null;return `<div class="reservation-row"><div><b>${x.partId?`<button class="linkbtn" onclick="openPartDetail(${x.partId})">${esc(x.name||partName(x.partId))}</button>`:esc(x.name||'Planned item')}</b><div class="task-note">${esc(x.notes||'')}${part&&free!==null?` • free after reservations: ${esc(free)} ${esc(part.unit||x.unit||'ea')}`:''}</div></div><div class="reservation-qty ${part&&free!==null&&free<0?'stock-short':'stock-ok'}">${esc(x.qty)} ${esc(x.unit||part?.unit||'ea')}</div><div class="reservation-actions">${part?`<button class="btn success" onclick="openUseReservedPartModal(${p.id},${JSON.stringify(x.id)})">Use</button>`:''}<button class="icon-btn" onclick="removeReservedPart(${p.id},${JSON.stringify(x.id)})">Release</button></div></div>`}).join(''):'<div class="empty">No parts reserved for this project yet.</div>'}</div>`;
  };

  window.openUseReservedPartModal=function(projectId,itemId){
    var p=projectById(Number(projectId));if(!p)return;var item=arr(p.plannedParts).find(function(x){return String(x.id)===String(itemId)});if(!item)return;var part=partById(Number(item.partId));if(!part)return;
    var on=partAvailable(part);
    openModal(`${modalHeader('Use Reserved Part',p.title)}<div class="notice" style="margin-bottom:12px"><b>${esc(part.name)}</b><br>Reserved: ${esc(item.qty)} ${esc(item.unit||part.unit||'ea')} • Calculated on hand: ${on===null?'—':esc(on+' '+(part.unit||'ea'))}</div><div class="form-grid">${field('Date','urDate',today(),'date')}${field('Quantity used','urQty',item.qty,'number','step="any" min="0.000001"')}${textareaField('Work performed','urWork',`Used ${part.name} on ${p.title}`)}${textareaField('Measurements / notes','urNotes',item.notes||'')}</div><div class="modal-actions"><button class="btn secondary" onclick="openProjectDetail(${p.id})">Cancel</button><button class="btn success" onclick="saveReservedPartUse(${p.id},${JSON.stringify(item.id)})">Record Use</button></div>`);
  };

  function addProjectUseRecord(project,part,qty,unit,unitCost,notes,logId,consumedItemId,projectPartId){
    project.partsUsed=arr(project.partsUsed);
    const id=projectPartId||uid();
    project.partsUsed.push({id:id,partId:part.id,name:part.name,qty:qty,unit:unit,unitCost:unitCost,notes:(notes?notes+' • ':'')+'Recorded as physical inventory use'+(logId?` • work log ${logId}`:''),logId:logId||null,consumedItemId:consumedItemId||null,consumptionRecorded:!!logId});
    return id;
  }

  window.saveReservedPartUse=function(projectId,itemId){
    var project=projectById(Number(projectId));if(!project)return;var item=arr(project.plannedParts).find(function(x){return String(x.id)===String(itemId)});if(!item)return;var part=partById(Number(item.partId));if(!part)return;
    var qty=Number(val('urQty'));if(!Number.isFinite(qty)||qty<=0)return alert('Enter a positive quantity used.');if(qty>num(item.qty)+1e-9)return alert('Quantity used cannot exceed the reserved quantity.');
    if(typeof window.preparePartForPhysicalUse==='function')window.preparePartForPhysicalUse(part,qty);
    var on=partAvailable(part);if(on!==null&&qty>on&&!confirm('This use exceeds calculated physical inventory and will make the part quantity negative. Record it anyway?'))return;
    var logId=uid(),consumedItemId=uid(),projectPartId=uid(),unit=item.unit||part.unit||'ea',notes=val('urNotes')||'';
    db.logs.push({id:logId,date:val('urDate')||today(),airframeHours:'',engineHours:'',laborHours:'',system:project.system||part.system||'General',projectIds:[project.id],work:val('urWork')||`Used ${part.name}`,observations:notes,blockers:'',nextStep:'',consumedParts:[{id:consumedItemId,partId:part.id,name:part.name,qty:qty,unit:unit,unitCost:part.unitCost,notes:'Consumed from project reservation',projectPartId:projectPartId}],otherCost:'',notes:'Created by Reserve → Use workflow.',origin:'reserved-part-use'});
    addProjectUseRecord(project,part,qty,unit,part.unitCost,notes,logId,consumedItemId,projectPartId);
    item.qty=Math.max(0,num(item.qty)-qty);if(item.qty<=1e-9)project.plannedParts=arr(project.plannedParts).filter(function(x){return String(x.id)!==String(itemId)});
    if(!arr(part.linkedProjectIds).includes(project.id))part.linkedProjectIds.push(project.id);
    saveDB('Reserved part used and inventory consumption recorded.');openLogDetail(logId);
  };


  // ----- Project detail: show inventory parts linked from the inventory side -----
  function projectLinkedInventoryParts(projectId){
    return arr(db.parts)
      .filter(function(part){return arr(part.linkedProjectIds).some(function(pid){return Number(pid)===Number(projectId)})})
      .sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''),undefined,{numeric:true,sensitivity:'base'})});
  }

  function installedPurchaseSourcesForPart(part){
    var explicit=arr(db.purchases).filter(function(p){
      return p.disposition==='Installed'&&(
        String(p.inventoryPartId||'')===String(part.id)||
        arr(part.purchaseIds).map(String).includes(String(p.id))
      );
    });
    if(explicit.length)return explicit;
    if(part.partNo){
      var pn=String(part.partNo).toLowerCase();
      var same=arr(db.purchases).filter(function(p){return p.disposition==='Installed'&&p.pn&&String(p.pn).toLowerCase()===pn});
      if(same.length===1)return same;
    }
    return [];
  }

  window.preparePartForPhysicalUse=function(part,qty){
    if(!part||!Number.isFinite(Number(qty))||Number(qty)<=0)return {credited:0,sources:[]};
    var need=Math.max(0,Number(qty)-Math.max(0,Number(partAvailable(part)??0)));
    if(need<=0)return {credited:0,sources:[]};
    var credited=0,sources=[];
    installedPurchaseSourcesForPart(part).forEach(function(p){
      if(credited>=need)return;
      var materialized=num(p.inventoryReceiptMaterializedQty);
      var availableCredit=Math.max(0,num(p.qty)-materialized);
      if(availableCredit<=0)return;
      var take=Math.min(availableCredit,need-credited);
      if(take<=0)return;
      part.stockQty=(part.stockQty===''?0:num(part.stockQty))+take;
      p.inventoryReceiptMaterializedQty=materialized+take;
      p.inventoryReceiptMaterialized=true;
      p.inventoryApplied=true;
      sources.push({purchaseId:p.id,qty:take,order:p.order||'',invoice:p.invoice||''});
      credited+=take;
    });
    return {credited:credited,sources:sources};
  };

  function assignedUseDefaultQty(part){
    var on=partAvailable(part);
    if(on!==null&&on!==undefined&&num(on)>0)return Math.min(1,num(on));
    var credit=installedPurchaseSourcesForPart(part).reduce(function(sum,p){
      return sum+Math.max(0,num(p.qty)-num(p.inventoryReceiptMaterializedQty));
    },0);
    return credit>0?credit:1;
  }

  window.openAssignedPartUse=function(projectId,partId){
    var project=projectById(Number(projectId)),part=partById(Number(partId));if(!project||!part)return;
    var reserved=arr(project.plannedParts).find(function(x){return Number(x.partId)===Number(part.id)});
    if(reserved&&typeof openUseReservedPartModal==='function')return openUseReservedPartModal(project.id,reserved.id);
    var qty=assignedUseDefaultQty(part),on=partAvailable(part),sources=installedPurchaseSourcesForPart(part);
    var installedSource=sources.length&&num(on)<=0;
    openModal(`${modalHeader('Move Assigned Part to Used',project.title)}
      <div class="notice" style="margin-bottom:12px"><b>${esc(part.name)}</b><br>Calculated on hand: ${on===null?'—':esc(on+' '+(part.unit||'ea'))}.${installedSource?' This part came from a purchase already marked Installed; recording use will preserve the purchase receipt as an inventory inflow and record the installation/use as the matching outflow, so on-hand does not go negative.':''}</div>
      <div class="form-grid">
        ${field('Date','apuDate',today(),'date')}
        ${field('Quantity used','apuQty',qty,'number','step="any" min="0.000001"')}
        ${textareaField('Work performed','apuWork',`Used ${part.name} on ${project.title}`)}
        ${textareaField('Notes / measurement','apuNotes','')}
      </div>
      <div class="modal-actions"><button class="secondary" onclick="openProjectDetail(${project.id})">Cancel</button><button class="primary" onclick="saveAssignedPartUse(${project.id},${part.id})">Move to Parts Used</button></div>`,true);
  };

  window.saveAssignedPartUse=function(projectId,partId){
    var project=projectById(Number(projectId)),part=partById(Number(partId));if(!project||!part)return;
    var qty=Number(val('apuQty'));if(!Number.isFinite(qty)||qty<=0)return alert('Enter a positive quantity used.');
    var prep=window.preparePartForPhysicalUse(part,qty);
    var on=partAvailable(part);
    if(on!==null&&qty>on&&!confirm('This use exceeds calculated physical inventory and will make the quantity negative. Record it anyway?'))return;
    var logId=uid(),consumedItemId=uid(),projectPartId=uid(),unit=part.unit||'ea',notes=val('apuNotes')||'';
    db.logs.push({
      id:logId,date:val('apuDate')||today(),airframeHours:'',engineHours:'',laborHours:'',system:project.system||part.system||'General',projectIds:[project.id],
      work:val('apuWork')||`Used ${part.name} on ${project.title}`,observations:notes,blockers:'',nextStep:project.nextStep||'',
      consumedParts:[{id:consumedItemId,partId:part.id,name:part.name,qty:qty,unit:unit,unitCost:part.unitCost,notes:'Moved from Assigned Inventory Parts to Parts Used.',projectPartId:projectPartId}],
      otherCost:'',notes:prep.credited?`Assigned → Used. ${prep.credited} ${unit} purchase receipt quantity materialized from installed purchase provenance.`:'Assigned → Used.',origin:'assigned-part-use'
    });
    addProjectUseRecord(project,part,qty,unit,part.unitCost,notes,logId,consumedItemId,projectPartId);
    if(!arr(part.linkedProjectIds).includes(project.id))part.linkedProjectIds.push(project.id);
    saveDB('Assigned part moved to Parts Used and inventory history updated.');
    openProjectDetail(project.id);
  };

  function projectPartWorkspaceRows(projectId){
    var project=projectById(Number(projectId));if(!project)return [];
    var ids=new Set();
    projectLinkedInventoryParts(projectId).forEach(function(part){ids.add(Number(part.id))});
    arr(project.plannedParts).forEach(function(x){if(x.partId)ids.add(Number(x.partId))});
    arr(project.partsUsed).forEach(function(x){if(x.partId)ids.add(Number(x.partId))});
    var rows=[...ids].map(function(id){
      var part=partById(id);if(!part)return null;
      var reservations=arr(project.plannedParts).filter(function(x){return Number(x.partId)===Number(id)});
      var uses=arr(project.partsUsed).filter(function(x){return Number(x.partId)===Number(id)});
      var reservedQty=reservations.reduce(function(s,x){return s+num(x.qty)},0);
      var usedQty=uses.reduce(function(s,x){return s+num(x.qty)},0);
      var on=typeof partAvailable==='function'?partAvailable(part):part.stockQty;
      var free=typeof partFreeQty==='function'?partFreeQty(part):on;
      var stage=usedQty>0?(reservedQty>0?'Used + Reserved':'Used'):(reservedQty>0?'Reserved':'Assigned');
      return {part:part,reservations:reservations,uses:uses,reservedQty:reservedQty,usedQty:usedQty,on:on,free:free,stage:stage};
    }).filter(Boolean);
    var custom=arr(project.partsUsed).filter(function(x){return !x.partId}).map(function(x){
      return {part:null,custom:x,reservations:[],uses:[x],reservedQty:0,usedQty:num(x.qty),on:null,free:null,stage:'Used'};
    });
    return rows.concat(custom).sort(function(a,b){
      var order={'Assigned':0,'Reserved':1,'Used + Reserved':2,'Used':3};
      return (order[a.stage]??9)-(order[b.stage]??9)||String(a.part?.name||a.custom?.name||'').localeCompare(String(b.part?.name||b.custom?.name||''),undefined,{numeric:true,sensitivity:'base'});
    });
  }

  function projectPartStageClass(stage){
    if(stage==='Used')return 'used';
    if(stage==='Reserved'||stage==='Used + Reserved')return 'reserved';
    return 'assigned';
  }

  function projectPartWorkspaceHTML(projectId){
    var project=projectById(Number(projectId));if(!project)return '';
    var rows=projectPartWorkspaceRows(projectId);
    var counts={assigned:0,reserved:0,used:0};
    rows.forEach(function(r){
      if(r.stage==='Assigned')counts.assigned++;
      if(r.reservedQty>0)counts.reserved++;
      if(r.usedQty>0)counts.used++;
    });
    return `<div class="detail-card project-parts-workspace" id="projectPartsWorkspace">
      <div class="section-tools project-parts-head">
        <div><h3>Project Parts</h3><div class="tiny muted">One workflow: Assigned → Reserved → Used. Assignment links a part; reservation holds quantity; Used records the actual installation/consumption and work history.</div></div>
        <div class="action-row">
          <button class="icon-btn" onclick="openAssignPartToProject(${project.id})">+ Assign</button>
          <button class="icon-btn" onclick="openReservePartModal(${project.id})">+ Reserve</button>
          <button class="icon-btn" onclick="addProjectPart(${project.id})">+ Use</button>
        </div>
      </div>
      <div class="project-parts-summary">
        <span><b>${counts.assigned}</b> Assigned</span>
        <span><b>${counts.reserved}</b> Reserved</span>
        <span><b>${counts.used}</b> Used</span>
      </div>
      <div class="project-parts-list">
        ${rows.length?rows.map(function(r){
          if(!r.part){
            var x=r.custom;
            return `<div class="project-part-row custom-used">
              <div><div class="project-part-title">${esc(x.name||'Material')}</div><div class="task-note">${esc(x.notes||'Custom / unlinked material')}</div></div>
              <div class="project-part-qty"><span class="project-part-stage used">Used</span><small>${esc(x.qty)} ${esc(x.unit||'')}</small></div>
              <div class="project-part-actions"><button class="icon-btn" onclick="removeProjectPart(${project.id},${JSON.stringify(x.id)})">Remove</button></div>
            </div>`;
          }
          var part=r.part,unit=part.unit||'ea',primaryReservation=r.reservations[0]||null;
          var detail=[];
          if(r.reservedQty>0)detail.push('Reserved '+r.reservedQty+' '+unit);
          if(r.usedQty>0)detail.push('Used '+r.usedQty+' '+unit);
          detail.push('On hand '+(r.on===null||r.on===undefined?'—':r.on+' '+unit));
          if(r.free!==null&&r.free!==undefined)detail.push('Free '+r.free+' '+unit);
          var note=[part.partNo?'PN '+part.partNo:'',part.system||'General',part.location||''].filter(Boolean).join(' • ');
          return `<div class="project-part-row">
            <div class="click-row" onclick="openPartDetail(${part.id})"><div class="project-part-title">${esc(part.name||'Part')}</div><div class="task-note">${esc(note)}</div></div>
            <div class="project-part-qty"><span class="project-part-stage ${projectPartStageClass(r.stage)}">${esc(r.stage)}</span><small>${esc(detail.join(' • '))}</small></div>
            <div class="project-part-actions">
              ${r.stage==='Assigned'?'<button class="secondary" onclick="openReserveSpecificPart('+project.id+','+part.id+')">Reserve</button>':''}
              ${r.stage==='Assigned'?'<button class="success" onclick="openAssignedPartUse('+project.id+','+part.id+')">Use</button>':''}
              ${r.reservedQty>0&&primaryReservation?'<button class="success" onclick="openUseReservedPartModal('+project.id+','+JSON.stringify(primaryReservation.id)+')">Use Reserved</button>':''}
              ${r.reservedQty>0&&primaryReservation?'<button class="secondary" onclick="removeReservedPart('+project.id+','+JSON.stringify(primaryReservation.id)+')">Release</button>':''}
              ${r.usedQty>0?'<button class="secondary" onclick="openProjectPartUseHistory('+project.id+','+part.id+')">Usage</button>':''}
              ${r.usedQty>0&&r.reservedQty<=0?'<button class="secondary" onclick="openAssignedPartUse('+project.id+','+part.id+')">Use More</button>':''}
              ${r.stage==='Assigned'?'<button class="icon-btn" onclick="unassignPartFromProject('+project.id+','+part.id+')">Unassign</button>':''}
            </div>
          </div>`;
        }).join(''):'<div class="empty">No project parts yet. Assign a part, reserve one for this job, or record something as used.</div>'}
      </div>
    </div>`;
  }

  window.openProjectPartUseHistory=function(projectId,partId){
    var project=projectById(Number(projectId)),part=partById(Number(partId));if(!project||!part)return;
    var uses=arr(project.partsUsed).filter(function(x){return Number(x.partId)===Number(part.id)});
    openModal(`${modalHeader('Part Usage History',project.title)}
      <div class="notice" style="margin-bottom:12px"><b>${esc(part.name)}</b><br>These entries are actual recorded use/install events. Removing one also reverses its linked work-log inventory consumption when that link exists.</div>
      <div class="detail-card">
        ${uses.length?uses.map(function(x){
          var log=x.logId?logById(Number(x.logId)):null;
          return `<div class="kv"><div><b>${esc((log?.date||'Date not recorded')+' • '+x.qty+' '+(x.unit||part.unit||'ea'))}</b><div class="task-note">${esc(x.notes||log?.work||'Recorded use')}</div></div><div class="action-row">${log?`<button class="secondary" onclick="openLogDetail(${log.id})">Work Log</button>`:''}<button class="danger" onclick="removeProjectPart(${project.id},${JSON.stringify(x.id)})">Remove</button></div></div>`;
        }).join(''):'<div class="empty">No recorded usage entries for this part.</div>'}
      </div>
      <div class="modal-actions"><button class="secondary" onclick="openProjectDetail(${project.id})">Back to Project</button></div>`,true);
  };

  window.openAssignPartToProject=function(projectId){
    var project=projectById(Number(projectId));if(!project)return;
    openModal(`${modalHeader('Assign Part to Project',project.title)}
      <div class="notice" style="margin-bottom:12px">Assignment only links the part to this project. It does not reserve quantity or reduce inventory.</div>
      <div class="form-grid">
        ${typeof searchablePartPicker==='function'?searchablePartPicker('apj',null,'Inventory part'):`<div class="full"><label>Inventory part</label><select id="apjPartFallback">${partOptions(null)}</select></div>`}
      </div>
      <div class="modal-actions"><button class="secondary" onclick="openProjectDetail(${project.id})">Cancel</button><button class="primary" onclick="saveAssignedPartToProject(${project.id})">Assign Part</button></div>`,true);
  };

  function assignedPartPickerId(){if(typeof partPickerId==='function')return partPickerId('apj');return selectedNumber('apjPartFallback')}

  window.saveAssignedPartToProject=function(projectId){
    var project=projectById(Number(projectId)),partId=assignedPartPickerId(),part=partId?partById(Number(partId)):null;
    if(!project||!part)return alert('Choose an inventory part.');
    part.linkedProjectIds=arr(part.linkedProjectIds).map(Number).filter(Boolean);
    if(!part.linkedProjectIds.includes(project.id))part.linkedProjectIds.push(project.id);
    saveDB('Part assigned to project.');
    openProjectDetail(project.id);
  };

  window.unassignPartFromProject=function(projectId,partId){
    var project=projectById(Number(projectId)),part=partById(Number(partId));if(!project||!part)return;
    var hasReservation=arr(project.plannedParts).some(function(x){return Number(x.partId)===Number(part.id)});
    var hasUse=arr(project.partsUsed).some(function(x){return Number(x.partId)===Number(part.id)});
    if(hasReservation||hasUse)return alert('Release the reservation first. Used parts remain related through project history.');
    if(!confirm('Remove this part assignment from the project? Inventory will not change.'))return;
    part.linkedProjectIds=arr(part.linkedProjectIds).filter(function(id){return Number(id)!==Number(project.id)});
    saveDB('Part unassigned from project.');
    openProjectDetail(project.id);
  };

  window.openReserveSpecificPart=function(projectId,partId){
    var project=projectById(Number(projectId)),part=partById(Number(partId));if(!project||!part)return;
    var free=typeof partFreeQty==='function'?partFreeQty(part):partAvailable(part);
    openModal(`${modalHeader('Reserve Assigned Part',project.title)}
      <div class="notice" style="margin-bottom:12px"><b>${esc(part.name)}</b><br>Free inventory: ${free===null||free===undefined?'—':esc(free+' '+(part.unit||'ea'))}. Reservation holds quantity for this project but does not consume it.</div>
      <div class="form-grid">${field('Quantity to reserve','rspQty','1','number','step="any" min="0.0001"')}${textareaField('Planning note','rspNotes','')}</div>
      <div class="modal-actions"><button class="secondary" onclick="openProjectDetail(${project.id})">Cancel</button><button class="primary" onclick="saveReserveSpecificPart(${project.id},${part.id})">Reserve</button></div>`);
  };

  window.saveReserveSpecificPart=function(projectId,partId){
    var project=projectById(Number(projectId)),part=partById(Number(partId)),qty=num(val('rspQty'));if(!project||!part)return;
    if(qty<=0)return alert('Enter a positive quantity.');
    var existing=arr(project.plannedParts).find(function(x){return Number(x.partId)===Number(part.id)});
    if(existing){existing.qty=num(existing.qty)+qty;if(val('rspNotes'))existing.notes=[existing.notes,val('rspNotes')].filter(Boolean).join(' • ')}
    else project.plannedParts.push({id:uid(),partId:part.id,name:part.name,qty:qty,unit:part.unit||'ea',notes:val('rspNotes')});
    if(!arr(part.linkedProjectIds).includes(project.id))part.linkedProjectIds.push(project.id);
    saveDB('Assigned part reserved for project.');
    openProjectDetail(project.id);
  };

  function injectProjectPartsWorkspace(projectId){
    var box=document.getElementById('modalBox');if(!box)return;
    box.querySelector('#projectPlannedPartsCard')?.remove();
    box.querySelector('#projectAssignedInventoryCard')?.remove();
    box.querySelector('#projectPartsWorkspace')?.remove();
    var left=box.querySelector('.detail-grid > div:first-child');if(!left)return;
    var cards=[...left.querySelectorAll(':scope > .detail-card')];
    var partsUsed=cards.find(function(card){return card.querySelector('h3')?.textContent?.trim()==='Parts Used'});
    if(partsUsed)partsUsed.remove();
    cards=[...left.querySelectorAll(':scope > .detail-card')];
    var overview=cards.find(function(card){return card.querySelector('h3')?.textContent?.trim()==='Project Overview'})||cards[0];
    if(overview)overview.insertAdjacentHTML('afterend',projectPartWorkspaceHTML(projectId));
    else left.insertAdjacentHTML('afterbegin',projectPartWorkspaceHTML(projectId));
  }

  var openProjectDetailInventoryLinkBase=window.openProjectDetail;
  window.openProjectDetail=function(id){
    openProjectDetailInventoryLinkBase(id);
    injectProjectPartsWorkspace(Number(id));
  };

  // ----- Quick Add 2.0 -----
  function openProjectsSelect(id,label,selected){
    var projects=arr(db.projects).filter(function(p){return p.status!=='Done'});
    return `<div class="full"><label>${esc(label||'Project')}</label><select id="${id}">${selectOptions(projects.map(function(p){return {value:p.id,label:p.title}}),selected||null,'— No project —')}</select></div>`;
  }

  window.openQuickReservedUse=function(){
    var count=arr(db.projects).reduce(function(n,p){return n+(p.status==='Done'?0:arr(p.plannedParts).filter(function(x){return !!x.partId}).length)},0);
    openModal(`${modalHeader('Use Reserved Part','Pick a reservation, then record actual use')}<input id="qruSearch" type="search" placeholder="Search project or part…" oninput="renderQuickReservedUseList()"><div id="qruList" class="quick-use-list"></div>${count?'':'<div class="empty">No active part reservations.</div>'}`);
    window.renderQuickReservedUseList();
  };

  window.renderQuickReservedUseList=function(){
    var box=document.getElementById('qruList');if(!box)return;var q=(val('qruSearch')||'').toLowerCase(),rows=[];
    arr(db.projects).filter(function(p){return p.status!=='Done'}).forEach(function(project){arr(project.plannedParts).forEach(function(item){var part=item.partId?partById(Number(item.partId)):null;if(!part)return;var hay=(project.title+' '+part.name+' '+(part.partNo||'')+' '+(part.system||'')).toLowerCase();if(q&&!hay.includes(q))return;rows.push({project:project,item:item,part:part})})});
    box.innerHTML=rows.map(function(r){return `<button class="quick-use-item" onclick="openUseReservedPartModal(${r.project.id},${JSON.stringify(r.item.id)})"><span class="quick-use-qty">${esc(r.item.qty)} ${esc(r.item.unit||r.part.unit||'ea')}</span><b>${esc(r.part.name)}</b><small>${esc(r.project.title)}${r.part.partNo?' • '+esc(r.part.partNo):''} • On hand ${esc(partAvailable(r.part)??'—')}</small></button>`}).join('')||'<div class="empty">No matching reservations.</div>';
  };

  window.openQuickPartUse=function(){
    openModal(`${modalHeader('Quick Part Used','Record actual physical use in a few fields')}<div class="form-grid">${typeof searchablePartPicker==='function'?searchablePartPicker('qpu',null,'Inventory part'):`<div class="full"><label>Inventory part</label><select id="qpuPartFallback">${partOptions(null)}</select></div>`}${openProjectsSelect('qpuProject','Project (optional)',null)}${field('Date','qpuDate',today(),'date')}${field('Quantity used','qpuQty','1','number','step="any" min="0.000001"')}${textareaField('Work performed','qpuWork','')}${textareaField('Notes / measurement','qpuNotes','')}</div><div class="modal-actions"><button class="btn secondary" onclick="openQuickAdd()">Back</button><button class="btn primary" onclick="saveQuickPartUse()">Record Use</button></div>`);
  };

  function quickPartPickerId(){if(typeof partPickerId==='function')return partPickerId('qpu');return selectedNumber('qpuPartFallback')}
  window.saveQuickPartUse=function(){
    var partId=quickPartPickerId(),part=partId?partById(Number(partId)):null;if(!part)return alert('Choose an inventory part.');var qty=Number(val('qpuQty'));if(!Number.isFinite(qty)||qty<=0)return alert('Enter a positive quantity.');
    if(typeof window.preparePartForPhysicalUse==='function')window.preparePartForPhysicalUse(part,qty);
    var projectId=selectedNumber('qpuProject'),project=projectId?projectById(projectId):null,on=partAvailable(part);if(on!==null&&qty>on&&!confirm('This use exceeds calculated physical inventory and will make the quantity negative. Record it anyway?'))return;
    var logId=uid(),consumedItemId=uid(),projectPartId=project?uid():null,unit=part.unit||'ea',work=val('qpuWork')||`Used ${part.name}${project?' on '+project.title:''}`,notes=val('qpuNotes')||'';
    db.logs.push({id:logId,date:val('qpuDate')||today(),airframeHours:'',engineHours:'',laborHours:'',system:project?.system||part.system||'General',projectIds:project?[project.id]:[],work:work,observations:notes,blockers:'',nextStep:'',consumedParts:[{id:consumedItemId,partId:part.id,name:part.name,qty:qty,unit:unit,unitCost:part.unitCost,notes:'Quick Add physical consumption',projectPartId:projectPartId}],otherCost:'',notes:'Created by Quick Add 2.0.',origin:'quick-part-use'});
    if(project){addProjectUseRecord(project,part,qty,unit,part.unitCost,notes,logId,consumedItemId,projectPartId);if(!arr(part.linkedProjectIds).includes(project.id))part.linkedProjectIds.push(project.id);var reserved=arr(project.plannedParts).find(function(x){return Number(x.partId)===Number(part.id)});if(reserved){reserved.qty=Math.max(0,num(reserved.qty)-qty);if(reserved.qty<=1e-9)project.plannedParts=arr(project.plannedParts).filter(function(x){return String(x.id)!==String(reserved.id)})}}
    saveDB('Part use recorded.');openLogDetail(logId);
  };

  window.openQuickNote=function(measurementMode){
    openModal(`${modalHeader(measurementMode?'Quick Measurement':'Quick Work Note',measurementMode?'Capture a reading or observation':'Minimal work-log entry')}<div class="form-grid">${openProjectsSelect('qnProject','Project (optional)',null)}${field('Date','qnDate',today(),'date')}${textareaField(measurementMode?'What are you measuring?':'Work / note','qnWork','')}${textareaField(measurementMode?'Reading / observation':'Details / observation','qnObs','')}</div><div class="modal-actions"><button class="btn secondary" onclick="openQuickAdd()">Back</button><button class="btn primary" onclick="saveQuickNote(${measurementMode?'true':'false'})">Save</button></div>`);
  };

  window.saveQuickNote=function(measurementMode){
    var projectId=selectedNumber('qnProject'),project=projectId?projectById(projectId):null,work=val('qnWork'),obs=val('qnObs');if(!work&&!obs)return alert('Enter a note or observation.');
    var title=work||(measurementMode?'Measurement / observation':'Work note'),logId=uid();db.logs.push({id:logId,date:val('qnDate')||today(),airframeHours:'',engineHours:'',laborHours:'',system:project?.system||'General',projectIds:project?[project.id]:[],work:title,observations:obs,blockers:'',nextStep:'',consumedParts:[],otherCost:'',notes:measurementMode?'Quick measurement entry.':'Quick work note.'});
    saveDB(measurementMode?'Measurement recorded.':'Work note recorded.');openLogDetail(logId);
  };

  window.openQuickAttach=function(){
    if(currentDetail&&currentDetail.type&&currentDetail.id){chooseAttachments(currentDetail.type,currentDetail.id);return;}
    var projects=arr(db.projects).filter(function(p){return p.status!=='Done'});if(!projects.length)return alert('Open a record first or create a project to attach the photo/file to.');
    openModal(`${modalHeader('Quick Photo / File','Attach directly to an active project')}<div><label>Project</label><select id="qaProject">${selectOptions(projects.map(function(p){return {value:p.id,label:p.title}}),projects[0]?.id,'— Select project —')}</select></div><div class="modal-actions"><button class="btn secondary" onclick="openQuickAdd()">Back</button><button class="btn primary" onclick="chooseQuickAttachmentTarget()">Choose Photo / File</button></div>`);
  };
  window.chooseQuickAttachmentTarget=function(){var pid=selectedNumber('qaProject');if(!pid)return alert('Choose a project.');chooseAttachments('project',pid)};

  window.openQuickAdd=function(){
    openModal(`${modalHeader('Quick Add','Fast capture while you are standing next to N594ZS')}<div class="quick-add-grid"><button onclick="openQuickReservedUse()">Use reserved part<small>Reservation → actual use → inventory deduction</small></button><button onclick="openQuickPartUse()">Part / material used<small>Search inventory and record physical consumption</small></button><button onclick="openQuickNote(false)">Work note<small>Fast project or general work entry</small></button><button onclick="openQuickNote(true)">Measurement<small>Capture a reading, setting or observation</small></button><button onclick="openQuickAttach()">Photo / file<small>Attach to the current record or an active project</small></button><button onclick="openSquawkModal()">Squawk<small>Discrepancy, severity, troubleshooting</small></button><button onclick="openRunModal()">Run / test<small>Engine, ground, taxi or flight-test data</small></button><button onclick="openPurchaseModal()">Purchase<small>Add a purchase-history line</small></button><button onclick="openProjectModal()">Project<small>New job or corrective-work item</small></button><button onclick="navTo('ops');closeModal()">Aircraft Ops<small>Status, configuration, inspections and reports</small></button></div>`);
  };

  if(!document.getElementById('assignedProjectPartsStyle')){
    var aps=document.createElement('style');aps.id='assignedProjectPartsStyle';
    aps.textContent='.assigned-part-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid #edf1f4}.assigned-part-row:last-child{border-bottom:0}.assigned-part-stock{text-align:right}.assigned-part-stock small{display:block;color:var(--muted);margin-top:4px;white-space:nowrap}@media(max-width:700px){.assigned-part-row{grid-template-columns:1fr}.assigned-part-stock{text-align:left}.assigned-part-stock small{white-space:normal}}';
    document.head.appendChild(aps);
  }

})();
