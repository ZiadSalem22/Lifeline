import React, { useState } from 'react';
import SignInForm from './SignInForm';
import SignUpForm from './SignUpForm';
import '../../styles/auth.css';

const Auth = ({ onBack, onAuthAction }) => {
  const [mode, setMode] = useState('signup');

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-tabs">
            <button className={mode === 'signin' ? 'auth-tab active' : 'auth-tab'} onClick={() => setMode('signin')}>Sign In</button>
            <button className={mode === 'signup' ? 'auth-tab active' : 'auth-tab'} onClick={() => setMode('signup')}>Sign Up</button>
          </div>
          <p className="auth-sub">{mode === 'signin' ? 'Welcome back — please sign in to continue.' : 'Create an account to sync your tasks across devices.'}</p>
        </div>

        <div className="auth-body">
          {mode === 'signin' ? (
            <SignInForm onSwitchToSignUp={() => setMode('signup')} onBack={onBack} onAuth={onAuthAction} />
          ) : (
            <SignUpForm onSwitchToSignIn={() => setMode('signin')} onBack={onBack} onAuth={onAuthAction} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
