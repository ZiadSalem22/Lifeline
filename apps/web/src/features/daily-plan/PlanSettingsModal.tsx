import { useState } from 'react';
import type { DailyPlanData, DailyPlanSettings, PlanHabit, TemplateKey } from '@lifeline/shared';
import { TEMPLATE_KEYS, bmr, maintenanceBase, proposeTarget } from '@lifeline/shared';
import { Modal } from '../../shared/ui/Modal';
import { templateFromDay } from './lib/templates';
import { dividerBelowAt, newHabitId, templateKeyOf, withDividerAt } from './lib/plan-model';
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
 * rate, and a live readout — BMR, maintenance, proposed daily target. The
 * proposal only lands in targets.kcal when the user taps USE (no hidden
 * rewrites of the ring's target).
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
        <label className={styles.macroLabel}>
          DAILY KCAL TARGET
          <select
            className={styles.smallInput}
            value={settings.goal.autoTarget ? 'auto' : 'manual'}
            aria-label="Daily kcal target mode"
            onChange={(e) => patchGoal({ autoTarget: e.target.value === 'auto' })}
          >
            <option value="auto">Auto — follows my goal</option>
            <option value="manual">Manual — I set the number</option>
          </select>
        </label>
        <label
          className={styles.macroLabel}
          title="Percentage of logged exercise calories added to TODAY's budget. 0% keeps the budget fixed (recommended for a cut — exercise deepens the deficit instead)."
        >
          EAT BACK EXERCISE
          <select
            className={styles.smallInput}
            value={settings.goal.creditPct}
            aria-label="Exercise calories credited into the daily budget"
            onChange={(e) => patchGoal({ creditPct: Number.parseInt(e.target.value, 10) })}
          >
            <option value={0}>0% — recommended</option>
            <option value={50}>50%</option>
            <option value={100}>100%</option>
          </select>
        </label>
      </div>
      {bmrRes && proposal ? (
        <div className={styles.energyReadout}>
          <div className={styles.energyReadoutLine}>
            <span>
              BMR ({bmrRes.method === 'katch' ? 'Katch-McArdle, from fat %' : 'Mifflin-St Jeor'})
            </span>
            <span>~{bmrRes.kcal.toLocaleString()} kcal</span>
          </div>
          <div className={styles.energyReadoutLine}>
            <span>Maintenance (before workouts)</span>
            <span>~{maintenanceBase(bmrRes.kcal, profile.activity).toLocaleString()} kcal</span>
          </div>
          <div className={styles.energyReadoutLine}>
            <span>
              {settings.goal.autoTarget ? 'Daily target (auto)' : 'Proposed daily target'}
            </span>
            <span>~{proposal.kcal.toLocaleString()} kcal</span>
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
            settings.targets.kcal !== proposal.kcal && (
              <button
                type="button"
                className={styles.chip}
                style={{ alignSelf: 'flex-start' }}
                onClick={() =>
                  props.patchSettings({ targets: { ...settings.targets, kcal: proposal.kcal } })
                }
              >
                USE ~{proposal.kcal.toLocaleString()} AS DAILY KCAL TARGET
              </button>
            )
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
          <div style={{ fontSize: 12, color: 'var(--plan-muted)' }}>{templateSummary}</div>
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
          <div style={{ fontSize: 11, color: 'var(--plan-muted)', fontStyle: 'italic' }}>
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

        <Section title="Schedule & rows">
          <div className={styles.macroGrid}>
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
                    {h < 10 ? `0${h}` : h}:00
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
                  return (
                    <option key={h} value={h}>
                      {h === 24 ? '00' : h < 10 ? `0${h}` : h}:00
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
          <label className={styles.macroLabel} style={{ fontSize: 9 }}>
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
          <label className={styles.macroLabel} style={{ fontSize: 9 }}>
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
