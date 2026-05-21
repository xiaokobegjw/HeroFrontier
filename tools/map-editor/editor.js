const $ = (id) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
};

const canvas = $("canvas");
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Canvas 2D context not available");

const bgFile = $("bgFile");
const bgUrl = $("bgUrl");
const loadUrlBtn = $("loadUrlBtn");
const bgCcPath = $("bgCcPath");
const loadCcPathBtn = $("loadCcPathBtn");
const bgOpacity = $("bgOpacity");
const bgOpacityText = $("bgOpacityText");
const embedBg = $("embedBg");
const cellSizeInput = $("cellSize");
const rebuildGridBtn = $("rebuildGridBtn");
const showGrid = $("showGrid");
const toolSelect = $("tool");
const undoBtn = $("undoBtn");
const redoBtn = $("redoBtn");
const saveBtn = $("saveBtn");
const loadJsonFile = $("loadJson");
const jsonText = $("jsonText");
const loadFromTextBtn = $("loadFromTextBtn");
const clearBtn = $("clearBtn");
const statusEl = $("status");
const pathSelect = $("pathSelect");
const addPathBtn = $("addPathBtn");
const renamePathBtn = $("renamePathBtn");
const deletePathBtn = $("deletePathBtn");
const clearPathBtn = $("clearPathBtn");
const clearWaypointsBtn = $("clearWaypointsBtn");
const reverseWaypointsBtn = $("reverseWaypointsBtn");
const waypointList = $("waypointList");
const waveSelect = $("waveSelect");
const addWaveBtn = $("addWaveBtn");
const renameWaveBtn = $("renameWaveBtn");
const deleteWaveBtn = $("deleteWaveBtn");
const waveStartAt = $("waveStartAt");
const waveTotalCount = $("waveTotalCount");
const waveSpawnDuration = $("waveSpawnDuration");
const addGroupBtn = $("addGroupBtn");
const groupList = $("groupList");
const clearTowersBtn = $("clearTowersBtn");
const towerList = $("towerList");
const clearObstaclesBtn = $("clearObstaclesBtn");
const obstacleList = $("obstacleList");

