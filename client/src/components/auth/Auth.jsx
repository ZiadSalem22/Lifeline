const Auth = ({ onBack }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <div style={{ maxWidth: '420px', margin: '0 auto', textAlign: 'center', padding: '48px 24px', borderRadius: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
      <h1 style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-text)', marginBottom: '8px' }}>Sign Up</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '20px' }}>Create an account to sync your tasks across devices. (Mock page)</p>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => alert('Mock Sign Up clicked')}
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            border: 'none',
            background: 'var(--color-primary)',
            color: 'var(--color-bg)',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Sign Up
        </button>

        <button
          type="button"
          onClick={() => alert('Mock Sign In clicked')}
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text)',
            cursor: 'pointer'
          }}
        >
          Sign In
        </button>
      </div>

      <button
        type="button"
        onClick={onBack}
        style={{
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          color: 'var(--color-text)',
          cursor: 'pointer'
        }}
      >
        Back to dashboard
      </button>
    </div>
  </div>
);

export default Auth;
