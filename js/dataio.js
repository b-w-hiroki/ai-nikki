/**
 * dataio.js — データのエクスポート / インポート
 * localStorage 内の全データを JSON でバックアップ・復元する
 */
import { Storage } from './storage.js';

// バックアップ対象の localStorage キー一覧
const BACKUP_KEYS = [
  'ai-nikki-entries',
  'ai-nikki-accumulation',
  'ai-nikki-settings',
  'ai-nikki-stats',
  'ai-nikki-photos',
  'ai-nikki-goals',
];

const SCHEMA_VERSION = 1;

function validateBackupData(data) {
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const number = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e9;
  if (!object(data)) throw new Error('bad data');
  const clean = {};
  for (const key of BACKUP_KEYS) {
    if (!Object.hasOwn(data, key)) continue;
    const v = data[key];
    if (!object(v)) throw new Error('bad section');
    if (key === 'ai-nikki-entries') {
      for (const [date, entry] of Object.entries(v)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !object(entry)) throw new Error('bad entry');
        for (const field of ['text','mood','aiComment']) if (entry[field] != null && typeof entry[field] !== 'string') throw new Error('bad entry text');
      }
    } else if (key === 'ai-nikki-accumulation') {
      if (!Object.entries(v).every(([date, counts]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && object(counts) && Object.values(counts).every(number))) throw new Error('bad counts');
    } else if (key === 'ai-nikki-goals') {
      if (!Object.values(v).every(number)) throw new Error('bad goals');
    } else if (key === 'ai-nikki-photos') {
      if (!Object.entries(v).every(([date, photo]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && typeof photo === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/.test(photo))) throw new Error('bad photo');
    } else if (key === 'ai-nikki-settings') {
      for (const field of ['theme','apiKey']) if (v[field] != null && typeof v[field] !== 'string') throw new Error('bad setting');
      if (v.customCategories != null && (!Array.isArray(v.customCategories) || !v.customCategories.every(c => object(c) && ['key','label','unit','icon'].every(k => typeof c[k] === 'string') && /^[a-zA-Z0-9_-]+$/.test(c.key) && (c.iconClass == null || /^[a-zA-Z0-9_-]+$/.test(c.iconClass))))) throw new Error('bad categories');
    } else if (key === 'ai-nikki-stats') {
      const defaults = {level:1,exp:0,expToNext:200,totalEntries:0,totalWords:0,totalPhotos:0,streak:{current:0,longest:0,lastDate:null},badges:[]};
      if (v.streak != null && !object(v.streak)) throw new Error('bad streak');
      const stats = {...defaults,...v,streak:{...defaults.streak,...v.streak}};
      if (!['level','exp','expToNext','totalEntries','totalWords','totalPhotos'].every(k=>number(stats[k])) || !Number.isSafeInteger(stats.level) || stats.level < 1 || stats.exp > 1e7 || !object(stats.streak) || !number(stats.streak.current) || !number(stats.streak.longest) || (stats.streak.lastDate != null && typeof stats.streak.lastDate !== 'string') || !Array.isArray(stats.badges) || !stats.badges.every(b=>typeof b === 'string')) throw new Error('bad stats');
      clean[key] = stats; continue;
    }
    clean[key] = v;
  }
  if (!Object.keys(clean).length) throw new Error('empty backup');
  return clean;
}

const DataIO = {
  /** 全データを 1 つのオブジェクトにまとめる */
  buildBackup() {
    const data = {};
    BACKUP_KEYS.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        try {
          data[key] = JSON.parse(raw);
        } catch {
          data[key] = raw;
        }
      }
    });
    return {
      app: 'ai-nikki',
      version: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    };
  },

  /** バックアップ JSON をファイルとしてダウンロード */
  exportToFile() {
    const backup = this.buildBackup();
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const today = new Date();
    const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-nikki-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  /**
   * バックアップ JSON 文字列を読み込んで localStorage を復元する
   * @returns {{ ok: boolean, message: string }}
   */
  importFromText(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, message: 'ファイルを読み込めませんでした（JSON 形式ではありません）' };
    }

    if (!parsed || parsed.app !== 'ai-nikki' || (parsed.version != null && parsed.version !== SCHEMA_VERSION)) {
      return { ok: false, message: 'AI Nikki の対応するバックアップファイルではありません' };
    }
    let clean, previous;
    try {
      clean = validateBackupData(parsed.data);
      previous = Object.fromEntries(Object.keys(clean).map(key => [key, localStorage.getItem(key)]));
    } catch {
      return { ok: false, message: 'バックアップの形式が不正です。現在のデータは変更していません' };
    }
    try {
      for (const [key, value] of Object.entries(clean)) localStorage.setItem(key, JSON.stringify(value));
    } catch {
      let restored = true;
      for (const [key, raw] of Object.entries(previous)) {
        try { if (raw === null) localStorage.removeItem(key); else localStorage.setItem(key, raw); } catch { restored = false; }
      }
      return { ok: false, message: restored ? '保存できなかったため元のデータに戻しました' : '保存と復旧に失敗しました。再読込せず元のバックアップを保管してください' };
    }

    return { ok: true, message: 'データを復元しました！' };
  },

  /** File オブジェクトを受け取って復元（Promise） */
  importFromFile(file) {
    return new Promise((resolve) => {
      if (!file) {
        resolve({ ok: false, message: 'ファイルが選択されていません' });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(this.importFromText(String(reader.result)));
      reader.onerror = () => resolve({ ok: false, message: 'ファイルの読み込みに失敗しました' });
      reader.readAsText(file);
    });
  },
};

export { DataIO };
