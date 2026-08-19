import * as THREE from 'three';
import { ModelViewer } from './model-viewer.js';
import { TextureEditor } from './texture-editor.js';

const $=id=>document.getElementById(id);
const mats=mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material];
const propOf=key=>String(key||'map').replace(/__g\d+$/,'');
const groupFor=(texture,prop)=>texture?.userData?.uvmapGroupKeys?.[prop];
function activeKey(){return $('textureMapSelect')?.value||'map';}
function materialForFace(mesh,faceIndex){if(!Array.isArray(mesh.material))return mesh.material;const slot=faceIndex*3,group=mesh.geometry.groups?.find(g=>slot>=g.start&&slot<g.start+g.count),index=group?.materialIndex??0;return mesh.material[index]||mesh.material[0];}
function textureForFace(mesh,faceIndex,key=activeKey()){
  const prop=propOf(key),grouped=String(key).includes('__g'),mat=materialForFace(mesh,faceIndex),texture=mat?.[prop];if(texture?.isTexture&&(!grouped||groupFor(texture,prop)===key))return texture;return null;
}
function keyForFace(mesh,faceIndex,key=activeKey()){
  const prop=propOf(key),texture=materialForFace(mesh,faceIndex)?.[prop];if(!texture?.isTexture)return null;if(!String(key).includes('__g'))return key;return groupFor(texture,prop)||key;
}
function wrap(value,mode){if(value>=0&&value<=1)return value;if(mode===THREE.RepeatWrapping)return value-Math.floor(value);if(mode===THREE.ClampToEdgeWrapping)return value<0?0:1;if(mode===THREE.MirroredRepeatWrapping){const whole=Math.floor(value);return Math.abs(whole)%2===1?Math.ceil(value)-value:value-whole;}return value;}
function transformLocal(texture,uv){
  if(texture.matrixAutoUpdate)texture.updateMatrix?.();const out=uv.clone(),base=texture.userData?.uvmapAtlasBaseMatrix;
  if(base?.length===9)out.applyMatrix3(new THREE.Matrix3().fromArray(base));else out.applyMatrix3(texture.matrix);
  out.x=wrap(out.x,texture.wrapS);out.y=wrap(out.y,texture.wrapT);if(texture.flipY)out.y=1-out.y;return out;
}
function transformed(texture,uv){if(!texture)return uv.clone();const tu=Math.floor(uv.x),tv=Math.floor(uv.y),local=uv.clone();local.x-=tu;local.y-=tv;const out=transformLocal(texture,local);out.x+=tu;out.y+=tv;return out;}
function faceMatches(mesh,faceIndex,key=activeKey()){return !String(key).includes('__g')||Boolean(textureForFace(mesh,faceIndex,key));}

const faceBase=ModelViewer.prototype.faceInfo;
ModelViewer.prototype.faceInfo=function(mesh,faceIndex){const info=faceBase.call(this,mesh,faceIndex);if(!info)return info;const texture=textureForFace(mesh,faceIndex);if(!texture)return info;info.rawUvs=info.rawUvs||info.uvs.map(v=>v.clone());info.uvs=info.rawUvs.map(v=>transformed(texture,v));const u=info.uvs.reduce((n,v)=>n+v.x,0)/info.uvs.length,v=info.uvs.reduce((n,p)=>n+p.y,0)/info.uvs.length;info.udim=1001+Math.floor(u)+Math.floor(v)*10;info.material=materialForFace(mesh,faceIndex);return info;};

const hitBase=ModelViewer.prototype.hitUV;
ModelViewer.prototype.hitUV=function(hit){const uv=hitBase.call(this,hit);return uv&&hit?.object?transformed(textureForFace(hit.object,hit.faceIndex),uv):uv;};

ModelViewer.prototype.findFaceByUV=function(u,v){
  const point={x:u,y:v},key=activeKey();for(const mesh of this.meshes){const position=mesh.geometry.getAttribute('position');if(!position)continue;const count=Math.floor((mesh.geometry.index?.count||position.count)/3);for(let faceIndex=0;faceIndex<count;faceIndex++){if(!faceMatches(mesh,faceIndex,key))continue;const info=this.faceInfo(mesh,faceIndex);if(!info?.uvs)continue;const [a,b,c]=info.uvs;const v0x=c.x-a.x,v0y=c.y-a.y,v1x=b.x-a.x,v1y=b.y-a.y,v2x=point.x-a.x,v2y=point.y-a.y,d00=v0x*v0x+v0y*v0y,d01=v0x*v1x+v0y*v1y,d02=v0x*v2x+v0y*v2y,d11=v1x*v1x+v1y*v1y,d12=v1x*v2x+v1y*v2y,den=d00*d11-d01*d01;if(Math.abs(den)<1e-10)continue;const q=(d11*d02-d01*d12)/den,r=(d00*d12-d01*d02)/den;if(q>=0&&r>=0&&q+r<=1)return info;}}
  return null;
};

const trianglesBase=TextureEditor.prototype.setUVTriangles;
TextureEditor.prototype.setUVTriangles=function(triangles){const viewer=window.__uvmapViewer,key=activeKey();if(viewer)triangles=(triangles||[]).filter(t=>faceMatches(t.mesh,t.faceIndex,key)).map(t=>viewer.faceInfo(t.mesh,t.faceIndex)||t);return trianglesBase.call(this,triangles);};

function rebuildTriangles(viewer,editor){const triangles=[],key=activeKey();for(const mesh of viewer.meshes){const attr=mesh.geometry.getAttribute(viewer.uvSetName)||mesh.geometry.getAttribute('uv'),position=mesh.geometry.getAttribute('position');if(!attr||!position)continue;const count=Math.floor((mesh.geometry.index?.count||position.count)/3);for(let faceIndex=0;faceIndex<count;faceIndex++)if(faceMatches(mesh,faceIndex,key))triangles.push({mesh,faceIndex});}editor.setUVTriangles(triangles);}

function setupAutoMaterialSwitch(){
  const viewer=window.__uvmapViewer,editor=window.__uvmapTex,select=$('textureMapSelect');if(!viewer||!editor||!select)return;
  const selectBase=select.onchange;select.onchange=async event=>{const result=selectBase?await selectBase.call(select,event):undefined;rebuildTriangles(viewer,editor);return result;};
  const previous=viewer.onFaceSelect;
  viewer.onFaceSelect=info=>{const target=info?.mesh?keyForFace(info.mesh,info.faceIndex):null;if(target&&target!==select.value&&[...select.options].some(o=>o.value===target)&&typeof select.onchange==='function'){select.value=target;Promise.resolve(select.onchange({target:select,type:'change'})).then(()=>previous?.(viewer.faceInfo(info.mesh,info.faceIndex)||info));return;}previous?.(info);};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(setupAutoMaterialSwitch));else setTimeout(setupAutoMaterialSwitch);
