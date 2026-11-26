// Kaimana Air Mail — input: keyboard flight controls plus mouse look.
// Arrow keys pitch and bank, W/S throttle, A/D rudder, C camera, M mute.

export function createInput() {
  const keys = new Set();
  let mouseLookX = 0;
  let mouseLookY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const pressed = new Set();

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) pressed.add(event.code);
    keys.add(event.code);
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseDown(event) {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
  }

  function onMouseMove(event) {
    if (!dragging) return;
    mouseLookX += (event.clientX - lastX) * 0.003;
    mouseLookY += (event.clientY - lastY) * 0.003;
    mouseLookY = Math.max(-0.6, Math.min(0.6, mouseLookY));
    lastX = event.clientX;
    lastY = event.clientY;
  }

  function onMouseUp() {
    dragging = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  /** Flight axes in -1..1 plus throttle steps, read once per frame. */
  function readFlightInput() {
    const pitch = (keys.has('ArrowUp') ? -1 : 0) + (keys.has('ArrowDown') ? 1 : 0);
    const roll = (keys.has('ArrowLeft') ? -1 : 0) + (keys.has('ArrowRight') ? 1 : 0);
    const yaw = (keys.has('KeyA') ? -1 : 0) + (keys.has('KeyD') ? 1 : 0);
    const throttleDelta = (keys.has('KeyW') ? 1 : 0) + (keys.has('KeyS') ? -1 : 0);
    return { pitch, roll, yaw, throttleDelta: throttleDelta * 0.55 };
  }

  /** True once when a key was pressed since the last call. */
  function wasPressed(code) {
    if (pressed.has(code)) {
      pressed.delete(code);
      return true;
    }
    return false;
  }

  function lookOffset() {
    return { x: mouseLookX, y: mouseLookY };
  }

  function resetLook() {
    mouseLookX = 0;
    mouseLookY = 0;
  }

  return { readFlightInput, wasPressed, lookOffset, resetLook };
}
