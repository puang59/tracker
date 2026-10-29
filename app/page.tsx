"use client";

import { useEffect, useRef, useState } from "react";
import {
  BLADE_LIMIT,
  addDays,
  azaStatus,
  dateKey,
  gelStatus,
  newBlade,
  toggleGel,
  toggleShave,
  ROUTINE_KEYS,
  stepDone,
  toggleSimple,
  toggleStep,
  useData,
  weekday,
  type Data,
  type Gel,
} from "@/lib/store";

const GEL_INFO: Record<Gel, { name: string; emoji: string }> = {
  nioclean: { name: "Nioclean Gel", emoji: "1f9f4" },
  sebozit: { name: "Sebozit Gel", emoji: "1f9ea" },
};

// Codes with an extension are brand icons (full file name); the rest are Twemoji codepoints.
const isBrand = (code: string) => code.includes(".");

function Emoji({ code, size = 28 }: { code: string; size?: number }) {
  const src = isBrand(code) ? code : `${code}.svg`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="emoji" src={`/emoji/${src}`} width={size} height={size} alt="" decoding="async" draggable={false} />;
}

const CLEANSER = { title: "2% Niacinamide Skin Cleanser", emoji: "1f9fc" };
const MOISTURIZER = { title: "B5 Moisturizer", emoji: "1f4a7" };
const AM_STEPS = [CLEANSER, MOISTURIZER, { title: "SPF 50", emoji: "2600" }];

function buzz() {
  try {
    navigator.vibrate?.(8);
  } catch {}
}

function Row({
  emoji,
  title,
  sub,
  done,
  dim,
  locked,
  onToggle,
}: {
  emoji: string;
  title: string;
  sub?: string;
  done: boolean;
  dim?: boolean;
  locked?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="row-wrap">
      <button
        className="row"
        data-done={done}
        data-dim={dim || locked}
        disabled={locked}
        aria-pressed={done}
        onClick={() => {
          buzz();
          onToggle();
        }}
      >
        <span className="row-emoji" data-brand={isBrand(emoji)}>
          <Emoji code={emoji} size={isBrand(emoji) ? 36 : 28} />
        </span>
        <span className="row-text">
          <span className="row-title">{title}</span>
          {sub && <span className="row-sub">{sub}</span>}
        </span>
        <span className="check" aria-hidden>
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
      </button>
    </div>
  );
}

function Section({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <h2>
        <Emoji code={emoji} size={16} />
        {title}
      </h2>
      <div className="card">{children}</div>
    </section>
  );
}

function BladeCard({
  date,
  isToday,
  shaves,
  startedAt,
}: {
  date: string;
  isToday: boolean;
  shaves: string[];
  startedAt: string;
}) {
  const [confirm, setConfirm] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const used = shaves.length;
  const left = BLADE_LIMIT - used;
  const shavedToday = shaves.includes(date);
  const worn = left === 0;
  const low = left <= 3 && !worn;

  const status = worn
    ? "Blade is done. Time for a fresh one."
    : low
      ? `Only ${left} left. Have a new blade ready.`
      : `${left} shaves left`;

  return (
    <section className="section">
      <h2>
        <Emoji code="1fa92" size={16} />
        Shaving blade
      </h2>
      <div className="card blade" data-state={worn ? "worn" : low ? "low" : "ok"}>
        <div className="blade-top">
          <div className="blade-count">
            <span className="blade-num">{used}</span>
            <span className="blade-of">/ {BLADE_LIMIT}</span>
          </div>
          <div className="blade-status">{status}</div>
        </div>
        <div className="segs" role="img" aria-label={`${used} of ${BLADE_LIMIT} shaves used`}>
          {Array.from({ length: BLADE_LIMIT }, (_, i) => (
            <span key={i} className="seg" data-on={i < used} />
          ))}
        </div>
        <div className="blade-actions">
          <button
            className="btn primary"
            disabled={worn && !shavedToday}
            data-on={shavedToday}
            onClick={() => {
              buzz();
              toggleShave(date);
            }}
          >
            {isToday ? (shavedToday ? "Shaved today ✓" : "I shaved today") : shavedToday ? "Shaved this day ✓" : "I shaved this day"}
          </button>
          {isToday && (
            <button
              className="btn"
              data-danger={confirm || worn}
              onClick={() => {
                if (!confirm && !worn) {
                  setConfirm(true);
                  timer.current = setTimeout(() => setConfirm(false), 3000);
                  return;
                }
                clearTimeout(timer.current);
                setConfirm(false);
                buzz();
                newBlade(date);
              }}
            >
              {confirm ? "Tap to confirm" : "New blade"}
            </button>
          )}
        </div>
        <div className="blade-meta">Current blade since {startedAt}</div>
      </div>
    </section>
  );
}

