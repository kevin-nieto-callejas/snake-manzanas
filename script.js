"use strict";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const boardCard = document.querySelector(".board-card");

const worldNameEl = document.querySelector("#world-name");
const harvestEl = document.querySelector("#harvest");
const livesEl = document.querySelector("#lives");
const scoreEl = document.querySelector("#score");
const bestScoreEl = document.querySelector("#best-score");
const bossMeter = document.querySelector("#boss-meter");
const bossMeterLabel = document.querySelector("#boss-meter-label");
const bossMeterFill = document.querySelector("#boss-meter-fill");
const bossMeterValue = document.querySelector("#boss-meter-value");

const startScreen = document.querySelector("#start-screen");
const worldSelectEl = document.querySelector("#world-select");
const pauseScreen = document.querySelector("#pause-screen");
const pauseResumeButton = document.querySelector("#pause-resume");
const pauseRestartButton = document.querySelector("#pause-restart");
const pauseWorldsButton = document.querySelector("#pause-worlds");
const transitionScreen = document.querySelector("#world-transition");
const nextWorldNameEl = document.querySelector("#next-world-name");
const nextWorldTipEl = document.querySelector("#next-world-tip");
const transitionContinueBtn = document.querySelector("#transition-continue");
const bossVictoryScreen = document.querySelector("#boss-victory");
const bossVictoryWorldsButton = document.querySelector("#boss-victory-worlds");
const gameOverScreen = document.querySelector("#game-over");
const gameOverTitleEl = document.querySelector("#game-over-title");
const finalScore = document.querySelector("#final-score");
const restartButton = document.querySelector("#restart");
const dpadButtons = document.querySelectorAll(".dpad-btn");
const soundToggleButton = document.querySelector("#sound-toggle");
const difficultySelectEl = document.querySelector("#difficulty-select");
const difficultyLabelEl = document.querySelector("#difficulty-label");
const pauseDifficultyEl = document.querySelector("#pause-difficulty");

const CELLS = 20;

// Configuración de cada mundo de la campaña. Un flag apagado es 0 o
// false: update()/draw() deben preguntar siempre por la capacidad
// (ej. "if (world.gusanoCazador)"), nunca por el id del mundo.
// Números más frágiles para calibrar: madura (ticks hasta que una
// manzana se pudre sola) y rastro (ticks que una celda pisada queda
// mortal). Están aquí arriba a propósito para tocarlos sin buscar
// en el resto del archivo.
const WORLDS = [
  { id: 1, nombre: "El Huerto", meta: 12, tickMs: 115, muros: "solidos",
    obstaculos: 0, manzanas: 3, madura: 70, gusanoCazador: false, rastro: 0,
    invasionHuerto: true, tip: "Si toda la cosecha se pudre, sobrevive a la invasion." },
  { id: 2, nombre: "La Bodega", meta: 15, tickMs: 125, muros: "wrap",
    obstaculos: 4, manzanas: 3, madura: 0, gusanoCazador: true, rastro: 0,
    tip: "El gusano compite por cualquier manzana." },
  { id: 3, nombre: "El Manzano Podrido", meta: 18, tickMs: 135, muros: "solidos",
    obstaculos: 4, obstaculosPorManzana: 2, manzanas: 4, madura: 0,
    gusanoCazador: false, rastro: 12, tip: "Cada manzana agrega dos trampas." },
  { id: 4, nombre: "El Corazon de la Plaga", meta: 18, tickMs: 125, muros: "solidos",
    obstaculos: 0, manzanas: 5, madura: 0, gusanoCazador: true, rastro: 0,
    jefeFinal: true, manzanasMoviles: true,
    tip: "Jefe final: tres fases, dos arenas y manzanas en movimiento." }
]

// tickMs de cada mundo tal como quedó calibrado (equivale a dificultad
// "Difícil"). aplicarDificultad() lo reescala a partir de este valor
// base, nunca al revés, para poder alternar de dificultad sin ir
// perdiendo precisión con redondeos sucesivos.
WORLDS.forEach(w => { w.tickMsBase = w.tickMs; });

// Posiciones fijas y simétricas de las cajas-obstáculo. Nunca quedan
// adyacentes a la serpiente inicial (fila y=10, columnas x=7..10).
const OBSTACULOS_FIJOS = [
  { x: 4, y: 4 }, { x: 15, y: 4 }, { x: 4, y: 15 }, { x: 15, y: 15 }
];

const VIDAS_POR_MUNDO = 3;

const STORAGE_KEY_MUNDO_MAX = "snake-manzanas:mundoMax";
const STORAGE_KEY_MEJOR_PUNTAJE = "snake-manzanas:mejorPuntaje";
const STORAGE_KEY_DIFICULTAD = "snake-manzanas:dificultad";
const STORAGE_KEY_MUTE = "snake-manzanas:mute";
const MODO_PRUEBAS = true;

// "Difícil" conserva el tickMs original de cada mundo. "Normal" lo
// alarga el mismo porcentaje en los 4 mundos y en el jefe, así la
// relación de velocidad entre mundos no cambia con la dificultad.
const DIFICULTAD_MULTIPLICADOR = { normal: 1.175, dificil: 1 };

// localStorage puede fallar (Safari bajo file://, modo privado, etc.):
// el progreso se degrada a solo-memoria en vez de romper el juego.
function leerStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function escribirStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sin persistencia disponible: el progreso vive solo en esta partida.
  }
}

// Tamaño en píxeles del tablero y de cada celda: se recalculan en cada
// resize, nunca son constantes fijas (así el canvas es nítido en
// cualquier viewport y densidad de píxeles).
let boardSize = 0;
let cell = 0;

const DIR_VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};
const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };
const KEY_TO_DIR = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right"
};

let worldIndex = 0;
let world = WORLDS[worldIndex];
let mundoMax = MODO_PRUEBAS ? WORLDS.length : leerStorage(STORAGE_KEY_MUNDO_MAX, 1);
let mejorPuntaje = leerStorage(STORAGE_KEY_MEJOR_PUNTAJE, 0);
// "dificil" como default conserva el comportamiento previo a este
// cambio para quien ya tenía progreso guardado.
let dificultad = leerStorage(STORAGE_KEY_DIFICULTAD, "dificil");
let muted = leerStorage(STORAGE_KEY_MUTE, false);

let snake;
let direction;
let directionQueue;
let apples;
let score;
let cosecha;
let vidas;
let running;
let paused;

let rafId = null;
let acc = 0;
let last = 0;
let transitionTimer = null;

// Estado de las mecánicas por capacidad: vacío/nulo cuando el mundo
// activo no tiene esa capacidad, sin que el resto del código necesite
// preguntar por el id del mundo.
let obstaculos = [];
let trail = new Map(); // "x,y" -> tick en que deja de ser mortal
let gusano = null;
let plaga = null;
let jefe = null;
let tickCount = 0;

// ===================== AUDIO =====================
// Todo el sonido sale de Web Audio API generado por código (osciladores
// + nodos de ganancia): sin archivos externos, sin licencias, sin peso
// en el repo. audioCtx se crea/reanuda recién en la primera interacción
// real (ver reanudarAudioSiHaceFalta), porque los navegadores bloquean
// el autoplay. Si el navegador no soporta o bloquea Web Audio, audioCtx
// se queda en null y todas las funciones de sonido no hacen nada: el
// juego sigue funcionando igual, solo mudo.
let audioCtx = null;
let masterGain = null; // controla el mute general
let musicGain = null;  // controla el volumen de la música (para pausa/game over)
let sfxGain = null;
let musicaTimer = null;
let musicaPasoActual = 0;
let musicaBaseFreq = 220;
const MUSICA_MELODIA = [0, 4, 7, 4]; // semitonos relativos: arpegio de 4 notas
const MUSICA_BASES_POR_MUNDO = [220, 233.08, 246.94, 261.63]; // sube medio tono por mundo

function inicializarAudio() {
  if (audioCtx) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  audioCtx = new AudioCtx();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = muted ? 0 : 1;
  masterGain.connect(audioCtx.destination);
  musicGain = audioCtx.createGain();
  musicGain.gain.value = 1;
  musicGain.connect(masterGain);
  sfxGain = audioCtx.createGain();
  sfxGain.gain.value = 1;
  sfxGain.connect(masterGain);
}

