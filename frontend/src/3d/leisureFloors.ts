import * as THREE from 'three';

function floorMap(wood: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const c = canvas.getContext('2d')!;
  let seed = 819;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const rows = wood ? 8 : 3, cols = wood ? 2 : 3, w = 1024 / cols, h = 1024 / rows;
  c.fillStyle = wood ? '#9b8063' : '#b2afa6';
  c.fillRect(0, 0, 1024, 1024);
  for (let row = 0; row < rows; row++) {
    for (let col = -1; col <= cols; col++) {
      const x = col * w + (wood ? (row % 2) * w / 2 : 0), y = row * h;
      const variation = random();
      c.fillStyle = wood ? `hsl(32 31% ${53 + variation * 8}%)` : `hsl(39 10% ${73 + variation * 3}%)`;
      c.fillRect(x + 1.2, y + 1.2, w - 2.4, h - 2.4);
      c.save();
      c.beginPath();
      c.rect(x + 1.2, y + 1.2, w - 2.4, h - 2.4);
      c.clip();
      if (wood) {
        const knotX = x + w * (0.2 + random() * 0.6), knotY = y + h * (0.25 + random() * 0.5);
        for (let line = 0; line < 90; line++) {
          const yy = y + random() * h;
          c.strokeStyle = random() > 0.45 ? 'rgba(69,42,22,0.16)' : 'rgba(242,219,180,0.20)';
          c.lineWidth = 0.4 + random() * 1.3;
          c.beginPath();
          for (let t = 0; t <= w; t += 5) {
            const xx = x + t, dx = (xx - knotX) / (w * 0.12), dy = yy - knotY;
            const bend = Math.exp(-dx * dx) * Math.exp(-Math.abs(dy) / 22) * Math.sign(dy) * 14;
            const py = yy + Math.sin(t * 0.025 + line) * 1.6 + bend;
            if (t === 0) c.moveTo(xx, py); else c.lineTo(xx, py);
          }
          c.stroke();
        }
      }
      for (let n = 0; n < 1000; n++) {
        c.fillStyle = random() > 0.5 ? '#ffffff06' : '#00000004';
        c.fillRect(x + random() * w, y + random() * h, wood ? 4 : 2, 1);
      }
      c.restore();
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

export function applyFloorFinishes(floor: THREE.Mesh, deck?: THREE.Mesh, divider: number = -2.4) {
  const insideMap = floorMap(false), outsideMap = floorMap(true);
  const inside = new THREE.MeshStandardMaterial({ map: insideMap, roughness: 0.46, metalness: 0 });
  const outside = new THREE.MeshStandardMaterial({ map: outsideMap, bumpMap: outsideMap, bumpScale: 0.003, roughness: 0.84, metalness: 0 });

  const source = floor.geometry.index ? floor.geometry.toNonIndexed() : floor.geometry;
  const p = source.attributes.position;
  const n = source.attributes.normal;
  const positions: number[] = [], normals: number[] = [], uv: number[] = [], groups: { start: number; count: number; materialIndex: number }[] = [];

  function clip(poly: { p: THREE.Vector3; n: THREE.Vector3 }[], interior: boolean) {
    const result: { p: THREE.Vector3; n: THREE.Vector3 }[] = [];
    const inHalf = (v: { p: THREE.Vector3; n: THREE.Vector3 }) => interior ? v.p.x <= divider : v.p.x >= divider;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], aIn = inHalf(a), bIn = inHalf(b);
      if (aIn) result.push(a);
      if (aIn !== bIn) {
        const t = (divider - a.p.x) / (b.p.x - a.p.x);
        result.push({ p: a.p.clone().lerp(b.p, t), n: a.n.clone().lerp(b.n, t).normalize() });
      }
    }
    return result;
  }

  for (let materialIndex = 0; materialIndex < 2; materialIndex++) {
    const start = positions.length / 3;
    for (let i = 0; i < p.count; i += 3) {
      const tri = [0, 1, 2].map(k => ({
        p: new THREE.Vector3().fromBufferAttribute(p, i + k),
        n: new THREE.Vector3().fromBufferAttribute(n, i + k)
      }));
      const polygon = clip(tri, materialIndex === 0);
      for (let j = 1; j + 1 < polygon.length; j++) {
        for (const v of [polygon[0], polygon[j], polygon[j + 1]]) {
          positions.push(v.p.x, v.p.y, v.p.z);
          normals.push(v.n.x, v.n.y, v.n.z);
          uv.push(v.p.x / 2.4, v.p.z / 2.4);
        }
      }
    }
    groups.push({ start, count: positions.length / 3 - start, materialIndex });
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  groups.forEach(a => g.addGroup(a.start, a.count, a.materialIndex));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  floor.geometry = g;
  floor.material = [inside, outside];
  floor.name = 'Piso: placas internas / réguas externas';

  if (deck) {
    const dp = deck.geometry.attributes.position;
    const duv: number[] = [];
    for (let i = 0; i < dp.count; i++) duv.push(dp.getX(i) / 2.4, dp.getZ(i) / 2.4);
    deck.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(duv, 2));
    deck.material = outside;
  }
}
