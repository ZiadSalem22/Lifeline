/**
 * Theme Colors Utility
 * 
 * Provides a centralized way to access theme colors dynamically
 * based on the current theme (light/dark mode).
 */

export const getThemeColors = () => {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

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