function reanudarAudioSiHaceFalta() {
  if (!audioCtx) inicializarAudio();
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}

// Nota corta con envolvente (ataque rápido, caída exponencial). Base de
// todos los efectos y de cada nota de la música.
function reproducirTono({ freq, duracion = 0.12, tipo = "sine", volumen = 0.2, deslizarA = null, retardo = 0, destino = null }) {
  if (!audioCtx || muted) return;
  const salida = destino || sfxGain;
  const t0 = audioCtx.currentTime + retardo;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t0);
  if (deslizarA) osc.frequency.exponentialRampToValueAtTime(Math.max(1, deslizarA), t0 + duracion);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volumen, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duracion);
  osc.connect(gain);
  gain.connect(salida);
  osc.start(t0);
  osc.stop(t0 + duracion + 0.03);
}

function sfxComerSana() {
  reproducirTono({ freq: 700, deslizarA: 1050, duracion: 0.1, tipo: "square", volumen: 0.22 });
}
// Más grave y disonante: dos osciladores desafinados entre sí (baten al
// sonar juntos) descendiendo en tono.
function sfxComerPodrida() {
  reproducirTono({ freq: 180, deslizarA: 90, duracion: 0.22, tipo: "sawtooth", volumen: 0.18 });
  reproducirTono({ freq: 165, deslizarA: 82, duracion: 0.22, tipo: "sawtooth", volumen: 0.12 });
}
function sfxPerderVida() {
  reproducirTono({ freq: 320, deslizarA: 70, duracion: 0.4, tipo: "sawtooth", volumen: 0.24 });
}
function sfxDerrotarJefe() {
  [440, 554.37, 659.25, 880].forEach((freq, i) => {
    reproducirTono({ freq, duracion: 0.18, tipo: "square", volumen: 0.22, retardo: i * 0.12 });
  });
}
function sfxEntrada() {
  reproducirTono({ freq: 523.25, deslizarA: 784, duracion: 0.16, tipo: "triangle", volumen: 0.2 });
}
// Tick suave en cada cambio de dirección: volumen bajo a propósito para
// no cansar en partidas largas.
function sfxMovimiento() {
  reproducirTono({ freq: 520, duracion: 0.035, tipo: "sine", volumen: 0.05 });
}

function frecuenciaDesdeSemitonos(base, semitonos) {
  return base * Math.pow(2, semitonos / 12);
}

function reproducirNotaMusica() {
  if (!audioCtx || muted) return;
  const semitonos = MUSICA_MELODIA[musicaPasoActual % MUSICA_MELODIA.length];
  reproducirTono({
    freq: frecuenciaDesdeSemitonos(musicaBaseFreq, semitonos),
    duracion: 0.32, tipo: "triangle", volumen: 0.5, destino: musicGain
  });
  musicaPasoActual++;
}

// Reinicia el loop de música con un tono base ligeramente distinto por
// mundo (MUSICA_BASES_POR_MUNDO), para que el cambio entre mundos se
// note sin componer una melodía nueva por cada uno.
function iniciarMusicaFondo() {
  if (!audioCtx || musicaTimer) return;
  musicaBaseFreq = MUSICA_BASES_POR_MUNDO[worldIndex % MUSICA_BASES_POR_MUNDO.length];
  musicaPasoActual = 0;
  musicGain.gain.setTargetAtTime(1, audioCtx.currentTime, 0.01);
  reproducirNotaMusica();
  musicaTimer = setInterval(reproducirNotaMusica, 380);
}
function detenerMusicaFondo() {
  if (musicaTimer) { clearInterval(musicaTimer); musicaTimer = null; }
}
function bajarVolumenMusica() {
  if (musicGain && audioCtx) musicGain.gain.setTargetAtTime(0.12, audioCtx.currentTime, 0.25);
}
function restaurarVolumenMusica() {
  if (musicGain && audioCtx) musicGain.gain.setTargetAtTime(1, audioCtx.currentTime, 0.25);
}

function actualizarBotonSonido() {
  if (!soundToggleButton) return;
  soundToggleButton.textContent = muted ? "🔇" : "🔊";
  soundToggleButton.setAttribute("aria-pressed", String(muted));
}
function alternarSonido() {
  reanudarAudioSiHaceFalta();
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 1;
  escribirStorage(STORAGE_KEY_MUTE, muted);
  actualizarBotonSonido();
}
// ===================================================

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Escala la dificultad interna del mundo según el avance de la cosecha
// (0 al entrar, 1 al llegar a la meta). Los mundos con meta infinita
// (Cosecha Infinita) se quedan en su dificultad base porque cosecha/∞
// siempre da 0: es un ajuste pendiente para la fase de balance.
function apretar(w, cosechaActual) {
  const p = Math.min(cosechaActual / w.meta, 1);
  if (w.madura) w.maduraActual = lerp(w.madura, 34, p);
  if (w.gusanoCazador) w.gusanoCada = cosechaActual > w.meta / 2 ? 2 : 3;
  if (w.rastro) w.rastroActual = lerp(w.rastro, 20, p);
}

function resizeCanvas() {
  const rect = boardCard.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const size = Math.floor(Math.min(rect.width, rect.height));
  if (size <= 0) return;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  boardSize = size;
  cell = size / CELLS;
  draw();
}

function crearSerpienteInicial() {
  return [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
    { x: 7, y: 10 }
  ];
}

// Prepara el tablero para el mundo activo (serpiente a 4 segmentos,
// cosecha en 0, vidas al máximo, manzanas nuevas, escalado reiniciado).
// Deja el juego pausado a la espera de la primera dirección.
function prepararTablero() {
  cancelLoop();
  tickCount = 0;
  snake = crearSerpienteInicial();
  direction = "right";
  directionQueue = [];
  running = false;
  paused = false;
  trail = new Map();
  obstaculos = world.obstaculos ? OBSTACULOS_FIJOS.slice(0, world.obstaculos) : [];
  plaga = null;
  jefe = world.jefeFinal ? { fase: 1, mapa: 1, esperandoInicio: true, golpeHasta: 0 } : null;
  gusano = world.jefeFinal ? crearJefeFinal() : (world.gusanoCazador ? crearGusano() : null);
  apples = [];
  for (let i = 0; i < world.manzanas - 1; i++) spawnApple(false);
  spawnApple(true);
  apretar(world, cosecha);
  gameOverScreen.classList.add("hidden");
  pauseScreen.classList.add("hidden");
  transitionScreen.classList.add("hidden");
  bossVictoryScreen.classList.add("hidden");
  updateHud();
  resizeCanvas();
}

function entrarMundo(index) {
  worldIndex = index;
  world = WORLDS[worldIndex];
  score = 0;
  cosecha = 0;
  vidas = VIDAS_POR_MUNDO;
  prepararTablero();
  iniciarMusicaFondo();
}

function esZonaSeguraDeRespawn(pos) {
  const protegidas=[...snake,{x:11,y:10},{x:10,y:9},{x:10,y:11}];
  return protegidas.some(celda=>sameCell(celda,pos));
}

function reubicarObstaculosParaRespawn(guardados) {
  obstaculos=[];
  const ocupadas=new Set(apples.map(apple=>apple.x+","+apple.y));
  function disponible(pos){
    const key=pos.x+","+pos.y;
    return pos.x>=0&&pos.x<CELLS&&pos.y>=0&&pos.y<CELLS&&
      !esZonaSeguraDeRespawn(pos)&&!ocupadas.has(key);
  }
  function celdaCercana(origen){
    if(disponible(origen))return {...origen};
    for(let radio=1;radio<CELLS*2;radio++){
      const candidatas=[];
      for(let dy=-radio;dy<=radio;dy++){
        const dx=radio-Math.abs(dy);
        candidatas.push({x:origen.x+dx,y:origen.y+dy});
        if(dx)candidatas.push({x:origen.x-dx,y:origen.y+dy});
      }
      candidatas.sort((a,b)=>(b.y-origen.y)-(a.y-origen.y));
      const libre=candidatas.find(disponible);
      if(libre)return libre;
    }
    return null;
  }
  guardados.forEach(original=>{
    const destino=celdaCercana(original);
    if(!destino)return;
    obstaculos.push(destino);
    ocupadas.add(destino.x+","+destino.y);
  });
}

