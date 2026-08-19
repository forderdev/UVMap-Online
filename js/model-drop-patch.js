const MODEL_RE = /\.(glb|gltf|fbx|obj)$/i;

function modelFile(files) {
  return [...files].find(file => MODEL_RE.test(file.name));
}

function setInputFiles(input, files, primary) {
  const ordered = primary ? [primary, ...files.filter(file => file !== primary)] : files;
  const transfer = new DataTransfer();
  for (const file of ordered) transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function installDropZone(element, input) {
  if (!element || !input || element.dataset.modelDropInstalled) return;
  element.dataset.modelDropInstalled = 'true';
  let depth = 0;

  const hasFiles = event => [...(event.dataTransfer?.types || [])].includes('Files');
  const activate = () => element.classList.add('model-drop-active');
  const deactivate = () => { depth = 0; element.classList.remove('model-drop-active'); };

  element.addEventListener('dragenter', event => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth++;
    activate();
  });

  element.addEventListener('dragover', event => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    activate();
  });

  element.addEventListener('dragleave', event => {
    if (!hasFiles(event)) return;
    depth = Math.max(0, depth - 1);
    if (!depth) element.classList.remove('model-drop-active');
  });

  element.addEventListener('drop', event => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    deactivate();
    const files = [...(event.dataTransfer?.files || [])];
    const model = modelFile(files);
    if (!model) {
      element.classList.add('model-drop-invalid');
      setTimeout(() => element.classList.remove('model-drop-invalid'), 650);
      return;
    }
    window.__uvmapPendingModelFiles = files;
    setInputFiles(input, files, model);
  });
}

function installStyles() {
  if (document.getElementById('modelDropStyles')) return;
  const style = document.createElement('style');
  style.id = 'modelDropStyles';
  style.textContent = `
    .hero-card, .hero-upload, .viewport-wrap { transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease; }
    .model-drop-active { border-color: #ff7a1a !important; box-shadow: inset 0 0 0 2px rgba(255,122,26,.55), 0 0 30px rgba(255,122,26,.16) !important; }
    .hero-card.model-drop-active, .hero-upload.model-drop-active { background-color: rgba(255,122,26,.06) !important; }
    .model-drop-invalid { animation: uvmap-drop-invalid .22s ease 2; }
    @keyframes uvmap-drop-invalid { 50% { box-shadow: inset 0 0 0 2px rgba(255,75,75,.8); } }
  `;
  document.head.append(style);
}

function install() {
  const input = document.getElementById('modelFileInput');
  if (!input) return;
  input.multiple = true;
  installStyles();
  installDropZone(document.querySelector('.hero-card'), input);
  installDropZone(document.getElementById('heroUploadButton'), input);
  installDropZone(document.getElementById('viewportWrap'), input);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
else install();
