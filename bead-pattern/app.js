import {
  BOARD_SIZE,
  findNearestColor,
  MARD_PALETTE,
  PALETTE_LAB,
  labDistance,
} from './palette.js';

const state = {
  image: null,
  crop: { x: 0, y: 0, w: 1, h: 1 },
  boardsW: 1,
  boardsH: 1,
  maxColors: 291,
  showGrid: true,
  showCodes: false,
  beadSize: 12,
  mapped: null,
  counts: null,
  selectedBoard: 'all',
};

const els = {
  fileInput: document.getElementById('fileInput'),
  uploadZone: document.getElementById('uploadZone'),
  cropCanvas: document.getElementById('cropCanvas'),
  previewCanvas: document.getElementById('previewCanvas'),
  boardsW: document.getElementById('boardsW'),
  boardsH: document.getElementById('boardsH'),
  maxColors: document.getElementById('maxColors'),
  maxColorsVal: document.getElementById('maxColorsVal'),
  showGrid: document.getElementById('showGrid'),
  showCodes: document.getElementById('showCodes'),
  beadSize: document.getElementById('beadSize'),
  beadSizeVal: document.getElementById('beadSizeVal'),
  generateBtn: document.getElementById('generateBtn'),
  legend: document.getElementById('legend'),
  stats: document.getElementById('stats'),
  boardFilter: document.getElementById('boardFilter'),
  exportAll: document.getElementById('exportAll'),
  exportBoards: document.getElementById('exportBoards'),
  cropSection: document.getElementById('cropSection'),
  resultSection: document.getElementById('resultSection'),
  paletteCount: document.getElementById('paletteCount'),
};

els.paletteCount.textContent = MARD_PALETTE.length;

let cropDrag = null;

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      state.image = img;
      state.crop = { x: 0, y: 0, w: img.width, h: img.height };
      fitCropToAspect();
      els.cropSection.hidden = false;
      drawCropCanvas();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function aspectRatio() {
  return state.boardsW / state.boardsH;
}

function fitCropToAspect() {
  if (!state.image) return;
  const img = state.image;
  const ar = aspectRatio();
  const imgAr = img.width / img.height;
  let w, h, x, y;
  if (imgAr > ar) {
    h = img.height;
    w = h * ar;
    x = (img.width - w) / 2;
    y = 0;
  } else {
    w = img.width;
    h = w / ar;
    x = 0;
    y = (img.height - h) / 2;
  }
  state.crop = { x, y, w, h };
}

function drawCropCanvas() {
  const canvas = els.cropCanvas;
  const ctx = canvas.getContext('2d');
  const img = state.image;
  if (!img) return;

  const maxW = canvas.parentElement.clientWidth - 32;
  const scale = Math.min(1, maxW / img.width);
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const { x, y, w, h } = state.crop;
  const sx = x * scale;
  const sy = y * scale;
  const sw = w * scale;
  const sh = h * scale;

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.clearRect(sx, sy, sw, sh);
  ctx.drawImage(img, x, y, w, h, sx, sy, sw, sh);

  ctx.strokeStyle = '#ff6b9d';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx, sy, sw, sh);

  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  const cols = state.boardsW;
  const rows = state.boardsH;
  for (let c = 1; c < cols; c++) {
    const lx = sx + (sw * c) / cols;
    ctx.beginPath();
    ctx.moveTo(lx, sy);
    ctx.lineTo(lx, sy + sh);
    ctx.stroke();
  }
  for (let r = 1; r < rows; r++) {
    const ly = sy + (sh * r) / rows;
    ctx.beginPath();
    ctx.moveTo(sx, ly);
    ctx.lineTo(sx + sw, ly);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function canvasCropToImage(clientX, clientY) {
  const canvas = els.cropCanvas;
  const rect = canvas.getBoundingClientRect();
  const scale = state.image.width / canvas.width;
  return {
    x: (clientX - rect.left) * scale,
    y: (clientY - rect.top) * scale,
  };
}

function setupCropInteraction() {
  const canvas = els.cropCanvas;

  canvas.addEventListener('mousedown', (e) => {
    if (!state.image) return;
    const p = canvasCropToImage(e.clientX, e.clientY);
    cropDrag = { startX: p.x, startY: p.y, orig: { ...state.crop } };
  });

  window.addEventListener('mousemove', (e) => {
    if (!cropDrag || !state.image) return;
    const p = canvasCropToImage(e.clientX, e.clientY);
    const dx = p.x - cropDrag.startX;
    const dy = p.y - cropDrag.startY;
    const img = state.image;
    let { x, y, w, h } = cropDrag.orig;
    x = Math.max(0, Math.min(img.width - w, x + dx));
    y = Math.max(0, Math.min(img.height - h, y + dy));
    state.crop = { x, y, w, h };
    drawCropCanvas();
  });

  window.addEventListener('mouseup', () => {
    cropDrag = null;
  });
}

function refreshPreview() {
  if (!state.mapped) return;
  if (state.selectedBoard === 'all') {
    renderPreview();
  } else {
    renderPreview(els.previewCanvas, Number(state.selectedBoard));
  }
}

function sampleAndMap() {
  state.boardsW = Number(els.boardsW.value);
  state.boardsH = Number(els.boardsH.value);
  const img = state.image;
  const w = state.boardsW * BOARD_SIZE;
  const h = state.boardsH * BOARD_SIZE;
  const { x, y, w: cw, h: ch } = state.crop;

  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  let tctx;
  try {
    tctx = tmp.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
  } catch {
    tctx = tmp.getContext('2d');
  }
  tctx.drawImage(img, x, y, cw, ch, 0, 0, w, h);
  const data = tctx.getImageData(0, 0, w, h).data;

  let mapped = new Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    mapped[i] = findNearestColor(data[o], data[o + 1], data[o + 2]);
  }

  if (state.maxColors < MARD_PALETTE.length) {
    mapped = reduceColors(mapped, state.maxColors);
  }

  state.mapped = { grid: mapped, w, h };
  state.counts = countColors(mapped);
  state.selectedBoard = 'all';
  updateBoardFilter();
  renderPreview();
  renderLegend();
  renderStats();
  els.resultSection.hidden = false;
}

