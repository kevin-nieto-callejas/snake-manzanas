"use strict";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const boardCard = document.querySelector(".board-card");

const worldNameEl = document.querySelector("#world-name");
const harvestEl = document.querySelector("#harvest");
const livesEl = document.querySelector("#lives");
const scoreEl = document.querySelector("#score");
const bestScoreEl = document.querySelector("#best-score");

const startScreen = document.querySelector("#start-screen");
const worldSelectEl = document.querySelector("#world-select");
const pauseScreen = document.querySelector("#pause-screen");
const transitionScreen = document.querySelector("#world-transition");
const nextWorldNameEl = document.querySelector("#next-world-name");
const nextWorldTipEl = document.querySelector("#next-world-tip");
const transitionContinueBtn = document.querySelector("#transition-continue");
const gameOverScreen = document.querySelector("#game-over");
const gameOverTitleEl = document.querySelector("#game-over-title");
const finalScore = document.querySelector("#final-score");
const restartButton = document.querySelector("#restart");
const dpadButtons = document.querySelectorAll(".dpad-btn");

const CELLS = 20;

// Configuración de cada mundo de la campaña. Un flag apagado es 0 o
// false: update()/draw() deben preguntar siempre por la capacidad
// (ej. "if (world.gusanoCazador)"), nunca por el id del mundo.
const WORLDS = [
  { id: 1, nombre: "El Huerto", meta: 12, tickMs: 115,
    muros: "solidos", obstaculos: 0, manzanas: 3,
    madura: 70, gusanoCazador: false, rastro: 0,
    tip: "Las manzanas se pudren si tardas." },

  { id: 2, nombre: "La Bodega", meta: 15, tickMs: 125,
    muros: "wrap", obstaculos: 4, manzanas: 3,
    madura: 0, gusanoCazador: true, rastro: 0,
    tip: "El gusano compite por tu cosecha." },

  { id: 3, nombre: "El Manzano Podrido", meta: 18, tickMs: 135,
    muros: "solidos", obstaculos: 0, manzanas: 4,
    madura: 0, gusanoCazador: false, rastro: 12,
    tip: "Tu propio rastro te envenena. La manzana con gusano parte tu longitud a la mitad: úsala como escape." },

  { id: 4, nombre: "Cosecha Infinita", meta: Infinity, tickMs: 120,
    muros: "wrap", obstaculos: 4, manzanas: 4,
    madura: 60, gusanoCazador: true, rastro: 14,
    tip: "Todo a la vez. Sobrevive." }
];

const VIDAS_POR_MUNDO = 3;
const PENALIZACION_REINICIO = 25;

const STORAGE_KEY_MUNDO_MAX = "snake-manzanas:mundoMax";
const STORAGE_KEY_MEJOR_PUNTAJE = "snake-manzanas:mejorPuntaje";

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
let mundoMax = leerStorage(STORAGE_KEY_MUNDO_MAX, 1);
let mejorPuntaje = leerStorage(STORAGE_KEY_MEJOR_PUNTAJE, 0);

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
  snake = crearSerpienteInicial();
  direction = "right";
  directionQueue = [];
  running = false;
  paused = false;
  apples = [];
  for (let i = 0; i < world.manzanas - 1; i++) spawnApple(false);
  spawnApple(true);
  apretar(world, cosecha);
  gameOverScreen.classList.add("hidden");
  pauseScreen.classList.add("hidden");
  transitionScreen.classList.add("hidden");
  updateHud();
  resizeCanvas();
}

function entrarMundo(index) {
  worldIndex = index;
  world = WORLDS[worldIndex];
  cosecha = 0;
  vidas = VIDAS_POR_MUNDO;
  prepararTablero();
}

