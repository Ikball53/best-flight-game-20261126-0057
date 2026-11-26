// Kaimana Air Mail — camera: a chase camera that trails the PK-7 and a
// cockpit view from the nose, both eased so the camera never fights the pilot.

import * as THREE from 'three';

export function createChaseCamera() {
  let mode = 'chase';
  const smoothedPosition = new THREE.Vector3(0, 80, 220);
  const smoothedLook = new THREE.Vector3(0, 60, 0);
  const tmpBehind = new THREE.Vector3();
  const tmpUp = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();

  function toggleMode() {
    mode = mode === 'chase' ? 'cockpit' : 'chase';
    return mode;
  }

  function currentMode() {
    return mode;
  }

  function snapTo(flight) {
    const headingRad = (flight.headingDeg * Math.PI) / 180;
    const back = new THREE.Vector3(Math.sin(headingRad), 0, Math.cos(headingRad));
    smoothedPosition.copy(flight.position).addScaledVector(back, 26).add(new THREE.Vector3(0, 9, 0));
    smoothedLook.copy(flight.position).addScaledVector(back, -30);
  }

  /** Ease the camera behind the aircraft each frame. */
  function update(camera, flight, lookOffset, dt) {
    const headingRad = (flight.headingDeg * Math.PI) / 180;
    const pitchRad = (flight.pitchDeg * Math.PI) / 180;
    const rollRad = (flight.rollDeg * Math.PI) / 180;
    // Behind the plane, in the direction opposite its heading.
    tmpBehind.set(Math.sin(headingRad), 0, Math.cos(headingRad));
    if (mode === 'chase') {
      const distance = 20 + flight.speed * 0.045;
      const height = 6.5 - pitchRad * 6;
      tmpLook.copy(flight.position).addScaledVector(tmpBehind, distance);
      tmpLook.y = flight.position.y + height;
      const ease = 1 - Math.exp(-5.5 * dt);
      smoothedPosition.lerp(tmpLook, ease);
      // Look ahead of the nose, nudged by the mouse drag.
      const ahead = flight.position.clone().addScaledVector(tmpBehind, -42);
      ahead.y = flight.position.y + Math.sin(pitchRad) * 30 + lookOffset.y * 26;
      ahead.x += Math.cos(headingRad) * lookOffset.x * 30;
      ahead.z -= Math.sin(headingRad) * lookOffset.x * 30;
      smoothedLook.lerp(ahead, 1 - Math.exp(-8 * dt));
      camera.position.copy(smoothedPosition);
      camera.up.set(Math.sin(rollRad) * 0.35, 1, 0);
      camera.lookAt(smoothedLook);
    } else {
      // Cockpit: sit just behind the canopy, look out over the nose.
      const nose = flight.position.clone().addScaledVector(tmpBehind, -3.4);
      nose.y = flight.position.y + 1.6;
      camera.position.copy(nose);
      tmpUp.set(0, 1, 0);
      camera.up.copy(tmpUp);
      const ahead = flight.position.clone().addScaledVector(tmpBehind, -80);
      ahead.y = flight.position.y + Math.sin(pitchRad) * 46 + lookOffset.y * 30;
      ahead.x += Math.cos(headingRad) * lookOffset.x * 34;
      ahead.z -= Math.sin(headingRad) * lookOffset.x * 34;
      camera.lookAt(ahead);
      smoothedPosition.copy(nose);
      smoothedLook.copy(ahead);
    }
  }

  return { update, toggleMode, currentMode, snapTo };
}
