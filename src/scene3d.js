import * as THREE from 'three';

const game = window.ShiftfrontGame;
const fallback = window.ShiftfrontRender;
const W = game.WIDTH / 100;
const H = game.HEIGHT / 100;
const PLAYER = 0x65e3db;
const RIVAL = 0xff9279;
const GROUND = 0x396452;
const skillColors = { heal: 0x8ff2be, regen: 0x8ff2be, fire: 0xffad6a, firezone: 0xff9a50, shield: 0xffd98e, storm: 0xffcb75, pulse: 0x9ae9fb, slash: 0xffd29a, buff: 0xb0ebc6 };
const shared = {
  box: new THREE.BoxGeometry(1, 1, 1),
  ball: new THREE.SphereGeometry(1, 12, 9),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
  cone: new THREE.ConeGeometry(1, 1, 9),
  disk: new THREE.CircleGeometry(1, 28)
};
const materials = new Map();
const sharedGeometries = new Set(Object.values(shared));
let renderer;
let world;
let camera;
let portraitRenderer;
let portraitStage;
let portraitCamera;
let active = false;
let currentMatch = null;
let aim = null;
let targetRing;
let aimRing;
let aimBeam;
let riverCurve;
const riverGlints = [];
const actors = new Map();
const shots = new Map();
const effects = new Map();

