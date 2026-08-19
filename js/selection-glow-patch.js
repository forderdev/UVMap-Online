import * as THREE from 'three';
import { ModelViewer } from './model-viewer.js';

const ids = (geometry, faceIndex) => geometry.index
  ? [geometry.index.getX(faceIndex * 3), geometry.index.getX(faceIndex * 3 + 1), geometry.index.getX(faceIndex * 3 + 2)]
  : [faceIndex * 3, faceIndex * 3 + 1, faceIndex * 3 + 2];

function facePoints(info) {
  if (!info?.mesh?.geometry || !Number.isInteger(info.faceIndex)) return null;
  const position = info.mesh.geometry.getAttribute('position');
  if (!position) return null;
  info.mesh.updateWorldMatrix(true, false);
  return ids(info.mesh.geometry, info.faceIndex).map(index => {
    const point = new THREE.Vector3();
    if (typeof info.mesh.getVertexPosition === 'function') info.mesh.getVertexPosition(index, point);
    else point.fromBufferAttribute(position, index);
    return info.mesh.localToWorld(point);
  });
}

function writeTriangle(object, points) {
  if (!points?.length) return false;
  let attribute = object.geometry?.getAttribute('position');
  if (!attribute || attribute.count !== 3) {
    object.geometry?.dispose?.();
    object.geometry = new THREE.BufferGeometry();
    object.geometry.setAttribute('position', new THREE.Float32BufferAttribute(9, 3));
    attribute = object.geometry.getAttribute('position');
  }
  for (let i = 0; i < 3; i++) attribute.setXYZ(i, points[i].x, points[i].y, points[i].z);
  attribute.needsUpdate = true;
  object.visible = true;
  return true;
}

function ensureGlow(viewer, line) {
  const selected = line === viewer.selectedLine;
  const key = selected ? '_qaSelectedGlow' : '_qaHoverGlow';
  if (viewer[key]) return viewer[key];
  const material = new THREE.MeshBasicMaterial({
    color: selected ? 0xff7a1a : 0x5bdcff,
    transparent: true,
    opacity: selected ? 0.48 : 0.34,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    toneMapped: false,
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(9, 3));
  const glow = new THREE.Mesh(geometry, material);
  glow.name = selected ? 'UVMap Selected Face Glow' : 'UVMap Hover Face Glow';
  glow.visible = false;
  glow.frustumCulled = false;
  glow.renderOrder = selected ? 997 : 996;
  viewer.scene.add(glow);
  viewer[key] = glow;
  return glow;
}

function updateHighlight(viewer, line, info) {
  const glow = ensureGlow(viewer, line);
  if (!info) {
    line.visible = false;
    glow.visible = false;
    return;
  }
  const points = facePoints(info);
  if (!points) {
    line.visible = false;
    glow.visible = false;
    return;
  }
  writeTriangle(line, points);
  writeTriangle(glow, points);
}

ModelViewer.prototype.highlight = function (line, info) {
  if (line === this.hoverLine) this._qaHoverFace = info || null;
  if (line === this.selectedLine && info) this.selectedFace = info;
  updateHighlight(this, line, info);
};

const setModelBase = ModelViewer.prototype.setModel;
ModelViewer.prototype.setModel = function (...args) {
  this.selectedFace = null;
  this._qaHoverFace = null;
  if (this.selectedLine) this.selectedLine.visible = false;
  if (this.hoverLine) this.hoverLine.visible = false;
  if (this._qaSelectedGlow) this._qaSelectedGlow.visible = false;
  if (this._qaHoverGlow) this._qaHoverGlow.visible = false;
  return setModelBase.apply(this, args);
};

ModelViewer.prototype.render = function () {
  if (this.mixer) this.mixer.update(Math.min(this.clock.getDelta(), 0.05));
  this.controls.update();

  if (this.selectedFace && this.selectedLine?.visible) updateHighlight(this, this.selectedLine, this.selectedFace);
  else if (this._qaSelectedGlow) this._qaSelectedGlow.visible = false;

  if (this._qaHoverFace && this.hoverLine?.visible) {
    const sameAsSelected = this.selectedFace
      && this.selectedFace.mesh === this._qaHoverFace.mesh
      && this.selectedFace.faceIndex === this._qaHoverFace.faceIndex;
    updateHighlight(this, this.hoverLine, this._qaHoverFace);
    if (sameAsSelected && this._qaHoverGlow) this._qaHoverGlow.visible = false;
  } else if (this._qaHoverGlow) {
    this._qaHoverGlow.visible = false;
  }

  this.renderer.render(this.scene, this.camera);
};