const Tool = {
  PathStart: "path_start",
  PathEnd: "path_end",
  WaypointAdd: "waypoint_add",
  WaypointRemove: "waypoint_remove",
  Hero: "hero",
  Base: "base",
  TowerAdd: "tower_add",
  TowerRemove: "tower_remove",
  ObstacleAdd: "obstacle_add",
  ObstacleRemove: "obstacle_remove",
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function distSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function tryParseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function nowIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function normalizeCcResourcesPath(input) {
  let s = String(input || "").trim();
  if (!s) return "";
  s = s.replace(/^db:\/\/assets\/resources\//i, "");
  s = s.replace(/^\/?assets\/resources\//i, "");
  s = s.replace(/^\/+/g, "");
  s = s.replace(/\.(png|jpg|jpeg|webp)$/i, "");
  return s;
}

function loadImageUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

class UndoRedo {
  constructor() {
    this.undo = [];
    this.redo = [];
  }
  push(op) {
    this.undo.push(op);
    this.redo.length = 0;
  }
  canUndo() {
    return this.undo.length > 0;
  }
  canRedo() {
    return this.redo.length > 0;
  }
  popUndo() {
    const op = this.undo.pop() || null;
    if (op) this.redo.push(op);
    return op;
  }
  popRedo() {
    const op = this.redo.pop() || null;
    if (op) this.undo.push(op);
    return op;
  }
  clear() {
    this.undo.length = 0;
    this.redo.length = 0;
  }
}

class MapState {
  constructor() {
    this.version = 4;
    this.background = { type: "none", src: "" };
    this.backgroundOpacity = 1;
    this.cellSize = 40;
    this.gridW = 0;
    this.gridH = 0;
    this.hero = null;
    this.base = null;
    this.towerSlots = [];
    this.obstacles = [];
    this.paths = [{ id: "A", start: null, end: null, waypoints: [] }];
    this.waves = [{ id: "W1", delay: 0, groups: [] }];
  }

  resizeGrid(w, h, cellSize) {
    this.cellSize = cellSize;
    this.gridW = Math.max(0, w | 0);
    this.gridH = Math.max(0, h | 0);
  }

  inBounds(gx, gy) {
    return gx >= 0 && gy >= 0 && gx < this.gridW && gy < this.gridH;
  }

  clear() {
    this.background = { type: "none", src: "" };
    this.backgroundOpacity = 1;
    this.gridW = 0;
    this.gridH = 0;
    this.hero = null;
    this.base = null;
    this.towerSlots = [];
    this.obstacles = [];
    this.paths = [{ id: "A", start: null, end: null, waypoints: [] }];
    this.waves = [{ id: "W1", delay: 0, groups: [] }];
  }

  getPathById(id) {
    return this.paths.find((p) => p.id === id) || null;
  }

  ensurePath(id) {
    const existing = this.getPathById(id);
    if (existing) return existing;
    const path = { id, start: null, end: null, waypoints: [] };
    this.paths.push(path);
    return path;
  }

  ensureAtLeastOnePath() {
    if (!Array.isArray(this.paths) || this.paths.length === 0) {
      this.paths = [{ id: "A", start: null, end: null, waypoints: [] }];
    }
  }

  toJsonObject(embedBackground) {
    const backgroundOut =
      this.background.type === "ccres"
        ? { type: "ccres", path: String(this.background.path || "") }
        : embedBackground && this.background.type === "dataURL"
          ? { type: "dataURL", src: this.background.src }
          : this.background.type === "url"
            ? { type: "url", src: this.background.src }
            : { type: "none", src: "" };

    const toPoint = (p) =>
      p
        ? {
            gx: p.gx,
            gy: p.gy,
            px: typeof p.px === "number" ? p.px : (p.gx + 0.5) * this.cellSize,
            py: typeof p.py === "number" ? p.py : (p.gy + 0.5) * this.cellSize,
          }
        : null;

    return {
      version: this.version,
      background: backgroundOut,
      backgroundOpacity: this.backgroundOpacity,
      cellSize: this.cellSize,
      gridW: this.gridW,
      gridH: this.gridH,
      hero: toPoint(this.hero),
      base: toPoint(this.base),
      towerSlots: (this.towerSlots || []).map(toPoint),
      obstacles: (this.obstacles || []).map(toPoint),
      paths: (this.paths || []).map((path) => ({
        id: String(path.id || ""),
        start: toPoint(path.start),
        end: toPoint(path.end),
        waypoints: (path.waypoints || []).map(toPoint),
      })),
      waves: (this.waves || []).map((w) => ({
        id: String(w.id || ""),
        delay: typeof w.delay === "number" && Number.isFinite(w.delay) ? w.delay : 0,
        groups: (w.groups || []).map((g) => ({
          enemyId: String(g.enemyId || ""),
          count: typeof g.count === "number" && Number.isFinite(g.count) ? g.count : 1,
          interval: typeof g.interval === "number" && Number.isFinite(g.interval) ? g.interval : 1,
          pathId: String(g.pathId || ""),
          spawnOffset: typeof g.spawnOffset === "number" && Number.isFinite(g.spawnOffset) ? g.spawnOffset : 0,
        })),
      })),
    };
  }

  loadFromJsonObject(obj) {
    const cellSize = typeof obj.cellSize === "number" ? Math.max(4, Math.floor(obj.cellSize)) : 40;
    const w = typeof obj.gridW === "number" ? Math.max(0, Math.floor(obj.gridW)) : 0;
    const h = typeof obj.gridH === "number" ? Math.max(0, Math.floor(obj.gridH)) : 0;
    this.resizeGrid(w, h, cellSize);
    const version = typeof obj.version === "number" && Number.isFinite(obj.version) ? Math.floor(obj.version) : 1;
    const legacyTopLeft = version < 4;

    const bg = obj.background;
    if (bg && typeof bg.type === "string") {
      if ((bg.type === "dataURL" || bg.type === "url") && typeof bg.src === "string") {
        this.background = { type: bg.type, src: bg.src };
      } else if (bg.type === "ccres" && typeof bg.path === "string") {
        this.background = { type: "ccres", path: normalizeCcResourcesPath(bg.path) };
      } else {
        this.background = { type: "none", src: "" };
      }
    } else this.background = { type: "none", src: "" };
    const opacityRaw = typeof obj.backgroundOpacity === "number" ? obj.backgroundOpacity : 1;
    this.backgroundOpacity = clamp(opacityRaw, 0, 1);

    const readPoint = (p) => {
      if (!p || typeof p.gx !== "number" || typeof p.gy !== "number") return null;
      const gx = Math.floor(p.gx);
      const gyRaw = Math.floor(p.gy);
      const gy = legacyTopLeft ? this.gridH - 1 - gyRaw : gyRaw;
      if (!this.inBounds(gx, gy)) return null;
      const px = typeof p.px === "number" && Number.isFinite(p.px) ? p.px : null;
      const pyRaw = typeof p.py === "number" && Number.isFinite(p.py) ? p.py : null;
      const py = pyRaw === null ? null : legacyTopLeft ? this.gridH * this.cellSize - pyRaw : pyRaw;
      return { gx, gy, ...(px === null ? {} : { px }), ...(py === null ? {} : { py }) };
    };

    this.hero = readPoint(obj.hero);
    this.base = readPoint(obj.base);
    this.towerSlots = Array.isArray(obj.towerSlots)
      ? Array.from(
          new Map(
            obj.towerSlots
              .map(readPoint)
              .filter(Boolean)
              .map((p) => [`${typeof p.px === "number" ? Math.round(p.px) : p.gx},${typeof p.py === "number" ? Math.round(p.py) : p.gy}`, p])
          ).values()
        )
      : [];
    this.obstacles = Array.isArray(obj.obstacles)
      ? Array.from(new Map(obj.obstacles.map(readPoint).filter(Boolean).map((p) => [`${p.gx},${p.gy}`, p])).values())
      : [];

    const waveSpawnDuration = (groups) => {
      if (!Array.isArray(groups) || groups.length === 0) return 0;
      let end = 0;
      for (const g of groups) {
        if (!g) continue;
        const spawnOffset = typeof g.spawnOffset === "number" && Number.isFinite(g.spawnOffset) ? Math.max(0, g.spawnOffset) : 0;
        const count = typeof g.count === "number" && Number.isFinite(g.count) ? Math.max(1, Math.floor(g.count)) : 1;
        const interval = typeof g.interval === "number" && Number.isFinite(g.interval) ? Math.max(0.01, g.interval) : 1;
        const dur = spawnOffset + Math.max(0, count - 1) * interval;
        if (dur > end) end = dur;
      }
      return end;
    };

    const wavesIn = Array.isArray(obj.waves) ? obj.waves : null;
    if (wavesIn) {
      const next = [];
      const used = new Set();
      for (const raw of wavesIn) {
        if (!raw || typeof raw !== "object") continue;
        let id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : "W1";
        if (used.has(id)) {
          let suffix = 2;
          while (used.has(`${id}_${suffix}`)) suffix++;
          id = `${id}_${suffix}`;
        }
        used.add(id);

        const delayRaw = typeof raw.delay === "number" && Number.isFinite(raw.delay) ? Math.max(0, raw.delay) : null;
        const startAtLegacy = typeof raw.startAt === "number" && Number.isFinite(raw.startAt) ? Math.max(0, raw.startAt) : null;
        const groups = Array.isArray(raw.groups)
          ? raw.groups
              .map((g) => {
                if (!g || typeof g !== "object") return null;
                const enemyId = typeof g.enemyId === "string" ? g.enemyId : "";
                const count = typeof g.count === "number" && Number.isFinite(g.count) ? Math.max(1, Math.floor(g.count)) : 1;
                const interval = typeof g.interval === "number" && Number.isFinite(g.interval) ? Math.max(0.01, g.interval) : 1;
                const pathId = typeof g.pathId === "string" ? g.pathId : "";
                const spawnOffset = typeof g.spawnOffset === "number" && Number.isFinite(g.spawnOffset) ? Math.max(0, g.spawnOffset) : 0;
                return { enemyId, count, interval, pathId, spawnOffset };
              })
              .filter(Boolean)
          : [];
        next.push({ id, delay: delayRaw, startAtLegacy, groups });
      }

      let prevAbsStart = 0;
      for (let i = 0; i < next.length; i++) {
        const wv = next[i];
        const prev = i > 0 ? next[i - 1] : null;
        const prevDur = prev ? waveSpawnDuration(prev.groups) : 0;

        if (typeof wv.delay !== "number") {
          const legacy = typeof wv.startAtLegacy === "number" ? wv.startAtLegacy : 0;
          if (i === 0) {
            wv.delay = legacy;
            prevAbsStart = legacy;
          } else {
            wv.delay = Math.max(0, legacy - (prevAbsStart + prevDur));
            prevAbsStart = legacy;
          }
        } else {
          if (i === 0) prevAbsStart = wv.delay;
          else prevAbsStart = prevAbsStart + prevDur + wv.delay;
        }
      }

      this.waves =
        next.length > 0
          ? next.map((wv) => ({ id: wv.id, delay: typeof wv.delay === "number" && Number.isFinite(wv.delay) ? wv.delay : 0, groups: wv.groups }))
          : [{ id: "W1", delay: 0, groups: [] }];
    } else {
      this.waves = [{ id: "W1", delay: 0, groups: [] }];
    }

    const pathsIn = Array.isArray(obj.paths) ? obj.paths : null;
    if (pathsIn) {
      const next = [];
      const used = new Set();
      for (const raw of pathsIn) {
        if (!raw || typeof raw !== "object") continue;
        let id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : "A";
        if (used.has(id)) {
          let suffix = 2;
          while (used.has(`${id}_${suffix}`)) suffix++;
          id = `${id}_${suffix}`;
        }
        used.add(id);
        next.push({
          id,
          start: readPoint(raw.start),
          end: readPoint(raw.end),
          waypoints: Array.isArray(raw.waypoints) ? raw.waypoints.map(readPoint).filter(Boolean) : [],
        });
      }
      this.paths = next;
      this.ensureAtLeastOnePath();
      return;
    }

    const legacyStart =
      obj.pathStart ? readPoint(obj.pathStart) : Array.isArray(obj.enemySpawns) && obj.enemySpawns.length > 0 ? readPoint(obj.enemySpawns[0]) : null;
    const legacyEnd = obj.pathEnd ? readPoint(obj.pathEnd) : readPoint(obj.base);
    const legacyWaypoints = Array.isArray(obj.waypoints) ? obj.waypoints.map(readPoint).filter(Boolean) : [];

    const legacySpawns = Array.isArray(obj.enemySpawns) ? obj.enemySpawns.map(readPoint).filter(Boolean) : [];
    if (legacySpawns.length > 1) {
      const ids = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      this.paths = legacySpawns.map((sp, i) => ({
        id: ids[i] || `P${i + 1}`,
        start: sp,
        end: legacyEnd,
        waypoints: [],
      }));
      this.ensureAtLeastOnePath();
      return;
    }

    this.paths = [{ id: "A", start: legacyStart, end: legacyEnd, waypoints: legacyWaypoints }];
    this.ensureAtLeastOnePath();
  }
}

class Viewport {
  constructor() {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
  }

  reset() {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
  }

  toWorld(screenX, screenY) {
    const rect = canvas.getBoundingClientRect();
    const dpr = rect.width > 0 ? canvas.width / rect.width : 1;
    const sx = (screenX - rect.left) * dpr;
    const sy = (screenY - rect.top) * dpr;
    const x = (sx - canvas.width / 2 - this.panX) / this.scale;
    const y = (sy - canvas.height / 2 - this.panY) / this.scale;
    return { x, y };
  }

  apply(ctx2) {
    const w = canvas.width;
    const h = canvas.height;
    ctx2.setTransform(1, 0, 0, 1, 0, 0);
    ctx2.translate(w / 2 + this.panX, h / 2 + this.panY);
    ctx2.scale(this.scale, this.scale);
  }
}

class Editor {
  constructor() {
    this.state = new MapState();
    this.undo = new UndoRedo();
    this.viewport = new Viewport();

    this.bgImage = null;
    this.bgW = 0;
    this.bgH = 0;

    this.isPointerDown = false;
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.panStartPan = { x: 0, y: 0 };

    this.tool = Tool.WaypointAdd;
    this.hoverCell = null;
    this.activePathId = "A";
    this.activeWaveId = "W1";
    this.activeGroupIndex = -1;
    this.highlightPathId = null;
    this.waveErrors = [];

    this.offscreen = document.createElement("canvas");
    this.offctx = this.offscreen.getContext("2d");
    if (!this.offctx) throw new Error("Offscreen 2D context not available");
    this.offDirty = true;

    this.fitOnNextFrame = false;
    this.paintLastKey = "";
  }

  setStatus(lines) {
    statusEl.textContent = lines.join("\n");
  }

  updateUiState() {
    undoBtn.disabled = !this.undo.canUndo();
    redoBtn.disabled = !this.undo.canRedo();
    bgOpacityText.textContent = String(Math.round(this.state.backgroundOpacity * 100));
    this.syncPathSelect();
    this.renderWaypointList();
    this.renderTowerList();
    this.renderObstacleList();
    this.syncWaveSelect();
    this.renderWaveEditor();
  }

  async loadBackgroundFromDataUrl(dataUrl) {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    this.bgImage = img;
    this.bgW = img.naturalWidth;
    this.bgH = img.naturalHeight;
    this.state.background = { type: "dataURL", src: dataUrl };
    this.rebuildGridFromBackground();
    this.offDirty = true;
  }

  async loadBackgroundFromUrl(url) {
    const img = new Image();
    img.src = url;
    await img.decode();
    this.bgImage = img;
    this.bgW = img.naturalWidth;
    this.bgH = img.naturalHeight;
    this.state.background = { type: "url", src: url };
    this.rebuildGridFromBackground();
    this.offDirty = true;
  }

  async loadBackgroundFromCcResPath(path) {
    const p = normalizeCcResourcesPath(path);
    if (!p) {
      this.setStatus(["Cocos resources 路径为空"]);
      return;
    }

    const base = `/assets/resources/${p}`;
    const candidates = [`${base}.png`, `${base}.jpg`, `${base}.jpeg`, `${base}.webp`];
    let img = null;
    for (const url of candidates) {
      try {
        img = await loadImageUrl(url);
        break;
      } catch {}
    }
    if (!img) {
      this.setStatus([`找不到图片：${base}.{png,jpg,jpeg,webp}`]);
      this.bgImage = null;
      this.bgW = 0;
      this.bgH = 0;
      this.state.background = { type: "ccres", path: p };
      this.offDirty = true;
      this.updateJsonText();
      this.updateUiState();
      return;
    }

    this.bgImage = img;
    this.bgW = img.naturalWidth;
    this.bgH = img.naturalHeight;
    this.state.background = { type: "ccres", path: p };
    this.rebuildGridFromBackground();
    this.offDirty = true;
  }

  rebuildGridFromBackground() {
    const cellSize = Math.max(4, Math.floor(Number(cellSizeInput.value) || 40));
    const w = this.bgW > 0 ? Math.max(1, Math.floor(this.bgW / cellSize)) : 0;
    const h = this.bgH > 0 ? Math.max(1, Math.floor(this.bgH / cellSize)) : 0;
    this.state.resizeGrid(w, h, cellSize);
    this.undo.clear();
    this.offDirty = true;
    this.fitOnNextFrame = true;
    this.updateJsonText();
    this.updateUiState();
  }

  clearAll() {
    this.state.clear();
    this.bgImage = null;
    this.bgW = 0;
    this.bgH = 0;
    this.undo.clear();
    this.viewport.reset();
    this.offDirty = true;
    this.activePathId = "A";
    this.activeWaveId = "W1";
    this.activeGroupIndex = -1;
    this.highlightPathId = null;
    this.waveErrors = [];
    this.updateJsonText();
    this.updateUiState();
  }

  updateJsonText() {
    const obj = this.state.toJsonObject(Boolean(embedBg.checked));
    jsonText.value = JSON.stringify(obj, null, 2);
  }

  loadFromJsonText(text) {
    const parsed = tryParseJson(text);
    if (!parsed.ok) {
      this.setStatus(["JSON 解析失败", String(parsed.error)]);
      return;
    }
    this.loadFromJsonObject(parsed.value);
  }

  async loadFromJsonObject(obj) {
    this.state.loadFromJsonObject(obj);
    cellSizeInput.value = String(this.state.cellSize);
    bgOpacity.value = String(Math.round(clamp(this.state.backgroundOpacity, 0, 1) * 100));
    this.undo.clear();
    this.offDirty = true;
    this.fitOnNextFrame = true;

    const bg = this.state.background;
    if (bg.type === "dataURL" && bg.src) {
      await this.loadBackgroundFromDataUrl(bg.src);
    } else if (bg.type === "url" && bg.src) {
      await this.loadBackgroundFromUrl(bg.src);
    } else if (bg.type === "ccres" && bg.path) {
      bgCcPath.value = bg.path;
      await this.loadBackgroundFromCcResPath(bg.path);
    } else {
      this.bgImage = null;
      this.bgW = 0;
      this.bgH = 0;
    }

    this.updateJsonText();
    this.updateUiState();
    this.setStatus(["已加载地图"]);
  }

  canvasToGrid(worldX, worldY) {
    const ox = -this.bgW / 2;
    const oy = -this.bgH / 2;
    const x = worldX - ox;
    const y = worldY - oy;
    const gx = Math.floor(x / this.state.cellSize);
    const gyTop = Math.floor(y / this.state.cellSize);
    const gy = this.state.gridH - 1 - gyTop;
    if (!this.state.inBounds(gx, gy)) return null;
    return { gx, gy };
  }

  worldToLevelPxPy(worldX, worldY) {
    const ox = -this.bgW / 2;
    const oy = -this.bgH / 2;
    const localX = worldX - ox;
    const localY = worldY - oy;
    const px = clamp(localX, 0, this.bgW);
    const py = clamp(this.bgH - localY, 0, this.bgH);
    return { px, py };
  }

  levelPxPyToWorld(px, py) {
    const ox = -this.bgW / 2;
    const oy = -this.bgH / 2;
    const localX = px;
    const localY = this.bgH - py;
    return { x: ox + localX, y: oy + localY };
  }

  gridToWorldCenter(gx, gy) {
    const ox = -this.bgW / 2;
    const oy = -this.bgH / 2;
    const x = ox + (gx + 0.5) * this.state.cellSize;
    const y = oy + (this.state.gridH - gy - 0.5) * this.state.cellSize;
    return { x, y };
  }

  pointToString(p) {
    if (!p) return "-";
    if (typeof p.px === "number" && typeof p.py === "number") return `${p.gx},${p.gy} (${Math.round(p.px)},${Math.round(p.py)})`;
    return `${p.gx},${p.gy}`;
  }

  clonePoint(p) {
    if (!p) return null;
    const out = { gx: p.gx, gy: p.gy };
    if (typeof p.px === "number") out.px = p.px;
    if (typeof p.py === "number") out.py = p.py;
    return out;
  }

  clonePath(p) {
    return {
      id: String(p.id || ""),
      start: this.clonePoint(p.start),
      end: this.clonePoint(p.end),
      waypoints: (p.waypoints || []).map((w) => this.clonePoint(w)).filter(Boolean),
    };
  }

  cloneWave(w) {
    return {
      id: String(w.id || ""),
      delay: typeof w.delay === "number" && Number.isFinite(w.delay) ? w.delay : 0,
      groups: (w.groups || []).map((g) => ({
        enemyId: String(g.enemyId || ""),
        count: typeof g.count === "number" && Number.isFinite(g.count) ? g.count : 1,
        interval: typeof g.interval === "number" && Number.isFinite(g.interval) ? g.interval : 1,
        pathId: String(g.pathId || ""),
        spawnOffset: typeof g.spawnOffset === "number" && Number.isFinite(g.spawnOffset) ? g.spawnOffset : 0,
      })),
    };
  }

  findPathIndex(id) {
    return (this.state.paths || []).findIndex((p) => p.id === id);
  }

  ensureActivePath() {
    this.state.ensureAtLeastOnePath();
    if (this.findPathIndex(this.activePathId) >= 0) return;
    this.activePathId = this.state.paths[0].id;
  }

  getActivePath() {
    this.ensureActivePath();
    return this.state.getPathById(this.activePathId);
  }

  syncPathSelect() {
    this.state.ensureAtLeastOnePath();
    const cur = this.activePathId;
    pathSelect.textContent = "";
    for (const p of this.state.paths) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.id;
      pathSelect.appendChild(opt);
    }
    const next = this.findPathIndex(cur) >= 0 ? cur : this.state.paths[0].id;
    this.activePathId = next;
    pathSelect.value = next;
  }

  ensureAtLeastOneWave() {
    if (!Array.isArray(this.state.waves) || this.state.waves.length === 0) {
      this.state.waves = [{ id: "W1", delay: 0, groups: [] }];
    }
  }

  findWaveIndex(id) {
    return (this.state.waves || []).findIndex((w) => w.id === id);
  }

  getWaveById(id) {
    return (this.state.waves || []).find((w) => w.id === id) || null;
  }

  ensureActiveWave() {
    this.ensureAtLeastOneWave();
    if (this.findWaveIndex(this.activeWaveId) >= 0) return;
    this.activeWaveId = this.state.waves[0].id;
  }

  syncWaveSelect() {
    this.ensureAtLeastOneWave();
    const cur = this.activeWaveId;
    waveSelect.textContent = "";
    for (const w of this.state.waves) {
      const opt = document.createElement("option");
      opt.value = w.id;
      opt.textContent = w.id;
      waveSelect.appendChild(opt);
    }
    const next = this.findWaveIndex(cur) >= 0 ? cur : this.state.waves[0].id;
    this.activeWaveId = next;
    waveSelect.value = next;
  }

  renderWaveEditor() {
    this.ensureActiveWave();
    const wave = this.getWaveById(this.activeWaveId);
    if (!wave) return;
    waveStartAt.value = String(wave.delay ?? 0);

    let totalCount = 0;
    let spawnEnd = 0;
    for (const g of wave.groups || []) {
      if (!g) continue;
      const count = typeof g.count === "number" && Number.isFinite(g.count) ? Math.max(1, Math.floor(g.count)) : 1;
      const interval = typeof g.interval === "number" && Number.isFinite(g.interval) ? Math.max(0.01, g.interval) : 1;
      const offset = typeof g.spawnOffset === "number" && Number.isFinite(g.spawnOffset) ? Math.max(0, g.spawnOffset) : 0;
      totalCount += count;
      const end = offset + Math.max(0, count - 1) * interval;
      if (end > spawnEnd) spawnEnd = end;
    }
    waveTotalCount.textContent = String(totalCount);
    const s = Math.round(spawnEnd * 100) / 100;
    waveSpawnDuration.textContent = `${s}s`;

    const paths = new Set((this.state.paths || []).map((p) => p.id));
    const errs = [];
    for (let i = 0; i < (wave.groups || []).length; i++) {
      const g = wave.groups[i];
      if (!g.enemyId) errs.push(`Wave ${wave.id} 组${i + 1}: enemyId 为空`);
      if (!paths.has(g.pathId)) errs.push(`Wave ${wave.id} 组${i + 1}: pathId 不存在 (${g.pathId || "-"})`);
      if (!(typeof g.count === "number" && g.count > 0)) errs.push(`Wave ${wave.id} 组${i + 1}: count 非法`);
      if (!(typeof g.interval === "number" && g.interval > 0)) errs.push(`Wave ${wave.id} 组${i + 1}: interval 非法`);
    }

    groupList.textContent = "";
    const header = document.createElement("div");
    header.className = "groupRow";
    header.innerHTML =
      `<div class="groupNum">#</div><div>EnemyID</div><div>count</div><div>interval</div><div>path</div><div>offset</div><div class="groupBtns"></div>`;
    groupList.appendChild(header);

    const setGroupField = (idx, key, value) => {
      const w = this.getWaveById(this.activeWaveId);
      if (!w) return;
      const g = w.groups[idx];
      if (!g) return;
      const before = g[key];
      if (before === value) return;
      g[key] = value;
      this.undo.push({ type: "group_field", waveId: this.activeWaveId, index: idx, key, before, after: value });
      this.highlightPathId = key === "pathId" ? value : this.highlightPathId;
      this.offDirty = true;
      this.updateJsonText();
      this.updateUiState();
    };

    const moveGroup = (from, to) => {
      const w = this.getWaveById(this.activeWaveId);
      if (!w) return;
      if (from < 0 || from >= w.groups.length) return;
      if (to < 0 || to >= w.groups.length) return;
      const g = w.groups.splice(from, 1)[0];
      w.groups.splice(to, 0, g);
      this.undo.push({ type: "group_move", waveId: this.activeWaveId, from, to });
      this.activeGroupIndex = to;
      this.highlightPathId = g.pathId || null;
      this.offDirty = true;
      this.updateJsonText();
      this.updateUiState();
    };

    const removeGroup = (idx) => {
      const w = this.getWaveById(this.activeWaveId);
      if (!w) return;
      const g = w.groups[idx];
      if (!g) return;
      w.groups.splice(idx, 1);
      this.undo.push({ type: "group_remove", waveId: this.activeWaveId, index: idx, group: { ...g } });
      if (this.activeGroupIndex === idx) this.activeGroupIndex = -1;
      this.offDirty = true;
      this.updateJsonText();
      this.updateUiState();
    };

    for (let i = 0; i < (wave.groups || []).length; i++) {
      const g = wave.groups[i];
      const row = document.createElement("div");
      row.className = "groupRow" + (i === this.activeGroupIndex ? " active" : "");
      row.addEventListener("click", (ev) => {
        if (ev.target && (ev.target.tagName === "INPUT" || ev.target.tagName === "SELECT" || ev.target.tagName === "BUTTON")) return;
        this.activeGroupIndex = i;
        this.highlightPathId = g.pathId || null;
        this.updateUiState();
      });

      const num = document.createElement("div");
      num.className = "groupNum";
      num.textContent = String(i + 1);
      row.appendChild(num);

      const enemy = document.createElement("input");
      enemy.type = "text";
      enemy.value = g.enemyId || "";
      enemy.placeholder = "Enemy1";
      enemy.addEventListener("change", () => setGroupField(i, "enemyId", enemy.value.trim()));
      row.appendChild(enemy);

      const count = document.createElement("input");
      count.type = "number";
      count.min = "1";
      count.step = "1";
      count.value = String(g.count ?? 1);
      count.addEventListener("change", () => setGroupField(i, "count", Math.max(1, Math.floor(Number(count.value) || 1))));
      row.appendChild(count);

      const interval = document.createElement("input");
      interval.type = "number";
      interval.min = "0.01";
      interval.step = "0.05";
      interval.value = String(g.interval ?? 1);
      interval.addEventListener("change", () => setGroupField(i, "interval", Math.max(0.01, Number(interval.value) || 1)));
      row.appendChild(interval);

      const pathId = document.createElement("select");
      for (const p of this.state.paths || []) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.id;
        pathId.appendChild(opt);
      }
      if (g.pathId && paths.has(g.pathId)) pathId.value = g.pathId;
      else pathId.value = (this.state.paths && this.state.paths[0] ? this.state.paths[0].id : "");
      pathId.addEventListener("change", () => setGroupField(i, "pathId", pathId.value));
      row.appendChild(pathId);

      const offset = document.createElement("input");
      offset.type = "number";
      offset.min = "0";
      offset.step = "0.1";
      offset.value = String(g.spawnOffset ?? 0);
      offset.addEventListener("change", () => setGroupField(i, "spawnOffset", Math.max(0, Number(offset.value) || 0)));
      row.appendChild(offset);

      const btns = document.createElement("div");
      btns.className = "groupBtns";
      const up = document.createElement("button");
      up.type = "button";
      up.className = "small";
      up.textContent = "↑";
      up.disabled = i === 0;
      up.addEventListener("click", (e) => {
        e.stopPropagation();
        moveGroup(i, i - 1);
      });
      const down = document.createElement("button");
      down.type = "button";
      down.className = "small";
      down.textContent = "↓";
      down.disabled = i === wave.groups.length - 1;
      down.addEventListener("click", (e) => {
        e.stopPropagation();
        moveGroup(i, i + 1);
      });
      const del = document.createElement("button");
      del.type = "button";
      del.className = "small danger";
      del.textContent = "删";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        removeGroup(i);
      });
      btns.appendChild(up);
      btns.appendChild(down);
      btns.appendChild(del);
      row.appendChild(btns);

      groupList.appendChild(row);
    }

    this.waveErrors = errs;
  }

  centerOnCell(gx, gy) {
    const w = this.gridToWorldCenter(gx, gy);
    this.viewport.panX = -w.x * this.viewport.scale;
    this.viewport.panY = -w.y * this.viewport.scale;
  }

  renderWaypointList() {
    const path = this.getActivePath();
    waypointList.textContent = "";

    const addRow = (label, pt, opts) => {
      const row = document.createElement("div");
      row.className = "waypointRow";
      const info = document.createElement("div");
      info.className = "waypointInfo";

      const idxEl = document.createElement("div");
      idxEl.className = "waypointIndex";
      idxEl.textContent = label;
      info.appendChild(idxEl);

      const coord = document.createElement("div");
      coord.className = "waypointCoord";
      coord.textContent = this.pointToString(pt);
      info.appendChild(coord);

      row.appendChild(info);

      const actions = document.createElement("div");
      actions.className = "waypointActions";

      const jumpBtn = document.createElement("button");
      jumpBtn.type = "button";
      jumpBtn.className = "small";
      jumpBtn.textContent = "跳";
      jumpBtn.disabled = !pt;
      jumpBtn.addEventListener("click", () => {
        if (!pt) return;
        this.centerOnCell(pt.gx, pt.gy);
      });
      actions.appendChild(jumpBtn);

      if (opts && opts.onClear) {
        const clearBtnEl = document.createElement("button");
        clearBtnEl.type = "button";
        clearBtnEl.className = "small danger";
        clearBtnEl.textContent = "清";
        clearBtnEl.disabled = !pt;
        clearBtnEl.addEventListener("click", () => {
          opts.onClear();
        });
        actions.appendChild(clearBtnEl);
      }

      if (opts && opts.onRemove) {
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "small danger";
        delBtn.textContent = "删";
        delBtn.disabled = !pt;
        delBtn.addEventListener("click", () => {
          opts.onRemove();
        });
        actions.appendChild(delBtn);
      }

      row.appendChild(actions);
      waypointList.appendChild(row);
    };

    addRow("S", path.start, {
      onClear: () => this.setPathPoint(this.activePathId, "start", null),
    });

    for (let i = 0; i < path.waypoints.length; i++) {
      const pt = path.waypoints[i];
      addRow(String(i + 1), pt, {
        onRemove: () => this.removeWaypointAt(this.activePathId, i),
      });
    }

    addRow("E", path.end, {
      onClear: () => this.setPathPoint(this.activePathId, "end", null),
    });
  }

  renderTowerList() {
    const towers = Array.isArray(this.state.towerSlots) ? this.state.towerSlots : [];
    towerList.textContent = "";

    const addRow = (label, pt, opts) => {
      const row = document.createElement("div");
      row.className = "waypointRow";
      const info = document.createElement("div");
      info.className = "waypointInfo";

      const idxEl = document.createElement("div");
      idxEl.className = "waypointIndex";
      idxEl.textContent = label;
      info.appendChild(idxEl);

      const coord = document.createElement("div");
      coord.className = "waypointCoord";
      coord.textContent = this.pointToString(pt);
      info.appendChild(coord);

      row.appendChild(info);

      const actions = document.createElement("div");
      actions.className = "waypointActions";

      const jumpBtn = document.createElement("button");
      jumpBtn.type = "button";
      jumpBtn.className = "small";
      jumpBtn.textContent = "跳";
      jumpBtn.disabled = !pt;
      jumpBtn.addEventListener("click", () => {
        if (!pt) return;
        this.centerOnCell(pt.gx, pt.gy);
      });
      actions.appendChild(jumpBtn);

      if (opts && opts.onRemove) {
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "small danger";
        delBtn.textContent = "删";
        delBtn.disabled = !pt;
        delBtn.addEventListener("click", () => {
          opts.onRemove();
        });
        actions.appendChild(delBtn);
      }

      row.appendChild(actions);
      towerList.appendChild(row);
    };

    for (let i = 0; i < towers.length; i++) {
      const pt = towers[i];
      addRow(`T${i + 1}`, pt, { onRemove: () => this.removeTowerSlotAt(i) });
    }
  }

  renderObstacleList() {
    const obstacles = Array.isArray(this.state.obstacles) ? this.state.obstacles : [];
    obstacleList.textContent = "";

    const addRow = (label, pt, opts) => {
      const row = document.createElement("div");
      row.className = "waypointRow";
      const info = document.createElement("div");
      info.className = "waypointInfo";

      const idxEl = document.createElement("div");
      idxEl.className = "waypointIndex";
      idxEl.textContent = label;
      info.appendChild(idxEl);

      const coord = document.createElement("div");
      coord.className = "waypointCoord";
      coord.textContent = this.pointToString(pt);
      info.appendChild(coord);

      row.appendChild(info);

      const actions = document.createElement("div");
      actions.className = "waypointActions";

      const jumpBtn = document.createElement("button");
      jumpBtn.type = "button";
      jumpBtn.className = "small";
      jumpBtn.textContent = "跳";
      jumpBtn.disabled = !pt;
      jumpBtn.addEventListener("click", () => {
        if (!pt) return;
        this.centerOnCell(pt.gx, pt.gy);
      });
      actions.appendChild(jumpBtn);

      if (opts && opts.onRemove) {
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "small danger";
        delBtn.textContent = "删";
        delBtn.disabled = !pt;
        delBtn.addEventListener("click", () => {
          opts.onRemove();
        });
        actions.appendChild(delBtn);
      }

      row.appendChild(actions);
      obstacleList.appendChild(row);
    };

    for (let i = 0; i < obstacles.length; i++) {
      const pt = obstacles[i];
      addRow(`X${i + 1}`, pt, { onRemove: () => this.removeObstacleAt(i) });
    }
  }

  setPathPoint(pathId, key, pt) {
    const path = this.state.getPathById(pathId);
    if (!path) return;
    const before = this.clonePoint(path[key]);
    const after = this.clonePoint(pt);
    const same = before && after && before.gx === after.gx && before.gy === after.gy;
    if (same || (!before && !after)) return;
    path[key] = after;
    this.undo.push({ type: "set_point", pathId, key, before, after });
    this.offDirty = true;
    this.updateJsonText();
    this.updateUiState();
  }

  addWaypoint(pathId, gx, gy) {
    const path = this.state.getPathById(pathId);
    if (!path) return;
    const point = { gx, gy };
    const index = path.waypoints.length;
    path.waypoints.push(point);
    this.undo.push({ type: "waypoint_add", pathId, index, point });
    this.offDirty = true;
    this.updateJsonText();
    this.updateUiState();
  }

  removeWaypointAt(pathId, index) {
    const path = this.state.getPathById(pathId);
    if (!path) return;
    if (index < 0 || index >= path.waypoints.length) return;
    const point = path.waypoints[index];
    path.waypoints.splice(index, 1);
    this.undo.push({ type: "waypoint_remove", pathId, index, point });
    this.offDirty = true;
    this.updateJsonText();
    this.updateUiState();
  }

  removeWaypointNear(pathId, gx, gy) {
    const path = this.state.getPathById(pathId);
    if (!path) return;
    if (path.waypoints.length === 0) return;
    let bestIdx = -1;
    let bestD = Infinity;
    for (let i = 0; i < path.waypoints.length; i++) {
      const p = path.waypoints[i];
      const d = distSq(p.gx, p.gy, gx, gy);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) return;
    if (bestD > 4) return;
    this.removeWaypointAt(pathId, bestIdx);
  }

  addTowerSlot(pt) {
    const towers = this.state.towerSlots || (this.state.towerSlots = []);
    const cs = this.state.cellSize;
    const px = typeof pt.px === "number" ? pt.px : (pt.gx + 0.5) * cs;
    const py = typeof pt.py === "number" ? pt.py : (pt.gy + 0.5) * cs;

    for (const t of towers) {
      const tpx = typeof t.px === "number" ? t.px : (t.gx + 0.5) * cs;
      const tpy = typeof t.py === "number" ? t.py : (t.gy + 0.5) * cs;
      if (distSq(px, py, tpx, tpy) <= 12 * 12) return;
    }

    const point = { gx: pt.gx, gy: pt.gy, px, py };
    const index = towers.length;
    towers.push(point);
    this.undo.push({ type: "tower_add", index, point });
    this.offDirty = true;
    this.updateJsonText();
    this.updateUiState();
  }

  removeTowerSlotAt(index) {
    const towers = this.state.towerSlots || (this.state.towerSlots = []);
    if (index < 0 || index >= towers.length) return;
    const point = towers[index];
    towers.splice(index, 1);
    this.undo.push({ type: "tower_remove", index, point });
    this.offDirty = true;
    this.updateJsonText();
    this.updateUiState();
  }

  removeTowerSlotNearPxPy(px, py) {
    const towers = this.state.towerSlots || (this.state.towerSlots = []);
    if (towers.length === 0) return;
    let bestIdx = -1;
    let bestD = Infinity;
    const cs = this.state.cellSize;
    for (let i = 0; i < towers.length; i++) {
      const p = towers[i];
      const ppx = typeof p.px === "number" ? p.px : (p.gx + 0.5) * cs;
      const ppy = typeof p.py === "number" ? p.py : (p.gy + 0.5) * cs;
      const d = distSq(ppx, ppy, px, py);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) return;
    if (bestD > 16 * 16) return;
    this.removeTowerSlotAt(bestIdx);
  }

  setTowerSlots(nextTowers) {
    const before = (this.state.towerSlots || []).map((p) => this.clonePoint(p)).filter(Boolean);
    const after = (nextTowers || []).map((p) => this.clonePoint(p)).filter(Boolean);
    this.state.towerSlots = after;
    this.undo.push({ type: "set_towerSlots", before, after });
    this.offDirty = true;
    this.updateJsonText();
    this.updateUiState();
  }

  addObstacle(gx, gy) {
    const obstacles = this.state.obstacles || (this.state.obstacles = []);
    const key = `${gx},${gy}`;
    for (const t of obstacles) {
      if (`${t.gx},${t.gy}` === key) return;
    }
    const point = { gx, gy };
    const index = obstacles.length;
    obstacles.push(point);
    this.undo.push({ type: "obstacle_add", index, point });
    this.offDirty = true;
    this.updateJsonText();
    this.updateUiState();
  }

  removeObstacleAt(index) {
    const obstacles = this.state.obstacles || (this.state.obstacles = []);
    if (index < 0 || index >= obstacles.length) return;
    const point = obstacles[index];
    obstacles.splice(index, 1);
    this.undo.push({ type: "obstacle_remove", index, point });
    this.offDirty = true;
    this.updateJsonText();
    this.updateUiState();
  }

  removeObstacleNear(gx, gy) {
    const obstacles = this.state.obstacles || (this.state.obstacles = []);
    if (obstacles.length === 0) return;
    let bestIdx = -1;
    let bestD = Infinity;
    for (let i = 0; i < obstacles.length; i++) {
      const p = obstacles[i];
      const d = distSq(p.gx, p.gy, gx, gy);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) return;
    if (bestD > 4) return;
    this.removeObstacleAt(bestIdx);
  }

  setObstacles(nextObstacles) {
    const before = (this.state.obstacles || []).map((p) => ({ gx: p.gx, gy: p.gy }));
    const after = (nextObstacles || []).map((p) => ({ gx: p.gx, gy: p.gy }));
    this.state.obstacles = after;
    this.undo.push({ type: "set_obstacles", before, after });
    this.offDirty = true;
    this.updateJsonText();
    this.updateUiState();
  }

  setWaypoints(pathId, nextWaypoints) {
    const path = this.state.getPathById(pathId);
    if (!path) return;
    const before = path.waypoints.map((p) => ({ gx: p.gx, gy: p.gy }));
    const after = nextWaypoints.map((p) => ({ gx: p.gx, gy: p.gy }));
    path.waypoints = after;
    this.undo.push({ type: "set_waypoints", pathId, before, after });
    this.offDirty = true;
    this.updateJsonText();
    this.updateUiState();
  }

  setPath(pathId, nextPath) {
    const path = this.state.getPathById(pathId);
    if (!path) return;
    const before = this.clonePath(path);
    const after = this.clonePath(nextPath);
    path.start = this.clonePoint(after.start);
    path.end = this.clonePoint(after.end);
    path.waypoints = (after.waypoints || []).map((p) => ({ gx: p.gx, gy: p.gy }));
    this.undo.push({ type: "set_path", pathId, before, after });
    this.offDirty = true;
    this.updateJsonText();
    this.updateUiState();
  }

  applyUndo(op, dir) {
    if (!op) return;
    if (op.type === "set_marker") {
      const next = dir === "undo" ? this.clonePoint(op.before) : this.clonePoint(op.after);
      this.state[op.key] = next;
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "wave_delay") {
      const w = this.getWaveById(op.waveId);
      if (!w) return;
      w.delay = dir === "undo" ? op.before : op.after;
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "wave_add") {
      if (dir === "undo") {
        this.state.waves = (this.state.waves || []).filter((w) => w.id !== op.wave.id);
      } else {
        const exists = this.getWaveById(op.wave.id);
        if (!exists) (this.state.waves || (this.state.waves = [])).push(this.cloneWave(op.wave));
      }
      this.ensureAtLeastOneWave();
      if (this.findWaveIndex(this.activeWaveId) < 0) this.activeWaveId = this.state.waves[0].id;
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "wave_delete") {
      if (dir === "undo") {
        const idx = clamp(op.index, 0, this.state.waves.length);
        this.state.waves.splice(idx, 0, this.cloneWave(op.wave));
      } else {
        this.state.waves = (this.state.waves || []).filter((w) => w.id !== op.wave.id);
      }
      this.ensureAtLeastOneWave();
      if (this.findWaveIndex(this.activeWaveId) < 0) this.activeWaveId = this.state.waves[0].id;
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "wave_rename") {
      const w = this.getWaveById(dir === "undo" ? op.afterId : op.beforeId);
      if (!w) return;
      const nextId = dir === "undo" ? op.beforeId : op.afterId;
      w.id = nextId;
      if (this.activeWaveId === (dir === "undo" ? op.afterId : op.beforeId)) this.activeWaveId = nextId;
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "group_add") {
      const w = this.getWaveById(op.waveId);
      if (!w) return;
      if (dir === "undo") {
        w.groups.splice(op.index, 1);
      } else {
        w.groups.splice(op.index, 0, { ...op.group });
      }
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "group_remove") {
      const w = this.getWaveById(op.waveId);
      if (!w) return;
      if (dir === "undo") {
        w.groups.splice(op.index, 0, { ...op.group });
      } else {
        w.groups.splice(op.index, 1);
      }
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "group_move") {
      const w = this.getWaveById(op.waveId);
      if (!w) return;
      const from = dir === "undo" ? op.to : op.from;
      const to = dir === "undo" ? op.from : op.to;
      const g = w.groups.splice(from, 1)[0];
      w.groups.splice(to, 0, g);
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "group_field") {
      const w = this.getWaveById(op.waveId);
      if (!w) return;
      const g = w.groups[op.index];
      if (!g) return;
      g[op.key] = dir === "undo" ? op.before : op.after;
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "set_point") {
      const path = this.state.getPathById(op.pathId);
      if (!path) return;
      path[op.key] = dir === "undo" ? this.clonePoint(op.before) : this.clonePoint(op.after);
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "waypoint_add") {
      const path = this.state.getPathById(op.pathId);
      if (!path) return;
      if (dir === "undo") {
        path.waypoints.splice(op.index, 1);
      } else {
        path.waypoints.splice(op.index, 0, { gx: op.point.gx, gy: op.point.gy });
      }
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "waypoint_remove") {
      const path = this.state.getPathById(op.pathId);
      if (!path) return;
      if (dir === "undo") {
        path.waypoints.splice(op.index, 0, { gx: op.point.gx, gy: op.point.gy });
      } else {
        path.waypoints.splice(op.index, 1);
      }
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "tower_add") {
      const towers = this.state.towerSlots || (this.state.towerSlots = []);
      if (dir === "undo") {
        towers.splice(op.index, 1);
      } else {
        towers.splice(op.index, 0, this.clonePoint(op.point));
      }
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "tower_remove") {
      const towers = this.state.towerSlots || (this.state.towerSlots = []);
      if (dir === "undo") {
        towers.splice(op.index, 0, this.clonePoint(op.point));
      } else {
        towers.splice(op.index, 1);
      }
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "set_towerSlots") {
      this.state.towerSlots = (dir === "undo" ? op.before : op.after).map((p) => this.clonePoint(p)).filter(Boolean);
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "obstacle_add") {
      const obstacles = this.state.obstacles || (this.state.obstacles = []);
      if (dir === "undo") {
        obstacles.splice(op.index, 1);
      } else {
        obstacles.splice(op.index, 0, { gx: op.point.gx, gy: op.point.gy });
      }
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "obstacle_remove") {
      const obstacles = this.state.obstacles || (this.state.obstacles = []);
      if (dir === "undo") {
        obstacles.splice(op.index, 0, { gx: op.point.gx, gy: op.point.gy });
      } else {
        obstacles.splice(op.index, 1);
      }
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "set_obstacles") {
      this.state.obstacles = (dir === "undo" ? op.before : op.after).map((p) => ({ gx: p.gx, gy: p.gy }));
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "set_waypoints") {
      const path = this.state.getPathById(op.pathId);
      if (!path) return;
      path.waypoints = (dir === "undo" ? op.before : op.after).map((p) => ({ gx: p.gx, gy: p.gy }));
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "set_path") {
      const path = this.state.getPathById(op.pathId);
      if (!path) return;
      const v = dir === "undo" ? op.before : op.after;
      path.start = this.clonePoint(v.start);
      path.end = this.clonePoint(v.end);
      path.waypoints = (v.waypoints || []).map((p) => ({ gx: p.gx, gy: p.gy }));
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "path_add") {
      if (dir === "undo") {
        this.state.paths = this.state.paths.filter((p) => p.id !== op.path.id);
      } else {
        const exists = this.state.getPathById(op.path.id);
        if (!exists) this.state.paths.push(this.clonePath(op.path));
      }
      this.state.ensureAtLeastOnePath();
      if (this.findPathIndex(this.activePathId) < 0) this.activePathId = this.state.paths[0].id;
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "path_delete") {
      if (dir === "undo") {
        const idx = clamp(op.index, 0, this.state.paths.length);
        this.state.paths.splice(idx, 0, this.clonePath(op.path));
      } else {
        this.state.paths = this.state.paths.filter((p) => p.id !== op.path.id);
      }
      this.state.ensureAtLeastOnePath();
      if (this.findPathIndex(this.activePathId) < 0) this.activePathId = this.state.paths[0].id;
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "path_rename") {
      const path = this.state.getPathById(dir === "undo" ? op.afterId : op.beforeId);
      if (!path) return;
      const nextId = dir === "undo" ? op.beforeId : op.afterId;
      path.id = nextId;
      if (this.activePathId === (dir === "undo" ? op.afterId : op.beforeId)) this.activePathId = nextId;
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
  }

  handlePointerDown(ev) {
    if (ev.button !== 0) return;
    this.isPointerDown = true;
    this.paintLastKey = "";

    if (this.isPanning || ev.getModifierState("Space")) {
      this.isPanning = true;
      this.panStart = { x: ev.clientX, y: ev.clientY };
      this.panStartPan = { x: this.viewport.panX, y: this.viewport.panY };
      return;
    }

    const p = this.viewport.toWorld(ev.clientX, ev.clientY);
    const cell = this.canvasToGrid(p.x, p.y);
    this.hoverCell = cell;

    if (!cell) return;
    if (this.tool === Tool.Hero || this.tool === Tool.Base) {
      const key = this.tool === Tool.Hero ? "hero" : "base";
      const before = this.clonePoint(this.state[key]);
      const after = { gx: cell.gx, gy: cell.gy };
      const same = before && before.gx === after.gx && before.gy === after.gy;
      if (!same) {
        this.state[key] = after;
        this.undo.push({ type: "set_marker", key, before, after });
        this.offDirty = true;
        this.updateJsonText();
        this.updateUiState();
      }
      return;
    }
    if (this.tool === Tool.TowerAdd) {
      const snap = ev.getModifierState("Shift");
      const pxpy = snap ? { px: (cell.gx + 0.5) * this.state.cellSize, py: (cell.gy + 0.5) * this.state.cellSize } : this.worldToLevelPxPy(p.x, p.y);
      this.addTowerSlot({ gx: cell.gx, gy: cell.gy, px: pxpy.px, py: pxpy.py });
      return;
    }
    if (this.tool === Tool.TowerRemove) {
      const pxpy = this.worldToLevelPxPy(p.x, p.y);
      this.removeTowerSlotNearPxPy(pxpy.px, pxpy.py);
      return;
    }
    if (this.tool === Tool.ObstacleAdd) {
      const key = `${cell.gx},${cell.gy}`;
      if (this.paintLastKey !== key) {
        this.paintLastKey = key;
        this.addObstacle(cell.gx, cell.gy);
      }
      return;
    }
    if (this.tool === Tool.ObstacleRemove) {
      const key = `${cell.gx},${cell.gy}`;
      if (this.paintLastKey !== key) {
        this.paintLastKey = key;
        this.removeObstacleNear(cell.gx, cell.gy);
      }
      return;
    }
    this.ensureActivePath();
    if (this.tool === Tool.PathStart) this.setPathPoint(this.activePathId, "start", { gx: cell.gx, gy: cell.gy });
    if (this.tool === Tool.PathEnd) this.setPathPoint(this.activePathId, "end", { gx: cell.gx, gy: cell.gy });
    if (this.tool === Tool.WaypointAdd) this.addWaypoint(this.activePathId, cell.gx, cell.gy);
    if (this.tool === Tool.WaypointRemove) this.removeWaypointNear(this.activePathId, cell.gx, cell.gy);
  }

  handlePointerMove(ev) {
    const p = this.viewport.toWorld(ev.clientX, ev.clientY);
    const cell = this.canvasToGrid(p.x, p.y);
    this.hoverCell = cell;

    if (this.isPanning) {
      const rect = canvas.getBoundingClientRect();
      const dpr = rect.width > 0 ? canvas.width / rect.width : 1;
      const dx = (ev.clientX - this.panStart.x) * dpr;
      const dy = (ev.clientY - this.panStart.y) * dpr;
      this.viewport.panX = this.panStartPan.x + dx;
      this.viewport.panY = this.panStartPan.y + dy;
      return;
    }

    if (!this.isPointerDown) return;
    if (!cell) return;
    if (this.tool === Tool.ObstacleAdd) {
      const key = `${cell.gx},${cell.gy}`;
      if (this.paintLastKey !== key) {
        this.paintLastKey = key;
        this.addObstacle(cell.gx, cell.gy);
      }
      return;
    }
    if (this.tool === Tool.ObstacleRemove) {
      const key = `${cell.gx},${cell.gy}`;
      if (this.paintLastKey !== key) {
        this.paintLastKey = key;
        this.removeObstacleNear(cell.gx, cell.gy);
      }
      return;
    }
  }

  handlePointerUp(ev) {
    if (ev.button !== 0) return;
    this.isPointerDown = false;
    if (this.isPanning) {
      this.isPanning = false;
      return;
    }
    this.paintLastKey = "";
  }

  handleWheel(ev) {
    ev.preventDefault();
    const delta = -ev.deltaY;
    const zoomFactor = delta > 0 ? 1.1 : 0.9;
    const before = this.viewport.toWorld(ev.clientX, ev.clientY);
    this.viewport.scale = clamp(this.viewport.scale * zoomFactor, 0.1, 8);
    const after = this.viewport.toWorld(ev.clientX, ev.clientY);
    this.viewport.panX += (after.x - before.x) * this.viewport.scale;
    this.viewport.panY += (after.y - before.y) * this.viewport.scale;
  }

  fitToScreen() {
    if (!this.bgImage || this.bgW <= 0 || this.bgH <= 0) return;
    const w = canvas.width;
    const h = canvas.height;
    const scaleX = (w * 0.9) / this.bgW;
    const scaleY = (h * 0.9) / this.bgH;
    this.viewport.scale = clamp(Math.min(scaleX, scaleY), 0.1, 8);
    this.viewport.panX = 0;
    this.viewport.panY = 0;
  }

  rebuildOffscreenIfNeeded() {
    if (!this.offDirty) return;
    this.offDirty = false;
    const w = Math.max(1, this.bgW | 0);
    const h = Math.max(1, this.bgH | 0);
    this.offscreen.width = w;
    this.offscreen.height = h;
    this.offctx.setTransform(1, 0, 0, 1, 0, 0);
    this.offctx.clearRect(0, 0, w, h);

    const cs = this.state.cellSize;
    if (showGrid.checked && this.state.gridW > 0 && this.state.gridH > 0) {
      this.offctx.strokeStyle = "rgba(255,255,255,0.12)";
      this.offctx.lineWidth = 1;
      this.offctx.beginPath();
      for (let gx = 0; gx <= this.state.gridW; gx++) {
        const x = gx * cs + 0.5;
        this.offctx.moveTo(x, 0);
        this.offctx.lineTo(x, this.state.gridH * cs);
      }
      for (let gy = 0; gy <= this.state.gridH; gy++) {
        const y = gy * cs + 0.5;
        this.offctx.moveTo(0, y);
        this.offctx.lineTo(this.state.gridW * cs, y);
      }
      this.offctx.stroke();
    }

    if (this.state.gridW > 0 && this.state.gridH > 0 && Array.isArray(this.state.obstacles) && this.state.obstacles.length > 0) {
      this.offctx.save();
      this.offctx.fillStyle = "rgba(255, 80, 80, 0.18)";
      this.offctx.strokeStyle = "rgba(255, 80, 80, 0.55)";
      this.offctx.lineWidth = 1;
      for (const p of this.state.obstacles) {
        const gx = p.gx | 0;
        const gy = p.gy | 0;
        const gyTop = this.state.gridH - 1 - gy;
        const x = gx * cs;
        const y = gyTop * cs;
        this.offctx.fillRect(x, y, cs, cs);
        this.offctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
      }
      this.offctx.restore();
    }
  }

  drawPaths(ctx2) {
    const paths = this.state.paths || [];
    const activeId = this.activePathId;
    const highlightId = this.highlightPathId;
    const cs = this.state.cellSize;
    const r = Math.max(6, cs * 0.18);

    const drawPoint = (pt, color, label) => {
      if (!pt) return;
      const w = this.gridToWorldCenter(pt.gx, pt.gy);
      ctx2.fillStyle = color;
      ctx2.beginPath();
      ctx2.arc(w.x, w.y, r, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.fillStyle = "rgba(0,0,0,0.75)";
      ctx2.font =
        `bold ${Math.max(10, Math.round(12 / this.viewport.scale))}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace`;
      ctx2.textAlign = "center";
      ctx2.textBaseline = "middle";
      ctx2.fillText(label, w.x, w.y);
    };

    drawPoint(this.state.hero, "rgba(120, 220, 255, 0.95)", "H");
    drawPoint(this.state.base, "rgba(255, 200, 80, 0.95)", "B");

    const towers = Array.isArray(this.state.towerSlots) ? this.state.towerSlots : [];
    if (towers.length > 0) {
      const size = Math.max(10, cs * 0.42);
      ctx2.save();
      ctx2.lineWidth = 2 / this.viewport.scale;
      for (let i = 0; i < towers.length; i++) {
        const pt = towers[i];
        const w =
          typeof pt.px === "number" && typeof pt.py === "number"
            ? this.levelPxPyToWorld(pt.px, pt.py)
            : this.gridToWorldCenter(pt.gx, pt.gy);
        ctx2.strokeStyle = "rgba(140, 255, 160, 0.95)";
        ctx2.fillStyle = "rgba(140, 255, 160, 0.18)";
        ctx2.beginPath();
        ctx2.rect(w.x - size * 0.5, w.y - size * 0.5, size, size);
        ctx2.fill();
        ctx2.stroke();
        ctx2.fillStyle = "rgba(0,0,0,0.75)";
        ctx2.font =
          `bold ${Math.max(10, Math.round(12 / this.viewport.scale))}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace`;
        ctx2.textAlign = "center";
        ctx2.textBaseline = "middle";
        ctx2.fillText("T", w.x, w.y);
      }
      ctx2.restore();
    }

    for (const path of paths) {
      const pts = [];
      if (path.start) pts.push(path.start);
      if (Array.isArray(path.waypoints)) pts.push(...path.waypoints);
      if (path.end) pts.push(path.end);

      const isActive = path.id === activeId;
      const isHighlighted = highlightId && path.id === highlightId;
      if (pts.length >= 2) {
        ctx2.save();
        ctx2.strokeStyle = isActive
          ? "rgba(255, 220, 120, 0.95)"
          : isHighlighted
            ? "rgba(102, 204, 255, 0.9)"
            : "rgba(120, 160, 255, 0.35)";
        ctx2.lineWidth = (isActive ? 3 : isHighlighted ? 3 : 2) / this.viewport.scale;
        ctx2.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const w = this.gridToWorldCenter(pts[i].gx, pts[i].gy);
          if (i === 0) ctx2.moveTo(w.x, w.y);
          else ctx2.lineTo(w.x, w.y);
        }
        ctx2.stroke();
        ctx2.restore();
      }

      const startColor = isActive ? "rgba(120,180,255,0.95)" : "rgba(120,180,255,0.55)";
      const endColor = isActive ? "rgba(255,200,80,0.95)" : "rgba(255,200,80,0.55)";
      drawPoint(path.start, startColor, "S");
      if (Array.isArray(path.waypoints)) {
        for (let i = 0; i < path.waypoints.length; i++) {
          drawPoint(path.waypoints[i], isActive ? "rgba(255,110,110,0.95)" : "rgba(255,110,110,0.45)", String(i + 1));
        }
      }
      drawPoint(path.end, endColor, "E");
    }
  }

  render() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      this.fitOnNextFrame = true;
    }

    if (this.fitOnNextFrame) {
      this.fitOnNextFrame = false;
      this.fitToScreen();
    }

    this.rebuildOffscreenIfNeeded();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.viewport.apply(ctx);

    if (this.bgW > 0 && this.bgH > 0) {
      ctx.imageSmoothingEnabled = false;
      if (this.bgImage) {
        ctx.globalAlpha = clamp(this.state.backgroundOpacity, 0, 1);
        ctx.drawImage(this.bgImage, -this.bgW / 2, -this.bgH / 2, this.bgW, this.bgH);
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(this.offscreen, -this.bgW / 2, -this.bgH / 2);
      this.drawPaths(ctx);
    }

    if (this.hoverCell) {
      const cs = this.state.cellSize;
      ctx.save();
      ctx.translate(-this.bgW / 2, -this.bgH / 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
      ctx.strokeStyle = "rgba(102, 204, 255, 0.75)";
      ctx.lineWidth = 1 / this.viewport.scale;
      const baseX = this.hoverCell.gx * cs;
      const baseY = this.hoverCell.gy * cs;
      ctx.fillRect(baseX, baseY, cs, cs);
      ctx.strokeRect(baseX + 0.5, baseY + 0.5, cs - 1, cs - 1);
      ctx.restore();
    }

    const info = [];
    info.push(`bg: ${this.bgImage ? `${this.bgW}x${this.bgH}  opacity=${Math.round(this.state.backgroundOpacity * 100)}%` : "-"}`);
    info.push(`grid: ${this.state.gridW}x${this.state.gridH}  cellSize=${this.state.cellSize}`);
    this.ensureActivePath();
    const path = this.getActivePath();
    info.push(`paths: ${(this.state.paths || []).length}  current=${this.activePathId}`);
    info.push(`hero: ${this.pointToString(this.state.hero)}  base: ${this.pointToString(this.state.base)}`);
    info.push(`towers: ${(this.state.towerSlots || []).length}`);
    info.push(`obstacles: ${(this.state.obstacles || []).length}`);
    info.push(`start: ${this.pointToString(path.start)}  end: ${this.pointToString(path.end)}  waypoints: ${(path.waypoints || []).length}`);
    this.ensureActiveWave();
    const wave = this.getWaveById(this.activeWaveId);
    const groups = wave && Array.isArray(wave.groups) ? wave.groups.length : 0;
    info.push(`waves: ${(this.state.waves || []).length}  current=${this.activeWaveId}  groups=${groups}`);
    if (this.waveErrors && this.waveErrors.length > 0) {
      for (const e of this.waveErrors.slice(0, 4)) info.push(`! ${e}`);
      if (this.waveErrors.length > 4) info.push(`! ... (${this.waveErrors.length})`);
    }
    this.setStatus(info);

    requestAnimationFrame(() => this.render());
  }
}

