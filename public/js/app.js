/* Kết nối các phần lại với nhau */

const $ = (id) => document.getElementById(id);

function renderNames() {
  const s = Settings.data;
  $('brandName').textContent = s.herName;
  $('footerName').textContent = s.herName;
  const h = new Date().getHours();
  const time = h < 11 ? 'Chào buổi sáng ☀️' : h < 14 ? 'Chào buổi trưa 🌤️' : h < 18 ? 'Chào buổi chiều 🌸' : h < 23 ? 'Chào buổi tối 🌙' : 'Khuya rồi đó, ngủ sớm nha 😴';
  $('greeting').textContent = `${time} ${s.herName} ơi!`;
}

function rotateSweet() {
  const el = $('sweetNote');
  el.style.opacity = 0;
  setTimeout(() => { el.textContent = `“${sweetLine()}”`; el.style.opacity = 1; }, 400);
}

function renderStats() {
  const t = Stats.today();
  const goal = Settings.data.waterGoal;
  $('statPomos').textContent = t.pomos;
  $('statMinutes').textContent = t.minutes;
  $('statWater').textContent = t.water;
  $('waterGoalText').textContent = goal;
  $('streakChip').textContent = `🔥 ${Stats.streak()} ngày`;
  $('glasses').innerHTML = Array.from({ length: Math.max(goal, t.water) },
    (_, i) => `<div class="glass${i < t.water ? ' full' : ''}" title="Ly ${i + 1}"></div>`).join('');
}

function spawnHeart() {
  const bg = $('heartsBg');
  if (bg.childElementCount > 14 || document.hidden) return;
  const el = document.createElement('span');
  el.className = 'float-heart';
  el.textContent = ['💗', '💕', '💖', '🌸', '✨', '💞'][Math.floor(Math.random() * 6)];
  el.style.left = Math.random() * 100 + 'vw';
  el.style.fontSize = 14 + Math.random() * 18 + 'px';
  el.style.animationDuration = 9 + Math.random() * 8 + 's';
  el.addEventListener('animationend', () => el.remove());
  bg.appendChild(el);
}

// Khi hết một phiên: báo bằng popup + chuông + thông báo hệ thống
function onPhaseEnd({ detail }) {
  const { from, to, skipped, silent } = detail;
  if (silent) return;
  const s = Settings.data;
  const auto = s.autoStart;

  if (to !== 'focus') {
    const due = Reminders.takeDueSoon();
    if (skipped) { toast('⏭ Đã bỏ qua, chuyển sang giờ nghỉ'); if (!due.length) return; }
    Sound.play('done');
    const mins = s[to];
    const title = to === 'long' ? 'Xuất sắc! Nghỉ dài thôi 🌙' : 'Hết giờ học rồi! 🎉';
    Notify.send(title, `Nghỉ ${mins} phút nha ${s.herName} 💕`);
    Popup.show({
      emoji: to === 'long' ? '🏆' : '🎉',
      title,
      html: `<p>${skipped ? '' : `Em vừa hoàn thành thêm 1 phiên 🍅. `}Giờ nghỉ <b>${mins} phút</b>${due.length ? ', trong lúc nghỉ nhớ:' : ' nhé!'}</p>`
        + Reminders.checklistHtml(due),
      sweet: sweetLine(),
      actions: Reminders.actionsFor(due, auto ? [] : [{ label: '▶ Bắt đầu nghỉ', primary: !due.includes('water'), onClick: () => Timer.start() }]),
    });
  } else {
    if (skipped) { toast('⏭ Quay lại học thôi nào 📚'); return; }
    Sound.play('break');
    Notify.send('Hết giờ nghỉ rồi 📚', 'Quay lại học thôi nào, cố lên nha!');
    if (auto) {
      toast('📚 Hết giờ nghỉ, phiên học mới đã bắt đầu! Cố lên nha 💪', 6000);
    } else {
      Popup.show({
        emoji: '📚',
        title: 'Hết giờ nghỉ rồi nè',
        html: '<p>Mình quay lại học tiếp nha, thêm một phiên nữa thôi!</p>',
        sweet: sweetLine(),
        actions: [{ label: 'Để sau', primary: false }, { label: '▶ Học tiếp', primary: true, onClick: () => Timer.start() }],
      });
    }
  }
}

