// Village : modèles low poly faits en code d'après les images de docs/concepts/ (maisons à colombages,
// toits de chaume ou de tuiles, forge au foyer rougeoyant, auberge à enseigne, coffre, établi, puits,
// panneau d'annonces, lanternes, clôtures, murets, potager, tour de guet, chemins), forgeron (PNJ) et
// rendu du village à un niveau donné.
// Ne contient aucune règle de jeu : positions, emprises et obstacles sont dans src/regles/village.ts.
// Repère d'un modèle : posé sur le sol (y = 0), façade vers +z.

import * as THREE from 'three';
import { CONFIG } from '../config';
import { creerAleatoire, type Aleatoire } from '../regles/aleatoire';
import {
  FORGE_ENCLUME,
  MAISON_JOUEUR,
  decrireVillage,
  type DescriptionVillage,
  type ElementVillage,
  type NiveauVillage,
  type TypeElementVillage,
} from '../regles/village';
import { maisonEndommagee } from './maisonEndommagee';
import { boite as boiteMaille, creerMateriau, fuseau, maille } from './outils';
import { creerEnclos } from './modelesFerme';
import { creerPersonnage, type Personnage } from './personnage';

export interface RenduVillage {
  /** Reconstruit le village à ce niveau. */
  definirNiveau(niveau: NiveauVillage): void;
  /**
   * Maisons de chaume affichées endommagées (attaque des bandits) : identifiants des éléments du village.
   * Les autres bâtiments restent intacts ; ensemble vide = tout intact. L'état est gardé d'un niveau à l'autre.
   */
  definirEndommages(ids: ReadonlySet<string>): void;
  /** Anime flammes et fumée ; `nuit` va de 0 (plein jour) à 1 (nuit) : fenêtres et lanternes s'allument. */
  mettreAJour(dt: number, nuit: number): void;
  liberer(): void;
}

// Couleurs relevées sur les images concept
const K = {
  mur: 0xf0d9a8,
  crepi: 0xe9d7b8,
  bois: 0xa86838,
  boisFonce: 0x8a5230,
  boisClair: 0xc27c40,
  panneau: 0xa9633a,
  porte: 0x8a5230,
  porteClaire: 0x9a5c34,
  chaume: 0xf7c843,
  chaumeSombre: 0xe2ae32,
  chaumeClair: 0xffd95c,
  tuile: 0xcf6238,
  tuileSombre: 0xb04f2c,
  tuileRouge: 0xd9483a,
  tuileRougeSombre: 0xbb3b30,
  toitBois: 0xb5622f,
  toitBoisClair: 0xc87238,
  soufflet: 0x9c4a32,
  pierre: 0x9a9299,
  pierreFoncee: 0x857d86,
  pierreClaire: 0xcbb99e,
  muret: 0xb3aca4,
  cheminee: 0xe2c9a0,
  brique: 0xb5553a,
  fer: 0x5d5a60,
  ferClair: 0x8c8a90,
  acier: 0xd5d5d8,
  coffre: 0xc87a36,
  etabli: 0xc9793a,
  corde: 0xc9ad62,
  eau: 0x2c5266,
  braise: 0xff7a1e,
  feuVif: 0xffc93c,
  feuRouge: 0xff5a1e,
  terre: 0xbd8a57,
  terreSombre: 0x7a5234,
  terreButte: 0x93643f,
  paves: 0xb9b1a6,
  vert: 0x5fae3c,
  vertSombre: 0x3f8f35,
  chou: 0xa5d66a,
  fleur: 0xe0483c,
  carotte: 0xf08a2c,
  chope: 0xf2b83a,
  mousse: 0xfff3d0,
  vitreJour: 0x86b7de,
  vitreNuit: 0xffc04a,
  lampe: 0xffd27a,
  lueur: 0xffb347,
  fumee: 0xe6e2dc,
} as const;

export function matrice(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(1, 1, 1),
  );
}

/** Assemble des formes en une seule géométrie à faces plates, une couleur par face (légèrement variée). */
export class Formes {
  private positions: number[] = [];
  private couleurs: number[] = [];

  constructor(private alea: Aleatoire) {}

  get vide(): boolean {
    return this.positions.length === 0;
  }

  ajouter(forme: THREE.BufferGeometry, couleur: number, m?: THREE.Matrix4, variation = 0.05): this {
    const g = forme.index ? forme.toNonIndexed() : forme;
    if (m) g.applyMatrix4(m);
    const p = g.getAttribute('position');
    const teinte = new THREE.Color(couleur);
    let v = 1;
    for (let i = 0; i < p.count; i += 3) {
      // Une teinte pour deux triangles : les faces rectangulaires restent unies
      if (i % 6 === 0) v = 1 + (this.alea.suivant() - 0.5) * 2 * variation;
      for (let k = i; k < i + 3; k++) {
        this.positions.push(p.getX(k), p.getY(k), p.getZ(k));
        this.couleurs.push(teinte.r * v, teinte.g * v, teinte.b * v);
      }
    }
    if (g !== forme) g.dispose();
    forme.dispose();
    return this;
  }

  /** Boîte posée : (x, z) = centre, y = base ; `ry` : rotation autour de la verticale. */
  boite(l: number, h: number, p: number, c: number, x: number, y: number, z: number, ry = 0): this {
    return this.ajouter(new THREE.BoxGeometry(l, h, p), c, matrice(x, y + h / 2, z, 0, ry, 0));
  }

  /** Boîte centrée en (x, y, z), tournée librement (poutres en biais, pans de toit). */
  barre(l: number, h: number, p: number, c: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): this {
    return this.ajouter(new THREE.BoxGeometry(l, h, p), c, matrice(x, y, z, rx, ry, rz));
  }

  /** Cylindre à pans centré en (x, y, z), axe vertical avant rotation. */
  cyl(rHaut: number, rBas: number, h: number, pans: number, c: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): this {
    return this.ajouter(new THREE.CylinderGeometry(rHaut, rBas, h, pans, 1), c, matrice(x, y, z, rx, ry, rz));
  }

  /**
   * Toit plein : base rectangulaire (L le long de x, P le long de z) posée à y, faîte de longueur `crete`
   * à la hauteur H. crete = L : deux pans et deux pignons ; crete < L : quatre pans (toit de chaume).
   */
  prisme(L: number, P: number, H: number, crete: number, c: number, x: number, y: number, z: number, ry = 0): this {
    const a = [-L / 2, 0, -P / 2];
    const b = [L / 2, 0, -P / 2];
    const cc = [L / 2, 0, P / 2];
    const d = [-L / 2, 0, P / 2];
    const e = [-crete / 2, H, 0];
    const f = [crete / 2, H, 0];
    const faces = [d, cc, f, d, f, e, b, a, e, b, e, f, a, d, e, cc, b, f, a, b, cc, a, cc, d];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(faces.flat(), 3));
    return this.ajouter(g, c, matrice(x, y, z, 0, ry, 0));
  }

  /** Toit à deux pans minces (faîte le long de x) : `hp` = demi-portée, `H` = hauteur du faîte au-dessus de y. */
  pans(L: number, hp: number, H: number, c: number, y: number, epaisseur = 0.22): this {
    const angle = Math.atan2(H, hp);
    const pente = Math.hypot(hp, H) + 0.12;
    for (const cote of [-1, 1]) {
      this.barre(L, epaisseur, pente, c, 0, y + H / 2, (cote * hp) / 2, cote * angle);
    }
    return this;
  }

  /**
   * Toit à deux pans faits de rangs qui se recouvrent (chaume épais, tuiles) : chaque rang, du faîte
   * vers l'égout, est un peu plus épais et plus long que le précédent. `ry` = π/2 : faîte le long de z.
   */
  toit(L: number, hp: number, H: number, couleurs: readonly number[], y: number, epaisseur: number, rangs: number, ry = 0): this {
    const angle = Math.atan2(H, hp);
    const pente = Math.hypot(hp, H);
    const base = matrice(0, y, 0, 0, ry, 0);
    for (const cote of [-1, 1]) {
      for (let r = 0; r < rangs; r++) {
        // Le rang va de t0 à t1 le long de la pente (0 = faîte, 1 = égout), en mordant sur le rang du dessus
        const t0 = r / rangs - (r ? 0.05 : 0);
        const t1 = (r + 1) / rangs + (r === rangs - 1 ? 0.14 / pente : 0);
        const tm = (t0 + t1) / 2;
        const e = epaisseur * (1 + 0.3 * r);
        this.ajouter(
          new THREE.BoxGeometry(L + r * 0.14, e, (t1 - t0) * pente),
          couleurs[r % couleurs.length],
          base.clone().multiply(matrice(0, H * (1 - tm) + e * 0.3, cote * hp * tm, cote * angle, 0, 0)),
        );
      }
    }
    return this;
  }

  terminer(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.couleurs, 3));
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

interface Point3 {
  x: number;
  y: number;
  z: number;
}

/** Un modèle en construction : géométries par matériau et points d'effets (dans le repère du modèle). */
class Modele {
  readonly corps: Formes;
  /** Vitres des fenêtres : bleues le jour, allumées la nuit */
  readonly vitres: Formes;
  /** Verres des lanternes : toujours lumineux, plus forts la nuit */
  readonly lampes: Formes;
  /** Braises : jamais ombrées */
  readonly braises: Formes;
  readonly flammes: Array<Point3 & { taille: number }> = [];
  readonly fumees: Point3[] = [];
  readonly lumieres: Point3[] = [];
  /** Lueur des lanternes sur le sol */
  readonly halos: Array<{ x: number; z: number; rayon: number }> = [];

  constructor(graine: number) {
    const alea = creerAleatoire(graine);
    this.corps = new Formes(alea);
    this.vitres = new Formes(alea);
    this.lampes = new Formes(alea);
    this.braises = new Formes(alea);
  }

  /** Fenêtre à croisillons posée sur un mur : (x, y, z) = centre, `ry` = direction vers l'extérieur. */
  fenetre(x: number, y: number, z: number, ry: number, l = 0.9, h = 0.9, jardiniere = false): void {
    const base = matrice(x, y, z, 0, ry, 0);
    const en = (dx: number, dy: number, dz: number) => base.clone().multiply(matrice(dx, dy, dz));
    this.corps.ajouter(new THREE.BoxGeometry(l + 0.26, h + 0.26, 0.1), K.bois, en(0, 0, 0));
    this.vitres.ajouter(new THREE.BoxGeometry(l, h, 0.06), 0xffffff, en(0, 0, 0.05), 0);
    this.corps.ajouter(new THREE.BoxGeometry(0.07, h, 0.04), K.bois, en(0, 0, 0.09));
    this.corps.ajouter(new THREE.BoxGeometry(l, 0.07, 0.04), K.bois, en(0, 0, 0.09));
    this.corps.ajouter(new THREE.BoxGeometry(l + 0.45, 0.1, 0.22), K.bois, en(0, -h / 2 - 0.16, 0.08));
    if (jardiniere) {
      this.corps.ajouter(new THREE.BoxGeometry(l + 0.3, 0.2, 0.26), K.boisFonce, en(0, -h / 2 - 0.32, 0.2));
      this.corps.ajouter(new THREE.BoxGeometry(l + 0.2, 0.1, 0.2), K.vertSombre, en(0, -h / 2 - 0.19, 0.2));
      for (const fx of [-0.3, 0, 0.3]) {
        this.corps.ajouter(new THREE.BoxGeometry(0.16, 0.14, 0.16), K.fleur, en(fx * l, -h / 2 - 0.1, 0.2), 0.12);
      }
    }
  }

