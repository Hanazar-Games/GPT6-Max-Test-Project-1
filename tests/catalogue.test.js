import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, CRAFTS } from '../src/missions.js';
import { filterMissions, filterCrafts, minimumDriveMinutes, minimumDriveLabel } from '../src/catalogue.js';
import { upgradeCraft } from '../src/upgrades.js';

const ids = items => items.map(item => item.id);

test('route categories expose every route and classify special routes by their rules', () => {
  assert.deepEqual(filterMissions(), MISSIONS);
  const short = filterMissions('', 'short');
  const long = filterMissions('', 'long');
  assert.equal(short.length, 25);
  assert.equal(long.length, 33);
  assert.deepEqual([...short, ...long], MISSIONS);
  assert.deepEqual(ids(filterMissions('', 'clear')), ['overdrive', 'earth']);
  assert.deepEqual(ids(filterMissions('', 'hazard')), ['apocalypse']);
});

test('route search combines spaced terms across fields with the active category', () => {
  assert.deepEqual(ids(filterMissions('  地球　长途\n无障碍 ', 'clear')), ['earth']);
  assert.deepEqual(ids(filterMissions('长途 地球', 'short')), []);
  assert.deepEqual(ids(filterMissions('全程加速', 'long')), ['overdrive']);
  assert.deepEqual(ids(filterMissions('霁蓝 连环')), ['tranquility']);
  assert.deepEqual(filterMissions('不存在的星球'), []);
  assert.deepEqual(filterMissions(' \t\n'), MISSIONS);
});

test('craft search recognizes names, roles and typed model dash variants', () => {
  for (const query of ['新星', '超速型', 'lc-60', 'LC–60', 'ＬＣ－６０', 'LC—60', 'lc−60']) {
    assert.deepEqual(ids(filterCrafts(query)), ['nova'], query);
  }
  assert.deepEqual(ids(filterCrafts('  lc-60　超速 ')), ['nova']);
  assert.deepEqual(ids(filterCrafts('回充 同心')), ['nautilus']);
  assert.deepEqual(filterCrafts('lc-60 护卫'), []);
  assert.deepEqual(filterCrafts('不存在的飞船'), []);
  assert.deepEqual(filterCrafts(' \t'), CRAFTS);
});

test('performance ordering ranks the full fleet and preserves catalogue order on ties', () => {
  for (const [sort, winner] of [['boostSpeed', 'nova'], ['handling', 'butterfly'], ['hull', 'tortoise'], ['recharge', 'atlas']]) {
    const result = filterCrafts('', sort);
    assert.equal(result[0].id, winner);
    assert.equal(result.length, CRAFTS.length);
    for (let i = 1; i < result.length; i++) {
      assert.ok(result[i - 1][sort] >= result[i][sort]);
      if (result[i - 1][sort] === result[i][sort]) assert.ok(CRAFTS.indexOf(result[i - 1]) < CRAFTS.indexOf(result[i]));
    }
  }
});

test('minimum journey labels remain attainable lower bounds even with the fastest upgraded craft', () => {
  const fastest = Math.max(...CRAFTS.map(craft => upgradeCraft(craft, { engine: 2 }).boostSpeed));
  for (const mission of MISSIONS.filter(mission => mission.endurance)) {
    const minutes = minimumDriveMinutes(mission);
    assert.ok(minutes >= (mission.tour ? 0 : 3));
    assert.ok(minutes * 60 <= mission.length / fastest);
    assert.ok((minutes + 1) * 60 > mission.length / fastest);
    assert.ok(filterMissions(minimumDriveLabel(mission).replace(/\s/g, "")).includes(mission));
  }
  assert.equal(minimumDriveMinutes(MISSIONS.find(m => m.id === "summit")), 8);
});

test('filtered performance results retain their order without modifying the source fleet', () => {
  const original = structuredClone(CRAFTS);
  const result = filterCrafts('1440', 'recharge');
  assert.deepEqual(ids(result), ['nautilus', 'viper']);
  assert.equal(result[0], CRAFTS.find(craft => craft.id === 'nautilus'));
  assert.deepEqual(filterCrafts('', 'catalogue'), CRAFTS);
  assert.deepEqual(CRAFTS, original);
  assert.deepEqual(filterCrafts('not-a-craft', 'boostSpeed'), []);
});

test('distance searches accept unit and spacing variants without matching longer routes', () => {
  for (const query of ['20km', '20 km', '20公里', '20 千米', '２０ ＫＭ', '20.0km']) {
    assert.deepEqual(ids(filterMissions(query)), ['cascade', 'regatta', 'lantern'], query);
  }
  assert.deepEqual(ids(filterMissions('50km 山桥', 'bridges')), ['marathon']);
  assert.deepEqual(ids(filterMissions('7.4公里', 'short')), ['glacier']);
  assert.deepEqual(ids(filterMissions('120 km')), ['terrace']);
  assert.deepEqual(ids(filterMissions('20km', 'short')), []);
  assert.deepEqual(ids(filterMissions('84 km 铸火', 'tour')), ['emberforge']);
});
