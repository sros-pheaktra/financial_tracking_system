// ============================================================
// js/components/Topbar.js
// ============================================================
import { State }   from '../utils/state.js';
const PAGE_TITLES = {
  dashboard: 'Dashboard',
  accounts:  'Accounts',
  analytics: 'Analytics',
  budgets:   'Budget Planner',
  goals:     'Savings Goals',
  settings:  'Settings'
};

export function renderTopbar(container, navigate) {
  container.innerHTML = topbarHTML();

  bindTopbar();

  document.getElementById('user-avatar')?.addEventListener('click', () => {
    const current = State.get('currentPage');

    if (current === 'settings') {
      navigate('dashboard');
    } else {
      navigate('settings');
    }
  });
}



function topbarHTML() {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const profile = State.get('profile');
  const fullName = profile.full_name || 'there';
  const initials = (profile?.full_name || 'JL').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return `
  <header class="topbar" id="topbar">
    <div class="topbar-title">
      <h1>Hello ${fullName},</h1>
      <p>${dateStr}</p>
    </div>
    <div class="topbar-actions">
      <button class="btn btn-primary" id="add-tx-hbtn" style="height:34px;padding:0 12px">
        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Transaction
      </button>
      <button class="icon-btn" id="notif-btn" title="Notifications">
        <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      </button>
      <button class="icon-btn" id="theme-btn" title="Toggle theme">
        <svg id="theme-icon-moon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <svg id="theme-icon-sun"  viewBox="0 0 24 24" style="display:none"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      </button>
      <div class="avatar" id="user-avatar" title="Profile">${initials}</div>
    </div>
  </header>`;
}

function bindTopbar() {
  const themeBtn = document.getElementById('theme-btn');
  const moon = document.getElementById('theme-icon-moon');
  const sun  = document.getElementById('theme-icon-sun');
  
  // Set initial icon
  const currentTheme = State.get('theme');
  if (currentTheme === 'dark') { moon.style.display = 'none'; sun.style.display = ''; }

  themeBtn?.addEventListener('click', () => {
    const t = State.get('theme') === 'light' ? 'dark' : 'light';
    State.set('theme', t);
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    if (t === 'dark') { moon.style.display = 'none'; sun.style.display = ''; }
    else              { sun.style.display = 'none'; moon.style.display = ''; }
  });
}

export function updatePageTitle(page) {
  const el = document.getElementById('page-title');
  if (el) el.textContent = PAGE_TITLES[page] || 'FinTrack';
}
