/* Trò chuyện hai chiều + phiếu hẹn. Dùng chung: ngăn kéo trên trang của em, tab "Trò chuyện" trong /admin.
   Người gửi do server xác định theo phiên đăng nhập (admin = anh, viewer = em). */

const CHAT_ICONS = {
  send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12 3 4.8a.8.8 0 0 1 1.1-.9l16 7.4a.8.8 0 0 1 0 1.4l-16 7.4a.8.8 0 0 1-1.1-.9L4.5 12Zm0 0H11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ticket: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h14a1.5 1.5 0 0 1 1.5 1.5v2a2.5 2.5 0 0 0 0 5v2A1.5 1.5 0 0 1 19 18H5a1.5 1.5 0 0 1-1.5-1.5v-2a2.5 2.5 0 0 0 0-5v-2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 6.5v11" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2.2"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  bubble: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4c4.7 0 8.5 3 8.5 6.8s-3.8 6.8-8.5 6.8c-.9 0-1.8-.1-2.6-.3L5 19.5l1-3.6C4.5 14.6 3.5 12.8 3.5 10.8 3.5 7 7.3 4 12 4Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 13.6s-3-1.8-3-3.6a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 1.8-3 3.6-3 3.6Z" fill="currentColor"/></svg>',
};

const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const CLUSTER_MS = 5 * 60000;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const ChatTime = {
  clock(ms) { return new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); },
  dayStart(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); },
  day(ms) {
    const diff = Math.round((this.dayStart(Date.now()) - this.dayStart(ms)) / 86400000);
    if (diff === 0) return 'Hôm nay';
    if (diff === 1) return 'Hôm qua';
    const d = new Date(ms);
    const wd = d.toLocaleDateString('vi-VN', { weekday: 'long' });
    return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${d.getDate()}/${d.getMonth() + 1}`;
  },
  short(ms) {
    const d = new Date(ms);
    return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1} · ${this.clock(ms)}`;
  },
  // "còn 2 ngày", "còn 3 giờ", "còn 20 phút"
  until(ms) {
    const diff = ms - Date.now();
    if (diff <= 0) return 'đã qua';
    const days = Math.round((this.dayStart(ms) - this.dayStart(Date.now())) / 86400000);
    if (days >= 1) return days === 1 ? 'ngày mai' : `còn ${days} ngày`;
    const h = Math.floor(diff / 3600000);
    return h >= 1 ? `còn ${h} giờ` : `còn ${Math.max(1, Math.round(diff / 60000))} phút`;
  },
  // Giá trị cho <input type="datetime-local"> theo giờ máy
  local(ms) {
    const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
  },
};

