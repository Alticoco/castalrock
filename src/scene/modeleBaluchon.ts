// Baluchon laissé à l'endroit de la mort : petit sac de toile noué, posé au sol, avec un rayon de lumière doux
// vers le ciel pour le repérer de loin. Fait en code, dans le style low poly du village.
// Ne contient aucune règle de jeu (position et contenu sont dans src/regles/mort.ts).
// Repère du modèle : posé sur le sol (y = 0).

import * as THREE from 'three';
import { CONFIG } from '../config';
import { boite, creerMateriau, galet, maille } from './outils';

export interface ModeleBaluchon {
  readonly objet: THREE.Group;
  /** Place le baluchon au sol. */
  placer(x: number, y: number, z: number): void;
  /** Anime le rayon (légère pulsation). */
  mettreAJour(dt: number): void;
  liberer(): void;
}

const COULEUR_TOILE = 0xc9ad62;
const COULEUR_TOILE_FONCEE = 0xa88f48;
const COULEUR_CORDE = 0x74432a;
const COULEUR_RAYON = 0xfff0b0;

export interface OptionsBaluchon {
  /** Taille par rapport au baluchon de la mort (1 par défaut) */
  echelle?: number;
  /** Rayon de lumière vers le ciel (vrai par défaut) ; faux pour un petit sac de butin */
  avecRayon?: boolean;
}

export function creerModeleBaluchon(options: OptionsBaluchon = {}): ModeleBaluchon {
  const { echelle = 1, avecRayon = true } = options;
  const objet = new THREE.Group();
  objet.name = 'baluchon';
  objet.scale.setScalar(echelle);
  const toile = creerMateriau(COULEUR_TOILE);
  const toileFoncee = creerMateriau(COULEUR_TOILE_FONCEE);
  const corde = creerMateriau(COULEUR_CORDE);

  // Corps du sac (bloc facetté un peu aplati) et col noué
  const corps = maille(galet(0.34, 0.3, 0.32, 1), toile, 0, 0.28, 0);
  const col = maille(new THREE.CylinderGeometry(0.1, 0.17, 0.16, 6), toileFoncee, 0, 0.55, 0);
  const noeud = maille(new THREE.TorusGeometry(0.13, 0.03, 4, 8), corde, 0, 0.5, 0);
  noeud.rotation.x = Math.PI / 2;
  const pointe = maille(new THREE.ConeGeometry(0.1, 0.2, 5), toileFoncee, 0.02, 0.72, 0);
  pointe.rotation.z = 0.25;
  // Un bâton de marche en travers, pour dire « affaires de voyageur »
  const baton = boite(0.04, 0.04, 0.8, corde, 0.18, 0.1, 0.05);
  baton.rotation.y = 0.5;
  objet.add(corps, col, noeud, pointe, baton);

  // Rayon de lumière : cylindre ouvert, translucide, sans écriture de profondeur (pas d'ombre, pas de tri gênant)
  const hauteur = CONFIG.mort.hauteurRayon;
  const materiauRayon = new THREE.MeshBasicMaterial({
    color: COULEUR_RAYON,
    transparent: true,
    opacity: CONFIG.mort.opaciteRayon,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const geometrieRayon = new THREE.CylinderGeometry(CONFIG.mort.rayonRayon * 0.6, CONFIG.mort.rayonRayon, hauteur, 10, 1, true);
  const rayon = new THREE.Mesh(geometrieRayon, materiauRayon);
  rayon.position.y = hauteur / 2;
  rayon.name = 'rayon-baluchon';
  if (avecRayon) objet.add(rayon);

  let temps = 0;
  return {
    objet,
    placer(x, y, z) {
      objet.position.set(x, y, z);
    },
    mettreAJour(dt) {
      temps += dt;
      materiauRayon.opacity = CONFIG.mort.opaciteRayon * (0.8 + 0.2 * Math.sin(temps * 2));
    },
    liberer() {
      if (!avecRayon) {
        geometrieRayon.dispose();
        materiauRayon.dispose();
      }
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
