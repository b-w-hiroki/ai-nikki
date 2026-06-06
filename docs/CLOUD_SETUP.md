# クラウド保存（アカウント）のセットアップ

AI Nikki は標準では端末内（localStorage）に保存します。
**Supabase（無料）** を使うと、アカウントでログインして
日記をクラウドに保存し、別の端末でも続けられます。

> 繋がない場合は今までどおり完全無料・サーバー不要で動きます。
> この設定は「クラウドも使いたい人」だけが行えばOKです。

## 手順

### 1. Supabase プロジェクトを作る（無料）
1. https://supabase.com にサインアップ
2. 「New project」でプロジェクトを作成（リージョンは近い場所で）
3. プロジェクトができたら **Settings → API** を開く
   - **Project URL**（`https://xxxx.supabase.co`）
   - **anon public** key
   をあとで使うので控える

### 2. データ保存用テーブルを作る
左メニュー **SQL Editor** で以下を実行：

```sql
create table if not exists backups (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb,
  updated_at timestamptz default now()
);

alter table backups enable row level security;

create policy "own rows" on backups
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

これで「自分のデータは自分だけが読み書きできる」状態になります。

### 3. ログイン方法を有効化
**Authentication → Providers** で使いたい方法を有効に：
- **Email**（マジックリンク）… デフォルトで有効なことが多い
- **Google** … 使う場合は Google の OAuth 設定が別途必要

**Authentication → URL Configuration** の
**Site URL / Redirect URLs** に、アプリのURL
（例 `https://b-w-hiroki.github.io/ai-nikki/app.html`）を登録。

### 4. アプリ側で接続
1. アプリの **マイページ → ⚙ 設定 → アカウント / クラウド保存**
2. 「⚙ クラウド接続を設定」→ **URL** と **anon key** を貼り付けて保存
3. メールアドレスでログイン（届いたリンクを開く）or Googleでログイン
4. ログイン後：
   - **☁️⬆ クラウドに保存** … 今の端末のデータをクラウドへ
   - **☁️⬇ クラウドから復元** … クラウドのデータをこの端末へ（上書き）

## 注意
- anon key はフロントに出てよいキーです（RLSで保護）。
  ただし **service_role key は絶対に貼らないでください**。
- 無料枠には上限があります（個人利用ならまず十分）。
- 写真を多用するとデータ量が増えます。容量にご注意を。
