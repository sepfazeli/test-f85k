import {
  PEOPLE, PERSON, GRACE,
  derive, parseEvent, canDo, position, upSince, wouldCut, awards, duration,
} from './state.js';

// ntfy.sh is the shared message board: every action is one message on this
// topic, and every phone replays the topic to work out the queue.
const NTFY = 'https://ntfy.sh';
const TOPIC = new URLSearchParams(location.search).get('topic') || 'sb20-throne-6254a509cb59';
const TITLE = 'The Throne · 20 Shore Breeze';

const $ = (sel) => document.querySelector(sel);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

let me = PERSON[store.get('throne.me')] ? store.get('throne.me') : null;
let soundOn = store.get('throne.sound') !== 'off';
let events = [];
let ids = new Set();
let lastId = null;
let skew = 0;
let es = null;
let lastBeat = 0;
let retryTimer = null;
let retryDelay = 2000;
let synced = false;
let pending = null; // { action, id, until }
let state = derive([], now());
let sig = '';
let wasMyTurn = false;
let favState = '';

function now() {
  return Date.now() / 1000 + skew;
}

// ---------- formatting ----------

const avatar = (id, cls = '') =>
  `<span class="avatar ${cls}" style="--c:${PERSON[id].color}">${PERSON[id].emoji}</span>`;
const nm = (id, start = true) => (id === me ? (start ? 'You' : 'you') : PERSON[id].name);

