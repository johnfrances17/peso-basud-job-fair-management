import { useState } from 'react'

export default function LoginScreen({ form, error, submitting, onChange, onSubmit }) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="auth-shell auth-shell-login">
      <section className="auth-card panel">
        <div className="auth-brand">
          <img className="auth-brand-mark" src="/logo.svg" alt="" aria-hidden="true" />
          <div>
            <h1>PESO Basud</h1>
            <p>MANAGEMENT SYSTEM</p>
          </div>
        </div>

        <div className="auth-copy">
          <h2>Welcome back</h2>
          <p>Sign in to your staff account.</p>
        </div>

        {error ? <div className="submit-notice error-notice" role="alert">{error}</div> : null}

        <form className="auth-form-simple" onSubmit={onSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => onChange('email', event.target.value)}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={form.password}
                onChange={(event) => onChange('password', event.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="auth-footer">Public Employment Service Office · Basud, Camarines Norte</p>
      </section>
    </div>
  )
}
