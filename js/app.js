/**
 * app.js — メインアプリロジック・画面遷移・UI制御
 */
import { Storage } from './storage.js';
import { Diary } from './diary.js';
import { Mood } from './mood.js';
import { Photo } from './photo.js';
import { Accumulation } from './accumulation.js';
import { Gamification } from './gamification.js';
import { DataIO } from './dataio.js';
import { Insights } from './insights.js';
import { Extras } from './extras.js';
import { AI } from './ai.js';

// ─── 定数 ───────────────────────────────────────────────
const DAYS_JP  = ['日', '月', '火', '水', '木', '金', '土'];
const MONTHS_JP = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

const THEMES = [
  { key: 'paper',    name: 'ペーパー',   color: '#f7f3ee' },
  { key: 'midnight', name: 'ミッドナイト', color: '#1a1a2e' },
  { key: 'retro',    name: 'レトロ',     color: '#f0e6d3' },
  { key: 'forest',   name: 'フォレスト',  color: '#e8f5e9' },
  { key: 'sakura',   name: 'さくら',     color: '#fce4ec' },
];

// ─── 状態 ───────────────────────────────────────────────
let currentScreen = 'home';
let calMonth, calYear;

// ─── 初期化 ─────────────────────────────────────────────
function init() {
  const now = new Date();
  calMonth = now.getMonth();
  calYear  = now.getFullYear();

  applyTheme(Storage.getSettings().theme || 'paper');

  renderCalendarHeader(now);
  flipCalendarAnimation();
  loadTodayEntry();
  renderStreakBar();
  renderTimeTravelCard();
  maybeShowOnboarding();
  updateFirstHint();
  renderDailyPrompt();
  renderReminder();

  // 気分変更コールバック
  Mood.init(() => {});

  // ボトムナビ
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const screen = btn.dataset.screen;
      if (screen) showScreen(screen);
    });
  });

  // 保存ボタン
  document.getElementById('saveBtn')?.addEventListener('click', saveDiary);

  // 写真 input
  document.getElementById('photoInput')?.addEventListener('change', async (e) => {
    await Photo.handleFileInput(e.target.files[0]);
  });

  // 気分ボタン
  document.querySelectorAll('.mood-btn').forEach((btn) => {
    btn.addEventListener('click', () => { Mood.select(btn.dataset.mood); updateFirstHint(); });
  });

  // 写真ボタン
  document.getElementById('btnAddPhoto')?.addEventListener('click', () =>
    document.getElementById('photoInput')?.click()
  );

  // 積み上げトグル
  document.getElementById('btnToggleAcc')?.addEventListener('click', () =>
    Accumulation.toggle()
  );

  // 写真削除
  document.getElementById('photoRemove')?.addEventListener('click', () => Photo.remove());

  // ヘッダーのカレンダーアイコン
  document.getElementById('btnHeaderCalendar')?.addEventListener('click', () => showScreen('calendar'));

  // ヘッダーのプロフィールアイコン
  document.getElementById('btnHeaderProfile')?.addEventListener('click', () => showScreen('profile'));

  // カレンダー画面の前月/次月
  document.getElementById('btnPrevMonth')?.addEventListener('click', () => changeMonth(-1));
  document.getElementById('btnNextMonth')?.addEventListener('click', () => changeMonth(1));

  // 積み上げアイテムクリック
  document.querySelectorAll('.acc-item[data-key]').forEach((item) => {
    item.addEventListener('click', () =>
      Accumulation.editItem(item, item.dataset.key)
    );
  });

  // 目標設定ボタン
  document.getElementById('btnSetGoal')?.addEventListener('click', openGoalModal);

  // 目標モーダルの保存/閉じる
  document.getElementById('btnSaveGoals')?.addEventListener('click', saveGoals);
  document.getElementById('btnCloseGoalModal')?.addEventListener('click', closeGoalModal);
  document.getElementById('goalModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('goalModal')) closeGoalModal();
  });

  // 積み上げ進捗を初期描画
  renderAccProgress();

  // オンボーディング
  document.getElementById('onboardNext')?.addEventListener('click', onboardNext);
  document.getElementById('onboardSkip')?.addEventListener('click', closeOnboarding);

  // 今日のお題（タップで本文に挿入）
  document.getElementById('dailyPrompt')?.addEventListener('click', insertDailyPrompt);

  // 全文検索
  document.getElementById('btnToggleSearch')?.addEventListener('click', toggleSearch);
  document.getElementById('searchInput')?.addEventListener('input', (e) => runSearch(e.target.value));

  // カスタムカテゴリ追加
  document.getElementById('btnAddCat')?.addEventListener('click', addCustomCategory);

  // Year in Review 画像保存
  document.getElementById('yrShare')?.addEventListener('click', shareYearReview);

  // Year in Review
  document.getElementById('btnYearReview')?.addEventListener('click', openYearReview);
  document.getElementById('btnCloseYr')?.addEventListener('click', closeYearReview);
  document.getElementById('yrPrev')?.addEventListener('click', () => moveYrSlide(-1));
  document.getElementById('yrNext')?.addEventListener('click', () => moveYrSlide(1));

  // AIチャット
  document.getElementById('chatSend')?.addEventListener('click', sendChat);
  document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat();
  });

  // 設定モーダル
  document.getElementById('btnOpenSettings')?.addEventListener('click', openSettings);
  document.getElementById('btnCloseSettings')?.addEventListener('click', closeSettings);
  document.getElementById('settingsModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('settingsModal')) closeSettings();
  });

  // エクスポート
  document.getElementById('btnExportData')?.addEventListener('click', () => {
    DataIO.exportToFile();
    showToast('⬇️ バックアップを保存しました！');
  });

  // インポート
  document.getElementById('btnImportData')?.addEventListener('click', () =>
    document.getElementById('importInput')?.click()
  );
  document.getElementById('importInput')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // 同じファイルを再選択できるようにリセット
    if (!file) return;
    if (!confirm('現在のデータを上書きして復元しますか？\nこの操作は元に戻せません。')) return;

    const result = await DataIO.importFromFile(file);
    if (result.ok) {
      showToast('✅ ' + result.message);
      setTimeout(() => location.reload(), 1200);
    } else {
      showToast('⚠️ ' + result.message);
    }
  });
}