  /** Porte de planches dans son encadrement, linteau débordant et poignée ; (x, z) = centre au pied, sur un mur tourné vers +z. */
  porte(x: number, z: number, l = 1.1, h = 1.9): void {
    const c = this.corps;
    for (const s of [-1, 1]) c.boite(0.2, h + 0.05, 0.2, K.bois, x + s * (l / 2 + 0.1), 0.3, z);
    c.boite(l + 0.75, 0.26, 0.26, K.bois, x, 0.3 + h, z);
    for (let i = 0; i < 3; i++) c.boite(l / 3 - 0.02, h, 0.14 + (i % 2) * 0.03, i % 2 ? K.porteClaire : K.porte, x + (i - 1) * (l / 3), 0.3, z);
    c.cyl(0.07, 0.07, 0.08, 6, K.fer, x + l / 2 - 0.2, 1.2, z + 0.12, Math.PI / 2);
  }

  /** Cheminée carrée avec son chapeau, et le point d'où sort la fumée. */
  cheminee(x: number, yBas: number, z: number, hauteur: number, cote: number, couleur: number, chapeau: number): void {
    this.corps.boite(cote, hauteur, cote, couleur, x, yBas, z);
    this.corps.boite(cote + 0.2, 0.22, cote + 0.2, chapeau, x, yBas + hauteur, z);
    this.fumees.push({ x, y: yBas + hauteur + 0.35, z });
  }

  /** Tonneau cerclé de fer. */
  tonneau(x: number, z: number, rayon: number, hauteur: number): void {
    this.corps.cyl(rayon * 0.85, rayon * 0.85, hauteur, 8, K.boisClair, x, hauteur / 2, z);
    this.corps.cyl(rayon, rayon, hauteur * 0.5, 8, K.boisClair, x, hauteur / 2, z);
    for (const k of [0.22, 0.78]) this.corps.cyl(rayon * 0.97, rayon * 0.97, 0.07, 8, K.ferClair, x, hauteur * k, z);
  }
}

// --- Modèles ----------------------------------------------------------------------------------

/** Maison de 6 x 5 m : colombages, toit de chaume épais à pignon en façade, ou de tuiles (faîte en travers), cheminée. */
function maison(m: Modele, tuiles: boolean, niveau: NiveauVillage): void {
  const L = 6;
  const P = 5;
  const H = 2.6;
  const c = m.corps;
  c.boite(L + 0.1, 0.35, P + 0.1, tuiles ? K.pierreClaire : K.pierre, 0, 0, 0);
  c.boite(L - 0.2, H, P - 0.2, tuiles ? K.crepi : K.mur, 0, 0, 0);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      if (tuiles) c.boite(0.5, H, 0.5, K.pierreClaire, sx * (L / 2 - 0.2), 0, sz * (P / 2 - 0.2));
      else c.boite(0.36, H, 0.36, K.bois, sx * (L / 2 - 0.13), 0, sz * (P / 2 - 0.13));
    }
    // Sablières en haut des murs, traverse à mi-hauteur sur les côtés
    c.boite(L, 0.3, 0.14, K.bois, 0, H - 0.3, sx * (P / 2 - 0.05));
    c.boite(0.14, 0.3, P, K.bois, sx * (L / 2 - 0.05), H - 0.3, 0);
    if (!tuiles) c.boite(0.12, 0.24, P - 0.4, K.bois, sx * (L / 2 - 0.06), 0.75, 0);
  }
  m.porte(0.75, P / 2 - 0.05);
  const fleurs = niveau >= 2;
  m.fenetre(-1.55, 1.5, P / 2 - 0.08, 0, 0.9, 0.9, fleurs);
  m.fenetre(L / 2 - 0.08, 1.5, 0.2, Math.PI / 2);
  m.fenetre(-(L / 2 - 0.08), 1.5, -0.2, -Math.PI / 2);
  m.fenetre(0.4, 1.5, -(P / 2 - 0.08), Math.PI);

  if (tuiles) {
    const hp = P / 2 + 0.5;
    const Ht = 2.4;
    c.prisme(L - 0.2, hp * 2, Ht, L - 0.2, K.crepi, 0, H, 0);
    c.toit(L + 0.9, hp, Ht, [K.tuile, K.tuileSombre, K.tuile], H + 0.05, 0.2, 3);
    c.boite(L + 1.0, 0.24, 0.4, K.tuileSombre, 0, H + Ht + 0.02, 0);
    // Colombage des pignons : poinçon et deux écharpes
    for (const sx of [-1, 1]) {
      const x = sx * (L / 2 - 0.08);
      c.boite(0.1, Ht - 0.45, 0.22, K.bois, x, H, 0);
      for (const sz of [-1, 1]) c.barre(0.1, 1.5, 0.18, K.bois, x, H + 0.7, sz * 0.85, -sz * 0.85);
    }
    m.cheminee(1.7, H + 0.4, -1.0, 2.5, 0.7, K.pierreClaire, K.pierre);
  } else {
    // Chaume : trois rangs épais qui se recouvrent, pignon à colombage au-dessus de la porte
    const hp = L / 2 + 0.45;
    const Ht = 2.9;
    const yT = H - 0.12;
    c.prisme(P - 0.2, hp * 2, Ht, P - 0.2, K.mur, 0, yT, 0, Math.PI / 2);
    c.toit(P + 0.9, hp, Ht, [K.chaumeClair, K.chaume, K.chaumeSombre], yT + 0.05, 0.4, 3, Math.PI / 2);
    c.boite(1.1, 0.36, P + 1.1, K.chaumeClair, 0, yT + Ht - 0.02, 0);
    for (const sz of [-1, 1]) {
      const z = sz * (P / 2 - 0.07);
      c.boite(0.26, Ht - 0.8, 0.14, K.bois, 0, H, z);
      for (const sx of [-1, 1]) c.barre(0.22, 1.9, 0.14, K.bois, sx * 0.85, H + 0.85, z, 0, 0, -sx * 0.82);
    }
    m.cheminee(1.6, H + 0.9, -0.9, 2.5, 0.7, K.cheminee, K.brique);
  }
}

/**
 * Maison du joueur, 6 x 5 m, d'après « Maison médiévale accueillante au potager » : murs clairs à chaînes
 * d'angle en pierre, pignon de bois en façade, toit de tuiles rouges, cheminée de pierre, lanterne près de
 * la porte, volets, petit potager devant la fenêtre et tas de bûches contre le mur droit.
 */
function maisonJoueur(m: Modele): void {
  const L = 6;
  const P = 5;
  const H = 2.6;
  const c = m.corps;
  const xPorte = MAISON_JOUEUR.porteX;
  c.boite(L + 0.1, 0.35, P + 0.1, K.pierre, 0, 0, 0);
  c.boite(L - 0.2, H, P - 0.2, K.crepi, 0, 0, 0);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      // Chaînes d'angle : gros blocs alternés
      for (let i = 0; i < 5; i++) {
        const large = i % 2 === 0;
        c.boite(large ? 0.62 : 0.48, 0.5, large ? 0.48 : 0.62, large ? K.pierreClaire : K.muret, sx * (L / 2 - 0.2), i * 0.5, sz * (P / 2 - 0.2));
      }
    }
    // Sablières épaisses en haut des murs
    c.boite(L + 0.1, 0.32, 0.2, K.bois, 0, H - 0.3, sx * (P / 2 - 0.04));
    c.boite(0.2, 0.32, P + 0.1, K.bois, sx * (L / 2 - 0.04), H - 0.3, 0);
  }

  // Porte sur une marche de pierre, arc de bois, lanterne sur potence à sa gauche
  const zF = P / 2 - 0.05;
  c.boite(1.7, 0.16, 0.5, K.pierreClaire, xPorte, 0.2, zF + 0.3);
  m.porte(xPorte, zF);
  for (const s of [-1, 1]) c.barre(0.5, 0.2, 0.24, K.bois, xPorte + s * 0.5, 2.36, zF, 0, 0, -s * 0.5);
  const xL = xPorte - 1.35;
  c.boite(0.1, 0.5, 0.1, K.fer, xL, 1.85, zF + 0.08);
  c.boite(0.08, 0.08, 0.42, K.fer, xL, 2.27, zF + 0.26);
  c.boite(0.26, 0.06, 0.26, K.fer, xL, 2.12, zF + 0.4);
  m.lampes.boite(0.2, 0.3, 0.2, 0xffffff, xL, 1.82, zF + 0.4);
  c.boite(0.26, 0.06, 0.26, K.fer, xL, 1.76, zF + 0.4);
  m.halos.push({ x: xL, z: zF + 0.9, rayon: 2.2 });

  // Fenêtres à volets
  const fenetreVolets = (x: number, z: number, ry: number): void => {
    m.fenetre(x, 1.5, z, ry);
    const base = matrice(x, 1.5, z, 0, ry, 0);
    for (const s of [-1, 1]) {
      c.ajouter(new THREE.BoxGeometry(0.42, 1.1, 0.07), K.panneau, base.clone().multiply(matrice(s * 0.82, 0, 0.05)));
      for (const dy of [-0.32, 0.32]) c.ajouter(new THREE.BoxGeometry(0.46, 0.1, 0.05), K.boisFonce, base.clone().multiply(matrice(s * 0.82, dy, 0.1)));
    }
  };
  fenetreVolets(1.55, P / 2 - 0.08, 0);
  fenetreVolets(L / 2 - 0.08, 1.3, Math.PI / 2);
  fenetreVolets(-(L / 2 - 0.08), -0.2, -Math.PI / 2);
  m.fenetre(0.4, 1.5, -(P / 2 - 0.08), Math.PI);

  // Toit de tuiles rouges, pignon de planches à colombage au-dessus de la porte
  const hp = L / 2 + 0.45;
  const Ht = 2.9;
  const yT = H - 0.02;
  c.prisme(P - 0.2, hp * 2, Ht, P - 0.2, K.panneau, 0, yT, 0, Math.PI / 2);
  c.toit(P + 0.9, hp, Ht, [K.tuileRouge, K.tuileRougeSombre, K.tuileRouge, K.tuileRougeSombre], yT + 0.05, 0.22, 4, Math.PI / 2);
  c.boite(0.5, 0.26, P + 1.1, K.tuileRougeSombre, 0, yT + Ht + 0.02, 0);
  for (const sz of [-1, 1]) {
    const z = sz * (P / 2 - 0.07);
    c.boite(L - 0.6, 0.24, 0.16, K.bois, 0, H + 0.05, z);
    c.boite(0.24, Ht - 0.8, 0.14, K.bois, 0, H + 0.1, z);
    for (const sx of [-1, 1]) {
      c.barre(0.2, 1.7, 0.14, K.bois, sx * 0.8, H + 0.95, z, 0, 0, -sx * 0.82);
      c.boite(0.14, 1.0, 0.12, K.boisFonce, sx * 1.55, H + 0.2, z);
    }
  }
  m.cheminee(1.7, H + 0.7, -0.9, 2.6, 0.75, K.pierreClaire, K.pierre);

  // Potager : bac de planches, un rang de choux, un rang de jeunes pousses
  const pot = MAISON_JOUEUR.potager;
  c.boite(pot.demiLargeur * 2, 0.16, pot.demiProfondeur * 2, K.terreSombre, pot.x, 0, pot.z);
  for (const s of [-1, 1]) {
    c.boite(pot.demiLargeur * 2 + 0.1, 0.24, 0.08, K.bois, pot.x, 0, pot.z + s * pot.demiProfondeur);
    c.boite(0.08, 0.24, pot.demiProfondeur * 2, K.panneau, pot.x + s * pot.demiLargeur, 0, pot.z);
  }
  for (let i = 0; i < 4; i++) {
    const x = pot.x - 0.63 + i * 0.42;
    c.ajouter(new THREE.IcosahedronGeometry(0.2, 0).scale(1, 0.6, 1), K.vertSombre, matrice(x, 0.25, pot.z - 0.26, 0, i, 0), 0.1);
    c.ajouter(new THREE.IcosahedronGeometry(0.13, 0), K.chou, matrice(x, 0.34, pot.z - 0.26, 0.3, i * 2, 0), 0.08);
    for (let f = 0; f < 3; f++) {
      const a = i + (f * Math.PI * 2) / 3;
      c.cyl(0.004, 0.045, 0.28, 3, f ? K.vert : K.vertSombre, x + Math.sin(a) * 0.05, 0.28, pot.z + 0.27 + Math.cos(a) * 0.05, Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45);
    }
  }

  // Tas de bûches contre le mur droit : deux en bas, une au-dessus, le bout clair vers la façade
  const b = MAISON_JOUEUR.buches;
  const buche = (x: number, y: number): void => {
    c.cyl(0.2, 0.2, b.demiProfondeur * 2, 7, K.bois, x, y, b.z, Math.PI / 2);
    for (const s of [-1, 1]) c.cyl(0.15, 0.15, 0.02, 7, K.boisClair, x, y, b.z + s * (b.demiProfondeur + 0.005), Math.PI / 2);
  };
  buche(b.x - 0.2, 0.2);
  buche(b.x + 0.2, 0.2);
  buche(b.x, 0.54);

  // Touffes d'herbe au pied des murs
  for (const [x, z] of [[-2.7, 2.75], [-3.2, 1.2], [3.15, 2.2], [2.9, 2.75], [-3.15, -1.6]] as const) {
    for (let f = 0; f < 3; f++) c.cyl(0.004, 0.06, 0.34, 3, f ? K.vert : K.vertSombre, x + (f - 1) * 0.09, 0.17, z, 0, f, (f - 1) * 0.35);
  }
}

