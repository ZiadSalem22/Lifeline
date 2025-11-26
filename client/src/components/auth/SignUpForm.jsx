import React, { useState } from 'react';

const SignUpForm = ({ onSwitchToSignIn, onBack }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password !== confirm) {
      alert('Passwords do not match');
      return;
    }
    // mock submit
    alert(`Mock sign up: ${name} <${email}>`);
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label className="auth-label">Name</label>
      <input className="auth-input" value={name} onChange={(e) => setName(e.target.value)} required />

      <label className="auth-label">Email</label>
      <input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

      <label className="auth-label">Password</label>
      <input className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

      <label className="auth-label">Confirm Password</label>
      <input className="auth-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />

      <div className="auth-actions">
        <button type="submit" className="btn-primary">Sign Up</button>
        <button type="button" className="btn-ghost" onClick={onSwitchToSignIn}>Already have an account? Sign In</button>
      </div>

      <button type="button" className="btn-back" onClick={onBack}>Back to dashboard</button>
    </form>
  );
};

export default SignUpForm;
