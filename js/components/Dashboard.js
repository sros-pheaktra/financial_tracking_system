// ============================================================
// js/components/Dashboard.js
// ============================================================
import { State }    from '../utils/state.js';
import { fmt, fmtShort, fmtDate, fmtDateTime, pct, progressClass, getStatusClass, debounce }
                    from '../utils/helpers.js';
import { drawLineChart, drawBarChart, drawDonutChart, drawMiniLine }
                    from './Charts.js';
import { Transactions, Accounts, Categories, Budgets, SavingsGoals } from '../services/supabase.js';
import { openTransactionModal } from './TransactionModal.js';
import { toast }    from './Toast.js';

// ── Load all dashboard data ───────────────────────────────────
export async function loadDashboardData() {
  const user = State.get('user');
  if (!user) return;

  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth() + 1;

  const [
    { data: accounts },
    { data: categories },
    txData,
    cashFlow,
    { data: spendCats },
    { data: budgets },
    { data: savingsGoals }
  ] = await Promise.all([
    Accounts.list(user.id),
    Categories.list(user.id),
    Transactions.list(user.id, { limit: 20 }),   // returns raw array
    Transactions.last6MonthsCashFlow(user.id),
    Transactions.spendingByCategory(user.id, year, month),
    Budgets.list(user.id),
    SavingsGoals.list(user.id)
  ]);

  // Transactions.list() throws on error and returns raw array — wrap safely
  const txList = Array.isArray(txData) ? txData : [];

  const { income, expense } = await Transactions.monthlyStats(user.id, year, month);
  // Derive balance from all transactions (account.balance is not auto-updated by DB)
  const allIncome  = txList.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const allExpense = txList.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const balance = allIncome - allExpense;

  // Spending breakdown
  const hasData = spendCats && spendCats.length > 0;

const catTotals = {};

if (hasData) {
  spendCats.forEach(t => {
    const name = t.categories?.name || 'Others';
    catTotals[name] = (catTotals[name] || 0) + Number(t.amount);
  });
}

// fallback data so donut always renders
const fallback = [
  { name: 'Loading...', value: 1, color: '#607D8B', pct: 100 }
];

const totalSpend =
  Object.values(catTotals).reduce((s, v) => s + v, 0) || 1;

const breakdown = hasData
  ? Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value,
        pct: Math.round((value / totalSpend) * 100),
        color:
          spendCats.find(t => t.categories?.name === name)?.categories?.color ||
          '#607D8B'
      }))
  : fallback;

  
  State.set('accounts', accounts || []);
  State.set('categories', categories || []);
  State.set('transactions', txList);
  State.set('cashFlow', cashFlow || []);
  State.set('spendingBreakdown', breakdown);
  State.set('budgets', budgets || []);
  State.set('savingsGoals', savingsGoals || []);

  // Compute real savings figures from the savings_goals table
  const goals = savingsGoals || [];
  const totalSaved  = goals.reduce((s, g) => s + Number(g.current_amount || 0), 0);
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount  || 0), 0);

  State.set('stats', {
    balance: balance,
    income,
    expense,
    savings:       totalSaved,
    savingsTarget: totalTarget,
  });
}

// ── Module-level container ref + one-time refresh listener ───
let _dashContainer = null;

window.addEventListener('data:refresh', async () => {
  if (!_dashContainer) return;
  await loadDashboardData();

  // Surgical updates — no full innerHTML wipe, no flicker
  patchStatCards();
  renderCharts();
  renderTransactions();
  renderBudget();
  renderBreakdown();
});

// ── Render Dashboard ──────────────────────────────────────────
export async function renderDashboard(container) {
  _dashContainer = container;
  await loadDashboardData();
  container.innerHTML = dashboardHTML();
  bindDashboard();
  patchStatCards();
  renderCharts();
  renderTransactions();
  renderBudget();
  renderBreakdown();
}
function computeStats() {
  // Use the stats already computed by loadDashboardData (monthly figures + full balance)
  return State.get('stats') || { balance: 0, income: 0, expense: 0, savings: 0 };
}

