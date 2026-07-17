import { useState } from 'react';
import type { DailyPlanData, DailyPlanSettings, PlanHabit, TemplateKey } from '@lifeline/shared';
import { TEMPLATE_KEYS, bmi, bmr, maintenanceBase, proposeTarget } from '@lifeline/shared';
import { Modal } from '../../shared/ui/Modal';
import { CityPicker } from './CityPicker';
import { templateFromDay } from './lib/templates';
import { dividerBelowAt, newHabitId, templateKeyOf, withDividerAt } from './lib/plan-model';
import { formatClock } from './lib/time-format';
import styles from './DailyPlan.module.css';

/**
 * Customize panel — nothing in the Daily Plan is hardcoded. Habits (add /
 * rename / reorder / delete / prayer group), targets, schedule hours, row
 * counts, non-negotiable labels, motto + subtitle, the workout→task link,
 * and per-weekday day templates (snapshot the current day with one tap).
 */

export interface PlanSettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: DailyPlanSettings;
  patchSettings: (patch: Partial<DailyPlanSettings>) => void;
  /** The selected day (template snapshots + "this weekday" default). */
  day: DailyPlanData;
  dateStr: string;
  /** Effective body weight (today's or most recent weigh-in); 0 = unknown. */
  weightKg: number;
  /** Most recent logged body-fat %; 0 = unknown. */
  fatPct: number;
}

const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  all: 'Every day',
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className={styles.sectionMiniMuted}>{title}</div>
      {children}
    </div>
  );
}

function NumberField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  // Draft-commit: clamping on every keystroke would fight typing (entering
  // "2200" digit-by-digit momentarily reads "2" → snapped to min). Commit
  // only in-range values; reconcile the text on blur.
  const [draft, setDraft] = useState(String(props.value));
  const [lastValue, setLastValue] = useState(props.value);
  if (props.value !== lastValue) {
    setLastValue(props.value);
    setDraft(String(props.value));
  }
  return (
    <label className={styles.macroLabel}>
      {props.label}
      <input
        type="number"
        className={styles.smallInput}
        style={{ width: '100%', boxSizing: 'border-box' }}
        value={draft}
        min={props.min}
        max={props.max}
        onChange={(e) => {
          setDraft(e.target.value);
          const parsed = Number.parseInt(e.target.value, 10);
          if (!Number.isNaN(parsed) && parsed >= props.min && parsed <= props.max) {
            props.onChange(parsed);
          }
        }}
        onBlur={() => setDraft(String(props.value))}
      />
    </label>
  );
}

const ACTIVITY_LABELS: Record<DailyPlanSettings['profile']['activity'], string> = {
  // Lifestyle EXCLUDING logged workouts — cardio kcal is added on top, so
  // picking a level "because I train" would double-count.
  sedentary: 'Sedentary — desk job, little walking',
  light: 'Light — on your feet a few hours',
  moderate: 'Moderate — active job / lots of walking',
  active: 'Active — physically demanding job',
  very: 'Very active — hard labor',
};

const GOAL_LABELS: Record<DailyPlanSettings['goal']['mode'], string> = {
  cut: 'Cut (lose)',
  maintain: 'Maintain',
  bulk: 'Bulk (gain)',
};

/**
 * BODY & GOAL: energy profile (sex / birth year / lifestyle), goal mode +
 * rate, and a live readout — BMR, BMI, maintenance, daily target. The target
 * is AUTO by default (the plan view materializes it as weight changes);
 * hand-editing KCAL/DAY opts out, SWITCH TO AUTO opts back in.
 */
