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
// Números más frágiles para calibrar: madura (ticks hasta que una
// manzana se pudre sola) y rastro (ticks que una celda pisada queda
// mortal). Están aquí arriba a propósito para tocarlos sin buscar
// en el resto del archivo.
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

// Posiciones fijas y simétricas de las cajas-obstáculo. Nunca quedan
// adyacentes a la serpiente inicial (fila y=10, columnas x=7..10).
const OBSTACULOS_FIJOS = [
  { x: 4, y: 4 }, { x: 15, y: 4 }, { x: 4, y: 15 }, { x: 15, y: 15 }
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

// Estado de las mecánicas por capacidad: vacío/nulo cuando el mundo
// activo no tiene esa capacidad, sin que el resto del código necesite
// preguntar por el id del mundo.
let obstaculos = [];
let trail = new Map(); // "x,y" -> tick en que deja de ser mortal
let gusano = null;
let tickCount = 0;

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
  gusano = world.gusanoCazador ? crearGusano() : null;
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
  score = 0;
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

function crearGusano() {
  const x0 = 10, y0 = 2;
  return {
    segments: [{ x: x0, y: y0 }, { x: x0 - 1, y: y0 }, { x: x0 - 2, y: y0 }],
    contador: 0,
    objetivo: null
  };
}

function celdaLibre(pos) {
  if (snake.some(part => sameCell(part, pos))) return false;
  if (apples.some(apple => sameCell(apple, pos))) return false;
  if (obstaculos.some(o => sameCell(o, pos))) return false;
  if (trail.has(`${pos.x},${pos.y}`)) return false;
  if (gusano && gusano.segments.some(seg => sameCell(seg, pos))) return false;
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
  const position = buscarCeldaLibre();
  if (!position) return;
  apples.push({ ...position, worm, bornTick: tickCount });
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

// Mundo 3: purga las celdas de rastro ya vencidas. Solo recorre las
// entradas activas del Map, nunca la cuadrícula completa.
function purgarRastro() {
  if (!trail.size) return;
  for (const [key, expira] of trail) {
    if (expira <= tickCount) trail.delete(key);
  }
}

function manzanaSanaMasCercana(desde) {
  let mejor = null;
  let mejorDist = Infinity;
  apples.forEach(apple => {
    if (apple.worm) return;
    const dist = Math.abs(apple.x - desde.x) + Math.abs(apple.y - desde.y);
    if (dist < mejorDist) { mejorDist = dist; mejor = apple; }
  });
  return mejor;
}

function celdaLibreParaGusano(pos) {
  if (pos.x < 0 || pos.x >= CELLS || pos.y < 0 || pos.y >= CELLS) return false;
  if (snake.some(part => sameCell(part, pos))) return false;
  if (obstaculos.some(o => sameCell(o, pos))) return false;
  if (gusano.segments.some(seg => sameCell(seg, pos))) return false;
  return true;
}

// Mundo 2: greedy que reduce distancia Manhattan hacia la manzana sana
// más cercana, priorizando el eje con mayor distancia restante. Si
// ambos ejes están bloqueados (serpiente/obstáculo), se queda quieto.
function moverGusano() {
  const objetivo = manzanaSanaMasCercana(gusano.segments[0]);
  gusano.objetivo = objetivo;
  if (!objetivo) return;

  const head = gusano.segments[0];
  const dx = objetivo.x - head.x;
  const dy = objetivo.y - head.y;
  const pasoX = dx !== 0 ? { x: head.x + Math.sign(dx), y: head.y } : null;
  const pasoY = dy !== 0 ? { x: head.x, y: head.y + Math.sign(dy) } : null;
  const opciones = Math.abs(dx) >= Math.abs(dy) ? [pasoX, pasoY] : [pasoY, pasoX];

  const siguiente = opciones
    .filter(Boolean)
    .map(pos => world.muros === "wrap" ? { x: (pos.x + CELLS) % CELLS, y: (pos.y + CELLS) % CELLS } : pos)
    .find(celdaLibreParaGusano);
  if (!siguiente) return;

  gusano.segments.unshift(siguiente);
  gusano.segments.pop();
  const comida = apples.find(apple => !apple.worm && sameCell(apple, siguiente));
  if (comida) comida.worm = true;
}

function actualizarGusano() {
  if (!world.gusanoCazador || !gusano) return;
  gusano.contador += 1;
  if (gusano.contador < world.gusanoCada) return;
  gusano.contador = 0;
  moverGusano();
}

function update() {
  tickCount += 1;
  purgarRastro();
  actualizarMaduracion();
  actualizarGusano();

  if (directionQueue.length) direction = directionQueue.shift();
  const vec = DIR_VECTORS[direction];
  let head = {
    x: snake[0].x + vec.x,
    y: snake[0].y + vec.y
  };
  if (world.muros === "wrap") {
    head = { x: (head.x + CELLS) % CELLS, y: (head.y + CELLS) % CELLS };
  }

  const hitWall = world.muros !== "wrap" && (head.x < 0 || head.x >= CELLS || head.y < 0 || head.y >= CELLS);
  const hitSelf = snake.some(part => sameCell(part, head));
  const hitObstaculo = obstaculos.some(o => sameCell(o, head));
  const hitRastro = trail.has(`${head.x},${head.y}`);
  if (hitWall || hitSelf || hitObstaculo || hitRastro) return endGame();

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
    const cola = snake.pop();
    if (world.rastro) trail.set(`${cola.x},${cola.y}`, tickCount + world.rastroActual);
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

  obstaculos.forEach(drawObstaculo);
  trail.forEach((expira, key) => drawRastro(key, expira));
  apples.forEach(drawApple);
  drawGusano();
  snake.forEach((part, index) => drawSnakePart(part, index === 0));
}

function drawObstaculo(pos) {
  const x = pos.x * cell + cell * 0.08;
  const y = pos.y * cell + cell * 0.08;
  const size = cell * 0.84;
  roundedRect(x, y, size, size, cell * 0.08);
  ctx.fillStyle = "#4a3826";
  ctx.fill();
  ctx.strokeStyle = "#241609";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = "#6b5236";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + size, y + size);
  ctx.moveTo(x + size, y); ctx.lineTo(x, y + size);
  ctx.stroke();
}

// Mundo 3: opacidad decreciente conforme la celda está por liberarse,
// para que el jugador vea qué va a dejar de ser mortal pronto.
function drawRastro(key, expira) {
  const [xs, ys] = key.split(",");
  const x = Number(xs);
  const y = Number(ys);
  const restante = Math.max(0, expira - tickCount);
  const opacidad = Math.min(1, restante / world.rastroActual) * 0.55;
  ctx.fillStyle = `rgba(120, 200, 90, ${opacidad})`;
  ctx.fillRect(x * cell, y * cell, cell, cell);
}

function drawGusano() {
  if (!world.gusanoCazador || !gusano) return;
  if (gusano.objetivo) {
    const head = gusano.segments[0];
    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = "rgba(180,180,70,.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(head.x * cell + cell / 2, head.y * cell + cell / 2);
    ctx.lineTo(gusano.objetivo.x * cell + cell / 2, gusano.objetivo.y * cell + cell / 2);
    ctx.stroke();
    ctx.restore();
  }
  gusano.segments.forEach((seg, index) => {
    const inset = index === 0 ? cell * 0.1 : cell * 0.18;
    const x = seg.x * cell + inset;
    const y = seg.y * cell + inset;
    const size = cell - inset * 2;
    roundedRect(x, y, size, size, cell * 0.15);
    ctx.fillStyle = index === 0 ? "#8c8c3e" : "#6b6b2a";
    ctx.fill();
    ctx.strokeStyle = "#3f3f18";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
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
  const cx = apple.x * cell + cell / 2;
  const cy = apple.y * cell + cell / 2 + cell * 0.067;
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
