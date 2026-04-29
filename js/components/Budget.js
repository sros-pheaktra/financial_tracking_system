// ============================================================
// js/components/Budget.js  — Budget management page
// ============================================================
import { State }    from '../utils/state.js';
import { Budgets, Categories, Transactions } from '../services/supabase.js';
import { fmt, pct, progressClass, currentMonth } from '../utils/helpers.js';
import { toast }    from './Toast.js';

// ── State ─────────────────────────────────────────────────────
let _budgets    = [];
let _categories = [];
let _spending   = {}; // categoryId → spent amount this month
let _editingId  = null;
let current = currentMonth();
let year = current.year;
let month = current.month;

// ── Public API ────────────────────────────────────────────────
export async function loadBudgetData() {
  const user = State.get('user');
  if (!user) return;

  const [budgetsRes, catsRes, spendRes] = await Promise.all([
    Budgets.list(user.id),
    Categories.list(user.id),
    Transactions.spendingByCategory(user.id, year, month),
  ]);

  _budgets    = budgetsRes.data ?? [];
  _categories = catsRes.data ?? [];
  
  _spending = {};
  (spendRes.data ?? []).forEach(tx => {
    const catId = String(tx.category_id);
    const amt = Number(tx.amount);
    if (!catId || isNaN(amt)) return;
    _spending[catId] = (_spending[catId] ?? 0) + amt;
  });
}

export async function renderBudget(container) {
  await loadBudgetData();
  container.innerHTML = budgetPageHTML();
  bindBudgetPage();
  
  // Auto‑refresh when other components change data
  window.addEventListener('data:changed', (e) => {
    if (e.detail?.type === 'transactions' || e.detail?.type === 'budgets') {
      const container = document.getElementById('content');
      if (container && container.querySelector('.budget-page')) {
        renderBudget(container);
      }
    }
  });
}



// ── HTML ──────────────────────────────────────────────────────
function budgetPageHTML() {
  const now = new Date(year, month - 1, 1);
  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  const budgets = State.get('budgets') || [];
  const txList = State.get('transactions') || [];

  const totalBudget = budgets.reduce(
    (sum, b) => sum + Number(b.amount || 0),
    0
  );

  const used = txList
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);

  const totalPct =
    totalBudget > 0
      ? Math.min(100, Math.round((used / totalBudget) * 100))
      : 0;


  const totalClass = progressClass(totalPct);

  return `
  <div class="page budget-page">

    <!-- ── Page Header ── -->
    <div class="budget-header">
      <div class="budget-header-left">
        <h2 class="budget-title">Budget Planner</h2>
        <p class="budget-subtitle">Track your spending against monthly limits</p>
      </div>
      <div class="budget-header-right">
        <div class="month-nav">
          <button class="icon-btn" id="prev-month-btn" title="Previous month">
            <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="month-label" id="month-label">${monthLabel}</span>
          <button class="icon-btn" id="next-month-btn" title="Next month">
            <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <button class="btn btn-primary" id="add-budget-btn">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Budget
        </button>
      </div>
    </div>

    <!-- ── Summary Strip ── -->
    <div class="budget-summary-strip">
      <div class="summary-card">
        <p class="label">Total Budgeted</p>
        <p class="summary-amount">${fmt(totalBudget)}</p>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-card">
        <p class="label">Total Spent</p>
        <p class="summary-amount ${totalClass === 'danger' ? 'text-danger' : ''}">${fmt(used)}</p>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-card">
        <p class="label">Remaining</p>
        <p class="summary-amount ${used > totalBudget ? 'text-danger' : 'text-income'}">${fmt(Math.max(0, totalBudget - used))}</p>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-card summary-card-wide">
        <div class="summary-overall-top">
          <p class="label">Overall Usage</p>
          <span class="pct-badge pct-badge-${totalClass}">${totalPct}%</span>
        </div>
        <div class="progress-track" style="margin-top:8px">
          <div class="progress-fill ${totalClass}" style="width:${totalPct}%"></div>
        </div>
      </div>
    </div>

    <!-- ── Budget Cards ── -->
    <div class="budget-grid" id="budget-grid">
      ${_budgets.length === 0 ? emptyStateHTML() : _budgets.map(b => budgetCardHTML(b)).join('')}
    </div>

  </div>

  <!-- ── Budget Modal ── -->
  ${budgetModalHTML()}
  `;
}

function emptyStateHTML() {
  return `
  <div class="budget-empty" id="budget-empty">
    <div class="budget-empty-icon">🎯</div>
    <h3>No budgets yet</h3>
    <p>Create your first budget to start tracking spending by category.</p>
    <button class="btn btn-primary" id="add-budget-empty-btn">
      <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Create Budget
    </button>
  </div>`;
}

