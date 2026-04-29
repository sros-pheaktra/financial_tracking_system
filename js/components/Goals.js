// ============================================================
// js/components/Goals.js  — Savings Goals management page
// ============================================================
import { State }       from '../utils/state.js';
import { SavingsGoals } from '../services/supabase.js';
import { fmt, pct }    from '../utils/helpers.js';
import { toast }       from './Toast.js';

// ── Module State ──────────────────────────────────────────────
let _goals     = [];
let _editingId = null;
let _contribId = null; // goal receiving a contribution

// ── Goal icon / color palettes ────────────────────────────────
const GOAL_ICONS = [
  '🏠','🚗','✈️','💻','📱','🎓','💍','🏖️',
  '🏋️','🎮','📷','🛍️','🏥','💼','🎸','⛵',
  '🌍','🍕','👶','🐾','🎯','💰','📚','🏆'
];

const GOAL_COLORS = [
  '#FF4444','#FF9500','#FFCC00','#34C759','#00C7BE',
  '#007AFF','#5856D6','#AF52DE','#FF2D55','#A2845E',
  '#30B0C7','#32ADE6','#FF6961','#77DD77','#FDFD96'
];

// ── Public API ────────────────────────────────────────────────
export async function loadGoalsData() {
  const user = State.get('user');
  if (!user) return;
  const { data, error } = await SavingsGoals.list(user.id);
  if (error) { toast(error.message, 'error'); return; }
  _goals = data ?? [];
}

export function renderGoals(container) {
  container.innerHTML = goalsPageHTML();
  bindGoalsPage();
  animateProgressBars();
}

// ── Summary helpers ───────────────────────────────────────────
function summaryStats() {
  const total     = _goals.length;
  const completed = _goals.filter(g => g.status === 'completed').length;
  const active    = _goals.filter(g => g.status === 'active').length;
  const totalTarget = _goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalSaved  = _goals.reduce((s, g) => s + Number(g.current_amount), 0);
  return { total, completed, active, totalTarget, totalSaved };
}

