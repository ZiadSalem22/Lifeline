import type { ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
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
const AXIS = 'var(--color-text-muted)';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** A short human label for an axis tick — 'Jul 8' for dates, else the raw x. */
function shortLabel(x: string): string {
  return DATE_RE.test(x) ? format(parseISO(x), 'MMM d') : x;
}

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
  const PAD = 4; // inset so endpoint / max-value dots aren't half-clipped
  const width = Math.max(240, points.length * 24);
  const maxY = points.reduce((max, point) => Math.max(max, point.y), 0) || 1;
  const stepX = (width - PAD * 2) / Math.max(1, points.length - 1);
  const xOf = (index: number) => PAD + index * stepX;
  const yOf = (y: number) => PAD + (1 - y / maxY) * (height - PAD * 2);
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xOf(index)} ${yOf(point.y)}`)
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
        <circle key={point.x} cx={xOf(index)} cy={yOf(point.y)} r="3" fill={color}>
          <title>{`${shortLabel(point.x)}: ${point.y}`}</title>
        </circle>
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
  const TOP = 12; // room for the max-value label
  const AXIS_B = 15; // room for the date labels
  const plotBottom = height - AXIS_B;
  const plotH = plotBottom - TOP;
  const dataMax = points.reduce((m, p) => Math.max(m, p.y ?? 0), 0);
  const yMax = Math.max(max ?? 0, dataMax, target ?? 0) || 1;
  const barW = Math.max(6, Math.min(22, Math.floor(320 / points.length) - 3));
  const gap = 3;
  const width = points.length * (barW + gap) - gap;
  const yOf = (v: number) => plotBottom - (v / yMax) * plotH;
  const last = points[points.length - 1];
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
              <rect x={x} y={TOP} width={barW} height={plotH} fill={TRACK} rx={2} />
              {value !== null && value > 0 && (
                <rect
                  x={x}
                  y={yOf(value)}
                  width={barW}
                  height={plotBottom - yOf(value)}
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
        <text x={0} y={9} fontSize="9" fill={AXIS}>
          {Math.round(yMax).toLocaleString()}
        </text>
        <text x={0} y={height - 3} fontSize="9" fill={AXIS}>
          {shortLabel(points[0]!.x)}
        </text>
        {points.length > 1 && last && (
          <text x={width} y={height - 3} textAnchor="end" fontSize="9" fill={AXIS}>
            {shortLabel(last.x)}
          </text>
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
  /** Zoomed baseline for narrow-band data (weight); default 0. */
  yMin?: number;
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

/** A non-null point flanked by nulls (or a series edge) — a lone path M-command
 * renders zero ink, so these must be drawn as dots or they vanish. */
function isIsolated(points: { y: number | null }[], i: number): boolean {
  if (points[i]?.y === null) return false;
  const prev = i > 0 ? (points[i - 1]?.y ?? null) : null;
  const next = i < points.length - 1 ? (points[i + 1]?.y ?? null) : null;
  return prev === null && next === null;
}

/** Ceiling on the plotted width so a 366-day year fits (~960px) instead of a
 * 6,600px strip whose recent data scrolls off-screen. */
const MAX_TREND_WIDTH = 960;

export function TrendLine({ series, height = 140, yMax, yMin = 0, target, label }: TrendLineProps) {
  const first = series[0];
  if (!first || first.points.length === 0) {
    return <div className={styles.chartEmpty}>No data</div>;
  }
  const n = first.points.length;
  const width = Math.min(Math.max(280, n * 18), MAX_TREND_WIDTH);
  const AXIS_B = 16; // bottom band for date labels
  const plotBottom = height - AXIS_B;
  const plotTop = 6;
  const plotH = plotBottom - plotTop;
  const dataMax = series.reduce((m, s) => s.points.reduce((mm, p) => Math.max(mm, p.y ?? 0), m), 0);
  const top = Math.max(yMax ?? 0, dataMax, target ?? 0) || 1;
  const span = top - yMin || 1;
  const stepX = width / Math.max(1, n - 1);
  const yOf = (v: number) => plotBottom - ((v - yMin) / span) * plotH;
  const gridLines = [0.25, 0.5, 0.75];
  const colors = [INK, INK_2];
  const firstX = first.points[0]?.x;
  const lastX = first.points[n - 1]?.x;
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
            y1={yOf(yMin + span * g)}
            y2={yOf(yMin + span * g)}
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
          <g key={s.label}>
            <path
              d={seriesPath(s.points, stepX, yOf)}
              fill="none"
              stroke={colors[si % colors.length]}
              strokeWidth="2"
              strokeLinejoin="round"
            >
              <title>{s.label}</title>
            </path>
            {s.points.map((p, i) =>
              p.y !== null && isIsolated(s.points, i) ? (
                <circle
                  key={p.x}
                  cx={i * stepX}
                  cy={yOf(p.y)}
                  r="2.5"
                  fill={colors[si % colors.length]}
                >
                  <title>{`${shortLabel(p.x)}: ${p.y}`}</title>
                </circle>
              ) : null,
            )}
          </g>
        ))}
        <text x={2} y={plotTop + 8} fontSize="9" fill={AXIS}>
          {Math.round(top)}
        </text>
        <text x={2} y={plotBottom - 2} fontSize="9" fill={AXIS}>
          {Math.round(yMin)}
        </text>
        {firstX && (
          <text x={0} y={height - 3} fontSize="9" fill={AXIS}>
            {shortLabel(firstX)}
          </text>
        )}
        {lastX && n > 1 && (
          <text x={width} y={height - 3} textAnchor="end" fontSize="9" fill={AXIS}>
            {shortLabel(lastX)}
          </text>
        )}
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
  // Month range caption, from the real (non-pad) days — gives the otherwise
  // anonymous week columns a temporal anchor.
  const realDates = days.filter((d) => DATE_RE.test(d.date)).map((d) => d.date);
  const firstReal = realDates[0];
  const lastReal = realDates[realDates.length - 1];
  const caption =
    firstReal && lastReal
      ? (() => {
          const a = format(parseISO(firstReal), 'MMM yyyy');
          const b = format(parseISO(lastReal), 'MMM yyyy');
          return a === b ? a : `${a} – ${b}`;
        })()
      : null;
  return (
    <div className={styles.heatBlock}>
      <div className={styles.heatWrap} role="img" aria-label={label}>
        {weeks.map((week, wi) => (
          <div key={wi} className={styles.heatWeek}>
            {week.map((day) => {
              const isPad = day.date.startsWith('pad-');
              return (
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
                    isPad
                      ? undefined
                      : (day.title ??
                        `${day.date}${day.value === null ? '' : ` — ${Math.round(day.value * 100)}%`}`)
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
      {caption && <div className={styles.heatCaption}>{caption}</div>}
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
  /** Tooltip/aria for the delta chip, e.g. "vs previous period". */
  deltaTitle?: string | undefined;
  spark?: number[] | undefined;
}

export function StatTile({
  label,
  value,
  delta,
  deltaTone = 'neutral',
  deltaTitle,
  spark,
}: StatTileProps) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <div className={styles.tileRow}>
        <span className={styles.tileValue}>{value}</span>
        {delta !== undefined && (
          <span
            className={styles.tileDelta}
            data-tone={deltaTone}
            title={deltaTitle}
            aria-label={deltaTitle ? `${delta} ${deltaTitle}` : undefined}
          >
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