const editor = new Editor();

bgOpacity.addEventListener("input", () => {
  const v = clamp((Number(bgOpacity.value) || 100) / 100, 0, 1);
  editor.state.backgroundOpacity = v;
  editor.offDirty = true;
  editor.updateJsonText();
  editor.updateUiState();
});

toolSelect.addEventListener("change", () => {
  editor.tool = toolSelect.value;
});

pathSelect.addEventListener("change", () => {
  editor.activePathId = pathSelect.value;
  editor.updateUiState();
});

addPathBtn.addEventListener("click", () => {
  const used = new Set((editor.state.paths || []).map((p) => p.id));
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let id = "";
  for (let i = 0; i < letters.length; i++) {
    const cand = letters[i];
    if (!used.has(cand)) {
      id = cand;
      break;
    }
  }
  if (!id) {
    let n = 1;
    while (used.has(`P${n}`)) n++;
    id = `P${n}`;
  }
  const path = { id, start: null, end: null, waypoints: [] };
  editor.state.paths.push(path);
  editor.activePathId = id;
  editor.undo.push({ type: "path_add", path: editor.clonePath(path) });
  editor.offDirty = true;
  editor.updateJsonText();
  editor.updateUiState();
});

renamePathBtn.addEventListener("click", () => {
  editor.ensureActivePath();
  const beforeId = editor.activePathId;
  const next = window.prompt("输入新的路径 ID（用于波次引用）", beforeId);
  if (next === null) return;
  const afterId = String(next).trim();
  if (!afterId) return;
  if (afterId === beforeId) return;
  if (editor.findPathIndex(afterId) >= 0) {
    editor.setStatus([`路径 ID 已存在：${afterId}`]);
    return;
  }
  const path = editor.state.getPathById(beforeId);
  if (!path) return;
  path.id = afterId;
  editor.activePathId = afterId;
  editor.undo.push({ type: "path_rename", beforeId, afterId });
  editor.offDirty = true;
  editor.updateJsonText();
  editor.updateUiState();
});

