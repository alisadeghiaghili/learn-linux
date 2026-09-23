/**
 * Confetti + short fanfare for level celebrations.
 */

const COLORS = ['#E95420', '#F0C040', '#38B26A', '#5B9BD5', '#C39BD3', '#F4EDEB'];

/**
 * @typedef {Object} ConfettiHandle
 * @property {() => void} stop
 */

/**
 * @param {number} [durationMs]
 * @returns {ConfettiHandle|null}
 */
export function launchConfetti(durationMs = 4200) {
  if (typeof document === 'undefined') return null;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (reduce) {
    const layer = document.createElement('div');
    layer.className = 'confetti-static';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
    return { stop: () => layer.remove() };
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
  document.body.appendChild(canvas);

  /** @type {{x:number,y:number,w:number,h:number,color:string,vx:number,vy:number,rot:number,vr:number}[]} */
  const pieces = [];
  const spawn = (count, fromSides = false) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let i = 0; i < count; i++) {
      pieces.push({
        x: fromSides ? (Math.random() < 0.5 ? -20 : w + 20) : w * 0.2 + Math.random() * w * 0.6,
        y: fromSides ? h * 0.35 + Math.random() * h * 0.3 : -20 - Math.random() * h * 0.35,
        w: 6 + Math.random() * 8,
        h: 8 + Math.random() * 10,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        vx: fromSides ? (Math.random() < 0.5 ? 2.4 : -2.4) + (Math.random() - 0.5) : (Math.random() - 0.5) * 2.4,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.25,
      });
    }
  };

  spawn(70);
  spawn(40, true);

  const started = performance.now();
  let raf = 0;
  let stopped = false;

  const tick = () => {
    const t = performance.now() - started;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (t < durationMs * 0.75 && pieces.length < 180) spawn(2, true);
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, 1 - t / durationMs);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (t < durationMs && !stopped) raf = requestAnimationFrame(tick);
    else cleanup();
  };

  const cleanup = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    canvas.remove();
  };

  raf = requestAnimationFrame(tick);
  return { stop: cleanup };
}

/** Short WebAudio fanfare — never throws. */
export function playFanfare() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ac.destination);
      const t0 = ac.currentTime + i * 0.09;
      g.gain.exponentialRampToValueAtTime(0.08, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.start(t0);
      o.stop(t0 + 0.25);
    });
    setTimeout(() => ac.close(), 800);
  } catch {
    /* audio blocked */
  }
}
