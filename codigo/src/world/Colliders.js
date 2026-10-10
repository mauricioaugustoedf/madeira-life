// Colisões simples em 2D (plano X/Z): círculos e caixas.
// Usa uma grade espacial para que, com centenas de objetos, só os próximos sejam testados.
export class Colliders {
  constructor(cellSize = 4) {
    this.cell = cellSize;
    this.grid = new Map();
    this.bounds = null;
    this._stamp = 0;
  }

  _key(ix, iz) { return ix + ',' + iz; }

  _insert(c, minX, minZ, maxX, maxZ) {
    c._s = 0;
    c._keys = [];
    const s = this.cell;
    for (let ix = Math.floor(minX / s); ix <= Math.floor(maxX / s); ix++) {
      for (let iz = Math.floor(minZ / s); iz <= Math.floor(maxZ / s); iz++) {
        const k = this._key(ix, iz);
        let list = this.grid.get(k);
        if (!list) { list = []; this.grid.set(k, list); }
        list.push(c);
        c._keys.push(k);
      }
    }
    return c;
  }

  addCircle(x, z, r) { return this._insert({ type: 0, x, z, r }, x - r, z - r, x + r, z + r); }

  addBox(x, z, halfW, halfD) {
    return this._insert({ type: 1, x, z, hw: halfW, hd: halfD }, x - halfW, z - halfD, x + halfW, z + halfD);
  }

  // Tira um obstáculo (objeto movido ou excluído no modo editar)
  remove(c) {
    if (!c || !c._keys) return;
    for (const k of c._keys) {
      const list = this.grid.get(k);
      if (!list) continue;
      const i = list.indexOf(c);
      if (i >= 0) list.splice(i, 1);
    }
    c._keys = null;
  }

  setBounds(minX, minZ, maxX, maxZ) { this.bounds = { minX, minZ, maxX, maxZ }; }

  // Empurra a posição (objeto com x e z) para fora de qualquer obstáculo
  resolve(pos, radius) {
    for (let pass = 0; pass < 2; pass++) {
      this._stamp++;
      const s = this.cell;
      const ix0 = Math.floor((pos.x - radius) / s), ix1 = Math.floor((pos.x + radius) / s);
      const iz0 = Math.floor((pos.z - radius) / s), iz1 = Math.floor((pos.z + radius) / s);
      for (let ix = ix0; ix <= ix1; ix++) {
        for (let iz = iz0; iz <= iz1; iz++) {
          const list = this.grid.get(this._key(ix, iz));
          if (!list) continue;
          for (const c of list) {
            if (c._s === this._stamp) continue;
            c._s = this._stamp;
            if (c.type === 0) this._circle(pos, radius, c); else this._box(pos, radius, c);
          }
        }
      }
    }
    const b = this.bounds;
    if (b) {
      pos.x = Math.min(b.maxX - radius, Math.max(b.minX + radius, pos.x));
      pos.z = Math.min(b.maxZ - radius, Math.max(b.minZ + radius, pos.z));
    }
  }

  // true se um círculo nesse ponto não encosta em nada
  isFree(x, z, radius) {
    const b = this.bounds;
    if (b && (x - radius < b.minX || x + radius > b.maxX || z - radius < b.minZ || z + radius > b.maxZ)) return false;
    const s = this.cell;
    for (let ix = Math.floor((x - radius) / s); ix <= Math.floor((x + radius) / s); ix++) {
      for (let iz = Math.floor((z - radius) / s); iz <= Math.floor((z + radius) / s); iz++) {
        const list = this.grid.get(this._key(ix, iz));
        if (!list) continue;
        for (const c of list) {
          if (c.type === 0) {
            const m = radius + c.r;
            if ((x - c.x) ** 2 + (z - c.z) ** 2 < m * m) return false;
          } else {
            const qx = Math.max(c.x - c.hw, Math.min(x, c.x + c.hw));
            const qz = Math.max(c.z - c.hd, Math.min(z, c.z + c.hd));
            if ((x - qx) ** 2 + (z - qz) ** 2 < radius * radius) return false;
          }
        }
      }
    }
    return true;
  }

  _circle(pos, radius, c) {
    const dx = pos.x - c.x, dz = pos.z - c.z;
    const min = radius + c.r;
    const d2 = dx * dx + dz * dz;
    if (d2 >= min * min) return;
    const d = Math.sqrt(d2) || 0.0001;
    pos.x = c.x + (dx / d) * min;
    pos.z = c.z + (dz / d) * min;
  }

  _box(pos, radius, c) {
    const qx = Math.max(c.x - c.hw, Math.min(pos.x, c.x + c.hw));
    const qz = Math.max(c.z - c.hd, Math.min(pos.z, c.z + c.hd));
    const dx = pos.x - qx, dz = pos.z - qz;
    const d2 = dx * dx + dz * dz;
    if (d2 > 1e-8) {
      if (d2 >= radius * radius) return;
      const d = Math.sqrt(d2);
      pos.x = qx + (dx / d) * radius;
      pos.z = qz + (dz / d) * radius;
      return;
    }
    // Centro dentro da caixa: sai pelo lado mais próximo
    const px = c.hw - Math.abs(pos.x - c.x), pz = c.hd - Math.abs(pos.z - c.z);
    if (px < pz) pos.x = c.x + Math.sign(pos.x - c.x || 1) * (c.hw + radius);
    else pos.z = c.z + Math.sign(pos.z - c.z || 1) * (c.hd + radius);
  }
}
