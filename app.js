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
  dayStops: document.getElementById("dayStops"),
  dayPctMow: document.getElementById("dayPctMow"),
  dayPctDrive: document.getElementById("dayPctDrive"),

  weekStops: document.getElementById("weekStops"),
  weekTotalAll: document.getElementById("weekTotalAll"),
  weekTotalDrive: document.getElementById("weekTotalDrive"),
  weekTotalMow: document.getElementById("weekTotalMow"),
  weekTotalOther: document.getElementById("weekTotalOther"),
  weekTotalBreak: document.getElementById("weekTotalBreak"),
  weekTotalGas: document.getElementById("weekTotalGas"),
  weekTotalEquip: document.getElementById("weekTotalEquip"),
  weekPctMow: document.getElementById("weekPctMow"),
  weekPctDrive: document.getElementById("weekPctDrive"),
  refreshWeekBtn: document.getElementById("refreshWeekBtn"),

  startDayBtn: document.getElementById("startDayBtn"),
  pauseDayBtn: document.getElementById("pauseDayBtn"),
  endDayBtn: document.getElementById("endDayBtn"),
  driveBtn: document.getElementById("driveBtn"),
  mowBtn: document.getElementById("mowBtn"),
  otherBtn: document.getElementById("otherBtn"),
  breakBtn: document.getElementById("breakBtn"),
  gasBtn: document.getElementById("gasBtn"),
  equipBtn: document.getElementById("equipBtn"),
  undoBtn: document.getElementById("undoBtn"),
  resetBtn: document.getElementById("resetBtn"),
  exportBtn2: document.getElementById("exportBtn2"),
  shareBtn2: document.getElementById("shareBtn2"),
  rangeModal: document.getElementById("rangeModal"),
  rangeModalTitle: document.getElementById("rangeModalTitle"),
  rangeCancelBtn: document.getElementById("rangeCancelBtn"),
  rangeGoBtn: document.getElementById("rangeGoBtn"),
  shareBackupBtn: document.getElementById("shareBackupBtn"),
  backupBtn: document.getElementById("backupBtn"),
  restoreBtn: document.getElementById("restoreBtn"),
  restoreFile: document.getElementById("restoreFile"),

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
if (typeof s.isPaused !== "boolean") s.isPaused = false;
if (s.pausedAt == null) s.pausedAt = null;
if (s.pausedMode == null) s.pausedMode = null;
if (typeof s.stopCount !== "number") s.stopCount = 0;
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

    isPaused: false,
    pausedAt: null,
    pausedMode: null,

    activeMode: null,
    activeStartedAt: null,

    stopCount: 0,   // increments ONLY when user taps Mow

    segments: [],
    history: [],
  };
}

let state = loadState();
let tickTimer = null;
let lastExportBlob = null;
let lastExportFilename = null;

let lastBackupBlob = null;
let lastBackupFilename = null;

