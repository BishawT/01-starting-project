import { useState } from 'react';

import { SessionStatus, useAuth } from '../context/AuthContext.jsx';

export default function AuthInputs() {
  // Session truth now lives in AuthContext, not in this component. We no longer
  // keep an isLoggedIn boolean, because a boolean is a claim the client makes
  // about itself; the server's answer is the only authority.
  const { user, status, isSignedIn, login, logout } = useAuth();

  const [enteredEmail, setEnteredEmail] = useState('');
  const [enteredPassword, setEnteredPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailNotValid = submitted && !enteredEmail.includes('@');
  const passwordNotValid = submitted && enteredPassword.trim().length < 6;
  const isFormValid = enteredEmail.includes('@') && enteredPassword.trim().length >= 6;

  const isCheckingSession = status === SessionStatus.LOADING;

  function switchMode() {
    setMode((currentMode) => (currentMode === 'login' ? 'create' : 'login'));
    setSubmitted(false);
    setMessage('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
    setMessage('');

    if (!isFormValid) return;

    const email = enteredEmail.trim().toLowerCase();
    const password = enteredPassword.trim();
    setIsSubmitting(true);

    try {
      if (mode === 'create') {
        // Registering does NOT create a session. The server answers with a
        // message, and we drop back to the login form — same UX as before.
        let response;

        // Separate "server said no" from "server unreachable", so the user sees
        // a real reason instead of "Failed to fetch".
        try {
          response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
        } catch {
          setMessage(
            'Cannot reach the authentication server. Start it with npm run server.'
          );
          return;
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          setMessage(data.message || 'Unable to create your account.');
          return;
        }

        setMode('login');
        setEnteredPassword('');
        setSubmitted(false);
        setMessage(data.message);
      } else {
        // login() lives in AuthContext. It POSTs, then calls refresh() so the
        // UI reflects what the SERVER now thinks — not what we hoped.
        await login(email, password);
        setEnteredPassword('');
        setSubmitted(false);
      }
    } catch (error) {
      setMessage(
        error?.message ??
          'Cannot reach the authentication server. Start it with npm run server.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    setIsSubmitting(true);
    try {
      await logout();
      setEnteredEmail('');
      setEnteredPassword('');
      setMessage('');
      setSubmitted(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  // We genuinely do not know yet whether anyone is signed in. Render neither
  // the form nor the signed-in view — picking one here is what causes the
  // "flash of login form" bug on every page load.
  if (isCheckingSession) {
    return (
      <div id="auth-inputs" className="auth-message">
        <p>Checking your session…</p>
      </div>
    );
  }

  if (isSignedIn) {
    return (
      <div id="auth-inputs" className="auth-message">
        {/* The email comes from the SERVER, via the session endpoint — not
            from the form field we happened to type into. */}
        <p>You are signed in as {user.email}.</p>
        <button className="button" type="button" onClick={handleLogout} disabled={isSubmitting}>
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <form id="auth-inputs" onSubmit={handleSubmit} noValidate>
      <div className="controls">
        <p>
          <label className={emailNotValid ? 'invalid' : undefined} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={enteredEmail}
            className={emailNotValid ? 'invalid' : undefined}
            onChange={(event) => setEnteredEmail(event.target.value)}
          />
        </p>
        <p>
          <label className={passwordNotValid ? 'invalid' : undefined} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={enteredPassword}
            className={passwordNotValid ? 'invalid' : undefined}
            onChange={(event) => setEnteredPassword(event.target.value)}
          />
        </p>
      </div>
      {message && <p className="form-message" role="status">{message}</p>}
      <div className="actions">
        <button type="button" className="text-button" onClick={switchMode}>
          {mode === 'login' ? 'Create a new account' : 'I already have an account'}
        </button>
        <button className="button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </div>
    </form>
  );
}