import { CONFIG } from '../config.js';

// Única moeda do jogo: dinheiro.
export class Economy {
  constructor() {
    this.money = CONFIG.economy.startMoney;
    this.totalEarned = 0;
    this.listeners = [];
  }

  onChange(fn) { this.listeners.push(fn); }

  earn(v) {
    this.money += v;
    this.totalEarned += v;
    for (const fn of this.listeners) fn(this.money, v);
  }

  // Modo teste: dinheiro infinito (compras não descontam)
  setInfinite(on) {
    this.infinite = on;
    for (const fn of this.listeners) fn(this.money, 0);
  }

  canAfford(v) { return this.infinite || this.money >= v; }

  spend(v) {
    if (this.infinite) return true;
    if (this.money < v) return false;
    this.money -= v;
    for (const fn of this.listeners) fn(this.money, -v);
    return true;
  }
}
