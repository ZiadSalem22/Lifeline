/**
 * Theme Colors Utility
 * 
 * Provides a centralized way to access theme colors dynamically
 * based on the current theme (light/dark mode).
 */

export const getThemeColors = () => {
    const theme = document.documentElement.getAttribute('data-theme');

    // Specific definition for Clean Beige
    if (theme === 'clean-beige') {
        return {
            primary: '#8b7765',
            primaryDark: '#6d5b4d',
            primaryLight: '#a69382',
            accent: '#c4b5a3',
            bg: '#fdfbf7',
            surface: '#f3eeda',
            surfaceLight: '#f9f5ea',
            surfaceHover: '#ebe4d0',
            text: '#4a4036',
            textMuted: '#8c7e72',
            border: 'rgba(139, 119, 101, 0.25)',
            borderHover: 'rgba(139, 119, 101, 0.4)',
            shadowPrimary: 'rgba(139, 119, 101, 0.25)',
            shadowDark: 'rgba(74, 64, 54, 0.1)',
        };
    }

    const isDark = ['dark', 'blue-dark', 'midnight'].includes(theme);

    if (isDark) {
        return {
            // Dark Mode - Black & Green
            primary: '#10b981',        // Emerald 500
            primaryDark: '#059669',    // Emerald 600
            primaryLight: '#34d399',   // Emerald 400
            accent: '#6ee7b7',         // Emerald 300
            bg: '#0a0a0a',             // Deep black
            surface: '#171717',        // Neutral 900
            surfaceLight: '#262626',   // Neutral 800
            surfaceHover: '#404040',   // Neutral 700
            text: '#ffffff',           // Pure white
            textMuted: '#a3a3a3',      // Neutral 400
            border: 'rgba(16, 185, 129, 0.1)',
            borderHover: 'rgba(16, 185, 129, 0.3)',
            shadowPrimary: 'rgba(16, 185, 129, 0.2)',
            shadowDark: 'rgba(0, 0, 0, 0.5)',
        };
    } else {
        return {
            // Light Mode - White & Green
            primary: '#059669',        // Emerald 600
            primaryDark: '#047857',    // Emerald 700
            primaryLight: '#10b981',   // Emerald 500
            accent: '#34d399',         // Emerald 400
            bg: '#ffffff',             // Pure white
            surface: '#f9fafb',        // Gray 50
            surfaceLight: '#f3f4f6',   // Gray 100
            surfaceHover: '#e5e7eb',   // Gray 200
            text: '#0a0a0a',           // Deep black
            textMuted: '#6b7280',      // Gray 500
            border: 'rgba(5, 150, 105, 0.15)',
            borderHover: 'rgba(5, 150, 105, 0.3)',
            shadowPrimary: 'rgba(5, 150, 105, 0.15)',
            shadowDark: 'rgba(0, 0, 0, 0.1)',
        };
    }
};

export default getThemeColors;
