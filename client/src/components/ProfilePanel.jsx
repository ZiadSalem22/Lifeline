import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';
import { useLoading } from '../context/LoadingContext';

export default function ProfilePanel() {
  const { isAuthenticated } = useAuth();
  const { fetchWithAuth } = useApi();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState('');
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    country: '',
    city: '',
    birthday: '',
    avatar_url: ''
  });

  const timezone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return null; } })();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!isAuthenticated) { setLoading(false); return; }
      try {
        const { fetchMe } = await import('../utils/api');
        const me = await fetchMe(fetchWithAuth);
        const p = me.profile || {};
        if (mounted) {
          setProfile({
            first_name: p.first_name || '',
            last_name: p.last_name || '',
            email: me.email || p.email || '',
            phone: p.phone || '',
            country: p.country || '',
            city: p.city || '',
            birthday: p.birthday || '',
            avatar_url: p.avatar_url || ''
          });
        }
      } catch (e) {
        setError(e.message || 'Failed to load profile');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [isAuthenticated, fetchWithAuth]);

  const { isLoading: globalLoading } = useLoading();

  const onChange = (field) => (e) => setProfile(prev => ({ ...prev, [field]: e.target.value }));

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!profile.first_name?.trim() || !profile.last_name?.trim()) {
        setError('First and last name are required');
        setSaving(false);
        return;
      }
      const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const payload = {
        first_name: profile.first_name.trim(),
        last_name: profile.last_name.trim(),
        email: profile.email || null,
        phone: profile.phone || null,
        country: profile.country || null,
        city: profile.city || null,
        birthday: profile.birthday || null,
        avatar_url: profile.avatar_url || null,
        timezone
      };
      console.debug('[ProfilePanel] saving profile payload:', payload);
      const res = await fetchWithAuth(`${apiBase}/profile`, { method: 'POST', body: JSON.stringify(payload) });
      console.debug('[ProfilePanel] /profile response status:', res.status);
      try {
        const clone = res.clone();
        const json = await clone.json().catch(() => null);
        console.debug('[ProfilePanel] /profile response body:', json);
      } catch (logErr) {
        console.warn('[ProfilePanel] failed to parse /profile response body', logErr);
      }
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      // Refresh profile/settings from server so UI reflects persisted values (e.g., start_day_of_week)
      try {
        const { fetchMe } = await import('../utils/api');
        const me = await fetchMe(fetchWithAuth);
        const p = me.profile || {};
        setProfile(prev => ({
          ...prev,
          first_name: p.first_name || prev.first_name,
          last_name: p.last_name || prev.last_name,
          email: me.email || p.email || prev.email,
          phone: p.phone || prev.phone,
          country: p.country || prev.country,
          city: p.city || prev.city,
          birthday: p.birthday || prev.birthday,
          avatar_url: p.avatar_url || prev.avatar_url
        }));
      } catch (refreshErr) {
        console.warn('Profile saved but failed to refresh from server:', refreshErr?.message || refreshErr);
      }
      setToast('Profile updated successfully!');
      setTimeout(() => setToast(''), 2500);
    } catch (e) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position:'relative' }}>
      {toast && (
        <div role="status" style={{ position:'absolute', top:-12, right:0, transform:'translateY(-100%)', background:'var(--color-surface)', border:'1px solid var(--color-border)', color:'var(--color-text)', borderRadius:'12px', padding:'10px 14px', boxShadow:'0 10px 30px rgba(0,0,0,0.25)', fontWeight:700 }}>
          {toast}
        </div>
      )}
      <div style={{ width:'100%', background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'16px', padding:'24px', boxShadow:'0 12px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <h2 style={{ margin:0, fontSize:'1.5rem', fontWeight:700, color:'var(--color-text)' }}>Your Profile</h2>
            <p style={{ margin:'6px 0 0', color:'var(--color-text-muted)' }}>Manage your personal information below.</p>
          </div>
          <div>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="avatar preview" style={{ width:64, height:64, borderRadius:'50%', objectFit:'cover', border:'1px solid var(--color-border)' }} />
            ) : (
              <div style={{ width:64, height:64, borderRadius:'50%', border:'1px solid var(--color-border)', background:'var(--color-surface-hover)' }} />
            )}
          </div>
        </div>

        {loading ? (
          (!globalLoading) ? (
            <div>Loading…</div>
          ) : null
        ) : (
          <form onSubmit={onSave}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
              <Field label="First Name *" value={profile.first_name} onChange={onChange('first_name')} required />
              <Field label="Last Name *" value={profile.last_name} onChange={onChange('last_name')} required />
              <Field label="Email" value={profile.email} onChange={onChange('email')} helper="Optional" />
              <Field label="Phone" value={profile.phone} onChange={onChange('phone')} helper="Optional" />
              <Field label="Country" value={profile.country} onChange={onChange('country')} helper="Optional" />
              <Field label="City" value={profile.city} onChange={onChange('city')} helper="Optional" />
              <Field label="Birthday" value={profile.birthday} onChange={onChange('birthday')} placeholder="YYYY-MM-DD" helper="Optional" />
              <Field label="Avatar URL" value={profile.avatar_url} onChange={onChange('avatar_url')} helper="Direct image URL">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar preview" style={{ width:40, height:40, borderRadius:'50%', objectFit:'cover', border:'1px solid var(--color-border)' }} />
                ) : null}
              </Field>
              {/* Week Start removed from Profile page; change it via Statistics instead */}
            </div>
            {error && <div style={{ color:'var(--color-danger)', fontSize:'0.85rem', marginTop:10 }}>{error}</div>}
            <div style={{ marginTop:16 }}>
              <button type="submit" disabled={saving || globalLoading} style={{ ...saveBtnStyle, cursor: (saving || globalLoading) ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving…' : (globalLoading ? 'Please wait…' : 'Save Changes')}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, children, helper, placeholder, required }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
      <label style={{ fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.4px' }}>{label}</label>
      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
        <input value={value} onChange={onChange} placeholder={placeholder} required={required} style={inputStyle} />
        {children}
      </div>
      {helper && <small style={{ color:'var(--color-text-muted)' }}>{helper}</small>}
    </div>
  );
}

// Week Start selector removed from ProfilePanel; user can change it in Statistics

const inputStyle = {
  padding:'12px 14px',
  borderRadius:'10px',
  border:'1px solid var(--color-border)',
  background:'var(--color-bg)',
  color:'var(--color-text)',
  fontSize:'0.9rem',
  width:'100%'
};

const saveBtnStyle = {
  padding:'12px 16px',
  borderRadius:'12px',
  border:'1px solid var(--color-primary)',
  background:'var(--color-primary)',
  color:'var(--color-bg)',
  fontWeight:700,
  fontSize:'0.95rem',
  cursor:'pointer',
  boxShadow:'0 8px 24px -4px var(--shadow-primary)'
};
