import * as THREE from 'three';
import { softBox } from '../core/Clay.js';
import { CONFIG } from '../config.js';
import { mat } from './World.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

export const PLANK_COLOR = 0xe2bd85;
export const DRY_COLOR = 0xb9763c;   // tábua seca: tom mais escuro e quente

// Depósito de tábuas: estoque (sim) + pilha visível sobre um estrado.
export class PlankStack {
  // opts permite reaproveitar para outros produtos (ex.: tábuas secas)
  constructor(scene, colliders, opts = {}) {
    const P = CONFIG.planks;
    this.stock = 0;
    this.capacity = opts.capacity || P.capacity;
    this.pos = opts.pos || P.stack;
    const color = opts.color || PLANK_COLOR;

    const sz = opts.size || [1.25, 0.07, 0.22];
    this.perLayer = opts.perLayer || 6; this.layers = opts.layers || 14;
    this.layerH = sz[1] + 0.005; this.rowD = sz[2] + 0.025;
    this.visibleMax = this.perLayer * this.layers;
    const geo = softBox(sz[0], sz[1], sz[2]);
    this.mesh = new THREE.InstancedMesh(geo, mat(color), this.visibleMax);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    for (let i = 0; i < this.visibleMax; i++) this.mesh.setMatrixAt(i, HIDDEN);
    scene.add(this.mesh);

    const pallet = new THREE.Mesh(softBox(1.5, 0.14, 1.6), mat(CONFIG.colors.woodDark));
    pallet.position.set(this.pos.x, 0.07, this.pos.z);
    pallet.receiveShadow = true; pallet.castShadow = true;
    scene.add(pallet);
    colliders.addBox(this.pos.x, this.pos.z, 0.75, 0.8);

    this.pop = new Map();
    this.scene = scene;
    this.level = 0;
    this.shelter = null;
  }

  // Ampliação do depósito: mais capacidade e uma cobertura que cresce a cada nível
  setLevel(level, capacity) {
    this.level = level;
    this.capacity = capacity;
    if (this.shelter) this.scene.remove(this.shelter);
    const g = new THREE.Group();
    g.position.set(this.pos.x, 0, this.pos.z);
    const big = level >= 2;
    const w = big ? 3.4 : 2.3, d = big ? 2.8 : 2.1, h = big ? 3.1 : 2.4;
    const post = softBox(0.16, h, 0.16);
    for (const [px, pz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2 - 0.1], [w / 2, d / 2 - 0.1]]) {
      const m = new THREE.Mesh(post, mat(CONFIG.colors.woodDark));
      m.position.set(px, h / 2, pz); m.castShadow = true;
      g.add(m);
    }
    const roof = new THREE.Mesh(softBox(w + 0.5, 0.14, d + 0.5), mat(big ? 0x3f6f8f : 0xa8473a));
    roof.position.y = h; roof.rotation.x = -0.12; roof.castShadow = true;
    g.add(roof);
    if (big) {
      // parede dos fundos e placa
      const wall = new THREE.Mesh(softBox(w, h * 0.8, 0.12), mat(CONFIG.colors.wood));
      wall.position.set(0, h * 0.4, -d / 2 - 0.05); wall.castShadow = true; wall.receiveShadow = true;
      g.add(wall);
    }
    this.scene.add(g);
    this.shelter = g;
  }

  get space() { return this.capacity - this.stock; }

  slotPosition(i, out = new THREE.Vector3()) {
    const layer = Math.floor(i / this.perLayer);
    const row = i % this.perLayer;
    // camadas alternam um leve deslocamento para parecer empilhado à mão
    out.set(this.pos.x + (layer % 2 ? 0.04 : -0.04), 0.14 + this.layerH / 2 + layer * this.layerH, this.pos.z + (row - (this.perLayer - 1) / 2) * this.rowD);
    return out;
  }

  add(n) {
    for (let k = 0; k < n && this.stock < this.capacity; k++) {
      const i = this.stock++;
      if (i < this.visibleMax) this.pop.set(i, 0);
    }
  }

  take(n) {
    const got = Math.min(n, this.stock);
    for (let k = 0; k < got; k++) {
      this.stock--;
      if (this.stock < this.visibleMax) { this.mesh.setMatrixAt(this.stock, HIDDEN); this.pop.delete(this.stock); }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    return got;
  }

  update(dt) {
    if (!this.pop.size) return;
    for (const [i, k0] of this.pop) {
      const k = Math.min(1, k0 + dt * 6);
      this.slotPosition(i, _p);
      _p.y += (1 - k) * 0.4;
      _q.identity();
      _s.set(1, 1, 1);
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      if (k >= 1) this.pop.delete(i); else this.pop.set(i, k);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
