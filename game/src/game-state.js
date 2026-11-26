// Kaimana Air Mail — sortie state: menu, flying, landed, crashed. Fuel,
// timer, score, ring progress, landing judgement and the autopilot that
// flies the plane for screenshot runs.

import * as THREE from 'three';
import { SORTIES, buildMailRings, checkRingPass, paintRings, ringDistance } from './rings.js';
import { createWind, createFlightState, stepFlight, MIN_TAKEOFF_SPEED } from './flight-model.js';
import { terrainHeightAt, onRunway, RUNWAY, CLINIC_STRIP } from './terrain.js';

export const PHASES = { MENU: 'menu', FLYING: 'flying', LANDED: 'landed', CRASHED: 'crashed' };

function stripFor(sortie) {
  return sortie.landingStrip === 'clinic' ? CLINIC_STRIP : RUNWAY;
}

/** Start a sortie: plane on the strip, fuel full, clock running. */
export function startSortie(sortieKey) {
  const sortie = SORTIES[sortieKey];
  const strip = stripFor(sortie);
  const start = {
    x: strip.x - Math.sin((strip.headingDeg * Math.PI) / 180) * (strip.length / 2 - 20),
    z: strip.z - Math.cos((strip.headingDeg * Math.PI) / 180) * (strip.length / 2 - 20),
    headingDeg: (strip.headingDeg + 180) % 360,
    altitude: terrainHeightAt(strip.x, strip.z) + 2.6,
    speed: 0,
  };
  const rings = buildMailRings(sortie.rings);
  return {
    phase: PHASES.FLYING,
    sortieKey,
    sortie,
    strip,
    flight: createFlightState(start),
    wind: createWind(sortie.windSpeed, sortie.windDirectionDeg, sortie.gust),
    ringGroup: rings.group,
    rings: rings.rings,
    ringsPassed: 0,
    nextRingIndex: 0,
    score: 0,
    fuelSecondsLeft: sortie.fuelSeconds,
    fuelSecondsTotal: sortie.fuelSeconds,
    timeLeft: sortie.timeLimitSeconds,
    elapsedSeconds: 0,
    ringsTotal: sortie.rings.length,
    nextRingDistance: null,
    windHeadline: '',
    allRingsDone: false,
    landingQuality: null,
    endReason: null,
    autopilot: false,
  };
}

/** Simple autopilot for screenshot runs: throttle up, steer at the next ring. */
function autopilotInput(state) {
  const flight = state.flight;
  const target = state.autopilotTarget
    ?? (state.nextRingIndex < state.rings.length
      ? state.rings[state.nextRingIndex].position
      : new THREE.Vector3(state.strip.x, 60, state.strip.z));
  const dx = target.x - flight.position.x;
  const dz = target.z - flight.position.z;
  // Heading convention: forward is (-sin h, -cos h), so desired heading is atan2(-dx, -dz).
  const desired = (Math.atan2(-dx, -dz) * 180) / Math.PI;
  const diff = ((desired - flight.headingDeg + 540) % 360) - 180;
  // A positive heading error needs a negative roll: banking left turns the nose right.
  const roll = Math.max(-1, Math.min(1, -diff / 28));
  const heightError = target.y - flight.position.y;
  const pitch = Math.max(-0.7, Math.min(0.7, heightError / 60));
  // Screenshot runs may cap the throttle, e.g. a slow final approach.
  const cruiseThrottle = state.autopilotThrottle ?? 0.72;
  const throttleDelta = flight.throttle < cruiseThrottle ? 1 : 0;
  return { pitch, roll, yaw: 0, throttleDelta: throttleDelta * 0.55 };
}

/**
 * Step one frame of a flying sortie. Returns events: ring, landed, crashed,
 * outOfFuel, outOfTime.
 */