deletePathBtn.addEventListener("click", () => {
  editor.ensureActivePath();
  if ((editor.state.paths || []).length <= 1) {
    editor.setStatus(["至少保留 1 条路径"]);
    return;
  }
  const id = editor.activePathId;
  const index = editor.findPathIndex(id);
  if (index < 0) return;
  const path = editor.clonePath(editor.state.paths[index]);
  editor.state.paths.splice(index, 1);
  editor.activePathId = editor.state.paths[clamp(index, 0, editor.state.paths.length - 1)].id;
  editor.undo.push({ type: "path_delete", index, path });
  editor.offDirty = true;
  editor.updateJsonText();
  editor.updateUiState();
});

clearPathBtn.addEventListener("click", () => {
  editor.ensureActivePath();
  const path = editor.getActivePath();
  editor.setPath(editor.activePathId, { id: path.id, start: null, end: null, waypoints: [] });
});

clearWaypointsBtn.addEventListener("click", () => {
  editor.ensureActivePath();
  editor.setWaypoints(editor.activePathId, []);
});

reverseWaypointsBtn.addEventListener("click", () => {
  editor.ensureActivePath();
  const path = editor.getActivePath();
  editor.setWaypoints(editor.activePathId, [...(path.waypoints || [])].reverse());
});

waveSelect.addEventListener("change", () => {
  editor.activeWaveId = waveSelect.value;
  editor.activeGroupIndex = -1;
  editor.highlightPathId = null;
  editor.updateUiState();
});

