import * as THREE from './vendor/three.module.min.js';

(() => {
'use strict';

const canvas = document.getElementById('game');
const hud = document.getElementById('hud');
const ctx = hud.getContext('2d');
const overlay = document.getElementById('overlay');
const card = document.getElementById('card');
const dashBtn = document.getElementById('dash');
const muteBtn = document.getElementById('mute');

const TAU = Math.PI * 2;
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const pick = (a) => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------------------------------------------------------------- content

const MUTATORS = [
  { id: 'storm', name: 'BULLET STORM', tag: 'you shoot in every direction', color: '#ffd23f', dur: 10 },
  { id: 'bouncy', name: 'RUBBER BULLETS', tag: 'shots bounce off the walls', color: '#3ff0ff', dur: 12 },
  { id: 'clones', name: 'CLONE ARMY', tag: 'four of you is better than one', color: '#a0ff9b', dur: 10 },
  { id: 'disco', name: 'DISCO FEVER', tag: 'double points, everybody dance', color: '#ff7bf5', dur: 10 },
  { id: 'loot', name: 'LOOT PINATA', tag: 'everything is stuffed with gems', color: '#ffe66d', dur: 9 },
  { id: 'chain', name: 'CHAIN REACTION', tag: 'enemies explode into each other', color: '#fff275', dur: 11 },
  { id: 'ice', name: 'ICE RINK', tag: 'nobody has any grip', color: '#9be7ff', dur: 10 },
  { id: 'reverse', name: 'SDRAWKCAB', tag: 'your controls are reversed', color: '#ff5d8f', dur: 6 },
  { id: 'hole', name: 'BLACK HOLE', tag: 'it eats everything. including you', color: '#b388ff', dur: 9 },
  { id: 'huge', name: 'BIG MODE', tag: 'enemies are enormous and slow', color: '#ff9f1c', dur: 10 },
  { id: 'zoom', name: 'ZOOMIES', tag: 'everything is way too fast', color: '#7cff6b', dur: 8 },
  { id: 'slow', name: 'BULLET TIME', tag: 'enemies wade through honey', color: '#6bffd8', dur: 7 },
  { id: 'meteor', name: 'METEOR SHOWER', tag: 'stay out of the red circles', color: '#ff6b35', dur: 9 },
  { id: 'tilt', name: 'TILT-A-WHIRL', tag: 'the arena is seasick', color: '#5dd9ff', dur: 9 },
  { id: 'rampage', name: 'RAMPAGE', tag: "can't shoot. can't die. RAM THEM", color: '#ff3b3b', dur: 6 },
  { id: 'dark', name: 'LIGHTS OUT', tag: 'who turned off the lights?', color: '#aab4d4', dur: 7 },
  { id: 'bertha', name: 'BIG BERTHA', tag: 'she is here and she is angry', color: '#ff4d6d', dur: 3, instant: true },
  { id: 'laser', name: 'DEATH RAY', tag: 'dash through the beam. or else', color: '#ff2e63', dur: 9 },
  { id: 'mega', name: 'MEGA CANNON', tag: 'huge shots that punch through everything', color: '#ffb703', dur: 9 },
  { id: 'homing', name: 'HEAT SEEKERS', tag: 'your bullets have opinions', color: '#80ffdb', dur: 10 },
  { id: 'hydra', name: 'HYDRA', tag: 'kill one, two more pop out', color: '#52b788', dur: 8 },
  { id: 'swarm', name: "SWARM O'CLOCK", tag: 'triple the enemies, extra loot', color: '#f72585', dur: 8 },
  { id: 'warp', name: 'TELEPORT ROULETTE', tag: 'you will not stay where you are', color: '#c77dff', dur: 8 },
  { id: 'mirror', name: 'MIRROR WORLD', tag: 'left is right is left', color: '#48cae4', dur: 7 },
  { id: 'wrap', name: 'NO WALLS', tag: 'leave one side, arrive on the other', color: '#b5e48c', dur: 10 },
  { id: 'emoji', name: 'CLOWN INVASION', tag: 'this is fine', color: '#ffc8dd', dur: 10 },
  { id: 'jackpot', name: 'TRIPLE JACKPOT', tag: 'three rules at once. good luck', color: '#ffd700', dur: 2, instant: true },
];
// Pairs that would hide a lethal hazard or cancel each other out.
const CLASH = { dark: ['laser', 'meteor'], laser: ['dark'], meteor: ['dark'], reverse: ['mirror'], mirror: ['reverse'] };
const EMOJI = ['\u{1F921}', '\u{1F47B}', '\u{1F4A9}', '\u{1F47D}', '\u{1F916}', '\u{1F383}', '\u{1F479}', '\u{1F414}'];
const FRIENDLY_FIRST = ['storm', 'bouncy', 'clones', 'disco', 'loot', 'mega', 'homing'];

const TYPES = {
  grunt: { r: 14, hp: 2, spd: 72, color: '#ff5d73', score: 10 },
  runner: { r: 10, hp: 1, spd: 150, color: '#ffd23f', score: 15 },
  tank: { r: 24, hp: 10, spd: 44, color: '#9d6bff', score: 40 },
  splitter: { r: 18, hp: 4, spd: 60, color: '#4dd599', score: 25 },
  mini: { r: 8, hp: 1, spd: 125, color: '#4dd599', score: 5 },
  shooter: { r: 13, hp: 3, spd: 58, color: '#ff9f1c', score: 30 },
  bertha: { r: 58, hp: 60, spd: 40, color: '#ff4d6d', score: 500 },
};

// ------------------------------------------------------------------ state

const W = 1400, H = 900; // arena size in world units
let SW = 0, SH = 0, DPR = 1, ui = 1, gfx = null;
let state = 'menu'; // menu | play | pause | over
let gt = 0; // animation clock, keeps running outside of play
let time = 0, score = 0, kills = 0, combo = 0, comboT = 0, bestCombo = 0, mutatorsSeen = 0;
let best = 0;
try { best = +localStorage.getItem('mayhem-best') || 0; } catch (e) { /* storage unavailable */ }

let p, enemies = [], bullets = [], orbs = [], particles = [], pickups = [], texts = [], booms = [], hazards = [];
let active = [], flags = {}, roll = null, banner = null, chaosT = 0, lastMutator = '';
let spawnT = 0, hordeT = 0, meteorT = 0, hole = { x: 0, y: 0 };
let shakeAmt = 0, hitStop = 0, flash = 0, hugeK = 1, stormAng = 0, shotSfxT = 0;
const cam = { a: 0, z: 1, fx: 1, sx: 0, sy: 0 };
let warpT = 0, warpTo = null, laserA = 0;
const chaosGap = () => (time < 30 ? 6 : time < 80 ? 4.5 : time < 150 ? 3.5 : 2.8);
const overdrive = () => active.filter((a) => !a.def.instant).length >= 4;

const keys = {};
const mouse = { x: 0, y: 0 };
const joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
let aimMode = 'auto';
let wantDash = false;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  SW = window.innerWidth;
  SH = window.innerHeight;
  hud.width = Math.round(SW * DPR);
  hud.height = Math.round(SH * DPR);
  ui = clamp(Math.min(SW, SH) / 700, 0.62, 1.15);
  if (gfx) gfx.resize();
}
window.addEventListener('resize', resize);
resize();

function reset() {
  p = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 14, hp: 3, maxHp: 5, inv: 0, dashT: 0, dashCd: 0, fireCd: 0, aim: 0 };
  enemies = []; bullets = []; orbs = []; particles = []; pickups = []; texts = []; booms = []; hazards = [];
  active = []; flags = {}; roll = null; banner = null; lastMutator = '';
  time = 0; score = 0; kills = 0; combo = 0; comboT = 0; bestCombo = 0; mutatorsSeen = 0;
  chaosT = 3.5; spawnT = 0.5; hordeT = 30; meteorT = 0; warpTo = null;
  shakeAmt = 0; hitStop = 0; flash = 0; hugeK = 1;
}

// ------------------------------------------------------------------ audio

let ac = null, master = null, muted = false, noiseBuf = null;
let musicT = 0, musicStep = 0, musicRoot = 45;

function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = 0.35;
    master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ac = null; }
}

