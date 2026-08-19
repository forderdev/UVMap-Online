import { ModelViewer } from './model-viewer.js';

const loadMtlBase=ModelViewer.prototype.loadMtlFile;
ModelViewer.prototype.loadMtlFile=async function(file){const result=await loadMtlBase.call(this,file);window.__uvmapCurrentMtlFile=file;return result;};

const loadFileBase=ModelViewer.prototype.loadFile;
ModelViewer.prototype.loadFile=async function(file){
  const ext=file.name.split('.').pop().toLowerCase();
  if(ext!=='obj')window.__uvmapCurrentMtlFile=null;
  const result=await loadFileBase.call(this,file);
  if(ext==='obj'&&window.__uvmapPendingMtlFile){const mtl=window.__uvmapPendingMtlFile;window.__uvmapPendingMtlFile=null;return this.loadMtlFile(mtl);}
  return result;
};
