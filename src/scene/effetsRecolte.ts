// Effets visuels de la récolte : éclats à chaque coup, chute des arbres, fragments des rochers
// et filons, particules des petites plantes. Aucune règle de jeu ici (points de vie et butin
// sont dans src/regles/recolte.ts). L'aléatoire de ces effets n'a pas besoin d'être reproductible.

import * as THREE from 'three';
import { CONFIG } from '../config';
import { INFOS_DECOR, type ElementDecor, type TypeDecor } from '../monde/decor';
import type { ModelesDecor } from './modelesDecor';

export interface EffetsRecolte {
  /** Petit nuage d'éclats à chaque coup qui touche `element`, depuis la position (x, z) du personnage. */
  coup(element: ElementDecor, depuisX: number, depuisZ: number): void;
  /** Destruction : chute de l'arbre (et souche), éclatement du rocher, particules des plantes. */
  detruire(element: ElementDecor, depuisX: number, depuisZ: number): void;
  mettreAJour(dt: number): void;
  liberer(): void;
}

const C = CONFIG.decor.couleurs;
const R = CONFIG.recolte;
const GRAVITE = 14;
const MAX_SOUCHES = 150;

const alea = (min: number, max: number) => min + Math.random() * (max - min);

/** Couleurs des éclats d'un type : copeaux bruns, éclats gris, feuilles... */
function couleursEclats(type: TypeDecor): number[] {
  switch (type) {
    case 'arbre-feuillu':
      return [C.tronc, C.tronc, C.feuillage];
    case 'sapin':
      return [C.tronc, C.tronc, C.sapin];
    case 'bouleau':
      return [C.ecorceBouleau, C.tronc, C.feuillageBouleau];
    case 'rocher':
      return [C.rocher, C.rocherSombre];
    case 'filon-fer':
      return [C.filon, C.rocherSombre, C.minerai];
    case 'filon-cuivre':
      return [C.filonCuivre, C.rocherSombre, C.mineraiCuivre];
    case 'filon-charbon':
      return [C.filonCharbon, C.rocherSombre, C.mineraiCharbon];
    case 'cristal-bleu':
      return [CONFIG.mine.couleurs.cristal, CONFIG.mine.couleurs.cristalClair, CONFIG.mine.couleurs.socleCristal];
    case 'buisson-baies':
      return [C.buisson, C.buisson, C.baie];
    case 'plante-medicinale':
      return [C.plante, C.plante, C.fleurPlante];
    case 'fibres':
      return [C.fibres, C.fibres, C.lienFibres];
    default:
      return [C.herbe];
  }
}

interface Particule {
  mesh: THREE.Mesh;
  vitesse: THREE.Vector3;
  rotation: THREE.Vector3;
  age: number;
  duree: number;
  taille: number;
  /** Vrai une fois posée au sol : elle ne bouge plus et rétrécit */
  posee: boolean;
  /** Hauteur du centre au-dessus du sol une fois posée ; une bûche (`couchee`) finit à plat */
  repos: number;
  couchee: boolean;
}

interface Chute {
  groupe: THREE.Group;
  inclinaison: THREE.Group;
  axe: THREE.Vector3;
  age: number;
}

/** Réunit des formes en une géométrie à couleurs par sommet : `ecorce` partout, `coeur` sur les faces indiquées. */
function assemblerBois(formes: THREE.BufferGeometry[], ecorce: number, coeur: number, estCoeur: (normale: THREE.Vector3, centre: THREE.Vector3) => boolean): THREE.BufferGeometry {
  const positions: number[] = [];
  const couleurs: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const centre = new THREE.Vector3();
  const teinte = new THREE.Color();
  for (const forme of formes) {
    const g = forme.index ? forme.toNonIndexed() : forme;
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i);
      b.fromBufferAttribute(p, i + 1);
      c.fromBufferAttribute(p, i + 2);
      n.copy(c).sub(b).cross(centre.copy(a).sub(b)).normalize();
      centre.copy(a).add(b).add(c).divideScalar(3);
      // Écorce : une facette sur deux un peu plus sombre
      teinte.set(estCoeur(n, centre) ? coeur : ecorce).multiplyScalar(estCoeur(n, centre) || (i / 3) % 4 < 2 ? 1 : 0.88);
      for (const s of [a, b, c]) {
        positions.push(s.x, s.y, s.z);
        couleurs.push(teinte.r, teinte.g, teinte.b);
      }
    }
    if (g !== forme) g.dispose();
    forme.dispose();
  }
  const resultat = new THREE.BufferGeometry();
  resultat.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  resultat.setAttribute('color', new THREE.Float32BufferAttribute(couleurs, 3));
  resultat.computeVertexNormals();
  return resultat;
}

