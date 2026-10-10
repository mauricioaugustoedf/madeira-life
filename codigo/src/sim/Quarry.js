import { CONFIG } from '../config.js';

// Lógica da pedreira (sem 3D): rochas com quantidade de pedra que esgotam e voltam a crescer.
export class Quarry {
  constructor(colliders) {
    this.colliders = colliders;
    const Q = CONFIG.quarry;
    this.cfg = Q;
    this.open = false;          // terreno comprado?
    this.rocks = [];
    let id = 0;
    for (let c = 0; c < Q.cols; c++) for (let r = 0; r < Q.rows; r++) {
      // deslocamento fixo (sem aleatório) para o save bater
      const jx = ((c * 7 + r * 3) % 5 - 2) * 0.25, jz = ((c * 3 + r * 5) % 5 - 2) * 0.25;
      this.rocks.push({ id: id++, x: Q.origin.x + c * Q.spacingX + jx, z: Q.origin.z + r * Q.spacingZ + jz,
        stone: Q.stonePerRock, timer: 0, reserved: false, shake: 0, scale: 0.9 + ((c + r) % 3) * 0.12 });
    }
    this.dirty = true;
    this.totalMined = 0;
  }

  // Liga a pedreira (terreno comprado): as rochas passam a bloquear a passagem
  openUp() {
    this.open = true; this.dirty = true;
    for (const r of this.rocks) if (!r.removed && !r.col) r.col = this.colliders.addCircle(r.x, r.z, 0.95 * r.scale);
  }

  // ---- Modo editar ----
  addRock(x, z) {
    const r = { id: this.rocks.length, x, z, stone: this.cfg.stonePerRock, timer: 0, reserved: false, shake: 0, scale: 0.9 + Math.random() * 0.25 };
    r.col = this.colliders.addCircle(x, z, 0.95 * r.scale);
    this.rocks.push(r); this.dirty = true;
    return r;
  }
  moveRock(r, x, z) {
    this.colliders.remove(r.col);
    r.x = x; r.z = z; r.col = this.colliders.addCircle(x, z, 0.95 * r.scale); this.dirty = true;
  }
  removeRock(r) {
    if (r.reserved) return false;
    this.colliders.remove(r.col); r.col = null; r.removed = true; r.stone = 0; r.timer = Infinity; this.dirty = true;
    return true;
  }
  toRows() { return this.rocks.filter((r) => !r.removed).map((r) => [r.stone, +Math.max(0, r.timer).toFixed(1), +r.x.toFixed(2), +r.z.toFixed(2), +r.scale.toFixed(3)]); }
  loadRows(rows) {
    for (const r of this.rocks) { this.colliders.remove(r.col); r.col = null; }
    this.rocks = rows.map(([stone, timer, x, z, scale], id) => ({ id, x, z, stone, timer, scale, reserved: false, shake: 0 }));
    if (this.open) for (const r of this.rocks) r.col = this.colliders.addCircle(r.x, r.z, 0.95 * r.scale);
    this.dirty = true;
  }

  // Tira 1 pedra da rocha (devolve true se tinha)
  mine(rock) {
    if (rock.stone <= 0) return false;
    rock.stone--;
    rock.shake = 1;
    this.totalMined++;
    if (rock.stone <= 0) { rock.timer = this.cfg.regrowSeconds; rock.reserved = false; }
    this.dirty = true;
    return true;
  }

  // Rocha com pedra mais perto (livre de outro mineiro)
  findRock(x, z, maxDist = Infinity, ignoreReserved = false) {
    let best = null, bestD = maxDist * maxDist;
    for (const r of this.rocks) {
      if (r.removed || r.stone <= 0 || (r.reserved && !ignoreReserved)) continue;
      const d = (r.x - x) ** 2 + (r.z - z) ** 2;
      if (d < bestD) { bestD = d; best = r; }
    }
    return best;
  }

  update(dt) {
    if (!this.open) return;
    for (const r of this.rocks) {
      if (r.removed) continue;
      if (r.stone <= 0) {
        r.timer -= dt;
        if (r.timer <= 0) { r.stone = this.cfg.stonePerRock; this.dirty = true; }
      }
      if (r.shake > 0) { r.shake = Math.max(0, r.shake - dt * 4); this.dirty = true; }
    }
  }
}
