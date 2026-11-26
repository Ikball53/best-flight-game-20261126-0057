// Kaimana Air Mail — terrain: sunset archipelago, sea, sky, runway and palms.
// One analytic height function drives both the visible ground and the collision
// model, so what you see is exactly what you can crash into.

import * as THREE from 'three';

/** Islands of the Kaimana archipelago: centre, radius, peak height. */
export const ISLANDS = [
  { x: 0, z: 0, radius: 340, height: 46, name: 'Palau Kaimana' },
  { x: -560, z: -420, radius: 230, height: 64, name: 'Mount Tifa' },
  { x: 620, z: -380, radius: 200, height: 38, name: 'Reef Atoll' },
  { x: -180, z: 620, radius: 180, height: 30, name: 'Turtle Cay' },
  { x: 700, z: 520, radius: 150, height: 52, name: 'Twin Peaks' },
];

/** Home airstrip on Palau Kaimana: centre, heading (deg), length, width.
 *  It runs along the island's contour so the ground under it stays near level. */
export const RUNWAY = { x: 180, z: 180, headingDeg: 135, length: 220, width: 16 };
/** Clinic strip used by the Reef Rescue sortie. */
export const CLINIC_STRIP = { x: -560, z: -330, headingDeg: 115, length: 150, width: 12 };

export const SEA_LEVEL = 0;

/** Smooth bump of one island at (x, z). */
function islandBump(x, z, island) {
  const dx = x - island.x;
  const dz = z - island.z;
  const d = Math.sqrt(dx * dx + dz * dz) / island.radius;
  if (d >= 1) return 0;
  const fall = Math.cos(d * Math.PI * 0.5);
  return island.height * fall * fall;
}

/** Ground height in metres at (x, z); 0 over open sea. */
export function terrainHeightAt(x, z) {
  let h = 0;
  for (const island of ISLANDS) h += islandBump(x, z, island);
  return h;
}

/** True when (x, z) lies on the home runway rectangle (with a small margin). */
export function onRunway(x, z, strip = RUNWAY) {
  const a = (strip.headingDeg * Math.PI) / 180;
  const dx = x - strip.x;
  const dz = z - strip.z;
  const along = dx * Math.sin(a) + dz * Math.cos(a);
  const across = dx * Math.cos(a) - dz * Math.sin(a);
  return Math.abs(along) <= strip.length / 2 + 6 && Math.abs(across) <= strip.width / 2 + 6;
}

/** Seeded pseudo-random so the palms and rocks never move between runs. */
function mulberry32(seed) {
  let t = seed >>> 0;
  return function nextRandom() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function sunsetSkyMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0.0, '#2b1055');
  gradient.addColorStop(0.35, '#7b2d8b');
  gradient.addColorStop(0.55, '#c94b6d');
  gradient.addColorStop(0.72, '#ff7e47');
  gradient.addColorStop(0.85, '#ffb347');
  gradient.addColorStop(1.0, '#ffd76a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false });
}

function buildSun() {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(85, 48),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }),
  );
  // Low in the west, so the dawn route's north-west legs fly into the sunset.
  disc.position.set(1472, 110, -850);
  disc.lookAt(0, 60, 0);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(170, 48),
    new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.35, fog: false }),
  );
  glow.position.copy(disc.position).multiplyScalar(1.001);
  glow.lookAt(0, 60, 0);
  group.add(disc, glow);
  const light = new THREE.DirectionalLight(0xffb36b, 2.4);
  light.position.set(1000, 300, -600);
  group.add(light);
  group.add(new THREE.AmbientLight(0x8a5a9e, 1.15));
  const hemi = new THREE.HemisphereLight(0xff9a5c, 0x2a6a8a, 1.0);
  group.add(hemi);
  return group;
}

