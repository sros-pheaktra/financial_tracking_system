// ============================================================
// js/components/Auth.js
// ============================================================
import { Auth }  from '../services/supabase.js';
import { toast } from './Toast.js';

export function renderAuth(container, onSuccess) {
  container.innerHTML = authHTML();
  bindAuth(onSuccess);
}

function authHTML() {
  return `
  <div class="auth-page" id="auth-page">
    <div class="auth-card">
      <div class="auth-logo">
        <div class="auth-logo-icon">F</div>
        <div>
          <h2>FinTrack</h2>
          <span>Smart financial management</span>
        </div>
      </div>

      <!-- Login Form -->
      <div id="login-form">
        <h3 style="margin-bottom:6px;font-size:16px">Welcome back</h3>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:20px">Sign in to your account</p>
        <div class="form-group">
          <label>Email</label>
          <input id="login-email" type="email" placeholder="you@email.com" required />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input id="login-pass" type="password" placeholder="••••••••" required />
        </div>
        <button class="btn btn-primary" id="login-btn" style="width:100%;justify-content:center;margin-top:4px">
          Sign In
        </button>
        <p class="auth-switch">Don't have an account? <a id="show-signup">Sign up</a></p>
      </div>

      <!-- Signup Form -->
      <div id="signup-form" style="display:none">
        <h3 style="margin-bottom:6px;font-size:16px">Create account</h3>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:20px">Start tracking your finances</p>
        <div class="form-group">
          <label>Full Name</label>
          <input id="signup-name" type="text" placeholder="Jordan Lee" required />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input id="signup-email" type="email" placeholder="you@email.com" required />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input id="signup-pass" type="password" placeholder="Min. 8 characters" required />
        </div>
        <button class="btn btn-primary" id="signup-btn" style="width:100%;justify-content:center;margin-top:4px">
          Create Account
        </button>
        <p class="auth-switch">Already have an account? <a id="show-login">Sign in</a></p>
      </div>
    </div>
  </div>`;
}

function bindAuth(onSuccess) {
  document.getElementById('show-signup')?.addEventListener('click', () => {
    document.getElementById('login-form').style.display  = 'none';
    document.getElementById('signup-form').style.display = 'block';
  });
  document.getElementById('show-login')?.addEventListener('click', () => {
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('login-form').style.display  = 'block';
  });

  document.getElementById('login-btn')?.addEventListener('click', async () => {
    const btn   = document.getElementById('login-btn');
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-pass').value;
    if (!email || !pass) return toast('Please fill all fields', 'error');

    btn.disabled = true; btn.textContent = 'Signing in…';
    const { error } = await Auth.signIn(email, pass);
    btn.disabled = false; btn.textContent = 'Sign In';

    if (error) toast(error.message, 'error');
    else onSuccess();
  });

  document.getElementById('signup-btn')?.addEventListener('click', async () => {
    const btn   = document.getElementById('signup-btn');
    const name  = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const pass  = document.getElementById('signup-pass').value;
    if (!name || !email || !pass) return toast('Please fill all fields', 'error');
    if (pass.length < 6) return toast('Password must be at least 6 characters', 'error');

    btn.disabled = true; btn.textContent = 'Creating…';
    const { error } = await Auth.signUp(email, pass, name);
    btn.disabled = false; btn.textContent = 'Create Account';

    if (error) toast(error.message, 'error');
    else {
      toast('Account created!', 'success');
      document.getElementById('signup-form').style.display = 'none';
      document.getElementById('login-form').style.display  = 'block';
    }
  });
}
