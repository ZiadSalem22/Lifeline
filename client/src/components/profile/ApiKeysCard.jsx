import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { createMcpApiKey, listMcpApiKeys, revokeMcpApiKey } from '../../utils/api';
import styles from './ProfilePanel.module.css';

const SCOPE_OPTIONS = [
  {
    value: 'read_only',
    label: 'Read only',
    description: 'Can list and search tasks without making changes.',
  },
  {
    value: 'read_write',
    label: 'Read and write',
    description: 'Can create, complete, and delete tasks through the current MCP write tools.',
  },
];

const EXPIRY_OPTIONS = [
  { value: '1_day', label: '1 day' },
  { value: '7_days', label: '7 days' },
  { value: '30_days', label: '30 days' },
  { value: '90_days', label: '90 days' },
  { value: 'never', label: 'Never' },
];

const EMPTY_FORM = {
  name: '',
  scopePreset: 'read_write',
  expiryPreset: '30_days',
};

function formatDateTime(value) {
  if (!value) return 'Never';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleString();
}

function getScopeLabel(scopes) {
  const normalizedScopes = Array.isArray(scopes) ? [...scopes].sort().join(',') : '';
  if (normalizedScopes === 'tasks:read') {
    return 'Read only';
  }
  if (normalizedScopes === 'tasks:read,tasks:write') {
    return 'Read and write';
  }
  return Array.isArray(scopes) && scopes.length > 0 ? scopes.join(', ') : 'Unknown';
}

function getStatusClassName(status) {
  if (status === 'revoked') return styles.badgeRevoked;
  if (status === 'expired') return styles.badgeExpired;
  return styles.badgeActive;
}

