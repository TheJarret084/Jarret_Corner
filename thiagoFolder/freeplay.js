circle.className = 'menu-circle';
freeplay.appendChild(circle);
// Asegúrate de incluir songs.js antes de este script en tu HTML
// <script src="songs.js"></script>

const freeplay = document.getElementById('freeplay');

function spawnSongs(songList) {
  songList.forEach((song, i) => {
    const item = document.createElement('div');
    item.className = 'song-item' + (i === 0 ? ' selected' : '');
    item.style.background = song.color;

    item.innerHTML = `
      <div class="song-name">${song.displayName}</div>
      <div class="song-info">${song.info}</div>
      <div class="song-mechanics">${song.mechanics}</div>
      <img class="icon-slide" src="slide.png" />
      <img class="icon-roll" src="roll.png" />
    `;
    freeplay.appendChild(item);
  });
}

// Llama a la función con el array songs (de songs.js)
spawnSongs(typeof songs !== 'undefined' ? songs : []);