addWaveBtn.addEventListener("click", () => {
  const used = new Set((editor.state.waves || []).map((w) => w.id));
  let n = 1;
  while (used.has(`W${n}`)) n++;
  const id = `W${n}`;
  const wave = { id, delay: 0, groups: [] };
  (editor.state.waves || (editor.state.waves = [])).push(wave);
  editor.activeWaveId = id;
  editor.undo.push({ type: "wave_add", wave: editor.cloneWave(wave) });
  editor.offDirty = true;
  editor.updateJsonText();
  editor.updateUiState();
});

renameWaveBtn.addEventListener("click", () => {
  editor.ensureActiveWave();
  const beforeId = editor.activeWaveId;
  const next = window.prompt("输入新的波次 ID（例如 W1、W2）", beforeId);
  if (next === null) return;
  const afterId = String(next).trim();
  if (!afterId) return;
  if (afterId === beforeId) return;
  if (editor.findWaveIndex(afterId) >= 0) {
    editor.setStatus([`波次 ID 已存在：${afterId}`]);
    return;
  }
  const wave = editor.getWaveById(beforeId);
  if (!wave) return;
  wave.id = afterId;
  editor.activeWaveId = afterId;
  editor.undo.push({ type: "wave_rename", beforeId, afterId });
  editor.offDirty = true;
  editor.updateJsonText();
  editor.updateUiState();
});

