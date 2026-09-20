import * as THREE from 'three';

/** One shared parameterization keeps the two skins and both cut faces watertight. */
export const APPLE_RADIUS = 1.28;
const SEGMENTS = 144;
const RINGS = 64;
export const SEED_CHAMBERS = 5;
export const SEEDS_PER_CHAMBER = 2;

function randomGenerator(seed: number) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}

export function equatorRadius(phi: number): number {
  return APPLE_RADIUS * (1 + 0.025 * Math.cos(5 * phi + 0.3));
}

export function applePoint(theta: number, phi: number): THREE.Vector3 {
  const lobes = 1 + (0.025 + 0.025 * Math.abs(Math.cos(theta))) * Math.cos(5 * phi + 0.3);
  const r = APPLE_RADIUS * Math.sin(theta) * (1 + 0.11 * Math.cos(theta)) * lobes;
  // Indented crown, rounded shoulders and a shallow dimple at the base.
  const y = 1.27 * Math.cos(theta)
    - 0.28 * Math.exp(-Math.pow(theta / 0.27, 2))
    + 0.13 * Math.exp(-Math.pow((Math.PI - theta) / 0.3, 2));
  return new THREE.Vector3(r * Math.cos(phi), Math.abs(y) < 1e-12 ? 0 : y, r * Math.sin(phi));
}