// ─── 設定モーダル ────────────────────────────────────────
function openSettings() {
  const usage = document.getElementById('settingsUsage');
  if (usage) usage.textContent = `使用容量: 約 ${Storage.getStorageUsageKB()} KB`;
  renderThemeGrid();
  renderCustomCategories();
  document.getElementById('settingsModal')?.classList.add('show');
}

function closeSettings() {
  document.getElementById('settingsModal')?.classList.remove('show');
}

// ─── テーマ ──────────────────────────────────────────────
function applyTheme(theme) {
  const t = THEMES.some((x) => x.key === theme) ? theme : 'paper';
  if (t === 'paper') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', t);
  }
  // ブラウザのテーマカラー（アドレスバー等）も合わせる
  const meta = document.querySelector('meta[name="theme-color"]');
  const def = THEMES.find((x) => x.key === t);
  if (meta && def) meta.setAttribute('content', def.color);
}

function renderThemeGrid() {
  const grid = document.getElementById('themeGrid');
  if (!grid) return;
  const current = Storage.getSettings().theme || 'paper';

  grid.innerHTML = THEMES.map((t) => `
    <button class="theme-swatch${t.key === current ? ' active' : ''}" data-theme-key="${t.key}">
      <span class="theme-dot" style="background:${t.color}"></span>
      <span class="theme-name">${t.name}</span>
    </button>
  `).join('');

  grid.querySelectorAll('.theme-swatch').forEach((btn) => {
    btn.addEventListener('click', () => selectTheme(btn.dataset.themeKey));
  });
}

function selectTheme(theme) {
  const settings = Storage.getSettings();
  settings.theme = theme;
  Storage.setSettings(settings);
  applyTheme(theme);

  document.querySelectorAll('#themeGrid .theme-swatch').forEach((b) => {
    b.classList.toggle('active', b.dataset.themeKey === theme);
  });

  const def = THEMES.find((x) => x.key === theme);
  showToast(`🎨 テーマを「${def ? def.name : theme}」に変更しました`);
}

// ─── 日めくりヘッダー ────────────────────────────────────
function renderCalendarHeader(date) {
  const el = (id) => document.getElementById(id);
  el('calYear').textContent = `${date.getFullYear()}年`;
  el('calDate').textContent = `${MONTHS_JP[date.getMonth()]}${date.getDate()}日`;
  el('calDay').textContent  = `${DAYS_JP[date.getDay()]}曜日`;
}

function flipCalendarAnimation() {
  setTimeout(() => {
    const inner = document.getElementById('calendarInner');
    if (!inner) return;
    inner.classList.add('flipping');
    setTimeout(() => inner.classList.remove('flipping'), 700);
  }, 300);
}

// ─── 今日の記録読み込み ──────────────────────────────────
function loadTodayEntry() {
  const dateStr = Diary.todayStr();
  Accumulation.init(dateStr);

  const entry = Diary.loadToday();
  if (!entry) return;

  const textarea = document.getElementById('diaryText');
  if (textarea) textarea.value = entry.text || '';

  Mood.setSelected(entry.mood || null);
  Photo.loadExisting(Storage.getPhoto(dateStr));

  // 積み上げがあれば表示
  if (entry.accumulation && Object.values(entry.accumulation).some((v) => v > 0)) {
    Accumulation.show();
    for (const [key, val] of Object.entries(entry.accumulation)) {
      const valEl = document.querySelector(`.acc-value[data-key="${key}"]`);
      if (valEl) valEl.textContent = val;
    }
  }
}

// ─── ストリークバー ──────────────────────────────────────
function renderStreakBar() {
  const stats = Storage.getStats();
  const streak = stats.streak.current;

  const countEl = document.getElementById('streakCount');
  if (countEl) countEl.textContent = `${streak}日連続`;

  const xpBar = document.getElementById('xpBar');
  if (xpBar) {
    const pct = Math.min((stats.exp / stats.expToNext) * 100, 100);
    xpBar.style.width = `${pct}%`;
  }

  const xpLabel = document.getElementById('xpLabel');
  if (xpLabel) xpLabel.textContent = `${stats.exp} / ${stats.expToNext}`;

  const levelBadge = document.getElementById('levelBadge');
  if (levelBadge) levelBadge.textContent = `Lv.${stats.level}`;
}

// ─── タイムトラベルカード ────────────────────────────────
function renderTimeTravelCard() {
  const result = Diary.getTimeTravelEntry();
  const card = document.getElementById('pastCard');
  if (!card) return;

  if (!result) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  card.classList.add('show');
  document.getElementById('pastTag').textContent  = result.label;
  document.getElementById('pastDate').textContent = Diary.formatDate(result.dateStr);
  const excerpt = result.entry.text.length > 100
    ? result.entry.text.slice(0, 100) + '…'
    : result.entry.text;
  document.getElementById('pastText').textContent = excerpt;
}

