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

    if (!parsed || parsed.app !== 'ai-nikki' || typeof parsed.data !== 'object') {
      return { ok: false, message: 'AI Nikki のバックアップファイルではないようです' };
    }

    let restored = 0;
    for (const key of BACKUP_KEYS) {
      if (Object.prototype.hasOwnProperty.call(parsed.data, key)) {
        Storage.set(key, parsed.data[key]);
        restored++;
      }
    }

    if (restored === 0) {
      return { ok: false, message: '復元できるデータが見つかりませんでした' };
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