function budgetCardHTML(b) {
  const catName  = b.categories?.name  ?? 'Uncategorized';
  const catIcon  = b.categories?.icon  ?? '📦';
  const catColor = b.categories?.color ?? '#607D8B';
  const amount   = Number(b.amount);

  const budgets = State.get('budgets') || [];
  const txList = State.get('transactions') || [];
  const spent = txList
  .filter(t => t.type === 'expense' && String(t.category_id) === String(b.category_id))
  .reduce((sum, t) => sum + Number(t.amount), 0);
  const remaining = amount - spent;
  const usedPct = amount > 0 ? pct(spent, amount) : 0;
  const cls = progressClass(usedPct);

  const warningBadge = usedPct >= 100
    ? `<span class="budget-badge budget-badge-over">Over Budget</span>`
    : usedPct >= 90
    ? `<span class="budget-badge budget-badge-danger">⚠ Near Limit</span>`
    : usedPct >= 70
    ? `<span class="budget-badge budget-badge-warning">Heads Up</span>`
    : `<span class="budget-badge budget-badge-safe">On Track</span>`;

  return `
  <div class="budget-card" data-id="${b.id}">
    <div class="budget-card-header">
      <div class="budget-cat-info">
        <div class="budget-cat-icon" style="background:${catColor}22;color:${catColor}">${catIcon}</div>
        <div>
          <p class="budget-cat-name">${catName}</p>
          <p class="budget-period caption">${b.period ?? 'monthly'}</p>
        </div>
      </div>
      <div class="budget-card-actions">
        ${warningBadge}
        <button class="icon-btn budget-edit-btn" data-id="${b.id}" title="Edit">
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn budget-delete-btn" data-id="${b.id}" title="Delete">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>

    <div class="budget-amounts">
      <div class="budget-amount-col">
        <p class="label">Spent</p>
        <p class="budget-spent ${cls === 'danger' ? 'text-danger' : cls === 'warning' ? 'text-warning' : ''}">${fmt(spent)}</p>
      </div>
      <div class="budget-amount-col budget-amount-center">
        <p class="label">of</p>
        <p class="budget-total">${fmt(amount)}</p>
      </div>
      <div class="budget-amount-col budget-amount-right">
        <p class="label">Left</p>
        <p class="budget-remaining ${remaining < 0 ? 'text-danger' : 'text-income'}">${remaining < 0 ? '-' + fmt(Math.abs(remaining)) : fmt(remaining)}</p>
      </div>
    </div>

    <div class="budget-progress-section">
      <div class="progress-track">
        <div class="progress-fill ${cls}" style="width:${usedPct}%; transition: width 0.6s cubic-bezier(0.4,0,0.2,1)"></div>
      </div>
      <div class="budget-progress-labels">
        <span class="caption" style="color:${catColor};font-weight:600">${usedPct}% used</span>
        <span>${fmt(Math.max(0, remaining))} left</span>
      </div>
    </div>
  </div>`;
}

function budgetModalHTML() {
  const expenseCategories = _categories.filter(c => c.type !== 'income');
  const usedCatIds = new Set(_budgets.map(b => b.category_id));

  return `
  <div class="modal-overlay" id="budget-modal-overlay">
    <div class="modal" id="budget-modal" style="max-width:440px">
      <div class="modal-header">
        <h2 id="budget-modal-title">New Budget</h2>
        <button class="icon-btn" id="budget-modal-close">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="form-group">
        <label>Category</label>
        <select id="budget-cat-select">
          <option value="">Select a category…</option>
          ${expenseCategories.map(c => {
            const disabled = usedCatIds.has(c.id) ? 'disabled' : '';
            const label    = usedCatIds.has(c.id) ? ` (already budgeted)` : '';
            return `<option value="${c.id}" data-name="${c.name}" ${disabled}>${c.icon ?? ''} ${c.name}${label}</option>`;
          }).join('')}
        </select>
      </div>

      <div class="form-group">
        <label>Monthly Limit ($)</label>
        <input type="number" id="budget-amount-input" placeholder="0.00" min="0" step="0.01" />
      </div>

      <div class="form-group">
        <label>Period</label>
        <select id="budget-period-select">
          <option value="monthly">Monthly</option>
          <option value="weekly">Weekly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" id="budget-modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="budget-modal-save">Save Budget</button>
      </div>
    </div>
  </div>`;
}

