import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { clayPatch } from '../core/Clay.js';

// Geometrias e materiais de árvore compartilhados entre a mata decorativa,
// a floresta produtiva e a animação de queda.
let cached = null;

export function getTreeAssets(timeUniform) {
  if (cached) return cached;
  const C = CONFIG.colors;

  const trunkGeo = new THREE.CylinderGeometry(0.17, 0.27, 1.4, 12);
  trunkGeo.translate(0, 0.7, 0);

  // Copa em 4 camadas, com degradê de cor (escura embaixo, clara na ponta) pintado nos vértices
  const tiers = [[1.2, 1.5, 0.75], [0.98, 1.35, 1.55], [0.74, 1.15, 2.3], [0.46, 0.95, 2.95]];
  // Cada camada é um "cone fofo": borda de baixo arredondada e ponta macia (estilo massinha)
  const cones = tiers.map(([r, h, y], i) => {
    const pts = [];
    const lip = Math.min(0.22, r * 0.22);
    pts.push(new THREE.Vector2(0.001, -h / 2 + lip * 0.4));
    pts.push(new THREE.Vector2(r * 0.7, -h / 2 + 0.02));
    for (let k = 0; k <= 2; k++) {                 // curva da borda
      const a = -Math.PI / 2 + (k / 2) * Math.PI * 0.75;
      pts.push(new THREE.Vector2(r - lip + Math.cos(a) * lip, -h / 2 + lip + Math.sin(a) * lip));
    }
    for (let k = 1; k <= 2; k++) {                 // lateral levemente estufada
      const t = k / 3;
      pts.push(new THREE.Vector2((r - lip * 0.6) * (1 - t) + Math.sin(t * Math.PI) * r * 0.06, -h / 2 + lip + t * (h - lip)));
    }
    pts.push(new THREE.Vector2(0.06, h / 2 - 0.02));
    pts.push(new THREE.Vector2(0.001, h / 2));
    const c = new THREE.LatheGeometry(pts, 11).toNonIndexed();
    c.rotateY(i * 0.4); c.translate(0, y, 0);
    return c;
  });
  const crownGeo = mergeGeometries(cones);
  {
    const pos = crownGeo.attributes.position, n = pos.count, col = new Float32Array(n * 3);
    const dark = new THREE.Color(0x6f8f6a), light = new THREE.Color(0xffffff), tmp = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const k = Math.min(1, Math.max(0, pos.getY(i) / 3.4));
      tmp.copy(dark).lerp(light, Math.pow(k, 0.8));
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
    crownGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }

  const stumpGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.35, 12);
  stumpGeo.translate(0, 0.175, 0);

  const logGeo = new THREE.CylinderGeometry(0.17, 0.17, 1.3, 12);
  logGeo.rotateZ(Math.PI / 2);

  const trunkMat = new THREE.MeshLambertMaterial({ color: C.trunk, flatShading: false });
  const stumpMat = new THREE.MeshLambertMaterial({ color: 0xc89a62, flatShading: false });

  // Copa com balanço ao vento calculado na GPU (custo quase zero)
  // fade: usa o atributo por instância aFade (1 = sólido) com transparência pontilhada,
  // que não exige ordenação e é barata no celular
  const makeCrownMat = (sway, fade = false) => {
    const m = new THREE.MeshLambertMaterial({ color: sway ? 0xffffff : C.pine, flatShading: false, vertexColors: true });
    if (!sway) return m;
    m.customProgramCacheKey = () => (fade ? 'crown-fade' : 'crown-sway');
    m.onBeforeCompile = (sh) => {
      clayPatch(sh);
      sh.uniforms.uTime = timeUniform;
      if (fade) {
        sh.vertexShader = 'attribute float aFade;\nvarying float vFade;\n' + sh.vertexShader.replace(
          '#include <begin_vertex>', '#include <begin_vertex>\n vFade = aFade;');
        sh.fragmentShader = 'varying float vFade;\n' + sh.fragmentShader.replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
          if (vFade < 0.99) {
            float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
            if (ign > vFade) discard;
          }`);
      }
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sway = sin(uTime * 1.7 + ip.x * 0.37 + ip.z * 0.23) * 0.05 * max(position.y, 0.0);
        transformed.x += sway;
        transformed.z += sway * 0.55;`
      );
    };
    return m;
  };

  cached = {
    trunkGeo, crownGeo, stumpGeo, logGeo,
    trunkMat, stumpMat,
    crownMat: makeCrownMat(true),
    crownMatStatic: makeCrownMat(false),
    crownMatFade: makeCrownMat(true, true),
    crownOffset: 1.1, // altura onde a copa começa (escala 1)
  };
  return cached;
}