function respawnEnMundoActual() {
  prepararTablero();
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

function renderSelectorDeMundos() {
  worldSelectEl.innerHTML = "";
  WORLDS.forEach((w, i) => {
    const desbloqueado = w.id <= mundoMax;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = desbloqueado ? "world-btn" : "world-btn locked";
    btn.disabled = !desbloqueado;
    const metaTexto = w.meta === Infinity ? "∞" : w.meta;
    btn.innerHTML = desbloqueado
      ? `<span class="world-btn-name">${w.nombre}</span>${metaTexto} manzanas`
      : `<span class="world-btn-name">🔒 ${w.nombre}</span>bloqueado`;
    if (desbloqueado) btn.addEventListener("click", () => elegirMundo(i));
    worldSelectEl.appendChild(btn);
  });
  bestScoreEl.textContent = mejorPuntaje;
}

function elegirMundo(index) {
  entrarMundo(index);
  startScreen.classList.add("hidden");
}

function spawnApple(worm) {
  let position;
  do {
    position = {
      x: Math.floor(Math.random() * CELLS),
      y: Math.floor(Math.random() * CELLS)
    };
  } while (snake.some(part => sameCell(part, position)) || apples.some(apple => sameCell(apple, position)));
  apples.push({ ...position, worm });
}

function encolarDir(dirName) {
  if (!DIR_VECTORS[dirName]) return;
  const referencia = directionQueue.length ? directionQueue[directionQueue.length - 1] : direction;
  if (dirName === referencia || dirName === OPPOSITE[referencia]) return;
  if (directionQueue.length >= 2) return;
  directionQueue.push(dirName);
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

function update() {
  if (directionQueue.length) direction = directionQueue.shift();
  const vec = DIR_VECTORS[direction];
  const head = {
    x: snake[0].x + vec.x,
    y: snake[0].y + vec.y
  };

  const hitWall = head.x < 0 || head.x >= CELLS || head.y < 0 || head.y >= CELLS;
  const hitSelf = snake.some(part => sameCell(part, head));
  if (hitWall || hitSelf) return endGame();

  snake.unshift(head);
  const appleIndex = apples.findIndex(apple => sameCell(apple, head));

  if (appleIndex >= 0) {
    const eaten = apples.splice(appleIndex, 1)[0];
    if (eaten.worm) {
      const newLength = Math.max(2, Math.ceil(snake.length / 2));
      snake.length = newLength;
      score = Math.max(0, score - 5);
      cosecha = Math.max(0, cosecha - 1);
    } else {
      score += 10;
      cosecha += 1;
    }
    apretar(world, cosecha);
    spawnApple(eaten.worm);
    registrarPuntaje();
    updateHud();
    if (cosecha >= world.meta) return completarMundo();
  } else {
    snake.pop();
  }
}

function completarMundo() {
  running = false;
  directionQueue = [];
  const siguiente = worldIndex + 1;
  if (siguiente >= WORLDS.length) return; // Cosecha Infinita no tiene meta alcanzable
  mundoMax = Math.max(mundoMax, WORLDS[siguiente].id);
  guardarProgreso();
  nextWorldNameEl.textContent = WORLDS[siguiente].nombre;
  nextWorldTipEl.textContent = WORLDS[siguiente].tip;
  transitionScreen.classList.remove("hidden");
  transitionTimer = setTimeout(avanzarMundo, 2000);
}

function avanzarMundo() {
  clearTimeout(transitionTimer);
  entrarMundo(worldIndex + 1);
}

function endGame() {
  running = false;
  directionQueue = [];
  vidas -= 1;
  if (vidas > 0) {
    gameOverTitleEl.textContent = "¡OUCH!";
    finalScore.textContent = `Vida perdida — ${vidas} ${vidas === 1 ? "vida restante" : "vidas restantes"}`;
    restartButton.textContent = "SEGUIR";
  } else {
    score = Math.max(0, score - PENALIZACION_REINICIO);
    registrarPuntaje();
    cosecha = 0;
    vidas = VIDAS_POR_MUNDO;
    apretar(world, cosecha);
    gameOverTitleEl.textContent = "PERDISTE";
    finalScore.textContent = `Sin vidas — reinicias ${world.nombre} (−${PENALIZACION_REINICIO} pts)`;
    restartButton.textContent = "REINTENTAR";
  }
  updateHud();
  gameOverScreen.classList.remove("hidden");
}

restartButton.addEventListener("click", () => {
  gameOverScreen.classList.add("hidden");
  respawnEnMundoActual();
});

function updateHud() {
  worldNameEl.textContent = world.nombre;
  harvestEl.textContent = `${cosecha}/${world.meta === Infinity ? "∞" : world.meta}`;
  livesEl.textContent = String(vidas);
  scoreEl.textContent = score;
  bestScoreEl.textContent = mejorPuntaje;
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
  ctx.fillStyle = "#07111d";
  ctx.fillRect(0, 0, boardSize, boardSize);

  ctx.strokeStyle = "#102030";
  ctx.lineWidth = 1;
  for (let i = 1; i < CELLS; i++) {
    const p = i * cell;
    ctx.beginPath();
    ctx.moveTo(p, 0); ctx.lineTo(p, boardSize);
    ctx.moveTo(0, p); ctx.lineTo(boardSize, p);
    ctx.stroke();
  }

  apples.forEach(drawApple);
  snake.forEach((part, index) => drawSnakePart(part, index === 0));
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
  const cx = apple.x * cell + cell / 2;
  const cy = apple.y * cell + cell / 2 + cell * 0.067;
  const r = cell * 0.3;
  ctx.fillStyle = "#ed493b";
  ctx.beginPath();
  ctx.arc(cx - cell * 0.167, cy, r, 0, Math.PI * 2);
  ctx.arc(cx + cell * 0.167, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#9bcf35";
  ctx.fillRect(cx + cell * 0.033, cy - cell * 0.5, cell * 0.1, cell * 0.267);
  ctx.beginPath();
  ctx.ellipse(cx + cell * 0.233, cy - cell * 0.433, cell * 0.2, cell * 0.1, -.5, 0, Math.PI * 2);
  ctx.fill();

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

document.addEventListener("keydown", event => {
  const dir = KEY_TO_DIR[event.key];
  if (!dir) return;
  event.preventDefault();
  encolarDir(dir);
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

document.addEventListener("visibilitychange", () => {
  if (document.hidden && running && !paused) {
    paused = true;
    cancelLoop();
    pauseScreen.classList.remove("hidden");
  }
});

pauseScreen.addEventListener("click", () => {
  if (!paused) return;
  paused = false;
  pauseScreen.classList.add("hidden");
  last = performance.now();
  acc = 0;
  rafId = requestAnimationFrame(frame);
});

transitionContinueBtn.addEventListener("click", avanzarMundo);

new ResizeObserver(resizeCanvas).observe(boardCard);

renderSelectorDeMundos();
entrarMundo(0);
