// ============================================================
// js/components/Dashboard.js
// ============================================================
import { State }    from '../utils/state.js';
import { fmt, fmtShort, fmtDate, fmtDateTime, pct, progressClass, getStatusClass, debounce }
                    from '../utils/helpers.js';
import { drawLineChart, drawBarChart, drawDonutChart, drawMiniLine }
                    from './Charts.js';
import { Transactions, Accounts, Categories, Budgets } from '../services/supabase.js';
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
    { data: budgets }
  ] = await Promise.all([
    Accounts.list(user.id),
    Categories.list(user.id),
    Transactions.list(user.id, { limit: 20 }),
    Transactions.last6MonthsCashFlow(user.id),
    Transactions.spendingByCategory(user.id, year, month),
    Budgets.list(user.id)
  ]);

  const balance = (accounts || []).reduce((s, a) => s + Number(a.balance), 0);
  const { income, expense } = await Transactions.monthlyStats(user.id, year, month);

  // Spending breakdown
  const catTotals = {};
  (spendCats || []).forEach(t => {
    const name = t.categories?.name || 'Others';
    catTotals[name] = (catTotals[name] || 0) + Number(t.amount);
  });
  const totalSpend = Object.values(catTotals).reduce((s, v) => s + v, 0) || 1;
  const breakdown  = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name, value,
      pct: Math.round((value / totalSpend) * 100),
      color: spendCats?.find(t => t.categories?.name === name)?.categories?.color || '#607D8B'
    }));

  State.set('accounts', accounts || []);
  State.set('categories', categories || []);
  State.set('transactions', txData || []);  // already correct, just needs txData to be right
  State.set('cashFlow', cashFlow || []);
  State.set('spendingBreakdown', breakdown);
  State.set('budgets', budgets || []);
  State.set('stats', { balance, income, expense, savings: balance * 0.114 });
}

// ── Render Dashboard ──────────────────────────────────────────
export function renderDashboard(container) {
  container.innerHTML = dashboardHTML();
  bindDashboard();
  renderCharts();
  renderTransactions();
  renderBudget();
  renderBreakdown();
}