function beep(freq, dur, type = 'square', vol = 0.2, slide = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol) {
  if (!ac || muted) return;
  const t = ac.currentTime, s = ac.createBufferSource(), g = ac.createGain();
  s.buffer = noiseBuf;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(g); g.connect(master);
  s.start(t); s.stop(t + dur + 0.02);
}

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const sfx = {
  shot() { if (shotSfxT <= 0) { shotSfxT = 0.09; beep(rand(620, 700), 0.05, 'square', 0.035, -300); } },
  kill() { beep(rand(180, 260), 0.1, 'triangle', 0.16, -120); noise(0.06, 0.08); },
  hurt() { beep(160, 0.4, 'sawtooth', 0.3, -120); noise(0.25, 0.25); },
  gem() { beep(midi(72 + Math.min(combo, 24) / 2), 0.07, 'sine', 0.12); },
  heart() { beep(523, 0.1, 'sine', 0.2); setTimeout(() => beep(784, 0.18, 'sine', 0.2), 90); },
  boom() { beep(90, 0.3, 'sine', 0.35, -55); noise(0.25, 0.2); },
  dash() { noise(0.12, 0.12); beep(300, 0.12, 'sine', 0.1, 500); },
  roll() { beep(rand(400, 900), 0.04, 'square', 0.05); },
  chaos() { [0, 4, 7, 12].forEach((n, i) => setTimeout(() => beep(midi(64 + n), 0.14, 'square', 0.12), i * 60)); },
  over() { [12, 7, 3, 0].forEach((n, i) => setTimeout(() => beep(midi(52 + n), 0.3, 'sawtooth', 0.15), i * 170)); },
};

const BASS = [0, null, 0, 7, 0, null, 3, null, 0, null, 0, 7, 5, null, 3, null];
const ARP = [0, 3, 7, 10, 12, 10, 7, 3];
function music(raw) {
  if (!ac || muted || state !== 'play') return;
  musicT -= raw * (flags.zoom ? 1.3 : flags.slow ? 0.75 : 1);
  if (musicT > 0) return;
  musicT = musicT < -0.3 ? 0.125 : musicT + 0.125;
  const s = musicStep++ % 16;
  if (s % 4 === 0) beep(125, 0.12, 'sine', 0.4, -85);
  if (s % 4 === 2) noise(0.03, 0.06);
  if (BASS[s] !== null) beep(midi(musicRoot + BASS[s]), 0.11, 'sawtooth', 0.06);
  if (active.length && s % 2 === 1) beep(midi(musicRoot + 24 + ARP[(musicStep >> 1) % 8]), 0.07, 'square', 0.03);
}

// ---------------------------------------------------------------- effects

function burst(x, y, color, n, speed = 220) {
  for (let i = 0; i < n && particles.length < 700; i++) {
    const a = rand(TAU), s = rand(speed * 0.2, speed);
    const life = rand(0.25, 0.7);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: life, life, color, size: rand(2, 5) });
  }
}
function floatText(x, y, txt, color = '#fff', size = 16) {
  if (texts.length < 60) texts.push({ x, y, txt, color, size, t: 0.9 });
}
function shake(n) { shakeAmt = Math.min(22, Math.max(shakeAmt, n)); }
const mult = () => Math.min(10, 1 + ((combo / 8) | 0));

// -------------------------------------------------------------- mutators

function rollPool() {
  return MUTATORS.filter((m) => !flags[m.id] && m.id !== lastMutator && !(CLASH[m.id] || []).some((id) => flags[id]));
}

function startRoll() {
  let pool = rollPool();
  if (mutatorsSeen === 0) pool = pool.filter((m) => FRIENDLY_FIRST.includes(m.id));
  if (!pool.length) return;
  const defs = [pick(pool)];
  // Later in a run the machine deals two rules at a time.
  const doubleChance = time > 100 ? 0.5 : time > 40 ? 0.3 : 0;
  const rest = pool.filter((m) => m !== defs[0] && !m.instant && !(CLASH[defs[0].id] || []).includes(m.id));
  if (!defs[0].instant && rest.length && Math.random() < doubleChance) defs.push(pick(rest));
  roll = { defs, t: 1 };
}

function safeSpot() {
  let spot = null, spotD = -Infinity;
  for (let i = 0; i < 14; i++) {
    const x = rand(60, W - 60), y = rand(60, H - 60);
    let d = flags.hole ? Math.hypot(x - hole.x, y - hole.y) : 1e9;
    for (const e of enemies) d = Math.min(d, Math.hypot(x - e.x, y - e.y) - e.cr);
    if (d > spotD) { spotD = d; spot = { x, y }; }
  }
  return spot;
}

function activate(def) {
  lastMutator = def.id;
  mutatorsSeen++;
  active = active.filter((a) => a.def !== def);
  active.push({ def, t: def.dur });
  flags[def.id] = active[active.length - 1];
  banner = { def, t: 2.2, dur: 2.2 };
  musicRoot = 40 + pick([0, 2, 3, 5, 7]);
  sfx.chaos();
  shake(8);
  if (def.id === 'hole') {
    do { hole.x = rand(W * 0.2, W * 0.8); hole.y = rand(H * 0.2, H * 0.8); }
    while (Math.hypot(hole.x - p.x, hole.y - p.y) < Math.min(W, H) * 0.28);
  }
  if (def.id === 'bertha') spawn('bertha');
  if (def.id === 'warp') { warpT = 1.6; warpTo = null; }
  if (def.id === 'laser') laserA = Math.atan2(p.y - H / 2, p.x - W / 2) + Math.PI / 2;
  if (def.id === 'jackpot') {
    for (let i = 0; i < 3; i++) {
      const pool = rollPool().filter((m) => !m.instant);
      if (!pool.length) break;
      activate(pick(pool));
    }
    banner = { def, t: 2.6, dur: 2.6 };
    flash = 0.4;
  }
  if (def.id === 'meteor') meteorT = 0.6;
}

function updateChaos(dt) {
  for (const a of active) a.t -= dt;
  const ended = active.filter((a) => a.t <= 0);
  if (ended.length) {
    active = active.filter((a) => a.t > 0);
    for (const a of ended) if (!a.def.instant) floatText(p.x, p.y - 34, a.def.name + ' OVER', a.def.color, 13);
  }
  flags = {};
  for (const a of active) flags[a.def.id] = a;

  if (roll) {
    const before = roll.t;
    roll.t -= dt;
    if (((before * 14) | 0) !== ((roll.t * 14) | 0)) sfx.roll();
    if (roll.t <= 0) {
      const defs = roll.defs;
      roll = null;
      for (const d of defs) activate(d);
      if (defs.length > 1) banner = { def: { name: defs.map((d) => d.name).join(' + '), tag: 'double trouble', color: '#fff' }, t: 2.6, dur: 2.6 };
    }
  } else {
    chaosT -= dt;
    if (chaosT <= 0) {
      chaosT = chaosGap();
      startRoll();
    }
  }
}

// ---------------------------------------------------------------- spawning

function spawn(type, x, y) {
  const def = TYPES[type];
  if (x === undefined) {
    const m = def.r + 30, side = (Math.random() * 4) | 0;
    x = side === 0 ? -m : side === 1 ? W + m : rand(W);
    y = side === 2 ? -m : side === 3 ? H + m : rand(H);
  }
  const hp = def.hp * (time > 150 && type !== 'mini' && type !== 'bertha' ? 1.5 : 1);
  enemies.push({
    type, def, x, y, vx: 0, vy: 0, hp, maxHp: hp, r: def.r, cr: def.r,
    seed: rand(100), hit: 0, fire: rand(1, 2.5), side: Math.random() < 0.5 ? 1 : -1, dead: false,
  });
}

function pickType() {
  const bag = ['grunt', 'grunt', 'grunt'];
  if (time > 12) bag.push('runner', 'runner');
  if (time > 28) bag.push('splitter');
  if (time > 45) bag.push('tank');
  if (time > 60) bag.push('shooter');
  if (time > 100) bag.push('runner', 'shooter', 'tank');
  return pick(bag);
}

function updateSpawns(dt) {
  spawnT -= dt;
  if (spawnT <= 0) {
    spawnT = Math.max(0.22, 0.85 - time * 0.009);
    const n = (time > 90 ? 2 : 1) * (flags.swarm ? 3 : 1);
    for (let i = 0; i < n && enemies.length < 120; i++) spawn(pickType());
  }
  hordeT -= dt;
  if (hordeT <= 0) {
    hordeT = 22;
    const n = Math.min(26, 12 + ((time / 30) | 0) * 2), rad = Math.hypot(W, H) / 2 + 40;
    const type = Math.random() < 0.5 ? 'runner' : 'grunt';
    for (let i = 0; i < n; i++) spawn(type, W / 2 + Math.cos((i / n) * TAU) * rad, H / 2 + Math.sin((i / n) * TAU) * rad);
    floatText(W / 2, H * 0.4, 'HORDE!', '#ff5d73', 46);
    beep(110, 0.5, 'sawtooth', 0.2, 110);
  }
  if (flags.meteor) {
    meteorT -= dt;
    if (meteorT <= 0) {
      meteorT = 0.38;
      const near = Math.random() < 0.3;
      hazards.push({
        x: near ? clamp(p.x + rand(-90, 90), 0, W) : rand(W),
        y: near ? clamp(p.y + rand(-90, 90), 0, H) : rand(H),
        r: rand(48, 74), t: 1.15, total: 1.15,
      });
    }
  }
}

// ----------------------------------------------------------------- combat

