import { TextureEditor } from './texture-editor.js';

function cloneLayer(layer){const canvas=document.createElement('canvas');canvas.width=layer.canvas.width;canvas.height=layer.canvas.height;canvas.getContext('2d').drawImage(layer.canvas,0,0);return{...layer,canvas};}
function push(editor,entry){editor.history.push({...entry,time:Date.now()});if(editor.history.length>60)editor.history.shift();editor.redoStack=[];editor.onHistory?.(editor.history);}
let opacityTimer=null,opacityState=null;
function flushOpacity(){if(!opacityState)return;clearTimeout(opacityTimer);const{editor,layerId,before}=opacityState,layer=editor.layers.find(l=>l.id===layerId);if(layer&&layer.opacity!==before)push(editor,{kind:'layer-meta',label:'Layer Opacity',layerId,property:'opacity',beforeValue:before,afterValue:layer.opacity});opacityState=null;opacityTimer=null;}
TextureEditor.prototype.flushPendingLayerHistory=flushOpacity;

function wrapMeta(name,label,property){const original=TextureEditor.prototype[name];TextureEditor.prototype[name]=function(id,value){flushOpacity();const layer=this.layers.find(l=>l.id===id)||this.activeLayer;if(!layer)return original.call(this,id,value);const before=layer[property],result=original.call(this,id,value),after=layer[property];if(after!==before)push(this,{kind:'layer-meta',label,layerId:layer.id,property,beforeValue:before,afterValue:after});if(name==='setLayerLocked'&&after!==before)this.changed('Layer Lock');return result;};}
wrapMeta('setLayerVisible','Layer Visibility','visible');
wrapMeta('setLayerLocked','Layer Lock','locked');
const blendBase=TextureEditor.prototype.setLayerBlend;
TextureEditor.prototype.setLayerBlend=function(value){flushOpacity();const layer=this.activeLayer;if(!layer)return;const before=layer.blend,result=blendBase.call(this,value),after=layer.blend;if(after!==before)push(this,{kind:'layer-meta',label:'Blend Mode',layerId:layer.id,property:'blend',beforeValue:before,afterValue:after});return result;};

const addBase=TextureEditor.prototype.addLayer;
TextureEditor.prototype.addLayer=function(...args){flushOpacity();const previousActive=this.activeLayerId,result=addBase.apply(this,args),layer=this.activeLayer;if(layer)push(this,{kind:'layer-add',label:'Add Layer',layer:cloneLayer(layer),index:this.layers.findIndex(l=>l.id===layer.id),previousActive,afterActive:this.activeLayerId});return result;};
const duplicateBase=TextureEditor.prototype.duplicateLayer;
TextureEditor.prototype.duplicateLayer=function(...args){flushOpacity();const previousActive=this.activeLayerId,beforeIds=new Set(this.layers.map(l=>l.id)),result=duplicateBase.apply(this,args),layer=this.layers.find(l=>!beforeIds.has(l.id));if(layer)push(this,{kind:'layer-add',label:'Duplicate Layer',layer:cloneLayer(layer),index:this.layers.findIndex(l=>l.id===layer.id),previousActive,afterActive:this.activeLayerId});return result;};
const deleteBase=TextureEditor.prototype.deleteLayer;
TextureEditor.prototype.deleteLayer=function(...args){flushOpacity();if(this.layers.length<=1)return deleteBase.apply(this,args);const index=this.layers.findIndex(l=>l.id===this.activeLayerId),deleted=this.layers[index]?cloneLayer(this.layers[index]):null,previousActive=this.activeLayerId,result=deleteBase.apply(this,args);if(deleted)push(this,{kind:'layer-delete',label:'Delete Layer',layer:deleted,index,previousActive,afterActive:this.activeLayerId});return result;};

const opacityBase=TextureEditor.prototype.setLayerOpacity;
TextureEditor.prototype.setLayerOpacity=function(value){const layer=this.activeLayer;if(!layer)return;if(!opacityState||opacityState.editor!==this||opacityState.layerId!==layer.id){flushOpacity();opacityState={editor:this,layerId:layer.id,before:layer.opacity};}const result=opacityBase.call(this,value);clearTimeout(opacityTimer);opacityTimer=setTimeout(flushOpacity,220);return result;};

const undoBase=TextureEditor.prototype.undo;
TextureEditor.prototype.undo=function(){flushOpacity();return undoBase.call(this);};
const redoBase=TextureEditor.prototype.redo;
TextureEditor.prototype.redo=function(){flushOpacity();return redoBase.call(this);};

const versionBase=TextureEditor.prototype.applyVersion;
TextureEditor.prototype.applyVersion=function(id){
  flushOpacity();const version=this.versions.find(v=>v.id===id);if(!version)return;
  const before=this.snapshot(),previousHistory=[...this.history];versionBase.call(this,id);const after=this.snapshot();
  this.history=[...previousHistory,{kind:'snapshot',label:'Apply Version',before,after,time:Date.now()}].slice(-60);this.redoStack=[];this.onHistory?.(this.history);
};
