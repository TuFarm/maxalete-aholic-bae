/* Góc giải trí — thêm trò chơi mới bằng cách thêm 1 phần tử vào GAMES.
   Trò chơi có hàm play() sẽ mở được; không có thì hiện "Sắp ra mắt". */

const GAMES = [
  {
    id: 'love-jar',
    emoji: '🫙',
    name: 'Hũ lời yêu',
    desc: 'Lắc hũ để nhận một lời nhắn bí mật',
    play() {
      const pick = () => personalize(pickRandom(Content.data.note, '{his} thương {her} nhiều 💗'));
      Popup.show({
        emoji: '🫙',
        title: 'Hũ lời yêu',
        html: '<div class="love-jar"><span class="jar" id="jar">🫙</span><div class="love-note" id="loveNote">Bấm vào hũ để lắc nè!</div></div>',
        actions: [{ label: 'Đóng hũ lại 💕', primary: true }],
      });
      const jar = document.getElementById('jar');
      jar.addEventListener('click', () => {
        jar.classList.remove('shake');
        void jar.offsetWidth;
        jar.classList.add('shake');
        Sound.play('soft');
        setTimeout(() => { document.getElementById('loveNote').textContent = pick(); }, 350);
      });
    },
  },
  { id: 'memory', emoji: '🃏', name: 'Lật thẻ cặp đôi', desc: 'Tìm các cặp hình giống nhau' },
  { id: 'quiz', emoji: '💭', name: 'Hiểu nhau bao nhiêu?', desc: 'Câu đố về hai đứa mình' },
  { id: 'catch', emoji: '🧺', name: 'Hứng tim', desc: 'Hứng thật nhiều trái tim rơi' },
  { id: 'wheel', emoji: '🎡', name: 'Vòng quay hẹn hò', desc: 'Quay xem cuối tuần đi đâu' },
];

const Games = {
  init() {
    const grid = document.getElementById('gameGrid');
    GAMES.forEach((g) => {
      const card = document.createElement(g.play ? 'button' : 'div');
      card.className = 'game' + (g.play ? '' : ' soon');
      card.innerHTML = `<span class="game-emoji">${g.emoji}</span><h3>${g.name}</h3><p>${g.desc}</p>`
        + `<span class="badge">${g.play ? 'Chơi ngay ✨' : 'Sắp ra mắt 💕'}</span>`;
      if (g.play) card.addEventListener('click', () => g.play());
      grid.appendChild(card);
    });
  },
};