/** Forge de 7 x 6 m, ouverte en façade : foyer voûté en pierre, cheminée, soufflet, enclume sur billot, table à outils. */
function forge(m: Modele, niveau: NiveauVillage): void {
  const c = m.corps;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      // Dés de pierre évasés sous les poteaux
      c.cyl(0.36, 0.52, 0.7, 4, K.pierre, sx * 3.1, 0.35, sz * 2.6, 0, Math.PI / 4);
      c.boite(0.36, 2.25, 0.36, K.bois, sx * 3.1, 0.7, sz * 2.6);
    }
    c.boite(0.32, 0.32, 5.5, K.bois, sx * 3.1, 2.75, 0);
    c.boite(6.6, 0.32, 0.32, K.bois, 0, 2.75, sx * 2.6);
    // Jambes de force des poteaux de façade (de face et de côté), poinçon du pignon
    c.barre(0.18, 1.1, 0.18, K.bois, sx * 2.7, 2.42, 2.6, 0, 0, sx * (Math.PI / 4));
    c.barre(0.18, 1.1, 0.18, K.bois, sx * 3.1, 2.42, 2.2, Math.PI / 4, 0, 0);
    c.boite(0.22, 1.8, 0.22, K.bois, sx * 3.1, 3.05, 0);
  }
  // Mur du fond (soubassement de gros blocs, torchis au-dessus) et muret de côté
  for (let i = 0; i < 6; i++) {
    c.boite(1.06, 0.5, 0.5 + (i % 2) * 0.06, i % 2 ? K.pierre : K.pierreFoncee, -2.65 + i * 1.06, 0, -2.75);
    c.boite(1.06, 0.5, 0.5 + ((i + 1) % 2) * 0.06, i % 2 ? K.pierreFoncee : K.pierre, -2.65 + i * 1.06, 0.5, -2.75);
  }
  c.boite(6.3, 1.9, 0.25, K.mur, 0, 1.0, -2.8);
  for (let i = 0; i < 3; i++) c.boite(0.5 + (i % 2) * 0.06, 1.0 - (i === 2 ? 0.3 : 0), 0.8, i % 2 ? K.pierreFoncee : K.pierre, -3.1, 0, -2.2 + i * 0.8);
  // Foyer : massif de pierre, voûte de claveaux, braises, hotte et cheminée à ressauts
  const fx = 0.4;
  c.boite(2.4, 1.6, 1.5, K.pierreFoncee, fx, 0, -1.95);
  for (const s of [-1, 1]) {
    c.boite(0.3, 0.42, 0.24, K.pierre, fx + s * 0.72, 0.3, -1.14);
    c.boite(0.26, 0.4, 0.22, K.pierreClaire, fx + s * 0.72, 0.72, -1.14);
    c.boite(0.42, 0.3, 0.2, K.pierre, fx + s * 1.0, 0, -1.16);
  }
  for (let i = 0; i < 5; i++) {
    // Claveaux de la voûte, en demi-cercle au-dessus de l'ouverture
    const a = (-0.5 + i / 4) * 2.2;
    c.barre(0.38, 0.3, 0.24, i % 2 ? K.pierreClaire : K.pierre, fx + Math.sin(a) * 0.72, 1.12 + Math.cos(a) * 0.36, -1.08, 0, 0, -a);
  }
  c.boite(1.7, 0.22, 0.34, K.pierre, fx, 0.3, -1.08);
  m.braises.boite(1.2, 0.95, 0.06, K.feuRouge, fx, 0.5, -1.19);
  m.braises.boite(0.95, 0.12, 0.2, K.braise, fx, 0.5, -1.1);
  for (const [bx, bz] of [[-0.3, -1.02], [0, -1.0], [0.28, -1.03]] as const) {
    m.braises.ajouter(new THREE.IcosahedronGeometry(0.11, 0), K.feuRouge, matrice(fx + bx, 0.6, bz, bx, bx * 3, 0), 0.15);
  }
  c.ajouter(new THREE.CylinderGeometry(0.66, 1.25, 1.4, 4, 1), K.pierreFoncee, matrice(fx, 2.3, -1.95, 0, Math.PI / 4, 0));
  c.boite(1.0, 2.2, 1.0, K.pierreFoncee, fx, 2.9, -1.95);
  c.boite(1.2, 0.35, 1.2, K.pierre, fx, 3.9, -1.95);
  c.boite(0.9, 0.5, 0.9, K.pierreFoncee, fx, 5.1, -1.95);
  c.boite(1.15, 0.26, 1.15, K.pierre, fx, 5.6, -1.95);
  m.fumees.push({ x: fx, y: 6.2, z: -1.95 });
  m.flammes.push({ x: fx, y: 0.6, z: -1.08, taille: 0.55 });
  m.lumieres.push({ x: fx, y: 1.1, z: -0.5 });
  // Enclume sur son billot : pied, taille étroite, table et corne
  const ex = FORGE_ENCLUME.x;
  const ez = FORGE_ENCLUME.z;
  c.cyl(0.36, 0.44, 0.5, 8, K.bois, ex, 0.25, ez);
  c.cyl(0.33, 0.33, 0.03, 8, K.boisClair, ex, 0.51, ez);
  c.boite(0.34, 0.12, 0.52, K.fer, ex, 0.5, ez);
  c.boite(0.18, 0.16, 0.3, K.fer, ex, 0.62, ez);
  c.boite(0.36, 0.2, 0.74, K.ferClair, ex, 0.78, ez);
  c.cyl(0.02, 0.1, 0.4, 5, K.ferClair, ex, 0.89, ez + 0.56, Math.PI / 2);
  // Table et râtelier à outils
  c.boite(1.4, 0.14, 0.8, K.boisClair, -2.35, 0.78, -0.8);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.boite(0.16, 0.78, 0.16, K.bois, -2.35 + sx * 0.56, 0, -0.8 + sz * 0.28);
  c.boite(0.34, 0.14, 0.2, K.fer, -2.3, 0.92, -0.8);
  c.boite(1.6, 0.14, 0.1, K.bois, -1.9, 2.0, -2.64);
  for (const tx of [-2.45, -2.0]) {
    // Marteaux pendus
    c.boite(0.07, 0.55, 0.06, K.boisClair, tx, 1.42, -2.62);
    c.boite(0.26, 0.15, 0.12, K.fer, tx, 1.86, -2.6);
  }
  for (const s of [-1, 1]) c.barre(0.05, 0.7, 0.05, K.fer, -1.5 + s * 0.06, 1.65, -2.62, 0, 0, s * 0.12);
  // Seau cerclé près de la table
  c.cyl(0.3, 0.24, 0.5, 8, K.boisClair, -1.3, 0.25, -1.85);
  c.cyl(0.31, 0.29, 0.07, 8, K.ferClair, -1.3, 0.4, -1.85);
  c.cyl(0.26, 0.26, 0.02, 8, K.eau, -1.3, 0.47, -1.85);
  // Soufflet sur son bâti, tourné vers le foyer
  for (const sz of [-1, 1]) c.boite(0.14, 1.0, 0.14, K.bois, 2.5, 0, -1.9 + sz * 0.42);
  c.boite(0.14, 0.12, 0.98, K.bois, 2.5, 0.42, -1.9);
  c.cyl(0.1, 0.56, 1.15, 8, K.soufflet, 2.38, 0.95, -1.9, 0, 0, Math.PI / 2);
  c.cyl(0.56, 0.3, 0.2, 8, K.soufflet, 3.04, 0.95, -1.9, 0, 0, Math.PI / 2);
  c.cyl(0.06, 0.06, 0.3, 6, K.fer, 1.72, 0.95, -1.9, 0, 0, Math.PI / 2);
  c.barre(0.1, 1.2, 0.1, K.boisClair, 2.75, 1.5, -1.9, 0, 0, -0.6);
  // Toit à deux pans : larges planches inégales, puis tuiles quand le village prospère
  if (niveau >= 3) {
    c.toit(8.0, 3.6, 2.0, [K.tuile, K.tuileSombre, K.tuile], 3.08, 0.2, 3);
  } else {
    const angle = Math.atan2(2.0, 3.6);
    const pente = Math.hypot(3.6, 2.0);
    for (const cote of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const longueur = pente + 0.15 + ((i * 3 + (cote > 0 ? 1 : 0)) % 4) * 0.09;
        const t = (longueur / 2 - 0.05) / pente;
        c.barre(8.0 / 7 - 0.05, 0.18, longueur, i % 2 ? K.toitBois : K.toitBoisClair, -4 + (i + 0.5) * (8 / 7), 3.08 + 2.0 * (1 - t), cote * 3.6 * t, cote * angle);
      }
    }
  }
  c.boite(8.2, 0.24, 0.4, niveau >= 3 ? K.tuileSombre : K.bois, 0, 5.03, 0);
}

