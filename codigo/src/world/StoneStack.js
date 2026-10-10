import * as THREE from 'three';
import { softBox } from '../core/Clay.js';
import { CONFIG } from '../config.js';
import { mat } from './World.js';
import { ZoneMarker } from './ZoneMarker.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
export const STONE_COLOR = 0x9a9a94;

// Estoque de pedras: pilha visível sobre um estrado + área de entrega no chão.
export class StoneStack {
  constructor(scene, colliders) {
    const S = CONFIG.stone;
    this.cfg = S;
    this.stock = 0;
    this.capacity = S.capacity;
    this.pos = S.stack;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.visibleMax = 80;
    this.geo = new THREE.DodecahedronGeometry(0.17, 1);
    this.mesh = new THREE.InstancedMesh(this.geo, mat(STONE_COLOR), this.visibleMax);
    this.mesh.castShadow = true; this.mesh.frustumCulled = false;
    for (let i = 0; i < this.visibleMax; i++) this.mesh.setMatrixAt(i, HIDDEN);
    this.group.add(this.mesh);
    const pallet = new THREE.Mesh(softBox(1.8, 0.14, 1.5), mat(CONFIG.colors.woodDark));
    pallet.position.set(this.pos.x, 0.07, this.pos.z); pallet.castShadow = true; pallet.receiveShadow = true;
    this.group.add(pallet);
    // muretas de pedra
    for (const dx of [-0.95, 0.95]) {
      const w = new THREE.Mesh(softBox(0.14, 0.5, 1.5), mat(0x7d7d77));
      w.position.set(this.pos.x + dx, 0.25, this.pos.z); w.castShadow = true; this.group.add(w);
    }
    this.marker = new ZoneMarker(scene, S.zone);
    const ico = new THREE.Shape(); // ícone: pedra
    ico.moveTo(-0.35, -0.2); ico.lineTo(-0.2, 0.25); ico.lineTo(0.2, 0.3); ico.lineTo(0.38, -0.05); ico.lineTo(0.2, -0.3); ico.closePath();
    this.marker.addIcon(ico);
    this.pickMarker = new ZoneMarker(scene, S.pickupZone);
    const up = new THREE.Shape(); // ícone: seta para fora (pegar)
    up.moveTo(-0.2, -0.32); up.lineTo(0.2, -0.32); up.lineTo(0.2, 0.05); up.lineTo(0.38, 0.05); up.lineTo(0, 0.4); up.lineTo(-0.38, 0.05); up.lineTo(-0.2, 0.05);
    this.pickMarker.addIcon(up, Math.PI);
    this.colliders = colliders;
    this.visible = true;
    this.level = 0;
    this.shelter = null;
    this.scene = scene;
    this.setVisible(false);
  }

  // Depósito de pedras: cobertura que cresce a cada nível
  setLevel(level, capacity) {
    this.level = level; this.capacity = capacity;
    if (this.shelter) this.group.remove(this.shelter);
    const g = new THREE.Group(); g.position.set(this.pos.x, 0, this.pos.z);
    const big = level >= 2, w = big ? 3.4 : 2.6, d = big ? 2.6 : 2.0, h = big ? 3.0 : 2.4;
    for (const [px, pz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
      const m = new THREE.Mesh(softBox(0.18, h, 0.18), mat(0x7d7d77)); m.position.set(px, h / 2, pz); m.castShadow = true; g.add(m);
    }
    const roof = new THREE.Mesh(softBox(w + 0.5, 0.14, d + 0.5), mat(big ? 0x55606b : 0x8e3b2f));
    roof.position.y = h; roof.rotation.x = -0.1; roof.castShadow = true; g.add(roof);
    if (big) {
      const wall = new THREE.Mesh(softBox(w, h * 0.7, 0.16), mat(0x9a9a94));
      wall.position.set(0, h * 0.35, -d / 2 - 0.05); wall.castShadow = true; g.add(wall);
    }
    const sign = new THREE.Mesh(softBox(1.4, 0.35, 0.06), mat(0x2b1d14)); sign.position.set(0, h - 0.35, d / 2 + 0.2); g.add(sign);
    this.group.add(g);
    this.shelter = g;
  }

  get space() { return this.capacity - this.stock; }

  setVisible(v) {
    if (v && !this.visible && !this._coll) { this.colliders.addBox(this.pos.x, this.pos.z, 1.0, 0.8); this._coll = true; }
    this.visible = v;
    this.group.visible = v; this.marker.group.visible = v; this.pickMarker.group.visible = v;
  }

  contains(x, z) { return this.visible && this.marker.contains(x, z); }
  inPickup(x, z) { return this.visible && this.pickMarker.contains(x, z); }

  slotPosition(i, out = new THREE.Vector3()) {
    const k = Math.min(i, this.visibleMax - 1);
    const layer = Math.floor(k / 16), j = k % 16;
    out.set(this.pos.x + ((j % 4) - 1.5) * 0.38, 0.3 + layer * 0.24, this.pos.z + (Math.floor(j / 4) - 1.5) * 0.32);
    return out;
  }

  _write() {
    for (let i = 0; i < this.visibleMax; i++) {
      if (i < this.stock) {
        this.slotPosition(i, _p);
        _q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, i * 1.7); _s.set(1.1, 0.8, 1);
        this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      } else this.mesh.setMatrixAt(i, HIDDEN);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  add(n = 1) { const k = Math.min(n, this.space); this.stock += k; this._write(); return k; }
  take(n = 1) { const k = Math.min(n, this.stock); this.stock -= k; this._write(); return k; }
}
