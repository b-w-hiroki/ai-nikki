/**
 * cloud.js — アカウント＆クラウド保存（Supabase）
 *
 * 設計方針:
 *   - 繋がない人は今までどおり localStorage のみで完全無料・サーバー不要。
 *   - ユーザーが自分の Supabase プロジェクト（無料枠）の URL と anon key を
 *     設定画面で入力すると、メール(マジックリンク)/Google でログインでき、
 *     全データ(JSONバックアップ)をクラウドに保存・復元できる。
 *   - 認証情報(接続設定)は 'ai-nikki-cloud' に保存（バックアップ対象外）。
 *
 * Supabase 側に必要なテーブル（SQL は設定画面のヘルプに表示）:
 *   create table backups (
 *     user_id uuid primary key references auth.users on delete cascade,
 *     data jsonb, updated_at timestamptz default now()
 *   );
 *   alter table backups enable row level security;
 *   create policy "own" on backups for all
 *     using (auth.uid() = user_id) with check (auth.uid() = user_id);
 */
import { DataIO } from './dataio.js';

const CFG_KEY = 'ai-nikki-cloud';
const SDK_URL = 'https://esm.sh/@supabase/supabase-js@2';

let _client = null;
let _sdkPromise = null;

function loadConfig() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; }
  catch { return {}; }
}
function saveConfig(cfg) {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

const Cloud = {
  /** 接続設定が入力済みか */
  isConfigured() {
    const c = loadConfig();
    return !!(c.url && c.anonKey);
  },

  getConfig() { return loadConfig(); },

  setConfig(url, anonKey) {
    saveConfig({ url: (url || '').trim(), anonKey: (anonKey || '').trim() });
    _client = null; // 再生成させる
  },

  clearConfig() {
    localStorage.removeItem(CFG_KEY);
    _client = null;
  },

  /** Supabase SDK を動的ロード（CDN。失敗時 null） */
  async _loadSdk() {
    if (window.supabase?.createClient) return window.supabase;
    if (!_sdkPromise) _sdkPromise = import(SDK_URL).catch(() => null);
    return _sdkPromise;
  },

  /** クライアント取得（未設定/失敗時 null） */
  async getClient() {
    if (_client) return _client;
    const c = loadConfig();
    if (!c.url || !c.anonKey) return null;
    const sdk = await this._loadSdk();
    if (!sdk?.createClient) return null;
    _client = sdk.createClient(c.url, c.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    return _client;
  },

  /** 現在ログイン中のユーザー（未ログイン時 null） */
  async getUser() {
    const client = await this.getClient();
    if (!client) return null;
    try {
      const { data } = await client.auth.getUser();
      return data?.user || null;
    } catch { return null; }
  },

  /** メール マジックリンクでログイン */
  async signInWithEmail(email) {
    const client = await this.getClient();
    if (!client) return { ok: false, message: '先にクラウド接続を設定してください' };
    try {
      const { error } = await client.auth.signInWithOtp({
        email: (email || '').trim(),
        options: { emailRedirectTo: location.href.split('#')[0] },
      });
      if (error) throw error;
      return { ok: true, message: 'ログイン用リンクをメールに送りました。メールを開いて認証してください。' };
    } catch (e) {
      return { ok: false, message: 'ログインに失敗しました: ' + (e.message || e) };
    }
  },

  /** Google でログイン */
  async signInWithGoogle() {
    const client = await this.getClient();
    if (!client) return { ok: false, message: '先にクラウド接続を設定してください' };
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.href.split('#')[0] },
      });
      if (error) throw error;
      return { ok: true, message: 'Google認証ページへ移動します…' };
    } catch (e) {
      return { ok: false, message: 'Googleログインに失敗しました: ' + (e.message || e) };
    }
  },

  async signOut() {
    const client = await this.getClient();
    if (client) { try { await client.auth.signOut(); } catch { /* noop */ } }
  },

  /** 端末→クラウドへ保存（全データJSON） */
  async push() {
    const client = await this.getClient();
    if (!client) return { ok: false, message: 'クラウド未設定です' };
    const user = await this.getUser();
    if (!user) return { ok: false, message: 'ログインしていません' };
    try {
      const payload = DataIO.buildBackup();
      const { error } = await client.from('backups').upsert({
        user_id: user.id, data: payload, updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return { ok: true, message: 'クラウドに保存しました' };
    } catch (e) {
      return { ok: false, message: '保存に失敗しました: ' + (e.message || e) };
    }
  },

  /** クラウド→端末へ復元（既存データは上書き） */
  async pull() {
    const client = await this.getClient();
    if (!client) return { ok: false, message: 'クラウド未設定です' };
    const user = await this.getUser();
    if (!user) return { ok: false, message: 'ログインしていません' };
    try {
      const { data, error } = await client.from('backups')
        .select('data').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      if (!data?.data) return { ok: false, message: 'クラウドに保存データがありません' };
      const result = DataIO.importFromText(JSON.stringify(data.data));
      return result;
    } catch (e) {
      return { ok: false, message: '復元に失敗しました: ' + (e.message || e) };
    }
  },
};

export { Cloud };
