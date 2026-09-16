// ---------- EVENT WIRING ----------
document.getElementById('modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('modal').classList.contains('open'))closeModal()});
document.getElementById('photoFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>3*1024*1024){alert('Please keep the aircraft dashboard photo under 3 MB.');e.target.value='';return}const r=new FileReader();r.onload=()=>{db.aircraft.photo=r.result;saveDB('Aircraft photo updated.');e.target.value=''};r.readAsDataURL(f)});
document.getElementById('entityFile').addEventListener('change',async e=>{const files=[...(e.target.files||[])],type=e.target.dataset.entityType,id=Number(e.target.dataset.entityId);e.target.value='';if(!type||!id||!files.length)return;await saveSelectedFiles(type,id,files)});
document.getElementById('importFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=async()=>{try{await importBackupObject(JSON.parse(r.result))}catch(err){alert('Could not import backup: '+err.message)}finally{e.target.value=''}};r.readAsText(f)});
renderAll();
initCloud();