/** Auberge de 10 x 8 m : rez-de-chaussée en pierre, étage à pans de bois, lucarne, enseigne à la chope. */
function auberge(m: Modele): void {
  const c = m.corps;
  c.boite(9.9, 0.4, 7.9, K.pierreClaire, 0, 0, 0);
  c.boite(9.6, 2.8, 7.6, K.crepi, 0, 0, 0);
  // Chaînes d'angle : gros blocs en quinconce
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        c.boite(i % 2 ? 0.9 : 0.6, 0.56, i % 2 ? 0.6 : 0.9, i % 2 ? K.pierreClaire : K.cheminee, sx * (i % 2 ? 4.45 : 4.6), i * 0.56, sz * (i % 2 ? 3.6 : 3.45));
      }
    }
  }
  c.boite(10.3, 0.34, 8.3, K.bois, 0, 2.7, 0);
  // Corbeaux sous l'encorbellement de la façade
  for (const px of [-4.2, -2.1, 2.1, 4.2]) c.boite(0.26, 0.3, 0.3, K.bois, px, 2.42, 3.92);
  c.boite(10, 2.3, 8, K.panneau, 0, 3.0, 0);
  for (const px of [-5, -1.7, 1.7, 5]) for (const sz of [-1, 1]) c.boite(0.3, 2.3, 0.3, K.bois, px, 3.0, sz * 4.0);
  for (const sx of [-1, 1]) {
    c.boite(0.3, 2.3, 0.3, K.bois, sx * 5, 3.0, 0);
    // Écharpes en biais aux angles de l'étage (façade et arrière)
    for (const sz of [-1, 1]) c.barre(0.2, 1.7, 0.12, K.bois, sx * 4.2, 3.75, sz * 4.03, 0, 0, sx * 0.75);
  }
  c.boite(10.3, 0.28, 8.3, K.bois, 0, 5.2, 0);
  // Toit de tuiles, pignons, lucarne au-dessus de la porte
  const hp = 4.7;
  const Ht = 3.2;
  c.prisme(9.9, hp * 2, Ht, 9.9, K.panneau, 0, 5.4, 0);
  c.toit(11.2, hp, Ht, [K.tuile, K.tuileSombre, K.tuile, K.tuileSombre], 5.45, 0.22, 4);
  c.boite(11.3, 0.26, 0.46, K.tuileSombre, 0, 5.42 + Ht, 0);
  // Grand pignon de façade au-dessus de la porte : toit de tuiles, colombage et fenêtre
  c.prisme(4.4, 5.0, 2.6, 4.4, K.tuile, 0, 5.35, 2.2, Math.PI / 2);
  c.prisme(4.4, 4.3, 2.24, 4.4, K.panneau, 0, 5.35, 2.26, Math.PI / 2);
  c.boite(4.3, 0.22, 0.12, K.bois, 0, 5.4, 4.42);
  c.boite(0.2, 0.7, 0.12, K.bois, 0, 6.85, 4.42);
  for (const s of [-1, 1]) c.barre(0.18, 1.3, 0.12, K.bois, s * 1.35, 6.05, 4.42, 0, 0, s * 0.75);
  m.fenetre(0, 6.15, 4.4, 0, 0.7, 0.7);
  // Porte double sous son arche de pierre
  for (const s of [-1, 1]) c.boite(0.42, 2.0, 0.34, K.pierreClaire, s * 1.2, 0, 3.8);
  for (let i = 0; i < 7; i++) {
    // Claveaux de l'arche
    const a = (-0.5 + i / 6) * 2.5;
    c.barre(0.5, 0.42, 0.34, i % 2 ? K.cheminee : K.pierreClaire, Math.sin(a) * 1.2, 2.0 + Math.cos(a) * 0.62, 3.8, 0, 0, -a);
  }
  c.boite(2.0, 2.45, 0.2, K.crepi, 0, 0, 3.78);
  for (let i = 0; i < 4; i++) c.boite(0.5, 2.3 - Math.abs(i - 1.5) * 0.16, 0.24 + (i % 2) * 0.02, i % 2 ? K.porteClaire : K.porte, (i - 1.5) * 0.5, 0, 3.8);
  for (const s of [-1, 1]) {
    // Heurtoirs en anneau
    c.cyl(0.13, 0.13, 0.05, 8, K.ferClair, s * 0.3, 1.05, 3.96, Math.PI / 2);
    c.cyl(0.07, 0.07, 0.06, 8, K.porte, s * 0.3, 1.05, 3.965, Math.PI / 2);
  }
  // Fenêtres : rez-de-chaussée, étage, côtés et arrière
  for (const s of [-1, 1]) {
    m.fenetre(s * 3.1, 1.55, 3.84, 0, 1.0, 1.1, true);
    m.fenetre(s * 3.3, 4.15, 4.04, 0);
    m.fenetre(s * 4.84, 1.55, 1.6, (s * Math.PI) / 2, 1.0, 1.1);
    m.fenetre(s * 5.04, 4.15, 2.0, (s * Math.PI) / 2);
    m.fenetre(s * 5.04, 4.15, -2.0, (s * Math.PI) / 2);
    m.fenetre(s * 2.6, 4.15, -4.04, Math.PI);
  }
  // Enseigne : potence et panneau à huit côtés, chope sur les deux faces
  c.boite(0.2, 0.2, 1.6, K.boisFonce, 4.3, 3.3, 4.75);
  c.barre(0.14, 0.9, 0.14, K.boisFonce, 4.3, 3.0, 4.35, Math.PI / 4);
  for (const dz of [-0.25, 0.25]) c.boite(0.05, 0.3, 0.05, K.ferClair, 4.3, 3.0, 5.0 + dz);
  c.cyl(0.58, 0.58, 0.12, 8, K.panneau, 4.3, 2.45, 5.0, 0, 0, Math.PI / 2);
  for (const s of [-1, 1]) {
    c.boite(0.04, 0.36, 0.3, K.chope, 4.3 + s * 0.07, 2.2, 5.0);
    c.boite(0.04, 0.12, 0.38, K.mousse, 4.3 + s * 0.07, 2.56, 5.0);
  }
  // Tonneaux et banc devant la façade (obstacles déclarés dans regles/village.ts)
  m.tonneau(-3.3, 4.55, 0.45, 1.0);
  m.tonneau(-2.35, 4.75, 0.38, 0.8);
  c.boite(1.6, 0.1, 0.45, K.boisClair, 3, 0.42, 4.5);
  for (const s of [-1, 1]) c.boite(0.12, 0.42, 0.4, K.bois, 3 + s * 0.6, 0, 4.5);
  m.cheminee(-3.3, 6.4, -1.2, 2.7, 0.9, K.cheminee, K.brique);
}

/** Coffre bombé cerclé de fer, ferrures d'angle boulonnées et serrure (image « Coffre et établi de menuisier »). */
function coffre(m: Modele): void {
  const c = m.corps;
  const couvercle = (rayon: number, longueur: number, couleur: number, x: number) =>
    c.ajouter(
      new THREE.CylinderGeometry(rayon, rayon, longueur, 8, 1, false, 0, Math.PI),
      couleur,
      matrice(x, 0.5, 0, 0, 0, Math.PI / 2),
    );
  c.boite(1.0, 0.5, 0.62, K.coffre, 0, 0, 0);
  couvercle(0.31, 1.0, K.coffre, 0);
  c.boite(1.05, 0.08, 0.67, K.fer, 0, 0.44, 0);
  for (const s of [-1, 1]) {
    c.boite(0.12, 0.5, 0.67, K.fer, s * 0.34, 0, 0);
    couvercle(0.34, 0.12, K.fer, s * 0.34);
    for (const sz of [-1, 1]) {
      // Ferrures d'angle au pied et boulons
      c.boite(0.2, 0.14, 0.1, K.fer, s * 0.42, 0, sz * 0.29);
      c.boite(0.07, 0.07, 0.04, K.ferClair, s * 0.34, 0.1, sz * 0.335);
      c.boite(0.07, 0.07, 0.04, K.ferClair, s * 0.34, 0.33, sz * 0.335);
    }
  }
  c.boite(0.2, 0.26, 0.05, K.ferClair, 0, 0.28, 0.335);
  c.boite(0.045, 0.1, 0.06, K.boisFonce, 0, 0.33, 0.34);
}

