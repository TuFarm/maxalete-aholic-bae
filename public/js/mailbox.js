/* Hộp thư: nhận lời chúc anh gửi từ trang quản trị */

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
    const his = Settings.data.hisName;
    Sound.play('soft');
    Notify.send(`💌 ${his} vừa gửi thư cho em`, 'Mở app ra đọc nha!');
    if (Timer.state.running && Timer.state.phase === 'focus') {
      toast(`💌 ${his} vừa gửi thư mới, tới giờ nghỉ mở xem nha!`, 7000);
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
      title: `Thư từ ${Settings.data.hisName}`,
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
      html: `<p>Nhập mã ${Settings.data.hisName} đã cho em để mở thư nha 💕</p>`
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
    if (!input.value.trim()) { error.textContent = 'Em chưa nhập mã nè'; return; }
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

  init() {
    this.render();
    if (!Api.online) return;
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
