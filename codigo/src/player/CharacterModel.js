import * as THREE from 'three';
import { softBox } from '../core/Clay.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Personagem estilo "boneco de massinha": formas lisas e arredondadas, sem rosto.
// Para ficar leve com muitos funcionários na tela, cada parte que se mexe (tronco, pernas,
// braços, cabeça) vira UMA malha só, com as cores pintadas nos vértices, e todos usam o MESMO material.
// Cabelo / chapéu / acessório podem ser trocados (menu de personalização).
const _geo = new Map();
function cached(key, make) { if (!_geo.has(key)) _geo.set(key, make()); return _geo.get(key); }
function boxGeo(w, h, d) { return cached(`b${w}|${h}|${d}`, () => softBox(w, h, d)); }
const sph = (r, ws = 18, hs = 12, ps = 0, pl = Math.PI * 2, ts = 0, tl = Math.PI) => cached(`s${r}|${ws}|${hs}|${ps}|${pl}|${ts}|${tl}`, () => new THREE.SphereGeometry(r, ws, hs, ps, pl, ts, tl));
const cap = (r, len) => cached(`c${r}|${len}`, () => new THREE.CapsuleGeometry(r, len, 5, 14));
const cyl = (rt, rb, h, seg = 18) => cached(`y${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const tor = (r, t, arc = Math.PI * 2) => cached(`t${r}|${t}|${arc}`, () => new THREE.TorusGeometry(r, t, 8, arc < 6 ? 14 : 22, arc));
let _sharedMat = null;
function charMat() {
  if (!_sharedMat) _sharedMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  return _sharedMat;
}
const FIXED = { eye: 0x1d1a17, lens: 0x26221f, lensClear: 0xbfe6f5, blush: 0xf09a8a, band: 0x6b4a2e, white: 0xf4f1ea, fleece: 0xf1e4cc, gold: 0xe8b84a, sole: 0xf2efe8 };
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const HEAD_R = 0.31, HEAD_Y = 0.13, HEAD_S = [1, 1.06, 0.97];

export class CharacterModel {
  // options: { headwear: 'none'|'cap'|'helmet'|'hat'|'beanie', hairStyle, accessory, tool: null|'axe' }
  constructor(appearance, options = {}) {
    const opt = { headwear: 'cap', hairStyle: 'curto', accessory: 'none', top: 'manga', legwear: 'calca', footwear: 'sapato', tool: null, ...options };
    this.group = new THREE.Group();
    this.colors = {};
    for (const [k, v] of Object.entries({ hair: 0x3a2618, cap: 0xf2b134, ...appearance, ...FIXED })) this.colors[k] = new THREE.Color(v);
    this._parts = new Map();   // grupo → [{ geo, slot, x, y, z, rx, tag }]
    this._meshes = new Map();  // grupo → malha juntada

    // Corpo (tudo que balança junto ao caminhar)
    this.body = new THREE.Group();
    this.group.add(this.body);
    const A = (g, geo, slot, x, y, z, o = {}) => this._add(g, geo, slot, x, y, z, o.rx || 0, o.tag || '', o.s, o.ry || 0, o.rz || 0);

    // Pernas (pivô no quadril) e braços (pivô no ombro): o formato depende da roupa
    this.legL = new THREE.Group(); this.legL.position.set(-0.15, 0.78, 0);
    this.legR = new THREE.Group(); this.legR.position.set(0.15, 0.78, 0);
    this.armL = new THREE.Group(); this.armL.position.set(-0.35, 1.34, 0);
    this.armR = new THREE.Group(); this.armR.position.set(0.35, 1.34, 0);
    this.body.add(this.legL, this.legR, this.armL, this.armR);
    // Tronco: um "feijão" macio, com quadril na cor da calça e pescoço
    A(this.body, cap(0.29, 0.2), 'shirt', 0, 1.12, 0, { s: [1, 0.84, 0.7] });
    A(this.body, sph(0.27, 18, 10), 'pants', 0, 0.84, 0, { s: [1.02, 0.55, 0.72] });
    A(this.body, cyl(0.1, 0.11, 0.16, 14), 'skin', 0, 1.47, 0);
    // Cabeça lisa, sem rosto, com orelhinhas
    this.head = new THREE.Group(); this.head.position.set(0, 1.62, 0);
    this.body.add(this.head);
    A(this.head, sph(HEAD_R, 22, 16), 'skin', 0, HEAD_Y, 0, { s: HEAD_S });
    A(this.head, sph(0.075, 12, 10), 'skin', -0.285, 0.1, 0, { s: [0.55, 1, 0.9] });
    A(this.head, sph(0.075, 12, 10), 'skin', 0.285, 0.1, 0, { s: [0.55, 1, 0.9] });

    this._building = true;
    this.setTop(opt.top);
    this.setLegwear(opt.legwear);
    this.setFootwear(opt.footwear);
    this.setHair(opt.hairStyle);
    this.setHeadwear(opt.headwear);
    this.setAccessory(opt.accessory);
    this._building = false;
    for (const g of [this.body, this.legL, this.legR, this.armL, this.armR, this.head]) this._rebuild(g);

    if (opt.tool === 'axe') {
      // Machado/picareta presos à mão direita (malhas separadas: aparecem só no trabalho)
      this.tool = new THREE.Group();
      this.tool.position.set(0, -0.52, 0.05);
      this.tool.rotation.x = Math.PI / 2;
      const handleMat = new THREE.MeshLambertMaterial({ color: 0xa0693a });
      const headMat = new THREE.MeshLambertMaterial({ color: 0xc3ccd4 });
      const mk = (w, h, d, m, x, y, z) => { const mesh = new THREE.Mesh(boxGeo(w, h, d), m); mesh.position.set(x, y, z); mesh.castShadow = true; this.tool.add(mesh); return mesh; };
      mk(0.06, 0.8, 0.06, handleMat, 0, 0.3, 0);
      this.axeHead = mk(0.05, 0.16, 0.26, headMat, 0, 0.62, 0.1);
      this.pickHead = mk(0.06, 0.08, 0.62, headMat, 0, 0.66, 0);
      this.pickHead.visible = false;
      this.armR.add(this.tool);
    }

    this.phase = 0;
    this.planting = -1; // 0..1 enquanto planta uma muda (ajoelha e enterra)
  }

  _add(group, geo, slot, x, y, z, rx = 0, tag = '', sc = null, ry = 0, rz = 0) {
    if (!this._parts.has(group)) this._parts.set(group, []);
    this._parts.get(group).push({ geo, slot, x, y, z, rx, ry, rz, tag, sc });
  }

  _drop(group, tag) {
    const list = this._parts.get(group);
    if (list) this._parts.set(group, list.filter((p) => p.tag !== tag));
  }

  // Junta as peças de um grupo numa malha só, com a cor de cada peça nos vértices
  _rebuild(group) {
    if (this._building) return;
    const list = this._parts.get(group) || [];
    const old = this._meshes.get(group);
    if (old) { group.remove(old); old.geometry.dispose(); this._meshes.delete(group); }
    if (!list.length) return;
    const geos = [];
    for (const p of list) {
      let g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
      if (g.attributes.uv) g.deleteAttribute('uv');
      if (g.attributes.uv1) g.deleteAttribute('uv1');
      _e.set(p.rx, p.ry || 0, p.rz || 0); _q.setFromEuler(_e); _p.set(p.x, p.y, p.z);
      if (p.sc) _s.set(p.sc[0], p.sc[1], p.sc[2]); else _s.set(1, 1, 1);
      g.applyMatrix4(_m4.compose(_p, _q, _s));
      const c = this.colors[p.slot] || this.colors.skin;
      const n = g.attributes.position.count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      geos.push(g);
    }
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    const mesh = new THREE.Mesh(merged, charMat());
    mesh.castShadow = true;
    group.add(mesh);
    this._meshes.set(group, mesh);
  }

  // Roupa de cima: manga longa, camiseta, regata, moletom, jaqueta
  setTop(type) {
    this.top = type;
    for (const g of [this.body, this.armL, this.armR]) this._drop(g, 'top');
    const T = (g, geo, slot, x, y, z, sc, rx = 0, rz = 0) => this._add(g, geo, slot, x, y, z, rx, 'top', sc, 0, rz);
    for (const arm of [this.armL, this.armR]) {
      if (type === 'camiseta') {
        T(arm, cap(0.108, 0.07), 'shirt', 0, -0.08, 0);
        T(arm, cap(0.085, 0.18), 'skin', 0, -0.26, 0);
      } else if (type === 'regata') {
        T(arm, cap(0.088, 0.26), 'skin', 0, -0.18, 0);
      } else {
        T(arm, cap(0.1, 0.24), 'shirt', 0, -0.17, 0);
      }
      T(arm, sph(0.09, 12, 10), 'skin', 0, -0.43, 0);
    }
    const b = this.body;
    if (type === 'moletom') {
      T(b, sph(0.2, 16, 10), 'shirt', 0, 1.45, -0.12, [1.25, 0.75, 0.8]);          // capuz caído nas costas
      T(b, tor(0.13, 0.05), 'shirt', 0, 1.44, 0.01, [1, 1, 0.85], Math.PI / 2);     // gola
      for (const x of [-0.06, 0.06]) {
        T(b, cap(0.012, 0.13), 'white', x, 1.31, 0.2);
        T(b, sph(0.024, 8, 6), 'white', x, 1.22, 0.205);
      }
      T(b, sph(0.16, 14, 8), 'shirt', 0, 0.98, 0.15, [1.2, 0.5, 0.35]);            // bolso canguru
    } else if (type === 'jaqueta') {
      T(b, tor(0.14, 0.065), 'fleece', 0, 1.43, 0.0, [1.05, 1, 0.9], Math.PI / 2 + 0.15);  // gola de pelinho
      T(b, cap(0.009, 0.42), 'gold', 0, 1.1, 0.205);                                 // zíper
      for (const x of [-0.13, 0.13]) T(b, softBox(0.12, 0.09, 0.04), 'shirt', x, 1.2, 0.19);  // bolsos
    } else if (type === 'regata') {
      T(b, tor(0.12, 0.02), 'shirt', 0, 1.42, 0.0, [1, 1, 0.85], Math.PI / 2);
    }
    for (const g of [this.body, this.armL, this.armR]) this._rebuild(g);
  }

  // Pernas: calça, bermuda ou short
  setLegwear(type) {
    this.legwear = type;
    for (const leg of [this.legL, this.legR]) {
      this._drop(leg, 'legs');
      const L = (geo, slot, y, sc) => this._add(leg, geo, slot, 0, y, 0, 0, 'legs', sc);
      if (type === 'bermuda') {
        L(cap(0.135, 0.14), 'pants', -0.13);
        L(cap(0.095, 0.24), 'skin', -0.42);
      } else if (type === 'short') {
        L(cap(0.135, 0.04), 'pants', -0.07);
        L(cap(0.1, 0.32), 'skin', -0.36);
      } else {
        L(cap(0.125, 0.38), 'pants', -0.3);
      }
      this._rebuild(leg);
    }
  }

  // Calçado: sapato, tênis, bota, chinelo
  setFootwear(type) {
    this.footwear = type;
    for (const leg of [this.legL, this.legR]) {
      this._drop(leg, 'feet');
      const F = (geo, slot, y, z, sc) => this._add(leg, geo, slot, 0, y, z, 0, 'feet', sc);
      if (type === 'tenis') {
        F(sph(0.13, 14, 10), 'shoes', -0.65, 0.06, [1, 0.66, 1.45]);
        F(sph(0.135, 14, 8), 'sole', -0.7, 0.065, [1.03, 0.28, 1.5]);
      } else if (type === 'bota') {
        F(cyl(0.135, 0.14, 0.24, 16), 'shoes', -0.55, 0);
        F(sph(0.14, 14, 10), 'shoes', -0.66, 0.06, [1, 0.62, 1.45]);
      } else if (type === 'chinelo') {
        F(sph(0.11, 12, 8), 'skin', -0.67, 0.06, [0.9, 0.5, 1.4]);
        F(cyl(0.12, 0.12, 0.035, 16), 'shoes', -0.72, 0.07, [1, 1, 1.6]);
      } else {
        F(sph(0.13, 14, 10), 'shoes', -0.66, 0.06, [1, 0.62, 1.45]);
      }
      this._rebuild(leg);
    }
  }

  setHair(style) {
    const g = this.head;
    this._drop(g, 'hair');
    this.hairStyle = style;
    const A = (geo, x, y, z, sc, rx = 0, rz = 0) => this._add(g, geo, 'hair', x, y, z, rx, 'hair', sc, 0, rz);
    const R = HEAD_R + 0.018;
    if (style === 'moicano') {
      A(cap(0.075, 0.34), 0, 0.42, -0.02, [1, 1, 1.25], Math.PI / 2);
    } else if (style === 'blackpower') {
      A(sph(0.4, 20, 14), 0, HEAD_Y + 0.17, -0.09, [1.08, 0.86, 0.92]);
    } else if (style === 'cacheado') {
      A(sph(R, 22, 12, 0, Math.PI * 2, 0, 1.25), 0, HEAD_Y, 0, HEAD_S);
      A(sph(R - 0.004, 22, 12, Math.PI, Math.PI, 0, 2.0), 0, HEAD_Y, 0, HEAD_S);
      // cachinhos espalhados pela cabeça
      for (let i = 0; i < 22; i++) {
        const th = 0.15 + (i % 11) / 11 * (i < 11 ? 1.15 : 1.0) + (i < 11 ? 0 : 0.35);
        const ph = i * 2.39996;
        if (Math.sin(ph) > 0.35 && th > 0.95) continue;          // deixa o rosto livre
        const r = R + 0.01;
        A(sph(0.075, 8, 6), -Math.cos(ph) * Math.sin(th) * r, HEAD_Y + Math.cos(th) * r * HEAD_S[1], Math.sin(ph) * Math.sin(th) * r * HEAD_S[2]);
      }
    } else if (style !== 'careca') {
      // touca de cabelo cobrindo o alto da cabeça + nuca
      A(sph(R, 22, 12, 0, Math.PI * 2, 0, 1.2), 0, HEAD_Y, 0, HEAD_S);
      A(sph(R - 0.004, 22, 12, Math.PI, Math.PI, 0, 2.05), 0, HEAD_Y, 0, HEAD_S);
      // topete macio jogado para o lado
      A(sph(0.15, 16, 10), 0.05, HEAD_Y + 0.27, 0.06, [1.5, 0.5, 1.3], 0, -0.22);
      if (style === 'longo') {
        A(cap(0.27, 0.22), 0, -0.04, -0.12, [1.05, 1, 0.55]);
      } else if (style === 'rabo') {
        A(sph(0.1, 14, 10), 0, 0.2, -0.33);
        A(cap(0.085, 0.24), 0, -0.02, -0.36, [1, 1, 1], -0.25);
      } else if (style === 'coque') {
        A(sph(0.13, 14, 10), 0, HEAD_Y + 0.33, -0.1);
      } else if (style === 'topete') {
        A(sph(0.16, 14, 10), 0, HEAD_Y + 0.29, 0.12, [1.15, 0.8, 1.3], -0.4);
      } else if (style === 'chanel') {
        A(sph(R + 0.03, 22, 12, Math.PI - 0.4, Math.PI + 0.8, 0, 1.68), 0, HEAD_Y, 0, HEAD_S);
      } else if (style === 'marias') {
        for (const x of [-1, 1]) {
          A(sph(0.09, 12, 8), x * 0.3, HEAD_Y + 0.12, -0.1);
          A(cap(0.075, 0.2), x * 0.34, HEAD_Y - 0.08, -0.12, null, 0, x * 0.25);
        }
      } else if (style === 'franja') {
        A(sph(0.15, 16, 10), -0.07, HEAD_Y + 0.2, 0.2, [1.4, 0.55, 0.75], 0.5, 0.25);
      }
    }
    this._rebuild(g);
  }

  setHeadwear(type) {
    const g = this.head;
    this._drop(g, 'hat');
    this.headwear = type;
    const A = (geo, slot, x, y, z, sc, rx = 0) => this._add(g, geo, slot, x, y, z, rx, 'hat', sc);
    const R = HEAD_R + 0.035;
    if (type === 'helmet') {
      A(sph(R + 0.01, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), 'cap', 0, HEAD_Y + 0.06, 0, [1, 1.05, 1]);
      A(tor(R + 0.03, 0.035), 'cap', 0, HEAD_Y + 0.06, 0, null, Math.PI / 2);
      A(cap(0.03, 0.26), 'cap', 0, HEAD_Y + 0.25, 0, [1, 1, 1.4], Math.PI / 2);
    } else if (type === 'cap') {
      A(sph(R, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), 'cap', 0, HEAD_Y + 0.08, 0, [1, 0.95, 1]);
      A(cyl(0.2, 0.2, 0.035, 22), 'cap', 0, HEAD_Y + 0.1, 0.27, [1.05, 1, 0.95]);
      A(sph(0.035, 8, 6), 'cap', 0, HEAD_Y + 0.4, 0);
    } else if (type === 'hat') {
      // chapéu de aba larga com faixa (como o de vaqueiro da referência)
      const hy = HEAD_Y + 0.22;
      A(cyl(0.52, 0.52, 0.035, 28), 'cap', 0, hy, 0, [1, 1, 0.92]);
      A(tor(0.52, 0.03), 'cap', 0, hy + 0.012, 0, [1, 0.92, 1], Math.PI / 2);
      A(cap(0.26, 0.06), 'cap', 0, hy + 0.12, 0, [1.05, 0.62, 0.95]);
      A(cyl(0.272, 0.28, 0.06, 24), 'band', 0, hy + 0.06, 0);
    } else if (type === 'palha') {
      const hy = HEAD_Y + 0.2;
      A(cyl(0.6, 0.6, 0.03, 30), 'cap', 0, hy, 0);
      A(cyl(0.27, 0.3, 0.2, 24), 'cap', 0, hy + 0.11, 0);
      A(cyl(0.305, 0.305, 0.06, 24), 'band', 0, hy + 0.05, 0);
    } else if (type === 'pescador') {
      A(cyl(0.29, 0.31, 0.2, 24), 'cap', 0, HEAD_Y + 0.3, 0);
      A(sph(0.29, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2), 'cap', 0, HEAD_Y + 0.39, 0, [1, 0.3, 1]);
      A(cyl(0.33, 0.47, 0.1, 26), 'cap', 0, HEAD_Y + 0.17, 0);
    } else if (type === 'boina') {
      A(sph(0.34, 20, 10), 'cap', 0.03, HEAD_Y + 0.25, -0.02, [1.08, 0.36, 1.04], 0);
      A(sph(0.03, 8, 6), 'cap', 0.03, HEAD_Y + 0.38, -0.02);
    } else if (type === 'cartola') {
      A(cyl(0.44, 0.44, 0.03, 28), 'cap', 0, HEAD_Y + 0.22, 0);
      A(cyl(0.25, 0.25, 0.44, 24), 'cap', 0, HEAD_Y + 0.45, 0);
      A(cyl(0.255, 0.255, 0.08, 24), 'band', 0, HEAD_Y + 0.28, 0);
    } else if (type === 'beanie') {
      A(sph(R, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), 'cap', 0, HEAD_Y + 0.05, 0, [1, 1.12, 1]);
      A(tor(R - 0.01, 0.045), 'cap', 0, HEAD_Y + 0.07, 0, null, Math.PI / 2);
      A(sph(0.07, 12, 8), 'cap', 0, HEAD_Y + 0.4, 0);
    }
    this._rebuild(g);
  }

  setAccessory(type) {
    const g = this.head;
    this._drop(g, 'acc');
    this._drop(this.body, 'acc');
    this.accessory = type;
    const A = (geo, slot, x, y, z, sc, rx = 0, ry = 0, rz = 0) => this._add(g, geo, slot, x, y, z, rx, 'acc', sc, ry, rz);
    const fz = HEAD_R * HEAD_S[2];
    if (type === 'oculos' || type === 'escuros') {
      for (const x of [-0.105, 0.105]) {
        A(tor(0.078, 0.018), 'lens', x, HEAD_Y + 0.04, fz - 0.012, [1, 0.85, 1]);
        if (type === 'escuros') A(cyl(0.072, 0.072, 0.012, 18), 'lens', x, HEAD_Y + 0.04, fz - 0.018, [1, 1, 0.85], Math.PI / 2);
      }
      A(cap(0.012, 0.05), 'lens', 0, HEAD_Y + 0.05, fz - 0.005, null, 0, 0, Math.PI / 2);
      for (const x of [-1, 1]) A(cap(0.012, 0.22), 'lens', x * 0.29, HEAD_Y + 0.04, fz * 0.42, null, Math.PI / 2);
    } else if (type === 'fone') {
      A(tor(HEAD_R + 0.045, 0.028, Math.PI), 'lens', 0, HEAD_Y + 0.02, -0.02, [1, 1.05, 1]);
      for (const x of [-1, 1]) A(cyl(0.1, 0.1, 0.09, 18), 'lens', x * (HEAD_R + 0.035), HEAD_Y + 0.02, -0.01, null, 0, 0, Math.PI / 2);
    } else if (type === 'colar') {
      this._add(this.body, tor(0.13, 0.012), 'gold', 0, 1.43, 0.03, Math.PI / 2 + 0.45, 'acc');
      this._add(this.body, sph(0.035, 10, 8), 'gold', 0, 1.31, 0.2, 0, 'acc', [1, 1, 0.5]);
    } else if (type === 'brinco') {
      for (const x of [-1, 1]) A(sph(0.028, 8, 6), 'gold', x * 0.3, 0.0, 0.02);
    } else if (type === 'cavanhaque') {
      A(sph(0.075, 12, 8), 'hair', 0, HEAD_Y - 0.27, 0.2, [1, 1.1, 0.8]);
      A(cap(0.032, 0.11), 'hair', 0, HEAD_Y - 0.13, fz - 0.035, [1, 1, 0.8], 0, 0, Math.PI / 2);
    } else if (type === 'bigode') {
      A(cap(0.036, 0.12), 'hair', 0, HEAD_Y - 0.12, fz - 0.03, [1, 1, 0.8], 0, 0, Math.PI / 2);
    } else if (type === 'barba') {
      // barba macia contornando o queixo, com bigode (como na referência)
      A(sph(HEAD_R + 0.02, 22, 10, -0.15, Math.PI + 0.3, 2.0, 1.0), 'hair', 0, HEAD_Y, 0, HEAD_S);
      A(sph(0.1, 14, 10), 'hair', 0, HEAD_Y - 0.27, 0.17, [1.3, 0.8, 0.8]);
      A(cap(0.036, 0.13), 'hair', 0, HEAD_Y - 0.13, fz - 0.035, [1, 1, 0.8], 0, 0, Math.PI / 2);
    }
    this._rebuild(g);
    this._rebuild(this.body);
  }

  showTool(v, kind = 'axe') {
    if (!this.tool) return;
    this.tool.visible = v;
    if (v) { this.axeHead.visible = kind === 'axe'; this.pickHead.visible = kind === 'pick'; }
  }

  // Troca a cor de uma parte (pele, camisa...) e repinta as malhas que usam essa cor
  setColor(slot, color) {
    if (!this.colors[slot]) this.colors[slot] = new THREE.Color();
    const c = new THREE.Color(color);
    if (c.equals(this.colors[slot])) return;
    this.colors[slot].copy(c);
    for (const [g, list] of this._parts) if (list.some((p) => p.slot === slot)) this._rebuild(g);
  }

  // speed01: 0 parado, 1 velocidade máxima
  // chop: -1 = sem golpe; 0..1 = fase do golpe de machado (0 erguido, ~0.75 impacto)
  animate(dt, speed01, time, chop = -1) {
    if (speed01 > 0.05) this.phase += dt * (6 + 5 * speed01);
    const swing = Math.sin(this.phase) * 0.75 * speed01;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    if (chop >= 0) {
      // Ergue acima da cabeça e desce com força
      const up = -2.7, hit = -0.55;
      let a;
      if (chop < 0.55) a = up * (chop / 0.55) ** 0.6;
      else if (chop < 0.75) { const k = (chop - 0.55) / 0.2; a = up + (hit - up) * k * k; }
      else a = hit * (1 - (chop - 0.75) / 0.25);
      this.armR.rotation.x = a;
      this.armL.rotation.x = a * 0.9;
      this.body.rotation.x = chop > 0.55 && chop < 0.85 ? 0.18 : 0.02;
      this.body.position.y = 0;
      return;
    }
    if (this.planting >= 0) {
      // Inclina para a frente e os braços descem até o chão, cavando
      const dig = Math.sin(this.planting * Math.PI * 4) * 0.25;
      this.body.rotation.x = 0.4;
      this.body.position.y = -0.1;
      this.armL.rotation.x = -0.9 + dig;
      this.armR.rotation.x = -0.9 - dig;
      this.legL.rotation.x = -0.55; this.legR.rotation.x = -0.25;
      return;
    }
    this.armL.rotation.x = -swing * 0.8;
    this.armR.rotation.x = swing * 0.8;
    const walkBob = Math.abs(Math.sin(this.phase)) * 0.07 * speed01;
    const idle = Math.sin(time * 2.2) * 0.012 * (1 - speed01);
    this.body.position.y = walkBob + idle;
    this.body.rotation.x = 0.08 * speed01;
  }
}