// ── Page HTML ─────────────────────────────────────────────────
function goalsPageHTML() {
  const { total, completed, active, totalTarget, totalSaved } = summaryStats();
  const overallPct = pct(totalSaved, totalTarget);

  // Sort: active first, then paused, then completed
  const sorted = [..._goals].sort((a, b) => {
    const order = { active: 0, paused: 1, completed: 2 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  });

  return `
  <div class="page goals-page">

    <!-- ── Page Header ── -->
    <div class="goals-header">
      <div>
        <h2 class="goals-title">Savings Goals</h2>
        <p class="goals-subtitle">Dream it. Plan it. Save it.</p>
      </div>
      <button class="btn btn-primary" id="add-goal-btn">
        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Goal
      </button>
    </div>

    <!-- ── Summary Banner ── -->
    <div class="goals-summary-banner">
      <div class="goals-summary-ring-wrap">
        ${ringChartSVG(overallPct)}
        <div class="ring-center-text">
          <span class="ring-pct">${overallPct}%</span>
          <span class="ring-label">saved</span>
        </div>
      </div>
      <div class="goals-summary-stats">
        <div class="gsstat">
          <p class="label">Total Saved</p>
          <p class="gsstat-val text-income">${fmt(totalSaved)}</p>
        </div>
        <div class="gsstat">
          <p class="label">Total Target</p>
          <p class="gsstat-val">${fmt(totalTarget)}</p>
        </div>
        <div class="gsstat">
          <p class="label">Still Needed</p>
          <p class="gsstat-val text-muted-val">${fmt(Math.max(0, totalTarget - totalSaved))}</p>
        </div>
        <div class="gsstat gsstat-chips">
          <span class="goal-chip chip-active">${active} active</span>
          <span class="goal-chip chip-done">${completed} completed</span>
          <span class="goal-chip chip-total">${total} total</span>
        </div>
      </div>
    </div>

    <!-- ── Goals Grid ── -->
    <div class="goals-grid" id="goals-grid">
      ${sorted.length === 0 ? goalsEmptyHTML() : sorted.map(g => goalCardHTML(g)).join('')}
    </div>

  </div>

  ${goalModalHTML()}
  ${contributionModalHTML()}
  `;
}

// ── Ring SVG ──────────────────────────────────────────────────
function ringChartSVG(percentage) {
  const r    = 44;
  const circ = 2 * Math.PI * r;
  const dash = (percentage / 100) * circ;

  return `
  <svg class="ring-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--border)" stroke-width="10"/>
    <circle cx="50" cy="50" r="${r}" fill="none"
      stroke="var(--accent)" stroke-width="10"
      stroke-linecap="round"
      stroke-dasharray="${dash} ${circ}"
      stroke-dashoffset="${circ / 4}"
      class="ring-progress"
      style="transition: stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)"/>
  </svg>`;
}

// ── Goal Card HTML ────────────────────────────────────────────
function goalCardHTML(g) {
  const target  = Number(g.target_amount);
  const current = Number(g.current_amount);
  const usedPct = pct(current, target);
  console.log({
  current,
  target,
  usedPct
});

  const isDone  = g.status === 'completed' || current >= target;
  const isPaused = g.status === 'paused';

  const statusBadge = isDone
    ? `<span class="goal-status-badge badge-done">✓ Completed</span>`
    : isPaused
    ? `<span class="goal-status-badge badge-paused">⏸ Paused</span>`
    : `<span class="goal-status-badge badge-active">In Progress</span>`;

  const deadlineHTML = g.deadline
    ? `<p class="goal-deadline">${deadlineLabel(g.deadline)}</p>`
    : '';

  const color = g.color || '#FF4444';

  return `
  <div class="goal-card ${isDone ? 'goal-card-done' : ''} ${isPaused ? 'goal-card-paused' : ''}" data-id="${g.id}">

    <!-- Card glow accent -->
    <div class="goal-card-accent" style="background:${color}"></div>

    <div class="goal-card-top">
      <div class="goal-icon-wrap" style="background:${color}22;border-color:${color}44">
        <span class="goal-icon">${g.icon || '🎯'}</span>
      </div>
      <div class="goal-card-meta">
        <h3 class="goal-name">${escHtml(g.name)}</h3>
        ${deadlineHTML}
        ${statusBadge}
      </div>
      <div class="goal-card-menu">
        <button class="icon-btn goal-contribute-btn ${isDone ? 'hidden' : ''}" data-id="${g.id}" title="Add contribution">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><circle cx="12" cy="12" r="9"/></svg>
        </button>
        <button class="icon-btn goal-edit-btn" data-id="${g.id}" title="Edit goal">
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn goal-delete-btn" data-id="${g.id}" title="Delete goal">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>

    <div class="goal-amounts">
      <div class="goal-amount-saved">
        <p class="label">Saved</p>
        <p class="goal-amount-big" style="color:${color}">${fmt(current)}</p>
      </div>
      <div class="goal-amount-target">
        <p class="label">Target</p>
        <p class="goal-amount-big">${fmt(target)}</p>
      </div>
    </div>

    <div class="goal-progress-section">
      <div class="goal-progress-track">
        <div class="goal-progress-fill"
          data-pct="${usedPct}"
          style="width:0%;background:${color};${isDone ? 'background:var(--income)' : ''}">
        </div>
      </div>
      <div class="goal-progress-labels">
        <span class="caption" style="color:${isDone ? 'var(--income)' : color};font-weight:700">${usedPct}%</span>
        <span class="caption">${fmt(Math.max(0, target - current))} to go</span>
      </div>
    </div>

    ${isDone ? `<div class="goal-confetti-strip">🎉 Goal reached! Great job!</div>` : ''}
  </div>`;
}

function deadlineLabel(dateStr) {
  const deadline = new Date(dateStr);
  const now      = new Date();
  const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0)  return `<span class="deadline-overdue">⚠ Deadline passed</span>`;
  if (diffDays === 0) return `<span class="deadline-today">Due today</span>`;
  if (diffDays <= 7) return `<span class="deadline-soon">${diffDays}d left</span>`;
  return `<span class="deadline-normal">Due ${deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>`;
}

function goalsEmptyHTML() {
  return `
  <div class="goals-empty">
    <div class="goals-empty-icon">⭐</div>
    <h3>No goals yet</h3>
    <p>Set your first savings goal and start tracking your progress toward what matters most.</p>
    <button class="btn btn-primary" id="add-goal-empty-btn">
      <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Create First Goal
    </button>
  </div>`;
}

