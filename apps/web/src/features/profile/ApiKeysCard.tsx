import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateMcpKeyInput } from '@lifeline/shared';
import { createMcpKey, listMcpKeys, revokeMcpKey } from './data';
import type { CreateMcpKeyResponse } from './data';
import { formatDateTime, getScopeLabel } from './profile-lib';
import styles from './Profile.module.css';

/**
 * MCP API keys card — port of the old ApiKeysCard.jsx onto /api/v1/mcp-keys:
 * list with status/scope labels, create with safe presets (defaults
 * read_write / 30_days) revealing the plaintext key exactly once with
 * copy-to-clipboard + warning, revoke with confirm.
 */

const SCOPE_OPTIONS: {
  value: CreateMcpKeyInput['scopePreset'];
  label: string;
  description: string;
}[] = [
  {
    value: 'read_only',
    label: 'Read only',
    description: 'Can list and search tasks without making changes.',
  },
  {
    value: 'read_write',
    label: 'Read and write',
    description: 'Can create, complete, and delete tasks through the MCP write tools.',
  },
];

const EXPIRY_OPTIONS: { value: CreateMcpKeyInput['expiryPreset']; label: string }[] = [
  { value: '1_day', label: '1 day' },
  { value: '7_days', label: '7 days' },
  { value: '30_days', label: '30 days' },
  { value: '90_days', label: '90 days' },
  { value: 'never', label: 'Never' },
];

const EMPTY_FORM: CreateMcpKeyInput = {
  name: '',
  scopePreset: 'read_write',
  expiryPreset: '30_days',
};

