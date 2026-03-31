/**
 * diary.js — 日記エントリの CRUD + タイムトラベルカード表示
 */
import { Storage } from './storage.js';

const Diary = {
  /** 今日の日付文字列 (YYYY-MM-DD) をローカルタイムで取得 */
  todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /** 指定日のエントリを取得 */
  get(dateStr) {
    return Storage.getEntry(dateStr);
  },

  /** エントリを保存 */
  save(dateStr, { mood, text, accValues }) {
    const wordCount = text.trim().length;
    const now = new Date().toISOString();
    const existing = Storage.getEntry(dateStr) || {};
    const entry = {
      ...existing,
      date: dateStr,
      mood: mood || existing.mood || null,
      text,
      accumulation: accValues || {},
      wordCount,
      createdAt: existing.createdAt || now,
      updatedAt: now,
    };
    return Storage.setEntry(dateStr, entry);
  },

  /** 今日のエントリをフォームに読み込む */
  loadToday() {
    const dateStr = this.todayStr();
    return Storage.getEntry(dateStr);
  },

  /** タイムトラベルカードのデータを取得 */
  getTimeTravelEntry() {
    const today = new Date();
    const targets = [
      { label: '1ヶ月前の今日', date: new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()) },
      { label: '1年前の今日',   date: new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()) },
      { label: '1週間前の今日', date: new Date(today.getTime() - 7 * 86400000) },
    ];

    for (const t of targets) {
      const dateStr = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}-${String(t.date.getDate()).padStart(2, '0')}`;
      const entry = Storage.getEntry(dateStr);
      if (entry && entry.text) {
        return { label: t.label, dateStr, entry };
      }
    }
    return null;
  },

  /** YYYY-MM-DD → 表示用文字列 */
  formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${y}年${parseInt(m)}月${parseInt(d)}日`;
  },

  /** 全エントリの気分マップ取得（カレンダー用） */
  getMoodMap() {
    const entries = Storage.getEntries();
    const map = {};
    for (const [k, v] of Object.entries(entries)) {
      if (v.mood) map[k] = v.mood;
    }
    return map;
  },
};

export { Diary };
