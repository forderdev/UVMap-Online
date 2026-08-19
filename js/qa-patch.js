import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { TextureEditor } from './texture-editor.js';
import { ModelViewer } from './model-viewer.js';

const $ = id => document.getElementById(id);
const mats = mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material];
const ids = (g, f) => g.index ? [g.index.getX(f * 3), g.index.getX(f * 3 + 1), g.index.getX(f * 3 + 2)] : [f * 3, f * 3 + 1, f * 3 + 2];
const uvAttr = (g, name = 'uv') => g.getAttribute(name) || (name === 'uv' ? null : g.getAttribute('uv'));
const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
const cloneCanvas = src => { const c = makeCanvas(src.width, src.height); c.getContext('2d').drawImage(src, 0, 0); return c; };

function cloneLayers(layers) { return layers.map(l => ({ ...l, canvas: cloneCanvas(l.canvas) })); }
async function canvasBlob(c) { return new Promise((ok, no) => c.toBlob(b => b ? ok(b) : no(new Error('Could not encode layer')), 'image/png')); }
async function blobCanvas(blob) {
  const bitmap = await createImageBitmap(blob); const c = makeCanvas(bitmap.width, bitmap.height); c.getContext('2d').drawImage(bitmap, 0, 0); bitmap.close?.(); return c;
}

const originalNewDocument = TextureEditor.prototype.newDocument;
TextureEditor.prototype.newDocument = function (...args) { window.__uvmapTex = this; return originalNewDocument.apply(this, args); };
const originalViewerResize = ModelViewer.prototype.resize;
ModelViewer.prototype.resize = function (...args) { window.__uvmapViewer = this; return originalViewerResize.apply(this, args); };

TextureEditor.prototype.capturePersistentState = function () {
  return {
    width: this.doc.width, height: this.doc.height, activeLayerId: this.activeLayerId,
    layers: cloneLayers(this.layers),
    versions: (this.versions || []).map(v => ({ ...v, canvas: cloneCanvas(v.canvas) })),
  };
};
TextureEditor.prototype.serializePersistentState = async function () {
  const state = this.capturePersistentState();
  return {
    width: state.width, height: state.height, activeLayerId: state.activeLayerId,
    layers: await Promise.all(state.layers.map(async l => ({ id: l.id, name: l.name, visible: l.visible, locked: l.locked, opacity: l.opacity, blend: l.blend, blob: await canvasBlob(l.canvas) }))),
    versions: await Promise.all(state.versions.slice(-20).map(async v => ({ id: v.id, name: v.name, time: v.time, blob: await canvasBlob(v.canvas) }))),
  };
};
TextureEditor.prototype.restorePersistentState = async function (data) {
  if (!data?.layers?.length) return false;
  const layers = []; for (const l of data.layers) layers.push({ ...l, canvas: await blobCanvas(l.blob) });
  const versions = []; for (const v of data.versions || []) versions.push({ ...v, canvas: await blobCanvas(v.blob) });
  this.doc.width = data.width; this.doc.height = data.height; this.layers = layers; this.activeLayerId = layers.some(l => l.id === data.activeLayerId) ? data.activeLayerId : layers[0].id;
  this.versions = versions; this.history = []; this.redoStack = []; this.selection = null; this.fit(); this.changed('Restore Project'); this.onHistory?.(this.history); return true;
};

