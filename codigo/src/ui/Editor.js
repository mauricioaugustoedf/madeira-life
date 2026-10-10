import * as THREE from 'three';
import { Stage } from '../sim/Forest.js';
import { DECOR } from '../world/Decor.js';

// Modo editar: tocar num objeto seleciona; arrastar move; Girar / Excluir / Adicionar.
// Com "Grupo" ligado, tocar numa árvore pega o bosque inteiro (árvores encostadas umas nas
// outras), numa rocha pega o grupo de rochas, e tudo se move/gira/exclui junto.
// As construções de produção ficam fixas. Ao sair, a navegação é recalculada e o jogo salva.
const LINK = { tree: 3.8, rock: 6.5, decor: 2.6 };   // distância que liga objetos do mesmo grupo

export class Editor {
  constructor(o) {
    Object.assign(this, o);   // engine, input, world, forest, quarry, decor, economy, player, particles, blocks(), onDone()
    this.on = false;
    this.sel = null;          // { members: [{ kind, ref }], cx, cz, r }
    this.drag = null;
    this.group = true;        // seleção em grupo ligada por padrão
    this.changed = false;
    this.bar = document.getElementById('edit-bar');
    this.tip = document.getElementById('edit-tip');
    this.btnRot = document.getElementById('ed-rot');
    this.btnDel = document.getElementById('ed-del');
    this.btnGroup = document.getElementById('ed-group');
    this.addEl = document.getElementById('edit-add');
    this.addList = document.getElementById('add-list');
    document.getElementById('edit-btn').addEventListener('click', () => (this.on ? this.exit() : this.enter()));
    document.getElementById('ed-done').addEventListener('click', () => this.exit());
    this.btnRot.addEventListener('click', () => this.rotate());
    this.btnDel.addEventListener('click', () => this.del());
    this.btnGroup.addEventListener('click', () => this.toggleGroup());
    document.getElementById('ed-add').addEventListener('click', () => this.openAdd());
    document.getElementById('add-close').addEventListener('click', () => { this.addEl.hidden = true; });

    // anel de seleção no chão (aparece por cima de tudo)
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xf2b134, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48), this.ringMat);
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.06; this.ring.visible = false;
    this.ring.renderOrder = 10;
    this.engine.scene.add(this.ring);
    // marquinhas em cada objeto do grupo
    this.dotMat = new THREE.MeshBasicMaterial({ color: 0xf2b134, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false });
    this.dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.35, 12).rotateX(-Math.PI / 2), this.dotMat, 400);
    this.dots.renderOrder = 10; this.dots.count = 0; this.dots.frustumCulled = false;
    this.engine.scene.add(this.dots);
    this._m = new THREE.Matrix4();

    this._ray = new THREE.Raycaster(); this._ndc = new THREE.Vector2();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); this._hit = new THREE.Vector3(); this._v = new THREE.Vector3();
    this.input.onDragStart = (x, y) => this._dragStart(x, y);
    this.input.onDrag = (x, y) => this._dragMove(x, y);
    this.input.onDragEnd = () => this._dragEnd();
    this._confirmDel = false;
    this._refreshGroupBtn();
  }

  enter() {
    this.on = true; this.changed = false;
    document.body.classList.add('editing');
    this.bar.hidden = false;
    this.select(null);
  }

  exit() {
    if (this.drag) this._dragEnd();
    this.on = false;
    document.body.classList.remove('editing');
    this.bar.hidden = true; this.addEl.hidden = true;
    this.select(null);
    if (this.changed) { this.world.nav.rebuild(); this.onDone(); }
  }

  toggleGroup() {
    this.group = !this.group;
    this._refreshGroupBtn();
    if (this.sel) this.select(this.group ? this._cluster(this.sel.members[0]) : [this.sel.members[0]]);
  }
  _refreshGroupBtn() { this.btnGroup.textContent = this.group ? 'Grupo ✓' : 'Grupo'; this.btnGroup.classList.toggle('primary', this.group); }

  _say(t) { this.tip.textContent = t; }

  _ground(sx, sy) {
    this._ndc.set((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
    this._ray.setFromCamera(this._ndc, this.engine.camera);
    return this._ray.ray.intersectPlane(this._plane, this._hit) ? this._hit : null;
  }

  // ---- objetos ----
  _alive(m) {
    if (m.kind === 'tree') return m.ref.stage !== Stage.REMOVED;
    if (m.kind === 'rock') return !m.ref.removed;
    return this.decor.items.includes(m.ref);
  }
  _rad(m) {
    if (m.kind === 'tree') return 0.45 * m.ref.scale + 0.25;
    if (m.kind === 'rock') return 1.1 * m.ref.scale;
    return this.decor.radius(m.ref);
  }
  _all(kind) {
    if (kind === 'tree') return this.forest.trees.filter((t) => t.stage !== Stage.REMOVED).map((ref) => ({ kind, ref }));
    if (kind === 'rock') return this.quarry.open ? this.quarry.rocks.filter((r) => !r.removed).map((ref) => ({ kind, ref })) : [];
    return this.decor.items.map((ref) => ({ kind, ref }));
  }
  _label(sel) {
    const ms = sel.members, m = ms[0];
    if (ms.length > 1) return m.kind === 'tree' ? `Bosque (${ms.length} árvores)` : m.kind === 'rock' ? `Grupo de rochas (${ms.length})` : `Grupo (${ms.length} itens)`;
    if (m.kind === 'tree') return m.ref.stage === Stage.STUMP ? 'Toco' : m.ref.stage === Stage.GROWING ? 'Muda' : 'Árvore';
    if (m.kind === 'rock') return 'Rocha da pedreira';
    return DECOR[m.ref.type].label;
  }

  // Objetos do mesmo tipo encostados uns nos outros (um bosque, um grupo de rochas)
  _cluster(seed) {
    const pool = this._all(seed.kind);
    if (seed.kind === 'decor') return [seed];   // casas e enfeites: um por vez
    const link = LINK[seed.kind];
    const out = [], seen = new Set([seed.ref]), queue = [seed];
    while (queue.length) {
      const a = queue.pop();
      out.push(a);
      for (const b of pool) {
        if (seen.has(b.ref)) continue;
        if (Math.hypot(a.ref.x - b.ref.x, a.ref.z - b.ref.z) <= link) { seen.add(b.ref); queue.push(b); }
      }
    }
    return out;
  }

  _centroid(members) {
    let x = 0, z = 0;
    for (const m of members) { x += m.ref.x; z += m.ref.z; }
    x /= members.length; z /= members.length;
    let r = 0;
    for (const m of members) r = Math.max(r, Math.hypot(m.ref.x - x, m.ref.z - z) + this._rad(m));
    return { cx: x, cz: z, r };
  }

  select(members) {
    this._confirmDel = false;
    this.btnDel.textContent = 'Excluir';
    if (!members || !members.length) {
      this.sel = null;
      this.ring.visible = false; this.dots.count = 0;
      this.btnRot.disabled = this.btnDel.disabled = true;
      this._say('Toque num objeto para escolher. Arraste o dedo em outro lugar para andar.');
      return;
    }
    this.sel = { members, ...this._centroid(members) };
    this.btnRot.disabled = members.length === 1 && members[0].kind === 'rock';
    this.btnDel.disabled = false;
    this._say(`${this._label(this.sel)}: arraste para mover`);
    this._placeRing(true);
  }

  _placeRing(ok) {
    const s = this.sel; if (!s) return;
    this.ring.visible = true;
    this.ring.scale.setScalar(Math.max(0.6, s.r));
    this.ring.position.set(s.cx, 0.06, s.cz);
    this.ringMat.color.setHex(ok ? 0xf2b134 : 0xe74c3c);
    this.dotMat.color.setHex(ok ? 0xf2b134 : 0xe74c3c);
    const ms = s.members.length > 1 ? s.members : [];
    this.dots.count = Math.min(400, ms.length);
    for (let i = 0; i < this.dots.count; i++) {
      this._m.makeTranslation(ms[i].ref.x, 0.07, ms[i].ref.z);
      this.dots.setMatrixAt(i, this._m);
    }
    this.dots.instanceMatrix.needsUpdate = true;
  }

  // Toque no modo editar: escolhe o objeto mais perto do ponto tocado
  tap(sx, sy) {
    const h = this._ground(sx, sy);
    if (!h) return;
    let best = null, bestD = Infinity;
    for (const kind of ['decor', 'tree', 'rock']) {
      for (const m of this._all(kind)) {
        const d = Math.hypot(m.ref.x - h.x, m.ref.z - h.z);
        const rad = kind === 'tree' ? 0.45 * m.ref.scale + 0.3 : this._rad(m);
        if (d < rad + 0.6 && d < bestD) { bestD = d; best = m; }
      }
    }
    if (!best) { this.select(null); return; }
    this.select(this.group ? this._cluster(best) : [best]);
  }

  // ---- mover ----
  _screenOf(x, z) {
    this._v.set(x, 0.5, z).project(this.engine.camera);
    return { x: (this._v.x * 0.5 + 0.5) * window.innerWidth, y: (-this._v.y * 0.5 + 0.5) * window.innerHeight };
  }

  _uncollide(m) { this.world.colliders.remove(m.ref.col); m.ref.col = null; }

  _commit(m, x, z) {
    if (m.kind === 'tree') this.forest.moveTree(m.ref, x, z);
    else if (m.kind === 'rock') this.quarry.moveRock(m.ref, x, z);
    else this.decor.move(m.ref, x, z);
  }

  _setPos(m, x, z) {
    const ref = m.ref;
    ref.x = x; ref.z = z;
    if (m.kind === 'tree') this.forest.dirty.add(ref);
    else if (m.kind === 'rock') this.quarry.dirty = true;
    else ref.group.position.set(x, 0, z);
  }

  _dragStart(sx, sy) {
    if (!this.on || !this.sel) return false;
    const s = this.sel;
    // pega o grupo tocando perto do centro ou de qualquer objeto dele
    let near = false;
    const pc = this._screenOf(s.cx, s.cz);
    if (Math.hypot(pc.x - sx, pc.y - sy) < 70) near = true;
    if (!near) {
      const h = this._ground(sx, sy);
      if (h) for (const m of s.members) if (Math.hypot(m.ref.x - h.x, m.ref.z - h.z) < this._rad(m) + 0.5) { near = true; break; }
    }
    if (!near) return false;
    const h = this._ground(sx, sy);
    this.drag = { ok: true, hx: h ? h.x : s.cx, hz: h ? h.z : s.cz, orig: s.members.map((m) => [m.ref.x, m.ref.z]), cx0: s.cx, cz0: s.cz };
    for (const m of s.members) this._uncollide(m);   // tira os próprios obstáculos enquanto arrasta
    return true;
  }

  _valid(x, z, r, skip) {
    const B = this.world.bounds;
    if (x - r < B.minX + 0.5 || x + r > B.maxX - 0.5 || z - r < B.minZ + 0.5 || z + r > B.maxZ - 0.5) return false;
    for (const b of this._blocks) if (Math.abs(x - b.x) < b.w / 2 + r * 0.8 && Math.abs(z - b.z) < b.d / 2 + r * 0.8) return false;
    if (!this.world.colliders.isFree(x, z, Math.max(0.2, r * 0.75))) return false;
    for (const it of this.decor.items) {
      if (skip && skip.has(it)) continue;
      if (Math.hypot(it.x - x, it.z - z) < (r + this.decor.radius(it)) * 0.8) return false;
    }
    const pp = this.player.position;
    return Math.hypot(pp.x - x, pp.z - z) > r * 0.7 + 0.35;
  }

  _validAll(members) {
    this._blocks = this.blocks();
    const skip = new Set(members.map((m) => m.ref));
    for (const m of members) if (!this._valid(m.ref.x, m.ref.z, this._rad(m), skip)) return false;
    return true;
  }

  _dragMove(sx, sy) {
    if (!this.drag || !this.sel) return;
    const h = this._ground(sx, sy);
    if (!h) return;
    const dx = h.x - this.drag.hx, dz = h.z - this.drag.hz;
    const s = this.sel;
    s.members.forEach((m, i) => this._setPos(m, this.drag.orig[i][0] + dx, this.drag.orig[i][1] + dz));
    s.cx = this.drag.cx0 + dx; s.cz = this.drag.cz0 + dz;
    this.drag.ok = this._validAll(s.members);
    this._placeRing(this.drag.ok);
    this._say(this.drag.ok ? 'Solte para colocar aqui' : 'Aqui não dá (área de trabalho, obstáculo ou fora do terreno)');
  }

  _dragEnd() {
    if (!this.drag || !this.sel) { this.drag = null; return; }
    const s = this.sel, d = this.drag;
    let moved = false;
    s.members.forEach((m, i) => {
      let x = m.ref.x, z = m.ref.z;
      if (!d.ok) { [x, z] = d.orig[i]; this._setPos(m, x, z); }
      if (x !== d.orig[i][0] || z !== d.orig[i][1]) moved = true;
      this._commit(m, x, z);
    });
    if (moved) this.changed = true;
    this.drag = null;
    Object.assign(s, this._centroid(s.members));
    this._placeRing(true);
    this._say(`${this._label(s)}: arraste para mover`);
  }

  // Gira um objeto (45°) ou o grupo inteiro em volta do centro
  rotate() {
    const s = this.sel; if (!s) return;
    if (s.members.length === 1) {
      const m = s.members[0];
      if (m.kind === 'tree') { m.ref.rot += Math.PI / 4; this.forest.dirty.add(m.ref); }
      else if (m.kind === 'decor') this.decor.rotate(m.ref);
      this.changed = true;
      return;
    }
    const a = Math.PI / 4, c = Math.cos(a), sn = Math.sin(a);
    const orig = s.members.map((m) => [m.ref.x, m.ref.z]);
    for (const m of s.members) this._uncollide(m);
    for (const m of s.members) {
      const dx = m.ref.x - s.cx, dz = m.ref.z - s.cz;
      this._setPos(m, s.cx + dx * c - dz * sn, s.cz + dx * sn + dz * c);
    }
    const ok = this._validAll(s.members);
    s.members.forEach((m, i) => {
      if (!ok) this._setPos(m, orig[i][0], orig[i][1]);
      if (m.kind === 'decor') { this._commit(m, m.ref.x, m.ref.z); this.decor.rotate(m.ref); }
      else this._commit(m, m.ref.x, m.ref.z);
    });
    if (ok) this.changed = true;
    else this._say('Não cabe girado aqui');
    this._placeRing(true);
  }

  del() {
    const s = this.sel; if (!s) return;
    if (!this._confirmDel) { this._confirmDel = true; this.btnDel.textContent = 'Confirmar'; this._say(`Excluir ${this._label(s).toLowerCase()}? Toque em Confirmar`); return; }
    let busy = 0;
    for (const m of s.members) {
      let ok = true;
      if (m.kind === 'tree') ok = this.forest.removeTree(m.ref);
      else if (m.kind === 'rock') ok = this.quarry.removeRock(m.ref);
      else this.decor.remove(m.ref);
      if (!ok) busy++;
      else if (s.members.length < 30 || Math.random() < 0.3) this.particles.burst(m.ref.x, 0.6, m.ref.z, 4, 2);
    }
    this.changed = true;
    this.select(null);
    if (busy) this._say(`${busy} ${busy > 1 ? 'objetos estavam' : 'objeto estava'} em uso e ficou. Tente de novo daqui a pouco.`);
  }

  // ---- adicionar ----
  _catalog() {
    const list = [{ id: 'tree', label: 'Muda de árvore', price: 50 }, { id: 'grove', label: 'Bosque (12 mudas)', price: 500 }];
    if (this.quarry.open) list.push({ id: 'rock', label: 'Rocha da pedreira', price: 300 });
    for (const [id, d] of Object.entries(DECOR)) list.push({ id, label: d.label, price: d.price });
    return list;
  }

  openAdd() {
    this.addList.innerHTML = '';
    for (const c of this._catalog()) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'add-item';
      b.disabled = !this.economy.canAfford(c.price);
      const n = document.createElement('span'); n.textContent = c.label;
      const p = document.createElement('small'); p.textContent = '$' + c.price.toLocaleString('pt-BR');
      b.append(n, p);
      b.addEventListener('click', () => { this.addEl.hidden = true; this._add(c); });
      this.addList.appendChild(b);
    }
    this.addEl.hidden = false;
  }

  // Lugar livre perto de você para um conjunto de pontos relativos (procura em volta)
  _spot(offsets, r) {
    this._blocks = this.blocks();
    const p = this.player.position;
    const ext = offsets.reduce((a, [ox, oz]) => Math.max(a, Math.hypot(ox, oz)), 0);
    for (let d = 2.2 + r + ext; d < 18 + ext; d += 0.8) {
      for (let k = 0; k < 12; k++) {
        const a = -Math.PI / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 6);
        const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
        if (offsets.every(([ox, oz]) => this._valid(x + ox, z + oz, r))) return { x, z };
      }
    }
    return null;
  }

  _add(c) {
    const grid = [];
    if (c.id === 'grove') for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) grid.push([(i - 1.5) * 2.5, (j - 1) * 2.6]);
    else grid.push([0, 0]);
    const r = c.id === 'tree' || c.id === 'grove' ? 0.6 : c.id === 'rock' ? 1.1 : this.decor.radius({ type: c.id, s: 1 });
    const spot = this._spot(grid, r);
    if (!spot) { this._say('Sem espaço livre aqui perto. Ande até um lugar vazio e tente de novo.'); return; }
    if (!this.economy.spend(c.price)) { this._say('Dinheiro insuficiente'); return; }
    const members = [];
    for (const [ox, oz] of grid) {
      const x = spot.x + ox, z = spot.z + oz;
      if (c.id === 'tree' || c.id === 'grove') members.push({ kind: 'tree', ref: this.forest.addTree(x, z) });
      else if (c.id === 'rock') members.push({ kind: 'rock', ref: this.quarry.addRock(x, z) });
      else members.push({ kind: 'decor', ref: this.decor.add(c.id, x, z) });
    }
    this.particles.burst(spot.x, 0.6, spot.z, 12, 2.5);
    this.changed = true;
    this.select(members);
  }

  update() {
    if (!this.on || !this.sel) return;
    const s = this.sel;
    s.members = s.members.filter((m) => this._alive(m));
    if (!s.members.length) { this.select(null); return; }
    if (!this.drag) { this.ring.position.set(s.cx, 0.06, s.cz); }
    this.ring.rotation.z += 0.02;
  }
}
