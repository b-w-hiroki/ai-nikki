/**
 * extras.js — 追加機能のロジック
 *   - デイリーお題（日替わりプロンプト）
 *   - 全文検索
 *   - 週次ふりかえり集計
 *   - 書き忘れリマインド判定
 * すべて localStorage の既存データから動作（API 不要）
 */
import { Storage } from './storage.js';
import { Insights } from './insights.js';

// 日替わりお題（書くハードルを下げる）
const PROMPTS = [
  '今日いちばん「いいな」と思った瞬間は？',
  '今日、誰かに感謝したいことはある？',
  '今日の自分を一言でほめるなら？',
  '今日あたらしく知ったこと・気づいたことは？',
  '今日、ちょっと頑張れたことは？',
  '明日の自分にひとことメッセージを。',
  '今日の天気と、そのときの気分は？',
  '最近ハマっていることは？',
  '今日の食事でおいしかったものは？',
  '今日、力を抜けた瞬間はあった？',
  '今週やってみたい小さな目標は？',
  '今日見た景色で印象に残ったものは？',
  'いま会いたい人は誰？その理由は？',
  '今日の自分に点数をつけるなら何点？',
];

const Extras = {
  /** 日付シードで「その日固定」のお題を返す（毎日変わる・再描画で不変） */
  getDailyPrompt(dateStr) {
    let h = 0;
    for (let i = 0; i < dateStr.length; i++) h = (Math.imul(31, h) + dateStr.charCodeAt(i)) | 0;
    return PROMPTS[(h >>> 0) % PROMPTS.length];
  },

  /** キーワードで日記を全文検索（新しい順） */
  search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const entries = Storage.getEntries();
    return Object.entries(entries)
      .filter(([, e]) => (e.text || '').toLowerCase().includes(q))
      .map(([dateStr, e]) => ({ dateStr, mood: e.mood, text: e.text }))
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  },

  /** 直近7日間のふりかえり集計 */
  getWeeklyReview() {
    const entries = Storage.getEntries();
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ dateStr: ds, entry: entries[ds] || null });
    }
    const written = days.filter((d) => d.entry).length;

    // よく出た気分
    const moodCount = {};
    days.forEach((d) => { if (d.entry?.mood) moodCount[d.entry.mood] = (moodCount[d.entry.mood] || 0) + 1; });
    let topMood = null, topN = 0;
    for (const [m, n] of Object.entries(moodCount)) if (n > topN) { topMood = m; topN = n; }

    const words = days.reduce((s, d) => s + (d.entry?.wordCount || 0), 0);

    return { days, written, topMood, topMoodMeta: topMood ? Insights.MOOD_META[topMood] : null, words };
  },

  /** 今日まだ書いていない＝リマインド対象か */
  shouldRemindToday() {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return !Storage.getEntry(today);
  },
};

export { Extras, PROMPTS };
