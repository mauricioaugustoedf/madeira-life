import * as THREE from 'three';
import { softBox } from '../core/Clay.js';
import { CONFIG } from '../config.js';
import { SawState } from '../sim/Sawmill.js';
import { mat } from './World.js';
import { getTreeAssets } from './TreeAssets.js';
import { PLANK_COLOR } from './PlankStack.js';
import { ZoneMarker } from './ZoneMarker.js';

const MACHINE = 0x3f7466;   // verde-petróleo da máquina
const MACHINE_DARK = 0x2b4f46;
const STEEL = 0xb8c0c6;

// Visual da serra: mesa de entrada com roletes, corpo com volante e lâmina,
// mesa de saída. A tora percorre a linha e sai como tábuas.
export class SawmillView {
  constructor(scene, sawmill, colliders, particles) {
    const C = CONFIG.sawmill;
    this.saw = sawmill;
    this.particles = particles;
    this.C = C;
    const cx = C.pos.x, cz = C.pos.z;
    const tableY = 0.62;
    this.tableY = tableY;
    const g = new THREE.Group();
    scene.add(g);

    const add = (geo, color, x, y, z, cast = true) => {
      const m = new THREE.Mesh(geo, mat(color));
      m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true;
      g.add(m); return m;
    };

    // Mesas de entrada e saída com roletes
    this.rollers = [];
    const rollerGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.62, 8);
    rollerGeo.rotateX(Math.PI / 2);
    const table = (x0, x1) => {
      const len = x1 - x0, mid = (x0 + x1) / 2;
      add(softBox(len, 0.08, 0.08), MACHINE_DARK, mid, tableY - 0.08, cz - 0.34);
      add(softBox(len, 0.08, 0.08), MACHINE_DARK, mid, tableY - 0.08, cz + 0.34);
      for (const lx of [x0 + 0.1, x1 - 0.1]) for (const lz of [-0.34, 0.34]) {
        add(softBox(0.08, tableY - 0.08, 0.08), MACHINE_DARK, lx, (tableY - 0.08) / 2, cz + lz);
      }
      const n = Math.max(3, Math.round(len / 0.32));
      for (let i = 0; i < n; i++) {
        const r = add(rollerGeo, STEEL, x0 + 0.12 + (i * (len - 0.24)) / (n - 1), tableY - 0.04, cz, false);
        this.rollers.push(r);
      }
    };
    table(C.infeedStart, cx - 0.55);
    table(cx + 0.55, C.outfeedEnd);

