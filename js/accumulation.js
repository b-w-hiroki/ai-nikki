/**
 * accumulation.js — 積み上げトラッカー（読書/運動/勉強 + カスタム）
 */
import { Storage } from './storage.js';

const DEFAULT_CATEGORIES = [
  { key: 'reading',  label: '読書', icon: '本', iconClass: 'book',     unit: 'ページ', step: '1'   },
  { key: 'exercise', label: '運動', icon: '走', iconClass: 'exercise', unit: '分',     step: '1'   },
  { key: 'study',    label: '勉強', icon: '学', iconClass: 'study',    unit: '時間',   step: '0.5' },
];

let _visible = false;
let _dateStr = null;
let _values = {};

const Accumulation = {
  init(dateStr) {
    _dateStr = dateStr;
    _values = Storage.getAccumulationByDate(dateStr);
    _visible = false;
    this._updateDisplay();
  },

  toggle() {
    _visible = !_visible;
    const section = document.getElementById('accSection');
    if (section) section.style.display = _visible ? 'block' : 'none';
  },

  show() {
    _visible = true;
    const section = document.getElementById('accSection');
    if (section) section.style.display = 'block';
  },

  getValues() {
    return { ..._values };
  },

  getCount() {
    return Object.values(_values).filter((v) => v > 0).length;
  },

  /** acc-item クリック時のインライン編集 */
  editItem(itemEl, key) {
    const valWrap = itemEl.querySelector('.acc-val-wrap');
    const inp = itemEl.querySelector('.acc-input');
    if (!valWrap || !inp) return;
    valWrap.style.display = 'none';
    inp.style.display = 'block';
    inp.value = _values[key] || '';
    inp.focus();
    inp.select();

    const commit = () => {
      const v = parseFloat(inp.value) || 0;
      _values[key] = v;
      valWrap.querySelector('.acc-value').textContent = v;
      valWrap.style.display = '';
      inp.style.display = 'none';
    };
    inp.onblur = commit;
    inp.onkeydown = (e) => { if (e.key === 'Enter') inp.blur(); };
  },

  save(dateStr) {
    _dateStr = dateStr || _dateStr;
    Storage.setAccumulationByDate(_dateStr, _values);
  },

  _updateDisplay() {
    for (const cat of DEFAULT_CATEGORIES) {
      const valEl = document.querySelector(`.acc-value[data-key="${cat.key}"]`);
      if (valEl) valEl.textContent = _values[cat.key] || 0;
    }
  },

  getCategories() {
    const settings = Storage.getSettings();
    return [...DEFAULT_CATEGORIES, ...(settings.customCategories || [])];
  },
};

export { Accumulation, DEFAULT_CATEGORIES };
