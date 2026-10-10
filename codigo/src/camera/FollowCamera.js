import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Câmera em terceira pessoa com ângulo fixo, seguimento suave e zoom.
// zoom = multiplicador da distância (maior = mais longe).
export class FollowCamera {
  constructor(camera, target) {
    this.camera = camera;
    this.target = target;
    const o = CONFIG.camera.offset;
    this.baseOffset = new THREE.Vector3(o.x, o.y, o.z);
    this.focus = new THREE.Vector3().copy(target.position);
    this._pos = new THREE.Vector3();
    this.zoomTarget = CONFIG.camera.zoomDefault;
    this.zoom = this.zoomTarget;
    this.onZoomChange = null;
    this.snap();
  }

  setZoom(z) {
    const C = CONFIG.camera;
    this.zoomTarget = Math.min(C.zoomMax, Math.max(C.zoomMin, z));
  }

  // fator > 1 aproxima (gesto de abrir os dedos)
  zoomBy(factor) { this.setZoom(this.zoomTarget / factor); }

  // 0 = mais perto, 1 = mais longe
  get zoom01() {
    const C = CONFIG.camera;
    return (this.zoom - C.zoomMin) / (C.zoomMax - C.zoomMin);
  }

  get distance() { return this.baseOffset.length() * this.zoom; }

  snap() {
    this.focus.copy(this.target.position);
    this.zoom = this.zoomTarget;
    this._apply();
  }

  update(dt) {
    const k = 1 - Math.exp(-CONFIG.camera.smoothing * dt);
    this.focus.lerp(this.target.position, k);
    const before = this.zoom;
    this.zoom += (this.zoomTarget - this.zoom) * (1 - Math.exp(-10 * dt));
    if (Math.abs(this.zoom - before) > 1e-4 && this.onZoomChange) this.onZoomChange(this.zoom);
    this._apply();
  }

  _apply() {
    this._pos.copy(this.baseOffset).multiplyScalar(this.zoom).add(this.focus);
    this.camera.position.copy(this._pos);
    this.camera.lookAt(this.focus.x, this.focus.y + CONFIG.camera.lookHeight, this.focus.z);
  }
}
