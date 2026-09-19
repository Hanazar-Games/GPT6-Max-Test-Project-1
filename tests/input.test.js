import test from 'node:test';
import assert from 'node:assert/strict';
import { FlightInput, KEY_ACTIONS } from '../src/input.js';
import { createGame, startGame, updateGame, isJumpReady } from '../src/game.js';

function flight() {
  const game = createGame();
  startGame(game);
  for (let i = 0; i < 181; i++) updateGame(game, {}, 1 / 60);
  for (const key of ['gates', 'pickups', 'obstacles', 'pads', 'meteors', 'gravityZones']) game.course[key] = [];
  return game;
}

test('keyboard and touch taps survive until a simulation step and fire only once', () => {
  for (const source of ['KeyF', 'pointer:1']) {
    const game = flight();
    const controls = new FlightInput();
    controls.press(source, 'jump');
    controls.release(source);
    assert.equal(controls.held('jump'), false);
    let jumps = 0;
    for (let i = 0; i < 180; i++) {
      updateGame(game, controls.read(), 1 / 60);
      jumps += game.events.filter(event => event.type === 'jump').length;
    }
    assert.equal(jumps, 1);
    assert.equal(game.height, 0);
  }
});

test('keyboard repeat and extra fingers do not retrigger a held jump after landing', () => {
  const game = flight();
  const controls = new FlightInput();
  controls.press('KeyF', KEY_ACTIONS.KeyF);
  let jumps = 0;
  for (let i = 0; i < 180; i++) {
    controls.press('KeyF', KEY_ACTIONS.KeyF);
    if (i === 160) controls.press('pointer:1', 'jump');
    updateGame(game, controls.read(), 1 / 60);
    jumps += game.events.filter(event => event.type === 'jump').length;
  }
  assert.equal(jumps, 1);
  controls.release('KeyF');
  assert.equal(controls.read().jump, true);
  controls.release('pointer:1');
  controls.press('pointer:2', 'jump');
  updateGame(game, controls.read(), 1 / 60);
  assert.ok(game.height > 0);
});

test('boost unlock waits for every keyboard and touch source to release', () => {
  const game = flight();
  const controls = new FlightInput();
  controls.press('Space', KEY_ACTIONS.Space);
  controls.press('pointer:1', 'boost');
  controls.press('pointer:2', 'boost');
  for (let i = 0; i < 360; i++) updateGame(game, controls.read(), 1 / 60);
  assert.equal(game.boostLocked, true);
  for (const source of ['Space', 'pointer:1']) {
    controls.release(source);
    updateGame(game, controls.read(), 1 / 60);
    assert.equal(game.boosting, false);
  }
  controls.release('pointer:2');
  controls.press('Space', KEY_ACTIONS.Space);
  updateGame(game, controls.read(), 1 / 60);
  assert.equal(game.boosting, true);
  assert.equal(controls.read().boostReleased, false);
});

test('alternative keys and simultaneous steering release independently', () => {
  const controls = new FlightInput();
  for (const source of ['KeyW', 'ArrowUp', 'KeyA', 'KeyD']) controls.press(source, KEY_ACTIONS[source]);
  assert.equal(controls.read().steer, 0);
  controls.release('KeyW');
  controls.release('KeyD');
  const input = controls.read();
  assert.equal(input.accelerate, true);
  assert.equal(input.steer, -1);
  controls.release('ArrowUp');
  assert.equal(controls.read().accelerate, false);
});

test('cancelled touch presses do not execute a queued jump or stop another control', () => {
  const controls = new FlightInput();
  controls.press('pointer:1', 'jump');
  controls.press('pointer:2', 'accelerate');
  controls.release('pointer:1', true);
  const game = flight();
  updateGame(game, controls.read(), 1 / 60);
  assert.equal(game.height, 0);
  assert.ok(game.speed > 0);
});

