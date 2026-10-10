import * as THREE from 'three';
import { mat } from './World.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _e = new THREE.Euler();

// Visual da pedreira: chão de cascalho e rochas que diminuem conforme são quebradas.
export class QuarryView {
  constructor(scene, quarry, land) {
    this.q = quarry;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    const R = land.rect;
    // chão de cascalho em volta das rochas
    const xs = quarry.rocks.map((r) => r.x), zs = quarry.rocks.map((r) => r.z);
    const minX = Math.min(...xs) - 3, maxX = Math.max(...xs) + 3, minZ = Math.min(...zs) - 3, maxZ = Math.max(...zs) + 3;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ), mat(0xb9ab8f, false));
    ground.rotation.x = -Math.PI / 2; ground.position.set((minX + maxX) / 2, 0.02, (minZ + maxZ) / 2);
    ground.receiveShadow = true;
    this.group.add(ground);
    void R;
    const n = 96;   // capacidade (o modo editar adiciona rochas)
    this.big = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1.0, 1), mat(0x8e8e88), n);
    this.top = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.6, 1), mat(0xa3a39c), n);
    this.rubble = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.35, 1), mat(0x7a7a74), n);
    for (const m of [this.big, this.top, this.rubble]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.group.add(m); }
  }

  setVisible(v) { this.group.visible = v; }

  update(time) {
    const Q = this.q;
    if (!Q.dirty || !this.group.visible) return;
    Q.dirty = false;
    const cnt = Math.min(96, Q.rocks.length);
    this.big.count = this.top.count = this.rubble.count = cnt;
    for (const r of Q.rocks) {
      if (r.id >= 96) continue;
      if (r.removed) {
        _m.makeScale(0, 0, 0);
        this.big.setMatrixAt(r.id, _m); this.top.setMatrixAt(r.id, _m); this.rubble.setMatrixAt(r.id, _m);
        continue;
      }
      const k = r.stone / Q.cfg.stonePerRock;          // 1 cheia → 0 esgotada
      const s = r.scale * (k > 0 ? 0.45 + 0.55 * k : 0.001);
      const wob = r.shake > 0 ? Math.sin(time * 50) * 0.06 * r.shake : 0;
      _e.set(wob, r.id * 1.3, 0.15); _q.setFromEuler(_e);
      _p.set(r.x, 0.55 * s, r.z); _s.set(s * 1.25, s * 0.85, s);
      this.big.setMatrixAt(r.id, _m.compose(_p, _q, _s));
      _p.set(r.x + 0.3 * s, 1.15 * s, r.z - 0.2 * s); _s.setScalar(s);
      this.top.setMatrixAt(r.id, _m.compose(_p, _q, _s));
      _p.set(r.x, 0.12, r.z); _s.set(1.4, 0.5, 1.2);
      this.rubble.setMatrixAt(r.id, _m.compose(_p, _q, _s));
    }
    this.big.instanceMatrix.needsUpdate = true;
    this.top.instanceMatrix.needsUpdate = true;
    this.rubble.instanceMatrix.needsUpdate = true;
  }
}
