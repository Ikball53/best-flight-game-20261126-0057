// Kaimana Air Mail — HUD: the lit instruments. Altitude, speed, heading,
// vertical speed, fuel, score, timer, mail rings, wind, compass strip and a
// working artificial horizon drawn on a small canvas.

import { altitudeFeet, speedKnots, verticalSpeedFpm } from './flight-model.js';

const $ = (id) => document.getElementById(id);

function padHeading(headingDeg) {
  const h = Math.round(((headingDeg % 360) + 360) % 360);
  return String(h).padStart(3, '0');
}

function formatTimer(secondsLeft) {
  const total = Math.max(0, Math.ceil(secondsLeft));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Draw the artificial horizon: sky, ground, pitch ladder, bank pointer. */
function drawHorizon(canvas, pitchDeg, rollDeg) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const centre = size / 2;
  const radius = centre - 4;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(centre, centre, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(centre, centre);
  ctx.rotate((-rollDeg * Math.PI) / 180);
  const pitchOffset = (pitchDeg / 30) * radius;
  ctx.translate(0, pitchOffset);
  // Sky above the horizon line, sea/ground below it.
  ctx.fillStyle = '#ff9a5c';
  ctx.fillRect(-radius, -radius * 2, radius * 2, radius * 2);
  ctx.fillStyle = '#274b63';
  ctx.fillRect(-radius, 0, radius * 2, radius * 2);
  ctx.strokeStyle = '#ffe9c4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-radius, 0);
  ctx.lineTo(radius, 0);
  ctx.stroke();
  // Pitch ladder rungs every 10 degrees.
  ctx.lineWidth = 1;
  ctx.font = '9px Verdana, sans-serif';
  ctx.fillStyle = '#ffe9c4';
  for (const deg of [-20, -10, 10, 20]) {
    const y = (-deg / 30) * radius;
    ctx.beginPath();
    ctx.moveTo(-18, y);
    ctx.lineTo(18, y);
    ctx.stroke();
    ctx.fillText(String(Math.abs(deg)), 22, y + 3);
  }
  ctx.restore();
  // Fixed aircraft symbol and bank pointer.
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(centre - 26, centre);
  ctx.lineTo(centre - 8, centre);
  ctx.moveTo(centre + 8, centre);
  ctx.lineTo(centre + 26, centre);
  ctx.moveTo(centre, centre - 4);
  ctx.lineTo(centre, centre + 4);
  ctx.stroke();
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.arc(centre, centre - radius + 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 233, 196, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(centre, centre, radius, 0, Math.PI * 2);
  ctx.stroke();
}

/** Build the repeating compass strip: every 30 degrees a fixed-width label. */
function buildCompassLabels() {
  const points = ['N', '030', '060', 'E', '120', '150', 'S', '210', '240', 'W', '300', '330'];
  const strip = $('compass-strip');
  strip.innerHTML = '';
  for (let round = 0; round < 3; round++) {
    for (const label of points) {
      const span = document.createElement('span');
      span.className = 'compass-label';
      span.textContent = label;
      strip.appendChild(span);
    }
  }
}

/** Pixels per degree on the compass strip: 30 degrees per 57 px label. */
const COMPASS_PX_PER_DEGREE = 57 / 30;

let compassLabels = null;

/** Refresh every instrument from the live flight state. */
export function updateHud(state) {
  $('hud-speed').textContent = speedKnots(state.flight);
  $('hud-alt').textContent = altitudeFeet(state.flight);
  $('hud-heading').textContent = padHeading(state.flight.headingDeg);
  $('hud-vs').textContent = verticalSpeedFpm(state.flight);
  const fuelPct = Math.max(0, Math.round((state.fuelSecondsLeft / state.fuelSecondsTotal) * 100));
  $('hud-fuel').textContent = `${fuelPct}%`;
  const fuelFill = $('fuel-fill');
  fuelFill.style.width = `${fuelPct}%`;
  fuelFill.classList.toggle('low', fuelPct < 25);
  $('hud-score').textContent = state.score;
  $('hud-timer').textContent = formatTimer(state.timeLeft);
  $('hud-rings').textContent = `${state.ringsPassed}/${state.ringsTotal}`;
  $('hud-wind-value').textContent = state.windHeadline;
  const next = state.nextRingDistance;
  $('hud-next-dist').textContent = next == null ? 'LAND NOW' : `${Math.round(next)} M`;
  const throttleFill = $('throttle-fill');
  throttleFill.style.height = `${Math.round(state.flight.throttle * 100)}%`;
  drawHorizon($('horizon'), state.flight.pitchDeg, state.flight.rollDeg);
  if (!compassLabels) {
    compassLabels = true;
    buildCompassLabels();
  }
  // Slide the strip so the current heading sits under the needle. The middle
  // round of labels starts at 360 degrees, i.e. 360 * pxPerDegree from the left.
  const strip = $('compass-strip');
  const heading = ((state.flight.headingDeg % 360) + 360) % 360;
  strip.style.transform = `translateX(${110 - (360 + heading) * COMPASS_PX_PER_DEGREE}px)`;
}

/** Flash a big centre message for a few seconds. */
let messageTimer = null;
export function flashMessage(text, seconds = 2.5) {
  const el = $('hud-message');
  el.textContent = text;
  if (messageTimer) clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    el.textContent = '';
  }, seconds * 1000);
}
