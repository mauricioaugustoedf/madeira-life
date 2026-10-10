import * as THREE from 'three';
import { CharacterModel } from '../player/CharacterModel.js';
import { CATALOG, SLOTS } from '../sim/Wardrobe.js';

// Menu de personalização: prévia 3D girando (arraste para girar), abas por parte,
// itens comprados com dinheiro do jogo. Itens comprados ficam liberados para sempre.
export class Customizer {
  constructor(wardrobe, economy, onChange) {
    this.w = wardrobe; this.economy = economy; this.onChange = onChange;
    this.el = document.getElementById('wardrobe');
    this.tabsEl = document.getElementById('wr-tabs');
    this.listEl = document.getElementById('wr-list');
    this.moneyEl = document.getElementById('wr-money');
    this.buyBar = document.getElementById('wr-buy');
    this.buyText = document.getElementById('wr-buy-text');
    this.buyBtn = document.getElementById('wr-buy-btn');
    this.canvas = document.getElementById('wr-canvas');
    this.slot = SLOTS[0];
    this.pending = null; // item bloqueado selecionado {slot, id}
    this.renderer = null;
    this.rot = 0.5;

    document.getElementById('wardrobe-btn').addEventListener('click', () => this.open());
    document.getElementById('wr-close').addEventListener('click', () => this.close());
    this.buyBtn.addEventListener('click', () => this._buy());

    // abas
    for (const s of SLOTS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'wr-tab'; b.textContent = CATALOG[s].label; b.dataset.slot = s;
      b.addEventListener('click', () => { this.slot = s; this.pending = null; this._render(); });
      this.tabsEl.appendChild(b);
    }
    // arrastar para girar a prévia
    let lastX = null;
    this.canvas.addEventListener('pointerdown', (e) => { lastX = e.clientX; this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', (e) => { if (lastX !== null) { this.rot += (e.clientX - lastX) * 0.012; lastX = e.clientX; } });
    this.canvas.addEventListener('pointerup', () => { lastX = null; });
  }

  _initPreview() {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x7a6a50, 2.2));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.2); sun.position.set(2, 3, 4); this.scene.add(sun);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, 1.35, 5.2);
    this.camera.lookAt(0, 1.05, 0);
    this.model = new CharacterModel({ skin: 0, hair: 0, shirt: 0, pants: 0, shoes: 0, cap: 0 }, { headwear: 'cap' });
    this.scene.add(this.model.group);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 24), new THREE.MeshLambertMaterial({ color: 0xc49a66 }));
    disc.position.y = -0.03; this.scene.add(disc);
  }

  open() {
    this.el.hidden = false;
    this._initPreview();
    this._render();
    const loop = (t) => {
      if (this.el.hidden) return;
      const r = this.canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      if (this.canvas.width !== w * this.renderer.getPixelRatio()) {
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
      }
      this.rot += 0.004;
      this.model.group.rotation.y = this.rot;
      this.model.animate(1 / 60, 0, t / 1000);
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  close() { this.el.hidden = true; this.pending = null; }

  // Prévia mostra o visual atual + o item bloqueado que está sendo experimentado
  _previewLook() {
    const saved = this.w.look;
    if (!this.pending) return this.w.apply(this.model);
    this.w.look = { ...saved, [this.pending.slot]: this.pending.id };
    this.w.apply(this.model);
    this.w.look = saved;
  }

  _render() {
    this.moneyEl.textContent = this.economy.infinite ? '∞' : '$' + Math.floor(this.economy.money).toLocaleString('pt-BR');
    for (const b of this.tabsEl.children) b.classList.toggle('on', b.dataset.slot === this.slot);
    const cat = CATALOG[this.slot];
    this.listEl.innerHTML = '';
    for (const it of cat.items) {
      const owned = this.w.has(this.slot, it.id);
      const worn = this.w.look[this.slot] === it.id;
      const sel = this.pending && this.pending.slot === this.slot && this.pending.id === it.id;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wr-item' + (worn ? ' worn' : '') + (sel ? ' sel' : '') + (owned ? '' : ' locked');
      if (cat.kind === 'color') {
        const sw = document.createElement('span'); sw.className = 'sw';
        sw.style.background = '#' + it.hex.toString(16).padStart(6, '0');
        b.appendChild(sw);
      }
      const name = document.createElement('span'); name.className = 'nm'; name.textContent = it.name; b.appendChild(name);
      const tag = document.createElement('span'); tag.className = 'tg';
      tag.textContent = worn ? 'Usando' : owned ? 'Seu' : '$' + it.price.toLocaleString('pt-BR');
      b.appendChild(tag);
      b.addEventListener('click', () => {
        if (owned) { this.pending = null; this.w.wear(this.slot, it.id); this.onChange(); }
        else this.pending = { slot: this.slot, id: it.id };
        this._render();
      });
      this.listEl.appendChild(b);
    }
    // barra de compra
    if (this.pending) {
      const it = this.w.item(this.pending.slot, this.pending.id);
      const ok = this.economy.canAfford(it.price);
      this.buyBar.hidden = false;
      this.buyText.textContent = `${it.name} — $${it.price.toLocaleString('pt-BR')}`;
      this.buyBtn.disabled = !ok;
      this.buyBtn.textContent = ok ? 'Comprar e usar' : 'Faltam $' + Math.ceil(it.price - this.economy.money).toLocaleString('pt-BR');
    } else this.buyBar.hidden = true;
    if (this.model) this._previewLook();
  }

  _buy() {
    const p = this.pending;
    if (!p) return;
    if (this.w.buy(p.slot, p.id, this.economy)) {
      this.w.wear(p.slot, p.id);
      this.pending = null;
      this.onChange();
    }
    this._render();
  }
}