deleteWaveBtn.addEventListener("click", () => {
  editor.ensureActiveWave();
  if ((editor.state.waves || []).length <= 1) {
    editor.setStatus(["至少保留 1 个波次"]);
    return;
  }
  const id = editor.activeWaveId;
  const index = editor.findWaveIndex(id);
  if (index < 0) return;
  const wave = editor.cloneWave(editor.state.waves[index]);
  editor.state.waves.splice(index, 1);
  editor.activeWaveId = editor.state.waves[clamp(index, 0, editor.state.waves.length - 1)].id;
  editor.activeGroupIndex = -1;
  editor.highlightPathId = null;
  editor.undo.push({ type: "wave_delete", index, wave });
  editor.offDirty = true;
  editor.updateJsonText();
  editor.updateUiState();
});

waveStartAt.addEventListener("change", () => {
  editor.ensureActiveWave();
  const wave = editor.getWaveById(editor.activeWaveId);
  if (!wave) return;
  const before = wave.delay;
  const after = Math.max(0, Number(waveStartAt.value) || 0);
  if (before === after) return;
  wave.delay = after;
  editor.undo.push({ type: "wave_delay", waveId: editor.activeWaveId, before, after });
  editor.offDirty = true;
  editor.updateJsonText();
  editor.updateUiState();
});