// Save a snapshot for Undo
function pushUndoSnapshot() {
  const snapshot = JSON.stringify({
  dayStartedAt: state.dayStartedAt,
  dayEndedAt: state.dayEndedAt,

  isPaused: state.isPaused,
  pausedAt: state.pausedAt,
  pausedMode: state.pausedMode,

  activeMode: state.activeMode,
  activeStartedAt: state.activeStartedAt,

  stopCount: state.stopCount,

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

  // If user explicitly taps Mow, count a stop
if (mode === "mow") {
  state.stopCount = (state.stopCount || 0) + 1;
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

  // Stops = number of times Mow was started
  // Count completed mow segments + current active mow segment (counts as started)
  const stops = state.stopCount || 0;

  const totalAll = totals.drive + totals.mow + totals.break + totals.gas + totals.equip + totals.other;
  return { totals, totalAll, stops };
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
  if (!btn) return; // prevents crashes if an element is missing/renamed
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
if (els.pauseDayBtn) {
  els.pauseDayBtn.textContent = state.isPaused ? "Resume Day" : "Pause Day";
}

  els.dayStatus.textContent = started
    ? ended
      ? "Day: Ended"
      : "Day: Running"
    : "Day: Not started";

  els.modeStatus.textContent = active ? `Mode: ${active.toUpperCase()}` : "Mode: —";

  const { totals, totalAll, stops } = computeTotals();
  els.totalAll.textContent = fmtTime(totalAll);
  els.totalDrive.textContent = fmtTime(totals.drive);
  els.totalMow.textContent = fmtTime(totals.mow);
  els.totalBreak.textContent = fmtTime(totals.break);
  els.totalGas.textContent = fmtTime(totals.gas);
  els.totalEquip.textContent = fmtTime(totals.equip);
  els.totalOther.textContent = fmtTime(totals.other);
  if (els.dayStops) els.dayStops.textContent = String(stops);
  if (els.dayPctMow) els.dayPctMow.textContent = msToPct(totals.mow, totalAll);
  if (els.dayPctDrive) els.dayPctDrive.textContent = msToPct(totals.drive, totalAll);

  if (!started) els.hintText.innerHTML = 'Tap <b>Start Day</b> to begin.';
  else if (ended) els.hintText.innerHTML = 'Day ended. You can <b>Export CSV</b> or <b>Reset today</b>.';
  else els.hintText.innerHTML = 'Tap a mode any time you switch.';

  // enable/disable buttons
  setButtonEnabled(els.startDayBtn, !started || ended);
  setButtonEnabled(els.endDayBtn, started && !ended);

  setButtonEnabled(els.driveBtn, started && !ended && !state.isPaused);
  setButtonEnabled(els.mowBtn, started && !ended && !state.isPaused);
  setButtonEnabled(els.otherBtn, started && !ended && !state.isPaused);
  setButtonEnabled(els.breakBtn, started && !ended && !state.isPaused);
  setButtonEnabled(els.gasBtn, started && !ended && !state.isPaused);
  setButtonEnabled(els.equipBtn, started && !ended && !state.isPaused);
  setButtonEnabled(els.pauseDayBtn, started && !ended);

  setButtonEnabled(els.undoBtn, state.history.length > 0);
  setButtonEnabled(els.exportBtn, started);
  setButtonEnabled(els.resetBtn, true);

  setButtonEnabled(els.exportBtn2, started);
  setButtonEnabled(els.shareBtn2, started);

  // highlight active mode button
  for (const m of MODES) {
    const b = els[`${m}Btn`];
    b.style.outline = active === m ? "2px solid rgba(255,255,255,0.55)" : "none";
  }

  renderLog();
  renderWeek(); 
}

function exportWeekCSV() {
  const weekStart = startOfWeekKey(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const dates = listStoredDatesInRange(weekStart, weekEnd);
  const csv = buildCsvForDates(dates);

  downloadCsv(csv, `mow-tracker-week-${ymdLocal(weekStart)}.csv`);
}

function exportMonthCSV() {
  const start = startOfMonth(new Date());
  const end = endOfMonth(new Date());

  const dates = listStoredDatesInRange(start, end);
  const csv = buildCsvForDates(dates);

  downloadCsv(csv, `mow-tracker-month-${ymdLocal(start).slice(0, 7)}.csv`);
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
  const totals = { drive: 0, mow: 0, break: 0, gas: 0, equip: 0, other: 0 };

  for (const seg of dayState.segments || []) {
    if (!seg || !seg.mode || seg.start == null || seg.end == null) continue;
    const dur = Math.max(0, seg.end - seg.start);
    if (totals[seg.mode] != null) totals[seg.mode] += dur;
  }

  // Stops = number of times Mow was started that day
  const stops = Number(dayState.stopCount || 0);

  const totalAll =
    totals.drive + totals.mow + totals.break + totals.gas + totals.equip + totals.other;

  return { totals, totalAll, stops };
}

function computeThisWeekTotals() {
  const weekStart = startOfWeekKey(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const sum = { drive: 0, mow: 0, break: 0, gas: 0, equip: 0, other: 0 };
  let sumStops = 0;

  for (const storageKey of allStoredDayKeys()) {
    const dateStr = parseDayKey(storageKey);
    if (!dateStr) continue;

    const d = new Date(dateStr + "T00:00:00");
    if (!(d >= weekStart && d < weekEnd)) continue;

    const dayState = loadDayStateByDate(dateStr);
    if (!dayState) continue;

    const { totals, stops } = computeTotalsForState(dayState);
      sumStops += stops;
      sum.drive += totals.drive;
      sum.mow += totals.mow;
      sum.break += totals.break;
      sum.gas += totals.gas;
      sum.equip += totals.equip;
      sum.other += totals.other;
  }

  const totalAll = sum.drive + sum.mow + sum.break + sum.gas + sum.equip + sum.other;
  return { sum, totalAll, sumStops };
}

function renderWeek() {
  if (!els.weekTotalAll) return; // weekly section not present

  // Always compute first, then use the values
  const { sum, totalAll, sumStops } = computeThisWeekTotals();

  els.weekTotalAll.textContent = fmtTime(totalAll);
  els.weekTotalDrive.textContent = fmtTime(sum.drive);
  els.weekTotalMow.textContent = fmtTime(sum.mow);

  // New weekly category totals
  if (els.weekTotalBreak) els.weekTotalBreak.textContent = fmtTime(sum.break);
  if (els.weekTotalGas) els.weekTotalGas.textContent = fmtTime(sum.gas);
  if (els.weekTotalEquip) els.weekTotalEquip.textContent = fmtTime(sum.equip);

  if (els.weekTotalOther) els.weekTotalOther.textContent = fmtTime(sum.other);

  // Weekly stops + percentages
  if (els.weekStops) els.weekStops.textContent = String(sumStops);
  if (els.weekPctMow) els.weekPctMow.textContent = msToPct(sum.mow, totalAll);
  if (els.weekPctDrive) els.weekPctDrive.textContent = msToPct(sum.drive, totalAll);
}

function ymdLocal(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date = new Date()) {
  const d = startOfMonth(date);
  d.setMonth(d.getMonth() + 1);
  return d; // exclusive end
}

function listStoredDatesInRange(startDate, endDateExclusive) {
  const keys = allStoredDayKeys(); // existing helper
  const dates = [];

  for (const k of keys) {
    const dateStr = parseDayKey(k); // existing helper
    if (!dateStr) continue;
    const d = new Date(dateStr + "T00:00:00");
    if (d >= startDate && d < endDateExclusive) dates.push(dateStr);
  }

  dates.sort(); // chronological
  return dates;
}

function buildCsvForDates(dateStrs) {
  // Header row
  const rows = [];
  rows.push([
    "date",
    "day_started_at",
    "day_ended_at",
    "stops",
    "total_seconds",
    "drive_seconds",
    "mow_seconds",
    "break_seconds",
    "gas_seconds",
    "equip_seconds",
    "other_seconds",
  ]);

  for (const dateStr of dateStrs) {
    const dayState = loadDayStateByDate(dateStr);
    if (!dayState) continue;

    const { totals, totalAll, stops } = computeTotalsForState(dayState);

    rows.push([
      dateStr,
      dayState.dayStartedAt ? new Date(dayState.dayStartedAt).toISOString() : "",
      dayState.dayEndedAt ? new Date(dayState.dayEndedAt).toISOString() : "",
      String(stops ?? 0),
      String(Math.floor(totalAll / 1000)),
      String(Math.floor(totals.drive / 1000)),
      String(Math.floor(totals.mow / 1000)),
      String(Math.floor(totals.break / 1000)),
      String(Math.floor(totals.gas / 1000)),
      String(Math.floor(totals.equip / 1000)),
      String(Math.floor(totals.other / 1000)),
    ]);
  }

  const csv = rows
    .map(r => r.map(v => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
    }).join(","))
    .join("\n");

  return csv;
}

function downloadCsv(csvText, filename) {
  const blob = new Blob([csvText], { type: "text/csv" });

  // store for sharing
  lastExportBlob = blob;
  lastExportFilename = filename;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function shareBlob(blob, filename, mimeType) {
  if (!blob) {
    alert("Nothing to share yet. Export or backup first.");
    return;
  }

  // Try Web Share with files (best on iPhone)
  try {
    const file = new File([blob], filename, { type: mimeType });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: filename,
        files: [file],
      });
      return;
    }
  } catch (e) {
    // fall through to fallback
  }

  // Fallback: trigger a download if sharing isn't available
  alert("Sharing isn't available here. Downloading instead.");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function shareLastExport() {
  shareBlob(lastExportBlob, lastExportFilename || "mow-tracker-export.csv", "text/csv");
}

function shareLastBackup() {
  shareBlob(lastBackupBlob, lastBackupFilename || "mow-tracker-backup.json", "application/json");
}

function requestRestoreBackup() {
  // open the hidden file picker
  if (els.restoreFile) {
    els.restoreFile.value = ""; // allow selecting same file twice
    els.restoreFile.click();
  }
}

function restoreBackupFromFile(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result || ""));

      if (!payload || payload.kind !== "mow-tracker-backup" || typeof payload.data !== "object") {
        alert("That file doesn't look like a Mow Tracker backup JSON.");
        return;
      }

      const entries = Object.entries(payload.data);
      if (entries.length === 0) {
        alert("Backup file contains no saved days.");
        return;
      }

      // Restore strategy: MERGE + OVERWRITE matching days (safe)
      // We do NOT clear everything; we only set keys included in the backup.
      for (const [k, v] of entries) {
        if (typeof k !== "string" || !k.startsWith("mowtracker:")) continue;
        if (typeof v !== "string") continue;
        localStorage.setItem(k, v);
      }

      // Reload today's state from storage and redraw
      state = loadState();
      render();
      renderWeek();

      alert(`Restore complete. Restored ${entries.length} day(s).`);
    } catch (e) {
      alert("Restore failed. The JSON file may be corrupted or not a valid backup.");
    }
  };

  reader.readAsText(file);
}

