// Piège posé : un collet de bois et de cordes (deux piquets, une branche cintrée, un nœud coulant), dans le style
// low poly du décor. Plein, une touffe de fourrure dépasse du nœud (grise pour un lapin, rousse pour un renard).
// Ne contient aucune règle de jeu (position, état et proie sont dans src/regles/pieges.ts).
// Repère du modèle : posé sur le sol (y = 0).

import * as THREE from 'three';
import { CONFIG } from '../config';
import type { Proie } from '../regles/pieges';
import { boite, creerMateriau, galet, maille } from './outils';

export interface ModelePiege {
  readonly objet: THREE.Group;
  /** Place le piège au sol. */
  placer(x: number, y: number, z: number, rotation?: number): void;
  /** Montre la touffe de fourrure de la proie prise, ou la cache (`null` : piège vide). */
  definirPrise(proie: Proie | null): void;
  liberer(): void;
}

const COULEUR_BOIS = 0x8a5a2c;
const COULEUR_BOIS_SOMBRE = 0x5e3d1e;
const COULEUR_CORDE = 0xd9c58a;
const COULEUR_TERRE = 0x6b4a2c;
const COULEUR_FOURRURE: Readonly<Record<Proie, { claire: number; foncee: number }>> = {
  lapin: { claire: 0xe9e2d4, foncee: 0xa89a82 },
  renard: { claire: 0xf08a3a, foncee: 0xb8561c },
};

export function creerModelePiege(): ModelePiege {
  const objet = new THREE.Group();
  objet.name = 'piege';
  objet.scale.setScalar(CONFIG.pieges.echelleModele);
  const bois = creerMateriau(COULEUR_BOIS);
  const boisSombre = creerMateriau(COULEUR_BOIS_SOMBRE);
  const corde = creerMateriau(COULEUR_CORDE);
  const terre = creerMateriau(COULEUR_TERRE);
  const fourrureClaire = creerMateriau(COULEUR_FOURRURE.lapin.claire);
  const fourrureFoncee = creerMateriau(COULEUR_FOURRURE.lapin.foncee);

  // Plaque de terre foulée sous le collet
  objet.add(maille(galet(0.42, 0.035, 0.36, 1), terre, 0, 0.02, 0));
  // Deux piquets enfoncés de travers
  for (const [x, inclinaison] of [[-0.3, 0.12], [0.3, -0.12]] as const) {
    const piquet = maille(new THREE.CylinderGeometry(0.022, 0.034, 0.42, 5), bois, x, 0.2, 0);
    piquet.rotation.z = inclinaison;
    objet.add(piquet);
  }
  // Branche souple cintrée entre les piquets
  const arc = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.32, 0.36, 0),
    new THREE.Vector3(-0.16, 0.5, 0),
    new THREE.Vector3(0.06, 0.52, 0),
    new THREE.Vector3(0.26, 0.4, 0),
  ]);
  objet.add(maille(new THREE.TubeGeometry(arc, 6, 0.02, 4), boisSombre));
  // Nœud coulant : cercle de corde, tenu par une cordelette à la branche
  const noeud = maille(new THREE.TorusGeometry(0.17, 0.014, 4, 8), corde, 0, 0.09, 0.02);
  noeud.rotation.x = Math.PI / 2;
  objet.add(noeud);
  objet.add(boite(0.012, 0.4, 0.012, corde, 0.05, 0.3, 0.02));
  // Bâtonnet de déclenchement, posé en biais dans le nœud
  const declencheur = boite(0.3, 0.024, 0.024, boisSombre, -0.02, 0.07, -0.02);
  declencheur.rotation.y = 0.5;
  objet.add(declencheur);

  // Touffe de fourrure (visible seulement quand le piège est plein)
  const touffe = new THREE.Group();
  touffe.name = 'touffe';
  touffe.add(maille(galet(0.15, 0.1, 0.13, 1), fourrureClaire, 0.02, 0.17, 0.02));
  touffe.add(maille(galet(0.09, 0.08, 0.09, 0), fourrureFoncee, -0.09, 0.13, 0.08));
  touffe.add(maille(new THREE.ConeGeometry(0.045, 0.16, 4), fourrureClaire, 0.1, 0.3, 0.03));
  touffe.add(maille(new THREE.ConeGeometry(0.04, 0.14, 4), fourrureFoncee, -0.05, 0.3, -0.02));
  touffe.scale.setScalar(1.7);
  touffe.visible = false;
  objet.add(touffe);

  return {
    objet,
    placer(x, y, z, rotation = 0) {
      objet.position.set(x, y, z);
      objet.rotation.y = rotation;
    },
    definirPrise(proie) {
      touffe.visible = proie !== null;
      if (!proie) return;
      fourrureClaire.color.setHex(COULEUR_FOURRURE[proie].claire);
      fourrureFoncee.color.setHex(COULEUR_FOURRURE[proie].foncee);
    },
    liberer() {
      objet.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
    },
  };
}
