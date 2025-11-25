import { useState } from 'react';
import { motion } from 'framer-motion';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';

const ModernCalendar = ({ selectedDate, onSelectDate }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const firstDayOfWeek = monthStart.getDay();
    const emptyDays = Array(firstDayOfWeek).fill(null);

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    const handleDateClick = (date) => {
        onSelectDate(format(date, 'yyyy-MM-dd'));
    };

    const isSelected = (date) => {
        if (typeof selectedDate === 'string' && selectedDate.includes('-')) {
            return isSameDay(date, new Date(selectedDate + 'T00:00:00'));
        }
        return false;
    };

    return (
        <div style={{ width: '100%' }}>
            {/* Month Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <button
                    onClick={handlePrevMonth}
                    style={{
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '8px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--color-surface-hover)';
                        e.currentTarget.style.color = 'var(--color-text)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--color-text-muted)';
                    }}
                >
                    <ChevronLeftIcon />
                </button>
                <h3 style={{
                    fontFamily: 'var(--font-family-heading)',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    color: 'var(--color-text)'
                }}>
                    {format(currentMonth, 'MMMM yyyy')}
                </h3>
                <button
                    onClick={handleNextMonth}
                    style={{
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '8px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--color-surface-hover)';
                        e.currentTarget.style.color = 'var(--color-text)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--color-text-muted)';
                    }}
                >
                    <ChevronRightIcon />
                </button>
            </div>

            {/* Week Days */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
                {weekDays.map((day, i) => (
                    <div key={i} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: '500', color: 'var(--color-text-muted)', padding: '8px 0' }}>
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Days */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                {emptyDays.map((_, i) => (
                    <div key={`empty-${i}`} style={{ aspectRatio: '1' }} />
                ))}
                {daysInMonth.map((date, i) => {
                    const selected = isSelected(date);
                    const today = isToday(date);

                    return (
                        <motion.button
                            key={i}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleDateClick(date)}
                            style={{
                                aspectRatio: '1',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                transition: 'all 0.3s',
                                border: today && !selected ? '1px solid var(--color-primary)' : 'none',
                                background: selected ? 'var(--color-primary)' : today ? 'var(--color-surface-hover)' : 'transparent',
                                color: selected ? '#000000' : today ? 'var(--color-text)' : 'var(--color-text-muted)',
                                boxShadow: selected ? 'var(--shadow-primary)' : 'none',
                                cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => {
                                if (!selected) {
                                    e.currentTarget.style.background = 'var(--color-surface-hover)';
                                    e.currentTarget.style.color = 'var(--color-text)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!selected) {
                                    e.currentTarget.style.background = today ? 'var(--color-surface-hover)' : 'transparent';
                                    e.currentTarget.style.color = today ? 'var(--color-text)' : 'var(--color-text-muted)';
                                }
                            }}
                        >
                            {format(date, 'd')}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
};

export default ModernCalendar;
