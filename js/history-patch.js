import { TextureEditor } from './texture-editor.js';

function push(editor,label,before){const after=editor.snapshot();editor.history.push({label,before,after,time:Date.now()});if(editor.history.length>60)editor.history.shift();editor.redoStack=[];editor.onHistory?.(editor.history);}
let opacityTimer=null,opacityEditor=null,opacityBefore=null;
function flushOpacity(){if(!opacityEditor||!opacityBefore)return;clearTimeout(opacityTimer);push(opacityEditor,'Layer Opacity',opacityBefore);opacityTimer=null;opacityEditor=null;opacityBefore=null;}
function wrap(name,label){const original=TextureEditor.prototype[name];TextureEditor.prototype[name]=function(...args){flushOpacity();if(name==='deleteLayer'&&this.layers.length<=1)return original.apply(this,args);const before=this.snapshot();const result=original.apply(this,args);push(this,label,before);return result;};}
wrap('addLayer','Add Layer');
wrap('duplicateLayer','Duplicate Layer');
wrap('deleteLayer','Delete Layer');
wrap('setLayerVisible','Layer Visibility');
wrap('setLayerLocked','Layer Lock');
wrap('setLayerBlend','Blend Mode');

const opacityBase=TextureEditor.prototype.setLayerOpacity;
TextureEditor.prototype.setLayerOpacity=function(...args){if(opacityEditor!==this){flushOpacity();opacityEditor=this;opacityBefore=this.snapshot();}const result=opacityBase.apply(this,args);clearTimeout(opacityTimer);opacityTimer=setTimeout(flushOpacity,220);return result;};

const undoBase=TextureEditor.prototype.undo;
TextureEditor.prototype.undo=function(){flushOpacity();return undoBase.call(this);};
const redoBase=TextureEditor.prototype.redo;
TextureEditor.prototype.redo=function(){flushOpacity();return redoBase.call(this);};

const versionBase=TextureEditor.prototype.applyVersion;
TextureEditor.prototype.applyVersion=function(id){
  flushOpacity();const version=this.versions.find(v=>v.id===id);if(!version)return;
  const before=this.snapshot(),previousHistory=[...this.history];versionBase.call(this,id);const after=this.snapshot();
  this.history=[...previousHistory,{label:'Apply Version',before,after,time:Date.now()}].slice(-60);this.redoStack=[];this.onHistory?.(this.history);
};
