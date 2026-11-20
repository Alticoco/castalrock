// Modèles des ruines, des petites grottes et de leurs coffres (session 3b), d'après les images
// « Ruines enchantées sous la mousse », « Entrée de mine chaleureuse » et « Galerie minière low poly aux cristaux bleus ».
// Les pièces sont décrites en blocs par src/monde/piecesRuines.ts ; ici, tous les blocs d'un site sont fondus en une
// seule géométrie à faces plates (couleurs par sommet), dessinée avec un matériau partagé par tous les sites :
// un site = une commande de dessin (deux s'il a une lanterne ou des éclats de cristal, affichés sans éclairage).
// Ne contient aucune règle de jeu. Aucune lumière n'est ajoutée à la scène.
// Habillage des sites du décor (d'après « Six ruines médiévales » et « Petite grotte aux cristaux bleus ») : pierres
// taillées aux coins rentrés et ébréchés, plaques de mousse sur les pierres du dessus, herbes et pierres tombées au
// pied des murs, lueur bleue des éclats de cristal peinte sur la roche voisine. Tout est tiré de la teinte des blocs
// (donc de la graine), calculé une fois à la création du site, et fondu dans la même géométrie.

import * as THREE from 'three';
import { CONFIG } from '../config';
import { creerAleatoire, type Aleatoire } from '../regles/aleatoire';
import { MATIERES_LUMINEUSES, type Bloc, type Forme, type Matiere } from '../monde/piecesRuines';

export interface GeometriesSite {
  solide: THREE.BufferGeometry;
  /** Lanterne et éclats de cristal (null s'il n'y en a pas) */
  lumineux: THREE.BufferGeometry | null;
}

export interface ModeleCoffre {
  objet: THREE.Group;
  /** Ouverture du couvercle, de 0 (fermé) à 1 (grand ouvert). */
  definirOuverture(t: number): void;
}

export interface ModelesRuines {
  /**
   * Fond les blocs d'un site en géométries (à libérer avec le site). `sol` : altitude du sol en un point du site, par
   * rapport à son centre ; quand il est donné (ruines et grottes du décor), le site est habillé (pierres ébréchées,
   * mousse, herbes, pierres tombées).
   */
  geometries(blocs: readonly Bloc[], sol?: (x: number, z: number) => number): GeometriesSite;
  /** Un petit coffre : ses géométries et ses matériaux sont partagés par tous les coffres. */
  creerCoffre(): ModeleCoffre;
  materiau: THREE.Material;
  materiauLumineux: THREE.Material;
  liberer(): void;
}

/** Sommets (triangles à la suite) d'une forme de base de taille 1. */
function sommetsDe(geometrie: THREE.BufferGeometry): Float32Array {
  const g = geometrie.index ? geometrie.toNonIndexed() : geometrie;
  const sommets = new Float32Array(g.getAttribute('position').array);
  if (g !== geometrie) g.dispose();
  geometrie.dispose();
  return sommets;
}

const VEGETALES: readonly Matiere[] = ['mousse', 'lierre'];
const PIERRES: readonly Matiere[] = ['pierre', 'pierreClaire', 'pierreSombre'];
/** Roches d'une grotte : elles reçoivent la lueur des éclats de cristal voisins. */
const ROCHES: readonly Matiere[] = ['roche', 'rocheSombre', 'rocheLueur', 'terre'];
/** Part de triangles qu'un site habillé peut coûter en plus (1,38 = 38 % de plus au maximum). */
const BUDGET = 1.38;
/** Portée de la lueur d'un éclat de cristal sur la roche, en mètres, et sa force. */
const PORTEE_LUEUR = 2.8;
const FORCE_LUEUR = 0.2;

/** Touffe d'herbe : quatre brins pointus (pyramides sans base) qui s'écartent, dans un cube de taille 1 posé sur y = -0,5. */
function sommetsHerbe(): Float32Array {
  // Pied du brin (x, z), puis sa pointe (x, y, z)
  const brins = [
    [0, 0, 0.02, 0.5, 0.05],
    [0.22, 0.1, 0.48, 0.12, 0.3],
    [-0.2, 0.16, -0.46, 0.0, 0.34],
    [-0.04, -0.22, 0.08, -0.08, -0.48],
  ];
  const s: number[] = [];
  for (const [x, z, px, hauteur, pz] of brins) {
    const r = 0.11;
    const pied = [0, 1, 2].map((k) => [x + Math.cos((k * 2 * Math.PI) / 3 + x * 9) * r, -0.5, z + Math.sin((k * 2 * Math.PI) / 3 + x * 9) * r]);
    for (let k = 0; k < 3; k++) s.push(...pied[(k + 1) % 3], ...pied[k], px, hauteur, pz);
  }
  return new Float32Array(s);
}

