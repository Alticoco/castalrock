// Intérieur de la maison du joueur : modèles low poly faits en code d'après l'image
// « Maison médiévale chaleureuse au coin du feu » (docs/concepts/) : plancher, murs de planches, poutres,
// cheminée de pierre et son feu, lit, coffre, établi, table et bancs, étagères, tapis, fenêtres, bougies.
// Ne contient aucune règle de jeu : tailles, positions et obstacles sont dans plan.ts.
// Repère du groupe : centre de la pièce au sol ; x vers l'est, z vers le sud (porte), cheminée au nord.

import * as THREE from 'three';
import { CONFIG } from '../config';
import { creerAleatoire } from '../regles/aleatoire';
import { Formes, matrice } from '../scene/modelesVillage';
import type { Meuble, PlanMaison } from './plan';

export interface InterieurMaison {
  readonly groupe: THREE.Group;
  /** Où placer la lueur du feu, dans le monde */
  readonly feu: { x: number; y: number; z: number };
  /** Anime les flammes de la cheminée et des bougies. */
  mettreAJour(dt: number): void;
}

const FEU_VIF = 0xffc93c;
const FEU_ORANGE = 0xff7a1e;
const FEU_ROUGE = 0xff5a1e;

export function creerInterieurMaison(plan: PlanMaison): InterieurMaison {
  const C = CONFIG.maison.couleurs;
  const alea = creerAleatoire(7300);
  const corps = new Formes(alea);
  // Ce qui éclaire sans être éclairé : vitres, braises, flammes des bougies
  const lueurs = new Formes(alea);
  const dl = plan.largeur / 2;
  const dp = plan.profondeur / 2;
  const H = plan.hauteur;
  const bougies: Array<{ x: number; y: number; z: number }> = [];

  /** Meuble du plan, dans le repère de la pièce. */
  const meuble = (id: string): Meuble => {
    const m = plan.meubles.find((x) => x.id === id);
    if (!m) throw new Error(`Meuble inconnu : ${id}`);
    return { ...m, x: m.x - plan.origine.x, z: m.z - plan.origine.z };
  };

  const bougie = (x: number, y: number, z: number): void => {
    corps.cyl(0.08, 0.1, 0.03, 6, C.fer, x, y + 0.015, z);
    corps.cyl(0.045, 0.05, 0.16, 6, C.bougie, x, y + 0.11, z);
    bougies.push({ x, y: y + 0.19, z });
  };
  const pot = (x: number, y: number, z: number, taille = 1): void => {
    corps.cyl(0.1 * taille, 0.07 * taille, 0.1 * taille, 6, C.poterie, x, y + 0.05 * taille, z);
    corps.cyl(0.07 * taille, 0.1 * taille, 0.1 * taille, 6, C.poterie, x, y + 0.15 * taille, z);
    corps.cyl(0.08 * taille, 0.07 * taille, 0.04 * taille, 6, C.poterie, x, y + 0.22 * taille, z);
  };
  /** Livres debout, serrés le long de z (`sens` : +1 ou -1) à partir de (x, y, z). */
  const livres = (x: number, y: number, z: number, sens: number): void => {
    [0x55703a, 0xb5372f, 0x3d4f8a, 0xc79a3a].forEach((couleur, i) => {
      corps.boite(0.2, 0.26 + (i % 2) * 0.05, 0.07, couleur, x, y, z + sens * i * 0.08, 0);
    });
  };

  // --- Plancher, murs, plafond ---
  const lames = 16;
  for (let i = 0; i < lames; i++) {
    const l = plan.largeur / lames;
    corps.boite(l - 0.02, 0.1, plan.profondeur, i % 3 === 1 ? C.boisSombre : C.plancher, -dl + (i + 0.5) * l, -0.1, 0);
  }
  corps.boite(plan.largeur, 0.05, plan.profondeur, C.poutre, 0, -0.12, 0);
  // Murs : planches debout, soubassement plus sombre, sablière en haut
  const planches = (longueur: number, pose: (t: number, largeur: number, i: number) => void): void => {
    const n = Math.round(longueur / 0.5);
    for (let i = 0; i < n; i++) pose(-longueur / 2 + ((i + 0.5) * longueur) / n, longueur / n, i);
  };
  for (const s of [-1, 1]) {
    planches(plan.largeur, (x, l, i) => corps.boite(l - 0.015, H, 0.2, i % 2 ? C.mur : C.murSombre, x, 0, s * (dp + 0.1)));
    planches(plan.profondeur, (z, l, i) => corps.boite(0.2, H, l - 0.015, i % 2 ? C.murSombre : C.mur, s * (dl + 0.1), 0, z));
    corps.boite(plan.largeur, 0.22, 0.08, C.poutre, 0, 0, s * (dp - 0.04));
    corps.boite(0.08, 0.22, plan.profondeur, C.poutre, s * (dl - 0.04), 0, 0);
    corps.boite(plan.largeur, 0.24, 0.14, C.poutre, 0, H - 0.5, s * (dp - 0.07));
    corps.boite(0.14, 0.24, plan.profondeur, C.poutre, s * (dl - 0.07), H - 0.5, 0);
  }
  // Poteaux aux angles et le long des grands murs, avec leurs écharpes
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      corps.boite(0.26, H, 0.26, C.poutre, sx * (dl - 0.1), 0, sz * (dp - 0.1));
      corps.barre(0.12, 0.9, 0.12, C.poutre, sx * (dl - 0.4), H - 0.75, sz * (dp - 0.08), 0, 0, sx * 0.8);
    }
  }
  for (const sz of [-1, 1]) {
    for (const x of [-2.1, 2.1]) corps.boite(0.2, H, 0.14, C.poutre, x, 0, sz * (dp - 0.06));
  }
  corps.boite(plan.largeur + 0.4, 0.12, plan.profondeur + 0.4, C.plafond, 0, H, 0);
  // Poutres apparentes, en travers de la pièce
  for (const z of [-2.1, -0.7, 0.7, 2.1]) corps.boite(plan.largeur, 0.24, 0.24, C.poutre, 0, H - 0.24, z);

  // --- Porte (mur sud) : planches, encadrement, ferrures et anneau ---
  {
    const z = dp;
    for (let i = 0; i < 3; i++) corps.boite(0.36, 2.0, 0.1, i % 2 ? C.bois : C.boisSombre, (i - 1) * 0.37, 0, z - 0.04);
    for (const s of [-1, 1]) corps.boite(0.18, 2.1, 0.16, C.poutre, s * 0.66, 0, z - 0.06);
    corps.boite(1.6, 0.2, 0.18, C.poutre, 0, 2.05, z - 0.07);
    for (const y of [0.45, 1.55]) corps.boite(1.0, 0.09, 0.04, C.fer, 0, y, z - 0.11);
    corps.ajouter(new THREE.TorusGeometry(0.09, 0.025, 4, 8), C.fer, matrice(0.36, 1.05, z - 0.13));
  }

  // --- Fenêtres : la lumière du soir derrière des croisillons ---
  const fenetre = (x: number, y: number, z: number, ry: number): void => {
    const base = matrice(x, y, z, 0, ry, 0);
    const en = (dx: number, dy: number, dzz: number) => base.clone().multiply(matrice(dx, dy, dzz));
    corps.ajouter(new THREE.BoxGeometry(1.2, 1.2, 0.12), C.poutre, en(0, 0, 0));
    lueurs.ajouter(new THREE.BoxGeometry(0.94, 0.94, 0.04), C.vitre, en(0, 0, 0.06), 0.03);
    lueurs.ajouter(new THREE.BoxGeometry(0.94, 0.3, 0.045), 0xc4583a, en(0, -0.32, 0.06), 0.03);
    corps.ajouter(new THREE.BoxGeometry(0.07, 0.94, 0.05), C.poutre, en(0, 0, 0.09));
    corps.ajouter(new THREE.BoxGeometry(0.94, 0.07, 0.05), C.poutre, en(0, 0, 0.09));
    corps.ajouter(new THREE.BoxGeometry(1.4, 0.08, 0.2), C.bois, en(0, -0.64, 0.1));
  };
  fenetre(-1.9, 1.65, -dp, 0);
  fenetre(-dl, 1.65, 0.1, Math.PI / 2);
  fenetre(dl, 1.7, 0.9, -Math.PI / 2);
  fenetre(-2.4, 1.65, dp, Math.PI);
  fenetre(2.4, 1.65, dp, Math.PI);

  // --- Cheminée de pierre : socle, piédroits, linteau, tablette, hotte qui se resserre ---
  const ch = meuble('cheminee');
  const zFond = -dp;
  const zAvant = ch.z + ch.demiProfondeur;
  {
    const zc = (zFond + zAvant) / 2;
    const p = zAvant - zFond;
    corps.boite(2.1, 0.18, p, C.pierre, ch.x, 0, zc);
    for (let i = 0; i < 4; i++) corps.boite(0.5, 0.2, 0.3, i % 2 ? C.pierre : C.pierreSombre, ch.x - 0.78 + i * 0.52, 0, zAvant - 0.16);
    for (const s of [-1, 1]) {
      corps.boite(0.42, 0.62, p - 0.1, C.pierre, ch.x + s * 0.82, 0.18, zc - 0.05);
      corps.boite(0.38, 0.6, p - 0.12, C.pierreSombre, ch.x + s * 0.8, 0.8, zc - 0.06);
      // Sommiers de l'arc
      corps.barre(0.5, 0.3, p - 0.14, C.pierre, ch.x + s * 0.52, 1.42, zc - 0.07, 0, 0, -s * 0.6);
    }
    corps.boite(0.5, 0.3, p - 0.14, C.pierreSombre, ch.x, 1.38, zc - 0.07);
    corps.boite(1.3, 1.5, 0.1, 0x3a2c28, ch.x, 0.18, zFond + 0.06);
    corps.boite(2.3, 0.16, p + 0.12, C.pierreSombre, ch.x, 1.66, zc + 0.04);
    // Hotte : trois assises de plus en plus étroites, jusqu'au plafond
    [
      [1.7, 0.45, 0.62],
      [1.35, 0.42, 0.52],
      [1.05, 0.35, 0.44],
    ].forEach(([l, h, prof], i) => {
      const y = 1.82 + [0, 0.45, 0.87][i];
      corps.boite(l, h, prof, i % 2 ? C.pierreSombre : C.pierre, ch.x, y, zFond + prof / 2);
    });
    // Bûches et braises
    corps.cyl(0.09, 0.09, 0.7, 6, C.boisSombre, ch.x - 0.12, 0.28, zc - 0.05, 0, 0.5, Math.PI / 2);
    corps.cyl(0.09, 0.09, 0.7, 6, C.bois, ch.x + 0.14, 0.28, zc + 0.02, 0, -0.45, Math.PI / 2);
    corps.cyl(0.08, 0.08, 0.6, 6, C.boisSombre, ch.x, 0.43, zc - 0.02, 0, 0.1, Math.PI / 2);
    lueurs.boite(0.8, 0.05, 0.4, FEU_ORANGE, ch.x, 0.18, zc - 0.03);
    // Sur la tablette : deux bougies et un pot
    bougie(ch.x - 0.85, 1.82, zAvant - 0.12);
    bougie(ch.x + 0.85, 1.82, zAvant - 0.12);
    pot(ch.x + 0.45, 1.82, zAvant - 0.14, 1.2);
  }

  // --- Lit : montants, tête et pied, matelas, couverture rouge, oreiller ---
  {
    const m = meuble('lit');
    const l = m.demiLargeur * 2;
    const p = m.demiProfondeur * 2;
    for (const sx of [-1, 1]) {
      corps.boite(0.14, 1.05, 0.14, C.boisSombre, m.x + sx * (l / 2 - 0.07), 0, m.z - p / 2 + 0.07);
      corps.boite(0.14, 0.72, 0.14, C.boisSombre, m.x + sx * (l / 2 - 0.07), 0, m.z + p / 2 - 0.07);
      corps.boite(0.08, 0.22, p - 0.2, C.bois, m.x + sx * (l / 2 - 0.05), 0.22, m.z);
    }
    corps.boite(l - 0.2, 0.62, 0.08, C.bois, m.x, 0.32, m.z - p / 2 + 0.07);
    corps.boite(l - 0.2, 0.34, 0.08, C.bois, m.x, 0.24, m.z + p / 2 - 0.07);
    corps.boite(l - 0.16, 0.2, p - 0.24, C.oreiller, m.x, 0.3, m.z);
    corps.boite(l - 0.1, 0.14, p * 0.62, C.drap, m.x, 0.44, m.z + p * 0.14);
    corps.boite(l - 0.08, 0.3, 0.06, C.drap, m.x, 0.26, m.z + p / 2 - 0.16);
    corps.barre(l * 0.62, 0.14, 0.42, C.oreiller, m.x, 0.58, m.z - p / 2 + 0.42, 0.18);
  }

  // --- Coffre au pied du lit : caisse, couvercle bombé, cerclages et serrure tournés vers la pièce ---
  {
    const m = meuble('coffre');
    const l = m.demiLargeur * 2;
    const p = m.demiProfondeur * 2;
    corps.boite(l, 0.42, p, C.bois, m.x, 0, m.z);
    corps.boite(l + 0.04, 0.12, p + 0.04, C.boisSombre, m.x, 0.42, m.z);
    corps.boite(l - 0.06, 0.1, p - 0.1, C.bois, m.x, 0.54, m.z);
    for (const s of [-1, 1]) {
      corps.boite(0.09, 0.66, p + 0.07, C.fer, m.x + s * (l / 2 - 0.13), 0, m.z);
      corps.boite(0.11, 0.11, 0.11, C.fer, m.x + s * (l / 2 - 0.02), 0, m.z + p / 2 - 0.03);
    }
    corps.boite(0.16, 0.2, 0.06, C.fer, m.x, 0.3, m.z + p / 2 + 0.02);
  }

  // --- Établi : plateau épais, étau, caisse, outils au mur ---
  {
    const m = meuble('etabli');
    const l = m.demiLargeur * 2;
    const p = m.demiProfondeur * 2;
    corps.boite(l, 0.1, p, C.bois, m.x, 0.78, m.z);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) corps.boite(0.12, 0.78, 0.12, C.boisSombre, m.x + sx * (l / 2 - 0.1), 0, m.z + sz * (p / 2 - 0.1));
    }
    corps.boite(l - 0.2, 0.06, p - 0.16, C.boisSombre, m.x, 0.22, m.z);
    corps.boite(0.5, 0.2, 0.36, C.bois, m.x + 0.25, 0.28, m.z);
    corps.boite(0.16, 0.2, 0.2, C.fer, m.x - 0.5, 0.88, m.z + 0.12);
    corps.boite(0.34, 0.1, 0.2, C.bois, m.x + 0.35, 0.88, m.z - 0.05);
    // Râtelier : marteau et scie
    corps.boite(1.1, 0.1, 0.05, C.boisSombre, m.x, 1.75, -dp + 0.03);
    corps.boite(0.06, 0.42, 0.05, C.bois, m.x - 0.3, 1.3, -dp + 0.05);
    corps.boite(0.24, 0.1, 0.09, C.fer, m.x - 0.3, 1.66, -dp + 0.06);
    corps.boite(0.14, 0.14, 0.05, C.bois, m.x + 0.25, 1.58, -dp + 0.05);
    corps.boite(0.1, 0.5, 0.02, 0xd5d5d8, m.x + 0.25, 1.08, -dp + 0.05);
  }

  // --- Table et bancs ---
  {
    const m = meuble('table');
    const l = m.demiLargeur * 2;
    const p = m.demiProfondeur * 2;
    corps.boite(l, 0.09, p, C.bois, m.x, 0.72, m.z);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) corps.boite(0.12, 0.72, 0.12, C.boisSombre, m.x + sx * (l / 2 - 0.1), 0, m.z + sz * (p / 2 - 0.12));
    }
    corps.boite(0.08, 0.1, p - 0.3, C.boisSombre, m.x, 0.3, m.z);
    bougie(m.x - 0.1, 0.81, m.z - 0.35);
    pot(m.x + 0.1, 0.81, m.z + 0.25, 1.5);
    corps.cyl(0.14, 0.1, 0.03, 8, C.oreiller, m.x - 0.12, 0.83, m.z + 0.6);
    for (const id of ['banc-ouest', 'banc-est']) {
      const b = meuble(id);
      corps.boite(b.demiLargeur * 2, 0.07, b.demiProfondeur * 2, C.bois, b.x, 0.42, b.z);
      for (const sz of [-1, 1]) corps.boite(b.demiLargeur * 2 - 0.06, 0.42, 0.1, C.boisSombre, b.x, 0, b.z + sz * (b.demiProfondeur - 0.2));
    }
  }

  // --- Tapis : rouge bordé d'or ---
  {
    const m = meuble('tapis');
    corps.boite(m.demiLargeur * 2, 0.02, m.demiProfondeur * 2, C.tapisBord, m.x, 0, m.z);
    corps.boite(m.demiLargeur * 2 - 0.3, 0.03, m.demiProfondeur * 2 - 0.3, C.tapis, m.x, 0, m.z);
    corps.boite(m.demiLargeur * 2 - 1.1, 0.035, m.demiProfondeur * 2 - 1.0, C.tapisBord, m.x, 0, m.z, Math.PI / 4);
  }

  // --- Étagères aux murs : planche sur consoles, livres, pots, bougie ---
  {
    const o = meuble('etagere-ouest');
    corps.boite(0.34, 0.06, o.demiProfondeur * 2, C.bois, -dl + 0.17, 1.55, o.z);
    for (const s of [-1, 1]) corps.barre(0.3, 0.06, 0.06, C.boisSombre, -dl + 0.15, 1.42, o.z + s * (o.demiProfondeur - 0.15), 0, 0, 0.75);
    livres(-dl + 0.14, 1.61, o.z - 0.6, 1);
    pot(-dl + 0.18, 1.61, o.z + 0.1, 1.3);
    bougie(-dl + 0.18, 1.61, o.z + 0.55);

    const e = meuble('etagere-est');
    for (const y of [1.3, 1.95]) {
      corps.boite(0.34, 0.06, e.demiProfondeur * 2, C.bois, dl - 0.17, y, e.z);
      for (const s of [-1, 1]) corps.barre(0.3, 0.06, 0.06, C.boisSombre, dl - 0.15, y - 0.13, e.z + s * (e.demiProfondeur - 0.15), 0, 0, -0.75);
    }
    livres(dl - 0.14, 1.36, e.z + 0.5, -1);
    pot(dl - 0.18, 1.36, e.z - 0.35, 1.3);
    pot(dl - 0.18, 2.01, e.z + 0.3, 1.5);
    bougie(dl - 0.18, 2.01, e.z - 0.35);
  }

  // --- Assemblage ---
  const matCorps = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  const matLueur = new THREE.MeshBasicMaterial({ vertexColors: true });
  const matFlammes = [FEU_ROUGE, FEU_ORANGE, FEU_VIF].map((c) => new THREE.MeshBasicMaterial({ color: c }));
  const geoFlamme = new THREE.ConeGeometry(0.2, 0.7, 5, 1).translate(0, 0.35, 0);

  const groupe = new THREE.Group();
  groupe.name = 'interieur-maison';
  groupe.position.set(plan.origine.x, plan.altitude, plan.origine.z);
  groupe.add(new THREE.Mesh(corps.terminer(), matCorps), new THREE.Mesh(lueurs.terminer(), matLueur));

  // Feu de cheminée : trois langues (rouge large, orange, cœur jaune)
  const feu = new THREE.Group();
  const zFeu = (zFond + zAvant) / 2 - 0.03;
  feu.position.set(ch.x, 0.3, zFeu);
  const langues: Array<{ objet: THREE.Mesh; hauteur: number; phase: number }> = [];
  [
    [0, 0, 1.5, 1.15],
    [0.14, 0.04, 1.1, 1.4],
    [-0.1, -0.03, 0.75, 1.0],
  ].forEach(([dx, dz, largeur, hauteur], i) => {
    const langue = new THREE.Mesh(geoFlamme, matFlammes[i]);
    langue.position.set(dx, 0, dz);
    langue.scale.set(largeur, hauteur, largeur * 0.8);
    feu.add(langue);
    langues.push({ objet: langue, hauteur, phase: i * 1.7 });
  });
  groupe.add(feu);
  // Flammes des bougies
  const flammesBougies = bougies.map((b, i) => {
    const flamme = new THREE.Mesh(geoFlamme, matFlammes[2]);
    flamme.position.set(b.x, b.y, b.z);
    flamme.scale.set(0.2, 0.2, 0.2);
    groupe.add(flamme);
    return { objet: flamme, phase: i * 2.3 };
  });

  let temps = 0;
  return {
    groupe,
    // Un peu en avant du foyer : la lueur baigne la pièce au lieu de rester dans l'âtre
    feu: { x: plan.origine.x + ch.x, y: plan.altitude + 1.0, z: plan.origine.z + zAvant + 0.5 },
    mettreAJour(dt) {
      temps += dt;
      langues.forEach((l, i) => {
        const t = temps * (7 + i * 2.3) + l.phase;
        l.objet.scale.y = l.hauteur * (1 + 0.22 * Math.sin(t) + 0.1 * Math.sin(t * 2.7));
        l.objet.rotation.y = temps * (1.5 + i);
      });
      for (const f of flammesBougies) {
        f.objet.scale.y = 0.2 * (1 + 0.18 * Math.sin(temps * 9 + f.phase) + 0.08 * Math.sin(temps * 23 + f.phase));
      }
    },
  };
}
