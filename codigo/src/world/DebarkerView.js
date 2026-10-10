import * as THREE from 'three';
import { softBox } from '../core/Clay.js';
import { CONFIG } from '../config.js';
import { mat } from './World.js';
import { getTreeAssets } from './TreeAssets.js';

const BODY = 0xc8642c, DARK = 0x3a3a3a, STEEL = 0xb8c0c6;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);
const BELT_Y = 0.5;

// Visual do descascador e das esteiras. Toras com casca na entrada, claras (sem casca) na saída.
export class DebarkerView {
  constructor(scene, debarker, colliders, particles) {
    this.d = debarker; this.particles = particles; this.colliders = colliders;
    const D = CONFIG.debarker;
    this.D = D;
    const g = this.group = new THREE.Group();
    g.visible = false;
    scene.add(g);
    const add = (geo, color, x, y, z, parent = g) => {
      const m = new THREE.Mesh(geo, mat(color)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    };
    const { x, z } = D.pos, { w, d, h } = D.size;
    // Corpo com o tambor que gira por cima
    add(softBox(w, h * 0.6, d), BODY, x, h * 0.3, z);
    add(softBox(w + 0.1, 0.08, d + 0.1), DARK, x, h * 0.6, z);
    const drumGeo = new THREE.CylinderGeometry(0.42, 0.42, w * 0.85, 10); drumGeo.rotateZ(Math.PI / 2);
    this.drum = add(drumGeo, STEEL, x, h * 0.6 + 0.3, z);
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(softBox(w * 0.85, 0.06, 0.12), mat(DARK));
      fin.position.set(0, Math.cos(i * Math.PI / 2) * 0.42, Math.sin(i * Math.PI / 2) * 0.42);
      fin.rotation.x = i * Math.PI / 2;
      this.drum.add(fin);
    }
    add(softBox(0.12, 0.9, 0.12), DARK, x - w / 2 + 0.1, h * 0.6 + 0.3, z);
    add(softBox(0.12, 0.9, 0.12), DARK, x + w / 2 - 0.1, h * 0.6 + 0.3, z);
    this.lampMat = new THREE.MeshBasicMaterial({ color: 0xd9534f });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), this.lampMat);
    lamp.position.set(x + w / 2 - 0.1, h * 0.6 + 0.8, z); g.add(lamp);

    // Esteiras: base escura + ripas que andam
    this.belts = [debarker.inBelt, debarker.outBelt];
    this.slats = [];
    const slatGeo = softBox(0.62, 0.03, 0.1);
    for (const belt of this.belts) {
      for (const sg of belt.segs) {
        const cx = sg.x0 + sg.dx * sg.len / 2, cz = sg.z0 + sg.dz * sg.len / 2;
        const ang = Math.atan2(sg.dx, sg.dz);
        const frame = new THREE.Group(); frame.position.set(cx, 0, cz); frame.rotation.y = ang; g.add(frame);
        add(softBox(0.66, 0.1, sg.len + 0.3), DARK, 0, BELT_Y - 0.06, 0, frame);
        add(softBox(0.06, 0.18, sg.len + 0.3), STEEL, -0.36, BELT_Y, 0, frame);
        add(softBox(0.06, 0.18, sg.len + 0.3), STEEL, 0.36, BELT_Y, 0, frame);
        for (const lz of [-sg.len / 2, sg.len / 2]) for (const lx of [-0.3, 0.3]) add(softBox(0.07, BELT_Y - 0.1, 0.07), DARK, lx, (BELT_Y - 0.1) / 2, lz, frame);
      }
      const n = Math.max(2, Math.floor(belt.length / 0.3));
      const inst = new THREE.InstancedMesh(slatGeo, mat(0x555555), n);
      inst.frustumCulled = false;
      g.add(inst);
      this.slats.push({ belt, inst, n });
    }
    this.slatOffset = 0;

    // Toras nas esteiras
    const A = getTreeAssets();
    const geo = A.logGeo.clone(); geo.scale(0.5, 0.9, 0.9);
    this.barkLogs = new THREE.InstancedMesh(geo, A.trunkMat, 8);
    this.cleanLogs = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xe0b77e, flatShading: false }), 12);
    for (const m of [this.barkLogs, this.cleanLogs]) { m.castShadow = true; m.frustumCulled = false; g.add(m); }
    this.cleanMat = this.cleanLogs.material;
    this._pt = {};
    this._bark = 0;
  }

  // Liga o visual (depois da obra) e bloqueia a passagem
  build() {
    if (this.group.visible) return;
    this.group.visible = true;
    const D = this.D;
    this.colliders.addBox(D.pos.x, D.pos.z, D.size.w / 2 + 0.05, D.size.d / 2 + 0.05);
    for (const belt of this.belts) for (const sg of belt.segs) {
      const cx = sg.x0 + sg.dx * sg.len / 2, cz = sg.z0 + sg.dz * sg.len / 2;
      const hx = Math.abs(sg.dx) * sg.len / 2 + 0.36, hz = Math.abs(sg.dz) * sg.len / 2 + 0.36;
      this.colliders.addBox(cx, cz, hx, hz);
    }
  }

  _place(mesh, i, belt, s) {
    belt.at(s, this._pt);
    _p.set(this._pt.x, BELT_Y + 0.17, this._pt.z);
    // tora atravessada na esteira (comprimento perpendicular ao movimento)
    _q.setFromAxisAngle(UP, Math.atan2(this._pt.dx, this._pt.dz));
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
  }

  update(dt) {
    if (!this.group.visible) return;
    const d = this.d, D = this.D;
    this.drum.rotation.x += dt * (d.running ? 9 : 1.5);
    this.lampMat.color.setHex(d.running ? 0x5cd65c : 0xf2b134);
    // ripas andando
    this.slatOffset = (this.slatOffset + dt * D.beltSpeed) % 0.3;
    for (const { belt, inst, n } of this.slats) {
      for (let i = 0; i < n; i++) {
        const s = (i * 0.3 + this.slatOffset) % belt.length;
        belt.at(s, this._pt);
        _p.set(this._pt.x, BELT_Y + 0.0, this._pt.z);
        _q.setFromAxisAngle(UP, Math.atan2(this._pt.dx, this._pt.dz));
        inst.setMatrixAt(i, _m.compose(_p, _q, _s));
      }
      inst.instanceMatrix.needsUpdate = true;
    }
    // toras
    let i = 0;
    for (const s of d.inBelt.items) if (i < 8) this._place(this.barkLogs, i++, d.inBelt, s);
    for (; i < 8; i++) this.barkLogs.setMatrixAt(i, HIDDEN);
    i = 0;
    for (const s of d.outBelt.items) if (i < 12) this._place(this.cleanLogs, i++, d.outBelt, s);
    for (; i < 12; i++) this.cleanLogs.setMatrixAt(i, HIDDEN);
    this.barkLogs.instanceMatrix.needsUpdate = true;
    this.cleanLogs.instanceMatrix.needsUpdate = true;
    // lascas de casca saindo
    if (d.running) {
      this._bark -= dt;
      if (this._bark <= 0) { this._bark = 0.12; this.particles.burst(D.pos.x, D.size.h * 0.9, D.pos.z, 2, 1.6); }
    }
  }
}
