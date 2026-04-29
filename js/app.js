// ============================================================
// js/app.js  — Main application bootstrap
// ============================================================
import { Auth, Profiles } from './services/supabase.js';
import { State }          from './utils/state.js';
import { renderAuth }     from './components/Auth.js';
import { renderSidebar }  from './components/Sidebar.js';
import { renderTopbar, updatePageTitle } from './components/Topbar.js';
import { renderDashboard, loadDashboardData } from './components/Dashboard.js';
import { renderBudget,    loadBudgetData }    from './components/Budget.js';
import { initTransactionModal, transactionModalHTML } from './components/TransactionModal.js';
import { renderGoals, loadGoalsData } from './components/Goals.js'; 

// ── Boot ──────────────────────────────────────────────────────
async function boot() {
  // Apply saved theme immediately
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  State.set('theme', savedTheme);

  const appEl = document.getElementById('app');

  // Check session
  const user = await Auth.getUser();

  if (!user) {
    renderAuth(appEl, () => boot());
    return;
  }

  State.set('user', user);

  // Load profile
  const { data: profile } = await Profiles.get(user.id);
  State.set('profile', profile);

  // Render shell
  appEl.innerHTML = `
    <div id="sidebar-root"></div>
    <div class="main">
      <div id="topbar-root"></div>
      <div class="content" id="content"></div>
    </div>
    ${transactionModalHTML()}`;

  renderSidebar(document.getElementById('sidebar-root'), navigate);
  renderTopbar(document.getElementById('topbar-root'), navigate);
  initTransactionModal();

  await navigate('dashboard');

  // Auth change listener
  Auth.onAuthChange(session => {
    if (!session) { window.location.reload(); }
  });
}

// ── Router ────────────────────────────────────────────────────
async function navigate(page) {
  State.set('currentPage', page);
  updatePageTitle(page);

  const content = document.getElementById('content');
  if (!content) return;

  content.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--text-muted)">Loading…</div>`;

  switch (page) {
    case 'dashboard':
      await loadDashboardData();
      renderDashboard(content);
      break;
    case 'budgets':
      await loadBudgetData();
      renderBudget(content);
      break;

    case 'goals':                         
      await loadGoalsData();
      renderGoals(content);
      break;

    case 'settings':
      renderSettings(content);
      break;

    default:
      content.innerHTML = pageStub('404', 'Page not found.');
  }
}

function pageStub(title, desc) {
  return `
  <div class="page" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;text-align:center;gap:12px">
    <div style="width:64px;height:64px;background:var(--accent-soft);border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;font-size:28px">🚧</div>
    <h2>${title}</h2>
    <p style="color:var(--text-muted);font-size:14px;max-width:320px">${desc}<br><br>Connect Supabase and this section will be populated automatically.</p>
  </div>`;
}
function refreshUI() {
  renderTopbar(document.getElementById('topbar-root'));
}

function renderSettings(container) {
  const profile = State.get('profile');
  const user    = State.get('user');

  container.innerHTML = `
  <div class="page" style="display: flex; justify-content: center">
    <div style="max-width:560px">
      <div class="chart-card" style="margin-bottom:16px">
        <h3 style="margin-bottom:18px">Profile Settings</h3>
        <div class="form-group">
          <label>Full Name</label>
          <input id="s-name" type="text" value="${profile?.full_name || ''}" />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" value="${user?.email || ''}" disabled style="opacity:.6;cursor:not-allowed" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Monthly Budget ($)</label>
            <input id="s-budget" type="number" value="${profile?.monthly_budget || 0}" />
          </div>
          <div class="form-group">
            <label>Savings Goal ($)</label>
            <input id="s-goal" type="number" value="${profile?.savings_goal || 0}" />
          </div>
        </div>
        <button class="btn btn-primary" id="save-profile-btn">Save Changes</button>
      </div>
    </div>
  </div>`;

  document.getElementById('save-profile-btn')?.addEventListener('click', async () => {
    const { toast } = await import('./components/Toast.js');
    const { Profiles } = await import('./services/supabase.js');
    const updates = {
      full_name:      document.getElementById('s-name').value,
      monthly_budget: parseFloat(document.getElementById('s-budget').value),
      savings_goal:   parseFloat(document.getElementById('s-goal').value)
    };
    const { data, error } = await Profiles.update(user.id, updates);
    if (error) toast(error.message, 'error');
    else {
      State.set('profile', data);
      toast('Profile saved!', 'success');
      refreshUI()
    }
  });
}

// ── Start ─────────────────────────────────────────────────────
boot();