// Ambiance : chunks du monde, eau, temps du jeu, repousse, ciel, lumières, horloge, village, mine et lumière de la torche.
import { CONFIG } from '../config';
import { facteurLumiere, heureDuJeu } from '../regles/temps';
import { creerLumiereTorche } from '../scene/torche';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';
import type { Repousse } from './repousse';
import type { Campement } from './campement';
import type { PiegesJeu } from './pieges';
import { OUTILS_DE_TEST } from '../moteur/modeTest';

export interface DependancesAmbiance {
  repousse: Repousse;
  campement: Campement;
  pieges: PiegesJeu;
}

export function creerAmbiance(jeu: EtatJeu, ctx: Contexte, dep: DependancesAmbiance) {
  const { camera, terrain, chunks, eau, mine, maison, entrees, cycleJour, lumieres, village, horloge } = ctx;
  // Lumière de la torche créée d'avance (éteinte) : le nombre de lumières de la scène ne change jamais
  const lumiereTorche = creerLumiereTorche();
  ctx.scene.add(lumiereTorche.lumiere);

  /** À chaque image, en fin de frame : le monde suit le personnage, le temps avance, ciel et lumières suivent. */
  function mettreAJour(dt: number): void {
    const { etat, visite } = jeu;
    // Le monde suit le personnage ; en caméra libre il suit la caméra, pour visiter au loin
    const centreX = visite ? camera.position.x : etat.x;
    const centreZ = visite ? camera.position.z : etat.z;
    // (dans la mine, aucun chunk du monde ne se charge)
    if (!mine.contient(centreX, centreZ)) chunks.mettreAJour(centreX, centreZ);
    eau.mettreAJour(dt);

    // Temps du jeu (T maintenue : accéléré), puis ciel, lumières et horloge
    jeu.tempsJeu += dt * (OUTILS_DE_TEST && entrees.appuye('KeyT') ? CONFIG.temps.facteurAcceleration : 1);
    dep.repousse.mettreAJour(dt);
    dep.pieges.mettreAJour();
    const heure = heureDuJeu(jeu.tempsJeu, CONFIG.temps);
    cycleJour.mettreAJour(heure, camera);
    // Torche en main : son aura suit le joueur ; dans la mine, elle remplace la lampe du joueur
    const torche = jeu.emplacement === 'torche';
    const obscurite = 1 - facteurLumiere(heure, CONFIG.temps);
    mine.definirTorche(torche);
    mine.mettreAJour(dt, etat, camera);
    maison.mettreAJour(dt, etat);
    lumiereTorche.mettreAJour(dt, torche, etat, obscurite, mine.dedans);
    village.mettreAJour(dt, obscurite);
    dep.campement.mettreAJourFeu(dt, obscurite);
    horloge.afficher(heure, cycleJour.soleilLeve);
    lumieres.suivre(centreX, visite ? terrain.hauteur(centreX, centreZ) : etat.y, centreZ);
  }

  return { mettreAJour };
}

export type Ambiance = ReturnType<typeof creerAmbiance>;
