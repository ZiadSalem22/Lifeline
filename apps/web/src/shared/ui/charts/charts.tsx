import type { ReactNode } from 'react';
import styles from './Charts.module.css';

/**
 * Dependency-free inline-SVG chart kit (no chart library by design — the
 * original Statistics convention, grown for the life-metrics overhaul).
 * Data ink comes from the theme chart tokens: --chart-ink is a
 * guaranteed-contrast color per theme, unlike --color-primary which sits at
 * ~1.4-3:1 on several theme surfaces.
 */

const INK = 'var(--chart-ink)';
const INK_2 = 'var(--chart-ink-2)';
const GRID = 'var(--chart-grid)';
const TRACK = 'var(--chart-track)';
const TARGET = 'var(--chart-target)';

/* ── DonutChart (moved from features/statistics) ─────────────────────────── */

export interface DonutChartProps {
  /** Percentage 0–100 (clamped). */
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
}

export function DonutChart({
  value,
  size = 120,
  stroke = 12,
  color = INK,
  label = 'Completion',
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
      aria-label={`${label} ${clamped}%`}
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

/* ── LineChart (moved from features/statistics) ──────────────────────────── */

export interface LinePoint {
  x: string;
  y: number;
}

export interface LineChartProps {
  points: LinePoint[];
  height?: number;
  color?: string;
  label?: string;
}

export function LineChart({
  points,
  height = 120,
  color = INK,
  label = 'Tasks per day',
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
      aria-label={label}
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

/* ── Sparkline ───────────────────────────────────────────────────────────── */

export function Sparkline({
  values,
  width = 72,
  height = 20,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const path = values
    .map(
      (v, i) =>
        `${i === 0 ? 'M' : 'L'} ${(i * stepX).toFixed(1)} ${(
          height -
          2 -
          ((v - min) / span) * (height - 4)
        ).toFixed(1)}`,
    )
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/* ── BarSeries ───────────────────────────────────────────────────────────── */

export interface BarPoint {
  x: string;
  y: number | null;
  /** Tooltip line; defaults to `x: y`. */
  title?: string;
}

export interface BarSeriesProps {
  points: BarPoint[];
  height?: number;
  /** Y scale ceiling; defaults to the series max (or the target if higher). */
  max?: number;
  /** Dashed horizontal target line (e.g. kcal goal). */
  target?: number;
  label: string;
  color?: string;
}

export function BarSeries({
  points,
  height = 120,
  max,
  target,
  label,
  color = INK,
}: BarSeriesProps) {
  if (points.length === 0) return <div className={styles.chartEmpty}>No data</div>;
  const dataMax = points.reduce((m, p) => Math.max(m, p.y ?? 0), 0);
  const yMax = Math.max(max ?? 0, dataMax, target ?? 0) || 1;
  const barW = Math.max(6, Math.min(22, Math.floor(320 / points.length) - 3));
  const gap = 3;
  const width = points.length * (barW + gap) - gap;
  const yOf = (v: number) => height - (v / yMax) * (height - 6);
  return (
    <div className={styles.chartScroll}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
      >
        {points.map((p, i) => {
          const x = i * (barW + gap);
          const value = p.y;
          return (
            <g key={p.x}>
              <rect x={x} y={0} width={barW} height={height} fill={TRACK} rx={2} />
              {value !== null && value > 0 && (
                <rect
                  x={x}
                  y={yOf(value)}
                  width={barW}
                  height={height - yOf(value)}
                  fill={color}
                  rx={2}
                />
              )}
              <title>{p.title ?? `${p.x}: ${value ?? '—'}`}</title>
            </g>
          );
        })}
        {target !== undefined && target > 0 && (
          <line
            x1={0}
            x2={width}
            y1={yOf(target)}
            y2={yOf(target)}
            stroke={TARGET}
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
        )}
      </svg>
    </div>
  );
}

/* ── TrendLine (gridlines, nullable points, optional 2nd series + target) ── */

export interface TrendSeries {
  label: string;
  points: { x: string; y: number | null }[];
}

export interface TrendLineProps {
  series: TrendSeries[];
  height?: number;
  yMax?: number;
  target?: number;
  label: string;
}

function seriesPath(
  points: { y: number | null }[],
  stepX: number,
  yOf: (v: number) => number,
): string {
  let d = '';
  let pen = false;
  points.forEach((p, i) => {
    if (p.y === null) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'} ${(i * stepX).toFixed(1)} ${yOf(p.y).toFixed(1)} `;
    pen = true;
  });
  return d.trim();
}

export function TrendLine({ series, height = 140, yMax, target, label }: TrendLineProps) {
  const first = series[0];
  if (!first || first.points.length === 0) {
    return <div className={styles.chartEmpty}>No data</div>;
  }
  const n = first.points.length;
  const width = Math.max(280, n * 18);
  const dataMax = series.reduce((m, s) => s.points.reduce((mm, p) => Math.max(mm, p.y ?? 0), m), 0);
  const top = Math.max(yMax ?? 0, dataMax, target ?? 0) || 1;
  const stepX = width / Math.max(1, n - 1);
  const yOf = (v: number) => 4 + (1 - v / top) * (height - 8);
  const gridLines = [0.25, 0.5, 0.75];
  const colors = [INK, INK_2];
  return (
    <div className={styles.chartScroll}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
      >
        {gridLines.map((g) => (
          <line
            key={g}
            x1={0}
            x2={width}
            y1={yOf(top * g)}
            y2={yOf(top * g)}
            stroke={GRID}
            strokeWidth="1"
          />
        ))}
        {target !== undefined && target > 0 && (
          <line
            x1={0}
            x2={width}
            y1={yOf(target)}
            y2={yOf(target)}
            stroke={TARGET}
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
        )}
        {series.map((s, si) => (
          <path
            key={s.label}
            d={seriesPath(s.points, stepX, yOf)}
            fill="none"
            stroke={colors[si % colors.length]}
            strokeWidth="2"
            strokeLinejoin="round"
          >
            <title>{s.label}</title>
          </path>
        ))}
      </svg>
    </div>
  );
}

/* ── CalendarHeatmap ─────────────────────────────────────────────────────── */

export interface HeatDay {
  date: string;
  /** 0–1 intensity; null = no entry that day. */
  value: number | null;
  title?: string;
}

/**
 * GitHub-style consistency grid: columns are weeks, rows Mon–Sun. Expects
 * days pre-sorted ascending and starting on a Monday (callers pad).
 */
export function CalendarHeatmap({ days, label }: { days: HeatDay[]; label: string }) {
  if (days.length === 0) return <div className={styles.chartEmpty}>No data</div>;
  const weeks: HeatDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return (
    <div className={styles.heatWrap} role="img" aria-label={label}>
      {weeks.map((week, wi) => (
        <div key={wi} className={styles.heatWeek}>
          {week.map((day) => (
            <span
              key={day.date}
              className={styles.heatCell}
              data-empty={day.value === null ? 'true' : undefined}
              style={
                day.value !== null && day.value > 0
                  ? { background: 'var(--chart-ink)', opacity: 0.25 + day.value * 0.75 }
                  : undefined
              }
              title={
                day.title ??
                `${day.date}${day.value === null ? '' : ` — ${Math.round(day.value * 100)}%`}`
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── StatTile ────────────────────────────────────────────────────────────── */

export interface StatTileProps {
  label: string;
  value: ReactNode;
  /** Signed delta vs the previous period (already formatted, e.g. "+12%"). */
  delta?: string | undefined;
  /** Whether the delta direction is good news (colors the chip). */
  deltaTone?: 'good' | 'bad' | 'neutral' | undefined;
  spark?: number[] | undefined;
}

export function StatTile({ label, value, delta, deltaTone = 'neutral', spark }: StatTileProps) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <div className={styles.tileRow}>
        <span className={styles.tileValue}>{value}</span>
        {delta !== undefined && (
          <span className={styles.tileDelta} data-tone={deltaTone}>
            {delta}
          </span>
        )}
      </div>
      {spark && spark.length > 1 && (
        <span className={styles.tileSpark}>
          <Sparkline values={spark} />
        </span>
      )}
    </div>
  );
}