TextureEditor.prototype._qaSmooth = function (p) {
  if (!this._qaSmoothPoint || !this.stabilization) { this._qaSmoothPoint = { ...p }; return p; }
  const follow = Math.max(0.08, 1 - this.stabilization * 0.92);
  this._qaSmoothPoint.x += (p.x - this._qaSmoothPoint.x) * follow; this._qaSmoothPoint.y += (p.y - this._qaSmoothPoint.y) * follow;
  return { ...p, x: this._qaSmoothPoint.x, y: this._qaSmoothPoint.y };
};
TextureEditor.prototype.dot = function (p, pressure = 1) {
  const layer = this.activeLayer; if (!layer) return;
  const ctx = layer.canvas.getContext('2d'); const size = this.size * (this.pressureSize ? Math.max(0.15, pressure) : 1); const alpha = this.opacity * (this.pressureOpacity ? Math.max(0.05, pressure) : 1); const radius = Math.max(0.5, size / 2);
  ctx.save(); if (this.tool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
  if (this.hardness >= 0.995) { ctx.globalAlpha = alpha; ctx.fillStyle = this.tool === 'eraser' ? '#000' : this.color; }
  else { const inner = Math.min(radius - 0.01, Math.max(0, radius * this.hardness)); const g = ctx.createRadialGradient(p.x, p.y, inner, p.x, p.y, radius); const n = parseInt(this.color.slice(1), 16); const rgba = `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${alpha})`; g.addColorStop(0, this.tool === 'eraser' ? `rgba(0,0,0,${alpha})` : rgba); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; }
  ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
};
TextureEditor.prototype.line = function (a, b, pressure = 1) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y), step = Math.max(1, this.size * 0.12); if (!dist) return this.dot(b, pressure);
  for (let i = 0; i <= dist; i += step) { const t = i / dist; this.dot({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, pressure); } this.dot(b, pressure);
};

const oldDown = TextureEditor.prototype.down;
const oldMove = TextureEditor.prototype.move;
const oldUp = TextureEditor.prototype.up;
TextureEditor.prototype.down = function (e) {
  if (e.button === 0 && this.tool === 'lasso') { const p = this.screenToUV(e); this.dragging = true; this._qaLasso = [p]; this.render(); return; }
  if (e.button === 0 && this.tool === 'move') {
    if (this.activeLayer?.locked) return; const p = this.screenToUV(e); this.dragging = true; this.strokeBefore = cloneLayers(this.layers); this._qaMove = { start: p, dx: 0, dy: 0, source: cloneCanvas(this.activeLayer.canvas) };
    const ctx = this.activeLayer.canvas.getContext('2d');
    if (this.selection?.points?.length >= 3) { const path = new Path2D(); path.moveTo(this.selection.points[0].x, this.selection.points[0].y); this.selection.points.slice(1).forEach(q => path.lineTo(q.x, q.y)); path.closePath(); const sourceCtx = this._qaMove.source.getContext('2d'); sourceCtx.globalCompositeOperation = 'destination-in'; sourceCtx.fill(path); ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fill(path); ctx.restore(); }
    else ctx.clearRect(0, 0, this.doc.width, this.doc.height);
    this.render(); return;
  }
  oldDown.call(this, e); if (e.button === 0 && ['brush', 'eraser'].includes(this.tool)) this._qaSmoothPoint = this.last ? { ...this.last } : null;
};
TextureEditor.prototype.move = function (e) {
  if (this.dragging && this.tool === 'lasso' && this._qaLasso) { const p = this.screenToUV(e), last = this._qaLasso.at(-1); if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 2) this._qaLasso.push(p); this.render(); return; }
  if (this.dragging && this.tool === 'move' && this._qaMove) { const p = this.screenToUV(e); this._qaMove.dx = p.x - this._qaMove.start.x; this._qaMove.dy = p.y - this._qaMove.start.y; this.render(); return; }
  if (this.dragging && ['brush', 'eraser'].includes(this.tool) && !this.panning) {
    const p = this._qaSmooth(this.screenToUV(e)); this.line(this.last, p, e.pressure || 1); this.last = p; this.changed('Paint', false); return;
  }
  oldMove.call(this, e);
};
TextureEditor.prototype.up = function (e) {
  if (this.dragging && this.tool === 'lasso' && this._qaLasso) { if (this._qaLasso.length >= 3) this.selection = { points: this._qaLasso.map(p => ({ x: p.x, y: p.y })) }; this._qaLasso = null; this.dragging = false; this.render(); return; }
  if (this.dragging && this.tool === 'move' && this._qaMove) {
    const layer = this.activeLayer, m = this._qaMove; layer.canvas.getContext('2d').drawImage(m.source, Math.round(m.dx), Math.round(m.dy)); if (this.selection?.points) this.selection.points = this.selection.points.map(p => ({ x: p.x + m.dx, y: p.y + m.dy })); this._qaMove = null; this.finish('Move'); return;
  }
  oldUp.call(this, e); this._qaSmoothPoint = null;
};
TextureEditor.prototype.cancelActiveOperation = function () {
  if (this._qaMove && this.strokeBefore) { this.layers = cloneLayers(this.strokeBefore); this._qaMove = null; this.strokeBefore = null; this.dragging = false; this.render(); return true; }
  if (this._qaLasso) { this._qaLasso = null; this.dragging = false; this.render(); return true; }
  if (this.selection) { this.selection = null; this.render(); return true; }
  return false;
};

