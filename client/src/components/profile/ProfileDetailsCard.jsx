import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { fetchMe, saveProfile } from '../../utils/api';
import styles from './ProfilePanel.module.css';

const EMPTY_PROFILE = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  country: '',
  city: '',
  avatar_url: '',
};

function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

function mapProfileResponse(me) {
  const profile = me?.profile || {};
  return {
    first_name: profile.first_name || '',
    last_name: profile.last_name || '',
    email: me?.email || profile.email || '',
    phone: profile.phone || '',
    country: profile.country || '',
    city: profile.city || '',
    avatar_url: profile.avatar_url || '',
  };
}

function Field({ label, value, onChange, helper, required = false, placeholder = '', children }) {
  const fieldId = useMemo(() => `profile-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` , [label]);

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={fieldId}>{label}</label>
      <div className={styles.inputRow}>
        <input
          className={styles.input}
          id={fieldId}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          value={value}
        />
        {children}
      </div>
      {helper ? <p className={styles.helper}>{helper}</p> : null}
    </div>
  );
}

export default function ProfileDetailsCard({ fetchWithAuth, globalLoading, isAuthenticated }) {
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [hasLoadedProfile, setHasLoadedProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      if (!isAuthenticated) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      try {
        const me = await fetchMe(fetchWithAuth);
        if (isMounted) {
          setProfile(mapProfileResponse(me));
          setHasLoadedProfile(true);
          setError('');
        }
      } catch (loadError) {
        if (isMounted) {
          setHasLoadedProfile(false);
          setError(loadError.message || 'Failed to load profile.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [fetchWithAuth, isAuthenticated]);

  const handleFieldChange = (field) => (event) => {
    const nextValue = event.target.value;
    setProfile((currentProfile) => ({
      ...currentProfile,
      [field]: nextValue,
    }));
  };

  const handleRetryLoad = () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');

    fetchMe(fetchWithAuth)
      .then((me) => {
        setProfile(mapProfileResponse(me));
        setHasLoadedProfile(true);
      })
      .catch((loadError) => {
        setHasLoadedProfile(false);
        setError(loadError.message || 'Failed to load profile.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!profile.first_name.trim() || !profile.last_name.trim()) {
      setError('First and last name are required.');
      return;
    }

    setSaving(true);

    try {
      await saveProfile({
        first_name: profile.first_name.trim(),
        last_name: profile.last_name.trim(),
        email: profile.email.trim() || null,
        phone: profile.phone.trim() || null,
        country: profile.country.trim() || null,
        city: profile.city.trim() || null,
        avatar_url: profile.avatar_url.trim() || null,
        timezone: getBrowserTimezone(),
      }, fetchWithAuth);
    } catch (saveError) {
      setError(saveError.message || 'Failed to save profile.');
      setSaving(false);
      return;
    }

    try {
      const me = await fetchMe(fetchWithAuth);
      setProfile(mapProfileResponse(me));
      setHasLoadedProfile(true);
      setSuccessMessage('Profile updated successfully.');
    } catch (refreshError) {
      setHasLoadedProfile(true);
      setSuccessMessage('Profile updated successfully, but refreshing the latest profile details failed.');
      setError(refreshError.message || 'Failed to refresh profile details.');
    } finally {
      setSaving(false);
    }
  };

  const avatarUrl = profile.avatar_url.trim();

  return (
    <section className={styles.card} aria-labelledby="profile-details-heading">
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title} id="profile-details-heading">Your Profile</h2>
          <p className={styles.subtitle}>Manage your personal information below.</p>
        </div>
        <div className={styles.avatarFrame}>
          {avatarUrl ? (
            <img alt="Profile avatar preview" className={styles.avatarImage} src={avatarUrl} />
          ) : (
            <div aria-hidden="true" className={styles.avatarPlaceholder} />
          )}
        </div>
      </div>

      {successMessage ? <div className={styles.successBanner} role="status">{successMessage}</div> : null}
      {error ? <div className={styles.errorBanner} role="alert">{error}</div> : null}

      {loading ? (
        !globalLoading ? <p className={styles.mutedState}>Loading profile…</p> : null
      ) : !hasLoadedProfile ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateTitle}>We couldn't load your profile.</p>
          <p className={styles.emptyStateBody}>Try again to refresh your saved account details.</p>
          <div className={styles.buttonRow}>
            <button className={styles.secondaryButton} onClick={handleRetryLoad} type="button">
              Retry
            </button>
          </div>
        </div>
      ) : (
        <form className={styles.form} onSubmit={handleSave}>
          <div className={styles.formGrid}>
            <Field label="First name" onChange={handleFieldChange('first_name')} required value={profile.first_name} />
            <Field label="Last name" onChange={handleFieldChange('last_name')} required value={profile.last_name} />
            <Field helper="Optional" label="Email" onChange={handleFieldChange('email')} value={profile.email} />
            <Field helper="Optional" label="Phone" onChange={handleFieldChange('phone')} value={profile.phone} />
            <Field helper="Optional" label="Country" onChange={handleFieldChange('country')} value={profile.country} />
            <Field helper="Optional" label="City" onChange={handleFieldChange('city')} value={profile.city} />
            <Field helper="Direct image URL" label="Avatar URL" onChange={handleFieldChange('avatar_url')} value={profile.avatar_url}>
              {avatarUrl ? <img alt="Small avatar preview" className={styles.inlineAvatarPreview} src={avatarUrl} /> : null}
            </Field>
          </div>
          <div className={styles.buttonRow}>
            <button className={styles.primaryButton} disabled={saving || globalLoading} type="submit">
              {saving ? 'Saving…' : globalLoading ? 'Please wait…' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