function clock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function ago(sec) {
  if (sec < 10) return 'just now';
  if (sec < 60) return `${Math.floor(sec)}s ago`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

const QUIPS = [
  [60, 'Just sat down. Settling in…'],
  [180, 'Business is in progress 💼'],
  [360, 'Probably reading the shampoo bottle 🧴'],
  [600, 'Doom-scrolling detected 📱'],
  [900, 'This is a LOT of business 📈'],
  [1500, 'Someone slide snacks under the door 🍪'],
  [2700, 'Send a search party 🔦'],
  [Infinity, 'Legend says they’re still in there 👻'],
];
const quip = (sec) => QUIPS.find(([limit]) => sec < limit)[1];

const FREE_LINES = [
  'The throne awaits its next ruler 👑',
  'Fresh, sparkly and ready ✨ (probably)',
  'Peace and quiet. For now. 🌊',
  'Go go go! 🏃',
];

// ---------- rendering ----------

function signature(s, t) {
  const head = s.queue[0];
  return JSON.stringify([
    me, s.occupant, s.since, s.queue, s.lastFree, s.feed.length, !!pending,
    head && !s.occupant && t - upSince(s) >= GRACE,
    s.occupant && t - s.since > 120,
  ]);
}

function renderHero(s, t) {
  const hero = $('#hero');
  if (s.occupant) {
    const mine = s.occupant === me;
    hero.className = 'hero card is-busy';
    hero.innerHTML = `
      <div class="hero-art">
        <span class="sitter">${PERSON[s.occupant].emoji}</span>
        <span class="throne">🚽</span>
        <span class="puff p1">💨</span><span class="puff p2">💨</span>
      </div>
      <div class="pill busy"><span class="dot"></span>Occupied</div>
      <h1>${mine ? 'You’re on the throne 👑' : `${PERSON[s.occupant].name} is on the throne`}</h1>
      <div class="timer" data-clock="${s.since}"></div>
      <p class="sub" data-quip="${s.since}"></p>
      <div class="meter"><span data-meter="${s.since}"></span></div>
      <div class="meter-label">Patience meter</div>`;
    return;
  }

  const head = s.queue[0]?.who;
  const mine = head === me;
  const lf = s.lastFree;
  const how = { done: 'Flushed', freed: 'Freed', expired: 'Timed out' };
  const sub = lf
    ? `${how[lf.how]} by ${avatar(lf.who, 'tiny')}${nm(lf.who)} · <span data-ago="${lf.t}"></span>`
    : FREE_LINES[Math.floor(t / 3600) % FREE_LINES.length];
  let turn = '';
  if (head) {
    const deadline = upSince(s) + GRACE;
    if (mine) turn = '<div class="turn mine">🔔 It’s YOUR turn! Go go go!</div>';
    else if (t < deadline) turn = `<div class="turn">🔔 ${PERSON[head].name}’s turn · claim within <span data-countdown="${deadline}"></span></div>`;
    else turn = `<div class="turn snooze">😴 ${PERSON[head].name} is snoozing. First come, first served!</div>`;
  }
  hero.className = `hero card is-free${mine ? ' my-turn' : ''}`;
  hero.innerHTML = `
    <div class="hero-art">
      <span class="throne bob">🚽</span>
      <span class="spark s1">✨</span><span class="spark s2">✨</span><span class="spark s3">🫧</span>
    </div>
    <div class="pill free"><span class="dot"></span>Free</div>
    <h1>${mine ? 'Your throne awaits!' : 'The throne is free!'}</h1>
    <p class="sub">${sub}</p>
    ${turn}`;
}

const button = (act, label, cls) => `<button class="btn ${cls}" type="button" data-act="${act}">${label}</button>`;

function renderActions(s, t) {
  const el = $('#actions');
  if (!me) {
    el.innerHTML = '';
    return;
  }
  const out = [];
  const pos = position(s, me);
  const head = s.queue[0]?.who;
  if (s.occupant === me) {
    out.push(button('done', 'I’m done! Flush 🧻', 'btn-done big'));
  } else if (!s.occupant) {
    if (!wouldCut(s, me, t)) {
      const snoozer = head && head !== me ? PERSON[head].name : null;
      out.push(button('in', snoozer ? `Go in (${snoozer} snoozed 😴)` : 'I’m going in! 🏃', 'btn-go big'));
    } else {
      if (pos) out.push(`<div class="status-pill">⏳ ${PERSON[head].name} is up · you’re #${pos}</div>`);
      else out.push(button('book', `Book after ${PERSON[head].name} 🎟️`, 'btn-book big'));
      out.push(button('cut', 'Cut the line 😈', 'btn-cut'));
    }
    if (pos) out.push(button('leave', 'Leave the line', 'btn-ghost'));
  } else {
    if (pos) {
      out.push(`<div class="status-pill">⏳ You’re #${pos} in line</div>`);
      out.push(button('leave', 'Leave the line', 'btn-ghost'));
    } else {
      out.push(button('book', 'Book my spot 🎟️', 'btn-book big'));
    }
    if (t - s.since > 120) {
      out.push(`<button class="link-btn" type="button" data-act="free">${PERSON[s.occupant].name} forgot to flush? Mark it free</button>`);
    }
  }
  el.innerHTML = out.join('');
  if (pending) el.querySelectorAll('button').forEach((b) => { b.disabled = true; });
}

function renderQueue(s) {
  $('#line-count').textContent = s.queue.length || '';
  if (!s.queue.length) {
    $('#queue').innerHTML = `<li class="empty">${s.occupant ? 'Nobody’s waiting. Book first dibs! 🎟️' : 'Nobody’s waiting. Living the dream 🌈'}</li>`;
    return;
  }
  $('#queue').innerHTML = s.queue.map((q, i) => {
    const note = i === 0 && !s.occupant ? 'up now!' : i === 0 ? 'next up' : '';
    return `<li class="q-item${q.who === me ? ' me' : ''}">
      <span class="q-pos">${i + 1}</span>
      ${avatar(q.who)}
      <span class="q-name">${PERSON[q.who].name}${q.who === me ? ' (you)' : ''}${note ? `<small>${note}</small>` : ''}</span>
      <span class="q-wait">waiting <span data-ago="${q.t}" data-bare></span></span>
    </li>`;
  }).join('');
}

function renderAwards(s) {
  const list = awards(s);
  $('#awards').innerHTML = list.length
    ? list.map((a) => `<div class="award">
        <div class="award-icon">${a.icon}</div>
        <div class="award-title">${a.title}</div>
        <div class="award-who">${avatar(a.who)}${PERSON[a.who].name}</div>
        <div class="award-detail">${a.detail}</div>
      </div>`).join('')
    : '<p class="empty">No royal records yet. The throne awaits its first ruler 👑</p>';
}

function feedLine(f) {
  switch (f.type) {
    case 'book': return ['🎟️', `${nm(f.who)} joined the line (#${f.pos})`];
    case 'leave': return ['🚶', `${nm(f.who)} left the line`];
    case 'in': return ['🚽', `${nm(f.who)} took the throne`];
    case 'cut': return ['😈', `${nm(f.who)} cut in front of ${nm(f.skipped, false)}!`];
    case 'skip': return ['😴', `${nm(f.who)} went in while ${nm(f.skipped, false)} snoozed`];
    case 'done': return ['🧻', `${nm(f.who)} flushed after ${duration(f.dur)}`];
    case 'free': return ['🙄', `${nm(f.who)} marked it free (${nm(f.victim, false)} forgot to flush)`];
    case 'expired': return ['👻', `${nm(f.who)} timed out after an hour. Are they okay?`];
  }
  return ['❔', ''];
}

function renderFeed(s) {
  const items = s.feed.slice(-12).reverse();
  $('#feed').innerHTML = items.length
    ? items.map((f) => {
        const [icon, text] = feedLine(f);
        return `<li><span class="f-icon">${icon}</span><span class="f-text">${text}</span><span class="f-time" data-ago="${f.t}"></span></li>`;
      }).join('')
    : '<li class="empty">Quiet day at the throne. Nothing logged in the last 12h 🌊</li>';
}

function renderMe() {
  $('#me').innerHTML = me
    ? `${avatar(me)}<span>${PERSON[me].name}</span><span class="caret">▼</span>`
    : '<span class="avatar">❔</span><span>Who?</span>';
  $('#sound').textContent = soundOn ? '🔊' : '🔇';
  $('#sound').setAttribute('aria-label', soundOn ? 'Sound on' : 'Sound off');
}

function renderFavicon(s) {
  const key = s.occupant ? 'busy' : 'free';
  if (key === favState) return;
  favState = key;
  const fill = s.occupant ? '%23ff6b6b' : '%232bd1a8';
  $('#favicon').href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='46' fill='${fill}' stroke='%2322305a' stroke-width='6'/><text x='50' y='69' font-size='54' text-anchor='middle'>🚽</text></svg>`;
}

function renderAll(s, t) {
  renderHero(s, t);
  renderActions(s, t);
  renderQueue(s);
  renderAwards(s);
  renderFeed(s);
  renderMe();
  renderFavicon(s);
}

// Text that changes every second without re-rendering (keeps animations smooth).
function updateLive(s, t) {
  document.querySelectorAll('[data-clock]').forEach((el) => { el.textContent = clock(t - el.dataset.clock); });
  document.querySelectorAll('[data-quip]').forEach((el) => { el.textContent = quip(t - el.dataset.quip); });
  document.querySelectorAll('[data-countdown]').forEach((el) => { el.textContent = clock(el.dataset.countdown - t); });
  document.querySelectorAll('[data-ago]').forEach((el) => {
    const text = ago(Math.max(0, t - el.dataset.ago));
    el.textContent = 'bare' in el.dataset ? text.replace(' ago', '').replace('just now', '0s') : text;
  });
  document.querySelectorAll('[data-meter]').forEach((el) => {
    const p = Math.min(1, (t - el.dataset.meter) / 900);
    el.style.width = `${Math.max(4, p * 100)}%`;
    el.style.backgroundColor = `hsl(${150 - p * 150} 75% 55%)`;
  });
  document.title = s.occupant
    ? `🔴 ${PERSON[s.occupant].name} ${clock(t - s.since)} · The Throne`
    : `✨ Free · The Throne`;
}

function tick() {
  const t = now();
  state = derive(events, t);
  const next = signature(state, t);
  if (next !== sig) {
    sig = next;
    renderAll(state, t);
  }
  updateLive(state, t);
  checkTurn(state);
  if (pending && Date.now() > pending.until) {
    pending = null;
    resync();
  }
}

function update() {
  sig = '';
  tick();
}

// ---------- your turn ----------

function checkTurn(s) {
  const myTurn = !!me && !s.occupant && s.queue[0]?.who === me;
  if (myTurn && !wasMyTurn && synced) {
    sfx.chime();
    navigator.vibrate?.([200, 100, 200, 100, 400]);
    toast('🔔 It’s your turn! The throne awaits 👑');
    if (document.visibilityState !== 'visible') notify('🔔 Your turn on the throne!', 'It’s free and it’s all yours. Go go go!');
  }
  wasMyTurn = myTurn;
}

async function notify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts = { body, icon: 'icon-192.png', tag: 'throne', renotify: true };
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch { /* best effort */ }
}

function askNotify() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(renderNotifyButton).catch(() => {});
  }
}

function renderNotifyButton() {
  const b = $('#notify');
  if (!('Notification' in window)) {
    b.hidden = true;
    return;
  }
  const p = Notification.permission;
  b.textContent = p === 'granted' ? 'Notifications on ✅' : p === 'denied' ? 'Notifications blocked in browser settings' : 'Allow notifications';
  b.disabled = p !== 'default';
}

// ---------- actions ----------

function message(s, action, t) {
  const n = PERSON[me].name;
  const next = s.queue.find((q) => q.who !== me)?.who;
  const upNext = next ? ` ${PERSON[next].name}, you're up!` : '';
  switch (action) {
    case 'book': return { tag: 'ticket', priority: 2, text: `${n} joined the line (#${s.queue.length + 1})` };
    case 'leave': return { tag: 'walking', priority: 1, text: `${n} left the line` };
    case 'in': return wouldCut(s, me, t)
      ? { tag: 'smiling_imp', priority: 2, text: `${n} CUT the line and took the throne!` }
      : { tag: 'toilet', priority: 2, text: `${n} is on the throne` };
    case 'done': return { tag: 'sparkles', priority: next ? 4 : 3, text: `Throne is FREE! ${n} flushed after ${duration(t - s.since)}.${upNext}` };
    case 'free': return { tag: 'roll_of_paper', priority: 3, text: `${n} marked the throne free (${PERSON[s.occupant].name} forgot to flush).${upNext}` };
  }
  return null;
}

async function send(action, el) {
  const t = now();
  const s = derive(events, t);
  if (!canDo(s, action, me)) {
    toast('Hmm, that just changed. Try again 🤔');
    update();
    return;
  }
  const m = message(s, action, t);
  pending = { action, id: null, until: Date.now() + 8000 };
  update();
  effects(action, el, wouldCut(s, me, t));
  try {
    const res = await fetch(`${NTFY}/`, {
      method: 'POST',
      body: JSON.stringify({
        topic: TOPIC,
        title: TITLE,
        message: m.text,
        tags: [m.tag, `e-${action}`, `u-${me}`],
        priority: m.priority,
        click: location.href,
      }),
    });
    if (res.status === 429) throw new Error('rate');
    if (!res.ok) throw new Error('http');
    const msg = await res.json();
    if (!pending) return;
    pending.id = msg.id;
    if (ids.has(msg.id)) settle();
  } catch (err) {
    pending = null;
    toast(err.message === 'rate' ? 'Whoa, slow down! Too many flushes 🌀' : 'Couldn’t reach the house 😵 Try again');
    update();
  }
}

// Our own message came back through the stream: check whether we won any race.
function settle() {
  const action = pending.action;
  pending = null;
  const s = derive(events, now());
  if (action === 'in' && s.occupant !== me && s.occupant) toast(`😱 ${PERSON[s.occupant].name} beat you to it!`);
  update();
}

async function onAction(act, el) {
  sfx.unlock();
  if (act === 'cut') {
    const head = state.queue[0]?.who;
    const ok = await confirmDialog({
      emoji: '😈',
      title: 'Cut the line?',
      text: `${head ? PERSON[head].name : 'Someone'} is next. Everyone will know. It goes on your record (for 12 hours).`,
      ok: 'Cut anyway',
      cancel: 'Be nice',
    });
    if (!ok) return;
    act = 'in';
  }
  if (act === 'free') {
    const occ = state.occupant;
    if (!occ) return;
    const ok = await confirmDialog({
      emoji: '🙄',
      title: 'Is it actually free?',
      text: `This kicks ${PERSON[occ].name} off the throne and logs a “forgot to flush”. Only if the door’s open!`,
      ok: 'Yep, mark it free',
      cancel: 'Nope',
    });
    if (!ok) return;
  }
  if (act === 'book') askNotify();
  send(act, el);
}

// ---------- realtime ----------

async function resync() {
  clearTimeout(retryTimer);
  try {
    const res = await fetch(`${NTFY}/${encodeURIComponent(TOPIC)}/json?poll=1&since=12h`, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const list = [];
    let last = null;
    for (const line of (await res.text()).split('\n')) {
      if (!line.trim()) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.event !== 'message') continue;
      last = msg.id;
      const ev = parseEvent(msg);
      if (ev) list.push(ev);
    }
    events = list;
    ids = new Set(list.map((e) => e.id));
    lastId = last;
    retryDelay = 2000;
    if (!synced) {
      synced = true;
      const s = derive(events, now());
      wasMyTurn = !!me && !s.occupant && s.queue[0]?.who === me;
    }
    if (pending?.id && ids.has(pending.id)) settle();
    openStream();
    update();
  } catch {
    setConn('offline');
    retryTimer = setTimeout(resync, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30000);
  }
}

function openStream() {
  es?.close();
  es = new EventSource(`${NTFY}/${encodeURIComponent(TOPIC)}/sse?since=${lastId || '12h'}`);
  lastBeat = Date.now();
  // ntfy sends named "open" and "keepalive" events; real messages are unnamed.
  es.addEventListener('open', (e) => {
    lastBeat = Date.now();
    setConn('live');
    if (!e.data) return;
    try {
      const est = JSON.parse(e.data).time + 0.5 - Date.now() / 1000;
      skew = Math.abs(est) < 1.5 ? 0 : est;
    } catch { /* ignore */ }
  });
  es.addEventListener('keepalive', () => { lastBeat = Date.now(); });
  es.onmessage = (e) => {
    lastBeat = Date.now();
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.event !== 'message' || ids.has(msg.id)) return;
    ids.add(msg.id);
    lastId = msg.id;
    const ev = parseEvent(msg);
    if (ev) events.push(ev);
    if (pending?.id === msg.id) settle();
    else update();
  };
  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) {
      setConn('offline');
      clearTimeout(retryTimer);
      retryTimer = setTimeout(resync, retryDelay);
    } else {
      setConn('connecting');
    }
  };
}