TextureEditor.prototype.paintUV = function (u, v, pressure = 1, start = false, meta = {}) {
  const n = Math.max(0, (meta.udim || this.activeTile || 1001) - 1001), ou = n % 10, ov = Math.floor(n / 10); const p = { x: (u - ou) * this.doc.width, y: (v - ov) * this.doc.height, u, v };
  if (start) { this.strokeBefore = cloneLayers(this.layers); this.dragging = true; this.last = p; this._qaPaintMeta = meta; this.dot(p, pressure); this.changed('Paint', false); return; }
  const jump = this.last ? Math.hypot(p.x - this.last.x, p.y - this.last.y) : 0; const seam = meta.udim !== this._qaPaintMeta?.udim || meta.mesh !== this._qaPaintMeta?.mesh || jump > Math.max(this.doc.width, this.doc.height) * 0.22;
  if (!this.last || seam) this.dot(p, pressure); else this.line(this.last, p, pressure); this.last = p; this._qaPaintMeta = meta; this.changed('Paint', false);
};
const oldEnd3D = TextureEditor.prototype.end3DStroke;
TextureEditor.prototype.end3DStroke = function () { this._qaPaintMeta = null; oldEnd3D.call(this); };

TextureEditor.prototype.setCompare = function (v) { this._qaCompare = Boolean(v); this.render(); };
TextureEditor.prototype.setComparePosition = function (v) { this._qaComparePos = Math.max(0, Math.min(1, Number(v))); this.render(); };
const oldRender = TextureEditor.prototype.render;
TextureEditor.prototype.render = function () {
  if (!this._qaCompare || !this.versions?.[0]?.canvas) { oldRender.call(this); if (this._qaMove) drawMovePreview(this); if (this._qaLasso || this.selection) drawSelection(this); return; }
  this._qaCompare = false; oldRender.call(this); this._qaCompare = true;
  const d = Math.min(devicePixelRatio || 1, 2), t = this.transform(), split = t.x + t.w * (this._qaComparePos ?? 0.5); this.ctx.save(); this.ctx.setTransform(d, 0, 0, d, 0, 0); this.ctx.beginPath(); this.ctx.rect(t.x, t.y, split - t.x, t.h); this.ctx.clip(); this.ctx.drawImage(this.versions[0].canvas, t.x, t.y, t.w, t.h); this.ctx.restore(); this.octx.save(); this.octx.setTransform(d, 0, 0, d, 0, 0); this.octx.strokeStyle = '#ff7a1a'; this.octx.lineWidth = 2; this.octx.beginPath(); this.octx.moveTo(split, t.y); this.octx.lineTo(split, t.y + t.h); this.octx.stroke(); this.octx.restore();
  if (this._qaMove) drawMovePreview(this); if (this._qaLasso || this.selection) drawSelection(this);
};
function drawSelection(editor) { const points = editor._qaLasso || editor.selection?.points; if (!points?.length) return; const d = Math.min(devicePixelRatio || 1, 2); editor.octx.save(); editor.octx.setTransform(d,0,0,d,0,0); editor.octx.strokeStyle='#f4f6f8'; editor.octx.setLineDash([5,4]); editor.octx.beginPath(); const first=editor.pointFromUV(points[0].u ?? points[0].x/editor.doc.width, points[0].v ?? points[0].y/editor.doc.height); editor.octx.moveTo(first.x,first.y); for(const q of points.slice(1)){const p=editor.pointFromUV(q.u ?? q.x/editor.doc.width,q.v ?? q.y/editor.doc.height);editor.octx.lineTo(p.x,p.y);} if(!editor._qaLasso)editor.octx.closePath(); editor.octx.stroke(); editor.octx.restore(); }
function drawMovePreview(editor) { const d=Math.min(devicePixelRatio||1,2),t=editor.transform(),m=editor._qaMove; editor.ctx.save();editor.ctx.setTransform(d,0,0,d,0,0);editor.ctx.globalAlpha=.82;editor.ctx.drawImage(m.source,t.x+m.dx*editor.zoom,t.y+m.dy*editor.zoom,t.w,t.h);editor.ctx.restore(); }

