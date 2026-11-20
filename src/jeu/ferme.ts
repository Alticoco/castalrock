// Ferme du village : poules et moutons qui se promènent (règles : src/regles/ferme.ts, modèles : src/scene/modelesFerme.ts).
// Pur décor : on ne peut ni les attaquer ni les récolter, ils ne bloquent pas le joueur. Rien n'est sauvegardé.
// Ils suivent le niveau du village affiché (les moutons arrivent au niveau 2), ne bougent plus à plus de 60 m du joueur
// ni quand le joueur est dans la mine ou la maison, et les poules restent sur place la nuit.
import * as THREE from 'three';
import { CONFIG } from '../config';
import { creerAleatoire, type Aleatoire } from '../regles/aleatoire';
import { avancerAnimal, creerEtatAnimal, decrireFerme, vitesseAnimal, type DefinitionAnimal, type EtatAnimal } from '../regles/ferme';
import { tournerVers } from '../regles/habitants';
import { heureDuJeu } from '../regles/temps';
import { obstaclesVillage, type NiveauVillage, type ObstaclesVillage } from '../regles/village';
import { creerMouton, creerPoule, type AnimalFerme } from '../scene/modelesFerme';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';

interface AnimalVivant {
  def: DefinitionAnimal;
  etat: EtatAnimal;
  /** Lacet affiché : il tourne vers `etat.orientation` plutôt que d'y sauter */
  cap: number;
  alea: Aleatoire;
  modele: AnimalFerme;
}

export function creerFerme(jeu: EtatJeu, ctx: Contexte) {
  const { scene, terrain, mine } = ctx;
  const R = CONFIG.ferme;
  const racine = new THREE.Group();
  racine.name = 'ferme';
  scene.add(racine);

  let niveau: NiveauVillage | null = null;
  let village: ObstaclesVillage = { cercles: [], rectangles: [] };
  let animaux: AnimalVivant[] = [];

  /** Nouveau niveau du village (ou début de partie) : les animaux sont recréés. */
  function reconstruire(nouveau: NiveauVillage): void {
    for (const a of animaux) {
      racine.remove(a.modele.objet);
      a.modele.liberer();
    }
    niveau = nouveau;
    village = obstaclesVillage(nouveau);
    animaux = decrireFerme(nouveau).map((def) => {
      const alea = creerAleatoire(def.graine);
      const etat = creerEtatAnimal(def, alea, village);
      const modele = def.espece === 'poule' ? creerPoule(def.variante) : creerMouton(def.variante);
      racine.add(modele.objet);
      return { def, etat, cap: etat.orientation, alea, modele };
    });
    for (const a of animaux) poser(a);
  }

  function poser(a: AnimalVivant): void {
    a.modele.objet.position.set(a.etat.x, terrain.hauteur(a.etat.x, a.etat.z), a.etat.z);
    a.modele.objet.rotation.y = a.cap;
  }

  /** À chaque image : fait vivre les animaux proches du joueur. */
  function mettreAJour(dt: number): void {
    if (jeu.niveauVillage !== niveau) reconstruire(jeu.niveauVillage);
    const { x, z } = jeu.etat;
    const dedans = mine.contient(x, z);
    racine.visible = !dedans;
    if (dedans) return;
    const H = CONFIG.habitants;
    const heure = heureDuJeu(jeu.tempsJeu, CONFIG.temps);
    const nuit = heure >= H.debutNuit || heure < H.debutJour;
    for (const a of animaux) {
      if (Math.hypot(a.etat.x - x, a.etat.z - z) > R.distanceMiseAJour) continue;
      a.etat = avancerAnimal(a.def, a.etat, dt, a.alea, village, nuit && a.def.espece === 'poule');
      a.cap = tournerVers(a.cap, a.etat.orientation, R.vitesseRotation * dt);
      poser(a);
      a.modele.animer(dt, { vitesse: a.etat.cible ? vitesseAnimal(a.def.espece) : 0, activite: a.etat.activite });
    }
  }

  return { mettreAJour };
}
