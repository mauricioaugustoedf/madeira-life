import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { mat, box } from './World.js';
import { GLOW_MAT, POOL_MAT } from '../core/DayNight.js';

// Casa com telhado de duas águas (frente para +Z)
function house(w, h, d, wall, roofColor, doorColor = 0x5a3a22) {
  const g = new THREE.Group();
  g.add(box(w, h, d, wall, 0, h / 2, 0));
  const roofH = Math.min(w, d) * 0.35;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - 0.3, 0); shape.lineTo(w / 2 + 0.3, 0); shape.lineTo(0, roofH); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d + 0.6, bevelEnabled: false });
  geo.translate(0, h, -(d + 0.6) / 2);
  const roof = new THREE.Mesh(geo, mat(roofColor)); roof.castShadow = true; roof.receiveShadow = true;
  g.add(roof);
  g.add(box(Math.min(1.1, w * 0.3), Math.min(1.9, h * 0.7), 0.1, doorColor, w * 0.2, Math.min(1.9, h * 0.7) / 2, d / 2 + 0.05, false));
  g.add(box(Math.min(1.0, w * 0.25), 0.8, 0.1, 0x9fd3e6, -w * 0.22, h * 0.58, d / 2 + 0.05, false));
  return g;
}

// Catálogo de decoração: preço, como desenhar e o tamanho que bloqueia a passagem
export const DECOR = {
  escritorio: { label: 'Escritório', price: 1500, col: { w: 4.2, d: 3.6 }, build: () => house(4.2, 2.8, 3.6, 0xe8dcc4, 0x4f6d8a) },
  casa: { label: 'Casa de madeira', price: 1200, col: { w: 3.2, d: 2.8 }, build: () => house(3.2, 2.4, 2.8, 0xb07a4a, 0x8e3b2f) },
  galpao: { label: 'Galpãozinho', price: 900, col: { w: 2.6, d: 2.2 }, build: () => house(2.6, 2.0, 2.2, 0x7d8b6a, 0x55606b, 0x3a3a3a) },
  banco: { label: 'Banco', price: 120, col: { w: 1.4, d: 0.5 }, build: () => {
    const g = new THREE.Group();
    g.add(box(1.4, 0.08, 0.45, 0x8a5a33, 0, 0.45, 0));
    g.add(box(1.4, 0.35, 0.06, 0x8a5a33, 0, 0.7, -0.2));
    for (const x of [-0.6, 0.6]) g.add(box(0.08, 0.45, 0.4, 0x3a3a3a, x, 0.22, 0));
    return g;
  } },
  flores: { label: 'Canteiro de flores', price: 90, col: { w: 1.4, d: 1.0 }, build: () => {
    const g = new THREE.Group();
    g.add(box(1.4, 0.22, 1.0, 0x8a5a33, 0, 0.11, 0));
    g.add(box(1.25, 0.06, 0.85, 0x5a3a22, 0, 0.24, 0, false));
    const cols = [0xe74c3c, 0xf1c40f, 0xe36aa8, 0xffffff, 0x9b59b6];
    for (let i = 0; i < 10; i++) {
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 2), mat(cols[i % cols.length]));
      f.position.set(-0.5 + (i % 5) * 0.25, 0.36, i < 5 ? -0.2 : 0.2); g.add(f);
    }
    return g;
  } },
  arbusto: { label: 'Arbusto', price: 50, col: { r: 0.5 }, build: () => {
    const g = new THREE.Group();
    for (const [x, y, z, r] of [[0, 0.45, 0, 0.55], [0.35, 0.35, 0.15, 0.38], [-0.3, 0.32, -0.1, 0.36]]) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), mat(0x4f8f3a)); m.position.set(x, y, z); m.castShadow = true; g.add(m);
    }
    return g;
  } },
  poste: { label: 'Poste de luz', price: 180, col: { r: 0.15 }, build: () => {
    const g = new THREE.Group();
    g.add(box(0.12, 3.0, 0.12, 0x3a3a3a, 0, 1.5, 0));
    g.add(box(0.7, 0.08, 0.1, 0x3a3a3a, 0.3, 2.95, 0));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff1b0 }));
    lamp.position.set(0.6, 2.8, 0); g.add(lamp);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), GLOW_MAT);   // brilha à noite
    glow.position.copy(lamp.position); glow.castShadow = false; glow.userData.noShadow = true; g.add(glow);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.8, 20).rotateX(-Math.PI / 2), POOL_MAT);   // luz no chão
    pool.position.set(0.6, 0.04, 0); pool.userData.noShadow = true; g.add(pool);
    return g;
  } },
  cerca: { label: 'Cerca (2 m)', price: 60, col: { w: 2.2, d: 0.2 }, build: () => {
    const g = new THREE.Group();
    for (const x of [-1, 0, 1]) g.add(box(0.12, 0.9, 0.12, CONFIG.colors.fence, x, 0.45, 0));
    for (const y of [0.35, 0.7]) g.add(box(2.2, 0.08, 0.06, CONFIG.colors.fence, 0, y, 0));
    return g;
  } },
  pedra: { label: 'Pedra decorativa', price: 60, col: { r: 0.8 }, build: (s = 1) => {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 1), mat(CONFIG.colors.rock));
    m.scale.set(s * 1.3, s * 0.8, s); m.position.y = 0.35 * s; m.rotation.set(0.3, s * 2.1, 0.2);
    m.castShadow = true; m.receiveShadow = true;
    const g = new THREE.Group(); g.add(m); return g;
  } },
};