// ── Goal Modal HTML ───────────────────────────────────────────
function goalModalHTML() {
  const iconsHTML = GOAL_ICONS.map(ic =>
    `<button type="button" class="icon-picker-btn" data-icon="${ic}">${ic}</button>`
  ).join('');

  const colorsHTML = GOAL_COLORS.map(c =>
    `<button type="button" class="color-picker-btn" data-color="${c}" style="background:${c}"></button>`
  ).join('');

  return `
  <div class="modal-overlay" id="goal-modal-overlay">
    <div class="modal" id="goal-modal" style="max-width:480px">
      <div class="modal-header">
        <h2 id="goal-modal-title">New Goal</h2>
        <button class="icon-btn" id="goal-modal-close">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <!-- Icon picker -->
      <div class="form-group">
        <label>Icon</label>
        <div class="icon-picker-grid" id="icon-picker-grid">${iconsHTML}</div>
        <input type="hidden" id="goal-icon-val" value="🎯"/>
      </div>

      <!-- Color picker -->
      <div class="form-group">
        <label>Color</label>
        <div class="color-picker-row" id="color-picker-row">${colorsHTML}</div>
        <input type="hidden" id="goal-color-val" value="${GOAL_COLORS[0]}"/>
      </div>

      <div class="form-group">
        <label>Goal Name</label>
        <input type="text" id="goal-name-input" placeholder="e.g. Buy a Laptop" maxlength="60"/>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Target Amount ($)</label>
          <input type="number" id="goal-target-input" placeholder="0.00" min="1" step="0.01"/>
        </div>
        <div class="form-group">
          <label>Already Saved ($)</label>
          <input type="number" id="goal-current-input" placeholder="0.00" min="0" step="0.01"/>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Deadline <span style="color:var(--text-muted)">(optional)</span></label>
          <input type="date" id="goal-deadline-input"/>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="goal-status-select">
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" id="goal-modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="goal-modal-save">Save Goal</button>
      </div>
    </div>
  </div>`;
}

// ── Contribution Modal HTML ───────────────────────────────────
function contributionModalHTML() {
  return `
  <div class="modal-overlay" id="contrib-modal-overlay">
    <div class="modal" id="contrib-modal" style="max-width:380px">
      <div class="modal-header">
        <h2>Add Contribution</h2>
        <button class="icon-btn" id="contrib-modal-close">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="contrib-goal-preview" id="contrib-goal-preview"></div>

      <div class="form-group" style="margin-top:16px">
        <label>Amount to Add ($)</label>
        <input type="number" id="contrib-amount-input" placeholder="0.00" min="0.01" step="0.01"/>
      </div>

      <div class="contrib-progress-preview" id="contrib-progress-preview"></div>

      <div class="modal-footer">
        <button class="btn btn-ghost" id="contrib-modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="contrib-modal-save">Add Contribution</button>
      </div>
    </div>
  </div>`;
}

