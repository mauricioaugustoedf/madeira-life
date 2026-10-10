import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Engine: renderer, cena, câmera, luzes e o loop principal.
export class Engine {
  constructor(canvas) {
    const R = CONFIG.render;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.maxDpr = Math.min(window.devicePixelRatio || 1, R.maxPixelRatio);
    this.dpr = this.maxDpr;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.colors.sky);
    this.scene.fog = new THREE.Fog(CONFIG.colors.sky, R.fogNear, R.fogFar);

    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.5, 200);

    // Iluminação simples: céu/chão + um sol com sombra limitada perto do jogador
    const hemi = new THREE.HemisphereLight(0xeaf6ff, 0x5d7a3a, 1.7);
    this.hemi = hemi;
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(R.shadowMapSize, R.shadowMapSize);
    const s = this.sun.shadow.camera;
    s.left = -R.shadowRadius; s.right = R.shadowRadius;
    s.top = R.shadowRadius; s.bottom = -R.shadowRadius;
    s.near = 1; s.far = 70;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    this.updaters = [];
    this.clock = new THREE.Clock();
    this.time = 0;
    this.running = false;
    this.fps = 60;
    this._fpsFrames = 0; this._fpsTime = 0; this._lowSamples = 0;

    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', this._resize);
    this._resize();

    // Pausa quando o app vai para segundo plano (economiza bateria)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop(); else this.start();
    });
  }

  onUpdate(fn) { this.updaters.push(fn); }

  // Gráficos leves: sem sombras e resolução menor (para economizar bateria / aparelhos mais fracos)
  setLowQuality(on) {
    this.low = on;
    this.renderer.shadowMap.enabled = !on;
    this.sun.castShadow = !on;
    this.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
    this.maxDpr = on ? Math.min(window.devicePixelRatio || 1, 1.25) : Math.min(window.devicePixelRatio || 1, CONFIG.render.maxPixelRatio);
    this.dpr = this.maxDpr;
    this.renderer.setPixelRatio(this.dpr);
    this._resize();
  }

  // Ajusta névoa, sombra e alcance da câmera conforme a distância do zoom
  setViewDistance(dist) {
    const R = CONFIG.render;
    this.scene.fog.near = R.fogNear + Math.max(0, dist - 19);
    this.scene.fog.far = R.fogFar + Math.max(0, dist - 19) * 1.6;
    const r = R.shadowRadius * Math.max(1, dist / 22);
    const s = this.sun.shadow.camera;
    if (Math.abs(s.right - r) > 0.5) {
      s.left = -r; s.right = r; s.top = r; s.bottom = -r;
      s.updateProjectionMatrix();
    }
    this.camera.far = dist + 140;
    this.camera.updateProjectionMatrix();
  }

  focusShadow(p) {
    this.sun.position.set(p.x + 12, 22, p.z + 9);
    this.sun.target.position.set(p.x, 0, p.z);
    this.sun.target.updateMatrixWorld();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    for (const fn of this.updaters) fn(dt, this.time);
    this.renderer.render(this.scene, this.camera);
    this._measure(dt);
  }

  // Mede FPS e reduz resolução automaticamente se o aparelho estiver sofrendo
  _measure(dt) {
    this._fpsFrames++; this._fpsTime += dt;
    if (this._fpsTime < 0.5) return;
    this.fps = this._fpsFrames / this._fpsTime;
    this._fpsFrames = 0; this._fpsTime = 0;
    if (this.fps < 45) this._lowSamples++; else this._lowSamples = 0;
    if (this._lowSamples >= 4 && this.dpr > CONFIG.render.minPixelRatio) {
      this.dpr = Math.max(CONFIG.render.minPixelRatio, this.dpr - 0.25);
      this.renderer.setPixelRatio(this.dpr);
      this._resize();
      this._lowSamples = 0;
    }
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Em retrato a tela é estreita: abre um pouco o campo de visão
    this.camera.fov = w < h ? CONFIG.camera.fov + 8 : CONFIG.camera.fov;
    this.camera.updateProjectionMatrix();
  }
}
