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

  // Clone to remove stale listeners
  const fresh = canvas.cloneNode(true);
  canvas.parentNode?.replaceChild(fresh, canvas);
  canvas = fresh;
  // Preserve the original id
  if (options.id) canvas.id = options.id;

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  canvas.width  = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const pad = { top: 10, right: 8, bottom: 24, left: 40 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;
  const n = values.length;
  const barW = (pw / n) * 0.52;
  const gap  = pw / n;

  const maxV = Math.max(...values, 1);
  const css = prop => getComputedStyle(document.documentElement).getPropertyValue(prop).trim();

  function drawBars(hoverIdx = -1) {
    ctx.clearRect(0, 0, W, H);

    const textColor   = css('--text-muted');
    const borderColor = css('--border');
    const cardBg      = css('--bg-card');

    // Grid lines
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
      const x  = pad.left + i * gap + (gap - barW) / 2;
      const bh = (v / maxV) * ph;
      const y  = pad.top + ph - bh;
      const r  = Math.min(6, barW / 2);
      const isHighlight = options.highlight === i;
      const isHover     = i === hoverIdx;

      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + barW - r, y);
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
      ctx.lineTo(x + barW, y + bh);
      ctx.lineTo(x, y + bh);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();

      const base = colors[i] || '#FF4444';
      ctx.fillStyle = (isHighlight || isHover) ? base : base + '55';
      ctx.fill();

      // X label
      ctx.fillStyle = isHover ? css('--text-primary') : textColor;
      ctx.font = isHover ? '500 10px DM Sans, sans-serif' : '10px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], x + barW / 2, H - 4);

      // ── Hover tooltip above bar ──────────────────────────
      if (isHover && bh > 0) {
        const label = '$' + v.toLocaleString();
        ctx.font = '600 11px DM Sans, sans-serif';
        const tw = ctx.measureText(label).width;
        const TW = tw + 16, TH = 22, TR = 5;
        const tx = x + barW / 2 - TW / 2;
        const ty = Math.max(pad.top - 4, y - TH - 8);

        // Shadow + box
        ctx.save();
        ctx.shadowColor   = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur    = 10;
        ctx.shadowOffsetY = 3;
        ctx.beginPath();
        ctx.moveTo(tx + TR, ty);
        ctx.lineTo(tx + TW - TR, ty);
        ctx.quadraticCurveTo(tx + TW, ty, tx + TW, ty + TR);
        ctx.lineTo(tx + TW, ty + TH - TR);
        ctx.quadraticCurveTo(tx + TW, ty + TH, tx + TW - TR, ty + TH);
        ctx.lineTo(tx + TR, ty + TH);
        ctx.quadraticCurveTo(tx, ty + TH, tx, ty + TH - TR);
        ctx.lineTo(tx, ty + TR);
        ctx.quadraticCurveTo(tx, ty, tx + TR, ty);
        ctx.closePath();
        ctx.fillStyle = cardBg;
        ctx.fill();
        ctx.restore();

        // Border
        ctx.beginPath();
        ctx.moveTo(tx + TR, ty);
        ctx.lineTo(tx + TW - TR, ty);
        ctx.quadraticCurveTo(tx + TW, ty, tx + TW, ty + TR);
        ctx.lineTo(tx + TW, ty + TH - TR);
        ctx.quadraticCurveTo(tx + TW, ty + TH, tx + TW - TR, ty + TH);
        ctx.lineTo(tx + TR, ty + TH);
        ctx.quadraticCurveTo(tx, ty + TH, tx, ty + TH - TR);
        ctx.lineTo(tx, ty + TR);
        ctx.quadraticCurveTo(tx, ty, tx + TR, ty);
        ctx.closePath();
        ctx.strokeStyle = borderColor;
        ctx.lineWidth   = 1;
        ctx.stroke();

        // Text
        ctx.fillStyle = base;
        ctx.textAlign = 'center';
        ctx.fillText(label, tx + TW / 2, ty + TH / 2 + 4);

        // Small caret line down to bar
        ctx.beginPath();
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = base + '88';
        ctx.lineWidth   = 1;
        ctx.moveTo(x + barW / 2, ty + TH);
        ctx.lineTo(x + barW / 2, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }

  function getHoverIndex(mx) {
    for (let i = 0; i < values.length; i++) {
      const x = pad.left + i * gap + (gap - barW) / 2;
      if (mx >= x - 4 && mx <= x + barW + 4) return i;
    }
    return -1;
  }

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    canvas.style.cursor = 'pointer';
    drawBars(getHoverIndex(e.clientX - rect.left));
  });
  canvas.addEventListener('mouseleave', () => {
    canvas.style.cursor = '';
    drawBars();
  });

  drawBars();
  return canvas; // return in case caller needs the new node reference
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