/** Établi de menuisier : plateau épais, pieds évasés, étau à vis, scie et marteau posés. */
function etabli(m: Modele): void {
  const c = m.corps;
  c.boite(1.86, 0.2, 0.9, K.etabli, 0, 0.74, 0);
  for (const sx of [-1, 1]) {
    // Pieds plus larges en bas qu'en haut
    for (const sz of [-1, 1]) c.cyl(0.13, 0.2, 0.74, 4, K.etabli, sx * 0.7, 0.37, sz * 0.28, 0, Math.PI / 4);
    c.boite(0.12, 0.12, 0.56, K.etabli, sx * 0.7, 0.24, 0);
  }
  c.boite(1.4, 0.12, 0.12, K.etabli, 0, 0.24, 0);
  // Étau : mors fixe, mors mobile, vis et sa poignée
  c.boite(0.36, 0.26, 0.1, K.fer, -0.35, 0.68, 0.47);
  c.boite(0.36, 0.24, 0.07, K.ferClair, -0.35, 0.69, 0.57);
  c.cyl(0.035, 0.035, 0.24, 6, K.ferClair, -0.35, 0.78, 0.7, Math.PI / 2);
  c.cyl(0.025, 0.025, 0.34, 6, K.ferClair, -0.35, 0.78, 0.82, 0, 0, Math.PI / 2);
  // Scie (lame, dents, poignée évidée) et marteau
  c.boite(0.7, 0.02, 0.15, K.acier, -0.15, 0.94, -0.1, 0.35);
  for (let i = 0; i < 6; i++) {
    const t = -0.3 + i * 0.12;
    c.cyl(0.001, 0.05, 0.07, 3, K.acier, -0.15 + t * Math.cos(0.35) + 0.1 * Math.sin(0.35), 0.95, -0.1 - t * Math.sin(0.35) + 0.1 * Math.cos(0.35), Math.PI / 2, 0.35);
  }
  for (const [dx, dz, l, p] of [[0.36, 0.07, 0.2, 0.05], [0.36, -0.09, 0.2, 0.05], [0.44, -0.01, 0.05, 0.2]] as const) {
    c.boite(l, 0.05, p, K.boisClair, -0.15 + dx * Math.cos(0.35) + dz * Math.sin(0.35), 0.94, -0.1 - dx * Math.sin(0.35) + dz * Math.cos(0.35), 0.35);
  }
  c.boite(0.44, 0.06, 0.07, K.boisClair, 0.5, 0.94, 0.12, -0.5);
  c.boite(0.12, 0.13, 0.26, K.fer, 0.68, 0.94, 0.22, -0.5);
}

/** Toit à deux pans en planches inégales (faîte le long de x, à l'aplomb de `z`) : `hp` = demi-portée, `H` = hauteur du faîte au-dessus de y. */
function toitPlanches(c: Formes, L: number, hp: number, H: number, y: number, planches: number, epaisseur: number, z = 0): void {
  const angle = Math.atan2(H, hp);
  const pente = Math.hypot(hp, H);
  const largeur = L / planches;
  for (const cote of [-1, 1]) {
    for (let i = 0; i < planches; i++) {
      // Chaque planche dépasse plus ou moins à l'égout
      const longueur = pente * (1.05 + ((i * 3 + (cote > 0 ? 1 : 0)) % 4) * 0.035);
      const t = (longueur / 2 - 0.03) / pente;
      c.barre(largeur - 0.03, epaisseur, longueur, i % 2 ? K.toitBois : K.toitBoisClair, -L / 2 + (i + 0.5) * largeur, y + H * (1 - t), z + cote * hp * t, cote * angle);
    }
  }
}

/** Puits : margelle de gros blocs en quinconce, treuil à manivelle, seau cerclé pendu à sa corde, petit toit de planches (de tuiles au niveau 3). */
function puits(m: Modele, niveau: NiveauVillage): void {
  const c = m.corps;
  const pans = 10;
  const pas = (Math.PI * 2) / pans;
  // Eau sombre au fond, deux rangs de blocs décalés, puis des dalles claires sur le dessus
  c.cyl(0.8, 0.8, 0.5, pans, K.eau, 0, 0.25, 0);
  for (let rang = 0; rang < 2; rang++) {
    for (let i = 0; i < pans; i++) {
      const a = (i + rang * 0.5) * pas;
      c.boite(0.7, 0.44, 0.36 + ((i + rang) % 3) * 0.02, (i + rang) % 2 ? K.pierre : K.pierreFoncee, Math.sin(a) * 0.9, rang * 0.43, Math.cos(a) * 0.9, a);
    }
  }
  for (let i = 0; i < pans; i++) {
    const a = i * pas;
    c.boite(0.68, 0.12, 0.42, i % 2 ? K.muret : K.pierreClaire, Math.sin(a) * 0.9, 0.86, Math.cos(a) * 0.9, a);
  }
  // Deux poteaux pris dans la margelle, entrait et jambes de force sous le toit
  for (const s of [-1, 1]) {
    c.boite(0.2, 2.45, 0.2, K.bois, s * 0.98, 0, 0);
    c.boite(0.16, 0.14, 1.6, K.bois, s * 0.98, 2.4, 0);
    for (const sz of [-1, 1]) c.barre(0.1, 0.62, 0.1, K.boisFonce, s * 0.98, 2.2, sz * 0.24, sz * 0.8);
    // Pignon de bois plein sous le toit
    c.prisme(0.1, 1.7, 0.62, 0.1, K.boisFonce, s * 0.98, 2.54, 0);
  }
  // Treuil : tambour, corde enroulée, manivelle de fer
  c.cyl(0.1, 0.1, 1.76, 8, K.boisFonce, 0, 1.7, 0, 0, 0, Math.PI / 2);
  c.cyl(0.135, 0.135, 0.36, 8, K.corde, 0, 1.7, 0, 0, 0, Math.PI / 2);
  c.cyl(0.03, 0.03, 0.14, 6, K.fer, 1.14, 1.7, 0, 0, 0, Math.PI / 2);
  c.boite(0.04, 0.32, 0.05, K.fer, 1.2, 1.4, 0);
  c.cyl(0.03, 0.03, 0.12, 6, K.boisClair, 1.27, 1.42, 0, 0, 0, Math.PI / 2);
  // Corde et seau cerclé de fer, avec son anse
  c.boite(0.03, 0.2, 0.03, K.corde, 0, 1.42, 0);
  c.cyl(0.2, 0.15, 0.3, 8, K.boisClair, 0, 1.13, 0);
  c.cyl(0.205, 0.192, 0.05, 8, K.ferClair, 0, 1.22, 0);
  c.cyl(0.172, 0.162, 0.05, 8, K.ferClair, 0, 1.04, 0);
  for (const s of [-1, 1]) c.barre(0.025, 0.24, 0.025, K.fer, s * 0.09, 1.35, 0, 0, 0, s * 0.9);
  // Toit
  if (niveau >= 3) {
    c.toit(2.9, 1.0, 0.75, [K.tuile, K.tuileSombre], 2.52, 0.12, 2);
    c.boite(3.0, 0.14, 0.26, K.tuileSombre, 0, 3.24, 0);
  } else {
    toitPlanches(c, 2.9, 1.0, 0.75, 2.56, 5, 0.1);
    c.boite(3.0, 0.12, 0.2, K.bois, 0, 3.27, 0);
  }
}

function feuDeCamp(m: Modele): void {
  const c = m.corps;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    c.ajouter(new THREE.IcosahedronGeometry(0.2, 0), K.pierre, matrice(Math.sin(a) * 0.58, 0.1, Math.cos(a) * 0.58, 0, a, 0), 0.1);
  }
  for (const a of [0.3, 1.4, 2.5]) c.barre(0.95, 0.14, 0.14, K.boisFonce, 0, 0.12, 0, 0, a, 0.12);
  m.braises.cyl(0.3, 0.36, 0.08, 7, K.braise, 0, 0.06, 0);
  m.flammes.push({ x: 0, y: 0.1, z: 0, taille: 1 });
  m.lumieres.push({ x: 0, y: 1.0, z: 0 });
}

function souche(m: Modele): void {
  m.corps.cyl(0.29, 0.34, 0.45, 8, K.bois, 0, 0.225, 0);
  m.corps.cyl(0.26, 0.26, 0.03, 8, K.corde, 0, 0.46, 0);
}

/** Lanterne de fer pendue à une potence, sur un dé de pierre ; elle éclaire le sol la nuit. */
function lanterne(m: Modele): void {
  const c = m.corps;
  // Dé de pierre, poteau qui s'affine, potence et jambe de force
  c.cyl(0.13, 0.2, 0.3, 4, K.pierre, 0, 0.15, 0, 0, Math.PI / 4);
  c.cyl(0.075, 0.1, 2.55, 4, K.boisFonce, 0, 1.55, 0, 0, Math.PI / 4);
  c.boite(0.2, 0.07, 0.2, K.bois, 0, 2.8, 0);
  c.boite(0.11, 0.11, 0.9, K.boisFonce, 0, 2.48, 0.33);
  c.barre(0.08, 0.62, 0.08, K.bois, 0, 2.25, 0.24, Math.PI / 4);
  // Lanterne : anneau, chapeau pointu, cage de fer autour du verre, culot
  c.boite(0.03, 0.12, 0.03, K.fer, 0, 2.36, 0.6);
  c.cyl(0.02, 0.2, 0.16, 4, K.fer, 0, 2.3, 0.6, 0, Math.PI / 4);
  c.boite(0.32, 0.04, 0.32, K.fer, 0, 2.19, 0.6);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.boite(0.03, 0.34, 0.03, K.fer, sx * 0.115, 1.86, 0.6 + sz * 0.115);
  m.lampes.boite(0.2, 0.34, 0.2, 0xffffff, 0, 1.86, 0.6);
  c.boite(0.28, 0.05, 0.28, K.fer, 0, 1.82, 0.6);
  c.cyl(0.07, 0.02, 0.07, 4, K.fer, 0, 1.785, 0.6, 0, Math.PI / 4);
  m.halos.push({ x: 0, z: 0.6, rayon: 3.2 });
}

/** Tronçon de clôture en bois : gros poteaux à tête taillée et deux lisses de planches un peu de travers. */
function cloture(m: Modele, demiLongueur: number): void {
  const c = m.corps;
  [-demiLongueur, 0].forEach((x, k) => {
    const h = 1.1 + k * 0.07;
    c.boite(0.26, h, 0.26, K.bois, x, 0, 0);
    c.cyl(0.07, 0.184, 0.14, 4, K.boisClair, x, h + 0.07, 0, 0, Math.PI / 4);
    // Chevilles de fer à hauteur des lisses, sur les deux faces
    for (const y of [0.4, 0.8]) for (const sz of [-1, 1]) c.boite(0.05, 0.05, 0.02, K.fer, x, y, sz * 0.135);
  });
  // Poteau de bout, plus mince : il disparaît dans le premier poteau du tronçon voisin et ferme la
  // clôture là où elle s'arrête (sorties du village)
  c.boite(0.2, 1.06, 0.2, K.bois, demiLongueur, 0, 0);
  c.cyl(0.05, 0.141, 0.11, 4, K.boisClair, demiLongueur, 1.115, 0, 0, Math.PI / 4);
  // Les lisses sont d'une seule planche par travée, chacune avec sa teinte et sa pente
  let n = 0;
  for (const cx of [-demiLongueur / 2, demiLongueur / 2]) {
    for (const y of [0.42, 0.82]) {
      c.barre(demiLongueur + 0.04, 0.17, 0.09, n % 3 ? K.boisClair : K.bois, cx, y + 0.01, 0, 0, 0, (n % 2 ? 1 : -1) * 0.02);
      n++;
    }
  }
}

