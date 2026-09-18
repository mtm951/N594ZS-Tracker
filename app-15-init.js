// ---------- EVENT WIRING ----------
document.getElementById('modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('modal').classList.contains('open'))closeModal()});
document.getElementById('photoFile').addEventListener('change',async e=>{
  const f=e.target.files?.[0];
  if(!f)return;
  if(f.size>3*1024*1024){alert('Please keep the aircraft dashboard photo under 3 MB.');e.target.value='';return}
  try{await saveAircraftPhotoFile(f)}catch(err){console.error(err);alert('Could not save aircraft photo: '+err.message)}finally{e.target.value=''}
});
document.getElementById('entityFile').addEventListener('change',async e=>{const files=[...(e.target.files||[])],type=e.target.dataset.entityType,rawId=e.target.dataset.entityId,id=/^\d+$/.test(String(rawId||''))?Number(rawId):rawId;e.target.value='';if(!type||!rawId||!files.length)return;await saveSelectedFiles(type,id,files)});
document.getElementById('importFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=async()=>{try{await importBackupObject(JSON.parse(r.result))}catch(err){alert('Could not import backup: '+err.message)}finally{e.target.value=''}};r.readAsText(f)});
renderAll();
initCloud();

// Load small, optional post-init UX layers without disturbing the core script order.
(function(){
  if(document.querySelector('script[data-assistant-collapse]'))return;
  const s=document.createElement('script');
  s.src='app-44-assistant-collapse.js?v=5.5.1';
  s.dataset.assistantCollapse='1';
  document.body.appendChild(s);
})();
