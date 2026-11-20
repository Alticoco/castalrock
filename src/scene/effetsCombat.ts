// Effets visuels du combat : éclaboussures (gelée du slime, éclats à l'impact) et petit nuage de
// fumée à la mort d'un ennemi. Aucune règle de jeu ici. L'aléatoire de ces effets n'a pas besoin
// d'être reproductible.

import * as THREE from 'three';
import { creerModeleEclat, type ModeleEclat } from './modeleEclat';

export interface EffetsCombat {
  /** Gouttes ou éclats projetés depuis (x, y, z), qui retombent au sol. */
  eclaboussures(x: number, y: number, z: number, couleur: number, nombre?: number): void;
  /** Petit nuage qui monte et se dissipe. */
  fumee(x: number, y: number, z: number): void;
  /** Étincelles vives et brèves (coup arrêté par le bouclier). Couleurs pleines : aucune lumière ajoutée. */
  etincelles(x: number, y: number, z: number, nombre?: number): void;
  /**
   * L'Éclat du Cœur jaillit de (x, y, z), monte en tournant puis vole en courbe jusqu'au joueur (lu à chaque image
   * avec `cible`) et disparaît en arrivant. Effet seulement : l'objet est déjà dans l'inventaire ou le coffre.
   */
  eclatVersJoueur(x: number, y: number, z: number, cible: () => { x: number; y: number; z: number }): void;
  mettreAJour(dt: number): void;
  liberer(): void;
}

const GRAVITE = 14;
const MAX_PARTICULES = 220;
const COULEUR_FUMEE = 0xe9e4da;
// Vol de l'Éclat : montée (s), puis vol vers le joueur (s), hauteur de la montée (m), hauteur visée sur le joueur (m)
const DUREE_MONTEE_ECLAT = 0.7;
const DUREE_VOL_ECLAT = 1.0;
const HAUTEUR_MONTEE_ECLAT = 1.8;
const HAUTEUR_VISEE_ECLAT = 1.2;

interface EclatEnVol {
  modele: ModeleEclat;
  age: number;
  depart: THREE.Vector3;
  apogee: THREE.Vector3;
  cible: () => { x: number; y: number; z: number };
  /** Côté du virage du vol (+1 ou -1) */
  cote: number;
}

const alea = (min: number, max: number) => min + Math.random() * (max - min);

interface Particule {
  mesh: THREE.Mesh;
  vitesse: THREE.Vector3;
  rotation: THREE.Vector3;
  age: number;
  duree: number;
  taille: number;
  /** Vrai : nuage qui monte et gonfle ; faux : goutte qui retombe */
  fumee: boolean;
}

