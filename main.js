
const { app, BrowserWindow, ipcMain, dialog, nativeImage, shell, safeStorage, Menu } = require('electron');
const { spawn } = require('child_process');
const os = require('os');
// Keep the same Windows user-data identity across StudioFlow updates.
app.setName('studioflow');
// Force every source build to the same canonical Windows data folder.
// This prevents Electron package/version changes from silently creating a blank database.
const CANONICAL_USER_DATA = require('path').join(process.env.APPDATA || app.getPath('appData'), 'studioflow');
app.setPath('userData', CANONICAL_USER_DATA);
let mainWindow = null;
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const http = require('http');
const crypto = require('crypto');
let exiftool = null;
function getExifTool(){
  if(exiftool) return exiftool;
  try { exiftool = require('exiftool-vendored').exiftool; return exiftool; }
  catch(error){ nativeLog(`ExifTool unavailable: ${error?.stack||error}`); return null; }
}

const DATA_FILE = 'studioflow-core-2.json';
const APP_BUILD = '3.9.0';
const ERROR_FILE = 'studioflow-core-2-errors.log';

const dataPath = () => path.join(app.getPath('userData'), DATA_FILE);
const errorPath = () => path.join(app.getPath('userData'), ERROR_FILE);

function promoteRecoveryDatabase(){
  const target=dataPath(), recovery=`${target}.recovery`;
  if(!fs.existsSync(recovery))return {promoted:false};
  try{
    const recoveryRaw=fs.readFileSync(recovery,'utf8');
    const recoveryData=JSON.parse(recoveryRaw);
    const recoveryValid=validateDatabaseShape(recoveryData);
    if(!recoveryValid.ok)throw new Error(recoveryValid.error);

    // A recovery file is only promoted when the active database is missing or
    // unreadable. A valid active ledger always wins, preventing an old recovery
    // file from re-triggering the recovery warning on every launch.
    if(fs.existsSync(target)){
      try{
        const activeData=JSON.parse(fs.readFileSync(target,'utf8'));
        const activeValid=validateDatabaseShape(activeData);
        if(activeValid.ok){
          const archived=`${recovery}.unused-${new Date().toISOString().replace(/[:.]/g,'-')}`;
          try{fs.renameSync(recovery,archived)}catch{try{fs.unlinkSync(recovery)}catch{}}
          nativeLog('Ignored stale recovery database because the active ledger is valid.');
          return {promoted:false,stale:true};
        }
      }catch{}
    }

    try{fs.copyFileSync(recovery,target)}catch{fs.writeFileSync(target,recoveryRaw,'utf8')}
    fs.unlinkSync(recovery);
    nativeLog('Promoted recovery database because the active ledger was missing or unreadable.');
    return {promoted:true};
  }catch(error){
    try{nativeLog(`Recovery database promotion failed: ${error.message}`)}catch{}
    return {promoted:false,error:error.message};
  }
}


function backupsDir(){ const dir=path.join(app.getPath('userData'),'backups'); if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true}); return dir; }
function artworkImagesDir(){ const dir=path.join(app.getPath('userData'),'artwork-images'); if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true}); return dir; }
function safeArtworkName(name='artwork'){ return String(name||'artwork').replace(/[^a-z0-9._-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,80)||'artwork'; }
function persistArtworkImageFromPath(filePath, preferredName=''){
  const ext=path.extname(filePath).toLowerCase()||'.jpg';
  const stat=fs.statSync(filePath);
  const digest=crypto.createHash('sha1').update(`${filePath}|${stat.size}|${stat.mtimeMs}`).digest('hex').slice(0,16);
  const target=path.join(artworkImagesDir(),`${safeArtworkName(preferredName||path.basename(filePath,ext))}-${digest}${ext}`);
  if(!fs.existsSync(target))fs.copyFileSync(filePath,target);
  return target;
}
function persistArtworkImageData(dataUrl, preferredName='artwork'){
  const match=String(dataUrl||'').match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if(!match)throw new Error('Unsupported image data.');
  const raw=Buffer.from(match[2],'base64');
  const ext=({jpeg:'jpg','svg+xml':'svg'}[match[1].toLowerCase()]||match[1].toLowerCase());
  const digest=crypto.createHash('sha1').update(raw).digest('hex').slice(0,16);
  const target=path.join(artworkImagesDir(),`${safeArtworkName(preferredName)}-${digest}.${ext}`);
  if(!fs.existsSync(target))fs.writeFileSync(target,raw);
  return target;
}
function summarizeDatabase(candidate={}){
  const counts={}; Object.entries(candidate||{}).forEach(([key,value])=>{if(Array.isArray(value))counts[key]=value.length});
  return {schemaVersion:Number(candidate?.schemaVersion||0),appVersion:String(candidate?.appVersion||''),counts,
    scenes:Number(candidate?.scenes?.length||0),artworks:Number(candidate?.artworks?.length||0),websiteProducts:Number(candidate?.websiteProducts?.length||0),inventoryItems:Number(candidate?.inventoryItems?.length||0)};
}
function backupFiles(){
  try{return fs.readdirSync(backupsDir()).filter(name=>name.toLowerCase().endsWith('.json')).map(name=>{const fullPath=path.join(backupsDir(),name);const stat=fs.statSync(fullPath);let summary={},healthy=false,error='';try{const parsed=JSON.parse(fs.readFileSync(fullPath,'utf8'));const valid=validateDatabaseShape(parsed);healthy=valid.ok;error=valid.ok?'':valid.error;summary=summarizeDatabase(parsed)}catch(e){error=e.message}return {name,path:fullPath,sizeBytes:stat.size,modified:stat.mtime.toISOString(),healthy,error,summary}}).sort((a,b)=>new Date(b.modified)-new Date(a.modified));}catch{return []}
}
function pruneBackups(retention=30){
  const keep=Math.max(5,Math.min(200,Number(retention)||30));
  backupFiles().slice(keep).forEach(file=>{try{fs.unlinkSync(file.path)}catch{}});
}
function validateDatabaseShape(candidate){
  if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))return {ok:false,error:'Backup does not contain a StudioFlow database object.'};
  const coreArrays=['artworks','customers','inventoryItems','salesTransactions','marketSessions','serviceJobs'];
  const malformed=coreArrays.filter(key=>candidate[key]!==undefined&&!Array.isArray(candidate[key]));
  if(malformed.length)return {ok:false,error:`Invalid database collections: ${malformed.join(', ')}`};
  return {ok:true};
}
function writeJsonAtomic(target,data){
  fs.mkdirSync(path.dirname(target),{recursive:true});
  const temp=`${target}.tmp-${process.pid}-${Date.now()}`;
  const payload=JSON.stringify(data,null,2);
  // Clean up orphaned temp files left by past FAILED saves. These piled up to many GB and can fill
  // the disk, which itself makes every subsequent save fail. Remove only ones >60s old (not ours).
  try{const dir=path.dirname(target),base=path.basename(target);for(const name of fs.readdirSync(dir)){if(name.startsWith(base+'.tmp-')){const fp=path.join(dir,name);try{if(fp!==temp&&(Date.now()-fs.statSync(fp).mtimeMs)>60000)fs.unlinkSync(fp)}catch{}}}}catch{}
  fs.writeFileSync(temp,payload,'utf8');
  try{const fd=fs.openSync(temp,'r');fs.fsyncSync(fd);fs.closeSync(fd)}catch{}

  if(fs.existsSync(target)){
    const safety=`${target}.previous`;
    try{fs.copyFileSync(target,safety)}catch{}
  }

  // IMPORTANT: never delete the destination before the replacement is safely in place. A previous
  // version unlinked the target first, so if the following rename then failed (Defender / OneDrive /
  // indexing briefly holding the file), the database FILE WAS LEFT MISSING and every later save
  // failed too. We now only ever create-or-overwrite, so the file can never be lost.
  let lastError=null;
  // 1) No destination yet -> an atomic rename is safe and cheapest (also recreates a missing file).
  if(!fs.existsSync(target)){
    for(let attempt=0;attempt<3;attempt++){
      try{fs.renameSync(temp,target);return;}
      catch(error){lastError=error;if(fs.existsSync(target))break;const w=Date.now()+(25*(attempt+1));while(Date.now()<w){}}
    }
  }
  // 2) Overwrite in place by COPYING the completed temp over the destination. copyFileSync creates
  //    the file if missing and overwrites if present -- it never leaves the destination deleted.
  for(let attempt=0;attempt<5;attempt++){
    try{
      fs.copyFileSync(temp,target);
      try{const fd=fs.openSync(target,'r');fs.fsyncSync(fd);fs.closeSync(fd)}catch{}
      try{fs.unlinkSync(temp)}catch{}
      return;
    }catch(error){lastError=error;const w=Date.now()+(25*(attempt+1));while(Date.now()<w){}}
  }

  // 3) Last resort: open the destination for writing and write in place.
  try{
    const fd=fs.openSync(target,'w');
    fs.writeFileSync(fd,payload,'utf8');
    try{fs.fsyncSync(fd)}catch{}
    fs.closeSync(fd);
    try{fs.unlinkSync(temp)}catch{}
    return;
  }catch(error){
    lastError=error;
  }

  // Last-resort recovery file. Scene creation can complete and this validated
  // database is promoted automatically on the next StudioFlow launch.
  try{
    const recovery=`${target}.recovery`;
    fs.writeFileSync(recovery,payload,'utf8');
    try{fs.unlinkSync(temp)}catch{}
    return;
  }catch(error){
    lastError=error;
  }

  try{if(fs.existsSync(temp))fs.unlinkSync(temp)}catch{}
  throw lastError||new Error('StudioFlow could not safely save the database.');
}
function createBackupFile(prefix='StudioFlow-Backup'){
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const target=path.join(backupsDir(),`${prefix}-${stamp}.json`);
  const data=loadData();
  data.databaseMeta={...(data.databaseMeta||{}),lastBackupAt:new Date().toISOString()};
  writeJsonAtomic(target,data);
  pruneBackups(data.backupSettings?.retentionCount);
  return target;
}
function maybeCreateDailyBackup(){
  try{
    const data=loadData();
    if(data.backupSettings?.automaticDailyBackup===false)return;
    const today=new Date().toISOString().slice(0,10);
    if(!backupFiles().some(file=>file.name.includes(`Daily-${today}`)))createBackupFile(`StudioFlow-Daily-${today}`);
  }catch(error){nativeLog(`Daily backup failed: ${error.message}`)}
}
function createStartupBackup(){
  try{
    const target=dataPath();
    if(!fs.existsSync(target))return null;
    const parsed=JSON.parse(fs.readFileSync(target,'utf8'));
    const valid=validateDatabaseShape(parsed);
    if(!valid.ok)return null;
    const score=databaseRichness(parsed);
    // Do not preserve an obviously empty shell as a trusted startup backup.
    if(score<25)return null;
    return createBackupFile('StudioFlow-Startup');
  }catch(error){nativeLog(`Startup backup failed: ${error.message}`);return null}
}
function databaseHealth(){
  try{
    const file=dataPath();
    if(!fs.existsSync(file))return {ok:false,status:'Missing',issues:['Database file does not exist yet.']};
    const raw=fs.readFileSync(file,'utf8');
    const parsed=JSON.parse(raw);
    const shape=validateDatabaseShape(parsed);
    const issues=[];
    if(!shape.ok)issues.push(shape.error);
    if(Number(parsed.schemaVersion||0)<9)issues.push('Database schema is older than StudioFlow 3.9.0.');
    const userDir=app.getPath('userData');
    const tempFiles=fs.readdirSync(userDir).filter(name=>name.startsWith(DATA_FILE+'.tmp-')).length;
    const recoveryAvailable=fs.existsSync(file+'.recovery');
    if(tempFiles>0)issues.push(`${tempFiles} unfinished temporary database file${tempFiles===1?'':'s'} found.`);
    if(recoveryAvailable)issues.push('A recovery database is waiting to be promoted.');
    return {ok:issues.length===0,status:issues.length?'Attention required':'Healthy',issues,schemaVersion:Number(parsed.schemaVersion||0),recordCollections:Object.values(parsed).filter(Array.isArray).length,tempFiles,recoveryAvailable,build:APP_BUILD};
  }catch(error){return {ok:false,status:'Unreadable',issues:[error.message]}}
}

function nativeLog(message) {
  try {
    fs.appendFileSync(errorPath(), `[${new Date().toISOString()}] ${message}\n`, 'utf8');
  } catch {}
}

function seed() {
  return {
    schemaVersion: 9,
    appVersion: 'StudioFlow 3.9.0',
    business: {
      name: 'Your Photography Business',
      currency: 'CAD',
      logo: ''
    },
    galleries: [
      { id: 'GAL-LANDSCAPES', name: 'Landscapes', description: '', coverImage: '' },
      { id: 'GAL-WILDLIFE', name: 'Wildlife', description: '', coverImage: '' },
      { id: 'GAL-WORLD', name: 'World Images', description: '', coverImage: '' },
      { id: 'GAL-LIMITED', name: 'Limited Editions', description: '', coverImage: '' }
    ],
    artworks: [],
    customers: [],
    serviceJobs: [],
    salesSources: [],
    productTemplates: [],
    inventoryProductTemplates: [],
    inventoryItems: [],
    marketSales: [],
    marketSessions: [],
    salesEvents: [],
    salesTransactions: [],
    salesTransactionItems: [],
    salesSpecials: [],
    salesPriceHistory: [],
    businessTransactions: [],
    quotes: [],
    giftCertificates: [],
    dailyBusinessLogs: [],
    backupSettings: { automaticBeforeUpdates: true, automaticDailyBackup: true, retentionCount: 30 },
    migrationHistory: [],
    databaseMeta: { createdAt: new Date().toISOString(), lastSavedAt: '', lastBackupAt: '' },
    pricing: { standard: {}, currency: 'CAD' },
    squarespace: {},
    scenePacks: [],
    scenes: [],
    roomProjects: [],
    activity: [],
    errors: []
  };
}

function normalize(input) {
  const base = seed();
  const data = { ...base, ...(input || {}) };
  data.business = { ...base.business, ...(data.business || {}) };

  if (Array.isArray(data.galleries) && data.galleries.every(g => typeof g === 'string')) {
    data.galleries = data.galleries.map((name, index) => ({
      id: `GAL-MIGRATED-${index + 1}`,
      name,
      description: '',
      coverImage: ''
    }));
  }

  data.galleries = Array.isArray(data.galleries) ? data.galleries : base.galleries;
  data.artworks = Array.isArray(data.artworks) ? data.artworks : [];
  data.removedArtworks = Array.isArray(data.removedArtworks) ? data.removedArtworks : [];
  data.customers = Array.isArray(data.customers) ? data.customers : [];
  data.serviceJobs = Array.isArray(data.serviceJobs) ? data.serviceJobs : [];
  data.salesSources = Array.isArray(data.salesSources) ? data.salesSources : [];
  data.productTemplates = Array.isArray(data.productTemplates) ? data.productTemplates : [];
  data.inventoryProductTemplates = Array.isArray(data.inventoryProductTemplates) ? data.inventoryProductTemplates : [];
  data.inventoryItems = Array.isArray(data.inventoryItems) ? data.inventoryItems : [];
  data.marketSales = Array.isArray(data.marketSales) ? data.marketSales : [];
  data.marketSessions = Array.isArray(data.marketSessions) ? data.marketSessions : [];
  data.salesEvents = Array.isArray(data.salesEvents) ? data.salesEvents : [];
  data.salesTransactions = Array.isArray(data.salesTransactions) ? data.salesTransactions : [];
  data.salesTransactionItems = Array.isArray(data.salesTransactionItems) ? data.salesTransactionItems : [];
  data.salesSpecials = Array.isArray(data.salesSpecials) ? data.salesSpecials : [];
  data.salesPriceHistory = Array.isArray(data.salesPriceHistory) ? data.salesPriceHistory : [];
  data.businessTransactions = Array.isArray(data.businessTransactions) ? data.businessTransactions : [];
  data.quotes = Array.isArray(data.quotes) ? data.quotes : [];
  data.giftCertificates = Array.isArray(data.giftCertificates) ? data.giftCertificates : [];
  data.dailyBusinessLogs = Array.isArray(data.dailyBusinessLogs) ? data.dailyBusinessLogs : [];
  data.backupSettings = data.backupSettings && typeof data.backupSettings === 'object' ? { automaticBeforeUpdates:true, automaticDailyBackup:true, retentionCount:30, ...data.backupSettings } : { automaticBeforeUpdates:true, automaticDailyBackup:true, retentionCount:30 };
  data.migrationHistory = Array.isArray(data.migrationHistory) ? data.migrationHistory : [];
  data.databaseMeta = data.databaseMeta && typeof data.databaseMeta === 'object' ? { createdAt:new Date().toISOString(), lastSavedAt:'', lastBackupAt:'', ...data.databaseMeta } : { createdAt:new Date().toISOString(), lastSavedAt:'', lastBackupAt:'' };
  if(Number(data.schemaVersion||0)<9){
    data.migrationHistory.push({from:Number(data.schemaVersion||0),to:9,time:new Date().toISOString(),version:'12.0.0'});
    data.schemaVersion=9;
  }
  data.appVersion='StudioFlow 3.9.0';
  data.pricing = data.pricing && typeof data.pricing === 'object' ? data.pricing : { standard: {}, currency: data.business.currency || 'CAD' };
  data.squarespace = data.squarespace && typeof data.squarespace === 'object' ? data.squarespace : {};
  data.scenePacks = Array.isArray(data.scenePacks) ? data.scenePacks : [];
  data.scenes = Array.isArray(data.scenes) ? data.scenes : [];
  data.roomProjects = Array.isArray(data.roomProjects) ? data.roomProjects : [];
  data.activity = Array.isArray(data.activity) ? data.activity : [];
  data.errors = Array.isArray(data.errors) ? data.errors : [];

  data.galleries = data.galleries.map(g => ({
    id: g.id || `GAL-${Date.now()}`,
    name: g.name || 'Untitled Gallery',
    description: g.description || '',
    coverImage: g.coverImage || ''
  }));

  data.artworks = data.artworks.map(a => ({
    id: a.id || a.artworkId || `ART-${Date.now()}`,
    title: a.title || 'Untitled',
    galleryId: a.galleryId || '',
    gallery: a.gallery || '',
    orientation: a.orientation || 'Landscape',
    description: a.description || '',
    keywords: Array.isArray(a.keywords) ? a.keywords : [],
    image: a.image || '',
    createdAt: a.createdAt || new Date().toISOString(),
    updatedAt: a.updatedAt || new Date().toISOString(),
    isLimitedEdition: a.isLimitedEdition === true,
    editionSize: a.editionSize ?? null,
    limitedEditionPricing: a.limitedEditionPricing || {},
    products: Array.isArray(a.products) ? a.products : [],
    squarespace: a.squarespace || { imported:false, productIds:[] }
  }));

  data.scenes = data.scenes.map(s => ({
    id: s.assetId || s.id || s.sceneId || `SCN-${Date.now()}`,
    assetId: s.assetId || s.id || s.sceneId || `SCN-${Date.now()}`,
    sourceImageId: s.sourceImageId || s.assetId || s.id || s.sceneId || '',
    recordType: 'roomAsset',
    inLibrary: s.inLibrary === true,
    packId: s.packId || '',
    name: s.name || 'Untitled Scene',
    style: s.style || 'Uncategorized',
    room: s.room || s.roomType || 'Room',
    wallWidth: Number(s.wallWidth || s.wallWidthInches || 144),
    safeWidth: Number(s.safeWidth || s.safeWidthInches || 72),
    safeHeight: Number(s.safeHeight || s.safeHeightInches || 48),
    safeCenterX: Number(s.safeCenterX ?? 50),
    safeCenterY: Number(s.safeCenterY ?? 38),
    lightDirection: s.lightDirection || 'left',
    lightAngle: Number(s.lightAngle ?? 35),
    shadowSoftness: Number(s.shadowSoftness ?? 72),
    shadowStrength: Number(s.shadowStrength ?? 36),
    image: s.image || '',
    backgroundLayer: s.backgroundLayer || s.image || '',
    foregroundLayers: Array.isArray(s.foregroundLayers) ? s.foregroundLayers : [],
    lightingOverlay: s.lightingOverlay || '',
    wallPlane: s.wallPlane || {
      topLeft:{x:24,y:13},topRight:{x:78,y:13},
      bottomRight:{x:78,y:65},bottomLeft:{x:24,y:65}
    },
    calibrated: s.calibrated === true,
    productionStatus: s.productionStatus || (s.calibrated ? 'Calibrated' : 'Needs Calibration'),
    calibrationLocked: s.calibrationLocked === true,
    approvedAt: s.approvedAt || '',
    designNotes: s.designNotes || '',
    calibration: s.calibration || {
      floorPoint:{x:20,y:90},
      ceilingPoint:{x:20,y:10},
      ceilingHeightInches:Number(s.wallHeight||96),
      pixelsPerInch:0,
      wallLeft:20,
      wallRight:80,
      furnitureTopY:65,
      topClearanceInches:3
    }
  }));

  return data;
}

