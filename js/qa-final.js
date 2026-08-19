import * as THREE from 'three';
import { ModelViewer } from './model-viewer.js';
import { TextureEditor } from './texture-editor.js';

const $ = id => document.getElementById(id);
const mats = mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material];
const ids = (g, f) => g.index ? [g.index.getX(f * 3), g.index.getX(f * 3 + 1), g.index.getX(f * 3 + 2)] : [f * 3, f * 3 + 1, f * 3 + 2];
const uvAttr = (g, name = 'uv') => g.getAttribute(name) || (name === 'uv' ? null : g.getAttribute('uv'));

const describeModelWithQa = ModelViewer.prototype.describeModel;
ModelViewer.prototype.describeModel = function () {
  const data = describeModelWithQa.call(this);
  data.hasUV = Boolean(data.hasAnyUV);
  return data;
};

ModelViewer.prototype.highlight = function (line, info) {
  if (!info) { line.visible = false; return; }
  const points = ids(info.mesh.geometry, info.faceIndex).map(index => {
    const target = new THREE.Vector3();
    if (typeof info.mesh.getVertexPosition === 'function') info.mesh.getVertexPosition(index, target);
    else target.fromBufferAttribute(info.mesh.geometry.getAttribute('position'), index);
    return info.mesh.localToWorld(target);
  });
  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry().setFromPoints(points);
  line.visible = true;
};

const loadTextureFileWithQa = ModelViewer.prototype.loadTextureFile;
ModelViewer.prototype.loadTextureFile = async function (...args) {
  window.__uvmapTextureLoadPending = (window.__uvmapTextureLoadPending || 0) + 1;
  try { return await loadTextureFileWithQa.apply(this, args); }
  finally { window.__uvmapTextureLoadPending = Math.max(0, (window.__uvmapTextureLoadPending || 1) - 1); }
};

const textureToCanvasWithQa = ModelViewer.prototype.textureToCanvas;
ModelViewer.prototype.textureToCanvas = async function (texture) {
  const direct = await textureToCanvasWithQa.call(this, texture);
  if (direct || !texture?.isTexture) return direct;
  const image = texture.image || texture.source?.data || {};
  const mip = texture.mipmaps?.[0] || {};
  const width = image.width || mip.width;
  const height = image.height || mip.height;
  if (!width || !height) return null;
  const target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: false, stencilBuffer: false });
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false });
  scene.add(new THREE.Mesh(geometry, material));
  const previous = this.renderer.getRenderTarget();
  try {
    this.renderer.setRenderTarget(target);
    this.renderer.clear();
    this.renderer.render(scene, camera);
    const pixels = new Uint8Array(width * height * 4);
    this.renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
    const flipped = new Uint8ClampedArray(pixels.length);
    const stride = width * 4;
    for (let y = 0; y < height; y++) flipped.set(pixels.subarray((height - 1 - y) * stride, (height - y) * stride), y * stride);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').putImageData(new ImageData(flipped, width, height), 0, 0);
    return canvas;
  } catch (error) {
    console.warn('Could not rasterize compressed texture', error);
    return null;
  } finally {
    this.renderer.setRenderTarget(previous);
    target.dispose();
    geometry.dispose();
    material.dispose();
  }
};

ModelViewer.prototype.applyTextureObject = function (source, key = 'map') {
  let count = 0;
  this.meshes.forEach(mesh => {
    if (!uvAttr(mesh.geometry, this.uvSetName)) return;
    mats(mesh).forEach(mat => {
      if (!mat) return;
      const old = mat[key];
      const texture = source.clone();
      this._qaCopyTexture?.(old, texture);
      texture.flipY = false;
      texture.colorSpace = ['map', 'emissiveMap', 'specularColorMap'].includes(key) ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      texture.needsUpdate = true;
      texture.userData.uvmapOwned = true;
      mat[key] = texture;
      this.prepareMaterial?.(mesh, mat, key);
      if (key === 'map' || key === 'alphaMap') mat.transparent = true;
      mat.needsUpdate = true;
      if (old?.userData?.uvmapOwned) old.dispose?.();
      count++;
    });
  });
  return count;
};

ModelViewer.prototype.applyCanvasToMap = function (canvas, key = 'map') {
  let count = 0;
  this.meshes.forEach(mesh => {
    if (!uvAttr(mesh.geometry, this.uvSetName)) return;
    mats(mesh).forEach(mat => {
      if (!mat) return;
      const old = mat[key];
      let texture;
      if (old?.isTexture && old.userData?.uvmapOwned) {
        texture = old;
        texture.image = canvas;
      } else {
        texture = new THREE.CanvasTexture(canvas);
        this._qaCopyTexture?.(old, texture);
        texture.userData.uvmapOwned = true;
        mat[key] = texture;
      }
      texture.flipY = false;
      texture.colorSpace = ['map', 'emissiveMap', 'specularColorMap'].includes(key) ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      texture.needsUpdate = true;
      if (key === 'map') {
        mat.color?.setRGB?.(1, 1, 1);
        mat.transparent = true;
      }
      if (key === 'alphaMap') mat.transparent = true;
      mat.needsUpdate = true;
      count++;
    });
  });
  return count;
};

const changedWithQa = TextureEditor.prototype.changed;
TextureEditor.prototype.changed = function (type, notify = true) {
  changedWithQa.call(this, type, notify);
  if (notify || type !== 'Paint' || this._qaLivePaintTimer) return;
  this._qaLivePaintTimer = setTimeout(() => {
    this._qaLivePaintTimer = null;
    this.onChange?.({ type: 'Paint Live', canvas: this.composite() });
  }, 33);
};

function syncTextureMapSelector() {
  const viewer = window.__uvmapViewer;
  const select = $('textureMapSelect');
  if (!viewer || !select) return;
  const maps = viewer.getAvailableTextureMaps?.() || [];
  if (!maps.length) return;
  const current = select.value || 'map';
  select.innerHTML = '';
  for (const map of maps) {
    const option = document.createElement('option');
    option.value = map.key;
    option.textContent = map.label;
    select.append(option);
  }
  select.value = maps.some(x => x.key === current) ? current : maps[0].key;
  select.classList.toggle('hidden', maps.length <= 1);
}

function installFinalQa() {
  $('textureFileInput')?.addEventListener('change', () => setTimeout(syncTextureMapSelector, 500));
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') window.__uvmapTex?.cancelActiveOperation?.();
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (event.key.toLowerCase() === 'q') document.querySelector('.tool-button[data-tool="lasso"]')?.click();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installFinalQa);
else installFinalQa();
