import { CONFIG } from '../config.js';

// Pedidos de clientes. `Orders` sorteia pedidos (produto, quantidade, cliente) e guarda o total
// concluído; cada vaga de carga tem um `OrderSlot` com o pedido do caminhão parado nela.
export class Orders {
  constructor(economy, rand = Math.random) {
    this.economy = economy;
    this.rand = rand;
    this.completed = 0;
    this.enabled = new Set(['plank']);   // produtos que os clientes pedem (cresce com as máquinas)
    this.onComplete = null;
    // main liga estas funções: o que o jogador já consegue produzir e quanto tem de cada um
    this.available = () => [...this.enabled];
    this.stockOf = () => 1;
  }

  valid(product) { return this.available().includes(product); }

  get dryEnabled() { return this.enabled.has('dry'); }
  set dryEnabled(v) { if (v) this.enabled.add('dry'); else this.enabled.delete('dry'); }

  // Só sorteia o que o jogador já consegue fazer; o que tem em estoque pesa mais
  _pickProduct(avoid = []) {
    const P = CONFIG.products;
    let list = this.available().filter((k) => P[k]);
    if (list.length <= 1) return list[0] || 'plank';
    const fresh = list.filter((k) => !avoid.includes(k) && this.stockOf(k) > 0);
    if (fresh.length) list = list.filter((k) => !avoid.includes(k) || !fresh.length);
    const w = (k) => P[k].weight * (k === 'plank' || this.stockOf(k) > 0 ? 1 : 0.3);
    const total = list.reduce((a, k) => a + w(k), 0);
    let r = this.rand() * total;
    for (const k of list) { r -= w(k); if (r <= 0) return k; }
    return list[list.length - 1];
  }

  // Cria um pedido novo; fica um pouco maior e mais valioso com o tempo
  make(avoid = []) {
    const O = CONFIG.orders;
    let qty;
    if (this.completed === 0) qty = O.firstQty;
    else {
      const grow = Math.floor(this.completed / 4);
      const min = O.minQty + grow, max = O.maxQty + grow * 2;
      qty = min + Math.floor(this.rand() * (max - min + 1));
    }
    const product = this.completed > 0 ? this._pickProduct(avoid) : 'plank';
    const def = CONFIG.products[product];
    qty = Math.max(2, Math.round(qty * def.qtyMul));
    qty = Math.min(qty, O.maxQtyCap); // cabe na carroceria do caminhão
    // serragem não se fabrica sob encomenda: o cliente pede no máximo o que você tem
    if (product === 'serragem') qty = Math.max(2, Math.min(qty, this.stockOf(product)));
    const mult = 1 + this.completed * O.bonusPerOrder;
    const price = product === 'plank' ? O.plankPrice : product === 'dry' ? O.dryPrice : def.price;
    const reward = Math.round(qty * price * Math.min(mult, 2));
    const pool = (CONFIG.buyers && CONFIG.buyers[product]) || [['Cliente', 0x2f6fb3]];
    const [customer, color] = pool[Math.floor(this.rand() * pool.length)];
    return { product, label: def.label, qty, delivered: 0, reward, customer, color };
  }

  finish(o) {
    this.economy.earn(o.reward);
    this.completed++;
    if (this.onComplete) this.onComplete(o);
  }
}

// Pedido de uma vaga (mesma interface que a doca já usava: current, remaining, next, deliverOne)
export class OrderSlot {
  constructor(orders, others = () => []) {
    this.orders = orders;
    this.others = others;      // produtos pedidos nas outras vagas (para variar)
    this.current = null;
  }

  get completed() { return this.orders.completed; }
  get enabled() { return this.orders.enabled; }

  next() { this.current = this.orders.make(this.others()); return this.current; }

  get remaining() { return this.current ? this.current.qty - this.current.delivered : 0; }

  // Entrega 1 unidade; devolve true se o pedido ficou completo
  deliverOne() {
    const o = this.current;
    if (!o || o.delivered >= o.qty) return false;
    o.delivered++;
    if (o.delivered < o.qty) return false;
    this.orders.finish(o);
    return true;
  }
}