function BodyGoalSection(props: {
  settings: DailyPlanSettings;
  patchSettings: (patch: Partial<DailyPlanSettings>) => void;
  weightKg: number;
  fatPct: number;
}) {
  const { settings } = props;
  const profile = settings.profile;
  const patchProfile = (patch: Partial<DailyPlanSettings['profile']>) =>
    props.patchSettings({ profile: { ...profile, ...patch } });
  const patchGoal = (patch: Partial<DailyPlanSettings['goal']>) =>
    props.patchSettings({ goal: { ...settings.goal, ...patch } });

  const currentYear = new Date().getFullYear();
  const bmrRes = bmr({
    weightKg: props.weightKg,
    fatPct: props.fatPct,
    heightCm: settings.height,
    birthYear: profile.birthYear,
    sex: profile.sex,
    currentYear,
  });
  const proposal = bmrRes
    ? proposeTarget(bmrRes.kcal, profile.activity, settings.goal, props.weightKg)
    : null;
  const bmiValue = bmi(props.weightKg, settings.height);

  return (
    <Section title="Body & goal — powers the energy ledger">
      <div className={styles.macroGrid}>
        <label className={styles.macroLabel}>
          SEX
          <select
            className={styles.smallInput}
            value={profile.sex}
            aria-label="Sex"
            onChange={(e) => patchProfile({ sex: e.target.value as typeof profile.sex })}
          >
            <option value="unset">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <label className={styles.macroLabel}>
          BIRTH YEAR
          <select
            className={styles.smallInput}
            value={profile.birthYear}
            aria-label="Birth year"
            onChange={(e) => patchProfile({ birthYear: Number.parseInt(e.target.value, 10) })}
          >
            <option value={0}>—</option>
            {Array.from({ length: 90 }, (_, i) => currentYear - 10 - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.macroLabel}>
          LIFESTYLE (EXCL. WORKOUTS)
          <select
            className={styles.smallInput}
            value={profile.activity}
            aria-label="Lifestyle activity"
            onChange={(e) => patchProfile({ activity: e.target.value as typeof profile.activity })}
          >
            {(Object.keys(ACTIVITY_LABELS) as Array<keyof typeof ACTIVITY_LABELS>).map((k) => (
              <option key={k} value={k}>
                {ACTIVITY_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.macroLabel}>
          GOAL
          <select
            className={styles.smallInput}
            value={settings.goal.mode}
            aria-label="Weight goal"
            onChange={(e) =>
              // Declaring a goal hands the target to the engine — that's the
              // whole point of declaring one. The TARGET select opts back out.
              patchGoal({ mode: e.target.value as typeof settings.goal.mode, autoTarget: true })
            }
          >
            {(Object.keys(GOAL_LABELS) as Array<keyof typeof GOAL_LABELS>).map((k) => (
              <option key={k} value={k}>
                {GOAL_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        {settings.goal.mode !== 'maintain' && (
          <label className={styles.macroLabel}>
            RATE KG / WEEK
            <select
              className={styles.smallInput}
              value={settings.goal.rateKgPerWeek}
              aria-label="Goal rate kg per week"
              onChange={(e) => patchGoal({ rateKgPerWeek: Number.parseFloat(e.target.value) })}
            >
              {[0.25, 0.5, 0.75, 1].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {bmrRes && proposal ? (
        <div className={styles.energyReadout}>
          <div className={styles.energyReadoutLine}>
            <span>
              BMR ({bmrRes.method === 'katch' ? 'Katch-McArdle, from fat %' : 'Mifflin-St Jeor'})
            </span>
            <span>{bmrRes.kcal.toLocaleString()} kcal</span>
          </div>
          {bmiValue > 0 && (
            <div className={styles.energyReadoutLine}>
              <span>BMI</span>
              <span>{bmiValue}</span>
            </div>
          )}
          <div className={styles.energyReadoutLine}>
            <span>Maintenance (before workouts)</span>
            <span>{maintenanceBase(bmrRes.kcal, profile.activity).toLocaleString()} kcal</span>
          </div>
          <div className={styles.energyReadoutLine}>
            <span>
              {settings.goal.autoTarget ? 'Daily target (auto)' : 'Proposed daily target'}
            </span>
            <span>{proposal.kcal.toLocaleString()} kcal</span>
          </div>
          {proposal.warnings.map((w) => (
            <div key={w} className={styles.energyWarn}>
              {w}
            </div>
          ))}
          {settings.goal.autoTarget ? (
            <div className={styles.energyHint}>
              Target follows your goal automatically — it re-computes as your weight changes.
            </div>
          ) : (
            <button
              type="button"
              className={styles.chip}
              style={{ alignSelf: 'flex-start' }}
              onClick={() => patchGoal({ autoTarget: true })}
            >
              SWITCH TO AUTO — target {proposal.kcal.toLocaleString()}
            </button>
          )}
        </div>
      ) : (
        <div className={styles.energyWarn}>
          {settings.goal.autoTarget ? 'Auto target is waiting on these inputs: ' : ''}
          Needs a weigh-in plus either a body-fat % (best) or height + birth year + sex — weight and
          measurements live on the Weight card.
        </div>
      )}
    </Section>
  );
}

/** Aladhan calculation methods. -1 = Auto (let the API pick for the city). */
const PRAYER_METHODS: { value: number; label: string }[] = [
  { value: -1, label: 'Auto — best for your city' },
  { value: 3, label: 'Muslim World League' },
  { value: 2, label: 'ISNA — North America' },
  { value: 4, label: 'Umm al-Qura — Makkah' },
  { value: 5, label: 'Egyptian General Authority' },
  { value: 1, label: 'Univ. of Islamic Sciences, Karachi' },
  { value: 7, label: 'Univ. of Tehran' },
  { value: 0, label: 'Shia Ithna-Ashari — Jafari' },
  { value: 8, label: 'Gulf Region' },
  { value: 9, label: 'Kuwait' },
  { value: 10, label: 'Qatar' },
  { value: 11, label: 'Singapore' },
  { value: 13, label: 'Turkey — Diyanet' },
];

/**
 * PRAYER TIMES: type a city (+ country) to show accurate times on the five
 * salah habit rows. Auto lets the provider pick the closest authority for the
 * location; the Advanced disclosure overrides it with a specific method.
 */
function PrayerSection(props: {
  settings: DailyPlanSettings;
  patchSettings: (patch: Partial<DailyPlanSettings>) => void;
}) {
  const prayer = props.settings.prayer;
  const [showAdvanced, setShowAdvanced] = useState(prayer.method >= 0);
  const patchPrayer = (patch: Partial<DailyPlanSettings['prayer']>) =>
    props.patchSettings({ prayer: { ...prayer, ...patch } });
  const wordLabel = { fontSize: 'calc(9px * var(--plan-scale, 1))' } as const;
  const fullWidth = { width: '100%', boxSizing: 'border-box' } as const;

  return (
    <Section title="Prayer times — shown on the five salah rows">
      <CityPicker
        idPrefix="prayer"
        value={{
          city: prayer.city,
          country: prayer.country,
          latitude: prayer.latitude,
          longitude: prayer.longitude,
        }}
        onChange={(next) => patchPrayer(next)}
      />
      <label
        className={styles.macroLabel}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, ...wordLabel }}
      >
        <input
          type="checkbox"
          checked={prayer.enabled}
          aria-label="Show prayer times on the salah rows"
          onChange={(e) => patchPrayer({ enabled: e.target.checked })}
        />
        SHOW TIMES ON THE SALAH ROWS
      </label>
      <button
        type="button"
        className={styles.habitLabelBtn}
        style={{ alignSelf: 'flex-start', ...wordLabel, color: 'var(--plan-muted)' }}
        aria-expanded={showAdvanced}
        onClick={() => setShowAdvanced((v) => !v)}
      >
        {showAdvanced ? '▾ ' : '▸ '}ADVANCED — CALCULATION METHOD
      </button>
      {showAdvanced && (
        <label className={styles.macroLabel} style={wordLabel}>
          CALCULATION METHOD
          <select
            className={styles.smallInput}
            style={fullWidth}
            value={prayer.method}
            aria-label="Prayer calculation method"
            onChange={(e) => patchPrayer({ method: Number.parseInt(e.target.value, 10) })}
          >
            {PRAYER_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </Section>
  );
}

export function PlanSettingsModal(props: PlanSettingsModalProps) {
  const { settings } = props;
  const [templateKey, setTemplateKey] = useState<TemplateKey>(templateKeyOf(props.dateStr));
  const [savedFlash, setSavedFlash] = useState(false);

  // Re-seed the weekday chip on every open — seeded only at mount, "SAVE
  // CURRENT DAY" would target whatever weekday the modal FIRST opened on
  // after the user navigates to another day.
  const [wasOpen, setWasOpen] = useState(props.open);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) setTemplateKey(templateKeyOf(props.dateStr));
  }

  const patchHabits = (habits: PlanHabit[]) => props.patchSettings({ habits });
  const moveHabit = (index: number, delta: -1 | 1) => {
    const next = [...settings.habits];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    if (item) next.splice(target, 0, item);
    patchHabits(next);
  };

  const template = settings.templates[templateKey];
  const templateSummary = template
    ? [
        `${Object.keys(template.schedule).length} schedule rows`,
        `${template.priorities.length} priorities`,
      ].join(' · ')
    : 'Empty — new days start blank';

  return (
    <Modal open={props.open} onClose={props.onClose} title="Customize Daily Plan">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Section title="Day templates — new days start from these">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TEMPLATE_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={
                  key === templateKey ? `${styles.chip} ${styles.chipActive}` : styles.chip
                }
                onClick={() => setTemplateKey(key)}
              >
                {TEMPLATE_LABELS[key]}
                {settings.templates[key] ? ' •' : ''}
              </button>
            ))}
          </div>
          <div
            style={{ fontSize: 'calc(12px * var(--plan-scale, 1))', color: 'var(--plan-muted)' }}
          >
            {templateSummary}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={styles.tinyPill}
              onClick={() => {
                props.patchSettings({
                  templates: { ...settings.templates, [templateKey]: templateFromDay(props.day) },
                });
                setSavedFlash(true);
                setTimeout(() => setSavedFlash(false), 1600);
              }}
            >
              {savedFlash ? 'SAVED ✓' : 'SAVE CURRENT DAY AS TEMPLATE'}
            </button>
            {template && (
              <button
                type="button"
                className={styles.tinyPillMuted}
                onClick={() => {
                  const templates = { ...settings.templates };
                  delete templates[templateKey];
                  props.patchSettings({ templates });
                }}
              >
                CLEAR
              </button>
            )}
          </div>
          <div
            style={{
              fontSize: 'calc(11px * var(--plan-scale, 1))',
              color: 'var(--plan-muted)',
              fontStyle: 'italic',
            }}
          >
            Build the day you want once (schedule, priorities), then save it here. Yesterday&apos;s
            unfinished items are offered as real tasks by the carry-over bar.
          </div>
        </Section>

        <Section title="Habits">
          {settings.habits.map((habit, i) => (
            <div key={habit.id} className={styles.habitEditRow}>
              <input
                dir="auto"
                className={`${styles.smallInput} ${styles.habitEditName}`}
                maxLength={100}
                value={habit.label}
                aria-label={`Habit ${i + 1} name`}
                onChange={(e) =>
                  patchHabits(
                    settings.habits.map((h, j) => (j === i ? { ...h, label: e.target.value } : h)),
                  )
                }
              />
              <label className={styles.habitEditFlag} title="Prayer rows are bold">
                <input
                  type="checkbox"
                  checked={habit.salah}
                  aria-label={`${habit.label} is a prayer`}
                  onChange={(e) =>
                    patchHabits(
                      settings.habits.map((h, j) =>
                        j === i ? { ...h, salah: e.target.checked } : h,
                      ),
                    )
                  }
                />
                PRAYER
              </label>
              <label className={styles.habitEditFlag} title="Rule line under this row">
                <input
                  type="checkbox"
                  checked={dividerBelowAt(settings.habits, i)}
                  aria-label={`Divider below ${habit.label}`}
                  onChange={(e) => patchHabits(withDividerAt(settings.habits, i, e.target.checked))}
                />
                DIVIDER
              </label>
              <button
                type="button"
                className={styles.iconBtn}
                style={{ color: 'var(--plan-muted)' }}
                aria-label={`Move ${habit.label} up`}
                disabled={i === 0}
                onClick={() => moveHabit(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                style={{ color: 'var(--plan-muted)' }}
                aria-label={`Move ${habit.label} down`}
                disabled={i === settings.habits.length - 1}
                onClick={() => moveHabit(i, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label={`Delete habit ${habit.label}`}
                onClick={() => {
                  if (!window.confirm(`Delete habit "${habit.label}"?`)) return;
                  patchHabits(settings.habits.filter((_, j) => j !== i));
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M5 5l14 14" />
                  <path d="M19 5L5 19" />
                </svg>
              </button>
            </div>
          ))}
          <button
            type="button"
            className={styles.presetChipDashed}
            style={{ alignSelf: 'flex-start' }}
            onClick={() =>
              patchHabits([
                ...settings.habits,
                { id: newHabitId(settings.habits), label: 'New habit', salah: false },
              ])
            }
          >
            + Add habit
          </button>
        </Section>

        <Section title="Targets">
          <div className={styles.macroGrid}>
            <NumberField
              label={settings.goal.autoTarget ? 'KCAL / DAY (AUTO)' : 'KCAL / DAY'}
              value={settings.targets.kcal}
              min={500}
              max={10000}
              // Hand-editing the number is an explicit opt-out of auto mode —
              // otherwise the goal engine would overwrite it on the next sync.
              onChange={(kcal) =>
                props.patchSettings({
                  targets: { ...settings.targets, kcal },
                  goal: { ...settings.goal, autoTarget: false },
                })
              }
            />
            <NumberField
              label="PROTEIN G"
              value={settings.targets.protein}
              min={20}
              max={500}
              onChange={(protein) =>
                props.patchSettings({ targets: { ...settings.targets, protein } })
              }
            />
            <NumberField
              label="CARBS G"
              value={settings.targets.carbs}
              min={20}
              max={1000}
              onChange={(carbs) => props.patchSettings({ targets: { ...settings.targets, carbs } })}
            />
            <NumberField
              label="WATER CUPS"
              value={settings.targets.water}
              min={1}
              max={24}
              onChange={(water) => props.patchSettings({ targets: { ...settings.targets, water } })}
            />
          </div>
        </Section>

        <BodyGoalSection
          settings={settings}
          patchSettings={props.patchSettings}
          weightKg={props.weightKg}
          fatPct={props.fatPct}
        />

        <PrayerSection settings={settings} patchSettings={props.patchSettings} />

        <Section title="Schedule & rows">
          <div className={styles.macroGrid}>
            <label className={styles.macroLabel}>
              TIME FORMAT
              <select
                className={styles.smallInput}
                value={settings.timeFormat}
                aria-label="Time format"
                onChange={(e) =>
                  props.patchSettings({ timeFormat: e.target.value as '24h' | '12h' })
                }
              >
                <option value="24h">24-hour (17:30)</option>
                <option value="12h">12-hour (5:30 PM)</option>
              </select>
            </label>
            <label className={styles.macroLabel}>
              DAY STARTS
              <select
                className={styles.smallInput}
                value={settings.dayStartHour}
                aria-label="Day starts at"
                onChange={(e) =>
                  props.patchSettings({ dayStartHour: Number.parseInt(e.target.value, 10) })
                }
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {formatClock(`${h < 10 ? '0' : ''}${h}:00`, settings.timeFormat)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.macroLabel}>
              DAY ENDS
              <select
                className={styles.smallInput}
                value={settings.dayEndHour}
                aria-label="Day ends at"
                onChange={(e) =>
                  props.patchSettings({ dayEndHour: Number.parseInt(e.target.value, 10) })
                }
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const h = i + 1;
                  const key = `${h === 24 ? '00' : h < 10 ? `0${h}` : h}:00`;
                  return (
                    <option key={h} value={h}>
                      {formatClock(key, settings.timeFormat)}
                    </option>
                  );
                })}
              </select>
            </label>
            <NumberField
              label="PRIORITIES"
              value={settings.priorityCount}
              min={1}
              max={5}
              onChange={(priorityCount) => props.patchSettings({ priorityCount })}
            />
            <NumberField
              label="TOMORROW ROWS"
              value={settings.tomorrowCount}
              min={1}
              max={8}
              onChange={(tomorrowCount) => props.patchSettings({ tomorrowCount })}
            />
            <NumberField
              label="GRATITUDE ROWS"
              value={settings.gratitudeCount}
              min={1}
              max={8}
              onChange={(gratitudeCount) => props.patchSettings({ gratitudeCount })}
            />
          </div>
        </Section>

        <Section title="Non-negotiables">
          {settings.nonnegLabels.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                dir="auto"
                className={styles.smallInput}
                style={{ flex: 1 }}
                maxLength={100}
                value={label}
                aria-label={`Non-negotiable ${i + 1}`}
                onChange={(e) =>
                  props.patchSettings({
                    nonnegLabels: settings.nonnegLabels.map((l, j) =>
                      j === i ? e.target.value : l,
                    ),
                  })
                }
              />
              <button
                type="button"
                className={styles.iconBtn}
                aria-label={`Delete non-negotiable ${label}`}
                onClick={() =>
                  props.patchSettings({
                    nonnegLabels: settings.nonnegLabels.filter((_, j) => j !== i),
                  })
                }
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M5 5l14 14" />
                  <path d="M19 5L5 19" />
                </svg>
              </button>
            </div>
          ))}
          {settings.nonnegLabels.length < 8 && (
            <button
              type="button"
              className={styles.presetChipDashed}
              style={{ alignSelf: 'flex-start' }}
              onClick={() =>
                props.patchSettings({ nonnegLabels: [...settings.nonnegLabels, 'New rule'] })
              }
            >
              + Add non-negotiable
            </button>
          )}
        </Section>

        <Section title="Your words">
          <label
            className={styles.macroLabel}
            style={{ fontSize: 'calc(9px * var(--plan-scale, 1))' }}
          >
            MASTHEAD SUBTITLE
            <input
              dir="auto"
              className={styles.smallInput}
              style={{ width: '100%', boxSizing: 'border-box' }}
              maxLength={100}
              value={settings.subtitle}
              aria-label="Masthead subtitle"
              onChange={(e) => props.patchSettings({ subtitle: e.target.value })}
            />
          </label>
          <label
            className={styles.macroLabel}
            style={{ fontSize: 'calc(9px * var(--plan-scale, 1))' }}
          >
            MOTTO (BOTTOM LINE)
            <input
              dir="auto"
              className={styles.smallInput}
              style={{ width: '100%', boxSizing: 'border-box' }}
              maxLength={100}
              value={settings.motto}
              aria-label="Motto"
              onChange={(e) => props.patchSettings({ motto: e.target.value })}
            />
          </label>
        </Section>

        <Section title="Workout sync">
          <div className={styles.macroGrid} style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <label className={styles.macroLabel}>
              COMPLETES TASK # (BLANK = OFF)
              <input
                type="number"
                className={styles.smallInput}
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={settings.gymTaskNumber ?? ''}
                aria-label="Gym task number"
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10);
                  props.patchSettings({
                    gymTaskNumber: Number.isNaN(parsed) || parsed < 1 ? null : parsed,
                  });
                }}
              />
            </label>
            <label className={styles.macroLabel}>
              CHECKS HABIT
              <select
                className={styles.smallInput}
                value={settings.gymHabitId}
                aria-label="Gym habit"
                onChange={(e) => props.patchSettings({ gymHabitId: e.target.value })}
              >
                {settings.habits.map((habit) => (
                  <option key={habit.id} value={habit.id}>
                    {habit.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Section>
      </div>
    </Modal>
  );
}