function pauseOrResumeDay() {
  if (!state.dayStartedAt || state.dayEndedAt) return;

  if (!state.isPaused) {
    // PAUSE
    pushUndoSnapshot();

    const t = nowMs();

    // close current segment if one is running
    if (state.activeMode && state.activeStartedAt) {
      state.segments.push({
        mode: state.activeMode,
        start: state.activeStartedAt,
        end: t,
      });
    }

    state.isPaused = true;
    state.pausedAt = t;
    state.pausedMode = state.activeMode; // remember what we were doing

    state.activeMode = null;
    state.activeStartedAt = null;

    saveState(state);
    render();
    return;
  }

  // RESUME
  pushUndoSnapshot();

  const t = nowMs();
  state.isPaused = false;
  state.pausedAt = null;

  // resume into the previous mode IF there was one
  if (state.pausedMode) {
    state.activeMode = state.pausedMode;
    state.activeStartedAt = t;
  }

  state.pausedMode = null;

  saveState(state);
  render();
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day); // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date = new Date()) {
  const d = startOfMonth(date);
  d.setMonth(d.getMonth() + 1);
  return d; // exclusive
}

function ymdLocal(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function listStoredDatesInRange(startDate, endDateExclusive) {
  const keys = allStoredDayKeys(); // existing helper
  const dates = [];

  for (const k of keys) {
    const dateStr = parseDayKey(k); // existing helper
    if (!dateStr) continue;
    const d = new Date(dateStr + "T00:00:00");
    if (d >= startDate && d < endDateExclusive) dates.push(dateStr);
  }

  dates.sort(); // chronological
  return dates;
}

function getRangeSpec(rangeKey) {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const labelDay = (d) => ymdLocal(d);

  const labelWeek = (start) => {
    const endInclusive = addDays(start, 6);
    return `week-${labelDay(start)}_to_${labelDay(endInclusive)}`;
  };

  const labelMonth = (start) => {
    const endExclusive = endOfMonth(start);
    const endInclusive = addDays(endExclusive, -1);
    return `month-${labelDay(start)}_to_${labelDay(endInclusive)}`;
  };

  if (rangeKey === "today") {
    const start = today;
    const end = addDays(start, 1);
    return { start, end, label: labelDay(start) };
  }

  if (rangeKey === "yesterday") {
    const start = addDays(today, -1);
    const end = addDays(start, 1);
    return { start, end, label: labelDay(start) };
  }

  if (rangeKey === "thisWeek") {
    const start = startOfWeek(now);
    const end = addDays(start, 7);
    return { start, end, label: labelWeek(start) };
  }

  if (rangeKey === "lastWeek") {
    const thisStart = startOfWeek(now);
    const start = addDays(thisStart, -7);
    const end = thisStart;
    return { start, end, label: labelWeek(start) };
  }

  if (rangeKey === "thisMonth") {
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return { start, end, label: labelMonth(start) };
  }

  if (rangeKey === "lastMonth") {
    const thisStart = startOfMonth(now);
    const lastMonthAnyDay = addDays(thisStart, -1); // last day of previous month
    const start = startOfMonth(lastMonthAnyDay);
    const end = endOfMonth(lastMonthAnyDay);
    return { start, end, label: labelMonth(start) };
  }

  // fallback
  const start = today;
  const end = addDays(start, 1);
  return { start, end, label: labelDay(start) };
}

async function shareTextAsFile({ text, filename, mimeType }) {
  try {
    const file = new File([text], filename, { type: mimeType });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: filename, files: [file] });
      return true;
    }
  } catch (e) {
    // fall through
  }
  return false;
}