export function makeSkinGeometry(upper: boolean): THREE.BufferGeometry {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let row = 0; row <= RINGS; row++) {
    const theta = (upper ? 0 : Math.PI / 2) + (row / RINGS) * Math.PI / 2;
    for (let col = 0; col <= SEGMENTS; col++) {
      const phi = col / SEGMENTS * Math.PI * 2;
      const p = applePoint(theta, phi);
      positions.push(p.x, p.y, p.z);
      uvs.push(col / SEGMENTS, 1 - theta / Math.PI);
    }
  }
  for (let row = 0; row < RINGS; row++) {
    for (let col = 0; col < SEGMENTS; col++) {
      const a = row * (SEGMENTS + 1) + col, b = a + SEGMENTS + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  // Smooth the duplicated UV seam without changing texture coordinates.
  const normals = g.getAttribute('normal');
  for (let row = 0; row <= RINGS; row++) {
    const a = row * (SEGMENTS + 1), b = a + SEGMENTS;
    const n = new THREE.Vector3().fromBufferAttribute(normals, a)
      .add(new THREE.Vector3().fromBufferAttribute(normals, b)).normalize();
    normals.setXYZ(a, n.x, n.y, n.z); normals.setXYZ(b, n.x, n.y, n.z);
  }
  return g;
}

export function makeCapGeometry(upper: boolean): THREE.BufferGeometry {
  const positions = [0, 0, 0], uvs = [0.5, 0.5], indices: number[] = [];
  const extent = APPLE_RADIUS * 1.06;
  for (let i = 0; i <= SEGMENTS; i++) {
    const phi = i / SEGMENTS * Math.PI * 2;
    const r = equatorRadius(phi);
    const x = r * Math.cos(phi), z = r * Math.sin(phi);
    positions.push(x, 0, z);
    uvs.push(0.5 + x / (extent * 2), 0.5 - z / (extent * 2));
    if (i < SEGMENTS) indices.push(0, upper ? i + 1 : i + 2, upper ? i + 2 : i + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices); g.computeVertexNormals();
  return g;
}

function canvasTexture(size: number, paint: (ctx: CanvasRenderingContext2D, size: number) => void) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  paint(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function skinTexture() {
  return canvasTexture(1024, (ctx, size) => {
    const rand = randomGenerator(72);
    ctx.fillStyle = '#b72c23'; ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x++) {
      const band = Math.sin(x * 0.073 + Math.sin(x * 0.024) * 3) * 0.5 + 0.5;
      const broad = Math.sin(x * 0.013) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(${206 + Math.round(broad * 24)},${69 + Math.round(broad * 18)},32,${0.08 + band * 0.26})`;
      ctx.fillRect(x, 0, 1, size);
    }
    for (let i = 0; i < 8500; i++) {
      const x = rand() * size, y = rand() * size;
      ctx.fillStyle = `rgba(255,217,148,${0.08 + rand() * 0.33})`;
      ctx.beginPath(); ctx.ellipse(x, y, 0.35 + rand() * 1, 0.4 + rand() * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    }
    const crown = ctx.createLinearGradient(0, 0, 0, size);
    crown.addColorStop(0, '#8c70264a'); crown.addColorStop(.15, '#d6872600');
    crown.addColorStop(.8, '#d6872600'); crown.addColorStop(1, '#7c491a65');
    ctx.fillStyle = crown; ctx.fillRect(0, 0, size, size);
  });
}

function fleshTexture() {
  return canvasTexture(1024, (ctx, size) => {
    const rand = randomGenerator(123);
    const c = size / 2, unit = size / (APPLE_RADIUS * 1.06 * 2);
    const gradient = ctx.createRadialGradient(c, c, 15, c, c, c);
    gradient.addColorStop(0, '#f3e3b5'); gradient.addColorStop(.5, '#faf0ce');
    gradient.addColorStop(.92, '#f5e6bc'); gradient.addColorStop(1, '#e2d0a2');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 19000; i++) {
      ctx.fillStyle = rand() > .5 ? '#b9a66a0e' : '#fffdf032';
      ctx.beginPath(); ctx.arc(rand() * size, rand() * size, .4 + rand() * 1.1, 0, Math.PI * 2); ctx.fill();
    }
    // A pale five-lobed core surrounds five separate almond-shaped seed chambers.
    ctx.beginPath();
    for (let i = 0; i <= 360; i++) {
      const a = i / 360 * Math.PI * 2;
      const r = (0.49 + 0.13 * Math.cos(5 * (a + Math.PI / 2))) * unit;
      const x = c + r * Math.cos(a), y = c + r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fillStyle = '#e4cd9370'; ctx.fill();
    ctx.strokeStyle = '#c9ac7055'; ctx.lineWidth = 2.5; ctx.stroke();
    for (let i = 0; i < SEED_CHAMBERS; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / SEED_CHAMBERS;
      ctx.save(); ctx.translate(c, c); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(.12 * unit, 0);
      ctx.bezierCurveTo(.30 * unit, -.15 * unit, .57 * unit, -.145 * unit, .65 * unit, 0);
      ctx.bezierCurveTo(.57 * unit, .145 * unit, .30 * unit, .15 * unit, .12 * unit, 0);
      const pocket = ctx.createLinearGradient(.12 * unit, 0, .65 * unit, 0);
      pocket.addColorStop(0, '#ac8a4e'); pocket.addColorStop(.4, '#ae8952'); pocket.addColorStop(1, '#c6a36e');
      ctx.fillStyle = pocket; ctx.fill(); ctx.strokeStyle = '#d9bc82'; ctx.lineWidth = 5; ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(c, c, .055 * unit, 0, Math.PI * 2);
    ctx.fillStyle = '#c9ad70'; ctx.fill();
    // Thin red perimeter: the cut shows skin thickness rather than an open shell.
    ctx.beginPath();
    for (let i = 0; i <= 360; i++) {
      const a = i / 360 * Math.PI * 2, r = (equatorRadius(a) - .008) * unit;
      if (i === 0) ctx.moveTo(c + r * Math.cos(a), c + r * Math.sin(a));
      else ctx.lineTo(c + r * Math.cos(a), c + r * Math.sin(a));
    }
    ctx.closePath(); ctx.strokeStyle = '#b8432d'; ctx.lineWidth = .022 * unit; ctx.stroke();
  });
}

/** Each ID describes ONE upright seed in the unsliced apple, never one per half. */
export interface SeedSpec {
  id: string;
  chamber: number;
  position: readonly [number, number, number];
  angle: number;
  halfLength: number;
}

export const SEED_SPECS: readonly SeedSpec[] = Array.from({ length: SEED_CHAMBERS }, (_, i) => {
  const angle = -Math.PI / 2 + i * Math.PI * 2 / SEED_CHAMBERS;
  return Array.from({ length: SEEDS_PER_CHAMBER }, (_, j) => {
    const side = (j === 0 ? -1 : 1) * .073;
    return {
      id: `seed-${i + 1}-${j + 1}`, chamber: i + 1, angle,
      position: [.40 * Math.cos(angle) - side * Math.sin(angle), -.035 + j * .025,
        .40 * Math.sin(angle) + side * Math.cos(angle)] as const,
      halfLength: .29 + .015 * ((i + j) % 3),
    };
  });
}).flat();

export function createWholeSeedGeometry(spec: SeedSpec): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 48, 32);
  const positions = g.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    // The long axis is Y: stem-to-base direction, NOT the horizontal cut plane.
    const taper = .80 - .25 * y;
    const radial = x * .12 * taper, tangent = z * .071 * taper;
    positions.setXYZ(i,
      spec.position[0] + radial * Math.cos(spec.angle) - tangent * Math.sin(spec.angle),
      spec.position[1] + y * spec.halfLength,
      spec.position[2] + radial * Math.sin(spec.angle) + tangent * Math.cos(spec.angle));
  }
  g.computeVertexNormals(); return g;
}

/** Clip the SAME source triangles against y=0, preserving only the requested half.
 * A matching contour caps the cut. Seeds wholly on one side are not duplicated.
 */
export function sliceSeedGeometry(source: THREE.BufferGeometry, upper: boolean) {
  const input = source.index ? source.toNonIndexed() : source.clone();
  const vertices = input.getAttribute('position');
  const surfacePositions: number[] = [];
  const contour = new Map<string, THREE.Vector3>();
  const inside = (v: THREE.Vector3) => upper ? v.y >= 0 : v.y <= 0;
  function record(v: THREE.Vector3) {
    if (Math.abs(v.y) < 1e-8) contour.set(`${v.x.toFixed(7)},${v.z.toFixed(7)}`, v.clone().setY(0));
  }
  for (let i = 0; i < vertices.count; i += 3) {
    const triangle = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(vertices, i + j));
    const polygon: THREE.Vector3[] = [];
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3];
      if (inside(a)) { polygon.push(a); record(a); }
      if (inside(a) !== inside(b)) {
        const intersection = a.clone().lerp(b, a.y / (a.y - b.y)).setY(0);
        polygon.push(intersection); record(intersection);
      }
    }
    for (let j = 1; j < polygon.length - 1; j++) {
      for (const v of [polygon[0], polygon[j], polygon[j + 1]]) surfacePositions.push(v.x, v.y, v.z);
    }
  }
  input.dispose();
  const surface = new THREE.BufferGeometry();
  surface.setAttribute('position', new THREE.Float32BufferAttribute(surfacePositions, 3));
  surface.computeVertexNormals();
  const section = new THREE.BufferGeometry();
  const boundary = [...contour.values()];
  const sectionPositions: number[] = [];
  if (boundary.length >= 3) {
    const center = boundary.reduce((sum, p) => sum.add(p), new THREE.Vector3()).divideScalar(boundary.length);
    boundary.sort((a, b) => Math.atan2(a.z - center.z, a.x - center.x) - Math.atan2(b.z - center.z, b.x - center.x));
    const pushTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
      for (const p of upper ? [a, b, c] : [a, c, b]) sectionPositions.push(p.x, 0, p.z);
    };
    // A brown seed-coat ring surrounds a pale interior, not a whole brown seed.
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i], b = boundary[(i + 1) % boundary.length];
      const innerA = center.clone().lerp(a, .84), innerB = center.clone().lerp(b, .84);
      pushTriangle(a, b, innerA); pushTriangle(b, innerB, innerA);
    }
    section.addGroup(0, sectionPositions.length / 3, 0);
    const innerStart = sectionPositions.length / 3;
    for (let i = 0; i < boundary.length; i++) {
      pushTriangle(center, center.clone().lerp(boundary[i], .84), center.clone().lerp(boundary[(i + 1) % boundary.length], .84));
    }
    section.addGroup(innerStart, sectionPositions.length / 3 - innerStart, 1);
  }
  section.setAttribute('position', new THREE.Float32BufferAttribute(sectionPositions, 3));
  section.computeVertexNormals();
  return { surface, section };
}

export interface AppleModel {
  root: THREE.Group;
  upper: THREE.Group;
  lower: THREE.Group;
  upperInterior: THREE.Group;
  lowerInterior: THREE.Group;
  seedMaterial: THREE.MeshPhysicalMaterial;
  setSeedInspection: (enabled: boolean) => void;
}

export function createApple(): AppleModel {
  const root = new THREE.Group();
  const upper = new THREE.Group(), lower = new THREE.Group();
  upper.name = 'upper-half'; lower.name = 'lower-half'; root.add(upper, lower);
  const skinMaterial = new THREE.MeshPhysicalMaterial({ map: skinTexture(), roughness: .43, metalness: 0, clearcoat: .25, clearcoatRoughness: .3 });
  const fleshMaterial = new THREE.MeshStandardMaterial({ map: fleshTexture(), roughness: .84 });
  const seedMaterial = new THREE.MeshPhysicalMaterial({ color: '#60321b', roughness: .29, clearcoat: .65, clearcoatRoughness: .2 });
  const seedCoatCutMaterial = new THREE.MeshStandardMaterial({ color: '#58351f', roughness: .8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const seedInsideMaterial = new THREE.MeshStandardMaterial({ color: '#ede0b9', roughness: .88, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const fleshCaps: THREE.Mesh[] = [];
  const seedSections: THREE.Mesh[] = [];
  const skins: THREE.Mesh[] = [];
  function half(group: THREE.Group, isUpper: boolean) {
    const skin = new THREE.Mesh(makeSkinGeometry(isUpper), skinMaterial);
    skin.userData.part = 'skin'; skin.castShadow = skin.receiveShadow = true; group.add(skin); skins.push(skin);
    const interior = new THREE.Group(); interior.name = isUpper ? 'upper-interior' : 'lower-interior';
    const cap = new THREE.Mesh(makeCapGeometry(isUpper), fleshMaterial);
    cap.userData.part = 'flesh'; cap.castShadow = cap.receiveShadow = true; interior.add(cap); fleshCaps.push(cap);
    interior.visible = false; group.add(interior); return interior;
  }
  const upperInterior = half(upper, true), lowerInterior = half(lower, false);
  for (const spec of SEED_SPECS) {
    const whole = createWholeSeedGeometry(spec);
    for (const isUpper of [true, false]) {
      const { surface, section } = sliceSeedGeometry(whole, isUpper);
      const fragment = new THREE.Group();
      fragment.name = `${spec.id}-${isUpper ? 'upper' : 'lower'}-fragment`;
      fragment.userData = { seedId: spec.id, chamber: spec.chamber, fragment: isUpper ? 'upper' : 'lower' };
      const body = new THREE.Mesh(surface, seedMaterial);
      body.name = 'seed-fragment-body'; body.userData = { part: 'seed', seedId: spec.id };
      body.castShadow = true;
      const cutFace = new THREE.Mesh(section, [seedCoatCutMaterial, seedInsideMaterial]);
      cutFace.name = 'seed-cross-section'; cutFace.userData = { part: 'seed', seedId: spec.id };
      cutFace.renderOrder = 2; seedSections.push(cutFace);
      fragment.add(body, cutFace);
      (isUpper ? upperInterior : lowerInterior).add(fragment);
    }
    whole.dispose();
  }
  function setSeedInspection(enabled: boolean) {
    // Transparent shell is explicitly a see-through teaching mode, not a cut face.
    skinMaterial.transparent = enabled;
    skinMaterial.opacity = enabled ? .075 : 1;
    skinMaterial.depthWrite = !enabled;
    skinMaterial.needsUpdate = true;
    skins.forEach(mesh => { mesh.castShadow = !enabled; });
    fleshCaps.forEach(mesh => { mesh.visible = !enabled; });
    seedSections.forEach(mesh => { mesh.visible = !enabled; });
  }
  const stemCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .97, 0), new THREE.Vector3(.025, 1.2, .02), new THREE.Vector3(.12, 1.48, .035)]);
  const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 16, .052, 10, false), new THREE.MeshStandardMaterial({ color: '#695037', roughness: .94 }));
  stem.castShadow = true; upper.add(stem);
  // A curved, double-sided leaf built from a strip, not an external model or image.
  const leafPositions: number[] = [], leafIndices: number[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, width = Math.sin(Math.PI * t) * .21;
    const center = new THREE.Vector3(.09 + t * .68, 1.35 + .20 * Math.sin(t * 2.5), .02 - t * .20);
    leafPositions.push(center.x, center.y + .025 * Math.sin(Math.PI * t), center.z);
    leafPositions.push(center.x, center.y - width * .32, center.z + width);
    leafPositions.push(center.x, center.y - width * .32, center.z - width);
    if (i < 24) { const k = i * 3; leafIndices.push(k, k + 1, k + 3, k + 1, k + 4, k + 3, k, k + 3, k + 2, k + 2, k + 3, k + 5); }
  }
  const leafGeometry = new THREE.BufferGeometry(); leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute(leafPositions, 3)); leafGeometry.setIndex(leafIndices); leafGeometry.computeVertexNormals();
  const leaf = new THREE.Mesh(leafGeometry, new THREE.MeshStandardMaterial({ color: '#587344', roughness: .65, side: THREE.DoubleSide }));
  leaf.castShadow = true; upper.add(leaf);
  const vein = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(.09, 1.355, .02), new THREE.Vector3(.43, 1.55, -.08), new THREE.Vector3(.77, 1.48, -.18)]), 16, .008, 5, false), new THREE.MeshStandardMaterial({ color: '#a3ae62' }));
  upper.add(vein);
  const calyx = new THREE.Mesh(new THREE.SphereGeometry(.085, 12, 8), new THREE.MeshStandardMaterial({ color: '#6d4530', roughness: 1 }));
  calyx.scale.set(1, .2, 1); calyx.position.y = -1.145; lower.add(calyx);
  return { root, upper, lower, upperInterior, lowerInterior, seedMaterial, setSeedInspection };
}

export function createKnife(): THREE.Group {
  const knife = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(.44, .035, 3.15), new THREE.MeshStandardMaterial({ color: '#e5ebdf', roughness: .2, metalness: .7 }));
  blade.castShadow = true; knife.add(blade);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(.07, .012, 3.13), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .12, metalness: .8 }));
  edge.position.x = .23; knife.add(edge);
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(.10, .57, 5, 12), new THREE.MeshStandardMaterial({ color: '#7c5336', roughness: .7 }));
  handle.rotation.x = Math.PI / 2; handle.position.z = 1.91; handle.castShadow = true; knife.add(handle);
  knife.visible = false; return knife;
}
