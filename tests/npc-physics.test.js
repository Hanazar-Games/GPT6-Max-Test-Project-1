import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, updateGame, obstacleLane, getFlightCue } from '../src/game.js';
import { MISSIONS, makeCourse } from '../src/missions.js';
import { makeTraffic, trafficDistance, trafficNear, trafficPose, TRAFFIC_SPEED } from '../src/traffic.js';
import { pilotInput, RACERS } from '../src/pilots.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

function flight(speed = 0) {
  const game = createGame('tranquility', 'scout', {}, { density: 0 });
  Object.assign(game, { status: 'running', speed });
  for (const key of Object.keys(game.course)) game.course[key] = [];
  return game;
}

test('acceleration, coasting and stopping distances agree across simulation frequencies', () => {
  for (const [speed, input, expected] of [[0, { accelerate: true }, .65], [10, { brake: true }, 100 / 520], [2, {}, 4 / 96]]) {
    for (const steps of [1, 6, 12]) {
      const game = flight(speed);
      for (let frame = 0; frame < steps; frame++) updateGame(game, input, .1 / steps);
      near(game.distance, expected);
      near(game.speed, input.accelerate ? 13 : 0);
    }
  }
});

test('reaching cruise or boost speed partway through a step integrates the remaining travel', () => {
  for (const boosting of [false, true]) for (const steps of [1, 6, 12]) {
    const game = flight();
    const target = boosting ? game.craft.boostSpeed : game.craft.speed;
    const acceleration = boosting ? 210 : 130;
    game.speed = target - 1;
    for (let frame = 0; frame < steps; frame++) updateGame(game, { accelerate: true, boost: boosting }, .1 / steps);
    near(game.distance, target * .1 - 1 / (2 * acceleration));
    near(game.speed, target);
  }
});

test('traffic plans clear every static rock with truck-sized margins on all routes', () => {
  for (const mission of MISSIONS) {
    const rocks = makeCourse(mission).obstacles.filter(obstacle => obstacle.kind === 'rock');
    const fleet = makeTraffic(mission, { density: 12, mix: { semi: 100 } }, rocks);
    if (!fleet.length) continue;
    for (const baseLane of [-11, 11]) {
      const vehicle = fleet.find(vehicle => vehicle.lane === baseLane);
      for (const rock of rocks) for (const offset of [-13, 0, 13]) {
        const time = (rock.distance + offset - vehicle.distance) / TRAFFIC_SPEED;
        const pose = trafficPose(vehicle, time);
        assert.ok(Math.abs(pose.lane - rock.lane) >= rock.radius + vehicle.radius + .3, `${mission.id}/${rock.id}/${baseLane}: clipped rock`);
        assert.ok(Math.abs(pose.lane) <= 15);
        assert.ok(Math.abs(pose.lane) + vehicle.radius < 17, 'the whole vehicle must stay on the asphalt');
        near(pose.slope, 0);
      }
    }
  }
});

test('traffic changes lane smoothly, preserves longitudinal gaps and shares two reusable paths', () => {
  const game = createGame('apocalypse', 'scout', {}, { density: 12 });
  const fleet = game.course.traffic;
  assert.equal(new Set(fleet.map(vehicle => vehicle.path)).size, 2);
  let turns = 0;
  for (const vehicle of fleet.slice(0, 6)) for (let time = 0; time < 40; time += .1) {
    const before = trafficPose(vehicle, time), after = trafficPose(vehicle, time + .001);
    assert.ok(Math.abs(before.slope) < .55, 'turns must not snap sideways');
    near((after.distance - before.distance) / .001, TRAFFIC_SPEED);
    assert.ok(Math.abs((after.lane - before.lane) / (.001 * TRAFFIC_SPEED) - before.slope) < .002);
    if (Math.abs(before.slope) > .01) turns++;
  }
  assert.ok(turns > 0);
  for (let i = 1; i < fleet.length; i++) near(trafficDistance(fleet[i], 900) - trafficDistance(fleet[i - 1], 900), fleet[i].distance - fleet[i - 1].distance);
});

test('future collision queries and guidance use the same moving lane as the rendered NPC', () => {
  const mission = MISSIONS[0], rock = { id: 0, distance: 500, lane: 11, radius: 2.8, kind: 'rock' };
  const vehicle = makeTraffic(mission, { density: 12, mix: { semi: 100 } }, [rock]).find(vehicle => vehicle.lane === 11);
  const elapsed = (rock.distance - vehicle.distance) / TRAFFIC_SPEED;
  const local = trafficNear([vehicle], elapsed, mission.length, 470, 530)[0];
  near(local.lane, trafficPose(vehicle, elapsed).lane);
  near(obstacleLane(local, elapsed + .5), trafficPose(vehicle, elapsed + .5).lane);
  const game = flight(200);
  Object.assign(game, { elapsed, distance: 460, lane: local.lane });
  game.course.traffic = [vehicle];
  const cue = getFlightCue(game);
  assert.equal(cue.hazard, 'traffic');
  for (let frame = 0; frame < 30 && !game.impacts; frame++) updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.impacts, 1);
});

test('turning truck corners collide where their rotated body extends beyond a straight collider', () => {
  for (const side of [-1, 1]) {
    const mission = MISSIONS[0], rock = { distance: 500, lane: side * 8, radius: 2.8, kind: 'rock' };
    const vehicle = makeTraffic(mission, { density: 12, mix: { semi: 100 } }, [rock]).find(vehicle => vehicle.lane === side * 11);
    const elapsed = (415 - vehicle.distance) / TRAFFIC_SPEED, pose = trafficPose(vehicle, elapsed);
    for (const [turning, height, expected] of [[true, 0, 1], [false, 0, 0], [true, 4, 0]]) {
      const game = flight();
      Object.assign(game, { elapsed, distance: pose.distance - 8, lane: pose.lane - side * 2.9, height });
      game.course.traffic = [turning ? vehicle : { ...vehicle, path: undefined, at: elapsed, distance: pose.distance, lane: pose.lane }];
      updateGame(game, {}, 1 / 60);
      assert.equal(game.impacts, expected, `side=${side}, turning=${turning}, height=${height}`);
    }
  }
});

test('traffic paths join across the lap seam and restart deterministically', () => {
  const game = createGame('apocalypse');
  for (const vehicle of game.course.traffic.slice(0, 4)) {
    const time = (game.mission.length - vehicle.distance) / TRAFFIC_SPEED;
    const a = trafficPose(vehicle, time - 1e-6), b = trafficPose(vehicle, time + 1e-6);
    assert.ok(Math.abs(a.lane - b.lane) < .001);
    assert.ok(Math.abs(a.slope - b.slope) < .001);
  }
  assert.deepEqual(game.course.traffic, createGame('apocalypse').course.traffic);
});

test('computer pilots brake for an unavoidable low crossing and keep flying above cleared hazards', () => {
  const low = flight(200), high = flight(200);
  for (const game of [low, high]) {
    game.distance = 100;
    game.course.obstacles = [{ distance: 120, lane: 0, radius: 2.8, kind: 'rock' }];
  }
  Object.assign(low, { height: .3, verticalSpeed: -4 });
  Object.assign(high, { height: 4, verticalSpeed: 0 });
  assert.equal(pilotInput(low, RACERS[0]).brake, true);
  assert.equal(pilotInput(high, RACERS[0]).brake, false);
});
