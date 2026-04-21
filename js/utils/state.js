// ============================================================
// js/utils/state.js  — Simple reactive state store
// ============================================================

const listeners = {};

export const State = {
  _data: {
    user: null,
    profile: null,
    theme: localStorage.getItem('theme') || 'light',
    accounts: [],
    categories: [],
    transactions: [],
    stats: { balance: 0, income: 0, expense: 0, savings: 0 },
    cashFlow: [],
    spendingBreakdown: [],
    budgets: [],
    loading: false,
    txFilter: 'all',
    txSearch: '',
    currentPage: 'dashboard'
  },

  get(key) { return this._data[key]; },

  set(key, value) {
    this._data[key] = value;
    (listeners[key] || []).forEach(fn => fn(value));
    (listeners['*'] || []).forEach(fn => fn(key, value));
  },

  on(key, fn) {
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(fn);
  },

  off(key, fn) {
    if (!listeners[key]) return;
    listeners[key] = listeners[key].filter(f => f !== fn);
  }
};