function setConn(c) {
  const el = $('#conn');
  el.dataset.state = c;
  el.textContent = {
    live: 'Live · synced with the house',
    connecting: 'Connecting to the house…',
    offline: 'Offline · retrying…',
  }[c];
}

// ---------- pickers, dialogs, toasts ----------

function openPicker() {
  $('#people').innerHTML = PEOPLE.map((p) => `
    <button class="person${p.id === me ? ' current' : ''}" type="button" data-id="${p.id}" style="--c:${p.color}">
      ${avatar(p.id)}<span>${p.name}</span>
    </button>`).join('');
  $('#picker').querySelector('[data-close]').hidden = !me;
  $('#picker').hidden = false;
}

$('#picker').addEventListener('click', (e) => {
  const person = e.target.closest('[data-id]');
  if (person) {
    sfx.unlock();
    me = person.dataset.id;
    store.set('throne.me', me);
    $('#picker').hidden = true;
    sfx.pop();
    burst(person, [PERSON[me].emoji, '✨', '💖'], 14);
    toast(`Hi ${PERSON[me].name}! ${PERSON[me].emoji}`);
    const s = derive(events, now());
    wasMyTurn = !s.occupant && s.queue[0]?.who === me;
    update();
  } else if (me && (e.target.closest('[data-close]') || e.target === e.currentTarget)) {
    $('#picker').hidden = true;
  }
});

