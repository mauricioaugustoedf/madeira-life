import { CONFIG } from '../config.js';

// Lógica pura da floresta (sem 3D): crescimento, reserva, corte e replantio.
// A parte visual (ForestView) apenas lê este estado.
export const Stage = { GROWING: 0, MATURE: 1, FALLING: 2, STUMP: 3, REMOVED: 4 };

export class Forest {
  constructor(colliders, rand) {
    const F = CONFIG.forest;
    this.cfg = F;
    this.trees = [];
    this.growthMultiplier = 1;   // upgrades futuros aumentam isso
    this._acc = 0;
    this.dirty = new Set();      // árvores cujo visual precisa atualizar
    this.totalCut = 0;

    this.colliders = colliders;
    this.rand = rand;
    this.onGrow = null; // avisado quando novas árvores são adicionadas
    this.addGrove(F, F.matureAtStart, 0.9);
  }

  // Planta um bosque em grade (usado no início e ao liberar terreno novo)
  addGrove(G, matureChance, maxGrowth) {
    const rand = this.rand, colliders = this.colliders;
    let id = this.trees.length;
    for (let c = 0; c < G.cols; c++) {
      for (let r = 0; r < G.rows; r++) {
        const x = G.origin.x + c * G.spacingX + (rand() - 0.5) * 0.7;
        const z = G.origin.z + r * G.spacingZ + (rand() - 0.5) * 0.7;
        const mature = rand() < matureChance;
        this._push({
          id: id++, x, z,
          scale: 0.9 + rand() * 0.25,
          rot: rand() * Math.PI * 2,
          tint: rand(),
          growth: mature ? 1 : rand() * maxGrowth,
          stage: mature ? Stage.MATURE : Stage.GROWING,
        });
      }
    }
    if (this.onGrow) this.onGrow();
  }

  _push(o) {
    const t = { reserved: false, timer: 0, shake: 0, ...o };
    this.trees.push(t);
    this.dirty.add(t);
    t.col = t.stage === Stage.REMOVED ? null : this.colliders.addCircle(t.x, t.z, 0.33 * t.scale);
    return t;
  }

  // ---- Modo editar ----
  addTree(x, z, opts = {}) {
    const t = this._push({ id: this.trees.length, x, z, scale: 0.9 + Math.random() * 0.25, rot: Math.random() * Math.PI * 2,
      tint: Math.random(), growth: 0, stage: Stage.GROWING, ...opts });
    if (this.onGrow) this.onGrow();
    return t;
  }

  moveTree(t, x, z) {
    this.colliders.remove(t.col);
    t.x = x; t.z = z;
    t.col = this.colliders.addCircle(x, z, 0.33 * t.scale);
    this.dirty.add(t);
  }

  removeTree(t) {
    if (t.reserved || t.stage === Stage.FALLING) return false;
    this.colliders.remove(t.col); t.col = null;
    t.stage = Stage.REMOVED;
    this.dirty.add(t);
    return true;
  }

  // Save completo (posição de cada árvore) e recarga
  toRows() {
    return this.trees.filter((t) => t.stage !== Stage.REMOVED).map((t) => [
      t.stage === Stage.FALLING ? Stage.STUMP : t.stage, +t.growth.toFixed(3), +t.timer.toFixed(1),
      +t.x.toFixed(2), +t.z.toFixed(2), +t.scale.toFixed(3), +t.rot.toFixed(2), +t.tint.toFixed(2)]);
  }

  loadRows(rows) {
    for (const t of this.trees) { this.colliders.remove(t.col); t.col = null; t.stage = Stage.REMOVED; this.dirty.add(t); }
    // as instâncias antigas ficam escondidas; recria a lista com ids novos a partir do fim
    const old = this.trees;
    this.trees = [];
    rows.forEach(([stage, growth, timer, x, z, scale, rot, tint]) => {
      this._push({ id: this.trees.length, stage, growth, timer, x, z, scale, rot, tint });
    });
    void old;
    if (this.onGrow) this.onGrow();
  }

  update(dt) {
    this._acc += dt;
    if (this._acc < this.cfg.tickInterval) return;
    const step = this._acc;
    this._acc = 0;
    const grow = (step / this.cfg.growSeconds) * this.growthMultiplier;
    for (const t of this.trees) {
      if (t.stage === Stage.GROWING) {
        t.growth = Math.min(1, t.growth + grow);
        if (t.growth >= 1) t.stage = Stage.MATURE;
        this.dirty.add(t);
      }
      // Tocos ficam até alguém (você ou um plantador) plantar uma muda
    }
  }

  // Árvore adulta livre mais próxima de (x, z)
  findMature(x, z) {
    let best = null, bestD = Infinity;
    for (const t of this.trees) {
      if (t.stage !== Stage.MATURE || t.reserved) continue;
      const d = (t.x - x) ** 2 + (t.z - z) ** 2;
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  // Toco livre mais próximo de (x, z)
  findStump(x, z) {
    let best = null, bestD = Infinity;
    for (const t of this.trees) {
      if (t.stage !== Stage.STUMP || t.reserved) continue;
      const d = (t.x - x) ** 2 + (t.z - z) ** 2;
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  // Muda nova no lugar do toco
  plant(t) {
    if (t.stage !== Stage.STUMP) return false;
    t.stage = Stage.GROWING;
    t.growth = 0;
    t.reserved = false;
    this.totalPlanted = (this.totalPlanted || 0) + 1;
    this.dirty.add(t);
    return true;
  }

  count(stage) {
    let n = 0;
    for (const t of this.trees) if (t.stage === stage) n++;
    return n;
  }

  reserve(t) { t.reserved = true; }
  release(t) { t.reserved = false; }

  hit(t) { t.shake = 1; this.dirty.add(t); }

  fell(t) {
    t.stage = Stage.FALLING;
    this.dirty.add(t);
  }

  landed(t) {
    if (t.stage === Stage.REMOVED) return;
    t.stage = Stage.STUMP;
    t.timer = this.cfg.stumpSeconds;
    t.reserved = false;
    t.growth = 0;
    this.totalCut++;
    this.dirty.add(t);
  }

  get matureCount() {
    let n = 0;
    for (const t of this.trees) if (t.stage === Stage.MATURE) n++;
    return n;
  }
}