function initSettings() {
  const modal = $('settingsModal');
  const form = $('settingsForm');
  const open = () => {
    for (const [k, v] of Object.entries(Settings.data)) {
      const input = form.elements[k];
      if (!input) continue;
      if (input.type === 'checkbox') input.checked = v; else input.value = v;
    }
    modal.hidden = false;
  };
  const close = () => { modal.hidden = true; };

  $('openSettings').addEventListener('click', open);
  $('closeSettings').addEventListener('click', close);
  $('logoutBtn').addEventListener('click', () => Api.logout());
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const patch = {};
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      const input = form.elements[k];
      if (!input) continue;
      if (input.type === 'checkbox') patch[k] = input.checked;
      else if (input.type === 'number') {
        const n = Math.round(+input.value);
        patch[k] = Number.isFinite(n) && n >= +input.min ? Math.min(n, +input.max) : DEFAULT_SETTINGS[k];
      } else patch[k] = input.value.trim() || DEFAULT_SETTINGS[k];
    }
    Settings.apply(patch);
    close();
    if (!Api.online) { toast('Đã lưu cài đặt trong máy 💾'); return; }
    try {
      const { settings } = await Api.saveSettings(patch);
      Settings.apply(settings);
      toast('Đã lưu cài đặt lên server 💾');
    } catch (err) {
      // Server không đặt PIN thì chỉ trang admin được sửa cài đặt
      toast(`Chưa lưu được lên server: ${err.message}`, 6000);
    }
  });
}

// Lấy cài đặt + nội dung mới nhất từ server. Không có server thì chạy bằng dữ liệu trong máy.
async function syncServer() {
  try {
    const { settings, items } = await Api.bootstrap();
    const firstTime = !Api.online;
    Api.online = true;
    Settings.apply(settings);
    Content.apply(items);
    if (firstTime) Mailbox.init();
  } catch {
    if (!Api.online) Mailbox.render();
  }
}

function initNotifyButton() {
  const btn = $('notifyBtn');
  const render = () => {
    if (!Notify.supported) { btn.hidden = true; return; }
    btn.textContent = Notify.granted ? '🔔 Đã bật' : '🔔 Bật thông báo';
    btn.disabled = Notify.granted;
  };
  btn.addEventListener('click', async () => {
    if (Notification.permission === 'denied') {
      toast('Thông báo đang bị chặn, em mở lại trong cài đặt trình duyệt nha 🔕', 6000);
      return;
    }
    const ok = await Notify.request();
    toast(ok ? 'Đã bật! Khi em ở tab khác vẫn nhận được lời nhắc 💌' : 'Chưa bật được thông báo 🥺');
    render();
  });
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  Timer.init();
  Reminders.init();
  Music.init();
  Games.init();
  initSettings();
  initNotifyButton();

  renderNames();
  renderStats();
  rotateSweet();

  $('addWater').addEventListener('click', () => {
    Stats.add('water');
    const t = Stats.today();
    toast(t.water === Settings.data.waterGoal ? '🎉 Đủ nước cả ngày rồi, giỏi quá trời!' : `💧 Ly thứ ${t.water}, tuyệt vời!`);
  });

  document.addEventListener('timer:phaseend', onPhaseEnd);
  document.addEventListener('stats:changed', renderStats);
  document.addEventListener('settings:changed', () => { renderNames(); renderStats(); });

  syncServer();
  setInterval(syncServer, 5 * 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Api.online) syncServer(); });
  document.addEventListener('content:changed', rotateSweet);

  setInterval(rotateSweet, 45000);
  setInterval(spawnHeart, 1600);
  for (let i = 0; i < 5; i++) setTimeout(spawnHeart, i * 300);
  if (FAST) toast('⚡ Chế độ test: 1 phút = 1 giây');
});
