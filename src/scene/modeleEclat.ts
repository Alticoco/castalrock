// L'Éclat du Cœur : le morceau du Cœur de Castal que porte Morvan. Un éclat de cristal bleu à facettes, pointu d'un
// côté et cassé net de l'autre (là où il tenait au cristal géant), avec une lueur douce qui pulse.
// Fait en code, aux couleurs du Cœur (src/scene/modelesLieux.ts). Aucune lumière : matière lumineuse, coque et halo
// en couleur additive. Ne contient aucune règle de jeu.
// Repère du modèle : `auSol` : couché sur le sol (y = 0) ; sinon centré sur l'origine, la pointe vers +y.

import * as THREE from 'three';
import { CONFIG } from '../config';

export interface ModeleEclat {
  readonly objet: THREE.Group;
  /** Fait pulser la lueur. */
  mettreAJour(dt: number): void;
  liberer(): void;
}

export interface OptionsEclat {
  /** Longueur de l'éclat, en mètres (0,5 par défaut) */
  longueur?: number;
  /** Couché au sol, avec un halo par terre et un mince filet de lumière pour le repérer de loin (faux par défaut) */
  auSol?: boolean;
}

// Bleu profond des facettes à l'ombre et blanc bleuté des petites facettes claires (les autres couleurs sont celles du Cœur)
const COULEUR_PROFONDE = 0x1450c4;
const COULEUR_FACETTE = 0xc9f2ff;
// Rythme de la pulsation (rad/s)
const VITESSE_PULSATION = 2.2;

/** Valeur fixe entre 0 et 1 pour un indice (pas d'aléatoire : l'éclat est toujours le même). */
function variation(i: number): number {
  const v = Math.sin(i * 12.9898 + 4.1) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Géométries de l'éclat pour une longueur de 1 (pied de la cassure vers y = 0, pointe en y = 1) : le corps à facettes
 * (une couleur par facette, la cassure plus pâle) et quelques petites facettes claires posées dessus.
 */
function geometriesEclat(): { corps: THREE.BufferGeometry; facettes: THREE.BufferGeometry } {
  const K = CONFIG.lieux.couleurs;
  // Trois anneaux de cinq sommets, irréguliers et aplatis (l'éclat tient couché), puis la pointe, déportée
  const P: THREE.Vector3[] = [];
  const anneau = (y: number, r: number, decalage: number, dx: number, penche: number): number => {
    const debut = P.length;
    for (let k = 0; k < 5; k++) {
      const a = ((k + decalage) * Math.PI * 2) / 5;
      const rr = r * (0.8 + 0.4 * variation(debut + k));
      // `penche` : l'anneau est incliné (la cassure est en biais)
      P.push(new THREE.Vector3(Math.sin(a) * rr + dx, y + penche * Math.sin(a) * rr, Math.cos(a) * rr * 0.62));
    }
    return debut;
  };
  const A = anneau(0.1, 0.22, 0, 0.02, 0.7);
  const B = anneau(0.36, 0.27, 0.35, 0, 0.15);
  const C = anneau(0.72, 0.15, 0.8, -0.04, -0.2);
  const pointe = P.push(new THREE.Vector3(-0.09, 1, 0.01)) - 1;
  // Le milieu de la cassure, dans le plan de l'anneau du pied : une coupe nette, en biais
  const fond = P.push(new THREE.Vector3(0.02, 0.1, 0)) - 1;

  const triangles: Array<[number, number, number]> = [];
  const cassure = new Set<number>();
  for (let k = 0; k < 5; k++) {
    const k1 = (k + 1) % 5;
    cassure.add(triangles.push([fond, A + k, A + k1]) - 1);
    triangles.push([A + k, A + k1, B + k1], [A + k, B + k1, B + k], [B + k, B + k1, C + k], [C + k, B + k1, C + k1], [C + k, C + k1, pointe]);
  }

  const centre = new THREE.Vector3(0, 0.45, 0);
  const n = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const g = new THREE.Vector3();
  const profonde = new THREE.Color(COULEUR_PROFONDE);
  const vive = new THREE.Color(K.cristal);
  const claire = new THREE.Color(K.cristalClair);
  const pale = new THREE.Color(K.cristalCassure).lerp(new THREE.Color(COULEUR_FACETTE), 0.6);
  const couleur = new THREE.Color();
  const positions: number[] = [];
  const couleurs: number[] = [];
  const claires: number[] = [];
  // Facettes du corps qui reçoivent une petite facette claire (indices dans `triangles`)
  const AVEC_FACETTE = new Set([2, 9, 16, 22, 27]);
  triangles.forEach((t, i) => {
    const [a, b, c] = [P[t[0]], P[t[1]], P[t[2]]];
    n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a)).normalize();
    g.copy(a).add(b).add(c).divideScalar(3);
    // Toutes les faces regardent vers l'extérieur ; celles de la cassure, vers le pied
    const dehors = cassure.has(i) ? n.y < 0 : n.dot(ab.subVectors(g, centre)) > 0;
    const ordre = dehors ? [a, b, c] : [a, c, b];
    if (!dehors) n.negate();
    // Une teinte par facette, du bleu profond au bleu clair ; la cassure est pâle
    if (cassure.has(i)) couleur.copy(pale).lerp(vive, 0.2 * variation(i + 40));
    else {
      const v = variation(i + 7);
      if (v < 0.5) couleur.copy(profonde).lerp(vive, v * 2);
      else couleur.copy(vive).lerp(claire, (v - 0.5) * 1.5);
    }
    for (const p of ordre) {
      positions.push(p.x, p.y, p.z);
      couleurs.push(couleur.r, couleur.g, couleur.b);
    }
    if (!AVEC_FACETTE.has(i)) return;
    // Petite facette claire : le triangle rétréci autour de son milieu, à peine décollé de la face
    for (const p of ordre) {
      const q = p.clone().lerp(g, 0.52 + 0.2 * variation(i + 90)).addScaledVector(n, 0.006);
      claires.push(q.x, q.y, q.z);
    }
  });
  const corps = new THREE.BufferGeometry();
  corps.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  corps.setAttribute('color', new THREE.Float32BufferAttribute(couleurs, 3));
  corps.computeVertexNormals();
  const facettes = new THREE.BufferGeometry();
  facettes.setAttribute('position', new THREE.Float32BufferAttribute(claires, 3));
  return { corps, facettes };
}