const Chat = {
  opts: null,
  rows: new Map(),
  outbox: [],
  stamped: new Set(),
  loaded: false,
  lastId: 0,
  firstId: 0,
  more: false,
  me: null,
  seen: 0,
  peerSeen: 0,
  unread: 0,
  upcoming: [],
  timer: null,
  rescheduleOf: null,
  outboxSeq: 0,

  peer() { return this.me === 'anh' ? 'em' : 'anh'; },
  name(who) {
    const s = Settings.data;
    return who === 'anh' ? (s.hisName || 'Anh') : (s.herName || 'Em');
  },
  visible() { return !document.hidden && this.opts.isVisible(); },

  async request(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    if (!res) throw new Error('Mất kết nối rồi, thử lại sau chút nha');
    if (res.status === 401) {
      const admin = location.pathname.startsWith('/admin');
      location.href = `/login?${admin ? 'need=admin&' : ''}next=${encodeURIComponent(location.pathname + location.search)}`;
      throw new Error('Cần đăng nhập lại');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error(data?.error || 'Có lỗi xảy ra, thử lại nha');
    return data;
  },

  // ---------- Dựng khung ----------

  mount(root, opts) {
    this.opts = { quiet: () => false, onUnread: () => {}, onClose: null, ...opts };
    root.classList.add('chat', `chat-${opts.mode}`);
    root.innerHTML = `
      <header class="chat-head">
        <h2 class="chat-title"></h2>
        ${opts.onClose ? `<button type="button" class="chat-icon-btn chat-close" aria-label="Đóng">${CHAT_ICONS.close}</button>` : ''}
      </header>
      <div class="chat-upcoming" hidden>
        <span class="chat-upcoming-label">📌 Sắp tới</span>
        <ul class="chat-upcoming-list"></ul>
      </div>
      <div class="chat-scroll" tabindex="0">
        <button type="button" class="btn tiny chat-more" hidden>Xem tin cũ hơn</button>
        <div class="chat-empty" hidden>
          <p class="chat-empty-line"></p>
          <p class="chat-empty-hint">Bấm nút phiếu hẹn bên cạnh ô nhắn để rủ đi chơi nha.</p>
        </div>
        <ol class="chat-list" role="log" aria-label="Tin nhắn"></ol>
      </div>
      <form class="chat-date-form" hidden>
        <div class="chat-date-head">
          <h3 class="chat-date-title">Rủ đi chơi</h3>
          <button type="button" class="chat-icon-btn chat-date-cancel" aria-label="Huỷ phiếu hẹn">${CHAT_ICONS.close}</button>
        </div>
        <label class="chat-field">Đi đâu, làm gì
          <input name="place" maxlength="80" required autocomplete="off" placeholder="Trà sữa, xem phim, dạo hồ…">
        </label>
        <label class="chat-field">Khi nào
          <input name="at" type="datetime-local" required>
        </label>
        <label class="chat-field"><span>Ghi chú <span class="chat-optional">(tuỳ chọn)</span></span>
          <input name="note" maxlength="200" autocomplete="off">
        </label>
        <p class="chat-error" role="alert"></p>
        <div class="chat-date-actions">
          <button type="submit" class="btn primary">Gửi phiếu hẹn</button>
        </div>
      </form>
      <form class="chat-compose">
        <button type="button" class="chat-icon-btn chat-date-btn" aria-label="Tạo phiếu hẹn" title="Rủ đi chơi">${CHAT_ICONS.ticket}</button>
        <label class="chat-input-wrap">
          <span class="sr-only">Tin nhắn</span>
          <textarea class="chat-input" rows="1" maxlength="1000"></textarea>
          <span class="chat-count" aria-live="polite"></span>
        </label>
        <button type="submit" class="chat-send" aria-label="Gửi" disabled>${CHAT_ICONS.send}</button>
      </form>`;

    const q = (s) => root.querySelector(s);
    this.root = root;
    this.els = {
      title: q('.chat-title'), upcoming: q('.chat-upcoming'), upList: q('.chat-upcoming-list'),
      scroll: q('.chat-scroll'), list: q('.chat-list'), more: q('.chat-more'),
      empty: q('.chat-empty'), emptyLine: q('.chat-empty-line'),
      dateForm: q('.chat-date-form'), dateTitle: q('.chat-date-title'), dateError: q('.chat-date-form .chat-error'),
      compose: q('.chat-compose'), input: q('.chat-input'), count: q('.chat-count'), send: q('.chat-send'),
    };
    this.bind();
    this.renderNames();
    document.addEventListener('settings:changed', () => { this.renderNames(); this.render(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.poll(); else this.schedule(); });
    // Mỗi phút vẽ lại để đếm ngược, "Hôm nay" và phiếu quá giờ luôn đúng khi trang mở cả ngày
    setInterval(() => { if (this.loaded && !document.hidden) this.render(); }, 60000);
    this.poll();
  },

  bind() {
    const { input, compose, send, dateForm, more } = this.els;
    const resize = () => {
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
      input.style.overflowY = input.scrollHeight > 132 ? 'auto' : 'hidden';
      const n = input.value.length;
      this.els.count.textContent = n > 850 ? `${n}/1000` : '';
      send.disabled = !input.value.trim();
    };
    input.addEventListener('input', resize);
    input.addEventListener('keydown', (e) => {
      // Bỏ qua khi bộ gõ tiếng Việt (Unikey/Telex) còn đang ghép chữ
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      compose.requestSubmit();
    });
    compose.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      resize();
      this.sendText(text);
    });
    this.root.querySelector('.chat-date-btn').addEventListener('click', () => this.openDateForm());
    this.root.querySelector('.chat-date-cancel').addEventListener('click', () => this.closeDateForm());
    dateForm.addEventListener('submit', (e) => { e.preventDefault(); this.sendDate(); });
    dateForm.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); this.closeDateForm(); } });
    more.addEventListener('click', () => this.loadOlder());
    this.root.querySelector('.chat-close')?.addEventListener('click', () => this.opts.onClose());
  },

  renderNames() {
    const peer = this.me ? this.peer() : (location.pathname.startsWith('/admin') ? 'em' : 'anh');
    this.els.title.textContent = `Nhắn với ${this.name(peer)}`;
    this.els.input.placeholder = `Nhắn cho ${this.name(peer)}…`;
    this.els.emptyLine.textContent = Settings.data.chatHello || 'Chưa có tin nhắn nào. Viết dòng đầu tiên nha ✏️';
  },

  // Gọi khi khung chat vừa hiện ra (mở ngăn kéo / chọn tab)
  shown() {
    this.scrollToEnd();
    this.markSeen();
    this.poll();
  },

  // ---------- Đồng bộ với server ----------

  schedule() {
    clearTimeout(this.timer);
    const ms = document.hidden ? 60000 : this.opts.isVisible() ? 5000 : 15000;
    this.timer = setTimeout(() => this.poll(), ms);
  },

  async poll() {
    clearTimeout(this.timer);
    if (this.polling) return;
    this.polling = true;
    try {
      const data = await this.request(this.loaded ? `/api/chat?after=${this.lastId}` : '/api/chat');
      const first = !this.loaded;
      this.loaded = true;
      if (first) this.more = data.more;
      const size = this.rows.size;
      const fresh = this.merge(data.chats, !first);
      this.applyState(data);
      if (first) { this.renderNames(); this.render(); this.scrollToEnd(); } else if (this.rows.size !== size || this.stateChanged) this.render();
      if (fresh.length) this.announce(fresh);
      this.markSeen();
    } catch { /* mạng chập chờn, lần sau thử lại */ }
    this.polling = false;
    this.schedule();
  },

  async loadOlder() {
    if (!this.firstId) return;
    const { scroll, more } = this.els;
    more.disabled = true;
    try {
      const data = await this.request(`/api/chat?before=${this.firstId}`);
      const prevHeight = scroll.scrollHeight;
      this.merge(data.chats, false);
      this.more = data.more;
      this.render();
      scroll.scrollTop += scroll.scrollHeight - prevHeight;
    } catch (err) { toast(err.message); }
    more.disabled = false;
  },

  // Gộp dòng từ server; trả về các dòng mới của người kia (để báo)
  merge(list, live) {
    const fresh = [];
    for (const r of list) {
      if (r.kind === 'reply') {
        const card = this.rows.get(r.refId);
        if (card && !this.rows.has(r.id)) {
          card.status = r.body;
          if (live && r.body === 'accepted') this.stamped.add(card.id);
        }
      }
      if (live && !this.rows.has(r.id) && r.sender !== this.me) fresh.push(r);
      this.rows.set(r.id, r);
      if (!this.firstId || r.id < this.firstId) this.firstId = r.id;
    }
    // Chỉ dời con trỏ poll theo dữ liệu đọc từ server, không theo id vừa gửi (tránh bỏ sót tin của người kia)
    if (list.length) this.lastId = Math.max(this.lastId, ...list.map((r) => r.id));
    return fresh;
  },

  applyState(data) {
    const upKey = (list) => list.map((u) => `${u.id}:${u.at}`).join(',');
    this.stateChanged = data.peerSeen !== this.peerSeen || upKey(data.upcoming) !== upKey(this.upcoming);
    this.me = data.me;
    this.seen = data.seen;
    this.peerSeen = data.peerSeen;
    this.upcoming = data.upcoming;
    this.setUnread(data.unread);
  },

  setUnread(n) {
    if (n === this.unread) return;
    this.unread = n;
    this.opts.onUnread(n);
  },

  async markSeen() {
    if (!this.loaded || !this.visible() || this.lastId <= this.seen) return;
    const hasIncoming = [...this.rows.values()].some((r) => r.id > this.seen && r.sender !== this.me && r.kind !== 'reply');
    this.seen = this.lastId;
    this.setUnread(0);
    if (!hasIncoming) return;
    this.request('/api/chat/seen', { method: 'POST', body: { lastId: this.lastId } }).catch(() => {});
  },

  // Tin mới của người kia: đang mở thì thôi; đang học thì chỉ báo nhẹ; còn lại có chuông
  announce(fresh) {
    if (this.visible()) return;
    const peer = this.name(this.peer());
    const last = fresh.at(-1);
    let line;
    if (last.kind === 'date') line = `🎟 ${peer} rủ đi: ${last.place}`;
    else if (last.kind === 'reply') {
      const card = this.rows.get(last.refId);
      const place = card?.place ? `: ${card.place}` : '';
      line = last.body === 'accepted' ? `💗 ${peer} đồng ý đi chơi rồi${place}`
        : last.body === 'declined' ? `🥺 ${peer} hẹn lần khác${place}` : `🔁 ${peer} đổi giờ hẹn${place}`;
    } else line = `💬 ${peer}: ${last.body.length > 60 ? last.body.slice(0, 60) + '…' : last.body}`;
    if (this.opts.quiet()) { toast(line, 5000); return; }
    toast(line, 6000);
    Sound.play('soft');
    Notify.send(`💬 ${peer} vừa nhắn`, line);
  },

  // ---------- Gửi ----------

  async sendText(text, retry) {
    const item = retry || { tempId: `t${++this.outboxSeq}`, body: text, at: Date.now() };
    item.failed = false;
    if (!retry) this.outbox.push(item);
    this.render();
    this.scrollToEnd();
    try {
      const { chat } = await this.request('/api/chat', { method: 'POST', body: { kind: 'text', body: item.body } });
      this.outbox = this.outbox.filter((o) => o !== item);
      this.rows.set(chat.id, chat);
    } catch (err) {
      item.failed = true;
      item.error = err.message;
    }
    this.render();
    this.scrollToEnd();
  },

  openDateForm(card) {
    const f = this.els.dateForm;
    this.rescheduleOf = card || null;
    f.reset();
    this.els.dateError.textContent = '';
    this.els.dateTitle.textContent = card ? 'Đổi giờ hẹn' : 'Rủ đi chơi';
    f.querySelector('[type="submit"]').textContent = card ? 'Gửi giờ mới' : 'Gửi phiếu hẹn';
    const at = f.elements.at;
    at.min = ChatTime.local(Date.now());
    if (card) {
      f.elements.place.value = card.place;
      f.elements.note.value = card.body || '';
      at.value = ChatTime.local(card.at);
    }
    f.hidden = false;
    (card ? at : f.elements.place).focus();
  },

  closeDateForm() {
    this.els.dateForm.hidden = true;
    this.rescheduleOf = null;
    this.els.input.focus();
  },

  async sendDate() {
    const f = this.els.dateForm;
    const btn = f.querySelector('[type="submit"]');
    // datetime-local là giờ máy; đổi sang mili-giây UTC trước khi gửi
    const at = new Date(f.elements.at.value).getTime();
    if (!Number.isFinite(at)) { this.els.dateError.textContent = 'Chọn ngày giờ hẹn nha'; return; }
    if (at < Date.now()) { this.els.dateError.textContent = 'Giờ hẹn phải ở tương lai nè'; return; }
    btn.disabled = true;
    try {
      const body = { kind: 'date', place: f.elements.place.value, note: f.elements.note.value, at };
      if (this.rescheduleOf) body.refId = this.rescheduleOf.id;
      const { chat } = await this.request('/api/chat', { method: 'POST', body });
      if (this.rescheduleOf) this.rescheduleOf.status = 'rescheduled';
      this.rows.set(chat.id, chat);
      this.closeDateForm();
      this.render();
      this.scrollToEnd();
    } catch (err) {
      this.els.dateError.textContent = err.message;
    }
    btn.disabled = false;
  },

  async answer(card, answer, btn) {
    btn.disabled = true;
    try {
      await this.request(`/api/chat/${card.id}/answer`, { method: 'POST', body: { answer } });
      card.status = answer;
      if (answer === 'accepted') this.stamped.add(card.id);
      this.render();
      this.poll();
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  },

  // ---------- Vẽ ----------

  scrollToEnd() {
    const { scroll } = this.els;
    const toEnd = () => requestAnimationFrame(() => { scroll.scrollTop = scroll.scrollHeight; });
    toEnd();
    // Font viết tay tải xong làm chữ cao lên, cuộn lại một lần nữa
    document.fonts?.ready.then(toEnd);
  },

  render() {
    if (!this.els) return;
    const { scroll, list, more, empty } = this.els;
    const nearEnd = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 80;
    const rows = [...this.rows.values()].sort((a, b) => a.id - b.id);
    more.hidden = !this.more;
    empty.hidden = !this.loaded || rows.length > 0 || this.outbox.length > 0;
    list.replaceChildren();

    const lastMine = rows.findLast((r) => r.sender === this.me && r.kind !== 'reply');
    let day = null;
    rows.forEach((r, i) => {
      const d = ChatTime.dayStart(r.createdAt);
      if (d !== day) { day = d; list.appendChild(this.dayRow(r.createdAt)); }
      if (r.kind === 'reply') { list.appendChild(this.eventRow(r)); return; }
      const next = rows[i + 1];
      const endsCluster = !next || next.sender !== r.sender || next.kind === 'reply'
        || next.createdAt - r.createdAt > CLUSTER_MS || ChatTime.dayStart(next.createdAt) !== d;
      const li = r.kind === 'date' ? this.dateRow(r) : this.textRow(r);
      if (endsCluster || r === lastMine) {
        let meta = ChatTime.clock(r.createdAt);
        if (r === lastMine && !this.outbox.length) meta += r.id <= this.peerSeen ? ' · Đã xem' : ' · Đã gửi';
        li.appendChild(el('span', 'chat-meta', meta));
      } else li.classList.add('chat-tight');
      list.appendChild(li);
    });

    if (this.outbox.length && (!rows.length || ChatTime.dayStart(rows.at(-1).createdAt) !== ChatTime.dayStart(Date.now()))) {
      list.appendChild(this.dayRow(Date.now()));
    }
    this.outbox.forEach((o) => list.appendChild(this.outboxRow(o)));
    this.renderUpcoming();
    if (nearEnd) scroll.scrollTop = scroll.scrollHeight;
  },

  dayRow(ms) {
    const li = el('li', 'chat-day');
    li.appendChild(el('span', '', ChatTime.day(ms)));
    return li;
  },

  msgShell(r) {
    const li = el('li', `chat-msg from-${r.sender} ${r.sender === this.me ? 'mine' : 'theirs'}`);
    li.dataset.id = r.id;
    return li;
  },

  textRow(r) {
    const li = this.msgShell(r);
    li.appendChild(el('p', 'chat-bubble', r.body));
    return li;
  },

  outboxRow(o) {
    const li = el('li', `chat-msg from-${this.me} mine ${o.failed ? 'is-failed' : 'is-sending'}`);
    li.appendChild(el('p', 'chat-bubble', o.body));
    const meta = el('span', 'chat-meta', o.failed ? 'Chưa gửi được · ' : 'Đang gửi…');
    if (o.failed) meta.title = o.error;
    if (o.failed) {
      const retry = el('button', 'chat-retry', 'Gửi lại');
      retry.type = 'button';
      retry.addEventListener('click', () => this.sendText(o.body, o));
      const drop = el('button', 'chat-retry', 'Bỏ');
      drop.type = 'button';
      drop.addEventListener('click', () => { this.outbox = this.outbox.filter((x) => x !== o); this.render(); });
      meta.append(retry, ' · ', drop);
    }
    li.appendChild(meta);
    return li;
  },

  eventRow(r) {
    const card = this.rows.get(r.refId);
    const who = this.name(r.sender);
    const place = card?.place || 'buổi hẹn';
    const text = r.body === 'accepted' ? `💗 ${who} đã đồng ý: ${place}`
      : r.body === 'declined' ? `🥺 ${who} hẹn lần khác: ${place}` : `🔁 ${who} đổi giờ: ${place}`;
    const li = el('li', 'chat-event');
    li.appendChild(el('span', '', text));
    return li;
  },

  dateRow(r) {
    const li = this.msgShell(r);
    li.classList.add('chat-date');
    const past = r.status === 'pending' && r.at < Date.now();
    const state = past ? 'past' : r.status;
    const wrap = el('div', `ticket-wrap is-${state}`);
    wrap.appendChild(el('span', 'ticket-tape'));
    const t = el('article', 'ticket');
    t.setAttribute('aria-label', `Phiếu hẹn: ${r.place}, ${ChatTime.short(r.at)}`);

    const d = new Date(r.at);
    const stub = el('div', 'ticket-stub');
    stub.setAttribute('aria-hidden', 'true');
    stub.append(el('span', 'ticket-wd', WEEKDAY_SHORT[d.getDay()]), el('span', 'ticket-day', d.getDate()),
      el('span', 'ticket-mo', `th ${d.getMonth() + 1}`));

    const main = el('div', 'ticket-main');
    main.appendChild(el('h3', 'ticket-place', r.place));
    main.appendChild(el('p', 'ticket-when', `${ChatTime.short(r.at)} · ${ChatTime.until(r.at)}`));
    if (r.body) main.appendChild(el('p', 'ticket-note', r.body));

    const mine = r.sender === this.me;
    if (state === 'pending' && !mine) {
      const actions = el('div', 'ticket-actions');
      const yes = el('button', 'btn primary ticket-btn', 'Đồng ý 💗');
      const move = el('button', 'btn ghost ticket-btn', 'Đổi giờ');
      const no = el('button', 'btn tiny ticket-btn', 'Lần khác nha');
      [yes, move, no].forEach((b) => { b.type = 'button'; });
      yes.addEventListener('click', () => this.answer(r, 'accepted', yes));
      no.addEventListener('click', () => this.answer(r, 'declined', no));
      move.addEventListener('click', () => this.openDateForm(r));
      actions.append(yes, move, no);
      main.appendChild(actions);
    } else if (state === 'accepted') {
      main.appendChild(el('p', 'sr-only', 'Đã chốt'));
    } else {
      const status = {
        pending: `Đang chờ ${this.name(this.peer())} trả lời…`,
        declined: 'Hẹn lần khác nha',
        rescheduled: 'Đã đổi sang giờ khác',
        past: 'Đã qua giờ hẹn',
      }[state];
      main.appendChild(el('p', 'ticket-status', status));
    }
    t.append(stub, main);
    wrap.appendChild(t);
    if (state === 'accepted') {
      const stamp = el('span', 'ticket-stamp', 'Đã chốt');
      stamp.setAttribute('aria-hidden', 'true');
      if (this.stamped.has(r.id)) { stamp.classList.add('is-new'); this.stamped.delete(r.id); }
      wrap.appendChild(stamp);
    }
    li.appendChild(wrap);
    return li;
  },

  renderUpcoming() {
    const { upcoming, upList } = this.els;
    upcoming.hidden = !this.upcoming.length;
    upList.replaceChildren();
    this.upcoming.forEach((u) => {
      const li = el('li');
      const b = el('button', 'chat-up');
      b.type = 'button';
      b.append(el('span', 'chat-up-place', u.place), el('span', 'chat-up-when', `${ChatTime.short(u.at)} · ${ChatTime.until(u.at)}`));
      b.addEventListener('click', () => {
        const target = this.els.list.querySelector(`[data-id="${u.id}"]`);
        if (!target) return;
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        target.classList.remove('is-flash');
        void target.offsetWidth;
        target.classList.add('is-flash');
      });
      li.appendChild(b);
      upList.appendChild(li);
    });
  },
};

