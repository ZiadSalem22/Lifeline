import type { ButtonHTMLAttributes } from 'react';
import styles from './IconButton.module.css';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name — icon-only buttons must always have one. */
  'aria-label': string;
  active?: boolean;
}

export function IconButton({
  active = false,
  className,
  type = 'button',
  children,
  ...rest
}: IconButtonProps) {
  const classes = [styles.iconButton, active ? styles.active : undefined, className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