ModelViewer.prototype.hitUV = function (hit) {
  if (!hit) return null; if (this.uvSetName === 'uv' && hit.uv) return hit.uv.clone(); if (this.uvSetName === 'uv1' && hit.uv1) return hit.uv1.clone();
  const g = hit.object.geometry, attr = uvAttr(g, this.uvSetName), pos = g.getAttribute('position'); if (!attr || !pos || !Number.isInteger(hit.faceIndex)) return hit.uv?.clone() || null;
  const vi = ids(g, hit.faceIndex), a = new THREE.Vector3().fromBufferAttribute(pos, vi[0]), b = new THREE.Vector3().fromBufferAttribute(pos, vi[1]), c = new THREE.Vector3().fromBufferAttribute(pos, vi[2]), local = hit.object.worldToLocal(hit.point.clone()), bary = new THREE.Vector3(); THREE.Triangle.getBarycoord(local, a, b, c, bary); if (!Number.isFinite(bary.x)) return null;
  return new THREE.Vector2(attr.getX(vi[0]), attr.getY(vi[0])).multiplyScalar(bary.x).add(new THREE.Vector2(attr.getX(vi[1]), attr.getY(vi[1])).multiplyScalar(bary.y)).add(new THREE.Vector2(attr.getX(vi[2]), attr.getY(vi[2])).multiplyScalar(bary.z));
};
ModelViewer.prototype.down = function (e) { if (e.button !== 0) return; if (this.tool === 'paint3d') { const h=this.ray(e),uv=this.hitUV(h); if(!h||!uv)return;this.painting=true;this.controls.enabled=false;this.onPaintUV?.({u:uv.x,v:uv.y,pressure:e.pressure||1,start:true,udim:1001+Math.floor(uv.x)+Math.floor(uv.y)*10,mesh:h.object,faceIndex:h.faceIndex});return;} if(this.tool!=='select')return;const h=this.ray(e);if(h)this.select(this.faceInfo(h.object,h.faceIndex)); };
ModelViewer.prototype.move = function (e) { if(this.tool==='paint3d'&&this.painting){const h=this.ray(e),uv=this.hitUV(h);if(h&&uv)this.onPaintUV?.({u:uv.x,v:uv.y,pressure:e.pressure||1,udim:1001+Math.floor(uv.x)+Math.floor(uv.y)*10,mesh:h.object,faceIndex:h.faceIndex});return;} if(e.buttons)return;const h=this.ray(e);if(!h){this.hoverLine.visible=false;this.onFaceHover?.(null);return;}const info=this.faceInfo(h.object,h.faceIndex);if(info){this.highlight(this.hoverLine,info);this.onFaceHover?.(info);} };

