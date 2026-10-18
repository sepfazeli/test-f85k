import test from 'node:test';
import assert from 'node:assert/strict';
import { derive, parseEvent, wouldCut, awards, SIT_LIMIT, GRACE } from './state.js';

let n = 0;
const ev = (t, action, who) => ({ id: `id${n++}`, t, action, who });

test('parses ntfy messages and rejects junk', () => {
  assert.deepEqual(parseEvent({ id: 'x', time: 5, event: 'message', tags: ['toilet', 'e-in', 'u-mo'] }), {
    id: 'x', t: 5, action: 'in', who: 'mo',
  });
  assert.equal(parseEvent({ id: 'x', time: 5, event: 'message', tags: ['e-in', 'u-bob'] }), null);
  assert.equal(parseEvent({ id: 'x', time: 5, event: 'keepalive' }), null);
});

test('book, in, done cycle', () => {
  const events = [ev(100, 'in', 'mo'), ev(110, 'book', 'dorsa'), ev(400, 'done', 'mo')];
  let s = derive(events.slice(0, 2), 200);
  assert.equal(s.occupant, 'mo');
  assert.deepEqual(s.queue.map((q) => q.who), ['dorsa']);
  s = derive(events, 401);
  assert.equal(s.occupant, null);
  assert.equal(s.lastFree.who, 'mo');
  assert.equal(s.feed.at(-1).dur, 300);
});

test('invalid events are ignored identically everywhere', () => {
  const s = derive([ev(100, 'in', 'mo'), ev(100, 'in', 'rana'), ev(101, 'done', 'rana')], 102);
  assert.equal(s.occupant, 'mo');
});

test('going in ahead of the next person is a cut only within the grace period', () => {
  const base = [ev(100, 'in', 'mo'), ev(110, 'book', 'dorsa'), ev(200, 'done', 'mo')];
  let s = derive(base, 210);
  assert.equal(wouldCut(s, 'parsa', 210), true);
  assert.equal(wouldCut(s, 'dorsa', 210), false);
  s = derive([...base, ev(210, 'in', 'parsa')], 211);
  assert.equal(s.cuts.parsa, 1);
  assert.deepEqual(s.queue.map((q) => q.who), ['dorsa']);

  s = derive([...base, ev(200 + GRACE + 1, 'in', 'parsa')], 200 + GRACE + 2);
  assert.equal(s.cuts.parsa, undefined);
  assert.equal(s.feed.at(-1).type, 'skip');
});

test('forgotten sessions auto-expire', () => {
  const s = derive([ev(100, 'in', 'mahyar')], 100 + SIT_LIMIT + 5);
  assert.equal(s.occupant, null);
  assert.equal(s.forgot.mahyar, 1);
});

test('anyone else can mark it free', () => {
  const s = derive([ev(100, 'in', 'sepehr'), ev(900, 'free', 'rana')], 901);
  assert.equal(s.occupant, null);
  assert.equal(s.forgot.sepehr, 1);
  assert.equal(derive([ev(100, 'in', 'sepehr'), ev(900, 'free', 'sepehr')], 901).occupant, 'sepehr');
});

test('awards pick winners', () => {
  const s = derive([
    ev(100, 'in', 'mo'), ev(160, 'done', 'mo'),
    ev(200, 'in', 'dorsa'), ev(800, 'done', 'dorsa'),
    ev(900, 'in', 'mo'), ev(1000, 'done', 'mo'),
  ], 1001);
  const byTitle = Object.fromEntries(awards(s).map((a) => [a.title, a.who]));
  assert.equal(byTitle['Throne Regular'], 'mo');
  assert.equal(byTitle['Marathon Sitter'], 'dorsa');
  assert.equal(byTitle['Speedrunner'], 'mo');
});