test('clearing input discards taps and holds before a pause or a new flight', () => {
  const controls = new FlightInput();
  controls.toggleCruise();
  controls.press('KeyF', 'jump');
  controls.release('KeyF');
  controls.press('pointer:1', 'accelerate');
  controls.press('Space', 'boost');
  controls.release('Space');
  controls.clear();
  assert.deepEqual(controls.read(), new FlightInput().read());
  const game = flight();
  updateGame(game, controls.read(), 1 / 60);
  assert.equal(game.height, 0);
  assert.equal(game.speed, 0);
  assert.equal(controls.cruise, false);
});

test('cruise maintains the normal throttle without holding a key or consuming boost energy', () => {
  const game = flight();
  const controls = new FlightInput();
  assert.equal(controls.toggleCruise(), true);
  for (let i = 0; i < 180; i++) updateGame(game, controls.read(), 1 / 60);
  assert.equal(game.speed, game.craft.speed);
  assert.equal(game.energy, 100);
  assert.equal(game.boosting, false);
  assert.equal(controls.held('accelerate'), false);
  assert.equal(controls.toggleCruise(), false);
  updateGame(game, controls.read(), 1 / 60);
  assert.ok(game.speed < game.craft.speed);
});

test('cruise cooperates with physical throttle, steering, jumping and manual boost', () => {
  const game = flight();
  const controls = new FlightInput();
  controls.toggleCruise();
  controls.press('KeyW', 'accelerate');
  controls.release('KeyW');
  assert.equal(controls.read().accelerate, true);
  controls.press('KeyD', 'right');
  controls.press('Space', 'boost');
  controls.press('KeyF', 'jump');
  updateGame(game, controls.read(), 1 / 60);
  assert.ok(game.lane > 0 && game.height > 0);
  assert.equal(game.boosting, true);
  assert.ok(game.energy < 100);
  controls.release('Space');
  assert.equal(controls.read().accelerate, true);
  controls.press('pointer:1', 'accelerate');
  controls.toggleCruise();
  assert.equal(controls.read().accelerate, true);
  controls.release('pointer:1');
  assert.equal(controls.read().accelerate, false);
});

test('any brake source cancels cruise immediately and prevents reactivation until all brakes release', () => {
  for (const source of ['KeyS', 'ArrowDown', 'pointer:1']) {
    const controls = new FlightInput();
    controls.toggleCruise();
    controls.press(source, 'brake');
    assert.equal(controls.cruise, false);
    assert.equal(controls.read().accelerate, false);
    assert.equal(controls.toggleCruise(), false);
    controls.press('pointer:2', 'brake');
    controls.release(source);
    assert.equal(controls.toggleCruise(), false);
    controls.release('pointer:2');
    assert.equal(controls.read().accelerate, false);
    assert.equal(controls.toggleCruise(), true);
  }
});

test('a held countdown jump launches once, while an earlier released tap expires', () => {
  for (const held of [false, true]) {
    const controls = new FlightInput();
    const game = createGame();
    startGame(game);
    controls.press('KeyF', 'jump');
    if (!held) controls.release('KeyF');
    let jumps = 0;
    for (let i = 0; i < 400; i++) {
      updateGame(game, controls.read(), 1 / 60);
      jumps += game.events.filter(event => event.type === 'jump').length;
    }
    assert.equal(jumps, Number(held));
  }
});

test('jump readiness stays false during low-gravity flight even after cooldown expires', () => {
  const game = createGame();
  startGame(game);
  for (let i = 0; i < 181; i++) updateGame(game, {}, 1 / 60);
  game.distance = game.course.gravityZones[0].start + 10;
  assert.equal(isJumpReady(game), true);
  updateGame(game, { jump: true }, 1 / 60);
  for (let i = 0; i < 100; i++) updateGame(game, {}, 1 / 60);
  assert.equal(game.jumpCooldown, 0);
  assert.ok(game.height > 5);
  assert.equal(isJumpReady(game), false);
  updateGame(game, { jumpPressed: true }, 1 / 60);
  assert.ok(!game.events.some(event => event.type === 'jump'));
  for (let i = 0; i < 100; i++) updateGame(game, {}, 1 / 60);
  assert.equal(game.height, 0);
  assert.equal(isJumpReady(game), true);
  game.energy = 17.99;
  assert.equal(isJumpReady(game), false);
  game.energy = 18;
  assert.equal(isJumpReady(game), true);
});
