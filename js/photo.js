/**
 * photo.js — 写真添付・Canvas圧縮（max 800px, JPEG q=0.7）
 */

const MAX_PX = 800;
const QUALITY = 0.7;

let _currentBase64 = null;
let _isNew = false;

const Photo = {
  getCurrentBase64() {
    return _currentBase64;
  },
  isNew() {
    return _isNew;
  },

  /** input[type=file] の change から呼ぶ */
  handleFileInput(file) {
    if (!file) return;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const base64 = this._compress(img);
          _currentBase64 = base64;
          _isNew = true;
          this._showPreview(base64);
          resolve(base64);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  /** 既存データを読み込んで表示する */
  loadExisting(base64) {
    _currentBase64 = base64 || null;
    _isNew = false;
    if (base64) {
      this._showPreview(base64);
    } else {
      this._hidePreview();
    }
  },

  remove() {
    _currentBase64 = null;
    _isNew = false;
    this._hidePreview();
    const input = document.getElementById('photoInput');
    if (input) input.value = '';
  },

  reset() {
    _currentBase64 = null;
    _isNew = false;
    this._hidePreview();
    const input = document.getElementById('photoInput');
    if (input) input.value = '';
  },

  _compress(img) {
    const canvas = document.createElement('canvas');
    let { width, height } = img;
    if (width > MAX_PX || height > MAX_PX) {
      if (width > height) {
        height = Math.round((height * MAX_PX) / width);
        width = MAX_PX;
      } else {
        width = Math.round((width * MAX_PX) / height);
        height = MAX_PX;
      }
    }
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', QUALITY);
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
