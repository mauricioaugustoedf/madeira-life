import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Truck } from '../vehicles/Truck.js';
import { ZoneMarker } from './ZoneMarker.js';
import { PLANK_COLOR } from './PlankStack.js';

const S = { AWAY: 0, ARRIVING: 1, WAITING: 2, LEAVING: 3 };
const TRUCK_COLORS = [0x2f6fb3, 0xc0392b, 0x27ae60, 0x8e44ad, 0xe67e22, 0x16a085];

// Doca de entrega: o caminhão do cliente chega pela estrada, espera a carga,
// vai embora quando o pedido fica completo e paga.
export class DeliveryDock {
  // orders = OrderSlot desta vaga; bay = { x } (posição da vaga ao longo da cerca); index = nº da vaga
  constructor(scene, orders, bay = { x: CONFIG.dock.zone.x }, index = 0) {
    this.D = CONFIG.dock;
    this.orders = orders;
    this.index = index;
    this.park = { x: bay.x, z: this.D.parkZ };
    this.zoneRect = { ...this.D.zone, x: bay.x };
    this.truck = new Truck(scene);
    this.truck.group.rotation.y = Math.PI; // anda para -X
    this.truck.group.position.set(this.D.enterX, 0, this.D.laneZ);
    this.truck.group.visible = false;
    this.state = S.AWAY;
    this.timer = 1.5 + index * 3;
    this.speed = 0;
    this.onPaid = null;
    this.open = true;            // vaga liberada?

    this.zone = new ZoneMarker(scene, this.zoneRect);
    // Seta apontando para o caminhão
    const arrow = new THREE.Shape();
    arrow.moveTo(-0.22, -0.35); arrow.lineTo(0.22, -0.35); arrow.lineTo(0.22, 0.05);
    arrow.lineTo(0.42, 0.05); arrow.lineTo(0, 0.45); arrow.lineTo(-0.42, 0.05); arrow.lineTo(-0.22, 0.05);
    this.zone.addIcon(arrow, Math.PI);
    this._pos = new THREE.Vector3();
  }

  // Pedido de um produto que você ainda não faz (save antigo): troca por outro, se nada foi entregue
  checkOrder() {
    const o = this.orders.current;
    if (!o || o.delivered > 0 || this.orders.orders.valid(o.product)) return;
    if (this.state !== S.WAITING && this.state !== S.ARRIVING) return;
    const n = this.orders.next();
    this.truck.setCargo(0);
    this.truck.setCargoColor((CONFIG.products[n.product] || {}).color || PLANK_COLOR);
    if (n.color) this.truck.setColor(n.color);
  }

  // O toque (no chão) acertou este caminhão? Inclui a área "atrás" dele, onde o toque no teto cai
  hit(x, z) {
    if (!this.open || (this.state !== S.WAITING && this.state !== S.ARRIVING)) return false;
    const g = this.truck.group, s = g.scale.x;
    return Math.abs(x - g.position.x) < 2.6 * s && z > g.position.z - 2.8 && z < g.position.z + 1.3;
  }

  // Dispensa o cliente: vai embora sem pagar (o que já estava na carroceria se perde) e vem outro
  giveUp() {
    this.orders.current = null;
    this.truck.setCargo(0);
    this.state = S.LEAVING;
    this.timer = 0.4;
    this.gaveUp = 3;   // segundos mostrando o aviso
  }

  setOpen(v) {
    this.open = v;
    this.zone.group.visible = v;
    if (!v) { this.truck.group.visible = false; this.state = S.AWAY; }
  }

  get waiting() { return this.state === S.WAITING; }
  get canReceive() { return this.state === S.WAITING && this.orders.remaining > 0; }
  // Produto pedido pelo cliente que está chegando ou esperando (null se não há cliente)
  get wantedProduct() {
    if ((this.state === S.WAITING || this.state === S.ARRIVING) && this.orders.remaining > 0) return this.orders.current.product;
    return null;
  }
  accepts(product) { return this.canReceive && this.orders.current.product === product; }
  get statusText() {
    if (this.state === S.AWAY) return 'Próximo cliente a caminho…';
    if (this.state === S.ARRIVING) return 'Caminhão chegando…';
    if (this.state === S.LEAVING) return this.gaveUp > 0 ? 'Cliente dispensado' : 'Pedido entregue!';
    return '';
  }