function reduceColors(mapped, maxColors) {
  const usage = new Map();
  mapped.forEach((c) => usage.set(c.code, (usage.get(c.code) || 0) + 1));
  const sorted = [...usage.entries()].sort((a, b) => b[1] - a[1]);
  const allowed = new Set(sorted.slice(0, maxColors).map(([code]) => code));
  const allowedEntries = PALETTE_LAB.filter((c) => allowed.has(c.code));

  return mapped.map((color) => {
    if (allowed.has(color.code)) return color;
    const target = color.lab;
    let best = allowedEntries[0];
    let bestDist = Infinity;
    for (const entry of allowedEntries) {
      const d = labDistance(target, entry.lab);
      if (d < bestDist) {
        bestDist = d;
        best = entry;
      }
    }
    return best;
  });
}

function countColors(mapped) {
  const counts = new Map();
  mapped.forEach((c) => counts.set(c.code, (counts.get(c.code) || 0) + 1));
  return [...counts.entries()]
    .map(([code, count]) => {
      const color = PALETTE_LAB.find((c) => c.code === code);
      return { code, hex: color.hex, count };
    })
    .sort((a, b) => b.count - a.count);
}

function hexLuminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function drawCodeLabel(ctx, code, hex, cx, cy, bs) {
  const fontSize = Math.max(8, Math.round(bs * 0.4));
  ctx.font = `700 ${fontSize}px "Segoe UI", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const light = hexLuminance(hex) > 0.55;
  ctx.lineWidth = Math.max(1.5, bs * 0.08);
  ctx.strokeStyle = light ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)';
  ctx.fillStyle = light ? '#111' : '#fff';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeText(code, cx, cy);
  ctx.fillText(code, cx, cy);
}

function getDrawContext(canvas) {
  try {
    return canvas.getContext('2d', { alpha: false, colorSpace: 'srgb' });
  } catch {
    return canvas.getContext('2d');
  }
}

function drawBead(ctx, hex, x, y, bs) {
  // 整格填色，避免手机缩小后圆豆间隙发灰发白
  ctx.fillStyle = hex;
  ctx.fillRect(x, y, bs, bs);
}

function renderPreview(targetCanvas = els.previewCanvas, boardOnly = null) {
  const { grid, w, h } = state.mapped;
  const bs = state.beadSize;
  const canvas = targetCanvas;

  const filterBoard =
    boardOnly !== null ? boardOnly : state.selectedBoard === 'all' ? null : Number(state.selectedBoard);

  if (filterBoard !== null) {
    const bx = filterBoard % state.boardsW;
    const by = Math.floor(filterBoard / state.boardsW);
    const ox = bx * BOARD_SIZE;
    const oy = by * BOARD_SIZE;
    canvas.width = BOARD_SIZE * bs;
    canvas.height = BOARD_SIZE * bs;
    const ctx = getDrawContext(canvas);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const c = grid[(oy + y) * w + (ox + x)];
        drawBead(ctx, c.hex, x * bs, y * bs, bs);
      }
    }

    if (state.showGrid) {
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= BOARD_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * bs + 0.5, 0);
        ctx.lineTo(i * bs + 0.5, BOARD_SIZE * bs);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * bs + 0.5);
        ctx.lineTo(BOARD_SIZE * bs, i * bs + 0.5);
        ctx.stroke();
      }
    }

    if (state.showCodes && bs >= 8) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          const c = grid[(oy + y) * w + (ox + x)];
          drawCodeLabel(ctx, c.code, c.hex, x * bs + bs / 2, y * bs + bs / 2, bs);
        }
      }
    }
    return;
  }

  canvas.width = w * bs;
  canvas.height = h * bs;
  const ctx = getDrawContext(canvas);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = grid[y * w + x];
      drawBead(ctx, c.hex, x * bs, y * bs, bs);
    }
  }

  if (state.showGrid) {
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x++) {
      ctx.beginPath();
      ctx.moveTo(x * bs + 0.5, 0);
      ctx.lineTo(x * bs + 0.5, h * bs);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * bs + 0.5);
      ctx.lineTo(w * bs, y * bs + 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,80,120,0.7)';
    ctx.lineWidth = 2;
    for (let c = 1; c < state.boardsW; c++) {
      const lx = c * BOARD_SIZE * bs + 0.5;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, h * bs);
      ctx.stroke();
    }
    for (let r = 1; r < state.boardsH; r++) {
      const ly = r * BOARD_SIZE * bs + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(w * bs, ly);
      ctx.stroke();
    }
  }

  if (state.showCodes && bs >= 8) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = grid[y * w + x];
        drawCodeLabel(ctx, c.code, c.hex, x * bs + bs / 2, y * bs + bs / 2, bs);
      }
    }
  }
}

function renderLegend() {
  els.legend.innerHTML = '';
  state.counts.forEach(({ code, hex, count }) => {
    const row = document.createElement('div');
    row.className = 'legend-item';
    row.innerHTML = `
      <span class="swatch" style="background:${hex}"></span>
      <span class="code">${code}</span>
      <span class="count">${count}</span>
    `;
    els.legend.appendChild(row);
  });
}

function renderStats() {
  const total = state.counts.reduce((s, c) => s + c.count, 0);
  const colors = state.counts.length;
  const boards = state.boardsW * state.boardsH;
  els.stats.innerHTML = `
    <p>总豆数：<strong>${total}</strong></p>
    <p>使用色号：<strong>${colors}</strong> / ${MARD_PALETTE.length}</p>
    <p>板数：<strong>${boards}</strong>（${state.boardsW}×${state.boardsH}，每板 50×50）</p>
    <p>成品尺寸：<strong>${state.boardsW * BOARD_SIZE}×${state.boardsH * BOARD_SIZE}</strong> 粒</p>
  `;
}

function updateBoardFilter() {
  const total = state.boardsW * state.boardsH;
  els.boardFilter.innerHTML = '<option value="all">全部</option>';
  for (let i = 0; i < total; i++) {
    const col = (i % state.boardsW) + 1;
    const row = Math.floor(i / state.boardsW) + 1;
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `第 ${row} 行 第 ${col} 板`;
    els.boardFilter.appendChild(opt);
  }
}

function exportCanvas(filterBoard = null) {
  const off = document.createElement('canvas');
  if (filterBoard !== null) {
    renderPreview(off, filterBoard);
    const link = document.createElement('a');
    link.download = `bead-board-${filterBoard + 1}.png`;
    link.href = off.toDataURL('image/png');
    link.click();
    return;
  }

  state.selectedBoard = 'all';
  els.boardFilter.value = 'all';
  renderPreview();
  const link = document.createElement('a');
  link.download = 'bead-pattern-full.png';
  link.href = els.previewCanvas.toDataURL('image/png');
  link.click();
}

function exportAllBoards() {
  const total = state.boardsW * state.boardsH;
  for (let i = 0; i < total; i++) {
    setTimeout(() => exportCanvas(i), i * 300);
  }
}

function bindEvents() {
  els.uploadZone.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) loadImage(e.target.files[0]);
  });

  ['dragenter', 'dragover'].forEach((ev) => {
    els.uploadZone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.uploadZone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((ev) => {
    els.uploadZone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.uploadZone.classList.remove('dragover');
      if (ev === 'drop' && e.dataTransfer.files[0]) loadImage(e.dataTransfer.files[0]);
    });
  });

  [els.boardsW, els.boardsH].forEach((el) => {
    el.addEventListener('change', () => {
      state.boardsW = Number(els.boardsW.value);
      state.boardsH = Number(els.boardsH.value);
      fitCropToAspect();
      drawCropCanvas();
    });
  });

  els.maxColors.addEventListener('input', () => {
    state.maxColors = Number(els.maxColors.value);
    els.maxColorsVal.textContent = state.maxColors;
  });

  els.beadSize.addEventListener('input', () => {
    state.beadSize = Number(els.beadSize.value);
    els.beadSizeVal.textContent = state.beadSize;
    if (state.mapped) refreshPreview();
  });

  els.showGrid.addEventListener('change', () => {
    state.showGrid = els.showGrid.checked;
    if (state.mapped) refreshPreview();
  });

  els.showCodes.addEventListener('change', () => {
    state.showCodes = els.showCodes.checked;
    if (state.mapped) refreshPreview();
  });

  els.generateBtn.addEventListener('click', sampleAndMap);

  els.boardFilter.addEventListener('change', () => {
    state.selectedBoard = els.boardFilter.value;
    if (state.selectedBoard === 'all') {
      renderPreview();
    } else {
      renderPreview(els.previewCanvas, Number(state.selectedBoard));
    }
  });

  els.exportAll.addEventListener('click', () => {
    state.selectedBoard = 'all';
    els.boardFilter.value = 'all';
    exportCanvas(null);
  });

  els.exportBoards.addEventListener('click', exportAllBoards);

  window.addEventListener('resize', () => {
    if (state.image) drawCropCanvas();
  });
}

setupCropInteraction();
bindEvents();
