const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Game, W, H, BASE_PADDLE, contact } = require('../projects/freeform-breaker/engine.js');
function seeded(seed = 7) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function fixture() {
  const events = [], g = new Game({ random: seeded(), onEvent: e => events.push(e) });
  g.action(); g.bricks = Array.from({ length: 5 }, (_, i) => ({ ...g.makeBrick(i, 0, 100), power: null }));
  return { g, events };
}
function ball(g, x, y, vx, vy) { const b = g.newBall(x, y, vx, vy); g.balls = [b]; return b; }
function advance(g, seconds) { for (let t = 0; t < seconds; t += 1 / 240) g.update(1 / 240); }
test('initial state is ready, with three lives and bounded nonoverlapping bricks', () => {
  for (let seed = 0; seed < 80; seed++) {
    const g = new Game({ random: seeded(seed) });
    assert.equal(g.lives, 3); assert.equal(g.state, 'ready'); assert(g.remaining > 10);
    const positions = new Set();
    for (const b of g.bricks) { assert(b.hp >= 1 && b.hp <= 100); assert(b.y + b.h < H / 2); assert(!positions.has(`${b.col}:${b.row}`)); positions.add(`${b.col}:${b.row}`); }
  }
});
test('layouts vary across seeds; even zero RNG makes a playable layout', () => {
  const layouts = new Set(Array.from({length: 30}, (_, i) => JSON.stringify(new Game({ random: seeded(i * 981) }).bricks.map(b => [b.col, b.row, b.hp]))));
  assert(layouts.size > 25); assert(new Game({ random: () => 0 }).remaining > 0);
});
test('HP remains in 1–100 through late levels', () => {
  const { g } = fixture(); for (const level of [1, 5, 10, 30, 100]) { g.level = level; for (let i = 0; i < 500; i++) { const h = g.health(); assert(h >= 1 && h <= 100 && Number.isInteger(h)); } }
});
test('top, left and right walls reflect without losing a life', () => {
  const { g } = fixture();
  let b = ball(g, 8, 400, -300, 200); advance(g, .02); assert(b.vx > 0);
  b = ball(g, W - 8, 400, 300, 200); advance(g, .02); assert(b.vx < 0);
  b = ball(g, 850, 8, 100, -360); advance(g, .02); assert(b.vy > 0); assert.equal(g.lives, 3);
});
test('paddle reflects a ball off its TOP face', () => {
  const { g, events } = fixture(); g.paddle.y = 420; g.move(520, 420);
  const b = ball(g, 520, 398, 0, 380); advance(g, .04);
  assert(b.vy < 0); assert(b.y < 406); assert.equal(events.filter(e => e.type === 'bounce').length, 1);
});
test('paddle reflects a ball off its BOTTOM face', () => {
  const { g, events } = fixture(); g.paddle.y = 320; g.move(520, 320);
  const b = ball(g, 520, 342, 0, -380); advance(g, .04);
  assert(b.vy > 0); assert(b.y > 334); assert.equal(events.filter(e => e.type === 'bounce').length, 1);
});
test('paddle traverses full vertical field and remains inside walls', () => {
  const { g } = fixture(); ball(g, 800, 400, 100, -360);
  g.move(-999, -999); advance(g, .5); assert.equal(g.paddle.y, 14); assert(g.paddle.x >= g.paddle.w / 2);
  g.move(9999, 9999); advance(g, .8); assert.equal(g.paddle.y, H - 18); assert(g.paddle.x <= W - g.paddle.w / 2);
});
test('moving paddle does not tunnel through a ball or reflect repeatedly', () => {
  const { g, events } = fixture(); g.paddle.y = 480; g.move(520, 280);
  const b = ball(g, 520, 390, 0, 370); advance(g, .08);
  assert(b.vy < 0); assert.equal(events.filter(e => e.type === 'bounce').length, 1);
});
test('only loss of final ball costs a life', () => {
  const { g } = fixture(); ball(g, 900, H + 9, 50, 370);
  g.balls.push(g.newBall(800, 420, 80, -370)); g.update(.01);
  assert.equal(g.lives, 3); assert.equal(g.balls.length, 1);
  g.balls[0].y = H + 9; g.update(.01); assert.equal(g.lives, 2); assert.equal(g.state, 'lifeLost');
  const hp = g.bricks[0].hp; g.action(); assert.equal(g.state, 'running'); assert.equal(g.bricks[0].hp, hp);
});
test('three lost serves end the game; action resets score and lives', () => {
  const { g } = fixture();
  for (let i = 0; i < 3; i++) { ball(g, 900, H + 9, 100, 370); g.update(.01); if (i < 2) g.action(); }
  assert.equal(g.state, 'gameOver'); assert.equal(g.lives, 0); g.score = 555; g.action(); assert.equal(g.lives, 3); assert.equal(g.score, 0); assert.equal(g.level, 1);
});
test('paused physics and effect timers remain frozen', () => {
  const { g } = fixture(); g.applyPower('grow'); g.action(); const before = JSON.stringify(g);
  for (let i = 0; i < 50; i++) g.update(.05); assert.equal(JSON.stringify(g), before);
  g.action(); assert.equal(g.state, 'running');
});
test('brick requires its remaining HP worth of damage and drops only on destruction', () => {
  const { g } = fixture(); const brick = g.bricks[0]; brick.hp = brick.maxHp = 3; brick.power = 'split';
  const b = g.balls[0]; for (let n = 0; n < 3; n++) { g.time += .1; g.hitBrick(brick, b); assert.equal(brick.hp, 2 - n); if (n < 2) assert.equal(g.drops.length, 0); }
  assert.equal(g.drops.length, 1); assert.equal(g.drops[0].type, 'split');
});
test('actual brick collision reflects and damages once', () => {
  const { g } = fixture(); const brick = g.bricks[0]; const before = brick.hp;
  const b = ball(g, brick.x + 30, brick.y + brick.h + 10, 0, -380); advance(g, .035);
  assert(b.vy > 0); assert.equal(brick.hp, before - 1);
});
test('split adds two balls and caps total at nine', () => {
  const { g } = fixture(); g.applyPower('split'); assert.equal(g.balls.length, 3);
  assert.notEqual(g.balls[0].vx, g.balls[1].vx);
  for (let i = 0; i < 10; i++) g.applyPower('split'); assert.equal(g.balls.length, 9);
});
test('grow and shrink are exactly ±30%, refresh, replace, then expire', () => {
  const { g } = fixture(); g.applyPower('grow'); g.update(.001); assert.equal(g.paddle.w, BASE_PADDLE * 1.3);
  g.time += 5; g.applyPower('grow'); assert.equal(g.effects.grow, g.time + 18);
  g.applyPower('shrink'); g.update(.001); assert.equal(g.effects.grow, 0); assert.equal(g.paddle.w, BASE_PADDLE * .7);
  g.time += 10; g.update(.001); assert.equal(g.paddle.w, BASE_PADDLE);
});
test('powerup activates when caught by paddle, not merely created', () => {
  const { g } = fixture(); g.drops = [{x: g.paddle.x, y: g.paddle.y - 19, r: 13, type: 'grow'}];
  assert.equal(g.effects.grow, 0); g.update(.02); assert(g.effects.grow > g.time); assert.equal(g.drops.length, 0);
});
test('spawn previews then adds at most five low-HP bonus bricks in empty cells', () => {
  const { g } = fixture(); const before = g.remaining; g.applyPower('spawn'); assert.equal(g.remaining, before); assert.equal(g.pending.length, 5);
  for (const b of g.pending) { assert(b.hp <= 3); assert(b.bonus); assert.equal(b.power, null); }
  advance(g, 1.1); assert.equal(g.remaining, before); advance(g, .2); assert.equal(g.remaining, before + 5); assert.equal(g.pending.length, 0);
});
test('spawn delays while paddle OR ball occupies the pending brick', () => {
  const { g } = fixture(); const b = g.makeBrick(7, 4, 2); b.spawnAt = 0; g.pending = [b];
  g.paddle.x = b.x + b.w / 2; g.paddle.y = b.y + b.h / 2; g.move(g.paddle.x, g.paddle.y); g.update(.001);
  assert.equal(g.pending.length, 1);
  g.paddle.x = 500; g.paddle.y = 600; g.move(500, 600);
  ball(g, b.x + b.w / 2, b.y + b.h / 2, 100, -360); g.update(.001); assert.equal(g.pending.length, 1);
  g.balls[0].y = 450; g.update(.001); assert.equal(g.pending.length, 0);
});
test('cannot clear while pending bricks remain; clear advances level and awards points', () => {
  const { g } = fixture(); g.bricks.forEach(b => b.hp = 0); const pending = g.makeBrick(5, 0, 1); pending.spawnAt = g.time + 1; g.pending = [pending];
  g.update(.01); assert.equal(g.state, 'running'); g.pending = []; g.update(.01);
  assert.equal(g.state, 'levelComplete'); assert.equal(g.score, 300); g.action(); assert.equal(g.level, 2); assert(g.remaining > 0); assert.equal(g.lives, 3);
});
test('cleanup activates at three bricks and level-based damage grows every two stages', () => {
  const { g } = fixture(); assert.equal(g.damage, 1); g.level = 3; assert.equal(g.damage, 2);
  g.bricks = g.bricks.slice(0, 3); g.update(.001); assert(g.cleanup); assert.equal(g.damage, 4);
});
test('speed normalization avoids horizontal stalls and unbounded acceleration', () => {
  const { g } = fixture(); const b = g.newBall(500, 400, 9000, 0); assert(Math.hypot(b.vx, b.vy) <= 650); assert(Math.abs(b.vy) > 100);
});
test('all-direction rectangular collision handles embedded centers', () => {
  const r = {x: 100,y: 100,w: 80,h: 14}; assert.equal(contact({x: 140,y: 112,r: 7}, r).ny, 1); assert.equal(contact({x: 140,y: 101,r: 7}, r).ny, -1);
});
test('long deterministic simulation keeps positions and scores finite', () => {
  const { g } = fixture();
  for (let i = 0; i < 18000; i++) {
    if (g.state !== 'running') g.action();
    const b = g.balls[0]; if (b) g.move(b.x, H - 40);
    if (i % 2500 === 0) g.applyPower('split'); if (i % 4000 === 0) g.applyPower('spawn');
    g.update(1 / 120);
    assert(Number.isFinite(g.score)); assert(g.balls.length <= 9); for (const b of g.balls) assert([b.x, b.y, b.vx, b.vy].every(Number.isFinite));
  }
});