function damage(e, d) {
  if (e.dead) return;
  e.hp -= d;
  e.hit = 0.08;
  if (e.hp <= 0) kill(e);
}

function drop(type, x, y) {
  if (pickups.length > 160) return;
  const a = rand(TAU), s = rand(40, 170);
  pickups.push({ type, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 10 });
}

function kill(e) {
  e.dead = true;
  if (state !== 'play') return;
  kills++; combo++; comboT = 2.5;
  bestCombo = Math.max(bestCombo, combo);
  const pts = e.def.score * mult() * (flags.disco ? 2 : 1) * (overdrive() ? 2 : 1);
  score += pts;
  floatText(e.x, e.y - e.cr, '+' + pts, flags.disco ? '#ff7bf5' : '#fff', 13 + Math.min(12, pts / 40));
  burst(e.x, e.y, e.def.color, 8 + e.r / 2);
  shake(Math.min(10, 2 + e.r / 6));
  sfx.kill();
  if (e.type === 'splitter') for (let i = 0; i < 3; i++) spawn('mini', e.x + rand(-12, 12), e.y + rand(-12, 12));
  if (flags.hydra && e.type !== 'mini' && e.type !== 'bertha' && enemies.length < 150) {
    for (let i = 0; i < 2; i++) spawn('mini', e.x + rand(-14, 14), e.y + rand(-14, 14));
  }
  if (flags.chain) booms.push({ x: e.x, y: e.y, r: 78, delay: 0.09, dmg: 3, color: '#fff275' });
  if (e.type === 'bertha') {
    for (let i = 0; i < 16; i++) drop('gem', e.x, e.y);
    drop('heart', e.x, e.y);
    burst(e.x, e.y, '#fff', 50, 420);
    shake(20);
    return;
  }
  const gems = (flags.loot ? 3 : Math.random() < 0.35 ? 1 : 0) + (flags.swarm ? 1 : 0);
  for (let i = 0; i < gems; i++) drop('gem', e.x, e.y);
  if (p.hp < p.maxHp && Math.random() < 0.04) drop('heart', e.x, e.y);
  else if (Math.random() < 0.012) drop('bomb', e.x, e.y);
  else if (Math.random() < 0.02) drop('box', e.x, e.y);
}

function hurtPlayer() {
  if (state !== 'play' || p.inv > 0 || p.dashT > 0 || flags.rampage) return;
  p.hp--;
  p.inv = 1.4;
  combo = 0;
  shake(16); hitStop = 0.09; flash = 0.4;
  sfx.hurt();
  burst(p.x, p.y, '#fff', 20, 300);
  if (p.hp <= 0) return gameOver();
  // Shove the crowd back so one hit never chains into a second.
  for (const e of enemies) {
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (d < 170) { e.vx = (dx / d) * 520; e.vy = (dy / d) * 520; }
  }
  orbs = orbs.filter((o) => Math.hypot(o.x - p.x, o.y - p.y) > 170);
}

function shoot(x, y, a) {
  if (bullets.length > 600) return;
  bullets.push({ x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 14, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, life: flags.bouncy ? 2.2 : 1.1, bounces: 3, mega: !!flags.mega, hits: flags.mega ? [] : null });
}

function cloneSpots() {
  const out = [];
  if (!flags.clones) return out;
  for (let i = 0; i < 3; i++) {
    const a = gt * 2.2 + (i * TAU) / 3;
    out.push({ x: p.x + Math.cos(a) * 50, y: p.y + Math.sin(a) * 50 });
  }
  return out;
}

// ----------------------------------------------------------------- update

function toWorld(sx, sy) {
  const fx = Math.abs(cam.fx) < 0.05 ? 0.05 : cam.fx;
  return gfx.pick(SW / 2 + (sx - SW / 2) / fx, sy);
}

function updatePlayer(dt) {
  const pdt = dt * (flags.zoom ? 1.35 : 1);
  let mx = 0, my = 0;
  if (keys.KeyA || keys.ArrowLeft) mx--;
  if (keys.KeyD || keys.ArrowRight) mx++;
  if (keys.KeyW || keys.ArrowUp) my--;
  if (keys.KeyS || keys.ArrowDown) my++;
  if (joy.id !== null) { mx = joy.dx; my = joy.dy; }
  const m = Math.hypot(mx, my);
  if (m > 1) { mx /= m; my /= m; }
  if (flags.reverse) { mx = -mx; my = -my; }

  let canFire = false;
  if (aimMode === 'mouse') {
    const w = toWorld(mouse.x, mouse.y);
    p.aim = Math.atan2(w.y - p.y, w.x - p.x);
    canFire = true;
  } else {
    let bestD = Infinity, t = null;
    for (const e of enemies) {
      const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
      if (d < bestD && e.x > -20 && e.x < W + 20 && e.y > -20 && e.y < H + 20) { bestD = d; t = e; }
    }
    if (t) { p.aim = Math.atan2(t.y - p.y, t.x - p.x); canFire = true; }
  }

  p.r += ((flags.rampage ? 26 : 14) - p.r) * Math.min(1, dt * 10);
  p.inv -= dt;
  p.dashCd -= pdt;
  if (wantDash && p.dashCd <= 0 && p.dashT <= 0) {
    const dx = m > 0.1 ? mx / (Math.hypot(mx, my) || 1) : Math.cos(p.aim);
    const dy = m > 0.1 ? my / (Math.hypot(mx, my) || 1) : Math.sin(p.aim);
    p.vx = dx * 780; p.vy = dy * 780;
    p.dashT = 0.16; p.dashCd = 1.0;
    sfx.dash();
  }
  wantDash = false;
  dashBtn.classList.toggle('cooling', p.dashCd > 0);

  if (p.dashT > 0) {
    p.dashT -= pdt;
    if (particles.length < 700) particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, t: 0.25, life: 0.25, color: '#3ff0ff', size: p.r });
  } else {
    const k = Math.min(1, (flags.ice ? 1.5 : 14) * pdt), spd = flags.rampage ? 330 : 255;
    p.vx += (mx * spd - p.vx) * k;
    p.vy += (my * spd - p.vy) * k;
  }
  if (flags.hole) {
    const dx = hole.x - p.x, dy = hole.y - p.y, d = Math.hypot(dx, dy) || 1, pull = 9000 / (d + 30);
    p.x += (dx / d) * pull * dt; p.y += (dy / d) * pull * dt;
    if (d < 24 + p.r && p.inv <= 0 && !flags.rampage) {
      hurtPlayer();
      p.vx = (-dx / d) * 700; p.vy = (-dy / d) * 700; p.dashT = 0.2;
    }
  }
  p.x += p.vx * pdt; p.y += p.vy * pdt;
  if (flags.wrap) { p.x = (p.x + W) % W; p.y = (p.y + H) % H; }
  else { p.x = clamp(p.x, p.r, W - p.r); p.y = clamp(p.y, p.r, H - p.r); }

  if (flags.warp) {
    warpT -= dt;
    if (!warpTo && warpT <= 0.7) warpTo = safeSpot();
    if (warpT <= 0 && warpTo) {
      burst(p.x, p.y, '#c77dff', 14);
      p.x = warpTo.x; p.y = warpTo.y; p.vx = p.vy = 0;
      p.inv = Math.max(p.inv, 0.6);
      booms.push({ x: p.x, y: p.y, r: 110, delay: 0, dmg: 5, big: true, color: '#c77dff' });
      warpTo = null; warpT = 1.8;
    }
  } else warpTo = null;

  p.fireCd -= pdt;
  if (p.fireCd <= 0 && canFire && !flags.rampage) {
    p.fireCd = (flags.storm ? 0.2 : 0.14) * (flags.mega ? 1.8 : 1);
    for (const o of [p, ...cloneSpots()]) {
      if (flags.storm) for (let i = 0; i < 8; i++) shoot(o.x, o.y, stormAng + (i * TAU) / 8);
      else shoot(o.x, o.y, p.aim + rand(-0.04, 0.04));
    }
    stormAng += 0.21;
    sfx.shot();
  }
}

