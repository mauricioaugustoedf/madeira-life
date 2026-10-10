import * as THREE from 'three';
import { softBox } from '../core/Clay.js';
import { CONFIG } from '../config.js';
import { mat } from './World.js';
import { PlankStack, PLANK_COLOR, DRY_COLOR } from './PlankStack.js';
import { ZoneMarker } from './ZoneMarker.js';

const BRICK = 0xb5654a, ROOF = 0x4e5559, METAL = 0x6d7b83;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const _m = new THREE.Matrix4();

// Visual da estufa: canteiro de obra antes de construir; depois prédio de tijolos com
// chaminé (fumaça quando seca), janela que brilha, fila de tábuas na porta e estrado de secas.
export class KilnView {
  constructor(scene, kiln, colliders) {
    this.scene = scene; this.kiln = kiln; this.colliders = colliders;
    const K = CONFIG.kiln;
    this.K = K;

    // Canteiro: terra batida + estacas nos cantos
    this.site = new THREE.Group();
    const dirt = new THREE.Mesh(new THREE.PlaneGeometry(K.size.w + 1.2, K.size.d + 2.6), mat(CONFIG.colors.dirt, false));
    dirt.rotation.x = -Math.PI / 2; dirt.position.set(K.pos.x, 0.021, K.pos.z + 0.9); dirt.receiveShadow = true;
    this.scene.add(dirt);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const st = new THREE.Mesh(softBox(0.1, 0.7, 0.1), mat(0xd8b585));
      st.position.set(K.pos.x + sx * K.size.w / 2, 0.35, K.pos.z + sz * K.size.d / 2);
      this.site.add(st);
    }
    const tape = new THREE.MeshBasicMaterial({ color: 0xf2b134 });
    for (const [w, d, x, z] of [[K.size.w, 0.04, 0, -K.size.d / 2], [K.size.w, 0.04, 0, K.size.d / 2], [0.04, K.size.d, -K.size.w / 2, 0], [0.04, K.size.d, K.size.w / 2, 0]]) {
      const t = new THREE.Mesh(softBox(w, 0.05, d), tape);
      t.position.set(K.pos.x + x, 0.55, K.pos.z + z);
      this.site.add(t);
    }
    scene.add(this.site);
    this.building = null;
    this.smoke = [];
  }

  // Ergue o prédio (chamado quando a obra termina ou ao carregar o save)
  build() {
    const K = this.K, { w, d, h } = K.size, cx = K.pos.x, cz = K.pos.z;
    this.scene.remove(this.site);
    const g = new THREE.Group();
    const add = (geo, color, x, y, z, m) => {
      const mesh = new THREE.Mesh(geo, m || mat(color));
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh); return mesh;
    };
    add(softBox(w, h, d), BRICK, cx, h / 2, cz);
    add(softBox(w + 0.3, 0.2, d + 0.3), ROOF, cx, h + 0.1, cz);
    add(softBox(0.6, 1.8, 0.6), BRICK, cx + w / 2 - 0.6, h + 0.9, cz - d / 2 + 0.6);   // chaminé
    add(softBox(1.3, 1.9, 0.08), METAL, cx - 1.0, 0.95, cz + d / 2 + 0.03);          // porta
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0x5a3a22 });
    add(softBox(1.0, 0.6, 0.06), 0, cx + 0.9, 1.6, cz + d / 2 + 0.03, this.glowMat);  // janela
    this.scene.add(g);
    this.building = g;
    this.colliders.addBox(cx, cz, w / 2, d / 2);

    // Fila de tábuas comuns esperando na porta
    const pg = softBox(1.0, 0.07, 0.2);
    this.queue = new THREE.InstancedMesh(pg, mat(PLANK_COLOR), K.inputCapacity);
    this.queue.castShadow = true; this.queue.frustumCulled = false;
    for (let i = 0; i < K.inputCapacity; i++) this.queue.setMatrixAt(i, HIDDEN);
    this.scene.add(this.queue);
    this._shown = -1;

    // Estoque de secas + área para pegar
    const D = CONFIG.dry;
    this.kiln.dry = new PlankStack(this.scene, this.colliders, { pos: D.stack, capacity: D.capacity, color: DRY_COLOR });
    this.dryZone = new ZoneMarker(this.scene, D.pickupZone);
    const icon = [-0.22, 0, 0.22].map((y) => {
      const r = new THREE.Shape();
      r.moveTo(-0.4, y - 0.07); r.lineTo(0.4, y - 0.07); r.lineTo(0.4, y + 0.07); r.lineTo(-0.4, y + 0.07); r.closePath();
      return r;
    });
    this.dryZone.addIcon(icon);
    this.inZone = new ZoneMarker(this.scene, K.inputZone);
    const arrow = new THREE.Shape();
    arrow.moveTo(-0.22, -0.35); arrow.lineTo(0.22, -0.35); arrow.lineTo(0.22, 0.05);
    arrow.lineTo(0.42, 0.05); arrow.lineTo(0, 0.45); arrow.lineTo(-0.42, 0.05); arrow.lineTo(-0.22, 0.05);
    this.inZone.addIcon(arrow);   // seta apontando para a porta

    // Fumaça da chaminé
    const sm = new THREE.MeshLambertMaterial({ color: 0xdddddd, transparent: true, opacity: 0.6, depthWrite: false });
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 2), sm.clone());
      s.visible = false;
      this.scene.add(s);
      this.smoke.push({ s, t: Math.random() });
    }
    this.kiln.built = true;
  }

  get doorPoint() { return new THREE.Vector3(this.K.pos.x - 1.0, 0.6, this.K.pos.z + this.K.size.d / 2 + 0.3); }

  update(dt, time, playerAtIn, playerAtDry) {
    if (!this.building) return;
    const k = this.kiln, K = this.K;
    // fila na porta
    const n = Math.min(k.input, K.inputCapacity);
    if (n !== this._shown) {
      this._shown = n;
      for (let i = 0; i < K.inputCapacity; i++) {
        if (i < n) {
          _m.makeTranslation(K.pos.x - 1.0 + (i % 2 ? 0.0 : 0.02), 0.04 + Math.floor(i / 2) * 0.075, K.pos.z + K.size.d / 2 + 0.28 + (i % 2) * 0.22);
          this.queue.setMatrixAt(i, _m);
        } else this.queue.setMatrixAt(i, HIDDEN);
      }
      this.queue.instanceMatrix.needsUpdate = true;
    }
    // janela acesa e fumaça enquanto seca
    const on = k.running;
    this.glowMat.color.setHex(on ? (Math.sin(time * 4) > 0 ? 0xffa53a : 0xff8a1f) : 0x5a3a22);
    const top = new THREE.Vector3(K.pos.x + K.size.w / 2 - 0.6, K.size.h + 1.9, K.pos.z - K.size.d / 2 + 0.6);
    for (const p of this.smoke) {
      if (!on && !p.s.visible) continue;
      p.t += dt * 0.45;
      if (p.t >= 1) { p.t = 0; p.s.visible = on; }
      p.s.position.set(top.x + Math.sin(p.t * 5 + time) * 0.2, top.y + p.t * 2.2, top.z);
      p.s.scale.setScalar(0.6 + p.t * 1.4);
      p.s.material.opacity = 0.55 * (1 - p.t);
    }
    this.inZone.setActive(playerAtIn && k.space > 0, time);
    this.dryZone.setActive(playerAtDry && k.dry && k.dry.stock > 0, time);
  }
}
