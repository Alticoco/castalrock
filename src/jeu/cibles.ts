import { INFOS_ENNEMIS } from '../regles/combat';
import type { CibleSort } from '../regles/sorts';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';

/** Ennemis et animaux vivants, vus comme des cylindres verticaux (flèches et sorts). */
export function ciblesVivantes(jeu: EtatJeu): CibleSort[] {
  const liste: CibleSort[] = [];
  for (const { etat: e, modele } of jeu.ennemis.values()) {
    if (e.phase === 'mort') continue;
    liste.push({ id: e.id, x: e.x, y: e.y, z: e.z, rayon: INFOS_ENNEMIS[e.type].rayon, hauteur: modele.hauteur });
  }
  return liste;
}

/** Les projectiles s'arrêtent sur le sol, et sur la surface de l'eau (celles qui tombent à l'eau sont perdues). */
export function creerSolProjectiles(terrain: Contexte['terrain']): (x: number, z: number) => number {
  return (x, z) => Math.max(terrain.hauteur(x, z), terrain.niveauEau);
}
