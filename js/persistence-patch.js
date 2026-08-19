import './qa-patch.js';
import './qa-final.js';
import { TextureEditor } from './texture-editor.js';

const originalLoadImageSource = TextureEditor.prototype.loadImageSource;
let restoreTimer = null;

function scheduleRestore(editor, pending) {
  if (restoreTimer) clearTimeout(restoreTimer);
  restoreTimer = setTimeout(async () => {
    if (window.__uvmapPendingEditorState !== pending) { restoreTimer = null; return; }
    if ((window.__uvmapTextureLoadPending || 0) > 0) { scheduleRestore(editor, pending); return; }
    try {
      await editor.restorePersistentState(pending);
      window.__uvmapPendingEditorState = null;
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
