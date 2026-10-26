/* Học cùng nhau: gửi trạng thái của mình lên server, xem người kia đang học tới đâu,
   kế hoạch tối nay của mình, và tim cổ vũ gửi cho nhau.
   Một lần poll /api/together vừa gửi trạng thái (khi có thay đổi hoặc mỗi phút), vừa nhận của người kia. */

const TOGETHER = {
  pollMs: 15000,
  hiddenPollMs: 60000,
  heartbeatMs: 55000,
  awayMs: 3 * 60000, // quá 3 phút không có tín hiệu thì coi như vắng
  cheerGapMs: 60000,
};

const hhmm = (ms) => new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

// Đang học (focus) thì không kêu chuông, chỉ hiện nhẹ
const inFocus = () => Timer.state.running && Timer.state.phase === 'focus';

// Thả một chùm tim bay lên nền trang (tự tắt khi người dùng giảm chuyển động)
function burstHearts(n = 6) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const bg = document.getElementById('heartsBg');
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      const el = document.createElement('span');
      el.className = 'float-heart is-cheer';
      el.textContent = ['💗', '💖', '💕'][i % 3];
      el.style.left = 30 + Math.random() * 40 + 'vw';
      el.style.fontSize = 22 + Math.random() * 16 + 'px';
      el.style.animationDuration = 5 + Math.random() * 3 + 's';
      el.addEventListener('animationend', () => el.remove());
      bg.appendChild(el);
    }, i * 140);
  }
}

