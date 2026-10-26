/* Hộp thư hai chiều: nhận thư người kia gửi, viết thư (có mã PIN, hẹn giờ), xem thư mình đã gửi */

const LETTER_EMOJIS = ['💌', '💗', '🌷', '🧋', '🌙', '☀️', '🎉', '🍀', '🐰', '🐻', '📚'];

const Mailbox = {
  messages: [],
  announced: new Set(),
  // Thư khoá em bấm "Để sau": không tự bật lại nữa, em tự mở trong hộp thư khi có mã
  dismissed: new Set(Store.get('dismissedLetters', [])),
  // Thư đến lúc đang học, chờ tới giờ nghỉ mới mở
  pendingIds: new Set(),
  POLL_MS: 60000,

  unread() { return this.messages.filter((m) => !m.readAt); },

  async refresh() {
    if (!Api.online) return;
    try {
      const { messages } = await Api.messages();
      this.messages = messages;
      this.render();
      this.announceNew();
    } catch { /* mạng chập chờn, lần sau thử lại */ }
  },

  // Có thư mới: đang học thì chỉ báo nhẹ, còn lại mở thư luôn
  announceNew() {
    const fresh = this.unread().filter((m) => !this.announced.has(m.id) && !this.dismissed.has(m.id));
    if (!fresh.length) return;
    fresh.forEach((m) => this.announced.add(m.id));
    const peer = Me.peerName;
    Sound.play('soft');
    Notify.send(`💌 ${peer} vừa gửi thư cho ${Me.you}`, 'Mở app ra đọc nha!');
    if (Timer.state.running && Timer.state.phase === 'focus') {
      toast(`💌 ${peer} vừa gửi thư mới, tới giờ nghỉ mở xem nha!`, 7000);
      fresh.forEach((m) => this.pendingIds.add(m.id));
      return;
    }
    this.openOldest(fresh);
  },

  // Mở thư cũ nhất trong danh sách; các thư còn lại nằm trong hộp thư
  openOldest(list) {
    const oldest = list.at(-1);
    if (oldest) this.open(oldest);
  },

  dismiss(m) {
    this.dismissed.add(m.id);
    Store.set('dismissedLetters', [...this.dismissed].slice(-200));
  },

  open(m) {
    if (m.locked) this.askPin(m); else Popup.show(this.letterPopup(m));
  },

  letterPopup(m) {
    return {
      emoji: m.emoji || '💌',
      title: `Thư từ ${Me.peerName}`,
      text: m.content,
      sweet: this.fmtDate(m.showAt),
      actions: [{
        label: 'Thương lắm 💗', primary: true,
        onClick: () => {
          if (m.readAt) return;
          m.readAt = Date.now();
          this.render();
          Api.markRead(m.id).catch(() => {});
        },
      }],
    };
  },

  // Thư có mã PIN: mở khoá 1 lần, server ghi nhớ nên lần sau (kể cả máy khác) không cần nhập lại
  askPin(m) {
    Popup.show({
      emoji: '🔒',
      title: 'Thư này có khoá nè',
      html: `<p>Nhập mã ${Me.peerName} đã cho ${Me.you} để mở thư nha 💕</p>`
        + '<p class="pin-hint" id="pinHint" hidden></p>'
        + '<input id="letterPin" class="pin-input" type="password" maxlength="20" autocomplete="off">'
        + '<p class="login-error" id="pinError" role="alert"></p>',
      actions: [
        { label: 'Để sau', onClick: () => this.dismiss(m) },
        { label: 'Mở khoá 🔓', primary: true, keepOpen: true, onClick: (btn) => this.unlock(m, btn) },
      ],
      onShow: (box) => {
        const hint = box.querySelector('#pinHint');
        if (m.hint) { hint.textContent = `💡 Gợi ý: ${m.hint}`; hint.hidden = false; }
        const input = box.querySelector('#letterPin');
        input.focus();
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') box.querySelector('#modalActions .primary').click();
        });
      },
    });
  },

  async unlock(m, btn) {
    const input = document.getElementById('letterPin');
    const error = document.getElementById('pinError');
    if (!input.value.trim()) { error.textContent = `${cap(Me.you)} chưa nhập mã nè`; return; }
    btn.disabled = true;
    try {
      const { message } = await Api.unlock(m.id, input.value.trim());
      Object.assign(m, message);
      this.render();
      Sound.play('done');
      Popup.replace(this.letterPopup(m));
    } catch (err) {
      error.textContent = err.message;
      input.select();
    } finally {
      btn.disabled = false;
    }
  },

  fmtDate(ms) {
    return new Date(ms).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  render() {
    const section = document.getElementById('mailbox');
    section.hidden = !Api.online;
    const list = document.getElementById('letterList');
    const unread = this.unread().length;
    document.getElementById('mailChip').textContent = unread ? `${unread} thư chưa đọc` : 'Đã đọc hết';
    document.getElementById('mailChip').classList.toggle('soft', !unread);
    list.innerHTML = '';
    if (!this.messages.length) {
      list.innerHTML = '<p class="hint">Chưa có thư nào, chờ chút nha 💭</p>';
      return;
    }
    this.messages.forEach((m) => {
      const card = document.createElement('button');
      card.className = 'letter-card' + (m.readAt ? '' : ' unread');
      const emoji = document.createElement('span');
      emoji.className = 'letter-emoji';
      emoji.textContent = m.emoji || '💌';
      const body = document.createElement('span');
      body.className = 'letter-body';
      const preview = document.createElement('span');
      preview.className = 'letter-preview';
      if (m.locked) {
        card.classList.add('locked');
        preview.textContent = '🔒 Thư bí mật, cần mã để mở' + (m.hint ? ` (gợi ý: ${m.hint})` : '');
      } else {
        preview.textContent = m.content.length > 70 ? m.content.slice(0, 70) + '…' : m.content;
      }
      const date = document.createElement('small');
      date.textContent = this.fmtDate(m.showAt) + (m.readAt ? '' : ' • Mới');
      body.append(preview, date);
      card.append(emoji, body);
      card.addEventListener('click', () => this.open(m));
      list.appendChild(card);
    });
  },

  // ---------- Viết thư & thư đã gửi ----------

  tab: 'inbox',
  emoji: LETTER_EMOJIS[0],

  showTab(name) {
    this.tab = name;
    document.querySelectorAll('.mail-tabs .phase-tab').forEach((t) => {
      const on = t.dataset.mail === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });
    document.querySelectorAll('[data-mail-panel]').forEach((p) => { p.hidden = p.dataset.mailPanel !== name; });
    if (name === 'sent') this.loadSent();
    if (name === 'compose') document.getElementById('mailContent').focus({ preventScroll: true });
  },

  newPin() { document.getElementById('mailPin').value = String(Math.floor(1000 + Math.random() * 9000)); },

  initCompose() {
    const $ = (id) => document.getElementById(id);
    const pick = $('mailEmoji');
    LETTER_EMOJIS.forEach((e) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'preset' + (e === this.emoji ? ' active' : '');
      b.textContent = e;
      b.setAttribute('aria-label', `Dán sticker ${e}`);
      b.setAttribute('aria-pressed', String(e === this.emoji));
      b.addEventListener('click', () => {
        this.emoji = e;
        pick.querySelectorAll('.preset').forEach((x) => {
          x.classList.toggle('active', x === b);
          x.setAttribute('aria-pressed', String(x === b));
        });
      });
      pick.appendChild(b);
    });
    this.newPin();
    $('mailNewPin').addEventListener('click', () => this.newPin());
    const content = $('mailContent');
    content.addEventListener('input', () => { $('mailCount').textContent = `${content.value.length}/2000`; });
    document.querySelectorAll('input[name="mailWhen"]').forEach((r) => r.addEventListener('change', () => {
      $('mailShowAt').disabled = document.querySelector('input[name="mailWhen"]:checked').value === 'now';
    }));

    $('mailCompose').addEventListener('submit', async (e) => {
      e.preventDefault();
      const later = document.querySelector('input[name="mailWhen"]:checked').value === 'later';
      let showAt = null;
      if (later) {
        // datetime-local là giờ máy; đổi sang mili-giây UTC để server không phải đoán múi giờ
        showAt = new Date($('mailShowAt').value).getTime();
        if (!Number.isFinite(showAt)) { toast('Chọn thời gian hẹn gửi nha ⏰'); return; }
      }
      const btn = $('mailSend');
      btn.disabled = true;
      try {
        const pin = $('mailPin').value.trim();
        await Api.sendLetter({ content: content.value, emoji: this.emoji, showAt, pin, hint: $('mailHint').value });
        content.value = '';
        $('mailHint').value = '';
        $('mailCount').textContent = '0/2000';
        this.newPin();
        Sound.play('done');
        toast(later ? `⏰ Đã hẹn gửi lúc ${this.fmtDate(showAt)}` : `💌 Đã gửi! ${cap(Me.they)} sẽ nhận được trong vòng 1 phút`);
        if (pin) toast(`🔑 Nhớ nhắn mã ${pin} cho ${Me.they} nha`, 8000);
        this.showTab('sent');
      } catch (err) {
        toast(err.message, 6000);
      } finally {
        btn.disabled = false;
      }
    });
  },

  async loadSent() {
    const box = document.getElementById('mailSent');
    try {
      const { messages } = await Api.sentLetters();
      this.renderSent(messages);
    } catch (err) {
      box.replaceChildren();
      toast(err.message);
    }
  },

  renderSent(messages) {
    const box = document.getElementById('mailSent');
    if (!messages.length) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = `${cap(Me.you)} chưa gửi thư nào cho ${Me.they}. Viết thử một lá nha ✏️`;
      box.replaceChildren(p);
      return;
    }
    const now = Date.now();
    const they = cap(Me.they);
    box.replaceChildren(...messages.map((m) => {
      const row = document.createElement('div');
      row.className = 'sent-item' + (m.readAt ? ' read' : '');
      const emoji = document.createElement('span');
      emoji.className = 'letter-emoji';
      emoji.textContent = m.emoji;
      const body = document.createElement('div');
      body.className = 'sent-body';
      const text = document.createElement('p');
      text.textContent = m.content;
      const status = document.createElement('small');
      status.textContent = m.readAt ? `✅ ${they} đã đọc lúc ${this.fmtDate(m.readAt)}`
        : m.showAt > now ? `⏰ Hẹn gửi lúc ${this.fmtDate(m.showAt)}` : `📨 Đã gửi lúc ${this.fmtDate(m.showAt)} • chưa đọc`;
      const meta = document.createElement('div');
      meta.className = 'sent-meta';
      const tag = (t) => { const x = document.createElement('span'); x.textContent = t; meta.appendChild(x); };
      if (m.pin) {
        tag(`🔑 Mã: ${m.pin}`);
        tag(m.unlockedAt ? `🔓 ${they} mở khoá lúc ${this.fmtDate(m.unlockedAt)}` : '🔒 Chưa mở khoá');
        if (m.hint) tag(`💡 ${m.hint}`);
      }
      body.append(text, status, meta);
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn ghost tiny-del';
      del.textContent = '🗑';
      del.title = 'Xoá thư';
      del.setAttribute('aria-label', 'Xoá thư này');
      del.addEventListener('click', async () => {
        if (!del.dataset.confirm) { del.dataset.confirm = '1'; del.textContent = 'Xoá thật?'; return; }
        try { await Api.deleteLetter(m.id); row.remove(); } catch (err) { toast(err.message); }
      });
      row.append(emoji, body, del);
      return row;
    }));
  },

  init() {
    this.render();
    if (!Api.online) return;
    document.getElementById('mailContent').placeholder = `Viết gì đó thật ngọt ngào cho ${Me.they}…`;
    document.getElementById('mailHintLabel').textContent = `💡 Gợi ý cho ${Me.they} (tuỳ chọn)`;
    document.querySelectorAll('.mail-tabs .phase-tab').forEach((t) => t.addEventListener('click', () => this.showTab(t.dataset.mail)));
    this.initCompose();
    this.refresh();
    setInterval(() => this.refresh(), this.POLL_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.refresh(); });
    // Thư đến lúc đang học sẽ được mở khi bắt đầu giờ nghỉ
    document.addEventListener('timer:phaseend', ({ detail }) => {
      if (detail.to === 'focus' || !this.pendingIds.size) return;
      const list = this.unread().filter((m) => this.pendingIds.has(m.id) && !this.dismissed.has(m.id));
      this.pendingIds.clear();
      this.openOldest(list);
    });
  },
};
