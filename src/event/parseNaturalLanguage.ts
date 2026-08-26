/**
 * Turn one sentence into a date, a length and a title.
 *
 * Two things this is not, and both are deliberate:
 *
 * 1. It is not an AI. It is a list of patterns for the handful of ways people
 *    actually write a date in Chinese and English, and it reports whether it
 *    matched anything. Everything it produces is shown in the dialog before it
 *    is saved, so a sentence it reads wrongly costs a correction, not a wrong
 *    entry. That confirmation step is what lets the rules stay small instead of
 *    growing to chase every phrasing.
 *
 * 2. It imports nothing — not Obsidian, not moment. Dates go in and come out as
 *    `YYYY-MM-DD` strings and the arithmetic is done in UTC, which is exact for
 *    date-only values and keeps the whole module a pure function that can be
 *    reasoned about on its own.
 */

export interface ParsedInput {
  title: string;
  /** `YYYY-MM-DD` */
  start: string;
  /** `YYYY-MM-DD`, inclusive. Equal to `start` unless a length was given. */
  end: string;
  /** The sentence opened with a reminder verb ("提醒我", "remind me to"). */
  isReminder: boolean;
  /** False when no date was recognised and `start` fell back to the reference day. */
  matchedDate: boolean;
  /** True when a length ("9 天", "for 3 days") set the end date. */
  matchedDuration: boolean;
}

import { addDays, buildDate, toParts, weekdayOf } from "./dateMath";

// ---------------------------------------------------------------- numerals

const CHINESE_DIGITS: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 兩: 2, 两: 2, 三: 3, 四: 4,
  五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

/**
 * Chinese numerals up to 99, which is as far as a day count or a day-of-month
 * ever needs to go. "十五" is 15, "二十" is 20, "二十五" is 25.
 */
const chineseToNumber = (text: string): number | null => {
  if (/^\d+$/.test(text)) return Number(text);
  if (!/^[零一二兩两三四五六七八九十]+$/.test(text)) return null;
  const tenAt = text.indexOf("十");
  if (tenAt === -1) {
    let value = 0;
    for (const char of text) {
      const digit = CHINESE_DIGITS[char];
      if (digit === undefined) return null;
      value = value * 10 + digit;
    }
    return value;
  }
  const head = text.slice(0, tenAt);
  const tail = text.slice(tenAt + 1);
  const tens = head === "" ? 1 : CHINESE_DIGITS[head] ?? null;
  const ones = tail === "" ? 0 : CHINESE_DIGITS[tail] ?? null;
  if (tens === null || ones === null) return null;
  return tens * 10 + ones;
};

const NUMBER_SOURCE = "\\d+|[零一二兩两三四五六七八九十]+";

// ---------------------------------------------------------------- weekdays

/** The character after 週 / 星期 / 禮拜. 日 and 天 both mean Sunday. */
const CHINESE_WEEKDAY: Record<string, number> = {
  日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6,
  "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 0,
};

const ENGLISH_WEEKDAY: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5, saturday: 6, sat: 6,
};

/**
 * The next occurrence of a weekday, counting today as an occurrence.
 *
 * Saying "Saturday" on a Saturday almost always means today, not a week away;
 * a user who meant next week says "下週六", which adds the week explicitly.
 */
const nextWeekday = (reference: string, weekday: number): string =>
  addDays(reference, (weekday - weekdayOf(reference) + 7) % 7);

// ---------------------------------------------------------------- title tidy-up

/**
 * Words shaved off the front of what is left once the date has been removed.
 *
 * Only the front, only whole words, and only ones that carry no meaning of
 * their own: "我要去日本旅遊" should become "日本旅遊", but nothing here may
 * eat into a title that genuinely starts with one of these characters, which
 * is why 把, 帶 and the like are absent.
 */
const LEADING_FILLER = [
  "我要去", "我想去", "我要", "我想", "我", "要去", "想去", "要", "打算",
  "有個", "有一個", "有", "是",
  "remind me to", "remind me", "remember to", "i will", "i'll", "i am", "i'm",
  "to", "the",
];

/**
 * Words left dangling at the end once the date they introduced has been cut
 * out: "call the bank on Friday" loses "Friday" and would otherwise keep the
 * "on". Prepositions only — nothing here can be the last word of a real title.
 */
