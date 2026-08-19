import './qa-patch.js';
import './qa-final.js';
import { TextureEditor } from './texture-editor.js';

const originalLoadImageSource = TextureEditor.prototype.loadImageSource;
let restoreTimer = null;

TextureEditor.prototype.loadImageSource = async function (...args) {
  const result = await originalLoadImageSource.apply(this, args);
  if (restoreTimer) clearTimeout(restoreTimer);
  const pending = window.__uvmapPendingEditorState;
  if (pending && this.restorePersistentState) {
    restoreTimer = setTimeout(async () => {
      if (window.__uvmapPendingEditorState !== pending) return;
      try {
        await this.restorePersistentState(pending);
        window.__uvmapPendingEditorState = null;
      } catch (error) {
        console.warn('Could not restore saved editor state', error);
      } finally {
        restoreTimer = null;
      }
    }, 350);
  }
  return result;
};
