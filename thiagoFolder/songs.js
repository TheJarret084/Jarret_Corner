// songs.js
// Exporta un array de canciones de ejemplo (puedes modificarlo luego)

const fs = require('fs');
const { parse } = require('jsonc-parser');

// Lee y parsea el catálogo de canciones en JSONC
const jsoncText = fs.readFileSync('anotherSongs.jsonc', 'utf-8');
const songsFromJsonc = parse(jsoncText);



const songs = [
  ...songsFromJsonc,
  {
    Name: "", // nombre de la canción
    color: "#44aaff", // color asociado / del fondo de atras del main
    info: "Más info...", // información adicional
    link: "", // link a la canción, en Funky Maker
    icon: "", // icono del personaje, si no se remplaza con el predeterminado
    bpm: 100 // BPM de la canción, por defecto 100
  }
];

module.exports = songs;