export function stepSortie(state, input, dt, sound) {
  const events = { ring: null, landed: false, crashed: false, outOfFuel: false, outOfTime: false };
  if (state.phase !== PHASES.FLYING) return events;

  state.wind.update(dt);
  state.windHeadline = state.wind.headline();
  state.elapsedSeconds += dt;
  state.timeLeft = Math.max(0, state.sortie.timeLimitSeconds - state.elapsedSeconds);
  state.fuelSecondsLeft = Math.max(0, state.fuelSecondsLeft - dt * (0.6 + state.flight.throttle * 0.8));

  const flightInput = state.autopilot ? autopilotInput(state) : input;
  const ground = terrainHeightAt(state.flight.position.x, state.flight.position.z);
  const stepEvents = stepFlight(state.flight, flightInput, state.wind, dt, ground);

  // Ring progress.
  const passed = checkRingPass(state.rings, state.flight.position, state.nextRingIndex);
  if (passed) {
    state.ringsPassed += 1;
    state.nextRingIndex += 1;
    const points = 100 * state.sortie.scoreMultiplier;
    state.score += points;
    events.ring = { ring: passed, points };
    if (sound) sound.ringChime();
    if (state.nextRingIndex >= state.rings.length) {
      state.allRingsDone = true;
    }
  }
  const nextRing = state.rings[state.nextRingIndex];
  state.nextRingDistance = nextRing ? ringDistance(nextRing, state.flight.position) : null;

  // Crash first: a hard ground contact is a crash even on the strip.
  if (stepEvents.scraped) {
    state.phase = PHASES.CRASHED;
    state.endReason = 'CRASHED';
    events.crashed = true;
    if (sound) sound.crash();
    return events;
  }

  // Landing: on the strip, slow, gentle, wheels on the ground.
  const strip = state.strip;
  const onStrip = onRunway(state.flight.position.x, state.flight.position.z, strip);
  if (state.flight.onGround && onStrip && state.flight.airborne) {
    const gentle = Math.abs(state.flight.verticalSpeed) < 9 && state.flight.speed < 46;
    const perfect = Math.abs(state.flight.verticalSpeed) < 3.5 && state.flight.speed < 34;
    if (gentle) {
      const timeBonus = Math.round(state.timeLeft) * 2 * state.sortie.scoreMultiplier;
      const fuelBonus = Math.round(state.fuelSecondsLeft) * 1 * state.sortie.scoreMultiplier;
      const landingBonus = (perfect ? 500 : 250) * state.sortie.scoreMultiplier;
      const ringBonus = state.allRingsDone ? 300 * state.sortie.scoreMultiplier : 0;
      state.score += timeBonus + fuelBonus + landingBonus + ringBonus;
      state.landingQuality = perfect ? 'PERFECT LANDING' : 'LANDED';
      state.endReason = state.allRingsDone ? 'MAIL DELIVERED' : 'LANDED EARLY';
      state.phase = PHASES.LANDED;
      events.landed = true;
      if (sound) sound.touchdown();
      if (state.allRingsDone && sound) sound.fanfare();
      return events;
    }
  }

  // Ditching or bush crash: wheels down somewhere that is not a strip.
  if (state.flight.onGround && !onStrip && state.flight.airborne && state.flight.speed < 6) {
    const overLand = terrainHeightAt(state.flight.position.x, state.flight.position.z) > 1;
    state.phase = PHASES.CRASHED;
    state.endReason = overLand ? 'CRASHED IN THE BUSH' : 'DITCHED IN THE SEA';
    events.crashed = true;
    if (sound) sound.crash();
    return events;
  }

  if (state.fuelSecondsLeft <= 0) {
    state.phase = PHASES.CRASHED;
    state.endReason = 'OUT OF FUEL';
    events.outOfFuel = true;
    if (sound) sound.crash();
    return events;
  }
  if (state.timeLeft <= 0) {
    state.phase = PHASES.CRASHED;
    state.endReason = 'OUT OF TIME';
    events.outOfTime = true;
    if (sound) sound.crash();
    return events;
  }
  return events;
}

/** Score breakdown lines for the end screen. */
export function endBreakdown(state) {
  const lines = [
    `Rings threaded: <b>${state.ringsPassed} / ${state.ringsTotal}</b>`,
    `Sortie: <b>${state.sortie.name}</b>`,
    `Time flown: <b>${Math.round(state.elapsedSeconds)}s</b>`,
    `Fuel left: <b>${Math.max(0, Math.round(state.fuelSecondsLeft))}s</b>`,
  ];
  if (state.landingQuality) lines.push(`Landing: <b>${state.landingQuality}</b>`);
  lines.push(`Final score: <b>${state.score}</b>`);
  return lines;
}

export { MIN_TAKEOFF_SPEED };