/* Ngăn kéo trên trang của em: nút tròn góc dưới + trang vở trượt từ phải */
const ChatDrawer = {
  open: false,

  init() {
    if (this.drawer) return;
    const launcher = el('button', 'chat-launcher');
    launcher.type = 'button';
    launcher.innerHTML = `${CHAT_ICONS.bubble}<span class="chat-badge" hidden></span>`;
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-controls', 'chatDrawer');
    const drawer = el('aside', 'chat-drawer');
    drawer.id = 'chatDrawer';
    drawer.hidden = true;
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-label', 'Trò chuyện');
    document.body.append(launcher, drawer);
    document.body.classList.add('has-chat');
    this.launcher = launcher;
    this.drawer = drawer;
    this.badge = launcher.querySelector('.chat-badge');
    this.label(0);

    launcher.addEventListener('click', () => (this.open ? this.close() : this.show()));
    drawer.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });

    Chat.mount(drawer, {
      mode: 'drawer',
      isVisible: () => this.open,
      quiet: () => typeof Timer !== 'undefined' && Timer.state.running && Timer.state.phase === 'focus',
      onUnread: (n) => this.label(n),
      onClose: () => this.close(),
    });
  },

  label(n) {
    const peer = Chat.name('anh');
    this.launcher.setAttribute('aria-label', n ? `Nhắn với ${peer}, ${n} tin chưa đọc` : `Nhắn với ${peer}`);
    const was = this.badge.hidden ? 0 : Number(this.badge.dataset.n || 0);
    this.badge.hidden = !n;
    this.badge.dataset.n = n;
    this.badge.textContent = n > 9 ? '9+' : n;
    if (n > was) {
      this.badge.classList.remove('is-bump');
      void this.badge.offsetWidth;
      this.badge.classList.add('is-bump');
    }
  },

  show() {
    this.open = true;
    this.drawer.hidden = false;
    this.launcher.setAttribute('aria-expanded', 'true');
    document.body.classList.add('chat-open');
    void this.drawer.offsetWidth; // để trình duyệt vẽ vị trí ban đầu trước khi trượt vào
    this.drawer.classList.add('is-open');
    Chat.els.input.focus({ preventScroll: true });
    Chat.shown();
  },

  close() {
    if (!this.open) return;
    this.open = false;
    this.launcher.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('chat-open');
    this.drawer.classList.remove('is-open');
    const hide = (e) => {
      if (e && e.target !== this.drawer) return;
      this.drawer.removeEventListener('transitionend', hide);
      if (!this.open) this.drawer.hidden = true;
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) hide();
    else this.drawer.addEventListener('transitionend', hide);
    this.launcher.focus();
    Chat.schedule();
  },
};
