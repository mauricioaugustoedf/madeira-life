import { CONFIG } from '../config.js';

// HUD mínimo: dinheiro (placeholder até a economia entrar) e FPS.
export class Hud {
  constructor() {
    this.fpsEl = document.getElementById('fps');
    this.hintEl = document.getElementById('hint');
    this.moneyEl = document.getElementById('money');
    this.logsEl = document.getElementById('logs');
    this.planksEl = document.getElementById('planks');
    this._planks = '';
    this.statusEl = document.getElementById('status');
    this.dotEl = document.getElementById('status-dot');
    this._logs = -1; this._status = '';
    this._t = 0;
  }

  hideHint() { this.hintEl.classList.add('gone'); }

  setMoney(v, delta = 0) {
    this.moneyEl.textContent = this.infinite ? '∞' : '$' + Math.floor(v).toLocaleString('pt-BR');
    if (delta > 0) {
      const chip = this.moneyEl.parentElement;
      chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump');
    }
  }

  // Cartão de pedidos: uma linha por vaga aberta (cliente, produto, entregue/total, valor)
  setOrders(docks) {
    if (!this.orderList) { this.orderList = document.getElementById('order-list'); this._ordKey = ''; }
    const rows = [];
    for (const d of docks) {
      if (!d.open) continue;
      const o = d.orders.current;
      const waiting = d.statusText;
      if (!o || (waiting && waiting !== 'Caminhão chegando…')) rows.push({ who: waiting || 'Aguardando cliente' });
      else {
        rows.push({ cust: o.customer, qty: `${o.label} ${o.delivered}/${o.qty}`, reward: '$' + o.reward.toLocaleString('pt-BR'), pct: Math.round(o.delivered / o.qty * 100) });
      }
    }
    const key = JSON.stringify(rows);
    if (key === this._ordKey) return;
    this._ordKey = key;
    this.orderList.innerHTML = '';
    for (const r of rows) {
      const el = document.createElement('div'); el.className = 'ord';
      if (r.qty) {
        const row = document.createElement('span'); row.className = 'ord-row';
        const q = document.createElement('span'); q.className = 'ord-who'; q.textContent = r.qty;
        const b = document.createElement('b'); b.textContent = r.reward;
        row.append(q, b); el.appendChild(row);
        const c = document.createElement('span'); c.className = 'ord-cust'; c.textContent = r.cust; el.appendChild(c);
        const bar = document.createElement('span'); bar.className = 'bar';
        const i = document.createElement('i'); i.style.width = r.pct + '%'; bar.appendChild(i); el.appendChild(bar);
      } else {
        const w = document.createElement('span'); w.className = 'ord-cust'; w.textContent = r.who; el.appendChild(w);
      }
      this.orderList.appendChild(el);
    }
  }

  // Texto flutuante (ex.: +$45) que sobe e some
  floatText(text, x, y, negative = false) {
    const el = document.createElement('div');
    el.className = 'float-text' + (negative ? ' neg' : '');
    el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  setLogs(n) {
    if (n === this._logs) return;
    this._logs = n;
    this.logsEl.textContent = n.toLocaleString('pt-BR');
  }

  // O que o jogador carrega nas costas
  setCarry(n, cap, summary) {
    if (!this.carryEl) { this.carryEl = document.getElementById('carry'); this.carryN = document.getElementById('carry-n'); this._carry = ''; }
    const t = n > 0 ? `${n}/${cap} · ${summary}` : '';
    if (t === this._carry) return;
    this._carry = t;
    this.carryEl.hidden = !t;
    this.carryN.textContent = t;
  }

  // Produtos novos (vigas, pallets, compensados) num chip só
  setProducts(list) {
    const short = { Compensados: 'Comp.' };
    const t = list.map(([label, n]) => `${short[label] || label} ${n}`).join(' · ');
    if (t === this._prods) return;
    this._prods = t;
    const chip = document.getElementById('prod-chip');
    chip.hidden = !t;
    document.getElementById('prods').textContent = t;
  }

  showStone(v) { document.getElementById('stone-chip').hidden = !v; }

  setStone(n, cap) {
    const t = n.toLocaleString('pt-BR') + '/' + cap;
    if (t === this._stone) return;
    this._stone = t;
    document.getElementById('stone').textContent = t;
  }

  showDry(v) { document.getElementById('dry-chip').hidden = !v; }

  setDry(n, cap) {
    const t = n.toLocaleString('pt-BR') + '/' + cap;
    if (t === this._dry) return;
    this._dry = t;
    document.getElementById('dry').textContent = t;
  }

  setPlanks(n, cap) {
    const t = n.toLocaleString('pt-BR') + '/' + cap;
    if (t === this._planks) return;
    this._planks = t;
    this.planksEl.textContent = t;
  }

  setStatus(text, kind) {
    if (text === this._status) return;
    this._status = text;
    this.statusEl.textContent = text;
    this.dotEl.className = 'dot ' + (kind || '');
  }

  update(dt, engine) {
    this._t += dt;
    if (this._t < 0.5) return;
    this._t = 0;
    const dn = this.dayNight;
    this.fpsEl.textContent = (dn && !dn.alwaysDay ? (dn.night > 0.5 ? '☾ ' : '☀ ') + dn.clock + ' · ' : '') + Math.round(engine.fps) + ' fps';
  }
}
