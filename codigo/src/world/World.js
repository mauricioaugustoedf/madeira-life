import * as THREE from 'three';
import { softBox } from '../core/Clay.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { Colliders } from './Colliders.js';
import { NavGrid } from './NavGrid.js';
import { getTreeAssets } from './TreeAssets.js';

// Materiais compartilhados: um por cor (menos trocas de estado na GPU)
const matCache = new Map();
export function mat(color, flat = false) {
  const key = color + (flat ? 'f' : 's');
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, flatShading: flat }));
  return matCache.get(key);
}

const _boxGeo = new Map();
function boxGeoCached(w, h, d) {
  const k = w + '|' + h + '|' + d;
  if (!_boxGeo.has(k)) _boxGeo.set(k, softBox(w, h, d));
  return _boxGeo.get(k);
}

export function box(w, h, d, color, x, y, z, shadow = true) {
  const m = new THREE.Mesh(boxGeoCached(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}

// Gerador pseudoaleatório com semente: o mapa sai sempre igual
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = new Colliders(4);
    this.timeUniform = { value: 0 };
    this.root = new THREE.Group();
    scene.add(this.root);

    const P = CONFIG.plot;
    this.bounds = { minX: P.minX, maxX: P.maxX, minZ: P.minZ, maxZ: P.maxZ }; // área liberada atual
    this.colliders.setBounds(P.minX + 0.6, P.minZ + 0.6, P.maxX - 0.6, P.maxZ - 0.6);
    this.fenceGroup = null;

    this._ground();
    this._fence();
    this._buildings();
    this._trees();
    this._grass();
    // pedras e escritório agora são decoração editável (world/Decor.js)
    this.nav = null;
  }

  // Grade de caminhos (jogador e NPCs). Chamar depois que todos os obstáculos existirem.
  buildNav() {
    this.nav = new NavGrid(this.colliders, this.colliders.bounds, 0.5, CONFIG.player.radius);
    return this.nav;
  }

  _ground() {
    const C = CONFIG.colors, P = CONFIG.plot;
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), mat(C.grassOuter, false));
    outer.rotation.x = -Math.PI / 2; outer.receiveShadow = true;
    this.root.add(outer);

    const w = P.maxX - P.minX, d = P.maxZ - P.minZ;
    const plot = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(C.grassPlot, false));
    plot.rotation.x = -Math.PI / 2; plot.position.set((P.minX + P.maxX) / 2, 0.01, (P.minZ + P.maxZ) / 2);
    plot.receiveShadow = true;
    this.root.add(plot);

    // Pátio de terra da serraria
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), mat(C.dirt, false));
    yard.rotation.x = -Math.PI / 2; yard.position.set(6, 0.02, -5); yard.receiveShadow = true;
    this.root.add(yard);

    // Estrada de terra por onde passam os caminhões dos clientes
    const road = new THREE.Mesh(new THREE.PlaneGeometry(240, 4.2), mat(C.path, false));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.015, CONFIG.dock.roadZ);
    road.receiveShadow = true;
    this.root.add(road);

    // Caminho do escritório até o pátio
    const path = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 14), mat(C.path, false));
    path.rotation.x = -Math.PI / 2; path.rotation.z = 0.5; path.position.set(-3, 0.025, 4.5);
    path.receiveShadow = true;
    this.root.add(path);
  }

  // Libera um terreno novo: a área cresce, a cerca é refeita e a grama clara cobre o lote
  expand(rect) {
    const B = this.bounds;
    B.minX = Math.min(B.minX, rect.minX); B.maxX = Math.max(B.maxX, rect.maxX);
    B.minZ = Math.min(B.minZ, rect.minZ); B.maxZ = Math.max(B.maxZ, rect.maxZ);
    this.colliders.setBounds(B.minX + 0.6, B.minZ + 0.6, B.maxX - 0.6, B.maxZ - 0.6);
    const w = rect.maxX - rect.minX, d = rect.maxZ - rect.minZ;
    const plot = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(CONFIG.colors.grassPlot, false));
    plot.rotation.x = -Math.PI / 2; plot.position.set((rect.minX + rect.maxX) / 2, 0.011, (rect.minZ + rect.maxZ) / 2);
    plot.receiveShadow = true;
    this.root.add(plot);
    this._fence();
    if (this.nav) this.nav.resize(this.colliders.bounds);
  }

  _fence() {
    if (this.fenceGroup) { this.root.remove(this.fenceGroup); this.fenceGroup.traverse((o) => o.geometry && o.geometry.dispose()); }
    const g = new THREE.Group();
    this.fenceGroup = g;
    const P = this.bounds, C = CONFIG.colors;
    const spacing = 2.5;
    const pts = [];
    for (let x = P.minX; x <= P.maxX; x += spacing) { pts.push([x, P.minZ], [x, P.maxZ]); }
    for (let z = P.minZ + spacing; z < P.maxZ; z += spacing) { pts.push([P.minX, z], [P.maxX, z]); }
    const post = new THREE.InstancedMesh(softBox(0.22, 1.1, 0.22), mat(C.fence), pts.length);
    const m4 = new THREE.Matrix4();
    pts.forEach(([x, z], i) => { m4.makeTranslation(x, 0.55, z); post.setMatrixAt(i, m4); });
    post.castShadow = true;
    g.add(post);

    const w = P.maxX - P.minX, d = P.maxZ - P.minZ;
    const cx = (P.minX + P.maxX) / 2, cz = (P.minZ + P.maxZ) / 2;
    for (const y of [0.45, 0.85]) {
      g.add(box(w, 0.1, 0.08, C.fence, cx, y, P.minZ, false));
      g.add(box(w, 0.1, 0.08, C.fence, cx, y, P.maxZ, false));
      g.add(box(0.08, 0.1, d, C.fence, P.minX, y, cz, false));
      g.add(box(0.08, 0.1, d, C.fence, P.maxX, y, cz, false));
    }
    this.root.add(g);
  }

  _building(x, z, w, h, d, wallColor, roofColor) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(box(w, h, d, wallColor, 0, h / 2, 0));
    // Telhado em duas águas (prisma triangular)
    const roofH = Math.min(w, d) * 0.35;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 - 0.3, 0); shape.lineTo(w / 2 + 0.3, 0); shape.lineTo(0, roofH); shape.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: d + 0.6, bevelEnabled: false });
    roofGeo.translate(0, h, -(d + 0.6) / 2);
    const roof = new THREE.Mesh(roofGeo, mat(roofColor));
    roof.castShadow = true; roof.receiveShadow = true;
    g.add(roof);
    this.root.add(g);
    this.colliders.addBox(x, z, w / 2, d / 2);
    return g;
  }

  _buildings() {
    const C = CONFIG.colors;
    // Galpão da serraria (placeholder: a máquina entra na próxima etapa)
    const shed = this._building(8, -8, 8, 3.6, 5.5, C.wood, C.roof);
    shed.add(box(2.4, 2.6, 0.12, C.woodDark, 0, 1.3, 2.8, false)); // porta
    shed.add(box(2.7, 0.18, 0.16, 0xf2e6cf, 0, 2.7, 2.82, false));  // moldura da porta
    for (const x of [-2.7, 2.7]) {                                     // janelas (acendem à noite)
      shed.add(box(1.1, 0.8, 0.1, 0x9fd3e6, x, 2.2, 2.79, false));
      shed.add(box(1.3, 0.12, 0.14, 0xf2e6cf, x, 1.75, 2.81, false));
    }
    // ripas verticais (madeira aparente)
    for (let i = -3.6; i <= 3.6; i += 0.6) if (Math.abs(i) > 1.4 && Math.abs(Math.abs(i) - 2.7) > 0.7) shed.add(box(0.05, 3.4, 0.04, C.woodDark, i, 1.7, 2.77, false));
  }

  // Mata decorativa fora da cerca. A floresta produtiva fica em sim/Forest + world/ForestView.
  _trees() {
    const C = CONFIG.colors, P = CONFIG.plot;
    const rand = rng(7);
    const spots = [];
    let tries = 0;
    while (spots.length < 200 && tries < 3000) {
      tries++;
      const x = (rand() - 0.5) * 150, z = (rand() - 0.5) * 150;
      const margin = 2.5;
      if (x > P.minX - margin && x < P.maxX + margin && z > P.minZ - margin && z < P.maxZ + margin) continue;
      if (Math.abs(z - CONFIG.dock.roadZ) < 3.5) continue; // estrada dos caminhões
      // lotes à venda ficam limpos
      if (CONFIG.lands.some((L) => x > L.rect.minX - margin && x < L.rect.maxX + margin && z > L.rect.minZ - margin && z < L.rect.maxZ + margin)) continue;
      spots.push({ x, z, s: 0.9 + rand() * 0.6 });
    }

    const A = getTreeAssets(this.timeUniform);
    const n = spots.length;
    const trunks = new THREE.InstancedMesh(A.trunkGeo, A.trunkMat, n);
    const crowns = new THREE.InstancedMesh(A.crownGeo, A.crownMat, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const tint = new THREE.Color(), base = new THREE.Color(C.pine), light = new THREE.Color(C.pineLight);
    spots.forEach((t, i) => {
      q.setFromAxisAngle(up, rand() * Math.PI * 2);
      sc.setScalar(t.s);
      p.set(t.x, 0, t.z);
      m4.compose(p, q, sc); trunks.setMatrixAt(i, m4);
      p.y = A.crownOffset * t.s;
      m4.compose(p, q, sc); crowns.setMatrixAt(i, m4);
      crowns.setColorAt(i, tint.copy(base).lerp(light, rand()));
    });
    trunks.castShadow = true; crowns.castShadow = true;
    trunks.receiveShadow = true; crowns.receiveShadow = true;
    this.root.add(trunks, crowns);
  }

  // Tufinhos de grama e flores espalhados (2 malhas instanciadas: quase não pesa)
  _grass() {
    const rand = rng(31);
    const avoid = [
      [6, -5, 16.5, 12.5], [0, CONFIG.dock.roadZ, 400, 5.5], [-3, 4.5, 4, 15],   // pátio, estrada, caminho
      [57, -7, 20, 26], [6, 10.5, 16, 7],                                         // pedreira, fila de máquinas
    ];
    const ok = (x, z) => !avoid.some(([cx, cz, w, d]) => Math.abs(x - cx) < w / 2 && Math.abs(z - cz) < d / 2);
    const blade = new THREE.ConeGeometry(0.05, 0.32, 3);
    const parts = [];
    for (let i = 0; i < 3; i++) { const b = blade.clone(); b.rotateZ((i - 1) * 0.35); b.translate((i - 1) * 0.06, 0.15, (i % 2) * 0.04); parts.push(b); }
    const tuftGeo = mergeGeometries(parts);
    const N = 2200;
    const tufts = new THREE.InstancedMesh(tuftGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: false }), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const shades = [0x5fa847, 0x77bd52, 0x8fcf5e, 0x6db34c].map((c) => new THREE.Color(c));
    let n = 0;
    for (let tries = 0; n < N && tries < N * 4; tries++) {
      const x = -75 + rand() * 155, z = -62 + rand() * 120;
      if (!ok(x, z)) continue;
      q.setFromAxisAngle(up, rand() * 6.28); sc.setScalar(0.7 + rand() * 0.8); p.set(x, 0, z);
      tufts.setMatrixAt(n, m4.compose(p, q, sc));
      tufts.setColorAt(n, shades[Math.floor(rand() * shades.length)]);
      n++;
    }
    tufts.count = n; tufts.receiveShadow = true;
    this.root.add(tufts);

    const petal = new THREE.IcosahedronGeometry(0.07, 1); petal.translate(0, 0.22, 0);
    const stem = new THREE.CylinderGeometry(0.012, 0.012, 0.22, 3); stem.translate(0, 0.11, 0);
    const flowerGeo = mergeGeometries([petal.toNonIndexed(), stem.toNonIndexed()]);
    const F = 500;
    const flowers = new THREE.InstancedMesh(flowerGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: false }), F);
    const fc = [0xff6b6b, 0xffd93d, 0xffffff, 0xc77dff, 0xff9ecd, 0x6bc5ff].map((c) => new THREE.Color(c));
    let f = 0;
    for (let tries = 0; f < F && tries < F * 6; tries++) {
      // flores em grupinhos
      const cx = -75 + rand() * 155, cz = -62 + rand() * 120;
      const col = fc[Math.floor(rand() * fc.length)];
      for (let k = 0; k < 5 && f < F; k++) {
        const x = cx + (rand() - 0.5) * 1.4, z = cz + (rand() - 0.5) * 1.4;
        if (!ok(x, z)) continue;
        q.setFromAxisAngle(up, rand() * 6.28); sc.setScalar(0.8 + rand() * 0.6); p.set(x, 0, z);
        flowers.setMatrixAt(f, m4.compose(p, q, sc));
        flowers.setColorAt(f, col);
        f++;
      }
    }
    flowers.count = f;
    this.root.add(flowers);
  }

  _rocks() {
    const C = CONFIG.colors;
    const geo = new THREE.DodecahedronGeometry(0.7, 1);
    const list = [[-4, -12, 1.0], [15, 12, 1.3], [14, 3, 0.8], [-15, 14, 1.1], [-2.5, 16.5, 0.9]];
    const rocks = new THREE.InstancedMesh(geo, mat(C.rock), list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    list.forEach(([x, z, s], i) => {
      e.set(0.3 * i, i * 1.3, 0.2); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, 0.35 * s, z), q, new THREE.Vector3(s * 1.3, s * 0.8, s));
      rocks.setMatrixAt(i, m4);
      this.colliders.addCircle(x, z, 0.8 * s);
    });
    rocks.castShadow = true; rocks.receiveShadow = true;
    this.root.add(rocks);
  }

  update(dt, time) {
    this.timeUniform.value = time;
  }
}
