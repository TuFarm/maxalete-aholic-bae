/* Trang quản trị: gửi thư, xem trạng thái đã đọc, chỉnh cài đặt và nội dung */

const $ = (id) => document.getElementById(id);

const EMOJIS = ['💌', '💗', '🌷', '🧋', '🌙', '☀️', '🎉', '🍀', '🐰', '📚'];

const SETTING_FIELDS = [
  { group: '💕 Tên gọi', fields: [
    ['herName', 'Tên của em', 'text', 20],
    ['hisName', 'Tên của anh', 'text', 20],
  ] },
  { group: '🍅 Pomodoro (phút)', fields: [
    ['focus', 'Học', 'number', 1, 120],
    ['short', 'Nghỉ ngắn', 'number', 1, 60],
    ['long', 'Nghỉ dài', 'number', 1, 60],
    ['longEvery', 'Nghỉ dài sau (phiên)', 'number', 2, 10],
    ['autoStart', 'Tự động chuyển phiên', 'checkbox'],
  ] },
  { group: '💌 Nhắc nhở', fields: [
    ['waterEvery', '💧 Uống nước mỗi (phút)', 'number', 10, 120],
    ['waterMl', 'Mỗi ly (ml)', 'number', 50, 1000],
    ['waterGoal', 'Mục tiêu (ly/ngày)', 'number', 1, 20],
    ['moveEvery', '🧘 Vận động mỗi (phút)', 'number', 15, 120],
    ['eyeEvery', '👀 Nghỉ mắt mỗi (phút)', 'number', 10, 60],
    ['eyeRest', 'Bật nhắc nghỉ mắt', 'checkbox'],
    ['sound', 'Phát chuông khi nhắc', 'checkbox'],
  ] },
];

const CONTENT_KINDS = [
  { kind: 'sweet', title: '🌸 Câu cổ vũ (hiện ở đầu trang và lúc nghỉ)' },
  { kind: 'note', title: '🫙 Lời nhắn trong "Hũ lời yêu"' },
  { kind: 'preset', title: '🎵 Nhạc mẫu — mỗi dòng: Tên | link YouTube hoặc ID' },
];

