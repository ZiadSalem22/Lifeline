import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import type { DayName } from '@lifeline/shared';
import { ApiError } from '../../shared/api/client';
import { putProfile } from '../../shared/api/endpoints';
import { useAuth } from '../providers/auth-context';
import { startDayForCountry } from './onboarding-lib';
import styles from './OnboardingPage.module.css';

/**
 * Onboarding (profile completion) — port of the old pages/OnboardingPage.jsx:
 * first/last/email required, phone, country (US/CA/MX auto-set Sunday start),
 * start-day select; PUT /me/profile with onboardingCompleted:true + browser
 * timezone; 409 email-conflict recovery ("Use different email"); identity
 * refresh then navigate home.
 */

function getBrowserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export default function OnboardingPage() {
  const { currentUser, refreshIdentity } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(currentUser?.email ?? '');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [startDay, setStartDay] = useState<DayName>('Monday');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [emailConflict, setEmailConflict] = useState(false);

  // Already onboarded → home (one-way flag; the old page did the same).
  if (currentUser?.profile?.onboardingCompleted) {
    return <Navigate to="/" replace />;
  }

  const valid = firstName.trim() !== '' && lastName.trim() !== '' && email.trim() !== '';

  const handleCountryChange = (value: string) => {
    setCountry(value);
    setStartDay(startDayForCountry(value));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError('');
    setEmailConflict(false);
    try {
      await putProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        timezone: getBrowserTimezone(),
        phone: phone.trim() || null,
        country: country.trim() || null,
        city: city.trim() || null,
        startDayOfWeek: startDay,
        onboardingCompleted: true,
      });
      try {
        await refreshIdentity();
      } catch {
        // identity refresh failures should not block completing onboarding
      }
      void navigate('/');
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.status === 409) {
        setError('This email is already associated with another account.');
        setEmailConflict(true);
      } else {
        setError(submitError instanceof Error ? submitError.message : 'Submission failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <section className={`${styles.card} fade-in-scale-up`}>
        <h1 className={styles.heading}>Welcome Home</h1>
        <p className={styles.text}>
          Let&rsquo;s personalize your experience. Please fill in the required fields to continue.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="onboarding-first-name">
              First Name *
            </label>
            <input
              id="onboarding-first-name"
              className={styles.input}
              required
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="onboarding-last-name">
              Last Name *
            </label>
            <input
              id="onboarding-last-name"
              className={styles.input}
              required
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="onboarding-email">
              Email *
            </label>
            <input
              id="onboarding-email"
              className={styles.input}
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="onboarding-phone">
              Phone
            </label>
            <input
              id="onboarding-phone"
              className={styles.input}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="onboarding-country">
              Country
            </label>
            <input
              id="onboarding-country"
              className={styles.input}
              value={country}
              onChange={(event) => handleCountryChange(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="onboarding-city">
              City
            </label>
            <input
              id="onboarding-city"
              className={styles.input}
              value={city}
              placeholder="For accurate prayer times"
              onChange={(event) => setCity(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="onboarding-start-day">
              Start Day Of Week
            </label>
            <select
              id="onboarding-start-day"
              className={styles.input}
              value={startDay}
              onChange={(event) => setStartDay(event.target.value as DayName)}
            >
              <option value="Sunday">Sunday</option>
              <option value="Monday">Monday</option>
              <option value="Saturday">Saturday</option>
            </select>
          </div>

          {error && (
            <div className={styles.errorBox} role="alert">
              <div>{error}</div>
              {emailConflict && (
                <button
                  type="button"
                  className={styles.recoveryButton}
                  onClick={() => {
                    setEmail('');
                    setError('');
                    setEmailConflict(false);
                  }}
                >
                  Use different email
                </button>
              )}
            </div>
          )}

          <button type="submit" className={styles.submit} disabled={!valid || submitting}>
            {submitting ? 'Saving...' : 'Continue'}
          </button>
        </form>
      </section>
    </div>
  );
}
