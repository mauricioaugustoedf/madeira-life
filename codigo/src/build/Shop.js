import { ZoneMarker } from '../world/ZoneMarker.js';
import { Sign } from '../world/Sign.js';

// Pontos de compra fixos no mapa.
// Cada item tem uma área no chão + placa. Ao entrar na área, aparece o cartão [COMPRAR].
// item = { id, zone:{x,z,w,d}, signAt:{x,z}, offer(): oferta | null, buy() }
// oferta = { title, short, desc, cost, planks? }   (planks = tábuas que você deposita na obra)
//        | { hidden: true }                        (ainda bloqueado: some do mapa, volta depois)
// offer() devolvendo null = item esgotado, removido de vez.
export class Shop {
  constructor(scene, economy, ui, resources = {}) {
    this.scene = scene;
    this.economy = economy;
    this.ui = ui;
    this.res = resources; // { planks: PlankStack }
    this.items = [];
    this.active = null;
    ui.onBuy = () => this.buyActive();
  }

  add(item) {
    item.deposited = 0;   // tábuas já entregues na obra (ficam guardadas até construir)
    item.pending = 0;     // tábuas voando até a obra
    item.stoneDep = 0;    // pedras já entregues na obra
    item.stonePending = 0;
    item.marker = new ZoneMarker(this.scene, item.zone, 0x7c6a4f);
    // moeda no centro da área
    item.sign = new Sign(this.scene, item.signAt.x, item.signAt.z);
    this.items.push(item);
    this._refreshSign(item);
    return item;
  }

  _remove(item) {
    item.sign.remove();
    item.marker.group.parent.remove(item.marker.group);
    this.items.splice(this.items.indexOf(item), 1);
    if (this.active === item) this.active = null;
  }

  // Modo teste "obras sem material": a oferta não pede tábuas nem pedras
  _offer(item) {
    const o = item.offer();
    if (o && this.freeMaterials && (o.planks || o.stone)) return { ...o, planks: 0, stone: 0 };
    return o;
  }

  canAfford(o, item) {
    return this.economy.canAfford(o.cost) && (!o.planks || item.deposited >= o.planks) && (!o.stone || item.stoneDep >= o.stone);
  }

  // Quantas pedras a obra ativa ainda aceita
  stoneNeed(item = this.active) {
    if (!item) return 0;
    const o = this._offer(item);
    if (!o || o.hidden || !o.stone) return 0;
    return Math.max(0, o.stone - item.stoneDep - item.stonePending);
  }

  // Quantas tábuas a obra ativa ainda aceita (contando as que estão voando)
  plankNeed(item = this.active) {
    if (!item) return 0;
    const o = this._offer(item);
    if (!o || o.hidden || !o.planks) return 0;
    return Math.max(0, o.planks - item.deposited - item.pending);
  }

  _setVisible(item, v) {
    item.sign.group.visible = v;
    item.marker.group.visible = v;
  }

  _refreshSign(item) {
    const o = this._offer(item);
    if (!o) { this._remove(item); return; }
    this._setVisible(item, !o.hidden);
    if (o.hidden) return;
    const price = o.sign ? o.sign : '$' + o.cost.toLocaleString('pt-BR') + (o.planks ? ` · ${item.deposited}/${o.planks} táb.` : '') + (o.stone ? ` · ${item.stoneDep}/${o.stone} pedras` : '');
    item.sign.set(o.short || o.title, price, this.canAfford(o, item));
  }

  buyActive() {
    const item = this.active;
    if (!item) return false;
    const o = this._offer(item);
    if (!o || o.hidden || !this.canAfford(o, item)) return false;
    if (!this.economy.spend(o.cost)) return false;
    item.deposited = 0;   // as tábuas foram usadas na obra
    item.stoneDep = 0;
    item.buy();
    this._refreshSign(item);
    if (this.onBought && o.cost > 0) this.onBought(item, o);
    return true;
  }

  update(dt, time, px, pz) {
    let found = null;
    for (const it of this.items) {
      if (!it.marker.group.visible) continue;
      const inside = it.marker.contains(px, pz);
      it.marker.setActive(inside, time);
      if (inside) found = it;
    }
    this.active = found;
    for (const it of this.items.slice()) this._refreshSign(it);
    if (found) {
      const o = this._offer(found);
      if (o && !o.hidden) this.ui.show(o, this.economy.infinite ? Infinity : this.economy.money, found.deposited, found.stoneDep);
      else this.ui.hide();
    } else this.ui.hide();
  }
}

// Cartão de compra na parte de baixo da tela
export class BuyCard {
  constructor() {
    this.el = document.getElementById('buy');
    this.titleEl = document.getElementById('buy-title');
    this.descEl = document.getElementById('buy-desc');
    this.costEl = document.getElementById('buy-cost');
    this.btn = document.getElementById('buy-btn');
    this.onBuy = null;
    this._key = '';
    // pointerdown responde na hora no iPhone (sem atraso de clique)
    this.btn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!this.btn.disabled && this.onBuy) this.onBuy();
    });
  }

  show(o, money, deposited = 0, stone = 0) {
    const lackMoney = Math.max(0, Math.ceil(o.cost - money));
    const lackPlanks = o.planks ? Math.max(0, o.planks - deposited) : 0;
    const lackStone = o.stone ? Math.max(0, o.stone - stone) : 0;
    const afford = !lackMoney && !lackPlanks && !lackStone;
    const hint = document.getElementById('hint');
    if (hint) hint.classList.add('gone'); // a dica inicial não disputa espaço com o cartão
    const key = `${o.title}|${o.desc}|${o.cost}|${o.planks}|${lackMoney}|${lackPlanks}|${deposited}|${lackStone}`;
    this.el.hidden = false;
    if (key === this._key) return;
    this._key = key;
    this.titleEl.textContent = o.title;
    let desc = o.desc;
    if (o.planks) desc = `${desc.replace(/\.?$/, '.')} Tábuas depositadas: ${deposited}/${o.planks}.`;
    if (o.stone) desc = `${desc.replace(/\.?$/, '.')} Pedras depositadas: ${stone}/${o.stone}.`;
    this.descEl.textContent = desc;
    this.costEl.textContent = o.costText ? o.costText : '$' + o.cost.toLocaleString('pt-BR') + (o.planks ? ` + ${o.planks} tábuas` : '') + (o.stone ? ` + ${o.stone} pedras` : '');
    this.costEl.classList.toggle('small', !!(o.planks || o.stone));
    this.btn.disabled = !afford;
    this.btn.textContent = afford ? (o.action || (o.planks || o.stone ? 'CONSTRUIR' : 'COMPRAR'))
      : lackPlanks ? `Traga mais ${lackPlanks} tábuas`
      : lackStone ? `Traga mais ${lackStone} pedras`
      : 'Faltam $' + lackMoney.toLocaleString('pt-BR');
  }

  hide() {
    if (!this.el.hidden) { this.el.hidden = true; this._key = ''; }
  }
}
