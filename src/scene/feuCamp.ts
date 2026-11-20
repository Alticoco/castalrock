// Feu de camp posé par le joueur : cercle de pierres, bûches, braises, trois langues de flammes qui
// dansent et une lumière chaude qui s'intensifie la nuit. Même allure que le feu du village
// (src/scene/modelesVillage.ts), en plus petit. Aucune règle de jeu ici.
// La lumière du feu est créée une fois pour toutes (creerLumiereFeuCamp), à intensité nulle tant qu'il n'y a pas
// de feu : changer le nombre de lumières de la scène recompilerait tous les shaders (saccade au moment de la pose).

import * as THREE from 'three';
import { CONFIG } from '../config';

export interface ModeleFeuCamp {
  readonly objet: THREE.Group;
  /** Pose le feu au sol en (x, y, z). */
  placer(x: number, y: number, z: number): void;
  /** Anime les flammes et la lumière ; `nuit` va de 0 (plein jour) à 1 (nuit). */
  mettreAJour(dt: number, nuit: number): void;
  liberer(): void;
}

const COULEURS = {
  pierre: 0x9a9299,
  bois: 0x74432a,
  braise: 0xff7a1e,
  feuVif: 0xffc93c,
  feuRouge: 0xff5a1e,
  lueur: 0xffb347,
} as const;

/** Lumière du feu de camp, toujours présente dans la scène (éteinte : intensité 0). L'appelant l'ajoute à la scène. */
export function creerLumiereFeuCamp(): THREE.PointLight {
  const lumiere = new THREE.PointLight(COULEURS.lueur, 0, 14, 2);
  lumiere.name = 'lumiere-feu-camp';
  return lumiere;
}

/** `lumiere` : la lumière partagée de creerLumiereFeuCamp, que le modèle place et anime tant qu'il existe. */
export function creerFeuCamp(lumiere: THREE.PointLight): ModeleFeuCamp {
  const E = CONFIG.campement.echelleFeu;
  const V = CONFIG.village;
  const objet = new THREE.Group();
  objet.name = 'feu-camp-pose';
  objet.scale.setScalar(E);

  const geoPierre = new THREE.IcosahedronGeometry(0.2, 0);
  const geoBuche = new THREE.BoxGeometry(0.95, 0.14, 0.14);
  const geoBraise = new THREE.CylinderGeometry(0.3, 0.36, 0.08, 7);
  const geoFlamme = new THREE.ConeGeometry(0.22, 0.75, 5, 1).translate(0, 0.375, 0);
  const matPierre = new THREE.MeshLambertMaterial({ color: COULEURS.pierre, flatShading: true });
  const matBois = new THREE.MeshLambertMaterial({ color: COULEURS.bois, flatShading: true });
  const matBraise = new THREE.MeshBasicMaterial({ color: COULEURS.braise });
  const matFlammes = [COULEURS.feuRouge, COULEURS.braise, COULEURS.feuVif].map((c) => new THREE.MeshBasicMaterial({ color: c }));

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pierre = new THREE.Mesh(geoPierre, matPierre);
    pierre.position.set(Math.sin(a) * 0.58, 0.1, Math.cos(a) * 0.58);
    pierre.rotation.y = a;
    pierre.castShadow = true;
    objet.add(pierre);
  }
  for (const a of [0.3, 1.4, 2.5]) {
    const buche = new THREE.Mesh(geoBuche, matBois);
    buche.position.set(0, 0.12, 0);
    buche.rotation.set(0, a, 0.12);
    buche.castShadow = true;
    objet.add(buche);
  }
  const braises = new THREE.Mesh(geoBraise, matBraise);
  braises.position.y = 0.06;
  objet.add(braises);

  // Trois langues de feu : rouge large, orange, cœur jaune (mêmes proportions que le feu du village)
  const flammes = new THREE.Group();
  flammes.position.y = 0.1;
  const langues: ReadonlyArray<readonly [number, number, number, number]> = [
    [0, 0, 1.25, 1.0],
    [0.1, 0.06, 0.95, 1.25],
    [-0.05, -0.04, 0.6, 0.9],
  ];
  langues.forEach(([dx, dz, largeur, hauteur], i) => {
    const langue = new THREE.Mesh(geoFlamme, matFlammes[i]);
    langue.position.set(dx, 0, dz);
    langue.scale.set(largeur, hauteur, largeur);
    langue.userData.hauteur = hauteur;
    flammes.add(langue);
  });
  objet.add(flammes);

  // La lumière (hors du groupe) n'est pas réduite par l'échelle : seule son intensité est plus faible
  const hauteurLumiere = 1.0 * E;

  let temps = 0;
  return {
    objet,
    placer(x, y, z) {
      objet.position.set(x, y, z);
      lumiere.position.set(x, y + hauteurLumiere, z);
    },
    mettreAJour(dt, nuit) {
      temps += dt;
      const n = Math.min(1, Math.max(0, nuit));
      flammes.children.forEach((langue, i) => {
        const t = temps * (7 + i * 2.3) + i;
        langue.scale.y = (langue.userData.hauteur as number) * (1 + 0.22 * Math.sin(t) + 0.1 * Math.sin(t * 2.7));
        langue.rotation.y = temps * (1.5 + i);
      });
      const base = (V.lumiereFeuJour + (V.lumiereFeuNuit - V.lumiereFeuJour) * n) * CONFIG.campement.partLumiereFeu;
      lumiere.intensity = base * (0.9 + 0.07 * Math.sin(temps * 9) + 0.05 * Math.sin(temps * 23));
    },
    liberer() {
      lumiere.intensity = 0;
      for (const g of [geoPierre, geoBuche, geoBraise, geoFlamme]) g.dispose();
      for (const m of [matPierre, matBois, matBraise, ...matFlammes]) m.dispose();
    },
  };
}
