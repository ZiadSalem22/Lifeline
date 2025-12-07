/**
 * useTheme Hook
 * 
 * React hook to access theme colors from CSS variables.
 * Automatically updates when theme changes.
 */

import { useState, useEffect } from 'react';

export const useTheme = () => {
    const [theme, setTheme] = useState('white');

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'white';
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'white' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    // Get CSS variable value
    const getCSSVar = (varName) => {
        return getComputedStyle(document.documentElement)
            .getPropertyValue(`--color-${varName}`)
            .trim();
    };

    return {
        theme,
        toggleTheme,
        colors: {
            primary: getCSSVar('primary'),
            primaryDark: getCSSVar('primary-dark'),
            primaryLight: getCSSVar('primary-light'),
            accent: getCSSVar('accent'),
            bg: getCSSVar('bg'),
            surface: getCSSVar('surface'),
            surfaceLight: getCSSVar('surface-light'),
            surfaceHover: getCSSVar('surface-hover'),
            text: getCSSVar('text'),
            textMuted: getCSSVar('text-muted'),
            border: getCSSVar('border'),
            borderHover: getCSSVar('border-hover'),
            shadowPrimary: getCSSVar('shadow-primary'),
            shadowDark: getCSSVar('shadow-dark'),
        }
    };
};

export default useTheme;