function inventoryScore(data) {
  if (!data || typeof data !== 'object') return -1;
  const inventory = Array.isArray(data.inventoryItems) ? data.inventoryItems.length : 0;
  const templates = Array.isArray(data.inventoryProductTemplates) ? data.inventoryProductTemplates.length : 0;
  const artworks = Array.isArray(data.artworks) ? data.artworks.length : 0;
  const sales = Array.isArray(data.marketSales) ? data.marketSales.length : 0;
  return inventory * 100000 + templates * 1000 + artworks * 10 + sales;
}

function findExistingStudioFlowLedger() {
  try {
    const current = path.resolve(dataPath());
    const roaming = app.getPath('appData');
    if (!fs.existsSync(roaming)) return null;
    const candidates = [];
    for (const entry of fs.readdirSync(roaming, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/studio\s*flow/i.test(entry.name)) continue;
      const candidate = path.join(roaming, entry.name, DATA_FILE);
      if (path.resolve(candidate) === current || !fs.existsSync(candidate)) continue;
      try {
        const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        candidates.push({ path: candidate, data: normalize(parsed), score: inventoryScore(parsed) });
      } catch (error) {
        nativeLog(`Skipped unreadable legacy ledger ${candidate}: ${error.message}`);
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || null;
  } catch (error) {
    nativeLog(`Inventory recovery scan failed: ${error.message}`);
    return null;
  }
}

function sceneIdentity(scene={}) {
  const id=String(scene.id||scene.assetId||scene.sceneId||'').trim().toLowerCase();
  const name=String(scene.internalName||scene.displayName||scene.name||'').trim().toLowerCase();
  const group=String(scene.collection||scene.style||'').trim().toLowerCase()+'|'+String(scene.roomType||scene.room||'').trim().toLowerCase();
  return id || `${group}|${name}`;
}

function sceneQuality(scene={}) {
  let n=0;
  if(scene.image||scene.backgroundLayer)n+=8;
  if(scene.calibration)n+=5;
  if(scene.calibrated)n+=3;
  if(scene.inLibrary)n+=2;
  if(scene.foregroundLayers?.length)n+=1;
  return n;
}

function mergeSceneRecord(a={},b={}) {
  const preferred=sceneQuality(b)>sceneQuality(a)?b:a;
  const other=preferred===a?b:a;
  return {...other,...preferred,
    id:preferred.id||preferred.assetId||other.id||other.assetId,
    assetId:preferred.assetId||preferred.id||other.assetId||other.id,
    image:preferred.image||preferred.backgroundLayer||other.image||other.backgroundLayer||'',
    backgroundLayer:preferred.backgroundLayer||preferred.image||other.backgroundLayer||other.image||'',
    calibration:preferred.calibration||other.calibration||null,
    foregroundLayers:(preferred.foregroundLayers?.length?preferred.foregroundLayers:other.foregroundLayers)||[]
  };
}

function walkJsonFiles(folder,depth=0,out=[]) {
  if(depth>4||!fs.existsSync(folder))return out;
  let entries=[];try{entries=fs.readdirSync(folder,{withFileTypes:true})}catch{return out}
  for(const e of entries){
    const full=path.join(folder,e.name);
    if(e.isDirectory()){
      if(/node_modules|cache|temp|crashpad/i.test(e.name))continue;
      walkJsonFiles(full,depth+1,out);
    }else if(/\.json(?:\.previous|\.recovery)?$/i.test(e.name) && /studioflow|backup|core|data/i.test(e.name+full))out.push(full);
  }
  return out;
}

function mergeLegacyScenes(current) {
  current=current||seed();
  current.scenes=Array.isArray(current.scenes)?current.scenes:[];
  current.scenePacks=Array.isArray(current.scenePacks)?current.scenePacks:[];
  const map=new Map(current.scenes.map(x=>[sceneIdentity(x),x]).filter(x=>x[0]));
  const packMap=new Map(current.scenePacks.map(x=>[String(x.id||x.name||'').toLowerCase(),x]).filter(x=>x[0]));
  const files=new Set([
    ...walkJsonFiles(app.getPath('appData')),
    `${dataPath()}.previous`,`${dataPath()}.recovery`
  ]);
  let recovered=0;
  for(const candidate of files){
    if(!candidate||path.resolve(candidate)===path.resolve(dataPath())||!fs.existsSync(candidate))continue;
    try{
      const raw=JSON.parse(fs.readFileSync(candidate,'utf8'));
      const legacy=normalize(raw);
      for(const scene of legacy.scenes||[]){
        const key=sceneIdentity(scene);if(!key)continue;
        const hasUseful=!!(scene.image||scene.backgroundLayer||scene.calibration||scene.calibrated||scene.inLibrary);
        if(!hasUseful)continue;
        if(map.has(key))map.set(key,mergeSceneRecord(map.get(key),scene));
        else{map.set(key,scene);recovered++}
      }
      for(const pack of legacy.scenePacks||[]){const k=String(pack.id||pack.name||'').toLowerCase();if(k&&!packMap.has(k))packMap.set(k,pack)}
    }catch(error){nativeLog(`Skipped scene recovery source ${candidate}: ${error.message}`)}
  }
  current.scenes=[...map.values()];current.scenePacks=[...packMap.values()];
  current.databaseMeta={...(current.databaseMeta||{}),sceneIndexRebuiltAt:new Date().toISOString(),sceneIndexRecovered:recovered};
  return current;
}


function databaseRichness(candidate={}){
  const weights={scenes:30,scenePacks:20,websiteProducts:12,websiteInventory:4,artworks:8,inventoryItems:3,serviceJobs:12,services:12,pricingOptions:8,roomProjects:15,galleries:2};
  let score=0;
  for(const [key,weight] of Object.entries(weights)){
    const value=candidate?.[key];
    if(Array.isArray(value)) score+=Math.min(value.length,2500)*weight;
    else if(value&&typeof value==='object') score+=Math.min(Object.keys(value).length,500)*weight;
  }
  if(candidate?.pricing&&typeof candidate.pricing==='object') score+=Object.keys(candidate.pricing).length*10;
  return score;
}
function protectCanonicalDatabase(){
  const target=dataPath();
  fs.mkdirSync(path.dirname(target),{recursive:true});
  const candidates=[];
  const add=(file,label)=>{
    if(!file||!fs.existsSync(file))return;
    try{const parsed=JSON.parse(fs.readFileSync(file,'utf8'));const valid=validateDatabaseShape(parsed);if(valid.ok)candidates.push({file,label,parsed,score:databaseRichness(parsed),mtime:fs.statSync(file).mtimeMs})}catch{}
  };
  add(target,'active'); add(`${target}.previous`,'previous'); add(`${target}.recovery`,'recovery');
  try{for(const f of backupFiles().slice(0,40))add(f.path,'backup')}catch{}
  if(!candidates.length)return {restored:false,reason:'no-valid-candidates'};
  const active=candidates.find(c=>path.resolve(c.file)===path.resolve(target));
  const best=[...candidates].sort((a,b)=>b.score-a.score||b.mtime-a.mtime)[0];
  const activeScore=active?.score||0;
  // Only intervene when the active ledger is clearly a thin shell compared with
  // an existing known-good ledger. Never replace a similarly rich database.
  if(best&&path.resolve(best.file)!==path.resolve(target)&&best.score>250&&activeScore<best.score*0.35){
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    if(fs.existsSync(target))try{fs.copyFileSync(target,`${target}.sparse-${stamp}`)}catch{}
    fs.copyFileSync(best.file,target);
    nativeLog(`Database guard restored ${best.label} ledger (${best.score}) over sparse active ledger (${activeScore}).`);
    return {restored:true,source:best.label,sourcePath:best.file,sourceScore:best.score,activeScore};
  }
  return {restored:false,activeScore,bestScore:best?.score||0};
}

function loadData() {
  try {
    // Startup must remain deterministic and fast. Read only the active ledger.
    // Legacy recovery is intentionally not run here because recursively scanning
    // Windows AppData can block Electron before the first window appears and can
    // merge incomplete ledgers over valid pricing/business collections.
    if (fs.existsSync(dataPath())) {
      return normalize(JSON.parse(fs.readFileSync(dataPath(), 'utf8')));
    }
    return seed();
  } catch (error) {
    nativeLog(error.stack || error.message || String(error));
    // Preserve the unreadable ledger for diagnosis instead of overwriting it.
    return seed();
  }
}

function saveData(data) {
  try {
    const normalized = normalize(data);
    normalized.databaseMeta={...(normalized.databaseMeta||{}),lastSavedAt:new Date().toISOString()};

    // Refuse a single save that would replace a well-populated business ledger
    // with a dramatically thinner one. The rejected payload is preserved for
    // diagnosis, while the healthy active database remains untouched.
    const target=dataPath();
    if(fs.existsSync(target)){
      try{
        const current=JSON.parse(fs.readFileSync(target,'utf8'));
        const currentValid=validateDatabaseShape(current);
        const incomingValid=validateDatabaseShape(normalized);
        const currentScore=currentValid.ok?databaseRichness(current):0;
        const incomingScore=incomingValid.ok?databaseRichness(normalized):0;
        if(currentScore>250 && incomingScore<currentScore*0.35){
          const stamp=new Date().toISOString().replace(/[:.]/g,'-');
          const rejected=path.join(backupsDir(),`StudioFlow-Rejected-Sparse-Save-${stamp}.json`);
          fs.writeFileSync(rejected,JSON.stringify(normalized,null,2),'utf8');
          nativeLog(`Blocked sparse database overwrite. Current score ${currentScore}; incoming score ${incomingScore}. Rejected payload: ${rejected}`);
          return {ok:false,blocked:true,error:'StudioFlow blocked a save that would remove most of your business data. Your existing database was not changed.',rejectedPath:rejected};
        }
      }catch(error){nativeLog(`Pre-save database comparison failed: ${error.message}`)}
    }

    writeJsonAtomic(target, normalized);
    return { ok: true, path: target, savedAt:normalized.databaseMeta.lastSavedAt }; 
  } catch (error) {
    nativeLog(error.stack || error.message || String(error));
    return { ok: false, error: error.message };
  }
}

/* ── StudioFlow g109 · splash screen ──────────────────────────────────────────
   The main window previously appeared the instant it was created and then sat blank while a
   100MB+ database was read and parsed, so there was a real gap to cover -- this is not a splash
   invented to pad an instant start.

   THREE DECISIONS WORTH KNOWING:
   1. It closes when the app is READY, not on a timer. A fixed six seconds every launch would be
      charming twice and infuriating by the end of the week. There is a minimum beat so the
      animation never cuts off mid-wave, and a hard ceiling so a hang can never trap him behind it.
   2. Canvas, not WebGL. A shader must compile before it draws, on whatever GPU driver the machine
      has -- a black window during compilation would defeat the entire point.
   3. Silent. Ambient audio on every launch is delightful twice, and he opens this at markets.

   The progress bar reports REAL stages from this process. StudioFlow's startup is mostly one big
   blocking read, so there are only a handful of honest milestones -- they are the ones below, not
   a fake ramp. */
let splashWindow = null, splashOpenedAt = 0, splashSkipped = false;
/* g112: raised from 1500. Kirk: "I know the system will take several seconds to load anyway, so
   I'm not concerned about it finishing later than the load time." So the sequence is allowed to
   play out — four waves and the final reveal — rather than being cut off the moment the database
   finishes parsing. Click still skips it instantly, and the ceiling still guarantees escape. */
/* g115: the film runs 8.04s at half speed. Kirk is content for the splash to outlast the load, so
   the minimum covers it and the sequence plays through. Click still skips instantly; the ceiling
   still guarantees escape and is raised above the film's length so it can never cut it short. */
const SPLASH_MIN_MS = 8300;
const SPLASH_MAX_MS = 16000;     // never trap him behind it

function createSplash() {
  try {
    splashWindow = new BrowserWindow({
      width: 1100, height: 620, frame: false, resizable: false, movable: true,
      transparent: false, backgroundColor: '#05080e', alwaysOnTop: true,
      skipTaskbar: true, show: false, center: true,
      webPreferences: {
        preload: path.join(__dirname, 'splash-preload.js'),
        contextIsolation: true, nodeIntegration: false
      }
    });
    splashWindow.loadFile('splash.html');
    splashWindow.once('ready-to-show', () => {
      splashOpenedAt = Date.now();
      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.show();
    });
    splashWindow.on('closed', () => { splashWindow = null; });
  } catch (error) {
    // A splash must never be the reason the app fails to start.
    nativeLog(`Splash could not be created: ${error.message}`);
    splashWindow = null;
  }
}
function splashStage(label, percent) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    try { splashWindow.webContents.send('splash:stage', { label, percent }); } catch (_) {}
  }
}
function closeSplash(mainWin) {
  const reveal = () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      try { splashWindow.webContents.send('splash:dismiss'); } catch (_) {}
      setTimeout(() => { if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close(); }, 340);
    }
    if (mainWin && !mainWin.isDestroyed()) { mainWin.show(); mainWin.focus(); mainWin.webContents.focus(); }
  };
  const elapsed = Date.now() - (splashOpenedAt || Date.now());
  if (splashSkipped || elapsed >= SPLASH_MIN_MS) reveal();
  else setTimeout(reveal, SPLASH_MIN_MS - elapsed);
}
ipcMain.on('splash:skip', () => {
  splashSkipped = true;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show(); mainWindow.focus(); mainWindow.webContents.focus();
  }
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#24282e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);
  // Electron's default show-on-create doesn't always transfer real OS-level keyboard focus on
  // Windows, especially when launched from a shortcut/batch file rather than double-clicked --
  // the window can be visually frontmost and clickable (so buttons, spinners, mouse-driven
  // controls all work) while actual typed keystrokes still route to whatever window last had
  // true focus. Explicitly focus once the page has actually finished loading, not just on
  // creation, so a keyboard focus request has real content to land on.
  splashStage('Opening workspace', 35);
  mainWindow.webContents.once('did-finish-load', () => {
    // g109: the show/focus now happens through closeSplash so the two windows hand over cleanly.
    // The focus dance below still matters for the reason described above.
    splashStage('Ready', 100);
    closeSplash(mainWindow);
    // Belt and braces: if the splash failed to create at all, this still shows the window.
    if (!splashWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.focus(); }
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.focus(); mainWindow.webContents.focus(); }
    }, SPLASH_MIN_MS + 400);
  });
  mainWindow.on('restore', () => { mainWindow.focus(); mainWindow.webContents.focus(); });
}

app.whenReady().then(async()=>{
  /* g109: the splash goes up FIRST, before any of the slow work, because covering that work is
     the whole point. Each stage is announced before the step it names, with a yield so the
     message actually reaches the splash renderer -- these calls are synchronous and would
     otherwise all queue and arrive together at the end, which would make the bar jump 0 to 100
     and tell him nothing. The percentages are the honest shape of the work: backing up a 100MB
     database is most of it. */
  createSplash();
  const beat = () => new Promise(r => setTimeout(r, 0));

  splashStage('Checking database', 8); await beat();
  const recoveryResult=promoteRecoveryDatabase();
  const guardResult=protectCanonicalDatabase();

  splashStage('Backing up your work', 15); await beat();
  createStartupBackup();
  maybeCreateDailyBackup();

  createWindow();
  if(guardResult?.restored){
    await dialog.showMessageBox(mainWindow,{
      type:'warning',
      title:'StudioFlow Database Recovered',
      message:'StudioFlow prevented an incomplete database from replacing your business records.',
      detail:`The richer ${guardResult.source} database was restored automatically. A copy of the incomplete database was preserved for diagnosis.`,
      buttons:['Continue'],
      defaultId:0
    });
  }
}).catch(error => nativeLog(error.stack || error.message));
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', error => nativeLog(error.stack || error.message));
process.on('unhandledRejection', error => nativeLog(error?.stack || error?.message || String(error)));

ipcMain.handle('data:load', () => loadData());
ipcMain.handle('data:save', (_event, data) => saveData(data));

ipcMain.handle('data:createBackup', async () => {
  const target=createBackupFile('StudioFlow-3.1.0-Manual');
  return {ok:true,path:target};
});
ipcMain.handle('data:autoBackup', async (_event, reason='update') => {
  const target=createBackupFile(`StudioFlow-Auto-${String(reason).replace(/[^a-z0-9_-]/gi,'-')}`);
  return {ok:true,path:target};
});
ipcMain.handle('data:restoreBackup', async () => {
  const result=await dialog.showOpenDialog(mainWindow,{properties:['openFile'],filters:[{name:'StudioFlow Backup',extensions:['json']}]});
  if(result.canceled||!result.filePaths[0])return null;
  createBackupFile('StudioFlow-Before-Restore');
  const restored=normalize(JSON.parse(fs.readFileSync(result.filePaths[0],'utf8')));
  writeJsonAtomic(dataPath(),restored);
  return {ok:true,data:restored,path:result.filePaths[0]};
});

ipcMain.handle('app:openExternal', async (_event, url) => {
  try { await shell.openExternal(String(url)); return {ok:true}; }
  catch(error){ return {ok:false,error:error.message}; }
});
ipcMain.handle('data:openFolder', async () => { const dir=app.getPath('userData'); await shell.openPath(dir); return dir; });
ipcMain.handle('data:statistics', () => {
  const d=loadData(), stat=fs.existsSync(dataPath())?fs.statSync(dataPath()):null;
  const counts={}; Object.entries(d).forEach(([k,v])=>{if(Array.isArray(v))counts[k]=v.length});
  return {dataFile:dataPath(),backupFolder:backupsDir(),sizeBytes:stat?.size||0,lastModified:stat?.mtime?.toISOString()||'',counts,schemaVersion:d.schemaVersion||0,appVersion:d.appVersion||'',health:databaseHealth()};
});
ipcMain.handle('data:listBackups', () => backupFiles());
ipcMain.handle('data:health', () => databaseHealth());
ipcMain.handle('data:restorePath', async (_event, backupPath) => {
  try{
    const resolved=path.resolve(String(backupPath||''));
    if(!resolved.startsWith(path.resolve(backupsDir())))return {ok:false,error:'Backup is outside the StudioFlow backup folder.'};
    const candidate=JSON.parse(fs.readFileSync(resolved,'utf8'));
    const validation=validateDatabaseShape(candidate); if(!validation.ok)return validation;
    createBackupFile('StudioFlow-Before-Restore');
    const restored=normalize(candidate); writeJsonAtomic(dataPath(),restored);
    return {ok:true,data:restored,path:resolved};
  }catch(error){return {ok:false,error:error.message}}
});
ipcMain.handle('data:inspectBackup', async (_event, backupPath) => {
  try{
    const resolved=path.resolve(String(backupPath||''));
    if(!resolved.startsWith(path.resolve(backupsDir())))return {ok:false,error:'Invalid backup path.'};
    const candidate=JSON.parse(fs.readFileSync(resolved,'utf8'));
    const validation=validateDatabaseShape(candidate); if(!validation.ok)return validation;
    return {ok:true,path:resolved,summary:summarizeDatabase(candidate),collections:Object.entries(candidate).filter(([,v])=>Array.isArray(v)).map(([key,v])=>({key,count:v.length}))};
  }catch(error){return {ok:false,error:error.message}}
});
ipcMain.handle('data:restoreSelected', async (_event, payload={}) => {
  try{
    const resolved=path.resolve(String(payload.backupPath||''));
    if(!resolved.startsWith(path.resolve(backupsDir())))return {ok:false,error:'Invalid backup path.'};
    const candidate=JSON.parse(fs.readFileSync(resolved,'utf8'));
    const validation=validateDatabaseShape(candidate); if(!validation.ok)return validation;
    const keys=Array.isArray(payload.collections)?payload.collections.filter(key=>Array.isArray(candidate[key])):[];
    if(!keys.length)return {ok:false,error:'Select at least one collection to restore.'};
    createBackupFile('StudioFlow-Before-Selective-Restore');
    const current=loadData(); keys.forEach(key=>{current[key]=candidate[key]});
    current.databaseMeta={...(current.databaseMeta||{}),lastSelectiveRestoreAt:new Date().toISOString(),lastSelectiveRestoreCollections:keys};
    const restored=normalize(current); writeJsonAtomic(dataPath(),restored);
    return {ok:true,data:restored,collections:keys};
  }catch(error){return {ok:false,error:error.message}}
});
ipcMain.handle('data:deleteBackup', async (_event, backupPath) => {
  try{const resolved=path.resolve(String(backupPath||''));if(!resolved.startsWith(path.resolve(backupsDir())))return {ok:false,error:'Invalid backup path.'};fs.unlinkSync(resolved);return {ok:true}}catch(error){return {ok:false,error:error.message}}
});



