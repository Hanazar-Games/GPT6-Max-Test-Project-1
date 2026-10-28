import test from 'node:test';
import assert from 'node:assert/strict';
import { createSelectionList } from '../src/selection-list.js';

function fixture() {
  let writes = 0, moves = 0;
  const list = {
    children: [],
    get firstElementChild() { return this.children[0] ?? null; },
    insertBefore(button, next) {
      this.children.splice(this.children.indexOf(button), 1);
      this.children.splice(next ? this.children.indexOf(next) : this.children.length, 0, button);
      moves++;
    },
  };
  for (const id of ['a', 'b', 'c', 'd']) {
    const attributes = new Map([['aria-pressed', 'false']]);
    const button = {
      dataset: { craft: id },
      getAttribute: key => attributes.get(key),
      setAttribute(key, value) { attributes.set(key, value); writes++; },
      get nextElementSibling() { return list.children[list.children.indexOf(this) + 1] ?? null; },
    };
    for (const key of ['hidden', 'disabled']) {
      let value = false;
      Object.defineProperty(button, key, { get: () => value, set(next) { value = next; writes++; } });
    }
    list.children.push(button);
  }
  return { list, view: createSelectionList(list, 'craft'), get writes() { return writes; }, get moves() { return moves; } };
}

test('unchanged selections and filters retain all cards without DOM writes or moves', () => {
  const f = fixture(), original = [...f.list.children];
  const state = { selectedId: 'b', visibleIds: new Set(['a', 'b', 'c', 'd']), order: ['a', 'b', 'c', 'd'] };
  f.view.update(state);
  assert.equal(f.writes, 1);
  for (let i = 0; i < 100; i++) f.view.update(state);
  assert.equal(f.writes, 1);
  assert.equal(f.moves, 0);
  assert.deepEqual(f.list.children, original);
});

test('selection changes only update the old and new card, including filtered selections', () => {
  const f = fixture(), visibleIds = new Set(['a', 'b', 'c', 'd']);
  f.view.update({ selectedId: 'a', visibleIds });
  f.view.update({ selectedId: 'c', visibleIds });
  assert.equal(f.writes, 3);
  f.view.update({ selectedId: 'c', visibleIds: new Set(['a']) });
  assert.equal(f.list.children[2].getAttribute('aria-pressed'), 'true');
  assert.equal(f.list.children[2].hidden, true);
  assert.equal(f.moves, 0);
});

test('filtering, sorting and clearing preserve cards and restore complete ordering', () => {
  const f = fixture(), original = [...f.list.children];
  const state = { selectedId: 'b', visibleIds: new Set(['b', 'd']), order: ['d', 'b', 'a', 'c'] };
  f.view.update(state);
  assert.deepEqual(f.list.children.map(button => button.dataset.craft), state.order);
  assert.deepEqual(f.list.children.filter(button => !button.hidden).map(button => button.dataset.craft), ['d', 'b']);
  const moves = f.moves;
  f.view.update(state);
  assert.equal(f.moves, moves);
  f.view.update({ selectedId: 'b', visibleIds: new Set(), order: state.order });
  assert.ok(f.list.children.every(button => button.hidden));
  f.view.update({ selectedId: 'b', visibleIds: new Set(['a', 'b', 'c', 'd']), order: ['a', 'b', 'c', 'd'] });
  assert.deepEqual(f.list.children, original);
  assert.ok(f.list.children.every(button => !button.hidden));
});

test('mode locking and unlocking only write disabled state when it changes', () => {
  const f = fixture(), state = { selectedId: 'a', visibleIds: new Set(['a', 'b', 'c', 'd']), disabled: true };
  f.view.update(state);
  assert.ok(f.list.children.every(button => button.disabled));
  const writes = f.writes;
  f.view.update(state);
  assert.equal(f.writes, writes);
  f.view.update({ ...state, disabled: false });
  assert.ok(f.list.children.every(button => !button.disabled));
  assert.equal(f.moves, 0);
});
