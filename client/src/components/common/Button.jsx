import React from 'react';
import styles from './Button.module.css';

/**
 * Reusable themed button component.
 * Props:
 * - variant: 'primary' | 'secondary' | 'subtle' | 'danger' | 'ghost'
 * - fullWidth: boolean
 * - icon: ReactNode (optional left icon)
 * - iconRight: ReactNode (optional right icon)
 * - disabled: boolean
 * - onClick: function
 * - type: 'button' | 'submit' | 'reset'
 */
export default function Button({
  children,
  variant = 'secondary',
  fullWidth = false,
  icon,
  iconRight,
  disabled = false,
  onClick,
  type = 'button',
  className = '',
  ariaLabel,
}) {
  const cls = [styles.btn, styles[variant]];
  if (fullWidth) cls.push(styles.fullWidth);
  if (disabled) cls.push(styles.disabled);
  if (className) cls.push(className);

  return (
    <button
      type={type}
      className={cls.join(' ')}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {icon ? <span>{icon}</span> : null}
      <span>{children}</span>
      {iconRight ? <span>{iconRight}</span> : null}
    </button>
  );
}