function respawnEnMundoActual() {
  const guardados=world.obstaculosPorManzana?obstaculos.map(pos=>({...pos})):null;
  prepararTablero();
  if(guardados){
    reubicarObstaculosParaRespawn(guardados);
    resizeCanvas();
  }
  restaurarVolumenMusica();
}

function guardarProgreso() {
  escribirStorage(STORAGE_KEY_MUNDO_MAX, mundoMax);
  escribirStorage(STORAGE_KEY_MEJOR_PUNTAJE, mejorPuntaje);
}

function registrarPuntaje() {
  if (score > mejorPuntaje) {
    mejorPuntaje = score;
    guardarProgreso();
  }
}

// Reescala tickMs de los 4 mundos (y del jefe) desde tickMsBase con el
// mismo porcentaje, para no romper la relación de velocidad entre
// mundos ni la calibración de cada uno.
function aplicarDificultad(nueva) {
  dificultad = DIFICULTAD_MULTIPLICADOR[nueva] ? nueva : "dificil";
  WORLDS.forEach(w => { w.tickMs = Math.round(w.tickMsBase * DIFICULTAD_MULTIPLICADOR[dificultad]); });
  escribirStorage(STORAGE_KEY_DIFICULTAD, dificultad);
  renderSelectorDificultad();
  actualizarEtiquetaDificultad();
}
function renderSelectorDificultad() {
  if (!difficultySelectEl) return;
  difficultySelectEl.querySelectorAll(".difficulty-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.dificultad === dificultad);
  });
}
function actualizarEtiquetaDificultad() {
  const texto = dificultad === "normal" ? "NORMAL" : "DIFÍCIL";
  if (difficultyLabelEl) difficultyLabelEl.textContent = texto;
  if (pauseDifficultyEl) pauseDifficultyEl.textContent = "Dificultad: " + texto;
}

function renderSelectorDeMundos() {
  worldSelectEl.innerHTML = "";
  WORLDS.forEach((w, i) => {
    const unlocked = MODO_PRUEBAS || w.id <= mundoMax;
    const btn = document.createElement("button");
    btn.type = "button"; btn.disabled = !unlocked;
    btn.className = unlocked ? "world-btn" : "world-btn locked";
    if (w.jefeFinal) btn.classList.add("boss-world");
    const meta = w.jefeFinal ? "BOSS FINAL - " + w.meta + " golpes" : w.meta + " manzanas";
    btn.innerHTML = unlocked
      ? '<span class="world-btn-name">' + (w.jefeFinal ? "&#9733; " : "") + w.nombre + "</span>" + meta
      : '<span class="world-btn-name">&#128274; ' + w.nombre + "</span>bloqueado";
    if (unlocked) btn.addEventListener("click", () => elegirMundo(i));
    worldSelectEl.appendChild(btn);
  });
  bestScoreEl.textContent = mejorPuntaje;
}

function elegirMundo(index) {
  reanudarAudioSiHaceFalta();
  entrarMundo(index);
  sfxEntrada();
  startScreen.classList.add("hidden");
}

function crearGusano() {
  return { segments: [{ x: 10, y: 2 }, { x: 9, y: 2 }, { x: 8, y: 2 }],
    contador: 0, objetivo: null, crecimientoPendiente: 0, modoLetal: false, ticksModoLetal: 0 };
}
function crearJefeFinal() {
  return { segments: Array.from({ length: 16 }, (_, i) => ({ x: 17 - i, y: 2 })),
    contador: 0, objetivo: snake[0], crecimientoPendiente: 0,
    modoLetal: true, ticksModoLetal: 0, esJefe: true };
}

function celdaLibre(pos) {
  if (snake.some(part => sameCell(part, pos))) return false;
  if (apples.some(apple => sameCell(apple, pos))) return false;
  if (obstaculos.some(o => sameCell(o, pos))) return false;
  if (trail.has(`${pos.x},${pos.y}`)) return false;
  if (gusano && gusano.segments.some(seg => sameCell(seg, pos))) return false;
  if (plaga && plaga.cazadores.some(cazador => cazador.segments.some(seg => sameCell(seg, pos)))) return false;
  return true;
}

// Intenta celdas al azar y, si el tablero está saturado (rastro u
// obstáculos), cae a un barrido completo. Si tampoco así hay hueco,
// no agrega manzana este intento en vez de entrar en bucle infinito.
function buscarCeldaLibre() {
  for (let intento = 0; intento < 200; intento++) {
    const candidato = { x: Math.floor(Math.random() * CELLS), y: Math.floor(Math.random() * CELLS) };
    if (celdaLibre(candidato)) return candidato;
  }
  const libres = [];
  for (let x = 0; x < CELLS; x++) {
    for (let y = 0; y < CELLS; y++) {
      if (celdaLibre({ x, y })) libres.push({ x, y });
    }
  }
  return libres.length ? libres[Math.floor(Math.random() * libres.length)] : null;
}

function spawnApple(worm) {
  const position = buscarCeldaLibre(); if (!position) return;
  const dirs = Object.values(DIR_VECTORS);
  apples.push({ ...position, worm, bornTick: tickCount,
    moveDir: dirs[Math.floor(Math.random() * dirs.length)],
    visualX: position.x, visualY: position.y });
}
function agregarObstaculosAleatorios(cantidad) {
  for (let i = 0; i < cantidad; i++) {
    const p = buscarCeldaLibre(); if (!p) break; obstaculos.push(p);
  }
}
function celdaLibreParaManzana(pos, actual) {
  if (pos.x < 0 || pos.x >= CELLS || pos.y < 0 || pos.y >= CELLS) return false;
  if (snake.some(x => sameCell(x,pos)) || obstaculos.some(x => sameCell(x,pos))) return false;
  if (trail.has(pos.x + "," + pos.y) || apples.some(x => x !== actual && sameCell(x,pos))) return false;
  return !(gusano && gusano.segments.some(x => sameCell(x,pos)));
}
function actualizarManzanasMoviles() {
  if (!world.manzanasMoviles || !jefe) return;
  const cada = jefe.fase === 1 ? 8 : jefe.fase === 2 ? 7 : 6;
  if (tickCount % cada) return;
  apples.forEach(apple => {
    const otros = Object.values(DIR_VECTORS).filter(d => d !== apple.moveDir).sort(() => Math.random()-.5);
    for (const dir of [apple.moveDir, ...otros]) {
      const pos = { x: apple.x + dir.x, y: apple.y + dir.y };
      if (!celdaLibreParaManzana(pos, apple)) continue;
      apple.x=pos.x; apple.y=pos.y; apple.moveDir=dir; break;
    }
  });
}

function encolarDir(dirName) {
  if (plaga&&plaga.estado==="cuenta") return;
  if (paused || !startScreen.classList.contains("hidden") ||
      !gameOverScreen.classList.contains("hidden") ||
      !transitionScreen.classList.contains("hidden") ||
      !bossVictoryScreen.classList.contains("hidden")) return;
  if (!DIR_VECTORS[dirName]) return;
  if (world.jefeFinal && jefe && jefe.esperandoInicio) {
    jefe.esperandoInicio = false;
    const referenciaInicial = directionQueue.length ? directionQueue[directionQueue.length - 1] : direction;
    if (dirName !== referenciaInicial && dirName !== OPPOSITE[referenciaInicial]) { directionQueue.push(dirName); sfxMovimiento(); }
    startGame();
    return;
  }
  const referencia = directionQueue.length ? directionQueue[directionQueue.length - 1] : direction;
  if (dirName === referencia || dirName === OPPOSITE[referencia]) return;
  if (directionQueue.length >= 2) return;
  directionQueue.push(dirName);
  sfxMovimiento();
  startGame();
}

function startGame() {
  if (running) return;
  running = true;
  last = performance.now();
  acc = 0;
  rafId = requestAnimationFrame(frame);
}

function cancelLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}
function pausarJuego(){if(!running||paused)return;paused=true;cancelLoop();bajarVolumenMusica();pauseScreen.classList.remove("hidden");}
function reanudarJuego(){if(!paused)return;paused=false;pauseScreen.classList.add("hidden");restaurarVolumenMusica();last=performance.now();acc=0;rafId=requestAnimationFrame(frame);}
function alternarPausa(){if(paused)reanudarJuego();else pausarJuego();}
function volverAlSelectorDeMundos(){
  cancelLoop();running=false;paused=false;directionQueue=[];pauseScreen.classList.add("hidden");
  bossVictoryScreen.classList.add("hidden");detenerMusicaFondo();renderSelectorDeMundos();startScreen.classList.remove("hidden");
}