// ─── 日記保存 ────────────────────────────────────────────
async function saveDiary() {
  const text  = document.getElementById('diaryText')?.value || '';
  const mood  = Mood.getSelected();

  if (!text.trim() && !mood) {
    showToast('気分か日記を入力してね ✏️');
    return;
  }

  const dateStr = Diary.todayStr();
  const accValues = Accumulation.getValues();

  // 日記保存
  Diary.save(dateStr, { mood, text, accValues });

  // 積み上げ保存
  Accumulation.save(dateStr);

  // 写真保存
  if (Photo.isNew() && Photo.getCurrentBase64()) {
    Storage.setPhoto(dateStr, Photo.getCurrentBase64());
  }

  // ゲーミフィケーション
  const now = new Date();
  const hour = now.getHours();
  const allMoods = Gamification.checkAllMoodsUnlocked();

  const stats = Gamification.updateStreak(dateStr);
  Gamification.updateTotals(dateStr, text.trim().length, Photo.isNew());

  const result = Gamification.addSaveExp({
    hasPhoto: !!Photo.getCurrentBase64(),
    hasMood: !!mood,
    hasAcc: Accumulation.getCount(),
    wordCount: text.trim().length,
  });

  // 保存ボタン演出
  triggerSaveAnimation(result.gained);

  // バッジ解放
  if (result.newBadges.length > 0) {
    setTimeout(() => showBadgeModal(result.newBadges[0]), 1500);
  }

  // レベルアップ
  if (result.leveledUp) {
    setTimeout(() => showToast(`🎉 Lv.${result.stats.level} にレベルアップ！`), 800);
  }

  renderStreakBar();

  // AIひとこと（内蔵AI対応ブラウザのみ・非対応なら何も起きない）
  const moodLabel = mood && Mood.getMoodInfo ? (Mood.getMoodInfo(mood)?.label || '') : '';
  maybeAddAiComment(text, moodLabel);
}

// ─── 保存アニメーション ──────────────────────────────────
function triggerSaveAnimation(gained) {
  const btn = document.getElementById('saveBtn');
  if (!btn) return;

  // リップル
  const rip = document.createElement('span');
  rip.className = 'save-ripple';
  rip.style.cssText = 'width:100px;height:100px;left:calc(50% - 50px);top:calc(50% - 50px)';
  btn.appendChild(rip);
  setTimeout(() => rip.remove(), 600);

  // テキスト変化
  btn.textContent = '保存しました！';
  btn.classList.add('saved');
  setTimeout(() => {
    btn.textContent = '今日の記録を保存する';
    btn.classList.remove('saved');
  }, 2000);

  showToast(`✏️ +${gained} EXP!`);
}

// ─── トースト ────────────────────────────────────────────
function showToast(msg, duration = 2500) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.innerHTML = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ─── 初回オンボーディング ────────────────────────────────
let _onboardStep = 0;
const ONBOARD_STEPS = 4;
const ONBOARD_KEY = 'ai-nikki-onboarded';

function maybeShowOnboarding() {
  if (localStorage.getItem(ONBOARD_KEY)) return;
  _onboardStep = 0;
  renderOnboardStep();
  document.getElementById('onboardOverlay')?.classList.add('show');
}

function renderOnboardStep() {
  document.querySelectorAll('.onboard-slide').forEach((s) => {
    s.hidden = parseInt(s.dataset.step) !== _onboardStep;
  });
  const dots = document.getElementById('onboardDots');
  if (dots) {
    dots.innerHTML = Array.from({ length: ONBOARD_STEPS }, (_, i) =>
      `<span class="onboard-dot${i === _onboardStep ? ' active' : ''}"></span>`).join('');
  }
  const next = document.getElementById('onboardNext');
  if (next) next.textContent = _onboardStep === ONBOARD_STEPS - 1 ? 'はじめる' : 'つぎへ';
}

function onboardNext() {
  if (_onboardStep < ONBOARD_STEPS - 1) {
    _onboardStep += 1;
    renderOnboardStep();
  } else {
    closeOnboarding();
  }
}

function closeOnboarding() {
  localStorage.setItem(ONBOARD_KEY, '1');
  document.getElementById('onboardOverlay')?.classList.remove('show');
}

// ─── 初回ヒント（まだ気分未選択なら👆を出す） ────────────
function updateFirstHint() {
  const hint = document.getElementById('moodHint');
  if (!hint) return;
  const hasAnyEntry = Object.keys(Storage.getEntries()).length > 0;
  const moodChosen = !!Mood.getSelected();
  hint.classList.toggle('show', !hasAnyEntry && !moodChosen);
}

// ─── 今日のお題 ──────────────────────────────────────────
function renderDailyPrompt() {
  const el = document.getElementById('dailyPromptText');
  if (el) el.textContent = Extras.getDailyPrompt(Diary.todayStr());
}

function insertDailyPrompt() {
  const ta = document.getElementById('diaryText');
  const promptEl = document.getElementById('dailyPromptText');
  if (!ta || !promptEl) return;
  const line = `${promptEl.textContent}\n`;
  if (ta.value.includes(promptEl.textContent)) { ta.focus(); return; }
  ta.value = ta.value ? `${ta.value}\n${line}` : line;
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
}

// ─── 書き忘れリマインド ──────────────────────────────────
function renderReminder() {
  const banner = document.getElementById('reminderBanner');
  if (!banner) return;
  banner.style.display = Extras.shouldRemindToday() ? 'flex' : 'none';
}