function updateEnemies(dt, playing) {
  const edt = dt * (flags.zoom ? 1.5 : 1) * (flags.slow ? 0.4 : 1);
  hugeK += ((flags.huge ? 1.8 : 1) - hugeK) * Math.min(1, dt * 6);
  // Outside of play the crowd chases a wandering point behind the menu.
  const tx = playing ? p.x : W / 2 + Math.cos(gt * 0.7) * W * 0.3;
  const ty = playing ? p.y : H / 2 + Math.sin(gt * 1.1) * H * 0.3;
  const steer = Math.min(1, (flags.ice ? 1.2 : 6) * edt);

  for (const e of enemies) {
    e.cr = e.r * (e.type === 'bertha' ? 1 : hugeK);
    e.hit -= dt;
    let dx = tx - e.x, dy = ty - e.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    if (e.type === 'shooter' && playing) {
      if (d < 200) { dx = -dx; dy = -dy; }
      else if (d < 300) { const t = dx; dx = -dy * e.side; dy = t * e.side; }
      e.fire -= edt;
      const onScreen = e.x > 0 && e.x < W && e.y > 0 && e.y < H;
      if (e.fire <= 0 && onScreen && d < 560) {
        e.fire = rand(1.8, 2.6);
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        orbs.push({ x: e.x, y: e.y, vx: Math.cos(a) * 185, vy: Math.sin(a) * 185, r: 6, life: 5 });
      }
    }
    let wig = 0;
    if (e.type === 'runner') wig += Math.sin(gt * 6 + e.seed) * 0.7;
    if (flags.disco) wig += Math.sin(gt * 9 + e.seed) * 1.1;
    if (wig) {
      const c = Math.cos(wig), s = Math.sin(wig), t = dx;
      dx = dx * c - dy * s; dy = t * s + dy * c;
    }
    const spd = e.def.spd * (flags.huge && e.type !== 'bertha' ? 0.6 : 1);
    e.vx += (dx * spd - e.vx) * steer;
    e.vy += (dy * spd - e.vy) * steer;
    e.x += e.vx * edt; e.y += e.vy * edt;

    if (flags.hole) {
      const hx = hole.x - e.x, hy = hole.y - e.y, hd = Math.hypot(hx, hy) || 1;
      const pull = (e.type === 'bertha' ? 3000 : 14000) / (hd + 30);
      e.x += (hx / hd) * pull * dt; e.y += (hy / hd) * pull * dt;
      if (hd < 24 && e.type !== 'bertha') { burst(e.x, e.y, '#b388ff', 6); kill(e); continue; }
    }

    if (!playing) continue;
    const pd = Math.hypot(e.x - p.x, e.y - p.y);
    if (pd < e.cr + p.r - 4) {
      if (flags.rampage) damage(e, e.type === 'bertha' ? 40 * dt : 99);
      else hurtPlayer();
    }
  }

  // Keep the crowd from stacking into a single blob.
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j], dx = b.x - a.x, dy = b.y - a.y, min = a.cr + b.cr;
      if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
      const d = Math.hypot(dx, dy) || 0.01;
      if (d < min) {
        const push = ((min - d) / d) * 0.5, wa = a.type === 'bertha' ? 0 : 1, wb = b.type === 'bertha' ? 0 : 1;
        a.x -= dx * push * wa; a.y -= dy * push * wa;
        b.x += dx * push * wb; b.y += dy * push * wb;
      }
    }
  }
}

function updateProjectiles(dt, playing) {
  for (const b of bullets) {
    b.life -= dt;
    if (flags.homing) {
      let t = null, bd = 240 * 240;
      for (const e of enemies) {
        const d = (e.x - b.x) ** 2 + (e.y - b.y) ** 2;
        if (d < bd && !e.dead) { bd = d; t = e; }
      }
      if (t) {
        const sp = Math.hypot(b.vx, b.vy), want = Math.atan2(t.y - b.y, t.x - b.x), cur = Math.atan2(b.vy, b.vx);
        const a = cur + clamp(Math.atan2(Math.sin(want - cur), Math.cos(want - cur)), -7 * dt, 7 * dt);
        b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
      }
    }
    if (flags.hole) {
      const dx = hole.x - b.x, dy = hole.y - b.y, d = Math.hypot(dx, dy) || 1, g = 90000 / (d + 40);
      b.vx += (dx / d) * g * dt; b.vy += (dy / d) * g * dt;
      if (d < 20) b.life = 0;
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) {
      if (flags.wrap && !flags.bouncy) { b.x = (b.x + W) % W; b.y = (b.y + H) % H; }
      else if (flags.bouncy && b.bounces-- > 0) {
        if (b.x < 0 || b.x > W) { b.vx = -b.vx; b.x = clamp(b.x, 0, W); }
        if (b.y < 0 || b.y > H) { b.vy = -b.vy; b.y = clamp(b.y, 0, H); }
      } else if (b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > H + 30) b.life = 0;
    }
    if (b.life <= 0) continue;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.x - b.x, dy = e.y - b.y, r = e.cr + (b.mega ? 13 : 4);
      if (dx * dx + dy * dy < r * r) {
        if (b.mega) {
          if (b.hits.includes(e)) continue;
          b.hits.push(e);
          e.vx += b.vx * 0.15; e.vy += b.vy * 0.15;
          damage(e, 4);
          continue;
        }
        b.life = 0;
        e.vx += b.vx * 0.05; e.vy += b.vy * 0.05;
        damage(e, 1);
        if (particles.length < 700) particles.push({ x: b.x, y: b.y, vx: -b.vx * 0.1, vy: -b.vy * 0.1, t: 0.15, life: 0.15, color: '#fff', size: 3 });
        break;
      }
    }
  }
  bullets = bullets.filter((b) => b.life > 0);

  const odt = dt * (flags.zoom ? 1.3 : 1) * (flags.slow ? 0.4 : 1);
  for (const o of orbs) {
    o.life -= dt;
    o.x += o.vx * odt; o.y += o.vy * odt;
    if (playing && Math.hypot(o.x - p.x, o.y - p.y) < o.r + p.r - 2) {
      o.life = 0;
      if (flags.rampage) burst(o.x, o.y, '#ff9f1c', 5); else hurtPlayer();
    }
  }
  orbs = orbs.filter((o) => o.life > 0 && o.x > -40 && o.x < W + 40 && o.y > -40 && o.y < H + 40);
}

function updateWorldBits(dt, playing) {
  if (flags.laser) {
    laserA += dt * 0.8;
    // The beam only bites after a 1.2s telegraph.
    if (flags.laser.def.dur - flags.laser.t > 1.2) {
      const c = Math.cos(laserA), s = Math.sin(laserA);
      for (const e of enemies) {
        if (!e.dead && Math.abs((e.x - W / 2) * s - (e.y - H / 2) * c) < e.cr + 10) damage(e, 25 * dt);
      }
      if (playing && Math.abs((p.x - W / 2) * s - (p.y - H / 2) * c) < p.r + 6) hurtPlayer();
    }
  }
  for (const h of hazards) {
    h.t -= dt;
    if (h.t <= 0) booms.push({ x: h.x, y: h.y, r: h.r, delay: 0, dmg: 6, hurts: true, color: '#ff6b35' });
  }
  hazards = hazards.filter((h) => h.t > 0);

  for (let i = 0; i < booms.length; i++) {
    const b = booms[i];
    if (!b.done) {
      b.delay -= dt;
      if (b.delay > 0) continue;
      b.done = true; b.t = 0.3;
      for (const e of enemies) if (!e.dead && Math.hypot(e.x - b.x, e.y - b.y) < b.r + e.cr) damage(e, b.dmg);
      if (b.hurts && playing && Math.hypot(p.x - b.x, p.y - b.y) < b.r + p.r - 8) hurtPlayer();
      burst(b.x, b.y, b.color, 10, 300);
      shake(b.hurts ? 7 : 4);
      if (b.hurts || b.big) sfx.boom();
    } else b.t -= dt;
  }
  booms = booms.filter((b) => !b.done || b.t > 0);

  for (const g of pickups) {
    g.t -= dt;
    g.vx *= 1 - Math.min(1, dt * 3); g.vy *= 1 - Math.min(1, dt * 3);
    if (playing) {
      const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy) || 1;
      if (d < 140) { g.vx += (dx / d) * 1800 * dt; g.vy += (dy / d) * 1800 * dt; }
      if (d < p.r + 12) {
        g.t = 0;
        if (g.type === 'gem') { score += 5 * mult(); comboT = Math.max(comboT, 1.5); sfx.gem(); }
        else if (g.type === 'heart') { p.hp = Math.min(p.maxHp, p.hp + 1); floatText(p.x, p.y - 30, '+1 HP', '#ff5d8f', 20); sfx.heart(); }
        else if (g.type === 'box') {
          const pool = rollPool();
          if (pool.length) activate(pick(pool));
          floatText(p.x, p.y - 40, 'MYSTERY BOX!', '#c77dff', 24);
        }
        else {
          booms.push({ x: p.x, y: p.y, r: Math.hypot(W, H), delay: 0, dmg: 8, big: true, color: '#fff' });
          flash = 0.5; shake(20);
          floatText(p.x, p.y - 40, 'KABOOM!', '#ffd23f', 34);
        }
      }
    }
    g.x = clamp(g.x + g.vx * dt, 10, W - 10);
    g.y = clamp(g.y + g.vy * dt, 10, H - 10);
  }
  pickups = pickups.filter((g) => g.t > 0);

  for (const q of particles) { q.t -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.96; q.vy *= 0.96; }
  particles = particles.filter((q) => q.t > 0);
  for (const t of texts) { t.t -= dt; t.y -= 34 * dt; }
  texts = texts.filter((t) => t.t > 0);
}

