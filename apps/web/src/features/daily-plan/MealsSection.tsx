import { useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import type {
  ChatFood,
  DailyPlanData,
  DailyPlanSettings,
  MealItem,
  MealSlot,
} from '@lifeline/shared';
import { MEAL_SLOTS } from '@lifeline/shared';
import { Modal } from '../../shared/ui/Modal';
import { detectMeal, guessSlot, logSummary, parseFood, photoFoods } from './lib/food-parser';
import styles from './DailyPlan.module.css';

/**
 * Meals & Nutrition (full-width, design handoff): smart log bar (text +
 * photo → demo parser), pinned preset chips, AI response strip with
 * SAVE AS MEAL / UNDO, a 4-slot meals diary with per-item macros, daily
 * totals (kcal ring + protein/carbs bars), and the saved-meals popup.
 */

type PatchDay = (
  patch: Partial<DailyPlanData> | ((day: DailyPlanData) => Partial<DailyPlanData>),
) => void;

export interface MealsSectionProps {
  day: DailyPlanData;
  settings: DailyPlanSettings;
  patchDay: PatchDay;
  patchSettings: (patch: Partial<DailyPlanSettings>) => void;
  onHide: () => void;
  /** Recently logged items from past days — 1-tap re-log. */
  recentItems: MealItem[];
}

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};
const r1 = (v: number): number => Math.round(v * 10) / 10;

function foodsToItems(foods: ChatFood[]): MealItem[] {
  return foods.map((f) => ({ n: f.name, cal: f.cal, p: f.p, c: f.c, f: f.f }));
}