const TRAILING_FILLER = ["on", "at", "by", "in", "of", "this", "next", "的", "在", "於"];

const EDGE_PUNCTUATION = /^[\s,，、。;；:：!！?？~～\-–—]+|[\s,，、。;；:：~～\-–—]+$/g;

const stripEdges = (text: string): string => text.replace(EDGE_PUNCTUATION, "");

const isLetter = (char: string | undefined): boolean =>
  char !== undefined && /[a-z0-9]/i.test(char);

/**
 * Trim one list of filler words off one end, repeatedly, without emptying the
 * title.
 *
 * A Latin-script filler word has to end at a word boundary. Without that check
 * "to" eats the front of "tomorrowland" and "on" eats the back of "carton" —
 * the CJK entries need no such guard, since Chinese has no letter runs to cut
 * into.
 */
const stripFiller = (
  text: string,
  words: string[],
  fromStart: boolean
): string => {
  let current = text;
  for (let pass = 0; pass < words.length; pass += 1) {
    const lower = current.toLowerCase();
    const hit = words.find((word) => {
      if (fromStart ? !lower.startsWith(word) : !lower.endsWith(word)) {
        return false;
      }
      if (!/[a-z]/i.test(word)) return true;
      const neighbour = fromStart
        ? current[word.length]
        : current[current.length - word.length - 1];
      return !isLetter(neighbour);
    });
    if (!hit) break;
    const next = stripEdges(
      fromStart ? current.slice(hit.length) : current.slice(0, -hit.length)
    );
    // Never strip a title down to nothing: an entry titled "要" is still more
    // use than an entry with no title at all
    if (next.length === 0) break;
    current = next;
  }
  return current;
};

const tidyTitle = (raw: string): string => {
  const collapsed = stripEdges(raw.replace(/\s+/g, " "));
  const withoutLeading = stripFiller(collapsed, LEADING_FILLER, true);
  return stripEdges(stripFiller(withoutLeading, TRAILING_FILLER, false)).trim();
};

// ---------------------------------------------------------------- the parser

/** Blank out a matched span so it leaves the title without shifting the rest. */
const blank = (text: string, match: RegExpExecArray): string =>
  text.slice(0, match.index) +
  " ".repeat(match[0].length) +
  text.slice(match.index + match[0].length);

/**
 * The Markdown a line carries when it is lifted straight out of a note.
 *
 * Right-clicking a selection in the editor hands this parser whatever was
 * highlighted, and that is usually a list item or a heading — `- [ ] 10月24 去
 * 日本9天`. The markers are the note's formatting, not part of what the line
 * says, so they come off before anything else is read.
 */
