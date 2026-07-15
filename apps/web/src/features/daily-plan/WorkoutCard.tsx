import { Fragment, useState } from 'react';
import type { DailyPlanData, DailyPlanSettings, GymExercise, GymRoutine } from '@lifeline/shared';
import { Modal } from '../../shared/ui/Modal';
import { WEEK_DAY_NAMES } from './lib/plan-model';
import {
  cardioKcal,
  computeCardio,
  computeStrength,
  isRoutineComplete,
  newRoutineKey,
  resolveRoutineKey,
  routineOf,
} from './lib/workout-lib';
import type { WorkoutState } from './lib/workout-lib';
import { CircleCheck } from './cards';
import styles from './DailyPlan.module.css';

/**
 * Workout logger (design handoff): routine title + set dots + kg inputs +
 * progressive-overload hints + PRs, and the Workout Setup popup (today's
 * routine, weekly split, routine editor). Set progress lives in the DAY blob
 * (workoutDone per routine); routine definitions/split/PRs live in settings.
 * Completing every set flips the gym habit + the configured real task via
 * onCompletionChange.
 */

const fmtKg = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * Number input that doesn't fight typing: clearing the field to retype no
 * longer snaps to 0/1 mid-edit. Drafts locally, commits parseable values,
 * reconciles with the stored value on blur (same pattern as the Customize
 * panel's NumberField).
 */
function DraftNumber(props: {
  value: number;
  ariaLabel: string;
  onCommit: (value: number) => void;
  commit?: (raw: number) => number;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
}) {
  const [draft, setDraft] = useState(String(props.value));
  const [last, setLast] = useState(props.value);
  if (props.value !== last) {
    setLast(props.value);
    setDraft(String(props.value));
  }
  return (
    <input
      type="number"
      className={props.className}
      style={props.style}
      value={draft}
      aria-label={props.ariaLabel}
      onChange={(e) => {
        setDraft(e.target.value);
        const parsed = Number.parseFloat(e.target.value);
        if (!Number.isNaN(parsed)) props.onCommit(props.commit ? props.commit(parsed) : parsed);
      }}
      onBlur={() => setDraft(String(props.value))}
    />
  );
}

export interface WorkoutBodyProps extends WorkoutState {
  patchDay: (patch: Partial<DailyPlanData>) => void;
  patchSettings: (patch: Partial<DailyPlanSettings>) => void;
  /** Fired when today's workout flips complete ⇄ incomplete (habit/task sync). */
  onCompletionChange: (complete: boolean) => void;
  /** Effective body weight (today's weigh-in or most recent) for the cardio
   *  calorie estimate; 0 = unknown → kcal hidden rather than faked. */
  bodyWeightKg: number;
}

/**
 * Ad-hoc cardio logger doubling as the walk calculator: minutes + speed +
 * incline → live "~N kcal" (ACSM via the shared energy lib), LOG adds it to
 * today's cardioDone under the 'quick' key (sums with earlier quick entries)
 * so the burned line, Meals card, and Statistics all pick it up.
 */
function QuickCardio(props: {
  day: DailyPlanData;
  patchDay: (patch: Partial<DailyPlanData>) => void;
  bodyWeightKg: number;
}) {
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(30);
  const [kmh, setKmh] = useState(5);
  const [incline, setIncline] = useState(0);
  const kcal =
    props.bodyWeightKg > 0 && min > 0
      ? Math.round(cardioKcal({ effort: 'walk', kmh, incline }, props.bodyWeightKg, min))
      : 0;

  const log = () => {
    if (min <= 0) return;
    const prev = (props.day.cardioDone ?? {}).quick;
    const km = kmh > 0 ? Math.round(((kmh * min) / 60) * 100) / 100 : 0;
    // Same caps as computeCardio — an over-cap snapshot throws on save.
    const next = {
      min: Math.min(1440, (prev?.min ?? 0) + min),
      km: Math.min(300, Math.round(((prev?.km ?? 0) + km) * 100) / 100),
      kcal: Math.min(5000, (prev?.kcal ?? 0) + kcal),
    };
    props.patchDay({ cardioDone: { ...(props.day.cardioDone ?? {}), quick: next } });
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        className={styles.moreBtn}
        aria-expanded={false}
        onClick={() => setOpen(true)}
      >
        + Quick cardio
      </button>
    );
  }
  return (
    <div className={styles.speedRow} style={{ flexWrap: 'wrap' }}>
      <label className={styles.speedField}>
        <span>min</span>
        <DraftNumber
          className={styles.smallInput}
          style={{ textAlign: 'center', padding: '4px 4px' }}
          value={min}
          ariaLabel="Quick cardio minutes"
          commit={(raw) => Math.max(0, Math.min(600, Math.round(raw)))}
          onCommit={setMin}
        />
      </label>
      <label className={styles.speedField}>
        <span>km/h</span>
        <DraftNumber
          className={styles.smallInput}
          style={{ textAlign: 'center', padding: '4px 4px' }}
          value={kmh}
          ariaLabel="Quick cardio speed km/h"
          commit={(raw) => Math.max(0, Math.min(25, Math.round(raw * 10) / 10))}
          onCommit={setKmh}
        />
      </label>
      <label className={styles.speedField}>
        <span>incline %</span>
        <DraftNumber
          className={styles.smallInput}
          style={{ textAlign: 'center', padding: '4px 4px' }}
          value={incline}
          ariaLabel="Quick cardio incline %"
          commit={(raw) => Math.max(0, Math.min(20, Math.round(raw * 10) / 10))}
          onCommit={setIncline}
        />
      </label>
      <span className={styles.speedHint}>
        {props.bodyWeightKg <= 0 ? 'log a weigh-in first' : kcal > 0 ? `${kcal} kcal` : '—'}
      </span>
      <button
        type="button"
        className={styles.pillBtn}
        aria-label="Log quick cardio"
        onClick={log}
        // Weight required: a 0-kcal quick entry is never re-snapshotted (unlike
        // routine cardio), so it would undercount the day forever.
        disabled={min <= 0 || props.bodyWeightKg <= 0}
      >
        LOG
      </button>
      <button
        type="button"
        className={styles.iconBtn}
        aria-label="Close quick cardio"
        onClick={() => setOpen(false)}
      >
        ×
      </button>
    </div>
  );
}