function exportSelectedRangeCSV(rangeKey = "today") {
  const { start, end, label } = getRangeSpec(rangeKey);
  const dates = listStoredDatesInRange(start, end);
  const csv = buildCsvForDates(dates);
  downloadCsv(csv, `mow-tracker-${label}.csv`);
}

async function shareSelectedRangeCSV(rangeKey = "today") {
  const { start, end, label } = getRangeSpec(rangeKey);
  const dates = listStoredDatesInRange(start, end);
  const csv = buildCsvForDates(dates);
  const filename = `mow-tracker-${label}.csv`;

  const ok = await shareTextAsFile({ text: csv, filename, mimeType: "text/csv" });
  if (!ok) {
    downloadCsv(csv, filename);
    alert("Sharing isn't available here. Downloaded instead.");
  }
}

function buildBackupPayload() {
  const prefix = "mowtracker:";
  const all = {};

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(prefix)) continue;
    all[k] = localStorage.getItem(k);
  }

  return {
    kind: "mow-tracker-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: all,
  };
}

function exportBackupJSON() {
  const payload = buildBackupPayload();
  const json = JSON.stringify(payload, null, 2);

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `mow-tracker-backup-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function shareBackupJSON() {
  const payload = buildBackupPayload();
  const json = JSON.stringify(payload, null, 2);
  const filename = `mow-tracker-backup-${todayKey()}.json`;

  const ok = await shareTextAsFile({ text: json, filename, mimeType: "application/json" });
  if (!ok) {
    exportBackupJSON();
    alert("Sharing isn't available here. Downloaded instead.");
  }
}

let pendingRangeAction = null; // "export" | "share"

function openRangeModal(action) {
  pendingRangeAction = action;
  if (els.rangeModalTitle) els.rangeModalTitle.textContent = action === "share" ? "Share CSV" : "Export CSV";
  if (els.rangeModal) els.rangeModal.style.display = "flex";
}

function closeRangeModal() {
  pendingRangeAction = null;
  if (els.rangeModal) els.rangeModal.style.display = "none";
}

function getPickedRangeKey() {
  const picked = document.querySelector('input[name="rangePick"]:checked');
  return picked ? picked.value : "today";
}

function setup() {
  // Register service worker for offline use
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }

  els.startDayBtn.addEventListener("click", startDay);
  els.pauseDayBtn?.addEventListener("click", pauseOrResumeDay);
  els.endDayBtn.addEventListener("click", endDay);

  els.driveBtn.addEventListener("click", () => switchMode("drive"));
  els.mowBtn.addEventListener("click", () => switchMode("mow"));
  els.otherBtn.addEventListener("click", () => switchMode("other"));
  els.breakBtn.addEventListener("click", () => switchMode("break"));
  els.gasBtn.addEventListener("click", () => switchMode("gas"));
  els.equipBtn.addEventListener("click", () => switchMode("equip"));

  els.backupBtn?.addEventListener("click", exportBackupJSON);
  els.shareBackupBtn?.addEventListener("click", shareBackupJSON);
  els.undoBtn.addEventListener("click", undo);
  els.resetBtn.addEventListener("click", resetToday);
  if (els.exportBtn) els.exportBtn.addEventListener("click", exportCSV);
  els.backupBtn?.addEventListener("click", exportBackupJSON);
  els.restoreBtn?.addEventListener("click", requestRestoreBackup);
  els.restoreFile?.addEventListener("change", (e) => restoreBackupFromFile(e.target.files?.[0]));
  els.exportBtn2?.addEventListener("click", () => openRangeModal("export"));
  els.shareBtn2?.addEventListener("click", () => openRangeModal("share"));

  els.rangeCancelBtn?.addEventListener("click", closeRangeModal);

  // clicking outside the card closes it
  els.rangeModal?.addEventListener("click", (e) => {
    if (e.target === els.rangeModal) closeRangeModal();
  });

  els.rangeGoBtn?.addEventListener("click", async () => {
    const rangeKey = getPickedRangeKey();
    const action = pendingRangeAction;
    closeRangeModal();

    if (action === "share") {
      await shareSelectedRangeCSV(rangeKey);
    } else {
      exportSelectedRangeCSV(rangeKey);
    }
  });

  if (els.refreshWeekBtn) els.refreshWeekBtn.addEventListener("click", renderWeek);

  // Keep updating live timers while day is running
  clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    if (state.dayStartedAt && !state.dayEndedAt) render();
  }, 500);

  render();
  renderWeek(); 
}

setup();
