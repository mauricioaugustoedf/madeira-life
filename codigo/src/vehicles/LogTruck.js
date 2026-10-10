import * as THREE from 'three';
import { softBox } from '../core/Clay.js';
import { CONFIG } from '../config.js';
import { mat } from '../world/World.js';
import { getTreeAssets } from '../world/TreeAssets.js';

// Caminhão de toras interno (dirigido pelo jogo).
// GARAGEM → vai ao ponto de carga mais cheio → CARREGA → volta → DESCARREGA no pátio.
// Anda numa grade de navegação própria, com folga maior (não entra no meio das árvores).
const S = { PARK: 0, TO_LP: 1, LOAD: 2, TO_YARD: 3, UNLOAD: 4 };

export class LogTruck {
  constructor(scene, { vnav, yard, loadPoints }) {
    this.cfg = CONFIG.logTruck;
    this.vnav = vnav; this.yard = yard; this.loadPoints = loadPoints;
    this.level = 1;
    this._applyLevel();

    // ---- Modelo (frente para +X no espaço local) ----
    const g = this.object = new THREE.Group();
    const add = (geo, m, x, y, z) => {
      const mesh = new THREE.Mesh(geo, m instanceof THREE.Material ? m : mat(m));
      mesh.position.set(x, y, z); mesh.castShadow = true; g.add(mesh); return mesh;
    };
    add(softBox(4.6, 0.32, 1.7), 0x3a3a3a, 0, 0.62, 0);          // chassi
    this.cabMat = new THREE.MeshLambertMaterial({ color: 0xe8a23a, flatShading: false });
    add(softBox(1.25, 1.35, 1.8), this.cabMat, 1.65, 1.45, 0);    // cabine
    add(softBox(0.4, 0.55, 1.62), 0xbfe6f5, 2.12, 1.75, 0);       // para-brisa
    add(softBox(0.18, 0.28, 1.85), 0x2b2b2b, 2.33, 0.82, 0);      // para-choque
    add(softBox(3.0, 0.12, 1.85), 0x5a3a22, -0.6, 0.84, 0);       // assoalho
    // Fueiros (estacas laterais que seguram as toras)
    const stake = softBox(0.1, 1.0, 0.1);
    for (const x of [-1.95, -0.6, 0.75]) for (const z of [-0.88, 0.88]) add(stake, 0x2b2b2b, x, 1.35, z);
    add(softBox(0.12, 0.9, 1.85), 0x2b2b2b, 0.95, 1.3, 0);        // grade atrás da cabine
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.32, 10); wheelGeo.rotateX(Math.PI / 2);
    this.wheels = [];
    for (const [x, z] of [[1.55, 0.84], [1.55, -0.84], [-1.0, 0.84], [-1.0, -0.84], [-1.85, 0.84], [-1.85, -0.84]]) {
      this.wheels.push(add(wheelGeo, 0x222222, x, 0.4, z));
    }
    // Carga: 2 colunas (ao longo do caminhão) x 5 toras lado a lado, em camadas
    const A = getTreeAssets();
    this.logGeo = A.logGeo; this.logMat = A.trunkMat;
    this.cargoMeshes = [];
    for (let i = 0; i < 50; i++) {
      const layer = Math.floor(i / 10), j = i % 10, col = Math.floor(j / 5), row = j % 5;
      const m = add(A.logGeo, A.trunkMat, -0.6 + (col - 0.5) * 1.4, 1.02 + layer * 0.27, (row - 2) * 0.33 + (layer % 2 ? 0.08 : 0));
      m.castShadow = false; m.visible = false;
      this.cargoMeshes.push(m);
    }
    scene.add(g);
    this.position = g.position;
    const G = this.cfg.garage;
    this.position.set(G.x, 0, G.z);
    this.heading = Math.PI; // de frente para oeste
    g.rotation.y = this.heading;

    this.cargo = 0;
    this.inFlight = 0;      // toras voando para o pátio (contam no save)
    this.state = S.PARK; this.timer = 1;
    this.path = null; this.pathIndex = 0;
    this.lp = null;
    this.waitT = 0;