export function WorkoutBody(props: WorkoutBodyProps) {
  const [setupOpen, setSetupOpen] = useState(false);
  const key = resolveRoutineKey(props);
  const routine = routineOf(props.settings, key);
  const done = props.day.workoutDone[key] ?? [];
  const totalSets = routine.ex.reduce((a, x) => a + x.sets, 0);
  const doneSets = routine.ex.reduce((a, x, i) => a + Math.min(done[i] ?? 0, x.sets), 0);
  const complete = isRoutineComplete(routine, done);
  // Footer sums the WHOLE day's burn (matches the Meals card + Statistics,
  // which sum all routines) so switching today's routine can't make the card
  // disagree with them. `?? {}` guards pre-cardioDone historical blobs.
  const dayCardio = Object.values(props.day.cardioDone ?? {}).reduce(
    (acc, cardio) => ({ min: acc.min + cardio.min, kcal: acc.kcal + cardio.kcal }),
    { min: 0, kcal: 0 },
  );
  const dayStrengthKcal = Object.values(props.day.strengthDone ?? {}).reduce(
    (acc, strength) => acc + strength.kcal,
    0,
  );
  const dayBurnKcal = dayCardio.kcal + dayStrengthKcal;

  // Recompute today's cardio + strength snapshots from the routine's completed
  // exercises whenever dots or minutes change — stored on the day blob so the
  // settings-free metrics extractor can read them.
  const withBurn = (
    nextRoutine: GymRoutine,
    nextDone: number[],
  ): Pick<DailyPlanData, 'cardioDone' | 'strengthDone'> => {
    const cardio = computeCardio(nextRoutine, nextDone, props.bodyWeightKg);
    const cardioDone = { ...(props.day.cardioDone ?? {}) };
    if (cardio.min > 0 || cardio.kcal > 0 || cardio.km > 0) cardioDone[key] = cardio;
    else delete cardioDone[key];
    const strength = computeStrength(nextRoutine, nextDone, props.bodyWeightKg);
    const strengthDone = { ...(props.day.strengthDone ?? {}) };
    if (strength.sets > 0) strengthDone[key] = strength;
    else delete strengthDone[key];
    return { cardioDone, strengthDone };
  };

  const tapSet = (exIdx: number, dotIdx: number) => {
    const current = Math.min(done[exIdx] ?? 0, routine.ex[exIdx]?.sets ?? 0);
    const nextCount = dotIdx + 1 === current ? dotIdx : dotIdx + 1;
    const nextDone = routine.ex.map((_, i) => (i === exIdx ? nextCount : (done[i] ?? 0)));
    const wasComplete = isRoutineComplete(routine, done);
    const nowComplete = isRoutineComplete(routine, nextDone);
    props.patchDay({
      workoutDone: { ...props.day.workoutDone, [key]: nextDone },
      ...withBurn(routine, nextDone),
    });
    if (wasComplete !== nowComplete) props.onCompletionChange(nowComplete);
  };

  const setKg = (exIdx: number, kg: number) => {
    const routines = {
      ...props.settings.gym.routines,
      [key]: {
        ...routine,
        ex: routine.ex.map((x, i) => (i === exIdx ? { ...x, kg } : x)),
      },
    };
    props.patchSettings({ gym: { ...props.settings.gym, routines } });
  };

  const setMin = (exIdx: number, min: number) => {
    const nextRoutine = {
      ...routine,
      ex: routine.ex.map((x, i) => (i === exIdx ? { ...x, min } : x)),
    };
    props.patchSettings({
      gym: {
        ...props.settings.gym,
        routines: { ...props.settings.gym.routines, [key]: nextRoutine },
      },
    });
    props.patchDay(withBurn(nextRoutine, done));
  };

  const setPr = (i: number, field: 'n' | 'v', value: string) => {
    const prs = props.settings.gym.prs.map((p, j) => (j === i ? { ...p, [field]: value } : p));
    props.patchSettings({ gym: { ...props.settings.gym, prs } });
  };

  return (
    <div className={styles.cardBody} style={{ gap: 8 }}>
      <div className={styles.gymHeadRow}>
        <button
          type="button"
          className={styles.gymTitleBtn}
          onClick={() => setSetupOpen(true)}
          title="Edit routines, exercises & weekly split"
        >
          <span className={styles.gymTitle}>
            {routine.ex.length === 0 ? 'Rest Day' : `${routine.name} Day`}
          </span>
          <span className={styles.gymSubtitle}>
            {routine.ex.length === 0 ? 'Recovery' : `${doneSets} / ${totalSets} sets done`}
          </span>
        </button>
        <button type="button" className={styles.pillBtn} onClick={() => setSetupOpen(true)}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 6h16" />
            <path d="M4 12h16" />
            <path d="M4 18h10" />
          </svg>
          EDIT ROUTINES
        </button>
      </div>

      {routine.ex.length === 0 && (
        <div className={styles.gymRest}>Rest day — recovery, stretching, long walk.</div>
      )}

      {/* Long routines scroll inside the card on phones. */}
      <div className={styles.scrollList}>
        {routine.ex.map((ex, i) => {
          const exDone = Math.min(done[i] ?? 0, ex.sets);
          const timed = ex.type === 'time';
          return (
            <div key={i} className={styles.exRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span dir="auto" className={exDone >= ex.sets ? styles.exNameDone : styles.exName}>
                  {ex.n}
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    flex: '0 0 auto',
                  }}
                >
                  <DraftNumber
                    className={styles.kgInput}
                    value={timed ? ex.min : ex.kg}
                    ariaLabel={`${ex.n} ${timed ? 'minutes' : 'kg'}`}
                    commit={(raw) =>
                      timed
                        ? Math.max(0, Math.min(600, Math.round(raw)))
                        : Math.max(0, Math.min(2000, raw))
                    }
                    onCommit={(v) => (timed ? setMin(i, v) : setKg(i, v))}
                  />
                  <span
                    style={{
                      fontSize: 'calc(10px * var(--plan-scale, 1))',
                      color: 'var(--plan-muted)',
                    }}
                  >
                    {timed ? 'min' : 'kg'}
                  </span>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', gap: 5 }}>
                  {Array.from({ length: ex.sets }, (_, k) => (
                    <CircleCheck
                      key={k}
                      on={k < exDone}
                      size={17}
                      label={`${ex.n} ${timed ? 'round' : 'set'} ${k + 1}`}
                      onToggle={() => tapSet(i, k)}
                    />
                  ))}
                </span>
                <span className={styles.setsLabel}>
                  {timed
                    ? `${ex.sets > 1 ? `${ex.sets} × ` : ''}${ex.min} min`
                    : `${ex.sets} × ${ex.reps}`}
                </span>
                {timed ? (
                  <span className={styles.overloadHint}>
                    {ex.kmh > 0
                      ? `${ex.kmh} km/h${ex.incline > 0 ? ` · ${ex.incline}%` : ''}`
                      : ex.effort}
                  </span>
                ) : (
                  ex.last > 0 && (
                    <span className={styles.overloadHint}>
                      Last {fmtKg(ex.last)}kg → try {fmtKg(ex.last + 2.5)}
                    </span>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      <QuickCardio day={props.day} patchDay={props.patchDay} bodyWeightKg={props.bodyWeightKg} />

      {(dayCardio.min > 0 || dayBurnKcal > 0) && (
        <div className={styles.cardioBurn}>
          {dayCardio.min > 0 ? `${dayCardio.min} min cardio · ` : ''}
          {dayBurnKcal > 0 ? `${dayBurnKcal} kcal burned` : ''}
          {dayStrengthKcal > 0 && dayCardio.kcal > 0 ? ' (cardio + sets)' : ''}
        </div>
      )}

      {complete && (
        <div className={styles.gymDone}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Workout complete — habit + task checked
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
        <div className={styles.sectionMiniRuled}>Personal Records</div>
        {props.settings.gym.prs.map((pr, i) => (
          <div key={i} className={styles.prRow}>
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="var(--plan-primary)"
              style={{ flex: '0 0 auto' }}
              aria-hidden="true"
            >
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.3-6.2-4.5-6.2 4.5 2.4-7.3L2 9.4h7.6z" />
            </svg>
            <input
              dir="auto"
              className={styles.prName}
              value={pr.n}
              aria-label={`PR name ${i + 1}`}
              onChange={(e) => setPr(i, 'n', e.target.value)}
            />
            <input
              className={styles.prVal}
              value={pr.v}
              aria-label={`PR value ${i + 1}`}
              onChange={(e) => setPr(i, 'v', e.target.value)}
            />
          </div>
        ))}
      </div>

      <WorkoutSetupModal
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        day={props.day}
        settings={props.settings}
        selectedIdx={props.selectedIdx}
        patchDay={props.patchDay}
        patchSettings={props.patchSettings}
        bodyWeightKg={props.bodyWeightKg}
        activeKey={key}
      />
    </div>
  );
}

/* ── Workout Setup popup ─────────────────────────────────────────────────── */

interface SetupProps {
  open: boolean;
  onClose: () => void;
  day: DailyPlanData;
  settings: DailyPlanSettings;
  selectedIdx: number;
  activeKey: string;
  bodyWeightKg: number;
  patchDay: (patch: Partial<DailyPlanData>) => void;
  patchSettings: (patch: Partial<DailyPlanSettings>) => void;
}

export function WorkoutSetupModal(props: SetupProps) {
  const gym = props.settings.gym;
  const keys = Object.keys(gym.routines);
  const [editKeyState, setEditKey] = useState<string | null>(null);
  const editKey = editKeyState && gym.routines[editKeyState] ? editKeyState : (keys[0] ?? 'rest');
  const editRoutine = routineOf(props.settings, editKey);
  // All-timed routine → the Sets/Reps/Kg headers read Rounds/Min/Effort.
  const allTimed = editRoutine.ex.length > 0 && editRoutine.ex.every((e) => e.type === 'time');

  const patchGym = (patch: Partial<DailyPlanSettings['gym']>) =>
    props.patchSettings({ gym: { ...gym, ...patch } });

  const updateEdit = (patch: Partial<GymRoutine>) =>
    patchGym({ routines: { ...gym.routines, [editKey]: { ...editRoutine, ...patch } } });

  const updateEx = (i: number, patch: Partial<GymExercise>) =>
    updateEdit({ ex: editRoutine.ex.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  // Today's cardio + strength snapshots for a routine, recomputed from its
  // exercises (routine edits must keep the day's burn history honest).
  const recomputeBurn = (
    routineKey: string,
    nextRoutine: GymRoutine,
    nextDone: number[],
  ): Pick<DailyPlanData, 'cardioDone' | 'strengthDone'> => {
    const cardio = computeCardio(nextRoutine, nextDone, props.bodyWeightKg);
    const cardioDone = { ...(props.day.cardioDone ?? {}) };
    if (cardio.min > 0 || cardio.kcal > 0 || cardio.km > 0) cardioDone[routineKey] = cardio;
    else delete cardioDone[routineKey];
    const strength = computeStrength(nextRoutine, nextDone, props.bodyWeightKg);
    const strengthDone = { ...(props.day.strengthDone ?? {}) };
    if (strength.sets > 0) strengthDone[routineKey] = strength;
    else delete strengthDone[routineKey];
    return { cardioDone, strengthDone };
  };

  // Edits that change minutes/effort/type re-snapshot today's burn.
  const updateExTimed = (i: number, patch: Partial<GymExercise>) => {
    const nextRoutine = {
      ...editRoutine,
      ex: editRoutine.ex.map((x, j) => (j === i ? { ...x, ...patch } : x)),
    };
    updateEdit({ ex: nextRoutine.ex });
    const doneArr = props.day.workoutDone[editKey];
    if (doneArr) props.patchDay(recomputeBurn(editKey, nextRoutine, doneArr));
  };

  // workoutDone is index-keyed, so removing an exercise must splice today's
  // logged dots at the same index or they shift onto the wrong exercises.
  const removeEx = (i: number) => {
    const nextEx = editRoutine.ex.filter((_, j) => j !== i);
    updateEdit({ ex: nextEx });
    const doneArr = props.day.workoutDone[editKey];
    if (doneArr) {
      const nextDone = doneArr.filter((_, j) => j !== i);
      props.patchDay({
        workoutDone: { ...props.day.workoutDone, [editKey]: nextDone },
        ...recomputeBurn(editKey, { ...editRoutine, ex: nextEx }, nextDone),
      });
    }
  };

  // Shrinking sets must clamp today's logged dots (the extractor doesn't clamp,
  // so a stale high count would show phantom sets in Statistics).
  const setEditSets = (i: number, sets: number) => {
    const nextRoutine = {
      ...editRoutine,
      ex: editRoutine.ex.map((x, j) => (j === i ? { ...x, sets } : x)),
    };
    updateEdit({ ex: nextRoutine.ex });
    const doneArr = props.day.workoutDone[editKey];
    if (doneArr) {
      const clamped = doneArr.map((v, j) => (j === i ? Math.min(v, sets) : v));
      props.patchDay({
        workoutDone: { ...props.day.workoutDone, [editKey]: clamped },
        ...recomputeBurn(editKey, nextRoutine, clamped),
      });
    }
  };

  const createRoutine = () => {
    const key = newRoutineKey(gym.routines);
    patchGym({ routines: { ...gym.routines, [key]: { name: 'New Routine', ex: [] } } });
    setEditKey(key);
  };

  const deleteRoutine = () => {
    if (editKey === 'rest' || keys.length <= 2) return;
    const routines = { ...gym.routines };
    delete routines[editKey];
    patchGym({
      routines,
      week: gym.week.map((k) => (k === editKey ? 'rest' : k)),
    });
    // Drop the deleted routine's day state too, or its burn would keep
    // counting in Meals/Statistics with no card to surface it.
    const dayPatch: Partial<DailyPlanData> = {};
    if (props.day.workoutRoutine === editKey) dayPatch.workoutRoutine = null;
    if (props.day.cardioDone?.[editKey]) {
      const cardioDone = { ...props.day.cardioDone };
      delete cardioDone[editKey];
      dayPatch.cardioDone = cardioDone;
    }
    if (props.day.strengthDone?.[editKey]) {
      const strengthDone = { ...props.day.strengthDone };
      delete strengthDone[editKey];
      dayPatch.strengthDone = strengthDone;
    }
    if (Object.keys(dayPatch).length > 0) props.patchDay(dayPatch);
    setEditKey(Object.keys(routines)[0] ?? 'rest');
  };

  return (
    <Modal open={props.open} onClose={props.onClose} title="Workout Setup">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className={styles.sectionMiniMuted}>Today&apos;s Routine</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {keys.map((k) => (
              <button
                key={k}
                type="button"
                className={
                  k === props.activeKey ? `${styles.chip} ${styles.chipActive}` : styles.chip
                }
                onClick={() => props.patchDay({ workoutRoutine: k })}
              >
                {gym.routines[k]?.name ?? k}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, order: 3 }}>
          <div className={styles.sectionMiniMuted}>Weekly Split</div>
          <div className={styles.weekSplitGrid}>
            {gym.week.map((value, di) => (
              <div key={di} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className={di === props.selectedIdx ? styles.weekDayToday : styles.weekDay}>
                  {WEEK_DAY_NAMES[di]}
                </span>
                <select
                  className={styles.weekSelect}
                  value={value}
                  aria-label={`Routine for ${WEEK_DAY_NAMES[di]}`}
                  onChange={(e) => {
                    patchGym({ week: gym.week.map((v, j) => (j === di ? e.target.value : v)) });
                    // Editing the selected day's slot clears the per-day override.
                    if (di === props.selectedIdx) props.patchDay({ workoutRoutine: null });
                  }}
                >
                  {keys.map((k) => (
                    <option key={k} value={k}>
                      {gym.routines[k]?.name ?? k}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, order: 2 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <div className={styles.sectionMiniRuled}>Edit Routines</div>
            <button type="button" className={styles.presetChipDashed} onClick={createRoutine}>
              + NEW ROUTINE
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {keys.map((k) => (
              <button
                key={k}
                type="button"
                className={k === editKey ? `${styles.chip} ${styles.chipActive}` : styles.chip}
                onClick={() => setEditKey(k)}
              >
                {gym.routines[k]?.name ?? k}
              </button>
            ))}
            <button
              type="button"
              className={styles.presetChipDashed}
              aria-label="New routine"
              onClick={createRoutine}
            >
              + NEW
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              dir="auto"
              className={styles.smallInput}
              style={{ flex: 1, fontWeight: 600 }}
              maxLength={100}
              value={editRoutine.name}
              aria-label="Routine name"
              onChange={(e) => updateEdit({ name: e.target.value })}
            />
            {editKey !== 'rest' && (
              <button
                type="button"
                className={styles.iconBtn}
                style={{
                  padding: 7,
                  border: '1px solid var(--plan-card-border)',
                  borderRadius: 8,
                  color: 'var(--plan-danger)',
                }}
                disabled={keys.length <= 2}
                title={
                  keys.length <= 2 ? 'Keep at least one routine besides Rest' : 'Delete routine'
                }
                aria-label="Delete routine"
                onClick={deleteRoutine}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M6 6l1 14h10l1-14" />
                </svg>
              </button>
            )}
          </div>
          <div className={styles.exEditGrid}>
            <span className={styles.exEditHead}>Exercise</span>
            <span className={styles.exEditHead} style={{ textAlign: 'center' }}>
              {allTimed ? 'Rounds' : 'Sets'}
            </span>
            <span className={styles.exEditHead} style={{ textAlign: 'center' }}>
              {allTimed ? 'Min' : 'Reps'}
            </span>
            <span className={styles.exEditHead} style={{ textAlign: 'center' }}>
              {allTimed ? 'Effort' : 'Kg'}
            </span>
            <span />
          </div>
          {editRoutine.ex.map((ex, i) => {
            const timed = ex.type === 'time';
            // Per-round estimate with the CURRENT speed/incline — live feedback
            // while tuning ("walk 30 min at this speed and incline → ~N kcal").
            const roundKcal =
              timed && ex.min > 0 ? Math.round(cardioKcal(ex, props.bodyWeightKg, ex.min)) : 0;
            return (
              <Fragment key={i}>
                <div className={styles.exEditGrid}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                    <input
                      dir="auto"
                      className={styles.smallInput}
                      style={{ flex: 1, minWidth: 0 }}
                      maxLength={100}
                      value={ex.n}
                      aria-label={`Exercise ${i + 1} name`}
                      onChange={(e) => updateEx(i, { n: e.target.value })}
                    />
                    <button
                      type="button"
                      className={styles.typeToggle}
                      aria-label={`Exercise ${i + 1} type: ${timed ? 'timed' : 'strength'}`}
                      title={
                        timed
                          ? 'Timed / cardio — tap for strength'
                          : 'Strength — tap for timed / cardio'
                      }
                      onClick={() =>
                        updateExTimed(
                          i,
                          timed ? { type: 'str' } : { type: 'time', min: ex.min > 0 ? ex.min : 15 },
                        )
                      }
                    >
                      {timed ? 'TIME' : 'STR'}
                    </button>
                  </span>
                  <DraftNumber
                    className={styles.smallInput}
                    style={{ textAlign: 'center', padding: '6px 4px' }}
                    value={ex.sets}
                    ariaLabel={`Exercise ${i + 1} ${timed ? 'rounds' : 'sets'}`}
                    commit={(raw) => Math.max(1, Math.min(10, Math.round(raw)))}
                    onCommit={(sets) => setEditSets(i, sets)}
                  />
                  {timed ? (
                    <DraftNumber
                      className={styles.smallInput}
                      style={{ textAlign: 'center', padding: '6px 4px' }}
                      value={ex.min}
                      ariaLabel={`Exercise ${i + 1} minutes`}
                      commit={(raw) => Math.max(0, Math.min(600, Math.round(raw)))}
                      onCommit={(min) => updateExTimed(i, { min })}
                    />
                  ) : (
                    <input
                      className={styles.smallInput}
                      style={{ textAlign: 'center', padding: '6px 4px' }}
                      value={ex.reps}
                      maxLength={20}
                      aria-label={`Exercise ${i + 1} reps`}
                      onChange={(e) => updateEx(i, { reps: e.target.value })}
                    />
                  )}
                  {timed ? (
                    <select
                      className={styles.smallInput}
                      style={{ textAlign: 'center', padding: '6px 2px' }}
                      value={ex.effort}
                      aria-label={`Exercise ${i + 1} effort`}
                      onChange={(e) =>
                        updateExTimed(i, { effort: e.target.value as GymExercise['effort'] })
                      }
                    >
                      <option value="walk">walk</option>
                      <option value="jog">jog</option>
                      <option value="run">run</option>
                    </select>
                  ) : (
                    <DraftNumber
                      className={styles.smallInput}
                      style={{ textAlign: 'center', padding: '6px 4px' }}
                      value={ex.kg}
                      ariaLabel={`Exercise ${i + 1} kg`}
                      commit={(raw) => Math.max(0, Math.min(2000, raw))}
                      onCommit={(kg) => updateEx(i, { kg })}
                    />
                  )}
                  <button
                    type="button"
                    className={styles.iconBtn}
                    title="Remove exercise"
                    aria-label={`Remove exercise ${i + 1}`}
                    onClick={() => removeEx(i)}
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
                {timed && (
                  <div className={styles.speedRow}>
                    <label className={styles.speedField}>
                      <span>km/h</span>
                      <DraftNumber
                        className={styles.smallInput}
                        style={{ textAlign: 'center', padding: '4px 4px' }}
                        value={ex.kmh}
                        ariaLabel={`Exercise ${i + 1} speed km/h`}
                        commit={(raw) => Math.max(0, Math.min(25, Math.round(raw * 10) / 10))}
                        onCommit={(kmh) => updateExTimed(i, { kmh })}
                      />
                    </label>
                    <label className={styles.speedField}>
                      <span>incline %</span>
                      <DraftNumber
                        className={styles.smallInput}
                        style={{ textAlign: 'center', padding: '4px 4px' }}
                        value={ex.incline}
                        ariaLabel={`Exercise ${i + 1} incline %`}
                        commit={(raw) => Math.max(0, Math.min(20, Math.round(raw * 10) / 10))}
                        onCommit={(incline) => updateExTimed(i, { incline })}
                      />
                    </label>
                    <span className={styles.speedHint}>
                      {props.bodyWeightKg <= 0
                        ? 'log a weigh-in for calorie estimates'
                        : roundKcal > 0
                          ? `${roundKcal} kcal / round${ex.kmh > 0 ? ' (speed + incline)' : ` (${ex.effort})`}`
                          : 'set minutes for an estimate'}
                    </span>
                  </div>
                )}
              </Fragment>
            );
          })}
          <button
            type="button"
            className={styles.presetChipDashed}
            style={{ alignSelf: 'flex-start' }}
            onClick={() =>
              updateEdit({
                ex: [
                  ...editRoutine.ex,
                  {
                    n: 'New Exercise',
                    type: 'str',
                    sets: 3,
                    reps: '10',
                    kg: 20,
                    last: 0,
                    min: 0,
                    km: 0,
                    effort: 'walk',
                    kmh: 0,
                    incline: 0,
                  },
                ],
              })
            }
          >
            + Add exercise
          </button>
        </div>
      </div>
    </Modal>
  );
}