// StudioFlow 12.0.4 artwork image resolver. Converts saved file paths and legacy
// image values into renderer-safe data URLs without changing the original file.
ipcMain.handle('file:resolveImageSource', async (_event, source) => {
  try {
    if (source && typeof source === 'object') source = source.data || source.url || source.path || source.src || '';
    source = String(source || '').trim().replace(/^['"]|['"]$/g, '');
    if (!source) return { ok:false, error:'No image source was stored for this artwork.' };
    if (/^data:image\//i.test(source)) return { ok:true, data:source };
    if (/^https?:\/\//i.test(source)) return { ok:true, data:source };
    if (/^blob:/i.test(source)) return { ok:false, error:'The artwork used a temporary browser image reference. Re-select the artwork image once to make it permanent.' };
    if (/^[A-Za-z0-9+/=\r\n]{500,}$/.test(source)) return { ok:true, data:`data:image/jpeg;base64,${source.replace(/\s+/g,'')}` };
    let candidate=source;
    if (/^file:\/\//i.test(candidate)) {
      try { candidate=decodeURIComponent(new URL(candidate).pathname); } catch {}
      if (process.platform==='win32' && /^\/[A-Za-z]:/.test(candidate)) candidate=candidate.slice(1);
    }
    const attempts=[candidate];
    if (!path.isAbsolute(candidate)) {
      attempts.push(path.join(__dirname,candidate));
      attempts.push(path.join(process.resourcesPath||__dirname,candidate));
    }
    const filePath=attempts.find(x=>{try{return fs.existsSync(x)&&fs.statSync(x).isFile()}catch{return false}});
    if (!filePath) return { ok:false, error:`Artwork image file was not found: ${source}` };
    const ext=path.extname(filePath).slice(1).toLowerCase();
    const mime={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',bmp:'image/bmp',tif:'image/tiff',tiff:'image/tiff'}[ext]||'application/octet-stream';
    return { ok:true, data:`data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`, path:filePath };
  } catch (error) {
    nativeLog(`Artwork image resolve failed: ${error.message}`);
    return { ok:false, error:error.message };
  }
});

ipcMain.handle('file:openImage', async (_event, options={}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: options?.title || 'Choose Artwork Image',
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
  });
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.focus(); }
  if (result.canceled || !result.filePaths[0]) return null;
  try {
    const sourcePath = result.filePaths[0];
    const storedPath = persistArtworkImageFromPath(sourcePath, options?.preferredName || path.basename(sourcePath,path.extname(sourcePath)));
    const extension = path.extname(storedPath).slice(1).toLowerCase();
    const mime = ['jpg', 'jpeg'].includes(extension) ? 'image/jpeg' : `image/${extension}`;
    return {
      name: path.basename(sourcePath),
      sourcePath,
      storedPath,
      data: `data:${mime};base64,${fs.readFileSync(storedPath).toString('base64')}`
    };
  } catch(error) {
    nativeLog(`Artwork image import failed: ${error.message}`);
    return {ok:false,error:error.message};
  }
});

ipcMain.handle('file:storeArtworkImage', async (_event, payload={}) => {
  try {
    let storedPath='';
    if(payload.data && /^data:image\//i.test(payload.data)) storedPath=persistArtworkImageData(payload.data,payload.name||payload.title||'artwork');
    else if(payload.path && fs.existsSync(payload.path)) storedPath=persistArtworkImageFromPath(payload.path,payload.name||payload.title||'artwork');
    else return {ok:false,error:'No usable artwork image was supplied.'};
    const ext=path.extname(storedPath).slice(1).toLowerCase();
    const mime={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',bmp:'image/bmp'}[ext]||'application/octet-stream';
    return {ok:true,storedPath,data:`data:${mime};base64,${fs.readFileSync(storedPath).toString('base64')}`};
  } catch(error){nativeLog(`Artwork image persistence failed: ${error.message}`);return {ok:false,error:error.message};}
});

ipcMain.handle('file:openArtworkImagesFolder', async () => {
  const error=await shell.openPath(artworkImagesDir());
  return error?{ok:false,error}:{ok:true,path:artworkImagesDir()};
});

ipcMain.handle('file:openImages', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
  });
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.focus(); }
  if (result.canceled) return [];
  return result.filePaths.map(filePath => {
    const extension = path.extname(filePath).slice(1).toLowerCase();
    const mime = ['jpg', 'jpeg'].includes(extension) ? 'image/jpeg' : `image/${extension}`;
    return { name: path.basename(filePath), data: `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}` };
  });
});

ipcMain.handle('file:openJson', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.focus(); }
  if (result.canceled || !result.filePaths[0]) return null;
  return fs.readFileSync(result.filePaths[0], 'utf8');
});


ipcMain.handle('file:openText', async (_event, options={}) => {
  const extensions = Array.isArray(options.extensions) ? options.extensions : ['csv','txt'];
  const result = await dialog.showOpenDialog(mainWindow, { properties:['openFile'], filters:[{name:options.name||'Text files', extensions}] });
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.focus(); }
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath=result.filePaths[0];
  return {name:path.basename(filePath), text:fs.readFileSync(filePath,'utf8')};
});

ipcMain.handle('file:saveText', async (_event, payload) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: payload.name || 'StudioFlow_Backup.json'
  });
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.focus(); }
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, payload.text, 'utf8');
  return result.filePath;
});




ipcMain.handle('room:capturePresentation', async (event, payload={}) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!win) return {ok:false,error:'StudioFlow window is unavailable.'};
    const r=payload.rect||{};
    const rect={x:Math.max(0,Math.round(Number(r.x)||0)),y:Math.max(0,Math.round(Number(r.y)||0)),width:Math.max(1,Math.round(Number(r.width)||1)),height:Math.max(1,Math.round(Number(r.height)||1))};
    const image=await win.webContents.capturePage(rect);
    const result=await dialog.showSaveDialog(win,{defaultPath:payload.name||'StudioFlow-Presentation.png',filters:[{name:'PNG Image',extensions:['png']}]});
    if (win) { win.show(); win.focus(); }
    if(result.canceled||!result.filePath)return {ok:false,canceled:true};
    fs.writeFileSync(result.filePath,image.toPNG());
    return {ok:true,path:result.filePath};
  } catch(error) { return {ok:false,error:error.message}; }
});

function extractLargestEmbeddedJpeg(filePath){
  try {
    const bytes=fs.readFileSync(filePath);
    const candidates=[];
    for(let start=0;start<bytes.length-4;start++){
      if(bytes[start]!==0xff || bytes[start+1]!==0xd8 || bytes[start+2]!==0xff) continue;
      let end=start+3;
      while(end<bytes.length-1){
        if(bytes[end]===0xff && bytes[end+1]===0xd9){
          const length=end+2-start;
          if(length>65536) candidates.push({start,end:end+2,length});
          start=end+1;
          break;
        }
        end++;
      }
    }
    candidates.sort((a,b)=>b.length-a.length);
    for(const candidate of candidates.slice(0,12)){
      const jpeg=bytes.subarray(candidate.start,candidate.end);
      const image=nativeImage.createFromBuffer(jpeg);
      if(image && !image.isEmpty()){
        const size=image.getSize();
        if(size.width>=640 && size.height>=480){
          nativeLog(`Direct RAW JPEG scan found ${size.width}x${size.height}, ${candidate.length} bytes in ${filePath}`);
          return {jpeg,size};
        }
      }
    }
  } catch(error){ nativeLog(`Direct RAW JPEG scan failed for ${filePath}: ${error.message}`); }
  return null;
}

function rawPreviewCachePath(filePath, extension='.jpg'){
  const stat=fs.statSync(filePath);
  const safe=Buffer.from(`${filePath}|${stat.size}|${stat.mtimeMs}`).toString('base64url').slice(-90);
  const dir=path.join(app.getPath('cache'),'StudioFlow','raw-previews');
  fs.mkdirSync(dir,{recursive:true});
  return path.join(dir,`${safe}${extension}`);
}

function validPreviewFile(filePath){
  try {
    if(!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).size < 1024) return false;
    const image=nativeImage.createFromPath(filePath);
    return Boolean(image && !image.isEmpty());
  } catch { return false; }
}

function findBundledExifTool(){
  const candidates=[];
  try {
    const pkg=require.resolve('exiftool-vendored.exe/package.json');
    candidates.push(path.join(path.dirname(pkg),'bin','exiftool.exe'));
  } catch(error){ nativeLog(`ExifTool package lookup failed: ${error?.message||error}`); }
  candidates.push(
    path.join(__dirname,'node_modules','exiftool-vendored.exe','bin','exiftool.exe'),
    path.join(process.resourcesPath||'', 'app.asar.unpacked','node_modules','exiftool-vendored.exe','bin','exiftool.exe'),
    path.join(process.resourcesPath||'', 'node_modules','exiftool-vendored.exe','bin','exiftool.exe')
  );
  return candidates.find(candidate=>candidate && fs.existsSync(candidate)) || null;
}

function extractExifToolBinary(filePath, tag, output){
  return new Promise(resolve=>{
    const executable=findBundledExifTool();
    if(!executable){ nativeLog('Bundled ExifTool executable was not found.'); return resolve(false); }
    let settled=false;
    const finish=value=>{ if(!settled){ settled=true; resolve(value); } };
    try {
      const child=spawn(executable,['-b',`-${tag}`,filePath],{windowsHide:true,stdio:['ignore','pipe','pipe']});
      const chunks=[]; let stderr='';
      child.stdout.on('data',chunk=>chunks.push(chunk));
      child.stderr.on('data',chunk=>stderr+=chunk.toString());
      child.on('error',error=>{ nativeLog(`ExifTool ${tag} launch failed for ${filePath}: ${error.message}`); finish(false); });
      child.on('close',code=>{
        if(settled) return;
        try {
          const data=Buffer.concat(chunks);
          if(code===0 && data.length>1024){
            fs.writeFileSync(output,data);
            if(validPreviewFile(output)) return finish(true);
          }
          try { if(fs.existsSync(output)) fs.unlinkSync(output); } catch {}
          nativeLog(`ExifTool ${tag} returned no usable preview for ${filePath}. Exit ${code}. ${stderr.trim()}`);
        } catch(error){ nativeLog(`ExifTool ${tag} output failed for ${filePath}: ${error.message}`); }
        finish(false);
      });
    } catch(error){ nativeLog(`ExifTool ${tag} could not start: ${error.message}`); finish(false); }
  });
}

async function createExifToolRawPreview(filePath){
  const output=rawPreviewCachePath(filePath,'.jpg');
  if(validPreviewFile(output)) return output;
  try { if(fs.existsSync(output)) fs.unlinkSync(output); } catch {}

  for(const tag of ['PreviewImage','JpgFromRaw','OtherImage','ThumbnailImage']){
    try { if(await extractExifToolBinary(filePath,tag,output)) return output; }
    catch(error){ nativeLog(`Direct ExifTool ${tag} failed for ${filePath}: ${error?.message||error}`); }
  }

  // The wrapper is deliberately loaded only after direct extraction fails.
  const tool=getExifTool();
  if(tool){
    const attempts=[
      ['PreviewImage', t=>t.extractPreview(filePath,output)],
      ['JpgFromRaw', t=>t.extractJpgFromRaw(filePath,output)],
      ['ThumbnailImage', t=>t.extractThumbnail(filePath,output)]
    ];
    for(const [label,extract] of attempts){
      try { await extract(tool); if(validPreviewFile(output)) return output; }
      catch(error){ nativeLog(`ExifTool wrapper ${label} failed for ${filePath}: ${error?.message||error}`); }
      try { if(fs.existsSync(output)) fs.unlinkSync(output); } catch {}
    }
  }
  return null;
}

function createWindowsRawPreview(filePath){
  return new Promise(resolve=>{
    if(process.platform!=='win32') return resolve(null);
    const output=rawPreviewCachePath(filePath,'.png');
    if(validPreviewFile(output)) return resolve(output);
    const script=`
$ErrorActionPreference='Stop'
Add-Type -AssemblyName PresentationCore
$inputPath=$args[0]
$outputPath=$args[1]
$stream=[System.IO.File]::OpenRead($inputPath)
try {
  $decoder=[System.Windows.Media.Imaging.BitmapDecoder]::Create($stream,[System.Windows.Media.Imaging.BitmapCreateOptions]::PreservePixelFormat,[System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad)
  if($decoder.Frames.Count -lt 1){ throw 'No RAW preview frame was returned by Windows Imaging Component.' }
  $frame=$decoder.Frames[0]
  $max=2200.0
  $scale=[Math]::Min(1.0,$max/[Math]::Max($frame.PixelWidth,$frame.PixelHeight))
  if($scale -lt 1.0){ $frame=[System.Windows.Media.Imaging.TransformedBitmap]::new($frame,[System.Windows.Media.ScaleTransform]::new($scale,$scale)) }
  $encoder=[System.Windows.Media.Imaging.PngBitmapEncoder]::new()
  $encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($frame))
  $out=[System.IO.File]::Create($outputPath)
  try { $encoder.Save($out) } finally { $out.Dispose() }
} finally { $stream.Dispose() }
`;
    const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',script,filePath,output],{windowsHide:true});
    let error=''; child.stderr.on('data',d=>error+=d.toString());
    child.on('error',()=>resolve(null));
    child.on('close',code=>{
      if(code===0 && validPreviewFile(output)) resolve(output);
      else { try{if(fs.existsSync(output))fs.unlinkSync(output)}catch{}; if(error)nativeLog(`Windows RAW preview failed for ${filePath}: ${error.trim()}`); resolve(null); }
    });
  });
}


function createWindowsShellThumbnail(filePath, requestedSize=2560){
  return new Promise(resolve=>{
    if(process.platform!=='win32') return resolve(null);
    const output=rawPreviewCachePath(filePath,'.shell.png');
    if(validPreviewFile(output)) return resolve(output);
    const helperDir=path.join(app.getPath('cache'),'StudioFlow','shell-thumbnail-helper');
    fs.mkdirSync(helperDir,{recursive:true});
    const scriptPath=path.join(helperDir,'Get-ShellThumbnail.ps1');
    const script=String.raw`param(
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$OutputPath,
  [int]$Size = 2560
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$source = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class StudioFlowShellThumbnail {
  [StructLayout(LayoutKind.Sequential)]
  public struct SIZE { public int cx; public int cy; }

  [Flags]
  public enum SIIGBF : uint {
    RESIZETOFIT = 0x00,
    BIGGERSIZEOK = 0x01,
    MEMORYONLY = 0x02,
    ICONONLY = 0x04,
    THUMBNAILONLY = 0x08,
    INCACHEONLY = 0x10,
    CROPTOSQUARE = 0x20,
    WIDETHUMBNAILS = 0x40,
    ICONBACKGROUND = 0x80,
    SCALEUP = 0x100
  }

  [ComImport]
  [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  [Guid("7e9fb0d3-919f-4307-ab2e-9b1860310c93")]
  interface IShellItemImageFactory {
    void GetImage(SIZE size, SIIGBF flags, out IntPtr phbm);
  }

  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  static extern void SHCreateItemFromParsingName(
    [MarshalAs(UnmanagedType.LPWStr)] string pszPath,
    IntPtr pbc,
    [MarshalAs(UnmanagedType.LPStruct)] Guid riid,
    [MarshalAs(UnmanagedType.Interface)] out object ppv);

  [DllImport("gdi32.dll")]
  [return: MarshalAs(UnmanagedType.Bool)]
  static extern bool DeleteObject(IntPtr hObject);

  public static void Save(string inputPath, string outputPath, int size) {
    object shellItem = null;
    IntPtr hBitmap = IntPtr.Zero;
    try {
      Guid iid = typeof(IShellItemImageFactory).GUID;
      SHCreateItemFromParsingName(inputPath, IntPtr.Zero, iid, out shellItem);
      var factory = (IShellItemImageFactory)shellItem;
      var requested = new SIZE { cx = size, cy = size };
      factory.GetImage(requested, SIIGBF.BIGGERSIZEOK | SIIGBF.THUMBNAILONLY | SIIGBF.SCALEUP, out hBitmap);
      if (hBitmap == IntPtr.Zero) throw new InvalidOperationException("Windows Shell returned an empty thumbnail handle.");
      using (var bitmap = Image.FromHbitmap(hBitmap)) {
        bitmap.Save(outputPath, ImageFormat.Png);
      }
    } finally {
      if (hBitmap != IntPtr.Zero) DeleteObject(hBitmap);
      if (shellItem != null && Marshal.IsComObject(shellItem)) Marshal.FinalReleaseComObject(shellItem);
    }
  }
}
'@
Add-Type -TypeDefinition $source -ReferencedAssemblies System.Drawing
[StudioFlowShellThumbnail]::Save($InputPath, $OutputPath, $Size)
`;
    try{
      if(!fs.existsSync(scriptPath) || fs.readFileSync(scriptPath,'utf8')!==script) fs.writeFileSync(scriptPath,script,'utf8');
      try{if(fs.existsSync(output))fs.unlinkSync(output)}catch{}
      const child=spawn('powershell.exe',[
        '-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
        '-File',scriptPath,'-InputPath',filePath,'-OutputPath',output,'-Size',String(requestedSize)
      ],{windowsHide:true,stdio:['ignore','ignore','pipe']});
      let stderr='';
      const timer=setTimeout(()=>{try{child.kill()}catch{};nativeLog(`Windows Shell thumbnail timed out for ${filePath}`);resolve(null)},30000);
      child.stderr.on('data',d=>stderr+=d.toString());
      child.on('error',error=>{clearTimeout(timer);nativeLog(`Windows Shell thumbnail helper failed to launch for ${filePath}: ${error.message}`);resolve(null)});
      child.on('close',code=>{
        clearTimeout(timer);
        if(code===0 && validPreviewFile(output)) return resolve(output);
        try{if(fs.existsSync(output))fs.unlinkSync(output)}catch{}
        nativeLog(`Windows Shell thumbnail helper failed for ${filePath}. Exit ${code}. ${stderr.trim()}`);
        resolve(null);
      });
    }catch(error){nativeLog(`Windows Shell thumbnail helper exception for ${filePath}: ${error.message}`);resolve(null)}
  });
}

const CULL_EXTENSIONS = new Set(['.jpg','.jpeg','.png','.webp','.tif','.tiff','.bmp','.gif','.heic','.heif','.dng','.cr2','.cr3','.nef','.arw','.orf','.rw2','.raf','.pef','.srw']);



