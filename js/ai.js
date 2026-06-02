/**
 * ai.js — ブラウザ内蔵 AI（Chrome の Prompt API / Gemini Nano）ラッパー
 *
 * 料金ゼロ・端末内で完結。対応していない環境では available()=false を返し、
 * 呼び出し側はフォールバック UI を出す。新旧の API 形を吸収する。
 *   - 新: window.LanguageModel
 *   - 旧: window.ai.languageModel
 */

const SYSTEM_PROMPT =
  'あなたは、やさしく思慮深い日記カウンセラーです。ユーザーの日記や気分に' +
  '寄り添い、否定や説教をせず、短く（2〜3文）あたたかい日本語で応答します。' +
  '必要なら、深掘りのための問いかけを1つだけ添えます。';

function getFactory() {
  if (typeof window === 'undefined') return null;
  if (window.LanguageModel) return window.LanguageModel;                       // 新 API
  if (window.ai && window.ai.languageModel) return window.ai.languageModel;    // 旧 API
  return null;
}

const AI = {
  /** API そのものが存在するか（ブラウザが Prompt API を持つか） */
  hasApi() {
    return !!getFactory();
  },

  /**
   * 実際に利用可能か（モデルDLが済んでいる/可能か）を判定。
   * @returns {Promise<'available'|'downloadable'|'downloading'|'unavailable'|'no-api'>}
   */
  async availability() {
    const f = getFactory();
    if (!f) return 'no-api';
    try {
      // 新旧でメソッド名が違う（availability / capabilities）
      if (typeof f.availability === 'function') {
        return await f.availability(); // 'available' | 'downloadable' | 'downloading' | 'unavailable'
      }
      if (typeof f.capabilities === 'function') {
        const cap = await f.capabilities();
        // 旧: { available: 'readily'|'after-download'|'no' }
        if (cap.available === 'readily') return 'available';
        if (cap.available === 'after-download') return 'downloadable';
        return 'unavailable';
      }
      return 'unavailable';
    } catch {
      return 'unavailable';
    }
  },

  /** セッションを作成（失敗時 null） */
  async createSession(extraSystem = '') {
    const f = getFactory();
    if (!f) return null;
    const opts = {
      initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT + (extraSystem ? '\n' + extraSystem : '') }],
    };
    try {
      if (typeof f.create === 'function') return await f.create(opts);
      return null;
    } catch {
      // initialPrompts 非対応な実装向けにフォールバック
      try {
        const s = await f.create();
        s._fallbackSystem = SYSTEM_PROMPT;
        return s;
      } catch {
        return null;
      }
    }
  },

  /**
   * 1回きりの単発プロンプト（日記コメント用）。
   * @returns {Promise<string|null>} 失敗時 null
   */
  async prompt(text, extraSystem = '') {
    const session = await this.createSession(extraSystem);
    if (!session) return null;
    try {
      const out = await session.prompt(text);
      return typeof out === 'string' ? out.trim() : null;
    } catch {
      return null;
    } finally {
      try { session.destroy && session.destroy(); } catch { /* noop */ }
    }
  },
};

export { AI, SYSTEM_PROMPT };