    // Corpo da serra
    add(softBox(1.1, tableY, 1.3), MACHINE, cx, tableY / 2, cz);
    add(softBox(1.2, 0.06, 1.4), MACHINE_DARK, cx, tableY + 0.03, cz);
    add(softBox(0.3, 2.3, 0.3), MACHINE, cx, 1.15, cz - 0.62);        // coluna
    add(softBox(0.34, 0.3, 0.95), MACHINE, cx, 2.15, cz - 0.2);        // braço superior
    // Volante (roda que gira) e lâmina
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16);
    wheelGeo.rotateX(Math.PI / 2);
    this.wheel = new THREE.Group();
    this.wheel.position.set(cx + 0.2, 1.75, cz - 0.62);
    const wheelMesh = new THREE.Mesh(wheelGeo, mat(MACHINE_DARK));
    wheelMesh.castShadow = true;
    this.wheel.add(wheelMesh);
    const spoke = new THREE.Mesh(softBox(0.7, 0.08, 0.12), mat(STEEL));
    this.wheel.add(spoke);
    g.add(this.wheel);
    this.blade = add(softBox(0.03, 1.25, 0.1), STEEL, cx, tableY + 0.65, cz, false);
    // Lâmpada de status
    this.lampMat = new THREE.MeshBasicMaterial({ color: 0xd9534f });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), this.lampMat);
    lamp.position.set(cx, 2.38, cz - 0.2);
    g.add(lamp);

    colliders.addBox((C.infeedStart + C.outfeedEnd) / 2, cz, (C.outfeedEnd - C.infeedStart) / 2, 0.55);

    // Tora em processamento e tábuas saindo
    const A = getTreeAssets();
    this.log = new THREE.Mesh(A.logGeo, A.trunkMat);
    this.log.castShadow = true; this.log.visible = false;
    this.barkMat = A.trunkMat;
    this.cleanMat = new THREE.MeshLambertMaterial({ color: 0xe0b77e, flatShading: false }); // tora descascada
    scene.add(this.log);
    this.planks = new THREE.Group();
    const plankGeo = softBox(1.25, 0.07, 0.22);
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(plankGeo, mat(PLANK_COLOR));
      p.position.set(0, 0.04 + Math.floor(i / 2) * 0.075, (i % 2 - 0.5) * 0.24);
      p.castShadow = true;
      this.planks.add(p);
    }
    this.planks.visible = false;
    scene.add(this.planks);

    // Área do operador (onde você fica para operar)
    this.zone = new ZoneMarker(scene, C.operatorZone);
    const gear = new THREE.Shape();
    const teeth = 8;
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const r = i % 2 ? 0.3 : 0.38;
      if (i === 0) gear.moveTo(Math.cos(a) * r, Math.sin(a) * r); else gear.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const hole = new THREE.Path(); hole.absarc(0, 0, 0.13, 0, Math.PI * 2, true);
    gear.holes.push(hole);
    this.zone.addIcon(gear);

    this.group = g;
    this.spin = 0;
    this._dust = 0;
    this._pop = 0;
  }

  // Melhoria visível: nova cor de pintura e um "pulo" da máquina
  setLevel(L, quiet = false) {
    mat(MACHINE).color.setHex(L.color);
    this.wheel.scale.setScalar(1 + (L.level - 1) * 0.12);
    if (quiet) return;
    this._pop = 1;
    this.particles.burst(this.C.pos.x, 1.2, this.C.pos.z, 16, 3);
  }

  update(dt, time, operatorPresent) {
    const s = this.saw, C = this.C;
    const cx = C.pos.x, cz = C.pos.z, y = this.tableY + 0.17;
    const active = s.state !== SawState.IDLE;

    // Volante e roletes aceleram/desaceleram suavemente
    const target = s.running ? 1 : 0;
    this.spin += (target - this.spin) * (1 - Math.exp(-4 * dt));
    this.wheel.rotation.z -= dt * 14 * this.spin;
    for (const r of this.rollers) r.rotation.z -= dt * 6 * this.spin;
    this.blade.position.x = cx + (this.spin > 0.1 ? Math.sin(time * 70) * 0.006 : 0);
    this.lampMat.color.setHex(s.running ? 0x5cd65c : (operatorPresent ? 0xf2b134 : 0xd9534f));
    this.zone.setActive(operatorPresent, time);

    if (this._pop > 0) {
      this._pop = Math.max(0, this._pop - dt * 2.5);
      this.group.position.y = Math.sin(this._pop * Math.PI) * 0.25; // pulinho
    }
    for (let i = 0; i < this.planks.children.length; i++) this.planks.children[i].visible = i < s.planksPerLog;

    const k = s.phaseProgress;
    this.log.visible = s.state === SawState.FEED || s.state === SawState.CUT;
    this.log.material = s.curDebarked ? this.cleanMat : this.barkMat;
    this.planks.visible = s.state === SawState.OUT;
    if (s.state === SawState.FEED) {
      // tora rola da pilha até a lâmina
      const x0 = C.infeedStart + 0.65, x1 = cx - 0.62;
      this.log.position.set(x0 + (x1 - x0) * k, y, cz);
      this.log.rotation.x = -k * 6;
    } else if (s.state === SawState.CUT) {
      const x0 = cx - 0.62, x1 = cx + 0.62;
      this.log.position.set(x0 + (x1 - x0) * k, y, cz);
      this.log.rotation.x = 0;
      if (s.running) {
        this._dust -= dt;
        if (this._dust <= 0) { this._dust = 0.08; this.particles.burst(cx + 0.05, this.tableY + 0.3, cz + 0.1, 3, 1.4); }
      }
    } else if (s.state === SawState.OUT) {
      const x0 = cx + 0.62, x1 = C.outfeedEnd - 0.55;
      this.planks.position.set(x0 + (x1 - x0) * k, this.tableY, cz);
    }
    return active;
  }
}