function dashboardHTML() {
  const s = State.get('stats');
  const profile = State.get('profile');

  return `
  <div class="page">
    <!-- Stat Cards -->
    <div class="stat-grid">
      ${statCard('Total Balance', fmt(s.balance), '+8% from last month', 'up',
        '#6366F1', dollarIcon(), 'balance-chart')}
      ${statCard('Monthly Income', fmtShort(s.income), 'Stable growth', 'up',
        '#10B981', trendUpIcon(), 'income-chart')}
      ${statCard('Monthly Expenses', fmtShort(s.expense), '-3% reduced spending', 'down',
        '#F43F5E', trendDownIcon(), 'expense-chart')}
      ${statCard('Savings Growth', fmtShort(s.savings),
        `Goal: ${fmt(profile?.savings_goal || 5000)}`, 'neutral',
        '#F59E0B', piggyIcon(), 'savings-chart')}
    </div>

    <!-- Chart Grid -->
    <div class="chart-grid">
      <!-- Income vs Expenses -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div><h3>Income vs Expenses</h3><p>6-month overview</p></div>
          <select class="period-select" id="cashflow-period">
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
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
            <strong>100%</strong><span>Total</span>
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

function statCard(label, value, sub, trend, color, icon, chartId) {
  const isDown = trend === 'down';
  return `
  <div class="stat-card">
    <div class="stat-card-header">
      <p>${label}</p>
      <div class="stat-icon" style="background:${color}22;color:${color}">${icon}</div>
    </div>
    <h2>${value}</h2>
    <span class="stat-badge ${trend}">${sub}</span>
    <canvas class="mini-chart" id="${chartId}" style="width:100%;height:44px;display:block"></canvas>
  </div>`;
}

// ── Bind events ───────────────────────────────────────────────
function bindDashboard() {
  // Add transaction
  document.getElementById('add-tx-btn')?.addEventListener('click', () => openTransactionModal());

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

  // Listen for data refresh
  window.addEventListener('data:refresh', async () => {
  await loadDashboardData();
  renderCharts();
  renderTransactions();
  renderBudget();
  renderBreakdown();
});  
}

// ── Render Charts ─────────────────────────────────────────────
function renderCharts() {
  const flow   = State.get('cashFlow');
  const labels = flow.map(f => f.month);

  // Income vs Expenses line chart
  const iec = document.getElementById('income-expense-chart');
  if (iec) {
    drawLineChart(iec,
      [
        { values: flow.map(f => f.income),  color: 'var(--income)' },
        { values: flow.map(f => f.expense), color: 'var(--expense)' }
      ],
      labels, { minZero: true }
    );
    const avgNet = flow.reduce((s, f) => s + f.net, 0) / (flow.length || 1);
    const el = document.getElementById('avg-net');
    if (el) el.textContent = '+' + fmt(avgNet);
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
      { highlight: flow.length - 1 }
    );
  }

  // Mini sparklines
  const incomeData  = flow.map(f => f.income);
  const expenseData = flow.map(f => f.expense);
  const s = State.get('stats');
  drawMiniLine(document.getElementById('balance-chart'),  incomeData, '#6366F1');
  drawMiniLine(document.getElementById('income-chart'),   incomeData, '#10B981');
  drawMiniLine(document.getElementById('expense-chart'),  expenseData, '#F43F5E');
  drawMiniLine(document.getElementById('savings-chart'),
    incomeData.map(v => v * 0.114), '#F59E0B');
}

function renderBreakdown() {
  const segments = State.get('spendingBreakdown');
  const canvas = document.getElementById('donut-chart');
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
      </div>`).join('');
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
  console.log('Raw txList length:', txList.length);

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
    <td style="color:var(--text-secondary);font-size:13px">${fmtDate(tx.date, { month: 'short', day: 'numeric' })}</td>
    <td style="color:var(--text-secondary);font-size:13px;text-transform:capitalize">
      ${isIncome ? '↓ Receive' : '↑ Send'}
    </td>
    <td class="amount-cell ${isIncome ? 'income' : 'expense'}">
      ${isIncome ? '+' : '-'}${fmt(tx.amount)}
    </td>
    <td><span class="status-badge ${getStatusClass(tx.status)}">${tx.status}</span></td>
  </tr>`;
}

// ── Render Budget ─────────────────────────────────────────────
function renderBudget() {
  const el = document.getElementById('budget-content');
  if (!el) return;

  const profile = State.get('profile');
  const stats   = State.get('stats');
  const budgets = State.get('budgets');
  const totalBudget = profile?.monthly_budget || 6000;
  const used    = stats.expense;
  const usedPct = pct(used, totalBudget);

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
      const cat   = b.categories;
      const bUsed = stats.expense * 0.2; // simplified
      const bPct  = pct(bUsed, b.amount);
      html += `
      <div class="budget-item-row">
        <div class="budget-item-icon" style="background:${cat?.color || '#eee'}22">
          ${cat?.icon || '📦'}
        </div>
        <div class="budget-item-info">
          <div class="budget-item-head">
            <span class="budget-item-name">${b.name}</span>
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
    html += `<p style="font-size:13px;color:var(--text-muted);margin-top:16px;text-align:center">No budgets set yet.</p>`;
  }

  el.innerHTML = html;
}

// ── SVG Icons ─────────────────────────────────────────────────
const svgIcon = d => `<svg viewBox="0 0 24 24">${d}</svg>`;
const dollarIcon  = () => svgIcon('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>');
const trendUpIcon = () => svgIcon('<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>');
const trendDownIcon = () => svgIcon('<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>');
const piggyIcon   = () => svgIcon('<path d="M19 6A7 7 0 0 0 5 6c-2 0-3 1-3 3 0 3 4 8 5 9h10c1-1 5-6 5-9 0-2-1-3-3-3Z"/><path d="M9 12h.01M15 12h.01"/>');
