import type { ReactNode } from 'react';
import styles from './PageShell.module.css';

export interface PageShellProps {
  heading: string;
  children?: ReactNode;
}

/** Common page frame for this phase's placeholder pages. */
export function PageShell({ heading, children }: PageShellProps) {
  return (
    <section className={`${styles.page} fade-in-slide-down`}>
      <h1 className={styles.heading}>{heading}</h1>
      {children ?? (
        <div className={styles.placeholder}>
          <p>This page is coming online in the next build phase.</p>
        </div>
      )}
    </section>
  );
}