const oldDescribe = ModelViewer.prototype.describeModel;
ModelViewer.prototype.describeModel = function () { const data=oldDescribe.call(this),missing=this.meshes.filter(m=>!uvAttr(m.geometry,this.uvSetName));data.hasAnyUV=missing.length<this.meshes.length;data.hasUV=missing.length===0&&this.meshes.length>0;data.allMeshesHaveUV=missing.length===0;data.missingUVMeshes=missing;return data; };
const oldSetModel = ModelViewer.prototype.setModel;
ModelViewer.prototype.setModel = function (root, animations=[]) { if(this.modelRoot&&this.modelRoot!==root){this.modelRoot.traverse(o=>{if(!o.isMesh)return;o.geometry?.dispose?.();for(const m of mats(o)){if(!m)continue;for(const v of Object.values(m))if(v?.isTexture&&v.userData?.uvmapOwned)v.dispose?.();m.dispose?.();}});} this.selectedLine.visible=false;this.hoverLine.visible=false;return oldSetModel.call(this,root,animations); };

const oldLoadFile = ModelViewer.prototype.loadFile;
ModelViewer.prototype.loadFile = async function (file) {
  const ext=file.name.split('.').pop().toLowerCase(); if(!['glb','gltf'].includes(ext))return oldLoadFile.call(this,file);
  this.sourceFile=file;this.sourceType=ext;const draco=new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.185.0/examples/jsm/libs/draco/');const ktx=new KTX2Loader().setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.185.0/examples/jsm/libs/basis/');ktx.detectSupport(this.renderer);const loader=new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx).setMeshoptDecoder(MeshoptDecoder);
  try { const data=ext==='gltf'?await file.text():await file.arrayBuffer();const result=await new Promise((ok,no)=>loader.parse(data,'',ok,no));this.setModel(result.scene,result.animations||[]);if(!this.meshes.length)throw new Error('No mesh was found in this model.');return this.describeModel(); }
  catch(e){if(ext==='gltf'&&/fetch|buffer|image|resource|404/i.test(String(e?.message||e)))throw new Error('This GLTF references external files. Use a self-contained GLB for now.');throw e;} finally{draco.dispose();ktx.dispose();}
};

ModelViewer.prototype._qaCopyTexture = function (from,to) { if(!from?.isTexture)return to;for(const k of ['wrapS','wrapT','magFilter','minFilter','channel','rotation','matrixAutoUpdate','generateMipmaps','premultiplyAlpha','unpackAlignment'])if(k in from)to[k]=from[k];to.repeat?.copy(from.repeat);to.offset?.copy(from.offset);to.center?.copy(from.center);to.matrix?.copy(from.matrix);return to; };
ModelViewer.prototype.applyCanvasToMap = function (canvas,key='map') { let count=0;this.meshes.forEach(mesh=>{if(!uvAttr(mesh.geometry,this.uvSetName))return;mats(mesh).forEach(mat=>{if(!mat)return;const old=mat[key],t=this._qaCopyTexture(old,new THREE.CanvasTexture(canvas));t.flipY=false;t.colorSpace=['map','emissiveMap','specularColorMap'].includes(key)?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());t.needsUpdate=true;t.userData.uvmapOwned=true;mat[key]=t;if(key==='map'){mat.color?.setRGB?.(1,1,1);try{const d=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height).data;for(let i=3;i<d.length;i+=Math.max(4,Math.floor(d.length/65536/4)*4)){if(d[i]<250){mat.transparent=true;break;}}}catch{}}if(key==='alphaMap')mat.transparent=true;mat.needsUpdate=true;if(old?.userData?.uvmapOwned)old.dispose?.();count++;});});return count; };

