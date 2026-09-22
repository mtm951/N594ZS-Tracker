'use strict';
// ---------- V5.19.1 TRACKER DATA STORE / LOCAL-FIRST BOUNDARY ----------
// First safe slice toward offline-first storage.
//
// This module deliberately does NOT replace the current persistence or cloud-sync
// engines yet. It gives feature code one small API for record reads/writes, then
// delegates persistence to the existing saveDB() path. That means behavior stays
// the same today while future IndexedDB/SQLite/offline-queue work can move behind
// this boundary without rewriting every feature module.

(function(){
  if(window.trackerStore)return;

  function copy(value){
    if(value===undefined)return undefined;
    if(typeof structuredClone==='function')return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function registry(){
    return (typeof RECORD_ARRAYS!=='undefined'&&RECORD_ARRAYS&&typeof RECORD_ARRAYS==='object')
      ?RECORD_ARRAYS:{};
  }

  function resolveType(type){
    const t=String(type||'').trim();
    if(t==='aircraft'||t==='settings')return {kind:'singleton',key:t};
    const key=registry()[t];
    if(!key)throw new Error('Unknown tracker record type: '+t);
    if(!Array.isArray(db[key]))db[key]=[];
    return {kind:'array',key};
  }

  function sameId(a,b){return String(a??'')===String(b??'')}

  function read(type,id='singleton'){
    const info=resolveType(type);
    if(info.kind==='singleton')return copy(db[info.key]||{});
    const hit=db[info.key].find(row=>sameId(row?.id,id));
    return hit?copy(hit):null;
  }

  function list(type){
    const info=resolveType(type);
    if(info.kind==='singleton')return [copy(db[info.key]||{})];
    return copy(db[info.key]);
  }

  function commit(message=''){
    if(typeof saveDB!=='function')throw new Error('Tracker persistence is not ready.');
    saveDB(message);
  }

  function write(type,id,value,options={}){
    const info=resolveType(type);
    const next=copy(value||{});

    if(info.kind==='singleton'){
      db[info.key]=next;
      if(options.persist!==false)commit(options.message||'');
      return copy(next);
    }

    const recordId=(id!==undefined&&id!==null&&id!=='')?id:next.id;
    if(recordId===undefined||recordId===null||recordId==='')throw new Error('Record id is required for '+type+'.');
    if(next.id===undefined||next.id===null||next.id==='')next.id=recordId;

    const rows=db[info.key],index=rows.findIndex(row=>sameId(row?.id,recordId));
    if(index>=0)rows[index]=next;else rows.push(next);
    if(options.persist!==false)commit(options.message||'');
    return copy(next);
  }

  function update(type,id,mutator,options={}){
    if(typeof mutator!=='function')throw new Error('Record updater must be a function.');
    const current=read(type,id);
    if(current===null)throw new Error('Record not found: '+type+':'+String(id));
    const draft=copy(current);
    const result=mutator(draft);
    const next=result===undefined?draft:result;
    return write(type,id,next,options);
  }

  function remove(type,id,options={}){
    const info=resolveType(type);
    if(info.kind==='singleton')throw new Error('Singleton records cannot be removed.');
    const rows=db[info.key],index=rows.findIndex(row=>sameId(row?.id,id));
    if(index<0)return false;
    rows.splice(index,1);
    if(options.persist!==false)commit(options.message||'');
    return true;
  }

  window.trackerStore=Object.freeze({
    read,
    list,
    write,
    update,
    remove,
    commit
  });
})();
