import styles from './Statistics.module.css';

/**
 * Dependency-free inline-SVG charts, ported 1:1 from the old
 * components/statistics/Statistics.jsx (no chart library by design).
 */

export interface DonutChartProps {
  /** Percentage 0–100 (clamped). */
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
}

export function DonutChart({
  value,
  size = 120,
  stroke = 12,
  color = 'var(--color-primary)',
}: DonutChartProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference * (1 - clamped / 100);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Completion ${clamped}%`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="var(--color-border)"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="14"
        fill="var(--color-text)"
      >
        {clamped}%
      </text>
    </svg>
  );
}

export interface LinePoint {
  x: string;
  y: number;
}

export interface LineChartProps {
  points: LinePoint[];
  height?: number;
  color?: string;
}

export function LineChart({
  points,
  height = 120,
  color = 'var(--color-primary)',
}: LineChartProps) {
  if (points.length === 0) return <div className={styles.chartEmpty}>No data</div>;
  const width = Math.max(240, points.length * 24);
  const maxY = points.reduce((max, point) => Math.max(max, point.y), 0) || 1;
  const stepX = width / Math.max(1, points.length - 1);
  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${index * stepX} ${height - (point.y / maxY) * height}`,
    )
    .join(' ');
  return (
    <svg
      className={styles.lineChart}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Tasks per day"
    >
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
      {points.map((point, index) => (
        <circle
          key={point.x}
          cx={index * stepX}
          cy={height - (point.y / maxY) * height}
          r="3"
          fill={color}
        />
      ))}
    </svg>
  );
}
