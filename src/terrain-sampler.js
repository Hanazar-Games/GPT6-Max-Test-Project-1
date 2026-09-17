export function createGroundSampler(points) {
  const segments = points.slice(1).map((b, i) => ({ a: points[i], b, index: i }));
  const build = segments => {
    const node = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
    for (const { a, b } of segments) {
      node.minX = Math.min(node.minX, a.x, b.x); node.maxX = Math.max(node.maxX, a.x, b.x);
      node.minZ = Math.min(node.minZ, a.z, b.z); node.maxZ = Math.max(node.maxZ, a.z, b.z);
    }
    if (segments.length <= 8) node.segments = segments;
    else {
      const axis = node.maxX - node.minX > node.maxZ - node.minZ ? 'x' : 'z';
      segments.sort((p, q) => p.a[axis] + p.b[axis] - q.a[axis] - q.b[axis]);
      const middle = Math.floor(segments.length / 2);
      node.left = build(segments.slice(0, middle)); node.right = build(segments.slice(middle));
    }
    return node;
  };
  const root = build(segments);
  return (x, z) => {
    const bound = node => Math.max(node.minX - x, 0, x - node.maxX) ** 2 + Math.max(node.minZ - z, 0, z - node.maxZ) ** 2;
    let nearest = Infinity, y = 0, low = Infinity, index = Infinity;
    const visit = node => {
      if (bound(node) > Math.max(nearest, 42 ** 2)) return;
      if (node.segments) {
        for (const { a, b, index: id } of node.segments) {
          const dx = b.x - a.x, dz = b.z - a.z;
          const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
          const d = (a.x + dx * t - x) ** 2 + (a.z + dz * t - z) ** 2;
          const level = a.y + (b.y - a.y) * t;
          if (d < nearest || d === nearest && id < index) { nearest = d; y = level; index = id; }
          if (d < 42 ** 2) low = Math.min(low, level);
        }
      } else {
        const first = bound(node.left) < bound(node.right) ? node.left : node.right;
        visit(first); visit(first === node.left ? node.right : node.left);
      }
    };
    visit(root);
    return { y: Math.min(y, low), distance: Math.sqrt(nearest) };
  };
}
