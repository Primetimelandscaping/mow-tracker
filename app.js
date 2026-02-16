// Mow Tracker — Offline daily timer (Drive/Mow/Other)
// Stores locally in localStorage (simple + reliable for one-day totals)

const MODES = ["drive", "mow", "break", "gas", "equip", "other"];

const els = {
  todayLabel: document.getElementById("todayLabel"),
  dayStatus: document.getElementById("dayStatus"),
  modeStatus: document.getElementById("modeStatus"),
  hintText: document.getElementById("hintText"),

  totalAll: document.getElementById("totalAll"),
  totalDrive: document.getElementById("totalDrive"),
  totalMow: document.getElementById("totalMow"),
  totalOther: document.getElementById("totalOther"),
  totalBreak: document.getElementById("totalBreak"),
  totalGas: document.getElementById("totalGas"),
  totalEquip: document.getElementById("totalEquip"),


  weekTotalAll: document.getElementById("weekTotalAll"),
  weekTotalDrive: document.getElementById("weekTotalDrive"),
  weekTotalMow: document.getElementById("weekTotalMow"),
  weekTotalOther: document.getElementById("weekTotalOther"),
  weekPctMow: document.getElementById("weekPctMow"),
  weekPctDrive: document.getElementById("weekPctDrive"),
  refreshWeekBtn: document.getElementById("refreshWeekBtn"),

  startDayBtn: document.getElementById("startDayBtn"),
  endDayBtn: document.getElementById("endDayBtn"),
  driveBtn: document.getElementById("driveBtn"),
  mowBtn: document.getElementById("mowBtn"),
  otherBtn: document.getElementById("otherBtn"),
  breakBtn: document.getElementById("breakBtn"),
  gasBtn: document.getElementById("gasBtn"),
  equipBtn: document.getElementById("equipBtn"),
  undoBtn: document.getElementById("undoBtn"),
  resetBtn: document.getElementById("resetBtn"),
  exportBtn: document.getElementById("exportBtn"),

  logList: document.getElementById("logList"),
};

const todayKey = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const STORAGE_KEY = () => `mowtracker:${todayKey()}`;

function nowMs() {
  return Date.now();
}

function fmtTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function fmtClock(t) {
  const d = new Date(t);
  const hh = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${mm} ${ampm}`;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY());
  if (!raw) return makeEmptyState();
  try {
    const s = JSON.parse(raw);
    // Basic shape guard
    if (!s || typeof s !== "object") return makeEmptyState();
    if (!Array.isArray(s.segments)) s.segments = [];
    return s;
  } catch {
    return makeEmptyState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY(), JSON.stringify(state));
}

function makeEmptyState() {
  return {
    dayStartedAt: null,
    dayEndedAt: null,
    activeMode: null,          // "drive" | "mow" | "other" | null
    activeStartedAt: null,     // timestamp
    segments: [],              // { mode, start, end }
    history: [],               // stack for undo: snapshots
  };
}

let state = loadState();
let tickTimer = null;

// Save a snapshot for Undo
function pushUndoSnapshot() {
  const snapshot = JSON.stringify({
    dayStartedAt: state.dayStartedAt,
    dayEndedAt: state.dayEndedAt,
    activeMode: state.activeMode,
    activeStartedAt: state.activeStartedAt,
    segments: state.segments,
  });
  state.history.push(snapshot);
  // keep last 30 actions
  if (state.history.length > 30) state.history.shift();
}

function undo() {
  const snap = state.history.pop();
  if (!snap) return;
  const restored = JSON.parse(snap);
  state.dayStartedAt = restored.dayStartedAt;
  state.dayEndedAt = restored.dayEndedAt;
  state.activeMode = restored.activeMode;
  state.activeStartedAt = restored.activeStartedAt;
  state.segments = restored.segments || [];
  saveState(state);
  render();
}

function startDay() {
  if (state.dayStartedAt && !state.dayEndedAt) return;

  pushUndoSnapshot();
  state.dayStartedAt = nowMs();
  state.dayEndedAt = null;
  state.activeMode = null;
  state.activeStartedAt = null;
  state.segments = [];
  saveState(state);
  render();
}

function endDay() {
  if (!state.dayStartedAt || state.dayEndedAt) return;

  pushUndoSnapshot();
  // close active segment if any
  if (state.activeMode && state.activeStartedAt) {
    state.segments.push({
      mode: state.activeMode,
      start: state.activeStartedAt,
      end: nowMs(),
    });
    state.activeMode = null;
    state.activeStartedAt = null;
  }

  state.dayEndedAt = nowMs();
  saveState(state);
  render();
}

function switchMode(mode) {
  if (!state.dayStartedAt || state.dayEndedAt) return;
  if (!MODES.includes(mode)) return;

  // If already in that mode, do nothing
  if (state.activeMode === mode) return;

  pushUndoSnapshot();

  const t = nowMs();

  // close prior segment
  if (state.activeMode && state.activeStartedAt) {
    state.segments.push({
      mode: state.activeMode,
      start: state.activeStartedAt,
      end: t,
    });
  }

  // open new segment
  state.activeMode = mode;
  state.activeStartedAt = t;

  saveState(state);
  render();
}

function resetToday() {
  if (!confirm("Reset today’s data? This cannot be undone.")) return;
  localStorage.removeItem(STORAGE_KEY());
  state = makeEmptyState();
  render();
}

function computeTotals() {
  const totals = { drive: 0, mow: 0, break: 0, gas: 0, equip: 0, other: 0 };

  for (const seg of state.segments) {
    const dur = (seg.end ?? seg.start) - seg.start;
    if (totals[seg.mode] != null) totals[seg.mode] += Math.max(0, dur);
  }

  // include live active segment
  if (state.activeMode && state.activeStartedAt && !state.dayEndedAt) {
    const liveDur = nowMs() - state.activeStartedAt;
    totals[state.activeMode] += Math.max(0, liveDur);
  }

  const totalAll = totals.drive + totals.mow + totals.other;
  return { totals, totalAll };
}

function renderLog() {
  els.logList.innerHTML = "";

  const items = [...state.segments];

  // show current active segment as "LIVE"
  if (state.activeMode && state.activeStartedAt && !state.dayEndedAt) {
    items.push({
      mode: state.activeMode,
      start: state.activeStartedAt,
      end: null,
      live: true,
    });
  }

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No segments yet.";
    els.logList.appendChild(empty);
    return;
  }

  for (let i = items.length - 1; i >= 0; i--) {
    const seg = items[i];
    const startStr = fmtClock(seg.start);
    const endStr = seg.end ? fmtClock(seg.end) : "LIVE";
    const dur = (seg.end ?? nowMs()) - seg.start;

    const row = document.createElement("div");
    row.className = "logItem";

    const left = document.createElement("div");
    left.className = "left";

    const mode = document.createElement("div");
    mode.className = "mode";
    mode.textContent = seg.mode.toUpperCase();

    const times = document.createElement("div");
    times.className = "times";
    times.textContent = `${startStr} → ${endStr}`;

    left.appendChild(mode);
    left.appendChild(times);

    const right = document.createElement("div");
    right.className = "dur";
    right.textContent = fmtTime(dur);

    row.appendChild(left);
    row.appendChild(right);

    els.logList.appendChild(row);
  }
}

function setButtonEnabled(btn, enabled) {
  btn.disabled = !enabled;
  btn.style.opacity = enabled ? "1" : "0.45";
}

function render() {
  // date label
  const d = new Date();
  els.todayLabel.textContent = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const started = !!state.dayStartedAt;
  const ended = !!state.dayEndedAt;
  const active = state.activeMode;

  els.dayStatus.textContent = started
    ? ended
      ? "Day: Ended"
      : "Day: Running"
    : "Day: Not started";

  els.modeStatus.textContent = active ? `Mode: ${active.toUpperCase()}` : "Mode: —";

  const { totals, totalAll } = computeTotals();
  els.totalAll.textContent = fmtTime(totalAll);
  els.totalDrive.textContent = fmtTime(totals.drive);
  els.totalMow.textContent = fmtTime(totals.mow);
  els.totalBreak.textContent = fmtTime(totals.break);
  els.totalGas.textContent = fmtTime(totals.gas);
  els.totalEquip.textContent = fmtTime(totals.equip);
  els.totalOther.textContent = fmtTime(totals.other);

  if (!started) els.hintText.innerHTML = 'Tap <b>Start Day</b> to begin.';
  else if (ended) els.hintText.innerHTML = 'Day ended. You can <b>Export CSV</b> or <b>Reset today</b>.';
  else els.hintText.innerHTML = 'Tap a mode any time you switch.';

  // enable/disable buttons
  setButtonEnabled(els.startDayBtn, !started || ended);
  setButtonEnabled(els.endDayBtn, started && !ended);

  setButtonEnabled(els.driveBtn, started && !ended);
  setButtonEnabled(els.mowBtn, started && !ended);
  setButtonEnabled(els.otherBtn, started && !ended);
  setButtonEnabled(els.breakBtn, started && !ended);
  setButtonEnabled(els.gasBtn, started && !ended);
  setButtonEnabled(els.equipBtn, started && !ended);

  setButtonEnabled(els.undoBtn, state.history.length > 0);
  setButtonEnabled(els.exportBtn, started);
  setButtonEnabled(els.resetBtn, true);

  // highlight active mode button
  for (const m of MODES) {
    const b = els[`${m}Btn`];
    b.style.outline = active === m ? "2px solid rgba(255,255,255,0.55)" : "none";
  }

  renderLog();
  renderWeek(); 
}

function exportCSV() {
  if (!state.dayStartedAt) return;

  // Build rows
  const rows = [];
  rows.push(["date", todayKey()]);
  rows.push(["day_started_at", new Date(state.dayStartedAt).toISOString()]);
  rows.push(["day_ended_at", state.dayEndedAt ? new Date(state.dayEndedAt).toISOString() : ""]);
  rows.push([]);
  rows.push(["mode", "start_local", "end_local", "duration_seconds"]);

  for (const seg of state.segments) {
    const durSec = Math.max(0, Math.floor((seg.end - seg.start) / 1000));
    rows.push([
      seg.mode,
      new Date(seg.start).toLocaleString(),
      new Date(seg.end).toLocaleString(),
      String(durSec),
    ]);
  }

  const { totals, totalAll } = computeTotals();
  rows.push([]);
  rows.push(["TOTALS"]);
  rows.push(["drive_seconds", String(Math.floor(totals.drive / 1000))]);
  rows.push(["mow_seconds", String(Math.floor(totals.mow / 1000))]);
  rows.push(["break_seconds", String(Math.floor(totals.break / 1000))]);
  rows.push(["gas_seconds", String(Math.floor(totals.gas / 1000))]);
  rows.push(["equip_seconds", String(Math.floor(totals.equip / 1000))]);
  rows.push(["other_seconds", String(Math.floor(totals.other / 1000))]);
  rows.push(["total_seconds", String(Math.floor(totalAll / 1000))]);

  const csv = rows
    .map(r => r.map(v => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
    }).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `mow-tracker-${todayKey()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function msToPct(part, whole) {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

function startOfWeekKey(date = new Date()) {
  // Monday-start week
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun,1=Mon...
  const diff = (day === 0 ? -6 : 1 - day); // move to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function allStoredDayKeys() {
  const prefix = "mowtracker:";
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) keys.push(k);
  }
  return keys;
}

function parseDayKey(storageKey) {
  // storageKey like "mowtracker:YYYY-MM-DD"
  const parts = storageKey.split(":");
  return parts[1] || null;
}

function loadDayStateByDate(dateStr) {
  const raw = localStorage.getItem(`mowtracker:${dateStr}`);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.segments)) return null;
    return s;
  } catch {
    return null;
  }
}

