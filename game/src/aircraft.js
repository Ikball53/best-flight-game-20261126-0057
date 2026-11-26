// Kaimana Air Mail — the mail plane: a small high-wing bush plane built from
// primitives, cream and coral livery, spinning prop, blinking nav lights.

import * as THREE from 'three';

function liveryTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f7ead0';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#e8542f';
  ctx.fillRect(0, 88, 512, 40);
  ctx.fillStyle = '#2a1a12';
  ctx.font = 'bold 44px Trebuchet MS, Verdana, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('KAIMANA AIR MAIL', 18, 46);
  ctx.fillStyle = '#f7ead0';
  ctx.font = 'bold 26px Trebuchet MS, Verdana, sans-serif';
  ctx.fillText('PK-7  ·  GOLDEN HOUR', 18, 108);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function lampMaterial(color) {
  return new THREE.MeshBasicMaterial({ color });
}

/** Build the PK-7 mail plane. Returns { group, propeller, navLeft, navRight, beacon }. */
export function buildMailPlane() {
  const group = new THREE.Group();
  const cream = new THREE.MeshLambertMaterial({ map: liveryTexture() });
  const creamPlain = new THREE.MeshLambertMaterial({ color: 0xf7ead0 });
  const coral = new THREE.MeshLambertMaterial({ color: 0xe8542f });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2a1a12 });
  const glass = new THREE.MeshPhongMaterial({ color: 0x9fd8e8, shininess: 120, specular: 0xffffff });

  // Fuselage: nose forward is -Z in plane space; the nose cone points -Z.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.8, 6.4, 12), cream);
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.02, 1.6, 12), coral);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.9;
  group.add(nose);

  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.6, 12), creamPlain);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = 4.4;
  group.add(tailCone);

  // Canopy: lit glasshouse the pilot sits in.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12), glass);
  canopy.scale.set(0.95, 0.75, 1.7);
  canopy.position.set(0, 0.85, -1.2);
  group.add(canopy);
  const canopyGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  canopyGlow.position.set(0, 0.7, -1.2);
  group.add(canopyGlow);

  // High wing with coral tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.22, 2.1), creamPlain);
  wing.position.set(0, 1.05, -0.4);
  group.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.26, 2.1), coral);
    tip.position.set(side * 5.35, 1.05, -0.4);
    group.add(tip);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 6), dark);
    strut.position.set(side * 2.6, 0.1, -0.4);
    strut.rotation.z = side * 0.7;
    group.add(strut);
  }

  // Tail: horizontal stabiliser and vertical fin with the mail flag.
  const stabiliser = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 1.2), creamPlain);
  stabiliser.position.set(0, 0.35, 5.2);
  group.add(stabiliser);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 1.5), coral);
  fin.position.set(0, 1.2, 5.3);
  group.add(fin);

  // Propeller: hub plus two blades, spun by the animation loop.
  const propeller = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 10), dark);
  hub.rotation.x = Math.PI / 2;
  propeller.add(hub);
  for (const angle of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.4, 0.1), dark);
    blade.rotation.z = angle;
    blade.position.y = 0;
    propeller.add(blade);
  }
  propeller.position.z = -4.85;
  group.add(propeller);

  // Fixed landing gear with little wheels.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6), dark);
    leg.position.set(side * 0.9, -1.5, -0.9);
    leg.rotation.z = side * 0.25;
    group.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.1, -2.2, -0.9);
    group.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 10), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -1.4, 4.6);
  group.add(tailWheel);

  // Nav lights: red left, green right, amber tail beacon.
  const navLeft = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), lampMaterial(0xff2a2a));
  navLeft.position.set(-5.8, 1.05, -0.4);
  const navRight = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), lampMaterial(0x2aff66));
  navRight.position.set(5.8, 1.05, -0.4);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), lampMaterial(0xffb84d));
  beacon.position.set(0, 2.35, 5.3);
  group.add(navLeft, navRight, beacon);

  group.traverse((child) => {
    if (child.isMesh) child.castShadow = false;
  });
  return { group, propeller, navLeft, navRight, beacon };
}