const Admin = {
  emoji: EMOJIS[0],

  // Xác thực bằng cookie đăng nhập; hết phiên thì quay về trang đăng nhập
  async request(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    if (!res) throw new Error('Không kết nối được server');
    if (res.status === 401 || res.status === 403) {
      location.href = '/login?need=admin&next=' + encodeURIComponent(location.pathname);
      throw new Error('Cần đăng nhập lại');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Có lỗi xảy ra');
    return data;
  },

  async logout() {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {});
    location.href = '/login';
  },

  async loadAll() {
    try {
      const { settings, items } = await this.request('/api/bootstrap');
      this.renderSettings(settings);
      this.renderContent(items);
    } catch (err) { toast(err.message); }
    this.loadSent();
  },

  // ----- Viết thư -----
  initCompose() {
    const pick = $('emojiPick');
    EMOJIS.forEach((e) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'preset' + (e === this.emoji ? ' active' : '');
      b.textContent = e;
      b.addEventListener('click', () => {
        this.emoji = e;
        pick.querySelectorAll('.preset').forEach((x) => x.classList.toggle('active', x === b));
      });
      pick.appendChild(b);
    });

    const newPin = () => { $('letterPin').value = String(Math.floor(1000 + Math.random() * 9000)); };
    newPin();
    $('newPin').addEventListener('click', newPin);

    const content = $('content');
    content.addEventListener('input', () => { $('charCount').textContent = `${content.value.length}/2000`; });
    document.querySelectorAll('input[name="when"]').forEach((r) => r.addEventListener('change', () => {
      $('showAt').disabled = r.value === 'now' && r.checked;
    }));

    $('composeForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const later = document.querySelector('input[name="when"]:checked').value === 'later';
      let showAt = null;
      if (later) {
        // datetime-local là giờ máy của anh; đổi sang mili-giây UTC để server không phải đoán múi giờ
        showAt = new Date($('showAt').value).getTime();
        if (!Number.isFinite(showAt)) { toast('Chọn thời gian hẹn gửi nha ⏰'); return; }
      }
      try {
        const pin = $('letterPin').value.trim();
        await this.request('/api/admin/messages', {
          method: 'POST',
          body: { content: content.value, emoji: this.emoji, showAt, pin, hint: $('pinHintInput').value },
        });
        content.value = '';
        $('pinHintInput').value = '';
        newPin();
        if (pin) toast(`🔑 Nhớ nhắn mã ${pin} cho em nha`, 8000);
        $('charCount').textContent = '0/2000';
        toast(later ? `⏰ Đã hẹn gửi lúc ${fmtDate(showAt)}` : '💌 Đã gửi! Em sẽ nhận được trong vòng 1 phút');
        this.loadSent();
      } catch (err) { toast(err.message); }
    });
  },

  // ----- Thư đã gửi -----
  async loadSent() {
    const box = $('sentList');
    try {
      const { messages } = await this.request('/api/admin/messages');
      box.innerHTML = messages.length ? '' : '<p class="hint">Chưa gửi thư nào.</p>';
      const now = Date.now();
      messages.forEach((m) => {
        const row = document.createElement('div');
        row.className = 'sent-item';
        const status = m.readAt ? `✅ Em đã đọc lúc ${fmtDate(m.readAt)}`
          : m.showAt > now ? `⏰ Hẹn gửi lúc ${fmtDate(m.showAt)}` : `📨 Đã gửi lúc ${fmtDate(m.showAt)} • chưa đọc`;
        row.innerHTML = '<span class="letter-emoji"></span><div class="sent-body"><p></p><small></small><div class="sent-meta"></div></div><button class="btn ghost tiny-del" title="Xoá">🗑</button>';
        row.querySelector('.letter-emoji').textContent = m.emoji;
        row.querySelector('p').textContent = m.content;
        row.querySelector('small').textContent = status;
        const meta = row.querySelector('.sent-meta');
        const tag = (text) => { const t = document.createElement('span'); t.textContent = text; meta.appendChild(t); };
        if (m.pin) {
          tag(`🔑 Mã: ${m.pin}`);
          tag(m.unlockedAt ? `🔓 Em mở khoá lúc ${fmtDate(m.unlockedAt)}` : '🔒 Chưa mở khoá');
          if (m.hint) tag(`💡 ${m.hint}`);
        }
        row.classList.toggle('read', Boolean(m.readAt));
        const del = row.querySelector('button');
        del.addEventListener('click', async () => {
          if (!del.dataset.confirm) { del.dataset.confirm = '1'; del.textContent = 'Xoá thật?'; return; }
          try { await this.request(`/api/admin/messages/${m.id}`, { method: 'DELETE' }); row.remove(); } catch (err) { toast(err.message); }
        });
        box.appendChild(row);
      });
    } catch (err) { box.innerHTML = ''; toast(err.message); }
  },

  // ----- Cài đặt -----
  renderSettings(settings) {
    const form = $('adminSettings');
    form.innerHTML = '';
    SETTING_FIELDS.forEach(({ group, fields }) => {
      const fs = document.createElement('fieldset');
      fs.innerHTML = `<legend>${group}</legend><div class="field-row"></div>`;
      const row = fs.querySelector('.field-row');
      fields.forEach(([name, label, type, a, b]) => {
        const l = document.createElement('label');
        if (type === 'checkbox') l.className = 'check';
        const input = document.createElement('input');
        input.name = name;
        input.type = type;
        if (type === 'checkbox') input.checked = Boolean(settings[name]);
        else {
          input.value = settings[name];
          if (type === 'number') { input.min = a; input.max = b; input.required = true; } else { input.maxLength = a; input.required = true; }
        }
        if (type === 'checkbox') l.append(input, ' ' + label); else l.append(label, input);
        row.appendChild(l);
      });
      form.appendChild(fs);
    });
    form.insertAdjacentHTML('beforeend', '<div class="modal-actions"><button class="btn primary" type="submit">Lưu cài đặt 💾</button></div>');
  },

  initSettings() {
    $('adminSettings').addEventListener('submit', async (e) => {
      e.preventDefault();
      const patch = {};
      for (const input of e.target.querySelectorAll('input')) {
        patch[input.name] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value.trim();
      }
      try {
        const { settings } = await this.request('/api/settings', { method: 'PUT', body: patch });
        this.renderSettings(settings);
        toast('💾 Đã lưu! Trang của em sẽ cập nhật trong vài phút (hoặc khi em mở lại tab)');
      } catch (err) { toast(err.message, 6000); }
    });
  },

  // ----- Nội dung -----
  renderContent(items) {
    const box = $('contentEditors');
    box.innerHTML = '';
    CONTENT_KINDS.forEach(({ kind, title }) => {
      const wrap = document.createElement('div');
      wrap.className = 'content-editor';
      wrap.innerHTML = `<h3></h3><textarea rows="7" class="letter-input"></textarea><div class="modal-actions"><button class="btn primary">Lưu 💾</button></div>`;
      wrap.querySelector('h3').textContent = title;
      const ta = wrap.querySelector('textarea');
      ta.value = kind === 'preset'
        ? items.preset.map((p) => `${p.name} | ${p.src}`).join('\n')
        : items[kind].join('\n');
      wrap.querySelector('button').addEventListener('click', async () => {
        const lines = ta.value.split('\n').map((l) => l.trim()).filter(Boolean);
        const list = kind === 'preset'
          ? lines.map((l) => {
            const i = l.lastIndexOf('|');
            return i < 0 ? { name: '🎵 ' + l, src: l } : { name: l.slice(0, i).trim(), src: l.slice(i + 1).trim() };
          })
          : lines;
        try {
          const res = await this.request(`/api/admin/items/${kind}`, { method: 'PUT', body: { items: list } });
          this.renderContent(res.items);
          toast('💾 Đã lưu nội dung');
        } catch (err) { toast(err.message, 6000); }
      });
      box.appendChild(wrap);
    });
  },

  init() {
    document.querySelectorAll('.admin-tabs .phase-tab').forEach((tab) => tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tabs .phase-tab').forEach((t) => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.tab-panel').forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
      if (tab.dataset.tab === 'sent') this.loadSent();
    }));
    $('logoutBtn').addEventListener('click', () => this.logout());
    $('reloadSent').addEventListener('click', () => this.loadSent());
    this.initCompose();
    this.initSettings();
    this.loadAll();
  },
};

function fmtDate(ms) {
  return new Date(ms).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

document.addEventListener('DOMContentLoaded', () => Admin.init());