const DEFAULTS = [
  ['escritorio', -9, 8, 0, 1],
  ['poste', -5.6, 6.2, 0, 1], ['poste', 4.6, 2.2, 0, 1], ['poste', 11.0, 16.6, 0, 1], ['poste', 3.4, -9.4, 0, 1],
  ['flores', -12.2, 9.6, 0, 1], ['arbusto', -12.4, 6.0, 0, 1], ['banco', -8.2, 12.8, 0, 1],
  ['pedra', -4, -12, 0, 1.0], ['pedra', 15, 12, 0, 1.3], ['pedra', 14, 3, 0, 0.8], ['pedra', -15, 14, 0, 1.1], ['pedra', -2.5, 16.5, 0, 0.9],
];

// Objetos decorativos que o jogador pode mover, girar, excluir e comprar no modo editar
export class Decor {
  constructor(scene, colliders) {
    this.scene = scene; this.colliders = colliders;
    this.items = [];
    for (const [type, x, z, rot, s] of DEFAULTS) this.add(type, x, z, rot, s);
  }

  _col(it) {
    const c = DECOR[it.type].col, s = it.s || 1;
    if (c.r) return this.colliders.addCircle(it.x, it.z, c.r * s);
    // caixas giradas: 0/180° mantém, 90/270° troca largura e fundo, diagonal vira círculo
    const q = ((Math.round(it.rot / (Math.PI / 4)) % 8) + 8) % 8;
    if (q % 2) return this.colliders.addCircle(it.x, it.z, Math.min(c.w, c.d) / 2);
    const swap = q % 4 === 2;
    return this.colliders.addBox(it.x, it.z, (swap ? c.d : c.w) / 2, (swap ? c.w : c.d) / 2);
  }

  // Raio aproximado (para tocar/selecionar e checar sobreposição)
  radius(it) { const c = DECOR[it.type].col; return (c.r || Math.max(c.w, c.d) / 2) * (it.s || 1); }

  add(type, x, z, rot = 0, s = 1) {
    if (!DECOR[type]) return null;
    const g = DECOR[type].build(s);
    g.traverse((o) => { if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(x, 0, z); g.rotation.y = rot;
    this.scene.add(g);
    const it = { type, x, z, rot, s, group: g };
    it.col = this._col(it);
    this.items.push(it);
    return it;
  }

  move(it, x, z) {
    this.colliders.remove(it.col);
    it.x = x; it.z = z; it.group.position.set(x, 0, z);
    it.col = this._col(it);
  }

  rotate(it, by = Math.PI / 4) {
    this.colliders.remove(it.col);
    it.rot = (it.rot + by) % (Math.PI * 2);
    it.group.rotation.y = it.rot;
    it.col = this._col(it);
  }

  remove(it) {
    this.colliders.remove(it.col);
    this.scene.remove(it.group);
    this.items.splice(this.items.indexOf(it), 1);
  }

  toJSON() { return this.items.map((it) => [it.type, +it.x.toFixed(2), +it.z.toFixed(2), +it.rot.toFixed(3), +(it.s || 1).toFixed(2)]); }

  load(list) {
    for (const it of this.items.slice()) this.remove(it);
    for (const [type, x, z, rot, s] of list) this.add(type, x, z, rot, s);
  }
}
