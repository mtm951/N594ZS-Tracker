// ---------- SHARED AIRCRAFT PHOTO ----------
let aircraftPhotoSignedCache={path:'',url:'',expires:0};

function resetAircraftPhotoCache(){aircraftPhotoSignedCache={path:'',url:'',expires:0}}

async function getAircraftPhotoDisplayUrl(){
  const path=db.aircraft?.photoPath||'';
  if(path&&supa&&cloudSession&&cloudWorkspaceId){
    if(aircraftPhotoSignedCache.path===path&&aircraftPhotoSignedCache.url&&Date.now()<aircraftPhotoSignedCache.expires){return aircraftPhotoSignedCache.url;}
    const {data,error}=await supa.storage.from(CLOUD_BUCKET).createSignedUrl(path,3600);
    if(error)throw error;
    aircraftPhotoSignedCache={path,url:data.signedUrl,expires:Date.now()+50*60*1000};
    return data.signedUrl;
  }
  return db.aircraft?.photo||'';
}

async function setAircraftPhotoElement(imgId,placeholderId){
  const img=document.getElementById(imgId),placeholder=document.getElementById(placeholderId);
  if(!img)return;
  try{
    const url=await getAircraftPhotoDisplayUrl();
    if(url){img.src=url;img.style.display='block';if(placeholder)placeholder.style.display='none';}
    else{img.removeAttribute('src');img.style.display='none';if(placeholder)placeholder.style.display='flex';}
  }catch(err){
    console.error('Could not load shared aircraft photo',err);
    if(db.aircraft?.photo){img.src=db.aircraft.photo;img.style.display='block';if(placeholder)placeholder.style.display='none';}
  }
}

async function refreshAircraftPhotoViews(){
  await Promise.allSettled([
    setAircraftPhotoElement('dashPhoto','dashPlaceholder'),
    setAircraftPhotoElement('airPhoto','airPlaceholder')
  ]);
}

async function uploadAircraftPhotoBlob(blob,name='aircraft-photo.jpg',contentType='image/jpeg'){
  if(!supa||!cloudSession||!cloudWorkspaceId||!canCloudEdit())throw new Error('Cloud edit access is required.');
  const path=`${WORKSPACE_SLUG}/aircraft/profile/${crypto.randomUUID()}__${safeCloudName(name)}`;
  const {error}=await supa.storage.from(CLOUD_BUCKET).upload(path,blob,{contentType:contentType||blob.type||'image/jpeg',upsert:false});
  if(error)throw error;
  const oldPath=db.aircraft?.photoPath||'';
  db.aircraft.photoPath=path;
  db.aircraft.photo='';
  resetAircraftPhotoCache();
  if(oldPath&&oldPath!==path){
    const removal=await supa.storage.from(CLOUD_BUCKET).remove([oldPath]);
    if(removal.error)console.warn('Old aircraft photo could not be removed',removal.error);
  }
  return path;
}

async function migrateAircraftPhotoToCloudIfNeeded(){
  if(!supa||!cloudSession||!cloudWorkspaceId||!canCloudEdit())return false;
  if(db.aircraft?.photoPath||!db.aircraft?.photo||!String(db.aircraft.photo).startsWith('data:image/'))return false;
  const response=await fetch(db.aircraft.photo);
  const blob=await response.blob();
  const subtype=(blob.type||'image/jpeg').split('/')[1]?.replace('jpeg','jpg')||'jpg';
  await uploadAircraftPhotoBlob(blob,`aircraft-photo.${subtype}`,blob.type||'image/jpeg');
  try{localStorage.setItem(DB_KEY,JSON.stringify(db));}catch(_e){}
  return true;
}

async function saveAircraftPhotoFile(file){
  if(!file)return;
  if(cloudSession&&cloudWorkspaceId){
    if(!canCloudEdit()){toast('Viewer access is read-only.','bad');return;}
    await uploadAircraftPhotoBlob(file,file.name||'aircraft-photo.jpg',file.type||'image/jpeg');
    saveDB('Aircraft photo updated and shared.');
    return;
  }
  const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file)});
  db.aircraft.photo=dataUrl;
  db.aircraft.photoPath='';
  resetAircraftPhotoCache();
  saveDB('Aircraft photo updated locally. Sign in to sync it.');
}

// The existing view renderers were written for browser-local photos. Wrap them so
// a private Supabase Storage photo is resolved after each render without rewriting
// the rest of the dashboard/aircraft view code.
const renderDashboardBeforeSharedPhoto=renderDashboard;
renderDashboard=function(...args){
  const result=renderDashboardBeforeSharedPhoto.apply(this,args);
  queueMicrotask(()=>refreshAircraftPhotoViews());
  return result;
};

const renderAircraftBeforeSharedPhoto=renderAircraft;
renderAircraft=function(...args){
  const result=renderAircraftBeforeSharedPhoto.apply(this,args);
  queueMicrotask(()=>refreshAircraftPhotoViews());
  return result;
};
