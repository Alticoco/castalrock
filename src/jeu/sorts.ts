// Sorts : boule de feu (touche A), soin (touche X).
import * as THREE from 'three';
import { CONFIG } from '../config';
import { facteurRayonExplosion, pvMax } from '../regles/progression';
import {
  MESSAGES_SORT,
  avancerProjectile,
  creerBarriere,
  ciblesDansExplosion,
  creerProjectile,
  degatsBouleDeFeu,
  lancerSort,
  pointVise,
  soinDuSort,
  type ImpactProjectile,
  type NomSort,
  type Projectile,
} from '../regles/sorts';
import type { EvenementQuete } from '../regles/quetes';
import { ciblesVivantes, creerSolProjectiles } from './cibles';
import type { Contexte } from './contexte';
import type { EtatJeu, EnnemiPresent } from './partie';

export interface DependancesSorts {
  infligerDegatsEnnemi: (present: EnnemiPresent, degats: number, depuisX: number, depuisZ: number, couleur: string) => void;
  /** Un sort lancé fait avancer les quêtes « lancer des sorts » */
  signalerQuete: (ev: EvenementQuete) => void;
}

interface BouleEnVol {
  id: number;
  projectile: Projectile;
}

export function creerSorts(jeu: EtatJeu, ctx: Contexte, dep: DependancesSorts) {
  const { terrain, vues, compteur, effetsSorts, interfaceCombat, renderer, personnage, bras } = ctx;
  let boules: BouleEnVol[] = [];
  let compteurBoules = 0;
  // Temps restant avant le départ de la boule dont le geste est en cours (secondes), null si aucune
  let delaiBoule: number | null = null;
  const pointPaume = new THREE.Vector3();

  const solSorts = creerSolProjectiles(terrain);
  const ciblesDesSorts = () => ciblesVivantes(jeu);

  /** Touche A ou X : coût, recharge et déblocage sont vérifiés par les règles ; un refus s'affiche en message. */
  function utiliserSort(sort: NomSort): void {
    const r = lancerSort(sort, {
      noeuds: jeu.progression.noeuds,
      mana: jeu.progression.mana,
      recharges: jeu.recharges,
      pv: jeu.vie.pv,
      pvMax: pvMax(jeu.progression),
    });
    if (!r.ok) {
      const message = MESSAGES_SORT[r.raison];
      if (message) compteur.annoncerMessage(message);
      return;
    }
    jeu.progression = { ...jeu.progression, mana: r.mana };
    jeu.recharges = r.recharges;
    dep.signalerQuete({ type: 'sortLance' });
    // Geste de la main gauche (bras en 1re personne, bras levé du personnage en 3e personne)
    personnage.jouerSort(sort);
    bras.jouerSort(sort);
    // La boule ne part qu'après le court temps où la flamme se forme dans la paume
    if (sort === 'boule-de-feu') delaiBoule = CONFIG.sorts.geste.anticipationBoule;
    else if (sort === 'soin') soigner();
    else proteger();
  }

  /** Barrière : un dôme bleuté entoure le joueur et absorbe les prochains dégâts (voir `blesser` dans combat.ts). */
  function proteger(): void {
    jeu.barriere = creerBarriere();
  }

  /**
   * La boule part vers ce que vise le réticule : de la paume gauche en 1re personne (bras visibles),
   * sinon de la poitrine du joueur.
   */
  function lancerBoule(): void {
    const { etat } = jeu;
    const depart = { x: etat.x, y: etat.y + CONFIG.sorts.bouleDeFeu.hauteurDepart, z: etat.z };
    if (bras.objet.visible) {
      const paume = bras.positionPaume(pointPaume);
      depart.x = paume.x;
      depart.y = paume.y;
      depart.z = paume.z;
    }
    const rayon = vues.rayonVisee;
    const but = pointVise(rayon.origine, rayon.direction, ciblesDesSorts(), solSorts);
    const boule = { id: ++compteurBoules, projectile: creerProjectile(depart, but, rayon.direction) };
    boules.push(boule);
    effetsSorts.deplacerBoule(boule.id, depart.x, depart.y, depart.z);
  }

  function soigner(): void {
    const avant = jeu.vie.pv;
    jeu.vie = { ...jeu.vie, pv: Math.min(pvMax(jeu.progression), jeu.vie.pv + soinDuSort()) };
    effetsSorts.soin(() => ({ x: jeu.etat.x, y: jeu.etat.y, z: jeu.etat.z }));
    interfaceCombat.chiffre(
      renderer.domElement.clientWidth / 2,
      renderer.domElement.clientHeight - 70,
      `+${Math.round(jeu.vie.pv - avant)}`,
      '#8fe07a',
    );
  }

  /** Les boules en vol avancent ; à l'impact : dégâts à l'ennemi touché, explosion aux autres autour. */
  function mettreAJourBoules(dt: number): void {
    if (delaiBoule !== null) {
      delaiBoule -= dt;
      if (delaiBoule <= 0) {
        delaiBoule = null;
        // Mort pendant le geste : la boule ne part pas
        if (jeu.vie.pv > 0) lancerBoule();
      }
    }
    if (boules.length === 0) return;
    const suite: BouleEnVol[] = [];
    for (const boule of boules) {
      const r = avancerProjectile(boule.projectile, dt, ciblesDesSorts(), solSorts);
      if (r.projectile) {
        boule.projectile = r.projectile;
        effetsSorts.deplacerBoule(boule.id, r.projectile.x, r.projectile.y, r.projectile.z);
        suite.push(boule);
        continue;
      }
      effetsSorts.retirerBoule(boule.id);
      if (r.impact) exploser(r.impact);
    }
    boules = suite;
  }

  function exploser(impact: ImpactProjectile): void {
    const B = CONFIG.sorts.bouleDeFeu;
    const degats = degatsBouleDeFeu();
    // Boule de feu II : explosion plus large
    const rayon = B.rayonExplosion * facteurRayonExplosion(jeu.progression);
    effetsSorts.explosion(impact.x, impact.y, impact.z, rayon);
    const touches = ciblesDansExplosion(ciblesDesSorts(), impact, rayon, impact.cible);
    if (impact.cible) {
      const present = jeu.ennemis.get(impact.cible);
      if (present) dep.infligerDegatsEnnemi(present, degats.direct, impact.x, impact.z, '#ffb060');
    }
    for (const id of touches) {
      const present = jeu.ennemis.get(id);
      if (present) dep.infligerDegatsEnnemi(present, degats.explosion, impact.x, impact.z, '#ffb060');
    }
  }

  return { utiliserSort, mettreAJourBoules };
}

export type Sorts = ReturnType<typeof creerSorts>;