function update(dt, raw) {
  const playing = state === 'play';
  gt += raw;
  shotSfxT -= raw;
  shakeAmt = Math.max(0, shakeAmt - raw * 40);
  flash = Math.max(0, flash - raw * 1.6);
  if (banner && (banner.t -= raw) <= 0) banner = null;

  if (playing) {
    time += dt;
    if (comboT > 0 && (comboT -= dt) <= 0) combo = 0;
    updateChaos(dt);
    updateSpawns(dt);
    updatePlayer(dt);
  } else if (enemies.length < 12) spawn(pick(['grunt', 'runner', 'splitter', 'tank', 'shooter']));

  updateEnemies(dt, playing);
  updateProjectiles(dt, state === 'play');
  updateWorldBits(dt, state === 'play');
  enemies = enemies.filter((e) => !e.dead);

  const tilt = flags.tilt, env = tilt ? Math.min(1, (tilt.def.dur - tilt.t) / 0.7, tilt.t / 0.7) : 0;
  cam.a = Math.sin(gt * 1.4) * 0.3 * env;
  cam.z = 1 - 0.14 * env;
  cam.fx += ((flags.mirror ? -1 : 1) - cam.fx) * Math.min(1, raw * 8);
  cam.sx = rand(-shakeAmt, shakeAmt); cam.sy = rand(-shakeAmt, shakeAmt);
  canvas.style.filter = flags.disco ? `hue-rotate(${((gt * 220) | 0) % 360}deg) saturate(1.5)` : '';
  music(raw);
}

// ------------------------------------------------------------------- draw
// The simulation stays on a flat plane: sim (x, y) maps to world (x, height, y).