// ── Bindings ──────────────────────────────────────────────────
function bindGoalsPage() {
  // Add buttons
  document.getElementById('add-goal-btn')?.addEventListener('click', openAddModal);
  document.getElementById('add-goal-empty-btn')?.addEventListener('click', openAddModal);

  // Delegate card actions
  document.getElementById('goals-grid')?.addEventListener('click', e => {
    const contribute = e.target.closest('.goal-contribute-btn');
    const edit       = e.target.closest('.goal-edit-btn');
    const del        = e.target.closest('.goal-delete-btn');
    if (contribute) openContribModal(contribute.dataset.id);
    if (edit)       openEditModal(edit.dataset.id);
    if (del)        confirmDelete(del.dataset.id);
  });

  // Goal modal controls
  document.getElementById('goal-modal-close')?.addEventListener('click',  closeGoalModal);
  document.getElementById('goal-modal-cancel')?.addEventListener('click', closeGoalModal);
  document.getElementById('goal-modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'goal-modal-overlay') closeGoalModal();
  });
  document.getElementById('goal-modal-save')?.addEventListener('click', saveGoal);

  // Contrib modal controls
  document.getElementById('contrib-modal-close')?.addEventListener('click',  closeContribModal);
  document.getElementById('contrib-modal-cancel')?.addEventListener('click', closeContribModal);
  document.getElementById('contrib-modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'contrib-modal-overlay') closeContribModal();
  });
  document.getElementById('contrib-modal-save')?.addEventListener('click', saveContribution);

  // Icon picker
  document.getElementById('icon-picker-grid')?.addEventListener('click', e => {
    const btn = e.target.closest('.icon-picker-btn');
    if (!btn) return;
    document.querySelectorAll('.icon-picker-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('goal-icon-val').value = btn.dataset.icon;
  });

  // Color picker
  document.getElementById('color-picker-row')?.addEventListener('click', e => {
    const btn = e.target.closest('.color-picker-btn');
    if (!btn) return;
    document.querySelectorAll('.color-picker-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('goal-color-val').value = btn.dataset.color;
  });

  // Live contribution preview
  document.getElementById('contrib-amount-input')?.addEventListener('input', updateContribPreview);
}

// ── Progress bar animation ────────────────────────────────────
function animateProgressBars() {
  requestAnimationFrame(() => {
    document.querySelectorAll('.goal-progress-fill[data-pct]').forEach(el => {
      const target = Math.min(100, parseInt(el.dataset.pct, 10));
      el.style.transition = 'width 0.8s cubic-bezier(0.4,0,0.2,1)';
      el.style.width = target + '%';
    });
  });
}

// ── Goal Modal logic ──────────────────────────────────────────
function openAddModal() {
  _editingId = null;
  document.getElementById('goal-modal-title').textContent = 'New Goal';
  resetGoalForm();
  document.getElementById('goal-modal-overlay').classList.add('open');
}

function openEditModal(id) {
  const g = _goals.find(g => g.id == id);
  if (!g) return;
  _editingId = id;
  document.getElementById('goal-modal-title').textContent = 'Edit Goal';

  // Populate form
  document.getElementById('goal-name-input').value    = g.name;
  document.getElementById('goal-target-input').value  = g.target_amount;
  document.getElementById('goal-current-input').value = g.current_amount;
  document.getElementById('goal-deadline-input').value = g.deadline ?? '';
  document.getElementById('goal-status-select').value  = g.status;
  document.getElementById('goal-icon-val').value       = g.icon || '🎯';
  document.getElementById('goal-color-val').value      = g.color || GOAL_COLORS[0];

  // Highlight icon + color selections
  document.querySelectorAll('.icon-picker-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.icon === (g.icon || '🎯'));
  });
  document.querySelectorAll('.color-picker-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.color === (g.color || GOAL_COLORS[0]));
  });

  document.getElementById('goal-modal-overlay').classList.add('open');
}

function resetGoalForm() {
  document.getElementById('goal-name-input').value     = '';
  document.getElementById('goal-target-input').value   = '';
  document.getElementById('goal-current-input').value  = '0';
  document.getElementById('goal-deadline-input').value = '';
  document.getElementById('goal-status-select').value  = 'active';
  document.getElementById('goal-icon-val').value       = '🎯';
  document.getElementById('goal-color-val').value      = GOAL_COLORS[0];
  // Default icon/color selections
  document.querySelectorAll('.icon-picker-btn').forEach((b, i) => b.classList.toggle('selected', i === 0));
  document.querySelectorAll('.color-picker-btn').forEach((b, i) => b.classList.toggle('selected', i === 0));
}

function closeGoalModal() {
  document.getElementById('goal-modal-overlay').classList.remove('open');
  _editingId = null;
}

async function saveGoal() {
  const user    = State.get('user');
  const name    = document.getElementById('goal-name-input').value.trim();
  const target  = parseFloat(document.getElementById('goal-target-input').value);
  const current = parseFloat(document.getElementById('goal-current-input').value || '0');
  const deadline = document.getElementById('goal-deadline-input').value || null;
  const status   = document.getElementById('goal-status-select').value;
  const icon     = document.getElementById('goal-icon-val').value;
  const color    = document.getElementById('goal-color-val').value;

  if (!name)            return toast('Please enter a goal name', 'error');
  if (!target || target <= 0) return toast('Please enter a valid target amount', 'error');
  if (current < 0)      return toast('Saved amount cannot be negative', 'error');

  const saveBtn = document.getElementById('goal-modal-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const payload = {
    user_id: user.id, name, target_amount: target, current_amount: current,
    deadline, status: current >= target ? 'completed' : status,
    icon, color
  };

  let error;
  if (_editingId) {
    const { error: e } = await SavingsGoals.update(_editingId, {
      name, target_amount: target, current_amount: current,
      deadline, status: current >= target ? 'completed' : status,
      icon, color
    });
    error = e;
  } else {
    const { error: e } = await SavingsGoals.create(payload);
    error = e;
  }

  saveBtn.disabled = false;
  saveBtn.textContent = 'Save Goal';

  if (error) { toast(error.message, 'error'); return; }

  toast(_editingId ? 'Goal updated!' : 'Goal created! 🎯', 'success');
  closeGoalModal();
  await reloadAndRender();
}