/* StudioFlow 11.4.2 · Squarespace connection engine */
const SQUARESPACE_SECRET_FILE = 'studioflow-squarespace-credentials.json';
const squarespaceSecretPath = () => path.join(app.getPath('userData'), SQUARESPACE_SECRET_FILE);
function saveSquarespaceToken(token){
  const value=String(token||'').trim();
  if(!value) throw new Error('Enter a Squarespace API key.');
  let payload={encrypted:false,value};
  if(safeStorage.isEncryptionAvailable()){
    payload={encrypted:true,value:safeStorage.encryptString(value).toString('base64')};
  }
  fs.writeFileSync(squarespaceSecretPath(),JSON.stringify(payload),'utf8');
  return true;
}
function loadSquarespaceToken(){
  try{
    if(!fs.existsSync(squarespaceSecretPath())) return '';
    const payload=JSON.parse(fs.readFileSync(squarespaceSecretPath(),'utf8'));
    if(payload.encrypted) return safeStorage.decryptString(Buffer.from(payload.value,'base64'));
    return String(payload.value||'');
  }catch(error){ nativeLog(`Squarespace credential read failed: ${error.message}`); return ''; }
}
async function squarespaceRequest(endpoint, token, query={}, options={}){
  const url=new URL(`https://api.squarespace.com${endpoint}`);
  Object.entries(query||{}).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')url.searchParams.set(k,String(v));});
  const fetchOpts={
    method: options.method || 'GET',
    headers:{Authorization:`Bearer ${token}`,'User-Agent':'StudioFlow/11.4.2','Content-Type':'application/json'}
  };
  // The inventory adjustments endpoint documents an Idempotency-Key requirement; sending one is
  // harmless on endpoints that ignore it.
  if(options.idempotent)fetchOpts.headers['Idempotency-Key']=(globalThis.crypto?.randomUUID?.())||`sf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if(options.body!==undefined) fetchOpts.body = JSON.stringify(options.body);
  const response=await fetch(url,fetchOpts);
  const text=await response.text();
  let body={}; try{body=text?JSON.parse(text):{}}catch{body={message:text}}
  if(!response.ok){
    const message=body?.message||body?.error||`Squarespace request failed (${response.status})`;
    const error=new Error(message); error.status=response.status; throw error;
  }
  return body;
}
async function squarespacePaginated(endpoint, token, resultKey, query={}){
  const result=[]; let cursor=''; let pages=0;
  do{
    const body=await squarespaceRequest(endpoint,token,{...query,...(cursor?{cursor}:{})});
    const rows=body[resultKey]||body.result||[]; if(Array.isArray(rows))result.push(...rows);
    cursor=body.pagination?.hasNextPage?body.pagination?.nextPageCursor||'':''; pages++;
  }while(cursor&&pages<100);
  return result;
}
ipcMain.handle('squarespace:saveCredentials',async(_event,payload={})=>{saveSquarespaceToken(payload.apiKey);return{ok:true}});
ipcMain.handle('squarespace:credentialStatus',()=>({configured:!!loadSquarespaceToken(),encrypted:safeStorage.isEncryptionAvailable()}));
ipcMain.handle('squarespace:clearCredentials',()=>{try{if(fs.existsSync(squarespaceSecretPath()))fs.unlinkSync(squarespaceSecretPath());return{ok:true}}catch(error){return{ok:false,error:error.message}}});
ipcMain.handle('squarespace:test',async(_event,payload={})=>{
  try{if(payload.apiKey)saveSquarespaceToken(payload.apiKey);const token=loadSquarespaceToken();if(!token)throw new Error('No Squarespace API key is saved.');const website=await squarespaceRequest('/1.0/authorization/website',token);return{ok:true,website};}
  catch(error){nativeLog(`Squarespace test failed: ${error.stack||error}`);return{ok:false,error:error.message,status:error.status||0}}
});
ipcMain.handle('squarespace:syncProducts',async()=>{
  try{const token=loadSquarespaceToken();if(!token)throw new Error('No Squarespace API key is saved.');const products=await squarespacePaginated('/v2/commerce/products',token,'products');const inventory=await squarespacePaginated('/1.0/commerce/inventory',token,'inventory');return{ok:true,products,inventory,syncedAt:new Date().toISOString()};}
  catch(error){nativeLog(`Squarespace product sync failed: ${error.stack||error}`);return{ok:false,error:error.message,status:error.status||0}}
});
ipcMain.handle('expense:parseExpensifyPdf',async()=>{
  try{
    const {filePaths,canceled}=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'PDF',extensions:['pdf']}]});
    if(canceled||!filePaths?.length)return {ok:false,cancelled:true};
    const filePath=filePaths[0];
    const buffer=fs.readFileSync(filePath);

    // ---- Text parsing -- validated directly against four real Expensify exports before writing
    // this. The main expense table (one row per line, with the receipt number inline) is far
    // more reliable to parse than the "Receipt Thumbnails" summary section, which extracts as a
    // messy multi-column zip across several receipts on one line and can misattribute comments.
    // pdf-parse's default text renderer only starts a new line on an EXACT Y-coordinate change,
    // with no logic for spacing between items on the same line. That breaks two things
    // specifically confirmed by testing directly against a real report: words on the same line
    // run together with no space ("DATE MERCHANT TOTAL" becomes "DATEMERCHANTTOTAL"), and a
    // price's cents -- rendered as slightly-raised superscript text with a different baseline --
    // get treated as a separate line entirely ("C$66.77" becomes "C$66" then ".77" elsewhere).
    // This custom renderer groups text by Y-position with tolerance (so a raised superscript
    // merges with its baseline), and only inserts a space between items when there's an actual
    // horizontal gap between them, rather than blindly per-line-only joining.
    const pdfParse=require('pdf-parse');
    const customRender=async pageData=>{
      const content=await pageData.getTextContent({normalizeWhitespace:true});
      const items=content.items.map(it=>({str:it.str,x:it.transform[4],y:it.transform[5],w:it.width||0,h:Math.abs(it.transform[3])||10}));
      if(!items.length)return '';
      // Group into rows: same row if Y is within a tolerance based on typical text height --
      // wide enough to catch a superscript sitting a few units above its baseline.
      const tol=Math.max(4,Math.min(...items.map(i=>i.h))*0.6);
      const sorted=[...items].sort((a,b)=>b.y-a.y||a.x-b.x);
      const rows=[];
      sorted.forEach(it=>{
        let row=rows.find(r=>Math.abs(r.y-it.y)<=tol);
        if(!row){row={y:it.y,items:[]};rows.push(row);}
        row.items.push(it);
      });
      return rows.map(row=>{
        const rowItems=row.items.sort((a,b)=>a.x-b.x);
        let line='',prevEnd=null;
        rowItems.forEach(it=>{
          if(prevEnd!==null&&it.x-prevEnd>Math.max(1,it.h*0.2))line+=' ';
          line+=it.str;
          prevEnd=it.x+it.w;
        });
        return line;
      }).join('\n');
    };
    const parsed=await pdfParse(buffer,{pagerender:async pageData=>customRender(pageData)});
    // The raw text stream includes invisible Unicode Private Use Area glyphs (the little
    // receipt/document icons rendered inline before each row) that don't show in a normal text
    // preview but break line-by-line parsing if left in. Confirmed by testing directly against
    // real exports before writing this regex.
    const text=parsed.text.replace(/[\uE000-\uF8FF]/g,' ');

    const titleMatch=text.match(/Expense(?:s|\s+Report)\s+([^\n]*?)\s*C\$[\d,]+\.\d{2}/);
    const reportName=titleMatch?titleMatch[1].trim():'Imported Expenses';
    const dateMatch=text.match(/\bDate\b\s*\n\s*([^\n]+)/);
    const dateLine=dateMatch?dateMatch[1].trim():'';
    const firstDateStr=(dateLine.split(/\s+to\s+/)[0]||'').trim();
    const yearMatch=firstDateStr.match(/(\d{4})/);
    const year=yearMatch?yearMatch[1]:new Date().getFullYear();

    // Category sections look like "Travel - C$112.27" on their own line, each followed by a
    // DATE/MERCHANT/[DESCRIPTION]/TOTAL table until the next category header or the activity log.
    const categoryRe=/^([A-Za-z][A-Za-z\s]*?)\s*-\s*C\$([\d,]+\.\d{2})\s*$/gm;
    const sections=[];
    let m;
    const headerMatches=[];
    while((m=categoryRe.exec(text))){ headerMatches.push({category:m[1].trim(),index:m.index}); }
    for(let i=0;i<headerMatches.length;i++){
      const start=headerMatches[i].index;
      const end=i+1<headerMatches.length?headerMatches[i+1].index:text.length;
      sections.push({category:headerMatches[i].category,body:text.slice(start,end)});
    }

    const rowRe=/^\s*([A-Za-z]{3}\s+\d{1,2})\s+(.+?)\s+(\d+)\s+(.*?)\s*C\$([\d,]+\.\d{2})\s*$/gm;
    const lineItems=[];
    sections.forEach(sec=>{
      let rm;
      const re=new RegExp(rowRe.source,'gm');
      while((rm=re.exec(sec.body))){
        const [,dateStr,merchant,receiptNum,description,amountStr]=rm;
        lineItems.push({
          date:`${dateStr}, ${year}`,
          merchant:merchant.trim(),
          description:(description||'').trim(),
          amount:Number(amountStr.replace(/,/g,'')),
          category:sec.category,
          receiptNumber:Number(receiptNum),
        });
      }
    });
    lineItems.sort((a,b)=>a.receiptNumber-b.receiptNumber);

    // ---- Image extraction -- validated the pattern (one large image per page, starting page
    // index 2, in the same order as receipt numbering) against real files using pypdf, but this
    // Node/pdf-lib implementation of that same idea has not been run before. If it fails for any
    // reason, line items still come through without their photo rather than losing the import.
    let images={};
    try{
      const {PDFDocument,PDFName,PDFRawStream}=require('pdf-lib');
      const pdfDoc=await PDFDocument.load(buffer,{ignoreEncryption:true});
      for(const item of lineItems){
        const pageIndex=item.receiptNumber+1; // pages 0-1 are summary; page 2 = receipt #1, etc.
        if(pageIndex>=pdfDoc.getPageCount())continue;
        try{
          const page=pdfDoc.getPage(pageIndex);
          const resources=page.node.Resources();
          const xObjects=resources?.lookup(PDFName.of('XObject'));
          if(!xObjects)continue;
          for(const key of xObjects.keys()){
            const xObj=xObjects.lookup(key);
            if(xObj instanceof PDFRawStream){
              const subtype=xObj.dict.lookup(PDFName.of('Subtype'));
              if(subtype?.name!=='Image')continue;
              const filter=xObj.dict.lookup(PDFName.of('Filter'));
              const filterName=filter?.name||(Array.isArray(filter?.array)?filter.array[0]?.name:'');
              if(filterName==='DCTDecode'){
                images[item.receiptNumber]={mime:'image/jpeg',data:Buffer.from(xObj.contents).toString('base64')};
                break;
              }
            }
          }
        }catch(pageErr){ nativeLog(`PDF image extraction failed for receipt ${item.receiptNumber}: ${pageErr.message}`); }
      }
    }catch(imgErr){ nativeLog(`PDF image extraction unavailable: ${imgErr.stack||imgErr}`); }

    return {
      ok:true,
      reportName,
      total:lineItems.reduce((n,x)=>n+x.amount,0),
      lineItems:lineItems.map(x=>({...x,receiptImage:images[x.receiptNumber]?`data:${images[x.receiptNumber].mime};base64,${images[x.receiptNumber].data}`:''})),
      sourceFile:filePath.split(/[\\/]/).pop(),
      // If nothing matched, include a sample of what was actually extracted -- this is what
      // makes a mismatch diagnosable instead of a dead end, since pdf-parse's text output could
      // genuinely differ from what this was validated against.
      rawTextSample:lineItems.length?undefined:text.slice(0,1500),
    };
  }catch(error){
    nativeLog(`Expensify PDF import failed: ${error.stack||error}`);
    return {ok:false,error:error.message};
  }
});
ipcMain.handle('printer:pollInkLevels',async(_event,payload={})=>{
  try{
    const {ipAddress}=payload;
    if(!ipAddress)throw new Error('No printer IP address configured. Add one on the printer\'s profile in Printers & Ink.');
    let snmp;
    try{ snmp=require('net-snmp'); }
    catch{ throw new Error('The net-snmp package isn\'t installed yet. Run "npm install" in the StudioFlow folder, then restart the app, to enable this.'); }
    const session=snmp.createSession(ipAddress,'public',{timeout:5000,retries:1});
    // Standard SNMP Printer-MIB supply table -- not Epson-specific, widely supported by
    // networked printers. Walking these three parallel tables: description, current level,
    // and max capacity, per supply (cartridge) index.
    const walkTable=oid=>new Promise((resolve,reject)=>{
      const results=[];
      session.subtree(oid,20,varbinds=>{
        varbinds.forEach(vb=>{ if(!snmp.isVarbindError(vb))results.push(vb); });
      },error=>{ if(error)reject(error); else resolve(results); });
    });
    /* g157 — READ THE UNIT AND THE CLASS TOO, and honour RFC 3805's sentinel values.
       Kirk's Canon MF8280cw is a LASER: toner, not ink, and it reported every supply as 100%.
       Two faults made that reading meaningless.
       (1) THE UNIT WAS NEVER READ. prtMarkerSuppliesSupplyUnit (…7.1) says what the numbers MEAN.
           Unit 19 is PERCENT — the level IS already a percentage and dividing it by max is wrong.
           Many lasers report unit 19 with max 100, which by luck gives the right answer, and some
           report unit 19 with max -2, which gave a nonsense one.
       (2) NEGATIVE LEVELS ARE NOT QUANTITIES. -1 means "other", -2 "unknown", -3 "some remaining,
           amount unknown". The old maths let those through arithmetically. A cartridge reporting
           -3 must be shown as "some remaining", never as a number.
       prtMarkerSuppliesClass (…4.1) distinguishes a CONSUMED supply (toner, ink) from a FILLED one
       (a waste box), which is worth saying rather than listing a waste container as if it were
       colour. Every field is reported UNINTERPRETED alongside the percentage so a printer that
       does something unexpected can be diagnosed from what it actually said. */
    let descs,levels,maxes,units,classes,types;
    try{
      [descs,levels,maxes,units,classes,types]=await Promise.all([
        walkTable('1.3.6.1.2.1.43.11.1.1.6.1'),
        walkTable('1.3.6.1.2.1.43.11.1.1.9.1'),
        walkTable('1.3.6.1.2.1.43.11.1.1.8.1'),
        walkTable('1.3.6.1.2.1.43.11.1.1.7.1'),
        walkTable('1.3.6.1.2.1.43.11.1.1.4.1'),
        walkTable('1.3.6.1.2.1.43.11.1.1.5.1'),
      ]);
    }finally{ session.close(); }
    if(!descs.length)throw new Error('Printer responded but reported no supply data via the standard Printer-MIB. It may use a different, non-standard status protocol.');
    const num=v=>typeof v==='number'?v:null;
    const supplies=descs.map((d,i)=>{
      const level=num(levels[i]?.value), max=num(maxes[i]?.value);
      const unit=num(units[i]?.value), cls=num(classes[i]?.value), type=num(types[i]?.value);
      const name=d.value?.toString?.()||`Supply ${i+1}`;
      let percent=null, note='';
      if(level===-1){ note='The printer reports this supply as "other" — no level available.'; }
      else if(level===-2){ note='The printer says the level is unknown for this supply.'; }
      else if(level===-3){ note='The printer says some remains but will not say how much. Many lasers only report this until toner runs low.'; }
      else if(level!=null&&level>=0){
        if(unit===19){ percent=Math.max(0,Math.min(100,Math.round(level))); }   // already a percentage
        else if(max!=null&&max>0){ percent=Math.max(0,Math.min(100,Math.round((level/max)*100))); }
        else { note='The printer gave a level but no capacity to measure it against, so no percentage can be worked out.'; }
      }
      return {colourName:name,percent,note,
        /* raw, for diagnosing a printer that behaves unexpectedly */
        rawLevel:level,rawMax:max,unit,supplyClass:cls===3?'consumed':cls===4?'filled':null,supplyType:type};
    });
    return {ok:true,supplies};
  }catch(error){
    nativeLog(`Printer SNMP poll failed: ${error.stack||error}`);
    return {ok:false,error:error.message};
  }
});
ipcMain.handle('printer:checkRecentJobs',async(_event,payload={})=>{
  try{
    if(process.platform!=='win32')throw new Error('Print job detection currently only works on Windows (via the print spooler). Not available on this operating system.');
    const {windowsPrinterName,sinceIso}=payload;
    if(!windowsPrinterName)throw new Error('No Windows printer queue name configured for this printer profile.');
    const {exec}=require('child_process');
    const since=sinceIso?new Date(sinceIso):new Date(Date.now()-24*60*60*1000);
    // Get-PrintJob only reliably shows recent/queued jobs, not full history -- this is a safety
    // net to notice printing happened, not a complete log. PowerShell's -Name here is the
    // Windows printer queue name, which is separate from the printer's IP address.
    const psCmd=`powershell -NoProfile -Command "Get-PrintJob -PrinterName '${windowsPrinterName.replace(/'/g,"''")}' | Select-Object DocumentName,SubmittedTime,TotalPages,JobStatus | ConvertTo-Json"`;
    const result=await new Promise((resolve,reject)=>{
      exec(psCmd,{timeout:10000},(error,stdout,stderr)=>{
        if(error)return reject(new Error(stderr||error.message));
        resolve(stdout);
      });
    });
    let jobs=[];
    try{ const parsed=JSON.parse(result||'[]'); jobs=Array.isArray(parsed)?parsed:(parsed?[parsed]:[]); }catch{ jobs=[]; }
    const recent=jobs.filter(j=>{ const t=j.SubmittedTime?new Date(j.SubmittedTime):null; return t&&t>=since; });
    return {ok:true,jobs:recent.map(j=>({documentName:j.DocumentName,submittedTime:j.SubmittedTime,pages:j.TotalPages,status:j.JobStatus}))};
  }catch(error){
    nativeLog(`Print job detection failed: ${error.stack||error}`);
    return {ok:false,error:error.message};
  }
});
ipcMain.handle('squarespace:adjustInventory',async(_event,payload={})=>{
  try{
    const token=loadSquarespaceToken();
    if(!token)throw new Error('No Squarespace API key is saved.');
    const {variantId,quantity}=payload;
    if(!variantId||quantity===undefined)throw new Error('Missing variant ID or quantity.');
    const body={setFiniteOperations:[{variantId,quantity:Number(quantity)}]};
    const result=await squarespaceRequest('/1.0/commerce/inventory/adjustments',token,{},{method:'POST',body});
    return {ok:true,result};
  }catch(error){
    nativeLog(`Squarespace inventory adjustment failed: ${error.stack||error}`);
    return {ok:false,error:error.message,status:error.status||0};
  }
});
/* g75 SOLD-OUT REPAIR. Third attempt, and this time it stops guessing.
   What we now know for certain from Kirk's store:
     - POST /v2/commerce/products/{p}/variants/{v} with {stock:...} is REJECTED outright:
       "The request body has unknown or readonly fields: [stock]". Stock is not writable there.
     - /1.0/commerce/inventory/adjustments with setUnlimitedOperations as objects returned 2xx and
       changed nothing; as plain strings it errored (and g74 masked that error behind the first).
   So rather than me picking a shape from memory and shipping another dud, this PROBES: it tries
   each known shape on ONE variant, re-reads that variant from Squarespace to see whether it
   actually went unlimited, and only then commits the winning shape to the rest. If none work it
   reports the exact wording Squarespace returned for every attempt, which is the thing I actually
   need to fix it properly. */
async function squarespaceVariantIsUnlimited(variantId,token){
  try{
    const body=await squarespaceRequest(`/1.0/commerce/inventory/${encodeURIComponent(variantId)}`,token);
    const row=(body.inventory||body.result||[])[0]||body;
    return row?(row.isUnlimited===true||row.unlimited===true):null;
  }catch(error){return null;}
}
ipcMain.handle('squarespace:setUnlimitedStock',async(_event,payload={})=>{
  try{
    const token=loadSquarespaceToken();
    if(!token)throw new Error('No Squarespace API key is saved.');
    const rows=(payload.variants||[]).map(v=>({productId:String(v.productId||'').trim(),variantId:String(v.variantId||'').trim()})).filter(v=>v.variantId);
    if(!rows.length)throw new Error('No variants were selected.');
    const post=(body)=>squarespaceRequest('/1.0/commerce/inventory/adjustments',token,{},{method:'POST',body,idempotent:true});
    const SHAPES=[
      {name:'setUnlimitedOperations as objects',build:ids=>({setUnlimitedOperations:ids.map(variantId=>({variantId}))})},
      {name:'setUnlimitedOperations as plain IDs',build:ids=>({setUnlimitedOperations:ids})},
      {name:'setUnlimitedOperations with isUnlimited flag',build:ids=>({setUnlimitedOperations:ids.map(variantId=>({variantId,isUnlimited:true}))})},
      {name:'setFiniteOperations with unlimited flag',build:ids=>({setFiniteOperations:ids.map(variantId=>({variantId,isUnlimited:true}))})}
    ];
    const probeId=rows[0].variantId;
    const attempts=[];let winner=null;
    for(const shape of SHAPES){
      try{await post(shape.build([probeId]));}
      catch(error){attempts.push({shape:shape.name,result:`rejected: ${error.message}`});continue;}
      const state=await squarespaceVariantIsUnlimited(probeId,token);
      if(state===true){winner=shape;attempts.push({shape:shape.name,result:'worked'});break;}
      attempts.push({shape:shape.name,result:state===null?'accepted, but the variant could not be re-read to confirm':'accepted, but the variant is still finite'});
    }
    if(!winner)return {ok:false,error:'Squarespace would not accept any known way of setting unlimited stock.',attempts,probeVariantId:probeId};
    const errors={};
    const rest=rows.slice(1);
    const chunkSize=Math.max(1,Math.min(50,Number(payload.chunkSize)||25));
    for(let i=0;i<rest.length;i+=chunkSize){
      const chunk=rest.slice(i,i+chunkSize).map(r=>r.variantId);
      try{await post(winner.build(chunk));}
      catch(error){
        for(const variantId of chunk){
          try{await post(winner.build([variantId]));}
          catch(inner){errors[variantId]=inner.message;}
        }
      }
    }
    let confirmed=[],unconfirmed=[];
    try{
      const inventory=await squarespacePaginated('/1.0/commerce/inventory',token,'inventory');
      const state={};
      for(const row of inventory){const id=String(row.variantId||row.id||'');if(id)state[id]=(row.isUnlimited===true||row.unlimited===true);}
      for(const r of rows){
        if(state[r.variantId]===true)confirmed.push(r.variantId);
        else unconfirmed.push({variantId:r.variantId,error:errors[r.variantId]||(state[r.variantId]===undefined?'Squarespace did not report this variant back.':'Squarespace still shows a finite stock count for it.')});
      }
    }catch(error){
      return {ok:true,verified:false,attempted:rows.length,shape:winner.name,attempts,confirmed:[],unconfirmed:[],verifyError:error.message};
    }
    return {ok:true,verified:true,attempted:rows.length,shape:winner.name,attempts,confirmed,unconfirmed};
  }catch(error){
    nativeLog(`Squarespace unlimited-stock repair failed: ${error.stack||error}`);
    return {ok:false,error:error.message,status:error.status||0};
  }
});
/* g80 OPTION-NAME REPAIR. Renames a variant's option VALUES so StudioFlow's duplicates fold back
   onto the site's own wording. Writing goes through the product's own variant path -- the same
   call the price update uses -- but `stock` turned out to be readonly there (g74), so `attributes`
   might be too. Rather than assume, this PROBES on one variant and re-reads the product to see
   whether the rename actually took, exactly as the stock repair had to learn to do. */
async function squarespaceFetchProduct(productId,token){
  try{
    const body=await squarespaceRequest(`/v2/commerce/products/${productId}`,token);
    return body?.products?.[0]||body?.product||body||null;
  }catch(error){
    // Some deployments only answer the collection endpoint; fall back to finding it in the list.
    const all=await squarespacePaginated('/v2/commerce/products',token,'products');
    return all.find(p=>String(p.id||p.productId)===String(productId))||null;
  }
}
ipcMain.handle('squarespace:renameVariantOptions',async(_event,payload={})=>{
  try{
    const token=loadSquarespaceToken();
    if(!token)throw new Error('No Squarespace API key is saved.');
    const productId=String(payload.productId||'').trim();
    const changes=(payload.changes||[]).filter(c=>c&&c.variantId&&c.attributes);
    if(!productId)throw new Error('Missing Squarespace product ID.');
    if(!changes.length)throw new Error('No renames were selected.');
    const norm=v=>String(v==null?'':v).trim().toLowerCase();
    const attrsMatch=(live,want)=>!!live&&Object.keys(want).every(k=>norm(live[k])===norm(want[k]));
    const write=c=>squarespaceRequest(`/v2/commerce/products/${productId}/variants/${c.variantId}`,token,{},{method:'POST',body:{attributes:c.attributes}});
    const attempts=[];
    // --- probe on one variant ---
    const probe=changes[0];
    try{await write(probe);}
    catch(error){
      attempts.push({shape:'attributes on the variant',result:`rejected: ${error.message}`});
      return {ok:false,error:'Squarespace would not accept an option-name change on a variant.',attempts};
    }
    let product=await squarespaceFetchProduct(productId,token);
    let live=(product?.variants||[]).find(v=>String(v.id||v.variantId)===String(probe.variantId));
    if(!attrsMatch(live?.attributes,probe.attributes)){
      attempts.push({shape:'attributes on the variant',result:'accepted, but the option value did not change on the store'});
      return {ok:false,error:'Squarespace accepted the change but the option name did not actually change.',attempts};
    }
    attempts.push({shape:'attributes on the variant',result:'worked'});
    // --- commit the rest ---
    const errors={};
    for(const c of changes.slice(1)){
      try{await write(c);}catch(error){errors[c.variantId]=error.message;}
    }
    // --- verify everything against the store ---
    product=await squarespaceFetchProduct(productId,token);
    const byId={};for(const v of (product?.variants||[]))byId[String(v.id||v.variantId)]=v;
    const confirmed=[],unconfirmed=[];
    for(const c of changes){
      if(attrsMatch(byId[String(c.variantId)]?.attributes,c.attributes))confirmed.push(c.variantId);
      else unconfirmed.push({variantId:c.variantId,error:errors[c.variantId]||'Squarespace still shows the old option name.'});
    }
    return {ok:true,verified:true,attempted:changes.length,attempts,confirmed,unconfirmed};
  }catch(error){
    nativeLog(`Squarespace option rename failed: ${error.stack||error}`);
    return {ok:false,error:error.message,status:error.status||0};
  }
});
ipcMain.handle('squarespace:removeVariant',async(_event,payload={})=>{
  try{
    const token=loadSquarespaceToken();
    if(!token)throw new Error('No Squarespace API key is saved.');
    const {productId,variantId}=payload;
    if(!productId||!variantId)throw new Error('Missing Squarespace product or variant ID.');
    await squarespaceRequest(`/v2/commerce/products/${productId}/variants/${variantId}`,token,{},{method:'DELETE'});
    return {ok:true};
  }catch(error){
    nativeLog(`Squarespace variant removal failed: ${error.stack||error}`);
    return {ok:false,error:error.message,status:error.status||0};
  }
});
ipcMain.handle('squarespace:restoreVariant',async(_event,payload={})=>{
  try{
    const token=loadSquarespaceToken();
    if(!token)throw new Error('No Squarespace API key is saved.');
    const {productId,attributes,sku,price,currency}=payload;
    if(!productId||!attributes)throw new Error('Missing Squarespace product ID or the original variant\'s attributes -- restore needs the snapshot captured when it was removed.');
    // g69 STOCK FIX. Squarespace defaults a newly created variant to quantity 0, i.e. SOLD OUT.
    // Every variant StudioFlow pushed before g69 landed on the live store unavailable to buy.
    // Prints are made to order, so unless the caller says otherwise the variant is unlimited.
    const stock=(payload.stock&&typeof payload.stock==='object')?payload.stock:{unlimited:true};
    const body={attributes,sku:sku||undefined,stock,pricing:price!==undefined?{basePrice:{currency:currency||'CAD',value:Number(price).toFixed(2)}}:undefined};
    const result=await squarespaceRequest(`/v2/commerce/products/${productId}/variants`,token,{},{method:'POST',body});
    return {ok:true,variant:result};
  }catch(error){
    nativeLog(`Squarespace variant restore failed: ${error.stack||error}`);
    return {ok:false,error:error.message,status:error.status||0};
  }
});
/* g70 CREATE PRODUCT. Until now StudioFlow could only add variants to a product that already
   existed on Squarespace -- ADD_PRODUCT updates were tracked but never pushable ("a different,
   unbuilt API surface"). This is that surface. Creates the product hidden (isVisible:false) so a
   brand-new piece never appears half-built on the live store; Kirk makes it visible himself once
   the image has landed and it looks right. */
ipcMain.handle('squarespace:createProduct',async(_event,payload={})=>{
  try{
    const token=loadSquarespaceToken();
    if(!token)throw new Error('No Squarespace API key is saved.');
    const {storePageId,name,description,variantAttributes,variants,currency,isVisible,urlSlug,tags}=payload;
    if(!storePageId)throw new Error('No Squarespace store page chosen -- run Website Sync Products first so StudioFlow knows which page your prints live on.');
    if(!name)throw new Error('The piece has no title, so there is nothing to name the product.');
    if(!Array.isArray(variants)||!variants.length)throw new Error('No priced sizes to create. Set prices in Website Pricing first.');
    const body={
      type:'PHYSICAL',
      storePageId,
      name,
      description:description||'',
      isVisible:isVisible===true,
      variantAttributes:Array.isArray(variantAttributes)?variantAttributes:[],
      variants:variants.map(v=>({
        sku:v.sku||undefined,
        attributes:v.attributes||{},
        // Prints are made to order -- never let a new variant be born Sold Out (the g69 lesson).
        stock:(v.stock&&typeof v.stock==='object')?v.stock:{unlimited:true},
        pricing:{basePrice:{currency:currency||'CAD',value:Number(v.price).toFixed(2)}}
      }))
    };
    if(urlSlug)body.urlSlug=urlSlug;
    if(Array.isArray(tags)&&tags.length)body.tags=tags;
    const result=await squarespaceRequest('/v2/commerce/products',token,{},{method:'POST',body});
    return {ok:true,product:result};
  }catch(error){
    nativeLog(`Squarespace product create failed: ${error.stack||error}`);
    return {ok:false,error:error.message,status:error.status||0};
  }
});
/* Product images are a separate multipart upload, not part of the create body. Squarespace accepts
   the file and processes it asynchronously, so a 202 with an id is success. The image may live in
   the DB as a data URL, on disk as a path, or as a remote URL -- handle all three. */
ipcMain.handle('squarespace:uploadProductImage',async(_event,payload={})=>{
  try{
    const token=loadSquarespaceToken();
    if(!token)throw new Error('No Squarespace API key is saved.');
    const {productId,image,filename}=payload;
    if(!productId)throw new Error('No Squarespace product ID to attach the image to.');
    if(!image)throw new Error('This piece has no image saved, so there was nothing to upload.');
    let buffer=null,type='image/jpeg';
    const src=String(image);
    if(/^data:/i.test(src)){
      const m=src.match(/^data:([^;,]+)[^,]*,(.*)$/s);
      if(!m)throw new Error('The saved image is not in a format StudioFlow can read.');
      type=m[1]||type; buffer=Buffer.from(m[2],'base64');
    }else if(/^https?:\/\//i.test(src)){
      const r=await fetch(src);
      if(!r.ok)throw new Error(`Could not download the image (${r.status}).`);
      type=r.headers.get('content-type')||type;
      buffer=Buffer.from(await r.arrayBuffer());
    }else{
      if(!fs.existsSync(src))throw new Error(`The image file is missing from disk:\n${src}`);
      buffer=fs.readFileSync(src);
      const ext=path.extname(src).toLowerCase();
      type=ext==='.png'?'image/png':ext==='.webp'?'image/webp':ext==='.gif'?'image/gif':'image/jpeg';
    }
    const form=new FormData();
    form.append('file',new Blob([buffer],{type}),filename||`artwork${type==='image/png'?'.png':'.jpg'}`);
    const response=await fetch(`https://api.squarespace.com/v2/commerce/products/${productId}/images`,{
      method:'POST',
      headers:{Authorization:`Bearer ${token}`,'User-Agent':'StudioFlow/11.4.2'},
      body:form
    });
    const text=await response.text();
    let out={}; try{out=text?JSON.parse(text):{}}catch{out={message:text}}
    if(!response.ok)throw new Error(out?.message||out?.error||`Image upload failed (${response.status})`);
    return {ok:true,image:out};
  }catch(error){
    nativeLog(`Squarespace product image upload failed: ${error.stack||error}`);
    return {ok:false,error:error.message,status:error.status||0};
  }
});
ipcMain.handle('squarespace:updateVariantPrice',async(_event,payload={})=>{
  try{
    const token=loadSquarespaceToken();
    if(!token)throw new Error('No Squarespace API key is saved.');
    const {productId,variantId,price,currency}=payload;
    if(!productId||!variantId)throw new Error('Missing Squarespace product or variant ID -- run Sync Products first so StudioFlow knows the real IDs.');
    const body={pricing:{basePrice:{currency:currency||'CAD',value:Number(price).toFixed(2)}}};
    const result=await squarespaceRequest(`/v2/commerce/products/${productId}/variants/${variantId}`,token,{},{method:'POST',body});
    return {ok:true,variant:result};
  }catch(error){
    nativeLog(`Squarespace price update failed: ${error.stack||error}`);
    return {ok:false,error:error.message,status:error.status||0};
  }
});
ipcMain.handle('squarespace:syncOrders',async(_event,payload={})=>{
  try{const token=loadSquarespaceToken();if(!token)throw new Error('No Squarespace API key is saved.');const query={};if(payload.modifiedAfter)query.modifiedAfter=payload.modifiedAfter;if(payload.modifiedBefore)query.modifiedBefore=payload.modifiedBefore;if(payload.fulfillmentStatus)query.fulfillmentStatus=payload.fulfillmentStatus;if(payload.paymentStates)query.paymentStates=payload.paymentStates;const orders=await squarespacePaginated('/1.0/commerce/orders',token,'result',query);return{ok:true,orders,syncedAt:new Date().toISOString()};}
  catch(error){nativeLog(`Squarespace order sync failed: ${error.stack||error}`);return{ok:false,error:error.message,status:error.status||0}}
});



