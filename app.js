/* PPL Tracker — vanilla JS app.
 * Loads program.json + exercise-image-overrides.json, renders a day at a time,
 * persists everything to localStorage.
 */
'use strict';

// ===================================================================
// Storage helpers
// ===================================================================
const LS_PREFIX = 'ppl:';
const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(val));
    } catch {}
  },
  del(key) {
    try { localStorage.removeItem(LS_PREFIX + key); } catch {}
  },
  wipeAll() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(LS_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  },
};

// `e` may be a numeric index (built-in) or a custom id like "c1700000000".
const setKey = (b, w, d, e, s) => `set:${b}.${w}.${d}.${e}.${s}`;
const lsrpeKey = (b, w, d, e) => `lsrpe:${b}.${w}.${d}.${e}`;
const doneKey = (b, w, d, e) => `done:${b}.${w}.${d}.${e}`;
const swapKey = (b, w, d, e) => `swap:${b}.${w}.${d}.${e}`;
const rmKey   = (exerciseBaseName) => `1rm:${exerciseBaseName.toLowerCase()}`;
const addsKey = (b, w, d) => `custom:adds:${b}.${w}.${d}`;
const editKey = (b, w, d, e) => `custom:edit:${b}.${w}.${d}.${e}`;

// ===================================================================
// App state
// ===================================================================
const DEFAULT_SETTINGS = { units: 'kg', images: 'on', setsPerExercise: '3' };
const state = {
  program: null,
  meta: {},   // base-name → { slug, primary[], secondary[], video? }
  pos: store.get('last', { block: 1, week: 1, day: 1 }),
  settings: Object.assign({}, DEFAULT_SETTINGS, store.get('settings', {})),
  restTimer: null,
};

// Effective set count given the override setting.
function effectiveSets(ex) {
  const s = state.settings.setsPerExercise;
  if (s === 'pdf') return ex.sets;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : ex.sets;
}
function effectiveTSV(day) {
  if (state.settings.setsPerExercise === 'pdf') return day.totalSetVolume;
  return day.exercises.reduce((sum, ex) => sum + effectiveSets(ex), 0);
}

// ===================================================================
// Boot
// ===================================================================
async function boot() {
  try {
    const [progRes, imgRes] = await Promise.all([
      fetch('program.json'),
      fetch('exercise-image-overrides.json'),
    ]);
    state.program = await progRes.json();
    const ovr = await imgRes.json();
    state.meta = Object.fromEntries(
      Object.entries(ovr)
        .filter(([k]) => !k.startsWith('_'))
        .map(([k, v]) => [k, typeof v === 'string' ? { slug: v, primary: [], secondary: [] } : v])
    );
  } catch (err) {
    document.body.innerHTML = `<pre style="color:#fff;padding:20px;">Failed to load program data.\n${err.message}\n\nIf you opened this file directly, try serving with:\n  python3 -m http.server 8000</pre>`;
    return;
  }
  // Clamp position into valid range.
  const blockCount = state.program.blocks.length;
  state.pos.block = Math.min(Math.max(1, state.pos.block), blockCount);
  state.pos.week = Math.min(Math.max(1, state.pos.week), 8);
  state.pos.day = Math.min(Math.max(1, state.pos.day), 6);

  wireGlobalUI();
  renderAll();
}
window.addEventListener('DOMContentLoaded', boot);

// ===================================================================
// Rendering
// ===================================================================
function renderAll() {
  renderSelectors();
  renderDay();
  store.set('last', state.pos);
}

