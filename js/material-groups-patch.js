import * as THREE from 'three';
import { ModelViewer } from './model-viewer.js';

const MAPS=[['map','Base Color'],['normalMap','Normal'],['roughnessMap','Roughness'],['metalnessMap','Metallic'],['aoMap','Ambient Occlusion'],['emissiveMap','Emissive'],['specularMap','Specular'],['specularColorMap','Specular Color'],['alphaMap','Alpha'],['bumpMap','Bump'],['displacementMap','Displacement'],['lightMap','Light']];
const mats=mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material];
const uvAttr=(g,name='uv')=>g.getAttribute(name)||(name==='uv'?null:g.getAttribute('uv'));
const propOf=key=>String(key||'map').replace(/__g\d+$/,'');
const groupOf=key=>String(key).includes('__g')?String(key):`${propOf(key)}__g0`;
const getGroup=(texture,prop)=>texture?.userData?.uvmapGroupKeys?.[prop];
const setGroup=(texture,prop,key)=>{texture.userData=texture.userData||{};texture.userData.uvmapGroupKeys=texture.userData.uvmapGroupKeys||{};texture.userData.uvmapGroupKeys[prop]=key;};

function buildGroups(viewer){
  const output=[];
  for(const [prop,label] of MAPS){
    const groups=[],byTexture=new Map(),byKey=new Map();
    for(const mesh of viewer.meshes){for(const mat of mats(mesh)){const texture=mat?.[prop];if(!texture?.isTexture)continue;let key=getGroup(texture,prop);if(key&&key.startsWith(`${prop}__g`)){let group=byKey.get(key);if(!group){group={key,label,texture,names:new Set()};groups.push(group);byKey.set(key,group);}if(mat.name)group.names.add(mat.name);continue;}let group=byTexture.get(texture);if(!group){key=`${prop}__g${groups.length}`;group={key,label,texture,names:new Set()};groups.push(group);byTexture.set(texture,group);byKey.set(key,group);setGroup(texture,prop,key);}if(mat.name)group.names.add(mat.name);}}
    const multiple=groups.length>1;groups.forEach((group,index)=>{const name=[...group.names][0]||`Material ${index+1}`;output.push({key:multiple?group.key:prop,label:multiple?`${label} · ${name}`:label,texture:group.texture,property:prop,groupKey:group.key});});
  }
  return output;
}

ModelViewer.prototype.getAvailableTextureMaps=function(){return buildGroups(this);};

function eachTarget(viewer,key,callback){
  const prop=propOf(key),grouped=String(key).includes('__g');if(grouped)buildGroups(viewer);
  for(const mesh of viewer.meshes){if(!uvAttr(mesh.geometry,viewer.uvSetName))continue;for(const mat of mats(mesh)){if(!mat)continue;if(grouped&&getGroup(mat[prop],prop)!==key)continue;callback(mesh,mat,prop);}}
}

ModelViewer.prototype.applyTextureObject=function(source,key='map'){
  const groupKey=groupOf(key);let count=0;eachTarget(this,key,(mesh,mat,prop)=>{const old=mat[prop],texture=source.clone();this._qaCopyTexture?.(old,texture);texture.flipY=false;texture.colorSpace=['map','emissiveMap','specularColorMap'].includes(prop)?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());texture.needsUpdate=true;texture.userData=texture.userData||{};texture.userData.uvmapOwned=true;setGroup(texture,prop,groupKey);mat[prop]=texture;this.prepareMaterial?.(mesh,mat,prop);if(prop==='map'||prop==='alphaMap')mat.transparent=true;mat.needsUpdate=true;if(old?.userData?.uvmapOwned)old.dispose?.();count++;});return count;
};

ModelViewer.prototype.applyCanvasToMap=function(canvas,key='map'){
  const groupKey=groupOf(key);let count=0;eachTarget(this,key,(mesh,mat,prop)=>{const old=mat[prop];let texture;if(old?.isTexture&&old.userData?.uvmapOwned){texture=old;texture.image=canvas;}else{texture=new THREE.CanvasTexture(canvas);this._qaCopyTexture?.(old,texture);texture.userData.uvmapOwned=true;mat[prop]=texture;}setGroup(texture,prop,groupKey);texture.flipY=false;texture.colorSpace=['map','emissiveMap','specularColorMap'].includes(prop)?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());texture.needsUpdate=true;if(prop==='map'){mat.color?.setRGB?.(1,1,1);mat.transparent=true;}if(prop==='alphaMap')mat.transparent=true;mat.needsUpdate=true;count++;});return count;
};
