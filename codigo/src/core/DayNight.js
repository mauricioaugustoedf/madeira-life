import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { mat } from '../world/World.js';

// Céu em degradê (cúpula), nuvens e ciclo de dia e noite.
// Muda a luz do sol e do céu, a cor da névoa e acende janelas e postes à noite.
const KEYS = [
  // t (0..1 do dia), topo do céu, horizonte, luz do sol (cor, força), céu/chão do hemisfério, força do hemisfério, noite (0..1)
  { t: 0.00, top: 0x1b2a4a, hor: 0x3c4d72, sun: 0x8fa8ff, si: 0.45, hs: 0x6a7fb0, hg: 0x34404c, hi: 1.15, night: 1 },
  { t: 0.20, top: 0x1b2a4a, hor: 0x3c4d72, sun: 0x8fa8ff, si: 0.45, hs: 0x6a7fb0, hg: 0x34404c, hi: 1.15, night: 1 },
  { t: 0.27, top: 0x6f8fc9, hor: 0xffb48a, sun: 0xffb27a, si: 1.4, hs: 0xe6d3e6, hg: 0x8a7a5a, hi: 1.6, night: 0.3 },
  { t: 0.34, top: 0x7cc6ef, hor: 0xfff0d2, sun: 0xfff1d6, si: 2.1, hs: 0xf3f8ff, hg: 0x8c9c6c, hi: 2.15, night: 0 },
  { t: 0.68, top: 0x7cc6ef, hor: 0xfff0d2, sun: 0xfff1d6, si: 2.1, hs: 0xf3f8ff, hg: 0x8c9c6c, hi: 2.15, night: 0 },
  { t: 0.76, top: 0x5f78b8, hor: 0xff9a6a, sun: 0xff9a5c, si: 1.3, hs: 0xead0d8, hg: 0x8a6a52, hi: 1.55, night: 0.35 },
  { t: 0.83, top: 0x1b2a4a, hor: 0x3c4d72, sun: 0x8fa8ff, si: 0.45, hs: 0x6a7fb0, hg: 0x34404c, hi: 1.15, night: 1 },
  { t: 1.00, top: 0x1b2a4a, hor: 0x3c4d72, sun: 0x8fa8ff, si: 0.45, hs: 0x6a7fb0, hg: 0x34404c, hi: 1.15, night: 1 },
];
// Brilho dos postes à noite (material compartilhado; a decoração usa)
export const GLOW_MAT = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
export const POOL_MAT = new THREE.MeshBasicMaterial({ color: 0xffc35a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
const _a = new THREE.Color(), _b = new THREE.Color();
const lerpHex = (h1, h2, k, out) => out.set(h1).lerp(_b.set(h2), k);

export class DayNight {
  constructor(engine) {
    this.engine = engine;
    this.len = CONFIG.dayNight.dayLength;
    // Cúpula do céu (não recebe névoa, desenhada atrás de tudo)
    this.uTop = { value: new THREE.Color(0x7cc6ef) };
    this.uHor = { value: new THREE.Color(0xfff0d2) };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: { top: this.uTop, hor: this.uHor },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y * 1.6, 0.0, 1.0); gl_FragColor = vec4(mix(hor, top, pow(h, 0.7)), 1.0); }',
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 12), skyMat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    engine.scene.add(this.sky);
    engine.scene.background = null;

    // Nuvens fofinhas (uma malha instanciada)
    const cg = new THREE.IcosahedronGeometry(1, 1);
    this.cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: false, emissive: 0x666666, fog: false });
    const n = 14;
    this.clouds = new THREE.InstancedMesh(cg, this.cloudMat, n * 3);
    this.clouds.frustumCulled = false;
    this.cloudData = [];
    const rand = (a, b) => a + Math.random() * (b - a);
    for (let i = 0; i < n; i++) this.cloudData.push({ x: rand(-120, 120), z: rand(-120, 60), y: rand(32, 44), s: rand(3, 6), v: rand(0.6, 1.4) });
    engine.scene.add(this.clouds);
    this._m = new THREE.Matrix4(); this._p = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3();

    // Brilho dos postes e janelas à noite
    this.glowMat = GLOW_MAT;
    this.windowMat = mat(0x9fd3e6);           // janelas das casas (material compartilhado)
    this.night = 0;
    this.t = 0.4;
    this.offset = 0;
    this.alwaysDay = true;
  }

  // Hora do dia em texto (para o HUD)
  get clock() {
    const mins = Math.floor(this.t * 24 * 60);
    return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  }

  update(dt, focus) {
    // o dia anda junto com o relógio de verdade (mesma hora para todo mundo que abrir o jogo)
    // Sempre de dia (pedido do jogador): hora fixa no fim da manhã, com sol bonito
    this.t = this.alwaysDay ? 0.46 : ((Date.now() / 1000 / this.len) + this.offset) % 1;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t <= this.t) i++;
    const A = KEYS[i], B = KEYS[i + 1];
    const k = (this.t - A.t) / Math.max(1e-6, B.t - A.t);
    const E = this.engine;
    lerpHex(A.top, B.top, k, this.uTop.value);
    lerpHex(A.hor, B.hor, k, this.uHor.value);
    lerpHex(A.sun, B.sun, k, E.sun.color);
    E.sun.intensity = A.si + (B.si - A.si) * k;
    lerpHex(A.hs, B.hs, k, E.hemi.color);
    lerpHex(A.hg, B.hg, k, E.hemi.groundColor);
    E.hemi.intensity = A.hi + (B.hi - A.hi) * k;
    E.scene.fog.color.copy(this.uHor.value);
    this.night = A.night + (B.night - A.night) * k;
    // janelas acesas e postes brilhando quando escurece
    this.windowMat.color.copy(_a.set(0x9fd3e6).lerp(_b.set(0xffc95e), this.night));
    this.glowMat.opacity = this.night * 0.32;
    POOL_MAT.opacity = this.night * 0.18;
    this.cloudMat.emissive.copy(_a.set(0x666666).multiplyScalar(1 - this.night * 0.8));
    if (focus) this.sky.position.set(focus.x, 0, focus.z);
    // nuvens andando devagar
    let j = 0;
    for (const c of this.cloudData) {
      c.x += c.v * dt; if (c.x > 140) c.x = -140;
      for (let b = 0; b < 3; b++) {
        this._p.set(c.x + (b - 1) * c.s * 0.9 + (focus ? focus.x * 0.5 : 0), c.y + (b === 1 ? c.s * 0.25 : 0), c.z + (focus ? focus.z * 0.5 : 0));
        const sc = c.s * (b === 1 ? 1.2 : 0.85);
        this._s.set(sc, sc * 0.55, sc * 0.8);
        this.clouds.setMatrixAt(j++, this._m.compose(this._p, this._q, this._s));
      }
    }
    this.clouds.instanceMatrix.needsUpdate = true;
  }
}