function renderSelectors() {
  const blockStrip = document.querySelector('.chip-strip[data-group="block"]');
  blockStrip.innerHTML = '';
  for (const block of state.program.blocks) {
    const btn = document.createElement('button');
    btn.className = 'chip' + (block.id === state.pos.block ? ' active' : '');
    btn.role = 'tab';
    btn.textContent = `Block ${block.id}`;
    btn.addEventListener('click', () => {
      state.pos.block = block.id;
      renderAll();
    });
    blockStrip.appendChild(btn);
  }

  const block = currentBlock();

  const weekStrip = document.querySelector('.chip-strip[data-group="week"]');
  weekStrip.innerHTML = '';
  for (const week of block.weeks) {
    const btn = document.createElement('button');
    btn.className = 'chip' + (week.id === state.pos.week ? ' active' : '') + (week.isDeload ? ' deload' : '');
    btn.textContent = `Week ${week.id}`;
    btn.addEventListener('click', () => {
      state.pos.week = week.id;
      renderAll();
    });
    weekStrip.appendChild(btn);
  }
  // Scroll active week into view on narrow screens.
  setTimeout(() => {
    const active = weekStrip.querySelector('.chip.active');
    if (active && active.scrollIntoView) active.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, 0);

  const dayStrip = document.querySelector('.chip-strip[data-group="day"]');
  dayStrip.innerHTML = '';
  const week = currentWeek();
  for (const day of week.days) {
    const btn = document.createElement('button');
    btn.className = 'chip' + (day.id === state.pos.day ? ' active' : '');
    btn.textContent = `D${day.id} · ${day.name}`;
    btn.addEventListener('click', () => {
      state.pos.day = day.id;
      renderAll();
    });
    dayStrip.appendChild(btn);
  }
}

function renderDay() {
  const block = currentBlock();
  const week = currentWeek();
  const day = currentDay();

  // ---- Hero ----
  document.getElementById('hero-eyebrow').textContent = `Block ${block.id} · ${week.label}`;
  document.getElementById('hero-number').textContent = `D${day.id}`;
  document.getElementById('hero-title').textContent = day.name;
  const deloadEl = document.getElementById('hero-deload');
  deloadEl.hidden = !week.isDeload;

  const customActive = state.settings.setsPerExercise !== 'pdf';
  const tsv = effectiveTSV(day);
  document.getElementById('hero-stat-tsv').innerHTML =
    `${tsv}${customActive ? `<span class="tsv-custom-note"> ${state.settings.setsPerExercise}/ex</span>` : ''}`;
  const effective = currentExercises();
  document.getElementById('hero-stat-ex').textContent = effective.length;

  // ---- Cards ----
  const list = document.getElementById('exercise-list');
  list.innerHTML = '';
  effective.forEach((ex, i) => {
    const card = renderExerciseCard(ex, ex._exKey);
    card.style.animationDelay = `${Math.min(i * 40, 320)}ms`;
    list.appendChild(card);
  });

  // "+ Add exercise" CTA at the bottom of every day.
  const addBtn = document.createElement('button');
  addBtn.className = 'add-exercise-card';
  addBtn.type = 'button';
  addBtn.innerHTML = '';
  addBtn.appendChild(makeIcon('plus'));
  addBtn.appendChild(document.createTextNode('Add exercise'));
  addBtn.addEventListener('click', () => openEditModal({ mode: 'add' }));
  list.appendChild(addBtn);

  refreshDayProgress();
  refreshBottomNav();
}

function refreshDayProgress() {
  const list = currentExercises();
  let totalSets = 0;
  let doneSets = 0;
  list.forEach(ex => {
    const n = effectiveSets(ex);
    totalSets += n;
    for (let s = 0; s < n; s++) {
      const entry = store.get(setKey(state.pos.block, state.pos.week, state.pos.day, ex._exKey, s));
      if (entry && entry.done) doneSets++;
    }
  });
  const ratio = totalSets ? doneSets / totalSets : 0;
  const complete = doneSets === totalSets && totalSets > 0;

  // Hero stat
  const heroProgEl = document.getElementById('hero-stat-progress');
  heroProgEl.textContent = `${doneSets}/${totalSets}`;
  heroProgEl.classList.toggle('progress-red', !complete && doneSets > 0);
  heroProgEl.classList.toggle('progress-done', complete);
  document.getElementById('hero-progress-bar').style.width = `${ratio * 100}%`;

  // Bottom nav status
  const navStatus = document.getElementById('nav-status');
  document.getElementById('nav-status-line-1').textContent =
    `Day ${state.pos.day} / 6 — ${currentDay().name}`;
  document.getElementById('nav-status-line-2').innerHTML =
    `<span class="progress-text">${doneSets}/${totalSets}</span> sets logged`;
  navStatus.style.setProperty('--progress', `${ratio * 100}%`);
  navStatus.classList.toggle('complete', complete);

  // Celebrate on transition into "complete" state
  maybeCelebrate(complete);
}

let _celebratedKey = null;
function maybeCelebrate(complete) {
  const key = `${state.pos.block}.${state.pos.week}.${state.pos.day}`;
  if (!complete) {
    if (_celebratedKey === key) _celebratedKey = null;
    return;
  }
  if (_celebratedKey === key) return;
  _celebratedKey = key;
  const el = document.getElementById('day-complete');
  el.hidden = false;
  // Re-trigger animation
  el.querySelectorAll('.day-complete-sweep, .day-complete-stack').forEach(n => {
    n.style.animation = 'none'; n.offsetHeight; n.style.animation = '';
  });
  if (navigator.vibrate) navigator.vibrate([20, 60, 20, 60, 80]);
  setTimeout(() => { el.hidden = true; }, 2200);
}

// Mark day chips that are fully complete with a small visual cue.
function refreshDayChipsCompletion() {
  const week = currentWeek();
  const dayStrip = document.querySelector('.chip-strip[data-group="day"]');
  if (!dayStrip) return;
  const chips = dayStrip.querySelectorAll('.chip');
  week.days.forEach((day, i) => {
    const chip = chips[i];
    if (!chip) return;
    let total = 0, done = 0;
    const list = getEffectiveExercises(state.pos.block, state.pos.week, day.id);
    list.forEach(ex => {
      const n = effectiveSets(ex);
      total += n;
      for (let s = 0; s < n; s++) {
        const entry = store.get(setKey(state.pos.block, state.pos.week, day.id, ex._exKey, s));
        if (entry && entry.done) done++;
      }
    });
    chip.classList.toggle('day-done', total > 0 && done === total);
  });
}

function refreshBottomNav() {
  const prevBtn = document.getElementById('nav-prev');
  const nextBtn = document.getElementById('nav-next');
  prevBtn.disabled = state.pos.day === 1;
  nextBtn.disabled = state.pos.day === 6;
  refreshDayChipsCompletion();
}

// ===================================================================
// Exercise card
// ===================================================================
function renderExerciseCard(ex, exKey) {
  const { block, week, day } = state.pos;

  // Resolve swap (if any)
  const swappedName = store.get(swapKey(block, week, day, exKey));
  const displayName = swappedName || ex.name;
  const baseExerciseName = displayName.replace(/^A\d+:\s*/, '');
  // For custom/edited exercises, prefer their inline meta when looking up
  // image + video; fall back to the global overrides for built-ins.
  const exMeta = mergeMeta(ex, displayName);

  const card = document.createElement('article');
  card.className = 'exercise-card' + (ex.supersetGroup ? ' superset' : '');

  // ----- top section: animated thumb + meta -----
  const top = document.createElement('div');
  top.className = 'exercise-top';

  const thumb = document.createElement('div');
  thumb.className = 'exercise-thumb loading';
  thumb.appendChild(makeAnimatedThumb(displayName, exMeta.slug));
  thumb.addEventListener('click', () => openDemoModal(displayName, ex));
  thumb.setAttribute('role', 'button');
  thumb.setAttribute('tabindex', '0');
  thumb.setAttribute('aria-label', `Show form demo for ${displayName}`);
  thumb.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDemoModal(displayName, ex);
    }
  });
  top.appendChild(thumb);

  const meta = document.createElement('div');
  meta.className = 'exercise-meta';
  const nameEl = document.createElement('h3');
  nameEl.className = 'exercise-name';
  if (ex.supersetGroup) {
    const badge = document.createElement('span');
    badge.className = 'superset-badge';
    badge.textContent = `Superset ${ex.supersetGroup}`;
    nameEl.appendChild(badge);
  }
  if (ex._isCustom) {
    const b = document.createElement('span');
    b.className = 'custom-badge'; b.textContent = 'Custom';
    nameEl.appendChild(b);
  } else if (ex._hasEdit) {
    const b = document.createElement('span');
    b.className = 'edited-badge'; b.textContent = 'Edited';
    nameEl.appendChild(b);
  }
  if (isExerciseDone(exKey)) {
    const stamp = document.createElement('span');
    stamp.className = 'done-stamp';
    stamp.textContent = '✓ Done';
    nameEl.appendChild(stamp);
  }
  nameEl.appendChild(document.createTextNode(displayName));
  meta.appendChild(nameEl);

  if (swappedName) {
    const sub = document.createElement('div');
    sub.className = 'exercise-swapped';
    sub.textContent = `↻ swapped from ${ex.name}`;
    meta.appendChild(sub);
  }

  const px = document.createElement('div');
  px.className = 'exercise-prescription';
  const nSets = effectiveSets(ex);
  const setsBadge = nSets === ex.sets
    ? `<b>${nSets}</b>`
    : `<b>${nSets}</b> <span style="color:var(--red);font-size:11px;">(PDF: ${ex.sets})</span>`;
  px.innerHTML = `${setsBadge} × <b>${escapeHtml(ex.reps)}</b> @ <b>${formatLoad(ex.load)}</b>`;
  meta.appendChild(px);

  const rest = document.createElement('div');
  rest.className = 'exercise-rest';
  rest.textContent = `Rest ${ex.rest}`;
  meta.appendChild(rest);

  // Muscle chips (primary + a few secondary)
  if ((exMeta.primary && exMeta.primary.length) || (exMeta.secondary && exMeta.secondary.length)) {
    const muscles = document.createElement('div');
    muscles.className = 'muscles';
    for (const name of (exMeta.primary || [])) {
      const chip = document.createElement('span');
      chip.className = 'muscle-chip primary';
      chip.textContent = name;
      muscles.appendChild(chip);
    }
    for (const name of (exMeta.secondary || []).slice(0, 3)) {
      const chip = document.createElement('span');
      chip.className = 'muscle-chip secondary';
      chip.textContent = name;
      muscles.appendChild(chip);
    }
    meta.appendChild(muscles);
  }

  const actions = document.createElement('div');
  actions.className = 'exercise-actions';
  actions.style.marginTop = '8px';

  const swapBtn = document.createElement('button');
  swapBtn.className = 'btn-ghost';
  swapBtn.appendChild(makeIcon('swap'));
  swapBtn.appendChild(document.createTextNode('Swap'));
  swapBtn.addEventListener('click', () => openSwapModal(ex, exKey));
  actions.appendChild(swapBtn);

  const editBtn = document.createElement('button');
  editBtn.className = 'btn-ghost';
  editBtn.appendChild(makeIcon('edit'));
  editBtn.appendChild(document.createTextNode('Edit'));
  editBtn.addEventListener('click', () => openEditModal({ mode: 'edit', exKey }));
  actions.appendChild(editBtn);

  const doneBtn = document.createElement('button');
  doneBtn.className = 'done-toggle';
  const initiallyDone = isExerciseDone(exKey);
  doneBtn.appendChild(makeIcon('check'));
  doneBtn.appendChild(document.createTextNode(initiallyDone ? 'Done' : 'Mark done'));
  if (initiallyDone) doneBtn.classList.add('is-done');
  doneBtn.addEventListener('click', () => toggleExerciseDone(exKey));
  actions.appendChild(doneBtn);

  meta.appendChild(actions);
  top.appendChild(meta);
  card.appendChild(top);

  // ----- coaching notes -----
  if (ex.notes) {
    const det = document.createElement('details');
    det.className = 'coach-notes';
    const sum = document.createElement('summary');
    sum.textContent = 'Coach notes';
    const p = document.createElement('p');
    p.textContent = ex.notes;
    det.appendChild(sum);
    det.appendChild(p);
    card.appendChild(det);
  }

  // ----- %1RM panel (only if exercise uses %1RM) -----
  if (ex.load.type === 'percent1RM') {
    const panel = document.createElement('div');
    panel.className = 'rm-panel';
    const stored1RM = store.get(rmKey(baseExerciseName));
    panel.innerHTML = `
      <label>1RM</label>
      <input type="number" class="rm-input" inputmode="decimal" step="0.5" placeholder="—" value="${stored1RM ?? ''}" />
      <span class="rm-unit" style="color:var(--text-mute);font-weight:600;">${state.settings.units}</span>
      <span class="rm-target">Target: <span data-target>—</span></span>
    `;
    const input = panel.querySelector('input');
    const targetEl = panel.querySelector('[data-target]');
    const updateTarget = () => {
      const v = parseFloat(input.value);
      if (Number.isFinite(v) && v > 0) {
        const target = roundToIncrement(v * (ex.load.value / 100), 2.5);
        targetEl.textContent = `${target} ${state.settings.units}`;
        store.set(rmKey(baseExerciseName), v);
      } else {
        targetEl.textContent = '—';
        store.del(rmKey(baseExerciseName));
      }
    };
    input.addEventListener('input', updateTarget);
    updateTarget();
    card.appendChild(panel);
  }

  // ----- set rows -----
  const setGrid = document.createElement('div');
  setGrid.className = 'set-grid';
  const labels = document.createElement('div');
  labels.className = 'col-labels';
  labels.innerHTML = `<span>Set</span><span>Weight (${state.settings.units})</span><span>Reps</span><span></span>`;
  setGrid.appendChild(labels);

  for (let s = 0; s < nSets; s++) {
    setGrid.appendChild(renderSetRow(ex, exKey, s));
  }
  card.appendChild(setGrid);

  // ----- LSRPE row -----
  const lsRow = document.createElement('div');
  lsRow.className = 'lsrpe-row';
  const lsrpeVal = store.get(lsrpeKey(block, week, day, exKey)) ?? '';
  lsRow.innerHTML = `
    <span>Last-set RPE</span>
    <input type="number" inputmode="decimal" min="1" max="10" step="0.5" value="${lsrpeVal}" placeholder="—" />
    <button class="btn-secondary rest-btn" type="button"></button>
  `;
  const restBtn = lsRow.querySelector('.rest-btn');
  restBtn.appendChild(makeIcon('timer'));
  restBtn.appendChild(document.createTextNode('Rest'));
  const lsInput = lsRow.querySelector('input');
  lsInput.setAttribute('aria-label', 'Last-set RPE (1 to 10)');
  lsInput.addEventListener('input', () => {
    const v = parseFloat(lsInput.value);
    const valid = Number.isFinite(v) && v >= 1 && v <= 10;
    lsInput.setAttribute('aria-invalid', String(lsInput.value !== '' && !valid));
    if (valid) store.set(lsrpeKey(block, week, day, exKey), v);
    else store.del(lsrpeKey(block, week, day, exKey));
  });
  lsRow.querySelector('.rest-btn').addEventListener('click', () => startRestTimer(ex.rest));
  card.appendChild(lsRow);

  if (isExerciseDone(exKey)) card.classList.add('done');

  return card;
}