// ── Bindings ──────────────────────────────────────────────────
function bindBudgetPage() {
  // Month navigation
  document.getElementById('prev-month-btn')?.addEventListener('click', () => shiftMonth(-1));
  document.getElementById('next-month-btn')?.addEventListener('click', () => shiftMonth(+1));

  // Add budget
  document.getElementById('add-budget-btn')?.addEventListener('click', openAddModal);
  document.getElementById('add-budget-empty-btn')?.addEventListener('click', openAddModal);

  // Card actions (event delegation)
  document.getElementById('budget-grid')?.addEventListener('click', e => {
    const editBtn   = e.target.closest('.budget-edit-btn');
    const deleteBtn = e.target.closest('.budget-delete-btn');
    if (editBtn)   openEditModal(editBtn.dataset.id);
    if (deleteBtn) confirmDelete(deleteBtn.dataset.id);
  });

  // Modal controls
  document.getElementById('budget-modal-close')?.addEventListener('click',  closeModal);
  document.getElementById('budget-modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('budget-modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('budget-modal-overlay')) closeModal();
  });
  document.getElementById('budget-modal-save')?.addEventListener('click', saveBudget);
}

// ── Month Navigation ──────────────────────────────────────────
async function shiftMonth(delta) {
  month += delta;
  if (month > 12) { month = 1;  year++; }
  if (month < 1)  { month = 12; year--; }

  const now = new Date(year, month - 1, 1);
  const label = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  document.getElementById('month-label').textContent = label;

  // Re-fetch spending for new month and re-render grid
  const user = State.get('user');
  const content = document.getElementById('content');
  if (content) renderBudget(content);

}

function refreshSummaryAndGrid() {
  const content = document.getElementById('content');
  if (content) renderBudget(content);
}


function openAddModal() {
  _editingId = null;
  document.getElementById('budget-modal-title').textContent = 'New Budget';

  // categories already used in existing budgets
  const usedCatIds = new Set(
    _budgets.map(b => b.category_id)
  );

  document.querySelectorAll('#budget-cat-select option').forEach(opt => {
    if (!opt.value) return;

    const baseText =
      opt.dataset.baseText ||
      opt.textContent.replace(' (already budgeted)', '');

    opt.dataset.baseText = baseText;

    const isUsed = usedCatIds.has(opt.value);
    opt.disabled = isUsed;
    opt.textContent = isUsed
      ? `${baseText} (already budgeted)`
      : baseText;
  });

  document.getElementById('budget-cat-select').value = '';
  document.getElementById('budget-amount-input').value = '';
  document.getElementById('budget-period-select').value = 'monthly';

  document.getElementById('budget-modal-overlay').classList.add('open');
}


function openEditModal(id) {
    const usedCatIds = new Set(
    _budgets.filter(b => b.id !== id).map(b => b.category_id)
    );

    document.querySelectorAll('#budget-cat-select option').forEach(opt => {
    if (!opt.value) return;
    opt.disabled = usedCatIds.has(opt.value);
    });

  const budget = _budgets.find(b => b.id == id);
  if (!budget) return;
  _editingId = id;

  document.getElementById('budget-modal-title').textContent = 'Edit Budget';

  // Enable all options (editing allows category change)
  document.querySelectorAll('#budget-cat-select option').forEach(opt => {
    if (!opt.value) return;
    opt.disabled = false;
    opt.textContent = opt.textContent.replace(' (already budgeted)', '');
  });

  document.getElementById('budget-cat-select').value    = budget.category_id;
  document.getElementById('budget-amount-input').value  = budget.amount;
  document.getElementById('budget-period-select').value = budget.period ?? 'monthly';

  document.getElementById('budget-modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('budget-modal-overlay').classList.remove('open');
  _editingId = null;
}

async function saveBudget() {
  const user       = State.get('user');
  const categoryId = document.getElementById('budget-cat-select').value;
  const amount     = parseFloat(document.getElementById('budget-amount-input').value);
  const period     = document.getElementById('budget-period-select').value;

  if (!categoryId) return toast('Please select a category', 'error');
  if (!amount || amount <= 0) return toast('Please enter a valid amount', 'error');

  const saveBtn = document.getElementById('budget-modal-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const payload = {
  user_id: user.id,
  category_id: categoryId,
  amount,
  period,
  start_date: new Date().toISOString().split('T')[0]
};


  let error;
  if (_editingId) {
    ({ error } = await Budgets.update(_editingId, { category_id: categoryId, amount, period }));
  } else {
    ({ error } = await Budgets.create(payload));
  }

  saveBtn.disabled = false;
  saveBtn.textContent = 'Save Budget';

  if (error) {
    toast(error.message, 'error');
    return;
  }

  toast(_editingId ? 'Budget updated!' : 'Budget created!', 'success');
  closeModal();

  // Reload data and re-render
  const content = document.getElementById('content');
  if (content) renderBudget(content);

}

async function confirmDelete(id) {
  const budget  = _budgets.find(b => b.id == id);
  const catName = budget?.categories?.name ?? 'this budget';

  if (!confirm(`Delete the budget for "${catName}"? This cannot be undone.`)) return;

  const { error } = await Budgets.delete(id);
  if (error) {
    toast(error.message, 'error');
    return;
  }

  toast('Budget deleted', 'info');
  const content = document.getElementById('content');
  if (content) renderBudget(content);

}