// ── Patch stat card values in-place (no DOM wipe = no flicker) ─
function patchStatCards() {
  const s = computeStats();
  const cards = _dashContainer.querySelectorAll('.stat-card');
  if (!cards.length) return;

  const savingsPct = s.savingsTarget > 0
    ? Math.min(100, Math.round((s.savings / s.savingsTarget) * 100))
    : 0;

  const patches = [
    { el: cards[0]?.querySelector('h2'), val: fmt(s.balance) },
    { el: cards[1]?.querySelector('h2'), val: fmt(s.income) },
    { el: cards[2]?.querySelector('h2'), val: fmt(s.expense) },
    { el: cards[3]?.querySelector('h2'), val: fmt(s.savings) },
    { el: cards[3]?.querySelector('.stat-badge'),
      val: s.savingsTarget > 0
        ? `${savingsPct}% of ${fmt(s.savingsTarget)} goal`
        : 'No goals set yet' },
  ];
  patches.forEach(({ el, val }) => { if (el && el.textContent !== val) el.textContent = val; });

  // ── Goal-met overlay ──────────────────────────────────────────
  const overlay = document.getElementById('savings-goal-overlay');
  if (!overlay) return;

  const goalMet  = s.savingsTarget > 0 && s.savings >= s.savingsTarget;
  const wasShown = overlay.style.display === 'flex';

  if (goalMet) {
    const amountEl = document.getElementById('savings-goal-amount');
    if (amountEl) amountEl.textContent = fmt(s.savings);
    if (!wasShown) {
      overlay.style.display = 'flex';
      overlay.style.animation = 'none';
      overlay.offsetHeight; // reflow
      overlay.style.animation = '';
    }
  } else {
    overlay.style.display = 'none';
  }
}

function dashboardHTML() {
  const s = computeStats();
  const profile = State.get('profile');

  return `
  <div class="page">
    <!-- Stat Cards -->
    <div class="stat-grid">
      ${statCard('Total Balance', fmt(s.balance), '', 'up',
        '#6366F1', dollarIcon(), 'balance-chart')}
      ${statCard('Monthly Income', fmt(s.income), '', 'up',
        '#10B981', trendUpIcon(), 'income-chart')}
      ${statCard('Monthly Expenses', fmt(s.expense), '', 'down',
        '#F43F5E', trendDownIcon(), 'expense-chart')}
      ${statCard('Savings Growth', fmt(s.savings),
        s.savingsTarget > 0
          ? `${Math.min(100, Math.round((s.savings / s.savingsTarget) * 100))}% of ${fmt(s.savingsTarget)} goal`
          : 'No goals set yet',
        '',
        '#F59E0B', piggyIcon(), 'savings-chart', true)}
    </div>

    <!-- Add Savings Modal -->
    <div id="savings-modal-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1000;align-items:center;justify-content:center">
      <div style="background:var(--bg-card);border-radius:16px;padding:28px 28px 24px;width:360px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.25)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <div>
            <h3 style="font-size:16px;font-weight:700;color:var(--text-primary);margin:0">Add to Savings Goal</h3>
            <p style="font-size:13px;color:var(--text-muted);margin:2px 0 0">Contribute toward one of your savings goals</p>
          </div>
          <button id="savings-modal-close" style="background:var(--bg-input);border:none;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:18px;color:var(--text-secondary);display:flex;align-items:center;justify-content:center">&times;</button>
        </div>
        <div id="savings-goal-selector-wrap" style="margin-bottom:14px">
          <label style="font-size:13px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px">Goal</label>
          <select id="savings-goal-select" style="width:100%;height:42px;border:1.5px solid var(--border);border-radius:10px;background:var(--bg-input);color:var(--text-primary);font-size:14px;padding:0 12px;outline:none;cursor:pointer">
            ${(State.get('savingsGoals') || [])
              .filter(g => g.status !== 'completed')
              .map(g => {
                const pctDone = g.target_amount > 0
                  ? Math.min(100, Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100))
                  : 0;
                return `<option value="${g.id}">${g.icon || '🎯'} ${g.name} — ${pctDone}% saved</option>`;
              }).join('') || '<option disabled>No active goals</option>'}
          </select>
        </div>
        <label style="font-size:13px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px">Amount</label>
        <div style="display:flex;align-items:center;border:1.5px solid var(--border);border-radius:10px;overflow:hidden;background:var(--bg-input)">
          <span style="padding:0 12px;font-size:15px;color:var(--text-muted);border-right:1.5px solid var(--border);height:42px;display:flex;align-items:center">$</span>
          <input id="savings-amount-input" type="number" min="0" placeholder="0.00"
            style="flex:1;border:none;outline:none;background:transparent;padding:0 12px;height:42px;font-size:15px;font-family:var(--font-display);color:var(--text-primary)" />
        </div>
        <p id="savings-modal-error" style="color:#F43F5E;font-size:12px;margin:6px 0 0;min-height:16px"></p>
        <div style="display:flex;gap:10px;margin-top:18px">
          <button id="savings-modal-cancel" style="flex:1;height:40px;border:1.5px solid var(--border);background:transparent;border-radius:10px;cursor:pointer;font-size:14px;font-weight:600;color:var(--text-secondary)">Cancel</button>
          <button id="savings-modal-confirm" style="flex:1;height:40px;background:#F59E0B;border:none;border-radius:10px;cursor:pointer;font-size:14px;font-weight:700;color:#fff">Confirm</button>
        </div>
      </div>
    </div>

    <!-- Chart Grid -->
    <div class="chart-grid">
      <!-- Income vs Expenses -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div><h3>Income vs Expenses</h3><p>6-month overview</p></div>
          <select class="period-select" id="cashflow-period">
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
        <canvas id="income-expense-chart" style="width:100%;height:200px;display:block;margin-top:8px"></canvas>
        <div class="chart-legend" style="margin-top:10px">
          <div class="legend-item">
            <div class="legend-dot" style="background:var(--income)"></div> Income
          </div>
          <div class="legend-item">
            <div class="legend-dot" style="background:var(--expense)"></div> Expense
          </div>
          <div style="margin-left:auto;font-size:13px;color:var(--text-secondary)">
            Avg. net: <strong style="color:var(--income)" id="avg-net">—</strong>
          </div>
        </div>
      </div>

      <!-- Cash Flow -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div><h3>Cash Flow</h3><p>Monthly net cash flow</p></div>
          <select class="period-select">
            <option>Monthly</option>
          </select>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin:10px 0 4px">
          <span id="cf-selected-month" style="background:var(--expense-soft);color:var(--expense);padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600"></span>
          <span style="font-size:13px;color:var(--text-muted)">selected</span>
          <span id="cf-selected-val" style="margin-left:auto;font-family:var(--font-display);font-size:18px;font-weight:800"></span>
        </div>
        <canvas id="cashflow-chart" style="width:100%;height:180px;display:block"></canvas>
      </div>

      <!-- Spending Breakdown -->
      <div class="chart-card">
        <div class="chart-card-header" style="justify-content:space-between">
          <div><h3>Spending Breakdown</h3><p>Expense distribution</p></div>
          <button class="icon-btn" style="border:none">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>
        </div>
        <div class="donut-wrap" style="width:140px;height:140px;position:relative;margin:16px auto 10px">
          <canvas id="donut-chart"></canvas>
          <div class="donut-label">
            <strong id="expenses-donut">
          </div>
        </div>
        <div class="breakdown-legend" id="breakdown-legend"></div>
      </div>
    </div>

    <!-- Bottom Grid -->
    <div class="bottom-grid">
      <!-- Transactions -->
      <div class="transactions-card">
        <div class="transactions-header">
          <div><h3>Latest Transactions</h3><p>Monitor your recent financial activities</p></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <div class="transactions-search">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input id="tx-search" placeholder="Search transactions…" />
            </div>
            <div class="filter-tabs">
              <button class="filter-tab active" data-filter="all">All</button>
              <button class="filter-tab" data-filter="expense">Send</button>
              <button class="filter-tab" data-filter="income">Receive</button>
            </div>
            <button class="btn btn-primary" id="add-tx-btn" style="height:34px;padding:0 12px">
              <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add
            </button>
          </div>
        </div>
        <div class="table-wrap" id="transactions-table"></div>
      </div>

      <!-- Budget Planner -->
      <div class="side-card" id="budget-card">
        <h3>Budget Planner</h3>
        <p class="sub">Monthly budgets & usage</p>
        <div id="budget-content"></div>
      </div>
    </div>
  </div>`;
}