function renderSetRow(ex, exKey, setIdx) {
  const { block, week, day } = state.pos;
  const k = setKey(block, week, day, exKey, setIdx);
  const stored = store.get(k, { weight: '', reps: '', done: false });

  const row = document.createElement('div');
  row.className = 'set-row';

  const num = document.createElement('div');
  num.className = 'set-num';
  num.textContent = setIdx + 1;
  row.appendChild(num);

  const wIn = document.createElement('input');
  wIn.type = 'number';
  wIn.inputMode = 'decimal';
  wIn.step = '0.5';
  wIn.placeholder = '–';
  wIn.value = stored.weight;
  row.appendChild(wIn);

  const rIn = document.createElement('input');
  rIn.type = 'number';
  rIn.inputMode = 'numeric';
  rIn.step = '1';
  rIn.placeholder = stripNonNum(ex.reps) || '–';
  rIn.value = stored.reps;
  row.appendChild(rIn);

  const check = document.createElement('button');
  check.className = 'set-check' + (stored.done ? ' checked' : '');
  check.appendChild(makeIcon(stored.done ? 'check' : 'circle'));
  check.setAttribute('aria-label', `Mark set ${setIdx + 1} done`);
  check.setAttribute('aria-pressed', String(!!stored.done));
  row.appendChild(check);

  const save = () => {
    const entry = {
      weight: wIn.value,
      reps: rIn.value,
      done: check.classList.contains('checked'),
    };
    if (!entry.weight && !entry.reps && !entry.done) store.del(k);
    else store.set(k, entry);
    refreshDayProgress();
    // Also refresh exercise card done state subtly
    const card = row.closest('.exercise-card');
    if (isExerciseDone(exKey)) card.classList.add('done');
    else card.classList.remove('done');
  };
  wIn.addEventListener('input', save);
  rIn.addEventListener('input', save);
  check.addEventListener('click', () => {
    const willBeDone = !check.classList.contains('checked');
    check.classList.toggle('checked', willBeDone);
    check.innerHTML = '';
    check.appendChild(makeIcon(willBeDone ? 'check' : 'circle'));
    check.setAttribute('aria-pressed', String(willBeDone));
    if (willBeDone && navigator.vibrate) navigator.vibrate(15);
    save();
    if (willBeDone) startRestTimer(ex.rest);
    // Update "Mark done" button label to reflect aggregate state.
    const card = row.closest('.exercise-card');
    const doneBtn = card.querySelector('.done-toggle');
    const aggDone = isExerciseDone(exKey);
    doneBtn.textContent = aggDone ? '✓ Done' : 'Mark done';
    doneBtn.classList.toggle('is-done', aggDone);
  });

  return row;
}