function confirmDialog({ emoji, title, text, ok, cancel }) {
  return new Promise((resolve) => {
    const d = $('#dialog');
    d.innerHTML = `<div class="sheet pop" role="alertdialog" aria-modal="true">
      <div class="sheet-emoji">${emoji}</div>
      <h2>${title}</h2>
      <p>${text}</p>
      <div class="sheet-actions">
        ${button('no', cancel, 'btn-ghost')}
        ${button('yes', ok, 'btn-cut')}
      </div>
    </div>`;
    d.hidden = false;
    d.onclick = (e) => {
      const b = e.target.closest('[data-act]');
      if (!b && e.target !== d) return;
      d.hidden = true;
      d.onclick = null;
      resolve(b?.dataset.act === 'yes');
    };
  });
}

let toastTimer;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ---------- fun ----------

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function burst(el, emojis, count = 18) {
  if (reduceMotion || !el) return;
  const r = el.getBoundingClientRect();
  const fx = $('#fx');
  const x0 = r.left + r.width / 2;
  const y0 = r.top + r.height / 2;
  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    span.textContent = emojis[i % emojis.length];
    fx.appendChild(span);
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 7;
    let x = x0;
    let y = y0;
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed - 6;
    let rot = Math.random() * 360;
    const spin = (Math.random() - 0.5) * 20;
    const start = performance.now();
    const step = (time) => {
      const life = (time - start) / 1300;
      if (life >= 1) {
        span.remove();
        return;
      }
      vy += 0.35;
      x += vx;
      y += vy;
      rot += spin;
      span.style.transform = `translate(${x - 13}px, ${y - 13}px) rotate(${rot}deg) scale(${1.2 - life * 0.5})`;
      span.style.opacity = String(1 - life * life);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

function effects(action, el, cut) {
  if (action === 'done') { sfx.flush(); burst(el, ['🧻', '✨', '🫧', '💨', '🧼'], 26); }
  else if (action === 'free') { sfx.flush(); burst(el, ['🙄', '🧻', '🫧'], 16); }
  else if (action === 'book') { sfx.pop(); burst(el, ['🎟️', '✨'], 12); }
  else if (action === 'in') { sfx.lock(); burst(el, cut ? ['😈', '💨', '🏃'] : ['👑', '🚽', '✨'], 16); }
  else if (action === 'leave') { sfx.boop(); burst(el, ['👋'], 6); }
  navigator.vibrate?.(30);
}

// Tiny synthesized sound effects, no audio files.
const sfx = (() => {
  let ctx = null;
  const ac = () => {
    if (!soundOn) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const tone = (freq, endFreq, dur, type = 'sine', vol = 0.25, delay = 0) => {
    const a = ac();
    if (!a) return;
    const t0 = a.currentTime + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    o.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  };
  return {
    unlock: () => ac(),
    pop: () => tone(380, 980, 0.14, 'sine', 0.3),
    boop: () => tone(520, 220, 0.2, 'triangle', 0.2),
    lock: () => { tone(900, 600, 0.06, 'square', 0.08); tone(500, 300, 0.08, 'square', 0.08, 0.08); },
    chime: () => { tone(880, 880, 0.35, 'sine', 0.25); tone(1320, 1320, 0.5, 'sine', 0.22, 0.18); },
    flush: () => {
      const a = ac();
      if (!a) return;
      const dur = 1.7;
      const t0 = a.currentTime;
      const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = a.createBufferSource();
      src.buffer = buf;
      const f = a.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 1.4;
      f.frequency.setValueAtTime(2200, t0);
      f.frequency.exponentialRampToValueAtTime(180, t0 + dur);
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.7, t0 + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f).connect(g).connect(a.destination);
      src.start(t0);
      for (let i = 0; i < 5; i++) tone(300 + i * 90, 700 + i * 120, 0.09, 'sine', 0.12, 0.9 + i * 0.13);
    },
  };
})();

// ---------- wiring ----------

$('#actions').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (b && !b.disabled) onAction(b.dataset.act, b);
});
$('#me').addEventListener('click', openPicker);
$('#sound').addEventListener('click', () => {
  soundOn = !soundOn;
  store.set('throne.sound', soundOn ? 'on' : 'off');
  renderMe();
  sfx.pop();
});
$('#notify').addEventListener('click', askNotify);
$('#topic').textContent = TOPIC;

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') resync();
});
addEventListener('online', resync);

// Reconnect if the stream silently stalls (ntfy sends a keepalive every ~45s).
setInterval(() => {
  if (document.visibilityState === 'visible' && es && Date.now() - lastBeat > 80000) resync();
}, 15000);
setInterval(tick, 1000);

navigator.serviceWorker?.register('sw.js').catch(() => {});
renderNotifyButton();
update();
if (!me) openPicker();
resync();
