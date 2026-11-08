# Aircraft models

## Singapore Airlines A380

- File: `a380.glb` (user-supplied `singapore_airlines_a380.glb`, copied without binary modification).
- Title: **Singapore Airlines A380**.
- Author: **zairiq-zairiq-123-pixar-cars-bfdi** — https://sketchfab.com/zairiqzairiqpixarcarsbfdi
- Source: https://sketchfab.com/3d-models/singapore-airlines-a380-fd047ccf175c4db5b7e3e400c67c47a0
- License: **Creative Commons Attribution 4.0 International (CC BY 4.0)** — https://creativecommons.org/licenses/by/4.0/
- Attribution is taken from the supplied GLB's embedded metadata. The game adjusts scale, orientation and landing-gear visibility at runtime. No endorsement is implied.

## Su-30 inspired low-poly fighter

- File: `su30.glb`.
- Author: **Lunar Courier project**.
- License: **CC0 1.0** — https://creativecommons.org/publicdomain/zero/1.0/
- Original simplified geometry: twin engines, twin fins, swept wings, canards, tandem canopy and separate landing gear. No externally downloaded fighter mesh is included.
- Rebuild with Node 22+: `node scripts/build-su30.mjs` from the repository root. The script uses the project's pinned Three.js dependency and exports a self-contained GLB.

## Original fictional aircraft fleet

- Files: `t6.glb`, `b62.glb`, `c24.glb`, `d9.glb`.
- Author: **Lunar Courier project**.
- License: **CC0 1.0** — https://creativecommons.org/publicdomain/zero/1.0/
- T-6: low-wing single-propeller trainer with a bubble canopy.
- B-62: twin rear-engine business jet with winglets and a high tailplane.
- C-24: high-wing twin-turboprop transport with a rear cargo ramp.
- D-9: single-engine delta-wing fighter with canards.
- Original fictional designs; these identifiers do not represent certified real-world aircraft. No external meshes or textures are used.
- Rebuild with Node 22+: `node scripts/build-aircraft-fleet.mjs`. Static geometry is batched by material; landing gear and propeller groups remain separate for runtime animation. Combined GLB size is approximately 255 kB.

In-game aircraft dimensions, performance and flight assistance are tuned for gameplay.