// An exercise is "done" when either:
//  - all of its prescribed sets are checked, OR
//  - the user toggled the per-exercise "Mark done" override.
function findExerciseByKey(blockId, weekId, dayId, exKey) {
  const list = getEffectiveExercises(blockId, weekId, dayId);
  return list.find(e => e._exKey === String(exKey));
}

function isExerciseDone(exKey) {
  const { block, week, day } = state.pos;
  const ex = findExerciseByKey(block, week, day, exKey);
  if (!ex) return false;
  if (store.get(doneKey(block, week, day, exKey)) === true) return true;
  const n = effectiveSets(ex);
  if (n === 0) return false;
  for (let s = 0; s < n; s++) {
    const entry = store.get(setKey(block, week, day, exKey, s));
    if (!entry || !entry.done) return false;
  }
  return true;
}

function toggleExerciseDone(exKey) {
  const { block, week, day } = state.pos;
  const ex = findExerciseByKey(block, week, day, exKey);
  if (!ex) return;
  const currentlyDone = isExerciseDone(exKey);
  const n = effectiveSets(ex);
  if (currentlyDone) {
    store.del(doneKey(block, week, day, exKey));
    for (let s = 0; s < n; s++) {
      const k = setKey(block, week, day, exKey, s);
      const entry = store.get(k);
      if (entry) {
        entry.done = false;
        store.set(k, entry);
      }
    }
  } else {
    store.set(doneKey(block, week, day, exKey), true);
    for (let s = 0; s < n; s++) {
      const k = setKey(block, week, day, exKey, s);
      const entry = store.get(k, { weight: '', reps: '', done: false });
      entry.done = true;
      store.set(k, entry);
    }
  }
  renderDay();
}

// ===================================================================
// Images & exercise metadata
// ===================================================================
function lookupExerciseMeta(name) {
  if (state.meta[name]) return state.meta[name];
  const stripped = name.replace(/^A\d+:\s*/, '');
  if (state.meta[stripped]) return state.meta[stripped];
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(state.meta)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}
function lookupImageSlug(name) {
  const m = lookupExerciseMeta(name);
  return m ? m.slug : null;
}