function material(color, options = {}) {
  const key = `${color}|${options.metalness || 0}|${options.emissive || 0}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({
    color, roughness: .65, metalness: options.metalness || 0,
    emissive: options.emissive || 0, emissiveIntensity: options.emissive ? .65 : 0,
    flatShading: true
  }));
  return materials.get(key);
}

function shape(parent, geometry, color, x, y, z, sx, sy, sz, options = {}) {
  const mesh = new THREE.Mesh(geometry, typeof color === 'number' ? material(color, options) : color);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  parent.add(mesh);
  return mesh;
}

function box(parent, color, x, y, z, sx, sy, sz, options) {
  return shape(parent, shared.box, color, x, y, z, sx, sy, sz, options);
}

function ball(parent, color, x, y, z, sx, sy, sz, options) {
  return shape(parent, shared.ball, color, x, y, z, sx, sy, sz, options);
}

function cyl(parent, color, x, y, z, sx, sy, sz, options) {
  return shape(parent, shared.cylinder, color, x, y, z, sx, sy, sz, options);
}

function ring(parent, radius, width, color, y = .03, alpha = .9) {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(radius, radius + width, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: alpha, depthWrite: false, side: THREE.DoubleSide }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  parent.add(mesh);
  return mesh;
}

function shadow(parent, sx, sz, y = .015) {
  const mesh = shape(parent, shared.disk, new THREE.MeshBasicMaterial({ color: 0x101f26, transparent: true, opacity: .32, depthWrite: false }), 0, y, 0, sx, sz, 1);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function line(parent, a, b, width, height, color, y = 0) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const piece = box(parent, color, (a.x + b.x) / 2, y, (a.z + b.z) / 2, Math.hypot(dx, dz), height, width);
  piece.rotation.y = -Math.atan2(dz, dx);
  return piece;
}

function groundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 768;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#466b54'; ctx.fillRect(0, 0, 1024, 768);
  let seed = 47293;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 26000; i++) {
    const x = rand() * 1024, y = rand() * 768;
    ctx.fillStyle = rand() > .57 ? 'rgba(189,196,113,.075)' : 'rgba(19,58,57,.095)';
    const w = 1 + rand() * 8;
    ctx.fillRect(x, y, w, 1 + rand() * 3);
  }
  for (let y = 0; y < 768; y += 48) for (let x = 0; x < 1024; x += 48) {
    ctx.fillStyle = 'rgba(15,37,41,.07)';
    ctx.fillRect(x, y, 1, 48); ctx.fillRect(x, y, 48, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function ribbon(points, width, y, color) {
  const vertices = [];
  const edges = points.map((point, index) => {
    const prev = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next.x - prev.x, dz = next.z - prev.z;
    const len = Math.hypot(dx, dz);
    return [{ x: point.x - dz / len * width / 2, z: point.z + dx / len * width / 2 },
      { x: point.x + dz / len * width / 2, z: point.z - dx / len * width / 2 }];
  });
  for (let i = 0; i < edges.length - 1; i++) {
    const [left, right] = edges[i];
    const [nextLeft, nextRight] = edges[i + 1];
    vertices.push(left.x, y, left.z, nextLeft.x, y, nextLeft.z, right.x, y, right.z,
      right.x, y, right.z, nextLeft.x, y, nextLeft.z, nextRight.x, y, nextRight.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  world.add(mesh);
}

function buildRiver() {
  riverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(12.6, 0, -.9), new THREE.Vector3(14.2, 0, 3.7),
    new THREE.Vector3(11.0, 0, 9.3), new THREE.Vector3(13.2, 0, 17.0)
  ], false, 'centripetal');
  const points = riverCurve.getPoints(54);
  ribbon(points, 2.35, .008, 0x244c50);
  ribbon(points, 1.92, .016, 0x348b90);
  ribbon(points, 1.53, .018, 0x53b6ad);
  for (let i = 2; i < 53; i += 3) {
    const p = points[i], tangent = riverCurve.getTangent(i / 54);
    const n = new THREE.Vector3(-tangent.z, 0, tangent.x);
    for (const side of [-1, 1]) {
      const a = p.clone().addScaledVector(n, side * .84);
      const b = a.clone().addScaledVector(tangent, .38);
      line(world, a, b, .021, .008, side < 0 ? 0xa0e9d2 : 0xc4f5dc, .027);
    }
  }
  for (let i = 0; i < 22; i++) {
    const glint = box(world, 0xc4f1d9, 0, .039, 0, .2, .008, .024, { emissive: 0x6cbfb6 });
    riverGlints.push({ mesh: glint, offset: i / 22, side: i % 2 ? -.28 : .27 });
  }
}

function buildRoads() {
  for (const lane of game.LANES) {
    for (const segment of [lane.slice(0, 2), ...(lane.length > 2 ? [lane.slice(1)] : [])]) {
      const a = { x: segment[0].x / 100, z: segment[0].y / 100 };
      const b = { x: segment[1].x / 100, z: segment[1].y / 100 };
      line(world, a, b, 1.36, .085, 0x263d40, .038);
      line(world, a, b, 1.22, .08, 0x697575, .08);
      line(world, a, b, 1.09, .09, 0x98a49c, .095);
      const distance = Math.hypot(b.x - a.x, b.z - a.z);
      for (let t = .4; t < distance - .2; t += .62) {
        const center = { x: a.x + (b.x - a.x) * t / distance, z: a.z + (b.z - a.z) * t / distance };
        const tangent = { x: (b.x - a.x) / distance, z: (b.z - a.z) / distance };
        const dash = line(world,
          { x: center.x - tangent.x * .13, z: center.z - tangent.z * .13 },
          { x: center.x + tangent.x * .13, z: center.z + tangent.z * .13 },
          .023, .008, 0xe6dbb9, .147);
        dash.material = material(0xe6dbb9);
      }
      for (let t = .7; t < distance - .3; t += 1.25) {
        const x = a.x + (b.x - a.x) * t / distance;
        const z = a.z + (b.z - a.z) * t / distance;
        const nx = -(b.z - a.z) / distance, nz = (b.x - a.x) / distance;
        for (const side of [-1, 1]) {
          const tile = box(world, 0xc3b88f, x + nx * side * .58, .155, z + nz * side * .58, .055, .014, .08);
          tile.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
        }
      }
    }
  }
}

function buildPlazas() {
  for (let team = 0; team < 2; team++) {
    const center = game.BASES[team];
    const x = center.x / 100, z = center.y / 100;
    cyl(world, 0x273f46, x, .018, z, 1.72, .055, 1.72);
    cyl(world, 0x9da69a, x, .08, z, 1.54, .1, 1.54);
    cyl(world, 0x75847e, x, .14, z, 1.22, .04, 1.22);
    ring(world, 1.08, .032, team ? RIVAL : PLAYER, .165, .9).position.set(x, .165, z);
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6;
      const block = box(world, k % 3 ? 0xaab2a1 : 0xd6ca9e, x + Math.sin(a) * 1.36, .147, z + Math.cos(a) * 1.36, .09, .02, .22);
      block.rotation.y = a;
    }
  }
}

function distanceRoad(x, z) {
  let nearest = Infinity;
  for (const lane of game.LANES) for (let i = 0; i < lane.length - 1; i++) {
    const a = lane[i], b = lane[i + 1];
    const ax = a.x / 100, az = a.y / 100, bx = b.x / 100, bz = b.y / 100;
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    nearest = Math.min(nearest, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return nearest;
}

function seeded(index) {
  const value = Math.sin(index * 319.7 + 72.3) * 43758.5453;
  return value - Math.floor(value);
}

function scenery() {
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.055, .083, .4, 5), material(0x695a4a), 78);
  const lower = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.26, 0), material(0x397b58), 78);
  const upper = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.20, 0), material(0x6ea06a), 78);
  const temp = new THREE.Object3D();
  let count = 0;
  for (let i = 0; i < 340 && count < 78; i++) {
    const x = .35 + seeded(i * 1.87) * (W - .7), z = .35 + seeded(i * 2.23 + 12) * (H - .7);
    if (distanceRoad(x, z) < .96 || game.BASES.some(p => Math.hypot(x - p.x / 100, z - p.y / 100) < 1.8)) continue;
    if ([{ x: 7.2, z: 3.8 }, { x: 8.1, z: 12.9 }, { x: 15.9, z: 3.1 }, { x: 16.7, z: 11.7 }].some(p => Math.hypot(x - p.x, z - p.z) < .75)) continue;
    const size = .8 + seeded(i * 11) * .55;
    temp.position.set(x, .23 * size, z); temp.scale.set(size, size, size); temp.updateMatrix(); trunk.setMatrixAt(count, temp.matrix);
    temp.position.y = .49 * size; temp.updateMatrix(); lower.setMatrixAt(count, temp.matrix);
    temp.position.set(x + .06, .67 * size, z + .02); temp.scale.set(size, size, size); temp.updateMatrix(); upper.setMatrixAt(count, temp.matrix);
    count++;
  }
  for (const mesh of [trunk, lower, upper]) { mesh.count = count; mesh.instanceMatrix.needsUpdate = true; world.add(mesh); }
  const buildings = [
    [4.1, 3.9, 1.2], [5.3, 5.9, .72], [4.5, 11.1, .83], [7.5, 9.8, .8],
    [17.9, 4.3, .87], [19.1, 6.8, 1.24], [18.7, 10.1, .89], [15.7, 12.3, 1.0],
    [10.0, 2.8, .59], [13.9, 13.9, .77]
  ];
  for (const [x, z, size] of buildings) {
    if (distanceRoad(x, z) < .8) continue;
    shadowAt(x, z, size * .92);
    box(world, 0x294b4d, x + .09, .29, z + .1, size * 1.3, .58, size * .94);
    box(world, 0x9daea0, x, .55, z, size * 1.28, .14, size * .94);
    box(world, 0x5c7e7b, x, .64, z, size * .83, .055, size * .55);
    for (let k = -1; k <= 1; k++) {
      box(world, 0xa9dfd3, x + k * size * .3, .34, z + size * .476, size * .2, .17, .018, { emissive: 0x58aa9f });
      box(world, 0x5f7673, x + k * size * .22, .69, z, size * .12, .018, size * .4);
    }
  }
  for (const p of [{ x: 7.2, z: 3.8 }, { x: 8.1, z: 12.9 }, { x: 15.9, z: 3.1 }, { x: 16.7, z: 11.7 }]) {
    cyl(world, 0x536454, p.x, .045, p.z, .73, .09, .73);
    ring(world, .63, .028, 0xe4c47f, .097, .8).position.set(p.x, .097, p.z);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const x = p.x + Math.sin(a) * .49, z = p.z + Math.cos(a) * .49;
      box(world, 0x826e55, x, .18, z, .19, .29, .19);
      box(world, 0xd8b779, x, .34, z, .22, .04, .22);
    }
  }
}

function shadowAt(x, z, size) {
  const group = new THREE.Group(); group.position.set(x, 0, z); world.add(group); shadow(group, size, size * .7);
}

function buildWorld() {
  world = new THREE.Scene();
  world.background = new THREE.Color(0x244b48);
  world.fog = new THREE.Fog(0x244b48, 18, 32);
  world.add(new THREE.HemisphereLight(0xddeef1, 0x42654b, 2.15));
  const sunlight = new THREE.DirectionalLight(0xffe4bd, 2.4);
  sunlight.position.set(-5, 12, 4);
  world.add(sunlight);
  const fill = new THREE.DirectionalLight(0x8cd5d6, .8);
  fill.position.set(7, 7, -7);
  world.add(fill);
  const turf = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: groundTexture(), color: 0xffffff, roughness: .98 }));
  turf.rotation.x = -Math.PI / 2;
  turf.position.set(W / 2, -.02, H / 2);
  world.add(turf);
  buildRiver();
  buildRoads();
  buildPlazas();
  scenery();
  targetRing = ring(world, .33, .04, 0xffd398, .07, .95); targetRing.visible = false;
  aimRing = ring(world, .62, .038, 0xf9e3ae, .075, .85); aimRing.visible = false;
  aimBeam = box(world, new THREE.MeshBasicMaterial({ color: 0xffdf9d, transparent: true, opacity: .35, depthWrite: false }), 0, .08, 0, 1, .008, .06);
  aimRing.material.toneMapped = false;
  aimRing.material.color.setHex(0xffca69);
  aimRing.material.opacity = 1;
  aimBeam.material.toneMapped = false;
  aimBeam.material.opacity = .65;
  aimBeam.scale.z = .11;
  aimBeam.visible = false;
}

function createWorker(heroId, team, health = true) {
  const hero = game.HEROES.find(entry => entry.id === heroId) || game.HEROES[0];
  const accent = Number.parseInt(hero.color.slice(1), 16);
  const model = new THREE.Group();
  shadow(model, .32, .18);
  const halo = ring(model, .29, .04, team ? RIVAL : PLAYER, .038, .9);
  const figure = new THREE.Group();
  model.add(figure);
  const legs = [];
  const arms = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(side * .095, .35, 0);
    box(leg, 0x314047, 0, -.11, 0, .115, .24, .13);
    box(leg, 0x23323a, 0, -.24, .047, .14, .075, .20);
    figure.add(leg); legs.push(leg);
    const arm = new THREE.Group(); arm.position.set(side * .24, .74, 0);
    ball(arm, accent, 0, -.085, 0, .085, .15, .09);
    ball(arm, 0xe1a984, 0, -.235, .045, .073, .07, .073);
    figure.add(arm); arms.push(arm);
  }
  ball(figure, accent, 0, .57, 0, .22, .28, .16);
  box(figure, 0x27404a, 0, .44, .125, .26, .045, .05);
  box(figure, team ? 0xed977f : 0x80ead3, 0, .43, .165, .20, .035, .025, { emissive: team ? 0xb2483e : 0x2b9c9b });
  cyl(figure, 0xe2b391, 0, .84, 0, .078, .12, .077);
  ball(figure, 0xe7b992, 0, 1.03, .012, .178, .192, .161);
  ball(figure, 0x3e3635, -.065, 1.043, .166, .017, .022, .014);
  ball(figure, 0x3e3635, .065, 1.043, .166, .017, .022, .014);
  box(figure, 0x9d675c, 0, .974, .173, .055, .009, .008);

  if (heroId === 'coder') {
    ball(figure, 0x273b4b, 0, 1.179, -.025, .179, .081, .151);
    box(figure, 0x233d4e, -.181, 1.075, .004, .047, .15, .068);
    ball(figure, 0x94f4ef, -.193, 1.012, .05, .027, .026, .027, { emissive: 0x6bded6 });
    const laptop = box(figure, 0x28434f, 0, .57, .253, .36, .22, .035);
    laptop.rotation.x = -.3;
    box(figure, 0x8cf1ed, 0, .58, .28, .275, .14, .012, { emissive: 0x51bfc9 });
    box(figure, 0xa6dfe0, 0, .452, .28, .36, .032, .18);
  } else if (heroId === 'medic') {
    for (const side of [-1, 1]) box(figure, 0xedf4e6, side * .13, .56, .125, .15, .42, .095);
    box(figure, 0x3dbd88, 0, .7, .184, .09, .025, .018);
    box(figure, 0x3dbd88, 0, .7, .184, .026, .10, .018);
    cyl(figure, 0xeaf6e9, 0, 1.223, -.01, .174, .092, .166);
    box(figure, 0x58bfa0, 0, 1.28, .101, .19, .027, .02);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-.12, .79, .17), new THREE.Vector3(-.11, .60, .2), new THREE.Vector3(0, .56, .21), new THREE.Vector3(.105, .67, .21)]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, .012, 5, false), material(0x234c5c));
    figure.add(tube);
  } else if (heroId === 'rider') {
    ball(figure, 0xf5a43e, 0, 1.164, -.013, .195, .117, .183);
    cyl(figure, 0xf9c458, 0, 1.12, .055, .192, .039, .183);
    box(figure, 0x31545b, 0, 1.062, .163, .24, .045, .03);
    box(figure, 0xe3ae54, 0, .59, -.208, .37, .38, .20);
    box(figure, 0xf9d48b, 0, .59, -.313, .28, .22, .03);
    for (const side of [-1, 1]) box(figure, 0xffe4a9, side * .12, .55, .17, .042, .27, .018);
  } else if (heroId === 'builder') {
    cyl(figure, 0xf1c247, 0, 1.214, -.015, .207, .088, .187);
    cyl(figure, 0xe0983a, 0, 1.163, .009, .238, .027, .222);
    for (const side of [-1, 1]) box(figure, 0xdbd19a, side * .13, .57, .149, .058, .31, .029);
    box(figure, 0x524b48, 0, .38, 0, .41, .075, .2);
    box(figure, 0x795043, .31, .49, .06, .038, .5, .04);
    box(figure, 0xa7b9ae, .31, .77, .07, .24, .105, .15, { metalness: .3 });
  } else if (heroId === 'chef') {
    cyl(figure, 0xf1f3e9, 0, 1.28, -.023, .19, .255, .168);
    ball(figure, 0xfff9e8, -.097, 1.412, -.02, .11, .088, .10);
    ball(figure, 0xfff9e8, .097, 1.412, -.02, .11, .086, .10);
    box(figure, 0xf6edda, 0, .54, .174, .30, .39, .045);
    for (let i = 0; i < 3; i++) ball(figure, 0xac4d40, .065, .7 - i * .10, .206, .012, .012, .012);
    cyl(figure, 0x303c43, .32, .405, .24, .19, .042, .19, { metalness: .28 });
    box(figure, 0x79564a, .53, .41, .24, .29, .035, .04);
  } else {
    ball(figure, 0x453a57, 0, 1.17, -.036, .178, .073, .15);
    for (const side of [-1, 1]) {
      const glass = ring(figure, .046, .009, 0x413853, 1.06, 1);
      glass.rotation.x = 0; glass.position.set(side * .07, 1.067, .173);
    }
    box(figure, 0xf2e4bc, -.105, .48, .235, .20, .17, .028);
    box(figure, 0xf5eacb, .105, .48, .235, .20, .17, .028);
    box(figure, 0xb190d2, 0, .54, .247, .012, .26, .012);
    box(figure, 0x6b506a, 0, .66, .17, .035, .20, .021);
  }
  if (health) addHealthBar(model, 1.43);
  Object.assign(model.userData, { figure, halo, legs, arms, height: 1.4 });
  return model;
}

function addHealthBar(model, height, width = .62) {
  const group = new THREE.Group();
  group.position.y = height;
  const backing = new THREE.Mesh(new THREE.PlaneGeometry(width + .035, .105), new THREE.MeshBasicMaterial({ color: 0x142a30, side: THREE.DoubleSide, depthTest: false, toneMapped: false }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(width, .069), new THREE.MeshBasicMaterial({ color: 0x7ae3c7, side: THREE.DoubleSide, depthTest: false, toneMapped: false }));
  fill.position.z = .005;
  group.add(backing, fill);
  model.add(group);
  model.userData.health = { group, fill, width };
}

function createStructure(entity) {
  const model = new THREE.Group();
  const live = new THREE.Group();
  const broken = new THREE.Group();
  model.add(live, broken);
  const base = entity.kind === 'base';
  const teamColor = entity.team ? RIVAL : PLAYER;
  const accent = entity.team ? 0xe37761 : 0x49bcb5;
  const size = base ? .88 : .45;
  shadow(live, size + .18, size * .76);
  cyl(live, 0x253c42, 0, .095, 0, size + .14, .19, size + .14);
  cyl(live, 0x829592, 0, .20, 0, size + .04, .11, size + .04);
  ring(live, size * .82, .035, teamColor, .265, 1);
  cyl(live, 0x314950, 0, base ? .90 : .70, 0, base ? .43 : .25, base ? 1.25 : .96, base ? .43 : .25);
  cyl(live, 0x90a9a5, 0, base ? 1.60 : 1.24, 0, base ? .50 : .35, .12, base ? .50 : .35, { metalness: .35 });
  cyl(live, 0x2b4c55, 0, base ? 1.75 : 1.38, 0, base ? .32 : .24, .20, base ? .32 : .24);
  const coreY = base ? 1.95 : 1.51;
  const core = ball(live, accent, 0, coreY, 0, base ? .24 : .16, base ? .27 : .20, base ? .24 : .16, { emissive: accent });
  live.userData.core = core;
  live.userData.coreY = coreY;
  for (let i = 0; i < (base ? 6 : 4); i++) {
    const a = i * Math.PI * 2 / (base ? 6 : 4);
    const x = Math.sin(a) * (base ? .33 : .2), z = Math.cos(a) * (base ? .33 : .2);
    box(live, 0x91aaa7, x, base ? .93 : .73, z, .05, base ? 1.06 : .68, .05, { metalness: .35 });
    box(live, accent, x * 1.28, .35, z * 1.28, .08, .19, .07, { emissive: accent });
  }
  if (base) {
    for (const side of [-1, 1]) {
      box(live, 0x3a5660, side * .51, .52, 0, .19, .67, .26);
      box(live, accent, side * .51, .63, .14, .1, .35, .024, { emissive: accent });
    }
  }
  shadow(broken, size, size * .7);
  cyl(broken, 0x4c5f5c, 0, .09, 0, size, .15, size);
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4;
    const rock = box(broken, 0x748079, Math.sin(a) * size * .57, .18, Math.cos(a) * size * .47, .21, .24, .28);
    rock.rotation.y = a;
  }
  addHealthBar(model, base ? 2.44 : 1.95, base ? .98 : .73);
  model.userData.live = live;
  model.userData.broken = broken;
  model.userData.height = base ? 2.35 : 1.83;
  return model;
}

function createMinion(entity) {
  const model = new THREE.Group();
  const color = entity.team ? 0xda7c67 : 0x55bdb2;
  shadow(model, .19, .15);
  ring(model, entity.radius > 13 ? .21 : .17, .025, entity.team ? RIVAL : PLAYER, .035, .75);
  box(model, 0x293e48, 0, .28, 0, .30, .30, .27);
  ball(model, color, 0, .38, .045, .19, .20, .16, { emissive: color });
  box(model, 0xd3efe0, 0, .43, .197, .16, .051, .028);
  for (const side of [-1, 1]) {
    box(model, 0x364b50, side * .13, .12, 0, .11, .12, .16);
    ball(model, 0x687b74, side * .23, .31, 0, .08, .08, .08);
  }
  if (entity.radius > 13) box(model, 0xdec887, 0, .35, -.22, .26, .22, .22);
  addHealthBar(model, .79, .39);
  model.userData.height = .72;
  return model;
}

function createCreep() {
  const model = new THREE.Group();
  shadow(model, .32, .21);
  ring(model, .28, .035, 0xebc674, .03, .7);
  box(model, 0x39464a, 0, .25, 0, .48, .35, .43);
  box(model, 0xc2b79b, 0, .50, 0, .51, .24, .46);
  box(model, 0x42545a, 0, .54, .24, .34, .09, .025);
  box(model, 0xf4e8c7, 0, .48, .263, .30, .038, .06);
  for (let i = 0; i < 3; i++) {
    const paper = box(model, 0xf3e9ca, -.05 + i * .045, .66 + i * .054, -.055 - i * .02, .32, .018, .28);
    paper.rotation.y = i * .13;
  }
  for (const side of [-1, 1]) {
    const roller = cyl(model, 0x697471, side * .27, .18, 0, .10, .04, .10);
    roller.rotation.z = Math.PI / 2;
    box(model, 0xffa87a, side * .08, .58, .242, .04, .035, .026, { emissive: 0xe18662 });
  }
  addHealthBar(model, .91, .62);
  model.userData.height = .85;
  return model;
}

function createDeploy(entity) {
  const model = new THREE.Group();
  shadow(model, .25, .19);
  cyl(model, 0x364d54, 0, .17, 0, .24, .30, .24);
  cyl(model, entity.team ? RIVAL : PLAYER, 0, .38, 0, .21, .11, .21, { emissive: entity.team ? RIVAL : PLAYER });
  box(model, 0xdbefdd, 0, .47, .12, .1, .09, .21);
  ring(model, .30, .035, entity.team ? RIVAL : PLAYER);
  addHealthBar(model, .83, .44);
  model.userData.height = .75;
  return model;
}

function makeActor(entity) {
  let model;
  if (entity.kind === 'hero') model = createWorker(entity.heroId, entity.team);
  else if (entity.kind === 'minion') model = createMinion(entity);
  else if (entity.kind === 'creep') model = createCreep();
  else if (entity.kind === 'deploy') model = createDeploy(entity);
  else model = createStructure(entity);
  model.position.set(entity.x / 100, 0, entity.y / 100);
  world.add(model);
  return model;
}

function releaseVisual(group) {
  const sharedMaterials = new Set(materials.values());
  group.traverse(object => {
    if (object.geometry && !sharedGeometries.has(object.geometry)) object.geometry.dispose();
    if (!object.material) return;
    for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!sharedMaterials.has(mat)) mat.dispose();
    }
  });
}

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(.25, 'rgba(255,255,255,.52)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

let glow;
const damageTextures = new Map();
function damageTexture(amount, team) {
  const key = `${amount}:${team}`;
  if (damageTextures.has(key)) return damageTextures.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  ctx.font = 'bold 39px Arial,sans-serif';
  ctx.lineWidth = 8; ctx.strokeStyle = '#243038';
  ctx.strokeText(String(amount), 64, 45);
  ctx.fillStyle = team === 0 ? '#fff1ab' : '#ffac94';
  ctx.fillText(String(amount), 64, 45);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  damageTextures.set(key, texture);
  return texture;
}

function makeShot(projectile) {
  const group = new THREE.Group();
  const color = projectile.source.team === 0 ? PLAYER : RIVAL;
  ball(group, 0xfffae5, 0, 0, 0, .055, .055, .055, { emissive: 0xffffff });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow || (glow = glowTexture()), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  sprite.scale.set(.43, .43, .43);
  group.add(sprite);
  world.add(group);
  return group;
}

function makeEffect(effect) {
  const group = new THREE.Group();
  if (effect.kind === 'damage') {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: damageTexture(effect.amount, effect.team),
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    sprite.scale.set(.59, .295, 1);
    group.add(sprite);
    group.position.set(effect.x / 100, 1.12, effect.y / 100);
    group.userData.sprite = sprite;
    world.add(group);
    return group;
  }
  group.position.set(effect.x / 100, .035, effect.y / 100);
  const color = skillColors[effect.kind] || (effect.team ? RIVAL : PLAYER);
  const radius = effect.radius / 100;
  const circle = shape(group, shared.disk, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: effect.ticks ? .09 : .25, depthWrite: false, side: THREE.DoubleSide }), 0, .012, 0, radius, radius, 1);
  circle.rotation.x = -Math.PI / 2;
  const outline = ring(group, radius * .91, radius * .055, color, .025, .8);
  world.add(group);
  group.userData = { circle, outline, radius };
  return group;
}

function updateActors(match) {
  const present = new Set();
  for (const entity of match.entities) {
    present.add(entity.id);
    let actor = actors.get(entity.id);
    if (!actor) { actor = makeActor(entity); actors.set(entity.id, actor); }
    const structure = entity.kind === 'tower' || entity.kind === 'base';
    actor.visible = structure || entity.alive;
    if (structure) {
      actor.userData.live.visible = entity.alive;
      actor.userData.broken.visible = !entity.alive;
      if (entity.alive) actor.userData.live.userData.core.position.y = actor.userData.live.userData.coreY + Math.sin(performance.now() * .002 + entity.id) * .055;
    }
    if (!actor.visible) continue;
    actor.position.set(entity.x / 100, 0, entity.y / 100);
    if (entity.kind === 'hero') {
      actor.scale.setScalar(entity === match.player ? 1.34 : 1.23);
      const rig = actor.userData;
      const pace = Math.sin(entity.walk || 0) * .28;
      rig.figure.position.y = Math.abs(Math.sin(entity.walk || 0)) * .028;
      rig.legs[0].rotation.x = pace; rig.legs[1].rotation.x = -pace;
      rig.arms[0].rotation.x = -pace * .62; rig.arms[1].rotation.x = pace * .62;
      if (entity.cooldown > 0 && entity.cooldown < .28) rig.arms[1].rotation.x = -.85;
      rig.figure.rotation.y = (Math.PI / 2 - (entity.facing || 0)) * .34 + .20;
      rig.halo.scale.setScalar(entity === match.player ? 1.16 + .06 * Math.sin(performance.now() * .006) : 1);
    }
    if (actor.userData.health) {
      const { group, fill, width } = actor.userData.health;
      const fraction = Math.max(0, Math.min(1, entity.hp / entity.maxHp));
      group.visible = entity.alive;
      group.quaternion.copy(camera.quaternion);
      fill.scale.x = Math.max(.001, fraction);
      fill.position.x = -(width * (1 - fraction)) / 2;
      fill.material.color.setHex(entity.team === 0 ? 0x8be7bd : entity.team === 1 ? 0xffa18b : 0xeed183);
    }
    if (entity.flashUntil > match.time && actor.userData.figure) actor.userData.figure.scale.setScalar(1.1);
    else if (actor.userData.figure) actor.userData.figure.scale.setScalar(1);
  }
  for (const [id, actor] of actors) if (!present.has(id)) { world.remove(actor); releaseVisual(actor); actors.delete(id); }
}

function updateProjectiles(match) {
  const present = new Set(match.projectiles);
  for (const projectile of match.projectiles) {
    let visual = shots.get(projectile);
    if (!visual) { visual = makeShot(projectile); shots.set(projectile, visual); }
    visual.position.set(projectile.x / 100, projectile.source.kind === 'base' ? 1.15 : .67, projectile.y / 100);
  }
  for (const [projectile, visual] of shots) if (!present.has(projectile)) { world.remove(visual); releaseVisual(visual); shots.delete(projectile); }
}

function updateEffects(match) {
  const present = new Set(match.effects);
  for (const effect of match.effects) {
    let visual = effects.get(effect);
    if (!visual) { visual = makeEffect(effect); effects.set(effect, visual); }
    const progress = Math.max(0, Math.min(1, (match.time - effect.started) / (effect.until - effect.started)));
    if (effect.kind === 'damage') {
      visual.position.y = 1.12 + progress * .55;
      visual.userData.sprite.material.opacity = 1 - progress;
      continue;
    }
    const scale = effect.ticks ? 1 + .045 * Math.sin(performance.now() * .01) : .35 + progress * .65;
    visual.scale.set(scale, 1, scale);
    visual.userData.outline.material.opacity = effect.ticks ? .62 : .85 * (1 - progress);
    visual.userData.circle.material.opacity = effect.ticks ? .07 : .22 * (1 - progress);
  }
  for (const [effect, visual] of effects) if (!present.has(effect)) {
    world.remove(visual);
    releaseVisual(visual);
    effects.delete(effect);
  }
}

function createPortrait() {
  try {
    portraitRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    portraitRenderer.setSize(256, 256, false);
    portraitRenderer.setClearColor(0x000000, 0);
    portraitRenderer.outputColorSpace = THREE.SRGBColorSpace;
    portraitRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    portraitRenderer.toneMappingExposure = 1.35;
    portraitStage = new THREE.Scene();
    portraitStage.add(new THREE.HemisphereLight(0xe0f3fa, 0x516658, 2.4));
    const key = new THREE.DirectionalLight(0xffe4c7, 3);
    key.position.set(-2, 4, 5); portraitStage.add(key);
    const rim = new THREE.DirectionalLight(0x7de0db, 1.7);
    rim.position.set(1, 3, -2); portraitStage.add(rim);
    portraitCamera = new THREE.PerspectiveCamera(28, 1, .1, 20);
    portraitCamera.position.set(1.65, 1.8, 3.85);
    portraitCamera.lookAt(0, .68, 0);
  } catch (_) { portraitRenderer = null; }
}

const portraitModels = new Map();
function avatar(canvas, heroId, team = 0) {
  if (!active || !portraitRenderer) { fallback.avatar(canvas, heroId, team); return; }
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const box = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(box.width * ratio));
  canvas.height = Math.max(1, Math.floor(box.height * ratio));
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const key = `${heroId}:${team}`;
  if (!portraitModels.has(key)) portraitModels.set(key, createWorker(heroId, team, false));
  const model = portraitModels.get(key);
  const large = canvas.id === 'portrait';
  model.rotation.y = -.17 + (large ? Math.sin(performance.now() * .0011) * .24 : 0);
  model.scale.setScalar(1.38);
  portraitStage.add(model);
  portraitRenderer.render(portraitStage, portraitCamera);
  const side = Math.min(canvas.width, canvas.height) * (large ? 1.08 : 1.14);
  const top = (canvas.height - side) / 2 + (large ? canvas.height * .07 : 0);
  ctx.drawImage(portraitRenderer.domElement, (canvas.width - side) / 2, top, side, side);
  portraitStage.remove(model);
}

function createContext(canvas) {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    camera = new THREE.OrthographicCamera(-6, 6, 3.65, -3.65, .1, 55);
    buildWorld();
    createPortrait();
    active = true;
    return null;
  } catch (error) {
    console.warn('WebGL unavailable, switching to 2D arena:', error);
    active = false;
    return canvas.getContext('2d', { alpha: false });
  }
}

function resize(canvas, dpr) {
  if (!active) return;
  renderer.setPixelRatio(dpr);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  const halfV = 3.65;
  const halfH = halfV * canvas.clientWidth / Math.max(1, canvas.clientHeight);
  camera.left = -halfH; camera.right = halfH;
  camera.top = halfV; camera.bottom = -halfV;
  camera.updateProjectionMatrix();
}

let cameraReady = false;
function animateRiver() {
  const elapsed = performance.now() * .000025;
  for (const glint of riverGlints) {
    const position = (elapsed + glint.offset) % 1;
    const point = riverCurve.getPoint(position);
    const tangent = riverCurve.getTangent(position);
    glint.mesh.position.set(point.x - tangent.z * glint.side, .04, point.z + tangent.x * glint.side);
    glint.mesh.rotation.y = -Math.atan2(tangent.z, tangent.x);
  }
}

function draw(ctx, match, canvas, view) {
  if (!active) { fallback.draw(ctx, match, canvas, view); return; }
  if (currentMatch !== match) {
    for (const actor of actors.values()) { world.remove(actor); releaseVisual(actor); }
    for (const shot of shots.values()) { world.remove(shot); releaseVisual(shot); }
    for (const effect of effects.values()) { world.remove(effect); releaseVisual(effect); }
    actors.clear(); shots.clear(); effects.clear();
    currentMatch = match; cameraReady = false;
  }
  const focus = match.player && document.getElementById('selection').classList.contains('hidden') ? match.player : { x: 1210, y: 780 };
  const width = camera.right - camera.left;
  const cx = Math.max(width / 2, Math.min(W - width / 2, focus.x / 100));
  const cz = Math.max(4.1, Math.min(H - 3.7, focus.y / 100));
  if (!cameraReady) { camera.userData.focus = new THREE.Vector3(cx, 0, cz); cameraReady = true; }
  camera.userData.focus.lerp(new THREE.Vector3(cx, 0, cz), .13);
  const point = camera.userData.focus;
  camera.position.set(point.x, 8.6, point.z + 7.1);
  camera.lookAt(point.x, 0, point.z);
  animateRiver();
  updateActors(match);
  updateProjectiles(match);
  updateEffects(match);
  const target = match.player && match.player.alive ? match.targetFor(match.player) : null;
  targetRing.visible = Boolean(target && target.team !== 0);
  if (target) {
    targetRing.position.set(target.x / 100, .075, target.y / 100);
    targetRing.scale.setScalar(.95 + .08 * Math.sin(performance.now() * .008));
  }
  aimRing.visible = aimBeam.visible = Boolean(aim && match.player && match.player.alive);
  if (aimRing.visible) {
    const hero = match.player;
    const reach = aim.self ? 0 : aim.slot === 2 ? 1.85 : 1.4;
    const x = hero.x / 100 + Math.cos(aim.angle) * reach;
    const z = hero.y / 100 + Math.sin(aim.angle) * reach;
    aimRing.position.set(x, .075, z);
    aimRing.scale.setScalar(aim.self ? aim.slot === 2 ? 2.7 : 1.9 : aim.slot === 2 ? 1.75 : 1.05);
    aimBeam.position.set((x + hero.x / 100) / 2, .07, (z + hero.y / 100) / 2);
    aimBeam.scale.x = reach;
    aimBeam.rotation.y = -aim.angle;
    aimBeam.visible = !aim.self;
  }
  renderer.render(world, camera);
}

window.ShiftfrontRender = { ...fallback, createContext, resize, draw, avatar,
  setAim: value => { aim = value; }, mode: () => active ? 'webgl' : '2d' };
