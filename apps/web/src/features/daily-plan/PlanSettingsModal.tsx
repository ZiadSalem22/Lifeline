import { useState } from 'react';
import type { DailyPlanData, DailyPlanSettings, PlanHabit, TemplateKey } from '@lifeline/shared';
import { TEMPLATE_KEYS } from '@lifeline/shared';
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

export function PlanSettingsModal(props: PlanSettingsModalProps) {
  const { settings } = props;
  const [templateKey, setTemplateKey] = useState<TemplateKey>(templateKeyOf(props.dateStr));
  const [savedFlash, setSavedFlash] = useState(false);

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
            <div key={habit.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                dir="auto"
                className={styles.smallInput}
                style={{ flex: 1 }}
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
                onClick={() => patchHabits(settings.habits.filter((_, j) => j !== i))}
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
              label="KCAL / DAY"
              value={settings.targets.kcal}
              min={500}
              max={10000}
              onChange={(kcal) => props.patchSettings({ targets: { ...settings.targets, kcal } })}
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
