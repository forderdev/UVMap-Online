import { ModelViewer } from './model-viewer.js';

const $ = id => document.getElementById(id);

const describeModelWithQa = ModelViewer.prototype.describeModel;
ModelViewer.prototype.describeModel = function () {
  const data = describeModelWithQa.call(this);
  data.hasUV = Boolean(data.hasAnyUV);
  return data;
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
    if (event.key.toLowerCase() === 'q') {
      document.querySelector('.tool-button[data-tool="lasso"]')?.click();
    }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installFinalQa);
else installFinalQa();
