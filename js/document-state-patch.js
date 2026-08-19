import { TextureEditor } from './texture-editor.js';

const $ = id => document.getElementById(id);
const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const cloneCanvas = src => { const c = makeCanvas(src.width, src.height); c.getContext('2d').drawImage(src, 0, 0); return c; };
const cloneState = state => ({
  width: state.width, height: state.height, activeLayerId: state.activeLayerId,
  layers: state.layers.map(l => ({ ...l, canvas: cloneCanvas(l.canvas) })),
  versions: (state.versions || []).map(v => ({ ...v, canvas: cloneCanvas(v.canvas) })),
});
async function canvasBlob(canvas) { return new Promise((ok, no) => canvas.toBlob(b => b ? ok(b) : no(new Error('Could not encode document')), 'image/png')); }
async function blobCanvas(blob) { const bitmap = await createImageBitmap(blob); const c = makeCanvas(bitmap.width, bitmap.height); c.getContext('2d').drawImage(bitmap, 0, 0); bitmap.close?.(); return c; }
async function serializeState(state) {
  return {
    width: state.width, height: state.height, activeLayerId: state.activeLayerId,
    layers: await Promise.all(state.layers.map(async l => ({ id:l.id,name:l.name,visible:l.visible,locked:l.locked,opacity:l.opacity,blend:l.blend,blob:await canvasBlob(l.canvas) }))),
    versions: await Promise.all((state.versions || []).slice(-20).map(async v => ({ id:v.id,name:v.name,time:v.time,blob:await canvasBlob(v.canvas) }))),
  };
}
async function deserializeState(state) {
  const layers=[]; for(const l of state.layers || []) layers.push({ ...l, canvas:await blobCanvas(l.blob) });
  const versions=[]; for(const v of state.versions || []) versions.push({ ...v, canvas:await blobCanvas(v.blob) });
  return { width:state.width,height:state.height,activeLayerId:state.activeLayerId,layers,versions };
}

TextureEditor.prototype.restoreCapturedState = function (state, label='Switch Texture Document') {
  if (!state?.layers?.length) return false;
  const copy=cloneState(state); this.doc.width=copy.width;this.doc.height=copy.height;this.layers=copy.layers;this.versions=copy.versions;this.activeLayerId=copy.layers.some(l=>l.id===copy.activeLayerId)?copy.activeLayerId:copy.layers[0].id;this.history=[];this.redoStack=[];this.selection=null;this.fit();this.changed(label);this.onHistory?.(this.history);return true;
};

const serializeBase=TextureEditor.prototype.serializePersistentState;
TextureEditor.prototype.serializePersistentState=async function(){
  if(this._qaDocumentStore&&this._qaDocumentKey)this._qaDocumentStore.set(this._qaDocumentKey,this.capturePersistentState());
  const payload=await serializeBase.call(this);payload.currentKey=this._qaDocumentKey||null;payload.documents=[];
  for(const [key,state] of this._qaDocumentStore||[]){if(key===payload.currentKey)continue;payload.documents.push({key,state:await serializeState(state)});}
  return payload;
};
const restoreBase=TextureEditor.prototype.restorePersistentState;
TextureEditor.prototype.restorePersistentState=async function(data){
  const result=await restoreBase.call(this,data);this._qaDocumentStore=new Map();
  for(const item of data?.documents||[]){try{this._qaDocumentStore.set(item.key,await deserializeState(item.state));}catch(error){console.warn('Could not restore texture document',item.key,error);}}
  this._qaDocumentKey=data?.currentKey||this._qaDocumentKey||null;return result;
};

function keyFromUi(){return `${$('textureMapSelect')?.value||'map'}:${Number($('udimSelect')?.value||1001)}`;}
function setupDocuments(){
  const tex=window.__uvmapTex,viewer=window.__uvmapViewer,mapSelect=$('textureMapSelect'),udimSelect=$('udimSelect');if(!tex||!mapSelect||!udimSelect)return;
  tex._qaDocumentStore=tex._qaDocumentStore||new Map();tex._qaDocumentKey=tex._qaDocumentKey||keyFromUi();
  const saveCurrent=()=>{if(tex._qaDocumentKey&&tex.layers?.length)tex._qaDocumentStore.set(tex._qaDocumentKey,tex.capturePersistentState());};
  const wrapSelect=select=>{const original=select.onchange;select.onchange=async event=>{saveCurrent();if(original)await original.call(select,event);const next=keyFromUi();tex._qaDocumentKey=next;const saved=tex._qaDocumentStore.get(next);if(saved)tex.restoreCapturedState(saved);else if(tex.layers?.length)tex._qaDocumentStore.set(next,tex.capturePersistentState());};};
  wrapSelect(mapSelect);wrapSelect(udimSelect);
  const oldFaceSelect=viewer.onFaceSelect;viewer.onFaceSelect=info=>{const before=Number(udimSelect.value||1001);oldFaceSelect?.(info);if(info?.udim&&info.udim!==before&&[...udimSelect.options].some(o=>Number(o.value)===info.udim)){udimSelect.value=String(info.udim);udimSelect.onchange?.({target:udimSelect,type:'change'});}};
  $('textureFileInput')?.addEventListener('change',event=>{const map=mapSelect.value||'map';for(const file of event.target.files||[]){const m=file.name.toLowerCase().match(/(?:^|[._-])(1\d{3})(?:[._-]|$)/),udim=m?Number(m[1]):1001;tex._qaDocumentStore.delete(`${map}:${udim}`);}},true);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(setupDocuments));else setTimeout(setupDocuments);
