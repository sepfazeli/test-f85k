// Pure queue logic. Every phone replays the same ordered event list from
// ntfy.sh through derive(), so everyone agrees on who is on the throne
// without a server of our own.

export const PEOPLE = [
  { id: 'sepehr', name: 'Sepehr', emoji: '🦊', color: '#FF8A3D' },
  { id: 'dorsa', name: 'Dorsa', emoji: '🐰', color: '#FF6FA8' },
  { id: 'rana', name: 'Rana', emoji: '🦋', color: '#9B6BFF' },
  { id: 'mo', name: 'Mo', emoji: '🐻', color: '#D9893B' },
  { id: 'mahyar', name: 'Mahyar', emoji: '🐸', color: '#2FB865' },
  { id: 'parsa', name: 'Parsa', emoji: '🐧', color: '#3D8BFF' },
];
export const PERSON = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));

export const SIT_LIMIT = 60 * 60; // auto-free a forgotten session after 60 min
export const BOOK_LIMIT = 2 * 60 * 60; // drop bookings nobody used after 2 h
export const GRACE = 5 * 60; // next in line gets 5 min before skipping them is fair game
export const WINDOW = 12 * 60 * 60; // ntfy.sh keeps messages for 12 h

const ACTIONS = new Set(['book', 'leave', 'in', 'done', 'free']);

// ntfy message -> { id, t, action, who }. The event rides in the tags
// ("e-in", "u-mo") so the human-readable message stays free for push alerts.
export function parseEvent(msg) {
  if (!msg || msg.event !== 'message' || !Array.isArray(msg.tags)) return null;
  let action = null;
  let who = null;
  for (const tag of msg.tags) {
    if (tag.startsWith('e-')) action = tag.slice(2);
    else if (tag.startsWith('u-')) who = tag.slice(2);
  }
  if (!ACTIONS.has(action) || !PERSON[who]) return null;
  return { id: msg.id, t: msg.time, action, who };
}

export function emptyState() {
  return {
    occupant: null,
    since: 0,
    queue: [], // [{ who, t }]
    head: null, // who is first in line, and since when
    headSince: 0,
    lastFree: null, // { who, t, how }
    sessions: [], // [{ who, start, end, how }]
    cuts: {},
    forgot: {},
    feed: [],
  };
}

export function position(s, who) {
  return s.queue.findIndex((q) => q.who === who) + 1;
}

// When the person at the front of the line got their chance: the later of
// reaching the front and the throne going free.
export function upSince(s) {
  return Math.max(s.headSince, s.lastFree ? s.lastFree.t : 0);
}

export function canDo(s, action, who) {
  switch (action) {
    case 'book':
      return s.occupant !== who && !position(s, who);
    case 'leave':
      return position(s, who) > 0;
    case 'in':
      return s.occupant === null;
    case 'done':
      return s.occupant === who;
    case 'free':
      return s.occupant !== null && s.occupant !== who;
  }
  return false;
}

// Would going in right now jump someone who still has their grace period?
export function wouldCut(s, who, now) {
  if (s.occupant !== null || !s.queue.length || s.queue[0].who === who) return false;
  return now - upSince(s) < GRACE;
}

function syncHead(s, t) {
  const head = s.queue.length ? s.queue[0].who : null;
  if (head !== s.head) {
    s.head = head;
    s.headSince = t;
  }
}

function endSession(s, end, how) {
  const who = s.occupant;
  s.sessions.push({ who, start: s.since, end, how });
  s.lastFree = { who, t: end, how };
  s.occupant = null;
  s.since = 0;
}

function expire(s, t) {
  if (s.occupant && t - s.since >= SIT_LIMIT) {
    const who = s.occupant;
    const end = s.since + SIT_LIMIT;
    endSession(s, end, 'expired');
    s.forgot[who] = (s.forgot[who] || 0) + 1;
    s.feed.push({ type: 'expired', who, t: end });
  }
  const before = s.queue.length;
  s.queue = s.queue.filter((q) => t - q.t < BOOK_LIMIT);
  if (s.queue.length !== before) syncHead(s, t);
}

function apply(s, { action, who, t }) {
  if (action === 'book') {
    s.queue.push({ who, t });
    s.feed.push({ type: 'book', who, t, pos: s.queue.length });
  } else if (action === 'leave') {
    s.queue = s.queue.filter((q) => q.who !== who);
    s.feed.push({ type: 'leave', who, t });
  } else if (action === 'in') {
    const first = s.queue.length ? s.queue[0].who : null;
    const skipped = first && first !== who ? first : null;
    const cut = skipped !== null && t - upSince(s) < GRACE;
    s.queue = s.queue.filter((q) => q.who !== who);
    s.occupant = who;
    s.since = t;
    if (cut) s.cuts[who] = (s.cuts[who] || 0) + 1;
    s.feed.push({ type: cut ? 'cut' : skipped ? 'skip' : 'in', who, t, skipped });
  } else if (action === 'done') {
    const dur = t - s.since;
    endSession(s, t, 'done');
    s.feed.push({ type: 'done', who, t, dur });
  } else if (action === 'free') {
    const victim = s.occupant;
    const dur = t - s.since;
    endSession(s, t, 'freed');
    s.forgot[victim] = (s.forgot[victim] || 0) + 1;
    s.feed.push({ type: 'free', who, t, victim, dur });
  }
  syncHead(s, t);
}

// Replays events (in ntfy's order) into the state as of `now` (unix seconds).
export function derive(events, now) {
  const s = emptyState();
  for (const ev of events) {
    if (ev.t < now - WINDOW) continue;
    expire(s, ev.t);
    if (canDo(s, ev.action, ev.who)) apply(s, ev);
  }
  expire(s, now);
  return s;
}

export function awards(s) {
  const visits = {};
  let longest = null;
  let fastest = null;
  for (const x of s.sessions) {
    visits[x.who] = (visits[x.who] || 0) + 1;
    if (x.how !== 'done') continue;
    const dur = x.end - x.start;
    if (!longest || dur > longest.dur) longest = { who: x.who, dur };
    if (dur >= 20 && (!fastest || dur < fastest.dur)) fastest = { who: x.who, dur };
  }
  const top = (counts) => {
    let best = null;
    for (const [who, n] of Object.entries(counts)) if (!best || n > best.n) best = { who, n };
    return best;
  };
  const out = [];
  const regular = top(visits);
  if (regular) out.push({ icon: '👑', title: 'Throne Regular', who: regular.who, detail: plural(regular.n, 'visit') });
  if (longest) out.push({ icon: '🐢', title: 'Marathon Sitter', who: longest.who, detail: duration(longest.dur) });
  if (fastest) out.push({ icon: '⚡', title: 'Speedrunner', who: fastest.who, detail: duration(fastest.dur) });
  const cutter = top(s.cuts);
  if (cutter) out.push({ icon: '😈', title: 'Line Cutter', who: cutter.who, detail: plural(cutter.n, 'cut') });
  const forgetful = top(s.forgot);
  if (forgetful) out.push({ icon: '🙈', title: 'Forgot to Flush', who: forgetful.who, detail: plural(forgetful.n, 'time') });
  return out;
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function duration(sec) {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ${String(sec % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