export function ApiKeysCard() {
  const queryClient = useQueryClient();
  const keysQuery = useQuery({ queryKey: ['mcp-keys'], queryFn: listMcpKeys });

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CreateMcpKeyInput>(EMPTY_FORM);
  const [revealedKey, setRevealedKey] = useState<CreateMcpKeyResponse | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copying, setCopying] = useState(false);

  const createMutation = useMutation({
    mutationFn: createMcpKey,
    onSuccess: (response) => {
      setRevealedKey(response);
      setFormOpen(false);
      setForm(EMPTY_FORM);
      setSuccess('API key created. Copy it now because it will not be shown again.');
      void queryClient.invalidateQueries({ queryKey: ['mcp-keys'] });
    },
    onError: (createError) => {
      setError(createError instanceof Error ? createError.message : 'Failed to create API key.');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: revokeMcpKey,
    onSuccess: () => {
      setSuccess('API key revoked.');
      void queryClient.invalidateQueries({ queryKey: ['mcp-keys'] });
    },
    onError: (revokeError) => {
      setError(revokeError instanceof Error ? revokeError.message : 'Failed to revoke API key.');
    },
  });

  const apiKeys = keysQuery.data?.items ?? [];

  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setRevealedKey(null);
    if (!form.name.trim()) {
      setError('API key name is required.');
      return;
    }
    createMutation.mutate({ ...form, name: form.name.trim() });
  };

  const handleCopy = async () => {
    if (!revealedKey || !navigator.clipboard?.writeText) {
      setError('Clipboard access is unavailable. Select and copy the key manually.');
      return;
    }
    setCopying(true);
    setError('');
    try {
      await navigator.clipboard.writeText(revealedKey.plaintextKey);
      setSuccess('API key copied to clipboard.');
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : 'Failed to copy the API key.');
    } finally {
      setCopying(false);
    }
  };

  const handleRevoke = (id: string, name: string) => {
    if (!window.confirm(`Revoke API key "${name}"? This cannot be undone.`)) return;
    setError('');
    setSuccess('');
    revokeMutation.mutate(id);
  };

  return (
    <section className={styles.card} aria-labelledby="profile-api-keys-heading">
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.cardTitle} id="profile-api-keys-heading">
            API Keys
          </h2>
          <p className={styles.cardSubtitle}>
            Create MCP API keys for desktop clients and agents. Plaintext secrets are shown only
            once.
          </p>
        </div>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            setError('');
            setSuccess('');
            setRevealedKey(null);
            setForm(EMPTY_FORM);
            setFormOpen((open) => !open);
          }}
        >
          {formOpen
            ? 'Cancel'
            : apiKeys.length > 0
              ? 'Create API key'
              : 'Create your first API key'}
        </button>
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

      {formOpen && (
        <form className={styles.form} onSubmit={handleCreate}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="mcp-api-key-name">
                Key name
              </label>
              <input
                id="mcp-api-key-name"
                className={styles.input}
                maxLength={100}
                required
                placeholder="Desktop CLI"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
              <p className={styles.helper}>
                Use a descriptive name so you can recognize the key later.
              </p>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="mcp-api-key-scope">
                Access
              </label>
              <select
                id="mcp-api-key-scope"
                className={styles.select}
                value={form.scopePreset}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    scopePreset: event.target.value as CreateMcpKeyInput['scopePreset'],
                  }))
                }
              >
                {SCOPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className={styles.helper}>
                {SCOPE_OPTIONS.find((option) => option.value === form.scopePreset)?.description}
              </p>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="mcp-api-key-expiry">
                Expiry
              </label>
              <select
                id="mcp-api-key-expiry"
                className={styles.select}
                value={form.expiryPreset}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    expiryPreset: event.target.value as CreateMcpKeyInput['expiryPreset'],
                  }))
                }
              >
                {EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className={styles.helper}>The backend enforces these safe presets.</p>
            </div>
          </div>
          <div className={styles.buttonRow}>
            <button
              className={styles.primaryButton}
              disabled={createMutation.isPending}
              type="submit"
            >
              {createMutation.isPending ? 'Creating…' : 'Create API key'}
            </button>
          </div>
        </form>
      )}

      {revealedKey && (
        <div className={styles.revealPanel} role="status">
          <div className={styles.revealHeader}>
            <h3 className={styles.revealTitle}>Copy your new API key now</h3>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={copying}
              onClick={() => void handleCopy()}
            >
              {copying ? 'Copying…' : 'Copy key'}
            </button>
          </div>
          <p className={styles.revealWarning}>
            This plaintext key will not be shown again after you leave this page.
          </p>
          <label className={styles.label} htmlFor="mcp-api-key-secret">
            Plaintext API key
          </label>
          <input
            id="mcp-api-key-secret"
            className={styles.secretField}
            readOnly
            value={revealedKey.plaintextKey}
            onFocus={(event) => event.target.select()}
          />
        </div>
      )}

      {keysQuery.isLoading ? (
        <p className={styles.mutedState}>Loading API keys…</p>
      ) : keysQuery.isError ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>We couldn't load your API keys.</p>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void keysQuery.refetch()}
          >
            Retry
          </button>
        </div>
      ) : apiKeys.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No API keys yet.</p>
          <p className={styles.emptyBody}>
            Create a key when you want to connect an MCP client to your Lifeline account.
          </p>
        </div>
      ) : (
        <div className={styles.keyList}>
          {apiKeys.map((apiKey) => (
            <article className={styles.keyCard} key={apiKey.id}>
              <div className={styles.keyTopRow}>
                <div>
                  <h3 className={styles.keyName}>{apiKey.name}</h3>
                  <p className={styles.keyPrefix}>Prefix: {apiKey.keyPrefix}</p>
                </div>
                <span
                  className={[
                    styles.badge,
                    apiKey.status === 'active'
                      ? styles.badgeActive
                      : apiKey.status === 'revoked'
                        ? styles.badgeRevoked
                        : styles.badgeExpired,
                  ].join(' ')}
                >
                  {apiKey.status}
                </span>
              </div>
              <dl className={styles.keyMetaGrid}>
                <div>
                  <dt className={styles.metaLabel}>Access</dt>
                  <dd className={styles.metaValue}>{getScopeLabel(apiKey.scopes)}</dd>
                </div>
                <div>
                  <dt className={styles.metaLabel}>Created</dt>
                  <dd className={styles.metaValue}>{formatDateTime(apiKey.createdAt)}</dd>
                </div>
                <div>
                  <dt className={styles.metaLabel}>Expires</dt>
                  <dd className={styles.metaValue}>{formatDateTime(apiKey.expiresAt)}</dd>
                </div>
                <div>
                  <dt className={styles.metaLabel}>Last used</dt>
                  <dd className={styles.metaValue}>
                    {apiKey.lastUsedAt ? formatDateTime(apiKey.lastUsedAt) : 'Not used yet'}
                  </dd>
                </div>
              </dl>
              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className={styles.dangerButton}
                  disabled={apiKey.status !== 'active' || revokeMutation.isPending}
                  onClick={() => handleRevoke(apiKey.id, apiKey.name)}
                >
                  {revokeMutation.isPending && revokeMutation.variables === apiKey.id
                    ? 'Revoking…'
                    : 'Revoke'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
