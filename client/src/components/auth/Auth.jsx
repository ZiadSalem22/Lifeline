const Auth = ({ onBack }) => (
  <div style={{ maxWidth: '420px', margin: '0 auto', textAlign: 'center', padding: '48px 24px' }}>
    <h2 style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-text)', marginBottom: '12px' }}>
      Authentication Coming Soon
    </h2>
    <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>
      This placeholder keeps the layout ready for a future sign-in experience.
    </p>
    <button
      type="button"
      onClick={onBack}
      style={{
        padding: '10px 18px',
        borderRadius: '10px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        cursor: 'pointer'
      }}
    >
      Back to dashboard
    </button>
  </div>
);

export default Auth;