function initGfx() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#070916');
  scene.fog = new THREE.Fog('#070916', 1000, 2600);
  const camera = new THREE.PerspectiveCamera(50, 1, 10, 6000);
  const focus = new THREE.Vector3(W / 2, 0, H / 2);

  const hemi = new THREE.HemisphereLight('#cfdcff', '#1c1c3a', 1.3);
  const sun = new THREE.DirectionalLight('#ffffff', 1.7);
  sun.position.set(W / 2 - 350, 800, H / 2 + 250);
  sun.target.position.set(W / 2, 0, H / 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.normalBias = 2;
  Object.assign(sun.shadow.camera, { left: -W * 0.75, right: W * 0.75, top: H, bottom: -H, near: 100, far: 2400 });
  // Only lit during LIGHTS OUT; zero decay so the range alone shapes the pool of light.
  const lamp = new THREE.PointLight('#ffffff', 0, 400, 0);
  scene.add(hemi, sun, sun.target, lamp);

  const colors = new Map();
  const col = (c) => { let v = colors.get(c); if (!v) colors.set(c, (v = new THREE.Color(c))); return v; };
  const lam = (color, flat) => new THREE.MeshLambertMaterial({ color, flatShading: !!flat });
  const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({
    color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide,
  });
  const mesh = (geo, mat, parent = scene) => { const m = new THREE.Mesh(geo, mat); parent.add(m); return m; };

  // ---- ground
  const gc = document.createElement('canvas');
  gc.width = gc.height = 128;
  const g2 = gc.getContext('2d');
  g2.fillStyle = '#b4b8d6'; g2.fillRect(0, 0, 128, 128);
  g2.strokeStyle = '#ffffff'; g2.lineWidth = 5; g2.strokeRect(0, 0, 128, 128);
  const gridTex = (rx, ry) => {
    const t = new THREE.CanvasTexture(gc);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.repeat.set(rx, ry);
    return t;
  };
  const outer = mesh(new THREE.PlaneGeometry(W + 3200, H + 3200).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: '#12152e', map: gridTex((W + 3200) / 140, (H + 3200) / 140) }));
  outer.position.set(W / 2, 0, H / 2);
  outer.receiveShadow = true;
  const arenaMat = new THREE.MeshLambertMaterial({ color: '#262d63', map: gridTex(W / 70, H / 70) });
  const arena = mesh(new THREE.PlaneGeometry(W, H).rotateX(-Math.PI / 2), arenaMat);
  arena.position.set(W / 2, 0.4, H / 2);
  arena.receiveShadow = true;
  const borderMat = glow('#4a52a0');
  const border = new THREE.Group();
  scene.add(border);
  for (const [x, z, w, d] of [[W / 2, 0, W + 8, 8], [W / 2, H, W + 8, 8], [0, H / 2, 8, H], [W, H / 2, 8, H]]) {
    mesh(new THREE.BoxGeometry(w, 6, d), borderMat, border).position.set(x, 3, z);
  }

  // ---- characters
  const ball = new THREE.SphereGeometry(1, 20, 14);
  const MODELS = {
    grunt: { geo: ball, eye: [0.72, 0.3, 0.38, 0.27] },
    runner: { geo: new THREE.ConeGeometry(0.9, 2.4, 10).rotateZ(-Math.PI / 2), flat: true, eye: [0.1, 0.36, 0.28, 0.24] },
    tank: { geo: new THREE.BoxGeometry(1.7, 1.7, 1.7), eye: [0.85, 0.3, 0.4, 0.26] },
    splitter: { geo: new THREE.DodecahedronGeometry(1.1, 0), flat: true, eye: [0.85, 0.3, 0.38, 0.26] },
    mini: { geo: new THREE.IcosahedronGeometry(1, 0), flat: true, eye: [0.7, 0.3, 0.38, 0.3] },
    shooter: { geo: new THREE.CylinderGeometry(1, 1, 1.6, 8), flat: true, eye: [0.88, 0.25, 0.4, 0.25] },
    bertha: { geo: new THREE.IcosahedronGeometry(1, 1), flat: true, eye: [0.82, 0.3, 0.34, 0.2] },
  };
  const M = { white: glow('#ffffff') };
  for (const t in MODELS) M[t] = lam(TYPES[t].color, MODELS[t].flat);

  const eyeGeo = new THREE.SphereGeometry(1, 10, 8), browGeo = new THREE.BoxGeometry(0.1, 0.1, 0.62);
  const spikeGeo = new THREE.ConeGeometry(0.16, 0.5, 6);
  const eyeW = glow('#ffffff'), eyeB = glow('#111111');
  function addEyes(g, [x, y, z, r], angry) {
    for (const s of [-1, 1]) {
      const w = mesh(eyeGeo, eyeW, g), b = mesh(eyeGeo, eyeB, g);
      w.position.set(x, y, s * z); w.scale.setScalar(r);
      b.position.set(x + r * 0.62, y, s * z); b.scale.setScalar(r * 0.5);
      if (!angry) continue;
      const brow = mesh(browGeo, eyeB, g);
      brow.position.set(x + r * 0.5, y + r * 1.05, s * z);
      brow.rotation.x = -s * 0.5;
      brow.scale.setScalar(r / 0.27);
    }
  }

  const emojiMats = EMOJI.map((ch) => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.font = '104px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(ch, 64, 70);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.SpriteMaterial({ map: t });
  });

  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  function makeEnemy(type) {
    const def = MODELS[type], g = new THREE.Group(), model = new THREE.Group();
    const body = mesh(def.geo, M[type], model);
    body.castShadow = true;
    addEyes(model, def.eye, true);
    if (type === 'bertha') {
      for (let i = 1; i < 12; i++) {
        const a = (i / 12) * TAU, sp = mesh(spikeGeo, M.bertha, model);
        dir.set(Math.cos(a), 0, Math.sin(a));
        sp.position.copy(dir).multiplyScalar(1.15);
        sp.quaternion.setFromUnitVectors(up, dir);
      }
    }
    g.add(model);
    g.userData = { body, model, mat: M[type], sprite: null, tick: 0 };
    return g;
  }

  const spiky = new THREE.IcosahedronGeometry(1.1, 0);
  function makeBlob(opacity) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: '#3ff0ff', transparent: opacity < 1, opacity, flatShading: true });
    const body = mesh(ball, mat, g);
    body.castShadow = opacity === 1;
    const gun = mesh(new THREE.BoxGeometry(1.1, 0.4, 0.4), lam('#eaf6ff'), g);
    gun.position.set(1.05, -0.15, 0);
    addEyes(g, [0.72, 0.35, 0.38, 0.27], false);
    g.userData = { body, mat, gun };
    scene.add(g);
    return g;
  }
  function placeBlob(g, x, y, r) {
    const ud = g.userData, ramp = !!flags.rampage;
    g.visible = true;
    g.position.set(x, r * (1 + Math.abs(Math.sin(gt * 9)) * 0.12), y);
    g.scale.setScalar(r);
    g.rotation.y = -p.aim;
    ud.mat.color.set(ramp ? '#ff3b3b' : '#3ff0ff');
    ud.body.geometry = ramp ? spiky : ball;
    ud.body.rotation.x = ramp ? gt * 9 : 0;
    ud.gun.visible = !ramp;
  }

  function makePool(factory) {
    const items = [];
    let n = 0;
    return {
      begin() { n = 0; },
      get() {
        let m = items[n];
        if (!m) { m = factory(); items.push(m); scene.add(m); }
        m.visible = true;
        n++;
        return m;
      },
      end() { for (let i = n; i < items.length; i++) items[i].visible = false; },
    };
  }

  const enemyLayer = new THREE.Group();
  scene.add(enemyLayer);
  const player = makeBlob(1);
  const clonePool = makePool(() => makeBlob(0.6));

  // ---- instanced swarms
  const dummy = new THREE.Object3D();
  function inst(geo, mat, max, tinted) {
    const m = new THREE.InstancedMesh(geo, mat, max);
    m.frustumCulled = false;
    m.userData.max = max;
    if (tinted) m.setColorAt(0, col('#ffffff'));
    m.count = 0;
    scene.add(m);
    return m;
  }
  function put(m, i, x, h, y, sx, sy, sz, ry = 0) {
    dummy.position.set(x, h, y);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(0, ry, 0);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
  }
  const bulletMat = glow('#fff8c2');
  const bulletI = inst(new THREE.SphereGeometry(1, 8, 6), bulletMat, 900);
  const megaI = inst(new THREE.SphereGeometry(1, 12, 8), glow('#ffb703'), 300);
  const orbI = inst(new THREE.SphereGeometry(1, 10, 8), glow('#ff9f1c'), 200);
  const partI = inst(new THREE.IcosahedronGeometry(1, 0), glow('#ffffff'), 800, true);
  const gemI = inst(new THREE.OctahedronGeometry(1, 0),
    new THREE.MeshLambertMaterial({ color: '#ffe66d', emissive: '#a07a00', flatShading: true }), 300);

  // ---- pickups
  const hs = new THREE.Shape();
  hs.moveTo(0, -0.9);
  hs.bezierCurveTo(-1.5, 0.1, -0.7, 1.1, 0, 0.35);
  hs.bezierCurveTo(0.7, 1.1, 1.5, 0.1, 0, -0.9);
  const heartGeo = new THREE.ExtrudeGeometry(hs, { depth: 0.5, bevelEnabled: false }).translate(0, 0, -0.25);
  const heartMat = new THREE.MeshLambertMaterial({ color: '#ff5d8f', emissive: '#7a1030' });
  const qc = document.createElement('canvas');
  qc.width = qc.height = 64;
  const q2 = qc.getContext('2d');
  q2.fillStyle = '#c77dff'; q2.fillRect(0, 0, 64, 64);
  q2.strokeStyle = '#fff'; q2.lineWidth = 6; q2.strokeRect(0, 0, 64, 64);
  q2.fillStyle = '#fff'; q2.font = '900 46px sans-serif'; q2.textAlign = 'center'; q2.textBaseline = 'middle';
  q2.fillText('?', 32, 35);
  const boxTex = new THREE.CanvasTexture(qc);
  boxTex.colorSpace = THREE.SRGBColorSpace;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1), boxMat = new THREE.MeshBasicMaterial({ map: boxTex });
  const bombMat = lam('#22242e'), fuseMat = glow('#ffd23f');
  const fuseGeo = new THREE.TorusGeometry(1.25, 0.14, 6, 24).rotateX(Math.PI / 2);
  const pickPools = {
    heart: makePool(() => new THREE.Mesh(heartGeo, heartMat)),
    box: makePool(() => new THREE.Mesh(boxGeo, boxMat)),
    bomb: makePool(() => { const g = new THREE.Group(); mesh(ball, bombMat, g); mesh(fuseGeo, fuseMat, g); return g; }),
  };

  // ---- hazards and effects
  const ringGeo = new THREE.RingGeometry(0.82, 1, 56).rotateX(-Math.PI / 2);
  const discGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: '#ff6b35', emissive: '#b02a00', flatShading: true });
  const boomPool = makePool(() => {
    const mat = glow('#ffffff', 0.5), g = new THREE.Group();
    mesh(ringGeo, mat, g);
    const dome = mesh(ball, mat, g);
    dome.scale.set(0.7, 0.45, 0.7);
    g.userData = { mat };
    return g;
  });
  const hazardPool = makePool(() => {
    const g = new THREE.Group(), zone = glow('#ff3c28', 0.2);
    const disc = mesh(discGeo, zone, g), edge = mesh(ringGeo, glow('#ff5533'), g);
    const fill = mesh(discGeo, glow('#ff5a32', 0.55), g), rock = mesh(rockGeo, rockMat, g);
    fill.position.y = 0.6;
    g.userData = { zone, disc, edge, fill, rock };
    return g;
  });

  const holeG = new THREE.Group();
  scene.add(holeG);
  mesh(ball, glow('#000000'), holeG).scale.setScalar(27);
  const swirlGeo = new THREE.TorusGeometry(1, 0.035, 6, 48);
  const swirls = [];
  for (let i = 0; i < 4; i++) {
    const s = mesh(swirlGeo, glow('#b388ff', 0.75), holeG);
    s.scale.setScalar(36 + i * 16);
    swirls.push(s);
  }
  const holeDisc = mesh(ringGeo, glow('#b388ff', 0.35), holeG);
  holeDisc.scale.setScalar(110);
  holeDisc.position.y = -24;

  const beamGeo = new THREE.BoxGeometry(1, 1, 1);
  const beamMat = glow('#ff2e63', 0.7);
  const beam = mesh(beamGeo, beamMat), beamCore = mesh(beamGeo, glow('#ffffff'));
  const warpRing = mesh(ringGeo, glow('#c77dff'));
  const warpBeam = mesh(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true), glow('#c77dff', 0.3));

  // ---- camera helpers
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3(), v3 = new THREE.Vector3();
  const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -14);
  const tint = new THREE.Color();
  let tick = 0;

  // Step quality down on devices that cannot hold a playable frame rate.
  let quality = 2, slowT = 0, slowN = 0, lastT = performance.now();
  function watchFrameRate() {
    const now = performance.now();
    slowT += Math.min(250, now - lastT);
    lastT = now;
    if (++slowN < 30) return;
    if (slowT / slowN > 40 && quality > 0) {
      quality--;
      sun.castShadow = renderer.shadowMap.enabled = false;
      resize3d();
    }
    slowT = slowN = 0;
  }

  function resize3d() {
    renderer.setPixelRatio(quality === 2 ? DPR : quality === 1 ? Math.min(DPR, 1) : 0.6);
    renderer.setSize(SW, SH, false);
    camera.aspect = SW / SH;
    camera.updateProjectionMatrix();
  }

  function pick(sx, sy) {
    ndc.set((sx / SW) * 2 - 1, -(sy / SH) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(aimPlane, hit)) ray.ray.at(3000, hit);
    return { x: hit.x, y: hit.z };
  }

  function project(x, y, h = 0) {
    v3.set(x, h, y).project(camera);
    return { x: SW / 2 + v3.x * 0.5 * SW * cam.fx, y: (-v3.y * 0.5 + 0.5) * SH, ok: v3.z < 1 };
  }

  function render() {
    tick++;
    watchFrameRate();
    const live = state === 'play' || state === 'pause';

    // camera: chase the player in a run, orbit the arena otherwise
    const tx = live ? p.x : W / 2, tz = live ? p.y - 40 : H / 2;
    focus.x += (tx - focus.x) * 0.1;
    focus.z += (tz - focus.z) * 0.1;
    const s = (Math.max(1, 1.2 / camera.aspect) / cam.z) * (live ? 1 : 1.25);
    const yaw = live ? cam.a * 1.3 : gt * 0.15;
    camera.position.set(focus.x + Math.sin(yaw) * 400 * s + cam.sx, 400 * s + cam.sy, focus.z + Math.cos(yaw) * 400 * s);
    camera.up.set(Math.sin(cam.a * 0.6), Math.cos(cam.a * 0.6), 0);
    camera.lookAt(focus.x, 0, focus.z);
    canvas.style.transform = Math.abs(cam.fx - 1) < 0.01 ? '' : `scaleX(${cam.fx.toFixed(3)})`;

    const dk = flags.dark ? Math.min(1, (flags.dark.def.dur - flags.dark.t) * 2, flags.dark.t * 2) : 0;
    hemi.intensity = 1.3 * (1 - 0.97 * dk);
    sun.intensity = 1.7 * (1 - dk);
    lamp.intensity = 2.4 * dk;
    lamp.position.set(p.x, 90, p.y);

    if (flags.disco) tint.setHSL((gt * 0.6) % 1, 0.75, 0.45);
    else tint.set(flags.ice ? '#3f86b0' : '#262d63');
    arenaMat.color.lerp(tint, 0.15);
    borderMat.color.set(active.length ? active[active.length - 1].def.color : '#4a52a0');
    border.visible = !flags.wrap;

    // enemies
    for (const e of enemies) {
      let g = e.mesh;
      if (!g) { g = e.mesh = makeEnemy(e.type); enemyLayer.add(g); }
      const ud = g.userData, hop = Math.abs(Math.sin(gt * 7 + e.seed));
      ud.tick = tick;
      g.position.set(e.x, e.cr * (1 + hop * 0.3), e.y);
      g.scale.setScalar(e.cr);
      g.rotation.y = -(state === 'play' ? Math.atan2(p.y - e.y, p.x - e.x) : Math.atan2(e.vy, e.vx));
      ud.body.material = e.hit > 0 ? M.white : ud.mat;
      ud.model.scale.y = 1 - hop * 0.12;
      const clown = !!flags.emoji;
      ud.model.visible = !clown;
      if (clown && !ud.sprite) {
        ud.sprite = new THREE.Sprite(emojiMats[(e.seed | 0) % emojiMats.length]);
        ud.sprite.scale.setScalar(2.8);
        g.add(ud.sprite);
      }
      if (ud.sprite) ud.sprite.visible = clown;
    }
    for (let i = enemyLayer.children.length - 1; i >= 0; i--) {
      if (enemyLayer.children[i].userData.tick !== tick) enemyLayer.remove(enemyLayer.children[i]);
    }

    // player and clones
    player.visible = false;
    clonePool.begin();
    if (state === 'play' || state === 'pause') {
      for (const c of cloneSpots()) placeBlob(clonePool.get(), c.x, c.y, 11);
      if (p.inv <= 0 || ((gt * 16) | 0) % 2) placeBlob(player, p.x, p.y, p.r);
    }
    clonePool.end();

    // bullets, orbs, particles
    bulletMat.color.set(flags.bouncy ? '#3ff0ff' : flags.homing ? '#80ffdb' : '#fff8c2');
    let nb = 0, nm = 0;
    for (const b of bullets) {
      const a = -Math.atan2(b.vy, b.vx);
      if (b.mega) { if (nm < megaI.userData.max) put(megaI, nm++, b.x, 16, b.y, 13, 13, 13); }
      else if (nb < bulletI.userData.max) put(bulletI, nb++, b.x, 16, b.y, 11, 3.5, 3.5, a);
    }
    bulletI.count = nb; bulletI.instanceMatrix.needsUpdate = true;
    megaI.count = nm; megaI.instanceMatrix.needsUpdate = true;

    let n = 0;
    const pulse = 7 + Math.sin(gt * 20) * 1.2;
    for (const o of orbs) if (n < orbI.userData.max) put(orbI, n++, o.x, 16, o.y, pulse, pulse, pulse);
    orbI.count = n; orbI.instanceMatrix.needsUpdate = true;

    n = 0;
    for (const q of particles) {
      if (n >= partI.userData.max) break;
      const k = clamp(q.t / q.life, 0, 1), sz = q.size * k * 1.3;
      const h = q.vx || q.vy ? 14 + Math.sin(Math.PI * (1 - k)) * 36 : 14;
      partI.setColorAt(n, col(q.color));
      put(partI, n++, q.x, h, q.y, sz, sz, sz, q.x);
    }
    partI.count = n; partI.instanceMatrix.needsUpdate = true; partI.instanceColor.needsUpdate = true;

    // pickups
    n = 0;
    for (const k in pickPools) pickPools[k].begin();
    for (const g of pickups) {
      if (g.t < 2 && ((g.t * 10) | 0) % 2) continue;
      const bob = 14 + Math.sin(gt * 6 + g.x) * 3;
      if (g.type === 'gem') { if (n < gemI.userData.max) put(gemI, n++, g.x, bob, g.y, 7, 10, 7, gt * 3 + g.x); continue; }
      const m = pickPools[g.type].get(), sz = g.type === 'heart' ? 12 : g.type === 'box' ? 24 : 11;
      m.position.set(g.x, bob + 6, g.y);
      m.scale.setScalar(sz);
      m.rotation.y = gt * 2.5;
    }
    for (const k in pickPools) pickPools[k].end();
    gemI.count = n; gemI.instanceMatrix.needsUpdate = true;

    // meteors fall from the sky onto their warning circle
    hazardPool.begin();
    for (const h of hazards) {
      const g = hazardPool.get(), ud = g.userData, k = 1 - h.t / h.total;
      g.position.set(h.x, 1.5, h.y);
      ud.disc.scale.setScalar(h.r);
      ud.edge.scale.setScalar(h.r);
      ud.fill.scale.setScalar(Math.max(0.01, h.r * k));
      ud.zone.opacity = 0.15 + k * 0.3;
      ud.rock.position.set((1 - k) * 280, (1 - k) * 950 + h.r * 0.3, -(1 - k) * 140);
      ud.rock.scale.setScalar(h.r * 0.42);
      ud.rock.rotation.set(gt * 4, gt * 3, 0);
    }
    hazardPool.end();

    boomPool.begin();
    for (const b of booms) {
      if (!b.done) continue;
      const g = boomPool.get(), k = 1 - b.t / 0.3;
      g.position.set(b.x, 3, b.y);
      g.scale.setScalar(Math.min(b.r, 900) * (0.3 + 0.7 * k));
      g.userData.mat.color.set(b.color);
      g.userData.mat.opacity = (1 - k) * 0.6;
    }
    boomPool.end();

    holeG.visible = !!flags.hole;
    if (flags.hole) {
      const k = Math.min(1, (flags.hole.def.dur - flags.hole.t) * 2, flags.hole.t * 2);
      holeG.position.set(hole.x, 30, hole.y);
      holeG.scale.setScalar(Math.max(0.01, k));
      swirls.forEach((sw, i) => sw.rotation.set(gt * (1.5 + i * 0.4) + i, gt * (1.1 + i * 0.3), i));
      holeDisc.rotation.y = gt * 2;
    }

    beam.visible = !!flags.laser;
    beamCore.visible = false;
    if (flags.laser) {
      const hot = flags.laser.def.dur - flags.laser.t > 1.2, L = (W + H) * 2;
      beam.position.set(W / 2, 16, H / 2);
      beam.rotation.y = -laserA;
      beam.scale.set(L, hot ? 20 + Math.sin(gt * 30) * 4 : 2, hot ? 22 + Math.sin(gt * 30) * 4 : 3);
      beamMat.opacity = hot ? 0.7 : 0.5 + Math.sin(gt * 20) * 0.3;
      beamCore.visible = hot;
      beamCore.position.copy(beam.position);
      beamCore.rotation.y = -laserA;
      beamCore.scale.set(L, 7, 7);
    }

    warpRing.visible = warpBeam.visible = !!(warpTo && flags.warp);
    if (warpRing.visible) {
      const r = 14 + Math.max(0, warpT) * 40;
      warpRing.position.set(warpTo.x, 2, warpTo.y);
      warpRing.scale.setScalar(r);
      warpBeam.position.set(warpTo.x, 200, warpTo.y);
      warpBeam.scale.set(r * 0.5, 400, r * 0.5);
    }

    renderer.render(scene, camera);
  }

  return { resize: resize3d, pick, project, render, renderer, get quality() { return quality; } };
}