addGroupBtn.addEventListener("click", () => {
  editor.ensureActiveWave();
  const wave = editor.getWaveById(editor.activeWaveId);
  if (!wave) return;
  const defaultPathId = editor.state.paths && editor.state.paths[0] ? editor.state.paths[0].id : "A";
  const group = { enemyId: "Enemy1", count: 10, interval: 0.6, pathId: defaultPathId, spawnOffset: 0 };
  const index = wave.groups.length;
  wave.groups.push(group);
  editor.activeGroupIndex = index;
  editor.highlightPathId = group.pathId;
  editor.undo.push({ type: "group_add", waveId: editor.activeWaveId, index, group: { ...group } });
  editor.offDirty = true;
  editor.updateJsonText();
  editor.updateUiState();
});

rebuildGridBtn.addEventListener("click", () => {
  if (!editor.bgImage) {
    editor.setStatus(["请先加载背景图"]);
    return;
  }
  editor.rebuildGridFromBackground();
});

showGrid.addEventListener("change", () => {
  editor.offDirty = true;
});

bgFile.addEventListener("change", async () => {
  const f = bgFile.files && bgFile.files[0];
  if (!f) return;
  try {
    const reader = new FileReader();
    const p = new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
    });
    reader.readAsDataURL(f);
    const res = await p;
    if (typeof res === "string") {
      await editor.loadBackgroundFromDataUrl(res);
      editor.updateUiState();
      editor.setStatus([`已加载背景（本地）：${editor.bgW}x${editor.bgH}`]);
    }
  } catch (e) {
    editor.setStatus(["加载失败", String(e)]);
  }
});