function frame(now) {
  const dt = Math.min(now - last, 250);
  acc += dt;
  last = now;
  while (acc >= world.tickMs) {
    update();
    acc -= world.tickMs;
    if (!running) break;
  }
  draw();
  if (running && !paused) {
    rafId = requestAnimationFrame(frame);
  } else {
    rafId = null;
  }
}

// Mundo 1: cada manzana sana lleva su reloj de maduración; al agotarse
// se pudre sola (se vuelve manzana con gusano) sin intervención del
// jugador.
function actualizarMaduracion() {
  if (!world.madura) return;
  apples.forEach(apple => {
    if (!apple.worm && tickCount - apple.bornTick >= world.maduraActual) {
      apple.worm = true;
    }
  });
}

function activarInvasionHuerto() {
  if (!world.invasionHuerto || plaga || !apples.length || !apples.every(apple => apple.worm)) return;
  const esquinas = [
    Array.from({length:9},(_,i)=>({x:0,y:i})),
    Array.from({length:9},(_,i)=>({x:CELLS-1,y:i})),
    Array.from({length:9},(_,i)=>({x:0,y:CELLS-1-i})),
    Array.from({length:9},(_,i)=>({x:CELLS-1,y:CELLS-1-i}))
  ];
  plaga = {
    estado: "cuenta",
    cuentaHasta: tickCount + Math.round(3000 / world.tickMs),
    inicio: null,
    duracion: Math.round(10000 / world.tickMs),
    cazadores: Array.from({length:3}, (_,index) => ({
      segments: esquinas[Math.floor(Math.random()*4)].map(pos=>({...pos})),
      orden:index, objetivo:snake[0]
    }))
  };
  directionQueue=[];
  updateHud();
}

function siguientePasoPlaga(cazador, objetivo) {
  const origen=cazador.segments[0], cola=[{pos:origen,primero:null}];
  const vistos=new Set([origen.x+","+origen.y]);
  const dirs=Object.values(DIR_VECTORS);
  const giro=(cazador.orden+tickCount)%dirs.length;
  const ordenadas=dirs.slice(giro).concat(dirs.slice(0,giro));
  for(let i=0;i<cola.length;i++){
    for(const dir of ordenadas){
      const pos={x:cola[i].pos.x+dir.x,y:cola[i].pos.y+dir.y}, key=pos.x+","+pos.y;
      if(pos.x<0||pos.x>=CELLS||pos.y<0||pos.y>=CELLS||vistos.has(key))continue;
      const ataca=sameCell(pos,objetivo);
      if(obstaculos.some(x=>sameCell(x,pos))||
         (snake.some(x=>sameCell(x,pos))&&!ataca)||
         cazador.segments.slice(0,-1).some(x=>sameCell(x,pos)))continue;
      const primero=cola[i].primero||pos;
      if(ataca)return primero;
      vistos.add(key);cola.push({pos,primero});
    }
  }
  return null;
}

function actualizarPlaga() {
  if(!plaga)return false;
  if(plaga.estado==="cuenta"){
    if(tickCount>=plaga.cuentaHasta){plaga.estado="caza";plaga.inicio=tickCount;}
    updateHud();return false;
  }
  if(tickCount-plaga.inicio>=plaga.duracion){
    const podridas=apples.filter(apple=>apple.worm);
    if(podridas.length){
      const sana=podridas[Math.floor(Math.random()*podridas.length)];
      sana.worm=false;sana.bornTick=tickCount;
    }
    plaga=null;updateHud();return false;
  }
  updateHud();
  const pasoVelocidad=tickCount%5;
  if(pasoVelocidad===0||pasoVelocidad===3)return false;
  for(const cazador of plaga.cazadores){
    cazador.objetivo=snake[0];
    const paso=siguientePasoPlaga(cazador,snake[0]);
    if(!paso)continue;
    cazador.segments.unshift(paso);cazador.segments.pop();
    if(snake.some(x=>sameCell(x,paso)))return true;
  }
  return false;
}

// Mundo 3: purga las celdas de rastro ya vencidas. Solo recorre las
// entradas activas del Map, nunca la cuadrícula completa.
function purgarRastro() {
  if (!trail.size) return;
  for (const [key, expira] of trail) {
    if (expira <= tickCount) trail.delete(key);
  }
}

function manzanaMasCercana(desde) {
  let mejor=null,dist=Infinity;
  apples.forEach(a=>{const d=Math.abs(a.x-desde.x)+Math.abs(a.y-desde.y);if(d<dist){dist=d;mejor=a;}});
  return mejor;
}
function normalizarPaso(pos) {
  if (world.muros !== "wrap") return pos;
  return { x:(pos.x+CELLS)%CELLS, y:(pos.y+CELLS)%CELLS };
}
function celdaLibreParaGusano(pos, objetivo) {
  if (pos.x<0||pos.x>=CELLS||pos.y<0||pos.y>=CELLS) return false;
  const ataca=gusano.modoLetal&&objetivo&&sameCell(pos,objetivo);
  if (snake.some(x=>sameCell(x,pos))&&!ataca) return false;
  if (obstaculos.some(x=>sameCell(x,pos))) return false;
  return !gusano.segments.slice(0,-1).some(x=>sameCell(x,pos));
}
function siguientePasoGusano(objetivo) {
  const origen=gusano.segments[0],cola=[{pos:origen,primero:null}],vistos=new Set([origen.x+","+origen.y]);
  for(let i=0;i<cola.length;i++){
    for(const dir of Object.values(DIR_VECTORS)){
      const pos=normalizarPaso({x:cola[i].pos.x+dir.x,y:cola[i].pos.y+dir.y}),k=pos.x+","+pos.y;
      if(vistos.has(k)||!celdaLibreParaGusano(pos,objetivo))continue;
      const primero=cola[i].primero||pos;if(sameCell(pos,objetivo))return primero;
      vistos.add(k);cola.push({pos,primero});
    }
  }
  return null;
}
function moverGusano(objetivo, come=true) {
  gusano.objetivo=objetivo;if(!objetivo)return false;
  const paso=siguientePasoGusano(objetivo);if(!paso)return false;
  gusano.segments.unshift(paso);
  const ai=apples.findIndex(a=>sameCell(a,paso));
  if(ai>=0&&come){
    const comida=apples.splice(ai,1)[0];
    spawnApple(world.jefeFinal?comida.worm:true);
    if(!world.jefeFinal)gusano.crecimientoPendiente+=2;
  }
  if(gusano.crecimientoPendiente>0)gusano.crecimientoPendiente--;else gusano.segments.pop();
  return gusano.modoLetal&&snake.some(x=>sameCell(x,paso));
}
function actualizarGusano() {
  if(!world.gusanoCazador||!gusano)return false;
  if(world.jefeFinal){
    gusano.contador++;const cada=jefe.fase===1?3:jefe.fase===2?2:1;
    if(gusano.contador<cada)return false;gusano.contador=0;
    const cola={...gusano.segments[gusano.segments.length-1]};
    const hit=moverGusano(snake[0],true);
    if(jefe.fase===3)trail.set(cola.x+","+cola.y,tickCount+8);
    return hit;
  }
  if(!gusano.modoLetal&&apples.length&&apples.every(a=>a.worm)){
    gusano.modoLetal=true;gusano.contador=0;gusano.ticksModoLetal=0;updateHud();
  }
  if(gusano.modoLetal){
    gusano.ticksModoLetal++;
    if(gusano.ticksModoLetal>=Math.round(1000/world.tickMs)){gusano.ticksModoLetal=0;gusano.crecimientoPendiente++;}
    const pasos=gusano.contador++%2===0?2:1;
    for(let i=0;i<pasos;i++)if(moverGusano(snake[0],false))return true;
    return false;
  }
  if(++gusano.contador<3)return false;gusano.contador=0;
  return moverGusano(manzanaMasCercana(gusano.segments[0]),true);
}
function activarMapaNucleo() {
  obstaculos=OBSTACULOS_FIJOS.filter(p=>!snake.some(x=>sameCell(x,p))&&!apples.some(x=>sameCell(x,p))&&!gusano.segments.some(x=>sameCell(x,p)));
  agregarObstaculosAleatorios(4-obstaculos.length);
}
function golpearJefe() {
  jefe.golpeHasta=tickCount+4;if(gusano.segments.length>4)gusano.segments.pop();
  const fase=cosecha>=12?3:cosecha>=6?2:1;if(fase===jefe.fase)return;
  jefe.fase=fase;jefe.esperandoInicio=true;gusano.contador=0;directionQueue=[];
  if(fase===2){jefe.mapa=2;activarMapaNucleo();}
  if(fase===3){const cola=gusano.segments[gusano.segments.length-1];for(let i=0;i<4;i++)gusano.segments.push({...cola});}
  updateHud();
}

