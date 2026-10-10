import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Stage } from '../sim/Forest.js';
import { getTreeAssets } from './TreeAssets.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

// Visual da floresta: árvores instanciadas que crescem, tremem ao levar machadada,
// caem e viram toco. Só atualiza as árvores que mudaram.
export class ForestView {
  constructor(scene, forest, timeUniform) {
    this.forest = forest;
    const A = getTreeAssets(timeUniform);
    this.A = A;
    const n = 1500; // capacidade (terrenos novos e o modo editar adicionam árvores)
    this.capacity = n;

    this.trunks = new THREE.InstancedMesh(A.trunkGeo, A.trunkMat, n);
    // Copa com atributo de transparência por árvore (para não tampar o jogador)
    const crownGeo = A.crownGeo.clone();
    this.fade = new Float32Array(n).fill(1);
    this.fadeAttr = new THREE.InstancedBufferAttribute(this.fade, 1);
    this.fadeAttr.setUsage(THREE.DynamicDrawUsage);
    crownGeo.setAttribute('aFade', this.fadeAttr);
    this.crowns = new THREE.InstancedMesh(crownGeo, A.crownMatFade, n);
    this.stumps = new THREE.InstancedMesh(A.stumpGeo, A.stumpMat, n);
    for (const m of [this.trunks, this.crowns, this.stumps]) {
      m.castShadow = true; m.receiveShadow = true;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false; // a caixa de corte do instanced não acompanha o crescimento
      scene.add(m);
    }
    this.young = new THREE.Color(0x7cc66b);
    this.base = new THREE.Color(CONFIG.colors.pine);
    this.light = new THREE.Color(CONFIG.colors.pineLight);
    this._c = new THREE.Color();
    this.shaking = new Set();
    this._setCount();
    forest.onGrow = () => this._setCount();

    // Árvores caindo (pool pequeno, reaproveitado)
    this.fallers = [];
    for (let i = 0; i < 3; i++) {
      const pivot = new THREE.Group();
      const trunk = new THREE.Mesh(A.trunkGeo, A.trunkMat);
      const crown = new THREE.Mesh(A.crownGeo, A.crownMatStatic.clone());
      crown.position.y = A.crownOffset;
      trunk.castShadow = crown.castShadow = true;
      pivot.add(trunk, crown);
      pivot.visible = false;
      scene.add(pivot);
      this.fallers.push({ pivot, crown, busy: false, t: 0, tree: null, dir: null, cb: null });
    }
  }

  _setCount() {
    const c = Math.min(this.capacity, this.forest.trees.length);
    this.trunks.count = c; this.crowns.count = c; this.stumps.count = c;
  }

  _sync(t, time) {
    if (t.id >= this.capacity) return;
    const i = t.id;
    if (t.stage === Stage.REMOVED) {
      this.trunks.setMatrixAt(i, HIDDEN); this.crowns.setMatrixAt(i, HIDDEN); this.stumps.setMatrixAt(i, HIDDEN);
      return;
    }
    if (t.stage === Stage.FALLING || t.stage === Stage.STUMP) {
      this.trunks.setMatrixAt(i, HIDDEN);
      this.crowns.setMatrixAt(i, HIDDEN);
      _p.set(t.x, 0, t.z); _q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, t.rot); _s.setScalar(t.scale);
      this.stumps.setMatrixAt(i, _m.compose(_p, _q, _s));
      return;
    }
    this.stumps.setMatrixAt(i, HIDDEN);
    const s = t.scale * (0.18 + 0.82 * t.growth);
    const wob = t.shake > 0 ? Math.sin(time * 45) * 0.07 * t.shake : 0;
    _e.set(wob, t.rot, wob * 0.6);
    _q.setFromEuler(_e);
    _s.setScalar(s);
    _p.set(t.x, 0, t.z);
    this.trunks.setMatrixAt(i, _m.compose(_p, _q, _s));
    _p.y = this.A.crownOffset * s;
    this.crowns.setMatrixAt(i, _m.compose(_p, _q, _s));
    // Muda clarinha; adulta com tom de pinheiro
    this._c.copy(this.base).lerp(this.light, t.tint * 0.8);
    if (t.growth < 1) this._c.lerp(this.young, (1 - t.growth) * 0.7);
    this.crowns.setColorAt(i, this._c);
  }

  // Anima a queda e chama onLanded(direção) quando a árvore toca o chão
  playFall(t, dirX, dirZ, onLanded) {
    const f = this.fallers.find((x) => !x.busy);
    if (!f) { onLanded(); return; }
    f.busy = true; f.t = 0; f.tree = t; f.cb = onLanded;
    f.axis = new THREE.Vector3(dirZ, 0, -dirX).normalize(); // eixo perpendicular à queda
    f.pivot.position.set(t.x, 0, t.z);
    f.pivot.scale.setScalar(t.scale);
    f.pivot.quaternion.identity();
    f.pivot.rotation.y = t.rot;
    f.baseQ = f.pivot.quaternion.clone();
    f.crown.material.color.copy(this.base).lerp(this.light, t.tint * 0.8);
    f.pivot.visible = true;
  }

  // Árvores entre a câmera e o ponto focado ficam semitransparentes.
  // A câmera fica sempre "atrás" (+Z) do foco, então basta um corredor em X/Z.
  _updateFade(dt, focus) {
    let changed = false;
    const k = 1 - Math.exp(-8 * dt);
    for (const t of this.forest.trees) {
      const dz = t.z - focus.z, dx = Math.abs(t.x - focus.x);
      const occludes = dz > -0.6 && dz < 9 && dx < 1.9 + dz * 0.12;
      const target = occludes ? 0.28 : 1;
      const f = this.fade[t.id];
      if (Math.abs(f - target) > 0.01) {
        this.fade[t.id] = f + (target - f) * k;
        changed = true;
      } else if (f !== target) { this.fade[t.id] = target; changed = true; }
    }
    if (changed) this.fadeAttr.needsUpdate = true;
  }

  update(dt, time, focus) {
    if (focus) this._updateFade(dt, focus);
    const F = this.forest;
    let changed = F.dirty.size > 0;
    for (const t of F.dirty) { if (t.shake > 0) this.shaking.add(t); this._sync(t, time); }
    F.dirty.clear();
    for (const t of this.shaking) {
      t.shake = Math.max(0, t.shake - dt * 3.5);
      this._sync(t, time);
      changed = true;
      if (t.shake === 0) this.shaking.delete(t);
    }
    if (changed) {
      this.trunks.instanceMatrix.needsUpdate = true;
      this.crowns.instanceMatrix.needsUpdate = true;
      this.stumps.instanceMatrix.needsUpdate = true;
      if (this.crowns.instanceColor) this.crowns.instanceColor.needsUpdate = true;
    }

    for (const f of this.fallers) {
      if (!f.busy) continue;
      f.t += dt;
      const T = 1.1;
      const k = Math.min(1, f.t / T);
      // Começa devagar e acelera, como uma árvore de verdade
      const ang = (Math.PI / 2 - 0.08) * k * k;
      _q.setFromAxisAngle(f.axis, ang);
      f.pivot.quaternion.copy(_q).multiply(f.baseQ);
      if (k >= 1 && f.cb) { const cb = f.cb; f.cb = null; cb(); }
      // Depois de cair, afunda e some
      if (f.t > T + 0.35) f.pivot.position.y -= dt * 1.2;
      if (f.t > T + 0.9) { f.busy = false; f.pivot.visible = false; }
    }
  }
}
