// ---------- v5.19.42 PRODUCTION ATOMIC INVENTORY TRANSACTIONS ----------
// All core physical-inventory mutations use the durable, one-at-a-time atomic
// journal automatically in an authenticated cloud workspace: receipts,
// manual adjustments, part use/consumption and purchase stock receipts.
(function(){
  'use strict';
  if(window.atomicReceiptOutbox)return;
  const KEY='n594zs_atomic_receipt_outbox_v1';
  const LEGACY_RECEIPT_OPT='n594zs_atomic_receipts_opt_in_v1';
  const ADJUST_OPT='n594zs_atomic_adjustments_opt_in_v1';
  const CONSUME_OPT='n594zs_atomic_consumption_opt_in_v1';
  const SNAP='n594zs_record_snapshot_v4';
  const VERS='n594zs_record_versions_v1';
  const RESOLVED='n594zs_atomic_receipt_resolutions_v1';
  const PENDING='n594zs_pending_cloud_v4';
  let inFlight=null, syncInFlight=null;

  function copy(x){return typeof structuredClone==='function'?structuredClone(x):JSON.parse(JSON.stringify(x))}
  function stable(x){return cloudStableJSON(x)}
  function key(t,id){return cloudRecordKey(t,id)}
  function read(){
    const raw=localStorage.getItem(KEY);
    if(!raw)return null;
    let e;
    try{e=JSON.parse(raw)}catch(_e){throw new Error('Pending receipt journal is unreadable; do not reload shared data.')}
    if(e?.format!=='N594ZS_ATOMIC_RECEIPT_V1'||!e.operationId||
       !e.workspaceId||!e.userId||!Array.isArray(e.changes)||!e.changes.length||
       !Array.isArray(e.before))throw new Error('Pending receipt journal failed validation.');
    return e;
  }
  function write(e){
    const json=JSON.stringify(e);
    localStorage.setItem(KEY,json);
    if(localStorage.getItem(KEY)!==json)throw new Error('Browser did not retain the receipt journal.');
  }
  function pending(){return !!localStorage.getItem(KEY)}
  // An existing Work Log referenced by an unacknowledged atomic journal must
  // not be edited: it would prevent recoverLocal() from validating the
  // original staged payload. An unreadable or foreign journal fails closed.
  function isPendingRecord(type,id){
    if(!pending())return false;
    try{
      const e=read();
      if(e.workspaceId!==cloudWorkspaceId||e.userId!==cloudSession?.user?.id)
        return type==='log';
      return e.changes.some(r=>r.record_type===type&&String(r.record_id)===String(id));
    }catch(error){
      console.warn('Atomic journal unreadable during pending record check',error);
      return type==='log';
    }
  }
  function receiptReady(){return !!supa&&!!cloudSession&&!!cloudWorkspaceId}
  // Kept as a public compatibility accessor. For receipts, "enabled" now
  // means the authenticated production path is available; no device opt-in.
  function enabled(){return receiptReady()}
  // Compatibility accessors retained for older modules/UI. In v5.19.42 the
  // core adjustment and consumption paths are production-default too.
  function adjustmentsEnabled(){return receiptReady()}
  function consumptionEnabled(){return receiptReady()}
  function purchaseReceiptsEnabled(){return receiptReady()}
  function shouldHandle(kind='receipt'){
    // Never bypass an earlier journal, regardless of which workflow created it.
    if(pending())return true;
    if(['receipt','adjustment','consumption','purchase'].includes(kind))return receiptReady();
    return false;
  }
  function snapshot(){
    const out=new Map();
    for(const [type,arrayKey] of [['order','orders'],['part','parts'],['project','projects'],['log','logs'],['purchase','purchases']])
      for(const row of arr(db[arrayKey])){
        const k=key(type,row.id);
        out.set(k,{key:k,record_type:type,record_id:String(row.id),data:copy(row)});
      }
    return out;
  }
  function restore(old){
    Object.keys(db).forEach(k=>delete db[k]);
    Object.assign(db,copy(old));
  }
  function validateIdentity(e){
    if(e.workspaceId!==cloudWorkspaceId||e.userId!==cloudSession?.user?.id)
      throw new Error('A pending receipt belongs to a different workspace or account. Do not discard it.');
  }

  function validateConsumptionEnvelope(before,after,changes,touchedKeys,old,meta,allowNewLog){
    const wanted=new Set(changes.map(r=>key(r.record_type,r.record_id)));
    const touched=new Set(touchedKeys);
    if(wanted.size!==changes.length||wanted.size!==touched.size||
       [...wanted].some(k=>!touched.has(k)))
      throw new Error('Consumption touched records outside the atomic transaction.');
    for(const k of Object.keys(old)){
      if(['parts','projects','logs','purchases'].includes(k))continue;
      if(stable(old[k])!==stable(db[k]))
        throw new Error('Consumption unexpectedly modified '+k+'.');
    }
    for(const [k,row] of before){
      if(!after.has(k))throw new Error('Consumption unexpectedly deleted '+k+'.');
      if(!wanted.has(k)&&stable(row.data)!==stable(after.get(k).data))
        throw new Error('Consumption changed an untracked record: '+k);
    }
    for(const [k] of after){
      if(!before.has(k)&&(!allowNewLog||k!==key('log',meta.logId)))
        throw new Error('Consumption unexpectedly created '+k+'.');
    }
  }

  function validateUsePartAndPurchases(before,changes,meta,allowedProjectIds=[]){
    const partChanges=changes.filter(r=>r.record_type==='part');
    if(partChanges.length!==1||String(partChanges[0].record_id)!==String(meta.partId))
      throw new Error('Consumption must version-lock exactly one source Part.');
    const originalPart=before.get(key('part',meta.partId))?.data,nextPart=partChanges[0].data;
    if(!originalPart)throw new Error('Consumption source Part baseline is missing.');
    const oldPart=copy(originalPart),newPart=copy(nextPart);
    delete oldPart.stockQty;delete oldPart.linkedProjectIds;
    delete newPart.stockQty;delete newPart.linkedProjectIds;
    const oldLinks=arr(originalPart.linkedProjectIds).map(String);
    const newLinks=arr(nextPart.linkedProjectIds).map(String);
    const allowed=new Set(arr(allowedProjectIds).filter(x=>x!==null&&x!==undefined).map(String));
    if(stable(oldPart)!==stable(newPart)||
       oldLinks.some(id=>!newLinks.includes(id))||
       newLinks.some(id=>!oldLinks.includes(id)&&!allowed.has(id)))
      throw new Error('Consumption changed unrelated Part fields or project links.');
    let credited=0;
    for(const purchase of changes.filter(r=>r.record_type==='purchase')){
      const original=before.get(key('purchase',purchase.record_id))?.data,updated=purchase.data;
      if(!original||original.disposition!=='Installed')
        throw new Error('Only an existing Installed Purchase can materialize receipts.');
      const prior=Number(original.inventoryReceiptMaterializedQty)||0;
      const next=Number(updated.inventoryReceiptMaterializedQty);
      const delta=next-prior;
      if(!Number.isFinite(delta)||delta<=0||next>Number(original.qty)+1e-9||
         updated.inventoryReceiptMaterialized!==true||updated.inventoryApplied!==true)
        throw new Error('Purchase credit is not a valid single receipt materialization.');
      const cleanOld=copy(original),cleanNew=copy(updated);
      for(const field of ['inventoryReceiptMaterializedQty','inventoryReceiptMaterialized','inventoryApplied']){
        delete cleanOld[field];delete cleanNew[field];
      }
      if(stable(cleanOld)!==stable(cleanNew))
        throw new Error('Purchase had an unrelated change during consumption.');
      credited+=delta;
    }
    if(Math.abs((Number(nextPart.stockQty)||0)-(Number(originalPart.stockQty)||0)-credited)>1e-9)
      throw new Error('Purchase receipts and Part stock credit do not reconcile.');
  }

  function validateNewUseLog(before,changes,meta,origin,projectIds){
    const logs=changes.filter(r=>r.record_type==='log');
    if(logs.length!==1||String(logs[0].record_id)!==String(meta.logId)||
       before.has(key('log',meta.logId)))
      throw new Error('Consumption must create exactly one new Work Log.');
    const log=logs[0].data,expectedProjects=arr(projectIds).map(String);
    if(String(log.id)!==String(meta.logId)||log.origin!==origin||
       !Array.isArray(log.consumedParts)||log.consumedParts.length!==1||
       arr(log.projectIds).length!==expectedProjects.length||
       expectedProjects.some(id=>!arr(log.projectIds).map(String).includes(id)))
      throw new Error('Atomic consumption Work Log does not match the requested use.');
    const consumed=log.consumedParts[0];
    const expectedProjectPart=meta.projectPartId==null?null:String(meta.projectPartId);
    const actualProjectPart=consumed.projectPartId==null?null:String(consumed.projectPartId);
    if(String(consumed.id)!==String(meta.consumedItemId)||
       String(consumed.partId)!==String(meta.partId)||
       actualProjectPart!==expectedProjectPart||
       Math.abs(Number(consumed.qty)-Number(meta.qty))>1e-9)
      throw new Error('Work Log consumption does not match the requested Part and quantity.');
  }

  function validateProjectUseAppend(before,changes,meta,reservationMode,strictReservation=true){
    const projects=changes.filter(r=>r.record_type==='project');
    if(projects.length!==1||String(projects[0].record_id)!==String(meta.projectId))
      throw new Error('Consumption must update exactly one matching Project.');
    const original=before.get(key('project',meta.projectId))?.data,next=projects[0].data;
    if(!original)throw new Error('Consumption Project baseline is missing.');
    const priorUsed=arr(original.partsUsed),afterUsed=arr(next.partsUsed),used=afterUsed[afterUsed.length-1];
    if(afterUsed.length!==priorUsed.length+1||
       stable(afterUsed.slice(0,-1))!==stable(priorUsed)||
       String(used?.id)!==String(meta.projectPartId)||
       String(used?.logId)!==String(meta.logId)||
       String(used?.consumedItemId)!==String(meta.consumedItemId)||
       String(used?.partId)!==String(meta.partId)||
       Math.abs(Number(used?.qty)-Number(meta.qty))>1e-9)
      throw new Error('Project Parts Used entry must match the Work Log.');
    let expectedReservations=copy(arr(original.plannedParts));
    if(reservationMode){
      const selected=expectedReservations.find(x=>String(x.id)===String(meta.reservationId));
      if(!selected||String(selected.partId)!==String(meta.partId)||
         (strictReservation&&Number(meta.qty)>Number(selected.qty)+1e-9))
        throw new Error('Reserved quantity changed; refresh before recording use.');
      selected.qty=Math.max(0,Number(selected.qty)-Number(meta.qty));
      if(selected.qty<=1e-9)
        expectedReservations=expectedReservations.filter(x=>String(x.id)!==String(meta.reservationId));
    }
    if(stable(arr(next.plannedParts))!==stable(expectedReservations))
      throw new Error('Project reservation state does not match the requested use.');
    const cleanOld=copy(original),cleanNew=copy(next);
    delete cleanOld.plannedParts;delete cleanOld.partsUsed;
    delete cleanNew.plannedParts;delete cleanNew.partsUsed;
    if(stable(cleanOld)!==stable(cleanNew))
      throw new Error('Consumption changed an unrelated Project field.');
  }

  function validateAssignedConsumption(before,after,changes,touchedKeys,old,meta){
    if(!(Number(meta?.qty)>0)||!Number.isFinite(Number(meta.qty))||
       meta.partId==null||meta.projectId==null||meta.logId==null||
       meta.consumedItemId==null||meta.projectPartId==null)
      throw new Error('Atomic assigned-part use metadata is incomplete.');
    const byType=type=>changes.filter(r=>r.record_type===type);
    if(changes.some(r=>!['part','project','log','purchase'].includes(r.record_type))||
       byType('project').length!==1||byType('log').length!==1)
      throw new Error('Assigned part use may change only one Part, one Project, one new Work Log and Installed Purchase provenance.');
    validateConsumptionEnvelope(before,after,changes,touchedKeys,old,meta,true);
    validateNewUseLog(before,changes,meta,'assigned-part-use',[meta.projectId]);
    validateProjectUseAppend(before,changes,meta,false);
    validateUsePartAndPurchases(before,changes,meta,[meta.projectId]);
  }

  function validateQuickConsumption(before,after,changes,touchedKeys,old,meta){
    if(!(Number(meta?.qty)>0)||!Number.isFinite(Number(meta.qty))||
       meta.partId==null||meta.logId==null||meta.consumedItemId==null)
      throw new Error('Atomic quick-part use metadata is incomplete.');
    const byType=type=>changes.filter(r=>r.record_type===type);
    const hasProject=meta.projectId!==null&&meta.projectId!==undefined;
    if(changes.some(r=>!['part','project','log','purchase'].includes(r.record_type))||
       byType('log').length!==1||byType('project').length!==(hasProject?1:0))
      throw new Error('Quick part use changed an unexpected record type.');
    if(hasProject&&meta.projectPartId==null)
      throw new Error('Quick project use is missing its Parts Used identity.');
    validateConsumptionEnvelope(before,after,changes,touchedKeys,old,meta,true);
    validateNewUseLog(before,changes,meta,'quick-part-use',hasProject?[meta.projectId]:[]);
    if(hasProject)validateProjectUseAppend(before,changes,meta,meta.reservationId!=null,false);
    validateUsePartAndPurchases(before,changes,meta,hasProject?[meta.projectId]:[]);
  }

  function validateLogAddConsumption(before,after,changes,touchedKeys,old,meta){
    if(!(Number(meta?.qty)>0)||!Number.isFinite(Number(meta.qty))||
       meta.partId==null||meta.logId==null||meta.consumedItemId==null)
      throw new Error('Atomic Work Log consumption metadata is incomplete.');
    const byType=type=>changes.filter(r=>r.record_type===type);
    if(changes.some(r=>!['part','log','purchase'].includes(r.record_type))||
       byType('log').length!==1||String(byType('log')[0].record_id)!==String(meta.logId))
      throw new Error('Work Log consumption changed an unexpected record.');
    validateConsumptionEnvelope(before,after,changes,touchedKeys,old,meta,false);
    const original=before.get(key('log',meta.logId))?.data,next=byType('log')[0].data;
    if(!original)throw new Error('Work Log consumption baseline is missing.');
    const oldItems=arr(original.consumedParts),newItems=arr(next.consumedParts),item=newItems[newItems.length-1];
    if(newItems.length!==oldItems.length+1||stable(newItems.slice(0,-1))!==stable(oldItems)||
       String(item?.id)!==String(meta.consumedItemId)||
       String(item?.partId)!==String(meta.partId)||
       Math.abs(Number(item?.qty)-Number(meta.qty))>1e-9)
      throw new Error('Work Log consumed item was not appended exactly once.');
    const cleanOld=copy(original),cleanNew=copy(next);
    delete cleanOld.consumedParts;delete cleanNew.consumedParts;
    if(stable(cleanOld)!==stable(cleanNew))
      throw new Error('Adding a consumed item changed unrelated Work Log fields.');
    validateUsePartAndPurchases(before,changes,meta,arr(meta.projectIds));
  }

  function validatePurchaseReceipt(before,after,changes,touchedKeys,old,meta){
    if(!(Number(meta?.qty)>0)||!Number.isFinite(Number(meta.qty))||
       meta.purchaseId==null||meta.partId==null)
      throw new Error('Atomic purchase receipt metadata is incomplete.');
    if(changes.some(r=>!['part','purchase'].includes(r.record_type)))
      throw new Error('Purchase receipt changed an unexpected record type.');
    const partChange=changes.filter(r=>r.record_type==='part');
    const purchaseChange=changes.filter(r=>r.record_type==='purchase');
    if(partChange.length!==1||purchaseChange.length!==1||
       String(partChange[0].record_id)!==String(meta.partId)||
       String(purchaseChange[0].record_id)!==String(meta.purchaseId))
      throw new Error('Purchase receipt must change exactly one Purchase and one linked Part.');
    const wanted=new Set(changes.map(r=>key(r.record_type,r.record_id)));
    const touched=new Set(touchedKeys);
    if(wanted.size!==2||touched.size!==2||[...wanted].some(k=>!touched.has(k)))
      throw new Error('Purchase receipt touched records outside its atomic transaction.');
    for(const [k,row] of before){
      if(!after.has(k))throw new Error('Purchase receipt unexpectedly deleted '+k+'.');
      if(!wanted.has(k)&&stable(row.data)!==stable(after.get(k).data))
        throw new Error('Purchase receipt changed an untracked record: '+k);
    }
    for(const [k] of after)if(!before.has(k))
      throw new Error('Purchase receipt unexpectedly created '+k+'.');
    const originalPurchase=before.get(key('purchase',meta.purchaseId))?.data,nextPurchase=purchaseChange[0].data;
    if(!originalPurchase||originalPurchase.inventoryApplied)
      throw new Error('Purchase was already applied or its baseline is missing.');
    const cleanPurchaseOld=copy(originalPurchase),cleanPurchaseNew=copy(nextPurchase);
    for(const field of ['inventoryPartId','inventoryApplied','disposition','remainingQty']){
      delete cleanPurchaseOld[field];delete cleanPurchaseNew[field];
    }
    if(stable(cleanPurchaseOld)!==stable(cleanPurchaseNew)||
       String(nextPurchase.inventoryPartId)!==String(meta.partId)||
       nextPurchase.inventoryApplied!==true||nextPurchase.disposition!=='On Hand'||
       Math.abs(Number(nextPurchase.remainingQty)-Number(meta.qty))>1e-9)
      throw new Error('Purchase receipt fields do not match the requested inventory credit.');
    const originalPart=before.get(key('part',meta.partId))?.data,nextPart=partChange[0].data;
    if(!originalPart)throw new Error('Purchase receipt Part baseline is missing.');
    if(Math.abs((Number(nextPart.stockQty)||0)-(Number(originalPart.stockQty)||0)-Number(meta.qty))>1e-9||
       nextPart.status!=='On Hand')
      throw new Error('Purchase receipt Part quantity/status does not match the received quantity.');
    const cleanPartOld=copy(originalPart),cleanPartNew=copy(nextPart);
    for(const field of ['stockQty','status','vendor','location','linkedProjectIds']){
      delete cleanPartOld[field];delete cleanPartNew[field];
    }
    if(stable(cleanPartOld)!==stable(cleanPartNew))
      throw new Error('Purchase receipt changed unrelated Part fields.');
    const oldLinks=arr(originalPart.linkedProjectIds).map(String),newLinks=arr(nextPart.linkedProjectIds).map(String);
    const allowedProject=originalPurchase.projectId==null?null:String(originalPurchase.projectId);
    if(oldLinks.some(id=>!newLinks.includes(id))||
       newLinks.some(id=>!oldLinks.includes(id)&&id!==allowedProject))
      throw new Error('Purchase receipt changed unrelated Part project links.');
  }

  // Reserved -> Use keeps its existing strict validator. Other physical-use
  // modes dispatch to equally scoped validators above.
  function validateConsumption(before,after,changes,touchedKeys,old,meta){
    if(meta?.mode==='assigned')return validateAssignedConsumption(before,after,changes,touchedKeys,old,meta);
    if(meta?.mode==='quick')return validateQuickConsumption(before,after,changes,touchedKeys,old,meta);
    if(meta?.mode==='log-add')return validateLogAddConsumption(before,after,changes,touchedKeys,old,meta);

    if(meta?.mode!=='reserved'||!(Number(meta.qty)>0)||
       !Number.isFinite(Number(meta.qty))||meta.partId==null||
       meta.projectId==null||meta.logId==null||meta.reservationId==null)
      throw new Error('Atomic consumption requires one specific Reserve -> Use transaction.');
    const byType=type=>changes.filter(r=>r.record_type===type);
    if(changes.some(r=>!['part','project','log','purchase'].includes(r.record_type))||
       byType('part').length!==1||byType('project').length!==1||
       byType('log').length!==1||
       String(byType('part')[0].record_id)!==String(meta.partId)||
       String(byType('project')[0].record_id)!==String(meta.projectId)||
       String(byType('log')[0].record_id)!==String(meta.logId))
      throw new Error('Atomic consumption must stage one Part, one Project and one new Work Log.');
    const wanted=new Set(changes.map(r=>key(r.record_type,r.record_id)));
    const touched=new Set(touchedKeys);
    if(wanted.size!==changes.length||wanted.size!==touched.size||
       [...wanted].some(k=>!touched.has(k)))
      throw new Error('Consumption touched records outside the atomic transaction.');
    for(const k of Object.keys(old)){
      if(['parts','projects','logs','purchases'].includes(k))continue;
      if(stable(old[k])!==stable(db[k]))
        throw new Error('Consumption unexpectedly modified '+k+'.');
    }
    for(const [k,row] of before){
      if(!after.has(k))throw new Error('Consumption unexpectedly deleted '+k+'.');
      if(!wanted.has(k)&&stable(row.data)!==stable(after.get(k).data))
        throw new Error('Consumption changed an untracked record: '+k);
    }
    for(const [k] of after){
      if(!before.has(k)&&k!==key('log',meta.logId))
        throw new Error('Consumption unexpectedly created '+k+'.');
    }
    const log=byType('log')[0].data;
    if(before.has(key('log',meta.logId))||
       !Array.isArray(log.consumedParts)||log.consumedParts.length!==1||
       String(log.id)!==String(meta.logId)||
       log.origin!=='reserved-part-use'||
       !arr(log.projectIds).some(id=>String(id)===String(meta.projectId))||
       arr(log.projectIds).length!==1)
      throw new Error('Atomic consumption Work Log is not a unique reserved-use entry.');
    const consumed=log.consumedParts[0];
    if(String(consumed.id)!==String(meta.consumedItemId)||
       String(consumed.partId)!==String(meta.partId)||
       String(consumed.projectPartId)!==String(meta.projectPartId)||
       Math.abs(Number(consumed.qty)-Number(meta.qty))>1e-9)
      throw new Error('Work Log consumption does not match the requested Part and quantity.');
    const originalProject=before.get(key('project',meta.projectId))?.data;
    const nextProject=byType('project')[0].data;
    if(!originalProject||String(nextProject.id)!==String(meta.projectId))
      throw new Error('Consumption Project baseline is missing.');
    const oldReservation=arr(originalProject.plannedParts).find(x=>String(x.id)===String(meta.reservationId));
    if(!oldReservation||String(oldReservation.partId)!==String(meta.partId)||
       Number(meta.qty)>Number(oldReservation.qty)+1e-9)
      throw new Error('Reserved quantity changed; refresh before recording use.');
    const expectedReservations=copy(arr(originalProject.plannedParts));
    const selected=expectedReservations.find(x=>String(x.id)===String(meta.reservationId));
    selected.qty=Math.max(0,Number(selected.qty)-Number(meta.qty));
    const expectedRemaining=selected.qty<=1e-9?expectedReservations.filter(x=>String(x.id)!==String(meta.reservationId)):expectedReservations;
    const priorUsed=arr(originalProject.partsUsed),afterUsed=arr(nextProject.partsUsed);
    const used=afterUsed[afterUsed.length-1];
    if(stable(arr(nextProject.plannedParts))!==stable(expectedRemaining)||
       afterUsed.length!==priorUsed.length+1||
       stable(afterUsed.slice(0,-1))!==stable(priorUsed)||
       String(used?.id)!==String(meta.projectPartId)||
       String(used?.logId)!==String(meta.logId)||
       String(used?.consumedItemId)!==String(meta.consumedItemId)||
       String(used?.partId)!==String(meta.partId)||
       Math.abs(Number(used?.qty)-Number(meta.qty))>1e-9)
      throw new Error('Project reservation release and Parts Used entry must match the Work Log.');
    const strippedProjectBefore=copy(originalProject),strippedProjectAfter=copy(nextProject);
    delete strippedProjectBefore.plannedParts;delete strippedProjectBefore.partsUsed;
    delete strippedProjectAfter.plannedParts;delete strippedProjectAfter.partsUsed;
    if(stable(strippedProjectBefore)!==stable(strippedProjectAfter))
      throw new Error('Consumption changed an unrelated Project field.');
    const originalPart=before.get(key('part',meta.partId))?.data,nextPart=byType('part')[0].data;
    if(!originalPart||String(nextPart.id)!==String(meta.partId))
      throw new Error('Consumption source Part baseline is missing.');
    const oldPart=copy(originalPart),newPart=copy(nextPart);
    delete oldPart.stockQty;delete oldPart.linkedProjectIds;
    delete newPart.stockQty;delete newPart.linkedProjectIds;
    if(stable(oldPart)!==stable(newPart)||
       !arr(nextPart.linkedProjectIds).some(id=>String(id)===String(meta.projectId))||
       arr(originalPart.linkedProjectIds).some(id=>!arr(nextPart.linkedProjectIds).some(n=>String(n)===String(id))))
      throw new Error('Consumption changed unrelated Part fields or project links.');
    let credited=0;
    for(const purchase of byType('purchase')){
      const original=before.get(key('purchase',purchase.record_id))?.data,updated=purchase.data;
      if(!original||original.disposition!=='Installed')
        throw new Error('Only an existing Installed Purchase can materialize receipts.');
      const prior=Number(original.inventoryReceiptMaterializedQty)||0;
      const next=Number(updated.inventoryReceiptMaterializedQty);
      const delta=next-prior;
      if(!Number.isFinite(delta)||delta<=0||next>Number(original.qty)+1e-9||
         updated.inventoryReceiptMaterialized!==true||updated.inventoryApplied!==true)
        throw new Error('Purchase credit is not a valid single receipt materialization.');
      const cleanOld=copy(original),cleanNew=copy(updated);
      for(const field of ['inventoryReceiptMaterializedQty','inventoryReceiptMaterialized','inventoryApplied']){
        delete cleanOld[field];delete cleanNew[field];
      }
      if(stable(cleanOld)!==stable(cleanNew))
        throw new Error('Purchase had an unrelated change during consumption.');
      credited+=delta;
    }
    if(Math.abs((Number(nextPart.stockQty)||0)-(Number(originalPart.stockQty)||0)-credited)>1e-9)
      throw new Error('Purchase receipts and Part stock credit do not reconcile.');
  }

  function stage(work,message,kind='receipt',meta=null){
    const adjustment=kind==='adjustment',consumption=kind==='consumption',purchaseReceipt=kind==='purchase';
    if(!shouldHandle(kind)||!supa||!cloudSession||!cloudWorkspaceId)
      throw new Error('Atomic '+(adjustment?'adjustments':consumption?'part consumption':purchaseReceipt?'purchase receipts':'receipts')+' requires an authenticated workspace. Connect without discarding local changes.');
    if(!canCloudEdit())throw new Error('This workspace is read-only.');
    if(pending())throw new Error('An earlier receipt is still pending, or another atomic operation is awaiting sync. Review it before changing inventory.');
    if(localStorage.getItem(PENDING)==='1')
      throw new Error('Other changes are waiting to sync. Wait for Synced or resolve the conflict before receiving.');
    if(!cloudRecordSnapshot?.size)throw new Error('Cloud baseline is not available. Wait until the tracker finishes loading.');
    if(typeof crypto?.randomUUID!=='function')throw new Error('Secure receipt operation IDs are unavailable.');
    const before=snapshot(),old=copy(db);
    let result,journalWritten=false,touchedKeys=[];
    try{
      // The scoped store rolls back an intermediate mutation error before we
      // ever create a journal. Do not use live captured Part/Order references.
      result=trackerStore.batch(work,{persist:false,beforePersist:details=>{touchedKeys=details.keys}});
      const after=snapshot(),changes=[],originals=[];
      for(const [k,r] of after){
        const prior=before.get(k);
        if(!prior){
          if(!consumption||r.record_type!=='log')throw new Error('Atomic operation unexpectedly created '+k+'.');
          if(cloudRecordSnapshot.has(k)||cloudRecordVersions.has(k))throw new Error('New Work Log ID already exists in the cloud baseline.');
          changes.push({record_type:'log',record_id:r.record_id,data:r.data,deleted_at:null,expected_version:0,updated_client:CLOUD_CLIENT_ID});
          originals.push({key:k,data:null});
          continue;
        }
        if(stable(prior.data)===stable(r.data))continue;
        if(!cloudRecordSnapshot.has(k)||cloudRecordSnapshot.get(k)!==stable(prior.data))
          throw new Error('The '+r.record_type+' has unverified local edits; sync first.');
        changes.push({
          record_type:r.record_type,record_id:r.record_id,data:r.data,
          deleted_at:null,expected_version:Number(cloudRecordVersions.get(k))||0,
          updated_client:CLOUD_CLIENT_ID
        });
        originals.push({key:k,data:prior.data});
      }
      if(consumption){
        // A consumption outflow is logged, not subtracted from stockQty. Lock
        // the source Part's version even if its own payload was unchanged.
        const pk=key('part',meta?.partId),original=before.get(pk);
        if(!original||!after.has(pk))throw new Error('Consumption source Part is missing.');
        if(!changes.some(r=>key(r.record_type,r.record_id)===pk)){
          if(!cloudRecordSnapshot.has(pk)||cloudRecordSnapshot.get(pk)!==stable(original.data))
            throw new Error('Source Part has unverified local edits; sync first.');
          changes.push({record_type:'part',record_id:String(meta.partId),data:after.get(pk).data,deleted_at:null,expected_version:Number(cloudRecordVersions.get(pk))||0,updated_client:CLOUD_CLIENT_ID});
          originals.push({key:pk,data:original.data});
        }
      }
      if(!changes.length)throw new Error('Atomic operation changed no records.');
      if(adjustment){
        // Atomic adjustments are limited to one existing Part and one append-only
        // ledger entry; stockQty, unrelated Part fields and records are immutable.
        if(changes.length!==1||changes[0].record_type!=='part')
          throw new Error('Atomic adjustment must change exactly one existing Part.');
        const change=changes[0],original=before.get(key('part',change.record_id))?.data;
        if(!original)throw new Error('Atomic adjustment Part baseline is missing.');
        const beforeRow=copy(original),afterRow=copy(change.data);
        const previous=arr(beforeRow.inventoryAdjustments),next=arr(afterRow.inventoryAdjustments);
        delete beforeRow.inventoryAdjustments;delete afterRow.inventoryAdjustments;
        if(stable(beforeRow)!==stable(afterRow)||next.length!==previous.length+1||
           stable(next.slice(0,-1))!==stable(previous))
          throw new Error('Atomic adjustment may only append one inventory-history entry.');
        const entry=next[next.length-1];
        if(!entry?.id||!Number.isFinite(Number(entry.delta))||Number(entry.delta)===0||
           previous.some(row=>String(row.id)===String(entry.id)))
          throw new Error('Atomic adjustment history entry is invalid or duplicated.');
        if(touchedKeys.length!==1||touchedKeys[0]!==key('part',change.record_id)||
           Object.keys(old).some(k=>k!=='parts'&&k!=='orders'&&stable(old[k])!==stable(db[k])))
          throw new Error('Atomic adjustment touched an unrelated record.');
      }else if(consumption){
        validateConsumption(before,after,changes,touchedKeys,old,meta);
      }else if(purchaseReceipt){
        validatePurchaseReceipt(before,after,changes,touchedKeys,old,meta);
      }else if(!changes.some(r=>r.record_type==='order'))
        throw new Error('Receipt did not produce a changed Order record.');
      // Production receipts may legitimately be Order-only when no inventory
      // Part is linked. But if an Order DOES name a Part, that Part must be
      // updated in this same operation so inventory can never be partially
      // acknowledged separately from the receipt.
      for(const order of (adjustment||consumption?[]:changes.filter(r=>r.record_type==='order'))){
        const linkedId=order.data?.partId;
        if(!linkedId)continue;
        const partIncluded=changes.some(r=>r.record_type==='part'&&
          String(r.record_id)===String(linkedId));
        if(!partIncluded)
          throw new Error('Receipt for '+(order.data?.item||('Order '+order.record_id))+
            ' is linked to inventory Part '+linkedId+' but that Part was not updated in the same atomic operation. Stop and review the order/part link before retrying.');
      }
      if(changes.length>50)throw new Error('A receipt can change at most 50 records.');
      const afterKeys=new Set(changes.map(r=>key(r.record_type,r.record_id)));
      for(const k of before.keys())if(!after.has(k))
        throw new Error('Receipt unexpectedly removed a Part or Order.');
      if([...after.keys()].some(k=>!before.has(k)&&!afterKeys.has(k)))
        throw new Error('Receipt unexpectedly created a Part or Order.');
      const e={
        format:'N594ZS_ATOMIC_RECEIPT_V1',operationKind:kind,
        operationId:crypto.randomUUID(),workspaceId:cloudWorkspaceId,
        userId:cloudSession.user.id,createdAt:new Date().toISOString(),
        changes, before:originals
      };
      // Durable journal BEFORE saveDB() queues the old general cloud sync.
      // If local cache persistence is interrupted, boot recovery replays the
      // identical staged Part+Order data before the cloud fetch can run.
      write(e);journalWritten=true;
      localStorage.setItem(PENDING,'1');
      cloudDirty=true;
      trackerStore.commit(message);
      cloudStatusLabel(adjustment?'Adjustment pending':consumption?'Consumption pending':purchaseReceipt?'Purchase receipt pending':'Receipt pending');
      return result;
    }catch(error){
      if(!journalWritten)restore(old);
      // After the journal is written, retain staged data and the journal even
      // if saveDB() throws: its browser or network side effects may have run.
      throw error;
    }
  }
  async function recoverLocal(){
    const e=read();
    if(!e)return false;
    if(!cloudSession||!cloudWorkspaceId)throw new Error('Connect to the workspace before recovering a pending atomic operation.');
    validateIdentity(e);
    const current=snapshot(),writes=[];
    // Preflight every member BEFORE modifying any in-memory row. In
    // particular, a crash can leave a newly created Work Log absent while
    // the existing Part/Project/Purchase edits survived in another tab.
    for(const r of e.changes){
      const k=key(r.record_type,r.record_id);
      const prior=e.before.find(x=>x.key===k);
      if(!prior)throw new Error('Atomic recovery is missing the original record: '+k);
      const now=current.get(k)?.data??null,original=prior.data??null;
      if(stable(now)===stable(r.data))continue;
      if(original===null){
        if(r.record_type!=='log'||now!==null)
          throw new Error(r.record_type==='log'&&now!==null?
            'Pending atomic Work Log was edited locally after staging: '+k+'. Export the safety copy and review its journal before retrying.':
            'Atomic recovery found an unexpected new record: '+k);
      }else if(stable(now)!==stable(original))
        throw new Error('A pending atomic operation has newer local edits. Do not reload cloud data.');
      const arrayName={part:'parts',order:'orders',project:'projects',log:'logs',purchase:'purchases'}[r.record_type];
      if(!arrayName||!Array.isArray(db[arrayName]))
        throw new Error('Pending atomic record type is unavailable: '+k);
      writes.push({arrayName,record_id:r.record_id,data:r.data,created:original===null});
    }
    if(writes.length){
      for(const w of writes){
        const rows=db[w.arrayName],index=rows.findIndex(x=>String(x.id)===String(w.record_id));
        if(index<0){
          if(!w.created)throw new Error('Existing atomic record disappeared during recovery.');
          rows.push(copy(w.data));
        }else rows[index]=copy(w.data);
      }
    }
    localStorage.setItem(PENDING,'1');cloudDirty=true;
    if(writes.length){
      if(typeof persistBrowserData==='function')await persistBrowserData(db,{quiet:true});
      else localStorage.setItem(DB_KEY,JSON.stringify(db));
      renderAll();
    }
    return !!writes.length;
  }
  function retain(message,kind){
    cloudDirty=true;
    try{localStorage.setItem(PENDING,'1')}catch(_e){}
    cloudStatusLabel(kind||'Receipt pending');
    if(message)console.warn('Atomic receipt is still pending:',message);
    return {pending:true,error:message||null};
  }
  async function flush(){
    if(inFlight)return inFlight;
    const job=async()=>{
      let e;
      try{e=read();if(!e)return {empty:true};validateIdentity(e)}
      catch(error){return retain(error.message,'Receipt needs review')}
      if(!supa||!cloudSession||!cloudWorkspaceId)return retain('Not signed in');
      if(!navigator.onLine)return retain('Offline');
      // This journal is shared between tabs. A second tab can receive the
      // save event with stale in-memory records: reconcile its local cache
      // before the RPC so normal sync cannot undo the acknowledged receipt.
      try{await recoverLocal()}
      catch(err){return retain(err.message,'Receipt needs review')}
      if(e.blocked)return retain('Receipt has a version conflict; review before retrying.','Receipt conflict');
      let data,error;
      try{
        ({data,error}=await supa.rpc('sync_tracker_records_atomic',{
          target_workspace:e.workspaceId,operation_id:e.operationId,changes:e.changes
        }));
      }catch(err){return retain(err?.message||String(err))}
      if(error)return retain(error.message||'Atomic RPC failed');
      if(arr(data?.conflicts).length){
        try{write({...e,blocked:true,conflicts:data.conflicts})}
        catch(err){return retain('Conflict journal could not be saved: '+err.message,'Receipt conflict')}
        toast('Receipt stopped safely: another device changed the same record. Review the pending receipt.','bad');
        return retain('Cloud version conflict','Receipt conflict');
      }
      const applied=arr(data?.applied);
      const required=new Set(e.changes.map(r=>key(r.record_type,r.record_id)));
      const ack=new Map(applied.map(r=>[key(r.record_type,r.record_id),r]));
      if(ack.size!==required.size||[...required].some(k=>!ack.has(k)||!(Number(ack.get(k).record_version)>0)))
        return retain('Atomic server receipt is incomplete; retry with the same operation ID.');
      // Preserve the EXACT staged payload in the synced baseline, not a newer
      // local edit made after the receipt. General guarded sync handles later
      // edits only after the atomic receipt is acknowledged.
      for(const r of e.changes){
        const k=key(r.record_type,r.record_id);
        cloudRecordSnapshot.set(k,stable(r.data));
        cloudRecordVersions.set(k,Number(ack.get(k).record_version));
      }
      try{
        const snapshots=JSON.stringify(Object.fromEntries(cloudRecordSnapshot));
        const versions=JSON.stringify(Object.fromEntries(cloudRecordVersions));
        localStorage.setItem(SNAP,snapshots);
        localStorage.setItem(VERS,versions);
        if(localStorage.getItem(SNAP)!==snapshots||localStorage.getItem(VERS)!==versions)
          throw new Error('Could not verify synced baseline');
        localStorage.removeItem(KEY);
        if(localStorage.getItem(KEY))throw new Error('Could not clear acknowledged receipt journal');
      }catch(err){return retain('Cloud received the receipt, but the local acknowledgement must be retried: '+err.message)}
      return {success:true,replayed:!!data?.replayed,applied};
    };
    inFlight=job().finally(()=>{inFlight=null});
    return inFlight;
  }

  // Read-only review for an older blocked journal. Some pre-v5.19.19
  // experimental journals contained only an Order, and an ordinary cloud
  // sync or second device may have already saved their exact payload.
  // Never overwrite the server or clear the journal merely because its
  // quantity looks right: every staged field must match exactly.
  // A pre-v5.19.19 Order-only test can remain blocked after the user deletes
  // that disposable Order elsewhere. A tombstone is not an exact payload
  // match: NEVER replay a deleted order or silently discard its local journal.
  // Offer archival only after a second read and explicit user confirmation.
  async function reviewDeletedOrderOnlyTest(e,remote){
    const r=e.changes[0];
    if(!e.blocked||e.changes.length!==1||r.record_type!=='order'||
       r.data?.partId||!remote?.deleted_at||!(Number(remote.record_version)>0)||
       String(remote.record_id)!==String(r.record_id)||
       String(remote.record_type)!=='order')return null;
    const k=key('order',r.record_id);
    const server=remote.data||{},staged=r.data||{};
    if(server.partId||String(server.id)!==String(r.record_id)||
       String(server.item)!==String(staged.item)||
       Number(server.qty)!==Number(staged.qty)||
       Number(server.receivedQty)!==Number(staged.receivedQty))return null;
    // The originating browser must have ALREADY removed the disposable
    // Order. If it still contains any version of the record, use supervised
    // review instead of hiding its potentially newer local edits.
    if(snapshot().has(k)){
      alert('This test Order is deleted in the cloud but still exists locally. No journal was changed. Save your safety copy and request review.');
      return {matched:false,deleted:true,resolved:false};
    }
    if(!confirm('The cloud shows that the unlinked test Order "'+
      String(staged.item||'')+'" was deleted after recording '+String(staged.receivedQty)+
      ' of '+String(staged.qty)+' units. This pending journal contains NO Part update or inventory credit. '+
      'Did you intentionally delete this disposable test Order and save its Pending Receipt Safety Copy? Cancel if unsure.'))
      return {matched:false,deleted:true,resolved:false};
    if(!confirm('Archive the obsolete pending receipt on THIS device? This does not restore the deleted Order, receive the remaining units, modify cloud records, or change physical inventory.'))
      return {matched:false,deleted:true,resolved:false};

    // Re-fetch the same canonical row after confirmation. Reject concurrent
    // changes to the tombstone or the pending operation.
    const {data:latest,error}=await supa.from('tracker_records')
      .select('record_type,record_id,data,deleted_at,record_version')
      .eq('workspace_id',e.workspaceId).in('record_id',[String(r.record_id)]);
    if(error)throw error;
    const row=arr(latest).find(x=>x.record_type==='order'&&
      String(x.record_id)===String(r.record_id));
    const current=read();
    if(!current||current.operationId!==e.operationId||
       stable(current.changes)!==stable(e.changes)||!row?.deleted_at||
       String(row.deleted_at)!==String(remote.deleted_at)||
       Number(row.record_version)!==Number(remote.record_version)||
       stable(row.data)!==stable(remote.data)||snapshot().has(k))
      throw new Error('Order or journal changed during recovery; no pending receipt was cleared.');

    // Archive FULL original evidence BEFORE changing the version baseline or
    // clearing the live journal. A failed storage write preserves the journal.
    const prior=localStorage.getItem(RESOLVED),archive=prior?JSON.parse(prior):[];
    if(!Array.isArray(archive))
      throw new Error('Saved receipt-resolution archive is invalid.');
    const records=archive.filter(x=>x.operationId!==e.operationId);
    records.push({operationId:e.operationId,resolvedAt:new Date().toISOString(),
      reason:'deleted-unlinked-test-order',journal:current,
      cloudTombstone:{record_type:'order',record_id:String(row.record_id),
        record_version:Number(row.record_version),deleted_at:row.deleted_at}});
    const archiveJSON=JSON.stringify(records.slice(-20));
    localStorage.setItem(RESOLVED,archiveJSON);
    if(localStorage.getItem(RESOLVED)!==archiveJSON)
      throw new Error('Could not verify pending receipt recovery archive.');

    // The local Order is absent and the server's tombstone agrees. Update
    // only this key's baseline so ordinary guarded sync won't recreate it.
    cloudRecordSnapshot.delete(k);
    cloudRecordVersions.set(k,Number(row.record_version));
    const snapshots=JSON.stringify(Object.fromEntries(cloudRecordSnapshot));
    const versions=JSON.stringify(Object.fromEntries(cloudRecordVersions));
    localStorage.setItem(SNAP,snapshots);localStorage.setItem(VERS,versions);
    if(localStorage.getItem(SNAP)!==snapshots||localStorage.getItem(VERS)!==versions)
      throw new Error('Could not save tombstone baseline; pending journal retained.');
    localStorage.removeItem(KEY);
    if(localStorage.getItem(KEY))
      throw new Error('Could not clear archived journal; original evidence remains in archive.');
    cloudStatusLabel('Sync pending');
    const outcome=await window.saveCloudState();
    if(localStorage.getItem(PENDING)==='1'||outcome?.pending){
      alert('The deleted test receipt was archived locally. Other edits may still need sync; review the cloud-status indicator.');
    }else{
      toast('Deleted test receipt archived; cloud inventory was not changed.','good');
    }
    openSettings();
    return {matched:false,deleted:true,resolved:true};
  }

  async function reviewLocalDrift(){
    let e;
    try{
      e=read();
      if(!e)return alert('There is no pending transaction to review.');
      validateIdentity(e);
      if(!supa||!cloudSession||!cloudWorkspaceId||!navigator.onLine)
        return alert('Reconnect to the original workspace before comparing the pending transaction.');
      const ids=[...new Set(e.changes.map(r=>String(r.record_id)))];
      const {data,error}=await supa.from('tracker_records')
        .select('record_type,record_id,data,deleted_at,record_version')
        .eq('workspace_id',e.workspaceId).in('record_id',ids);
      if(error)throw error;
      const serverRows=new Map(arr(data).map(r=>[key(r.record_type,r.record_id),r]));
      const differing=e.changes.filter(r=>{
        const row=serverRows.get(key(r.record_type,r.record_id));
        return !row||!!row.deleted_at||!(Number(row.record_version)>0)||stable(row.data)!==stable(r.data);
      });
      if(differing.length){
        alert('The cloud does not exactly match the pending transaction for '+differing.map(r=>r.record_type+' '+r.record_id).join(', ')+'. Nothing was changed or discarded. Keep the safety copy and request a supervised conflict review.');
        return {matched:false,differing:differing.map(r=>key(r.record_type,r.record_id))};
      }
      const local=snapshot();
      const localDrift=e.changes.filter(r=>stable(local.get(key(r.record_type,r.record_id))?.data??null)!==stable(r.data));
      if(!localDrift.length)return retryFromUI();
      const names=localDrift.map(r=>r.record_type+' '+r.record_id).join(', ');
      if(!confirm('The cloud ALREADY contains the exact pending transaction, but this device has newer local data for '+names+'. Replace only those local records with the exact cloud transaction and acknowledge it? This will NOT receive or consume anything again.'))return {matched:true,resolved:false};
      const current=read();
      if(!current||current.operationId!==e.operationId||stable(current.changes)!==stable(e.changes))throw new Error('Pending transaction changed during review. Reopen Inventory Transaction Safety.');
      for(const r of e.changes){
        const k=key(r.record_type,r.record_id),rows={part:db.parts,project:db.projects,log:db.logs,purchase:db.purchases,order:db.orders}[r.record_type];
        if(!rows)throw new Error('Unsupported pending record type: '+r.record_type);
        const idx=rows.findIndex(x=>String(x.id)===String(r.record_id));
        if(idx<0)rows.push(copy(r.data));else rows[idx]=copy(r.data);
      }
      if(typeof persistBrowserData==='function')await persistBrowserData(db,{quiet:true});else localStorage.setItem(DB_KEY,JSON.stringify(db));
      renderAll();
      let archived=[];const existing=localStorage.getItem(RESOLVED);
      if(existing){archived=JSON.parse(existing);if(!Array.isArray(archived))throw new Error('Stored receipt recovery archive is invalid.')}
      archived=archived.filter(x=>x.operationId!==e.operationId);
      archived.push({operationId:e.operationId,resolvedAt:new Date().toISOString(),reason:'cloud-identical-local-drift-reconciled',journal:current});
      const archiveJSON=JSON.stringify(archived.slice(-3));localStorage.setItem(RESOLVED,archiveJSON);
      if(localStorage.getItem(RESOLVED)!==archiveJSON)throw new Error('Could not verify the local receipt recovery archive.');
      for(const r of e.changes){
        const k=key(r.record_type,r.record_id),server=serverRows.get(k);
        cloudRecordSnapshot.set(k,stable(server.data));cloudRecordVersions.set(k,Number(server.record_version));
      }
      const snapshots=JSON.stringify(Object.fromEntries(cloudRecordSnapshot)),versions=JSON.stringify(Object.fromEntries(cloudRecordVersions));
      localStorage.setItem(SNAP,snapshots);localStorage.setItem(VERS,versions);
      if(localStorage.getItem(SNAP)!==snapshots||localStorage.getItem(VERS)!==versions)throw new Error('Could not safely update the cloud baseline; original journal was retained.');
      localStorage.removeItem(KEY);if(localStorage.getItem(KEY))throw new Error('Could not safely clear the acknowledged journal.');
      localStorage.removeItem(PENDING);cloudStatusLabel('Synced');openSettings();toast('Cloud-identical pending transaction safely acknowledged.','good');
      return {matched:true,resolved:true};
    }catch(err){
      alert('Safe local/cloud comparison did not complete: '+(err?.message||String(err))+'. Keep the saved browser data and safety copy.');
      return {matched:false,error:err?.message||String(err)};
    }
  }

  function conflictValue(value){
    if(value===undefined)return '—';
    if(value===null)return 'null';
    if(typeof value==='string')return value.length>220?value.slice(0,217)+'…':value;
    let text;
    try{text=JSON.stringify(value,null,2)}catch(_e){text=String(value)}
    return text.length>900?text.slice(0,897)+'…':text;
  }
  function topLevelDiffs(staged,cloud){
    const keys=[...new Set([...Object.keys(staged||{}),...Object.keys(cloud||{})])].sort();
    return keys.filter(k=>stable(staged?.[k])!==stable(cloud?.[k])).map(k=>({
      field:k,staged:staged?.[k],cloud:cloud?.[k]
    }));
  }
  async function openConflictReview(){
    let e;
    try{
      e=read();
      if(!e)return alert('There is no pending transaction to review.');
      validateIdentity(e);
      if(!supa||!cloudSession||!cloudWorkspaceId||!navigator.onLine)
        return alert('Reconnect to the original workspace before opening the supervised conflict review.');
      const ids=[...new Set(e.changes.map(r=>String(r.record_id)))];
      const {data,error}=await supa.from('tracker_records')
        .select('record_type,record_id,data,deleted_at,record_version')
        .eq('workspace_id',e.workspaceId).in('record_id',ids);
      if(error)throw error;
      const serverRows=new Map(arr(data).map(r=>[key(r.record_type,r.record_id),r]));
      let html=modalHeader('Supervised Transaction Conflict Review','Read-only comparison — nothing will be changed')+
        '<div class="notice"><b>Safety mode:</b> this screen only compares the original staged transaction with the current cloud records. It will not write, delete, consume, receive, or overwrite anything.</div>';
      for(const staged of e.changes){
        const k=key(staged.record_type,staged.record_id),remote=serverRows.get(k);
        html+='<div class="detail-section"><h3 style="margin:0 0 6px">'+esc(staged.record_type.toUpperCase())+' · '+esc(staged.record_id)+'</h3>';
        if(!remote){
          html+='<div class="danger-note"><b>Cloud record not found.</b> The staged record exists locally in the pending transaction, but no matching cloud record was returned.</div>';
        }else if(remote.deleted_at){
          html+='<div class="danger-note"><b>Cloud record is deleted.</b> No automatic restoration will be attempted.</div>';
        }else{
          const diffs=topLevelDiffs(staged.data,remote.data);
          html+='<div class="muted small">Cloud version: '+esc(String(remote.record_version))+' · '+(diffs.length?'Differences found: '+diffs.length:'<b>Exact data match</b>')+'</div>';
          if(diffs.length){
            html+='<div style="margin-top:8px">';
            for(const d of diffs){
              html+='<div class="notice" style="margin:6px 0"><b>'+esc(d.field)+'</b><div class="small"><b>Original staged:</b><pre style="white-space:pre-wrap;margin:4px 0 8px">'+esc(conflictValue(d.staged))+'</pre><b>Current cloud:</b><pre style="white-space:pre-wrap;margin:4px 0">'+esc(conflictValue(d.cloud))+'</pre></div></div>';
            }
            html+='</div>';
          }
        }
        html+='</div>';
      }
      html+='<div class="notice"><b>Recommended next step:</b> review the differences above. Do not retry or manually repeat the inventory operation until we determine which version represents the intended work. The original atomic journal remains protected.</div>'+
        '<div class="modal-actions"><button class="secondary" onclick="atomicReceiptOutbox.exportPendingJournal()">Download Safety Copy</button><button class="secondary" onclick="atomicReceiptOutbox.openSettings()">Back to Transaction Safety</button></div>';
      openModal(html);
      return true;
    }catch(err){
      alert('The supervised conflict review could not be loaded: '+(err?.message||String(err))+'. No records were changed.');
      return false;
    }
  }

  async function reviewConflict(){
    let e;
    try{
      e=read();
      if(!e)return alert('There is no pending receipt to review.');
      validateIdentity(e);
      if(!e.blocked)return alert('This receipt is not version-blocked. Use Retry Pending Receipt only for nonconflict network failures.');
      if(!supa||!cloudSession||!cloudWorkspaceId||!navigator.onLine)
        return alert('Reconnect to the original workspace before comparing the pending receipt.');
      const ids=[...new Set(e.changes.map(r=>String(r.record_id)))];
      const {data,error}=await supa.from('tracker_records')
        .select('record_type,record_id,data,deleted_at,record_version')
        .eq('workspace_id',e.workspaceId).in('record_id',ids);
      if(error)throw error;
      const serverRows=new Map(arr(data).map(r=>[key(r.record_type,r.record_id),r]));
      const differing=e.changes.filter(r=>{
        const row=serverRows.get(key(r.record_type,r.record_id));
        return !row||!!row.deleted_at||!(Number(row.record_version)>0)||
          stable(row.data)!==stable(r.data);
      });
      if(differing.length){
        // The user may have intentionally deleted an old, unlinked test
        // Order after its browser journal was blocked. Do not call the RPC
        // or restore the deleted record; offer a fully guarded local archive.
        if(differing.length===1){
          const staged=differing[0],remote=serverRows.get(key(staged.record_type,staged.record_id));
          if(remote?.deleted_at){
            const handled=await reviewDeletedOrderOnlyTest(e,remote);
            if(handled)return handled;
          }
        }
        alert('The cloud differs from the pending receipt for '+differing.map(r=>r.record_type+' '+r.record_id).join(', ')+
          '. Nothing was changed or discarded. Keep this browser’s saved data and request a supervised conflict review; do not re-receive the order.');
        return {matched:false,differing:differing.map(r=>key(r.record_type,r.record_id))};
      }
      // The remote state is already EXACTLY the desired journal payload.
      // Offer a separate, explicit local acknowledgement, not a retry RPC.
      const unlinked=e.changes.some(r=>r.record_type==='order'&&
        (!r.data?.partId||!e.changes.some(p=>p.record_type==='part'&&
          String(p.record_id)===String(r.data.partId))));
      const prompt='The cloud ALREADY contains every field from this pending '+(e.operationKind==='adjustment'?'adjustment':e.operationKind==='consumption'?'consumption':'receipt')+'. '+
        'No cloud records need to be written. '+
        (unlinked?'WARNING: This older receipt has no linked Part update and did NOT credit inventory. ':
          e.operationKind==='adjustment'?'The Part adjustment matches the cloud. ':
          e.operationKind==='consumption'?'The linked Part, Project, Work Log and any Purchase credits all match the cloud. ':
          'Linked Part and Order changes both match the cloud. ')+
        'Archive and acknowledge this local journal? This does NOT receive anything again.';
      if(!confirm(prompt))return {matched:true,resolved:false};
      // If a different tab altered the journal during the async fetch,
      // never reconcile a different operation using stale server results.
      const current=read();
      if(!current||current.operationId!==e.operationId||
         stable(current.changes)!==stable(e.changes))
        throw new Error('Pending transaction changed during review. Reopen Advanced / Troubleshooting → Inventory Transaction Safety.');
      await recoverLocal();
      // An on-device recovery trail must exist before clearing the live
      // journal. Refuse to acknowledge if storage cannot retain the archive.
      let archived=[];
      const existing=localStorage.getItem(RESOLVED);
      if(existing){
        archived=JSON.parse(existing);
        if(!Array.isArray(archived))throw new Error('Stored receipt recovery archive is invalid.');
      }
      archived=archived.filter(x=>x.operationId!==e.operationId);
      archived.push({operationId:e.operationId,resolvedAt:new Date().toISOString(),
        reason:'cloud-identical',journal:current});
      const archiveJSON=JSON.stringify(archived.slice(-3));
      localStorage.setItem(RESOLVED,archiveJSON);
      if(localStorage.getItem(RESOLVED)!==archiveJSON)
        throw new Error('Could not verify the local receipt recovery archive.');
      for(const r of e.changes){
        const k=key(r.record_type,r.record_id),server=serverRows.get(k);
        cloudRecordSnapshot.set(k,stable(server.data));
        cloudRecordVersions.set(k,Number(server.record_version));
      }
      const snapshots=JSON.stringify(Object.fromEntries(cloudRecordSnapshot));
      const versions=JSON.stringify(Object.fromEntries(cloudRecordVersions));
      localStorage.setItem(SNAP,snapshots);localStorage.setItem(VERS,versions);
      if(localStorage.getItem(SNAP)!==snapshots||localStorage.getItem(VERS)!==versions)
        throw new Error('Could not safely update the cloud baseline; original journal was retained.');
      localStorage.removeItem(KEY);
      if(localStorage.getItem(KEY))
        throw new Error('Could not safely clear the acknowledged journal.');
      // Normal guarded sync still protects any OTHER edits on this device.
      const outcome=await window.saveCloudState();
      if(localStorage.getItem(PENDING)==='1'||outcome?.pending){
        cloudStatusLabel('Sync pending');
        alert('The identical receipt journal was archived and cleared. Other local changes still need normal cloud synchronization; review the cloud status.');
      }else{
        toast('Pending receipt confirmed in cloud and safely acknowledged.','good');
      }
      openSettings();
      return {matched:true,resolved:true};
    }catch(err){
      alert('Pending receipt was not automatically cleared: '+(err?.message||String(err))+
        '. Keep the saved browser data and request a supervised review.');
      return {matched:false,error:err?.message||String(err)};
    }
  }
  // A core tracker backup intentionally contains db records, not localStorage.
  // Export the *actual pending journal* before any manual conflict review so
  // crashes, browser resets or app reinstalls cannot silently erase the only
  // evidence of a partially acknowledged receipt. This never modifies state.
  function exportPendingJournal(){
    const raw=localStorage.getItem(KEY);
    if(!raw){alert('No pending atomic receipt journal exists on this device.');return false;}
    let e=null,validationError='';
    try{e=read()}catch(err){validationError=err.message||String(err);}
    const keys=e?[...new Set(e.changes.map(r=>key(r.record_type,r.record_id)))]:[];
    const current=snapshot(),localRecords=[],baseline={},versions={};
    for(const k of keys){
      if(current.has(k))localRecords.push(current.get(k));
      if(cloudRecordSnapshot.has(k))baseline[k]=cloudRecordSnapshot.get(k);
      if(cloudRecordVersions.has(k))versions[k]=cloudRecordVersions.get(k);
    }
    const record={
      format:'N594ZS_ATOMIC_RECEIPT_SAFETY_EXPORT_V1',
      exportedAt:new Date().toISOString(),
      appVersion:typeof APP_VERSION==='string'?APP_VERSION:'unknown',
      status:e?.blocked?'blocked':e?'pending':'unreadable',
      validationError,
      journal:e,
      rawJournal:e?null:raw,
      localRecords,cloudBaseline:baseline,cloudVersions:versions,
      cloudPending:localStorage.getItem(PENDING)==='1'
    };
    if(typeof downloadJSON!=='function')throw new Error('Download support is unavailable. Keep this browser data intact.');
    downloadJSON(record,'N594ZS_Atomic_'+(e?.operationKind==='consumption'?'Consumption':'Receipt')+'_Safety_'+today()+'.json');
    toast('Pending atomic receipt safety download started. Keep the file separate from your core backup.','good');
    return record;
  }
  // An older app may have allowed a TEXT-ONLY edit to a newly staged Log.
  // Provide a deliberately manual, backup-first escape hatch. Never guess
  // about edited quantities, consumed items, project links or source stock.
  function textOnlyPendingLogDrift(e){
    if(e?.operationKind!=='consumption')return null;
    const logs=e.changes.filter(x=>x.record_type==='log');
    if(logs.length!==1||Number(logs[0].expected_version)!==0)return null;
    const r=logs[0],k=key('log',r.record_id);
    const prior=e.before.find(x=>x.key===k);
    if(!prior||prior.data!==null)return null;
    const now=arr(db.logs).find(x=>String(x.id)===String(r.record_id));
    if(!now||stable(now)===stable(r.data))return null;
    const stripNotes=source=>{
      const value=copy(source);
      for(const field of ['work','observations','notes','blockers','nextStep'])delete value[field];
      return stable(value);
    };
    return stripNotes(now)===stripNotes(r.data)?{log:r,now}:null;
  }
  async function restorePendingWorkLog(){
    let e;
    try{
      e=read();
      if(!e)throw new Error('There is no pending atomic transaction.');
      validateIdentity(e);
    }catch(error){alert(error.message||String(error));return false}
    const candidate=textOnlyPendingLogDrift(e);
    if(!candidate){
      alert('No eligible text-only pending Work Log mismatch was found. If the transaction still cannot sync, export its safety copy and request supervised review. No records were changed.');
      return false;
    }
    const current=snapshot();
    for(const r of e.changes){
      if(r.record_type==='log')continue;
      const k=key(r.record_type,r.record_id),now=current.get(k)?.data??null;
      const original=e.before.find(x=>x.key===k);
      if(!original||(stable(now)!==stable(r.data)&&stable(now)!==stable(original.data??null))){
        alert('Another member of this atomic operation changed after staging. No automatic local repair is safe. Export the safety copy and request supervised review.');
        return false;
      }
    }
    if(!confirm('This pending Work Log contains additional TEXT entered after the atomic operation. A safety copy will be downloaded before restoring its original staged text. Continue?'))return false;
    let safety;
    try{safety=exportPendingJournal()}catch(error){
      alert('Safety export failed; no Work Log was changed: '+(error?.message||String(error)));
      return false;
    }
    if(!safety?.journal){
      alert('Safety copy could not be verified; no Work Log was changed.');
      return false;
    }
    if(!confirm('Confirm the Pending Atomic Safety Copy has been SAVED and retained. Restoring replaces ONLY this Work Log’s post-staging text with its original journal version. The extra text remains in the downloaded copy and can be re-entered AFTER successful sync. Proceed?'))return false;
    const idx=db.logs.findIndex(x=>String(x.id)===String(candidate.log.record_id));
    if(idx<0)return false;
    const previous=copy(db.logs[idx]);
    db.logs[idx]=copy(candidate.log.data);
    try{
      if(typeof persistBrowserData==='function')await persistBrowserData(db,{quiet:true});
      else{
        const json=JSON.stringify(db);localStorage.setItem(DB_KEY,json);
        if(localStorage.getItem(DB_KEY)!==json)throw new Error('Browser cache verification failed.');
      }
      localStorage.setItem(PENDING,'1');
      cloudDirty=true;
    }catch(error){
      db.logs[idx]=previous;
      alert('The local staged-text restore could not be saved. Original local text was retained; keep your safety file. '+(error?.message||String(error)));
      return false;
    }
    renderAll();
    openSettings();
    toast('Original staged Work Log text restored locally. Use Retry Pending only after checking the safety copy.','good');
    return true;
  }
  function openSettings(){
    let e=null,corrupt='';
    try{e=read()}catch(err){corrupt=err.message}
    const legacyUnlinked=e?.changes.some(r=>r.record_type==='order'&&
      (!r.data?.partId||!e.changes.some(p=>p.record_type==='part'&&
        String(p.record_id)===String(r.data.partId))));
    const detail=e?'<div class="notice"><b>Pending '+(e.operationKind==='adjustment'?'adjustment':e.operationKind==='consumption'?'consumption':'receipt')+'</b><br>Operation '+esc(e.operationId)+
      '<br>Created '+esc(e.createdAt)+(e.blocked?'<br><b>Version conflict — no automatic retry.</b>':'')+
      '<br>'+e.changes.map(r=>esc(r.record_type+' '+r.record_id)).join(', ')+'</div>'+
      (e?.changes.some(r=>r.record_type==='log')?'<div class="notice"><b>Pending Work Log protected.</b> Do not edit, delete or adjust its consumed items until the transaction is acknowledged. Export the Pending Atomic Safety Copy before supervised recovery.</div>':'')+
      (legacyUnlinked?'<div class="danger-note">This older pending operation has no linked Part update. It may have updated an Order, but it is NOT an atomic inventory receipt. Do not receive it again or expect stock credit from this attempt.</div>':''):'';
    const active=receiptReady();
    openModal(modalHeader('Inventory Transaction Safety','Status and recovery')+
      '<div class="notice"><b>Inventory protection is automatic.</b> Order receipts, inventory adjustments, Part use, Work Log consumption, and Purchase stock receipts are protected as complete transactions when cloud-connected. You normally do not need to do anything here.</div>'+
      (corrupt?'<div class="danger-note">'+esc(corrupt)+'</div>':'')+detail+
      '<div class="detail-section"><b>Order receipts: '+(active?'Protected':'Waiting for cloud connection')+'</b><div class="muted small">Linked Order + Part changes commit together; legitimate unlinked Order-only receipts are journaled as one operation.</div></div>'+
      '<div class="detail-section"><b>Inventory adjustments: '+(active?'Protected':'Waiting for cloud connection')+'</b><div class="muted small">Adjustment and reversal history is version-checked and retry-safe.</div></div>'+
      '<div class="detail-section"><b>Part use / consumption: '+(active?'Protected':'Waiting for cloud connection')+'</b><div class="muted small">Reserved, Assigned, Quick Part Used, and Work Log consumed-item additions share the same protected transaction path.</div></div>'+
      '<div class="detail-section"><b>Purchase stock receipts: '+(active?'Protected':'Waiting for cloud connection')+'</b><div class="muted small">A linked Purchase and Part receive stock together or not at all.</div></div>'+
      '<div class="modal-actions">'+
      (textOnlyPendingLogDrift(e)?'<button class="secondary" onclick="atomicReceiptOutbox.restorePendingWorkLog()">Backup and Restore Staged Work Log Text</button>':'')+
      (pending()?'<button class="secondary" onclick="atomicReceiptOutbox.exportPendingJournal()">'+
        (e?.operationKind==='consumption'?'Download Pending Atomic Safety Copy':'Download Pending Receipt Safety Copy')+'</button>':'')+
      (e?(e.blocked?
        '<button class="primary" onclick="atomicReceiptOutbox.openConflictReview()">Open Supervised Conflict Review</button>':
        '<button class="primary" onclick="atomicReceiptOutbox.retryFromUI()">Retry Pending Transaction</button><button class="secondary" onclick="atomicReceiptOutbox.reviewLocalDrift()">Compare Local / Cloud Safely</button>'):'')+
      '<button class="secondary" onclick="openAdvancedTroubleshooting()">Back to Advanced</button><button class="secondary" onclick="openCloudAccount()">Cloud Account</button></div>');
  }
  // Compatibility shim for any older cached UI that still calls this method.
  // Production receipts can no longer be disabled per device.
  function toggle(){
    localStorage.removeItem(LEGACY_RECEIPT_OPT);
    toast('Atomic order receipts are now automatic whenever cloud sync is connected.','good');
    openSettings();
  }
  function toggleAdjustments(){
    localStorage.removeItem(ADJUST_OPT);
    toast('Atomic inventory adjustments are now automatic whenever cloud sync is connected.','good');
    openSettings();
  }
  function stageAdjustment(work,message){return stage(work,message,'adjustment')}
  function stageConsumption(work,message,meta){return stage(work,message,'consumption',meta)}
  function stagePurchaseReceipt(work,message,meta){return stage(work,message,'purchase',meta)}
  function toggleConsumption(){
    localStorage.removeItem(CONSUME_OPT);
    toast('Atomic part-use transactions are now automatic whenever cloud sync is connected.','good');
    openSettings();
  }
  async function retryFromUI(){
    if(!cloudSession||!cloudWorkspaceId)return alert('Sign in to your original workspace first.');
    const result=await window.saveCloudState();
    if(result?.pending)return alert('The inventory transaction is still pending. '+(result.error||'Check your connection or the cloud conflict.'));
    openSettings();toast('Pending receipt synchronized.','good');
  }
  const previousSave=window.saveCloudState;
  window.saveCloudState=function(){
    if(syncInFlight)return syncInFlight;
    const work=async()=>{
      if(pending()){
        const outcome=await flush();
        if(!outcome.success)return outcome;
      }
      return previousSave();
    };
    syncInFlight=work().finally(()=>{syncInFlight=null});
    return syncInFlight;
  };
  const previousLoad=window.loadCloudState;
  window.loadCloudState=async function(silent=false){
    if(pending()){
      await recoverLocal();
      const outcome=await flush();
      if(!outcome.success)throw new Error('A receipt is awaiting atomic cloud sync. Local data was preserved.');
    }
    return previousLoad(silent);
  };
  const previousReload=window.forceCloudReload;
  window.forceCloudReload=async function(){
    if(pending())return alert('An inventory transaction is still awaiting sync. Open Advanced / Troubleshooting → Inventory Transaction Safety before reloading shared data.');
    return previousReload();
  };
  for(const action of ['reliabilityUseCloud','reliabilityKeepLocal','reliabilityApplyFieldMerge']){
    const prev=window[action];
    if(typeof prev!=='function')continue;
    window[action]=function(...args){
      if(pending())return alert('Protecting an unsynced inventory transaction. Open Advanced / Troubleshooting → Inventory Transaction Safety before this operation.');
      return prev(...args);
    };
  }
  const signOutBase=window.cloudSignOut;
  window.cloudSignOut=function(...args){
    if(pending()){
      let e;
      try{e=read()}catch(error){return alert(error.message)}
      if(e.userId===cloudSession?.user?.id)
        return alert('An unsynced receipt belongs to this account. Sync it before signing out.');
      // Another account must be allowed to leave and sign into the owner of
      // the journal. The workspace-bound operation itself remains untouched.
    }
    return signOutBase(...args);
  };
  const previousAccount=window.openCloudAccount;
  window.openCloudAccount=function(){
    previousAccount();
    const modal=document.getElementById('modalBox');if(!modal)return;
    const buttons=modal.querySelector('.modal-actions');
    const card=document.createElement('div');
    card.className=pending()?'notice':'card soft-card';
    card.style.marginTop='12px';
    card.innerHTML=pending()
      ?'<b>Inventory transaction pending.</b><div class="muted small" style="margin-top:5px">Your data is protected, but this transaction must finish or be reviewed before other inventory changes can pass it.</div>'
      :'<b>Inventory protection active</b><div class="muted small" style="margin-top:5px">Receipts, stock adjustments and physical Part use are transaction-protected automatically.</div>';
    if(buttons)modal.insertBefore(card,buttons);else modal.appendChild(card);
    if(pending()&&buttons)buttons.insertAdjacentHTML('afterbegin',
      '<button class="primary" onclick="atomicReceiptOutbox.openSettings()">Review Pending Inventory Transaction</button>');
  };
  const originalStatus=window.cloudStatusLabel;
  window.cloudStatusLabel=function(label,kind){
    if(pending()&&label==='Synced'){
      let kind='receipt';try{kind=read()?.operationKind||'receipt'}catch(_e){}
      label=kind==='consumption'?'Consumption pending':kind==='adjustment'?'Adjustment pending':kind==='purchase'?'Purchase receipt pending':'Receipt pending';
    }
    return originalStatus(label,kind);
  };
  window.atomicReceiptOutbox=Object.freeze({
    enabled,adjustmentsEnabled,consumptionEnabled,purchaseReceiptsEnabled,shouldHandle,hasPending:pending,isPendingRecord,stage,stageAdjustment,stageConsumption,stagePurchaseReceipt,flush,recoverLocal,
    openSettings,toggle,toggleAdjustments,toggleConsumption,retryFromUI,reviewConflict,reviewLocalDrift,openConflictReview,exportPendingJournal,restorePendingWorkLog
  });
})();