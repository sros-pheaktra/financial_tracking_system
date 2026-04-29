// ============================================================
// js/utils/helpers.js  — Formatting & utility functions
// ============================================================

export function fmt(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(amount);
}

export function fmtShort(amount) {
  if (Math.abs(amount) >= 1000) {
    return '$' + (amount / 1000).toFixed(1) + 'k';
  }
  return '$' + amount.toFixed(0);
}

export function fmtDate(dateStr, opts = { month: 'short', day: 'numeric' }) {
  return new Date(dateStr).toLocaleDateString('en-US', opts);
}

export function fmtDateTime(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function el(tag, cls, content = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (content) e.innerHTML = content;
  return e;
}

export function pct(part, total) {
  const p = Number(part) || 0;
  const t = Number(total) || 0;
  if (t <= 0) return 0;

  return Number(((p / t) * 100).toFixed(1)); // 0.3%
}



export function progressClass(pct) {
  if (pct >= 90) return 'danger';
  if (pct >= 70) return 'warning';
  return 'safe';
}

export const CATEGORY_COLORS = [
  '#FF4444','#FF9500','#FFCC00','#34C759','#00C7BE',
  '#007AFF','#5856D6','#AF52DE','#FF2D55','#A2845E'
];

export function getCategoryColor(name) {
  const map = {
    'Rent': '#F44336', 'Food': '#FF9800', 'Transport': '#2196F3',
    'Shopping': '#E91E63', 'Utilities': '#9C27B0', 'Others': '#607D8B',
    'Salary': '#10B981', 'Healthcare': '#00BCD4', 'Education': '#3F51B5',
    'Entertainment': '#FF5722', 'Freelance': '#8BC34A', 'Investment': '#009688'
  };
  return map[name] || '#607D8B';
}

export function getStatusClass(status) {
  const map = { completed: 'completed', pending: 'pending', failed: 'failed', cancelled: 'failed' };
  return map[status] || 'pending';
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