/** Vrai pour une pierre taillée (boîte de pierre) : elle peut être ébréchée. */
const estPierreTaillee = (b: Bloc) => b.forme === 'boite' && PIERRES.includes(b.matiere);

/** Nombre de coins ébréchés d'une pierre taillée (0 à 2), d'après sa teinte ; les petites pierres restent entières. */
function eclatsDe(b: Bloc): number {
  if (Math.min(b.lx, b.ly, b.lz) < 0.3) return 0;
  const u = (b.teinte * 97.31) % 1;
  return u < 0.62 ? 0 : u < 0.92 ? 1 : 2;
}

export function creerModelesRuines(): ModelesRuines {
  const K = CONFIG.ruines.couleurs;
  const formes: Record<Forme, Float32Array> = {
    boite: sommetsDe(new THREE.BoxGeometry(1, 1, 1)),
    fut: sommetsDe(new THREE.CylinderGeometry(0.5, 0.5, 1, 7)),
    touffe: sommetsDe(new THREE.IcosahedronGeometry(0.5, 0)),
    roc: sommetsDe(new THREE.DodecahedronGeometry(0.5, 0)),
    dalle: sommetsDe(new THREE.CylinderGeometry(0.5, 0.5, 1, 6)),
    eclat: sommetsDe(new THREE.CylinderGeometry(0.03, 0.5, 1, 5)),
    herbe: sommetsHerbe(),
  };
  const materiau = new THREE.MeshLambertMaterial({ vertexColors: true });
  const materiauLumineux = new THREE.MeshBasicMaterial({ vertexColors: true });

  // Objets de travail réutilisés
  const matrice = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const taille = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const couleur = new THREE.Color();

  type Sol = (x: number, z: number) => number;

  // --- Pierres taillées : coins rentrés (facettes irrégulières) et coins ébréchés --------------------
  // Triangles de la pierre en cours, dans son cube de taille 1 (12 pour la boîte, 4 de plus par coin ébréché)
  const tampon = new Float32Array(20 * 9);
  const coins = new Float32Array(8 * 3);
  const coupes = new Float32Array(8 * 3);
  const poly = new Float32Array(8 * 3);
  let nPoly = 0;

  /** Vrai si le dessous de la pierre est enterré (fondations) : il n'est pas dessiné. */
  const dessousEnterre = (p: Bloc, sol: Sol) => p.rx === 0 && p.rz === 0 && p.y - p.ly / 2 < sol(p.x, p.z) - 0.5;
  const estTaille = (p: Bloc) => estPierreTaillee(p) || (p.forme === 'boite' && p.matiere === 'mousse');

  /** Nombre de triangles d'un bloc (`sol` donné : site habillé). */
  function trianglesDe(p: Bloc, sol?: Sol): number {
    if (!sol || !estPierreTaillee(p)) return formes[p.forme].length / 9;
    return 12 + 4 * eclatsDe(p) - (dessousEnterre(p, sol) ? 2 : 0);
  }

  function pointPoly(x: number, y: number, z: number): void {
    poly[nPoly * 3] = x;
    poly[nPoly * 3 + 1] = y;
    poly[nPoly * 3 + 2] = z;
    nPoly += 1;
  }

  /** Point de coupe d'un coin ébréché `i`, sur l'arête qui mène au coin voisin `j`. */
  function pointCoupe(i: number, j: number): void {
    const axe = (i ^ j) >> 1; // 1, 2, 4 -> 0, 1, 2
    const t = coupes[i * 3 + axe];
    pointPoly(
      coins[i * 3] + (coins[j * 3] - coins[i * 3]) * t,
      coins[i * 3 + 1] + (coins[j * 3 + 1] - coins[i * 3 + 1]) * t,
      coins[i * 3 + 2] + (coins[j * 3 + 2] - coins[i * 3 + 2]) * t,
    );
  }

  /** Écrit dans le tampon le triangle des points p, q, r du polygone, tourné vers l'extérieur de la pierre. */
  function triangle(o: number, p: number, q: number, r: number): number {
    a.fromArray(poly, p * 3);
    b.fromArray(poly, q * 3);
    c.fromArray(poly, r * 3);
    n.copy(b).sub(a).cross(ab.copy(c).sub(a));
    const dehors = n.x * (a.x + b.x + c.x) + n.y * (a.y + b.y + c.y) + n.z * (a.z + b.z + c.z) >= 0;
    a.toArray(tampon, o);
    (dehors ? b : c).toArray(tampon, o + 3);
    (dehors ? c : b).toArray(tampon, o + 6);
    return o + 9;
  }

  /**
   * Taille une boîte de pierre (ou une plaque de mousse) : chaque coin est un peu rentré, ce qui casse les faces en
   * facettes, et un ou deux coins sont ébréchés. Renvoie le nombre de valeurs écrites dans le tampon.
   */
  function tailler(bloc: Bloc, sansDessous: boolean): number {
    const h = creerAleatoire(Math.floor(bloc.teinte * 4294967296));
    const pierre = bloc.matiere !== 'mousse';
    const dims = [bloc.lx, bloc.ly, bloc.lz];
    const mince = Math.min(bloc.lx, bloc.ly, bloc.lz);
    for (let i = 0; i < 8; i++) {
      for (let k = 0; k < 3; k++) {
        // Pierre : retrait de quelques centimètres (plus marqué dans l'épaisseur du mur) ; mousse : contour très irrégulier
        const u = h.suivant();
        const retrait = pierre ? Math.min(0.14, (u * (k === 2 ? 0.05 : 0.02)) / dims[k]) : dims[k] === mince ? 0 : u * 0.24;
        coins[i * 3 + k] = ((i >> k) & 1 ? 0.5 : -0.5) * (1 - 2 * retrait);
      }
    }
    if (!pierre) {
      // Plaque de mousse : même contour dessus et dessous (pas de bord en surplomb)
      const bit = bloc.ly === mince ? 2 : bloc.lz === mince ? 4 : 1;
      for (let i = 0; i < 8; i++) {
        if (!(i & bit)) continue;
        for (let k = 0; k < 3; k++) if (1 << k !== bit) coins[i * 3 + k] = coins[(i ^ bit) * 3 + k];
      }
    }
    // Coins ébréchés : ceux du dessus pour une pierre posée droite, n'importe lesquels pour une pierre tombée
    const droite = bloc.rx === 0 && Math.abs(bloc.rz) < 0.2;
    const nombre = pierre ? eclatsDe(bloc) : 0;
    let ebreches = 0;
    for (let e = 0; e < nombre; e++) {
      let i = h.entier(0, 7);
      if (droite) i |= 2;
      if (ebreches & (1 << i)) i ^= 1;
      ebreches |= 1 << i;
      const d = h.entre(0.12, 0.25);
      for (let k = 0; k < 3; k++) coupes[i * 3 + k] = Math.min(0.42, (d * h.entre(0.7, 1.3)) / dims[k]);
    }
    let o = 0;
    for (let axe = 0; axe < 3; axe++) {
      const u = 1 << ((axe + 1) % 3);
      const v = 1 << ((axe + 2) % 3);
      for (let cote = 0; cote < 2; cote++) {
        if (sansDessous && axe === 1 && cote === 0) continue;
        const base = cote << axe;
        const tour = [base, base | u, base | u | v, base | v];
        nPoly = 0;
        for (let q = 0; q < 4; q++) {
          const i = tour[q];
          if (ebreches & (1 << i)) {
            pointCoupe(i, tour[(q + 3) % 4]);
            pointCoupe(i, tour[(q + 1) % 4]);
          } else {
            pointPoly(coins[i * 3], coins[i * 3 + 1], coins[i * 3 + 2]);
          }
        }
        for (let q = 1; q < nPoly - 1; q++) o = triangle(o, 0, q, q + 1);
      }
    }
    for (let i = 0; i < 8; i++) {
      if (!(ebreches & (1 << i))) continue;
      nPoly = 0;
      pointCoupe(i, i ^ 1);
      pointCoupe(i, i ^ 2);
      pointCoupe(i, i ^ 4);
      o = triangle(o, 0, 1, 2);
    }
    return o;
  }

  /**
   * Fond des blocs en une géométrie. `sol` donné : site habillé (pierres taillées). `eclats` : éclats de cristal du
   * site, dont la lueur est peinte sur la roche voisine.
   */
  function fondre(blocs: readonly Bloc[], sol?: Sol, eclats: readonly Bloc[] = []): THREE.BufferGeometry {
    let total = 0;
    for (const bloc of blocs) total += trianglesDe(bloc, sol) * 9;
    const positions = new Float32Array(total);
    const normales = new Float32Array(total);
    const couleurs = new Float32Array(total);
    const lueur = new THREE.Color(K.cristal);
    let o = 0;
    for (const bloc of blocs) {
      let s = formes[bloc.forme];
      let longueur = s.length;
      if (sol && estTaille(bloc)) {
        longueur = tailler(bloc, estPierreTaillee(bloc) && dessousEnterre(bloc, sol));
        s = tampon;
      }
      position.set(bloc.x, bloc.y, bloc.z);
      rotation.setFromEuler(euler.set(bloc.rx, bloc.ry, bloc.rz, 'YXZ'));
      matrice.compose(position, rotation, taille.set(bloc.lx, bloc.ly, bloc.lz));
      couleur.set(K[bloc.matiere]);
      // Chaque bloc a sa nuance : plus ou moins clair, et un peu plus jaune ou plus bleu pour la végétation
      const lum = 1 + (bloc.teinte - 0.5) * (MATIERES_LUMINEUSES.includes(bloc.matiere) ? 0.1 : 0.2);
      const chaud = VEGETALES.includes(bloc.matiere) ? (((bloc.teinte * 7.13) % 1) - 0.5) * 0.18 : 0;
      const r = couleur.r * lum * (1 + chaud);
      const v = couleur.g * lum;
      const bl = couleur.b * lum * (1 - chaud);
      const eclaire = eclats.length > 0 && ROCHES.includes(bloc.matiere);
      // Éclat de cristal d'un site habillé : plus clair vers la pointe
      const pointe = sol !== undefined && bloc.forme === 'eclat' && bloc.matiere === 'cristal';
      for (let i = 0; i < longueur; i += 9) {
        a.set(s[i], s[i + 1], s[i + 2]).applyMatrix4(matrice);
        b.set(s[i + 3], s[i + 4], s[i + 5]).applyMatrix4(matrice);
        c.set(s[i + 6], s[i + 7], s[i + 8]).applyMatrix4(matrice);
        n.copy(c).sub(b).cross(ab.copy(a).sub(b)).normalize();
        // Légère différence d'une face à l'autre (la même pour les deux triangles d'une face plane)
        const face = 1 + 0.035 * Math.sin(n.x * 12.9 + n.y * 78.2 + n.z * 37.7 + bloc.teinte * 40);
        // Lueur des éclats de cristal proches, d'après le milieu du triangle
        let k = 0;
        if (eclaire) {
          const mx = (a.x + b.x + c.x) / 3;
          const my = (a.y + b.y + c.y) / 3;
          const mz = (a.z + b.z + c.z) / 3;
          for (const e of eclats) {
            const d = 1 - Math.hypot(e.x - mx, e.y - my, e.z - mz) / PORTEE_LUEUR;
            if (d > 0) k += d * d;
          }
          k = Math.min(1.2, k) * FORCE_LUEUR;
        }
        let j = i + 1;
        for (const p of [a, b, c]) {
          const f = pointe ? face * (1 + 0.5 * s[j]) : face;
          j += 3;
          positions[o] = p.x;
          positions[o + 1] = p.y;
          positions[o + 2] = p.z;
          normales[o] = n.x;
          normales[o + 1] = n.y;
          normales[o + 2] = n.z;
          couleurs[o] = r * f + lueur.r * k;
          couleurs[o + 1] = v * f + lueur.g * k;
          couleurs[o + 2] = bl * f + lueur.b * k;
          o += 3;
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(normales, 3));
    g.setAttribute('color', new THREE.BufferAttribute(couleurs, 3));
    g.computeBoundingSphere();
    return g;
  }

  // --- Habillage d'un site de ruines : mousse sur les pierres du dessus, herbes et pierres tombées au pied --------
  /**
   * Renvoie les blocs du site suivis de leur habillage. Le tirage part de la teinte des blocs (donc de la graine du
   * site) ; le total reste sous BUDGET fois le coût du site nu.
   */
  function habiller(blocs: readonly Bloc[], sol: Sol): readonly Bloc[] {
    const pierres = blocs.filter(estPierreTaillee);
    if (pierres.length === 0) return blocs;
    const h: Aleatoire = creerAleatoire(Math.floor(blocs[0].teinte * 4294967296) ^ blocs.length);
    let reste = 0;
    for (const x of blocs) reste += (formes[x.forme].length / 9) * BUDGET - trianglesDe(x, sol);
    const ajouts: Bloc[] = [];
    /** Pose un bloc à (ox, oz) dans le repère du bloc `de` (à plat), à l'altitude y ; faux si le budget est épuisé. */
    const poser = (forme: Forme, matiere: Matiere, de: Bloc, ox: number, y: number, oz: number, lx: number, ly: number, lz: number, ry = 0, rx = 0, rz = 0): boolean => {
      const cs = Math.cos(de.ry);
      const sn = Math.sin(de.ry);
      const ajout: Bloc = { forme, matiere, x: de.x + ox * cs + oz * sn, y, z: de.z - ox * sn + oz * cs, lx, ly, lz, rx, ry: de.ry + ry, rz, teinte: h.suivant() };
      const prix = trianglesDe(ajout, sol);
      if (prix > reste) return false;
      reste -= prix;
      ajouts.push(ajout);
      return true;
    };
    const droite = (x: Bloc) => x.rx === 0 && Math.abs(x.rz) < 0.12;
    /** Vrai si un autre bloc est posé sur le dessus de la pierre. */
    const couverte = (p: Bloc): boolean => {
      const dessus = p.y + p.ly / 2;
      const portee = 0.5 * Math.max(p.lx, p.lz) + 0.2;
      for (const x of blocs) {
        if (x === p || x.y - x.ly / 2 > dessus + 0.12 || x.y + x.ly / 2 < dessus + 0.06) continue;
        if (Math.hypot(x.x - p.x, x.z - p.z) < portee) return true;
      }
      return false;
    };
    /** Vrai si le point (x, z) du site est sous une pierre taillée qui dépasse du sol. */
    const sousPierre = (x: number, z: number, y: number): boolean => {
      for (const p of pierres) {
        if (p.y + p.ly / 2 < y + 0.05) continue;
        const dx = x - p.x;
        const dz = z - p.z;
        const cs = Math.cos(p.ry);
        const sn = Math.sin(p.ry);
        if (Math.abs(dx * cs - dz * sn) < p.lx / 2 + 0.05 && Math.abs(dx * sn + dz * cs) < p.lz / 2 + 0.05) return true;
      }
      return false;
    };
    /** Point au pied de la pierre `p`, à `ecart` mètres de l'une de ses deux grandes faces (null s'il est sous une pierre). */
    const auPied = (p: Bloc, ecart: number): { ox: number; oz: number; y: number } | null => {
      const ox = h.entre(-0.4, 0.4) * p.lx;
      const oz = (h.suivant() < 0.5 ? 1 : -1) * (p.lz / 2 + ecart);
      const cs = Math.cos(p.ry);
      const sn = Math.sin(p.ry);
      const x = p.x + ox * cs + oz * sn;
      const z = p.z - ox * sn + oz * cs;
      const y = sol(x, z);
      return sousPierre(x, z, y) ? null : { ox, oz, y };
    };

    // Au pied des murs : touffes d'herbe et coussins de mousse
    const pieds = pierres.filter((p) => dessousEnterre(p, sol) && p.y + p.ly / 2 > sol(p.x, p.z) + 0.1);
    for (const p of pieds) {
      const u = h.suivant();
      if (u > 0.72) continue;
      const lieu = auPied(p, h.entre(0.12, 0.3));
      if (!lieu) continue;
      if (u < 0.58) {
        const t = h.entre(0.45, 0.75);
        if (!poser('herbe', h.suivant() < 0.75 ? 'mousse' : 'lierre', p, lieu.ox, lieu.y + t / 2 - 0.04, lieu.oz, t * 1.1, t, t * 1.1, h.entre(0, 6))) break;
      } else if (!poser('touffe', 'mousse', p, lieu.ox, lieu.y + 0.04, lieu.oz, h.entre(0.45, 0.7), 0.24, h.entre(0.35, 0.5), h.entre(0, 3))) {
        break;
      }
    }
    // Mousse : une plaque au contour irrégulier sur une pierre du dessus, qui déborde d'un côté, et parfois une coulure
    for (const p of pierres) {
      if (!droite(p) || Math.min(p.lx, p.lz) < 0.4 || h.suivant() > 0.45 || couverte(p)) continue;
      const dessus = p.y + p.ly / 2;
      const cote = h.suivant() < 0.5 ? 1 : -1;
      const lx = p.lx * h.entre(0.5, 0.85);
      const lz = p.lz * h.entre(0.6, 0.95) + 0.06;
      const ox = ((p.lx - lx) / 2) * h.entre(-1, 1);
      if (!poser('boite', 'mousse', p, ox, dessus + 0.035, cote * ((p.lz - lz) / 2 + 0.05), lx, 0.09, lz)) break;
      if (h.suivant() < 0.55) {
        const hauteur = h.entre(0.16, 0.4);
        poser('boite', 'mousse', p, ox + h.entre(-0.25, 0.25) * lx, dessus + 0.05 - hauteur / 2, cote * (p.lz / 2 + 0.02), h.entre(0.16, 0.3), hauteur, 0.07);
      }
    }
    // Quelques pierres tombées un peu plus loin
    const tombees = pieds.length > 0 ? h.entier(2, 4) : 0;
    for (let k = 0; k < tombees; k++) {
      const p = pieds[h.entier(0, pieds.length - 1)];
      const lieu = auPied(p, h.entre(0.5, 1.3));
      if (!lieu) continue;
      const t = h.entre(0.28, 0.5);
      poser('boite', h.suivant() < 0.3 ? 'pierreSombre' : 'pierre', p, lieu.ox, lieu.y + t * 0.25, lieu.oz, t * 1.3, t * 0.75, t, h.entre(0, 3), h.entre(-0.4, 0.4), h.entre(-0.4, 0.4));
    }
    return ajouts.length > 0 ? [...blocs, ...ajouts] : blocs;
  }

  // --- Coffre : caisse cerclée de fer et couvercle sur charnière (construits une fois) -------------
  const bloc = (matiere: Matiere, x: number, y: number, z: number, lx: number, ly: number, lz: number, teinte = 0.5): Bloc => ({
    forme: 'boite', matiere, x, y, z, lx, ly, lz, rx: 0, ry: 0, rz: 0, teinte,
  });
  const HAUT_CAISSE = 0.4;
  const FOND = -0.24;
  const caisse: Bloc[] = [
    bloc('coffre', 0, HAUT_CAISSE / 2, 0, 0.8, HAUT_CAISSE, 0.48),
    // Intérieur sombre, visible couvercle levé
    bloc('coffreSombre', 0, HAUT_CAISSE + 0.004, 0, 0.7, 0.01, 0.38, 0.2),
    bloc('fer', 0, HAUT_CAISSE - 0.04, 0, 0.84, 0.07, 0.52),
    bloc('fer', 0, 0.035, 0, 0.84, 0.07, 0.52),
  ];
  // Couvercle : décrit par rapport à sa charnière (arête arrière, en haut de la caisse)
  const couvercle: Bloc[] = [
    bloc('coffre', 0, 0.06, -FOND, 0.8, 0.12, 0.48, 0.65),
    bloc('coffre', 0, 0.155, -FOND, 0.78, 0.08, 0.34, 0.75),
    bloc('ferClair', 0, 0.0, -FOND + 0.255, 0.14, 0.16, 0.04),
  ];
  for (const s of [-1, 1]) {
    caisse.push(bloc('fer', s * 0.27, HAUT_CAISSE / 2, 0, 0.09, HAUT_CAISSE + 0.01, 0.52));
    couvercle.push(bloc('fer', s * 0.27, 0.065, -FOND, 0.09, 0.14, 0.52), bloc('fer', s * 0.27, 0.16, -FOND, 0.09, 0.1, 0.37));
  }
  const geometrieCaisse = fondre(caisse);
  const geometrieCouvercle = fondre(couvercle);

  return {
    geometries(blocs, sol) {
      const tous = sol ? habiller(blocs, sol) : blocs;
      const lumineux = tous.filter((x) => MATIERES_LUMINEUSES.includes(x.matiere));
      const eclats = sol ? lumineux.filter((x) => x.matiere === 'cristal') : [];
      return {
        solide: fondre(tous.filter((x) => !MATIERES_LUMINEUSES.includes(x.matiere)), sol, eclats),
        lumineux: lumineux.length > 0 ? fondre(lumineux, sol) : null,
      };
    },
    creerCoffre() {
      const objet = new THREE.Group();
      const bas = new THREE.Mesh(geometrieCaisse, materiau);
      const haut = new THREE.Mesh(geometrieCouvercle, materiau);
      haut.position.set(0, HAUT_CAISSE, FOND);
      for (const m of [bas, haut]) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
      objet.add(bas, haut);
      objet.name = 'coffre de ruine';
      return {
        objet,
        definirOuverture(t) {
          haut.rotation.x = -1.85 * Math.min(1, Math.max(0, t));
        },
      };
    },
    materiau,
    materiauLumineux,
    liberer() {
      geometrieCaisse.dispose();
      geometrieCouvercle.dispose();
      materiau.dispose();
      materiauLumineux.dispose();
    },
  };
}