function buildSea() {
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(5200, 5200, 1, 1),
    new THREE.MeshPhongMaterial({ color: 0x2a6a8a, shininess: 120, specular: 0xffb36b }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = SEA_LEVEL;
  return sea;
}

function buildGround() {
  const size = 2600;
  const segments = 180;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const sand = new THREE.Color(0xe8c98a);
  const grass = new THREE.Color(0x4d7a3a);
  const jungle = new THREE.Color(0x2c5a2e);
  const rock = new THREE.Color(0x6b5560);
  const tmp = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const h = terrainHeightAt(x, z);
    positions.setY(i, h - 0.4);
    if (h <= 0.4) {
      tmp.copy(sand);
    } else if (h < 8) {
      tmp.copy(sand).lerp(grass, (h - 0.4) / 7.6);
    } else if (h < 26) {
      tmp.copy(grass).lerp(jungle, (h - 8) / 18);
    } else {
      tmp.copy(jungle).lerp(rock, Math.min(1, (h - 26) / 22));
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const ground = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  ground.position.y = 0;
  return ground;
}

function buildRunwayStrip(strip, label) {
  const group = new THREE.Group();
  const a = (strip.headingDeg * Math.PI) / 180;
  // Asphalt that hugs the terrain: displace each vertex to the ground height.
  const asphaltGeometry = new THREE.PlaneGeometry(strip.width, strip.length, 1, 16);
  asphaltGeometry.rotateZ(a);
  asphaltGeometry.rotateX(-Math.PI / 2);
  const asphaltPositions = asphaltGeometry.attributes.position;
  for (let i = 0; i < asphaltPositions.count; i++) {
    const wx = strip.x + asphaltPositions.getX(i);
    const wz = strip.z + asphaltPositions.getZ(i);
    asphaltPositions.setY(i, terrainHeightAt(wx, wz) + 0.6);
  }
  asphaltGeometry.computeVertexNormals();
  const asphalt = new THREE.Mesh(
    asphaltGeometry,
    new THREE.MeshLambertMaterial({ color: 0x3a3a44 }),
  );
  asphalt.position.set(strip.x, 0, strip.z);
  group.add(asphalt);
  const dashMaterial = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  for (let d = -strip.length / 2 + 12; d < strip.length / 2 - 6; d += 24) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 10), dashMaterial);
    dash.rotation.x = -Math.PI / 2;
    dash.rotation.z = a;
    const lx = strip.x + Math.sin(a) * d;
    const lz = strip.z + Math.cos(a) * d;
    dash.position.set(lx, terrainHeightAt(lx, lz) + 0.8, lz);
    group.add(dash);
  }
  const windsock = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 12, 6),
    new THREE.MeshLambertMaterial({ color: 0xdddddd }),
  );
  pole.position.y = 6;
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 7, 8),
    new THREE.MeshLambertMaterial({ color: 0xff6b35 }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(3.5, 11, 0);
  windsock.add(pole, sock);
  const wx = strip.x + Math.cos(a) * (strip.width / 2 + 10);
  const wz = strip.z - Math.sin(a) * (strip.width / 2 + 10);
  windsock.position.set(wx, terrainHeightAt(wx, wz), wz);
  group.add(windsock);
  group.userData.label = label;
  return group;
}

function buildPalms() {
  const group = new THREE.Group();
  const random = mulberry32(20261126);
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const leafMaterial = new THREE.MeshLambertMaterial({ color: 0x2e7d32, side: THREE.DoubleSide });
  for (let i = 0; i < 90; i++) {
    const island = ISLANDS[Math.floor(random() * ISLANDS.length)];
    const angle = random() * Math.PI * 2;
    const radius = island.radius * (0.35 + random() * 0.55);
    const x = island.x + Math.cos(angle) * radius;
    const z = island.z + Math.sin(angle) * radius;
    const h = terrainHeightAt(x, z);
    if (h < 2 || h > 20) continue;
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 9, 6), trunkMaterial);
    trunk.position.y = 4.5;
    trunk.rotation.z = (random() - 0.5) * 0.16;
    palm.add(trunk);
    for (let leaf = 0; leaf < 6; leaf++) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(1.1, 7, 4), leafMaterial);
      blade.position.y = 9.4;
      blade.rotation.z = Math.PI / 2.6;
      blade.rotation.y = (leaf / 6) * Math.PI * 2;
      blade.translateX(2.4);
      palm.add(blade);
    }
    palm.position.set(x, h, z);
    palm.rotation.y = random() * Math.PI * 2;
    const scale = 0.8 + random() * 0.7;
    palm.scale.setScalar(scale);
    group.add(palm);
  }
  return group;
}

function buildClouds() {
  const group = new THREE.Group();
  const random = mulberry32(777);
  const material = new THREE.MeshLambertMaterial({
    color: 0xffd9c2, transparent: true, opacity: 0.85, emissive: 0xff8a4d, emissiveIntensity: 0.25,
  });
  for (let i = 0; i < 26; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(random() * 3);
    for (let p = 0; p < puffs; p++) {
      const radius = 14 + random() * 22;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), material);
      puff.position.set((random() - 0.5) * 46, (random() - 0.5) * 8, (random() - 0.5) * 22);
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    const angle = random() * Math.PI * 2;
    const dist = 500 + random() * 900;
    cloud.position.set(Math.cos(angle) * dist, 150 + random() * 130, Math.sin(angle) * dist);
    group.add(cloud);
  }
  return group;
}

function buildBeaconTower() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(2, 3.4, 26, 8),
    new THREE.MeshLambertMaterial({ color: 0xf2ead8 }),
  );
  base.position.y = 13;
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 5, 8),
    new THREE.MeshLambertMaterial({ color: 0xd94f30 }),
  );
  band.position.y = 20;
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  lamp.position.y = 27.5;
  group.add(base, band, lamp);
  group.position.set(-40, terrainHeightAt(-40, -90), -90);
  group.userData.lamp = lamp;
  return group;
}

/** Build the whole archipelago and return its parts. */
export function buildTerrain(scene) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2600, 24, 16), sunsetSkyMaterial());
  scene.add(sky);
  scene.add(buildSun());
  scene.add(buildSea());
  scene.add(buildGround());
  scene.add(buildRunwayStrip(RUNWAY, 'Palau Kaimana'));
  scene.add(buildRunwayStrip(CLINIC_STRIP, 'Clinic Strip'));
  scene.add(buildPalms());
  scene.add(buildClouds());
  const tower = buildBeaconTower();
  scene.add(tower);
  scene.fog = new THREE.Fog(0xd96a55, 900, 2600);
  return { tower };
}
