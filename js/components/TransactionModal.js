// ============================================================
// js/components/TransactionModal.js
// ============================================================
import { State } from '../utils/state.js';
import { today } from '../utils/helpers.js';
import { Transactions } from '../services/supabase.js';
import { toast } from './Toast.js';

let overlay, form, activeType = 'expense', editId = null;

export function initTransactionModal() {
  overlay = document.getElementById('tx-modal');
  form    = document.getElementById('tx-form');

  overlay.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeType = btn.dataset.type;
      overlay.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  form.addEventListener('submit', handleSubmit);
  overlay.querySelector('.modal-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
}

export function openTransactionModal(txData = null) {
  editId = txData?.id ?? null;
  overlay.querySelector('.modal-title').textContent = editId ? 'Edit Transaction' : 'Add Transaction';

  // Populate accounts — FIXED: guard against missing/empty accounts
  const accountSel = form.querySelector('#tx-account');
  const accounts = State.get('accounts') || [];
  if (accounts.length === 0) {
    accountSel.innerHTML = '<option value="" disabled selected>No accounts found</option>';
  } else {
    accountSel.innerHTML = accounts
      .map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  }

  // Populate categories
  const catSel = form.querySelector('#tx-category');
  const cats = State.get('categories') || [];
  catSel.innerHTML = cats
    .filter(c => c.type === 'expense')
    .map(c => `<option value="${c.id}">${c.icon || ''} ${c.name}</option>`).join('');

  if (txData) {
    form.querySelector('#tx-desc').value   = txData.description || '';
    form.querySelector('#tx-amount').value = txData.amount || '';
    form.querySelector('#tx-date').value   = txData.date || today();
    form.querySelector('#tx-notes').value  = txData.notes || '';

    requestAnimationFrame(() => {
      if (txData.account_id) {
        form.querySelector('#tx-account').value = txData.account_id;
      }
      if (txData.category_id) {
        form.querySelector('#tx-category').value = txData.category_id;
      }
      if (txData.payment_method) {
        form.querySelector('#tx-payment-method').value = txData.payment_method;
      }
    });

    activeType = txData.type;
  } else {
    form.reset();
    form.querySelector('#tx-date').value = today();
    activeType = 'expense';
  }

  overlay.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === activeType);
  });

  overlay.classList.add('open');
}

function closeModal() {
  overlay.classList.remove('open');
  editId = null;
}

async function handleSubmit(e) {
  e.preventDefault();
  const btn = form.querySelector('.btn-submit');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const user = State.get('user');
  const payload = {
    user_id:        user.id,
    account_id:     form.querySelector('#tx-account').value,
    category_id:    form.querySelector('#tx-category').value || null,
    type:           activeType,
    amount:         parseFloat(form.querySelector('#tx-amount').value),
    description:    form.querySelector('#tx-desc').value,
    date:           form.querySelector('#tx-date').value,
    notes:          form.querySelector('#tx-notes').value || null,
    payment_method: form.querySelector('#tx-payment-method').value,
    status:         'completed'
  };

  const { error } = editId
    ? await Transactions.update(editId, payload)
    : await Transactions.create(payload);

  btn.disabled = false;
  btn.textContent = 'Save';

  if (error) {
    toast(error.message, 'error');
  } else {
    toast(editId ? 'Transaction updated!' : 'Transaction added!', 'success');
    closeModal();
    window.dispatchEvent(new CustomEvent('data:refresh'));
    // After successfully adding/updating/deleting a transaction:
    window.dispatchEvent(new CustomEvent('data:changed', { detail: { type: 'transactions' } }));
  }
}

export function transactionModalHTML() {
  return `
  <div class="modal-overlay" id="tx-modal">
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">Add Transaction</h2>
        <button class="icon-btn modal-close" title="Close">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <form id="tx-form">
        <div class="form-group">
          <label>Type</label>
          <div class="type-toggle">
            <button type="button" class="type-btn expense active" data-type="expense">💸 Expense</button>
            <button type="button" class="type-btn income" data-type="income">💰 Income</button>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Description</label>
            <input id="tx-desc" type="text" placeholder="e.g. Netflix" required />
          </div>
          <div class="form-group">
            <label>Amount</label>
            <input id="tx-amount" type="number" step="0.01" min="0.01" placeholder="0.00" required />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Date</label>
            <input id="tx-date" type="date" required />
          </div>
          <div class="form-group">
            <label>Payment Method</label>
            <select id="tx-payment-method" required>
              <option value="cash">Cash</option>
              <option value="digital">Digital Payment</option>
            </select>
          </div>
        </div>
        <div class="form-group" style="display: none">
          <label>Account</label>
          <select id="tx-account" required></select>
        </div>
        <div class="form-group">
          <label>Category</label>
          <select id="tx-category"></select>
        </div>
        <div class="form-group">
          <label>Notes <span style="color:var(--text-muted)">(optional)</span></label>
          <textarea id="tx-notes" rows="2" placeholder="Additional notes…"></textarea>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost modal-close">Cancel</button>
          <button type="submit" class="btn btn-primary btn-submit">Save Transaction</button>
        </div>
      </form>
    </div>
  </div>`;
}