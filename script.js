"use strict";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const lengthEl = document.querySelector("#length");
const boardCard = document.querySelector(".board-card");
const startScreen = document.querySelector("#start-screen");
const pauseScreen = document.querySelector("#pause-screen");
const gameOverScreen = document.querySelector("#game-over");
const finalScore = document.querySelector("#final-score");
const restartButton = document.querySelector("#restart");
const dpadButtons = document.querySelectorAll(".dpad-btn");

const CELLS = 20;
const TICK_MS = 115;

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

let snake;
let direction;
let directionQueue;
let apples;
let score;
let running;
let paused;

let rafId = null;
let acc = 0;
let last = 0;

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

function resetGame() {
  cancelLoop();
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
    { x: 7, y: 10 }
  ];
  direction = "right";
  directionQueue = [];
  score = 0;
  running = false;
  paused = false;
  apples = [];
  spawnApple(false);
  spawnApple(false);
  spawnApple(true);
  updateHud();
  gameOverScreen.classList.add("hidden");
  pauseScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
  resizeCanvas();
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
  startScreen.classList.add("hidden");
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
  while (acc >= TICK_MS) {
    update();
    acc -= TICK_MS;
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
    } else {
      score += 10;
    }
    spawnApple(eaten.worm);
    updateHud();
  } else {
    snake.pop();
  }
}

function endGame() {
  running = false;
  directionQueue = [];
  finalScore.textContent = `Puntuación: ${score}`;
  gameOverScreen.classList.remove("hidden");
}

function updateHud() {
  scoreEl.textContent = score;
  lengthEl.textContent = snake.length;
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

restartButton.addEventListener("click", resetGame);

new ResizeObserver(resizeCanvas).observe(boardCard);
resetGame();
