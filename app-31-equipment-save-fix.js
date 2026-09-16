// ---------- V4.9.1 EQUIPMENT SAVE BUTTON FIX ----------
// app-29 embedded a JSON string inside a double-quoted onclick attribute.
// For equipment linked to a purchase, that produced malformed HTML/JS and the
// Save Equipment click never reached saveEquipment(). Rebind the button with a
// real event listener after the modal is rendered.

const openEquipmentModalSaveFixBase=openEquipmentModal;
openEquipmentModal=function(id=null,prefill=null){
  const existing=id?equipmentById(id):null;
  const purchaseId=String((existing||prefill||{}).purchaseId||'');
  openEquipmentModalSaveFixBase(id,prefill);
  const modal=document.getElementById('modalBox');
  if(!modal)return;
  const saveBtn=[...modal.querySelectorAll('.modal-actions button')].find(b=>(b.textContent||'').trim()==='Save Equipment');
  if(!saveBtn)return;
  saveBtn.removeAttribute('onclick');
  saveBtn.onclick=null;
  saveBtn.addEventListener('click',()=>saveEquipment(id,purchaseId),{once:true});
};
