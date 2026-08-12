"use strict";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const lengthEl = document.querySelector("#length");
const startScreen = document.querySelector("#start-screen");
const gameOverScreen = document.querySelector("#game-over");
const finalScore = document.querySelector("#final-score");
const restartButton = document.querySelector("#restart");

const CELLS = 20;
const SIZE = canvas.width / CELLS;
const SPEED = 115;
const DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 }
};

let snake;
let direction;
let nextDirection;
let apples;
let score;
let timer;
let running;

function resetGame() {
  clearInterval(timer);
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
    { x: 7, y: 10 }
  ];
  direction = { x: 1, y: 0 };
  nextDirection = { ...direction };
  score = 0;
  running = false;
  apples = [];
  spawnApple(false);
  spawnApple(false);
  spawnApple(true);
  updateHud();
  gameOverScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
  draw();
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

function startGame() {
  if (running) return;
  running = true;
  startScreen.classList.add("hidden");
  timer = setInterval(tick, SPEED);
}

function tick() {
  direction = nextDirection;
  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y
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

  draw();
}

function endGame() {
  clearInterval(timer);
  running = false;
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#07111d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#102030";
  ctx.lineWidth = 1;
  for (let i = 1; i < CELLS; i++) {
    ctx.beginPath();
    ctx.moveTo(i * SIZE, 0); ctx.lineTo(i * SIZE, canvas.height);
    ctx.moveTo(0, i * SIZE); ctx.lineTo(canvas.width, i * SIZE);
    ctx.stroke();
  }

  apples.forEach(drawApple);
  snake.forEach((part, index) => drawSnakePart(part, index === 0));
}

function drawSnakePart(part, isHead) {
  const inset = isHead ? 2 : 4;
  const x = part.x * SIZE + inset;
  const y = part.y * SIZE + inset;
  const size = SIZE - inset * 2;
  roundedRect(x, y, size, size, isHead ? 8 : 5);
  ctx.fillStyle = isHead ? "#9edb3e" : "#75ae31";
  ctx.fill();
  ctx.strokeStyle = "#466f20";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (isHead) {
    const horizontal = direction.x !== 0;
    const eyes = horizontal
      ? [{ x: direction.x > 0 ? .72 : .28, y: .3 }, { x: direction.x > 0 ? .72 : .28, y: .7 }]
      : [{ x: .3, y: direction.y > 0 ? .72 : .28 }, { x: .7, y: direction.y > 0 ? .72 : .28 }];
    eyes.forEach(eye => {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x + size * eye.x, y + size * eye.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#15200e";
      ctx.beginPath();
      ctx.arc(x + size * eye.x + direction.x * 1.5, y + size * eye.y + direction.y * 1.5, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

function drawApple(apple) {
  const cx = apple.x * SIZE + SIZE / 2;
  const cy = apple.y * SIZE + SIZE / 2 + 2;
  ctx.fillStyle = "#ed493b";
  ctx.beginPath();
  ctx.arc(cx - 5, cy, 9, 0, Math.PI * 2);
  ctx.arc(cx + 5, cy, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#9bcf35";
  ctx.fillRect(cx + 1, cy - 15, 3, 8);
  ctx.beginPath();
  ctx.ellipse(cx + 7, cy - 13, 6, 3, -.5, 0, Math.PI * 2);
  ctx.fill();

  if (apple.worm) {
    ctx.strokeStyle = "#e9b48d";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx + 6, cy - 1);
    ctx.quadraticCurveTo(cx + 13, cy - 6, cx + 11, cy + 4);
    ctx.stroke();
    ctx.fillStyle = "#43241c";
    ctx.beginPath();
    ctx.arc(cx + 11, cy + 4, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

document.addEventListener("keydown", event => {
  const requested = DIRECTIONS[event.key];
  if (!requested) return;
  event.preventDefault();
  const isOpposite = requested.x === -direction.x && requested.y === -direction.y;
  if (!isOpposite) nextDirection = requested;
  startGame();
});

restartButton.addEventListener("click", resetGame);
resetGame();
