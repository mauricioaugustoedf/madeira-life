import * as THREE from 'three';
import { softBox } from '../core/Clay.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat } from './World.js';

// Placa de madeira com texto desenhado num canvas (título + preço).
// Fica virada para a câmera (que olha sempre na mesma direção).
export class Sign {
  constructor(scene, x, z, { height = 1.7, width = 2.4 } = {}) {
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);

    this.canvas = document.createElement('canvas');
    this.canvas.width = 384; this.canvas.height = 192;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 2;
    // poste + tábua da placa numa malha só; a face com o texto é um plano por cima
    const by = height + width / 4 - 0.1, tilt = -0.35;   // inclina para a câmera de cima
    const postG = new THREE.CylinderGeometry(0.07, 0.08, height, 12); postG.translate(0, height / 2, 0);
    const boardG = softBox(width, width / 2, 0.14); boardG.rotateX(tilt); boardG.translate(0, by, 0);
    const wood = new THREE.Mesh(mergeGeometries([postG.toNonIndexed(), boardG.toNonIndexed()], false), mat(0xfff1df));
    wood.castShadow = true;
    postG.dispose(); boardG.dispose();
    this.group.add(wood);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.97, width / 2 * 0.95), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true }));
    face.position.set(0, by, 0); face.rotation.x = tilt; face.translateZ(0.075);
    this.group.add(face);
    scene.add(this.group);
    this._key = '';
  }

  set(title, line2, highlight = false) {
    const key = title + '|' + line2 + '|' + highlight;
    if (key === this._key) return;
    this._key = key;
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height;
    c.clearRect(0, 0, W, H);
    c.fillStyle = highlight ? '#ffe2b0' : '#fff7ec';
    c.beginPath(); c.roundRect(10, 10, W - 20, H - 20, 34); c.fill();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#5a3f2c';
    c.font = '700 34px Rubik, system-ui, sans-serif';
    this._fit(c, title, W - 40, 34, 700);
    c.fillText(title, W / 2, H * 0.36);
    c.fillStyle = '#e08a1e';
    c.font = '800 52px Rubik, system-ui, sans-serif';
    this._fit(c, line2, W - 40, 52, 800);
    c.fillText(line2, W / 2, H * 0.7);
    this.tex.needsUpdate = true;
  }

  _fit(c, text, maxW, size, weight) {
    let s = size;
    while (c.measureText(text).width > maxW && s > 14) { s -= 2; c.font = `${weight} ${s}px Rubik, system-ui, sans-serif`; }
  }

  remove() { this.group.parent && this.group.parent.remove(this.group); }
}