/** Tronçon de muret : deux rangs de gros blocs en quinconce, chaperon de dalles, piliers coiffés aux deux bouts. */
function muret(m: Modele, demiLongueur: number): void {
  const c = m.corps;
  const n = Math.max(2, Math.round(demiLongueur * 2));
  const w = (demiLongueur * 2) / n;
  const teintes = [K.muret, K.pierre, K.pierreClaire, K.muret, K.pierreFoncee];
  for (let i = 0; i < n; i++) c.boite(w, 0.48, 0.5 + (i % 3) * 0.03, teintes[i % 5], -demiLongueur + (i + 0.5) * w, 0, 0);
  for (let i = 0; i <= n; i++) {
    // Rang du dessus décalé d'un demi-bloc ; les demi-blocs des bouts s'arrêtent aux piliers
    const bout = i === 0 ? 1 : i === n ? -1 : 0;
    c.boite(bout ? w / 2 : w, 0.46, 0.5 + ((i + 1) % 3) * 0.03, teintes[(i + 2) % 5], -demiLongueur + i * w + (bout * w) / 4, 0.48, 0);
  }
  for (let i = 0; i < n; i++) c.boite(w, 0.12, 0.6, i % 2 ? K.pierreClaire : K.cheminee, -demiLongueur + (i + 0.5) * w, 0.94, 0);
  for (const x of [-demiLongueur, demiLongueur]) {
    c.boite(0.9, 0.22, 0.9, K.pierreFoncee, x, 0, 0);
    c.boite(0.8, 1.1, 0.8, K.muret, x, 0.22, 0);
    c.boite(0.95, 0.14, 0.95, K.pierreClaire, x, 1.32, 0);
    c.cyl(0.12, 0.56, 0.16, 4, K.cheminee, x, 1.54, 0, 0, Math.PI / 4);
  }
}

/** Potager de 5 x 4 m : bac de planches, buttes de terre, choux, carottes, pieds de tomates, petite barrière. */
function potager(m: Modele): void {
  const c = m.corps;
  c.boite(4.6, 0.16, 3.6, K.terreSombre, 0, 0, 0);
  for (const s of [-1, 1]) {
    // Bordure de planches, poteaux d'angle taillés en pointe, lisse et piquets
    c.boite(4.84, 0.3, 0.1, s > 0 ? K.bois : K.panneau, 0, 0, s * 1.87);
    c.boite(0.1, 0.3, 3.74, s > 0 ? K.panneau : K.bois, s * 2.37, 0, 0);
    for (const sz of [-1, 1]) {
      c.boite(0.18, 0.78, 0.18, K.bois, s * 2.41, 0, sz * 1.91);
      c.cyl(0.03, 0.127, 0.1, 4, K.boisClair, s * 2.41, 0.83, sz * 1.91, 0, Math.PI / 4);
    }
    c.boite(4.7, 0.09, 0.07, K.boisFonce, 0, 0.56, s * 1.92);
    c.boite(0.07, 0.09, 3.7, K.boisFonce, s * 2.42, 0.56, 0);
    for (let i = 1; i < 8; i++) c.boite(0.09, 0.66, 0.05, i % 2 ? K.boisClair : K.bois, -2.41 + i * 0.6025, 0.04, s * 1.955);
    for (let i = 1; i < 6; i++) c.boite(0.05, 0.66, 0.09, i % 2 ? K.bois : K.boisClair, s * 2.455, 0.04, -1.91 + i * 0.637);
  }
  for (let rang = 0; rang < 4; rang++) {
    const z = -1.2 + rang * 0.8;
    c.boite(4.2, 0.1, 0.46, K.terreButte, 0, 0.12, z);
    for (let i = 0; i < 7; i++) {
      const x = -1.8 + i * 0.6;
      if (rang === 3) {
        // Pieds de tomates sur tuteur, un emplacement sur deux
        if (i % 2) continue;
        c.boite(0.04, 0.85, 0.04, K.boisClair, x, 0.2, z);
        c.ajouter(new THREE.IcosahedronGeometry(0.19, 0), K.vertSombre, matrice(x, 0.48, z, 0, i, 0), 0.1);
        c.ajouter(new THREE.IcosahedronGeometry(0.15, 0), K.vert, matrice(x + 0.03, 0.74, z, 0.4, i * 2, 0), 0.1);
        for (const [dx, dy, dz] of [[0.16, 0.5, 0.08], [-0.12, 0.66, 0.12], [0.05, 0.84, -0.12]] as const) {
          c.ajouter(new THREE.IcosahedronGeometry(0.06, 0), K.fleur, matrice(x + dx, dy, z + dz), 0.08);
        }
      } else if (rang % 2 === 0) {
        // Chou : feuilles sombres étalées, cœur clair
        c.ajouter(new THREE.IcosahedronGeometry(0.23, 0).scale(1, 0.55, 1), K.vertSombre, matrice(x, 0.26, z, 0, i, 0), 0.1);
        c.ajouter(new THREE.IcosahedronGeometry(0.14, 0), K.chou, matrice(x, 0.36, z, 0.3, i * 2, 0), 0.08);
      } else {
        // Carotte : le haut de la racine dépasse, trois fanes en bouquet
        c.cyl(0.07, 0.045, 0.1, 5, K.carotte, x, 0.26, z);
        for (let f = 0; f < 3; f++) {
          const a = i + (f * Math.PI * 2) / 3;
          c.cyl(0.004, 0.04, 0.3, 3, f ? K.vert : K.vertSombre, x + Math.sin(a) * 0.06, 0.44, z + Math.cos(a) * 0.06, Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4);
        }
      }
    }
  }
}

/** Tour de guet en bois : dés de pierre, croix de Saint-André, plancher sur solives, garde-corps, toit de tuiles à deux étages, fanion, échelle. */
function tourDeGuet(m: Modele): void {
  const c = m.corps;
  const d = 1.3;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      c.cyl(0.26, 0.36, 0.5, 4, K.pierre, sx * d, 0.25, sz * d, 0, Math.PI / 4);
      c.boite(0.3, 5.6, 0.3, K.bois, sx * d, 0.4, sz * d);
    }
    // Sur chaque face : traverse basse, croix de Saint-André, solive qui dépasse et sablière du toit
    c.boite(2.6, 0.16, 0.14, K.bois, 0, 0.6, sx * d);
    c.boite(0.14, 0.16, 2.6, K.bois, sx * d, 0.6, 0);
    for (const sens of [-1, 1]) {
      c.barre(0.13, 4.0, 0.13, sens > 0 ? K.boisFonce : K.bois, 0, 2.3, sx * (d + sens * 0.02), 0, 0, sens * 0.62);
      c.barre(0.13, 4.0, 0.13, sens > 0 ? K.boisFonce : K.bois, sx * (d + sens * 0.02), 2.3, 0, sens * 0.62, 0, 0);
    }
    c.boite(3.7, 0.2, 0.2, K.bois, 0, 3.9, sx * d);
    c.boite(0.2, 0.2, 3.7, K.bois, sx * d, 3.9, 0);
    c.boite(3.0, 0.18, 0.18, K.bois, 0, 5.85, sx * d);
    c.boite(0.18, 0.18, 3.0, K.bois, sx * d, 5.85, 0);
    // Garde-corps des côtés et de l'arrière : main courante, lisse et barreaux
    for (const y of [4.62, 5.08]) c.boite(0.1, 0.11, 3.3, y > 5 ? K.bois : K.boisFonce, sx * 1.6, y, 0);
    for (let i = 0; i < 6; i++) c.boite(0.08, 0.88, 0.08, K.boisClair, sx * 1.6, 4.2, -1.5 + i * 0.6);
  }
  for (const y of [4.62, 5.08]) {
    c.boite(3.3, 0.11, 0.1, y > 5 ? K.bois : K.boisFonce, 0, y, -1.6);
    // Côté échelle : le garde-corps s'ouvre au milieu
    for (const s of [-1, 1]) c.boite(1.2, 0.11, 0.1, y > 5 ? K.bois : K.boisFonce, s * 1.05, y, 1.6);
  }
  for (let i = 1; i < 5; i++) c.boite(0.08, 0.88, 0.08, K.boisClair, -1.5 + i * 0.6, 4.2, -1.6);
  for (const s of [-1, 1]) for (const x of [0.5, 1.05]) c.boite(0.08, 0.88, 0.08, K.boisClair, s * x, 4.2, 1.6);
  // Plancher : planches de deux teintes ; celle du bord laisse passer l'échelle
  for (let i = 0; i < 6; i++) c.boite(3.5, 0.12, 0.48, i % 2 ? K.boisClair : K.etabli, 0, 4.1, -1.5 + i * 0.5);
  for (const s of [-1, 1]) c.boite(1.3, 0.12, 0.48, K.boisClair, s * 1.1, 4.1, 1.5);
  // Toit pointu à deux étages de tuiles, poinçon et fanion
  c.cyl(1.5, 2.75, 0.8, 4, K.tuile, 0, 6.4, 0, 0, Math.PI / 4);
  c.cyl(0.04, 1.7, 1.25, 4, K.tuileSombre, 0, 7.35, 0, 0, Math.PI / 4);
  c.boite(0.08, 0.75, 0.08, K.boisFonce, 0, 7.9, 0);
  c.prisme(0.03, 0.55, 0.3, 0.03, K.fleur, 0, 8.3, 0.3, 0);
  // Échelle
  for (const s of [-1, 1]) c.boite(0.09, 4.45, 0.09, K.bois, s * 0.32, 0, 1.52);
  for (let i = 1; i <= 10; i++) c.boite(0.64, 0.07, 0.07, K.boisClair, 0, i * 0.4, 1.52);
}

/** Panneau d'annonces : deux poteaux, un tableau de planches encadré, un auvent de planches et des parchemins cloués. */
function panneauAnnonces(m: Modele): void {
  const c = m.corps;
  for (const s of [-1, 1]) {
    c.boite(0.15, 2.22, 0.15, K.boisFonce, s * 0.55, 0, 0);
    c.cyl(0.03, 0.106, 0.09, 4, K.bois, s * 0.55, 2.265, 0, 0, Math.PI / 4);
  }
  // Tableau : cinq planches de deux teintes, traverses en haut et en bas
  for (let i = 0; i < 5; i++) c.boite(1.0, 0.2, 0.06 + (i % 2) * 0.012, i % 2 ? K.porteClaire : K.panneau, 0, 0.92 + i * 0.2, 0.03);
  for (const y of [0.86, 1.9]) c.boite(1.26, 0.09, 0.13, K.boisFonce, 0, y, 0.04);
  // Auvent
  toitPlanches(c, 1.6, 0.4, 0.26, 2.14, 4, 0.06, 0.04);
  c.boite(1.66, 0.07, 0.1, K.bois, 0, 2.4, 0.04);
  // Parchemins cloués : position, largeur, hauteur, inclinaison, teinte
  const papiers: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
    [-0.3, 1.62, 0.3, 0.36, 0.08, K.mur],
    [0.08, 1.66, 0.26, 0.3, -0.06, K.mousse],
    [0.34, 1.4, 0.24, 0.34, 0.05, K.crepi],
    [-0.12, 1.2, 0.34, 0.26, -0.04, K.mousse],
    [-0.38, 1.16, 0.16, 0.2, 0.12, K.cheminee],
  ];
  papiers.forEach(([x, y, l, h, rot, teinte], k) => {
    const base = matrice(x, y, 0.085, 0, 0, rot);
    const en = (dx: number, dy: number, dz: number) => base.clone().multiply(matrice(dx, dy, dz));
    c.ajouter(new THREE.BoxGeometry(l, h, 0.02), teinte, en(0, 0, 0), 0.03);
    // Lignes d'écriture, clou en haut, sceau de cire sur une annonce sur deux
    for (let i = 0; i < 3; i++) {
      c.ajouter(new THREE.BoxGeometry(l * (i === 2 ? 0.45 : 0.7), 0.022, 0.006), K.terreSombre, en(i === 2 ? -l * 0.125 : 0, h * (0.16 - i * 0.17), 0.012), 0.03);
    }
    c.ajouter(new THREE.BoxGeometry(0.04, 0.04, 0.03), K.fer, en(0, h / 2 - 0.045, 0.012));
    if (k % 2 === 0) c.ajouter(new THREE.CylinderGeometry(0.035, 0.035, 0.016, 6), K.fleur, en(l * 0.28, -h * 0.34, 0.014).multiply(matrice(0, 0, 0, Math.PI / 2)), 0.05);
  });
}

