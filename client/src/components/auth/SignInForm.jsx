import React, { useState } from 'react';

const SignInForm = ({ onSwitchToSignUp, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // mock submit - will integrate with backend later
    alert(`Mock sign in: ${email}`);
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label className="auth-label">Email</label>
      <input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

      <label className="auth-label">Password</label>
      <input className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

      <div className="auth-actions">
        <button type="submit" className="btn-primary">Sign In</button>
        <button type="button" className="btn-ghost" onClick={onSwitchToSignUp}>Create an account</button>
      </div>

      <button type="button" className="btn-back" onClick={onBack}>Back to dashboard</button>
    </form>
  );
};

export default SignInForm;