function computeTotalsForState(dayState) {
  const totals = { drive: 0, mow: 0, other: 0 };
  for (const seg of dayState.segments || []) {
    if (!seg || !seg.mode || seg.start == null || seg.end == null) continue;
    const dur = Math.max(0, seg.end - seg.start);
    if (totals[seg.mode] != null) totals[seg.mode] += dur;
  }
  const totalAll = totals.drive + totals.mow + totals.other;
  return { totals, totalAll };
}

function computeThisWeekTotals() {
  const weekStart = startOfWeekKey(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const sum = { drive: 0, mow: 0, other: 0 };

  for (const storageKey of allStoredDayKeys()) {
    const dateStr = parseDayKey(storageKey);
    if (!dateStr) continue;

    const d = new Date(dateStr + "T00:00:00");
    if (!(d >= weekStart && d < weekEnd)) continue;

    const dayState = loadDayStateByDate(dateStr);
    if (!dayState) continue;

    const { totals } = computeTotalsForState(dayState);
    sum.drive += totals.drive;
    sum.mow += totals.mow;
    sum.other += totals.other;
  }

  const totalAll = sum.drive + sum.mow + sum.other;
  return { sum, totalAll };
}

function renderWeek() {
  if (!els.weekTotalAll) return; // if section not present

  const { sum, totalAll } = computeThisWeekTotals();

  els.weekTotalAll.textContent = fmtTime(totalAll);
  els.weekTotalDrive.textContent = fmtTime(sum.drive);
  els.weekTotalMow.textContent = fmtTime(sum.mow);
  els.weekTotalOther.textContent = fmtTime(sum.other);

  els.weekPctMow.textContent = msToPct(sum.mow, totalAll);
  els.weekPctDrive.textContent = msToPct(sum.drive, totalAll);
}

function setup() {
  // Register service worker for offline use
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }

  els.startDayBtn.addEventListener("click", startDay);
  els.endDayBtn.addEventListener("click", endDay);

  els.driveBtn.addEventListener("click", () => switchMode("drive"));
  els.mowBtn.addEventListener("click", () => switchMode("mow"));
  els.otherBtn.addEventListener("click", () => switchMode("other"));
  els.breakBtn.addEventListener("click", () => switchMode("break"));
  els.gasBtn.addEventListener("click", () => switchMode("gas"));
  els.equipBtn.addEventListener("click", () => switchMode("equip"));

  els.undoBtn.addEventListener("click", undo);
  els.resetBtn.addEventListener("click", resetToday);
  els.exportBtn.addEventListener("click", exportCSV);

  els.refreshWeekBtn.addEventListener("click", renderWeek);

  // Keep updating live timers while day is running
  clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    if (state.dayStartedAt && !state.dayEndedAt) render();
  }, 500);

  render();
  renderWeek(); 
}

setup();
