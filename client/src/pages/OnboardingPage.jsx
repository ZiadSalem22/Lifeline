import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { useAuthContext } from '../providers/AuthProvider';

export default function OnboardingPage({ user, currentUser, guestMode, onCompleted }) {
  const { fetchWithAuth } = useApi();
  const { isAuthenticated } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [startDay, setStartDay] = useState('Monday');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [emailConflict, setEmailConflict] = useState(false);

  const timezone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return null; } })();

  const effectiveUser = user || currentUser || null;
  if (!isAuthenticated || guestMode) {
    return <Navigate to="/" replace />;
  }

  if (effectiveUser && effectiveUser.profile && effectiveUser.profile.onboarding_completed) {
    return <Navigate to="/" replace />;
  }

  const valid = firstName.trim() && lastName.trim() && email.trim();

  const { refreshIdentity } = useAuthContext();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    setEmailConflict(false);
    try {
      const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const res = await fetchWithAuth(`${apiBase}/profile`, {
        method: 'POST',
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          timezone: timezone || null,
          phone: phone || null,
          country: country || null,
          start_day_of_week: startDay || null,
          onboarding_completed: true
        })
      });
      if (res.status === 409) {
        // Email already used by another account
        setError('This email is already associated with another account.');
        setEmailConflict(true);
        setSubmitting(false);
        return;
      }
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      // Refresh identity so AuthProvider.currentUser reflects the saved profile
      try { await refreshIdentity(); } catch (e) { /* ignore refresh errors */ }
      onCompleted && onCompleted();
    } catch (err) {
      setError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', padding:'40px 20px' }}>
      <div style={{ width:'100%', maxWidth:'440px', background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'16px', padding:'32px 32px 40px', boxShadow:'0 12px 40px rgba(0,0,0,0.25)' }}>
        <h2 style={{ margin:0, fontSize:'1.6rem', fontWeight:700, fontFamily:'var(--font-family-heading)', color:'var(--color-text)' }}>Welcome Home</h2>
        <p style={{ margin:'12px 0 28px', fontSize:'0.95rem', lineHeight:1.5, color:'var(--color-text-muted)' }}>
          Let’s personalize your experience. Please fill in the required fields to continue.
        </p>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            <label style={{ fontSize:'0.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>First Name *</label>
            <input value={firstName} onChange={e=>setFirstName(e.target.value)} required style={inputStyle} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            <label style={{ fontSize:'0.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>Last Name *</label>
            <input value={lastName} onChange={e=>setLastName(e.target.value)} required style={inputStyle} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            <label style={{ fontSize:'0.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>Email *</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} required type="email" style={inputStyle} />
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            <label style={{ fontSize:'0.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>Phone</label>
            <input value={phone} onChange={e=>setPhone(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            <label style={{ fontSize:'0.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>Country</label>
            <input value={country} onChange={e=>{ setCountry(e.target.value); // attempt to set sensible default start day
                const c = e.target.value && String(e.target.value).toLowerCase();
                if (c.includes('united states') || c === 'us' || c === 'usa' || c.includes('america')) setStartDay('Sunday');
                else if (c.includes('canada') || c.includes('mexico')) setStartDay('Sunday');
                else setStartDay('Monday');
              }} style={inputStyle} />
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            <label style={{ fontSize:'0.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>Start Day Of Week</label>
            <select value={startDay} onChange={e=>setStartDay(e.target.value)} style={inputStyle}>
              <option value="Sunday">Sunday</option>
              <option value="Monday">Monday</option>
              <option value="Saturday">Saturday</option>
            </select>
          </div>
          {error && (
            <div style={{ color:'var(--color-danger)', fontSize:'0.8rem', display:'flex', flexDirection:'column', gap:8 }}>
              <div>{error}</div>
              {emailConflict && (
                <div style={{ display:'flex', gap:8 }}>
                  <button type="button" onClick={() => { setEmail(''); setError(null); setEmailConflict(false); }} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--color-border)', background:'transparent' }}>Use different email</button>
                </div>
              )}
            </div>
          )}
          <button type="submit" disabled={!valid || submitting} style={buttonStyle}>
            {submitting ? 'Saving...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  padding:'12px 14px',
  borderRadius:'10px',
  border:'1px solid var(--color-border)',
  background:'var(--color-bg)',
  color:'var(--color-text)',
  fontSize:'0.9rem'
};

const buttonStyle = {
  padding:'14px 18px',
  borderRadius:'12px',
  border:'1px solid var(--color-primary)',
  background:'var(--color-primary)',
  color:'var(--color-bg)',
  fontWeight:700,
  fontSize:'0.95rem',
  cursor:'pointer',
  boxShadow:'0 8px 24px -4px var(--shadow-primary)'
};