// Compose the effective image/muscles/video for an exercise instance.
// Inline overrides on the exercise (from user edits / customs) win over the
// global metadata file. This means editing the video URL in the editor takes
// effect immediately without touching the overrides JSON.
function mergeMeta(ex, displayName) {
  const base = lookupExerciseMeta(displayName) || {};
  return {
    slug:      (ex.slug && ex.slug.trim()) || base.slug || null,
    primary:   (ex.primary  && ex.primary.length)  ? ex.primary  : (base.primary  || []),
    secondary: (ex.secondary && ex.secondary.length)? ex.secondary: (base.secondary || []),
    video:     (ex.video && ex.video.trim()) || base.video || null,
  };
}

// Returns an element that cycles between the exercise's frame 0 and frame 1
// from free-exercise-db, producing a flipbook-style motion preview.
function makeAnimatedThumb(name, slugOverride) {
  if (state.settings.images === 'off') return placeholderEl();
  const slug = slugOverride || lookupImageSlug(name);
  if (!slug) return placeholderEl();
  const wrap = document.createElement('div');
  wrap.className = 'thumb-cycle';
  let loadedCount = 0;
  let errored = 0;
  const stopShimmer = () => wrap.parentElement && wrap.parentElement.classList.remove('loading');
  const fallback = () => {
    stopShimmer();
    wrap.replaceWith(placeholderEl());
  };
  for (let i = 0; i < 2; i++) {
    const img = document.createElement('img');
    img.alt = `${name} — ${i === 0 ? 'start' : 'end'} position`;
    img.loading = 'lazy';
    img.src = imageUrl(slug, i);
    img.addEventListener('load', () => {
      loadedCount++;
      // Stop the skeleton shimmer the moment the first frame arrives.
      if (loadedCount === 1) stopShimmer();
    });
    img.addEventListener('error', () => {
      errored++;
      if (i === 0 && errored === 1) fallback();
    });
    wrap.appendChild(img);
  }
  return wrap;
}

function imageUrl(slug, idx) {
  return `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${encodeURIComponent(slug)}/${idx}.jpg`;
}

function placeholderEl() {
  const ph = document.createElement('div');
  ph.className = 'placeholder';
  ph.textContent = 'PPL';
  return ph;
}

function extractYoutubeId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

// ===================================================================
// Demo modal — larger animation + muscle chips + YouTube embed
// ===================================================================
function openDemoModal(displayName, ex) {
  const m = mergeMeta(ex || {}, displayName);
  const modal = document.getElementById('demo-modal');
  const body = document.getElementById('demo-body');
  document.getElementById('demo-title').textContent = 'Form demo';

  body.innerHTML = '';

  // Large animated frame swap
  const anim = document.createElement('div');
  anim.className = 'demo-anim';
  anim.appendChild(makeAnimatedThumb(displayName, m.slug));
  body.appendChild(anim);

  const nm = document.createElement('h3');
  nm.className = 'demo-name';
  nm.textContent = displayName;
  body.appendChild(nm);

  const px = document.createElement('div');
  px.className = 'exercise-prescription';
  px.innerHTML = `<b>${effectiveSets(ex)}</b> × <b>${escapeHtml(ex.reps)}</b> @ <b>${formatLoad(ex.load)}</b> · Rest ${ex.rest}`;
  body.appendChild(px);

  // Muscles section
  if ((m.primary && m.primary.length) || (m.secondary && m.secondary.length)) {
    const lab = document.createElement('div');
    lab.className = 'demo-section-label';
    lab.textContent = 'Muscles worked';
    body.appendChild(lab);

    const muscles = document.createElement('div');
    muscles.className = 'muscles';
    for (const name of (m.primary || [])) {
      const chip = document.createElement('span');
      chip.className = 'muscle-chip primary';
      chip.textContent = name;
      muscles.appendChild(chip);
    }
    for (const name of (m.secondary || [])) {
      const chip = document.createElement('span');
      chip.className = 'muscle-chip secondary';
      chip.textContent = name;
      muscles.appendChild(chip);
    }
    body.appendChild(muscles);
  }

  // Coach notes
  if (ex.notes) {
    const lab = document.createElement('div');
    lab.className = 'demo-section-label';
    lab.textContent = 'Coach notes';
    body.appendChild(lab);
    const p = document.createElement('p');
    p.style.color = 'var(--text-dim)';
    p.style.fontSize = '13px';
    p.style.lineHeight = '1.5';
    p.style.margin = '0';
    p.textContent = ex.notes;
    body.appendChild(p);
  }

  // YouTube embed (or graceful note)
  const vlab = document.createElement('div');
  vlab.className = 'demo-section-label';
  vlab.style.display = 'flex';
  vlab.style.alignItems = 'center';
  vlab.textContent = 'Form video';
  // Tiny "✎ Edit" link that opens the editor focused for video changes
  if (ex && ex._exKey != null) {
    const editLink = document.createElement('button');
    editLink.className = 'demo-edit-link';
    editLink.type = 'button';
    editLink.appendChild(makeIcon('edit'));
    editLink.appendChild(document.createTextNode('Edit'));
    editLink.addEventListener('click', () => {
      closeDemoModal();
      openEditModal({ mode: 'edit', exKey: ex._exKey, focusVideo: true });
    });
    vlab.appendChild(editLink);
  }
  body.appendChild(vlab);

  const videoId = extractYoutubeId(m.video);
  if (videoId) {
    const iframe = document.createElement('iframe');
    iframe.className = 'demo-video';
    iframe.src = `https://www.youtube.com/embed/${videoId}`;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'no-referrer';
    body.appendChild(iframe);
  } else {
    const note = document.createElement('div');
    note.className = 'demo-no-video';
    const query = encodeURIComponent(displayName.replace(/^A\d+:\s*/, ''));
    note.innerHTML = `No video listed in the PDF for this exercise. ` +
      `<a href="https://www.youtube.com/results?search_query=jeff+nippard+${query}" target="_blank" rel="noopener" style="color:var(--red);">Search YouTube ↗</a>`;
    body.appendChild(note);
  }

  modal.hidden = false;
}

function closeDemoModal() {
  const modal = document.getElementById('demo-modal');
  // Pause the iframe by clearing the body (kills any sound).
  document.getElementById('demo-body').innerHTML = '';
  modal.hidden = true;
}