/* StudioFlow 11.5.3 · Google Analytics OAuth + live reporting */
const GA_SECRET_FILE = 'studioflow-google-analytics.json';
const gaSecretPath = () => path.join(app.getPath('userData'), GA_SECRET_FILE);
function gaWriteSecret(data){
  const raw=JSON.stringify(data||{}); let payload={encrypted:false,value:raw};
  if(safeStorage.isEncryptionAvailable()) payload={encrypted:true,value:safeStorage.encryptString(raw).toString('base64')};
  fs.writeFileSync(gaSecretPath(),JSON.stringify(payload),'utf8');
}
function gaReadSecret(){
  try{if(!fs.existsSync(gaSecretPath()))return {};const payload=JSON.parse(fs.readFileSync(gaSecretPath(),'utf8'));const raw=payload.encrypted?safeStorage.decryptString(Buffer.from(payload.value,'base64')):payload.value;return JSON.parse(raw||'{}')}catch(error){nativeLog(`GA credential read failed: ${error.message}`);return {}}
}
function gaClientFromJson(body){
  const c=body?.installed||body?.web||body;
  if(!c?.client_id||!c?.client_secret)throw new Error('This is not a valid Google OAuth client JSON file.');
  return {clientId:c.client_id,clientSecret:c.client_secret,projectId:c.project_id||'',redirectUris:c.redirect_uris||[]};
}
async function gaRefresh(secret){
  if(!secret?.tokens?.refresh_token)throw new Error('Google Analytics is not connected.');
  if(secret.tokens.access_token && Number(secret.tokens.expires_at||0)>Date.now()+60000)return secret.tokens.access_token;
  const body=new URLSearchParams({client_id:secret.client.clientId,client_secret:secret.client.clientSecret,refresh_token:secret.tokens.refresh_token,grant_type:'refresh_token'});
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  const j=await r.json();if(!r.ok)throw new Error(j.error_description||j.error||'Google token refresh failed.');
  secret.tokens={...secret.tokens,...j,expires_at:Date.now()+Number(j.expires_in||3600)*1000};gaWriteSecret(secret);return secret.tokens.access_token;
}
async function gaFetch(url,options={}){const secret=gaReadSecret();const token=await gaRefresh(secret);const r=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(options.headers||{})}});const text=await r.text();let j={};try{j=text?JSON.parse(text):{}}catch{j={message:text}}if(!r.ok)throw new Error(j.error?.message||j.message||`Google Analytics request failed (${r.status}).`);return j}
ipcMain.handle('ga:importCredentials',async()=>{try{const result=await dialog.showOpenDialog(mainWindow,{properties:['openFile'],title:'Choose Google OAuth credentials',filters:[{name:'Google OAuth JSON',extensions:['json']}]});if(result.canceled||!result.filePaths[0])return null;const body=JSON.parse(fs.readFileSync(result.filePaths[0],'utf8'));const client=gaClientFromJson(body),old=gaReadSecret();gaWriteSecret({...old,client});return{ok:true,projectId:client.projectId,encrypted:safeStorage.isEncryptionAvailable()}}catch(error){return{ok:false,error:error.message}}});
ipcMain.handle('ga:status',()=>{const s=gaReadSecret();return{credentials:!!s.client?.clientId,connected:!!s.tokens?.refresh_token,projectId:s.client?.projectId||'',encrypted:safeStorage.isEncryptionAvailable()}});
ipcMain.handle('ga:disconnect',()=>{try{if(fs.existsSync(gaSecretPath()))fs.unlinkSync(gaSecretPath());return{ok:true}}catch(error){return{ok:false,error:error.message}}});
ipcMain.handle('ga:connect',async()=>{try{
  const secret=gaReadSecret();if(!secret.client?.clientId)throw new Error('Import the Google OAuth credentials JSON first.');
  const state=crypto.randomBytes(20).toString('hex');let resolveCode,rejectCode;const codePromise=new Promise((res,rej)=>{resolveCode=res;rejectCode=rej});
  const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1');if(u.pathname!='/oauth2callback')return;if(u.searchParams.get('state')!==state)throw new Error('OAuth state did not match.');const err=u.searchParams.get('error');if(err)throw new Error(err);const code=u.searchParams.get('code');res.writeHead(200,{'Content-Type':'text/html'});res.end('<h2>StudioFlow is connected.</h2><p>You may close this window and return to StudioFlow.</p>');resolveCode(code)}catch(e){rejectCode(e)}});
  await new Promise((res,rej)=>server.listen(0,'127.0.0.1',e=>e?rej(e):res()));const port=server.address().port;const redirect=`http://127.0.0.1:${port}/oauth2callback`;
  const auth=new URL('https://accounts.google.com/o/oauth2/v2/auth');auth.searchParams.set('client_id',secret.client.clientId);auth.searchParams.set('redirect_uri',redirect);auth.searchParams.set('response_type','code');auth.searchParams.set('scope','https://www.googleapis.com/auth/analytics.readonly');auth.searchParams.set('access_type','offline');auth.searchParams.set('prompt','consent');auth.searchParams.set('state',state);await shell.openExternal(auth.toString());
  const timer=setTimeout(()=>rejectCode(new Error('Google sign-in timed out.')),180000);const code=await codePromise;clearTimeout(timer);server.close();
  const body=new URLSearchParams({code,client_id:secret.client.clientId,client_secret:secret.client.clientSecret,redirect_uri:redirect,grant_type:'authorization_code'});const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});const j=await r.json();if(!r.ok)throw new Error(j.error_description||j.error||'Google sign-in failed.');secret.tokens={...j,expires_at:Date.now()+Number(j.expires_in||3600)*1000};gaWriteSecret(secret);return{ok:true};
}catch(error){nativeLog(`GA connect failed: ${error.stack||error}`);return{ok:false,error:error.message}}});
ipcMain.handle('ga:listProperties',async()=>{try{const j=await gaFetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200');const properties=[];(j.accountSummaries||[]).forEach(a=>(a.propertySummaries||[]).forEach(x=>properties.push({id:String(x.property||'').replace('properties/',''),name:x.displayName||x.property,account:a.displayName||''})));return{ok:true,properties}}catch(error){return{ok:false,error:error.message}}});
ipcMain.handle('ga:sync',async(_event,payload={})=>{try{const propertyId=String(payload.propertyId||'').replace(/\D/g,'');if(!propertyId)throw new Error('Select a Google Analytics property first.');const endpoint=`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;const run=body=>gaFetch(endpoint,{method:'POST',body:JSON.stringify(body)});const dateRanges=[{startDate:payload.startDate||'30daysAgo',endDate:payload.endDate||'today'}];
  const totals=await run({dateRanges,metrics:[{name:'activeUsers'},{name:'newUsers'},{name:'sessions'},{name:'screenPageViews'},{name:'averageSessionDuration'},{name:'engagementRate'}]});
  const sources=await run({dateRanges,dimensions:[{name:'sessionDefaultChannelGroup'}],metrics:[{name:'sessions'}],limit:10,orderBys:[{metric:{metricName:'sessions'},desc:true}]});
  const pages=await run({dateRanges,dimensions:[{name:'pageTitle'},{name:'pagePath'}],metrics:[{name:'screenPageViews'},{name:'activeUsers'}],limit:100,orderBys:[{metric:{metricName:'screenPageViews'},desc:true}]});
  const countries=await run({dateRanges,dimensions:[{name:'country'}],metrics:[{name:'activeUsers'}],limit:10,orderBys:[{metric:{metricName:'activeUsers'},desc:true}]});
  const vals=totals.rows?.[0]?.metricValues?.map(x=>Number(x.value||0))||[];return{ok:true,syncedAt:new Date().toISOString(),analytics:{visitors:vals[0]||0,newUsers:vals[1]||0,visits:vals[2]||0,pageViews:vals[3]||0,avgDuration:vals[4]||0,engagementRate:(vals[5]||0)*100,bounceRate:100-(vals[5]||0)*100,sources:(sources.rows||[]).map(r=>({name:r.dimensionValues?.[0]?.value||'Unknown',value:Number(r.metricValues?.[0]?.value||0)})),pages:(pages.rows||[]).map(r=>({title:r.dimensionValues?.[0]?.value||'',path:r.dimensionValues?.[1]?.value||'',views:Number(r.metricValues?.[0]?.value||0),users:Number(r.metricValues?.[1]?.value||0)})),countries:(countries.rows||[]).map(r=>({name:r.dimensionValues?.[0]?.value||'Unknown',value:Number(r.metricValues?.[0]?.value||0)}))}}}catch(error){nativeLog(`GA sync failed: ${error.stack||error}`);return{ok:false,error:error.message}}});

ipcMain.handle('cull:chooseFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties:['openDirectory'], title:'Choose a photo shoot folder' });
  if (result.canceled || !result.filePaths[0]) return null;
  const folder = result.filePaths[0];
  const files = fs.readdirSync(folder, {withFileTypes:true})
    .filter(entry => entry.isFile() && CULL_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map(entry => {
      const filePath=path.join(folder,entry.name); const stat=fs.statSync(filePath);
      return {path:filePath,name:entry.name,extension:path.extname(entry.name).slice(1).toUpperCase(),size:stat.size,modified:stat.mtime.toISOString()};
    }).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
  return {folder,files};
});

/* ==========================================================================================
   g164 — THE LENS, FOR THE WALL MEASURING TOOL.
   ==========================================================================================
   A wall photographed with a LEVEL camera keeps its vertical edges parallel, and four corners
   then cannot give the focal length — that is geometry, not a shortcoming (see
   modules/wall-perspective.js). One number closes it, and the photograph is usually carrying it
   already: phones write the 35mm-EQUIVALENT focal length, which needs no sensor size because it
   IS normalised to a 36mm frame.

   Deliberately separate from cull:metadata, which returns DISPLAY STRINGS ("ISO 400", "f/2.8").
   This returns NUMBERS, because they are about to be used in arithmetic — parsing "26.0 mm" back
   out of a caption would be a silent source of wrong answers.
   ========================================================================================== */
ipcMain.handle('image:lensInfo', async (_event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return { ok: false, error: 'That image is not on disk.' };
    const tool = getExifTool();
    if (!tool) return { ok: false, error: 'The EXIF reader is not available in this build.' };
    const t = await tool.read(filePath);
    const num = v => { const n = Number(v); return isFinite(n) && n > 0 ? n : null; };
    const width = num(t.ImageWidth) || num(t.ExifImageWidth);
    const eq35 = num(t.FocalLengthIn35mmFormat) || num(t.FocalLengthIn35mmFilm);
    /* FocalLength often reads "5.1 mm" rather than a bare number. */
    const focal = num(t.FocalLength) || num(String(t.FocalLength || '').replace(/[^\d.]/g, ''));
    return { ok: true, width, height: num(t.ImageHeight) || num(t.ExifImageHeight),
      focalLength: focal, focalLength35: eq35,
      make: String(t.Make || ''), model: String(t.Model || ''),
      /* Said plainly so the page can explain WHY it cannot help rather than just failing. */
      note: eq35 ? '' : (focal ? 'This photograph records a focal length but not the 35mm equivalent, and the sensor size is not in the file.' : 'This photograph carries no focal length \u2014 it may have been edited, exported or screenshotted, which usually strips EXIF.') };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('cull:metadata', async (_event, filePath) => {
  try {
    if(!filePath || !fs.existsSync(filePath)) return {};
    const tool=getExifTool();
    if(!tool) return {};
    const t=await tool.read(filePath);
    const exposure=t.ExposureTime || t.ShutterSpeed || '';
    return {
      camera:[t.Make,t.Model].filter(Boolean).join(' '),
      lens:t.LensModel || t.Lens || '',
      exposure:exposure ? String(exposure) : '',
      aperture:t.FNumber ? `f/${t.FNumber}` : (t.Aperture ? `f/${t.Aperture}` : ''),
      iso:t.ISO ? `ISO ${t.ISO}` : '',
      focalLength:t.FocalLength ? String(t.FocalLength) : '',
      dimensions:(t.ImageWidth&&t.ImageHeight)?`${t.ImageWidth} × ${t.ImageHeight}`:'',
      orientation:String(t.Orientation||''),
      captured:t.DateTimeOriginal ? String(t.DateTimeOriginal) : ''
    };
  } catch(error){ nativeLog(`Cull metadata failed for ${filePath}: ${error?.stack||error}`); return {}; }
});

ipcMain.handle('cull:thumbnail', async (_event, filePath) => {
  const stages=[];
  const stage=(name,status,detail='')=>{stages.push({name,status,detail});nativeLog(`Cull preview ${status.toUpperCase()} · ${name}${detail?` · ${detail}`:''} · ${filePath}`)};
  const resultError=(message)=>({ok:false,error:message,stages});
  const imagePayload=(buffer,source)=>{
    try{
      stage('Preview bytes received','ok',`${buffer.length} bytes`);
      const image=nativeImage.createFromBuffer(buffer);
      if(!image || image.isEmpty()){
        stage('JPEG validation','failed','Electron nativeImage rejected the extracted bytes');
        return resultError('A preview was extracted, but Electron could not decode it as an image.');
      }
      const size=image.getSize();
      stage('JPEG validation','ok',`${size.width} × ${size.height}`);

      // Do not send multi-megabyte RAW previews through IPC as base64. Write the
      // validated JPEG to StudioFlow's temporary preview cache and let Chromium
      // load it as a normal file URL. This is the same reliable display path used
      // for ordinary local images and keeps the original RAW file untouched.
      const output=rawPreviewCachePath(filePath,'.viewer.jpg');
      fs.writeFileSync(output,buffer);
      const maxDisplay=1600;
      const scale=Math.min(1,maxDisplay/Math.max(size.width,size.height));
      const displayImage=scale<1?image.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale)),quality:'best'}):image;
      const displayJpeg=displayImage.toJPEG(84);
      const thumbSize=displayImage.getSize();
      const thumbScale=Math.min(1,240/Math.max(thumbSize.width,thumbSize.height));
      const thumbnailImage=thumbScale<1?displayImage.resize({width:Math.max(1,Math.round(thumbSize.width*thumbScale)),height:Math.max(1,Math.round(thumbSize.height*thumbScale)),quality:'good'}):displayImage;
      const data=`data:image/jpeg;base64,${displayJpeg.toString('base64')}`;
      const thumbnailData=`data:image/jpeg;base64,${thumbnailImage.toJPEG(76).toString('base64')}`;
      stage('Temporary preview file','ok',`${path.basename(output)} · ${fs.statSync(output).size} bytes`);
      stage('Renderer payload','ok',`In-memory JPEG prepared · ${displayJpeg.length} bytes`);
      return {ok:true,data,thumbnailData,previewPath:output,mime:'image/jpeg',size:displayImage.getSize(),source,stages};
    }catch(error){
      stage('Renderer payload','failed',error.message);
      return resultError(`Preview conversion failed: ${error.message}`);
    }
  };
  try {
    stage('File selected','ok',path.basename(filePath));
    if(!filePath || !fs.existsSync(filePath)){
      stage('File exists','failed','File not found');
      return resultError('The selected file no longer exists.');
    }
    const stat=fs.statSync(filePath);
    stage('File exists','ok',`${stat.size} bytes`);
    const ext=path.extname(filePath).toLowerCase();
    stage('File type detected','ok',ext||'unknown');
    const rawExtensions=new Set(['.cr3','.cr2','.nef','.arw','.orf','.rw2','.raf','.dng']);
    const isRaw=rawExtensions.has(ext);

    // Primary path on Windows: call IShellItemImageFactory directly. This is
    // the same Windows Shell thumbnail-provider route used by File Explorer.
    if(process.platform==='win32'){
      stage('Windows Explorer thumbnail provider','running','Calling IShellItemImageFactory');
      try{
        const shellOutput=await createWindowsShellThumbnail(filePath,1600);
        if(shellOutput){
          const png=fs.readFileSync(shellOutput);
          const image=nativeImage.createFromBuffer(png);
          if(image && !image.isEmpty()){
            const size=image.getSize();
            stage('Windows Explorer thumbnail provider','ok',`${size.width} × ${size.height}`);
            const maxDisplay=1600;
            const scale=Math.min(1,maxDisplay/Math.max(size.width,size.height));
            const displayImage=scale<1?image.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale)),quality:'best'}):image;
            const displaySize=displayImage.getSize();
            const thumbScale=Math.min(1,240/Math.max(displaySize.width,displaySize.height));
            const thumbnailImage=thumbScale<1?displayImage.resize({width:Math.max(1,Math.round(displaySize.width*thumbScale)),height:Math.max(1,Math.round(displaySize.height*thumbScale)),quality:'good'}):displayImage;
            const displayJpeg=displayImage.toJPEG(84);
            const data=`data:image/jpeg;base64,${displayJpeg.toString('base64')}`;
            const thumbnailData=`data:image/jpeg;base64,${thumbnailImage.toJPEG(76).toString('base64')}`;
            stage('Temporary preview file','ok',`${path.basename(shellOutput)} · ${png.length} bytes`);
            stage('Renderer payload','ok','In-memory image prepared');
            return {ok:true,data,thumbnailData,previewPath:shellOutput,mime:'image/jpeg',size:displaySize,source:'windows-shell-ishellitemimagefactory',stages};
          }
          stage('Windows Explorer thumbnail provider','failed','Shell PNG could not be decoded by Electron');
        }else{
          stage('Windows Explorer thumbnail provider','failed','Windows returned no usable Shell thumbnail');
        }
      }catch(error){
        stage('Windows Explorer thumbnail provider','failed',error.message||String(error));
        nativeLog(`Windows Shell preview failed for ${filePath}: ${error?.stack||error}`);
      }
    }else{
      stage('Windows Explorer thumbnail provider','skipped','Available only in the Windows desktop build');
    }

    // Standard image formats can still use Electron's system decoder if the
    // Windows Shell route was unavailable.
    if(!isRaw){
      stage('System image decoder','running');
      const image=await nativeImage.createThumbnailFromPath(filePath,{width:2600,height:1800});
      if(!image || image.isEmpty()){
        stage('System image decoder','failed','No image returned');
        return resultError(`Preview unavailable for ${path.basename(filePath)}.`);
      }
      stage('System image decoder','ok',`${image.getSize().width} × ${image.getSize().height}`);
      const previewUrl=pathToFileURL(filePath).href;
      stage('Renderer payload','ok','Original local image URL prepared');
      return {ok:true,previewUrl,previewPath:filePath,size:image.getSize(),source:'system-codec',stages};
    }

    stage('RAW fallback pipeline','ok','Windows Shell preview was unavailable; trying embedded-preview fallbacks');
    const stem=filePath.slice(0,-ext.length);
    const sidecar=['.jpg','.jpeg','.JPG','.JPEG'].map(x=>stem+x).find(fs.existsSync);
    if(sidecar){
      stage('JPEG sidecar search','ok',path.basename(sidecar));
      return imagePayload(fs.readFileSync(sidecar),'jpeg-sidecar');
    }
    stage('JPEG sidecar search','skipped','No matching sidecar');

    stage('Embedded JPEG scan','running');
    const scanned=extractLargestEmbeddedJpeg(filePath);
    if(scanned){
      const candidate=Buffer.from(scanned.jpeg);
      const checked=imagePayload(candidate,'direct-raw-jpeg-scan');
      if(checked.ok){
        stage('Embedded JPEG scan','ok',`${scanned.size?.width||'?'} × ${scanned.size?.height||'?'}`);
        checked.stages=stages;
        return checked;
      }
      stage('Embedded JPEG scan','failed','Candidate JPEG was not renderable; continuing to ExifTool');
    }else stage('Embedded JPEG scan','failed','No complete embedded JPEG found');

    const output=rawPreviewCachePath(filePath,'.jpg');
    const validJpegFile=f=>{
      try{
        const b=fs.readFileSync(f);
        if(b.length<=1024 || b[0]!==0xff || b[1]!==0xd8) return false;
        const img=nativeImage.createFromBuffer(b);
        return img && !img.isEmpty();
      }catch{return false}
    };
    if(validJpegFile(output)){
      stage('Preview cache','ok',path.basename(output));
      return imagePayload(fs.readFileSync(output),'cached-embedded-jpeg');
    }
    stage('Preview cache','skipped','No valid cached preview');
    try{if(fs.existsSync(output))fs.unlinkSync(output)}catch{}

    const executable=findBundledExifTool();
    if(!executable){
      stage('ExifTool decoder','failed','Bundled executable not found');
      return resultError('The bundled CR3 decoder is missing from this StudioFlow folder.');
    }
    stage('ExifTool decoder','ok',path.basename(executable));
    let extractedTag='';
    for(const tag of ['JpgFromRaw','PreviewImage','OtherImage','ThumbnailImage']){
      stage(`Extract ${tag}`,'running');
      const ok=await new Promise(resolve=>{
        const chunks=[];let stderr='',settled=false;
        const finish=v=>{if(!settled){settled=true;resolve(v)}};
        try{
          const child=spawn(executable,['-b',`-${tag}`,filePath],{windowsHide:true,stdio:['ignore','pipe','pipe']});
          const timer=setTimeout(()=>{try{child.kill()}catch{};finish(null)},45000);
          child.stdout.on('data',d=>chunks.push(d));
          child.stderr.on('data',d=>stderr+=d.toString());
          child.on('error',e=>{clearTimeout(timer);nativeLog(`CR3 ${tag} launch error: ${e.message}`);finish(null)});
          child.on('close',code=>{
            clearTimeout(timer);
            const buffer=Buffer.concat(chunks);
            if(code===0 && buffer.length>1024){
              const img=nativeImage.createFromBuffer(buffer);
              if(img && !img.isEmpty()) return finish(buffer);
            }
            nativeLog(`CR3 ${tag} failed. Exit ${code}. ${stderr.trim()}`);
            finish(null);
          });
        }catch(e){nativeLog(`CR3 ${tag} exception: ${e.message}`);finish(null)}
      });
      if(ok){
        extractedTag=tag;
        fs.writeFileSync(output,ok);
        stage(`Extract ${tag}`,'ok',`${ok.length} bytes`);
        break;
      }
      stage(`Extract ${tag}`,'failed','No renderable JPEG returned');
    }
    if(!extractedTag){
      stage('RAW preview complete','failed','All extraction methods failed');
      return resultError('StudioFlow found the RAW file but could not extract a renderable embedded preview.');
    }
    stage('RAW preview complete','ok',extractedTag);
    return imagePayload(fs.readFileSync(output),`exiftool-${extractedTag}`);
  } catch(error){
    stage('Unexpected preview error','failed',error?.message||String(error));
    nativeLog(`Cull thumbnail error for ${filePath}: ${error?.stack||error}`);
    return resultError(error.message);
  }
});

ipcMain.handle('cull:openFile', async (_event, filePath) => {
  try { const error=await shell.openPath(filePath); return error?{ok:false,error}:{ok:true}; }
  catch(error){ return {ok:false,error:error.message}; }
});

function uniqueDestination(folder, name){
  let target=path.join(folder,name); if(!fs.existsSync(target)) return target;
  const ext=path.extname(name), stem=path.basename(name,ext); let i=2;
  while(fs.existsSync(target)) target=path.join(folder,`${stem} (${i++})${ext}`);
  return target;
}

ipcMain.handle('cull:organize', async (_event, payload={}) => {
  const sourceFolder=payload.folder; const ratings=payload.ratings||{}; const mode=payload.mode==='move'?'move':'copy';
  const deleteNo=payload.deleteNo===true; if(!sourceFolder || !fs.existsSync(sourceFolder)) return {ok:false,error:'Shoot folder not found'};
  const yesFolder=path.join(sourceFolder,'YES'); const maybeFolder=path.join(sourceFolder,'MAYBE');
  fs.mkdirSync(yesFolder,{recursive:true}); fs.mkdirSync(maybeFolder,{recursive:true});
  const result={yes:0,maybe:0,no:0,errors:[]};
  for(const [filePath,rating] of Object.entries(ratings)){
    try{
      if(!fs.existsSync(filePath)) continue;
      if(rating==='yes'||rating==='maybe'){
        const dir=rating==='yes'?yesFolder:maybeFolder; const dest=uniqueDestination(dir,path.basename(filePath));
        if(mode==='move') fs.renameSync(filePath,dest); else fs.copyFileSync(filePath,dest);
        result[rating]++;
      } else if(rating==='no' && deleteNo){ await shell.trashItem(filePath); result.no++; }
    }catch(error){result.errors.push(`${path.basename(filePath)}: ${error.message}`)}
  }
  return {ok:result.errors.length===0,...result,yesFolder,maybeFolder};
});

ipcMain.handle('cull:openFolder', async (_event, folderPath) => shell.openPath(folderPath));
ipcMain.handle('cull:openInLightroom', async (_event, folderPath) => {
  try {
    const roots=[process.env.ProgramFiles,process.env['ProgramFiles(x86)']].filter(Boolean),candidates=[];
    for(const root of roots){const adobe=path.join(root,'Adobe');if(!fs.existsSync(adobe))continue;for(const name of fs.readdirSync(adobe).filter(n=>/^Adobe Lightroom Classic/i.test(n)).sort().reverse())candidates.push(path.join(adobe,name,'Lightroom.exe'));}
    const exe=candidates.find(fs.existsSync);if(!exe)return {ok:false,error:'Adobe Lightroom Classic was not found in the standard Adobe installation folders.'};
    spawn(exe,[],{detached:true,stdio:'ignore'}).unref();await shell.openPath(folderPath);return {ok:true,exe,folderPath};
  }catch(error){return {ok:false,error:error.message}}
});

/* ── StudioFlow g87 · OpenAI image generation ─────────────────────────────────
   The AI Art Creation page used to compose a prompt for Kirk to copy elsewhere.
   This is the first real image-generation call StudioFlow makes.

   Endpoint: POST https://api.openai.com/v1/images/edits (multipart), because the artwork is sent
   as a REFERENCE IMAGE -- that is what makes the print in the generated room Kirk's actual
   photograph rather than the model's guess at it. Generations (no reference) is used only when
   there is no artwork to send.

   Facts checked against OpenAI's docs on 2026-08-06, not from memory:
     · models gpt-image-2 (current), gpt-image-1.5, gpt-image-1, gpt-image-1-mini
     · gpt-image-2 always processes image inputs at HIGH fidelity, and input_fidelity must be
       OMITTED for it -- sending it is an error
     · response is base64 in data[0].b64_json, never a URL
     · size edges must be multiples of 16, max edge 3840, long:short ratio <= 3:1
     · GPT Image models need API Organization Verification on the OpenAI account first
     · a complex prompt can take up to 2 minutes, hence the long timeout below
     · moderation refusals arrive as error.code 'moderation_blocked'

   IMPORTANT: this could not be run against the live API from the build container (no network), so
   every failure returns OpenAI's OWN error text verbatim in `error` plus `raw` -- the same
   probe-and-report discipline that eventually fixed the Squarespace stock writes after three
   builds of guessing. Do not paraphrase these errors in the UI. */
const OPENAI_SECRET_FILE = 'studioflow-openai-credentials.json';
const openaiSecretPath = () => path.join(app.getPath('userData'), OPENAI_SECRET_FILE);
function saveOpenAiToken(token){
  const value=String(token||'').trim();
  if(!value) throw new Error('Enter an OpenAI API key.');
  let payload={encrypted:false,value};
  if(safeStorage.isEncryptionAvailable()){
    payload={encrypted:true,value:safeStorage.encryptString(value).toString('base64')};
  }
  fs.writeFileSync(openaiSecretPath(),JSON.stringify(payload),'utf8');
  return true;
}
function loadOpenAiToken(){
  try{
    if(!fs.existsSync(openaiSecretPath())) return '';
    const payload=JSON.parse(fs.readFileSync(openaiSecretPath(),'utf8'));
    if(payload.encrypted) return safeStorage.decryptString(Buffer.from(payload.value,'base64'));
    return String(payload.value||'');
  }catch(error){ nativeLog(`OpenAI credential read failed: ${error.message}`); return ''; }
}
ipcMain.handle('ai:saveKey',async(_event,payload={})=>{
  try{ saveOpenAiToken(payload.apiKey); return {ok:true}; }
  catch(error){ return {ok:false,error:error.message}; }
});
ipcMain.handle('ai:keyStatus',()=>({configured:!!loadOpenAiToken(),encrypted:safeStorage.isEncryptionAvailable()}));
ipcMain.handle('ai:clearKey',()=>{
  try{ if(fs.existsSync(openaiSecretPath())) fs.unlinkSync(openaiSecretPath()); return {ok:true}; }
  catch(error){ return {ok:false,error:error.message}; }
});

// Turn whatever the renderer has for the artwork -- a data URL or a path on disk -- into bytes.
/* g93: this handled data: URLs and disk paths only. Many of Kirk's artworks carry a Squarespace
   CDN https URL as their image, so this returned null, the caller quietly fell through to the
   no-reference endpoint, and he paid for a room containing an invented picture. Fetch http(s) too. */
async function aiReferenceBytes(ref){
  const src=String(ref||'');
  if(!src) return null;
  if(/^https?:\/\//i.test(src)){
    const res=await fetch(src);
    if(!res.ok) throw new Error(`The artwork image could not be downloaded from ${src} (HTTP ${res.status}).`);
    const type=res.headers.get('content-type')||'image/jpeg';
    if(!/^image\//i.test(type)) throw new Error(`The artwork URL returned ${type}, not an image.`);
    return {buffer:Buffer.from(await res.arrayBuffer()),type:type.split(';')[0].trim()};
  }
  if(/^data:/i.test(src)){
    const comma=src.indexOf(',');
    const meta=src.slice(5,comma);
    const type=(meta.split(';')[0]||'image/png').trim();
    return {buffer:Buffer.from(src.slice(comma+1),'base64'),type};
  }
  if(fs.existsSync(src)){
    const ext=path.extname(src).toLowerCase();
    const type=ext==='.jpg'||ext==='.jpeg'?'image/jpeg':ext==='.webp'?'image/webp':'image/png';
    return {buffer:fs.readFileSync(src),type};
  }
  return null;
}

ipcMain.handle('ai:generateRoom',async(_event,payload={})=>{
  const started=Date.now();
  try{
    const token=loadOpenAiToken();
    if(!token) throw new Error('No OpenAI API key is saved. Add one under Connect OpenAI on the AI Art Creation page.');
    const prompt=String(payload.prompt||'').trim();
    if(!prompt) throw new Error('There is nothing to generate from -- the prompt is empty.');
    const model=String(payload.model||'gpt-image-2');
    const size=String(payload.size||'1536x1024');
    const quality=String(payload.quality||'medium');

    /* g93 — THE IMPORTANT HALF. Previously, if a reference was requested but could not be read,
       this silently fell through to /images/generations and produced a room containing an invented
       artwork. Kirk got a render with someone else's picture on the wall and was billed for it.
       Failing to attach the artwork is now a hard error: the whole point of this page is that the
       print on the wall is HIS. Only a request that never had an artwork may use generations. */
    const wanted=String(payload.referenceImage||'').trim();
    const ref=await aiReferenceBytes(payload.referenceImage);
    if(wanted&&!ref){
      return {ok:false,status:0,
        error:`The artwork could not be read, so nothing was generated — a render without your photograph would be worthless. StudioFlow could not load: ${wanted.slice(0,200)}`,
        code:'reference_unreadable'};
    }
    let url,fetchOpts;
    if(ref){
      // Reference-image path: the real photograph goes in, so the print on the wall is his.
      const form=new FormData();
      form.append('model',model);
      form.append('prompt',prompt);
      form.append('size',size);
      form.append('quality',quality);
      form.append('n','1');
      // input_fidelity is REJECTED by gpt-image-2 (it is always high) and only sent for older models.
      if(!/^gpt-image-2/.test(model)) form.append('input_fidelity','high');
      form.append('image[]',new Blob([ref.buffer],{type:ref.type}),'artwork.png');
      url='https://api.openai.com/v1/images/edits';
      fetchOpts={method:'POST',headers:{Authorization:`Bearer ${token}`},body:form};
    }else{
      url='https://api.openai.com/v1/images/generations';
      fetchOpts={method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({model,prompt,size,quality,n:1})};
    }

    // Complex prompts are documented as taking up to two minutes; allow well past that.
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),240000);
    let response,text;
    try{
      response=await fetch(url,Object.assign({signal:controller.signal},fetchOpts));
      text=await response.text();
    }finally{ clearTimeout(timer); }

    let body={};
    try{ body=JSON.parse(text); }catch(_){ body={}; }
    if(!response.ok){
      const err=body.error||{};
      nativeLog(`OpenAI image generation failed (${response.status}): ${text.slice(0,2000)}`);
      return {ok:false,status:response.status,
        // OpenAI's own wording, unedited -- a summarised error is what wasted three builds on the
        // Squarespace writes.
        error:err.message||`OpenAI returned ${response.status} with no message.`,
        code:err.code||'',type:err.type||'',
        moderation:err.moderation_details||null,
        requestId:response.headers.get('x-request-id')||'',
        raw:text.slice(0,4000)};
    }
    const b64=body?.data?.[0]?.b64_json;
    if(!b64) return {ok:false,status:response.status,
      error:'OpenAI replied successfully but the response contained no image data.',raw:text.slice(0,4000)};
    return {ok:true,dataUrl:`data:image/png;base64,${b64}`,usage:body.usage||null,
      model,size,quality,usedReference:!!ref,ms:Date.now()-started,
      requestId:response.headers.get('x-request-id')||''};
  }catch(error){
    nativeLog(`OpenAI image generation threw: ${error.stack||error}`);
    const aborted=error.name==='AbortError';
    return {ok:false,error:aborted?'The request took longer than four minutes and was cancelled.':error.message,raw:''};
  }
});

/* ── StudioFlow g88 · copy and paste ──────────────────────────────────────────
   Kirk could not paste an OpenAI key into StudioFlow, and reported having no right-click menu
   anywhere in the app. Both are the same root cause: Electron does NOT provide a context menu of
   its own, and this app never built one or declared an application menu. Every text field in
   StudioFlow has been affected since day one -- the API key box is just where it finally bit.

   Two fixes, because they cover different routes to the same action:
     1. An application menu carrying the standard edit ROLES. Roles are what bind Ctrl+C/X/V/A at
        the OS level, so keyboard paste is guaranteed rather than relying on a default menu.
     2. A right-click context menu, built per click so it only offers what makes sense: Cut and
        Copy only when text is selected, Paste only in a field that can receive it. */
function buildAppMenu(){
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [ isMac ? { role: 'close' } : { role: 'quit' } ] },
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
      ...(isMac ? [{ role: 'pasteAndMatchStyle' }] : []),
      { role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }
    ]},
    { label: 'View', submenu: [
      { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' },
      { role: 'togglefullscreen' }
    ]},
    { label: 'Window', submenu: [ { role: 'minimize' }, { role: 'zoom' },
      ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }]) ]}
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
function attachContextMenu(win){
  if(!win || !win.webContents) return;
  win.webContents.on('context-menu', (_event, props) => {
    const items = [];
    const editable = !!props.isEditable;
    const hasSelection = !!(props.selectionText && props.selectionText.trim());
    if(editable && hasSelection) items.push({ role: 'cut' });
    if(hasSelection) items.push({ role: 'copy' });
    if(editable) items.push({ role: 'paste' });
    if(editable && !hasSelection && !items.length) items.push({ role: 'paste' });
    if(items.length) items.push({ type: 'separator' });
    if(editable) items.push({ role: 'selectAll' });
    if(!items.length) return;                       // nothing sensible to offer here
    Menu.buildFromTemplate(items).popup({ window: win });
  });
}
app.whenReady().then(() => {
  try{
    buildAppMenu();
    // Covers the window created at startup and any opened later.
    BrowserWindow.getAllWindows().forEach(attachContextMenu);
    app.on('browser-window-created', (_e, win) => attachContextMenu(win));
  }catch(error){ nativeLog(`Context menu setup failed: ${error.stack||error}`); }
});

/* ============================================================================
   StudioFlow 4.0 g94 · WEBSITE EXPORT
   Writes a complete static website to a folder Kirk chooses: the template files
   copied verbatim from site-template/, a generated catalogue.js, and real image
   files decoded out of the database.

   Images are written ONE AT A TIME rather than in a single manifest. The DB runs
   past 100MB with images inline as data URLs; shipping 75 of those across one IPC
   message would be a hundred-megabyte payload. Per-image calls also give the page
   honest progress instead of a spinner that sits there for a minute.

   Resizing uses electron's own nativeImage -- no new dependency, and it is already
   imported at the top of this file. Bytes are resolved by aiReferenceBytes(), the
   same helper the AI room generator uses, because it already handles all three
   shapes an artwork image can take here: data: URL, disk path, and a Squarespace
   CDN https URL (the website-cache side of artworkCatalog()).
   ============================================================================ */

const SITE_TEMPLATE_DIR = () => path.join(__dirname, 'site-template');

ipcMain.handle('site:chooseFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choose a folder for the exported website'
  });
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.focus(); }
  if (result.canceled || !result.filePaths[0]) return null;
  return { folder: result.filePaths[0] };
});

ipcMain.handle('site:chooseImageFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Choose the folder holding your room images'
  });
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.focus(); }
  if (result.canceled || !result.filePaths[0]) return null;
  const folder = result.filePaths[0];
  let files = [];
  try {
    files = fs.readdirSync(folder, { withFileTypes: true })
      .filter(e => e.isFile() && /\.(jpe?g|png|webp)$/i.test(e.name))
      .map(e => ({ name: e.name, path: path.join(folder, e.name) }));
  } catch (error) { return { folder, files: [], error: error.message }; }
  return { folder, files };
});

ipcMain.handle('site:copyTemplate', async (_event, payload = {}) => {
  try {
    const folder = String(payload.folder || '');
    if (!folder) throw new Error('No export folder was chosen.');
    const source = SITE_TEMPLATE_DIR();
    if (!fs.existsSync(source)) throw new Error(`The site template folder is missing: ${source}`);
    fs.mkdirSync(folder, { recursive: true });
    fs.mkdirSync(path.join(folder, 'images'), { recursive: true });
    const copied = [];
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      fs.copyFileSync(path.join(source, entry.name), path.join(folder, entry.name));
      copied.push(entry.name);
    }
    return { ok: true, copied };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('site:writeText', async (_event, payload = {}) => {
  try {
    const folder = String(payload.folder || '');
    const name = String(payload.name || '');
    if (!folder || !name) throw new Error('A folder and a file name are both required.');
    if (name.includes('..')) throw new Error('Refusing to write outside the export folder.');
    const target = path.join(folder, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, String(payload.text || ''), 'utf8');
    return { ok: true, path: target, bytes: Buffer.byteLength(String(payload.text || ''), 'utf8') };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

/* ==========================================================================================
   g155 — A SMALL PREVIEW OF A PICTURE, FOR THE EXPORT PAGE ITSELF.
   ==========================================================================================
   Kirk: "can i see the picture and what will fit in the window inside the export theme card and
   move it into place?" Until now the Website Export page showed chosen pictures as FILENAMES only,
   so choosing a hero was done blind and the crop could not be judged until after an export.

   Service pictures are stored as PATHS on purpose (the database is past 100MB with images inline),
   which means the renderer has no bytes to show. This hands back ONE SMALL data URL — 900px, JPEG,
   quality 72 — purely for looking at. Deliberately small: the preview only has to show framing and
   crop, and a full-resolution data URL for every service would put tens of megabytes through IPC
   and into the page for no gain.

   Reuses aiReferenceBytes() and nativeImage, exactly as the export does, so the preview and the
   exported file come from the same decode path — a picture that previews here is one that will
   write, and a format that cannot be decoded says so HERE rather than at export time.
   ========================================================================================== */
ipcMain.handle('site:previewImage', async (_event, payload = {}) => {
  try {
    const bytes = await aiReferenceBytes(payload.source);
    if (!bytes || !bytes.buffer || !bytes.buffer.length) {
      return { ok: false, error: 'That file could not be read.' };
    }
    let img = nativeImage.createFromBuffer(bytes.buffer);
    if (img.isEmpty()) {
      /* Same limit the export documents: nativeImage decodes JPEG and PNG only. Naming the format
         is more use than "failed" — it tells him WHY and what to convert. */
      return { ok: false, error: 'This format cannot be previewed (JPEG and PNG only). It may still export.' };
    }
    const size = img.getSize();
    const max = Math.max(1, Math.min(1400, Number(payload.max) || 900));
    if (size.width > max) img = img.resize({ width: max, quality: 'good' });
    const out = img.getSize();
    return { ok: true,
      dataUrl: 'data:image/jpeg;base64,' + img.toJPEG(72).toString('base64'),
      width: size.width, height: size.height,          // the TRUE size, for the aspect readout
      previewWidth: out.width, previewHeight: out.height };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

/* One artwork image in, two JPEGs out: a large one for the product page and a
   small one for grids. A grid of 75 full-resolution photographs is what makes a
   photographer's site unusable on a phone. */
/* ==========================================================================================
   g184 — PREPARING A FOLDER OF PICTURES FOR UPLOAD.
   ==========================================================================================
   Kirk found Squarespace's own unlinked-page-plus-password route and asked whether StudioFlow can
   still do the work of RESIZING the pictures — and watermark them at the same time.

   The resize could be done here with nativeImage. THE WATERMARK CANNOT: nativeImage decodes,
   resizes and encodes, but it cannot composite one image onto another. The renderer has a canvas
   and can. So main does what only main can do — read a file off disk and write one back — and the
   compositing happens where the tool for it exists.

   `image:readAsDataUrl` deliberately takes a maxPx: sending a 60-megapixel original across the IPC
   boundary as base64 would be several hundred megabytes of string for a picture that is about to
   be scaled to 2000px anyway.
   ========================================================================================== */
ipcMain.handle('image:readAsDataUrl', async (_event, payload = {}) => {
  try {
    const bytes = await aiReferenceBytes(payload.source);
    if (!bytes || !bytes.buffer || !bytes.buffer.length) {
      return { ok: false, error: 'That file could not be read.' };
    }
    let img = nativeImage.createFromBuffer(bytes.buffer);
    if (img.isEmpty()) {
      /* Same reasoning as site:writeImage: nativeImage decodes JPEG and PNG only. Rather than
         fail, hand the original bytes back untouched and say so. */
      return { ok: true, dataUrl: 'data:' + (bytes.type || 'image/jpeg') + ';base64,' +
        bytes.buffer.toString('base64'), resized: false, note: 'This format could not be resized here.' };
    }
    const max = Math.max(200, Math.min(6000, Number(payload.maxPx) || 2000));
    const size = img.getSize();
    if (size.width > max || size.height > max) {
      img = size.width >= size.height ? img.resize({ width: max, quality: 'best' })
                                      : img.resize({ height: max, quality: 'best' });
    }
    const out = img.getSize();
    return { ok: true, dataUrl: img.toDataURL(), width: out.width, height: out.height,
      sourceWidth: size.width, sourceHeight: size.height, resized: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

/* Write a picture the renderer has composited. Kept separate from site:writeImage, which forces an
   `images/` subfolder and a slugged name — wrong here, where the whole point is a folder of files
   he will upload himself and wants to recognise by their own names. */
ipcMain.handle('image:writeFile', async (_event, payload = {}) => {
  try {
    const folder = String(payload.folder || '');
    let name = String(payload.name || '');
    if (!folder || !name) throw new Error('A folder and a file name are both required.');
    /* Same refusal as site:writeText — a name is never allowed to climb out of the folder he
       chose, however it arrived here. */
    name = name.replace(/[\\/]+/g, '-');
    if (name.includes('..')) throw new Error('Refusing to write outside the chosen folder.');
    const data = String(payload.dataUrl || '');
    const comma = data.indexOf(',');
    if (comma < 0) throw new Error('That image was not readable.');
    const buf = Buffer.from(data.slice(comma + 1), 'base64');
    if (!buf.length) throw new Error('That image was empty.');
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, name), buf);
    return { ok: true, bytes: buf.length, name };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('site:writeImage', async (_event, payload = {}) => {
  try {
    const folder = String(payload.folder || '');
    const slug = String(payload.slug || '').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
    if (!folder || !slug) throw new Error('A folder and an image name are both required.');
    const bytes = await aiReferenceBytes(payload.source);
    if (!bytes || !bytes.buffer || !bytes.buffer.length) {
      return { ok: false, error: 'No readable image was stored for this piece.' };
    }
    const dir = path.join(folder, 'images');
    fs.mkdirSync(dir, { recursive: true });

    /* g98 (from the website-export branch): nativeImage decodes JPEG and PNG only. Anything else
       (WebP, TIFF, HEIC) comes back empty. Rather than fail, sniff the real format from the file's
       magic bytes, pass the original through unresized, and say so -- a large file beats no file.
       Formats a browser can't display are reported as needing conversion. */
    const head = bytes.buffer.subarray(0, 16);
    const hex = head.toString('hex');
    let sniffed = bytes.type || 'unknown';
    if (hex.startsWith('ffd8ff')) sniffed = 'image/jpeg';
    else if (hex.startsWith('89504e47')) sniffed = 'image/png';
    else if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') sniffed = 'image/webp';
    else if (hex.startsWith('49492a00') || hex.startsWith('4d4d002a')) sniffed = 'image/tiff';
    else if (hex.slice(8, 16) === '66747970') sniffed = 'image/heic';

    const image = nativeImage.createFromBuffer(bytes.buffer);
    if (image.isEmpty()) {
      const ext = { 'image/webp': 'webp', 'image/tiff': 'tif', 'image/heic': 'heic' }[sniffed] || 'bin';
      const browserSafe = sniffed === 'image/webp';
      const dir2 = path.join(folder, 'images');
      fs.mkdirSync(dir2, { recursive: true });
      const file = `${slug}.${ext}`;
      fs.writeFileSync(path.join(dir2, file), bytes.buffer);
      return {
        ok: browserSafe,
        files: [`images/${file}`, `images/${file}`],
        resized: false,
        format: sniffed,
        bytes: bytes.buffer.length,
        error: browserSafe ? null
          : `Stored as ${sniffed} (${hex.slice(0, 12)}), which browsers can't display. Re-save this image as JPEG.`
      };
    }
    const source = image.getSize();
    const written = [];
    const sizes = Array.isArray(payload.sizes) && payload.sizes.length
      ? payload.sizes : [{ suffix: '', width: 1600, quality: 82 }, { suffix: '-thumb', width: 700, quality: 78 }];

    for (const size of sizes) {
      const width = Math.min(Number(size.width) || 1600, source.width || 1600);
      const resized = width < (source.width || 0) ? image.resize({ width, quality: 'good' }) : image;
      const file = `${slug}${size.suffix || ''}.jpg`;
      fs.writeFileSync(path.join(dir, file), resized.toJPEG(Number(size.quality) || 82));
      written.push(`images/${file}`);
    }
    return { ok: true, files: written, width: source.width, height: source.height,
             orientation: (source.height || 0) > (source.width || 0) ? 'portrait' : 'landscape' };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('site:openFolder', async (_event, folder) => shell.openPath(String(folder || '')));

/* g95 · Picture picker for the website export.
   Returns PATHS, not data URLs, unlike file:openImages -- these get stored in
   state.websiteExport and the DB is already past 100MB with images inline. The
   export reads the bytes at write time via the same aiReferenceBytes() path. */
/* ==========================================================================================
   g176 — BUILDING A CLIENT GALLERY.
   ==========================================================================================
   Template v26 ships the READING half: client.html decrypts a manifest with a passphrase and
   shows the pictures. Nothing could WRITE one, which made the whole feature unusable. This is
   that half.

   THE SEAL MUST MATCH client-gallery.js's unlock() EXACTLY — PBKDF2-SHA256, the iteration count
   carried in the blob, a raw passphrase as key material, AES-GCM, everything base64. A mismatch
   anywhere produces a gallery that simply will not open, with no diagnosis available to whoever
   is holding the passphrase. So it is not written from the spec and hoped for: the harness seals
   a manifest here and decrypts it with the REAL unlock() lifted out of the template.

   WHAT IS DELIBERATELY NOT ENCRYPTED: `title` and `hint` sit in plaintext beside the blob so the
   gate can say "Sarah & Tom — 14 June" before anyone types anything. That is the point of them,
   and it is also the trap — anything private in either is public. Said in the UI, not just here.

   THE PASSPHRASE IS NOT RECOVERABLE. It is never stored anywhere in the exported site; only the
   client's copy and Kirk's own record exist. Losing it means re-sealing the gallery, which is why
   StudioFlow keeps it on the gallery record rather than making him remember it.
   ========================================================================================== */
ipcMain.handle('site:buildClientGallery', async (_event, payload = {}) => {
  try {
    const folder = String(payload.folder || '');
    if (!folder) throw new Error('No export folder was chosen.');
    const images = Array.isArray(payload.images) ? payload.images : [];
    if (!images.length) throw new Error('That gallery has no pictures in it.');
    const passphrase = String(payload.passphrase || '');
    if (!passphrase) throw new Error('That gallery has no passphrase.');

    /* A token for the LINK and a separate name for the FOLDER, deliberately not the same value.
       If they matched, anyone holding a link would also know the directory the full-size files
       sit in, and the encryption of the manifest would be protecting a door with the wall
       already open. */
    const token = crypto.randomBytes(8).toString('hex');          // 16 hex chars
    const dirName = crypto.randomBytes(8).toString('hex');

    const galleryDir = path.join(folder, 'client-images', dirName);
    fs.mkdirSync(path.join(galleryDir, 'l'), { recursive: true });
    fs.mkdirSync(path.join(galleryDir, 't'), { recursive: true });
    fs.mkdirSync(path.join(folder, 'client-galleries'), { recursive: true });

    const written = [];
    const skipped = [];
    for (const img of images) {
      const src = String(img && img.path || '');
      if (!src || !fs.existsSync(src)) { skipped.push({ name: img && img.name, why: 'not on disk' }); continue; }
      const base = path.basename(src).replace(/[^\w.\-]+/g, '-');
      try {
        /* FULL SIZE IS COPIED, NOT RE-ENCODED. They are downloading these — a "resize" that
           happens to be 100% would still re-compress the JPEG and quietly cost quality on the
           deliverable the client paid for. */
        fs.copyFileSync(src, path.join(galleryDir, base));

        const native = nativeImage.createFromPath(src);
        if (native.isEmpty()) { skipped.push({ name: base, why: 'could not be read as an image' }); continue; }
        const size = native.getSize();
        const jpegName = base.replace(/\.[^.]+$/, '') + '.jpg';

        const shrink = (maxPx, quality) => {
          const scale = Math.min(1, maxPx / Math.max(size.width, size.height));
          return native.resize({
            width: Math.max(1, Math.round(size.width * scale)),
            height: Math.max(1, Math.round(size.height * scale)),
            quality: quality
          });
        };
        fs.writeFileSync(path.join(galleryDir, 'l', jpegName), shrink(2000, 'best').toJPEG(88));
        fs.writeFileSync(path.join(galleryDir, 't', jpegName), shrink(700, 'good').toJPEG(80));

        written.push({ file: base, large: 'l/' + jpegName, thumb: 't/' + jpegName,
          name: String(img.name || base).replace(/\.[^.]+$/, '') });
      } catch (error) {
        skipped.push({ name: base, why: error.message });
      }
    }
    if (!written.length) throw new Error('None of those pictures could be written.');

    const manifest = {
      title: String(payload.title || ''),
      kicker: String(payload.kicker || ''),
      intro: String(payload.intro || ''),
      shotOn: String(payload.shotOn || ''),
      expires: String(payload.expires || ''),
      note: String(payload.note || ''),
      path: 'client-images/' + dirName + '/',
      images: written
    };

    const webcrypto = crypto.webcrypto;
    const enc = new TextEncoder();
    const iterations = 250000;
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const base = await webcrypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    const key = await webcrypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const sealed = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key,
      enc.encode(JSON.stringify(manifest)));

    const blob = {
      v: 1,
      iterations: iterations,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      data: Buffer.from(sealed).toString('base64'),
      /* PLAINTEXT, on purpose — the gate shows these before anything is unlocked. */
      /* g177 — A BLANK PUBLIC HEADING MUST MEAN "SAY NOTHING", NOT "PUBLISH THE PRIVATE ONE".
         This fell back to payload.title, which is the heading shown INSIDE the gallery and is
         where Kirk naturally writes "Henderson Wedding \u2014 full set". That title would then have
         been written in plaintext into a file anyone holding the link can read, alongside a
         careful warning on the form telling him not to put anything private there. The form was
         right; the fallback quietly undid it.
         Caught by round-tripping a sealed manifest and grepping the stored file for the client's
         surname \u2014 everything else was absent, that was not. */
      title: String(payload.gateTitle || 'Your gallery'),
      hint: String(payload.hint || '')
    };
    fs.writeFileSync(path.join(folder, 'client-galleries', token + '.json'),
      JSON.stringify(blob, null, 2));

    return { ok: true, token: token, dirName: dirName, count: written.length,
      skipped: skipped, link: 'client.html?g=' + token };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('site:choosePictures', async (_event, payload={}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: payload.multiple === false ? ['openFile'] : ['openFile','multiSelections'],
    title: payload.title || 'Choose images',
    filters: [{ name:'Images', extensions:['jpg','jpeg','png','webp'] }]
  });
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.focus(); }
  if (result.canceled || !result.filePaths.length) return [];
  return result.filePaths.map(filePath => ({ name: path.basename(filePath), path: filePath }));
});

/* ── StudioFlow g123 · finding Kirk's edited keepers ──────────────────────────
   His workflow: raws sit in the shoot folder, and anything he takes through Lightroom comes back
   as a JPEG in a subfolder called "lightroom alterations" with THE SAME BASE FILENAME. That makes
   the edit set a near-perfect training label — not "I flagged this" but "I spent time on it and
   delivered it", which is a far stronger signal than any rating.

   Matching is on the base name, case-insensitively, ignoring extension, and tolerant of the
   suffixes export presets like to add (-Edit, _1, -2). The subfolder name is matched loosely too,
   because "Lightroom Alterations" and "lightroom alterations" are the same folder to him. */
/* g142 — WHY THIS NEVER FOUND HIS FOLDER, two faults at once.
   (1) IT ONLY EVER LOOKED ONE LEVEL DOWN. g126 taught the ARCHIVE scanner that the edits can sit
       inside YES ("Fairy Lake / YES / lightroom alterations") — and this handler, which is what
       "Learn from my edits" calls, never got the same treatment. Kirk's shoot has the edits inside
       YES, so it reported "no lightroom alterations subfolder" while the folder was plainly there.
   (2) I HAD ENCODED ONE SPELLING. /lightroom\s*alterations?/ does not match "Lightroom-Edits",
       "lr edits", or a folder simply called "Edits" — and Kirk calls them "the lightroom edits".
   Both are now fixed, and — more usefully — when it still finds nothing it REPORTS THE SUBFOLDERS
   IT ACTUALLY SAW, so the next round is a fact rather than another guess at the name. He can also
   point at the folder himself, and the name he picks is remembered for every later shoot. */
const CULL_EDIT_DIR = (name, extra = []) => {
  const s = String(name).toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (extra.some(x => String(x).toLowerCase().trim() === s)) return true;
  return /^(lightroom |lr |light room )?(alterations?|edits?|edited|exports?|processed|finals?)$/.test(s);
};
const CULL_EDIT_FILE = /\.(jpe?g|png|tiff?|webp|heic)$/i;
const cullEditBase = n => n.replace(/\.[^.]+$/, '')
  .replace(/[-_ ]?edit(ed)?$/i, '')            // "IMG_1234-Edit"
  .replace(/[-_ ]\d{1,2}$/, '')                // "IMG_1234-2"
  .trim().toLowerCase();

ipcMain.handle('cull:findEdits', async (_event, payload = {}) => {
  try {
    const folder = String(payload.folder || '');
    if (!folder || !fs.existsSync(folder)) return { ok: false, error: 'That shoot folder is not there any more.' };
    const extra = Array.isArray(payload.names) ? payload.names : [];

    const subs = d => { try { return fs.readdirSync(d, { withFileTypes: true }).filter(e => e.isDirectory()); } catch (_) { return []; } };

    /* The shoot root first, then every folder one level down — YES, MAYBE, or anything else he
       happens to file them under. A named folder passed in wins outright. */
    const found = [], seen = [];
    if (payload.editFolder && fs.existsSync(payload.editFolder)) found.push(payload.editFolder);
    if (!found.length) {
      for (const d of subs(folder)) {
        seen.push(d.name);
        if (CULL_EDIT_DIR(d.name, extra)) found.push(path.join(folder, d.name));
      }
      for (const d of subs(folder)) {
        const inner = path.join(folder, d.name);
        for (const d2 of subs(inner)) {
          seen.push(d.name + '\\' + d2.name);
          if (CULL_EDIT_DIR(d2.name, extra)) found.push(path.join(inner, d2.name));
        }
      }
    }

    if (!found.length) {
      return { ok: true, folderFound: false, edits: [], sawFolders: seen,
        error: 'No edited-photo folder found in this shoot or one level inside it.' };
    }

    const bases = new Set();
    for (const dir of found) {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!f.isFile() || !CULL_EDIT_FILE.test(f.name)) continue;
        const base = cullEditBase(f.name);
        if (base) bases.add(base);
      }
    }
    return { ok: true, folderFound: true, sawFolders: seen,
      folderName: found.map(f => path.basename(f)).join(', '),
      folders: found, edits: [...bases] };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

/* Lets him point straight at the edited folder when the name is one I have not anticipated. */
ipcMain.handle('cull:chooseEditFolder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Choose the folder holding your edited photos'
  });
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.focus(); }
  if (r.canceled || !r.filePaths[0]) return null;
  return { folder: r.filePaths[0], name: path.basename(r.filePaths[0]) };
});