function statCard(label, value, sub, trend, color, icon, chartId, showSaveBtn = false) {
  return `
  <div class="stat-card" id="${showSaveBtn ? 'savings-stat-card' : ''}" style="position:relative;overflow:hidden">
    <div class="stat-card-header">
      <p>${label}</p>
      <div class="stat-icon" style="background:${color}22;color:${color}">${icon}</div>
    </div>
    <h2 id="${showSaveBtn ? 'savings-value' : ''}">${value}</h2>
    <span class="stat-badge ${trend}" id="${showSaveBtn ? 'savings-badge' : ''}">${sub}</span>
    ${showSaveBtn ? `
    <button id="add-savings-btn" style="
      margin-top:10px;width:100%;height:32px;
      background:${color}18;border:1.5px solid ${color}44;
      border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;
      color:${color};display:flex;align-items:center;justify-content:center;gap:5px;
      transition:background 0.15s">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Savings
    </button>` : ''}
    <canvas class="mini-chart" id="${chartId}" style="width:100%;height:44px;display:block;margin-top:${showSaveBtn ? '8px' : '0'}"></canvas>
    ${showSaveBtn ? `
    <!-- Goal-met celebration overlay — hidden until savings >= goal -->
    <div id="savings-goal-overlay" style="
      display:none;position:absolute;inset:0;
      background:linear-gradient(135deg,#78350f 0%,#92400e 40%,#d97706 100%);
      border-radius:inherit;padding:14px 16px 12px;
      flex-direction:column;align-items:center;justify-content:center;gap:6px;
      text-align:center;animation:savingsGoalIn 0.5s cubic-bezier(.22,1,.36,1) both">
      <div style="font-size:28px;line-height:1;animation:savingsBounce 0.6s 0.3s both">🎉</div>
      <div style="font-size:13px;font-weight:800;color:#fef3c7;letter-spacing:0.04em;text-transform:uppercase">Goal Reached!</div>
      <div id="savings-goal-amount" style="font-size:20px;font-weight:900;color:#fff;font-family:var(--font-display)"></div>
      <div style="font-size:11px;color:#fde68a;line-height:1.4;max-width:160px">
        You've hit your savings target. Amazing work! 🏆
      </div>
      <div style="
        margin-top:4px;width:100%;height:4px;border-radius:4px;
        background:rgba(255,255,255,0.2);overflow:hidden">
        <div style="width:100%;height:100%;background:#fff;border-radius:4px;
          animation:savingsBar 1s 0.5s cubic-bezier(.22,1,.36,1) both;transform-origin:left"></div>
      </div>
    </div>
    <style>
      @keyframes savingsGoalIn {
        from { opacity:0; transform:scale(0.92); }
        to   { opacity:1; transform:scale(1); }
      }
      @keyframes savingsBounce {
        0%   { transform:scale(0) rotate(-15deg); }
        60%  { transform:scale(1.3) rotate(8deg); }
        100% { transform:scale(1) rotate(0deg); }
      }
      @keyframes savingsBar {
        from { transform:scaleX(0); }
        to   { transform:scaleX(1); }
      }
    </style>` : ''}
  </div>`;
}

// ── Bind events ───────────────────────────────────────────────
function bindDashboard() {
  // Add transaction
  document.getElementById('add-tx-btn')?.addEventListener('click', () => openTransactionModal());
  document.getElementById('add-tx-hbtn')?.addEventListener('click', () => openTransactionModal());

  // Savings modal
  const overlay   = document.getElementById('savings-modal-overlay');
  const input     = document.getElementById('savings-amount-input');
  const errorEl   = document.getElementById('savings-modal-error');

  function openSavingsModal() {
    if (input)   input.value = '';
    if (errorEl) errorEl.textContent = '';
    // Refresh the goal selector with the latest goals from State
    const goalSelect = document.getElementById('savings-goal-select');
    if (goalSelect) {
      const activeGoals = (State.get('savingsGoals') || []).filter(g => g.status !== 'completed');
      goalSelect.innerHTML = activeGoals.length
        ? activeGoals.map(g => {
            const pctDone = g.target_amount > 0
              ? Math.min(100, Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100))
              : 0;
            return `<option value="${g.id}">${g.icon || '🎯'} ${g.name} — ${pctDone}% saved</option>`;
          }).join('')
        : '<option disabled>No active goals — create one on the Goals page</option>';
    }
    if (overlay) { overlay.style.display = 'flex'; input?.focus(); }
  }
  function closeSavingsModal() {
    if (overlay) overlay.style.display = 'none';
  }

  document.getElementById('add-savings-btn')?.addEventListener('click', openSavingsModal);
  document.getElementById('savings-modal-close')?.addEventListener('click', closeSavingsModal);
  document.getElementById('savings-modal-cancel')?.addEventListener('click', closeSavingsModal);
  overlay?.addEventListener('click', e => { if (e.target === overlay) closeSavingsModal(); });

  document.getElementById('savings-modal-confirm')?.addEventListener('click', async () => {
    const val = parseFloat(input?.value);
    if (!val || val <= 0) {
      if (errorEl) errorEl.textContent = 'Please enter a valid amount.';
      return;
    }

    // Identify which goal to contribute to
    const goals       = State.get('savingsGoals') || [];
    const activeGoals = goals.filter(g => g.status !== 'completed');

    if (activeGoals.length === 0) {
      if (errorEl) errorEl.textContent = 'No active savings goals. Create one on the Goals page.';
      return;
    }

    // Use goal selector if rendered, else pick the first active goal
    const goalSelectEl = document.getElementById('savings-goal-select');
    const goalId = goalSelectEl?.value || activeGoals[0].id;
    const goal   = goals.find(g => g.id === goalId);
    if (!goal) { if (errorEl) errorEl.textContent = 'Goal not found.'; return; }

    const confirmBtn = document.getElementById('savings-modal-confirm');
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Saving…'; }

    const newAmount = Number(goal.current_amount) + val;
    const newStatus = newAmount >= Number(goal.target_amount) ? 'completed' : goal.status;
    const { error } = await SavingsGoals.update(goalId, {
      current_amount: newAmount,
      status: newStatus
    });

    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm'; }

    if (error) {
      if (errorEl) errorEl.textContent = error.message;
      return;
    }

    closeSavingsModal();
    await loadDashboardData();
    patchStatCards();
    renderCharts();
    const msg = newStatus === 'completed'
      ? `🎉 Goal "${goal.name}" completed!`
      : `$${val.toLocaleString()} added to "${goal.name}"!`;
    toast(msg, 'success');
  });
  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.set('txFilter', btn.dataset.filter);
      renderTransactions();
    });
  });

  // Search
  const searchInput = document.getElementById('tx-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      State.set('txSearch', searchInput.value);
      renderTransactions();
    }, 250));
  }
}

