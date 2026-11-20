// Arc (case 4) : clic maintenu pour tendre, relâcher pour tirer ; flèches en vol, plantées au sol, reprises en passant dessus.
import * as THREE from 'three';
import { CONFIG } from '../config';
import { ajouter, compter, retirer } from '../regles/inventaire';
import { aLeNoeud } from '../regles/competences';
import { avancerFleche, butCompense, creerFleche, peutTirer, tensionArc, tirDeFleche, type Fleche } from '../regles/arc';
import { creerProjectile, pointVise } from '../regles/sorts';
import { LONGUEUR_FLECHE, creerMateriauxOutils, creerModeleFleche } from '../scene/outils';
import { ciblesVivantes, creerSolProjectiles } from './cibles';
import type { Contexte } from './contexte';
import type { EtatJeu, EnnemiPresent } from './partie';

export interface DependancesArc {
  infligerDegatsEnnemi: (present: EnnemiPresent, degats: number, depuisX: number, depuisZ: number, couleur: string) => void;
  rafraichirInventaire: () => void;
}

interface FlecheEnVol {
  fleche: Fleche;
  modele: THREE.Group;
}

interface FlecheAuSol {
  x: number;
  z: number;
  age: number;
  modele: THREE.Group;
}

export function creerArcJeu(jeu: EtatJeu, ctx: Contexte, dep: DependancesArc) {
  const { terrain, vues, entrees, compteur, personnage, bras, scene } = ctx;
  const A = CONFIG.arc;
  const materiaux = creerMateriauxOutils();
  const AXE_FLECHE = new THREE.Vector3(1, 0, 0);
  const direction = new THREE.Vector3();
  // Modèles de flèches retirés de la scène, prêts à resservir
  const reserve: THREE.Group[] = [];
  let enVol: FlecheEnVol[] = [];
  let auSol: FlecheAuSol[] = [];
  // Clic maintenu : l'arc se tend depuis `duree` secondes
  let tend = false;
  let duree = 0;

  const solFleches = creerSolProjectiles(terrain);
  const cibles = () => ciblesVivantes(jeu);

  function prendreModele(): THREE.Group {
    let modele = reserve.pop();
    if (!modele) {
      modele = creerModeleFleche(materiaux);
      modele.traverse((o) => {
        o.castShadow = false;
      });
    }
    scene.add(modele);
    return modele;
  }

  function rendreModele(modele: THREE.Group): void {
    scene.remove(modele);
    reserve.push(modele);
  }

  /** Place le modèle : sa pointe en (x, y, z), tourné dans le sens (dx, dy, dz). */
  function placer(modele: THREE.Group, x: number, y: number, z: number, dx: number, dy: number, dz: number): void {
    direction.set(dx, dy, dz).normalize();
    modele.quaternion.setFromUnitVectors(AXE_FLECHE, direction);
    modele.position.set(x, y, z).addScaledVector(direction, -LONGUEUR_FLECHE);
  }

  /** La flèche part vers ce que vise le réticule : de l'œil en 1re personne, sinon de l'épaule du personnage. */
  function tirer(tension: number): void {
    const r = retirer(jeu.inventaire, 'fleche', 1);
    if (r.retire < 1) return;
    jeu.inventaire = r.conteneur;
    dep.rafraichirInventaire();
    const { etat } = jeu;
    const rayon = vues.rayonVisee;
    const depart =
      vues.vue === 'premiere'
        ? {
            x: rayon.origine.x + rayon.direction.x * A.avanceDepart,
            y: rayon.origine.y + rayon.direction.y * A.avanceDepart,
            z: rayon.origine.z + rayon.direction.z * A.avanceDepart,
          }
        : { x: etat.x, y: etat.y + A.hauteurDepart, z: etat.z };
    const tir = tirDeFleche(tension, aLeNoeud(jeu.progression, 'tir-charge'));
    const but = butCompense(depart, pointVise(rayon.origine, rayon.direction, cibles(), solFleches), tir.vitesse);
    const fleche = creerFleche(creerProjectile(depart, but, rayon.direction), tir);
    const modele = prendreModele();
    placer(modele, fleche.x, fleche.y, fleche.z, fleche.vx, fleche.vy, fleche.vz);
    enVol.push({ fleche, modele });
  }

  /** Les flèches en vol avancent ; elles blessent ce qu'elles touchent, ou se plantent dans le sol. */
  function voler(dt: number): void {
    if (enVol.length === 0) return;
    const vivantes = cibles();
    const suite: FlecheEnVol[] = [];
    for (const vol of enVol) {
      const f = vol.fleche;
      const r = avancerFleche(f, dt, vivantes, solFleches);
      if (r.fleche) {
        vol.fleche = r.fleche;
        placer(vol.modele, r.fleche.x, r.fleche.y, r.fleche.z, r.fleche.vx, r.fleche.vy, r.fleche.vz);
        suite.push(vol);
        continue;
      }
      const impact = r.impact;
      if (impact?.cible) {
        const present = jeu.ennemis.get(impact.cible);
        if (present) dep.infligerDegatsEnnemi(present, f.degats, jeu.etat.x, jeu.etat.z, '#f4ead0');
      }
      // Plantée dans la terre ferme : elle reste là, à reprendre
      if (impact && !impact.cible && terrain.hauteur(impact.x, impact.z) >= terrain.niveauEau) {
        placer(vol.modele, impact.x, impact.y - 0.12, impact.z, f.vx, Math.min(f.vy, -0.25 * Math.hypot(f.vx, f.vz)), f.vz);
        auSol.push({ x: impact.x, z: impact.z, age: 0, modele: vol.modele });
        while (auSol.length > A.maxAuSol) rendreModele(auSol.shift()!.modele);
      } else {
        rendreModele(vol.modele);
      }
    }
    enVol = suite;
  }

  /** Les flèches au sol vieillissent ; le joueur reprend celles sur lesquelles il passe (s'il a de la place). */
  function ramasser(dt: number): void {
    if (auSol.length === 0) return;
    const { etat } = jeu;
    let reprises = 0;
    auSol = auSol.filter((f) => {
      f.age += dt;
      let garder = f.age < A.dureeAuSol;
      if (garder && jeu.vie.pv > 0 && Math.hypot(f.x - etat.x, f.z - etat.z) <= A.porteeRamassage) {
        const ajout = ajouter(jeu.inventaire, 'fleche', 1);
        if (ajout.reste === 0) {
          jeu.inventaire = ajout.conteneur;
          reprises += 1;
          garder = false;
        }
      }
      if (!garder) rendreModele(f.modele);
      return garder;
    });
    if (reprises > 0) {
      dep.rafraichirInventaire();
      compteur.annoncerObjets({ fleche: reprises });
    }
  }

  /**
   * À chaque image : clic maintenu (tendre) et relâché (tirer), pose des bras, flèches en vol et au sol.
   * `fige` : un écran est ouvert, les flèches en vol attendent.
   */
  function mettreAJour(dt: number, commande: boolean, fige: boolean): void {
    const fleches = compter(jeu.inventaire, 'fleche');
    const peut = commande && jeu.emplacement === 'arc' && jeu.equipement.arc && !jeu.pilote && !jeu.visite && !jeu.etat.nage && !jeu.etat.grimpe;
    if (!peut) {
      tend = false;
    } else if (!tend) {
      if (entrees.clicGaucheDebut) {
        if (fleches < 1) compteur.annoncerMessage('Pas de flèche (à fabriquer à l’établi)');
        else {
          tend = true;
          duree = 0;
        }
      }
    } else if (entrees.clicGauche) {
      duree += dt;
    } else {
      // Clic relâché : la flèche part si l'arc était assez tendu
      const tension = tensionArc(duree);
      tend = false;
      if (peutTirer(tension)) tirer(tension);
    }
    const tension = tend ? tensionArc(duree) : 0;
    const encochee = compter(jeu.inventaire, 'fleche') > 0;
    bras.definirArc(tension, tend, encochee);
    personnage.definirArc(tension, tend, encochee);
    personnage.definirCarquois(jeu.equipement.arc);
    if (!fige) voler(dt);
    ramasser(dt);
  }

  return {
    mettreAJour,
    /** Vrai tant que le joueur tend son arc : il avance lentement. */
    enTension: () => tend,
  };
}

export type ArcJeu = ReturnType<typeof creerArcJeu>;