    // Toras voando (carregar/descarregar)
    this.flyers = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(A.logGeo, A.trunkMat); m.visible = false; scene.add(m);
      this.flyers.push({ m, t: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), done: null });
    }
    this._v = new THREE.Vector3();
  }

  _applyLevel() {
    const L = this.cfg.levels[this.level - 1];
    this.capacity = L.capacity; this.speed = L.speed;
  }

  setLevel(n) { this.level = n; this._applyLevel(); }

  get status() {
    return ['Na garagem', 'Indo ao ponto de carga', 'Carregando toras', 'Levando ao pátio', 'Descarregando no pátio'][this.state];
  }

  _refreshCargo() { this.cargoMeshes.forEach((m, i) => { m.visible = i < this.cargo; }); }

  _fly(from, to, done) {
    const f = this.flyers.find((x) => x.t >= 1);
    if (!f) { done(); return; }
    f.from.copy(from); f.to.copy(to); f.t = 0; f.done = done; f.m.visible = true;
  }

  _bedPoint(i) { return this.cargoMeshes[Math.min(i, this.cargoMeshes.length - 1)].getWorldPosition(this._v).clone(); }

  _drive(tx, tz, next) {
    const path = this.vnav.findPath(this.position.x, this.position.z, tx, tz);
    if (!path) { this.state = S.PARK; this.timer = 2; return false; }
    this.path = path; this.pathIndex = 0; this.state = next;
    return true;
  }

  // Ponto de parada ao lado do ponto de carga (do lado de fora do bosque)
  _stopFor(lp) { return { x: lp.zone.x, z: lp.zone.z + lp.zone.d / 2 + 1.6 }; }

  _pickLoadPoint() {
    let best = null;
    for (const lp of this.loadPoints) {
      if (!lp.visible || lp.stock <= 0) continue;
      if (!best || lp.stock > best.stock) best = lp;
    }
    if (!best) return null;
    // Espera juntar uma carga razoável, mas não para sempre
    if (best.stock < Math.min(this.cfg.minLoad, this.capacity) && this.waitT < 12) return null;
    return best;
  }

  _move(dt) {
    const wp = this.path[this.pathIndex];
    const dx = wp.x - this.position.x, dz = wp.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    const step = this.speed * dt;
    // vira suavemente para a direção do movimento (frente = +X local)
    if (dist > 0.05) {
      const target = Math.atan2(-dz, dx);
      const diff = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
      this.heading += diff * (1 - Math.exp(-6 * dt));
      this.object.rotation.y = this.heading;
    }
    for (const w of this.wheels) w.rotation.z -= Math.min(step, dist) / 0.4;
    if (dist <= step + 0.02) {
      this.position.x = wp.x; this.position.z = wp.z;
      if (++this.pathIndex >= this.path.length) { this.path = null; return true; }
      return false;
    }
    this.position.x += (dx / dist) * step;
    this.position.z += (dz / dist) * step;
    return false;
  }

  _load(dt) {
    // alinha com o ponto de carga (de frente para oeste)
    const diff = Math.atan2(Math.sin(Math.PI - this.heading), Math.cos(Math.PI - this.heading));
    this.heading += diff * (1 - Math.exp(-5 * dt));
    this.object.rotation.y = this.heading;
    this.timer -= dt;
    if (this.timer > 0) return;
    if (this.cargo < this.capacity && this.lp.stock > 0) {
      const from = this.lp.slotPosition(this.lp.stock - 1, new THREE.Vector3());
      this.lp.take(1);
      this.cargo++;
      const to = this._bedPoint(this.cargo - 1);
      this._fly(from, to, () => this._refreshCargo());
      this.timer = this.cfg.loadInterval;
      return;
    }
    this.lp.reservedByTruck = false; this.lp = null;
    const G = this.cfg.garage; this._drive(G.x, G.z, S.TO_YARD);
  }

  update(dt) {
    switch (this.state) {
      case S.PARK: {
        this.timer -= dt;
        if (this.timer > 0) break;
        this.timer = 0.5;
        if (this.cargo > 0) { const G = this.cfg.garage; this._drive(G.x, G.z, S.TO_YARD); break; }
        this.waitT += 0.5;
        const lp = this._pickLoadPoint();
        if (!lp) break;
        this.waitT = 0;
        const st = this._stopFor(lp);
        if (this._drive(st.x, st.z, S.TO_LP)) { this.lp = lp; lp.reservedByTruck = true; }
        break;
      }
      case S.TO_LP:
        if (this._move(dt)) { this.state = S.LOAD; this.timer = 0.3; }
        break;
      case S.TO_YARD:
        if (this._move(dt)) { this.state = S.UNLOAD; this.timer = 0.3; }
        break;
      case S.UNLOAD:
      case S.LOAD:
        if (this.state === S.LOAD) { this._load(dt); break; }
        // estaciona de frente para oeste
        {
          const diff = Math.atan2(Math.sin(Math.PI - this.heading), Math.cos(Math.PI - this.heading));
          this.heading += diff * (1 - Math.exp(-5 * dt));
          this.object.rotation.y = this.heading;
        }
        this.timer -= dt;
        if (this.timer > 0) break;
        if (this.cargo > 0) {
          const from = this._bedPoint(this.cargo - 1);
          this.cargo--; this._refreshCargo();
          const to = this.yard.slotPosition(Math.min(this.yard.stock + this.inFlight, this.yard.visibleMax - 1), new THREE.Vector3());
          this.inFlight++;
          this._fly(from, to, () => { this.inFlight--; this.yard.add(1); });
          this.timer = this.cfg.unloadInterval;
          break;
        }
        this.state = S.PARK; this.timer = 0.6;
        break;
    }

    for (const f of this.flyers) {
      if (f.t >= 1) continue;
      f.t = Math.min(1, f.t + dt * 2.6);
      f.m.position.lerpVectors(f.from, f.to, f.t);
      f.m.position.y += Math.sin(f.t * Math.PI) * 1.6;
      f.m.rotation.y = f.t * 2;
      if (f.t >= 1) { f.m.visible = false; const d = f.done; f.done = null; if (d) d(); }
    }
  }
}
