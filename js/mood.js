/**
 * mood.js — 気分スタンプ管理
 */

const MOODS = [
  { id: 'great', emoji: '😄', label: '最高！',   color: 'var(--mood-great)' },
  { id: 'good',  emoji: '🙂', label: 'いい感じ', color: 'var(--mood-good)' },
  { id: 'ok',    emoji: '😐', label: 'ふつう',   color: 'var(--mood-ok)' },
  { id: 'bad',   emoji: '😟', label: 'ちょっと…', color: 'var(--mood-bad)' },
  { id: 'awful', emoji: '😢', label: 'つらい',   color: 'var(--mood-awful)' },
];

let _selectedMood = null;
let _onChangeCallback = null;

const Mood = {
  init(onChangeCb) {
    _onChangeCallback = onChangeCb;
  },

  select(moodId) {
    _selectedMood = moodId;
    this._render();
    if (_onChangeCallback) _onChangeCallback(moodId);
  },

  getSelected() {
    return _selectedMood;
  },

  setSelected(moodId) {
    _selectedMood = moodId || null;
    this._render();
  },

  reset() {
    _selectedMood = null;
    this._render();
  },

  getMoodInfo(moodId) {
    return MOODS.find((m) => m.id === moodId) || null;
  },

  getAll() {
    return MOODS;
  },

  _render() {
    document.querySelectorAll('.mood-btn').forEach((btn) => {
      const isSelected = btn.dataset.mood === _selectedMood;
      btn.classList.toggle('selected', isSelected);
    });
    const label = document.getElementById('moodLabel');
    if (label) {
      const info = this.getMoodInfo(_selectedMood);
      label.textContent = info ? info.label : '';
    }
  },
};

export { Mood, MOODS };
