/**
 * photo.js — 写真添付・Canvas圧縮（max 800px, JPEG q=0.7）
 */

const MAX_PX = 800;
const QUALITY = 0.7;

let _currentBase64 = null;
let _isNew = false;
let _isRemoved = false;
let _selectionId = 0;

const Photo = {
  getCurrentBase64() {
    return _currentBase64;
  },
  isNew() {
    return _isNew;
  },

  isRemoved() { return _isRemoved; },

  /** input[type=file] の change から呼ぶ */
  handleFileInput(file) {
    if (!file) return;
    const selectionId = ++_selectionId;
    return new Promise((resolve, reject) => {
      const isCurrent = () => selectionId === _selectionId;
      const fail = (message) => {
        if (isCurrent()) reject(new Error(message));
        else resolve(null);
      };
      const reader = new FileReader();
      reader.onerror = () => fail('写真を読み込めませんでした。もう一度選び直してください。');
      reader.onabort = () => fail('写真の読み込みが中断されました。');
      reader.onload = (e) => {
        if (!isCurrent()) { resolve(null); return; }
        const img = new Image();
        img.onerror = () => fail('この写真は開けませんでした。別の画像を選んでください。');
        img.onload = () => {
          if (!isCurrent()) { resolve(null); return; }
          try {
            const base64 = this._compress(img);
            _currentBase64 = base64;
            _isNew = true;
            _isRemoved = false;
            this._showPreview(base64);
            resolve(base64);
          } catch {
            fail('写真を処理できませんでした。小さい画像で試してください。');
          }
        };
        img.src = e.target.result;
      };
      try {
        reader.readAsDataURL(file);
      } catch {
        fail('写真を読み込めませんでした。もう一度選び直してください。');
      }
    });
  },

  /** 既存データを読み込んで表示する */
  loadExisting(base64) {
    _selectionId += 1;
    _currentBase64 = base64 || null;
    _isNew = false;
    _isRemoved = false;
    if (base64) {
      this._showPreview(base64);
    } else {
      this._hidePreview();
    }
  },

  remove() {
    _selectionId += 1;
    _currentBase64 = null;
    _isNew = false;
    _isRemoved = true;
    this._hidePreview();
    const input = document.getElementById('photoInput');
    if (input) input.value = '';
  },

  reset() {
    _selectionId += 1;
    _currentBase64 = null;
    _isNew = false;
    _isRemoved = false;
    this._hidePreview();
    const input = document.getElementById('photoInput');
    if (input) input.value = '';
  },

  _compress(img) {
    const canvas = document.createElement('canvas');
    let { width, height } = img;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error('Invalid image dimensions');
    }
    if (width > MAX_PX || height > MAX_PX) {
      if (width > height) {
        height = Math.max(1, Math.round((height * MAX_PX) / width));
        width = MAX_PX;
      } else {
        width = Math.max(1, Math.round((width * MAX_PX) / height));
        height = MAX_PX;
      }
    }
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.drawImage(img, 0, 0, width, height);
    const result = canvas.toDataURL('image/jpeg', QUALITY);
    if (!result.startsWith('data:image/')) throw new Error('Image encoding failed');
    return result;
  },

  _showPreview(base64) {
    const preview = document.getElementById('photoPreview');
    const imgEl = document.getElementById('photoImg');
    if (preview && imgEl) {
      imgEl.src = base64;
      preview.style.display = 'block';
    }
  },

  _hidePreview() {
    const preview = document.getElementById('photoPreview');
    if (preview) preview.style.display = 'none';
  },
};

export { Photo };
