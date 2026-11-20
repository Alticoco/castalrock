// Indices de direction : remplit les textes à trous (`{direction:camp}`, `{distance:camp}`…) avec la vraie position des
// lieux (voir src/regles/indices.ts). Les distances se comptent depuis le centre du village, en pas (un pas = un mètre).
import { CONFIG } from '../config';
import { indiceVers, remplirIndices, type Indice, type NomIndice } from '../regles/indices';
import type { Contexte } from './contexte';

const memoire = new WeakMap<Contexte, (texte: string) => string>();

/** La fonction qui remplit les indices d'un texte (créée une fois par partie). */
export function remplisseurIndices(ctx: Contexte): (texte: string) => string {
  let remplir = memoire.get(ctx);
  if (!remplir) {
    const A = CONFIG.habitants.aldric;
    const indices: Record<NomIndice, Indice> = {
      aldric: indiceVers(A.x, A.z),
      mine: indiceVers(ctx.mine.portail.x, ctx.mine.portail.z),
      camp: indiceVers(ctx.lieux.camp.x, ctx.lieux.camp.z),
      ruines: indiceVers(ctx.lieux.autel.x, ctx.lieux.autel.z),
    };
    remplir = (texte) => remplirIndices(texte, indices);
    memoire.set(ctx, remplir);
  }
  return remplir;
}