  // Ponto da carroceria onde a próxima tábua vai cair
  nextCargoPoint(out = new THREE.Vector3()) {
    const o = this.orders.current;
    return this.truck.cargoWorld(o ? o.delivered : 0, out);
  }

  // Recebe 1 tábua (a chamada vem quando a tábua "pousa" na carroceria)
  receive(product = 'plank') {
    if (!this.accepts(product)) return false;
    const done = this.orders.deliverOne();
    this.truck.setCargo(this.orders.current.delivered);
    if (done) {
      this.state = S.LEAVING;
      this.gaveUp = 0;
      this.timer = 0.8; // pequena pausa antes de sair
      if (this.onPaid) this.onPaid(this.orders.current, this.truck.group.getWorldPosition(this._pos));
    }
    return true;
  }

  update(dt, time, playerInZone) {
    const D = this.D, g = this.truck.group;
    this.zone.setActive(playerInZone && this.canReceive, time);

    if (!this.open) return;
    if (this.state === S.AWAY) {
      this.timer -= dt;
      if (this.timer <= 0) {
        // Continua um pedido salvo pela metade; senão, cliente novo
        const o = this.orders.current;
        if (!o || o.delivered >= o.qty || (o.delivered === 0 && !this.orders.orders.valid(o.product))) this.orders.next();
        const o2 = this.orders.current;
        this.truck.setCargo(o2.delivered);
        this.truck.setCargoColor((CONFIG.products[o2.product] || {}).color || PLANK_COLOR);
        this.truck.setColor(o2.color || TRUCK_COLORS[(this.orders.completed) % TRUCK_COLORS.length]);
        g.scale.setScalar(o2.qty <= 6 ? 0.82 : 1);   // pedido pequeno: caminhonete
        g.position.set(D.enterX, 0, D.laneZ);
        g.visible = true;
        this.state = S.ARRIVING;
        this.speed = D.truckSpeed;
      }
      return;
    }

    if (this.state === S.ARRIVING) {
      const dist = g.position.x - this.park.x;
      if (dist > 0.02) {
        // desacelera perto da vaga
        this.speed = Math.max(1.2, Math.min(D.truckSpeed, dist * 1.4));
        const step = Math.min(dist, this.speed * dt);
        g.position.x -= step;
        this.truck.roll(step);
      } else {
        // encosta na vaga (sai da faixa)
        g.position.x = this.park.x;
        g.position.z = Math.max(this.park.z, g.position.z - dt * 2.2);
        if (g.position.z <= this.park.z + 0.001) { this.state = S.WAITING; this.wait = 0; this._lastDel = this.orders.current ? this.orders.current.delivered : 0; }
      }
      return;
    }

    if (this.state === S.LEAVING) {
      if (this.gaveUp > 0) this.gaveUp -= dt;
      if (this.timer > 0) { this.timer -= dt; return; }
      if (g.position.z < D.laneZ) { g.position.z = Math.min(D.laneZ, g.position.z + dt * 2.2); this.speed = 1; return; }
      this.speed = Math.min(D.truckSpeed * 1.3, this.speed + 6 * dt);
      const step = this.speed * dt;
      g.position.x -= step;
      this.truck.roll(step);
      if (g.position.x < D.exitX) {
        this.state = S.AWAY;
        this.timer = CONFIG.orders.nextTruckDelay + this.index * 1.5;
        g.position.set(D.enterX, 0, D.laneZ);
        g.visible = false;
      }
      return;
    }
    // WAITING: motor ligado, caminhão balança levemente
    g.position.y = Math.abs(Math.sin(time * 18)) * 0.012;

  }
}
