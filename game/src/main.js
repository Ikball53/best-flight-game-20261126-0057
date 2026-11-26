// Kaimana Air Mail — main: renderer, scene, game loop, menus, and the
// screenshot modes (?shot=cover|rings|runway|cockpit) that stage the game
// mid-flight so its renders show the real thing.

import * as THREE from 'three';
import { buildTerrain, terrainHeightAt } from './terrain.js';
import { buildMailPlane } from './aircraft.js';
import { createChaseCamera } from './camera.js';
import { createInput } from './input.js';
import { createSoundBank } from './audio.js';
import { updateHud, flashMessage } from './hud.js';
import { startSortie, stepSortie, endBreakdown, PHASES } from './game-state.js';
import { paintRings } from './rings.js';
import { MAX_SPEED } from './flight-model.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(window.location.search);
const shotMode = params.get('shot');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$('game-root').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 6000);
camera.position.set(0, 80, 220);

const terrain = buildTerrain(scene);
const plane = buildMailPlane();
scene.add(plane.group);
const chaseCamera = createChaseCamera();
const input = createInput();
const sound = createSoundBank();

let state = null;
let clockTime = 0;
let lastFrame = performance.now();

function showMenu() {
  $('menu').classList.remove('hidden');
  $('endscreen').classList.add('hidden');
  $('hud').classList.add('hidden');
  if (state && state.ringGroup) scene.remove(state.ringGroup);
  state = null;
}

function beginSortie(sortieKey) {
  sound.unlock();
  if (state && state.ringGroup) scene.remove(state.ringGroup);
  state = startSortie(sortieKey);
  scene.add(state.ringGroup);
  chaseCamera.snapTo(state.flight);
  $('menu').classList.add('hidden');
  $('endscreen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  flashMessage(`${state.sortie.name.toUpperCase()} — FLY THE RINGS, THEN LAND`, 3);
}

function showEndScreen() {
  $('end-title').textContent = state.endReason || 'SORTIE OVER';
  const delivered = state.phase === PHASES.LANDED && state.allRingsDone;
  $('end-line').textContent = delivered
    ? 'Every letter home. The archipelago thanks you, pilot.'
    : state.phase === PHASES.LANDED
      ? 'Wheels down safe — but the mail sack was not full.'
      : 'The PK-7 will fly again. The mail must go through.';
  $('end-breakdown').innerHTML = endBreakdown(state).join('<br>');
  $('endscreen').classList.remove('hidden');
}

document.querySelectorAll('.sortie').forEach((button) => {
  button.addEventListener('click', () => beginSortie(button.dataset.sortie));
});
$('restart-button').addEventListener('click', () => {
  if (state) beginSortie(state.sortieKey);
});
$('menu-button').addEventListener('click', showMenu);

/** Stage a screenshot: autopilot on, plane placed mid-route near the action. */
function stageScreenshot(mode) {
  const sortieKey = 'dawn';
  beginSortie(sortieKey);
  state.autopilot = true;
  state.flight.throttle = 0.72;
  state.flight.speed = 58;
  if (mode === 'cover') {
    // Mid-route over the lagoon, first ring dead ahead, runway behind.
    state.flight.position.set(180, 82, -170);
    state.flight.headingDeg = 318;
    state.flight.pitchDeg = 0;
    state.nextRingIndex = 1;
    state.ringsPassed = 1;
    state.rings[0].passed = true;
    chaseCamera.snapTo(state.flight);
  } else if (mode === 'rings') {
    // About 120 m out from the second ring on its approach line, so the
    // gold ring fills the frame ahead of the nose when the shutter falls.
    const ring = state.rings[1].position;
    state.flight.position.set(ring.x - 84, ring.y - 8, ring.z + 84);
    state.flight.headingDeg = 315;
    state.nextRingIndex = 1;
    state.ringsPassed = 1;
    state.rings[0].passed = true;
    chaseCamera.snapTo(state.flight);
  } else if (mode === 'runway') {
    // Final approach from the sea side, north-east of the strip: the strip
    // axis runs 135/315, so the approach heading is 135, slow and gentle.
    state.flight.position.set(364, 34, -4);
    state.flight.headingDeg = 135;
    state.flight.speed = 42;
    state.flight.throttle = 0.45;
    state.autopilotThrottle = 0.45;
    state.nextRingIndex = 7;
    state.ringsPassed = 7;
    state.rings.forEach((ring, i) => { ring.passed = i < 7; });
    state.allRingsDone = false;
    state.autopilotTarget = new THREE.Vector3(180, 30, 180);
    chaseCamera.snapTo(state.flight);
  } else if (mode === 'cockpit') {
    // Cockpit view: level flight toward the first ring, islands below.
    state.flight.position.set(87, 80, 25);
    state.flight.headingDeg = 347;
    state.flight.pitchDeg = 0;
    state.nextRingIndex = 0;
    state.ringsPassed = 0;
    if (chaseCamera.currentMode() !== 'cockpit') chaseCamera.toggleMode();
    chaseCamera.snapTo(state.flight);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  clockTime += dt;

  if (input.wasPressed('KeyM')) sound.setMuted(!sound.isMuted());
  if (input.wasPressed('KeyC')) chaseCamera.toggleMode();
  if (input.wasPressed('KeyR') && state) beginSortie(state.sortieKey);

  if (state && state.phase === PHASES.FLYING) {
    const flightInput = input.readFlightInput();
    const events = stepSortie(state, flightInput, dt, sound);
    if (events.ring) {
      flashMessage(`RING ${state.ringsPassed}/${state.ringsTotal}  +${events.ring.points}`, 1.6);
    }
    if (events.landed || events.crashed || events.outOfFuel || events.outOfTime) {
      setTimeout(showEndScreen, 900);
    }
    sound.updateEngine(state.flight.throttle, state.flight.speed / MAX_SPEED, state.flight.airborne);
    updateHud(state);
    paintRings(state.rings, state.nextRingIndex, clockTime);
  }

  if (state) {
    // Pose the plane mesh from the flight state.
    const flight = state.flight;
    plane.group.position.copy(flight.position);
    plane.group.rotation.set(0, 0, 0);
    plane.group.rotateY((flight.headingDeg * Math.PI) / 180);
    plane.group.rotateX((-flight.pitchDeg * Math.PI) / 180);
    plane.group.rotateZ((flight.rollDeg * Math.PI) / 180);
    plane.propeller.rotation.z += dt * (8 + flight.throttle * 42);
    const blink = Math.sin(clockTime * 4) > 0;
    plane.navLeft.visible = blink;
    plane.navRight.visible = blink;
    plane.beacon.visible = Math.sin(clockTime * 2.4) > 0.4;
    chaseCamera.update(camera, flight, input.lookOffset(), dt);
    terrain.tower.userData.lamp.material.color.setHex(blink ? 0xffe9a8 : 0x8a6a3a);
  } else {
    // Menu backdrop: slow orbit over the archipelago.
    const angle = clockTime * 0.03;
    camera.position.set(Math.sin(angle) * 700, 260, Math.cos(angle) * 700);
    camera.lookAt(0, 30, 0);
    plane.group.position.set(0, 70, 0);
    plane.group.rotation.y = clockTime * 0.2;
    plane.propeller.rotation.z += dt * 10;
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

if (shotMode) {
  stageScreenshot(shotMode);
} else {
  showMenu();
}
requestAnimationFrame(frame);
