// Grade de navegação + A*: calcula um caminho que contorna obstáculos.
// É montada a partir dos colliders. Quando o mapa mudar (nova construção), chame rebuild().
export class NavGrid {
  constructor(colliders, bounds, cellSize, agentRadius) {
    this.colliders = colliders;
    this.b = bounds;
    this.cs = cellSize;
    this.r = agentRadius;
    this.w = Math.ceil((bounds.maxX - bounds.minX) / cellSize);
    this.h = Math.ceil((bounds.maxZ - bounds.minZ) / cellSize);
    this.free = new Uint8Array(this.w * this.h);
    this.g = new Float32Array(this.w * this.h);
    this.parent = new Int32Array(this.w * this.h);
    this.seen = new Uint32Array(this.w * this.h);
    this.closed = new Uint32Array(this.w * this.h);
    this.run = 0;
    this.rebuild();
  }

  // A área navegável cresceu (terreno novo): realoca a grade e reconstrói
  resize(bounds) {
    this.b = bounds;
    this.w = Math.ceil((bounds.maxX - bounds.minX) / this.cs);
    this.h = Math.ceil((bounds.maxZ - bounds.minZ) / this.cs);
    const n = this.w * this.h;
    this.free = new Uint8Array(n); this.g = new Float32Array(n);
    this.parent = new Int32Array(n); this.seen = new Uint32Array(n); this.closed = new Uint32Array(n);
    this.run = 0;
    this.rebuild();
  }

  rebuild() {
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        const [x, z] = this.center(i, j);
        this.free[j * this.w + i] = this.colliders.isFree(x, z, this.r + 0.05) ? 1 : 0;
      }
    }
  }

  center(i, j) { return [this.b.minX + (i + 0.5) * this.cs, this.b.minZ + (j + 0.5) * this.cs]; }

  cellOf(x, z) {
    const i = Math.min(this.w - 1, Math.max(0, Math.floor((x - this.b.minX) / this.cs)));
    const j = Math.min(this.h - 1, Math.max(0, Math.floor((z - this.b.minZ) / this.cs)));
    return j * this.w + i;
  }

  // Célula livre mais próxima (busca em anéis)
  nearestFree(idx) {
    if (this.free[idx]) return idx;
    const ci = idx % this.w, cj = (idx / this.w) | 0;
    for (let rad = 1; rad < 12; rad++) {
      let best = -1, bestD = Infinity;
      for (let j = cj - rad; j <= cj + rad; j++) {
        for (let i = ci - rad; i <= ci + rad; i++) {
          if (i < 0 || j < 0 || i >= this.w || j >= this.h) continue;
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== rad) continue;
          const k = j * this.w + i;
          if (!this.free[k]) continue;
          const d = (i - ci) ** 2 + (j - cj) ** 2;
          if (d < bestD) { bestD = d; best = k; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  // Linha reta sem obstáculos entre dois pontos?
  lineFree(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.ceil(d / (this.cs * 0.5));
    for (let s = 1; s <= n; s++) {
      const t = s / n;
      if (!this.colliders.isFree(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, this.r)) return false;
    }
    return true;
  }

  // Devolve lista de pontos [{x, z}] até o destino, ou null
  findPath(sx, sz, tx, tz) {
    let start = this.nearestFree(this.cellOf(sx, sz));
    let goal = this.nearestFree(this.cellOf(tx, tz));
    if (start < 0 || goal < 0) return null;
    const goalFreeExact = this.free[this.cellOf(tx, tz)] === 1;
    if (goalFreeExact && this.lineFree(sx, sz, tx, tz)) return [{ x: tx, z: tz }];

    this.run++;
    const run = this.run, W = this.w;
    const gi = goal % W, gj = (goal / W) | 0;
    const heap = new MinHeap();
    this.g[start] = 0; this.seen[start] = run; this.parent[start] = -1;
    heap.push(start, 0);
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
    let found = false;
    while (heap.size) {
      const cur = heap.pop();
      if (this.closed[cur] === run) continue;
      this.closed[cur] = run;
      if (cur === goal) { found = true; break; }
      const ci = cur % W, cj = (cur / W) | 0;
      for (const [di, dj, cost] of dirs) {
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= this.h) continue;
        const nk = nj * W + ni;
        if (!this.free[nk] || this.closed[nk] === run) continue;
        if (di && dj && (!this.free[cj * W + ni] || !this.free[nj * W + ci])) continue; // sem cortar quina
        const ng = this.g[cur] + cost;
        if (this.seen[nk] !== run || ng < this.g[nk]) {
          this.seen[nk] = run; this.g[nk] = ng; this.parent[nk] = cur;
          const hx = Math.abs(ni - gi), hz = Math.abs(nj - gj);
          heap.push(nk, ng + Math.max(hx, hz) + 0.4142 * Math.min(hx, hz));
        }
      }
    }
    if (!found) return null;

    const cells = [];
    for (let k = goal; k !== -1; k = this.parent[k]) cells.push(k);
    cells.reverse();
    const pts = cells.map((k) => { const [x, z] = this.center(k % W, (k / W) | 0); return { x, z }; });
    if (goalFreeExact) pts[pts.length - 1] = { x: tx, z: tz };

    // Suaviza: pula pontos intermediários quando há visão direta
    const out = [];
    let ax = sx, az = sz, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.lineFree(ax, az, pts[j].x, pts[j].z)) j--;
      out.push(pts[j]);
      ax = pts[j].x; az = pts[j].z; i = j + 1;
    }
    return out;
  }
}

class MinHeap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(key, pr) {
    const k = this.k, p = this.p;
    let i = k.length; k.push(key); p.push(pr);
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (p[up] <= pr) break;
      k[i] = k[up]; p[i] = p[up]; i = up;
    }
    k[i] = key; p[i] = pr;
  }
  pop() {
    const k = this.k, p = this.p;
    const top = k[0];
    const lk = k.pop(), lp = p.pop();
    if (k.length) {
      let i = 0;
      const n = k.length;
      while (true) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && p[c + 1] < p[c]) c++;
        if (p[c] >= lp) break;
        k[i] = k[c]; p[i] = p[c]; i = c;
      }
      k[i] = lk; p[i] = lp;
    }
    return top;
  }
}
