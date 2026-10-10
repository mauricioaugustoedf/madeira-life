import * as THREE from 'three';
import { softBox } from '../core/Clay.js';
import { CONFIG } from '../config.js';
import { mat } from './World.js';
import { PlankStack } from './PlankStack.js';
import { ZoneMarker } from './ZoneMarker.js';
import { getTreeAssets } from './TreeAssets.js';

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const _m = new THREE.Matrix4();

// Galpão de uma máquina de produto: prédio com porta e chaminé de exaustão, área de entrada
// (insumo empilhado na frente), estoque do produto pronto e área para pegar.
export class MachineView {
  constructor(scene, machine, colliders) {
    this.scene = scene; this.m = machine; this.colliders = colliders;
    const D = machine.def, R = CONFIG.machineRow;
    this.D = D;
    const Z = D.z ?? R.z;
    this.pos = { x: D.x, z: Z };
    this.inZoneRect = { x: D.x - 0.8, z: Z + R.d / 2 + 1.2, w: 1.4, d: 1.0 };
    this.outStackPos = { x: D.x + 1.05, z: Z + R.d / 2 + 0.95 };
    this.outZoneRect = { x: D.x + 1.05, z: Z + R.d / 2 + 2.5, w: 1.4, d: 0.9 };
    this.buildZone = { x: D.x - 0.8, z: Z + R.d / 2 + 2.9, w: 1.6, d: 1.0 };
    this.group = null;
  }

  // Zonas que o caminhão interno deve evitar
  get zones() { return [this.inZoneRect, this.outZoneRect, this.buildZone]; }

  build() {
    if (this.group) return;
    const D = this.D, R = CONFIG.machineRow, { x, z } = this.pos;
    const g = this.group = new THREE.Group();
    const add = (geo, color, px, py, pz) => {
      const m = new THREE.Mesh(geo, mat(color)); m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
    };
    add(softBox(R.w, R.h, R.d), D.color, x, R.h / 2, z);
    add(softBox(R.w + 0.3, 0.18, R.d + 0.3), 0x4e5559, x, R.h + 0.09, z);
    add(softBox(1.1, 1.7, 0.06), 0x6d7b83, x - 0.75, 0.85, z + R.d / 2 + 0.03);   // porta de entrada
    add(softBox(0.9, 1.2, 0.06), 0x3a3a3a, x + 0.85, 0.6, z + R.d / 2 + 0.03);   // saída
    add(softBox(0.8, 0.5, 0.06), 0x9fd3e6, x + 0.85, 1.75, z + R.d / 2 + 0.03);   // janela (acende à noite)
    add(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 8), 0x9aa3ab, x + R.w / 2 - 0.45, R.h + 0.6, z - 0.4); // exaustor
    this.fan = add(softBox(0.5, 0.05, 0.08), 0x3a3a3a, x + R.w / 2 - 0.45, R.h + 1.22, z - 0.4);
    this.lampMat = new THREE.MeshBasicMaterial({ color: 0xd9534f });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), this.lampMat);
    lamp.position.set(x, R.h - 0.35, z + R.d / 2 + 0.08); g.add(lamp);
    this.scene.add(g);
    this.colliders.addBox(x, z, R.w / 2, R.d / 2);

    // Insumo esperando na porta
    const inputColor = D.input === 'log' ? null : (CONFIG.products[D.input] || {}).color;
    const A = getTreeAssets();
    const geo = D.input === 'log' ? A.logGeo : softBox(1.0, 0.07, 0.2);
    this.queue = new THREE.InstancedMesh(geo, D.input === 'log' ? A.trunkMat : mat(inputColor), D.inputCap);
    this.queue.castShadow = true; this.queue.frustumCulled = false;
    for (let i = 0; i < D.inputCap; i++) this.queue.setMatrixAt(i, HIDDEN);
    this.scene.add(this.queue);
    this._shown = -1;

    // Produto pronto
    const P = CONFIG.products[D.product];
    this.m.out = new PlankStack(this.scene, this.colliders, { pos: this.outStackPos, capacity: D.outCap, color: P.color, size: P.size, perLayer: P.perLayer, layers: P.layers });
    this.outZone = new ZoneMarker(this.scene, this.outZoneRect);
    const icon = [-0.2, 0, 0.2].map((y) => { const r = new THREE.Shape(); r.moveTo(-0.38, y - 0.07); r.lineTo(0.38, y - 0.07); r.lineTo(0.38, y + 0.07); r.lineTo(-0.38, y + 0.07); r.closePath(); return r; });
    this.outZone.addIcon(icon);
    this.inZone = new ZoneMarker(this.scene, this.inZoneRect);
    const arrow = new THREE.Shape();
    arrow.moveTo(-0.2, -0.32); arrow.lineTo(0.2, -0.32); arrow.lineTo(0.2, 0.05); arrow.lineTo(0.38, 0.05); arrow.lineTo(0, 0.4); arrow.lineTo(-0.38, 0.05); arrow.lineTo(-0.2, 0.05);
    this.inZone.addIcon(arrow, Math.PI);   // aponta para a porta (norte)
    this.m.built = true;
  }

  get doorPoint() { return new THREE.Vector3(this.pos.x - 0.75, 0.6, this.pos.z + CONFIG.machineRow.d / 2 + 0.3); }

  update(dt, time, playerAtIn, playerAtOut) {
    if (!this.group) return;
    const m = this.m, D = this.D, R = CONFIG.machineRow;
    const n = Math.min(m.input, D.inputCap);
    if (n !== this._shown) {
      this._shown = n;
      const log = D.input === 'log';
      for (let i = 0; i < D.inputCap; i++) {
        if (i < n) {
          if (log) _m.makeTranslation(this.pos.x - 0.75, 0.15 + Math.floor(i / 3) * 0.27, this.pos.z + R.d / 2 + 0.35 + (i % 3) * 0.32);
          else _m.makeTranslation(this.pos.x - 0.75, 0.04 + Math.floor(i / 2) * 0.075, this.pos.z + R.d / 2 + 0.3 + (i % 2) * 0.22);
          this.queue.setMatrixAt(i, _m);
        } else this.queue.setMatrixAt(i, HIDDEN);
      }
      this.queue.instanceMatrix.needsUpdate = true;
    }
    this.fan.rotation.y += dt * (m.running ? 14 : 0.5);
    this.lampMat.color.setHex(m.running ? 0x5cd65c : (m.input > 0 ? 0xf2b134 : 0xd9534f));
    this.m.out.update(dt);
    this.inZone.setActive(playerAtIn && m.space > 0, time);
    this.outZone.setActive(playerAtOut && m.out.stock > 0, time);
  }
}
