import { TextureEditor } from './texture-editor.js';

const RASTER=new Set(['brush','eraser','fill','line','rect','ellipse']);
const SHAPES=new Set(['line','rect','ellipse']);
function cloneCanvas(src){const c=document.createElement('canvas');c.width=src.width;c.height=src.height;c.getContext('2d').drawImage(src,0,0);return c;}
function activeSnapshot(editor){const layer=editor.activeLayer;return layer?[{...layer,canvas:cloneCanvas(layer.canvas)}]:[];}
function withActiveSnapshot(editor,callback){const own=Object.prototype.hasOwnProperty.call(editor,'snapshot'),previous=editor.snapshot;editor.snapshot=()=>activeSnapshot(editor);try{return callback();}finally{if(own)editor.snapshot=previous;else delete editor.snapshot;}}
function expand(editor,x0,y0,x1,y1){const b=editor._qaRasterBounds;if(!b)editor._qaRasterBounds={x0,y0,x1,y1};else{b.x0=Math.min(b.x0,x0);b.y0=Math.min(b.y0,y0);b.x1=Math.max(b.x1,x1);b.y1=Math.max(b.y1,y1);}}
function clampBounds(editor){const b=editor._qaRasterBounds;if(!b)return null;const x=Math.max(0,Math.floor(b.x0)),y=Math.max(0,Math.floor(b.y0)),x1=Math.min(editor.doc.width,Math.ceil(b.x1)),y1=Math.min(editor.doc.height,Math.ceil(b.y1));const w=x1-x,h=y1-y;return w>0&&h>0?{x,y,w,h}:null;}
function push(editor,entry){editor.history.push(entry);if(editor.history.length>60)editor.history.shift();editor.redoStack=[];editor.onHistory?.(editor.history);}

const dotBase=TextureEditor.prototype.dot;
TextureEditor.prototype.dot=function(p,pressure=1){const radius=Math.max(.5,this.size*(this.pressureSize?Math.max(.15,pressure):1)/2)+2;expand(this,p.x-radius,p.y-radius,p.x+radius,p.y+radius);return dotBase.call(this,p,pressure);};

const downBase=TextureEditor.prototype.down;
TextureEditor.prototype.down=function(e){
  if(e.button===0&&RASTER.has(this.tool)){
    this._qaRasterBounds=null;const p=this.screenToUV(e);this._qaRasterStart=p;this._qaRasterEnd=p;
    if(this.tool==='fill')this._qaRasterBounds={x0:0,y0:0,x1:this.doc.width,y1:this.doc.height};
    return withActiveSnapshot(this,()=>downBase.call(this,e));
  }
  return downBase.call(this,e);
};

const moveBase=TextureEditor.prototype.move;
TextureEditor.prototype.move=function(e){if(this.dragging&&SHAPES.has(this.tool))this._qaRasterEnd=this.screenToUV(e);return moveBase.call(this,e);};

const upBase=TextureEditor.prototype.up;
TextureEditor.prototype.up=function(e){
  if(this.dragging&&SHAPES.has(this.tool)){
    const p=e?.clientX!=null?this.screenToUV(e):(this._qaRasterEnd||this._qaRasterStart);this._qaRasterEnd=p;const a=this._qaRasterStart||p,r=this.size/2+3;expand(this,Math.min(a.x,p.x)-r,Math.min(a.y,p.y)-r,Math.max(a.x,p.x)+r,Math.max(a.y,p.y)+r);
  }
  return upBase.call(this,e);
};

const paintBase=TextureEditor.prototype.paintUV;
TextureEditor.prototype.paintUV=function(u,v,pressure=1,start=false,meta={}){if(start){this._qaRasterBounds=null;return withActiveSnapshot(this,()=>paintBase.call(this,u,v,pressure,start,meta));}return paintBase.call(this,u,v,pressure,start,meta);};

TextureEditor.prototype.finish=function(label){
  this.dragging=false;
  if(this.strokeBefore){
    const beforeLayers=this.strokeBefore,bounds=clampBounds(this),layer=this.activeLayer,beforeLayer=layer&&beforeLayers.find(x=>x.id===layer.id);
    if(bounds&&beforeLayer&&beforeLayers.length===1){
      try{
        const beforeData=beforeLayer.canvas.getContext('2d').getImageData(bounds.x,bounds.y,bounds.w,bounds.h);const afterData=layer.canvas.getContext('2d').getImageData(bounds.x,bounds.y,bounds.w,bounds.h);
        push(this,{kind:'pixels',label,layerId:layer.id,...bounds,beforeData,afterData,time:Date.now()});
      }catch(error){const after=this.snapshot();push(this,{kind:'snapshot',label,before:beforeLayers,after,time:Date.now()});}
    }else{
      const after=this.snapshot();push(this,{kind:'snapshot',label,before:beforeLayers,after,time:Date.now()});
    }
    this.strokeBefore=null;this.changed(label);
  }
  this.last=null;this._qaRasterBounds=null;this._qaRasterStart=null;this._qaRasterEnd=null;this.render();
};

function applyPixels(editor,entry,data){const layer=editor.layers.find(l=>l.id===entry.layerId);if(!layer)return false;layer.canvas.getContext('2d').putImageData(data,entry.x,entry.y);return true;}
TextureEditor.prototype.undo=function(){
  this.flushPendingLayerHistory?.();const h=this.history.pop();if(!h)return;this.redoStack.push(h);
  if(h.kind==='pixels'){applyPixels(this,h,h.beforeData);this.changed('Undo');}else this.restore(h.before);
  this.onHistory?.(this.history);
};
TextureEditor.prototype.redo=function(){
  this.flushPendingLayerHistory?.();const h=this.redoStack.pop();if(!h)return;this.history.push(h);
  if(h.kind==='pixels'){applyPixels(this,h,h.afterData);this.changed('Redo');}else this.restore(h.after);
  this.onHistory?.(this.history);
};
