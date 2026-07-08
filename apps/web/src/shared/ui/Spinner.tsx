import styles from './Spinner.module.css';

export interface SpinnerProps {
  /** Diameter in pixels. */
  size?: number;
  label?: string;
}

export function Spinner({ size = 32, label = 'Loading' }: SpinnerProps) {
  return (
    <span
      className={styles.spinner}
      style={{ width: size, height: size }}
      role="status"
      aria-label={label}
    />
  );
}
