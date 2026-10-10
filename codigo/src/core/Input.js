// Entrada por toque e teclado.
// - Arrastar em qualquer lugar: joystick (aparece onde o dedo tocou).
// - Toque rápido em qualquer lugar: andar até o ponto (callback onTap).
// - Pinça com dois dedos: zoom (callback onPinch). Roda do mouse também.
// vector() devolve {x, y} entre -1 e 1. y positivo = para cima na tela.
export class Input {
  constructor(layer, baseEl, knobEl) {
    this.layer = layer;
    this.base = baseEl;
    this.knob = knobEl;
    this.radius = 56;
    this.pointers = new Map();
    this.joyId = null;
    this.joyShown = false;
    this.origin = { x: 0, y: 0 };
    this.stick = { x: 0, y: 0 };
    this.pinch = null;
    this.keys = new Set();
    this.out = { x: 0, y: 0 };

    this.onFirstMove = null;
    this.onTap = null;        // (x, y) em pixels da tela
    this.onPinch = null;      // (fator) >1 aproxima, <1 afasta
    this.onWheel = null;      // (deltaY)
    // Arrastar um objeto (modo editar): onDragStart(x, y) devolve true para "pegar" o toque
    this.onDragStart = null; this.onDrag = null; this.onDragEnd = null;
    this.dragId = null;

    layer.addEventListener('pointerdown', (e) => this._down(e));
    layer.addEventListener('pointermove', (e) => this._move(e));
    layer.addEventListener('pointerup', (e) => this._up(e, true));
    layer.addEventListener('pointercancel', (e) => this._up(e, false));
    layer.addEventListener('wheel', (e) => { e.preventDefault(); if (this.onWheel) this.onWheel(e.deltaY); }, { passive: false });

    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.pointers.clear(); this._resetJoy(); this.pinch = null; });
  }

  _firstMove() { if (this.onFirstMove) { this.onFirstMove(); this.onFirstMove = null; } }

  _down(e) {
    e.preventDefault();
    try { this.layer.setPointerCapture(e.pointerId); } catch (_) {}
    const p = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), tapOk: true };
    this.pointers.set(e.pointerId, p);

    if (this.pointers.size === 2) {
      // Dois dedos: vira pinça. Cancela joystick, arrasto e toques pendentes.
      this._resetJoy();
      if (this.dragId !== null) { this.dragId = null; if (this.onDragEnd) this.onDragEnd(); }
      const [a, b] = [...this.pointers.values()];
      a.tapOk = false; b.tapOk = false;
      this.pinch = { last: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
      return;
    }
    // Joystick nasce onde o dedo tocar, em qualquer ponto da tela
    if (this.pointers.size === 1) {
      if (this.onDragStart && this.onDragStart(e.clientX, e.clientY)) { this.dragId = e.pointerId; p.tapOk = false; return; }
      this.joyId = e.pointerId;
      this.origin.x = e.clientX; this.origin.y = e.clientY;
    }
  }

  _move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(p.x - p.x0, p.y - p.y0) > 12) p.tapOk = false;

    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      if (this.onPinch) this.onPinch(d / this.pinch.last);
      this.pinch.last = d;
      return;
    }

    if (e.pointerId === this.dragId) { if (this.onDrag) this.onDrag(p.x, p.y); return; }
    if (e.pointerId !== this.joyId) return;
    let dx = p.x - this.origin.x, dy = p.y - this.origin.y;
    const len = Math.hypot(dx, dy);
    if (!this.joyShown && len > 8) {
      this.joyShown = true;
      this.base.style.transform = `translate(${this.origin.x}px, ${this.origin.y}px)`;
      this.base.classList.add('active');
    }
    if (len > this.radius) { dx = dx / len * this.radius; dy = dy / len * this.radius; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    let mx = dx / this.radius, my = -dy / this.radius;
    if (Math.hypot(mx, my) < 0.12) { mx = 0; my = 0; } else this._firstMove();
    this.stick.x = mx; this.stick.y = my;
  }

  _up(e, normal) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (e.pointerId === this.dragId) { this.dragId = null; if (this.onDragEnd) this.onDragEnd(); return; }
    if (e.pointerId === this.joyId) this._resetJoy();
    if (this.pinch) {
      if (this.pointers.size < 2) {
        this.pinch = null;
        for (const q of this.pointers.values()) q.tapOk = false;
      }
      return;
    }
    const quick = performance.now() - p.t0 < 350;
    if (normal && p.tapOk && quick && this.onTap) { this._firstMove(); this.onTap(p.x, p.y); }
  }

  _resetJoy() {
    this.joyId = null;
    this.joyShown = false;
    this.stick.x = 0; this.stick.y = 0;
    this.knob.style.transform = 'translate(0px, 0px)';
    this.base.classList.remove('active');
  }

  vector() {
    let x = this.stick.x, y = this.stick.y;
    const k = this.keys;
    let kx = 0, ky = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) kx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) kx += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) ky += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) ky -= 1;
    if (kx || ky) { const l = Math.hypot(kx, ky); x = kx / l; y = ky / l; this._firstMove(); }
    this.out.x = x; this.out.y = y;
    return this.out;
  }
}