function progressFor(data: Data, k: string): [number, number] {
  const d = data.days[k] ?? {};
  const aza = azaStatus(data, k);
  const flags = [d.mv, d.cr, d.om, d.sh, d.pg1, d.pg2, d.pg3, d.pg4, d.mg, d.gel, ...(aza.due || aza.done ? [aza.done] : []), d.a1, d.a2, d.a3, d.p1, d.p3];
  return [flags.filter(Boolean).length, flags.length];
}

const DAYS_BACK = 30;

function DayStrip({
  data,
  today,
  selected,
  onSelect,
}: {
  data: Data;
  today: string;
  selected: string;
  onSelect: (k: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const keys = Array.from({ length: DAYS_BACK }, (_, i) => addDays(today, i - (DAYS_BACK - 1)));
  return (
    <div className="days" ref={ref}>
      {keys.map((k) => {
        const [done, total] = progressFor(data, k);
        const [y, m, d] = k.split("-").map(Number);
        const dt = new Date(y, m - 1, d);
        return (
          <button
            key={k}
            className="day"
            data-selected={k === selected}
            data-today={k === today}
            aria-label={dt.toDateString()}
            onClick={() => onSelect(k)}
          >
            <span className="day-wd">{dt.toLocaleDateString(undefined, { weekday: "narrow" })}</span>
            <span className="day-num">{d}</span>
            <span className="day-dot" data-state={done === 0 ? "none" : done === total ? "full" : "some"} />
          </button>
        );
      })}
    </div>
  );
}

type Tab = "checklist" | "skincare";

function Tabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="tabs" role="tablist" data-tab={tab}>
      <span className="tabs-thumb" aria-hidden />
      {(["checklist", "skincare"] as const).map((t) => (
        <button key={t} role="tab" aria-selected={tab === t} onClick={() => onChange(t)}>
          {t === "checklist" ? "Checklist" : "Skincare"}
        </button>
      ))}
    </div>
  );
}

