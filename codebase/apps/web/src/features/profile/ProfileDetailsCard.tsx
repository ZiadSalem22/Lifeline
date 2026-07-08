import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '../../shared/api/client';
import { putProfile } from '../../shared/api/endpoints';
import { useAuth } from '../../app/providers/auth-context';
import { getBrowserTimezone } from './profile-lib';
import styles from './Profile.module.css';

/**
 * Profile details card — port of the old ProfileDetailsCard.jsx onto the v1
 * camelCase PUT /me/profile. Names are required; the browser timezone is
 * auto-injected; a 409 email conflict surfaces the dedicated message; identity
 * is refetched after save so the TopBar chip updates.
 */

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  avatarUrl: string;
}

const EMAIL_CONFLICT_MESSAGE = 'This email is already associated with another account.';

export function ProfileDetailsCard() {
  const { currentUser, refreshIdentity } = useAuth();

  const [form, setForm] = useState<FormState>(() => ({
    firstName: currentUser?.profile?.firstName ?? '',
    lastName: currentUser?.profile?.lastName ?? '',
    email: currentUser?.email ?? '',
    phone: currentUser?.profile?.phone ?? '',
    country: currentUser?.profile?.country ?? '',
    city: currentUser?.profile?.city ?? '',
    avatarUrl: currentUser?.profile?.avatarUrl ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const setField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    setSaving(true);
    try {
      await putProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        phone: form.phone.trim() || null,
        country: form.country.trim() || null,
        city: form.city.trim() || null,
        avatarUrl: form.avatarUrl.trim() || null,
        timezone: getBrowserTimezone(),
      });
      await refreshIdentity();
      setSuccess('Profile updated successfully.');
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.status === 409) {
        setError(EMAIL_CONFLICT_MESSAGE);
      } else {
        setError(saveError instanceof Error ? saveError.message : 'Failed to save profile.');
      }
    } finally {
      setSaving(false);
    }
  };

  const avatarUrl = form.avatarUrl.trim();

  return (
    <section className={styles.card} aria-labelledby="profile-details-heading">
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.cardTitle} id="profile-details-heading">
            Your Profile
          </h2>
          <p className={styles.cardSubtitle}>Manage your personal information below.</p>
        </div>
        <div className={styles.avatarFrame}>
          {avatarUrl ? (
            <img alt="Profile avatar preview" className={styles.avatarImage} src={avatarUrl} />
          ) : (
            <div aria-hidden="true" className={styles.avatarPlaceholder} />
          )}
        </div>
      </div>

      {success && (
        <div className={styles.successBanner} role="status">
          {success}
        </div>
      )}
      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      )}

      <form className={styles.form} onSubmit={handleSave}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="profile-first-name">
              First name
            </label>
            <input
              id="profile-first-name"
              className={styles.input}
              required
              value={form.firstName}
              onChange={(event) => setField('firstName', event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="profile-last-name">
              Last name
            </label>
            <input
              id="profile-last-name"
              className={styles.input}
              required
              value={form.lastName}
              onChange={(event) => setField('lastName', event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="profile-email">
              Email
            </label>
            <input
              id="profile-email"
              className={styles.input}
              type="email"
              value={form.email}
              onChange={(event) => setField('email', event.target.value)}
            />
            <p className={styles.helper}>Optional</p>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="profile-phone">
              Phone
            </label>
            <input
              id="profile-phone"
              className={styles.input}
              value={form.phone}
              onChange={(event) => setField('phone', event.target.value)}
            />
            <p className={styles.helper}>Optional</p>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="profile-country">
              Country
            </label>
            <input
              id="profile-country"
              className={styles.input}
              value={form.country}
              onChange={(event) => setField('country', event.target.value)}
            />
            <p className={styles.helper}>Optional</p>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="profile-city">
              City
            </label>
            <input
              id="profile-city"
              className={styles.input}
              value={form.city}
              onChange={(event) => setField('city', event.target.value)}
            />
            <p className={styles.helper}>Optional</p>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="profile-avatar">
              Avatar URL
            </label>
            <div className={styles.inputRow}>
              <input
                id="profile-avatar"
                className={styles.input}
                value={form.avatarUrl}
                onChange={(event) => setField('avatarUrl', event.target.value)}
              />
              {avatarUrl && (
                <img alt="Small avatar preview" className={styles.inlineAvatar} src={avatarUrl} />
              )}
            </div>
            <p className={styles.helper}>Direct image URL</p>
          </div>
        </div>
        <div className={styles.buttonRow}>
          <button className={styles.primaryButton} disabled={saving} type="submit">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </section>
  );
}
