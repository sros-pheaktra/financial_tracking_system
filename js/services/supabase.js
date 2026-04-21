// ============================================================
// js/services/supabase.js  — Supabase client + CRUD helpers
// ============================================================

// ── CONFIG ──────────────────────────────────────────────────
// Replace these with your actual Supabase project values
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../utils/config.js";

// ── Client ───────────────────────────────────────────────────
const { createClient } = supabase;
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Auth ─────────────────────────────────────────────────────
export const Auth = {
  async signUp(email, password, fullName) {
    return sb.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } }
    });
  },
  async signIn(email, password) {
    return sb.auth.signInWithPassword({ email, password });
  },
  async signOut() {
    return sb.auth.signOut();
  },
  async getUser() {
    const { data } = await sb.auth.getUser();
    return data?.user ?? null;
  },
  onAuthChange(callback) {
    return sb.auth.onAuthStateChange((_event, session) => callback(session));
  }
};

// ── Profile ───────────────────────────────────────────────────
export const Profiles = {
  async get(userId) {
    return sb.from('profiles').select('*').eq('id', userId).single();
  },
  async update(userId, updates) {
    return sb.from('profiles').update(updates).eq('id', userId).select().single();
  }
};

// ── Accounts ──────────────────────────────────────────────────
export const Accounts = {
  async list(userId) {
    return sb.from('accounts').select('*').eq('user_id', userId).order('is_primary', { ascending: false });
  },
  async create(data) {
    return sb.from('accounts').insert(data).select().single();
  },
  async update(id, data) {
    return sb.from('accounts').update(data).eq('id', id).select().single();
  },
  async delete(id) {
    return sb.from('accounts').delete().eq('id', id);
  },
  async totalBalance(userId) {
    const { data } = await sb.from('accounts').select('balance').eq('user_id', userId);
    return data?.reduce((sum, a) => sum + Number(a.balance), 0) ?? 0;
  }
};

// ── Categories ────────────────────────────────────────────────
export const Categories = {
  async list(userId) {
    return sb.from('categories')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order('name');
  }
};

// ── Transactions ──────────────────────────────────────────────
export const Transactions = {
  async list(userId, { limit = 50, offset = 0, type = null, search = '' } = {}) {
  let q = sb.from('transactions')
    .select(`
      *,
      categories(name, icon, color),
      accounts!transactions_account_id_fkey(name)
    `)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (type) q = q.eq('type', type);
  if (search) q = q.ilike('description', `%${search}%`);

  const { data, error } = await q.range(offset, offset + limit - 1);

  if (error) throw error;

  return data; 
},


  async monthlyStats(userId, year, month) {
    const from = `${year}-${String(month).padStart(2,'0')}-01`;
    const to   = new Date(year, month, 0).toISOString().slice(0,10);
    const { data } = await sb.from('transactions')
      .select('type, amount')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to);

    const income  = data?.filter(t => t.type==='income' ).reduce((s,t) => s+Number(t.amount), 0) ?? 0;
    const expense = data?.filter(t => t.type==='expense').reduce((s,t) => s+Number(t.amount), 0) ?? 0;
    return { income, expense, net: income - expense };
  },

  async last6MonthsCashFlow(userId) {
    const rows = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const stats = await Transactions.monthlyStats(userId, d.getFullYear(), d.getMonth() + 1);
      rows.push({ month: d.toLocaleString('default', { month: 'short' }), ...stats });
    }
    return rows;
  },

  async spendingByCategory(userId, year, month) {
    const from = `${year}-${String(month).padStart(2,'0')}-01`;
    const to   = new Date(year, month, 0).toISOString().slice(0,10);
    return sb.from('transactions')
      .select('amount, categories(name, color, icon)')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('date', from)
      .lte('date', to);
  },

  async create(data) {
    return sb.from('transactions').insert(data).select().single();
  },
  async update(id, data) {
    return sb.from('transactions').update(data).eq('id', id).select().single();
  },
  async delete(id) {
    return sb.from('transactions').delete().eq('id', id);
  }
};

// ── Budgets ───────────────────────────────────────────────────
export const Budgets = {
  async list(userId) {
    return sb.from('budgets').select('*, categories(name, icon, color)').eq('user_id', userId);
  },
  async create(data) {
    return sb.from('budgets').insert(data).select().single();
  },
  async update(id, data) {
    return sb.from('budgets').update(data).eq('id', id).select().single();
  },
  async delete(id) {
    return sb.from('budgets').delete().eq('id', id);
  }
};

// ── Savings Goals ─────────────────────────────────────────────
export const SavingsGoals = {
  async list(userId) {
    return sb.from('savings_goals').select('*').eq('user_id', userId);
  },
  async create(data) {
    return sb.from('savings_goals').insert(data).select().single();
  },
  async update(id, data) {
    return sb.from('savings_goals').update(data).eq('id', id).select().single();
  },
  async delete(id) {
    return sb.from('savings_goals').delete().eq('id', id);
  }
};