export function MealsSection(props: MealsSectionProps) {
  const { day, settings } = props;
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [libSlot, setLibSlot] = useState<MealSlot | null>(null);
  const [libEdit, setLibEdit] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const totals = MEAL_SLOTS.reduce(
    (acc, slot) => {
      for (const item of day.meals[slot]) {
        acc.cal += num(item.cal);
        acc.p += num(item.p);
        acc.c += num(item.c);
        acc.f += num(item.f);
      }
      return acc;
    },
    { cal: 0, p: 0, c: 0, f: 0 },
  );
  const totCal = Math.round(totals.cal);
  const targets = settings.targets;
  const kcalLeft = Math.max(0, targets.kcal - totCal);
  const CIRC = 2 * Math.PI * 30;
  const calDash = `${(Math.min(1, totCal / targets.kcal) * CIRC).toFixed(1)} ${CIRC.toFixed(1)}`;

  const lastAi = [...day.chat].reverse().find((m) => m.who === 'ai');
  const lastAiIndex = lastAi ? day.chat.lastIndexOf(lastAi) : -1;

  const logFoods = (slot: MealSlot, foods: ChatFood[], reply: string) => {
    props.patchDay((current) => ({
      meals: { ...current.meals, [slot]: [...current.meals[slot], ...foodsToItems(foods)] },
      lastLog: { slot, count: foods.length },
      chat: [...current.chat, { who: 'ai' as const, t: reply, foods }].slice(-40),
    }));
  };

  const send = (text: string, photo: boolean) => {
    const trimmed = text.trim();
    if ((!trimmed && !photo) || typing) return;
    setDraft('');
    props.patchDay((current) => ({
      chat: [
        ...current.chat,
        { who: 'me' as const, t: photo ? `📷 ${trimmed || 'Meal photo'}` : trimmed },
      ].slice(-40),
    }));
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      const hour = new Date().getHours();
      if (photo) {
        const foods = photoFoods();
        const slot = detectMeal(trimmed, hour);
        logFoods(
          slot,
          foods,
          `From your photo I can see:\n${logSummary(foods, slot)}\n\n(Demo — real version sends the image to a vision model)`,
        );
        return;
      }
      const foods = parseFood(trimmed);
      if (foods.length === 0) {
        props.patchDay((current) => ({
          chat: [
            ...current.chat,
            {
              who: 'ai' as const,
              t: "I couldn't recognize that food yet (demo has a small database). Try things like eggs, chicken, rice, oats, shawarma, protein shake…",
            },
          ].slice(-40),
        }));
        return;
      }
      const slot = detectMeal(trimmed, hour);
      logFoods(slot, foods, logSummary(foods, slot));
    }, 900);
  };

  const undoLast = () => {
    props.patchDay((current) => {
      const last = current.lastLog;
      if (!last) return {};
      const arr = [...current.meals[last.slot]];
      arr.splice(Math.max(0, arr.length - last.count), last.count);
      return {
        meals: { ...current.meals, [last.slot]: arr },
        lastLog: null,
        chat: [...current.chat, { who: 'ai' as const, t: 'Undone ✓' }].slice(-40),
      };
    });
  };

  const saveAiAsPreset = () => {
    if (!lastAi?.foods?.length || lastAi.presetSaved) return;
    const foods = lastAi.foods;
    props.patchSettings({
      presets: [
        ...settings.presets,
        {
          name: foods.map((f) => f.name).join(' + '),
          cal: Math.round(foods.reduce((a, f) => a + f.cal, 0)),
          p: r1(foods.reduce((a, f) => a + f.p, 0)),
          c: r1(foods.reduce((a, f) => a + f.c, 0)),
          f: r1(foods.reduce((a, f) => a + f.f, 0)),
          pinned: false,
        },
      ],
    });
    props.patchDay((current) => ({
      chat: current.chat.map((m, i) => (i === lastAiIndex ? { ...m, presetSaved: true } : m)),
    }));
  };

  const logPreset = (preset: DailyPlanSettings['presets'][number], slot: MealSlot) => {
    props.patchDay((current) => ({
      meals: {
        ...current.meals,
        [slot]: [
          ...current.meals[slot],
          { n: preset.name, cal: preset.cal, p: preset.p, c: preset.c, f: preset.f },
        ],
      },
      lastLog: { slot, count: 1 },
      chat: [
        ...current.chat,
        {
          who: 'ai' as const,
          t: `“${preset.name}” → ${SLOT_LABELS[slot]} ✓  (+${preset.cal} kcal · +${preset.p}g P)`,
        },
      ].slice(-40),
    }));
    setLibOpen(false);
  };

  const logRecent = (item: MealItem) => {
    const slot = guessSlot(new Date().getHours());
    props.patchDay((current) => ({
      meals: { ...current.meals, [slot]: [...current.meals[slot], { ...item }] },
      lastLog: { slot, count: 1 },
      chat: [
        ...current.chat,
        {
          who: 'ai' as const,
          t: `“${item.n}” → ${SLOT_LABELS[slot]} ✓  (+${Math.round(num(item.cal))} kcal)`,
        },
      ].slice(-40),
    }));
  };

  const updateItem = (slot: MealSlot, index: number, patch: Partial<MealItem>) => {
    props.patchDay((current) => ({
      meals: {
        ...current.meals,
        [slot]: current.meals[slot].map((item, i) => (i === index ? { ...item, ...patch } : item)),
      },
    }));
  };

  const removeItem = (slot: MealSlot, index: number) => {
    props.patchDay((current) => ({
      meals: { ...current.meals, [slot]: current.meals[slot].filter((_, i) => i !== index) },
    }));
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      send(draft, false);
    }
  };

  const onPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    send(draft, true);
  };

  const pinned = settings.presets.filter((p) => p.pinned);

  return (
    <div className={styles.fullCard}>
      <button
        type="button"
        className={`${styles.cardCtl} ${styles.ctlHide}`}
        title="Hide section"
        aria-label="Hide Meals & Nutrition"
        onClick={props.onHide}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M5 5l14 14" />
          <path d="M19 5L5 19" />
        </svg>
      </button>
      <div className={styles.secbar}>
        <span>Meals &amp; Nutrition</span>
        <span className={styles.secbarBadge}>
          {totCal.toLocaleString()} / {targets.kcal.toLocaleString()} KCAL
        </span>
      </div>

      <div className={styles.logBar}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          aria-label="Meal photo"
          onChange={onPhoto}
        />
        <button
          type="button"
          className={styles.iconBtn}
          style={{ padding: 9, border: '1px solid var(--plan-card-border)', borderRadius: 9 }}
          title="Photo of your meal"
          aria-label="Photo of your meal"
          onClick={() => fileRef.current?.click()}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>
        <input
          dir="auto"
          className={styles.smallInput}
          style={{ flex: 1, padding: '9px 12px', fontSize: 12.5 }}
          placeholder="Log food: “2 eggs and toast for breakfast”…"
          aria-label="Log food"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
        />
        <button
          type="button"
          className={styles.primaryBtn}
          style={{ padding: '9px 16px', letterSpacing: '.08em', fontSize: 11 }}
          onClick={() => send(draft, false)}
        >
          LOG
        </button>
      </div>

      <div className={styles.pinnedRow}>
        <span className={styles.sectionMiniMuted} style={{ fontSize: 9 }}>
          Pinned
        </span>
        {pinned.map((preset, i) => (
          <button
            key={`${preset.name}-${i}`}
            type="button"
            className={styles.presetChip}
            title="Log now"
            onClick={() => logPreset(preset, guessSlot(new Date().getHours()))}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            <span dir="auto">{preset.name}</span>
            <span className={styles.presetCal}>{preset.cal} kcal</span>
          </button>
        ))}
        <button
          type="button"
          className={styles.presetChipDashed}
          onClick={() => {
            setLibSlot(null);
            setLibEdit(null);
            setLibOpen(true);
          }}
        >
          Manage
        </button>
      </div>

      {props.recentItems.length > 0 && (
        <div className={styles.pinnedRow}>
          <span className={styles.sectionMiniMuted} style={{ fontSize: 9 }}>
            Recent
          </span>
          {props.recentItems.map((item, i) => (
            <button
              key={`${item.n}-${i}`}
              type="button"
              className={styles.presetChip}
              title="Log again"
              onClick={() => logRecent(item)}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              <span dir="auto">{item.n}</span>
              <span className={styles.presetCal}>{Math.round(num(item.cal))} kcal</span>
            </button>
          ))}
        </div>
      )}

      {typing && <div className={styles.aiStripTyping}>Analyzing…</div>}
      {!typing && lastAi && (
        <div className={styles.aiStrip}>
          <span dir="auto" className={styles.aiText}>
            {lastAi.t}
          </span>
          <span style={{ display: 'inline-flex', gap: 6, flex: '0 0 auto' }}>
            {lastAi.foods && lastAi.foods.length > 0 && !lastAi.presetSaved && (
              <button type="button" className={styles.tinyPill} onClick={saveAiAsPreset}>
                SAVE AS MEAL
              </button>
            )}
            {lastAi.presetSaved && (
              <span className={styles.savedMark}>
                <svg
                  width="11"
                  height="11"
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
                SAVED
              </span>
            )}
            {day.lastLog && (
              <button type="button" className={styles.tinyPillMuted} onClick={undoLast}>
                UNDO
              </button>
            )}
          </span>
        </div>
      )}

      <div className={styles.diaryWrap}>
        <div className={styles.diaryLeft}>
          <div className={styles.diaryGrid}>
            {MEAL_SLOTS.map((slot) => {
              const items = day.meals[slot];
              const subtotal = items.reduce((a, x) => a + num(x.cal), 0);
              return (
                <div key={slot} className={styles.slotCard}>
                  <div className={styles.slotHead}>
                    <span className={styles.sectionMini}>{SLOT_LABELS[slot]}</span>
                    <span className={styles.slotSubtotal}>
                      {items.length > 0 ? `${Math.round(subtotal)} kcal` : ''}
                    </span>
                    <button
                      type="button"
                      className={styles.slotAdd}
                      aria-label={`Add food to ${SLOT_LABELS[slot]}`}
                      onClick={() => {
                        setLibSlot(slot);
                        setLibEdit(null);
                        setLibOpen(true);
                      }}
                    >
                      + ADD
                    </button>
                  </div>
                  {items.length === 0 && <div className={styles.slotEmpty}>Nothing logged yet</div>}
                  {items.map((item, i) => (
                    <div key={i} className={styles.mealItemRow}>
                      <div
                        style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}
                      >
                        <input
                          dir="auto"
                          className={styles.mealName}
                          value={item.n}
                          aria-label={`${SLOT_LABELS[slot]} item ${i + 1}`}
                          onChange={(e) => updateItem(slot, i, { n: e.target.value })}
                        />
                        <span className={styles.mealMacro}>
                          P {r1(num(item.p))} · C {r1(num(item.c))} · F {r1(num(item.f))}
                        </span>
                      </div>
                      <input
                        type="number"
                        className={styles.mealKcal}
                        value={Math.round(num(item.cal))}
                        aria-label={`${SLOT_LABELS[slot]} item ${i + 1} kcal`}
                        onChange={(e) => updateItem(slot, i, { cal: num(e.target.value) })}
                      />
                      <span className={styles.kcalUnit}>kcal</span>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        title="Remove"
                        aria-label={`Remove ${SLOT_LABELS[slot]} item ${i + 1}`}
                        onClick={() => removeItem(slot, i)}
                      >
                        <svg
                          width="11"
                          height="11"
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
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.diaryRight}>
          <div className={styles.totalsHead}>Daily Totals</div>
          <div className={styles.kcalRingRow}>
            <svg
              width="86"
              height="86"
              viewBox="0 0 72 72"
              style={{ flex: '0 0 auto' }}
              role="img"
              aria-label={`${totCal} of ${targets.kcal} kcal`}
            >
              <circle
                cx="36"
                cy="36"
                r="30"
                fill="none"
                stroke="var(--plan-rule)"
                strokeWidth="5.5"
              />
              <circle
                className={styles.scoreRing}
                cx="36"
                cy="36"
                r="30"
                fill="none"
                stroke="var(--plan-primary)"
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeDasharray={calDash}
                transform="rotate(-90 36 36)"
              />
              <text
                x="36"
                y="34"
                textAnchor="middle"
                fontSize="13"
                fontWeight="700"
                fill="var(--color-text)"
                fontFamily="var(--font-family-heading)"
              >
                {totCal.toLocaleString()}
              </text>
              <text x="36" y="45" textAnchor="middle" fontSize="7.5" fill="var(--plan-muted)">
                KCAL
              </text>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span className={styles.kcalLeftBig}>{kcalLeft.toLocaleString()}</span>
              <span className={styles.kcalLeftSub}>
                kcal left of {targets.kcal.toLocaleString()}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {(
              [
                ['Protein', r1(totals.p), targets.protein, ' g'],
                ['Carbs', r1(totals.c), targets.carbs, ' g'],
              ] as const
            ).map(([label, value, target, unit]) => (
              <div key={label} className={styles.barRow}>
                <div className={styles.barLabelRow}>
                  <span>{label}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {value.toLocaleString()} / {target.toLocaleString()}
                    {unit}
                  </span>
                </div>
                <span className={styles.barTrack}>
                  <span
                    className={styles.barFill}
                    style={{ width: `${Math.min(100, Math.round((value / target) * 100))}%` }}
                  />
                </span>
              </div>
            ))}
            <div className={styles.fatRow}>
              <span>Fat</span>
              <span className={styles.fatVal}>{r1(totals.f)} g</span>
            </div>
          </div>
        </div>
      </div>

      <SavedMealsModal
        open={libOpen}
        onClose={() => setLibOpen(false)}
        slot={libSlot}
        editIndex={libEdit}
        setSlot={setLibSlot}
        setEditIndex={setLibEdit}
        settings={settings}
        patchSettings={props.patchSettings}
        onLog={logPreset}
        onManualAdd={(slot, item) => {
          props.patchDay((current) => ({
            meals: { ...current.meals, [slot]: [...current.meals[slot], item] },
            lastLog: { slot, count: 1 },
            chat: [
              ...current.chat,
              { who: 'ai' as const, t: `“${item.n}” → ${SLOT_LABELS[slot]} ✓` },
            ].slice(-40),
          }));
          setLibOpen(false);
        }}
      />
    </div>
  );
}

/* ── Saved Meals popup ───────────────────────────────────────────────────── */

interface SavedMealsProps {
  open: boolean;
  onClose: () => void;
  slot: MealSlot | null;
  editIndex: number | null;
  setSlot: (slot: MealSlot | null) => void;
  setEditIndex: (index: number | null) => void;
  settings: DailyPlanSettings;
  patchSettings: (patch: Partial<DailyPlanSettings>) => void;
  onLog: (preset: DailyPlanSettings['presets'][number], slot: MealSlot) => void;
  onManualAdd: (slot: MealSlot, item: MealItem) => void;
}

export function SavedMealsModal(props: SavedMealsProps) {
  const { settings } = props;
  const [manual, setManual] = useState({ n: '', cal: '', p: '', c: '', f: '' });
  const autoSlot = guessSlot(new Date().getHours());
  const activeSlot = props.slot ?? autoSlot;

  const updatePreset = (index: number, patch: Partial<DailyPlanSettings['presets'][number]>) => {
    props.patchSettings({
      presets: settings.presets.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    });
  };

  return (
    <Modal open={props.open} onClose={props.onClose} title="Add Food">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className={styles.slotChipRow}>
          <span className={styles.sectionMiniMuted}>Log to</span>
          {MEAL_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              className={activeSlot === slot ? styles.slotChipActive : styles.slotChip}
              onClick={() => props.setSlot(slot)}
            >
              {SLOT_LABELS[slot]}
            </button>
          ))}
          {props.slot === null && <span className={styles.slotHint}>auto: {autoSlot}</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className={styles.sectionMiniMuted}>Saved meals — tap to log</div>
          <div className={styles.presetGrid}>
            {settings.presets.map((preset, i) => (
              <div key={i} className={styles.presetCard}>
                <div className={styles.presetCardTop}>
                  <button
                    type="button"
                    className={styles.presetLog}
                    onClick={() => props.onLog(preset, activeSlot)}
                  >
                    <span dir="auto" className={styles.presetName}>
                      {preset.name}
                    </span>
                    <span className={styles.presetMacroLine}>
                      {preset.cal} kcal · P {preset.p} · C {preset.c} · F {preset.f}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={preset.pinned ? styles.presetIconBtnActive : styles.presetIconBtn}
                    title="Pin to Daily Plan"
                    aria-label={`Pin ${preset.name}`}
                    aria-pressed={preset.pinned}
                    onClick={() => updatePreset(i, { pinned: !preset.pinned })}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill={preset.pinned ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 17v5" />
                      <path d="M9 3h6l1 7 2.5 2.5H5.5L8 10z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={
                      props.editIndex === i ? styles.presetIconBtnActive : styles.presetIconBtn
                    }
                    style={{ marginRight: 6 }}
                    title="Edit"
                    aria-label={`Edit ${preset.name}`}
                    onClick={() => props.setEditIndex(props.editIndex === i ? null : i)}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
                    </svg>
                  </button>
                </div>
                {props.editIndex === i && (
                  <div className={styles.presetEditor}>
                    <input
                      dir="auto"
                      className={styles.smallInput}
                      style={{ width: '100%', boxSizing: 'border-box', fontWeight: 600 }}
                      value={preset.name}
                      aria-label="Meal name"
                      onChange={(e) => updatePreset(i, { name: e.target.value })}
                    />
                    <div className={styles.macroGrid}>
                      {(
                        [
                          ['KCAL', 'cal'],
                          ['P', 'p'],
                          ['C', 'c'],
                          ['F', 'f'],
                        ] as const
                      ).map(([label, field]) => (
                        <label key={field} className={styles.macroLabel}>
                          {label}
                          <input
                            type="number"
                            className={styles.smallInput}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '5px 6px' }}
                            value={preset[field]}
                            onChange={(e) => updatePreset(i, { [field]: num(e.target.value) })}
                          />
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      className={styles.dangerLink}
                      onClick={() => {
                        props.setEditIndex(null);
                        props.patchSettings({
                          presets: settings.presets.filter((_, j) => j !== i),
                        });
                      }}
                    >
                      DELETE MEAL
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button
              type="button"
              className={styles.newPresetCard}
              onClick={() => {
                const presets = [
                  ...settings.presets,
                  { name: 'New meal', cal: 400, p: 25, c: 40, f: 12, pinned: false },
                ];
                props.patchSettings({ presets });
                props.setEditIndex(presets.length - 1);
              }}
            >
              + New saved meal
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className={styles.sectionMiniMuted}>Or enter manually</div>
          <div className={styles.manualGrid}>
            <input
              dir="auto"
              className={styles.smallInput}
              placeholder="Food name"
              aria-label="Manual food name"
              value={manual.n}
              onChange={(e) => setManual({ ...manual, n: e.target.value })}
            />
            {(
              [
                ['kcal', 'cal'],
                ['P g', 'p'],
                ['C g', 'c'],
                ['F g', 'f'],
              ] as const
            ).map(([placeholder, field]) => (
              <input
                key={field}
                type="number"
                className={styles.smallInput}
                style={{ width: '100%', boxSizing: 'border-box', padding: '7px 6px' }}
                placeholder={placeholder}
                aria-label={`Manual ${placeholder}`}
                value={manual[field]}
                onChange={(e) => setManual({ ...manual, [field]: e.target.value })}
              />
            ))}
          </div>
          <button
            type="button"
            className={styles.primaryBtn}
            style={{
              alignSelf: 'flex-start',
              borderRadius: 999,
              letterSpacing: '.08em',
              fontSize: 10.5,
            }}
            onClick={() => {
              const name = manual.n.trim();
              if (!name) return;
              props.onManualAdd(activeSlot, {
                n: name,
                cal: num(manual.cal),
                p: num(manual.p),
                c: num(manual.c),
                f: num(manual.f),
              });
              setManual({ n: '', cal: '', p: '', c: '', f: '' });
            }}
          >
            ADD TO {SLOT_LABELS[activeSlot].toUpperCase()}
          </button>
        </div>
      </div>
    </Modal>
  );
}
