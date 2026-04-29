// ============================================================
// js/components/Sidebar.js
// ============================================================
import { State } from '../utils/state.js';
import { Auth }  from '../services/supabase.js';
import { toast } from './Toast.js';

export function renderSidebar(container, onNavigate) {
  container.innerHTML = sidebarHTML();
  bindSidebar(onNavigate);
}

function sidebarHTML() {
  return `
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-logo">F</div>
    <nav class="sidebar-nav">
      ${navItem('dashboard', gridIcon(), 'Dashboard', true)}
      ${navItem('budgets',   targetIcon(), 'Budgets')}
      ${navItem('goals',     starIcon(), 'Goals')}
    </nav>
    <div class="sidebar-bottom">
      ${navItem('settings', settingsIcon(), 'Settings')}
      <a class="nav-item" id="logout-btn">
        ${logoutIcon()}
        <span>Logout</span>
      </a>
    </div>
  </aside>`;
}

function navItem(page, icon, label, active = false) {
  return `
  <a class="nav-item${active ? ' active' : ''}" data-page="${page}">
    ${icon}
    <span>${label}</span>
  </a>`;
}

function bindSidebar(onNavigate) {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      onNavigate(item.dataset.page);
    });
  });

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await Auth.signOut();
    toast('Signed out successfully', 'info');
    window.location.reload();
  });
}

export function updateActiveNav(page) {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
}

// ── SVG Icons ─────────────────────────────────────────────────
const svg = (content) => `<svg viewBox="0 0 24 24">${content}</svg>`;
const gridIcon     = () => svg('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>');
const targetIcon   = () => svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>');
const starIcon     = () => svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>');
const settingsIcon = () => svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>');
const logoutIcon   = () => svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>');