// ── Contribution Modal logic ──────────────────────────────────
function openContribModal(id) {
  _contribId = id;
  const g = _goals.find(g => g.id == id);
  if (!g) return;

  document.getElementById('contrib-amount-input').value = '';

  // Preview header
  const color = g.color || '#FF4444';
  document.getElementById('contrib-goal-preview').innerHTML = `
    <div class="contrib-goal-header">
      <span class="contrib-goal-icon" style="background:${color}22">${g.icon || '🎯'}</span>
      <div>
        <p class="contrib-goal-name">${escHtml(g.name)}</p>
        <p class="caption">${fmt(Number(g.current_amount))} saved of ${fmt(Number(g.target_amount))}</p>
      </div>
    </div>`;

  updateContribPreview();
  document.getElementById('contrib-modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('contrib-amount-input')?.focus(), 100);
}

function updateContribPreview() {
  const g = _goals.find(g => g.id == _contribId);
  if (!g) return;
  const extra   = parseFloat(document.getElementById('contrib-amount-input')?.value || '0') || 0;
  const current = Number(g.current_amount);
  const target  = Number(g.target_amount);
  const newVal  = Math.min(current + extra, target);
  const newPct  = pct(newVal, target);
  const color   = g.color || '#FF4444';

  document.getElementById('contrib-progress-preview').innerHTML = `
    <div class="contrib-preview-box">
      <div class="contrib-preview-row">
        <span class="caption">New total</span>
        <span style="font-weight:700;color:${color}">${fmt(newVal)}</span>
      </div>
      <div class="goal-progress-track" style="margin-top:8px">
        <div class="goal-progress-fill" style="width:${newPct}%;background:${color};transition:width .4s ease"></div>
      </div>
      <div class="goal-progress-labels" style="margin-top:4px">
        <span class="caption" style="color:${color};font-weight:700">${newPct}%</span>
        <span class="caption">${fmt(Math.max(0, target - newVal))} remaining</span>
      </div>
      ${newVal >= target ? `<p class="contrib-goal-reached">🎉 This will complete your goal!</p>` : ''}
    </div>`;
}

function closeContribModal() {
  document.getElementById('contrib-modal-overlay').classList.remove('open');
  _contribId = null;
}

async function saveContribution() {
  const g      = _goals.find(g => g.id == _contribId);
  if (!g) return;
  const extra  = parseFloat(document.getElementById('contrib-amount-input').value);
  if (!extra || extra <= 0) return toast('Enter a valid contribution amount', 'error');

  const saveBtn = document.getElementById('contrib-modal-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const newAmount = Number(g.current_amount) + extra;
  const newStatus = newAmount >= Number(g.target_amount) ? 'completed' : g.status;

  const { error } = await SavingsGoals.update(g.id, {
    current_amount: newAmount,
    status: newStatus
  });

  saveBtn.disabled = false;
  saveBtn.textContent = 'Add Contribution';

  if (error) { toast(error.message, 'error'); return; }

  const msg = newStatus === 'completed'
    ? '🎉 Goal completed! Amazing work!'
    : `Added ${fmt(extra)} to "${g.name}"!`;
  toast(msg, 'success');
  closeContribModal();
  await reloadAndRender();
}

// ── Delete ────────────────────────────────────────────────────
async function confirmDelete(id) {
  const g = _goals.find(g => g.id == id);
  if (!confirm(`Delete "${g?.name ?? 'this goal'}"? This cannot be undone.`)) return;

  const { error } = await SavingsGoals.delete(id);
  if (error) { toast(error.message, 'error'); return; }
  toast('Goal deleted', 'info');
  await reloadAndRender();
}

// ── Reload helpers ────────────────────────────────────────────
async function reloadAndRender() {
  await loadGoalsData();
  const content = document.getElementById('content');
  if (content) {
    renderGoals(content);
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}