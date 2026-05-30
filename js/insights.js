/**
 * insights.js — 統計・感情コレクション・Year in Review 用のデータ集計
 * すべて localStorage の既存データから算出する（API 不要）
 */
import { Storage } from './storage.js';

const MOOD_ORDER = ['great', 'good', 'ok', 'bad', 'awful'];
const MOOD_META = {
  great: { emoji: '😄', label: '最高！',   color: '#4CAF50', score: 2 },
  good:  { emoji: '🙂', label: 'いい感じ', color: '#8BC34A', score: 1 },
  ok:    { emoji: '😐', label: 'ふつう',   color: '#FFC107', score: 0 },
  bad:   { emoji: '😟', label: 'ちょっと…', color: '#FF9800', score: -1 },
  awful: { emoji: '😢', label: 'つらい',   color: '#f44336', score: -2 },
};

// レアな感情コレクション（記録パターンから自動検出）
const COMBOS = [
  {
    id: 'comeback', icon: '🌅', name: 'カムバック',
    desc: '「つらい」の翌日に「最高！」を記録した',
  },
  {
    id: 'rainbow', icon: '🌈', name: 'フルスペクトラム',
    desc: '5種類すべての気分を記録した',
  },
  {
    id: 'sunny-week', icon: '☀️', name: 'ごきげんウィーク',
    desc: '7日間で5回以上ポジティブな気分を記録した',
  },
  {
    id: 'steady', icon: '🪨', name: 'マイペース',
    desc: '「ふつう」を10回以上記録した',
  },
];

const Insights = {
  MOOD_ORDER,
  MOOD_META,

  /** 全エントリを日付順の配列で返す */
  _sortedEntries() {
    const entries = Storage.getEntries();
    return Object.entries(entries)
      .map(([dateStr, e]) => ({ dateStr, ...e }))
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  },

  /** 気分ごとの記録回数 */
  getMoodCounts(year = null) {
    const counts = { great: 0, good: 0, ok: 0, bad: 0, awful: 0 };
    for (const e of this._sortedEntries()) {
      if (year !== null && !e.dateStr.startsWith(`${year}-`)) continue;
      if (e.mood && counts[e.mood] !== undefined) counts[e.mood] += 1;
    }
    return counts;
  },

  /** どの気分を解放済みか（コレクション図鑑用） */
  getMoodCollection() {
    const counts = this.getMoodCounts();
    return MOOD_ORDER.map((id) => ({
      id,
      ...MOOD_META[id],
      count: counts[id],
      unlocked: counts[id] > 0,
    }));
  },

  /** レアコンボの解放状況を検出 */
  getComboCollection() {
    const sorted = this._sortedEntries().filter((e) => e.mood);
    const counts = this.getMoodCounts();
    const unlocked = new Set();

    // rainbow: 5種類すべて
    if (MOOD_ORDER.every((m) => counts[m] > 0)) unlocked.add('rainbow');

    // steady: ふつう10回以上
    if (counts.ok >= 10) unlocked.add('steady');

    // comeback: 連続する日付で awful → great
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (prev.mood === 'awful' && cur.mood === 'great') {
        const gap = (new Date(cur.dateStr) - new Date(prev.dateStr)) / 86400000;
        if (gap === 1) { unlocked.add('comeback'); break; }
      }
    }

    // sunny-week: 任意の7日窓でポジティブ(great/good)5回以上
    for (let i = 0; i < sorted.length; i++) {
      const windowStart = new Date(sorted[i].dateStr).getTime();
      let positives = 0;
      for (let j = i; j < sorted.length; j++) {
        const gap = (new Date(sorted[j].dateStr).getTime() - windowStart) / 86400000;
        if (gap > 6) break;
        if (sorted[j].mood === 'great' || sorted[j].mood === 'good') positives += 1;
      }
      if (positives >= 5) { unlocked.add('sunny-week'); break; }
    }

    return COMBOS.map((c) => ({ ...c, unlocked: unlocked.has(c.id) }));
  },

  /** 月別の記録数（指定年・12要素配列） */
  getMonthlyEntryCounts(year) {
    const months = new Array(12).fill(0);
    for (const e of this._sortedEntries()) {
      const [y, m] = e.dateStr.split('-');
      if (parseInt(y) === year) months[parseInt(m) - 1] += 1;
    }
    return months;
  },

  /** 月別の平均気分スコア（記録のない月は null） */
  getMonthlyMoodScore(year) {
    const sum = new Array(12).fill(0);
    const cnt = new Array(12).fill(0);
    for (const e of this._sortedEntries()) {
      const [y, m] = e.dateStr.split('-');
      if (parseInt(y) !== year || !e.mood) continue;
      sum[parseInt(m) - 1] += MOOD_META[e.mood].score;
      cnt[parseInt(m) - 1] += 1;
    }
    return sum.map((s, i) => (cnt[i] ? s / cnt[i] : null));
  },

  /** 積み上げの年間合計 */
  getYearlyAccumulation(year) {
    const acc = Storage.getAccumulation();
    const totals = { reading: 0, exercise: 0, study: 0 };
    for (const [dateStr, val] of Object.entries(acc)) {
      if (!dateStr.startsWith(`${year}-`)) continue;
      totals.reading += val.reading || 0;
      totals.exercise += val.exercise || 0;
      totals.study += val.study || 0;
    }
    return totals;
  },

  /** Year in Review 用の集計をまとめて返す */
  getYearReview(year) {
    const yearEntries = this._sortedEntries().filter((e) => e.dateStr.startsWith(`${year}-`));
    const photos = Storage.getPhotos();
    const photoCount = Object.keys(photos).filter((d) => d.startsWith(`${year}-`)).length;
    const totalWords = yearEntries.reduce((s, e) => s + (e.wordCount || 0), 0);

    // 最長連続（年内）
    let longest = 0, run = 0, prev = null;
    for (const e of yearEntries) {
      if (prev && (new Date(e.dateStr) - new Date(prev)) / 86400000 === 1) run += 1;
      else run = 1;
      longest = Math.max(longest, run);
      prev = e.dateStr;
    }

    // 最もポジティブだった月
    const monthScores = this.getMonthlyMoodScore(year);
    let bestMonth = null, bestScore = -Infinity;
    monthScores.forEach((s, i) => {
      if (s !== null && s > bestScore) { bestScore = s; bestMonth = i; }
    });

    // 最も活発だった月（記録数）
    const monthCounts = this.getMonthlyEntryCounts(year);
    let topMonth = 0;
    monthCounts.forEach((c, i) => { if (c > monthCounts[topMonth]) topMonth = i; });

    // いちばん長文の日
    let longestEntry = null;
    for (const e of yearEntries) {
      if (!longestEntry || (e.wordCount || 0) > (longestEntry.wordCount || 0)) longestEntry = e;
    }

    return {
      year,
      totalEntries: yearEntries.length,
      totalWords,
      photoCount,
      longestStreak: longest,
      moodCounts: this.getMoodCounts(year),
      monthCounts,
      bestMonth,
      topMonth,
      accumulation: this.getYearlyAccumulation(year),
      longestEntry,
    };
  },
};

export { Insights, MOOD_META, MOOD_ORDER };
