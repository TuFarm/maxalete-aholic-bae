/* Lời nhắc uống nước, vận động, nghỉ mắt + hộp thoại dễ thương */

const Popup = {
  queue: [],
  open: false,

  // opts: { emoji, title, html | text, sweet, actions: [{ label, primary, onClick, keepOpen }], onShow(box) }
  // onShow chạy khi popup thật sự hiện ra (có thể phải xếp hàng sau popup khác)
  // Nội dung do người dùng nhập (thư) phải đi qua `text` để không bị chèn HTML
  show(opts) {
    this.queue.push(opts);
    if (!this.open) this.next();
  },

  next() {
    const opts = this.queue.shift();
    const modal = document.getElementById('modal');
    if (!opts) { modal.hidden = true; this.open = false; return; }
    this.open = true;
    document.getElementById('modalEmoji').textContent = opts.emoji;
    document.getElementById('modalTitle').textContent = opts.title;
    const body = document.getElementById('modalText');
    body.classList.toggle('letter', opts.text != null);
    if (opts.text != null) body.textContent = opts.text; else body.innerHTML = opts.html || '';
    document.getElementById('modalSweet').textContent = opts.sweet || '';
    const actions = document.getElementById('modalActions');
    actions.innerHTML = '';
    (opts.actions || [{ label: 'Okiee 💕', primary: true }]).forEach((a) => {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.primary ? 'primary' : 'ghost');
      b.textContent = a.label;
      b.addEventListener('click', () => {
        a.onClick?.(b);
        if (!a.keepOpen) this.next();
      });
      actions.appendChild(b);
    });
    const box = modal.querySelector('.modal-box');
    box.classList.remove('pop');
    void box.offsetWidth;
    box.classList.add('pop');
    modal.hidden = false;
    opts.onShow?.(box);
  },

  // Chen một popup lên đầu hàng đợi và hiện ngay (thay cho popup đang mở)
  replace(opts) {
    this.queue.unshift(opts);
    this.next();
  },
};

const STRETCHES = [
  'Đứng dậy vươn vai thật cao, hít sâu 3 lần 🙆‍♀️',
  'Xoay cổ nhẹ nhàng 5 vòng mỗi bên 🌀',
  'Đi bộ quanh phòng hoặc đi rót nước 🚶‍♀️',
  'Xoay cổ tay, cổ chân cho đỡ mỏi ✋',
  'Nhón gót 15 lần cho máu lưu thông 🦶',
  'Ưỡn lưng, kéo vai ra sau, mở ngực 🧘‍♀️',
];

const Reminders = {
  // Thời gian học đã tích luỹ (ms) kể từ lần nhắc gần nhất — chỉ đếm khi đồng hồ đang chạy
  acc: Store.get('reminders', { water: 0, move: 0, eye: 0 }),
  lastTick: Date.now(),

  interval(type) {
    const s = Settings.data;
    return { water: s.waterEvery, move: s.moveEvery, eye: s.eyeEvery }[type] * MIN;
  },

  save() { Store.set('reminders', this.acc); },

  tick() {
    const now = Date.now();
    const delta = now - this.lastTick;
    this.lastTick = now;
    if (!Timer.state.running) return this.render();

    for (const k of ['water', 'move', 'eye']) this.acc[k] += delta;
    const phase = Timer.state.phase;

    if (phase === 'focus') {
      // Nghỉ mắt là lời nhắc nhỏ, không làm gián đoạn giờ học
      if (Settings.data.eyeRest && this.acc.eye >= this.interval('eye')) {
        this.acc.eye = 0;
        Sound.play('soft');
        toast('👀 Nghỉ mắt 20 giây: nhìn ra xa khoảng 6 mét nha!', 8000);
        Notify.send('👀 Nghỉ mắt 20-20-20', 'Nhìn ra xa 6m trong 20 giây nha bé!');
      }
    } else {
      this.acc.eye = 0;
      // Đang nghỉ mà tới hạn thì nhắc ngay
      const due = ['water', 'move'].filter((k) => this.acc[k] >= this.interval(k));
      if (due.length) this.showBreak(due);
    }
    this.save();
    this.render();
  },

  // Gọi khi bắt đầu giờ nghỉ: nhắc những việc sắp tới hạn (>= 80% chu kỳ)
  takeDueSoon() {
    const due = ['water', 'move'].filter((k) => this.acc[k] >= this.interval(k) * 0.8);
    due.forEach((k) => { this.acc[k] = 0; });
    this.acc.eye = 0;
    this.save();
    return due;
  },

  // Hộp thoại nhắc riêng (khi tới hạn giữa giờ nghỉ)
  showBreak(due) {
    due.forEach((k) => { this.acc[k] = 0; });
    this.save();
    Sound.play('soft');
    const title = due.includes('water') ? '💧 Tới giờ uống nước rồi!' : '🧘 Đứng dậy vận động nè!';
    Notify.send(title, 'Mở app xem lời nhắc nha 💕');
    Popup.show({
      emoji: due.includes('water') ? '💧' : '🧘',
      title: title.slice(2).trim(),
      html: this.checklistHtml(due),
      sweet: sweetLine(),
      actions: this.actionsFor(due),
    });
  },

  checklistHtml(due) {
    const items = [];
    if (due.includes('water')) items.push(`💧 Uống 1 ly nước nhỏ (~${Settings.data.waterMl}ml), nhấp từng ngụm nha`);
    if (due.includes('move')) items.push(STRETCHES[Math.floor(Math.random() * STRETCHES.length)]);
    return items.map((t) => `<div>${t}</div>`).join('');
  },

  actionsFor(due, extra = []) {
    const actions = [...extra];
    if (due.includes('water')) {
      actions.push({
        label: 'Đã uống 1 ly 💧', primary: true,
        onClick: () => { Stats.add('water'); toast('Giỏi quá! +1 ly nước 💧'); },
      });
    }
    actions.push({ label: due.includes('water') ? 'Lát nữa' : 'Xong rồi nè 💪', primary: !due.includes('water') });
    return actions;
  },

  render() {
    const s = Settings.data;
    const set = (id, k, enabled = true) => {
      const el = document.getElementById(id);
      el.closest('li').classList.toggle('off', !enabled);
      if (!enabled) { el.textContent = 'tắt'; return; }
      if (!Timer.state.running) { el.textContent = '—'; return; }
      const left = this.interval(k) - this.acc[k];
      if (k !== 'eye' && Timer.state.phase === 'focus' && left <= this.interval(k) * 0.2 + Timer.remaining()) {
        el.textContent = 'giờ nghỉ tới';
      } else {
        el.textContent = left <= 0 ? 'ngay bây giờ' : `~${Math.ceil(left / MIN)} phút`;
      }
    };
    set('nWater', 'water');
    set('nMove', 'move');
    set('nEye', 'eye', s.eyeRest);
    document.getElementById('rWater').textContent = `mỗi ${s.waterEvery} phút, 1 ly nhỏ ~${s.waterMl}ml`;
    document.getElementById('rEye').textContent = `mỗi ${s.eyeEvery} phút, nhìn xa 6m trong 20 giây`;
    document.getElementById('rMove').textContent = `mỗi ${s.moveEvery} phút ngồi, 2–3 phút giãn cơ`;
  },

  init() {
    setInterval(() => this.tick(), 1000);
    document.addEventListener('settings:changed', () => this.render());
    this.render();
  },
};