// ── Render Charts ─────────────────────────────────────────────
function renderCharts() {
  const flow   = State.get('cashFlow');
  const labels = flow.map(f => f.month);

  // Income vs Expenses — custom renderer matching reference design
  const iec = document.getElementById('income-expense-chart');
  if (iec) {
    drawIncomeExpenseChart(iec, flow);
    const avgNet = flow.reduce((s, f) => s + f.net, 0) / (flow.length || 1);
    const el = document.getElementById('avg-net');
    if (el) el.textContent = (avgNet >= 0 ? '+' : '') + fmt(avgNet);
  }

  // Cash flow bar chart
  const cfc = document.getElementById('cashflow-chart');
  if (cfc) {
    const last = flow[flow.length - 1];
    const el = document.getElementById('cf-selected-month');
    const vEl = document.getElementById('cf-selected-val');
    if (el && last)  el.textContent  = last.month;
    if (vEl && last) vEl.textContent = '$' + last.net.toLocaleString();
    drawBarChart(cfc,
      flow.map(f => f.net),
      labels,
      flow.map(() => '#FF4444'),
      { highlight: flow.length - 1, id: 'cashflow-chart' }
    );
  }

  // Mini sparklines
  const incomeData  = flow.map(f => f.income);
  const expenseData = flow.map(f => f.expense);
  drawMiniLine(document.getElementById('balance-chart'),  incomeData, '#6366F1');
  drawMiniLine(document.getElementById('income-chart'),   incomeData, '#10B981');
  drawMiniLine(document.getElementById('expense-chart'),  expenseData, '#F43F5E');
  // Use real total saved across all goals for the savings sparkline
  const totalSaved = (State.get('savingsGoals') || []).reduce((s, g) => s + Number(g.current_amount || 0), 0);
  drawMiniLine(document.getElementById('savings-chart'),
    incomeData.map(() => totalSaved), '#F59E0B');
}