const MARKDOWN_PREFIX = /^\s*(?:>+\s*)?(?:#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+\.\s+)/;

const REMINDER_VERB =
  /^\s*(提醒我一下|提醒我|提醒|記得要|記得|別忘了|別忘記|不要忘記|remind me to|remind me|remember to)\s*/i;

/**
 * Read a sentence.
 *
 * `reference` is "today" as a `YYYY-MM-DD` string; passing it in rather than
 * reading the clock is what makes every case here reproducible.
 */
export const parseNaturalLanguage = (
  input: string,
  reference: string
): ParsedInput => {
  let rest = input.replace(MARKDOWN_PREFIX, "");
  let isReminder = false;

  const verb = REMINDER_VERB.exec(rest);
  if (verb) {
    isReminder = true;
    rest = rest.slice(verb[0].length);
  }

  let start: string | null = null;
  let durationDays: number | null = null;

  // -- relative days. Matched before anything else so that "3 天後" is read as
  // an offset and never falls through to the duration rule as "3 days long"
  const relative: Array<[RegExp, (m: RegExpExecArray) => string | null]> = [
    [
      new RegExp(`(${NUMBER_SOURCE})\\s*(?:天|日)(?:之)?後`),
      (m) => {
        const n = chineseToNumber(m[1]);
        return n === null ? null : addDays(reference, n);
      },
    ],
    [/\bin\s+(\d+)\s+days?\b/i, (m) => addDays(reference, Number(m[1]))],
    [/大後天|大后天/, () => addDays(reference, 3)],
    [/後天|后天|\bday\s+after\s+tomorrow\b/i, () => addDays(reference, 2)],
    [/明天|明日|\btomorrow\b/i, () => addDays(reference, 1)],
    [/今天|今日|\btoday\b/i, () => reference],
  ];

  for (const [pattern, resolve] of relative) {
    const match = pattern.exec(rest);
    if (!match) continue;
    const value = resolve(match);
    if (value === null) continue;
    start = value;
    rest = blank(rest, match);
    break;
  }

  // -- absolute dates
  if (start === null) {
    const withYear =
      /(\d{4})\s*[-/年]\s*(\d{1,2})\s*[-/月]\s*(\d{1,2})\s*日?/.exec(rest);
    if (withYear) {
      const value = buildDate(
        Number(withYear[1]),
        Number(withYear[2]),
        Number(withYear[3])
      );
      if (value !== null) {
        start = value;
        rest = blank(rest, withYear);
      }
    }
  }

  if (start === null) {
    // No year given. "10月24" said in December means next October, so the year
    // chosen is the one that puts the date on or after today.
    const noYear = new RegExp(
      `(${NUMBER_SOURCE})\\s*[月/]\\s*(${NUMBER_SOURCE})\\s*(?:日|號)?`
    ).exec(rest);
    if (noYear) {
      const month = chineseToNumber(noYear[1]);
      const day = chineseToNumber(noYear[2]);
      if (month !== null && day !== null) {
        const [refYear] = toParts(reference);
        const thisYear = buildDate(refYear, month, day);
        const value =
          thisYear !== null && thisYear >= reference
            ? thisYear
            : buildDate(refYear + 1, month, day);
        if (value !== null) {
          start = value;
          rest = blank(rest, noYear);
        }
      }
    }
  }

  // -- weekdays
  if (start === null) {
    const chinese = /(下下|下個|下|這個|這|本)?\s*(?:週|周|星期|禮拜)\s*([日天一二三四五六1-7])/.exec(
      rest
    );
    if (chinese) {
      const weekday = CHINESE_WEEKDAY[chinese[2]];
      if (weekday !== undefined) {
        const weeksAhead =
          chinese[1] === "下下" ? 2 : chinese[1] === "下" || chinese[1] === "下個" ? 1 : 0;
        start = addDays(nextWeekday(reference, weekday), weeksAhead * 7);
        rest = blank(rest, chinese);
      }
    }
  }

  if (start === null) {
    const english = new RegExp(
      `\\b(next\\s+)?(${Object.keys(ENGLISH_WEEKDAY).join("|")})\\b`,
      "i"
    ).exec(rest);
    if (english) {
      const weekday = ENGLISH_WEEKDAY[english[2].toLowerCase()];
      start = addDays(
        nextWeekday(reference, weekday),
        english[1] ? 7 : 0
      );
      rest = blank(rest, english);
    }
  }

  // -- a bare "next week" with no weekday attached
  if (start === null) {
    const nextWeek = /下週|下周|下星期|下禮拜|\bnext\s+week\b/i.exec(rest);
    if (nextWeek) {
      start = addDays(reference, 7);
      rest = blank(rest, nextWeek);
    }
  }

  // -- how long it lasts. 晚 and 夜 are how a trip is usually counted, and a
  // "3 晚" stay still occupies 3 calendar days on the calendar.
  const duration = new RegExp(
    `(${NUMBER_SOURCE})\\s*(?:天|日|晚|夜)|\\bfor\\s+(\\d+)\\s+(?:days?|nights?)\\b`
  ).exec(rest);
  if (duration) {
    const n = duration[1] ? chineseToNumber(duration[1]) : Number(duration[2]);
    if (n !== null && n >= 1) {
      durationDays = n;
      rest = blank(rest, duration);
    }
  }

  const resolvedStart = start ?? reference;
  return {
    title: tidyTitle(rest),
    start: resolvedStart,
    end: durationDays ? addDays(resolvedStart, durationDays - 1) : resolvedStart,
    isReminder,
    matchedDate: start !== null,
    matchedDuration: durationDays !== null,
  };
};
