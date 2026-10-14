"use strict";
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;
const COLS = 10, ROWS = 6, GAP = 4, TOP = 50;
const BW = (W - GAP * (COLS + 1)) / COLS, BH = 16;
const ROW_COLORS = ["#b3261e", "#d9622b", "#e3a33b", "#2f7d4f", "#2463b3", "#6b3fa0"];
const $ = (id) => document.getElementById(id);
const msg = $("msg");

let paddle, ball, bricks, score, lives, level, state, keys = {};
let best = Number(load("bricks-best") || 0);
$("best").textContent = best;

function load(key) { try { return localStorage.getItem(key); } catch { return null; } }
function save(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } }
const color = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function newGame() {
  score = 0;
  lives = 3;
  level = 1;
  buildLevel();
  msg.textContent = "Click, tap or press Space to launch.";
  hud();
}

function buildLevel() {
  bricks = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      bricks.push({ x: GAP + c * (BW + GAP), y: TOP + r * (BH + GAP), color: ROW_COLORS[r], points: (ROWS - r) * 10, alive: true });
    }
  }
  paddle = { w: 90, h: 12, x: W / 2 - 45, y: H - 30 };
  resetBall();
}

function resetBall() {
  state = "ready";
  ball = { r: 7, x: paddle.x + paddle.w / 2, y: paddle.y - 8, vx: 0, vy: 0 };
}

function launch() {
  if (state === "over") return newGame();
  if (state === "ready") {
    const speed = 300 + (level - 1) * 40; // pixels per second
    const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 0.8;
    ball.vx = speed * Math.cos(angle);
    ball.vy = speed * Math.sin(angle);
    state = "playing";
    msg.textContent = "";
  } else if (state === "playing") {
    state = "paused";
    msg.textContent = "Paused. Press Space or tap to resume.";
  } else if (state === "paused") {
    state = "playing";
    msg.textContent = "";
  }
}

function update(dt) {
  const move = (keys.ArrowLeft || keys.a ? -1 : 0) + (keys.ArrowRight || keys.d ? 1 : 0);
  if (move && state !== "paused") paddle.x = clamp(paddle.x + move * 520 * dt, 0, W - paddle.w);
  if (state === "ready") {
    ball.x = paddle.x + paddle.w / 2;
    return;
  }
  if (state !== "playing") return;

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
  if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
  if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }

  // Paddle: where the ball lands sets the bounce angle.
  if (ball.vy > 0 && ball.y + ball.r >= paddle.y && ball.y + ball.r <= paddle.y + paddle.h + 8 && ball.x >= paddle.x - ball.r && ball.x <= paddle.x + paddle.w + ball.r) {
    const hit = clamp((ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2), -1, 1);
    const speed = Math.hypot(ball.vx, ball.vy);
    const angle = hit * (Math.PI / 3);
    ball.vx = speed * Math.sin(angle);
    ball.vy = -speed * Math.cos(angle);
    ball.y = paddle.y - ball.r;
  }

  for (const b of bricks) {
    if (!b.alive) continue;
    const nx = clamp(ball.x, b.x, b.x + BW), ny = clamp(ball.y, b.y, b.y + BH);
    const dx = ball.x - nx, dy = ball.y - ny;
    if (dx * dx + dy * dy > ball.r * ball.r) continue;
    b.alive = false;
    score += b.points;
    if (Math.abs(dx) > Math.abs(dy)) ball.vx = Math.sign(dx || -ball.vx) * Math.abs(ball.vx);
    else ball.vy = Math.sign(dy || -ball.vy) * Math.abs(ball.vy);
    hud();
    break;
  }

  if (bricks.every((b) => !b.alive)) {
    level++;
    buildLevel();
    msg.textContent = `Level ${level}! Launch when you're ready.`;
    hud();
  }

  if (ball.y - ball.r > H) {
    lives--;
    hud();
    if (lives <= 0) {
      state = "over";
      if (score > best) {
        best = score;
        save("bricks-best", String(best));
        hud();
      }
      msg.textContent = `Game over: ${score} points. Click, tap or press Space to play again.`;
    } else {
      resetBall();
      msg.textContent = `${lives} ${lives === 1 ? "life" : "lives"} left. Launch when you're ready.`;
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = color("--card");
  ctx.fillRect(0, 0, W, H);
  for (const b of bricks) {
    if (!b.alive) continue;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, BW, BH);
  }
  ctx.fillStyle = color("--accent");
  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
  ctx.fillStyle = color("--fg");
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
  if (state === "over" || state === "paused") {
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(0, 0, W, H);
  }
}

function hud() {
  $("score").textContent = score;
  $("lives").textContent = Math.max(0, lives);
  $("level").textContent = level;
  $("best").textContent = best;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000); // cap the step so a background tab doesn't teleport the ball
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

function pointerX(clientX) {
  const rect = canvas.getBoundingClientRect();
  return ((clientX - rect.left) / rect.width) * W;
}
canvas.addEventListener("pointermove", (e) => {
  if (state === "paused") return;
  paddle.x = clamp(pointerX(e.clientX) - paddle.w / 2, 0, W - paddle.w);
});
canvas.addEventListener("pointerdown", (e) => {
  paddle.x = clamp(pointerX(e.clientX) - paddle.w / 2, 0, W - paddle.w);
  if (e.pointerType === "mouse" || state !== "playing") launch();
});
document.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  keys[e.key] = true;
  if (e.key === " " && !e.repeat) launch();
});
document.addEventListener("keyup", (e) => { keys[e.key] = false; });
$("new").addEventListener("click", (e) => {
  newGame();
  e.currentTarget.blur();
});

newGame();
requestAnimationFrame(frame);
