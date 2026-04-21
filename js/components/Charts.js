// ============================================================
// js/components/Charts.js  — Lightweight canvas-based charts
// ============================================================

export function drawLineChart(canvas, datasets, labels, options = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  canvas.width  = W * dpr; canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const pad = { top: 10, right: 12, bottom: 24, left: 38 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top  - pad.bottom;

  const allVals = datasets.flatMap(d => d.values);
  const minV = options.minZero ? 0 : Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 1;

  const style = getComputedStyle(document.documentElement);
  const textColor   = style.getPropertyValue('--text-muted').trim();
  const borderColor = style.getPropertyValue('--border').trim();

  // Grid lines
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  [0, .25, .5, .75, 1].forEach(t => {
    const y = pad.top + ph * (1 - t);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + pw, y);
    ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.font = '10px DM Sans, sans-serif';
    ctx.textAlign = 'right';
    const val = minV + range * t;
    ctx.fillText(val >= 1000 ? (val/1000).toFixed(1)+'k' : val.toFixed(0), pad.left - 4, y + 3);
  });

  // X labels
  ctx.textAlign = 'center';
  labels.forEach((l, i) => {
    const x = pad.left + (i / (labels.length - 1)) * pw;
    ctx.fillStyle = textColor;
    ctx.fillText(l, x, H - 4);
  });

  // Lines
  datasets.forEach(ds => {
    const pts = ds.values.map((v, i) => ({
      x: pad.left + (i / (ds.values.length - 1)) * pw,
      y: pad.top + ph * (1 - (v - minV) / range)
    }));

    // Fill
    const baseColor = resolveColor(ds.color);

    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ph);

    grad.addColorStop(0, hexToRgba(baseColor, 0.2));
    grad.addColorStop(1, hexToRgba(baseColor, 0));

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pad.top + ph);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, pad.top + ph);
    ctx.closePath();

    ctx.fillStyle = grad;
    ctx.fill();
    function resolveColor(color) {
    if (!color) return '#000';

    if (color.startsWith('var(')) {
      const varName = color.slice(4, -1).trim(); // remove var( )
      return getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim();
    }

      return color;
    }
    function hexToRgba(hex, alpha) {
    if (!hex.startsWith('#')) return hex;

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }



    // Line
    ctx.beginPath();
    ctx.strokeStyle = ds.color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap  = 'round';
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();

    // Dots
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = ds.color;
      ctx.fill();
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim();
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  });
}

export function drawBarChart(canvas, values, labels, colors, options = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  canvas.width  = W * dpr; canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const pad = { top: 10, right: 8, bottom: 24, left: 40 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;
  const n = values.length;
  const barW = (pw / n) * 0.52;
  const gap  = pw / n;

  const maxV = Math.max(...values, 1);
  const style = getComputedStyle(document.documentElement);
  const textColor   = style.getPropertyValue('--text-muted').trim();
  const borderColor = style.getPropertyValue('--border').trim();

  // Grid
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  [0, .5, 1].forEach(t => {
    const y = pad.top + ph * (1 - t);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + pw, y); ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.font = '10px DM Sans, sans-serif';
    ctx.textAlign = 'right';
    const v = maxV * t;
    ctx.fillText(v >= 1000 ? '$'+(v/1000).toFixed(1)+'k' : '$'+v.toFixed(0), pad.left - 4, y + 3);
  });

  values.forEach((v, i) => {
    const x = pad.left + i * gap + (gap - barW) / 2;
    const bh = (v / maxV) * ph;
    const y  = pad.top + ph - bh;

    // Rounded top bar
    const r = Math.min(6, barW / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + barW - r, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
    ctx.lineTo(x + barW, y + bh);
    ctx.lineTo(x, y + bh);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    if (options.highlight === i) {
      ctx.fillStyle = colors[i] || '#FF4444';
    } else {
      ctx.fillStyle = (colors[i] || '#FF4444') + '55';
    }
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.font = '10px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x + barW / 2, H - 4);
  });
}

export function drawDonutChart(canvas, segments, options = {}) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const size = options.size || 140;
  canvas.style.width  = size + 'px';
  canvas.style.height = size + 'px';
  canvas.width  = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const cx = size / 2, cy = size / 2;
  const outer = size * 0.46;
  const inner = size * 0.30;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let angle = -Math.PI / 2;

  segments.forEach(seg => {
    const sweep = (seg.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outer, angle, angle + sweep);
    ctx.arc(cx, cy, inner, angle + sweep, angle, true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim();
    ctx.lineWidth = 2;
    ctx.stroke();
    angle += sweep;
  });
}

export function drawMiniLine(canvas, values, color) {
  if (!canvas || !values.length) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  canvas.width  = W * dpr; canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * W,
    y: H - ((v - min) / range) * (H - 4) - 2
  }));

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, color + '44');
  grad.addColorStop(1, color + '00');

  ctx.beginPath();
  ctx.moveTo(pts[0].x, H);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length-1].x, H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();
}