// ===================================================================
// Exercise editor — add / edit / delete an exercise
// ===================================================================
const editor = {
  mode: 'add',       // 'add' | 'edit'
  exKey: null,       // for 'edit'
  loadType: 'rpe',
};

function openEditModal({ mode, exKey, focusVideo }) {
  editor.mode = mode;
  editor.exKey = exKey ?? null;

  const titleEl = document.getElementById('edit-title');
  const form = document.getElementById('edit-form');
  const errEl = document.getElementById('edit-error');
  const resetBtn = document.getElementById('edit-reset');
  const deleteBtn = document.getElementById('edit-delete');

  errEl.hidden = true; errEl.textContent = '';

  let initial;
  if (mode === 'edit') {
    const ex = findExerciseByKey(state.pos.block, state.pos.week, state.pos.day, exKey);
    if (!ex) return;
    const meta = mergeMeta(ex, ex.name);
    initial = {
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      loadType: ex.load.type,
      loadValue: ex.load.value,
      rest: ex.rest,
      notes: ex.notes || '',
      supersetGroup: ex.supersetGroup || '',
      primary: (meta.primary || []).join(', '),
      secondary: (meta.secondary || []).join(', '),
      slug: ex.slug || meta.slug || '',
      video: ex.video || meta.video || '',
    };
    titleEl.textContent = ex._isCustom ? 'Edit custom exercise' : 'Edit exercise';
    resetBtn.hidden = !ex._hasEdit;        // only show Reset if there's an edit to undo
    deleteBtn.hidden = !ex._isCustom;      // only customs can be deleted
  } else {
    initial = {
      name: '', sets: 3, reps: '10',
      loadType: 'rpe', loadValue: 8,
      rest: '1-2min', notes: '', supersetGroup: '',
      primary: '', secondary: '', slug: '', video: '',
    };
    titleEl.textContent = 'Add exercise';
    resetBtn.hidden = true;
    deleteBtn.hidden = true;
  }

  // Fill form
  form.name.value = initial.name;
  form.sets.value = initial.sets;
  form.reps.value = initial.reps;
  form.loadValue.value = initial.loadValue;
  form.rest.value = initial.rest;
  form.notes.value = initial.notes;
  form.supersetGroup.value = initial.supersetGroup;
  form.primary.value = initial.primary;
  form.secondary.value = initial.secondary;
  form.slug.value = initial.slug;
  form.video.value = initial.video;

  setEditorLoadType(initial.loadType);

  document.getElementById('edit-modal').hidden = false;
  // Focus the field that's most likely to be edited.
  setTimeout(() => {
    if (focusVideo) form.video.focus();
    else if (mode === 'add') form.name.focus();
  }, 50);
}

function closeEditModal() {
  document.getElementById('edit-modal').hidden = true;
}

function setEditorLoadType(t) {
  editor.loadType = t;
  document.querySelectorAll('[data-edit-load] button').forEach(b => {
    b.classList.toggle('active', b.dataset.value === t);
  });
  document.getElementById('edit-load-label').textContent =
    t === 'percent1RM' ? 'Value (%)' : 'Value (1-10)';
}

function readEditorForm() {
  const form = document.getElementById('edit-form');
  return {
    name: form.name.value.trim(),
    sets: parseInt(form.sets.value, 10),
    reps: form.reps.value.trim(),
    loadType: editor.loadType,
    loadValue: parseFloat(form.loadValue.value),
    rest: form.rest.value.trim(),
    notes: form.notes.value.trim(),
    supersetGroup: form.supersetGroup.value.trim().toUpperCase() || null,
    primary: form.primary.value.split(',').map(s => s.trim()).filter(Boolean),
    secondary: form.secondary.value.split(',').map(s => s.trim()).filter(Boolean),
    slug: form.slug.value.trim(),
    video: form.video.value.trim(),
  };
}

function validateEditorData(data) {
  const errors = [];
  if (!data.name) errors.push('Name is required.');
  if (!Number.isFinite(data.sets) || data.sets < 1 || data.sets > 10) errors.push('Sets must be 1-10.');
  if (!data.reps) errors.push('Reps is required.');
  if (!Number.isFinite(data.loadValue) || data.loadValue <= 0) errors.push('Intensity value must be a positive number.');
  if (data.loadType === 'rpe' && (data.loadValue < 1 || data.loadValue > 10)) errors.push('RPE must be between 1 and 10.');
  if (data.loadType === 'percent1RM' && (data.loadValue < 1 || data.loadValue > 110)) errors.push('%1RM must be between 1 and 110.');
  if (!data.rest) errors.push('Rest is required.');
  if (data.video && !/^https?:\/\//i.test(data.video)) errors.push('Video URL must start with http:// or https://.');
  return errors;
}

function saveEditor() {
  const data = readEditorForm();
  const errs = validateEditorData(data);
  const errEl = document.getElementById('edit-error');
  if (errs.length) {
    errEl.textContent = errs.join(' ');
    errEl.hidden = false;
    return;
  }
  const { block, week, day } = state.pos;
  const payload = {
    name: data.name,
    sets: data.sets,
    reps: data.reps,
    load: { type: data.loadType, value: data.loadValue },
    rest: data.rest,
    notes: data.notes,
    supersetGroup: data.supersetGroup,
    primary: data.primary,
    secondary: data.secondary,
    slug: data.slug,
    video: data.video,
  };

  if (editor.mode === 'add') {
    const adds = store.get(addsKey(block, week, day), []);
    payload.id = 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
    adds.push(payload);
    store.set(addsKey(block, week, day), adds);
  } else {
    // For built-ins, store as a per-instance edit override.
    // For customs, mutate the addition entry in place (keeps its id stable).
    const ex = findExerciseByKey(block, week, day, editor.exKey);
    if (!ex) { closeEditModal(); return; }
    if (ex._isCustom) {
      const adds = store.get(addsKey(block, week, day), []);
      const idx = adds.findIndex(c => c.id === editor.exKey);
      if (idx !== -1) {
        adds[idx] = { ...adds[idx], ...payload };
        store.set(addsKey(block, week, day), adds);
      }
    } else {
      store.set(editKey(block, week, day, editor.exKey), payload);
    }
  }

  closeEditModal();
  renderDay();
}

function resetEditor() {
  if (editor.mode !== 'edit' || editor.exKey == null) return;
  const { block, week, day } = state.pos;
  // Only built-ins have an edit override to reset.
  store.del(editKey(block, week, day, editor.exKey));
  closeEditModal();
  renderDay();
}

function deleteEditor() {
  if (editor.mode !== 'edit' || editor.exKey == null) return;
  if (!confirm('Delete this custom exercise? Its logged sets will be cleared.')) return;
  const { block, week, day } = state.pos;
  const adds = store.get(addsKey(block, week, day), []);
  const filtered = adds.filter(c => c.id !== editor.exKey);
  store.set(addsKey(block, week, day), filtered);
  // Also wipe any per-set / lsrpe / done / swap entries for this custom.
  wipeKeysForExercise(block, week, day, editor.exKey);
  closeEditModal();
  renderDay();
}

function wipeKeysForExercise(b, w, d, exKey) {
  const prefix = `ppl:`;
  const ks = [
    `set:${b}.${w}.${d}.${exKey}.`,
    `lsrpe:${b}.${w}.${d}.${exKey}`,
    `done:${b}.${w}.${d}.${exKey}`,
    `swap:${b}.${w}.${d}.${exKey}`,
  ];
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(prefix)) continue;
    const tail = k.slice(prefix.length);
    if (ks.some(p => tail === p || tail.startsWith(p))) localStorage.removeItem(k);
  }
}

