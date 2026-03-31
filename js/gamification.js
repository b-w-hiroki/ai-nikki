/**
 * gamification.js — レベル / EXP / ストリーク / バッジ管理
 */
import { Storage } from './storage.js';

const TITLES = [
  { min: 1,  max: 4,  label: 'かけだしライター' },
  { min: 5,  max: 9,  label: '見習いライター' },
  { min: 10, max: 19, label: '一人前ライター' },
  { min: 20, max: 29, label: 'ベテランライター' },
  { min: 30, max: 49, label: 'マスターライター' },
  { min: 50, max: Infinity, label: '伝説のライター' },
];

const BADGES = [
  { id: 'first-entry',   icon: '✏️', name: '初投稿',    desc: '初めて日記を書いた',         check: (s) => s.totalEntries >= 1 },
  { id: 'streak-7',      icon: '🔥', name: '7日連続',   desc: '7日間連続で記録',             check: (s) => s.streak.current >= 7 },
  { id: 'photographer',  icon: '📷', name: '写真家',    desc: '写真を5枚添付した',           check: (s) => s.totalPhotos >= 5 },
  { id: 'streak-30',     icon: '🏆', name: '30日連続',  desc: '30日間連続で記録',            check: (s) => s.streak.current >= 30 },
  { id: 'words-10000',   icon: '📚', name: '1万文字',   desc: '累計1万文字を達成した',       check: (s) => s.totalWords >= 10000 },
  { id: 'night-owl',     icon: '🌙', name: '夜更かし',  desc: '深夜0時以降に投稿',           check: (_s, meta) => meta?.hour >= 0 && meta?.hour < 4 },
  { id: 'early-bird',    icon: '🌅', name: '早起き',    desc: '朝6時前に投稿',               check: (_s, meta) => meta?.hour >= 4 && meta?.hour < 6 },
  { id: 'all-moods',     icon: '🎭', name: '多感',      desc: '5種類すべての気分を記録した', check: (_s, meta) => meta?.allMoods },
  { id: 'streak-100',    icon: '⭐', name: '100日連続', desc: '100日間連続で記録',           check: (s) => s.streak.current >= 100 },
];

const Gamification = {
  getTitle(level) {
    return TITLES.find((t) => level >= t.min && level <= t.max)?.label || 'かけだしライター';
  },

  expRequired(level) {
    return level * 200;
  },

  /** 保存時の EXP 加算。返値: { newStats, leveledUp, newBadges } */
  addSaveExp(options = {}) {
    const { hasPhoto = false, hasMood = false, hasAcc = 0, wordCount = 0 } = options;
    const stats = Storage.getStats();

    let gained = 50; // 日記保存
    if (hasMood) gained += 5;
    if (hasPhoto) gained += 10;
    gained += hasAcc * 10;
    if (wordCount >= 500) gained += 20;

    return this._applyExp(stats, gained, options);
  },

  _applyExp(stats, gained, meta = {}) {
    stats.exp += gained;
    let leveledUp = false;

    while (stats.exp >= this.expRequired(stats.level)) {
      stats.exp -= this.expRequired(stats.level);
      stats.level += 1;
      stats.expToNext = this.expRequired(stats.level);
      leveledUp = true;
    }
    stats.expToNext = this.expRequired(stats.level);

    // バッジチェック
    const newBadges = this._checkBadges(stats, meta);
    Storage.setStats(stats);
    return { stats, gained, leveledUp, newBadges };
  },

  _checkBadges(stats, meta = {}) {
    const newBadges = [];
    for (const badge of BADGES) {
      if (stats.badges.includes(badge.id)) continue;
      if (badge.check(stats, meta)) {
        stats.badges.push(badge.id);
        newBadges.push(badge);
      }
    }
    return newBadges;
  },

  /** ストリーク更新。保存日に呼ぶ */
  updateStreak(dateStr) {
    const stats = Storage.getStats();
    const streak = stats.streak;
    const today = dateStr;

    if (streak.lastDate === today) return stats; // 同日2度目

    const yesterday = this._offsetDate(today, -1);
    if (streak.lastDate === yesterday) {
      streak.current += 1;
    } else if (streak.lastDate !== today) {
      streak.current = 1;
    }
    streak.longest = Math.max(streak.longest, streak.current);
    streak.lastDate = today;
    Storage.setStats(stats);
    return stats;
  },

  /** 統計更新（保存時に呼ぶ） */
  updateTotals(dateStr, wordCount, hasNewPhoto) {
    const entries = Storage.getEntries();
    const stats = Storage.getStats();
    const isNew = !entries[dateStr];
    if (isNew) stats.totalEntries += 1;
    stats.totalWords += wordCount;
    if (hasNewPhoto) stats.totalPhotos += 1;
    Storage.setStats(stats);
    return stats;
  },

  /** allMoods チェック用 */
  checkAllMoodsUnlocked() {
    const entries = Storage.getEntries();
    const moods = new Set(Object.values(entries).map((e) => e.mood));
    return ['great', 'good', 'ok', 'bad', 'awful'].every((m) => moods.has(m));
  },

  getBadgeById(id) {
    return BADGES.find((b) => b.id === id);
  },

  getAllBadges() {
    return BADGES;
  },

  _offsetDate(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  },
};

export { Gamification, BADGES };
