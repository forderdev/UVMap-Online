# UVMap - Online

UVMap - Online is a local-first browser UV and texture workspace for game modding.

## First version

- Load GLB, GLTF, FBX and OBJ models
- Optional MTL loading for OBJ files
- Detect embedded textures where the browser can decode them
- Load PNG, JPG, JPEG, WebP, BMP, TGA and DDS textures
- Click a 3D surface to outline the matching UV triangle
- Hover between the 3D model and texture view in both directions
- Experimental Auto UV for meshes with no UV coordinates
- Detect Base Color, Normal, Roughness, Metallic, AO, Emissive, Specular, Alpha, Bump, Displacement and Light maps
- Show texture-map controls only when those maps exist
- Multiple UV set selection
- Basic UDIM tile detection
- Mesh visibility, grid, wireframe and studio lighting controls
- Animation playback for models with clips
- 2D brush, eraser, eyedropper, fill, line, rectangle, ellipse, lasso and move tools
- Pen pressure options for brush size and opacity
- Layers with visibility, lock, opacity, duplication and blend modes
- Direct 3D painting through mesh UV coordinates
- Live texture updates on the model
- Per-stroke undo and redo history
- Texture version snapshots
- 15 second IndexedDB autosave
- Local project dashboard
- 30 day trash recovery
- English and Turkish UI, English by default
- Desktop-first interface with an experimental mobile warning
- GLB export marked Safe
- FBX export marked May have some bugs

## Storage

There is no account system and no backend in the first version. Projects are stored locally in IndexedDB. Clearing browser site data can remove them.

## Run locally

This project intentionally has no build step. It uses native JavaScript modules and a pinned Three.js CDN import map.

Run it through a local static web server:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## GitHub Pages

The repository contains `.github/workflows/pages.yml`. Pushes to `main` deploy the static site with GitHub Pages Actions.

If Pages has not been enabled for this repository yet, open repository Settings, go to Pages and choose GitHub Actions as the source.

## Notes

Auto UV is experimental and can create overlapping or inaccurate mapping on complex meshes.

FBX export is experimental and can lose rigs, animation, material or texture details. Use GLB when you need the safer export path.