// ── Income vs Expenses Chart — with hover tooltip & crosshair ─
function drawIncomeExpenseChart(canvas, flow) {
  if (!canvas || !flow.length) return;

  // Remove any existing listener clone to avoid stacking handlers
  const fresh = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(fresh, canvas);
  canvas = fresh;
  // Re-bind the id so renderCharts can still find it
  canvas.id = 'income-expense-chart';

  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.offsetWidth;
  const H   = canvas.offsetHeight || 200;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const css       = prop => getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  const cardBg    = () => css('--bg-card')       || '#fff';
  const textMain  = () => css('--text-primary')  || '#0F1117';
  const textMuted = () => css('--text-muted')    || '#9CA3AF';
  const textSec   = () => css('--text-secondary')|| '#6B7280';
  const gridColor = () => css('--border')        || '#E8E9EF';

  const pad = { top: 12, right: 16, bottom: 30, left: 44 };
  const pw  = W - pad.left - pad.right;
  const ph  = H - pad.top  - pad.bottom;

  const allVals = [...flow.map(f => f.income), ...flow.map(f => f.expense)];
  const dataMax  = Math.max(...allVals, 0);
  const tickCount = 5;
  const step      = dataMax / tickCount || 1;
  const yMax      = dataMax || step * tickCount;
  const yTicks    = Array.from({ length: tickCount + 1 }, (_, i) => i * step);

  function xOf(i) { return pad.left + (i / (flow.length - 1)) * pw; }
  function yOf(v) { return pad.top  + ph * (1 - v / yMax); }

  // ── Core draw (static layer) ──────────────────────────────
  function drawBase() {
    ctx.clearRect(0, 0, W, H);

    // Grid & Y labels
    ctx.save();
    ctx.font      = `11px 'DM Sans', sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = textMuted();
    yTicks.forEach(v => {
      const y = yOf(v);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = gridColor();
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + pw, y); ctx.stroke();
      ctx.restore();
      const label = v === 0 ? '0' : v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'k' : v.toFixed(0);
      ctx.fillText(label, pad.left - 6, y + 4);
    });
    ctx.restore();

    // X labels
    ctx.save();
    ctx.font      = `11px 'DM Sans', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = textMuted();
    flow.forEach((f, i) => ctx.fillText(f.month, xOf(i), H - 6));
    ctx.restore();

    drawDataset(flow.map(f => f.expense), '#EF4444');
    drawDataset(flow.map(f => f.income),  '#22C55E');
  }

  function smoothPath(pts) {
    if (pts.length < 2) return;
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i+1].x) / 2;
      ctx.bezierCurveTo(mx, pts[i].y, mx, pts[i+1].y, pts[i+1].x, pts[i+1].y);
    }
  }

  function drawDataset(values, color, highlightIdx = -1) {
    const pts = values.map((v, i) => ({ x: xOf(i), y: yOf(v) }));

    // Fill
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ph);
    grad.addColorStop(0, color + '28');
    grad.addColorStop(1, color + '00');
    ctx.save();
    ctx.beginPath();
    smoothPath(pts);
    ctx.lineTo(pts[pts.length-1].x, pad.top + ph);
    ctx.lineTo(pts[0].x, pad.top + ph);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // Stroke
    ctx.save();
    ctx.beginPath();
    smoothPath(pts);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2.5;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.restore();

    // Dots
    pts.forEach((p, i) => {
      const isHot = i === highlightIdx;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isHot ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle   = color;
      ctx.fill();
      ctx.lineWidth   = isHot ? 3 : 2.5;
      ctx.strokeStyle = cardBg();
      ctx.stroke();
    });
  }

  // ── Hover overlay ─────────────────────────────────────────
  function drawHover(idx) {
    drawBase();
    if (idx < 0 || idx >= flow.length) return;

    const f  = flow[idx];
    const x  = xOf(idx);

    // Vertical crosshair line
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = textSec() + '88';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + ph);
    ctx.stroke();
    ctx.restore();

    // Re-draw datasets with highlighted dot
    drawDataset(flow.map(f => f.expense), '#EF4444', idx);
    drawDataset(flow.map(f => f.income),  '#22C55E', idx);

    // ── Tooltip box ──────────────────────────────────────────
    const INCOME_COLOR  = '#22C55E';
    const EXPENSE_COLOR = '#EF4444';
    const NET_POSITIVE  = f.net >= 0;

    const lines = [
      { label: f.month,           value: null,          color: textMain()   },
      { label: 'Income',          value: fmt(f.income), color: INCOME_COLOR  },
      { label: 'Expense',         value: fmt(f.expense),color: EXPENSE_COLOR },
      { label: 'Net',             value: (NET_POSITIVE ? '+' : '') + fmt(f.net),
        color: NET_POSITIVE ? INCOME_COLOR : EXPENSE_COLOR },
    ];

    const FONT_SIZE  = 12;
    const LINE_H     = 20;
    const PAD_X      = 12;
    const PAD_Y      = 10;
    const TIP_W      = 148;
    const TIP_H      = PAD_Y * 2 + LINE_H * lines.length;
    const RADIUS     = 8;

    // Position: prefer right of cursor, flip left near edge
    let tx = x + 14;
    if (tx + TIP_W > W - 4) tx = x - TIP_W - 14;
    let ty = pad.top + 4;
    if (ty + TIP_H > H - pad.bottom) ty = H - pad.bottom - TIP_H - 4;

    // Shadow
    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur    = 16;
    ctx.shadowOffsetY = 4;

    // Box
    ctx.beginPath();
    ctx.moveTo(tx + RADIUS, ty);
    ctx.lineTo(tx + TIP_W - RADIUS, ty);
    ctx.quadraticCurveTo(tx + TIP_W, ty, tx + TIP_W, ty + RADIUS);
    ctx.lineTo(tx + TIP_W, ty + TIP_H - RADIUS);
    ctx.quadraticCurveTo(tx + TIP_W, ty + TIP_H, tx + TIP_W - RADIUS, ty + TIP_H);
    ctx.lineTo(tx + RADIUS, ty + TIP_H);
    ctx.quadraticCurveTo(tx, ty + TIP_H, tx, ty + TIP_H - RADIUS);
    ctx.lineTo(tx, ty + RADIUS);
    ctx.quadraticCurveTo(tx, ty, tx + RADIUS, ty);
    ctx.closePath();
    ctx.fillStyle = cardBg();
    ctx.fill();
    ctx.restore();

    // Border
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(tx + RADIUS, ty);
    ctx.lineTo(tx + TIP_W - RADIUS, ty);
    ctx.quadraticCurveTo(tx + TIP_W, ty, tx + TIP_W, ty + RADIUS);
    ctx.lineTo(tx + TIP_W, ty + TIP_H - RADIUS);
    ctx.quadraticCurveTo(tx + TIP_W, ty + TIP_H, tx + TIP_W - RADIUS, ty + TIP_H);
    ctx.lineTo(tx + RADIUS, ty + TIP_H);
    ctx.quadraticCurveTo(tx, ty + TIP_H, tx, ty + TIP_H - RADIUS);
    ctx.lineTo(tx, ty + RADIUS);
    ctx.quadraticCurveTo(tx, ty, tx + RADIUS, ty);
    ctx.closePath();
    ctx.strokeStyle = gridColor();
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.restore();

    // Text rows
    ctx.save();
    ctx.font = `${FONT_SIZE}px 'DM Sans', sans-serif`;
    lines.forEach((row, i) => {
      const rowY = ty + PAD_Y + i * LINE_H + FONT_SIZE * 0.85;
      if (row.value === null) {
        // Month header — bold, centered
        ctx.font      = `700 13px 'DM Sans', sans-serif`;
        ctx.fillStyle = textMain();
        ctx.textAlign = 'center';
        ctx.fillText(row.label, tx + TIP_W / 2, rowY);
        ctx.font      = `${FONT_SIZE}px 'DM Sans', sans-serif`;
      } else {
        // Color dot
        ctx.beginPath();
        ctx.arc(tx + PAD_X + 4, rowY - 3.5, 4, 0, Math.PI * 2);
        ctx.fillStyle = row.color;
        ctx.fill();
        // Label
        ctx.fillStyle = textSec();
        ctx.textAlign = 'left';
        ctx.fillText(row.label, tx + PAD_X + 14, rowY);
        // Value — right-aligned
        ctx.fillStyle = row.color;
        ctx.textAlign = 'right';
        ctx.font      = `600 ${FONT_SIZE}px 'DM Sans', sans-serif`;
        ctx.fillText(row.value, tx + TIP_W - PAD_X, rowY);
        ctx.font      = `${FONT_SIZE}px 'DM Sans', sans-serif`;
      }
    });
    ctx.restore();
  }

  // ── Mouse event: snap to nearest data point ───────────────
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    // Find closest data index
    let closest = 0, minDist = Infinity;
    flow.forEach((_, i) => {
      const d = Math.abs(xOf(i) - mx);
      if (d < minDist) { minDist = d; closest = i; }
    });
    // Only activate inside the chart area (with a small buffer)
    if (mx < pad.left - 8 || mx > W - pad.right + 8) {
      drawBase();
    } else {
      canvas.style.cursor = 'crosshair';
      drawHover(closest);
    }
  }

  function onMouseLeave() {
    canvas.style.cursor = '';
    drawBase();
  }

  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseleave', onMouseLeave);

  // Initial render
  drawBase();
}