const Together = {
  data: null,
  offset: 0, // giờ server - giờ máy này
  dirty: true,
  lastSent: 0,
  cheerCursor: null,
  prevPeerDone: null,
  cheerUntil: 0,
  polling: false,
  timer: null,
  soon: null,
  started: false,

  serverNow() { return Date.now() + this.offset; },

  // Trạng thái của mình gửi cho người kia. `left` tính tại lúc gửi; server ghi kèm giờ của server
  // nên bên kia tự đếm ngược được mà không phụ thuộc đồng hồ máy mình.
  presence() {
    const t = Stats.today();
    const s = Settings.data;
    return {
      phase: Timer.state.phase,
      running: Timer.state.running,
      left: Math.round(Timer.remaining()),
      total: Math.round(Timer.duration()),
      done: Timer.state.done,
      longEvery: s.longEvery,
      day: dateKey(),
      pomos: t.pomos,
      minutes: t.minutes,
      water: t.water,
      waterGoal: s.waterGoal,
      eyeRest: s.eyeRest,
      lastWater: t.lastWater || null,
      lastMove: Reminders.last.move,
      lastEye: Reminders.last.eye,
      online: true,
    };
  },

  // Có thay đổi: gửi sớm (gom các thay đổi liên tiếp trong ~1 giây)
  markDirty() {
    this.dirty = true;
    if (!this.started) return;
    clearTimeout(this.soon);
    this.soon = setTimeout(() => this.poll(), 1000);
  },

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.poll(), document.hidden ? TOGETHER.hiddenPollMs : TOGETHER.pollMs);
  },

  async poll() {
    if (this.polling) return;
    this.polling = true;
    clearTimeout(this.timer);
    const send = this.dirty || Date.now() - this.lastSent > TOGETHER.heartbeatMs;
    if (send) this.dirty = false;
    try {
      const body = { cheersAfter: this.cheerCursor ?? undefined };
      if (send) body.presence = this.presence();
      const data = await Api.together(body);
      if (send) this.lastSent = Date.now();
      this.receive(data);
    } catch {
      if (send) this.dirty = true; // lần sau gửi lại
    } finally {
      this.polling = false;
      this.schedule();
    }
  },

  receive(data) {
    this.offset = data.now - Date.now();
    const first = !this.data;
    this.data = data;
    if (first) Stats.merge(data.presence[Me.who]?.day, data.presence[Me.who]);

    if (this.cheerCursor !== null && data.cheers.length) this.gotCheers(data.cheers.length);
    this.cheerCursor = Math.max(this.cheerCursor ?? 0, data.cheerCursor);

    // Chỉ báo việc người kia vừa xong khi so với lần poll trước (lần đầu thì không)
    const peerPlan = data.plans[Me.peer];
    if (this.prevPeerDone) {
      peerPlan.filter((p) => p.doneAt && !this.prevPeerDone.has(p.id)).forEach((p) => this.peerFinished(p));
    }
    this.prevPeerDone = new Set(peerPlan.filter((p) => p.doneAt).map((p) => p.id));

    Plan.receive(data.plans[Me.who]);
    this.render();
  },

  gotCheers(n) {
    const quiet = inFocus();
    if (!quiet) Sound.play('soft');
    burstHearts(Math.min(12, 5 + n));
    toast(n > 1 ? `💗 ${Me.peerName} gửi ${n} trái tim cổ vũ ${Me.you} nè!` : `💗 ${Me.peerName} gửi tim cổ vũ ${Me.you} nè!`, 5000);
    if (!quiet) Notify.send(`💗 ${Me.peerName} gửi tim cho ${Me.you}`, 'Cố lên nha!');
  },

  peerFinished(item) {
    if (!inFocus()) Sound.play('soft');
    toast(`🎉 ${Me.peerName} vừa xong “${item.text}”`, 6000);
  },

  async cheer() {
    const btn = this.els.cheer;
    if (Date.now() < this.cheerUntil) return;
    btn.disabled = true;
    try {
      await Api.cheer();
      this.cheerUntil = Date.now() + TOGETHER.cheerGapMs;
      burstHearts(4);
      btn.classList.remove('is-sent');
      void btn.offsetWidth;
      btn.classList.add('is-sent');
      toast(`Đã gửi tim cho ${Me.peerName} 💗`);
    } catch (err) {
      if (err.status === 429) this.cheerUntil = Date.now() + TOGETHER.cheerGapMs;
      toast(err.message);
    } finally {
      this.renderCheer();
    }
  },

  // ---------- Hiển thị người kia ----------

  // Người kia đang ở trạng thái nào: none | away | focus | short | long | paused | idle
  peerState() {
    const d = this.data;
    const p = d?.presence[Me.peer];
    if (!p) return { key: 'none' };
    const age = this.serverNow() - p.updatedAt;
    if (!p.online || age > TOGETHER.awayMs) return { key: 'away', p, seenToday: p.day === d.today || dateKey(new Date(p.updatedAt)) === dateKey() };
    if (p.running) return { key: p.phase, p, left: Math.max(0, p.left - age) };
    if (p.left < p.total) return { key: 'paused', p };
    return { key: 'idle', p };
  },

  statusText(st) {
    const left = st.left != null ? fmtTime(st.left) : '';
    switch (st.key) {
      case 'none': return 'chưa vào học hôm nay';
      case 'away': return st.seenToday ? `đang vắng · lần cuối thấy lúc ${hhmm(st.p.updatedAt)}` : 'chưa vào học hôm nay';
      case 'focus': return st.left > 0 ? `đang tập trung · còn ${left}` : 'sắp xong một phiên rồi';
      case 'short': return `đang nghỉ ngắn · còn ${left}`;
      case 'long': return `đang nghỉ dài · còn ${left}`;
      case 'paused': return `đang tạm dừng (${PHASES[st.p.phase].label.toLowerCase()})`;
      default: return 'đang ở đây, chưa bấm giờ';
    }
  },

  renderStatus() {
    if (!this.data) return;
    const st = this.peerState();
    this.els.root.dataset.state = st.key;
    this.els.status.textContent = this.statusText(st);
  },

  renderFacts() {
    const d = this.data;
    const st = this.peerState();
    const p = st.p && st.p.day === d.today ? st.p : null;
    const today = (ms) => ms && dateKey(new Date(ms)) === dateKey();
    const facts = [
      ['🍅', p ? `${p.pomos} phiên · ${p.minutes} phút học` : '0 phiên học'],
      ['💧', p ? `${p.water}/${p.waterGoal || 8} ly nước${today(p.lastWater) ? ` · lần cuối ${hhmm(p.lastWater)}` : ''}` : 'chưa uống ly nào'],
      ['🧘', p && today(p.lastMove) ? `vận động lúc ${hhmm(p.lastMove)}` : 'chưa tới giờ vận động'],
    ];
    if (!p || p.eyeRest) facts.push(['👀', p && today(p.lastEye) ? `nghỉ mắt lúc ${hhmm(p.lastEye)}` : 'chưa tới giờ nghỉ mắt']);
    this.els.facts.replaceChildren(...facts.map(([ico, text]) => {
      const li = document.createElement('li');
      const i = document.createElement('span');
      i.className = 'fact-ico';
      i.textContent = ico;
      li.append(i, text);
      return li;
    }));
  },

  renderPlan() {
    const items = this.data.plans[Me.peer];
    const done = items.filter((p) => p.doneAt).length;
    const list = this.els.plan;
    this.els.count.hidden = !items.length;
    this.els.count.textContent = `📝 ${done}/${items.length}`;
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'peer-plan-empty';
      li.textContent = `${Me.peerName} chưa lên kế hoạch tối nay`;
      list.replaceChildren(li);
      return;
    }
    const MAX = 6;
    const rows = items.slice(0, MAX).map((p) => {
      const li = document.createElement('li');
      li.classList.toggle('is-done', Boolean(p.doneAt));
      const box = document.createElement('span');
      box.className = 'peer-box';
      box.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span');
      text.className = 'peer-plan-text';
      text.textContent = p.text;
      li.append(box, text);
      li.setAttribute('aria-label', `${p.text}${p.doneAt ? ', đã xong' : ', chưa xong'}`);
      return li;
    });
    if (items.length > MAX) {
      const more = document.createElement('li');
      more.className = 'peer-plan-more';
      more.textContent = `+${items.length - MAX} việc nữa`;
      rows.push(more);
    }
    list.replaceChildren(...rows);
  },

  renderCheer() {
    const left = Math.ceil((this.cheerUntil - Date.now()) / 1000);
    const btn = this.els.cheer;
    btn.disabled = left > 0;
    btn.textContent = left > 0 ? `💗 Gửi tiếp sau ${left}s` : '💗 Gửi tim cổ vũ';
  },

  render() {
    if (!this.data) return;
    this.els.root.hidden = false;
    this.els.heading.textContent = Me.peerName;
    this.els.avatar.textContent = Me.avatar(Me.peer);
    this.els.planTitle.textContent = `Kế hoạch tối nay của ${Me.they}`;
    this.renderStatus();
    this.renderFacts();
    this.renderPlan();
    this.renderCheer();
  },

  setOpen(open) {
    this.els.root.classList.toggle('is-collapsed', !open);
    this.els.toggle.setAttribute('aria-expanded', String(open));
    Store.set('togetherOpen', open);
  },

  init() {
    if (this.started) return;
    this.started = true;
    const $ = (id) => document.getElementById(id);
    this.els = {
      root: $('together'), toggle: $('togetherToggle'), heading: $('peerHeading'), status: $('peerStatus'),
      avatar: $('peerAvatar'), count: $('peerCount'), facts: $('peerFacts'), plan: $('peerPlan'),
      planTitle: $('peerPlanTitle'), cheer: $('cheerBtn'),
    };
    // Điện thoại: mặc định thu gọn còn một dòng
    this.setOpen(Store.get('togetherOpen', !matchMedia('(max-width: 600px)').matches));
    this.els.toggle.addEventListener('click', () => this.setOpen(this.els.root.classList.contains('is-collapsed')));
    this.els.cheer.addEventListener('click', () => this.cheer());

    const dirty = () => this.markDirty();
    ['timer:start', 'timer:pause', 'timer:reset', 'timer:phaseend', 'stats:changed', 'settings:changed', 'reminders:changed']
      .forEach((name) => document.addEventListener(name, dirty));
    document.addEventListener('settings:changed', () => this.render());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { this.dirty = true; this.poll(); } else this.schedule();
    });
    // Rời trang: báo cho người kia biết ngay thay vì đợi 3 phút
    addEventListener('pagehide', () => { try { navigator.sendBeacon('/api/presence/bye'); } catch { /* bỏ qua */ } });
    addEventListener('pageshow', (e) => { if (e.persisted) { this.dirty = true; this.poll(); } });

    setInterval(() => {
      if (document.hidden || !this.data) return;
      this.renderStatus();
      if (this.cheerUntil > Date.now() - 1000) this.renderCheer();
    }, 1000);
    this.poll();
  },
};

