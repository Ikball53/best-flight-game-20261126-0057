// Kaimana Air Mail — mail rings: the golden rings each sortie threads, their
// routes, meshes, and pass detection.

import * as THREE from 'three';

/** Ring routes per sortie: positions are [x, altitude, z]. */
export const SORTIES = {
  dawn: {
    name: 'Dawn Mail Run',
    rings: [
      [120, 70, -120], [260, 85, -260], [420, 80, -330], [560, 95, -260],
      [430, 75, -40], [180, 90, 60], [-120, 70, 120], [60, 55, 150],
    ],
    windSpeed: 4,
    windDirectionDeg: 90,
    gust: 2,
    fuelSeconds: 360,
    timeLimitSeconds: 360,
    scoreMultiplier: 1,
    landingStrip: 'home',
  },
  reef: {
    name: 'Reef Rescue',
    rings: [
      [120, 70, -120], [-80, 95, -320], [-340, 110, -480], [-560, 80, -420],
      [-620, 70, -180], [-420, 90, 40], [-260, 75, 300], [-120, 70, 480],
      [60, 60, 560], [-300, 55, 620],
    ],
    windSpeed: 8,
    windDirectionDeg: 140,
    gust: 5,
    fuelSeconds: 420,
    timeLimitSeconds: 420,
    scoreMultiplier: 1.5,
    landingStrip: 'clinic',
  },
  sunset: {
    name: 'Sunset Express',
    rings: [
      [150, 60, -180], [380, 95, -360], [620, 70, -300], [500, 110, -80],
      [240, 65, -140], [-60, 100, -360], [-420, 70, -420], [-580, 95, -120],
      [-360, 60, 180], [-80, 85, 420], [220, 60, 520], [60, 50, 150],
    ],
    windSpeed: 12,
    windDirectionDeg: 200,
    gust: 8,
    fuelSeconds: 300,
    timeLimitSeconds: 300,
    scoreMultiplier: 2,
    landingStrip: 'home',
  },
};

export const RING_RADIUS = 14;

/** Build the ring meshes for a route. Returns { group, rings }. */
export function buildMailRings(route) {
  const group = new THREE.Group();
  const rings = route.map(([x, y, z], index) => {
    const ringGroup = new THREE.Group();
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(RING_RADIUS, 1.1, 12, 40),
      new THREE.MeshBasicMaterial({ color: 0xffc94d }),
    );
    const inner = new THREE.Mesh(
      new THREE.TorusGeometry(RING_RADIUS - 2.5, 0.5, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.7 }),
    );
    const hub = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff6b35 }),
    );
    ringGroup.add(torus, inner, hub);
    // Face the ring along the route so the pilot flies through it, not past it.
    const next = route[Math.min(index + 1, route.length - 1)];
    const dx = next[0] - x;
    const dz = next[2] - z;
    ringGroup.rotation.y = Math.atan2(dx, dz);
    ringGroup.position.set(x, y, z);
    group.add(ringGroup);
    return {
      index,
      position: new THREE.Vector3(x, y, z),
      mesh: ringGroup,
      torus,
      passed: false,
      pulse: Math.random() * Math.PI * 2,
    };
  });
  return { group, rings };
}

/** Distance from the aircraft to a ring centre. */
export function ringDistance(ring, position) {
  return ring.position.distanceTo(position);
}

/**
 * Check whether the aircraft just flew through the next unpassed ring.
 * Returns the ring when passed, else null.
 */
export function checkRingPass(rings, position, nextIndex) {
  const ring = rings[nextIndex];
  if (!ring || ring.passed) return null;
  if (ringDistance(ring, position) < RING_RADIUS - 1.5) {
    ring.passed = true;
    return ring;
  }
  return null;
}

/** Paint the next ring gold and passed rings green; pulse the next one. */
export function paintRings(rings, nextIndex, time) {
  rings.forEach((ring, i) => {
    if (ring.passed) {
      ring.torus.material.color.setHex(0x3ddc5a);
      ring.mesh.scale.setScalar(1);
    } else if (i === nextIndex) {
      ring.torus.material.color.setHex(0xffc94d);
      const pulse = 1 + Math.sin(time * 4 + ring.pulse) * 0.08;
      ring.mesh.scale.setScalar(pulse);
    } else {
      ring.torus.material.color.setHex(0xd98a2b);
      ring.mesh.scale.setScalar(1);
    }
  });
}