function renderBreakdown() {
  const segments = State.get('spendingBreakdown') || [];
  const stats = computeStats(); // ✅ get stats object
  const canvas = document.getElementById('donut-chart');

  // ✅ Update donut center label (use expense, not income)
  const donutLabel = document.getElementById('expenses-donut');
  if (donutLabel) {
    donutLabel.textContent = `$${stats.expense.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  if (canvas && segments.length) {
    drawDonutChart(canvas, segments);
  }

  const legend = document.getElementById('breakdown-legend');
  if (legend) {
    legend.innerHTML = segments.slice(0, 6).map(s => `
      <div class="legend-row">
        <div class="legend-color" style="background:${s.color}"></div>
        <span>${s.name}</span>
        <span class="legend-pct">${s.pct}%</span>
      </div>
    `).join('');
  }
}


// ── Render Transactions ───────────────────────────────────────
export function renderTransactions() {
  const container = document.getElementById('transactions-table');
  if (!container) return;

  const filter  = State.get('txFilter');
  const search  = (State.get('txSearch') || '').toLowerCase();
  let txList    = State.get('transactions') || [];

  if (filter !== 'all') txList = txList.filter(t => t.type === filter);
  if (search) txList = txList.filter(t =>
    t.description?.toLowerCase().includes(search) ||
    t.categories?.name?.toLowerCase().includes(search)
  );

  if (!txList.length) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <p>No transactions found</p>
    </div>`;
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Date & Time</th>
          <th>Type</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${txList.map(tx => txRow(tx)).join('')}
      </tbody>
    </table>`;

  container.querySelectorAll('tbody tr').forEach((row, i) => {
    row.addEventListener('click', () => openTransactionModal(txList[i]));
  });
}

function txRow(tx) {
  const cat   = tx.categories;
  const isIncome = tx.type === 'income';
  const icon  = cat?.icon || (isIncome ? '💰' : '💳');
  const color = cat?.color || (isIncome ? 'var(--income-soft)' : 'var(--expense-soft)');

  return `
  <tr>
    <td>
      <div class="tx-merchant">
        <div class="tx-icon" style="background:${color}">${icon}</div>
        <div>
          <div class="tx-name">${tx.description || 'Unknown'}</div>
          <div class="tx-cat">${cat?.name || tx.type}</div>
        </div>
      </div>
    </td>
    <td style="color:var(--text-secondary);font-size:13px"> ${fmtDate(tx.date, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} </td>
    <td> <span style=" display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:500; background:${isIncome ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}; color:${isIncome ? '#22c55e' : '#ef4444'}; "> ${isIncome ? '↓ Receive' : '↑ Send'} </span> </td>
    <td class="amount-cell ${isIncome ? 'income' : 'expense'}">
      ${isIncome ? '+' : '-'}${fmt(tx.amount)}
    </td>
    <td><span class="status-badge ${getStatusClass(tx.status)}">${tx.status}</span></td>
    <td style="font-size:13px;color:var(--text-muted);max-width:160px">
      ${tx.notes
        ? `<span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px" title="${tx.notes.replace(/"/g,'&quot;')}">${tx.notes}</span>`
        : `<span style="color:var(--border)">—</span>`}
    </td>
  </tr>`;
}

// ── Render Budget ─────────────────────────────────────────────
function renderBudget() {
  const el = document.getElementById('budget-content');
  if (!el) return;

  const profile = State.get('profile');
  const stats   = State.get('stats');
  const budgets = State.get('budgets') || [];
  const txList = State.get('transactions') || [];

  const totalBudget = budgets.reduce(
    (sum, b) => sum + Number(b.amount || 0),
    0
  );

  const used = txList
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);

  const usedPct =
    totalBudget > 0
      ? Math.min(100, Math.round((used / totalBudget) * 100))
      : 0;


  let html = `
    <div class="budget-overall">
      <div class="row">
        <span style="font-size:13px;color:var(--text-secondary)">Overall usage</span>
        <span class="budget-pct">${usedPct}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill ${progressClass(usedPct)}" style="width:${usedPct}%"></div>
      </div>
      <p class="budget-sub">${fmt(used)} spent of ${fmt(totalBudget)} budget</p>
    </div>`;

  if (budgets.length) {
    html += `<div class="budget-items">`;
    budgets.forEach(b => {
      const cat = b.categories;

      const bUsed = txList
        .filter(t =>
          t.type === 'expense' &&
          t.category_id === b.category_id
        )
        .reduce((s, t) => s + Number(t.amount), 0);

      const bPct = b.amount > 0
        ? Math.min(100, Math.round((bUsed / b.amount) * 100))
        : 0;

      html += `
        <div class="budget-item-row">
          <div class="budget-item-icon" style="background:${cat?.color || '#eee'}22">
            ${cat?.icon || '📦'}
          </div>

          <div class="budget-item-info">
            <div class="budget-item-head">
              <span class="budget-item-name">${cat?.name || 'Unknown'}</span>
              <span class="budget-item-amt">${fmt(bUsed)} / ${fmt(b.amount)}</span>
            </div>

            <div class="progress-track sm">
              <div class="progress-fill ${progressClass(bPct)}" style="width:${bPct}%"></div>
            </div>
          </div>
        </div>`;
    });

    html += `</div>`;
  } else {
    html += `<p style="font-size:13px;color:var(--text-muted);margin-top:16px;text-align:center">
      No budgets set yet.
    </p>`;
  }

  el.innerHTML = html;
}

// ── SVG Icons ─────────────────────────────────────────────────
const svgIcon = d => `<svg viewBox="0 0 24 24">${d}</svg>`;
const dollarIcon  = () => svgIcon('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>');
const trendUpIcon = () => svgIcon('<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>');
const trendDownIcon = () => svgIcon('<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>');
const piggyIcon   = () => svgIcon('<path d="M19 6A7 7 0 0 0 5 6c-2 0-3 1-3 3 0 3 4 8 5 9h10c1-1 5-6 5-9 0-2-1-3-3-3Z"/><path d="M9 12h.01M15 12h.01"/>');