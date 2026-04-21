// ============================================================
// js/components/Toast.js
// ============================================================

let container;

function getContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

export function toast(message, type = 'info', duration = 3500) {
  const c = getContainer();
  const t = document.createElement('div');
  t.className = `toast ${type}`;

  const icons = {
    success: `<svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:var(--income);fill:none;stroke-width:2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:var(--expense);fill:none;stroke-width:2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:var(--transfer);fill:none;stroke-width:2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
  };

  t.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
  c.appendChild(t);

  requestAnimationFrame(() => t.classList.add('show'));

  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, duration);
}