function heartPath(x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.5, y - s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

function label(txt, x, y, size, color, align = 'center', alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.font = `900 ${Math.round(size)}px "Trebuchet MS", system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.16);
  ctx.strokeStyle = 'rgba(8,9,20,0.85)';
  ctx.strokeText(txt, x, y);
  ctx.fillStyle = color;
  ctx.fillText(txt, x, y);
  ctx.globalAlpha = 1;
}

function drawHud() {
  const pad = 16 * ui;
  label(String(score), pad, pad + 30 * ui, 38 * ui, '#fff', 'left');
  if (combo > 1) {
    const m = mult();
    label(`x${m}  ${combo} combo`, pad, pad + 56 * ui, 17 * ui, m >= 5 ? '#ff7bf5' : '#ffd23f', 'left');
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(pad, pad + 64 * ui, 120 * ui, 4);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(pad, pad + 64 * ui, 120 * ui * clamp(comboT / 2.5, 0, 1), 4);
  }
  for (let i = 0; i < p.maxHp; i++) {
    const x = SW - pad - 14 * ui - i * 30 * ui, y = pad + 14 * ui;
    heartPath(x, y, 11 * ui);
    ctx.fillStyle = i < p.hp ? '#ff5d8f' : 'rgba(255,255,255,0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(8,9,20,0.85)'; ctx.lineWidth = 2; ctx.stroke();
  }

  // active mutators
  const pw = 130 * ui;
  active.filter((a) => !a.def.instant).forEach((a, i) => {
    const y = pad + 96 * ui + i * 26 * ui;
    label(a.def.name, pad, y, 13 * ui, a.def.color, 'left');
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(pad, y + 4, pw, 3);
    ctx.fillStyle = a.def.color; ctx.fillRect(pad, y + 4, pw * clamp(a.t / a.def.dur, 0, 1), 3);
  });
  if (overdrive()) label('OVERDRIVE x2', SW - pad, pad + 54 * ui, 19 * ui * (1 + Math.sin(gt * 12) * 0.08), '#ff2e63', 'right');

  if (roll) {
    const name = MUTATORS[((gt * 16) | 0) % MUTATORS.length].name;
    label(roll.defs.length > 1 ? 'DOUBLE TROUBLE INCOMING...' : 'THE MACHINE IS DECIDING...', SW / 2, SH * 0.2 - 40 * ui, 15 * ui, '#c9cdf0');
    label(name, SW / 2 + rand(-3, 3), SH * 0.2 + rand(-3, 3), 40 * ui, '#fff', 'center', 0.85);
  } else if (banner) {
    const k = banner.t / banner.dur, slam = 1 + Math.max(0, k - 0.88) * 9;
    const fit = Math.min(1, (SW * 0.9) / (banner.def.name.length * 34 * ui));
    label(banner.def.name, SW / 2, SH * 0.2, 54 * ui * slam * fit, banner.def.color, 'center', Math.min(1, k * 3));
    label(banner.def.tag, SW / 2, SH * 0.2 + 30 * ui, 17 * ui, '#fff', 'center', Math.min(1, k * 3));
  }

  if (time < 6 && state === 'play') {
    label('the rules are about to change', SW / 2, SH - 46 * ui, 15 * ui, '#c9cdf0', 'center', Math.min(1, 6 - time));
  }
  // countdown to the next roll
  const cw = 160 * ui, total = chaosGap();
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(SW / 2 - cw / 2, SH - 22 * ui, cw, 5);
  ctx.fillStyle = '#ff5d8f'; ctx.fillRect(SW / 2 - cw / 2, SH - 22 * ui, cw * (roll ? 1 : clamp(1 - chaosT / total, 0, 1)), 5);
  label('NEXT CHAOS', SW / 2, SH - 28 * ui, 10 * ui, '#c9cdf0');

  if (joy.id !== null) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 50, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.arc(joy.ox + joy.dx * 50, joy.oy + joy.dy * 50, 22, 0, TAU); ctx.fill();
  }
}

function draw() {
  if (!gfx) return;
  gfx.render();

  // 2D layer: anything that has to stay readable regardless of the camera
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, SW, SH);
  for (const e of enemies) {
    if (e.maxHp < 10 || e.hp >= e.maxHp) continue;
    const s = gfx.project(e.x, e.y, e.cr * 2.7), w = 54 * ui;
    if (!s.ok) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(s.x - w / 2, s.y, w, 5);
    ctx.fillStyle = '#7cff6b'; ctx.fillRect(s.x - w / 2, s.y, w * Math.max(0, e.hp / e.maxHp), 5);
  }
  for (const t of texts) {
    const s = gfx.project(t.x, t.y, 40 + (0.9 - t.t) * 50);
    if (s.ok) label(t.txt, s.x, s.y, t.size * ui, t.color, 'center', Math.min(1, t.t * 2.5));
  }
  if (state === 'play' || state === 'pause') {
    if (p.dashCd > 0) {
      const s = gfx.project(p.x, p.y, p.r);
      ctx.strokeStyle = 'rgba(63,240,255,0.8)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.x, s.y, 26 * ui, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p.dashCd)); ctx.stroke();
    }
    drawHud();
  }
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.6})`; ctx.fillRect(0, 0, SW, SH); }
}

