import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = readFileSync('js/photo.js', 'utf8').replace('export { Photo };', '');
function setup({ canvasError = false, canvasResult = 'data:image/jpeg;base64,compressed' } = {}) {
  const readers = [], images = [], draws = [];
  const elements = {
    photoPreview: { style: {} }, photoImg: {}, photoInput: { value: 'selected' },
  };
  class FileReader {
    constructor() { readers.push(this); }
    readAsDataURL(file) { this.file = file; }
  }
  class Image {
    constructor() { images.push(this); this.width = 1600; this.height = 1200; }
  }
  const canvas = {
    getContext: () => ({ drawImage(...args) { draws.push(args); } }),
    toDataURL(type, quality) {
      assert.equal(type, 'image/jpeg'); assert.equal(quality, 0.7);
      if (canvasError) throw Error('out of memory');
      return canvasResult;
    },
  };
  const document = {
    getElementById: id => elements[id],
    createElement: tag => { assert.equal(tag, 'canvas'); return canvas; },
  };
  const photo = runInNewContext(source + ';Photo', { FileReader, Image, document });
  const load = (index = readers.length - 1) => readers[index].onload({ target: { result: 'data:image/png;base64,input' } });
  return { photo, readers, images, elements, canvas, draws, load };
}

test('valid photo is compressed to 800px and marked as a new attachment', async () => {
  const h = setup();
  const pending = h.photo.handleFileInput({ name: 'photo.png' });
  h.load(); h.images[0].onload();
  assert.equal(await pending, 'data:image/jpeg;base64,compressed');
  assert.equal(h.photo.getCurrentBase64(), await pending);
  assert.equal(h.photo.isNew(), true);
  assert.equal(h.canvas.width, 800); assert.equal(h.canvas.height, 600);
  assert.equal(h.elements.photoPreview.style.display, 'block');
});

for (const failure of ['read', 'abort', 'decode', 'canvas', 'empty encoding']) {
  test(`${failure} failure rejects and keeps the existing photo`, async () => {
    const h = setup({ canvasError: failure === 'canvas', canvasResult: failure === 'empty encoding' ? 'data:,' : undefined });
    h.photo.loadExisting('data:image/jpeg;base64,original');
    const pending = h.photo.handleFileInput({});
    const rejection = assert.rejects(pending, /写真|画像/);
    if (failure === 'read') h.readers[0].onerror();
    else if (failure === 'abort') h.readers[0].onabort();
    else {
      h.load();
      if (failure === 'decode') h.images[0].onerror();
      else h.images[0].onload();
    }
    await rejection;
    assert.equal(h.photo.getCurrentBase64(), 'data:image/jpeg;base64,original');
    assert.equal(h.photo.isNew(), false);
    assert.equal(h.elements.photoImg.src, 'data:image/jpeg;base64,original');
  });
}

for (const action of ['remove', 'reset', 'loadExisting']) {
  test(`${action} invalidates an image that is still decoding`, async () => {
    const h = setup();
    const pending = h.photo.handleFileInput({}); h.load();
    h.photo[action]('data:image/jpeg;base64,other-entry');
    h.images[0].onload();
    assert.equal(await pending, null);
    assert.equal(h.photo.getCurrentBase64(), action === 'loadExisting' ? 'data:image/jpeg;base64,other-entry' : null);
    assert.equal(h.photo.isNew(), false);
  });
}

test('newer selection wins even if the earlier photo finishes last', async () => {
  const h = setup();
  const first = h.photo.handleFileInput({ name: 'first' }); h.load();
  const second = h.photo.handleFileInput({ name: 'second' }); h.load();
  h.images[1].onload(); await second;
  const selected = h.photo.getCurrentBase64();
  h.images[0].onload();
  assert.equal(await first, null);
  assert.equal(h.photo.getCurrentBase64(), selected);
  assert.equal(h.draws.length, 1);
});

test('stale file read and stale errors do not overwrite or alert on another entry', async () => {
  const h = setup();
  const first = h.photo.handleFileInput({});
  h.photo.reset(); h.load();
  assert.equal(await first, null); assert.equal(h.images.length, 0);
  const second = h.photo.handleFileInput({});
  h.photo.loadExisting('other-entry'); h.readers[1].onerror();
  assert.equal(await second, null); assert.equal(h.photo.getCurrentBase64(), 'other-entry');
});

test('invalid dimensions fail without replacing existing state', async () => {
  const h = setup(); h.photo.loadExisting('original');
  const pending = h.photo.handleFileInput({});
  const rejection = assert.rejects(pending, /写真/);
  h.load(); h.images[0].width = 0; h.images[0].onload();
  await rejection; assert.equal(h.photo.getCurrentBase64(), 'original');
});

test('extreme aspect ratio still produces a nonzero canvas', async () => {
  const h = setup(); const pending = h.photo.handleFileInput({});
  h.load(); h.images[0].width = 10000; h.images[0].height = 1; h.images[0].onload();
  await pending; assert.equal(h.canvas.height, 1);
});

test('cancelled file picker does not replace or clear an existing photo', () => {
  const h = setup(); h.photo.loadExisting('original');
  assert.equal(h.photo.handleFileInput(undefined), undefined);
  assert.equal(h.photo.getCurrentBase64(), 'original');
  assert.equal(h.readers.length, 0);
});


test('file input reports failures and clears the picker for retry', async () => {
  const app = readFileSync('js/app.js', 'utf8');
  const marker = "document.getElementById('photoInput')?.addEventListener('change', ";
  const start = app.indexOf(marker) + marker.length;
  const end = app.indexOf('\n  });', start);
  const calls = [], messages = [];
  const handler = runInNewContext('(' + app.slice(start, end) + '\n  })', {
    Photo: { handleFileInput: async file => { calls.push(file); throw Error('読み込み失敗'); } },
    showToast: (...args) => messages.push(args),
  });
  const file = { name: 'broken.png' };
  const event = { target: { files: [file], value: 'selected' } };
  await handler(event);
  assert.equal(event.target.value, '');
  assert.equal(calls[0], file);
  assert.equal(messages[0][0], '⚠️ 読み込み失敗');
});


test('only explicit removal marks a saved photo for deletion', async () => {
  const h = setup(); h.photo.loadExisting('data:image/jpeg;base64,saved');
  assert.equal(h.photo.isRemoved(), false);
  const pending = h.photo.handleFileInput({});
  assert.equal(h.photo.isRemoved(), false);
  h.load(); h.images[0].onerror(); await assert.rejects(pending);
  assert.equal(h.photo.isRemoved(), false);
  h.photo.remove(); assert.equal(h.photo.isRemoved(), true);
  h.photo.reset(); assert.equal(h.photo.isRemoved(), false);
  h.photo.remove(); h.photo.loadExisting('data:image/jpeg;base64,other');
  assert.equal(h.photo.isRemoved(), false);
  h.photo.remove(); const next=h.photo.handleFileInput({});h.load();h.images[1].onload();await next;
  assert.equal(h.photo.isRemoved(), false);
});

test('save routes deletion only through the explicit removal flag', () => {
  const app = readFileSync('js/app.js', 'utf8');
  assert.match(app, /else if \(Photo\.isRemoved\(\)\)\s*\{[\s\S]*?Storage\.removePhoto\(dateStr\)/);
});
