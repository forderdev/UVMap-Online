import './qa-patch.js';
import './qa-final.js';
import './material-groups-patch.js';
import './document-state-patch.js';
import './uv-transform-patch.js';
import './udim-live-patch.js';
import './history-patch.js';
import './raster-history-patch.js';
import './icon-polish-patch.js';
import { TextureEditor } from './texture-editor.js';

const originalLoadImageSource = TextureEditor.prototype.loadImageSource;
let restoreTimer = null;

async function selectSavedDocument() {
  const map = window.__uvmapPendingActiveMap;
  const udim = window.__uvmapPendingActiveUdim;
  const mapSelect = document.getElementById('textureMapSelect');
  const udimSelect = document.getElementById('udimSelect');
  if (map && mapSelect && [...mapSelect.options].some(o => o.value === map)) {
    mapSelect.value = map;
    if (mapSelect.onchange) await mapSelect.onchange({ target: mapSelect, type: 'change' });
  }
  if (udim && udimSelect && [...udimSelect.options].some(o => Number(o.value) === Number(udim))) {
    udimSelect.value = String(udim);
    if (udimSelect.onchange) await udimSelect.onchange({ target: udimSelect, type: 'change' });
  }
}

function scheduleRestore(editor, pending) {
  if (restoreTimer) clearTimeout(restoreTimer);
  restoreTimer = setTimeout(async () => {
    if (window.__uvmapPendingEditorState !== pending) { restoreTimer = null; return; }
    if ((window.__uvmapTextureLoadPending || 0) > 0) { scheduleRestore(editor, pending); return; }
    try {
      await selectSavedDocument();
      await editor.restorePersistentState(pending);
      window.__uvmapPendingEditorState = null;
      window.__uvmapPendingActiveMap = null;
      window.__uvmapPendingActiveUdim = null;
    } catch (error) {
      console.warn('Could not restore saved editor state', error);
    } finally {
      restoreTimer = null;
    }
  }, 350);
}

TextureEditor.prototype.loadImageSource = async function (...args) {
  const result = await originalLoadImageSource.apply(this, args);
  const pending = window.__uvmapPendingEditorState;
  if (pending && this.restorePersistentState) scheduleRestore(this, pending);
  return result;
};