/** Disque ou tube dont la couleur s'éteint vers le bord (ou vers le haut) : en additif, le noir ne se voit pas. */
function degrade(geometrie: THREE.BufferGeometry, force: (x: number, y: number, z: number) => number): THREE.BufferGeometry {
  const pos = geometrie.attributes.position;
  const teintes: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const f = Math.max(0, Math.min(1, force(pos.getX(i), pos.getY(i), pos.getZ(i))));
    teintes.push(f, f, f);
  }
  geometrie.setAttribute('color', new THREE.Float32BufferAttribute(teintes, 3));
  return geometrie;
}

export function creerModeleEclat(options: OptionsEclat = {}): ModeleEclat {
  const { longueur = 0.5, auSol = false } = options;
  const K = CONFIG.lieux.couleurs;
  const objet = new THREE.Group();
  objet.name = 'eclat-coeur';

  const geo = geometriesEclat();
  const matCorps = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    flatShading: true,
    roughness: 0.3,
    metalness: 0,
    emissive: K.cristal,
    emissiveIntensity: 0.3,
  });
  const matFacettes = new THREE.MeshBasicMaterial({ color: COULEUR_FACETTE });
  const additif = (cote: THREE.Side, sommets = false) =>
    new THREE.MeshBasicMaterial({ color: K.cristal, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: cote, vertexColors: sommets });
  // Aura : la même forme un peu plus large, vue de l'intérieur (comme celle du Cœur)
  const matAura = additif(THREE.BackSide);

  const cristal = new THREE.Group();
  const corps = new THREE.Mesh(geo.corps, matCorps);
  corps.castShadow = true;
  const aura = new THREE.Mesh(geo.corps, matAura);
  aura.scale.set(1.3, 1.08, 1.45);
  aura.position.y = -0.04;
  cristal.add(corps, new THREE.Mesh(geo.facettes, matFacettes), aura);
  cristal.scale.setScalar(longueur);
  objet.add(cristal);

  const aLiberer: Array<THREE.BufferGeometry | THREE.Material> = [geo.corps, geo.facettes, matCorps, matFacettes, matAura];
  let matHalo: THREE.MeshBasicMaterial | null = null;
  if (auSol) {
    // Couché sur le flanc, la pointe un peu relevée
    cristal.rotation.set(0.25, 0.6, -1.18);
    cristal.position.set(-0.4 * longueur, 0.2 * longueur, 0);
    // Halo par terre et mince filet de lumière vers le haut : ils s'éteignent vers le bord et vers le sommet
    matHalo = additif(THREE.DoubleSide, true);
    const rayonHalo = 2.2 * longueur;
    const geoHalo = degrade(new THREE.CircleGeometry(rayonHalo, 16).rotateX(-Math.PI / 2), (x, _y, z) => 1 - Math.hypot(x, z) / rayonHalo);
    const halo = new THREE.Mesh(geoHalo, matHalo);
    halo.position.y = 0.03;
    const hauteurFilet = 5 * longueur;
    const geoFilet = degrade(new THREE.CylinderGeometry(0.05 * longueur, 0.16 * longueur, hauteurFilet, 6, 1, true).translate(0, hauteurFilet / 2, 0), (_x, y) => 0.3 * (1 - y / hauteurFilet));
    const filet = new THREE.Mesh(geoFilet, matHalo);
    objet.add(halo, filet);
    aLiberer.push(geoHalo, geoFilet, matHalo);
  } else {
    cristal.position.y = -0.5 * longueur;
  }

  let temps = 0;
  function appliquer(): void {
    const battement = 0.5 + 0.5 * Math.sin(temps * VITESSE_PULSATION);
    matCorps.emissiveIntensity = 0.22 + 0.3 * battement;
    matAura.opacity = 0.1 + 0.12 * battement;
    if (matHalo) matHalo.opacity = 0.14 + 0.12 * battement;
  }
  appliquer();

  return {
    objet,
    mettreAJour(dt) {
      temps += dt;
      appliquer();
    },
    liberer() {
      for (const r of aLiberer) r.dispose();
    },
  };
}
