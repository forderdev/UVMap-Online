import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as THREE from 'three';
import { ModelViewer } from './model-viewer.js';

const loadBase=ModelViewer.prototype.loadFile;
function fileKey(value){try{return decodeURIComponent(String(value).split(/[?#]/)[0]).replace(/\\/g,'/').split('/').pop().toLowerCase();}catch{return String(value).replace(/\\/g,'/').split('/').pop().toLowerCase();}}
ModelViewer.prototype.loadFile=async function(file){
  const ext=file.name.split('.').pop().toLowerCase();if(!['gltf','glb'].includes(ext))return loadBase.call(this,file);
  this.sourceFile=file;this.sourceType=ext;const candidates=window.__uvmapPendingModelFiles?.length?window.__uvmapPendingModelFiles:[file],byName=new Map(candidates.map(f=>[fileKey(f.name),f])),urls=[];
  const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{const match=byName.get(fileKey(url));if(!match)return url;const blob=URL.createObjectURL(match);urls.push(blob);return blob;});
  const draco=new DRACOLoader(manager).setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.185.0/examples/jsm/libs/draco/'),ktx=new KTX2Loader(manager).setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.185.0/examples/jsm/libs/basis/');ktx.detectSupport(this.renderer);const loader=new GLTFLoader(manager).setDRACOLoader(draco).setKTX2Loader(ktx).setMeshoptDecoder(MeshoptDecoder);
  try{const data=ext==='gltf'?await file.text():await file.arrayBuffer(),result=await new Promise((ok,no)=>loader.parse(data,'',ok,no));this.setModel(result.scene,result.animations||[]);if(!this.meshes.length)throw new Error('No mesh was found in this model.');return this.describeModel();}
  catch(error){const message=String(error?.message||error);if(ext==='gltf'&&/fetch|buffer|image|resource|404|failed to load/i.test(message))throw new Error('A GLTF dependency could not be found. Select the .gltf together with its .bin and image files.');throw error;}
  finally{urls.forEach(URL.revokeObjectURL);draco.dispose();ktx.dispose();window.__uvmapPendingModelFiles=null;}
};

function setup(){
  const input=document.getElementById('modelFileInput'),viewport=document.getElementById('viewportWrap');if(input){input.multiple=true;input.accept='.glb,.gltf,.fbx,.obj,.bin,.png,.jpg,.jpeg,.webp,.ktx2,.basis';const original=input.onchange;input.onchange=function(event){let files=[...input.files],model=files.find(f=>/\.(glb|gltf|fbx|obj)$/i.test(f.name));if(model&&files[0]!==model&&typeof DataTransfer!=='undefined'){try{const dt=new DataTransfer();dt.items.add(model);files.filter(f=>f!==model).forEach(f=>dt.items.add(f));input.files=dt.files;files=[...input.files];}catch{}}window.__uvmapPendingModelFiles=files;return original?.call(input,event);};}
  viewport?.addEventListener('drop',event=>{window.__uvmapPendingModelFiles=[...event.dataTransfer.files];},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
