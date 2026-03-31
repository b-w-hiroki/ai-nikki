/**
 * storage.js — localStorage ヘルパー
 * すべてのデータアクセスはこのモジュール経由で行う
 */

const KEYS = {
  ENTRIES: 'ai-nikki-entries',
  ACCUMULATION: 'ai-nikki-accumulation',
  SETTINGS: 'ai-nikki-settings',
  STATS: 'ai-nikki-stats',
  PHOTOS: 'ai-nikki-photos',
};

const Storage = {
  // --- 汎用 ---
  get(key) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('Storage full:', e);
      return false;
    }
  },

  // --- 日記エントリ ---
  getEntries() {
    return this.get(KEYS.ENTRIES) || {};
  },
  getEntry(dateStr) {
    return this.getEntries()[dateStr] || null;
  },
  setEntry(dateStr, entry) {
    const entries = this.getEntries();
    entries[dateStr] = entry;
    return this.set(KEYS.ENTRIES, entries);
  },

  // --- 写真（別キーで管理して本体サイズを節約） ---
  getPhotos() {
    return this.get(KEYS.PHOTOS) || {};
  },
  getPhoto(dateStr) {
    return this.getPhotos()[dateStr] || null;
  },
  setPhoto(dateStr, base64) {
    const photos = this.getPhotos();
    photos[dateStr] = base64;
    return this.set(KEYS.PHOTOS, photos);
  },
  removePhoto(dateStr) {
    const photos = this.getPhotos();
    delete photos[dateStr];
    return this.set(KEYS.PHOTOS, photos);
  },

  // --- 積み上げ ---
  getAccumulation() {
    return this.get(KEYS.ACCUMULATION) || {};
  },
  getAccumulationByDate(dateStr) {
    return this.getAccumulation()[dateStr] || {};
  },
  setAccumulationByDate(dateStr, data) {
    const acc = this.getAccumulation();
    acc[dateStr] = data;
    return this.set(KEYS.ACCUMULATION, acc);
  },

  // --- 設定 ---
  getSettings() {
    return this.get(KEYS.SETTINGS) || {
      apiKey: '',
      theme: 'paper',
      customCategories: [],
    };
  },
  setSettings(settings) {
    return this.set(KEYS.SETTINGS, settings);
  },

  // --- 統計・ゲーミフィケーション ---
  getStats() {
    return this.get(KEYS.STATS) || {
      level: 1,
      exp: 0,
      expToNext: 200,
      streak: { current: 0, longest: 0, lastDate: null },
      badges: [],
      totalEntries: 0,
      totalWords: 0,
      totalPhotos: 0,
    };
  },
  setStats(stats) {
    return this.set(KEYS.STATS, stats);
  },

  // --- ユーティリティ ---
  getStorageUsageKB() {
    let total = 0;
    for (const key of Object.values(KEYS)) {
      const v = localStorage.getItem(key);
      if (v) total += v.length * 2;
    }
    return Math.round(total / 1024);
  },
};

export { Storage, KEYS };
