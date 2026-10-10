import { CONFIG } from '../config.js';

// Lógica do descascador e das duas esteiras (sem 3D).
// Esteira de entrada puxa toras do pátio → descascador → esteira de saída → fila na serra.
// Cada esteira é uma linha com comprimento; as toras andam e param umas atrás das outras.
export class Belt {
  constructor(points) {
    this.points = points;
    this.segs = [];
    let L = 0;
    for (let i = 1; i < points.length; i++) {
      const [x0, z0] = points[i - 1], [x1, z1] = points[i];
      const len = Math.hypot(x1 - x0, z1 - z0);
      this.segs.push({ x0, z0, dx: (x1 - x0) / len, dz: (z1 - z0) / len, len, start: L });
      L += len;
    }
    this.length = L;
    this.items = [];          // posições (s) ao longo da esteira; [0] é a mais à frente
  }

  // Ponto e direção na posição s
  at(s, out) {
    let seg = this.segs[this.segs.length - 1];
    for (const g of this.segs) if (s <= g.start + g.len) { seg = g; break; }
    const k = Math.min(seg.len, Math.max(0, s - seg.start));
    out.x = seg.x0 + seg.dx * k; out.z = seg.z0 + seg.dz * k; out.dx = seg.dx; out.dz = seg.dz;
    return out;
  }

  canAdd(spacing) { return !this.items.length || this.items[this.items.length - 1] >= spacing; }
  add() { this.items.push(0); }
  get frontReady() { return this.items.length > 0 && this.items[0] >= this.length - 0.001; }
  takeFront() { return this.items.shift(); }

  update(dt, speed, spacing) {
    let limit = this.length;
    for (let i = 0; i < this.items.length; i++) {
      this.items[i] = Math.min(limit, this.items[i] + speed * dt);
      limit = this.items[i] - spacing;
    }
  }
}

export class Debarker {
  constructor(yard) {
    const D = CONFIG.debarker;
    this.cfg = D;
    this.yard = yard;
    this.built = false;
    this.inBelt = new Belt(D.inBelt);
    this.outBelt = new Belt(D.outBelt);
    this.busy = false;      // tem tora dentro do descascador?
    this.t = 0;             // progresso 0..1
    this.done = false;      // tora pronta esperando lugar na esteira de saída
    this.running = false;
    this.debarked = 0;
  }

  // Toras dentro do sistema (voltam ao pátio no save)
  get inTransit() { return this.inBelt.items.length + (this.busy ? 1 : 0) + this.outBelt.items.length; }

  // A serra pega uma tora descascada da fila, se houver
  takeReady() {
    if (!this.outBelt.frontReady) return false;
    this.outBelt.takeFront();
    return true;
  }

  update(dt) {
    this.running = false;
    if (!this.built) return;
    const D = this.cfg;
    // pátio → esteira de entrada
    if (this.yard.stock > 0 && this.inBelt.canAdd(D.spacing) && this.inBelt.items.length < 4) {
      this.yard.take(1);
      this.inBelt.add();
    }
    this.inBelt.update(dt, D.beltSpeed, D.spacing);
    // esteira → descascador
    if (!this.busy && this.inBelt.frontReady) { this.inBelt.takeFront(); this.busy = true; this.t = 0; this.done = false; }
    if (this.busy && !this.done) {
      this.t += dt / D.seconds;
      this.running = true;
      if (this.t >= 1) { this.t = 1; this.done = true; }
    }
    if (this.busy && this.done && this.outBelt.canAdd(D.spacing)) {
      this.outBelt.add(); this.busy = false; this.done = false; this.debarked++;
    }
    this.outBelt.update(dt, D.beltSpeed, D.spacing);
  }
}