/** Souche d'un arbre abattu : fût court évasé, cinq racines, dessus de bois clair. Rayon d'environ 0,55 m. */
function creerSouche(ecorce: number): THREE.BufferGeometry {
  const formes: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.5, 0.62, 0.6, 8).translate(0, 0.3, 0)];
  for (let i = 0; i < 5; i++) {
    const racine = new THREE.ConeGeometry(0.36, 1.25, 4).translate(0, 0.38, 0);
    racine.scale(1, 1, 0.7).rotateZ(-1.92).translate(0.3, 0.42, 0).rotateY((i / 5) * Math.PI * 2 + (i % 2) * 0.25);
    formes.push(racine);
  }
  return assemblerBois(formes, ecorce, C.boisCoupe, (n, centre) => n.y > 0.9 && centre.y > 0.55);
}

/** Bûche : rondin court à huit pans, couché, aux deux bouts de bois clair. Longueur 0,8 m. */
function creerBuche(ecorce: number): THREE.BufferGeometry {
  const rondin = new THREE.CylinderGeometry(0.17, 0.17, 0.8, 8).rotateZ(Math.PI / 2);
  return assemblerBois([rondin], ecorce, C.boisCoupe, (n) => Math.abs(n.x) > 0.9);
}

export function creerEffetsRecolte(
  scene: THREE.Scene,
  modeles: ModelesDecor,
  hauteurSol: (x: number, z: number) => number,
): EffetsRecolte {
  const geometrieEclat = new THREE.TetrahedronGeometry(1, 0);
  // Fragment de roche : bloc trapu à pans, comme sur l'image « Bois et pierres »
  const geometrieFragment = new THREE.DodecahedronGeometry(1, 0).scale(1.15, 0.8, 0.9);
  // Souches (écorce brune ou de bouleau) et bûche : couleurs par sommet, le bois coupé est clair
  const materiauBois = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 });
  const geometriesSouche = { brune: creerSouche(C.tronc), bouleau: creerSouche(C.ecorceBouleau) };
  const geometriesBuche = { brune: creerBuche(C.tronc), bouleau: creerBuche(C.ecorceBouleau) };
  const materiaux = new Map<number, THREE.MeshStandardMaterial>();
  const particules: Particule[] = [];
  const chutes: Chute[] = [];
  const souches: THREE.Mesh[] = [];
  const quaternion = new THREE.Quaternion();

  function materiau(couleur: number): THREE.MeshStandardMaterial {
    let m = materiaux.get(couleur);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: couleur, flatShading: true, roughness: 0.9, metalness: 0 });
      materiaux.set(couleur, m);
    }
    return m;
  }

  function lancer(
    geometrie: THREE.BufferGeometry,
    couleur: number | THREE.Material,
    pos: THREE.Vector3,
    vitesse: THREE.Vector3,
    taille: number,
    duree: number,
    reposBuche = 0,
  ): void {
    const mesh = new THREE.Mesh(geometrie, typeof couleur === 'number' ? materiau(couleur) : couleur);
    mesh.position.copy(pos);
    mesh.scale.setScalar(taille);
    mesh.rotation.set(alea(0, 6), alea(0, 6), alea(0, 6));
    mesh.castShadow = false;
    scene.add(mesh);
    particules.push({
      mesh,
      vitesse,
      rotation: new THREE.Vector3(alea(-8, 8), alea(-8, 8), alea(-8, 8)),
      age: 0,
      duree,
      taille,
      posee: false,
      repos: reposBuche > 0 ? reposBuche * taille : taille * 0.5,
      couchee: reposBuche > 0,
    });
  }

  /** Direction horizontale du personnage vers l'élément (longueur 1). */
  function directionOpposee(e: ElementDecor, depuisX: number, depuisZ: number): { x: number; z: number } {
    let dx = e.x - depuisX;
    let dz = e.z - depuisZ;
    const l = Math.hypot(dx, dz);
    if (l < 1e-4) {
      const a = alea(0, Math.PI * 2);
      return { x: Math.cos(a), z: Math.sin(a) };
    }
    dx /= l;
    dz /= l;
    return { x: dx, z: dz };
  }

  function nuage(e: ElementDecor, depuisX: number, depuisZ: number, nombre: number, tailleBase: number): void {
    const infos = INFOS_DECOR[e.type];
    const sens = directionOpposee(e, depuisX, depuisZ);
    const hauteur = infos.arbre ? 1.3 : infos.hauteurVisee * 0.6;
    // Les éclats partent du côté du personnage, à hauteur de frappe
    const recul = infos.rayonVisee * e.echelle * 0.8;
    const couleurs = couleursEclats(e.type);
    for (let i = 0; i < nombre; i++) {
      const pos = new THREE.Vector3(
        e.x - sens.x * recul + alea(-0.15, 0.15),
        e.y + hauteur * e.echelle * alea(0.7, 1.1),
        e.z - sens.z * recul + alea(-0.15, 0.15),
      );
      const v = new THREE.Vector3(
        -sens.x * alea(0.5, 2.2) + alea(-1.5, 1.5),
        alea(1.5, 4),
        -sens.z * alea(0.5, 2.2) + alea(-1.5, 1.5),
      );
      lancer(geometrieEclat, couleurs[i % couleurs.length], pos, v, tailleBase * alea(0.6, 1.2), R.dureeEclats * alea(0.7, 1.1));
    }
  }

  function coup(e: ElementDecor, depuisX: number, depuisZ: number): void {
    nuage(e, depuisX, depuisZ, INFOS_DECOR[e.type].arbre ? 5 : 4, 0.07);
  }

  function chuteArbre(e: ElementDecor, depuisX: number, depuisZ: number): void {
    const sens = directionOpposee(e, depuisX, depuisZ);
    const modele = modeles.modele(e.type, e.variante);
    const mesh = new THREE.Mesh(modele.geometrie, modeles.materiauGrand);
    mesh.rotation.y = e.rotation;
    mesh.scale.setScalar(e.echelle);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const inclinaison = new THREE.Group();
    inclinaison.add(mesh);
    const groupe = new THREE.Group();
    groupe.position.set(e.x, e.y, e.z);
    groupe.add(inclinaison);
    scene.add(groupe);
    // Pivoter autour de cet axe fait basculer le haut de l'arbre vers (sens.x, sens.z)
    chutes.push({ groupe, inclinaison, axe: new THREE.Vector3(sens.z, 0, -sens.x), age: 0 });

    // Souche : reste visible pendant la session
    const essence = e.type === 'bouleau' ? 'bouleau' : 'brune';
    const souche = new THREE.Mesh(geometriesSouche[essence], materiauBois);
    // La souche a la largeur du tronc de l'arbre abattu
    const largeur = e.echelle * (e.type === 'arbre-feuillu' ? 1 : e.type === 'sapin' ? 0.72 : 0.48);
    souche.position.set(e.x, e.y, e.z);
    souche.rotation.y = e.rotation;
    souche.scale.set(largeur, 0.85 + 0.15 * e.echelle, largeur);
    souche.castShadow = true;
    souche.receiveShadow = true;
    scene.add(souche);
    souches.push(souche);
    if (souches.length > MAX_SOUCHES) scene.remove(souches.shift()!);

    nuage(e, depuisX, depuisZ, 10, 0.1);
    // Trois bûches roulent au pied de l'arbre
    for (let i = 0; i < 3; i++) {
      const a = alea(0, Math.PI * 2);
      const pos = new THREE.Vector3(e.x + Math.cos(a) * 0.7, e.y + alea(0.6, 1.2), e.z + Math.sin(a) * 0.7);
      const v = new THREE.Vector3(Math.cos(a) * alea(1, 2.5), alea(1.5, 3), Math.sin(a) * alea(1, 2.5));
      lancer(geometriesBuche[essence], materiauBois, pos, v, alea(0.85, 1.1), R.dureeEclats * 6, 0.17);
    }
  }

  function eclatementRoche(e: ElementDecor): void {
    const couleurs = couleursEclats(e.type);
    const nombre = Math.round(alea(6, 10));
    const infos = INFOS_DECOR[e.type];
    for (let i = 0; i < nombre; i++) {
      const a = alea(0, Math.PI * 2);
      const pos = new THREE.Vector3(
        e.x + Math.cos(a) * 0.3 * e.echelle,
        e.y + infos.hauteurVisee * e.echelle * alea(0.3, 0.8),
        e.z + Math.sin(a) * 0.3 * e.echelle,
      );
      const v = new THREE.Vector3(Math.cos(a) * alea(1.5, 4), alea(2.5, 5.5), Math.sin(a) * alea(1.5, 4));
      lancer(geometrieFragment, couleurs[i % couleurs.length], pos, v, Math.min(0.3, 0.12 * e.echelle + 0.08) * alea(0.7, 1.3), R.dureeEclats * 2);
    }
  }

  function detruire(e: ElementDecor, depuisX: number, depuisZ: number): void {
    if (INFOS_DECOR[e.type].arbre) chuteArbre(e, depuisX, depuisZ);
    else if (e.type === 'rocher' || e.type === 'filon-fer' || e.type === 'filon-cuivre' || e.type === 'filon-charbon' || e.type === 'cristal-bleu') eclatementRoche(e);
    else nuage(e, depuisX, depuisZ, 9, 0.09);
  }

  function retirerParticule(i: number): void {
    scene.remove(particules[i].mesh);
    particules.splice(i, 1);
  }

  function mettreAJour(dt: number): void {
    for (let i = particules.length - 1; i >= 0; i--) {
      const p = particules[i];
      p.age += dt;
      if (p.age >= p.duree) {
        retirerParticule(i);
        continue;
      }
      const m = p.mesh;
      if (!p.posee) {
        p.vitesse.y -= GRAVITE * dt;
        m.position.addScaledVector(p.vitesse, dt);
        m.rotation.x += p.rotation.x * dt;
        m.rotation.y += p.rotation.y * dt;
        m.rotation.z += p.rotation.z * dt;
        const sol = hauteurSol(m.position.x, m.position.z) + p.repos;
        if (m.position.y <= sol) {
          m.position.y = sol;
          p.posee = true;
          if (p.couchee) {
            m.rotation.x = 0;
            m.rotation.z = 0;
          }
        }
      }
      // Dernier tiers de vie : l'éclat rétrécit
      const reste = (p.duree - p.age) / (p.duree / 3);
      m.scale.setScalar(p.taille * Math.min(1, reste));
    }

    const dureeChute = R.dureeChuteArbre * R.partChute;
    const dureeFonte = R.dureeChuteArbre - dureeChute;
    for (let i = chutes.length - 1; i >= 0; i--) {
      const c = chutes[i];
      c.age += dt;
      if (c.age >= R.dureeChuteArbre) {
        scene.remove(c.groupe);
        chutes.splice(i, 1);
        continue;
      }
      // Chute : lente au début, de plus en plus vite (l'arbre bascule d'un quart de tour)
      const t = Math.min(1, c.age / dureeChute);
      quaternion.setFromAxisAngle(c.axe, (Math.PI / 2) * t * t);
      c.inclinaison.quaternion.copy(quaternion);
      // Puis il rétrécit sur place et disparaît
      const fonte = c.age > dureeChute ? 1 - (c.age - dureeChute) / dureeFonte : 1;
      c.groupe.scale.setScalar(Math.max(0.001, fonte));
    }
  }

  function liberer(): void {
    for (const p of particules) scene.remove(p.mesh);
    for (const c of chutes) scene.remove(c.groupe);
    for (const s of souches) scene.remove(s);
    particules.length = 0;
    chutes.length = 0;
    souches.length = 0;
    geometrieEclat.dispose();
    geometrieFragment.dispose();
    for (const g of [...Object.values(geometriesSouche), ...Object.values(geometriesBuche)]) g.dispose();
    materiauBois.dispose();
    for (const m of materiaux.values()) m.dispose();
    materiaux.clear();
  }

  return { coup, detruire, mettreAJour, liberer };
}