/* ── StudioFlow g125 · training from the shoots he has already edited ─────────
   Kirk wants to seed the model from years of past work in one go, then have it keep learning as he
   culls. This finds the shoots worth learning from: any folder containing a "lightroom
   alterations" subfolder, either the one he picks or its immediate children, so he can point at a
   single shoot or at the parent that holds a season of them. */
ipcMain.handle('cull:chooseArchive', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Choose a shoot, or a folder containing several shoots'
  });
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.focus(); }
  if (r.canceled || !r.filePaths[0]) return null;
  return { folder: r.filePaths[0] };
});

ipcMain.handle('cull:scanArchive', async (_event, payload = {}) => {
  try {
    const root = String(payload.folder || '');
    if (!root || !fs.existsSync(root)) return { ok: false, error: 'That folder is not there any more.' };

    const RAW = /\.(cr2|cr3|nef|arw|orf|raf|rw2|dng|jpe?g|tiff?|png)$/i;
    /* g142: the same loose folder matcher the shoot scanner uses, plus any name he has taught it,
       so the two paths can never again disagree about what an edits folder is called. */
    const extra = Array.isArray(payload.names) ? payload.names : [];
    const ALT = { test: n => CULL_EDIT_DIR(n, extra) };
    const YES = /^yes$/i, MAYBE = /^maybe$/i;

    const baseOf = n => cullEditBase(n);
    const dirs = d => fs.readdirSync(d, { withFileTypes: true }).filter(e => e.isDirectory());
    const imagesIn = d => {
      try {
        return fs.readdirSync(d, { withFileTypes: true })
          .filter(f => f.isFile() && RAW.test(f.name)).map(f => path.join(d, f.name));
      } catch (_) { return []; }
    };
    /* g126: the alterations folder may sit in the shoot root OR inside YES — Kirk's older shoots
       look like "Fairy Lake / YES / lightroom alterations", because he moved the keepers first and
       edited them there. Collect edited base names from wherever they are. */
    const editsUnder = (d) => {
      const found = new Set();
      const scan = (dir) => {
        for (const sub of dirs(dir)) {
          if (!ALT.test(sub.name)) continue;
          for (const f of fs.readdirSync(path.join(dir, sub.name), { withFileTypes: true })) {
            if (f.isFile() && /\.(jpe?g|png|tiff?|webp|heic)$/i.test(f.name)) found.add(baseOf(f.name));
          }
        }
      };
      scan(d);
      /* g142: ANY folder one level down, not only YES and MAYBE — he does not always use those. */
      for (const sub of dirs(d)) if (!ALT.test(sub.name)) scan(path.join(d, sub.name));
      return found;
    };

    const shootAt = (dir, name) => {
      const edits = editsUnder(dir);
      const yesDir = dirs(dir).find(e => YES.test(e.name));
      const maybeDir = dirs(dir).find(e => MAYBE.test(e.name));
      if (!edits.size && !yesDir) return null;              // nothing here says what he chose

      /* THE KEY POINT: a YES folder is a list of positives, and the frames LEFT IN THE ROOT are the
         negatives. Reading the YES folder on its own would teach it that everything is a keeper. */
      const positives = new Set(), negatives = new Set(), maybes = new Set();
      if (yesDir) imagesIn(path.join(dir, yesDir.name)).forEach(p => positives.add(p));
      if (maybeDir) imagesIn(path.join(dir, maybeDir.name)).forEach(p => maybes.add(p));
      for (const p of imagesIn(dir)) {
        if (edits.has(baseOf(path.basename(p)))) positives.add(p); else negatives.add(p);
      }
      /* A maybe he went back and edited is him settling the question. */
      for (const p of [...maybes]) {
        if (edits.has(baseOf(path.basename(p)))) { positives.add(p); maybes.delete(p); }
      }
      /* g126: restored from the earlier scanner — a handful of frames cannot teach anything and
         only adds noise to the store. Counts both sides now, not just the raw file list. */
      if (!positives.size) return null;
      if ((positives.size + negatives.size) < 8) return null;
      return {
        folder: dir, name,
        positives: [...positives], negatives: [...negatives], maybes: [...maybes],
        organised: !!yesDir
      };
    };

    const shoots = [];
    const self = shootAt(root, path.basename(root));
    if (self) shoots.push(self);
    for (const e of dirs(root)) {
      if (ALT.test(e.name) || YES.test(e.name) || MAYBE.test(e.name)) continue;
      const s = shootAt(path.join(root, e.name), e.name);
      if (s) shoots.push(s);
    }
    return { ok: true, shoots };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

/* ── StudioFlow g131 · downloadable files for the site ────────────────────────
   The Free Tools page gives visitors a zip. siteWriteImage cannot carry it — that decodes and
   resizes pictures — so this copies an arbitrary file into the export folder untouched. Used for
   Loupe today; anything he wants to give away later goes the same way. */
ipcMain.handle('site:chooseDownloads', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    title: 'Choose files to offer as downloads',
    filters: [{ name: 'Downloads', extensions: ['zip', 'pdf', 'exe', 'dmg', 'html'] }, { name: 'Any file', extensions: ['*'] }]
  });
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.focus(); }
  if (r.canceled || !r.filePaths.length) return [];
  return r.filePaths.map(p => ({ name: path.basename(p), path: p, bytes: (fs.statSync(p).size || 0) }));
});