// ------------------------------------------------------------------ flow

const HOW = `
  <div class="how">
    <b class="desktop">WASD / arrows</b><span class="desktop">move</span>
    <b class="desktop">Mouse</b><span class="desktop">aim (you fire automatically)</span>
    <b class="desktop">Space / Shift</b><span class="desktop">dash through danger</span>
    <b class="desktop">P &middot; M</b><span class="desktop">pause &middot; mute</span>
    <b class="touch">Drag</b><span class="touch">move (you aim and fire automatically)</span>
    <b class="touch">DASH</b><span class="touch">dash through danger</span>
  </div>`;

function showCard(html, onClick) {
  card.innerHTML = html;
  overlay.classList.add('show');
  card.querySelector('button').onclick = onClick;
}

function showMenu() {
  showCard(`
    <h1>MAYHEM<span>MACHINE</span></h1>
    <p class="sub">Survive the swarm. Every few seconds the machine rewrites the rules.</p>
    ${HOW}
    <button type="button">PLAY</button>
    ${best ? `<p class="note">Best score: ${best}</p>` : ''}`, start);
}

function start() {
  initAudio();
  reset();
  state = 'play';
  overlay.classList.remove('show');
}

function togglePause() {
  if (state === 'play') {
    state = 'pause';
    showCard(`<h1>PAUSED</h1><p class="sub">The chaos is waiting for you.</p>${HOW}<button type="button">RESUME</button>`, togglePause);
  } else if (state === 'pause') {
    state = 'play';
    overlay.classList.remove('show');
  }
}

function gameOver() {
  state = 'over';
  const during = active.filter((a) => !a.def.instant).map((a) => a.def.name).join(' + ');
  const record = score > best;
  if (record) { best = score; try { localStorage.setItem('mayhem-best', String(best)); } catch (e) { /* storage unavailable */ } }
  active = []; flags = {}; roll = null; banner = null; bullets = []; orbs = []; hazards = [];
  sfx.over();
  const mm = (time / 60) | 0, ss = String((time % 60) | 0).padStart(2, '0');
  setTimeout(() => showCard(`
    <h1>GAME<span>OVER</span></h1>
    <p class="big">${score}</p>
    <p class="note ${record ? 'record' : ''}">${record ? 'NEW BEST!' : 'Best: ' + best}</p>
    <div class="stats">
      <div><strong>${mm}:${ss}</strong><small>SURVIVED</small></div>
      <div><strong>${kills}</strong><small>KILLS</small></div>
      <div><strong>${bestCombo}</strong><small>BEST COMBO</small></div>
    </div>
    <p class="note">${during ? 'Taken out during ' + during + '.' : 'No chaos to blame for that one.'} You outlasted ${mutatorsSeen} rule change${mutatorsSeen === 1 ? '' : 's'}.</p>
    <button type="button">PLAY AGAIN</button>`, start), 700);
}

// ------------------------------------------------------------------ input

window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'KeyM') toggleMute();
  else if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  else if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    if (state === 'play') wantDash = true;
  } else if (e.code === 'Enter' && overlay.classList.contains('show')) card.querySelector('button').click();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });

canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; aimMode = 'mouse'; });
canvas.addEventListener('mousedown', (e) => { if (e.button === 2 && state === 'play') wantDash = true; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  aimMode = 'auto';
  for (const t of e.changedTouches) {
    if (joy.id === null) { joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.dx = joy.dy = 0; }
    else if (state === 'play') wantDash = true;
  }
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier !== joy.id) continue;
    let dx = (t.clientX - joy.ox) / 50, dy = (t.clientY - joy.oy) / 50;
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    joy.dx = dx; joy.dy = dy;
  }
}, { passive: false });
const endTouch = (e) => { for (const t of e.changedTouches) if (t.identifier === joy.id) { joy.id = null; joy.dx = joy.dy = 0; } };
canvas.addEventListener('touchend', endTouch);
canvas.addEventListener('touchcancel', endTouch);

dashBtn.addEventListener('touchstart', (e) => { e.preventDefault(); if (state === 'play') wantDash = true; }, { passive: false });
dashBtn.addEventListener('click', () => { if (state === 'play') wantDash = true; });

function toggleMute() {
  muted = !muted;
  muteBtn.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
}
muteBtn.addEventListener('click', () => { toggleMute(); muteBtn.blur(); });

// ------------------------------------------------------------------- loop

let last = performance.now();
function frame(now) {
  const raw = Math.min(0.033, Math.max(0, (now - last) / 1000));
  last = now;
  if (state !== 'pause') {
    let dt = raw;
    if (hitStop > 0) { hitStop -= raw; dt = 0; }
    update(dt, raw);
  }
  draw();
  requestAnimationFrame(frame);
}

// Console hook: mayhem.force('disco') triggers a rule change on demand.
window.mayhem = {
  force(id) { const d = MUTATORS.find((m) => m.id === id); if (d && state === 'play') activate(d); return !!d; },
  get info() {
    return { state, score, time, hp: p.hp, kills, enemies: enemies.length, bullets: bullets.length, active: active.map((a) => a.def.id) };
  },
  get quality() { return gfx.quality; },
  mutators: MUTATORS.map((m) => m.id),
};

reset();
try {
  gfx = initGfx();
  resize();
  showMenu();
  requestAnimationFrame(frame);
} catch (err) {
  console.error(err);
  card.innerHTML = '<h1>NO 3D<span>SUPPORT</span></h1><p class="sub">This game needs WebGL, which this browser or device could not start.</p>';
}
})();