function update() {
  tickCount++; purgarRastro(); actualizarMaduracion(); activarInvasionHuerto();
  if(jefe&&jefe.estado==="destruccion"){
    if(tickCount>=jefe.destruccionHasta)iniciarDominioInfinito();
    return;
  }
  if(jefe&&jefe.esperandoInicio)return;
  actualizarManzanasMoviles();
  if(actualizarGusano())return endGame();
  if(actualizarPlaga())return endGame();
  if(!running||plaga&&plaga.estado==="cuenta")return;
  if(directionQueue.length)direction=directionQueue.shift();
  const v=DIR_VECTORS[direction];let head={x:snake[0].x+v.x,y:snake[0].y+v.y};
  if(world.muros==="wrap")head=normalizarPaso(head);
  const fuera=world.muros!=="wrap"&&(head.x<0||head.x>=CELLS||head.y<0||head.y>=CELLS);
  const hitGusano=gusano&&gusano.modoLetal&&gusano.segments.some(x=>sameCell(x,head));
  const hitPlaga=plaga&&plaga.cazadores.some(c=>c.segments.some(x=>sameCell(x,head)));
  if(fuera||snake.some(x=>sameCell(x,head))||obstaculos.some(x=>sameCell(x,head))||trail.has(head.x+","+head.y)||hitGusano||hitPlaga)return endGame();
  snake.unshift(head);
  const ai=apples.findIndex(a=>sameCell(a,head));
  if(ai<0){const cola=snake.pop();if(world.rastro)trail.set(cola.x+","+cola.y,tickCount+world.rastroActual);return;}
  const eaten=apples.splice(ai,1)[0];
  const dominioInfinito=world.jefeFinal&&jefe&&jefe.estado==="infinito";
  if(eaten.worm&&!dominioInfinito){
    const antes=snake.length-1;snake.length=Math.max(2,Math.ceil(antes/2));
    score=Math.max(0,score-5);cosecha=Math.max(0,cosecha-1);
    sfxComerPodrida();
  }else if(dominioInfinito){
    score+=10;
    sfxComerSana();
  }else{
    score+=world.jefeFinal?25:10;cosecha++;if(world.jefeFinal)golpearJefe();
    sfxComerSana();
  }
  apretar(world,cosecha);
  if(dominioInfinito&&snake.length>=CELLS*CELLS)return completarVictoriaFinal();
  spawnApple(world.jefeFinal?false:eaten.worm);
  agregarObstaculosAleatorios(world.obstaculosPorManzana||0);
  registrarPuntaje();updateHud();
  if(!dominioInfinito&&cosecha>=world.meta)completarMundo();
}
function iniciarDestruccionJefe(){
  directionQueue=[];
  jefe.estado="destruccion";
  jefe.destruccionInicio=tickCount;
  jefe.destruccionHasta=tickCount+Math.round(2800/world.tickMs);
  jefe.restos=gusano?gusano.segments.map(x=>({...x})):[];
  gusano=null;obstaculos=[];trail.clear();sfxDerrotarJefe();updateHud();
}
function iniciarDominioInfinito(){
  jefe.estado="infinito";jefe.fase=4;jefe.mapa=1;jefe.esperandoInicio=true;
  directionQueue=[];obstaculos=[];trail.clear();
  apples.forEach(apple=>{apple.worm=false;apple.bornTick=tickCount;});
  while(apples.length<world.manzanas)spawnApple(false);
  updateHud();
}
function completarVictoriaFinal(){
  running=false;directionQueue=[];registrarPuntaje();updateHud();
  bossVictoryScreen.classList.remove("hidden");
}
function completarMundo() {
  directionQueue=[];
  if(world.jefeFinal){iniciarDestruccionJefe();return;}
  running=false;
  const siguiente=worldIndex+1;if(siguiente>=WORLDS.length)return;
  mundoMax=Math.max(mundoMax,WORLDS[siguiente].id);guardarProgreso();
  nextWorldNameEl.textContent=WORLDS[siguiente].nombre;nextWorldTipEl.textContent=WORLDS[siguiente].tip;
  transitionScreen.classList.remove("hidden");transitionTimer=setTimeout(avanzarMundo,2000);
}
function avanzarMundo(){clearTimeout(transitionTimer);entrarMundo(worldIndex+1);}
function reiniciarDesdeElHuerto(){
  if(!MODO_PRUEBAS){mundoMax=1;guardarProgreso();}
  entrarMundo(0);renderSelectorDeMundos();startScreen.classList.remove("hidden");
}
function endGame(){
  running=false;directionQueue=[];vidas--;
  sfxPerderVida();bajarVolumenMusica();
  if(vidas>0){
    gameOverTitleEl.textContent="OUCH!";
    finalScore.textContent="Vida perdida - "+vidas+(vidas===1?" vida restante":" vidas restantes");
    restartButton.textContent="SEGUIR";
  }else{
    registrarPuntaje();gameOverTitleEl.textContent="FIN DE LA CAMPANA";
    finalScore.textContent="Te quedaste sin vidas. Vuelves al inicio.";
    restartButton.textContent="VOLVER AL INICIO";
    detenerMusicaFondo();
  }
  updateHud();gameOverScreen.classList.remove("hidden");
}
restartButton.addEventListener("click",()=>{
  gameOverScreen.classList.add("hidden");
  if(vidas<=0)reiniciarDesdeElHuerto();else respawnEnMundoActual();
});
function updateHud(){
  const esFinal=world.jefeFinal&&jefe;
  bossMeter.classList.toggle("hidden",!esFinal);
  if(esFinal&&jefe.estado==="infinito"){
    const objetivo=CELLS*CELLS;
    worldNameEl.textContent="Dominio Infinito";
    harvestEl.textContent=snake.length+"/"+objetivo;
    bossMeter.classList.add("infinite");
    bossMeterLabel.textContent="DOMINIO INFINITO";
    bossMeterValue.textContent=snake.length+"/"+objetivo;
    bossMeterFill.style.width=(snake.length/objetivo*100)+"%";
  }else if(esFinal&&jefe.estado==="destruccion"){
    worldNameEl.textContent="JEFE DESTRUIDO";
    harvestEl.textContent=world.meta+"/"+world.meta;
    bossMeter.classList.remove("infinite");
    bossMeterLabel.textContent="JEFE DESTRUIDO";
    bossMeterValue.textContent="0/"+world.meta;
    bossMeterFill.style.width="0%";
  }else{
    const cuentaPlaga=plaga&&plaga.estado==="cuenta";
    const segundosPlaga=plaga?cuentaPlaga?
      Math.max(1,Math.ceil((plaga.cuentaHasta-tickCount)*world.tickMs/1000)):
      Math.max(0,Math.ceil((plaga.duracion-(tickCount-plaga.inicio))*world.tickMs/1000)):0;
    worldNameEl.textContent=esFinal?world.nombre+" - FASE "+jefe.fase:
      cuentaPlaga?world.nombre+" - HUERTO INFECTADO "+segundosPlaga:
      plaga?world.nombre+" - INVASION "+segundosPlaga+"s":
      gusano&&gusano.modoLetal?world.nombre+" - CAZADOR LETAL":world.nombre;
    harvestEl.textContent=cosecha+"/"+world.meta;
    if(esFinal){
      const vida=Math.max(0,world.meta-cosecha);
      bossMeter.classList.remove("infinite");
      bossMeterLabel.textContent="VIDA DEL CORAZON";
      bossMeterValue.textContent=vida+"/"+world.meta;
      bossMeterFill.style.width=(vida/world.meta*100)+"%";
    }
  }
  livesEl.textContent=vidas;scoreEl.textContent=score;bestScoreEl.textContent=mejorPuntaje;
}

function sameCell(a, b) {
  return a.x === b.x && a.y === b.y;
}

function roundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function draw() {
  if (!cell) return;
  ctx.clearRect(0, 0, boardSize, boardSize);
  ctx.fillStyle = world.jefeFinal && jefe ? (jefe.mapa === 1 ? "#0d1017" : "#160b08") : "#07111d";
  ctx.fillRect(0, 0, boardSize, boardSize);

  ctx.strokeStyle = world.jefeFinal ? (jefe && jefe.mapa === 2 ? "#352016" : "#242532") : "#102030";
  ctx.lineWidth = 1;
  for (let i = 1; i < CELLS; i++) {
    const p = i * cell;
    ctx.beginPath();
    ctx.moveTo(p, 0); ctx.lineTo(p, boardSize);
    ctx.moveTo(0, p); ctx.lineTo(boardSize, p);
    ctx.stroke();
  }

  obstaculos.forEach(drawObstaculo);
  trail.forEach((expira, key) => drawRastro(key, expira));
  apples.forEach(drawApple);
  drawGusano();
  drawPlaga();
  snake.forEach((part, index) => drawSnakePart(part, index === 0));
  drawEstadoPlaga();
  drawEstadoJefe();
}

function drawObstaculo(pos) {
  const x=pos.x*cell+cell*.06,y=pos.y*cell+cell*.06,size=cell*.88;
  ctx.save();ctx.shadowColor="#ff3a1d";ctx.shadowBlur=cell*.22;
  roundedRect(x,y,size,size,cell*.13);
  const g=ctx.createLinearGradient(x,y,x+size,y+size);
  g.addColorStop(0,"#31130f");g.addColorStop(.5,"#7a2819");g.addColorStop(1,"#1b0b09");
  ctx.fillStyle=g;ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle="#ff4938";ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle="#ffd15c";ctx.font="bold "+Math.max(13,cell*.55)+"px system-ui";
  ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("!",x+size/2,y+size/2);ctx.restore();
}

// Mundo 3: opacidad decreciente conforme la celda está por liberarse,
// para que el jugador vea qué va a dejar de ser mortal pronto.
function drawRastro(key, expira) {
  const p=key.split(","),restante=Math.max(0,expira-tickCount);
  const duracion=world.jefeFinal?8:world.rastroActual,opacidad=Math.min(1,restante/duracion)*.68;
  ctx.fillStyle=world.jefeFinal?"rgba(255,82,20,"+opacidad+")":"rgba(120,200,90,"+opacidad+")";
  ctx.fillRect(Number(p[0])*cell,Number(p[1])*cell,cell,cell);
}