ipcMain.handle('site:copyDownload', async (_event, payload = {}) => {
  try {
    const folder = String(payload.folder || '');
    const source = String(payload.source || '');
    if (!folder || !source) throw new Error('A folder and a file are both required.');
    if (!fs.existsSync(source)) throw new Error(`That file is no longer there: ${source}`);
    const dir = path.join(folder, 'downloads');
    fs.mkdirSync(dir, { recursive: true });
    /* Keep his own filename — it is what the visitor sees when it lands in their downloads. */
    const name = String(payload.name || path.basename(source)).replace(/[^A-Za-z0-9._-]+/g, '-');
    fs.copyFileSync(source, path.join(dir, name));
    return { ok: true, href: 'downloads/' + name, bytes: fs.statSync(source).size || 0 };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

/* ── StudioFlow g136 · how many people took it ────────────────────────────────
   GitHub counts every download of a release asset and reports it on a public repo with no token
   and no tracking script — which is the whole reason the files went there rather than onto
   Squarespace, where downloads are invisible.

   Honest about what this number is: it counts the FILE being fetched from the release. It does not
   count people who used the live version at github.io without downloading anything, and it will
   include the odd bot. It is a floor, not a headcount. */
ipcMain.handle('github:releaseStats', async (_event, payload = {}) => {
  try {
    const owner = String(payload.owner || '').trim();
    const repo = String(payload.repo || '').trim();
    if (!owner || !repo) return { ok: false, error: 'A GitHub owner and repository are both needed.' };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let res, text;
    try {
      res = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'StudioFlow' }
      });
      text = await res.text();
    } finally { clearTimeout(timer); }

    if (!res.ok) {
      let msg = `GitHub returned ${res.status}.`;
      if (res.status === 404) msg = 'That repository was not found, or it is private. Release counts are only public on a public repo.';
      if (res.status === 403) msg = 'GitHub is rate-limiting this connection. It allows 60 checks an hour without a token; try again shortly.';
      return { ok: false, error: msg, raw: text.slice(0, 500) };
    }
    const releases = JSON.parse(text);
    const assets = [];
    let total = 0;
    releases.forEach(r => (r.assets || []).forEach(a => {
      total += Number(a.download_count) || 0;
      assets.push({
        name: a.name, count: Number(a.download_count) || 0,
        release: r.tag_name || r.name || '', url: a.browser_download_url || ''
      });
    }));
    assets.sort((a, b) => b.count - a.count);
    return { ok: true, total, assets, releases: releases.length, checkedAt: new Date().toISOString() };
  } catch (error) {
    const aborted = error.name === 'AbortError';
    return { ok: false, error: aborted ? 'GitHub did not answer within fifteen seconds.' : error.message };
  }
});