export default function Page() {
  const data = useData();
  const [tab, setTab] = useState<Tab>("checklist");
  const [today, setToday] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setToday(dateKey());
    sync();
    document.addEventListener("visibilitychange", sync);
    const t = setInterval(sync, 60000);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      clearInterval(t);
    };
  }, []);

  if (!data || !today) return <main className="wrap" />;

  const date = viewDate ?? today;
  const isToday = date === today;

  const day = data.days[date] ?? {};
  const gel = gelStatus(data, date);
  const aza = azaStatus(data, date);
  const azaCounts = aza.due || aza.done;

  // each tab has its own progress; the gel counts in both since it's shared
  const flags =
    tab === "skincare"
      ? [day.a1, day.a2, day.a3, day.p1, !!day.gel, day.p3]
      : [day.mv, day.cr, day.om, day.sh, day.pg1, day.pg2, day.pg3, day.pg4, day.mg, !!day.gel, ...(azaCounts ? [aza.done] : [])];
  const total = flags.length;
  const doneCount = flags.filter(Boolean).length;
  const allDone = doneCount === total;

  const [vy, vm, vd] = date.split("-").map(Number);
  const viewed = new Date(vy, vm - 1, vd);
  const dateLabel = viewed.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const azaSub = aza.done
    ? `Next: ${weekday(aza.next)}`
    : aza.overdue
      ? `Overdue · last ${weekday(aza.last!)}`
      : aza.due
        ? aza.last
          ? `Due tonight · last ${weekday(aza.last)}`
          : "Due tonight"
        : "";

  return (
    <main className="wrap">
      <DayStrip data={data} today={today} selected={date} onSelect={(k) => setViewDate(k === today ? null : k)} />

      <header className="head">
        <p className="date">{dateLabel}</p>
        <h1>{isToday ? "Today" : date === addDays(today, -1) ? "Yesterday" : viewed.toLocaleDateString(undefined, { weekday: "long" })}</h1>
        <div className="progress">
          <div className="bar">
            <span style={{ transform: `scaleX(${doneCount / total})` }} data-full={allDone} />
          </div>
          <span className="progress-label" data-full={allDone}>
            {allDone ? (
              <>
                <Emoji code="1f389" size={16} /> All done
              </>
            ) : (
              `${doneCount} of ${total}`
            )}
          </span>
        </div>
      </header>

      <Tabs tab={tab} onChange={setTab} />

      {tab === "skincare" ? (
        <>
          <Section emoji="2600" title="Morning routine">
            {AM_STEPS.map((st, i) => (
              <Row
                key={st.title}
                emoji={st.emoji}
                title={st.title}
                sub={`Step ${i + 1}`}
                done={stepDone(day, ROUTINE_KEYS.am[i])}
                locked={i > 0 && !stepDone(day, ROUTINE_KEYS.am[i - 1]) && !stepDone(day, ROUTINE_KEYS.am[i])}
                onToggle={() => toggleStep(date, "am", i, gel.tonight)}
              />
            ))}
          </Section>
          <Section emoji="1f319" title="Night routine">
            {[CLEANSER, { title: GEL_INFO[gel.tonight].name, emoji: GEL_INFO[gel.tonight].emoji }, MOISTURIZER].map(
              (st, i) => (
                <Row
                  key={i}
                  emoji={st.emoji}
                  title={st.title}
                  sub={`Step ${i + 1}`}
                  done={stepDone(day, ROUTINE_KEYS.pm[i])}
                  locked={i > 0 && !stepDone(day, ROUTINE_KEYS.pm[i - 1]) && !stepDone(day, ROUTINE_KEYS.pm[i])}
                  onToggle={() => toggleStep(date, "pm", i, gel.tonight)}
                />
              ),
            )}
          </Section>
        </>
      ) : (
      <>
      <Section emoji="2600" title="Morning">
        <Row emoji="hk-orange.svg" title="Multivitamin" sub="After breakfast" done={!!day.mv} onToggle={() => toggleSimple(date, "mv")} />
        <Row emoji="1f4aa" title="Creatine" sub="After breakfast" done={!!day.cr} onToggle={() => toggleSimple(date, "cr")} />
        <Row emoji="osmega-green.svg" title="Osmega-500" sub="After breakfast" done={!!day.om} onToggle={() => toggleSimple(date, "om")} />
        <Row emoji="eye-cyan.svg" title="Sodium hyaluronate eye drop" done={!!day.sh} onToggle={() => toggleSimple(date, "sh")} />
        <Row emoji="eye-pink.svg" title="Polyethylene glycol 400 eye drop" done={!!day.pg1} onToggle={() => toggleSimple(date, "pg1")} />
      </Section>

      <Section emoji="1f37d" title="Afternoon">
        <Row emoji="eye-pink.svg" title="Polyethylene glycol 400 eye drop" done={!!day.pg2} onToggle={() => toggleSimple(date, "pg2")} />
      </Section>

      <Section emoji="1f319" title="Evening">
        <Row emoji="eye-pink.svg" title="Polyethylene glycol 400 eye drop" done={!!day.pg3} onToggle={() => toggleSimple(date, "pg3")} />
      </Section>

      <Section emoji="1f319" title="Night">
        <Row
          emoji="hk-navy.svg"
          title="Magnesium glycinate"
          sub="2 tablets"
          done={!!day.mg}
          onToggle={() => toggleSimple(date, "mg")}
        />
        <Row emoji="eye-pink.svg" title="Polyethylene glycol 400 eye drop" done={!!day.pg4} onToggle={() => toggleSimple(date, "pg4")} />
        <Row
          emoji={GEL_INFO[gel.tonight].emoji}
          title={GEL_INFO[gel.tonight].name}
          sub={gel.done ? "Applied" : "Tonight's gel"}
          done={!!gel.done}
          onToggle={() => toggleGel(date, gel.tonight)}
        />
        {azaCounts && (
          <Row
            emoji="ordinary.png"
            title="Azelaic Acid 10%"
            sub={azaSub}
            done={aza.done}
            onToggle={() => toggleSimple(date, "aza")}
          />
        )}
      </Section>

      <BladeCard date={date} isToday={isToday} shaves={data.blade.shaves} startedAt={data.blade.startedAt} />
      </>
      )}
    </main>
  );
}