// ─── 全文検索 ────────────────────────────────────────────
function toggleSearch() {
  const panel = document.getElementById('searchPanel');
  if (!panel) return;
  const open = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = open ? 'block' : 'none';
  if (open) {
    document.getElementById('searchInput')?.focus();
  } else {
    const input = document.getElementById('searchInput');
    if (input) input.value = '';
    runSearch('');
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function runSearch(query) {
  const box = document.getElementById('searchResults');
  if (!box) return;
  const q = query.trim();
  if (!q) { box.innerHTML = ''; return; }

  const results = Extras.search(q);
  if (results.length === 0) {
    box.innerHTML = `<div class="search-empty">「${escapeHtml(q)}」に一致する日記はありません</div>`;
    return;
  }

  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  box.innerHTML = results.slice(0, 30).map((r) => {
    const idx = r.text.toLowerCase().indexOf(q.toLowerCase());
    const start = Math.max(0, idx - 12);
    let snippet = (start > 0 ? '…' : '') + r.text.slice(start, start + 60);
    snippet = escapeHtml(snippet).replace(re, '<mark>$1</mark>');
    const moodInfo = r.mood ? Mood.getMoodInfo(r.mood) : null;
    return `<div class="search-result" data-date="${r.dateStr}">
      <div class="search-result-head">
        <span>${moodInfo ? moodInfo.emoji : '📝'}</span>
        <span class="search-result-date">${Diary.formatDate(r.dateStr)}</span>
      </div>
      <div class="search-result-text">${snippet}</div>
    </div>`;
  }).join('');

  box.querySelectorAll('.search-result').forEach((el) => {
    el.addEventListener('click', () => openDayView(el.dataset.date));
  });
}

// ─── カスタム積み上げカテゴリ ────────────────────────────
function renderCustomCategories() {
  const list = document.getElementById('customCatList');
  if (!list) return;
  const cats = Accumulation.getCustomCategories();
  if (cats.length === 0) {
    list.innerHTML = `<div class="search-empty" style="padding:8px">まだ追加されたカテゴリはありません</div>`;
    return;
  }
  list.innerHTML = cats.map((c) => `
    <div class="custom-cat-row">
      <span class="ccr-icon">${c.icon}</span>
      <span class="ccr-name">${escapeHtml(c.label)}</span>
      <span class="ccr-unit">${escapeHtml(c.unit)}</span>
      <button class="ccr-del" data-key="${c.key}" title="削除" aria-label="削除">✕</button>
    </div>
  `).join('');
  list.querySelectorAll('.ccr-del').forEach((b) => {
    b.addEventListener('click', () => {
      Accumulation.removeCustomCategory(b.dataset.key);
      renderCustomCategories();
      showToast('カテゴリを削除しました');
    });
  });
}

function addCustomCategory() {
  const name = document.getElementById('catName');
  const icon = document.getElementById('catIcon');
  const unit = document.getElementById('catUnit');
  if (!name || !name.value.trim()) { showToast('カテゴリ名を入力してください'); return; }

  Accumulation.addCustomCategory({
    label: name.value.trim(),
    icon: icon?.value.trim() || '◆',
    unit: unit?.value.trim() || '回',
  });
  name.value = ''; if (icon) icon.value = ''; if (unit) unit.value = '';
  renderCustomCategories();
  showToast('🎉 カテゴリを追加しました');
}

// ─── Year in Review を画像保存 ───────────────────────────
async function shareYearReview() {
  const slide = document.querySelectorAll('#yrSlides .yr-slide')[_yrIndex];
  if (!slide) return;
  if (typeof html2canvas === 'undefined') {
    showToast('⚠️ 画像保存の準備中です。少し待って再度お試しください');
    return;
  }
  showToast('🖼 画像を生成中…');
  try {
    const canvas = await html2canvas(slide, { scale: 2, backgroundColor: null, logging: false });
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-nikki-${new Date().getFullYear()}-${_yrIndex + 1}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('✅ 画像を保存しました！');
  } catch {
    showToast('⚠️ 画像の生成に失敗しました');
  }
}

// ─── バッジモーダル ──────────────────────────────────────
function showBadgeModal(badge) {
  document.getElementById('badgeIcon').textContent  = badge.icon;
  document.getElementById('badgeTitle').textContent = badge.name;
  document.getElementById('badgeDesc').textContent  = badge.desc;
  document.getElementById('badgeModal').classList.add('show');
}

window.closeBadge = function () {
  document.getElementById('badgeModal').classList.remove('show');
};

// ─── 画面遷移 ────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  const target = document.getElementById(`screen-${name}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
  const navBtn = document.getElementById(`nav-${name}`);
  if (navBtn) navBtn.classList.add('active');

  currentScreen = name;

  if (name === 'calendar') renderCalendarGrid();
  if (name === 'profile')  renderProfile();
  if (name === 'chat')     setupChat();
}

// ─── カレンダー画面 ──────────────────────────────────────
function changeMonth(delta) {
  calMonth += delta;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  renderCalendarGrid();
}

// スタンププール（ボーナス用）
const BONUS_STAMPS = ['✨','⭐','🌟','💫','🌸','🍀','🌈','🎵','💎','🔮','🎀','🌺','🦋','🌻','💐'];
const MOOD_STAMPS  = { great: '😄', good: '🙂', ok: '😐', bad: '😟', awful: '😢' };

/**
 * 日付文字列をシードにした擬似乱数（0〜1）
 * 同じ日付なら常に同じ値を返す（再描画で変わらない）
 */
function seededRand(dateStr, salt = 0) {
  let h = salt;
  for (let i = 0; i < dateStr.length; i++) h = (Math.imul(31, h) + dateStr.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

function buildStampsHtml(dateStr, entry) {
  const stamps = [];

  // 気分スタンプ（必ず1枚目）
  if (entry.mood && MOOD_STAMPS[entry.mood]) {
    stamps.push(MOOD_STAMPS[entry.mood]);
  }

  // 写真があれば📸
  if (Storage.getPhoto(dateStr)) stamps.push('📸');

  // 積み上げ別スタンプ
  const acc = entry.accumulation || {};
  if ((acc.reading  || 0) > 0) stamps.push('📚');
  if ((acc.exercise || 0) > 0) stamps.push('💪');
  if ((acc.study    || 0) > 0) stamps.push('✏️');

  // ボーナスを最大1枚追加（ランダム固定）
  if (stamps.length < 3) {
    const idx = Math.floor(seededRand(dateStr, 99) * BONUS_STAMPS.length);
    stamps.push(BONUS_STAMPS[idx]);
  }

  // 最大3枚まで
  const shown = stamps.slice(0, 3);

  return shown.map((emoji, i) => {
    const rot   = Math.round(seededRand(dateStr, i) * 30 - 15); // -15〜+14度
    const scale = 0.85 + seededRand(dateStr, i + 10) * 0.3;    // 0.85〜1.15
    return `<span class="cal-stamp" style="transform:rotate(${rot}deg) scale(${scale})">${emoji}</span>`;
  }).join('');
}

function renderCalendarGrid() {
  document.getElementById('monthTitle').textContent = `${calYear}年 ${MONTHS_JP[calMonth]}`;
  const grid = document.getElementById('daysGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const entries = Storage.getEntries();
  const today   = Diary.todayStr();
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const c = document.createElement('div');
    c.className = 'day-cell empty';
    grid.appendChild(c);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const entry   = entries[dateStr];
    const c       = document.createElement('div');
    c.className   = 'day-cell';

    if (dateStr === today) c.classList.add('today');

    if (entry) {
      c.classList.add('has-entry');
      c.innerHTML = `
        <span class="day-num">${d}</span>
        <div class="stamp-container">${buildStampsHtml(dateStr, entry)}</div>
      `;
      c.addEventListener('click', () => openDayView(dateStr));
    } else {
      c.textContent = d;
      if (dateStr === today) {
        c.addEventListener('click', () => showScreen('home'));
      }
    }

    grid.appendChild(c);
  }
}

function openDayView(dateStr) {
  const entry = Diary.get(dateStr);
  if (!entry) return;
  const text = entry.text ? entry.text.slice(0, 200) : '';
  showToast(`📖 ${Diary.formatDate(dateStr)}: ${text}…`);
}

// ─── プロフィール画面 ────────────────────────────────────
function renderProfile() {
  const stats = Storage.getStats();
  const title = Gamification.getTitle(stats.level);

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('profileLevel',   `Lv.${stats.level} — ${title}`);
  set('profileStreak',  `${stats.streak.current}日連続記録中`);
  set('statEntries',    stats.totalEntries);
  set('statWords',      stats.totalWords.toLocaleString());
  set('statPhotos',     stats.totalPhotos);

  // バッジ一覧
  const badgeList = document.getElementById('badgeList');
  if (badgeList) {
    const allBadges = Gamification.getAllBadges();
    badgeList.innerHTML = allBadges.map((b) => {
      const unlocked = stats.badges.includes(b.id);
      return `<div class="badge-item${unlocked ? '' : ' locked'}" title="${b.desc}">
        <div class="badge-item-icon">${b.icon}</div>
        <div class="badge-item-name">${b.name}</div>
      </div>`;
    }).join('');
  }

  // 今月の積み上げ
  renderMonthlyAccumulation();

  // 感情コレクション + 気分バランス
  renderMoodCollection();
  renderMoodBalance();

  // 今週のふりかえり
  renderWeeklyReview();
}

// ─── 今週のふりかえり ────────────────────────────────────
function renderWeeklyReview() {
  const strip = document.getElementById('weekStrip');
  const summary = document.getElementById('weekSummary');
  if (!strip || !summary) return;

  const wr = Extras.getWeeklyReview();
  const today = Diary.todayStr();
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];

  strip.innerHTML = wr.days.map((d) => {
    const dow = DOW[new Date(d.dateStr).getDay()];
    const isToday = d.dateStr === today;
    if (d.entry && d.entry.mood) {
      const m = Mood.getMoodInfo(d.entry.mood);
      return `<div class="week-day">
        <div class="week-dot${isToday ? ' today' : ''}">${m ? m.emoji : '📝'}</div>
        <div class="week-dow">${dow}</div>
      </div>`;
    }
    return `<div class="week-day">
      <div class="week-dot empty${isToday ? ' today' : ''}">·</div>
      <div class="week-dow">${dow}</div>
    </div>`;
  }).join('');

  const moodLine = wr.topMoodMeta
    ? `よく出た気分は <strong>${wr.topMoodMeta.emoji} ${wr.topMoodMeta.label}</strong>`
    : '気分の記録はまだありません';
  summary.innerHTML = `この7日間で <strong>${wr.written}日</strong> 記録 ／ ${moodLine}`;
}

// ─── 感情コレクション図鑑 ────────────────────────────────
function renderMoodCollection() {
  const grid = document.getElementById('moodCollection');
  if (grid) {
    grid.innerHTML = Insights.getMoodCollection().map((m) => `
      <div class="mood-collect-item${m.unlocked ? '' : ' locked'}" title="${m.label}">
        <span class="mood-collect-emoji">${m.unlocked ? m.emoji : '❔'}</span>
        <span class="mood-collect-count">${m.unlocked ? '×' + m.count : '—'}</span>
      </div>
    `).join('');
  }

  const comboList = document.getElementById('comboList');
  if (comboList) {
    comboList.innerHTML = Insights.getComboCollection().map((c) => `
      <div class="combo-item ${c.unlocked ? 'unlocked' : 'locked'}">
        <span class="combo-icon">${c.unlocked ? c.icon : '🔒'}</span>
        <div class="combo-text">
          <div class="combo-name">${c.unlocked ? c.name : '？？？'}</div>
          <div class="combo-desc">${c.desc}</div>
        </div>
        <span class="combo-lock">${c.unlocked ? '✅' : ''}</span>
      </div>
    `).join('');
  }
}

// ─── 気分バランスバー ────────────────────────────────────
function renderMoodBalance() {
  const el = document.getElementById('moodBalance');
  if (!el) return;
  const counts = Insights.getMoodCounts();
  const max = Math.max(1, ...Object.values(counts));

  el.innerHTML = Insights.MOOD_ORDER.map((id) => {
    const meta = Insights.MOOD_META[id];
    const c = counts[id];
    const pct = (c / max) * 100;
    return `<div class="mb-row">
      <span class="mb-emoji">${meta.emoji}</span>
      <div class="mb-track"><div class="mb-fill" style="width:${pct}%;background:${meta.color}"></div></div>
      <span class="mb-count">${c}</span>
    </div>`;
  }).join('');
}

function renderMonthlyAccumulation() {
  const now = new Date();
  const acc = Storage.getAccumulation();
  const totals = { reading: 0, exercise: 0, study: 0 };

  for (const [key, val] of Object.entries(acc)) {
    const d = new Date(key);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
      if (val.reading)  totals.reading  += val.reading  || 0;
      if (val.exercise) totals.exercise += val.exercise || 0;
      if (val.study)    totals.study    += val.study    || 0;
    }
  }

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('accReadingTotal',   `${totals.reading} ページ`);
  set('accExerciseTotal',  `${totals.exercise} 分`);
  set('accStudyTotal',     `${totals.study} 時間`);
}

// ─── Year in Review ──────────────────────────────────────
let _yrIndex = 0;
let _yrTotal = 0;

function openYearReview() {
  const year = new Date().getFullYear();
  const r = Insights.getYearReview(year);

  if (r.totalEntries === 0) {
    showToast(`📭 ${year}年の記録がまだありません`);
    return;
  }

  const moodPeak = Object.entries(r.moodCounts).sort((a, b) => b[1] - a[1])[0];
  const peakMeta = Insights.MOOD_META[moodPeak[0]];
  const monthName = (i) => (i === null ? '—' : `${i + 1}月`);
  const acc = r.accumulation;

  const slides = [
    {
      cls: 'yr-gradient-1',
      html: `<h2 data-depth="6">${r.year}年のあなた</h2>
        <div class="yr-emoji-hero" data-depth="20">📖</div>
        <div class="yr-big"><span class="yr-count" data-count="${r.totalEntries}">0</span><span style="font-size:24px">日</span></div>
        <div class="yr-sub">日記を書きました</div>
        <div class="yr-stat-row" data-depth="10">
          <div><div class="yr-stat-num"><span class="yr-count" data-count="${r.totalWords}">0</span></div><div class="yr-stat-lbl">文字</div></div>
          <div><div class="yr-stat-num"><span class="yr-count" data-count="${r.photoCount}">0</span></div><div class="yr-stat-lbl">写真</div></div>
          <div><div class="yr-stat-num"><span class="yr-count" data-count="${r.longestStreak}">0</span></div><div class="yr-stat-lbl">最長連続</div></div>
        </div>`,
    },
    {
      cls: 'yr-gradient-2',
      html: `<h2 data-depth="6">いちばんの気分</h2>
        <div class="yr-emoji-hero" data-depth="20">${peakMeta.emoji}</div>
        <div class="yr-big" style="font-size:32px">${peakMeta.label}</div>
        <div class="yr-sub">を <span class="yr-count" data-count="${moodPeak[1]}">0</span> 回記録しました</div>
        <div style="margin-top:24px" data-depth="10">
          ${Insights.MOOD_ORDER.map((id) => {
            const m = Insights.MOOD_META[id];
            return `<div class="yr-mood-line">${m.emoji} ${'■'.repeat(Math.min(20, r.moodCounts[id]))} ${r.moodCounts[id]}</div>`;
          }).join('')}
        </div>`,
    },
    {
      cls: 'yr-gradient-3',
      html: `<h2 data-depth="6">感情の旅路</h2>
        <div class="yr-emoji-hero" data-depth="20">🗓️</div>
        <div class="yr-sub" style="font-size:16px">いちばん活発だったのは</div>
        <div class="yr-big" style="font-size:40px">${monthName(r.topMonth)}</div>
        <div class="yr-sub">（<span class="yr-count" data-count="${r.monthCounts[r.topMonth]}">0</span> 件の記録）</div>
        <div class="yr-sub" style="margin-top:20px">いちばんポジティブだったのは <strong>${monthName(r.bestMonth)}</strong></div>`,
    },
    {
      cls: 'yr-gradient-4',
      html: `<h2 data-depth="6">積み上げの1年</h2>
        <div class="yr-emoji-hero" data-depth="20">🏔️</div>
        <div class="yr-stat-row" style="flex-direction:column;gap:12px" data-depth="10">
          <div><div class="yr-stat-num">📚 <span class="yr-count" data-count="${acc.reading}">0</span></div><div class="yr-stat-lbl">読書ページ</div></div>
          <div><div class="yr-stat-num">💪 <span class="yr-count" data-count="${acc.exercise}">0</span></div><div class="yr-stat-lbl">運動の分数</div></div>
          <div><div class="yr-stat-num">✏️ <span class="yr-count" data-count="${acc.study}">0</span></div><div class="yr-stat-lbl">勉強の時間</div></div>
        </div>`,
    },
    {
      cls: 'yr-gradient-5',
      html: `<h2 data-depth="6">来年へ</h2>
        <div class="yr-emoji-hero" data-depth="20">🎉</div>
        <div class="yr-big" style="font-size:28px">おつかれさま！</div>
        <div class="yr-sub" style="margin-top:12px;line-height:1.8">
          ${r.year}年も よく書きました。<br>
          来年も あなたの毎日を<br>めくっていきましょう。
        </div>`,
    },
  ];

  _yrTotal = slides.length;
  _yrIndex = 0;

  document.getElementById('yrSlides').innerHTML = slides
    .map((s) => `<div class="yr-slide ${s.cls}">${s.html}</div>`).join('');
  document.getElementById('yrDots').innerHTML = slides
    .map((_, i) => `<span class="yr-dot${i === 0 ? ' active' : ''}"></span>`).join('');

  updateYrSlide();
  document.getElementById('yrOverlay').classList.add('show');
}

function moveYrSlide(delta) {
  _yrIndex = Math.max(0, Math.min(_yrTotal - 1, _yrIndex + delta));
  updateYrSlide();
}

const _prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function updateYrSlide() {
  const slides = document.getElementById('yrSlides');
  if (slides) slides.style.transform = `translateX(-${_yrIndex * 100}%)`;

  document.querySelectorAll('#yrDots .yr-dot').forEach((d, i) => {
    d.classList.toggle('active', i === _yrIndex);
  });

  const prev = document.getElementById('yrPrev');
  const next = document.getElementById('yrNext');
  if (prev) prev.disabled = _yrIndex === 0;
  if (next) next.disabled = _yrIndex === _yrTotal - 1;

  // 現在スライドの演出
  const slideEls = document.querySelectorAll('#yrSlides .yr-slide');
  slideEls.forEach((el, i) => {
    // パララックス：深さ別に少しズラして入場
    el.querySelectorAll('[data-depth]').forEach((node) => {
      const depth = parseFloat(node.dataset.depth) || 0;
      if (_prefersReducedMotion) { node.style.transform = ''; node.style.opacity = ''; return; }
      if (i === _yrIndex) {
        node.style.transition = 'transform .6s cubic-bezier(.23,1,.32,1), opacity .5s ease';
        node.style.transform = 'translateY(0)';
        node.style.opacity = '1';
      } else {
        node.style.transition = 'none';
        node.style.transform = `translateY(${depth}px)`;
        node.style.opacity = '0';
      }
    });
  });

  // カウントアップ（現在スライド内）
  const cur = slideEls[_yrIndex];
  if (cur) cur.querySelectorAll('.yr-count').forEach((el) => animateCount(el));

  // 最終スライドで紙吹雪
  if (_yrIndex === _yrTotal - 1) launchConfetti();
}

function animateCount(el) {
  const target = parseInt(el.dataset.count, 10) || 0;
  if (_prefersReducedMotion) { el.textContent = target.toLocaleString(); return; }
  const dur = 900;
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    el.textContent = Math.round(target * eased).toLocaleString();
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = target.toLocaleString();
  }
  requestAnimationFrame(tick);
}

