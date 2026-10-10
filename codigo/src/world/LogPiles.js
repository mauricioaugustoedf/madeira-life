import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { getTreeAssets } from './TreeAssets.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

// Toras soltas no chão (todas num único InstancedMesh com vagas reaproveitáveis).
// Na Etapa 3 o transporte vai recolher daqui.
export class LogPiles {
  constructor(scene) {
    const A = getTreeAssets();
    this.max = CONFIG.logs.maxOnGround;
    this.mesh = new THREE.InstancedMesh(A.logGeo, A.trunkMat, this.max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    for (let i = 0; i < this.max; i++) this.mesh.setMatrixAt(i, HIDDEN);
    scene.add(this.mesh);

    this.slots = new Array(this.max).fill(null); // {x, y, z, yaw, pop}
    this.free = [];
    for (let i = this.max - 1; i >= 0; i--) this.free.push(i);
    this.popping = new Set();
    this.piles = [];      // grupos de toras {x, z, ids[]} — útil para o transporte
    this.totalProduced = 0;
  }

  get count() { return this.max - this.free.length; }
  get isFull() { return this.free.length < CONFIG.forest.logsPerTree; }

  // Cria uma pilha de n toras deitadas na direção (dirX, dirZ)
  addPile(x, z, dirX, dirZ, n) {
    const yaw = Math.atan2(-dirZ, dirX); // eixo da tora alinhado com a queda
    const px = -dirZ, pz = dirX;         // perpendicular, para lado a lado
    const ids = [];
    for (let k = 0; k < n && this.free.length; k++) {
      const id = this.free.pop();
      const row = k < 2 ? 0 : 1;
      const off = row === 0 ? (k - 0.5) * 0.36 : 0;
      this.slots[id] = { x: x + px * off, y: 0.17 + row * 0.3, z: z + pz * off, yaw, pop: 0 };
      this.popping.add(id);
      ids.push(id);
    }
    if (ids.length) this.piles.push({ x, z, dx: dirX, dz: dirZ, ids });
    this.totalProduced += ids.length;
    return ids.length;
  }

  // Pega 1 tora da pilha mais próxima dentro do raio. Devolve {x, y, z} de onde saiu, ou null.
  takeNearest(x, z, radius) {
    let best = null, bestD = radius * radius;
    for (const p of this.piles) {
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d <= bestD) { bestD = d; best = p; }
    }
    if (!best) return null;
    const id = best.ids.pop();
    const s = this.slots[id];
    const from = s ? { x: s.x, y: s.y, z: s.z } : { x: best.x, y: 0.2, z: best.z };
    this.remove(id);
    if (!best.ids.length) this.piles.splice(this.piles.indexOf(best), 1);
    return from;
  }

  // Pilha livre (não reservada por outro carregador) mais próxima de (x, z)
  nearestPile(x, z) {
    let best = null, bestD = Infinity;
    for (const p of this.piles) {
      if (p.reserved || !p.ids.length) continue;
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  // Tira 1 tora de uma pilha específica. Devolve {x, y, z} ou null se a pilha acabou.
  takeFrom(pile) {
    if (!this.piles.includes(pile) || !pile.ids.length) return null;
    const id = pile.ids.pop();
    const s = this.slots[id];
    const from = s ? { x: s.x, y: s.y, z: s.z } : { x: pile.x, y: 0.2, z: pile.z };
    this.remove(id);
    if (!pile.ids.length) this.piles.splice(this.piles.indexOf(pile), 1);
    return from;
  }

  // Remove n toras das pilhas mais antigas (usado na produção offline)
  removeLogs(n) {
    let left = n;
    while (left > 0 && this.piles.length) {
      const p = this.piles[0];
      while (left > 0 && p.ids.length) { this.remove(p.ids.pop()); left--; }
      if (!p.ids.length) this.piles.shift();
    }
    return n - left;
  }

  remove(id) {
    if (!this.slots[id]) return;
    this.slots[id] = null;
    this.popping.delete(id);
    this.mesh.setMatrixAt(id, HIDDEN);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.free.push(id);
  }

  _write(id) {
    const s = this.slots[id];
    const k = s.pop;
    const scale = k < 1 ? 1 - Math.pow(1 - k, 3) * 1 + Math.sin(k * Math.PI) * 0.15 : 1;
    _q.setFromAxisAngle(UP, s.yaw);
    _p.set(s.x, s.y + (1 - Math.min(1, k)) * 0.6, s.z);
    _s.setScalar(Math.max(0.001, scale));
    this.mesh.setMatrixAt(id, _m.compose(_p, _q, _s));
  }

  update(dt) {
    if (!this.popping.size) return;
    for (const id of this.popping) {
      const s = this.slots[id];
      s.pop = Math.min(1, s.pop + dt * 3);
      this._write(id);
      if (s.pop >= 1) this.popping.delete(id);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