// ===================================================================
// Swap modal
// ===================================================================
function openSwapModal(ex, exKey) {
  const baseName = ex.name.replace(/^A\d+:\s*/, '');
  const subsForBase = state.program.substitutions[baseName] || state.program.substitutions[ex.name] || [];

  const modal = document.getElementById('swap-modal');
  const body = document.getElementById('swap-body');
  document.getElementById('swap-title').textContent = `Swap exercise`;

  const current = store.get(swapKey(state.pos.block, state.pos.week, state.pos.day, exKey));

  body.innerHTML = '';
  const lead = document.createElement('div');
  lead.className = 'sub-current';
  lead.innerHTML = `Prescribed: <b>${escapeHtml(ex.name)}</b><br>${ex.sets} × ${escapeHtml(ex.reps)} @ ${formatLoad(ex.load)} stays the same.`;
  body.appendChild(lead);

  if (subsForBase.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'No approved substitutions listed for this exercise in the program PDF. You can still mark a custom swap below.';
    body.appendChild(empty);
  }

  const list = document.createElement('ul');
  list.className = 'sub-list';

  for (const sub of subsForBase) {
    const li = document.createElement('li');
    if (current === sub) li.classList.add('selected');
    li.innerHTML = `<span>${escapeHtml(sub)}</span><button class="pick">${current === sub ? 'Selected' : 'Use'}</button>`;
    li.querySelector('.pick').addEventListener('click', () => {
      store.set(swapKey(state.pos.block, state.pos.week, state.pos.day, exKey), sub);
      closeSwapModal();
      renderDay();
    });
    list.appendChild(li);
  }
  body.appendChild(list);

  if (current) {
    const reset = document.createElement('button');
    reset.className = 'btn-secondary sub-reset';
    reset.textContent = 'Reset to original';
    reset.addEventListener('click', () => {
      store.del(swapKey(state.pos.block, state.pos.week, state.pos.day, exKey));
      closeSwapModal();
      renderDay();
    });
    body.appendChild(reset);
  }

  const mw = document.createElement('div');
  mw.className = 'mw-link';
  const displayName = current || ex.name;
  const query = encodeURIComponent(displayName.replace(/^A\d+:\s*/, ''));
  mw.innerHTML = `Need a different reference? <a href="https://musclewiki.com/search?q=${query}" target="_blank" rel="noopener">View on MuscleWiki ↗</a>`;
  body.appendChild(mw);

  modal.hidden = false;
}

function closeSwapModal() {
  document.getElementById('swap-modal').hidden = true;
}

// ===================================================================
// Rest timer
// ===================================================================
function startRestTimer(restText) {
  // Parse "2-3min", "1-2min", "0min", "30sec" etc.
  let seconds = 90;
  if (/sec/i.test(restText)) {
    const m = restText.match(/(\d+)/);
    if (m) seconds = parseInt(m[1], 10);
  } else if (/min/i.test(restText)) {
    const nums = restText.match(/\d+(\.\d+)?/g);
    if (nums) {
      const upper = parseFloat(nums[nums.length - 1]);
      seconds = Math.round(upper * 60);
    }
  }
  if (seconds <= 0) return;
  runTimer(seconds);
}

function runTimer(seconds) {
  if (state.restTimer) clearInterval(state.restTimer);
  const overlay = document.getElementById('rest-overlay');
  const label = document.getElementById('rest-label');
  const timeEl = document.getElementById('rest-time');
  overlay.hidden = false;
  label.textContent = 'Rest';
  let remaining = seconds;
  const tick = () => {
    timeEl.textContent = fmtClock(remaining);
    if (remaining <= 0) {
      clearInterval(state.restTimer);
      state.restTimer = null;
      label.textContent = 'Done';
      timeEl.textContent = '0:00';
      if (navigator.vibrate) navigator.vibrate([60, 80, 60]);
      setTimeout(() => { overlay.hidden = true; }, 1500);
      return;
    }
    remaining -= 1;
  };
  tick();
  state.restTimer = setInterval(tick, 1000);
}

document.getElementById('rest-skip').addEventListener('click', () => {
  if (state.restTimer) clearInterval(state.restTimer);
  state.restTimer = null;
  document.getElementById('rest-overlay').hidden = true;
});
document.getElementById('rest-add').addEventListener('click', () => {
  // Add 30 seconds — easiest via restart with current remaining + 30
  const cur = document.getElementById('rest-time').textContent;
  const [m, s] = cur.split(':').map(n => parseInt(n, 10));
  runTimer((m * 60 + s) + 30);
});

