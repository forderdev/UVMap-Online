import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const fixtureDir = resolve('.qa-fixtures');
mkdirSync(fixtureDir, { recursive: true });
const modelPath = resolve(fixtureDir, 'orbit-triangle.obj');
writeFileSync(modelPath, [
  'v -1 -1 0',
  'v 1 -1 0',
  'v 0 1 0',
  'vt 0 0',
  'vt 1 0',
  'vt 0.5 1',
  'f 1/1 2/2 3/3',
  '',
].join('\n'));

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

async function cameraPosition() {
  return page.evaluate(() => window.__uvmapViewer.camera.position.toArray());
}

async function middleOrbit(dx = 90, dy = 32) {
  const canvas = page.locator('#viewportCanvas');
  const box = await canvas.boundingBox();
  assert.ok(box && box.width > 100 && box.height > 100, '3D viewport must be visible');
  const x = box.x + box.width * 0.56;
  const y = box.y + box.height * 0.28;
  const before = await cameraPosition();
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up({ button: 'middle' });
  await page.waitForTimeout(120);
  const after = await cameraPosition();
  assert.ok(distance(before, after) > 0.001, `middle mouse orbit did not move camera: ${before} -> ${after}`);
}

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__uvmapViewer && typeof window.__uvmapViewer.recoverOrbitInput === 'function', null, { timeout: 60000 });
  await page.setInputFiles('#modelFileInput', modelPath);
  await page.waitForFunction(() => !document.getElementById('editor').classList.contains('hidden') && window.__uvmapViewer.meshes.length === 1, null, { timeout: 30000 });

  await middleOrbit();

  await page.evaluate(() => {
    const viewer = window.__uvmapViewer;
    const controls = viewer.controls;
    controls.enabled = false;
    controls.state = 0;
    controls._pointers.length = 0;
    controls._pointers.push(98765);
    controls._pointerPositions[98765] = { x: 10, y: 10 };
    window.dispatchEvent(new Event('blur'));
  });
  await page.waitForTimeout(50);

  const recoveredAfterBlur = await page.evaluate(() => {
    const viewer = window.__uvmapViewer;
    return {
      enabled: viewer.controls.enabled,
      state: viewer.controls.state,
      pointers: viewer.controls._pointers.length,
      painting: viewer.painting,
    };
  });
  assert.deepEqual(recoveredAfterBlur, { enabled: true, state: -1, pointers: 0, painting: false });
  await middleOrbit(-76, 26);

  // Simulate the harder case where an old mouse pointer remains registered,
  // but no blur or cancel event was delivered. The next M3 press must heal
  // the stale state before OrbitControls processes that pointerdown.
  await page.evaluate(() => {
    const controls = window.__uvmapViewer.controls;
    controls.enabled = true;
    controls.state = 0;
    controls._pointers.length = 0;
    controls._pointers.push(76543);
    controls._pointerPositions[76543] = { x: 20, y: 20 };
  });
  await middleOrbit(64, -30);

  const finalState = await page.evaluate(() => {
    const controls = window.__uvmapViewer.controls;
    return { enabled: controls.enabled, state: controls.state, pointers: controls._pointers.length };
  });
  assert.deepEqual(finalState, { enabled: true, state: -1, pointers: 0 });
  console.log('UVMap orbit recovery QA passed');
} finally {
  await browser.close();
}
