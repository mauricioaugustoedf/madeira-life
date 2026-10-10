import { CONFIG } from '../config.js';

// Produção enquanto o jogo esteve fechado: conta de taxas, não simulação física.
// Só conta o que é automático (funcionários contratados). O que depende de você fica parado.
export function simulateOffline(seconds, s) {
  const O = CONFIG.offline;
  const sec = Math.min(seconds, O.maxHours * 3600);
  const out = { seconds, counted: sec, capped: seconds > sec, treesCut: 0, planted: 0, stumpsFinal: 0, replantedRecently: 0, logsCut: 0, hauled: 0, logsSawn: 0, planksMade: 0, deliverable: 0, deliverCap: 0, kilnPotential: 0, dryMade: 0, delivered: 0, deliveredDry: 0, orders: 0, money: 0 };

  // Lenhadores: limitados pelo próprio ritmo e pelas árvores em pé. Sem plantador,
  // os tocos ficam tocos: só dá para cortar o que já existia (adultas + mudas crescendo).
  let cutPotential = 0;
  const plantRate = s.planters > 0 ? s.planters / O.secondsPerTreePerPlanter : 0;
  if (s.lumberjacks > 0) {
    const ljRate = s.lumberjacks / O.secondsPerTreePerLumberjack;
    const standing = s.matureTrees + s.growingTrees;
    const regrowRate = Math.min(plantRate, s.treeCount / s.growSeconds);
    const byForest = standing + regrowRate * Math.max(0, sec - s.growSeconds);
    cutPotential = Math.floor(Math.min(ljRate * sec, byForest)) * s.logsPerTree;
  }
  // Carregadores: levam do chão ao pátio (toras que já estavam + as cortadas)
  const haulPotential = s.haulers > 0 ? Math.floor((s.haulers * s.haulCapacity / O.secondsPerTripPerHauler) * sec) : 0;
  let hauled = Math.min(haulPotential, s.groundLogs + cutPotential);
  // O chão comporta no máximo maxGround toras: os lenhadores param quando enche
  let logsCut = Math.min(cutPotential, s.maxGround - s.groundLogs + hauled);
  logsCut = Math.max(0, Math.floor(logsCut / s.logsPerTree) * s.logsPerTree);
  hauled = Math.min(hauled, s.groundLogs + logsCut);
  out.logsCut = logsCut;
  out.treesCut = logsCut / s.logsPerTree;
  out.hauled = hauled;
  // Mineiros: pedras levadas ao estoque (as rochas voltam a crescer sozinhas)
  out.stoneMined = s.miners > 0 ? Math.max(0, Math.min(s.stoneSpace, Math.floor(s.miners * s.minerCapacity / O.secondsPerTripPerMiner * sec))) : 0;
  // Plantadores: replantam os tocos que havia e os que foram surgindo
  out.planted = Math.floor(Math.min(plantRate * sec, s.stumps + out.treesCut));
  out.stumpsFinal = s.stumps + out.treesCut - out.planted;
  // Árvores replantadas no fim do período ainda são mudas (as antigas já cresceram)
  out.replantedRecently = Math.min(out.planted, out.treesCut, Math.floor(plantRate * s.growSeconds));

  // Entregadores: capacidade de levar tábuas aos caminhões nesse tempo
  const deliverPotential = Math.floor(((s.deliverers > 0 ? s.deliverers * s.deliverCapacity / O.secondsPerTripPerDeliverer : 0) + (s.forkliftRate || 0)) * sec);

  // Operador: serra as toras do pátio (inclusive as que chegaram); o depósito
  // só enche se ninguém estiver entregando
  const yardAvail = s.yardStock + hauled;
  if (s.operator && yardAvail > 0) {
    const byTime = Math.floor(sec / s.cycleSeconds);
    const kilnDrain = s.kilnFeeder ? Math.floor(s.kilnBatch / s.kilnSeconds * sec) : 0;
    const bySpace = Math.floor((s.plankSpace + deliverPotential + kilnDrain) / s.planksPerLog);
    out.logsSawn = Math.max(0, Math.min(byTime, yardAvail, bySpace));
    out.planksMade = out.logsSawn * s.planksPerLog;
  }
  // Estufa: quantas tábuas dá para secar (abastecedor e estufa trabalhando juntos)
  out.kilnPotential = s.kilnFeeder
    ? Math.floor(Math.min(s.kilnFeeder * s.feederCapacity / O.secondsPerTripPerFeeder, s.kilnBatch / s.kilnSeconds) * sec)
    : 0;
  // Capacidade de entrega (o main.js passa isso pelos pedidos reais e calcula o dinheiro)
  out.deliverCap = deliverPotential;
  out.deliverable = Math.min(deliverPotential, s.plankStock + out.planksMade);
  out.truckBudget = sec;
  return out;
}

export function formatDuration(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  if (m > 0) return `${m}min`;
  return `${Math.floor(sec)}s`;
}