/* Kế hoạch tối nay của mình: thêm việc, tick khi xong, xoá. Việc chưa xong tự chuyển sang hôm sau. */
const Plan = {
  items: [],
  pending: 0, // đang chờ server trả lời: bỏ qua dữ liệu poll để không nháy ngược trạng thái
  online: false,
  justDone: null, // id việc vừa tick, để chỉ nó chạy nét gạch

  // Chỉ vẽ lại khi danh sách thật sự đổi (poll 15 giây/lần không làm nháy)
  sig(list) { return list.map((p) => `${p.id}:${p.doneAt ? 1 : 0}:${p.text}`).join('|'); },

  setItems(list) {
    const changed = this.sig(list) !== this.sig(this.items);
    this.items = list;
    if (changed) this.render();
  },

  receive(list) {
    const first = !this.online;
    this.online = true;
    if (this.pending) return;
    if (first) { this.items = list; this.render(); } else this.setItems(list);
  },

  async mutate(apply, call) {
    const before = this.items;
    this.items = apply(this.items.map((p) => ({ ...p })));
    this.render();
    this.pending++;
    try {
      const { plan } = await call();
      this.pending--;
      if (!this.pending) this.setItems(plan);
      Together.markDirty();
      return true;
    } catch (err) {
      this.pending--;
      this.items = before;
      this.render();
      toast(err.message);
      return false;
    }
  },

  add(text) {
    return this.mutate(
      (list) => [...list, { id: `tmp${Date.now()}`, text, day: dateKey(), doneAt: null, temp: true }],
      () => Api.planAdd(text),
    );
  },

  async toggle(item, done) {
    this.justDone = done ? item.id : null;
    const ok = await this.mutate(
      (list) => list.map((p) => (p.id === item.id ? { ...p, doneAt: done ? Date.now() : null } : p)),
      () => Api.planUpdate(item.id, { done }),
    );
    if (!ok || !done) return;
    const left = this.items.filter((p) => !p.doneAt).length;
    Sound.play(left ? 'soft' : 'done');
    toast(left ? `✅ Xong “${item.text}” rồi, giỏi quá!` : '🎉 Xong hết kế hoạch rồi! Nghỉ ngơi thôi nào 💕');
  },

  remove(item) {
    return this.mutate((list) => list.filter((p) => p.id !== item.id), () => Api.planDelete(item.id));
  },

  dayLabel(day) {
    if (!day || day >= dateKey()) return '';
    const [, m, d] = day.split('-');
    return `từ ${d}/${m}`;
  },

  render() {
    const list = this.els.list;
    const chip = this.els.chip;
    const focused = document.activeElement?.closest?.('#planList') ? document.activeElement : null;
    const refocus = focused && focused.closest('li')?.dataset.id;
    const done = this.items.filter((p) => p.doneAt).length;
    chip.hidden = !this.items.length;
    chip.textContent = this.items.length && done === this.items.length ? '🎉 Xong hết' : `${done}/${this.items.length} xong`;
    chip.classList.toggle('soft', done !== this.items.length);
    this.els.form.querySelectorAll('input, button').forEach((el) => { el.disabled = !this.online; });
    this.els.hint.textContent = this.online
      ? `Việc chưa xong tự chuyển sang hôm sau. ${cap(Me.they)} sẽ thấy ${Me.you} tick tới đâu 💕`
      : 'Đang kết nối server để tải kế hoạch…';

    if (!this.items.length) {
      const li = document.createElement('li');
      li.className = 'plan-empty';
      li.textContent = this.online ? `Tối nay ${Me.you} định học gì? Viết vào ô bên dưới nha ✏️` : '';
      list.replaceChildren(li);
      return;
    }
    list.replaceChildren(...this.items.map((p) => {
      const li = document.createElement('li');
      li.dataset.id = p.id;
      li.className = 'plan-item' + (p.doneAt ? ' is-done' : '') + (p.temp ? ' is-temp' : '')
        + (p.id === this.justDone ? ' just-done' : '');
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = Boolean(p.doneAt);
      box.disabled = Boolean(p.temp);
      box.addEventListener('change', () => this.toggle(p, box.checked));
      const text = document.createElement('span');
      text.className = 'plan-text';
      text.textContent = p.text;
      label.append(box, text);
      li.appendChild(label);
      const from = this.dayLabel(p.day);
      if (from && !p.doneAt) {
        const tag = document.createElement('small');
        tag.className = 'plan-from';
        tag.textContent = from;
        li.appendChild(tag);
      }
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'plan-del';
      del.textContent = '✕';
      del.title = 'Xoá việc này';
      del.setAttribute('aria-label', `Xoá “${p.text}”`);
      del.disabled = Boolean(p.temp);
      del.addEventListener('click', () => this.remove(p));
      li.appendChild(del);
      return li;
    }));
    this.justDone = null;
    // Giữ focus bàn phím trên ô vừa tick sau khi vẽ lại
    if (refocus) list.querySelector(`li[data-id="${refocus}"] input`)?.focus();
  },

  init() {
    const $ = (id) => document.getElementById(id);
    this.els = { list: $('planList'), chip: $('planChip'), form: $('planForm'), input: $('planInput'), hint: $('planHint') };
    this.els.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = this.els.input.value.trim();
      if (!text) return;
      this.els.input.value = '';
      if (!await this.add(text)) this.els.input.value = text;
      this.els.input.focus();
    });
    this.render();
  },
};
