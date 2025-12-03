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
    setSelectedDays(prev => (prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]));
  };

  const handleApply = () => {
    let recurrenceData = null;
    const invalidRange = !startDate || !endDate || new Date(startDate) > new Date(endDate);
    if (mode === 'daily' || mode === 'dateRange') {
      if (invalidRange) return alert('Please select a valid start and end date');
      recurrenceData = { mode, type: mode, startDate, endDate };
    } else if (mode === 'specificDays') {
      if (invalidRange) return alert('Please select a valid date range');
      if (selectedDays.length === 0) return alert('Please select at least one weekday');
      recurrenceData = { mode, type: 'specificDays', startDate, endDate, selectedDays };
    }
    onApply && onApply(recurrenceData);
  };

  const handleClear = () => {
    setMode('daily');
    setStartDate(baseDate || '');
    setEndDate('');
    setSelectedDays([]);
    onClear && onClear();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay safe-area-x" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, color: 'var(--color-text)' }}>Select Recurrence</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {[
            { key: 'daily', label: 'Daily', desc: 'Every day between start and end' },
            { key: 'dateRange', label: 'Date Range', desc: 'Single continuous span (daily)' },
            { key: 'specificDays', label: 'Specific Weekdays', desc: 'Only selected weekdays in range' }
          ].map(opt => (
            <label key={opt.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 10, border: `1px solid ${mode === opt.key ? 'var(--color-primary)' : 'var(--color-border)'}`, background: mode === opt.key ? 'color-mix(in oklab, var(--color-primary) 12%, transparent)' : 'var(--color-surface-light)', cursor: 'pointer' }}>
              <input type="radio" name="recurrenceMode" checked={mode === opt.key} onChange={() => setMode(opt.key)} style={{ marginTop: 2 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>{opt.label}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{opt.desc}</span>
              </div>
            </label>
          ))}
        </div>

        {(mode === 'daily' || mode === 'dateRange') && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--color-border)' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--color-border)' }} />
            </div>
          </div>
        )}

        {mode === 'specificDays' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Start date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--color-border)' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>End date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--color-border)' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 16 }}>
              {days.map((d, idx) => (
                <button key={d} onClick={() => toggleDay(d)} aria-pressed={selectedDays.includes(d)} style={{ padding: 10, borderRadius: 10, border: `1px solid ${selectedDays.includes(d) ? 'var(--color-primary)' : 'var(--color-border)'}`, background: selectedDays.includes(d) ? 'color-mix(in oklab, var(--color-primary) 12%, transparent)' : 'transparent', cursor: 'pointer', color: 'var(--color-text)' }}>{dayShort[idx]}</button>
              ))}
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <button onClick={handleClear} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>Clear</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleApply} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: 'var(--color-bg)', cursor: 'pointer', fontWeight: 600 }}>Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecurrenceSelector;
