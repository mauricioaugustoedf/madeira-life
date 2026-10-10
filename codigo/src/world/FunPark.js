import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { softBox } from '../core/Clay.js';
import { mat } from './World.js';

// Parque de diversões: tenda listrada + roda-gigante girando devagar.
// Fica num ponto fixo do mapa; os jogos acontecem no painel (ui/FunPanel.js).
const RED = new THREE.Color(0xe0574a), CREAM = new THREE.Color(0xfff1df), BLUE = new THREE.Color(0x5aa0d8), YEL = new THREE.Color(0xf4c04a);

// Pinta listras verticais (gomos) na geometria, alternando duas cores
function stripes(geo, n, a, b) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const ang = Math.atan2(cz, cx) + Math.PI;
    const c = Math.floor(ang / (Math.PI * 2) * n) % 2 ? a : b;
    for (let k = 0; k < 3; k++) { col[(i + k) * 3] = c.r; col[(i + k) * 3 + 1] = c.g; col[(i + k) * 3 + 2] = c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function paint(geo, c) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export class FunPark {
  constructor(scene, colliders, { tent, wheel }) {
    this.scene = scene; this.colliders = colliders;
    this.P = { tent, wheel };
    this.group = new THREE.Group();
    this.built = false;
    this._cols = [];
  }

  build() {
    if (this.built) return;
    this.built = true;
    const { tent, wheel } = this.P;
    const vmat = new THREE.MeshLambertMaterial({ vertexColors: true });

    // ---- Tenda ----
    const t = new THREE.Group(); t.position.set(tent.x, 0, tent.z);
    const R = tent.r;
    const parts = [];
    const wall = new THREE.CylinderGeometry(R, R * 1.03, 1.7, 28); wall.translate(0, 0.85, 0);
    parts.push(stripes(wall, 14, RED, CREAM));
    const roof = new THREE.ConeGeometry(R * 1.18, 1.7, 28); roof.translate(0, 1.7 + 0.85, 0);
    parts.push(stripes(roof, 14, RED, CREAM));
    const rim = new THREE.TorusGeometry(R * 1.12, 0.09, 8, 28); rim.rotateX(Math.PI / 2); rim.translate(0, 1.72, 0);
    parts.push(paint(rim, YEL));
    // bandeirolas na borda do telhado
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const f = new THREE.ConeGeometry(0.13, 0.26, 4); f.rotateX(Math.PI); f.translate(Math.cos(a) * R * 1.12, 1.55, Math.sin(a) * R * 1.12);
      parts.push(paint(f, i % 2 ? BLUE : YEL));
    }
    const pole = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8); pole.translate(0, 3.7, 0);
    parts.push(paint(pole, CREAM));
    const ball = new THREE.SphereGeometry(0.1, 12, 8); ball.translate(0, 4.12, 0);
    parts.push(paint(ball, YEL));
    const flag = new THREE.ConeGeometry(0.16, 0.5, 3); flag.rotateZ(-Math.PI / 2); flag.scale(1, 1, 0.25); flag.translate(0.27, 3.95, 0);
    parts.push(paint(flag, BLUE));
    // entrada (de frente para a câmera) com balcão
    const door = softBox(1.15, 1.35, 0.2); door.translate(0, 0.68, R - 0.02);
    parts.push(paint(door, new THREE.Color(0x7a3426)));
    const counter = softBox(1.6, 0.55, 0.45); counter.translate(0, 0.28, R + 0.3);
    parts.push(paint(counter, new THREE.Color(0xc98a52)));
    const top = softBox(1.75, 0.08, 0.55); top.translate(0, 0.58, R + 0.3);
    parts.push(paint(top, CREAM));
    for (const g of parts) { if (g.attributes.uv) g.deleteAttribute('uv'); }
    const tentMesh = new THREE.Mesh(mergeGeometries(parts.map((g) => g.index ? g.toNonIndexed() : g), false), vmat);
    tentMesh.castShadow = true; tentMesh.receiveShadow = true;
    t.add(tentMesh);
    // letreiro sobre a entrada
    this.signCanvas = document.createElement('canvas'); this.signCanvas.width = 256; this.signCanvas.height = 72;
    const c = this.signCanvas.getContext('2d');
    c.fillStyle = '#fff7ec'; c.beginPath(); c.roundRect(4, 4, 248, 64, 26); c.fill();
    c.fillStyle = '#d2463a'; c.font = '800 36px Rubik, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('PARQUE', 128, 38);
    const tex = new THREE.CanvasTexture(this.signCanvas); tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.42), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    sign.position.set(0, 1.55, R + 0.12); sign.rotation.x = -0.25;
    t.add(sign);
    this.group.add(t);

    // ---- Roda-gigante ----
    const w = new THREE.Group(); w.position.set(wheel.x, 0, wheel.z);
    const WR = wheel.r, hub = WR + 0.55;
    const legs = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const l = new THREE.CylinderGeometry(0.07, 0.09, Math.hypot(hub, WR * 0.55), 10);
      l.rotateX(sz * 0.12); l.rotateZ(sx * 0.32); l.translate(sx * WR * 0.27, hub / 2, sz * 0.28);
      legs.push(paint(l, CREAM));
    }
    const base = softBox(WR * 1.4, 0.18, 0.9); base.translate(0, 0.09, 0);
    legs.push(paint(base, new THREE.Color(0xc98a52)));
    for (const g of legs) if (g.attributes.uv) g.deleteAttribute('uv');
    const frame = new THREE.Mesh(mergeGeometries(legs.map((g) => g.index ? g.toNonIndexed() : g), false), vmat);
    frame.castShadow = true;
    w.add(frame);
    // parte que gira: aro + raios
    this.rotor = new THREE.Group(); this.rotor.position.set(0, hub, 0);
    const rp = [];
    for (const z of [-0.18, 0.18]) {
      const ring = new THREE.TorusGeometry(WR, 0.05, 8, 36); ring.translate(0, 0, z); rp.push(paint(ring, BLUE));
    }
    for (let i = 0; i < 8; i++) {
      const s = new THREE.CylinderGeometry(0.03, 0.03, WR, 6); s.translate(0, WR / 2, 0); s.rotateZ(i / 8 * Math.PI * 2);
      rp.push(paint(s, CREAM));
    }
    const axle = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 14); axle.rotateX(Math.PI / 2); rp.push(paint(axle, YEL));
    for (const g of rp) if (g.attributes.uv) g.deleteAttribute('uv');
    const rotorMesh = new THREE.Mesh(mergeGeometries(rp.map((g) => g.index ? g.toNonIndexed() : g), false), vmat);
    rotorMesh.castShadow = true;
    this.rotor.add(rotorMesh);
    // cabines (ficam sempre na vertical)
    this.cabins = [];
    const cabCols = [RED, YEL, BLUE, new THREE.Color(0x6cc070)];
    for (let i = 0; i < 8; i++) {
      const cg = softBox(0.42, 0.34, 0.4); cg.translate(0, -0.22, 0);
      const cab = new THREE.Mesh(paint(cg, cabCols[i % 4]), vmat);
      cab.castShadow = true;
      this.rotor.add(cab);
      this.cabins.push({ mesh: cab, a: i / 8 * Math.PI * 2 });
    }
    w.add(this.rotor);
    this.group.add(w);
    this.scene.add(this.group);

    // bloqueia a passagem
    this._cols.push(this.colliders.addCircle(tent.x, tent.z, R + 0.15));
    this._cols.push(this.colliders.addBox(tent.x, tent.z + R + 0.3, 0.85, 0.3));
    this._cols.push(this.colliders.addBox(wheel.x, wheel.z, WR * 0.72, 0.5));
    this.update(0);
  }

  update(dt) {
    if (!this.built) return;
    this.rotor.rotation.z -= dt * 0.25;
    const WR = this.P.wheel.r;
    for (const c of this.cabins) {
      c.mesh.position.set(Math.cos(c.a) * WR, Math.sin(c.a) * WR, 0);
      c.mesh.rotation.z = -this.rotor.rotation.z;   // cabine sempre "em pé"
    }
  }
}
