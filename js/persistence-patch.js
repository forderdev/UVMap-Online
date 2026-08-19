import './qa-patch.js';
import { TextureEditor } from './texture-editor.js';

const originalLoadImageSource = TextureEditor.prototype.loadImageSource;
TextureEditor.prototype.loadImageSource = async function (...args) {
  const result = await originalLoadImageSource.apply(this, args);
  const pending = window.__uvmapPendingEditorState;
  if (pending && this.restorePersistentState) {
    window.__uvmapPendingEditorState = null;
    try {
      await this.restorePersistentState(pending);
    } catch (error) {
      console.warn('Could not restore saved editor state', error);
    }
  }
  return result;
};