function installUiFixes() {
  const icons={select:['ads_click','V'],brush:['brush','B'],eraser:['backspace','E'],paint3d:['format_paint','P'],eyedropper:['colorize','I'],fill:['format_color_fill','G'],line:['horizontal_rule','L'],rect:['crop_square','R'],ellipse:['circle','O'],lasso:['gesture',''],move:['control_camera','M']};
  const names=[...new Set(Object.values(icons).map(x=>x[0]).concat('menu'))].sort().join(',');const link=document.createElement('link');link.rel='stylesheet';link.href=`https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&icon_names=${names}&display=block`;document.head.append(link);
  document.querySelectorAll('.tool-button[data-tool]').forEach(b=>{const [i,k]=icons[b.dataset.tool]||['circle',''];b.innerHTML=`<span class="material-symbols-outlined qa-tool-icon">${i}</span><small>${k}</small>`;});
  const style=document.createElement('style');style.textContent=`.qa-tool-icon{font-size:20px!important;font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 20}.tool-button[data-tool=line] .qa-tool-icon{transform:rotate(-45deg)}#qaMobilePanel{display:none}.qa-compare{display:flex;align-items:center;gap:5px}.qa-compare input{width:90px}.resize-handle{left:auto!important;top:auto!important;right:0;bottom:0;cursor:nwse-resize}@media(max-width:900px){#qaMobilePanel{display:grid}}`;document.head.append(style);
  const mobile=document.createElement('button');mobile.id='qaMobilePanel';mobile.className='icon-button';mobile.innerHTML='<span class="material-symbols-outlined">menu</span>';mobile.title='Properties';mobile.onclick=()=>$('propertiesPanel')?.classList.toggle('mobile-open');document.querySelector('.topbar-left')?.prepend(mobile);
  setupPanelWindowing(); setupCompare(); setupNewProjectSafety();
}
function setupCompare(){const tex=window.__uvmapTex;if(!tex)return;const wrap=document.createElement('label');wrap.className='qa-compare hidden';wrap.innerHTML='<span>Before</span><input type="range" min="0" max="100" value="50"><span>After</span>';$('uvCoordinateLabel')?.before(wrap);wrap.querySelector('input').oninput=e=>tex.setComparePosition(e.target.value/100);const sync=()=>{const on=$('uvPanel')?.classList.contains('compare-mode');tex.setCompare(on);wrap.classList.toggle('hidden',!on||!tex.versions?.[0]);};$('compareButton')?.addEventListener('click',()=>setTimeout(sync));$('compareToolButton')?.addEventListener('click',()=>setTimeout(sync));}
function setupPanelWindowing(){const panel=$('uvPanel'),header=panel?.querySelector('.uv-panel-header'),handle=$('uvResizeHandle'),host=$('viewportWrap');if(!panel||!header||!handle||!host)return;let a=null;const start=(e,type)=>{if(e.button!==0||panel.classList.contains('maximized')||e.target.closest('button,select,input'))return;const p=panel.getBoundingClientRect(),h=host.getBoundingClientRect();a={type,sx:e.clientX,sy:e.clientY,l:p.left-h.left,t:p.top-h.top,w:p.width,h:p.height};e.preventDefault();};header.addEventListener('pointerdown',e=>start(e,'move'));handle.addEventListener('pointerdown',e=>{e.stopPropagation();start(e,'resize')});window.addEventListener('pointermove',e=>{if(!a)return;const r=host.getBoundingClientRect(),dx=e.clientX-a.sx,dy=e.clientY-a.sy;let l=a.l,t=a.t,w=a.w,h=a.h;if(a.type==='move'){l+=dx;t+=dy}else{w+=dx;h+=dy}w=Math.max(300,Math.min(w,r.width-8));h=Math.max(260,Math.min(h,r.height-8));l=Math.max(4,Math.min(l,r.width-w-4));t=Math.max(4,Math.min(t,r.height-h-4));Object.assign(panel.style,{left:`${l}px`,top:`${t}px`,right:'auto',bottom:'auto',width:`${w}px`,height:`${h}px`});window.__uvmapTex?.resize();});window.addEventListener('pointerup',()=>a=null);}
function setupNewProjectSafety(){const maybeReset=e=>{if(!window.__uvmapViewer?.modelRoot||!$('dashboard')||$('dashboard').classList.contains('hidden'))return;e.preventDefault();e.stopImmediatePropagation();sessionStorage.setItem('uvmap-new-after-reload','1');location.reload();};$('newProjectButton')?.addEventListener('click',maybeReset,true);$('heroUploadButton')?.addEventListener('click',maybeReset,true);if(sessionStorage.getItem('uvmap-new-after-reload')){sessionStorage.removeItem('uvmap-new-after-reload');setTimeout(()=>$('modelFileInput')?.click(),250);}}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(installUiFixes));else setTimeout(installUiFixes);
