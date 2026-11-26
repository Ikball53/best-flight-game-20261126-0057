// Kaimana Air Mail — flight model: arcade throttle / pitch / roll / yaw with
// trade-wind gusts, stall, and a gentle ground effect near the runway.

import * as THREE from 'three';

export const MAX_SPEED = 92; // m/s at full throttle
export const CRUISE_SPEED = 55; // m/s where the PK-7 feels happiest
export const STALL_SPEED = 24; // m/s: below this the wing gives up
export const MIN_TAKEOFF_SPEED = 30;

/** Wind state: a steady trade wind plus slow gusts that swing it around. */
export function createWind(baseSpeed, baseDirectionDeg, gustStrength) {
  return {
    baseSpeed,
    baseDirectionDeg,
    gustStrength,
    time: 0,
    /** Current wind vector (m/s) pushing the aircraft. */
    vector(out = new THREE.Vector3()) {
      const gust = Math.sin(this.time * 0.11) * 0.5 + Math.sin(this.time * 0.031 + 1.7) * 0.5;
      const speed = this.baseSpeed + gust * this.gustStrength;
      const dir = ((this.baseDirectionDeg + Math.sin(this.time * 0.05) * 14) * Math.PI) / 180;
      out.set(Math.sin(dir) * speed, 0, Math.cos(dir) * speed);
      return out;
    },
    /** Headline for the HUD: speed in knots and compass direction. */
    headline() {
      const speedKt = Math.round(this.baseSpeed * 1.944);
      if (speedKt < 2) return 'CALM';
      const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      const idx = Math.round((((this.baseDirectionDeg % 360) + 360) % 360) / 45) % 8;
      return `${speedKt} KT ${names[idx]}`;
    },
    update(dt) {
      this.time += dt;
    },
  };
}

/** Fresh flight state for a sortie start. */
export function createFlightState(start) {
  return {
    position: new THREE.Vector3(start.x, start.altitude, start.z),
    headingDeg: start.headingDeg,
    pitchDeg: 0,
    rollDeg: 0,
    speed: start.speed,
    throttle: 0.55,
    verticalSpeed: 0,
    onGround: false,
    airborne: false,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Step the aircraft one frame. `input` carries pitch/roll/yaw in -1..1 and
 * throttleDelta. Returns events the game loop reacts to: stalled, scraped.
 */
export function stepFlight(state, input, wind, dt, groundHeight) {
  const events = { stalled: false, scraped: false };

  state.throttle = clamp(state.throttle + input.throttleDelta * dt, 0, 1);
  const targetSpeed = state.throttle * MAX_SPEED;
  const accel = state.speed < targetSpeed ? 9 : 14;
  state.speed += clamp(targetSpeed - state.speed, -accel * dt, accel * dt);

  // Pitch and roll answer at every speed, but sluggishly when slow.
  const authority = clamp((state.speed - 8) / 40, 0.25, 1);
  state.pitchDeg = clamp(state.pitchDeg + input.pitch * 42 * authority * dt, -24, 30);
  state.rollDeg = clamp(state.rollDeg + input.roll * 95 * authority * dt, -62, 62);
  // The wing levels itself when the stick is centred.
  if (Math.abs(input.roll) < 0.05) state.rollDeg *= Math.max(0, 1 - 1.6 * dt);
  if (Math.abs(input.pitch) < 0.05) state.pitchDeg *= Math.max(0, 1 - 1.2 * dt);
  // A banked wing turns the nose; rudder helps at low speed.
  const turnRate = (-state.rollDeg * 0.9 + input.yaw * 16) * (state.speed / CRUISE_SPEED);
  state.headingDeg = (state.headingDeg + turnRate * dt + 360) % 360;

  const stalled = state.speed < STALL_SPEED && state.position.y > groundHeight + 4;
  if (stalled) events.stalled = true;

  // Lift from pitch and speed; a stall drops the nose and the altitude with it.
  const pitchRad = (state.pitchDeg * Math.PI) / 180;
  const liftFactor = clamp(state.speed / CRUISE_SPEED, 0, 1.35);
  let climb = Math.sin(pitchRad) * state.speed * liftFactor;
  if (stalled) climb = -14;
  // Ground effect: the last few metres over the strip float a little.
  if (state.position.y < groundHeight + 7 && climb < 0 && state.speed > MIN_TAKEOFF_SPEED) {
    climb *= 0.45;
  }
  state.verticalSpeed = climb;

  const headingRad = (state.headingDeg * Math.PI) / 180;
  const forward = new THREE.Vector3(-Math.sin(headingRad), 0, -Math.cos(headingRad));
  const velocity = forward.multiplyScalar(state.speed);
  velocity.y = climb;

  // The trade wind pushes the whole aircraft sideways.
  const windVector = wind.vector();
  state.position.addScaledVector(velocity, dt);
  state.position.addScaledVector(windVector, dt * 0.55);

  // Terrain contact: the wheels touch at 2.6 m, the PK-7's gear height.
  const ground = terrainHeightAtSafe(groundHeight);
  if (state.position.y <= ground + 2.6) {
    state.position.y = ground + 2.6;
    if (Math.abs(state.verticalSpeed) > 9 || state.speed > 46) events.scraped = true;
    state.onGround = true;
    state.verticalSpeed = 0;
    state.speed = Math.max(0, state.speed - 26 * dt);
    if (state.speed < 4) state.speed = 0;
  } else {
    state.onGround = false;
  }
  if (state.position.y > 3) state.airborne = true;
  return events;
}

function terrainHeightAtSafe(h) {
  return typeof h === 'number' ? h : 0;
}

/** Knots for the HUD. */
export function speedKnots(state) {
  return Math.round(state.speed * 1.944);
}

/** Feet for the HUD. */
export function altitudeFeet(state) {
  return Math.max(0, Math.round(state.position.y * 3.281));
}

/** Vertical speed in feet per minute for the HUD. */
export function verticalSpeedFpm(state) {
  return Math.round(state.verticalSpeed * 196.85);
}
