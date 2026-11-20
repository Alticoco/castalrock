import { CONFIG } from '../config';

/** Lance la boucle de jeu ; miseAJour reçoit le temps écoulé en secondes (plafonné). */
export function lancerBoucle(miseAJour: (dt: number) => void): void {
  let dernier = performance.now();
  const image = (maintenant: number) => {
    const dt = Math.min((maintenant - dernier) / 1000, CONFIG.pasMaxDt);
    dernier = maintenant;
    miseAJour(dt);
    requestAnimationFrame(image);
  };
  requestAnimationFrame(image);
}