loadUrlBtn.addEventListener("click", async () => {
  const url = bgUrl.value.trim();
  if (!url) return;
  try {
    await editor.loadBackgroundFromUrl(url);
    editor.updateUiState();
    editor.setStatus([`已加载背景（URL）：${editor.bgW}x${editor.bgH}`]);
  } catch (e) {
    editor.setStatus(["加载失败", String(e)]);
  }
});

loadCcPathBtn.addEventListener("click", async () => {
  const p = normalizeCcResourcesPath(bgCcPath.value);
  if (!p) return;
  bgCcPath.value = p;
  try {
    await editor.loadBackgroundFromCcResPath(p);
    editor.updateUiState();
    editor.setStatus([`已设置背景（Cocos resources）：${p}`]);
  } catch (e) {
    editor.setStatus(["加载失败", String(e)]);
  }
});

undoBtn.addEventListener("click", () => {
  const op = editor.undo.popUndo();
  if (!op) return;
  editor.applyUndo(op, "undo");
  editor.updateUiState();
});

redoBtn.addEventListener("click", () => {
  const op = editor.undo.popRedo();
  if (!op) return;
  editor.applyUndo(op, "redo");
  editor.updateUiState();
});

clearTowersBtn.addEventListener("click", () => {
  editor.setTowerSlots([]);
});

clearObstaclesBtn.addEventListener("click", () => {
  editor.setObstacles([]);
});

saveBtn.addEventListener("click", () => {
  const obj = editor.state.toJsonObject(Boolean(embedBg.checked));
  const text = JSON.stringify(obj, null, 2);
  jsonText.value = text;
  downloadText(`hf_map_${nowIso()}.json`, text);
});

loadJsonFile.addEventListener("change", async () => {
  const f = loadJsonFile.files && loadJsonFile.files[0];
  if (!f) return;
  const text = await f.text();
  jsonText.value = text;
  const parsed = tryParseJson(text);
  if (!parsed.ok) {
    editor.setStatus(["JSON 解析失败", String(parsed.error)]);
    return;
  }
  await editor.loadFromJsonObject(parsed.value);
  editor.offDirty = true;
});

loadFromTextBtn.addEventListener("click", async () => {
  const text = jsonText.value.trim();
  if (!text) return;
  const parsed = tryParseJson(text);
  if (!parsed.ok) {
    editor.setStatus(["JSON 解析失败", String(parsed.error)]);
    return;
  }
  await editor.loadFromJsonObject(parsed.value);
  editor.offDirty = true;
});

clearBtn.addEventListener("click", () => {
  editor.clearAll();
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("mousedown", (e) => editor.handlePointerDown(e));
window.addEventListener("mousemove", (e) => editor.handlePointerMove(e));
window.addEventListener("mouseup", (e) => editor.handlePointerUp(e));
canvas.addEventListener("wheel", (e) => editor.handleWheel(e), { passive: false });

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    const op = editor.undo.popUndo();
    if (!op) return;
    editor.applyUndo(op, "undo");
    editor.updateUiState();
  }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
    e.preventDefault();
    const op = editor.undo.popRedo();
    if (!op) return;
    editor.applyUndo(op, "redo");
    editor.updateUiState();
  }
  if (e.code === "Space") editor.isPanning = true;
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Space") editor.isPanning = false;
});

editor.updateUiState();
editor.render();
