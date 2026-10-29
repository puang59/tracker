import { useSyncExternalStore } from "react";

export type Gel = "nioclean" | "sebozit";

export type Day = {
  mv?: true;
  cr?: true;
  om?: true;
  mg?: true;
  aza?: true;
  // eye drops: sodium hyaluronate (morning) and PEG 400 (morning/afternoon/evening/night)
  sh?: true;
  pg1?: true;
  pg2?: true;
  pg3?: true;
  pg4?: true;
  gel?: Gel;
  // skincare routine steps (night step 2 is the gel above)
  a1?: true;
  a2?: true;
  a3?: true;
  p1?: true;
  p3?: true;
};

// Routine order is strict: step N can only be ticked once step N-1 is done.
export type Routine = "am" | "pm";
export const ROUTINE_KEYS: Record<Routine, ("a1" | "a2" | "a3" | "p1" | "gel" | "p3")[]> = {
  am: ["a1", "a2", "a3"],
  pm: ["p1", "gel", "p3"],
};

export const stepDone = (day: Day, key: (typeof ROUTINE_KEYS)["am" | "pm"][number]) => !!day[key];

export type Data = {
  v: 1;
  days: Record<string, Day>;
  blade: {
    startedAt: string;
    shaves: string[]; // one entry per shave day
    retired: { startedAt: string; endedAt: string; count: number }[];
  };
};

export const BLADE_LIMIT = 20;
const KEY = "tracker:v2";

export const dateKey = (d = new Date()) => {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

// Initial seed: tonight is Nioclean, and the current blade already has 2 shaves.
const fresh = (): Data => {
  const today = dateKey();
  return {
    v: 1,
    days: {
      // yesterday was Sebozit, so tonight starts on Nioclean
      [addDays(today, -1)]: { gel: "sebozit", aza: true },
    },
    blade: {
      startedAt: addDays(today, -4),
      shaves: [addDays(today, -4), addDays(today, -2)],
      retired: [],
    },
  };
};

// One-time seed for existing saves: azelaic acid was last applied yesterday,
// so the next dose is tomorrow night. Skipped once any dose has been logged.
function seedAza(data: Data): Data {
  if (Object.values(data.days).some((d) => d.aza)) return data;
  const y = addDays(dateKey(), -1);
  return { ...data, days: { ...data.days, [y]: { ...data.days[y], aza: true } } };
}

let cache: Data | null = null;
const listeners = new Set<() => void>();

function load(): Data {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return seedAza(JSON.parse(raw) as Data);
  } catch {}
  return fresh();
}

function getSnapshot() {
  if (cache === null) cache = load();
  return cache;
}

function commit(next: Data) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = load();
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useData(): Data | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

function patchDay(date: string, fn: (d: Day) => Day) {
  const data = getSnapshot();
  const day = fn({ ...(data.days[date] ?? {}) });
  commit({ ...data, days: { ...data.days, [date]: day } });
}

export function toggleSimple(date: string, k: "mv" | "cr" | "om" | "mg" | "aza" | "sh" | "pg1" | "pg2" | "pg3" | "pg4") {
  patchDay(date, (d) => {
    if (d[k]) delete d[k];
    else d[k] = true;
    return d;
  });
}

export function toggleGel(date: string, gel: Gel) {
  patchDay(date, (d) => {
    if (d.gel) delete d.gel;
    else d.gel = gel;
    return d;
  });
}

export function toggleStep(date: string, routine: Routine, i: number, gel: Gel) {
  const keys = ROUTINE_KEYS[routine];
  patchDay(date, (d) => {
    if (stepDone(d, keys[i])) {
      // unticking a step also clears everything after it
      for (const k of keys.slice(i)) delete d[k];
    } else if (i === 0 || stepDone(d, keys[i - 1])) {
      if (keys[i] === "gel") d.gel = gel;
      else d[keys[i] as "a1" | "a2" | "a3" | "p1" | "p3"] = true;
    }
    return d;
  });
}

export function toggleShave(date: string) {
  const data = getSnapshot();
  const has = data.blade.shaves.includes(date);
  if (!has && data.blade.shaves.length >= BLADE_LIMIT) return;
  const shaves = has
    ? data.blade.shaves.filter((s) => s !== date)
    : [...data.blade.shaves, date];
  commit({ ...data, blade: { ...data.blade, shaves } });
}

export function newBlade(date: string) {
  const data = getSnapshot();
  const { startedAt, shaves } = data.blade;
  commit({
    ...data,
    blade: {
      startedAt: date,
      shaves: [],
      retired: [
        ...data.blade.retired,
        { startedAt, endedAt: date, count: shaves.length },
      ],
    },
  });
}

/* ---------- derived ---------- */

const toUTC = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export const daysBetween = (a: string, b: string) =>
  Math.round((toUTC(b) - toUTC(a)) / 86400000);

export const addDays = (k: string, n: number) => {
  const [y, m, d] = k.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d + n));
};

export const weekday = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short" });
};

function lastWith(data: Data, today: string, pick: (d: Day) => boolean, includeToday: boolean) {
  const keys = Object.keys(data.days)
    .filter((k) => (includeToday ? k <= today : k < today) && pick(data.days[k]))
    .sort();
  return keys.length ? keys[keys.length - 1] : null;
}

export function gelStatus(data: Data, today: string) {
  const done = data.days[today]?.gel ?? null;
  const lastKey = lastWith(data, today, (d) => !!d.gel, false);
  const last = lastKey ? data.days[lastKey].gel! : null;
  const auto: Gel = last === "nioclean" ? "sebozit" : "nioclean";
  const tonight: Gel = done ?? auto;
  return { done, tonight, last };
}

export function azaStatus(data: Data, today: string) {
  const done = !!data.days[today]?.aza;
  const lastKey = lastWith(data, today, (d) => !!d.aza, true);
  if (!lastKey) return { done, due: true, overdue: false, last: null, next: today };
  const gap = daysBetween(lastKey, today);
  const next = addDays(lastKey, 2);
  return { done, due: !done && gap >= 2, overdue: !done && gap >= 3, last: lastKey, next };
}