const BATIMENTS: readonly TypeElementVillage[] = ['maison-chaume', 'maison-tuiles', 'maison-joueur', 'forge', 'auberge', 'tour-guet'];

function construireModele(el: ElementVillage, niveau: NiveauVillage, endommage: boolean): Modele {
  const m = new Modele(4000 + el.type.length * 31 + niveau);
  switch (el.type) {
    case 'maison-chaume':
      // Endommagée : tout dans le corps (pas de vitres à allumer la nuit, pas de fumée)
      if (endommage) maisonEndommagee(m.corps);
      else maison(m, false, niveau);
      break;
    case 'maison-tuiles':
      maison(m, true, niveau);
      break;
    case 'maison-joueur':
      maisonJoueur(m);
      break;
    case 'forge':
      forge(m, niveau);
      break;
    case 'auberge':
      auberge(m);
      break;
    case 'coffre':
      coffre(m);
      break;
    case 'etabli':
      etabli(m);
      break;
    case 'puits':
      puits(m, niveau);
      break;
    case 'feu-camp':
      feuDeCamp(m);
      break;
    case 'souche':
      souche(m);
      break;
    case 'lanterne':
      lanterne(m);
      break;
    case 'cloture':
      cloture(m, el.demiLargeur);
      break;
    case 'muret':
      muret(m, el.demiLargeur);
      break;
    case 'potager':
      potager(m);
      break;
    case 'tour-guet':
      tourDeGuet(m);
      break;
    case 'panneau':
      panneauAnnonces(m);
      break;
    case 'forgeron':
    case 'enclos': // (enclos : maillage propre, posé directement par `poser`)
      break;
  }
  return m;
}

// --- Sol : place et chemins -------------------------------------------------------------------

