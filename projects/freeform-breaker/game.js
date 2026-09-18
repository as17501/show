(() => {
  'use strict';
  const { Game, W, H, clamp } = Breaker;
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const colors = ['#b8df8b', '#86ba99', '#85b8c6', '#afa2ce', '#d4a977', '#da8796'];
  const powerStyle = {
    split: { color: '#c0f58a', icon: '⋔', label: '一球变三 · 最多 9 球' },
    grow: { color: '#9bc8ed', icon: '↔', label: '挡板加长 30% · 18 秒' },
    spawn: { color: '#efba77', icon: '▦', label: '砖块增生 · 5 块高分脆砖即将出现' },
    shrink: { color: '#e89dba', icon: '⇥⇤', label: '挡板缩短 30% · 10 秒' }
  };
  const colorFor = hp => colors[hp <= 3 ? 0 : hp <= 8 ? 1 : hp <= 16 ? 2 : hp <= 30 ? 3 : hp <= 60 ? 4 : 5];
  let particles = [], popups = [], rings = [], best = 0, sound = false, audio = null, lastTone = 0;
  let toastUntil = 0, lastState = '', lastHud = 0, trailClock = 0, restartPending = false;
  const keys = new Set();
  try { best = Number(localStorage.getItem('freeform-best')) || 0; sound = localStorage.getItem('freeform-sound') === 'true'; } catch {}
  function tone(freq, length = .06, volume = .025) {
    if (!sound || !audio || audio.state !== 'running' || audio.currentTime - lastTone < .025) return;
    lastTone = audio.currentTime;
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(freq, audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * .6, audio.currentTime + length);
    gain.gain.setValueAtTime(volume, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + length);
    osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + length);
  }
  function unlockAudio() {
    if (!sound) return;
    try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); void audio.resume().catch(() => {}); } catch { sound = false; updateSound(); }
  }
  function notify(text) { $('toast').textContent = text; toastUntil = performance.now() + 2700; $('toast').classList.add('visible'); }
  const game = new Game({ onEvent(e) {
    if (e.type === 'break') {
      for (let i = 0; i < 12; i++) particles.push({ x: e.x, y: e.y, vx: (Math.random() - .5) * 270, vy: (Math.random() - .5) * 240, life: .5 + Math.random() * .3, maxLife: .8, size: 2 + Math.random() * 3, color: colorFor(e.hp) });
      popups.push({ x: e.x, y: e.y, text: '+' + e.points, life: .7 }); tone(570 + Math.min(10, game.combo) * 42, .09);
    } else if (e.type === 'hit') { tone(270 + e.hp * 3, .035, .012); }
    else if (e.type === 'bounce') { rings.push({ x: e.x, y: e.y, life: .25 }); tone(440, .055); }
    else if (e.type === 'power') { notify(powerStyle[e.power].label); tone(e.power === 'shrink' ? 180 : 780, .18, .04); }
    else if (e.type === 'cleanup') notify('收尾加速 · 最后 3 块，球体伤害 +2');
    else if (e.type === 'clear') { tone(990, .3, .04); saveBest(); }
    else if (e.type === 'lost') { tone(120, .35, .045); saveBest(); }
  } });
  function saveBest() {
    best = Math.max(best, game.score);
    try { localStorage.setItem('freeform-best', String(best)); } catch {}
  }
  function roundRect(x, y, w, h, radius, fill, stroke) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function render(now, dt) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#111a17'; ctx.fillRect(0, 0, W, H);
    // A quiet drafting grid keeps the field readable behind dense layouts.
    ctx.fillStyle = '#314034';
    for (let x = 20; x < W; x += 26) for (let y = 18; y < H; y += 26) { ctx.globalAlpha = .42; ctx.fillRect(x, y, 1, 1); }
    ctx.globalAlpha = 1;
    const glow = ctx.createRadialGradient(W / 2, 180, 0, W / 2, 180, 480);
    glow.addColorStop(0, '#8daa6110'); glow.addColorStop(1, '#8daa6100'); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#8baf6340'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(1, H - 30); ctx.lineTo(1, 1); ctx.lineTo(W - 1, 1); ctx.lineTo(W - 1, H - 30); ctx.stroke();
    ctx.setLineDash([5, 9]); ctx.strokeStyle = '#cb96754a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(20, H - 30); ctx.lineTo(W - 20, H - 30); ctx.stroke(); ctx.setLineDash([]);
    for (const b of game.pending) {
      ctx.globalAlpha = .4 + Math.sin(now / 110) * .22;
      ctx.setLineDash([4, 4]); roundRect(b.x, b.y, b.w, b.h, 5, '#efba7710', '#efba77'); ctx.setLineDash([]);
      ctx.fillStyle = '#efba77'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('+', b.x + b.w / 2, b.y + 21); ctx.globalAlpha = 1;
    }
    for (const b of game.bricks) {
      if (b.hp <= 0) continue;
      const color = colorFor(b.maxHp);
      ctx.globalAlpha = .82 + .18 * b.hp / b.maxHp;
      roundRect(b.x, b.y, b.w, b.h, 5, b.flash > 0 ? '#eaffd4' : color);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff32'; ctx.fillRect(b.x + 6, b.y + 1, b.w - 12, 1);
      if (b.hp < b.maxHp) {
        roundRect(b.x + 7, b.y + b.h - 5, b.w - 14, 2, 1, '#10241b30');
        roundRect(b.x + 7, b.y + b.h - 5, (b.w - 14) * b.hp / b.maxHp, 2, 1, '#183322a0');
        if (b.hp / b.maxHp < .5) {
          ctx.strokeStyle = '#15332350'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(b.x + 14, b.y); ctx.lineTo(b.x + 20, b.y + 8); ctx.lineTo(b.x + 15, b.y + 14); ctx.stroke();
        }
      }
      ctx.fillStyle = '#152920'; ctx.font = '600 14px ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillText(String(b.hp), b.x + b.w / 2, b.y + 21);
      if (b.power) {
        const s = powerStyle[b.power];
        roundRect(b.x + b.w - 17, b.y + 4, 13, 13, 3, '#19251dd0');
        ctx.fillStyle = s.color; ctx.font = '10px sans-serif'; ctx.fillText(s.icon, b.x + b.w - 10.5, b.y + 14);
      }
      if (b.bonus) { ctx.fillStyle = '#263220'; ctx.font = '10px monospace'; ctx.fillText('★', b.x + 10, b.y + 14); }
    }
    for (const d of game.drops) {
      const s = powerStyle[d.type]; ctx.shadowColor = s.color; ctx.shadowBlur = 13;
      roundRect(d.x - 14, d.y - 14, 28, 28, 7, '#1d2923', s.color); ctx.shadowBlur = 0;
      ctx.fillStyle = s.color; ctx.textAlign = 'center'; ctx.font = '19px sans-serif'; ctx.fillText(s.icon, d.x, d.y + 6);
    }
    const p = game.paddle, pc = game.effects.shrink > game.time ? '#e89dba' : game.effects.grow > game.time ? '#9bc8ed' : '#c0f58a';
    ctx.shadowColor = pc; ctx.shadowBlur = 20;
    roundRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, 7, pc, '#edfbd7'); ctx.shadowBlur = 0;
    roundRect(p.x - p.w / 2 + 12, p.y - 2, p.w - 24, 4, 2, '#223b2930');
    for (let j = -1; j <= 1; j++) { ctx.fillStyle = '#1a331b60'; ctx.fillRect(p.x + j * 5 - .5, p.y - 2, 1, 4); }
    if (game.state === 'ready' || game.state === 'lifeLost') {
      ctx.setLineDash([4, 9]); ctx.strokeStyle = '#c0f58a45'; ctx.beginPath(); ctx.moveTo(p.x, p.y - 20); ctx.lineTo(p.x + 33, p.y - 115); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#f2f8dc'; ctx.beginPath(); ctx.arc(p.x, p.y - 20, 7, 0, Math.PI * 2); ctx.fill();
    }
    trailClock += dt;
    const addTrail = trailClock > 1 / 55 && game.state === 'running'; if (addTrail) trailClock = 0;
    for (const b of game.balls) {
      if (addTrail) { b.trail.unshift({ x: b.x, y: b.y }); if (b.trail.length > 11) b.trail.pop(); }
      for (let i = b.trail.length - 1; i >= 0; i--) {
        ctx.globalAlpha = (1 - i / b.trail.length) * .22; ctx.fillStyle = '#ddf5ae';
        ctx.beginPath(); ctx.arc(b.trail[i].x, b.trail[i].y, b.r * (1 - i / 14), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.shadowColor = '#d4ffa2'; ctx.shadowBlur = 17; ctx.fillStyle = '#f6ffe3';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
    const visualDt = game.state === 'paused' ? 0 : dt;
    for (const p of particles) {
      p.life -= visualDt; p.x += p.vx * visualDt; p.y += p.vy * visualDt; p.vy += visualDt * 150;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    particles = particles.filter(p => p.life > 0).slice(-400);
    for (const p of popups) {
      p.life -= visualDt; p.y -= visualDt * 30; ctx.globalAlpha = Math.max(0, p.life / .7);
      ctx.fillStyle = '#e4f7c9'; ctx.font = '12px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(p.text, p.x, p.y);
    }
    popups = popups.filter(p => p.life > 0);
    for (const r of rings) {
      r.life -= visualDt; ctx.globalAlpha = Math.max(0, r.life / .25); ctx.strokeStyle = '#c0f58a';
      ctx.beginPath(); ctx.arc(r.x, r.y, 8 + (.25 - r.life) * 75, 0, Math.PI * 2); ctx.stroke();
    }
    rings = rings.filter(r => r.life > 0); ctx.globalAlpha = 1;
  }
  const screens = {
    ready: ['不被底线定义', '整个场地，都是你的主场。', '移动鼠标，自由接球。\n挡板上下都能反弹，只有底部会掉球。', '开始游戏'],
    paused: ['TAKE A BREATHER', '休息一下，手感还在。', '游戏与道具计时已暂停。\n准备好后，继续你的自由反弹。', '继续游戏'],
    lifeLost: ['再来一球', '没关系，节奏重新找。', () => `还有 ${game.lives} 条生命，砖块进度已保留。\n场上所有球掉出底部，才扣一条命。`, '发射新球'],
    levelComplete: ['STAGE CLEAR', '漂亮！这一场，全部击破。', () => `过关奖励 +${game.level * 300} · 当前得分 ${game.score}\n下一关将生成新的砖块组合。`, '下一关'],
    gameOver: ['GOOD GAME', '这一局，打得很自由。', () => `最终得分 ${game.score} · 抵达第 ${game.level} 关\n换一种组合，再挑战一次？`, '再玩一次']
  };
  function updateHud(now, force = false) {
    if (!force && now - lastHud < 80 && lastState === game.state) return; lastHud = now;
    $('score').textContent = String(game.score).padStart(6, '0');
    $('best').textContent = String(Math.max(best, game.score)).padStart(6, '0');
    $('level').textContent = String(game.level).padStart(2, '0'); $('remaining').textContent = game.remaining;
    $('damage').innerHTML = String(game.damage).padStart(2, '0') + ' <small>DMG</small>';
    $('lives').textContent = '♥ '.repeat(game.lives) + '♡ '.repeat(3 - game.lives);
    $('lives').setAttribute('aria-label', `${game.lives}条生命`);
    $('pattern').textContent = game.patternName; $('ball-count').textContent = `${String(game.balls.length || (game.state === 'ready' ? 1 : 0)).padStart(2, '0')} BALL${game.balls.length > 1 ? 'S' : ''}`;
    $('status').textContent = { ready: '准备就绪', running: game.cleanup ? '收尾加速 · 伤害 +2' : '游戏进行中', paused: '已暂停', lifeLost: '等待发射', levelComplete: '关卡完成', gameOver: '游戏结束' }[game.state];
    $('pause').textContent = game.state === 'running' ? '暂停 Ⅱ' : game.state === 'paused' ? '继续 ▷' : '开始 ▷';
    $('combo').classList.toggle('visible', game.combo >= 2); $('combo').querySelector('strong').textContent = '× ' + game.combo;
    const active = [];
    for (const type of ['grow', 'shrink']) if (game.effects[type] > game.time) {
      const time = game.effects[type] - game.time, total = type === 'grow' ? 18 : 10;
      active.push(`<div class="effect-line ${type === 'shrink' ? 'negative' : ''}"><span>${type === 'grow' ? '↔ 挡板加长 +30%' : '⇥⇤ 挡板缩短 −30%'}</span><span>${Math.ceil(time)}s</span></div><div class="effect-track"><i style="width:${time / total * 100}%;background:${powerStyle[type].color}"></i></div>`);
    }
    if (game.balls.length > 1) active.push(`<div class="effect-line"><span>⋔ 多球模式</span><span>${game.balls.length} / 9</span></div>`);
    if (game.cleanup) active.push('<div class="effect-line"><span>↗ 收尾加速</span><span>伤害 +2</span></div>');
    if (game.pending.length) active.push(`<div class="effect-line"><span>▦ 砖块增生预告</span><span>${game.pending.length} 块</span></div>`);
    $('effects').innerHTML = active.join('') || '<p class="empty-effects">暂无效果，接住你的第一份补给。</p>';
    $('effect-count').textContent = `${active.length} ACTIVE`;
    if (lastState !== game.state || force) {
      lastState = game.state; $('overlay').classList.toggle('hidden', game.state === 'running');
      if (screens[game.state]) {
        const [tag, title, desc, button] = screens[game.state];
        $('overlay-tag').textContent = tag; $('overlay-title').textContent = title;
        $('overlay-desc').innerText = typeof desc === 'function' ? desc() : desc;
        $('primary').innerHTML = `${button} <span>↗</span>`;
        document.querySelector('.key-hint').innerHTML = `或按 <kbd>SPACE</kbd> ${game.state === 'paused' ? '继续' : '开始'}`;
      }
      if (game.state === 'gameOver' || game.state === 'levelComplete') saveBest();
    }
  }
  function performAction() { restartPending = false; unlockAudio(); game.action(); updateHud(performance.now(), true); }
  $('primary').addEventListener('click', performAction);
  $('pause').addEventListener('click', performAction);
  function updateSound() { $('sound').textContent = sound ? '音效 ON' : '音效 OFF'; $('sound').setAttribute('aria-pressed', String(sound)); $('sound').setAttribute('aria-label', sound ? '关闭音效' : '开启音效'); }
  $('sound').addEventListener('click', () => { sound = !sound; updateSound(); unlockAudio(); try { localStorage.setItem('freeform-sound', String(sound)); } catch {} if (sound) tone(660, .12); });
  $('restart').addEventListener('click', () => {
    if ((game.state === 'running' || game.state === 'paused') && !restartPending) {
      game.pause(); restartPending = true; notify('再点一次「重新开始」确认重置；也可继续游戏'); updateHud(performance.now(), true); return;
    }
    saveBest(); game.reset(); particles = []; popups = []; rings = []; restartPending = false; lastState = ''; updateHud(performance.now(), true);
  });
  $('fullscreen').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('arena').requestFullscreen(); }
    catch { notify('当前窗口不支持全屏，可在浏览器中打开试玩'); }
  });
  function pointer(e) {
    const rect = canvas.getBoundingClientRect(); game.move((e.clientX - rect.left) / rect.width * W, (e.clientY - rect.top) / rect.height * H);
  }
  canvas.addEventListener('pointermove', pointer);
  canvas.addEventListener('pointerdown', e => { if (e.button !== 0) return; canvas.focus({ preventScroll: true }); canvas.setPointerCapture(e.pointerId); pointer(e); unlockAudio(); });
  window.addEventListener('keydown', e => {
    if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) {
      if (e.code === 'Space' || e.code === 'Enter') return;
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Escape'].includes(e.code)) {
      e.preventDefault(); if (!e.repeat && e.code === 'Space') performAction();
      else if (!e.repeat && e.code === 'Escape') { game.pause(); updateHud(performance.now(), true); }
      else keys.add(e.code);
    }
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); game.pause(); saveBest(); updateHud(performance.now(), true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); game.pause(); saveBest(); } });
  window.addEventListener('pagehide', saveBest);
  let previous = performance.now(), accumulator = 0;
  function frame(now) {
    const dt = Math.min(.05, (now - previous) / 1000); previous = now;
    if (game.state === 'running') {
      const x = Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA'));
      const y = Number(keys.has('ArrowDown') || keys.has('KeyS')) - Number(keys.has('ArrowUp') || keys.has('KeyW'));
      if (x || y) game.move(game.paddle.x + x * 650 * dt, game.paddle.y + y * 650 * dt);
      accumulator += dt;
      while (accumulator >= 1 / 120) { game.update(1 / 120); accumulator -= 1 / 120; }
    } else accumulator = 0;
    if (now > toastUntil) $('toast').classList.remove('visible');
    render(now, dt); updateHud(now); requestAnimationFrame(frame);
  }
  updateSound(); updateHud(performance.now(), true); requestAnimationFrame(frame);
  // Explicit opt-in inspection hook for local smoke tests, absent during normal play.
  if (new URLSearchParams(location.search).has('test')) window.__game = game;
})();
