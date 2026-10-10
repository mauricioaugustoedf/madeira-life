// Painel do Parque de diversões: três joguinhos de habilidade valendo dinheiro.
// Você escolhe a aposta, paga para jogar e recebe a aposta multiplicada conforme o resultado.
const BETS = [10, 50, 100, 500, 1000, 5000];
const fmt = (v) => '$' + Math.round(v).toLocaleString('pt-BR');

const GAMES = {
  axe: { name: 'Machado no alvo', help: 'Toque em ARREMESSAR quando o machado passar pelo centro. Centro dourado paga 4x, verde 2x, amarelo devolve a aposta.' },
  cups: { name: 'Copinhos', help: 'Veja onde a bolinha está, acompanhe os copos se misturando e toque no copo certo. Acertou: 2,5x.' },
  timer: { name: 'Cronômetro', help: 'Pare o cronômetro em 5,00 segundos. Os números somem no meio! Até 0,05 de erro: 5x · até 0,15: 2x · até 0,35: devolve.' },
};

export class FunPanel {
  constructor(economy, { onResult } = {}) {
    this.economy = economy;
    this.onResult = onResult;
    this.net = 0;          // saldo acumulado no parque (ganhos − apostas)
    this.bet = 10;
    this.game = 'axe';
    this.state = 'idle';   // idle | running | choose | done
    this.el = document.getElementById('park');
    this.area = document.getElementById('pk-area');
    this.msg = document.getElementById('pk-msg');
    this.btn = document.getElementById('pk-play');
    this.moneyEl = document.getElementById('pk-money');
    this.netEl = document.getElementById('pk-net');
    this.helpEl = document.getElementById('pk-help');
    this.betsEl = document.getElementById('pk-bets');
    this.tabsEl = document.getElementById('pk-tabs');
    for (const id of ['pk-close', 'pk-close2']) document.getElementById(id).addEventListener('click', () => this.close());
    this.btn.addEventListener('click', () => this._press());
    for (const [k, g] of Object.entries(GAMES)) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'wr-tab'; b.textContent = g.name; b.dataset.g = k;
      b.addEventListener('click', () => { if (this._playing()) return; this.game = k; this._setup(); });
      this.tabsEl.appendChild(b);
    }
    for (const v of BETS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pk-bet'; b.textContent = fmt(v); b.dataset.v = v;
      b.addEventListener('click', () => { if (this._playing()) return; this.bet = v; this._refresh(); });
      this.betsEl.appendChild(b);
    }
    economy.onChange(() => { if (!this.el.hidden) this._refresh(); });
  }

  open() { this.el.hidden = false; this._setup(); }
  close() {
    if (this._playing()) this._finish(0, 'Jogo cancelado.');   // aposta já paga fica no parque
    this._gen = (this._gen || 0) + 1;
    this.el.hidden = true; cancelAnimationFrame(this._raf);
  }

  _playing() { return this.state === 'running' || this.state === 'choose' || this.state === 'busy'; }

  _refresh() {
    this.moneyEl.textContent = this.economy.infinite ? '∞' : fmt(this.economy.money);
    this.netEl.textContent = (this.net >= 0 ? '+' : '−') + fmt(Math.abs(this.net));
    this.netEl.className = this.net >= 0 ? 'pos' : 'neg';
    for (const b of this.betsEl.children) {
      const v = +b.dataset.v;
      b.classList.toggle('on', v === this.bet);
      b.disabled = !this.economy.canAfford(v);
    }
    if (!this.economy.canAfford(this.bet)) {
      const ok = BETS.filter((v) => this.economy.canAfford(v));
      if (ok.length) this.bet = ok[ok.length - 1];
    }
    for (const b of this.tabsEl.children) b.classList.toggle('on', b.dataset.g === this.game);
    if (this.state === 'idle' || this.state === 'done') {
      const can = this.economy.canAfford(this.bet);
      this.btn.disabled = !can;
      this.btn.textContent = can ? `JOGAR (${fmt(this.bet)})` : 'Sem dinheiro para apostar';
    }
  }

  // Monta a área do jogo escolhido
  _setup() {
    cancelAnimationFrame(this._raf);
    this._gen = (this._gen || 0) + 1;
    this.state = 'idle';
    this.helpEl.textContent = GAMES[this.game].help;
    this.msg.textContent = '';
    this.msg.className = 'pk-msg';
    const a = this.area;
    a.innerHTML = '';
    a.className = 'pk-area pk-' + this.game;
    if (this.game === 'axe') {
      a.innerHTML = `<div class="pk-target"><i></i><i></i><i></i><i></i><b class="pk-hit" hidden></b></div>
        <div class="pk-track"><span class="z r"></span><span class="z y"></span><span class="z g"></span><span class="z o"></span><span class="z g"></span><span class="z y"></span><span class="z r"></span><em class="pk-marker"></em></div>`;
      this.pos = 0.08; this._axeMarker();
    } else if (this.game === 'cups') {
      a.innerHTML = '<div class="pk-table"></div>';
      const t = a.firstChild;
      this.cups = [];
      for (let i = 0; i < 3; i++) {
        const c = document.createElement('button');
        c.type = 'button'; c.className = 'pk-cup'; c.dataset.i = i;
        c.addEventListener('click', () => this._pickCup(i));
        t.appendChild(c);
        this.cups.push({ el: c, slot: i });
      }
      this.ballEl = document.createElement('span'); this.ballEl.className = 'pk-ball'; t.appendChild(this.ballEl);
      this.ballCup = 1;
      this._placeCups(true);
    } else {
      a.innerHTML = '<div class="pk-clock">0,00</div><div class="pk-goal">Alvo: 5,00 s</div>';
      this.clockEl = a.querySelector('.pk-clock');
    }
    this._refresh();
  }

  _press() {
    if (this.state === 'idle' || this.state === 'done') {
      if (this.state === 'done') this._setup();
      if (!this.economy.spend(this.bet)) return;
      this.net -= this.bet;
      this.paid = this.bet;
      this.msg.textContent = '';
      this._start();
      this._refresh();
    } else if (this.state === 'running') {
      if (this.game === 'axe') this._throwAxe();
      else if (this.game === 'timer') this._stopTimer();
    }
  }

  _finish(mult, text) {
    cancelAnimationFrame(this._raf);
    this.state = 'done';
    const win = Math.round(this.paid * mult);
    if (win > 0) { this.economy.earn(win); this.net += win; }
    const profit = win - this.paid;
    this.msg.textContent = text + (mult > 0 ? `  ${mult.toString().replace('.', ',')}x → ${fmt(win)}` : '');
    this.msg.className = 'pk-msg ' + (profit > 0 ? 'win' : profit === 0 ? 'even' : 'lose');
    if (this.onResult) this.onResult(profit, win);
    this._refresh();
    this.btn.textContent = this.economy.canAfford(this.bet) ? `JOGAR DE NOVO (${fmt(this.bet)})` : 'Sem dinheiro para apostar';
  }

  _start() {
    if (this.game === 'axe') {
      this.state = 'running';
      this.btn.textContent = 'ARREMESSAR!';
      this.area.querySelector('.pk-hit').hidden = true;
      this.dir = 1; this.speed = 1.25 + Math.random() * 0.35;
      let last = performance.now();
      const step = (t) => {
        const dt = Math.min(0.05, (t - last) / 1000); last = t;
        this.pos += this.dir * this.speed * dt;
        if (this.pos > 1) { this.pos = 2 - this.pos; this.dir = -1; }
        if (this.pos < 0) { this.pos = -this.pos; this.dir = 1; }
        this._axeMarker();
        this._raf = requestAnimationFrame(step);
      };
      this._raf = requestAnimationFrame(step);
    } else if (this.game === 'cups') {
      this.state = 'busy';
      this.btn.disabled = true; this.btn.textContent = 'Olhe a bolinha…';
      this.ballCup = Math.floor(Math.random() * 3);
      this._lift(this.ballCup, true);
      const gen = this._gen;
      setTimeout(() => { if (gen !== this._gen) return; this._lift(this.ballCup, false); setTimeout(() => gen === this._gen && this._shuffle(7 + Math.floor(this.paid / 1000)), 450); }, 1100);
    } else {
      this.state = 'running';
      this.btn.textContent = 'PARAR!';
      this.t0 = performance.now();
      const step = (t) => {
        const s = (t - this.t0) / 1000;
        this.clockEl.textContent = s < 2 ? s.toFixed(2).replace('.', ',') : '?,??';
        this.clockEl.classList.toggle('hide', s >= 2);
        if (s > 12) { this._finish(0, 'Passou muito do tempo!'); return; }
        this._raf = requestAnimationFrame(step);
      };
      this._raf = requestAnimationFrame(step);
    }
  }

  // ---- Machado ----
  _axeMarker() {
    const m = this.area.querySelector('.pk-marker');
    if (m) m.style.left = (this.pos * 100) + '%';
  }
  _throwAxe() {
    const d = Math.abs(this.pos - 0.5);   // 0 = centro
    // faixas: dourado ±3%, verde ±13%, amarelo ±25%
    const [mult, text] = d <= 0.03 ? [4, 'No centro!'] : d <= 0.13 ? [2, 'Muito bom!'] : d <= 0.25 ? [1, 'Na trave…'] : [0, 'Errou o alvo.'];
    const hit = this.area.querySelector('.pk-hit');
    const ang = Math.random() * Math.PI * 2, r = Math.min(1, d / 0.5) * 46;
    hit.style.left = (50 + Math.cos(ang) * r) + '%'; hit.style.top = (50 + Math.sin(ang) * r) + '%';
    hit.hidden = false;
    this._finish(mult, text);
  }

  // ---- Copinhos ----
  _placeCups(instant) {
    for (const c of this.cups) {
      c.el.style.transition = instant ? 'none' : '';
      c.el.style.left = `calc(${c.slot * 33.33 + 16.66}% - 34px)`;
    }
    const b = this.cups[this.ballCup];
    if (b) this.ballEl.style.left = `calc(${b.slot * 33.33 + 16.66}% - 9px)`;
  }
  _lift(i, up) {
    const c = this.cups[i];
    this._placeCups(false);
    this.ballEl.style.opacity = up ? '1' : '0';
    c.el.classList.toggle('up', up);
  }
  _shuffle(n) {
    const speed = Math.max(170, 330 - Math.min(150, this.paid / 30));   // aposta alta: mais rápido
    for (const c of this.cups) c.el.style.transitionDuration = speed + 'ms';
    let k = 0;
    const gen = this._gen;
    const swap = () => {
      if (gen !== this._gen) return;
      if (k++ >= n) {
        this.state = 'choose';
        this.btn.textContent = 'Toque no copo com a bolinha';
        return;
      }
      const a = Math.floor(Math.random() * 3); let b = Math.floor(Math.random() * 2); if (b >= a) b++;
      const ca = this.cups.find((c) => c.slot === a), cb = this.cups.find((c) => c.slot === b);
      ca.slot = b; cb.slot = a;
      this._placeCups(false);
      setTimeout(swap, speed + 40);
    };
    swap();
  }
  _pickCup(i) {
    if (this.state !== 'choose') return;
    const right = i === this.ballCup;
    this._lift(this.ballCup, true);
    if (!right) this.cups[i].el.classList.add('up');
    this._finish(right ? 2.5 : 0, right ? 'Achou a bolinha!' : 'Não era esse…');
  }

  // ---- Cronômetro ----
  _stopTimer() {
    const s = (performance.now() - this.t0) / 1000;
    this.clockEl.textContent = s.toFixed(2).replace('.', ',');
    this.clockEl.classList.remove('hide');
    const e = Math.abs(s - 5);
    const [mult, text] = e <= 0.05 ? [5, 'Perfeito!'] : e <= 0.15 ? [2, 'Quase exato!'] : e <= 0.35 ? [1, 'Pertinho.'] : [0, e < 1 ? 'Passou longe.' : 'Muito longe.'];
    this._finish(mult, text);
  }

  toJSON() { return { net: this.net }; }
  load(d) { if (d && typeof d.net === 'number') this.net = d.net; }
}
