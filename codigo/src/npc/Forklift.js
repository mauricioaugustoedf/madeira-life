import * as THREE from 'three';
import { softBox } from '../core/Clay.js';
import { CONFIG } from '../config.js';
import { mat } from '../world/World.js';
import { CharacterModel } from '../player/CharacterModel.js';
import { Deliverer } from './Deliverer.js';

// Empilhadeira: mesmo trabalho do entregador (estoque certo → caminhão do cliente),
// mas leva muitas tábuas de uma vez no garfo. Frente para +Z local.
export class Forklift extends Deliverer {
  constructor(scene, deps, spawn) {
    super(scene, deps, spawn);
    scene.remove(this.object);
    this.level = 1;
    this.cfg = { ...CONFIG.forklift };
    this._applyLevel();

    const g = new THREE.Group();
    const add = (w, h, d, c, x, y, z) => {
      const m = new THREE.Mesh(softBox(w, h, d), c instanceof THREE.Material ? c : mat(c));
      m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
    };
    add(1.15, 0.6, 1.5, 0xf2b134, 0, 0.6, -0.1);           // corpo amarelo
    add(1.15, 0.55, 0.35, 0x3a3a3a, 0, 0.75, -0.95);        // contrapeso
    add(0.08, 1.4, 0.08, 0x3a3a3a, 0.45, 1.6, -0.75);       // teto (colunas)
    add(0.08, 1.4, 0.08, 0x3a3a3a, -0.45, 1.6, -0.75);
    add(0.08, 1.4, 0.08, 0x3a3a3a, 0.45, 1.6, 0.45);
    add(0.08, 1.4, 0.08, 0x3a3a3a, -0.45, 1.6, 0.45);
    add(1.1, 0.06, 1.35, 0x3a3a3a, 0, 2.3, -0.15);
    add(0.1, 2.2, 0.1, 0x555555, 0.38, 1.2, 0.72);          // torre
    add(0.1, 2.2, 0.1, 0x555555, -0.38, 1.2, 0.72);
    const wheel = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 10); wheel.rotateZ(Math.PI / 2);
    this.wheels = [];
    for (const [x, z] of [[0.55, 0.4], [-0.55, 0.4], [0.55, -0.7], [-0.55, -0.7]]) {
      const w = new THREE.Mesh(wheel, mat(0x222222)); w.position.set(x, 0.3, z); g.add(w); this.wheels.push(w);
    }
    // Garfo (sobe um pouco quando carrega)
    this.fork = new THREE.Group(); this.fork.position.set(0, 0.18, 0.8);
    for (const x of [-0.25, 0.25]) {
      const f = new THREE.Mesh(softBox(0.12, 0.05, 1.1), mat(0x555555)); f.position.set(x, 0, 0.5); this.fork.add(f);
    }
    g.add(this.fork);
    // Motorista sentado
    const driver = new CharacterModel(this.cfg.appearance, { headwear: 'helmet' });
    driver.group.scale.setScalar(0.85);
    driver.group.position.set(0, 0.3, -0.35);
    driver.legL.rotation.x = driver.legR.rotation.x = -1.4;
    driver.armL.rotation.x = driver.armR.rotation.x = -0.9;
    g.add(driver.group);

    // Tábuas no garfo: o grupo back do entregador vira a pilha no garfo
    this.back.removeFromParent();
    this.back = new THREE.Group(); this.back.position.set(0, 0.06, 0.6);
    this.backPlanks = [];
    const geo = softBox(0.85, 0.06, 0.2);
    for (let i = 0; i < 48; i++) {
      // 4 tábuas lado a lado por camada (em profundidade)
      const m = new THREE.Mesh(geo, this.backMat);
      m.position.set(0, Math.floor(i / 4) * 0.065, (i % 4) * 0.22);
      m.castShadow = true; m.visible = false;
      this.back.add(m); this.backPlanks.push(m);
    }
    this.fork.add(this.back);

    g.position.copy(this.position);
    this.object = g;
    this.position = g.position;
    scene.add(g);
    this.model = { animate: () => {} };
  }

  _applyLevel() {
    const L = CONFIG.forklift.levels[this.level - 1];
    this.cfg.capacity = L.capacity; this.cfg.speed = L.speed;
  }

  setLevel(n) { this.level = n; this._applyLevel(); }

  get status() { return super.status.replace('tábuas', 'tábuas (empilhadeira)'); }

  update(dt, time) {
    const before = this.position.x + this.position.z;
    super.update(dt, time);
    const moved = Math.abs(this.position.x + this.position.z - before);
    for (const w of this.wheels) w.rotation.x += moved / 0.3;
    // garfo sobe com carga
    const target = this.carrying > 0 ? 0.45 : 0.18;
    this.fork.position.y += (target - this.fork.position.y) * (1 - Math.exp(-6 * dt));
  }
}