export function creerEffetsCombat(scene: THREE.Scene, sol: (x: number, z: number) => number): EffetsCombat {
  const groupe = new THREE.Group();
  scene.add(groupe);
  const geometrieGoutte = new THREE.TetrahedronGeometry(1);
  const geometrieFumee = new THREE.IcosahedronGeometry(1, 0);
  const materiaux = new Map<number, THREE.MeshStandardMaterial>();
  // Étincelles : couleurs pleines (sans éclairage), pour rester vives la nuit
  const materiauxVifs = [0xffffff, 0xffe9a0, 0xffc45a].map((c) => new THREE.MeshBasicMaterial({ color: c }));
  const particules: Particule[] = [];
  const eclats: EclatEnVol[] = [];
  const point = new THREE.Vector3();
  const arrivee = new THREE.Vector3();
  const milieu = new THREE.Vector3();

  function materiau(couleur: number): THREE.MeshStandardMaterial {
    let m = materiaux.get(couleur);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: couleur, flatShading: true, roughness: 0.8 });
      if (couleur === COULEUR_FUMEE) {
        m.transparent = true;
        m.opacity = 0.7;
        m.depthWrite = false;
      }
      materiaux.set(couleur, m);
    }
    return m;
  }

  function ajouter(p: Particule): void {
    if (particules.length >= MAX_PARTICULES) {
      const vieille = particules.shift();
      if (vieille) groupe.remove(vieille.mesh);
    }
    groupe.add(p.mesh);
    particules.push(p);
  }

  return {
    eclaboussures(x, y, z, couleur, nombre = 8) {
      for (let i = 0; i < nombre; i++) {
        const mesh = new THREE.Mesh(geometrieGoutte, materiau(couleur));
        const taille = alea(0.04, 0.09);
        mesh.scale.setScalar(taille);
        mesh.position.set(x + alea(-0.15, 0.15), y + alea(-0.1, 0.15), z + alea(-0.15, 0.15));
        const angle = alea(0, Math.PI * 2);
        const force = alea(1.2, 3.2);
        ajouter({
          mesh,
          vitesse: new THREE.Vector3(Math.sin(angle) * force, alea(2.2, 4.6), Math.cos(angle) * force),
          rotation: new THREE.Vector3(alea(-8, 8), alea(-8, 8), alea(-8, 8)),
          age: 0,
          duree: alea(0.5, 0.85),
          taille,
          fumee: false,
        });
      }
    },

    etincelles(x, y, z, nombre = 10) {
      for (let i = 0; i < nombre; i++) {
        const mesh = new THREE.Mesh(geometrieGoutte, materiauxVifs[i % materiauxVifs.length]);
        const taille = alea(0.02, 0.045);
        mesh.scale.setScalar(taille);
        mesh.position.set(x + alea(-0.08, 0.08), y + alea(-0.08, 0.08), z + alea(-0.08, 0.08));
        const angle = alea(0, Math.PI * 2);
        const force = alea(1.5, 4.5);
        ajouter({
          mesh,
          vitesse: new THREE.Vector3(Math.sin(angle) * force, alea(0.8, 3.4), Math.cos(angle) * force),
          rotation: new THREE.Vector3(alea(-14, 14), alea(-14, 14), alea(-14, 14)),
          age: 0,
          duree: alea(0.2, 0.42),
          taille,
          fumee: false,
        });
      }
    },

    fumee(x, y, z) {
      for (let i = 0; i < 7; i++) {
        const mesh = new THREE.Mesh(geometrieFumee, materiau(COULEUR_FUMEE));
        const taille = alea(0.16, 0.3);
        mesh.scale.setScalar(taille * 0.3);
        mesh.position.set(x + alea(-0.3, 0.3), y + alea(0.1, 0.7), z + alea(-0.3, 0.3));
        ajouter({
          mesh,
          vitesse: new THREE.Vector3(alea(-0.5, 0.5), alea(0.5, 1.3), alea(-0.5, 0.5)),
          rotation: new THREE.Vector3(alea(-1, 1), alea(-1, 1), alea(-1, 1)),
          age: 0,
          duree: alea(0.6, 1),
          taille,
          fumee: true,
        });
      }
    },

    eclatVersJoueur(x, y, z, cible) {
      const modele = creerModeleEclat({ longueur: 0.5 });
      const depart = new THREE.Vector3(x, y, z);
      const apogee = new THREE.Vector3(x, y + HAUTEUR_MONTEE_ECLAT, z);
      modele.objet.position.copy(depart);
      groupe.add(modele.objet);
      eclats.push({ modele, age: 0, depart, apogee, cible, cote: Math.random() < 0.5 ? -1 : 1 });
    },

    mettreAJour(dt) {
      for (let i = eclats.length - 1; i >= 0; i--) {
        const e = eclats[i];
        e.age += dt;
        e.modele.mettreAJour(dt);
        const objet = e.modele.objet;
        if (e.age >= DUREE_MONTEE_ECLAT + DUREE_VOL_ECLAT) {
          groupe.remove(objet);
          e.modele.liberer();
          eclats.splice(i, 1);
          continue;
        }
        if (e.age < DUREE_MONTEE_ECLAT) {
          // Jaillit du corps : monte vite puis ralentit, en grossissant
          const k = e.age / DUREE_MONTEE_ECLAT;
          point.lerpVectors(e.depart, e.apogee, 1 - (1 - k) * (1 - k));
          objet.scale.setScalar(0.4 + 0.6 * k);
          objet.rotation.y += 7 * dt;
        } else {
          // Vol en courbe (Bézier à trois points) vers le joueur, de plus en plus vite
          const t = (e.age - DUREE_MONTEE_ECLAT) / DUREE_VOL_ECLAT;
          const k = t * t * (3 - 2 * t);
          const c = e.cible();
          arrivee.set(c.x, c.y + HAUTEUR_VISEE_ECLAT, c.z);
          milieu.addVectors(e.apogee, arrivee).multiplyScalar(0.5);
          milieu.x += e.cote * (arrivee.z - e.apogee.z) * 0.3;
          milieu.z -= e.cote * (arrivee.x - e.apogee.x) * 0.3;
          milieu.y += 1.2;
          point.copy(e.apogee).multiplyScalar((1 - k) * (1 - k)).addScaledVector(milieu, 2 * (1 - k) * k).addScaledVector(arrivee, k * k);
          objet.scale.setScalar(1 - 0.7 * t * t);
          objet.rotation.y += 11 * dt;
        }
        objet.position.copy(point);
        objet.rotation.z += 3 * dt;
      }
      for (let i = particules.length - 1; i >= 0; i--) {
        const p = particules[i];
        p.age += dt;
        if (p.age >= p.duree) {
          groupe.remove(p.mesh);
          particules.splice(i, 1);
          continue;
        }
        const k = p.age / p.duree;
        if (p.fumee) {
          // Gonfle vite, puis se dissipe
          p.vitesse.multiplyScalar(Math.exp(-1.5 * dt));
          p.mesh.scale.setScalar(p.taille * (k < 0.3 ? 0.3 + (k / 0.3) * 0.7 : 1 - ((k - 0.3) / 0.7) * 0.85));
        } else {
          p.vitesse.y -= GRAVITE * dt;
          p.mesh.scale.setScalar(p.taille * (1 - k * k));
        }
        p.mesh.position.addScaledVector(p.vitesse, dt);
        p.mesh.rotation.x += p.rotation.x * dt;
        p.mesh.rotation.y += p.rotation.y * dt;
        p.mesh.rotation.z += p.rotation.z * dt;
        if (!p.fumee) {
          const h = sol(p.mesh.position.x, p.mesh.position.z) + 0.02;
          if (p.mesh.position.y < h) {
            // Posée : elle ne bouge plus et finit de rétrécir
            p.mesh.position.y = h;
            p.vitesse.set(0, 0, 0);
            p.rotation.set(0, 0, 0);
          }
        }
      }
    },

    liberer() {
      for (const e of eclats) e.modele.liberer();
      eclats.length = 0;
      scene.remove(groupe);
      geometrieGoutte.dispose();
      geometrieFumee.dispose();
      for (const m of materiaux.values()) m.dispose();
      for (const m of materiauxVifs) m.dispose();
      particules.length = 0;
    },
  };
}
