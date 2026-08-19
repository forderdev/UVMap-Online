import { ModelViewer } from './model-viewer.js';

const ORBIT_NONE = -1;

function pointerIds(controls) {
  return Array.isArray(controls?._pointers) ? [...controls._pointers] : [];
}

function orbitLooksStuck(viewer) {
  const controls = viewer?.controls;
  if (!controls) return false;
  return controls.enabled === false || controls.state !== ORBIT_NONE || pointerIds(controls).length > 0 || viewer.painting === true;
}

ModelViewer.prototype.recoverOrbitInput = function (reason = 'pointer-recovery', options = {}) {
  const controls = this.controls;
  if (!controls || !orbitLooksStuck(this)) return false;

  const ids = pointerIds(controls);
  const wasPainting = this.painting === true;
  const doc = this.canvas?.ownerDocument || document;

  if (controls._onPointerMove) doc.removeEventListener('pointermove', controls._onPointerMove);
  if (controls._onPointerUp) doc.removeEventListener('pointerup', controls._onPointerUp);

  if (options.releaseCapture !== false && this.canvas?.releasePointerCapture) {
    for (const id of ids) {
      try {
        if (!this.canvas.hasPointerCapture || this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
      } catch {}
    }
  }

  if (Array.isArray(controls._pointers)) controls._pointers.length = 0;
  if (controls._pointerPositions && typeof controls._pointerPositions === 'object') {
    for (const key of Object.keys(controls._pointerPositions)) delete controls._pointerPositions[key];
  }

  controls.state = ORBIT_NONE;
  if ('_controlActive' in controls) controls._controlActive = false;
  this.painting = false;
  controls.enabled = true;

  if (wasPainting) {
    try { this.onPaintUV?.({ end: true, cancelled: true, reason }); } catch (error) { console.warn('Could not finish interrupted 3D paint stroke', error); }
  }

  controls.update?.();
  return true;
};

function installOrbitRecovery(viewer) {
  if (!viewer?.canvas || viewer._orbitRecoveryInstalled) return;
  viewer._orbitRecoveryInstalled = true;

  const canvas = viewer.canvas;

  // A new middle mouse press must always be able to start a fresh orbit.
  // If an earlier pointer release was missed, repair the stale state before
  // OrbitControls receives this new pointerdown event.
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 1) return;
    if (!orbitLooksStuck(viewer)) return;
    viewer._orbitRecoveryIgnoreLostUntil = performance.now() + 80;
    viewer.recoverOrbitInput('middle-button-retry', { releaseCapture: false });
  }, true);

  canvas.addEventListener('pointercancel', () => {
    queueMicrotask(() => viewer.recoverOrbitInput('pointer-cancel'));
  });

  canvas.addEventListener('lostpointercapture', () => {
    if ((viewer._orbitRecoveryIgnoreLostUntil || 0) > performance.now()) return;
    queueMicrotask(() => viewer.recoverOrbitInput('lost-pointer-capture'));
  });

  window.addEventListener('pointerup', event => {
    if (event.buttons !== 0) return;
    setTimeout(() => viewer.recoverOrbitInput('missed-pointer-up'), 0);
  });

  window.addEventListener('blur', () => viewer.recoverOrbitInput('window-blur'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') viewer.recoverOrbitInput('document-hidden');
  });
}

const originalResize = ModelViewer.prototype.resize;
ModelViewer.prototype.resize = function (...args) {
  installOrbitRecovery(this);
  return originalResize.apply(this, args);
};
