import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Visual "massinha / brinquedo": tudo liso, cantos arredondados, luz macia e um leve brilho
// nas bordas (como os ícones 3D de referência). Feito uma vez para todos os materiais Lambert.

// Trecho de shader que clareia as bordas viradas para longe da câmera (efeito de material fosco
// e macio). Fica antes do "opaque_fragment", onde a luz já foi somada.
export const CLAY_RIM = `
  {
    float clayF = 1.0 - clamp(dot(normalize(normal), geometryViewDir), 0.0, 1.0);
    clayF = clayF * clayF;
    outgoingLight = outgoingLight * (1.0 - 0.10 * clayF) + (diffuseColor.rgb * 0.55 + vec3(0.10, 0.09, 0.08)) * clayF * 0.42;
  }
  #include <opaque_fragment>`;

export function clayPatch(shader) {
  shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', CLAY_RIM);
}

// Todos os MeshLambertMaterial do jogo ganham o efeito (materiais com shader próprio chamam clayPatch)
THREE.MeshLambertMaterial.prototype.onBeforeCompile = function (shader) { clayPatch(shader); };

// Caixa com cantos arredondados (substitui BoxGeometry no jogo inteiro)
export function softBox(w = 1, h = 1, d = 1) {
  const m = Math.min(w, h, d);
  const r = Math.min(0.16, m * 0.3);
  if (r < 0.012) return new THREE.BoxGeometry(w, h, d);
  return new RoundedBoxGeometry(w, h, d, m > 0.5 ? 3 : m > 0.15 ? 2 : 1, r);
}