function launchConfetti() {
  if (_prefersReducedMotion) return;
  const overlay = document.getElementById('yrOverlay');
  if (!overlay || overlay._confettiDone) return;
  overlay._confettiDone = true;
  const colors = ['#e07a3a', '#7c5cbf', '#46e08a', '#ffab40', '#ff6d88', '#5c9ce6'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.top = '-12px';
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = (Math.random() * 0.4) + 's';
    piece.style.animationDuration = (1.4 + Math.random() * 1.1) + 's';
    if (Math.random() > 0.5) piece.style.borderRadius = '50%';
    overlay.appendChild(piece);
    setTimeout(() => piece.remove(), 2800);
  }
}

function closeYearReview() {
  const overlay = document.getElementById('yrOverlay');
  overlay.classList.remove('show');
  overlay._confettiDone = false;
}

// ─── AIチャット（ブラウザ内蔵AI） ────────────────────────
let _chatSession = null;
let _chatBusy = false;

async function setupChat() {
  const wrap = document.getElementById('chatWrap');
  const unsupported = document.getElementById('chatUnsupported');
  if (!wrap || !unsupported) return;

  const status = await AI.availability();

  if (status === 'no-api' || status === 'unavailable') {
    wrap.style.display = 'none';
    unsupported.style.display = '';
    return;
  }

  // 対応あり（available / downloadable / downloading）
  unsupported.style.display = 'none';
  wrap.style.display = 'flex';

  // 初回の挨拶（ログが空のとき）
  const log = document.getElementById('chatLog');
  if (log && log.children.length === 0) {
    if (status === 'downloadable' || status === 'downloading') {
      addChatMsg('ai', '初回はAIモデルの準備に少し時間がかかることがあります。メッセージを送ると準備を始めます。');
    } else {
      addChatMsg('ai', 'こんにちは。今日はどんな一日でしたか？ 気になっていることでも、うれしかったことでも、気軽に聞かせてください。');
    }
  }
}

