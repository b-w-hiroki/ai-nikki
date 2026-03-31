/**
 * app.js — メインアプリロジック・画面遷移・UI制御
 */
import { Storage } from './storage.js';
import { Diary } from './diary.js';
import { Mood } from './mood.js';
import { Photo } from './photo.js';
import { Accumulation } from './accumulation.js';
import { Gamification } from './gamification.js';

// ─── 定数 ───────────────────────────────────────────────
const DAYS_JP  = ['日', '月', '火', '水', '木', '金', '土'];
const MONTHS_JP = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

// ─── 状態 ───────────────────────────────────────────────
let currentScreen = 'home';
let calMonth, calYear;

// ─── 初期化 ─────────────────────────────────────────────
function init() {
  const now = new Date();
  calMonth = now.getMonth();
  calYear  = now.getFullYear();

  renderCalendarHeader(now);
  flipCalendarAnimation();
  loadTodayEntry();
  renderStreakBar();
  renderTimeTravelCard();

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
    btn.addEventListener('click', () => Mood.select(btn.dataset.mood));
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
}

// ─── カレンダー画面 ──────────────────────────────────────
function changeMonth(delta) {
  calMonth += delta;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  renderCalendarGrid();
}

function renderCalendarGrid() {
  document.getElementById('monthTitle').textContent = `${calYear}年 ${MONTHS_JP[calMonth]}`;
  const grid = document.getElementById('daysGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const moodMap = Diary.getMoodMap();
  const today = Diary.todayStr();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const c = document.createElement('div');
    c.className = 'day-cell empty';
    grid.appendChild(c);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const c = document.createElement('div');
    c.className = 'day-cell';
    c.textContent = d;

    if (dateStr === today) c.classList.add('today');

    const mood = moodMap[dateStr];
    if (mood) c.classList.add('has-entry', `mood-${mood}`);

    c.addEventListener('click', () => {
      if (mood || dateStr === today) openDayView(dateStr);
    });
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

// ─── グローバル公開（インライン onclick 用） ─────────────
window.showScreen = showScreen;
window.showToast  = showToast;
window.changeMonth = changeMonth;

// ─── エントリポイント ────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
