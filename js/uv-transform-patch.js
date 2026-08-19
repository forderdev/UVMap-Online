import { ModelViewer } from './model-viewer.js';
import { TextureEditor } from './texture-editor.js';

const $=id=>document.getElementById(id);
const mats=mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material];
const propOf=key=>String(key||'map').replace(/__g\d+$/,'');
const groupFor=(texture,prop)=>texture?.userData?.uvmapGroupKeys?.[prop];
function activeKey(){return $('textureMapSelect')?.value||'map';}
function textureFor(mesh,key=activeKey()){
  const prop=propOf(key),grouped=String(key).includes('__g');for(const mat of mats(mesh)){const texture=mat?.[prop];if(!texture?.isTexture)continue;if(!grouped||groupFor(texture,prop)===key)return texture;}return null;
}
function keyForMesh(mesh,key=activeKey()){
  const prop=propOf(key);for(const mat of mats(mesh)){const texture=mat?.[prop];if(texture?.isTexture)return groupFor(texture,prop)||key;}return null;
}
function transformed(texture,uv){
  if(!texture)return uv.clone();texture.updateMatrix?.();const tu=Math.floor(uv.x),tv=Math.floor(uv.y),isTile=tu!==0||tv!==0;
  if(!isTile){const out=uv.clone();texture.transformUv?.(out);return out;}
  const out=uv.clone();out.x-=tu;out.y-=tv;texture.transformUv?.(out);out.x+=tu;out.y+=tv;return out;
}
function meshMatches(mesh,key=activeKey()){return !String(key).includes('__g')||Boolean(textureFor(mesh,key));}

const faceBase=ModelViewer.prototype.faceInfo;
ModelViewer.prototype.faceInfo=function(mesh,faceIndex){const info=faceBase.call(this,mesh,faceIndex);if(!info)return info;const texture=textureFor(mesh);if(!texture)return info;info.rawUvs=info.uvs.map(v=>v.clone());info.uvs=info.rawUvs.map(v=>transformed(texture,v));return info;};

const hitBase=ModelViewer.prototype.hitUV;
ModelViewer.prototype.hitUV=function(hit){const uv=hitBase.call(this,hit);return uv&&hit?.object?transformed(textureFor(hit.object),uv):uv;};

ModelViewer.prototype.findFaceByUV=function(u,v){
  const point={x:u,y:v},key=activeKey();for(const mesh of this.meshes){if(!meshMatches(mesh,key))continue;const position=mesh.geometry.getAttribute('position');if(!position)continue;const count=Math.floor((mesh.geometry.index?.count||position.count)/3);for(let faceIndex=0;faceIndex<count;faceIndex++){const info=this.faceInfo(mesh,faceIndex);if(!info?.uvs)continue;const [a,b,c]=info.uvs;const v0x=c.x-a.x,v0y=c.y-a.y,v1x=b.x-a.x,v1y=b.y-a.y,v2x=point.x-a.x,v2y=point.y-a.y,d00=v0x*v0x+v0y*v0y,d01=v0x*v1x+v0y*v1y,d02=v0x*v2x+v0y*v2y,d11=v1x*v1x+v1y*v1y,d12=v1x*v2x+v1y*v2y,den=d00*d11-d01*d01;if(Math.abs(den)<1e-10)continue;const q=(d11*d02-d01*d12)/den,r=(d00*d12-d01*d02)/den;if(q>=0&&r>=0&&q+r<=1)return info;}}
  return null;
};

const trianglesBase=TextureEditor.prototype.setUVTriangles;
TextureEditor.prototype.setUVTriangles=function(triangles){const viewer=window.__uvmapViewer,key=activeKey();if(viewer)triangles=(triangles||[]).filter(t=>meshMatches(t.mesh,key)).map(t=>viewer.faceInfo(t.mesh,t.faceIndex)||t);return trianglesBase.call(this,triangles);};

function rebuildTriangles(viewer,editor){const triangles=[];for(const mesh of viewer.meshes){if(!meshMatches(mesh))continue;const attr=mesh.geometry.getAttribute(viewer.uvSetName)||mesh.geometry.getAttribute('uv'),position=mesh.geometry.getAttribute('position');if(!attr||!position)continue;const count=Math.floor((mesh.geometry.index?.count||position.count)/3);for(let faceIndex=0;faceIndex<count;faceIndex++)triangles.push({mesh,faceIndex});}editor.setUVTriangles(triangles);}

function setupAutoMaterialSwitch(){
  const viewer=window.__uvmapViewer,editor=window.__uvmapTex,select=$('textureMapSelect');if(!viewer||!editor||!select)return;
  const selectBase=select.onchange;select.onchange=async event=>{const result=selectBase?await selectBase.call(select,event):undefined;rebuildTriangles(viewer,editor);return result;};
  const previous=viewer.onFaceSelect;
  viewer.onFaceSelect=info=>{const target=info?.mesh?keyForMesh(info.mesh):null;if(target&&target!==select.value&&[...select.options].some(o=>o.value===target)&&typeof select.onchange==='function'){select.value=target;Promise.resolve(select.onchange({target:select,type:'change'})).then(()=>previous?.(viewer.faceInfo(info.mesh,info.faceIndex)||info));return;}previous?.(info);};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(setupAutoMaterialSwitch));else setTimeout(setupAutoMaterialSwitch);