/** Place centrale et chemins : une seule géométrie plate, posée juste au-dessus du sol. */
function construireSol(d: DescriptionVillage): THREE.BufferGeometry {
  const alea = creerAleatoire(9100 + d.niveau);
  const positions: number[] = [];
  const couleurs: number[] = [];
  const paves = d.revetement === 'paves';
  const teinte = new THREE.Color(paves ? K.paves : K.terre);
  const variation = paves ? 0.09 : 0.04;
  const quad = (p: number[][], y: number) => {
    for (const tri of [[0, 1, 2], [0, 2, 3]]) {
      const v = 1 + (alea.suivant() - 0.5) * 2 * variation;
      for (const i of tri) {
        positions.push(p[i][0], y, p[i][1]);
        couleurs.push(teinte.r * v, teinte.g * v, teinte.b * v);
      }
    }
  };

  // Place : grille en anneaux, bord irrégulier. Les hauteurs diffèrent de quelques centimètres
  // entre place, chemins et sentiers pour que leurs recouvrements ne scintillent pas.
  const secteurs = 16;
  const rayons = [0, 0.3, 0.55, 0.8, 1].map((k) => k * d.place.rayon);
  const anneaux = rayons.map((r, i) =>
    Array.from({ length: secteurs }, (_, s) => {
      const a = ((s + (i % 2) * 0.5) / secteurs) * Math.PI * 2;
      const rr = i === rayons.length - 1 ? r + alea.entre(-0.5, 0.5) : r;
      return [d.place.x + Math.sin(a) * rr, d.place.z + Math.cos(a) * rr];
    }),
  );
  for (let i = 0; i + 1 < anneaux.length; i++) {
    for (let s = 0; s < secteurs; s++) {
      const t = (s + 1) % secteurs;
      quad([anneaux[i][s], anneaux[i + 1][s], anneaux[i + 1][t], anneaux[i][t]], 0.03);
    }
  }

  // Chemins : bandes découpées en tronçons, largeur légèrement irrégulière
  for (const c of d.chemins) {
    const longueur = Math.hypot(c.x2 - c.x1, c.z2 - c.z1);
    if (longueur < 0.1) continue;
    const ux = (c.x2 - c.x1) / longueur;
    const uz = (c.z2 - c.z1) / longueur;
    const n = Math.max(1, Math.ceil(longueur / (paves ? 1.6 : 2.6)));
    const y = c.largeur > 2.5 ? 0.02 : 0.01;
    let avant: number[][] | null = null;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * longueur;
      const cx = c.x1 + ux * t;
      const cz = c.z1 + uz * t;
      const g = c.largeur / 2 + alea.entre(-0.22, 0.22);
      const dr = c.largeur / 2 + alea.entre(-0.22, 0.22);
      const bords = [
        [cx + uz * g, cz - ux * g],
        [cx - uz * dr, cz + ux * dr],
      ];
      if (avant) {
        if (paves) {
          // Deux rangées de dalles par tronçon
          const m0 = [(avant[0][0] + avant[1][0]) / 2, (avant[0][1] + avant[1][1]) / 2];
          const m1 = [(bords[0][0] + bords[1][0]) / 2, (bords[0][1] + bords[1][1]) / 2];
          quad([avant[0], bords[0], m1, m0], y);
          quad([m0, m1, bords[1], avant[1]], y);
        } else {
          quad([avant[0], bords[0], bords[1], avant[1]], y);
        }
      }
      avant = bords;
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(couleurs, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// --- Forgeron ---------------------------------------------------------------------------------

// Couleurs du villageois de personnage.ts remplacées pour le forgeron (chemise grise, cheveux sombres)
const TENUE_FORGERON: ReadonlyArray<readonly [number, number]> = [
  [0x7d9455, 0x8b8f96],
  [0x7b4b2e, 0x3b332e],
  [0x7c5a3a, 0x4d4640],
];

export interface Forgeron {
  objet: THREE.Object3D;
  /** Pose de l'habitant (src/regles/habitants.ts) : il marche, bat le fer quand il fait son activité, tourne la tête de l'angle du regard. */
  animer(dt: number, p: { x: number; y: number; z: number; orientation: number; vitesse: number; activite: boolean; regard: number }): void;
}

/** Le forgeron : le modèle du villageois avec d'autres couleurs, une barbe, un tablier de cuir à poche et une masse. */
export function creerForgeron(): Forgeron {
  const perso: Personnage = creerPersonnage();
  const vus = new Set<THREE.Material>();
  let supportOutil: THREE.Object3D | null = null;
  perso.objet.traverse((o) => {
    // Support de l'outil dans la main droite (repéré par sa position dans personnage.ts)
    if (!(o as THREE.Mesh).isMesh && o.position.x === 0 && Math.abs(o.position.y + 0.285) < 1e-6 && Math.abs(o.position.z - 0.01) < 1e-6) {
      supportOutil = o;
    }
    const materiau = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!materiau || Array.isArray(materiau) || vus.has(materiau)) return;
    vus.add(materiau);
    // Cheveux du héros : matériau blanc, couleur portée par chaque facette (deux bruns). On l'assombrit d'un bloc
    // pour retrouver les cheveux sombres du forgeron (même rapport que la teinte principale 0x7b4b2e → 0x3b332e).
    if ((o.name === 'masse' || o.name === 'frange') && o.parent?.name === 'cheveux') {
      materiau.color.setRGB(0x3b / 0x7b, 0x33 / 0x4b, 1);
      return;
    }
    for (const [avant, apres] of TENUE_FORGERON) if (materiau.color.getHex() === avant) materiau.color.setHex(apres);
  });

  // Tablier de cuir : bavette sur le buste, pan sur les cuisses
  const cuir = creerMateriau(0x6b4a2f);
  const tout = perso.objet.children[0];
  const bassin = tout?.children[0];
  const haut = tout?.children[1];
  const cuirSombre = creerMateriau(0x553823);
  let teteForgeron: THREE.Object3D | undefined;
  if (bassin && haut) {
    haut.add(boiteMaille(0.3, 0.3, 0.03, cuir, 0, 0.17, 0.172));
    haut.add(boiteMaille(0.36, 0.06, 0.035, cuirSombre, 0, 0.03, 0.176));
    bassin.add(boiteMaille(0.44, 0.4, 0.03, cuir, 0, -0.19, 0.2));
    bassin.add(boiteMaille(0.22, 0.13, 0.02, cuirSombre, 0, -0.2, 0.22));
    // Barbe en collier et moustache, sur la tête (le seul groupe agrandi du buste)
    const tete = haut.children.find((o) => !(o as THREE.Mesh).isMesh && o.scale.x > 1.05);
    teteForgeron = tete;
    if (tete) {
      const barbe = creerMateriau(0x3b332e);
      tete.add(
        maille(
          fuseau([
            { y: -0.07, rx: 0.07, rz: 0.03, dz: 0.165 },
            { y: 0.0, rx: 0.15, rz: 0.045, dz: 0.165 },
            { y: 0.085, rx: 0.205, rz: 0.04, dz: 0.178 },
          ]),
          barbe,
        ),
      );
      tete.add(boiteMaille(0.16, 0.035, 0.03, barbe, 0, 0.13, 0.206));
    }
  }

  // Marteau à la place de la hache (manche le long de y, tête le long de x, comme les outils du joueur)
  if (supportOutil) {
    const marteau = new THREE.Group();
    marteau.add(
      maille(
        fuseau([
          { y: -0.1, rx: 0.021, rz: 0.018 },
          { y: 0.1, rx: 0.017, rz: 0.015 },
          { y: 0.36, rx: 0.019, rz: 0.016 },
        ]),
        creerMateriau(0x8a6238),
      ),
    );
    // Tête de masse : bloc sombre et deux tables de frappe plus claires
    const fer = creerMateriau(K.fer);
    const table = creerMateriau(K.ferClair);
    marteau.add(boiteMaille(0.16, 0.1, 0.1, fer, 0, 0.32, 0));
    for (const s of [-1, 1]) marteau.add(boiteMaille(0.035, 0.115, 0.115, table, s * 0.092, 0.32, 0));
    (supportOutil as THREE.Object3D).clear();
    (supportOutil as THREE.Object3D).add(marteau);
  }

  const R = CONFIG.village;
  const pose = { x: 0, y: 0, z: 0, orientation: 0, vitesse: 0, auSol: true, nage: false, progressionFrappe: -1 };
  let temps = 0;
  return {
    objet: perso.objet,
    animer(dt, p) {
      pose.x = p.x;
      pose.y = p.y;
      pose.z = p.z;
      pose.orientation = p.orientation;
      pose.vitesse = p.vitesse;
      // À l'enclume : une série de coups de marteau, puis une pause au repos
      const serie = R.coupsForgeron * R.dureeCoupForgeron;
      temps = p.activite ? (temps + dt) % (serie + R.pauseForgeron) : 0;
      pose.progressionFrappe = p.activite && temps < serie ? (temps % R.dureeCoupForgeron) / R.dureeCoupForgeron : -1;
      perso.mettreAJour(dt, pose);
      if (teteForgeron) teteForgeron.rotation.y = p.regard;
    },
  };
}

// --- Rendu du village -------------------------------------------------------------------------

interface ModeleConstruit {
  corps: THREE.BufferGeometry;
  vitres: THREE.BufferGeometry | null;
  lampes: THREE.BufferGeometry | null;
  braises: THREE.BufferGeometry | null;
  source: Modele;
}

export function creerRenduVillage(scene: THREE.Scene, altitude: number): RenduVillage {
  const R = CONFIG.village;
  const matCorps = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  const matVitre = new THREE.MeshLambertMaterial({ color: K.vitreJour, emissive: K.lueur, emissiveIntensity: 0 });
  const matLampe = new THREE.MeshLambertMaterial({ color: K.lampe, emissive: K.lueur, emissiveIntensity: 0.35 });
  const matBraise = new THREE.MeshBasicMaterial({ vertexColors: true });
  const matFlammes = [K.feuRouge, K.braise, K.feuVif].map((c) => new THREE.MeshBasicMaterial({ color: c }));
  const matHalo = new THREE.MeshBasicMaterial({
    color: K.lueur,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const matFumee = new THREE.MeshLambertMaterial({ color: K.fumee, flatShading: true, transparent: true, opacity: 0.55 });
  const matSol = new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const geoFlamme = new THREE.ConeGeometry(0.22, 0.75, 5, 1).translate(0, 0.375, 0);
  const geoFumee = new THREE.IcosahedronGeometry(0.3, 0);
  // Halo : disque lumineux au centre (premier sommet) qui s'éteint vers le bord
  const geoHalo = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2);
  const teintesHalo = new Float32Array(geoHalo.getAttribute('position').count * 3);
  teintesHalo.fill(1, 0, 3);
  geoHalo.setAttribute('color', new THREE.BufferAttribute(teintesHalo, 3));
  const couleurJour = new THREE.Color(K.vitreJour);
  const couleurNuit = new THREE.Color(K.vitreNuit);

  const racine = new THREE.Group();
  racine.name = 'village';
  scene.add(racine);
  const modeles = new Map<string, ModeleConstruit>();
  let geoSol: THREE.BufferGeometry | null = null;

  // Éléments animés du niveau affiché
  let flammes: Array<{ objet: THREE.Object3D; phase: number; taille: number }> = [];
  let fumees: Array<{ objet: THREE.Object3D; x: number; y: number; z: number; phase: number }> = [];
  let lumieres: THREE.PointLight[] = [];
  let temps = 0;
  let niveauAffiche: NiveauVillage | null = null;
  let endommages: ReadonlySet<string> = new Set();

  function modeleDe(el: ElementVillage, niveau: NiveauVillage): ModeleConstruit {
    const endommage = el.type === 'maison-chaume' && endommages.has(el.id);
    const cle = `${el.type}:${niveau}:${el.demiLargeur.toFixed(2)}${endommage ? ':endommage' : ''}`;
    let construit = modeles.get(cle);
    if (!construit) {
      const source = construireModele(el, niveau, endommage);
      construit = {
        corps: source.corps.terminer(),
        vitres: source.vitres.vide ? null : source.vitres.terminer(),
        lampes: source.lampes.vide ? null : source.lampes.terminer(),
        braises: source.braises.vide ? null : source.braises.terminer(),
        source,
      };
      modeles.set(cle, construit);
    }
    return construit;
  }

  /** Enclos des moutons : un seul objet, construit une fois (géométrie et matériau partagés). */
  let enclos: THREE.Group | null = null;

  function poser(el: ElementVillage, niveau: NiveauVillage, rang: number): void {
    if (el.type === 'enclos') {
      enclos ??= creerEnclos();
      const copie = enclos.clone();
      copie.name = el.id;
      copie.position.set(el.x, altitude, el.z);
      copie.rotation.y = el.orientation;
      racine.add(copie);
      return;
    }
    const modele = modeleDe(el, niveau);
    const groupe = new THREE.Group();
    groupe.name = el.id;
    groupe.position.set(el.x, altitude, el.z);
    groupe.rotation.y = el.orientation;
    if (BATIMENTS.includes(el.type)) groupe.userData.peutMasquer = true;

    const corps = new THREE.Mesh(modele.corps, matCorps);
    corps.castShadow = true;
    corps.receiveShadow = true;
    groupe.add(corps);
    if (modele.vitres) groupe.add(new THREE.Mesh(modele.vitres, matVitre));
    if (modele.lampes) groupe.add(new THREE.Mesh(modele.lampes, matLampe));
    if (modele.braises) groupe.add(new THREE.Mesh(modele.braises, matBraise));

    for (const f of modele.source.flammes) {
      const feu = new THREE.Group();
      feu.position.set(f.x, f.y, f.z);
      // Trois langues de feu : rouge large, orange, cœur jaune
      const langues = [
        [0, 0, 1.25, 1.0],
        [0.1, 0.06, 0.95, 1.25],
        [-0.05, -0.04, 0.6, 0.9],
      ];
      langues.forEach(([dx, dz, largeur, hauteur], i) => {
        const langue = new THREE.Mesh(geoFlamme, matFlammes[i]);
        langue.position.set(dx * f.taille, 0, dz * f.taille);
        langue.scale.set(largeur * f.taille, hauteur * f.taille, largeur * f.taille);
        langue.userData.hauteur = hauteur * f.taille;
        feu.add(langue);
      });
      groupe.add(feu);
      flammes.push({ objet: feu, phase: rang * 1.7, taille: f.taille });
    }
    for (const l of modele.source.lumieres) {
      const lumiere = new THREE.PointLight(K.lueur, R.lumiereFeuJour, 16, 2);
      lumiere.position.set(l.x, l.y, l.z);
      groupe.add(lumiere);
      lumieres.push(lumiere);
    }
    for (const s of modele.source.fumees) {
      for (let i = 0; i < 3; i++) {
        const bouffee = new THREE.Mesh(geoFumee, matFumee);
        groupe.add(bouffee);
        fumees.push({ objet: bouffee, x: s.x, y: s.y, z: s.z, phase: i / 3 + rang * 0.37 });
      }
    }
    for (const h of modele.source.halos) {
      const halo = new THREE.Mesh(geoHalo, matHalo);
      halo.position.set(h.x, 0.09, h.z);
      halo.scale.setScalar(h.rayon);
      halo.renderOrder = 2;
      groupe.add(halo);
    }
    racine.add(groupe);
  }

  function definirNiveau(niveau: NiveauVillage): void {
    niveauAffiche = niveau;
    racine.clear();
    flammes = [];
    fumees = [];
    lumieres = [];
    geoSol?.dispose();

    const d = decrireVillage(niveau);
    geoSol = construireSol(d);
    const sol = new THREE.Mesh(geoSol, matSol);
    sol.position.y = altitude + 0.03;
    sol.receiveShadow = true;
    racine.add(sol);

    d.elements.forEach((el, rang) => {
      // Le forgeron (Bertil) est un habitant : son modèle est posé par src/jeu/habitants.ts
      if (el.type !== 'forgeron') poser(el, niveau, rang);
    });
  }

  function definirEndommages(ids: ReadonlySet<string>): void {
    const pareil = ids.size === endommages.size && [...ids].every((id) => endommages.has(id));
    endommages = new Set(ids);
    // Les modèles sont gardés en mémoire : reposer le village ne coûte presque rien
    if (!pareil && niveauAffiche !== null) definirNiveau(niveauAffiche);
  }

  function mettreAJour(dt: number, nuit: number): void {
    temps += dt;
    const n = Math.min(1, Math.max(0, nuit));
    matVitre.color.copy(couleurJour).lerp(couleurNuit, n);
    matVitre.emissiveIntensity = n;
    matLampe.emissiveIntensity = 0.35 + 0.65 * n;
    matHalo.opacity = 0.5 * n;

    for (const f of flammes) {
      f.objet.children.forEach((langue, i) => {
        const t = temps * (7 + i * 2.3) + f.phase + i;
        langue.scale.y = (langue.userData.hauteur as number) * (1 + 0.22 * Math.sin(t) + 0.1 * Math.sin(t * 2.7));
        langue.rotation.y = temps * (1.5 + i);
      });
    }
    lumieres.forEach((lumiere, i) => {
      const base = R.lumiereFeuJour + (R.lumiereFeuNuit - R.lumiereFeuJour) * n;
      lumiere.intensity = base * (0.9 + 0.07 * Math.sin(temps * 9 + i * 2) + 0.05 * Math.sin(temps * 23 + i));
    });
    for (const f of fumees) {
      // Chaque bouffée monte, grossit puis s'efface en rétrécissant
      const u = (temps * 0.16 + f.phase) % 1;
      f.objet.position.set(f.x + u * u * 0.9, f.y + u * 2.6, f.z + Math.sin(u * 5 + f.phase * 9) * 0.15);
      f.objet.scale.setScalar(Math.sin(Math.PI * u) * (0.7 + u * 1.3) + 0.001);
      f.objet.rotation.y = u * 3 + f.phase;
    }
  }

  return {
    definirNiveau,
    definirEndommages,
    mettreAJour,
    liberer() {
      scene.remove(racine);
      racine.clear();
      for (const m of modeles.values()) {
        m.corps.dispose();
        m.vitres?.dispose();
        m.lampes?.dispose();
        m.braises?.dispose();
      }
      modeles.clear();
      enclos?.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      geoSol?.dispose();
      for (const g of [geoFlamme, geoFumee, geoHalo]) g.dispose();
      for (const m of [matCorps, matVitre, matLampe, matBraise, matHalo, matFumee, matSol, ...matFlammes]) m.dispose();
    },
  };
}