export default function ApiKeysCard({ fetchWithAuth, globalLoading, isAuthenticated }) {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedApiKeys, setHasLoadedApiKeys] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [revokingId, setRevokingId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [revealedKey, setRevealedKey] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadApiKeys() {
      if (!isAuthenticated) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      try {
        const response = await listMcpApiKeys(fetchWithAuth);
        if (isMounted) {
          setApiKeys(response.apiKeys || []);
          setHasLoadedApiKeys(true);
          setError('');
        }
      } catch (loadError) {
        if (isMounted) {
          setHasLoadedApiKeys(false);
          setError(loadError.message || 'Failed to load API keys.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadApiKeys();

    return () => {
      isMounted = false;
    };
  }, [fetchWithAuth, isAuthenticated]);

  const createButtonLabel = useMemo(() => {
    if (isCreateFormOpen) return 'Cancel';
    return apiKeys.length > 0 ? 'Create API key' : 'Create your first API key';
  }, [apiKeys.length, isCreateFormOpen]);

  const handleFormChange = (field) => (event) => {
    const nextValue = event.target.value;
    setForm((currentForm) => ({
      ...currentForm,
      [field]: nextValue,
    }));
  };

  const handleCreateToggle = () => {
    setError('');
    setSuccessMessage('');
    setRevealedKey(null);
    setForm(EMPTY_FORM);
    setIsCreateFormOpen((currentValue) => !currentValue);
  };

  const handleRetryLoad = () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');

    listMcpApiKeys(fetchWithAuth)
      .then((response) => {
        setApiKeys(response.apiKeys || []);
        setHasLoadedApiKeys(true);
      })
      .catch((loadError) => {
        setHasLoadedApiKeys(false);
        setError(loadError.message || 'Failed to load API keys.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setRevealedKey(null);

    if (!form.name.trim()) {
      setError('API key name is required.');
      return;
    }

    setIsCreating(true);

    try {
      const response = await createMcpApiKey({
        name: form.name.trim(),
        scopePreset: form.scopePreset,
        expiryPreset: form.expiryPreset,
      }, fetchWithAuth);

      setApiKeys((currentApiKeys) => {
        const nextApiKeys = [response.apiKey, ...currentApiKeys];
        return nextApiKeys.filter((apiKey, index) => (
          nextApiKeys.findIndex((candidate) => candidate.id === apiKey.id) === index
        ));
      });
      setHasLoadedApiKeys(true);
      setRevealedKey(response);
      setIsCreateFormOpen(false);
      setForm(EMPTY_FORM);
      setSuccessMessage('API key created. Copy it now because it will not be shown again.');
    } catch (createError) {
      setError(createError.message || 'Failed to create API key.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!revealedKey?.plaintextKey || !navigator.clipboard?.writeText) {
      setError('Clipboard access is unavailable. Select and copy the key manually.');
      return;
    }

    setIsCopying(true);
    setError('');

    try {
      await navigator.clipboard.writeText(revealedKey.plaintextKey);
      setSuccessMessage('API key copied to clipboard.');
    } catch (copyError) {
      setError(copyError.message || 'Failed to copy the API key.');
    } finally {
      setIsCopying(false);
    }
  };

  const handleRevoke = async (apiKeyId, apiKeyName) => {
    if (!window.confirm(`Revoke API key "${apiKeyName}"? This cannot be undone.`)) {
      return;
    }

    setRevokingId(apiKeyId);
    setError('');
    setSuccessMessage('');

    try {
      const response = await revokeMcpApiKey(apiKeyId, fetchWithAuth);
      setApiKeys((currentApiKeys) => currentApiKeys.map((apiKey) => (
        apiKey.id === apiKeyId ? response.apiKey : apiKey
      )));
      setSuccessMessage('API key revoked.');
    } catch (revokeError) {
      setError(revokeError.message || 'Failed to revoke API key.');
    } finally {
      setRevokingId('');
    }
  };

  return (
    <section className={styles.card} aria-labelledby="profile-api-keys-heading">
      <div className={styles.sectionHeaderRow}>
        <div>
          <h2 className={styles.title} id="profile-api-keys-heading">API Keys</h2>
          <p className={styles.subtitle}>
            Create MCP API keys for desktop clients and agents. Plaintext secrets are shown only once.
          </p>
        </div>
        <button className={styles.secondaryButton} onClick={handleCreateToggle} type="button">
          {createButtonLabel}
        </button>
      </div>

      {successMessage ? <div className={styles.successBanner} role="status">{successMessage}</div> : null}
      {error ? <div className={styles.errorBanner} role="alert">{error}</div> : null}

      {isCreateFormOpen ? (
        <form className={styles.form} onSubmit={handleCreate}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="mcp-api-key-name">Key name</label>
              <input
                className={styles.input}
                id="mcp-api-key-name"
                maxLength={100}
                onChange={handleFormChange('name')}
                placeholder="Desktop CLI"
                required
                value={form.name}
              />
              <p className={styles.helper}>Use a descriptive name so you can recognize the key later.</p>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="mcp-api-key-scope">Access</label>
              <select className={styles.select} id="mcp-api-key-scope" onChange={handleFormChange('scopePreset')} value={form.scopePreset}>
                {SCOPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <p className={styles.helper}>{SCOPE_OPTIONS.find((option) => option.value === form.scopePreset)?.description}</p>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="mcp-api-key-expiry">Expiry</label>
              <select className={styles.select} id="mcp-api-key-expiry" onChange={handleFormChange('expiryPreset')} value={form.expiryPreset}>
                {EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <p className={styles.helper}>The backend enforces these safe presets.</p>
            </div>
          </div>
          <div className={styles.buttonRow}>
            <button className={styles.primaryButton} disabled={isCreating || globalLoading} type="submit">
              {isCreating ? 'Creating…' : 'Create API key'}
            </button>
          </div>
        </form>
      ) : null}

      {revealedKey ? (
        <div className={styles.revealPanel} role="status">
          <div className={styles.revealHeader}>
            <h3 className={styles.revealTitle}>Copy your new API key now</h3>
            <button className={styles.secondaryButton} disabled={isCopying} onClick={handleCopy} type="button">
              {isCopying ? 'Copying…' : 'Copy key'}
            </button>
          </div>
          <p className={styles.revealWarning}>
            This plaintext key will not be shown again after you leave this page state.
          </p>
          <label className={styles.label} htmlFor="mcp-api-key-secret">Plaintext API key</label>
          <input
            aria-describedby="mcp-api-key-secret-help"
            className={styles.secretField}
            id="mcp-api-key-secret"
            readOnly
            value={revealedKey.plaintextKey}
          />
          <p className={styles.helper} id="mcp-api-key-secret-help">Copy and store this secret somewhere safe now.</p>
        </div>
      ) : null}

      {loading ? (
        !globalLoading ? <p className={styles.mutedState}>Loading API keys…</p> : null
      ) : !hasLoadedApiKeys ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateTitle}>We couldn't load your API keys.</p>
          <p className={styles.emptyStateBody}>Retry to fetch your existing key metadata.</p>
          <div className={styles.buttonRow}>
            <button className={styles.secondaryButton} onClick={handleRetryLoad} type="button">
              Retry
            </button>
          </div>
        </div>
      ) : apiKeys.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateTitle}>No API keys yet.</p>
          <p className={styles.emptyStateBody}>Create a key when you want to connect an MCP client to your Lifeline account.</p>
        </div>
      ) : (
        <div className={styles.apiKeyList}>
          {apiKeys.map((apiKey) => (
            <article className={styles.apiKeyCard} key={apiKey.id}>
              <div className={styles.apiKeyTopRow}>
                <div>
                  <h3 className={styles.apiKeyName}>{apiKey.name}</h3>
                  <p className={styles.apiKeyPrefix}>Prefix: {apiKey.keyPrefix}</p>
                </div>
                <span className={`${styles.badge} ${getStatusClassName(apiKey.status)}`}>{apiKey.status}</span>
              </div>
              <dl className={styles.apiKeyMetaGrid}>
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
                  <dd className={styles.metaValue}>{apiKey.expiresAt ? formatDateTime(apiKey.expiresAt) : 'Never'}</dd>
                </div>
                <div>
                  <dt className={styles.metaLabel}>Last used</dt>
                  <dd className={styles.metaValue}>{apiKey.lastUsedAt ? formatDateTime(apiKey.lastUsedAt) : 'Not used yet'}</dd>
                </div>
              </dl>
              <div className={styles.buttonRow}>
                <button
                  className={styles.dangerButton}
                  disabled={apiKey.status !== 'active' || revokingId === apiKey.id}
                  onClick={() => handleRevoke(apiKey.id, apiKey.name)}
                  type="button"
                >
                  {revokingId === apiKey.id ? 'Revoking…' : 'Revoke'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
