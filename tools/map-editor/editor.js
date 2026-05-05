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
const bgOpacity = $("bgOpacity");
const bgOpacityText = $("bgOpacityText");
const embedBg = $("embedBg");
const cellSizeInput = $("cellSize");
const rebuildGridBtn = $("rebuildGridBtn");
const showGrid = $("showGrid");
const showWalkable = $("showWalkable");
const toolSelect = $("tool");
const brushSizeInput = $("brushSize");
const brushSizeText = $("brushSizeText");
const undoBtn = $("undoBtn");
const redoBtn = $("redoBtn");
const saveBtn = $("saveBtn");
const loadJsonFile = $("loadJson");
const jsonText = $("jsonText");
const loadFromTextBtn = $("loadFromTextBtn");
const clearBtn = $("clearBtn");
const statusEl = $("status");

const Tool = {
  Paint: "paint",
  Erase: "erase",
  Hero: "hero",
  Castle: "castle",
  SpawnAdd: "spawn_add",
  SpawnRemove: "spawn_remove",
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
    this.version = 1;
    this.background = { type: "none", src: "" };
    this.backgroundOpacity = 1;
    this.cellSize = 40;
    this.gridW = 0;
    this.gridH = 0;
    this.walkable = new Uint8Array(0);
    this.heroStart = null;
    this.castle = null;
    this.enemySpawns = [];
  }

  resizeGrid(w, h, cellSize) {
    this.cellSize = cellSize;
    this.gridW = Math.max(0, w | 0);
    this.gridH = Math.max(0, h | 0);
    this.walkable = new Uint8Array(this.gridW * this.gridH);
  }

  idx(gx, gy) {
    return gy * this.gridW + gx;
  }

  inBounds(gx, gy) {
    return gx >= 0 && gy >= 0 && gx < this.gridW && gy < this.gridH;
  }

  getWalkable(gx, gy) {
    if (!this.inBounds(gx, gy)) return 0;
    return this.walkable[this.idx(gx, gy)];
  }

  setWalkable(gx, gy, v) {
    if (!this.inBounds(gx, gy)) return false;
    const i = this.idx(gx, gy);
    const nv = v ? 1 : 0;
    if (this.walkable[i] === nv) return false;
    this.walkable[i] = nv;
    return true;
  }

  clear() {
    this.background = { type: "none", src: "" };
    this.gridW = 0;
    this.gridH = 0;
    this.walkable = new Uint8Array(0);
    this.heroStart = null;
    this.castle = null;
    this.enemySpawns = [];
  }

  toJsonObject(embedBackground) {
    const walkableIdx = [];
    for (let i = 0; i < this.walkable.length; i++) {
      if (this.walkable[i]) walkableIdx.push(i);
    }
    const backgroundOut =
      embedBackground && this.background.type === "dataURL"
        ? { type: "dataURL", src: this.background.src }
        : this.background.type === "url"
          ? { type: "url", src: this.background.src }
          : { type: "none", src: "" };

    const toPoint = (p) =>
      p
        ? {
            gx: p.gx,
            gy: p.gy,
            px: (p.gx + 0.5) * this.cellSize,
            py: (p.gy + 0.5) * this.cellSize,
          }
        : null;

    return {
      version: this.version,
      background: backgroundOut,
      backgroundOpacity: this.backgroundOpacity,
      cellSize: this.cellSize,
      gridW: this.gridW,
      gridH: this.gridH,
      walkable: walkableIdx,
      heroStart: toPoint(this.heroStart),
      castle: toPoint(this.castle),
      enemySpawns: this.enemySpawns.map((p) => ({
        gx: p.gx,
        gy: p.gy,
        px: (p.gx + 0.5) * this.cellSize,
        py: (p.gy + 0.5) * this.cellSize,
      })),
    };
  }

  loadFromJsonObject(obj) {
    const cellSize = typeof obj.cellSize === "number" ? Math.max(4, Math.floor(obj.cellSize)) : 40;
    const w = typeof obj.gridW === "number" ? Math.max(0, Math.floor(obj.gridW)) : 0;
    const h = typeof obj.gridH === "number" ? Math.max(0, Math.floor(obj.gridH)) : 0;
    this.resizeGrid(w, h, cellSize);

    const bg = obj.background;
    if (bg && typeof bg.type === "string" && typeof bg.src === "string") {
      if (bg.type === "dataURL" || bg.type === "url") this.background = { type: bg.type, src: bg.src };
      else this.background = { type: "none", src: "" };
    } else {
      this.background = { type: "none", src: "" };
    }
    const opacityRaw = typeof obj.backgroundOpacity === "number" ? obj.backgroundOpacity : 1;
    this.backgroundOpacity = clamp(opacityRaw, 0, 1);

    if (Array.isArray(obj.walkable)) {
      for (const idx of obj.walkable) {
        if (typeof idx !== "number") continue;
        const i = Math.floor(idx);
        if (i >= 0 && i < this.walkable.length) this.walkable[i] = 1;
      }
    }

    const readPoint = (p) => {
      if (!p || typeof p.gx !== "number" || typeof p.gy !== "number") return null;
      const gx = Math.floor(p.gx);
      const gy = Math.floor(p.gy);
      if (!this.inBounds(gx, gy)) return null;
      return { gx, gy };
    };
    this.heroStart = readPoint(obj.heroStart);
    this.castle = readPoint(obj.castle);
    this.enemySpawns = Array.isArray(obj.enemySpawns) ? obj.enemySpawns.map(readPoint).filter(Boolean) : [];
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

    this.brushSize = 1;
    this.tool = Tool.Paint;
    this.hoverCell = null;
    this.pendingStroke = null;

    this.offscreen = document.createElement("canvas");
    this.offctx = this.offscreen.getContext("2d");
    if (!this.offctx) throw new Error("Offscreen 2D context not available");
    this.offDirty = true;

    this.fitOnNextFrame = false;
  }

  setStatus(lines) {
    statusEl.textContent = lines.join("\n");
  }

  updateUiState() {
    undoBtn.disabled = !this.undo.canUndo();
    redoBtn.disabled = !this.undo.canRedo();
    brushSizeText.textContent = String(this.brushSize);
    bgOpacityText.textContent = String(Math.round(this.state.backgroundOpacity * 100));
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
    const gy = Math.floor(y / this.state.cellSize);
    if (!this.state.inBounds(gx, gy)) return null;
    return { gx, gy };
  }

  gridToWorldCenter(gx, gy) {
    const ox = -this.bgW / 2;
    const oy = -this.bgH / 2;
    const x = ox + (gx + 0.5) * this.state.cellSize;
    const y = oy + (gy + 0.5) * this.state.cellSize;
    return { x, y };
  }

  applyBrush(gx, gy, makeWalkable) {
    const r = this.brushSize | 0;
    const changes = [];
    for (let dy = -r + 1; dy <= r - 1; dy++) {
      for (let dx = -r + 1; dx <= r - 1; dx++) {
        const x = gx + dx;
        const y = gy + dy;
        if (!this.state.inBounds(x, y)) continue;
        const prev = this.state.getWalkable(x, y);
        const next = makeWalkable ? 1 : 0;
        if (prev === next) continue;
        this.state.setWalkable(x, y, next);
        changes.push({ gx: x, gy: y, prev, next });
      }
    }
    return changes;
  }

  beginStroke() {
    this.pendingStroke = { kind: "cells", changes: [] };
  }

  appendStrokeChanges(changes) {
    if (!this.pendingStroke || this.pendingStroke.kind !== "cells") return;
    const seen = this.pendingStroke._seen || (this.pendingStroke._seen = new Map());
    for (const c of changes) {
      const key = `${c.gx},${c.gy}`;
      if (seen.has(key)) {
        const idx = seen.get(key);
        this.pendingStroke.changes[idx].next = c.next;
      } else {
        seen.set(key, this.pendingStroke.changes.length);
        this.pendingStroke.changes.push(c);
      }
    }
  }

  endStroke() {
    if (!this.pendingStroke) return;
    if (this.pendingStroke.kind === "cells" && this.pendingStroke.changes.length > 0) {
      const op = {
        type: "cells",
        changes: this.pendingStroke.changes.map((c) => ({ gx: c.gx, gy: c.gy, prev: c.prev, next: c.next })),
      };
      this.undo.push(op);
      this.offDirty = true;
      this.updateJsonText();
    }
    this.pendingStroke = null;
    this.updateUiState();
  }

  setMarker(type, gx, gy) {
    const before =
      type === "hero" ? this.state.heroStart : type === "castle" ? this.state.castle : null;
    const after = { gx, gy };
    const same = before && before.gx === after.gx && before.gy === after.gy;
    if (same) return;

    if (type === "hero") this.state.heroStart = after;
    if (type === "castle") this.state.castle = after;

    this.undo.push({ type: "marker", marker: type, before, after });
    this.offDirty = true;
    this.updateJsonText();
    this.updateUiState();
  }

  addSpawn(gx, gy) {
    const exists = this.state.enemySpawns.some((p) => p.gx === gx && p.gy === gy);
    if (exists) return;
    this.state.enemySpawns.push({ gx, gy });
    this.undo.push({ type: "spawn_add", point: { gx, gy } });
    this.offDirty = true;
    this.updateJsonText();
    this.updateUiState();
  }

  removeSpawnNear(gx, gy) {
    if (this.state.enemySpawns.length === 0) return;
    let bestIdx = -1;
    let bestD = Infinity;
    for (let i = 0; i < this.state.enemySpawns.length; i++) {
      const p = this.state.enemySpawns[i];
      const d = distSq(p.gx, p.gy, gx, gy);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) return;
    const p = this.state.enemySpawns[bestIdx];
    if (bestD > 4) return;
    this.state.enemySpawns.splice(bestIdx, 1);
    this.undo.push({ type: "spawn_remove", point: { gx: p.gx, gy: p.gy }, index: bestIdx });
    this.offDirty = true;
    this.updateJsonText();
    this.updateUiState();
  }

  applyUndo(op, dir) {
    if (!op) return;
    if (op.type === "cells") {
      for (const c of op.changes) {
        this.state.setWalkable(c.gx, c.gy, dir === "undo" ? c.prev : c.next);
      }
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "marker") {
      const v = dir === "undo" ? op.before : op.after;
      if (op.marker === "hero") this.state.heroStart = v;
      if (op.marker === "castle") this.state.castle = v;
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "spawn_add") {
      if (dir === "undo") {
        this.state.enemySpawns = this.state.enemySpawns.filter((p) => !(p.gx === op.point.gx && p.gy === op.point.gy));
      } else {
        const exists = this.state.enemySpawns.some((p) => p.gx === op.point.gx && p.gy === op.point.gy);
        if (!exists) this.state.enemySpawns.push({ gx: op.point.gx, gy: op.point.gy });
      }
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
    if (op.type === "spawn_remove") {
      if (dir === "undo") {
        const exists = this.state.enemySpawns.some((p) => p.gx === op.point.gx && p.gy === op.point.gy);
        if (!exists) this.state.enemySpawns.splice(clamp(op.index, 0, this.state.enemySpawns.length), 0, { gx: op.point.gx, gy: op.point.gy });
      } else {
        this.state.enemySpawns = this.state.enemySpawns.filter((p) => !(p.gx === op.point.gx && p.gy === op.point.gy));
      }
      this.offDirty = true;
      this.updateJsonText();
      return;
    }
  }

  handlePointerDown(ev) {
    if (ev.button !== 0) return;
    this.isPointerDown = true;

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
    if (this.tool === Tool.Paint || this.tool === Tool.Erase) {
      this.beginStroke();
      const changes = this.applyBrush(cell.gx, cell.gy, this.tool === Tool.Paint);
      this.appendStrokeChanges(changes);
      this.offDirty = true;
      return;
    }

    if (this.tool === Tool.Hero) this.setMarker("hero", cell.gx, cell.gy);
    if (this.tool === Tool.Castle) this.setMarker("castle", cell.gx, cell.gy);
    if (this.tool === Tool.SpawnAdd) this.addSpawn(cell.gx, cell.gy);
    if (this.tool === Tool.SpawnRemove) this.removeSpawnNear(cell.gx, cell.gy);
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
    if (this.tool === Tool.Paint || this.tool === Tool.Erase) {
      const changes = this.applyBrush(cell.gx, cell.gy, this.tool === Tool.Paint);
      this.appendStrokeChanges(changes);
      this.offDirty = true;
    }
  }

  handlePointerUp(ev) {
    if (ev.button !== 0) return;
    this.isPointerDown = false;
    if (this.isPanning) {
      this.isPanning = false;
      return;
    }
    this.endStroke();
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
    if (showWalkable.checked && this.state.gridW > 0 && this.state.gridH > 0) {
      this.offctx.fillStyle = "rgba(80, 220, 140, 0.25)";
      for (let gy = 0; gy < this.state.gridH; gy++) {
        for (let gx = 0; gx < this.state.gridW; gx++) {
          if (!this.state.getWalkable(gx, gy)) continue;
          this.offctx.fillRect(gx * cs, gy * cs, cs, cs);
        }
      }
    }

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

    const drawMarker = (pt, color, text) => {
      if (!pt) return;
      const x = (pt.gx + 0.5) * cs;
      const y = (pt.gy + 0.5) * cs;
      this.offctx.fillStyle = color;
      this.offctx.beginPath();
      this.offctx.arc(x, y, Math.max(6, cs * 0.18), 0, Math.PI * 2);
      this.offctx.fill();
      this.offctx.fillStyle = "rgba(0,0,0,0.75)";
      this.offctx.font = "bold 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
      this.offctx.textAlign = "center";
      this.offctx.textBaseline = "middle";
      this.offctx.fillText(text, x, y);
    };

    drawMarker(this.state.heroStart, "rgba(120,180,255,0.95)", "H");
    drawMarker(this.state.castle, "rgba(255,200,80,0.95)", "C");
    for (const p of this.state.enemySpawns) drawMarker(p, "rgba(255,110,110,0.95)", "E");
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
    }

    if (this.hoverCell && (this.tool === Tool.Paint || this.tool === Tool.Erase)) {
      const cs = this.state.cellSize;
      const r = this.brushSize | 0;
      ctx.save();
      ctx.translate(-this.bgW / 2, -this.bgH / 2);
      ctx.fillStyle = this.tool === Tool.Paint ? "rgba(80, 220, 140, 0.22)" : "rgba(255, 120, 120, 0.18)";
      ctx.strokeStyle = this.tool === Tool.Paint ? "rgba(80, 220, 140, 0.65)" : "rgba(255, 120, 120, 0.55)";
      ctx.lineWidth = 1 / this.viewport.scale;
      const baseX = (this.hoverCell.gx - (r - 1)) * cs;
      const baseY = (this.hoverCell.gy - (r - 1)) * cs;
      const size = (r * 2 - 1) * cs;
      ctx.fillRect(baseX, baseY, size, size);
      ctx.strokeRect(baseX + 0.5, baseY + 0.5, size - 1, size - 1);
      ctx.restore();
    }

    const info = [];
    info.push(`bg: ${this.bgImage ? `${this.bgW}x${this.bgH}  opacity=${Math.round(this.state.backgroundOpacity * 100)}%` : "-"}`);
    info.push(`grid: ${this.state.gridW}x${this.state.gridH}  cellSize=${this.state.cellSize}`);
    info.push(`walkable: ${this.state.walkable.reduce((a, b) => a + (b ? 1 : 0), 0)}`);
    info.push(`hero: ${this.state.heroStart ? `${this.state.heroStart.gx},${this.state.heroStart.gy}` : "-"}`);
    info.push(`castle: ${this.state.castle ? `${this.state.castle.gx},${this.state.castle.gy}` : "-"}`);
    info.push(`spawns: ${this.state.enemySpawns.length}`);
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

brushSizeInput.addEventListener("input", () => {
  editor.brushSize = Math.max(1, Math.floor(Number(brushSizeInput.value) || 1));
  editor.updateUiState();
});

toolSelect.addEventListener("change", () => {
  editor.tool = toolSelect.value;
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
showWalkable.addEventListener("change", () => {
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
