/**
 * Reads the opening hours as an employee writes them ("Lundi – Vendredi" / "8h30 – 12h30 · 14h – 18h") so the block
 * can say whether the shop is open right now. A line it cannot read is simply left out of that: the text still shows.
 */

/** Minutes since midnight: [start, end]. */
export type Interval = [number, number];

export type HoursRow = { days: string; hours: string };

/** Monday is 0 and Sunday is 6. */
const DAYS = [
  ["lundi", "lun"],
  ["mardi", "mar"],
  ["mercredi", "mer"],
  ["jeudi", "jeu"],
  ["vendredi", "ven"],
  ["samedi", "sam"],
  ["dimanche", "dim"],
] as const;

export const DAY_NAMES = DAYS.map(([full]) => full);

const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const dayIndex = (word: string) => DAYS.findIndex(([full, short]) => word === full || word === short);

/** "Lundi – Vendredi" gives 0..4, "Lundi, jeudi et samedi" gives 0, 3, 5. Null when no day is named. */
export function parseDays(text: string): number[] | null {
  const tokens = plain(text).match(/[a-z]+|[-–—]/g) ?? [];
  const found = new Set<number>();
  let previous = -1;
  let range = false;
  for (const token of tokens) {
    const day = dayIndex(token);
    if (day >= 0) {
      if (range && previous >= 0) {
        // A range may wrap over the end of the week ("samedi – lundi").
        for (let current = previous; ; current = (current + 1) % 7) {
          found.add(current);
          if (current === day) break;
        }
      } else {
        found.add(day);
      }
      previous = day;
      range = false;
    } else if (token === "-" || token === "–" || token === "—" || token === "a" || token === "au") {
      range = previous >= 0;
    }
  }
  return found.size > 0 ? [...found].sort((a, b) => a - b) : null;
}

/** "8h30 – 12h30 · 14h – 18h" gives two intervals. "Fermé" gives none. Null when the text cannot be read. */
export function parseHours(text: string): Interval[] | null {
  if (/ferm/i.test(plain(text))) return [];
  const times = [...plain(text).matchAll(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?/g)].map((match) => Number(match[1]) * 60 + Number(match[2] ?? 0));
  if (times.length < 2 || times.length % 2 !== 0) return null;
  const intervals: Interval[] = [];
  for (let index = 0; index < times.length; index += 2) {
    const [start, end] = [times[index], times[index + 1]];
    if (start >= end || end > 24 * 60) return null;
    intervals.push([start, end]);
  }
  return intervals;
}

export type Week = Interval[][];

/** The intervals of each weekday, from every row that could be read. Null when none could. */
export function buildWeek(rows: HoursRow[]): Week | null {
  const week: Week = Array.from({ length: 7 }, () => []);
  let readable = false;
  for (const row of rows) {
    const days = parseDays(row.days);
    const intervals = parseHours(row.hours);
    if (!days || !intervals) continue;
    readable = true;
    for (const day of days) week[day].push(...intervals);
  }
  for (const intervals of week) intervals.sort((a, b) => a[0] - b[0]);
  return readable ? week : null;
}

/** The weekday (Monday = 0) and the minutes since midnight at this moment, in the shop's time zone. */
export function nowIn(timeZone: string, date = new Date()): { day: number; minutes: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(date);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
    if (day >= 0) return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
  } catch {
    // An unknown time zone: use the visitor's own clock.
  }
  return { day: (date.getDay() + 6) % 7, minutes: date.getHours() * 60 + date.getMinutes() };
}

/** 510 gives "8h30", 1080 gives "18h". */
export function formatTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hour}h` : `${hour}h${String(rest).padStart(2, "0")}`;
}

export type Status = { open: boolean; detail: string };

/** Open or closed at this moment, and the next change ("jusqu’à 18h", "Ouvre demain à 8h30"). */
export function statusAt(week: Week, now: { day: number; minutes: number }): Status {
  const today = week[now.day];
  const current = today.find(([start, end]) => now.minutes >= start && now.minutes < end);
  if (current) {
    // A shop that reopens right away (no break) is described by the end of the whole stretch.
    let end = current[1];
    for (const [start, stop] of today) if (start <= end && stop > end) end = stop;
    return { open: true, detail: `jusqu’à ${formatTime(end)}` };
  }
  const later = today.find(([start]) => start > now.minutes);
  if (later) return { open: false, detail: `Ouvre à ${formatTime(later[0])}` };
  for (let ahead = 1; ahead <= 7; ahead += 1) {
    const day = (now.day + ahead) % 7;
    if (week[day].length > 0) return { open: false, detail: `Ouvre ${ahead === 1 ? "demain" : DAY_NAMES[day]} à ${formatTime(week[day][0][0])}` };
  }
  return { open: false, detail: "" };
}