function addChatMsg(role, text) {
  const log = document.getElementById('chatLog');
  if (!log) return null;
  const el = document.createElement('div');
  el.className = `chat-msg ${role}`;
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

async function sendChat() {
  if (_chatBusy) return;
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSend');
  const text = (input?.value || '').trim();
  if (!text) return;

  addChatMsg('user', text);
  input.value = '';
  _chatBusy = true;
  if (sendBtn) sendBtn.disabled = true;

  const thinking = addChatMsg('ai', '…');
  if (thinking) thinking.classList.add('thinking');

  try {
    if (!_chatSession) {
      // 直近の日記を少しだけ文脈に渡す
      const recent = recentDiaryContext();
      _chatSession = await AI.createSession(recent);
    }
    if (!_chatSession) throw new Error('no-session');

    const reply = await _chatSession.prompt(text);
    if (thinking) {
      thinking.classList.remove('thinking');
      thinking.textContent = (reply || '').trim() || 'うまく応答できませんでした。もう一度試してみてください。';
    }
  } catch {
    if (thinking) {
      thinking.classList.remove('thinking');
      thinking.textContent = '⚠️ 応答の生成に失敗しました。ブラウザのAI機能が使えない可能性があります。';
    }
  } finally {
    _chatBusy = false;
    if (sendBtn) sendBtn.disabled = false;
    const log = document.getElementById('chatLog');
    if (log) log.scrollTop = log.scrollHeight;
  }
}

/** 直近3日分の日記を文脈用テキストに（プライバシーは端末内なので外部送信なし） */
function recentDiaryContext() {
  const entries = Storage.getEntries();
  const keys = Object.keys(entries).sort((a, b) => b.localeCompare(a)).slice(0, 3);
  if (keys.length === 0) return '';
  const lines = keys.map((k) => {
    const e = entries[k];
    const mood = e.mood && Mood.getMoodInfo ? (Mood.getMoodInfo(e.mood)?.label || '') : '';
    return `- ${k}（${mood}）: ${(e.text || '').slice(0, 80)}`;
  });
  return '参考までに、ユーザーの最近の日記です（必要なときだけ触れてください）:\n' + lines.join('\n');
}

// ─── AIひとこと（保存後・内蔵AI対応時のみ） ──────────────
async function maybeAddAiComment(text, moodLabel) {
  const box = document.getElementById('aiComment');
  const body = document.getElementById('aiCommentBody');
  if (!box || !body) return;
  if (!text || text.trim().length < 4) return;

  const status = await AI.availability();
  if (status === 'no-api' || status === 'unavailable') return;

  box.style.display = '';
  body.classList.add('loading');
  body.textContent = '考えています…';

  const prompt =
    `次は今日の日記です。気分は「${moodLabel || '未選択'}」。` +
    `2文以内で、共感のひとことと、よければ小さな問いかけを返してください。\n\n日記:\n${text}`;
  const reply = await AI.prompt(prompt);

  body.classList.remove('loading');
  if (reply) {
    body.textContent = reply;
  } else {
    box.style.display = 'none';
  }
}

// ─── 積み上げ目標モーダル ─────────────────────────────────
function openGoalModal() {
  const goals = Accumulation.getGoals();
  const categories = [
    { key: 'reading',  label: '読書',  unit: 'ページ/月' },
    { key: 'exercise', label: '運動',  unit: '分/月' },
    { key: 'study',    label: '勉強',  unit: '時間/月' },
  ];

  const rows = categories.map((cat) => `
    <div class="goal-row">
      <label class="goal-label">${cat.label}</label>
      <div class="goal-input-wrap">
        <input class="goal-input" type="number" min="0" data-key="${cat.key}"
          value="${goals[cat.key] || ''}" placeholder="未設定">
        <span class="goal-unit">${cat.unit}</span>
      </div>
    </div>
  `).join('');

  document.getElementById('goalModalBody').innerHTML = rows;
  document.getElementById('goalModal').classList.add('show');
}

function saveGoals() {
  document.querySelectorAll('#goalModalBody .goal-input').forEach((inp) => {
    const key = inp.dataset.key;
    const val = parseFloat(inp.value);
    if (!isNaN(val) && val > 0) {
      Accumulation.setGoal(key, val);
    } else if (inp.value === '') {
      Accumulation.setGoal(key, 0);
    }
  });
  closeGoalModal();
  renderAccProgress();
  showToast('🎯 目標を設定しました！');
}

function closeGoalModal() {
  document.getElementById('goalModal').classList.remove('show');
}

/** ホーム画面の積み上げセクションに今月進捗を反映 */
function renderAccProgress() {
  const goals    = Accumulation.getGoals();
  const keys     = ['reading', 'exercise', 'study'];

  keys.forEach((key) => {
    const goal  = goals[key] || 0;
    const total = Accumulation.getMonthlyTotal(key);
    const bar   = document.querySelector(`.acc-progress-mini[data-key="${key}"]`);
    const label = document.querySelector(`.acc-goal-label[data-key="${key}"]`);
    if (!bar) return;

    if (goal > 0) {
      bar.style.width = `${Math.min((total / goal) * 100, 100)}%`;
      bar.parentElement.style.display = 'block';
      if (label) label.textContent = `${total} / ${goal}`;
    } else {
      bar.parentElement.style.display = 'none';
    }
  });
}

// ─── グローバル公開（インライン onclick 用） ─────────────
window.showScreen    = showScreen;
window.showToast     = showToast;
window.changeMonth   = changeMonth;
window.openGoalModal = openGoalModal;
window.saveGoals     = saveGoals;
window.closeGoalModal = closeGoalModal;

// ─── エントリポイント ────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
