import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(String(error)));

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__uvmapViewer && document.querySelector('.hero-card'), null, { timeout: 60000 });

  const dragState = await page.evaluate(() => {
    const zone = document.querySelector('.hero-card');
    const transfer = new DataTransfer();
    const obj = [
      'o DropTest',
      'v -1 -1 0',
      'v 1 -1 0',
      'v 0 1 0',
      'vt 0 0',
      'vt 1 0',
      'vt 0.5 1',
      'f 1/1 2/2 3/3',
    ].join('\n');
    transfer.items.add(new File([obj], 'drop-test.obj', { type: 'text/plain' }));
    zone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    const activeDuringDrag = zone.classList.contains('model-drop-active');
    zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    return { activeDuringDrag };
  });

  assert.equal(dragState.activeDuringDrag, true);
  await page.waitForFunction(() => window.__uvmapViewer.meshes.length === 1 && document.getElementById('modelNameBadge')?.textContent === 'drop-test.obj', null, { timeout: 30000 });

  const state = await page.evaluate(() => ({
    sourceType: window.__uvmapViewer.sourceType,
    triangles: window.__uvmapViewer.describeModel().triangleCount,
    hasUV: window.__uvmapViewer.describeModel().hasUV,
    editorVisible: !document.getElementById('editor').classList.contains('hidden'),
    dropHighlightCleared: !document.querySelector('.hero-card').classList.contains('model-drop-active'),
  }));

  assert.equal(state.sourceType, 'obj');
  assert.equal(state.triangles, 1);
  assert.equal(state.hasUV, true);
  assert.equal(state.editorVisible, true);
  assert.equal(state.dropHighlightCleared, true);
  assert.deepEqual(pageErrors, []);
  console.log('UVMap drag and drop QA passed');
} finally {
  await browser.close();
}
