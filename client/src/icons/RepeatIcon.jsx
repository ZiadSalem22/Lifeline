import React from 'react';

const RepeatIcon = ({ size = 14, color = 'currentColor', style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={style}
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M17 1l4 4-4 4V6H7a3 3 0 00-3 3v2h2V9a1 1 0 011-1h10V1zM7 23l-4-4 4-4v3h10a3 3 0 003-3v-2h-2v2a1 1 0 01-1 1H7v3z"
      fill={color}
    />
  </svg>
);

export default RepeatIcon;
