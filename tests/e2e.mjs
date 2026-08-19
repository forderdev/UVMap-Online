import { chromium } from 'playwright';
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
function makePng(width = 16, height = 16) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1); raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const i = row + 1 + x * 4; raw[i] = 245; raw[i + 1] = 245; raw[i + 2] = 245; raw[i + 3] = 255;
    }
  }
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function makeFixture(dir) {
  mkdirSync(dir, { recursive: true });
  const bin = Buffer.alloc(68);
  const floats = [-1,-1,0, 1,-1,0, 0,1,0, 0,0, 1,0, 0.5,1];
  floats.forEach((value, index) => bin.writeFloatLE(value, index * 4));
  bin.writeUInt16LE(0, 60); bin.writeUInt16LE(1, 62); bin.writeUInt16LE(2, 64);
  writeFileSync(resolve(dir, 'triangle.bin'), bin);
  writeFileSync(resolve(dir, 'checker.png'), makePng());
  const gltf = {
    asset: { version: '2.0', generator: 'UVMap QA' },
    buffers: [{ uri: 'triangle.bin', byteLength: 68 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 24, target: 34962 },
      { buffer: 0, byteOffset: 60, byteLength: 6, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-1,-1,0], max: [1,1,0] },
      { bufferView: 1, componentType: 5126, count: 3, type: 'VEC2' },
      { bufferView: 2, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    images: [{ uri: 'checker.png' }],
    textures: [{ source: 0 }],
    materials: [{ name: 'White', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 0 }] }],
    nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
  };
  writeFileSync(resolve(dir, 'triangle.gltf'), JSON.stringify(gltf));
}

const fixtureDir = resolve('.qa-fixtures');
makeFixture(fixtureDir);
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(String(error)));

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__uvmapViewer && window.__uvmapTex, null, { timeout: 60000 });

  await page.waitForFunction(() => document.querySelector('[data-tool="eyedropper"] .material-symbols-outlined')?.textContent.trim() === 'colorize');
  assert.equal(await page.locator('[data-tool="eraser"] .material-symbols-outlined').textContent(), 'ink_eraser');

  await page.setInputFiles('#modelFileInput', [resolve(fixtureDir, 'triangle.gltf'), resolve(fixtureDir, 'triangle.bin'), resolve(fixtureDir, 'checker.png')]);
  await page.waitForFunction(() => window.__uvmapViewer.meshes.length === 1 && document.getElementById('modelNameBadge')?.textContent === 'triangle.gltf', null, { timeout: 60000 });
  await page.waitForFunction(() => document.getElementById('textureResolutionLabel')?.textContent.includes('16'), null, { timeout: 30000 });

  const modelInfo = await page.evaluate(() => {
    const viewer = window.__uvmapViewer;
    const info = viewer.describeModel();
    const face = viewer.faceInfo(viewer.meshes[0], 0);
    return { hasUV: info.hasUV, triangles: info.triangleCount, uvCount: face.uvs.length, maps: viewer.getAvailableTextureMaps().map(x => x.key) };
  });
  assert.equal(modelInfo.hasUV, true);
  assert.equal(modelInfo.triangles, 1);
  assert.equal(modelInfo.uvCount, 3);
  assert.ok(modelInfo.maps.includes('map'));

  const originalPixel = await page.evaluate(() => {
    const c = window.__uvmapTex.composite(); return [...c.getContext('2d').getImageData(8, 8, 1, 1).data];
  });
  assert.ok(originalPixel[0] > 200 && originalPixel[1] > 200 && originalPixel[2] > 200);

  await page.evaluate(() => {
    const tex = window.__uvmapTex, viewer = window.__uvmapViewer;
    tex.setTool('brush'); tex.setBrush({ color: '#ff0000', size: 5, opacity: 1, hardness: 1, stabilization: 0, pressureSize: false, pressureOpacity: false });
    const meta = { udim: 1001, mapKey: 'map', mesh: viewer.meshes[0], faceIndex: 0 };
    tex.paintUV(0.5, 0.5, 1, true, meta); tex.end3DStroke();
  });
  await page.waitForTimeout(150);
  const painted = await page.evaluate(() => {
    const tex = window.__uvmapTex, viewer = window.__uvmapViewer, c = tex.composite();
    const editorPixel = [...c.getContext('2d').getImageData(8, 8, 1, 1).data];
    const image = (Array.isArray(viewer.meshes[0].material) ? viewer.meshes[0].material[0] : viewer.meshes[0].material).map.image;
    const modelPixel = image?.getContext ? [...image.getContext('2d').getImageData(8, 8, 1, 1).data] : null;
    return { editorPixel, modelPixel };
  });
  assert.ok(painted.editorPixel[0] > 220 && painted.editorPixel[1] < 80);
  assert.ok(painted.modelPixel && painted.modelPixel[0] > 220 && painted.modelPixel[1] < 80);

  await page.evaluate(() => window.__uvmapTex.undo());
  await page.waitForTimeout(100);
  const undone = await page.evaluate(() => {
    const tex = window.__uvmapTex, viewer = window.__uvmapViewer;
    const editorPixel = [...tex.composite().getContext('2d').getImageData(8, 8, 1, 1).data];
    const image = (Array.isArray(viewer.meshes[0].material) ? viewer.meshes[0].material[0] : viewer.meshes[0].material).map.image;
    const modelPixel = [...image.getContext('2d').getImageData(8, 8, 1, 1).data];
    return { editorPixel, modelPixel };
  });
  assert.ok(undone.editorPixel[1] > 200 && undone.modelPixel[1] > 200);

  const layers = await page.evaluate(() => {
    const tex = window.__uvmapTex, before = tex.layers.length; tex.addLayer('QA Layer'); const added = tex.layers.length; tex.undo(); const undone = tex.layers.length; tex.redo(); const redone = tex.layers.length; return { before, added, undone, redone };
  });
  assert.deepEqual(layers, { before: 1, added: 2, undone: 1, redone: 2 });

  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await page.locator('#exportGlbButton').click({ force: true });
  const download = await downloadPromise;
  assert.ok(download.suggestedFilename().endsWith('.glb'));

  await page.evaluate(() => {
    const tex = window.__uvmapTex, viewer = window.__uvmapViewer; tex.setLayer(tex.layers[0].id); tex.setTool('brush'); tex.setBrush({ color: '#ff0000', size: 5, opacity: 1, hardness: 1, stabilization: 0, pressureSize: false, pressureOpacity: false }); const meta = { udim: 1001, mapKey: 'map', mesh: viewer.meshes[0], faceIndex: 0 }; tex.paintUV(0.5, 0.5, 1, true, meta); tex.end3DStroke();
  });
  await page.locator('#backDashboardButton').click();
  await page.waitForFunction(() => !document.getElementById('dashboard').classList.contains('hidden') && document.querySelectorAll('#projectGrid .project-card').length > 0, null, { timeout: 30000 });
  await page.locator('#projectGrid .project-card').first().click();
  await page.waitForFunction(() => !document.getElementById('editor').classList.contains('hidden') && window.__uvmapViewer.meshes.length === 1, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  const reopened = await page.evaluate(() => [...window.__uvmapTex.composite().getContext('2d').getImageData(8, 8, 1, 1).data]);
  assert.ok(reopened[0] > 220 && reopened[1] < 80, `reopened pixel was ${reopened}`);

  assert.deepEqual(pageErrors, []);
  console.log('UVMap browser QA passed');
} finally {
  await browser.close();
}
