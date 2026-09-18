(function (root) {
  'use strict';
  const W = 1040, H = 680, BALL_R = 7, BASE_PADDLE = 132;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const TYPES = ['split', 'grow', 'spawn', 'shrink'];
  const PATTERNS = ['星际阶梯', '双子矩阵', '钻石回廊', '轨道之环', '像素波浪'];
  function contact(ball, rect) {
    const cx = clamp(ball.x, rect.x, rect.x + rect.w);
    const cy = clamp(ball.y, rect.y, rect.y + rect.h);
    const dx = ball.x - cx, dy = ball.y - cy;
    const d = Math.hypot(dx, dy);
    if (d >= ball.r) return null;
    if (d > 0.0001) return { nx: dx / d, ny: dy / d, depth: ball.r - d };
    const sides = [
      { v: ball.x - rect.x, nx: -1, ny: 0 },
      { v: rect.x + rect.w - ball.x, nx: 1, ny: 0 },
      { v: ball.y - rect.y, nx: 0, ny: -1 },
      { v: rect.y + rect.h - ball.y, nx: 0, ny: 1 }
    ].sort((a, b) => a.v - b.v);
    return { ...sides[0], depth: ball.r + sides[0].v };
  }
  class Game {
    constructor({ random = Math.random, onEvent = () => {} } = {}) {
      this.random = random; this.onEvent = onEvent; this.nextId = 0;
      this.reset();
    }
    emit(type, data = {}) { this.onEvent({ type, ...data }); }
    reset() {
      this.level = 1; this.lives = 3; this.score = 0; this.combo = 0;
      this.time = 0; this.lastKill = -99; this.state = 'ready';
      this.paddle = { x: W / 2, y: H - 85, w: BASE_PADDLE, h: 14, vx: 0, vy: 0 };
      this.target = { x: this.paddle.x, y: this.paddle.y };
      this.balls = []; this.drops = []; this.pending = []; this.effects = { grow: 0, shrink: 0 };
      this.generate();
    }
    get damage() { return 1 + Math.floor((this.level - 1) / 2) + (this.cleanup ? 2 : 0); }
    get speed() { return Math.min(570, 370 + (this.level - 1) * 23); }
    get remaining() { return this.bricks.filter(b => b.hp > 0).length; }
    move(x, y) { this.target = { x: clamp(x, this.paddle.w / 2 + 3, W - this.paddle.w / 2 - 3), y: clamp(y, 14, H - 18) }; }
    health() {
      const max = Math.min(100, 7 + this.level * 5);
      const hard = this.random() < Math.min(0.18, 0.04 + this.level * 0.012);
      return hard ? Math.min(100, max + 5 + Math.floor(this.random() * this.level * 8)) : 1 + Math.floor(Math.pow(this.random(), 1.7) * max);
    }
    makeBrick(col, row, hp = this.health()) {
      return { id: ++this.nextId, col, row, x: 40 + col * 81, y: 68 + row * 39, w: 73, h: 31,
        hp, maxHp: hp, power: this.random() < .23 ? TYPES[Math.floor(this.random() * 4)] : null, flash: 0 };
    }
    generate() {
      this.bricks = []; this.cleanup = false;
      this.pattern = Math.floor(this.random() * PATTERNS.length);
      const rows = Math.min(7, 5 + Math.floor(this.level / 3));
      for (let row = 0; row < rows; row++) for (let col = 0; col < 12; col++) {
        const x = Math.abs(col - 5.5), y = Math.abs(row - (rows - 1) / 2);
        const mask = [row % 3 !== col % 4, col !== 5 && col !== 6,
          x / 6 + y / (rows / 2) < 1.45,
          !(x < 2.2 && y < 1.2), (col + row * 2) % 7 !== 0][this.pattern];
        if (mask && this.random() > .09) this.bricks.push(this.makeBrick(col, row));
      }
      // Even a deliberately degenerate random source must leave a playable stage.
      if (!this.bricks.length) this.bricks.push(this.makeBrick(5, 0, 1));
      this.patternName = PATTERNS[this.pattern]; this.initialCount = this.bricks.length;
    }
    newBall(x, y, vx, vy) {
      const b = { id: ++this.nextId, x, y, vx, vy, r: BALL_R, trail: [], hitAt: new Map() };
      this.normalize(b); return b;
    }
    normalize(b) {
      let speed = Math.hypot(b.vx, b.vy) || this.speed;
      const target = clamp(speed, this.speed * .9, Math.min(650, this.speed * 1.3));
      b.vx = b.vx / speed * target; b.vy = b.vy / speed * target;
      if (Math.abs(b.vy) < target * .22) {
        b.vy = (b.vy < 0 ? -1 : 1) * target * .22;
        b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(target * target - b.vy * b.vy);
      }
    }
    launch() {
      this.paddle.x = W / 2; this.paddle.y = H - 85;
      this.target = { x: this.paddle.x, y: this.paddle.y };
      this.balls = [this.newBall(W / 2, H - 106, this.speed * .32, -this.speed * .948)];
      this.state = 'running'; this.emit('launch');
    }
    action() {
      if (this.state === 'gameOver') { this.reset(); this.launch(); }
      else if (this.state === 'ready' || this.state === 'lifeLost') this.launch();
      else if (this.state === 'levelComplete') {
        this.level++; this.drops = []; this.pending = []; this.effects = { grow: 0, shrink: 0 };
        this.paddle.w = BASE_PADDLE; this.combo = 0; this.generate(); this.launch();
      } else if (this.state === 'paused') this.state = 'running';
      else if (this.state === 'running') this.state = 'paused';
    }
    pause() { if (this.state === 'running') this.state = 'paused'; }
    applyPower(type) {
      if (type === 'split') {
        const source = this.balls[0];
        if (source) for (const angle of [-.40, .40]) {
          if (this.balls.length >= 9) break;
          this.balls.push(this.newBall(source.x, source.y,
            source.vx * Math.cos(angle) - source.vy * Math.sin(angle),
            source.vx * Math.sin(angle) + source.vy * Math.cos(angle)));
        }
      } else if (type === 'grow') { this.effects.grow = this.time + 18; this.effects.shrink = 0; }
      else if (type === 'shrink') { this.effects.shrink = this.time + 10; this.effects.grow = 0; }
      else if (type === 'spawn') {
        const empty = [];
        for (let row = 0; row < 7; row++) for (let col = 0; col < 12; col++) {
          if (!this.bricks.some(b => b.hp > 0 && b.col === col && b.row === row) &&
              !this.pending.some(b => b.col === col && b.row === row)) empty.push({ col, row });
        }
        for (let i = 0; i < 5 && empty.length; i++) {
          const pos = empty.splice(Math.floor(this.random() * empty.length), 1)[0];
          const b = this.makeBrick(pos.col, pos.row, 1 + Math.floor(this.random() * 3));
          b.bonus = true; b.power = null; b.spawnAt = this.time + 1.25; this.pending.push(b);
        }
      }
      this.emit('power', { power: type });
    }
    hitBrick(b, ball) {
      if (this.time - (ball.hitAt.get(b.id) ?? -1) < .065) return;
      ball.hitAt.set(b.id, this.time);
      const dealt = Math.min(b.hp, this.damage); b.hp -= dealt; b.flash = .10;
      this.score += dealt * 2;
      this.emit('hit', { x: ball.x, y: ball.y, hp: b.maxHp });
      if (b.hp <= 0) {
        this.combo = this.time - this.lastKill < 3.5 ? this.combo + 1 : 1; this.lastKill = this.time;
        const points = (b.bonus ? 100 : 35) * Math.min(5, 1 + Math.floor(this.combo / 4));
        this.score += points;
        this.emit('break', { x: b.x + b.w / 2, y: b.y + b.h / 2, hp: b.maxHp, points });
        if (b.power) this.drops.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, type: b.power, r: 13 });
      }
    }
    update(dt) {
      if (this.state !== 'running') return;
      dt = clamp(dt, 0, .05);
      // 480 Hz substeps bound relative ball/paddle displacement and avoid tunnelling.
      const steps = Math.max(1, Math.ceil(dt * 480));
      for (let i = 0; i < steps && this.state === 'running'; i++) this.step(dt / steps);
    }
    step(dt) {
      this.time += dt;
      if (this.time - this.lastKill > 3.5) this.combo = 0;
      const p = this.paddle;
      p.w = BASE_PADDLE * (this.effects.grow > this.time ? 1.3 : this.effects.shrink > this.time ? .7 : 1);
      const tx = clamp(this.target.x, p.w / 2 + 3, W - p.w / 2 - 3);
      const dx = tx - p.x, dy = this.target.y - p.y, distance = Math.hypot(dx, dy);
      const factor = distance ? Math.min(1, 1800 * dt / distance) : 0;
      const oldX = p.x, oldY = p.y;
      p.x = clamp(p.x + dx * factor, p.w / 2 + 3, W - p.w / 2 - 3);
      p.y = clamp(p.y + dy * factor, 14, H - 18);
      p.vx = dt ? (p.x - oldX) / dt : 0; p.vy = dt ? (p.y - oldY) / dt : 0;
      const rect = { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
      for (const b of this.bricks) b.flash = Math.max(0, b.flash - dt);
      for (const b of this.balls) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
        if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
        const c = contact(b, rect);
        if (c) {
          b.x += c.nx * (c.depth + .1); b.y += c.ny * (c.depth + .1);
          if (!b.paddleTouch && (b.vx - p.vx) * c.nx + (b.vy - p.vy) * c.ny < 0) {
            if (Math.abs(c.ny) > .5) {
              const offset = clamp((b.x - p.x) / (p.w / 2), -.95, .95);
              const angle = offset * 1.02 + clamp(p.vx / 7000, -.16, .16);
              const speed = clamp(Math.hypot(b.vx, b.vy) * 1.01, this.speed, Math.min(650, this.speed * 1.3));
              b.vx = Math.sin(angle) * speed; b.vy = (c.ny < 0 ? -1 : 1) * Math.cos(angle) * speed;
            } else { b.vx = c.nx * Math.max(Math.abs(b.vx), this.speed * .4); }
            this.normalize(b); this.emit('bounce', { x: b.x, y: b.y });
          }
          b.paddleTouch = true;
        } else b.paddleTouch = false;
        for (const brick of this.bricks) {
          if (brick.hp <= 0) continue;
          const c = contact(b, brick); if (!c) continue;
          b.x += c.nx * (c.depth + .05); b.y += c.ny * (c.depth + .05);
          const dot = b.vx * c.nx + b.vy * c.ny;
          if (dot < 0) { b.vx -= 2 * dot * c.nx; b.vy -= 2 * dot * c.ny; this.hitBrick(brick, b); }
          this.normalize(b); break;
        }
      }
      this.balls = this.balls.filter(b => b.y - b.r <= H);
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const d = this.drops[i]; d.y += 108 * dt;
        if (contact(d, rect)) { this.drops.splice(i, 1); this.applyPower(d.type); }
        else if (d.y > H + 20) this.drops.splice(i, 1);
      }
      this.pending = this.pending.filter(b => {
        if (this.time < b.spawnAt) return true;
        const touchesPaddle = b.x < rect.x + rect.w && b.x + b.w > rect.x && b.y < rect.y + rect.h && b.y + b.h > rect.y;
        if (touchesPaddle || this.balls.some(ball => contact(ball, { x: b.x - 12, y: b.y - 12, w: b.w + 24, h: b.h + 24 }))) return true;
        this.bricks.push(b); return false;
      });
      if (!this.remaining && !this.pending.length) {
        this.state = 'levelComplete'; this.score += 300 * this.level; this.emit('clear');
      } else if (!this.balls.length) {
        this.lives--; this.combo = 0; this.drops = []; this.pending = [];
        this.effects = { grow: 0, shrink: 0 }; this.paddle.w = BASE_PADDLE;
        this.state = this.lives > 0 ? 'lifeLost' : 'gameOver'; this.emit('lost');
      } else if (this.remaining <= 3 && !this.pending.length && !this.cleanup) {
        this.cleanup = true; this.emit('cleanup');
      }
    }
  }
  const api = { Game, W, H, BASE_PADDLE, TYPES, contact, clamp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Breaker = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
