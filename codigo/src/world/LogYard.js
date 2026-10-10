import * as THREE from 'three';
import { softBox } from '../core/Clay.js';
import { CONFIG } from '../config.js';
import { getTreeAssets } from './TreeAssets.js';
import { mat } from './World.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

// Pátio de toras: estoque de toras prontas para a serra.
// Faixa amarela no chão = área de descarga. A pilha atrás cresce visivelmente.
export class LogYard {
  constructor(scene, colliders) {
    const Y = CONFIG.yard;
    this.stock = 0;
    this.drop = Y.drop;

    // Área de descarga marcada no chão
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.PlaneGeometry(Y.drop.w, Y.drop.d), mat(0x9a7448, false));
    base.rotation.x = -Math.PI / 2; base.receiveShadow = true;
    g.add(base);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf2b134 });
    const t = 0.12;
    for (const [w, d, x, z] of [
      [Y.drop.w, t, 0, -Y.drop.d / 2 + t / 2], [Y.drop.w, t, 0, Y.drop.d / 2 - t / 2],
      [t, Y.drop.d, -Y.drop.w / 2 + t / 2, 0], [t, Y.drop.d, Y.drop.w / 2 - t / 2, 0],
    ]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w, d), stripeMat);
      s.rotation.x = -Math.PI / 2; s.position.set(x, 0.005, z);
      g.add(s);
    }
    // Seta indicando "descarregue aqui"
    const arrow = new THREE.Shape();
    arrow.moveTo(-0.25, 0.2); arrow.lineTo(0.25, 0.2); arrow.lineTo(0.25, -0.05);
    arrow.lineTo(0.45, -0.05); arrow.lineTo(0, -0.45); arrow.lineTo(-0.45, -0.05); arrow.lineTo(-0.25, -0.05);
    const am = new THREE.Mesh(new THREE.ShapeGeometry(arrow), stripeMat);
    am.rotation.x = -Math.PI / 2; am.position.set(0, 0.006, 0);
    am.rotation.z = Math.PI; // aponta para a pilha
    g.add(am);
    g.position.set(Y.drop.x, 0.03, Y.drop.z);
    scene.add(g);

    // Pilha: 2 colunas x 5 toras por camada x 6 camadas = 60 visíveis
    this.cols = 2; this.perLayer = 5; this.layers = 6;
    this.visibleMax = this.cols * this.perLayer * this.layers;
    const A = getTreeAssets();
    this.mesh = new THREE.InstancedMesh(A.logGeo, A.trunkMat, this.visibleMax);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    for (let i = 0; i < this.visibleMax; i++) this.mesh.setMatrixAt(i, HIDDEN);
    scene.add(this.mesh);
    this.stackPos = Y.stack;

    // Estrado de madeira sob a pilha
    const pallet = new THREE.Mesh(softBox(2.9, 0.12, 2.0), mat(CONFIG.colors.woodDark));
    pallet.position.set(Y.stack.x, 0.06, Y.stack.z); pallet.receiveShadow = true;
    scene.add(pallet);
    colliders.addBox(Y.stack.x, Y.stack.z, 1.45, 1.0);

    this.pop = new Map(); // id -> progresso da animação de entrada
  }

  // Posição no mundo da tora de índice i (para animar a tora voando até lá)
  slotPosition(i, out = new THREE.Vector3()) {
    const layer = Math.floor(i / (this.cols * this.perLayer));
    const inLayer = i % (this.cols * this.perLayer);
    const col = Math.floor(inLayer / this.perLayer);
    const row = inLayer % this.perLayer;
    const off = layer % 2 ? 0.17 : 0;
    out.set(
      this.stackPos.x + (col - 0.5) * 1.38,
      0.12 + 0.17 + layer * 0.3,
      this.stackPos.z + (row - 2) * 0.36 + off - (layer % 2 ? 0.17 : 0)
    );
    return out;
  }

  inDropZone(x, z) {
    const d = this.drop;
    return Math.abs(x - d.x) <= d.w / 2 && Math.abs(z - d.z) <= d.d / 2;
  }

  add(n = 1) {
    for (let k = 0; k < n; k++) {
      const i = this.stock;
      this.stock++;
      if (i < this.visibleMax) this.pop.set(i, 0);
    }
  }

  // Retira toras (a serra da Etapa 3 vai usar)
  take(n = 1) {
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
      const k = Math.min(1, k0 + dt * 5);
      this.slotPosition(i, _p);
      _p.y += (1 - k) * 0.8;
      _q.setFromAxisAngle(UP, 0);
      _s.setScalar(0.4 + 0.6 * k);
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      if (k >= 1) this.pop.delete(i); else this.pop.set(i, k);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