// ===================================================================
// Settings modal + global wiring
// ===================================================================
function wireGlobalUI() {
  // Paint icons into static buttons
  const settingsBtn = document.getElementById('settings-btn');
  settingsBtn.innerHTML = ''; settingsBtn.appendChild(makeIcon('cog'));
  const swapClose = document.getElementById('swap-close');
  swapClose.innerHTML = ''; swapClose.appendChild(makeIcon('close'));
  const settingsClose = document.getElementById('settings-close');
  settingsClose.innerHTML = ''; settingsClose.appendChild(makeIcon('close'));
  const demoClose = document.getElementById('demo-close');
  demoClose.innerHTML = ''; demoClose.appendChild(makeIcon('close'));
  const navPrev = document.getElementById('nav-prev');
  navPrev.innerHTML = ''; navPrev.appendChild(makeIcon('chevL'));
  const navNext = document.getElementById('nav-next');
  navNext.innerHTML = ''; navNext.appendChild(makeIcon('chevR'));
  const editClose = document.getElementById('edit-close');
  editClose.innerHTML = ''; editClose.appendChild(makeIcon('close'));

  // Editor wiring
  editClose.addEventListener('click', closeEditModal);
  document.getElementById('edit-save').addEventListener('click', saveEditor);
  document.getElementById('edit-reset').addEventListener('click', resetEditor);
  document.getElementById('edit-delete').addEventListener('click', deleteEditor);
  document.querySelectorAll('[data-edit-load] button').forEach(b => {
    b.addEventListener('click', () => setEditorLoadType(b.dataset.value));
  });
  // Submit on Enter inside form fields (except textarea).
  document.getElementById('edit-form').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      saveEditor();
    }
  });

  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('settings-close').addEventListener('click', closeSettings);
  document.getElementById('swap-close').addEventListener('click', closeSwapModal);
  document.getElementById('demo-close').addEventListener('click', closeDemoModal);
  // Bottom nav
  document.getElementById('nav-prev').addEventListener('click', () => {
    if (state.pos.day > 1) { state.pos.day--; renderAll(); }
  });
  document.getElementById('nav-next').addEventListener('click', () => {
    if (state.pos.day < 6) { state.pos.day++; renderAll(); }
  });
  document.getElementById('nav-status').addEventListener('click', () => {
    // Scroll to top so all day controls are visible.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('reset-data').addEventListener('click', () => {
    if (confirm('Wipe all logged sets, 1RMs, swaps and settings?')) {
      store.wipeAll();
      state.pos = { block: 1, week: 1, day: 1 };
      state.settings = Object.assign({}, DEFAULT_SETTINGS);
      renderAll();
      closeSettings();
    }
  });
  // segmented controls
  document.querySelectorAll('.seg').forEach(seg => {
    const setting = seg.dataset.setting;
    seg.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        state.settings[setting] = b.dataset.value;
        store.set('settings', state.settings);
        paintSettings();
        renderDay();
      });
    });
  });
  // Tap backdrop to close modals. The demo modal needs special close to kill
  // any playing YouTube iframe.
  document.querySelectorAll('.modal-backdrop').forEach(b => {
    b.addEventListener('click', e => {
      if (e.target !== b) return;
      if (b.id === 'demo-modal') closeDemoModal();
      else b.hidden = true;
    });
  });
}

function openSettings() {
  paintSettings();
  document.getElementById('settings-modal').hidden = false;
}
function closeSettings() {
  document.getElementById('settings-modal').hidden = true;
}
function paintSettings() {
  document.querySelectorAll('.seg').forEach(seg => {
    const setting = seg.dataset.setting;
    seg.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.dataset.value === state.settings[setting]);
    });
  });
}

// ===================================================================
// Utility helpers
// ===================================================================
function currentBlock() { return state.program.blocks.find(b => b.id === state.pos.block); }
function currentWeek()  { return currentBlock().weeks.find(w => w.id === state.pos.week); }
function currentDay()   { return currentWeek().days.find(d => d.id === state.pos.day); }

// Returns the merged exercise list for a given day: built-ins (with any user
// edits layered on top) followed by user-added custom exercises. Each entry
// carries:
//   _exKey   — storage key (numeric string for built-ins, "c{id}" for customs)
//   _isCustom — true if user-added
//   _hasEdit  — true if a built-in has user edits applied
function getEffectiveExercises(blockId, weekId, dayId) {
  const day = state.program.blocks[blockId - 1].weeks[weekId - 1].days[dayId - 1];
  const out = day.exercises.map((ex, i) => {
    const edit = store.get(editKey(blockId, weekId, dayId, i));
    const merged = edit ? { ...ex, ...edit } : { ...ex };
    merged._exKey = String(i);
    merged._isCustom = false;
    merged._hasEdit = !!edit;
    return merged;
  });
  const adds = store.get(addsKey(blockId, weekId, dayId), []);
  for (const c of adds) {
    out.push({ ...c, _exKey: c.id, _isCustom: true, _hasEdit: false });
  }
  return out;
}

function currentExercises() {
  return getEffectiveExercises(state.pos.block, state.pos.week, state.pos.day);
}

function formatLoad(load) {
  return load.type === 'percent1RM' ? `${load.value}% 1RM` : `RPE ${load.value}`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function stripNonNum(s) {
  const m = String(s).match(/^\d+/);
  return m ? m[0] : '';
}
function roundToIncrement(v, inc) {
  return Math.round(v / inc) * inc;
}
function fmtClock(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Inline SVG icons — keep them small & semantic (stroke-only, currentColor).
const ICONS = {
  check:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 12 10 17 19 7"></polyline></svg>',
  circle:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8"></circle></svg>',
  chevL:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 6 9 12 15 18"></polyline></svg>',
  chevR:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"></polyline></svg>',
  close:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>',
  cog:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  swap:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  timer:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><line x1="9" y1="2" x2="15" y2="2"/></svg>',
  plus:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  edit:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
};
function makeIcon(name) {
  const span = document.createElement('span');
  span.className = 'icon';
  span.innerHTML = ICONS[name] || '';
  span.setAttribute('aria-hidden', 'true');
  return span;
}
