import * as THREE from 'three';

export function terrainElevation(geometry, x, z) {
  const { width, height, widthSegments: columns, heightSegments: rows } = geometry.parameters;
  const bounds = geometry.boundingBox;
  const u = (x - bounds.min.x) / width * columns, v = (z - bounds.min.z) / height * rows;
  if (u < 0 || v < 0 || u > columns || v > rows) return null;
  const col = Math.min(columns - 1, Math.floor(u)), row = Math.min(rows - 1, Math.floor(v));
  const tx = u - col, tz = v - row, index = row * (columns + 1) + col;
  const positions = geometry.attributes.position;
  const a = positions.getY(index), b = positions.getY(index + columns + 1), c = positions.getY(index + columns + 2), d = positions.getY(index + 1);
  return tx + tz <= 1 ? a + (d - a) * tx + (b - a) * tz : c + (b - c) * (1 - tx) + (d - c) * (1 - tz);
}

export function makeSurfaceTexture() {
  const size = 128, data = new Uint8Array(size * size * 4);
  let seed = 713;
  for (let i = 0; i < size * size; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const value = 190 + (seed >>> 26);
    data.set([value, value, value, 255], i * 4);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function makeReflectionMap(tint) {
  const width = 128, height = 64, data = new Uint8Array(width * height * 4);
  const sky = new THREE.Color(tint).lerp(new THREE.Color('#bdd9ed'), 0.7);
  const ground = new THREE.Color('#152431'), color = new THREE.Color();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const altitude = Math.cos(y / (height - 1) * Math.PI);
    const horizon = Math.exp(-altitude * altitude * 32) * 0.4;
    const sun = Math.exp(-((x / width - 0.72) ** 2 * 260 + (y / height - 0.3) ** 2 * 180));
    color.copy(ground).lerp(sky, Math.max(0, altitude)).multiplyScalar(0.65).addScalar(horizon + sun * 2);
    data.set([Math.min(255, color.r * 255), Math.min(255, color.g * 255), Math.min(255, color.b * 255), 255], (y * width + x) * 4);
  }
  const texture = new THREE.DataTexture(data, width, height);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