function drawGusano() {
  if(!world.gusanoCazador||!gusano)return;
  if(gusano.objetivo&&!gusano.esJefe){
    const h=gusano.segments[0];ctx.save();ctx.setLineDash([4,5]);
    ctx.strokeStyle=gusano.modoLetal?"rgba(255,55,48,.8)":"rgba(220,190,90,.65)";
    ctx.beginPath();ctx.moveTo((h.x+.5)*cell,(h.y+.5)*cell);
    ctx.lineTo((gusano.objetivo.x+.5)*cell,(gusano.objetivo.y+.5)*cell);ctx.stroke();ctx.restore();
  }
  const pal=gusano.esJefe?{head:"#ff9a20",body:"#ef6416",stroke:"#160b08"}:
    gusano.modoLetal?{head:"#ff3b30",body:"#b51f2e",stroke:"#68121b"}:
    {head:"#a87939",body:"#7a542b",stroke:"#4a3018"};
  if(gusano.esJefe){ctx.save();ctx.shadowColor="#ff7116";ctx.shadowBlur=cell*(.22+Math.sin(performance.now()/120)*.08);}
  gusano.segments.forEach((seg,i)=>{
    const inset=i===0?cell*.067:cell*.133,x=seg.x*cell+inset,y=seg.y*cell+inset,size=cell-inset*2;
    roundedRect(x,y,size,size,i===0?cell*.267:cell*.167);
    ctx.fillStyle=gusano.esJefe&&i>0&&i%2===0?"#17100d":(i===0?pal.head:pal.body);
    ctx.fill();ctx.strokeStyle=gusano.esJefe&&i>0&&i%2===0?"#ff7a18":pal.stroke;ctx.lineWidth=2;ctx.stroke();
    if(i===0){ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(x+size*.7,y+size*.3,cell*.14,0,Math.PI*2);ctx.arc(x+size*.7,y+size*.7,cell*.14,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#090302";ctx.beginPath();ctx.arc(x+size*.75,y+size*.3,cell*.055,0,Math.PI*2);ctx.arc(x+size*.75,y+size*.7,cell*.055,0,Math.PI*2);ctx.fill();}
  });
  if(gusano.esJefe)ctx.restore();
}
function drawPlaga() {
  if(!plaga||plaga.estado==="cuenta")return;
  plaga.cazadores.forEach((cazador,ci)=>{
    cazador.segments.forEach((seg,i)=>{
      const inset=i===0?cell*.067:cell*.133;
      const x=seg.x*cell+inset,y=seg.y*cell+inset,size=cell-inset*2;
      ctx.save();ctx.shadowColor="#ff2a20";ctx.shadowBlur=cell*(.18+(ci%2)*.05);
      roundedRect(x,y,size,size,i===0?cell*.267:cell*.167);
      ctx.fillStyle=i===0?"#ff3b30":"#b51f2e";ctx.fill();
      ctx.shadowBlur=0;ctx.strokeStyle="#68121b";ctx.lineWidth=2;ctx.stroke();
      if(i===0){
        ctx.fillStyle="#fff";ctx.beginPath();
        ctx.arc(x+size*.7,y+size*.3,cell*.14,0,Math.PI*2);
        ctx.arc(x+size*.7,y+size*.7,cell*.14,0,Math.PI*2);ctx.fill();
        ctx.fillStyle="#160202";ctx.beginPath();
        ctx.arc(x+size*.76,y+size*.3,cell*.06,0,Math.PI*2);
        ctx.arc(x+size*.76,y+size*.7,cell*.06,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    });
  });
}

function drawEstadoPlaga(){
  if(!plaga)return;
  const ahora=performance.now();
  ctx.save();ctx.textAlign="center";ctx.textBaseline="middle";
  if(plaga.estado==="cuenta"){
    const restanteMs=Math.max(0,(plaga.cuentaHasta-tickCount)*world.tickMs);
    const restante=Math.max(1,Math.ceil(restanteMs/1000));
    const pulso=.5+Math.sin(ahora/120)*.18;
    const fondo=ctx.createRadialGradient(boardSize/2,boardSize*.52,cell,boardSize/2,boardSize*.52,boardSize*.72);
    fondo.addColorStop(0,"rgba(55,7,12,.91)");fondo.addColorStop(.58,"rgba(11,7,12,.94)");
    fondo.addColorStop(1,"rgba(2,5,8,.98)");ctx.fillStyle=fondo;ctx.fillRect(0,0,boardSize,boardSize);

    for(let i=0;i<28;i++){
      const angulo=i*2.399+ahora*.00012*(1+i%3);
      const radio=cell*(2.2+(i%9)*.72);
      const x=boardSize/2+Math.cos(angulo)*radio;
      const y=boardSize*.53+Math.sin(angulo)*radio*.72;
      const tam=cell*(.045+(i%4)*.026);
      ctx.globalAlpha=.18+(i%5)*.075;
      ctx.fillStyle=i%3===0?"#9dcf35":i%3===1?"#ff4038":"#ff9b32";
      ctx.beginPath();ctx.arc(x,y,tam,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;

    const onda=(ahora%900)/900;
    for(let i=0;i<3;i++){
      const r=cell*(1.2+((onda+i/3)%1)*5.2);
      ctx.strokeStyle="rgba(255,55,45,"+(Math.max(0,.28-r/(cell*22)))+")";
      ctx.lineWidth=Math.max(1,cell*.05);ctx.beginPath();ctx.arc(boardSize/2,boardSize*.56,r,0,Math.PI*2);ctx.stroke();
    }

    plaga.cazadores.forEach((cazador,index)=>{
      const h=cazador.segments[0],cx=(h.x+.5)*cell,cy=(h.y+.5)*cell;
      ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.PI/4);
      ctx.shadowColor="#ff3028";ctx.shadowBlur=cell*(.25+pulso*.25);
      ctx.fillStyle="rgba(255,47,40,.9)";ctx.fillRect(-cell*.31,-cell*.31,cell*.62,cell*.62);
      ctx.strokeStyle="#ffd05b";ctx.lineWidth=2;ctx.strokeRect(-cell*.31,-cell*.31,cell*.62,cell*.62);
      ctx.restore();ctx.fillStyle="#fff";ctx.font="bold "+Math.max(12,cell*.46)+"px monospace";
      ctx.fillText("!",cx,cy);ctx.fillStyle="#ffb23f";ctx.font="bold "+Math.max(9,cell*.28)+"px monospace";
      ctx.fillText(String(index+1),cx,cy+cell*.58);
    });

    const pillX=boardSize*.25,pillY=boardSize*.105,pillW=boardSize*.5,pillH=cell*.72;
    roundedRect(pillX,pillY,pillW,pillH,cell*.3);ctx.fillStyle="rgba(255,58,45,.15)";ctx.fill();
    ctx.strokeStyle="rgba(255,92,58,.65)";ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle="#ffbd63";ctx.font="bold "+Math.max(10,cell*.34)+"px monospace";
    ctx.fillText("EVENTO DE SUPERVIVENCIA",boardSize/2,pillY+pillH/2);

    ctx.shadowColor="#ff322b";ctx.shadowBlur=cell*.32;ctx.fillStyle="#ff5145";
    ctx.font="bold "+Math.max(26,cell*.93)+"px Georgia";
    ctx.fillText("\u00a1EL HUERTO FUE INFECTADO!",boardSize/2,boardSize*.29);ctx.shadowBlur=0;
    ctx.fillStyle="#f4d6bd";ctx.font="bold "+Math.max(11,cell*.4)+"px monospace";
    ctx.fillText("LA PLAGA HA CORROMPIDO TODAS LAS MANZANAS",boardSize/2,boardSize*.37);

    const cx=boardSize/2,cy=boardSize*.56,r=cell*1.28;
    ctx.fillStyle="rgba(3,5,9,.92)";ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#5d1518";ctx.lineWidth=cell*.18;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
    const fraccion=((Math.max(1,restanteMs)-1)%1000+1)/1000;
    ctx.strokeStyle="#ff493d";ctx.lineCap="round";ctx.shadowColor="#ff3028";ctx.shadowBlur=cell*.28;
    ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*fraccion);ctx.stroke();
    ctx.shadowBlur=0;ctx.fillStyle="#fff";ctx.font="bold "+Math.max(60,cell*2.35)+"px Georgia";
    ctx.fillText(String(restante),cx,cy-cell*.08);
    ctx.fillStyle="#ffbd63";ctx.font="bold "+Math.max(9,cell*.29)+"px monospace";ctx.fillText("SEGUNDOS",cx,cy+cell*.78);

    const chipY=boardSize*.76,chipH=cell*.9,gap=cell*.28,chipW=boardSize*.31;
    [boardSize/2-chipW-gap/2,boardSize/2+gap/2].forEach((x,i)=>{
      roundedRect(x,chipY,chipW,chipH,cell*.18);ctx.fillStyle=i?"rgba(255,142,35,.12)":"rgba(255,53,45,.13)";ctx.fill();
      ctx.strokeStyle=i?"#c87928":"#b83232";ctx.lineWidth=1.5;ctx.stroke();
      ctx.fillStyle=i?"#ffc65a":"#ff8277";ctx.font="bold "+Math.max(10,cell*.32)+"px monospace";
      ctx.fillText(i?"RESISTE 10 s":"3 CAZADORES GIGANTES",x+chipW/2,chipY+chipH/2);
    });
    ctx.strokeStyle="rgba(255,48,40,"+(.58+pulso*.35)+")";ctx.lineWidth=Math.max(4,cell*.16);
    ctx.shadowColor="#ff2f28";ctx.shadowBlur=cell*.5;
    ctx.strokeRect(cell*.18,cell*.18,boardSize-cell*.36,boardSize-cell*.36);
  }else{
    const transcurrido=Math.max(0,tickCount-plaga.inicio);
    const restante=Math.max(0,Math.ceil((plaga.duracion-transcurrido)*world.tickMs/1000));
    const progreso=Math.max(0,1-transcurrido/plaga.duracion);
    ctx.fillStyle="rgba(70,0,5,.13)";ctx.fillRect(0,0,boardSize,boardSize);
    for(let i=0;i<5;i++){
      const y=(ahora*.035+i*boardSize/5)%boardSize;
      ctx.fillStyle="rgba(255,44,34,.025)";ctx.fillRect(0,y,boardSize,cell*.34);
    }
    ctx.strokeStyle="rgba(255,45,35,"+(.48+Math.sin(ahora/150)*.14)+")";
    ctx.lineWidth=Math.max(3,cell*.12);ctx.strokeRect(cell*.1,cell*.1,boardSize-cell*.2,boardSize-cell*.2);

    const cx=boardSize/2,cy=cell*1.35,r=cell*.86;
    ctx.fillStyle="rgba(4,6,10,.94)";ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#5d1518";ctx.lineWidth=cell*.14;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle="#ff4036";ctx.shadowColor="#ff3028";ctx.shadowBlur=cell*.25;ctx.lineCap="round";
    ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*progreso);ctx.stroke();ctx.shadowBlur=0;
    ctx.fillStyle="#ff8b69";ctx.font="bold "+Math.max(8,cell*.25)+"px monospace";ctx.fillText("PLAGA",cx,cy-cell*.35);
    ctx.fillStyle="#fff";ctx.font="bold "+Math.max(20,cell*.72)+"px monospace";ctx.fillText(String(restante),cx,cy+cell*.17);
    if(transcurrido<Math.round(1400/world.tickMs)){
      const alfa=Math.max(0,1-transcurrido/Math.round(1400/world.tickMs));
      ctx.globalAlpha=alfa;ctx.shadowColor="#ff3028";ctx.shadowBlur=cell*.4;ctx.fillStyle="#ff5649";
      ctx.font="bold "+Math.max(34,cell*1.25)+"px Georgia";
      ctx.fillText("\u00a1SOBREVIVE!",boardSize/2,boardSize*.5);ctx.globalAlpha=1;
    }
  }
  ctx.restore();
}

function drawEstadoJefe(){
  if(!world.jefeFinal||!jefe)return;
  if(jefe.estado==="destruccion"){
    const total=Math.max(1,jefe.destruccionHasta-jefe.destruccionInicio);
    const progreso=Math.min(1,(tickCount-jefe.destruccionInicio)/total);
    ctx.save();
    ctx.fillStyle="rgba(18,4,0,"+(0.35+progreso*.45)+")";ctx.fillRect(0,0,boardSize,boardSize);
    (jefe.restos||[]).forEach((resto,i)=>{
      const pulso=Math.max(0,1-progreso),radio=cell*(.35+progreso*(1.4+(i%3)*.3));
      ctx.shadowColor=i%2===0?"#ff7a18":"#ffd04a";ctx.shadowBlur=cell*(1+progreso*2);
      ctx.fillStyle=i%2===0?"rgba(255,80,12,"+pulso+")":"rgba(255,190,45,"+pulso+")";
      ctx.beginPath();ctx.arc((resto.x+.5)*cell,(resto.y+.5)*cell,radio,0,Math.PI*2);ctx.fill();
    });
    ctx.shadowColor="#ff5a0a";ctx.shadowBlur=cell*.8;ctx.fillStyle="#ff9a27";
    ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="bold "+Math.max(30,cell*1.35)+"px Georgia";
    ctx.fillText("JEFE DESTRUIDO",boardSize/2,boardSize*.46);
    ctx.shadowBlur=0;ctx.fillStyle="#fff1d0";ctx.font="bold "+Math.max(13,cell*.48)+"px monospace";
    ctx.fillText("EL DOMINIO INFINITO SE ABRE...",boardSize/2,boardSize*.58);
    ctx.restore();return;
  }
  if(jefe.estado==="infinito"){
    if(jefe.esperandoInicio){
      ctx.save();
      ctx.fillStyle="rgba(2,8,5,.88)";ctx.fillRect(0,0,boardSize,boardSize);
      ctx.fillStyle="#b8ef45";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.font="bold "+Math.max(28,cell*1.2)+"px Georgia";
      ctx.fillText("DOMINIO INFINITO",boardSize/2,boardSize*.4);
      ctx.fillStyle="#ffffff";ctx.font="bold "+Math.max(13,cell*.46)+"px monospace";
      ctx.fillText("LLENA LAS 400 CASILLAS PARA GANAR",boardSize/2,boardSize*.53);
      ctx.fillStyle="#ffc65a";ctx.fillText("PULSA UNA FLECHA PARA INICIAR",boardSize/2,boardSize*.65);
      ctx.restore();
    }
    return;
  }
  ctx.save();
  if(tickCount<=jefe.golpeHasta){ctx.fillStyle="rgba(255,122,24,.2)";ctx.fillRect(0,0,boardSize,boardSize);}
  if(jefe.esperandoInicio){
    const names={1:["FASE I","EL JARDIN NEGRO"],2:["FASE II","NUCLEO INCENDIADO"],3:["FASE FINAL","FURIA DE LA PLAGA"]};
    ctx.fillStyle="rgba(3,3,5,.84)";ctx.fillRect(0,0,boardSize,boardSize);
    ctx.textAlign="center";
    ctx.fillStyle="#ff922d";ctx.font="bold "+Math.max(30,cell*1.35)+"px Georgia";ctx.textBaseline="middle";ctx.fillText(names[jefe.fase][0],boardSize/2,boardSize*.43);
    ctx.fillStyle="#fff1d0";ctx.font="bold "+Math.max(14,cell*.52)+"px monospace";ctx.fillText(names[jefe.fase][1],boardSize/2,boardSize*.54);
    ctx.fillStyle="#ffc65a";ctx.font=Math.max(12,cell*.4)+"px monospace";
    const tip=jefe.fase===1?"Atrapa las manzanas que se mueven":jefe.fase===2?"Segundo mapa: evita las trampas":"Corre: deja fuego a su paso";
    ctx.fillText(tip,boardSize/2,boardSize*.62);
    ctx.fillStyle="#ffffff";ctx.font="bold "+Math.max(12,cell*.42)+"px monospace";
    ctx.fillText("PULSA UNA FLECHA PARA INICIAR",boardSize/2,boardSize*.72);
  }
  ctx.restore();
}

function hexANumeros(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mezclarColor(hexA, hexB, t) {
  const a = hexANumeros(hexA);
  const b = hexANumeros(hexB);
  const [r, g, bl] = [0, 1, 2].map(i => Math.round(lerp(a[i], b[i], t)));
  return `rgb(${r},${g},${bl})`;
}

// Mundo 1: anillo que se vacía como reloj de arena a medida que la
// manzana se acerca a pudrirse.
function dibujarAnilloMaduracion(cx, cy, r, progreso) {
  const radio = r * 1.9;
  const restante = 1 - progreso;
  ctx.strokeStyle = "#f4f7f2";
  ctx.lineWidth = Math.max(1, cell * 0.045);
  ctx.beginPath();
  ctx.arc(cx, cy, radio, -Math.PI / 2, -Math.PI / 2 + restante * Math.PI * 2);
  ctx.stroke();
}

function drawSnakePart(part, isHead) {
  const inset = isHead ? cell * 0.067 : cell * 0.133;
  const x = part.x * cell + inset;
  const y = part.y * cell + inset;
  const size = cell - inset * 2;
  roundedRect(x, y, size, size, isHead ? cell * 0.267 : cell * 0.167);
  ctx.fillStyle = isHead ? "#9edb3e" : "#75ae31";
  ctx.fill();
  ctx.strokeStyle = "#466f20";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (isHead) {
    const vec = DIR_VECTORS[direction];
    const horizontal = vec.x !== 0;
    const eyes = horizontal
      ? [{ x: vec.x > 0 ? .72 : .28, y: .3 }, { x: vec.x > 0 ? .72 : .28, y: .7 }]
      : [{ x: .3, y: vec.y > 0 ? .72 : .28 }, { x: .7, y: vec.y > 0 ? .72 : .28 }];
    const eyeR = cell * 0.15;
    const pupilR = cell * 0.067;
    eyes.forEach(eye => {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x + size * eye.x, y + size * eye.y, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#15200e";
      ctx.beginPath();
      ctx.arc(x + size * eye.x + vec.x * pupilR, y + size * eye.y + vec.y * pupilR, pupilR, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

function drawApple(apple) {
  if(world.manzanasMoviles){
    apple.visualX=lerp(apple.visualX??apple.x,apple.x,.14);
    apple.visualY=lerp(apple.visualY??apple.y,apple.y,.14);
  }
  const ax=world.manzanasMoviles?apple.visualX:apple.x;
  const ay=world.manzanasMoviles?apple.visualY:apple.y;
  const cx = ax * cell + cell / 2;
  const cy = ay * cell + cell / 2 + cell * 0.067;
  const r = cell * 0.3;

  const madurando = world.madura && !apple.worm;
  let colorCuerpo = "#ed493b";
  let progreso = 0;
  if (madurando) {
    progreso = Math.min(1, (tickCount - apple.bornTick) / world.maduraActual);
    colorCuerpo = mezclarColor("#ed493b", "#6b4327", progreso);
    dibujarAnilloMaduracion(cx, cy, r, progreso);
  }

  const parpadeo = madurando && progreso >= 0.8 && Math.floor(tickCount / 4) % 2 === 0;
  ctx.globalAlpha = parpadeo ? 0.55 : 1;
  ctx.fillStyle = colorCuerpo;
  ctx.beginPath();
  ctx.arc(cx - cell * 0.167, cy, r, 0, Math.PI * 2);
  ctx.arc(cx + cell * 0.167, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#9bcf35";
  ctx.fillRect(cx + cell * 0.033, cy - cell * 0.5, cell * 0.1, cell * 0.267);
  ctx.beginPath();
  ctx.ellipse(cx + cell * 0.233, cy - cell * 0.433, cell * 0.2, cell * 0.1, -.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (apple.worm) {
    ctx.strokeStyle = "#e9b48d";
    ctx.lineWidth = Math.max(1.2, cell * 0.073);
    ctx.beginPath();
    ctx.moveTo(cx + cell * 0.2, cy - cell * 0.033);
    ctx.quadraticCurveTo(cx + cell * 0.433, cy - cell * 0.2, cx + cell * 0.367, cy + cell * 0.133);
    ctx.stroke();
    ctx.fillStyle = "#43241c";
    ctx.beginPath();
    ctx.arc(cx + cell * 0.367, cy + cell * 0.133, cell * 0.043, 0, Math.PI * 2);
    ctx.fill();
  }
}

document.addEventListener("keydown",event=>{
  if(event.code==="Escape"){event.preventDefault();pausarJuego();return;}
  if(event.code==="Space"){event.preventDefault();alternarPausa();return;}
  const dir=KEY_TO_DIR[event.key];if(!dir)return;event.preventDefault();encolarDir(dir);
});

let touchStartX = 0;
let touchStartY = 0;
canvas.addEventListener("touchstart", event => {
  const t = event.changedTouches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
}, { passive: true });

canvas.addEventListener("touchend", event => {
  const t = event.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  if (Math.hypot(dx, dy) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) encolarDir(dx > 0 ? "right" : "left");
  else encolarDir(dy > 0 ? "down" : "up");
}, { passive: true });

dpadButtons.forEach(btn => {
  btn.addEventListener("click", () => encolarDir(btn.dataset.dir));
});

document.addEventListener("visibilitychange",()=>{if(document.hidden)pausarJuego();});
pauseResumeButton.addEventListener("click",reanudarJuego);
pauseRestartButton.addEventListener("click",()=>entrarMundo(worldIndex));
pauseWorldsButton.addEventListener("click",volverAlSelectorDeMundos);
transitionContinueBtn.addEventListener("click",avanzarMundo);
bossVictoryWorldsButton.addEventListener("click",volverAlSelectorDeMundos);
if (soundToggleButton) soundToggleButton.addEventListener("click", alternarSonido);
if (difficultySelectEl) {
  difficultySelectEl.querySelectorAll(".difficulty-btn").forEach(btn => {
    btn.addEventListener("click", () => aplicarDificultad(btn.dataset.dificultad));
  });
}

new ResizeObserver(resizeCanvas).observe(boardCard);

renderSelectorDeMundos();
aplicarDificultad(dificultad);
actualizarBotonSonido();
entrarMundo(0);
