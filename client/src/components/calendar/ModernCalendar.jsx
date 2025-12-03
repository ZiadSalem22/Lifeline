import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, addDays } from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon } from '../../icons/Icons';
import styles from './ModernCalendar.module.css';

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
        if (!selectedDate) return false;
        if (selectedDate === 'today') {
            return isSameDay(date, new Date());
        }
        if (selectedDate === 'tomorrow') {
            return isSameDay(date, addDays(new Date(), 1));
        }
        if (typeof selectedDate === 'string' && selectedDate.includes('-')) {
            return isSameDay(date, new Date(selectedDate + 'T00:00:00'));
        }
        return false;
    };

    // Sync visible month to selected date so highlight stays in view
    useEffect(() => {
        if (!selectedDate) return;
        let target;
        if (selectedDate === 'today') target = new Date();
        else if (selectedDate === 'tomorrow') target = addDays(new Date(), 1);
        else if (typeof selectedDate === 'string' && selectedDate.includes('-')) target = new Date(selectedDate + 'T00:00:00');
        if (target && !isNaN(target.getTime())) {
            const targetMonthStart = startOfMonth(target);
            const currentMonthStart = startOfMonth(currentMonth);
            if (!isSameDay(targetMonthStart, currentMonthStart)) {
                setCurrentMonth(targetMonthStart);
            }
        }
    }, [selectedDate]);

    return (
        <div className={styles.wrap}>
            {/* Month Navigation */}
            <div className={styles.nav}>
                <button
                    onClick={handlePrevMonth}
                    className={styles['nav-btn']}
                >
                    <ChevronLeftIcon />
                </button>
                <h3 className={styles.title}>
                    {format(currentMonth, 'MMMM yyyy')}
                </h3>
                <button
                    onClick={handleNextMonth}
                    className={styles['nav-btn']}
                >
                    <ChevronRightIcon />
                </button>
            </div>

            {/* Week Days */}
            <div className={styles.week}>
                {weekDays.map((day, i) => (
                    <div key={i} className={styles['week-day']}>
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Days */}
            <div className={styles.grid}>
                {emptyDays.map((_, i) => (
                    <div key={`empty-${i}`} className={styles.empty} />
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
                            className={`${styles.tile} ${today && !selected ? styles['tile-today'] : ''} ${selected ? styles['tile-selected'] : ''}`}
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
