import React, { useState, useEffect } from 'react';

const RecurrenceSelector = ({ recurrence, baseDate, isOpen, onClose, onApply, onClear }) => {
  const [mode, setMode] = useState(recurrence?.mode || 'daily');
  const [startDate, setStartDate] = useState(recurrence?.startDate || baseDate || '');
  const [endDate, setEndDate] = useState(recurrence?.endDate || '');
  const [selectedDays, setSelectedDays] = useState(recurrence?.selectedDays || []);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  useEffect(() => {
    if (!isOpen) return;
    setMode(recurrence?.mode || 'daily');
    setStartDate(recurrence?.startDate || baseDate || '');
    setEndDate(recurrence?.endDate || '');
    setSelectedDays(recurrence?.selectedDays || []);
  }, [isOpen, recurrence, baseDate]);

  const toggleDay = (day) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleApply = () => {
    let recurrenceData = null;

    if (mode === 'daily') {
      if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
      }
      if (new Date(startDate) > new Date(endDate)) {
        alert('Start date must be before end date');
        return;
      }
      recurrenceData = {
        mode: 'daily',
        type: 'daily',
        startDate,
        endDate,
      };
    } else if (mode === 'dateRange') {
      if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
      }
      if (new Date(startDate) > new Date(endDate)) {
        alert('Start date must be before end date');
        return;
      }
      recurrenceData = {
        mode: 'dateRange',
        type: 'dateRange',
        startDate,
        endDate,
      };
    } else if (mode === 'specificDays') {
      if (selectedDays.length === 0) {
        alert('Please select at least one day');
        return;
      }
      if (!startDate || !endDate) {
        alert('Please select the date range this should apply to');
        return;
      }
      if (new Date(startDate) > new Date(endDate)) {
        alert('Start date must be before end date');
        return;
      }
      recurrenceData = {
        mode: 'specificDays',
        type: 'specificDays',
        startDate,
        endDate,
        selectedDays,
      };
    }

    onApply(recurrenceData);
  };

  const handleClear = () => {
    setMode('daily');
    setStartDate(baseDate || '');
    setEndDate('');
    setSelectedDays([]);
    onClear();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recurrenceDialogTitle"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '18px',
          padding: '28px 28px 24px',
          maxWidth: '520px',
          width: 'min(96%, 520px)',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 12px 28px -8px rgba(0,0,0,0.35)',
          transition: 'box-shadow 0.25s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <h2 id="recurrenceDialogTitle" style={{
              color: 'var(--color-text)',
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 600,
              letterSpacing: '-0.25px'
            }}>Recurrence</h2>
            <p style={{
              margin: 0,
              fontSize: '0.8rem',
              color: 'var(--color-text-muted)'
            }}>Define how this task should generate future instances.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              padding: '6px 10px',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: '0.7rem',
              fontWeight: 600,
              lineHeight: 1
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text)';
              e.currentTarget.style.borderColor = 'var(--color-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-muted)';
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }}
          >
            Cancel
          </button>
        </div>
        <fieldset style={{ margin: 0, border: 'none', padding: 0 }}>
          <legend style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
            border: 0
          }}>Recurrence mode</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px' }}>
            {[
              { key: 'daily', label: 'Daily', desc: 'Every day between start and end' },
              { key: 'dateRange', label: 'Date Range', desc: 'Single continuous span (daily)' },
              { key: 'specificDays', label: 'Specific Weekdays', desc: 'Only selected weekdays in range' }
            ].map(opt => (
              <label key={opt.key} style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                padding: '10px 12px',
                borderRadius: '12px',
                border: '1px solid ' + (mode === opt.key ? 'var(--color-primary)' : 'var(--color-border)'),
                background: mode === opt.key ? 'var(--color-primary)10' : 'var(--color-surface-light)',
                cursor: 'pointer',
                transition: 'border-color 0.2s ease'
              }}>
                <input
                  type="radio"
                  name="recurrenceMode"
                  checked={mode === opt.key}
                  onChange={() => setMode(opt.key)}
                  style={{ marginTop: '2px', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '-0.2px', color: 'var(--color-text)' }}>{opt.label}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{opt.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Conditional Content - Daily */}
        {mode === 'daily' && (
          <div style={{ background: 'var(--color-surface-light)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', margin: '0 0 12px' }}>
              Provide a start and end date.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', color: 'var(--color-text)', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '600' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    color: 'var(--color-text)',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--color-text)', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '600' }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    color: 'var(--color-text)',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Conditional Content - Date Range */}
        {mode === 'dateRange' && (
          <div style={{ background: 'var(--color-surface-light)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: 'var(--color-text)', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '600' }}>
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  color: 'var(--color-text)',
                  fontSize: '0.875rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--color-text)', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '600' }}>
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  color: 'var(--color-text)',
                  fontSize: '0.875rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        )}

        {/* Conditional Content - Specific Days */}
        {mode === 'specificDays' && (
          <div style={{ background: 'var(--color-surface-light)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', color: 'var(--color-text)', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '600' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    color: 'var(--color-text)',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--color-text)', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '600' }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    color: 'var(--color-text)',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <label style={{ display: 'block', color: 'var(--color-text)', marginBottom: '10px', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.5px' }}>
              WEEKDAYS
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' }}>
              {days.map((day, index) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '10px',
                    border: '1px solid ' + (selectedDays.includes(day) ? 'var(--color-primary)' : 'var(--color-border)'),
                    background: selectedDays.includes(day) ? 'var(--color-primary)15' : 'var(--color-surface)',
                    color: selectedDays.includes(day) ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    letterSpacing: '0.5px'
                  }}
                >
                  {dayShort[index]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
          <button
            onClick={handleApply}
            style={{
              flex: 1,
              padding: '10px 14px',
              background: 'var(--color-primary)',
              color: 'var(--color-bg)',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.75rem',
              letterSpacing: '0.5px'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-primary-dark)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-primary)'; }}
          >
            SAVE
          </button>
          <button
            onClick={handleClear}
            style={{
              flex: 1,
              padding: '10px 14px',
              background: 'var(--color-surface-light)',
              color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.75rem',
              letterSpacing: '0.5px'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; }}
          >
            CLEAR
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '10px 14px',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.75rem',
              letterSpacing: '0.5px'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; }}
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecurrenceSelector;
