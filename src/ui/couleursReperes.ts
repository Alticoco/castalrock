// Couleur de chaque type de repère personnel (boussole et carte agrandie). Affichage seulement, aucune règle.
import type { TypeRepereJoueur } from '../regles/reperes';

export const COULEURS_REPERES: Readonly<Record<TypeRepereJoueur, string>> = {
  filon: '#F09A45',
  cueillette: '#8FD18B',
  danger: '#F2806F',
  tresor: '#E8C35A',
  lieu: '#C9A2F0',
};
