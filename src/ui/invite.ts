// Invite d'interaction en bas de l'écran (« E : ouvrir le coffre ») et court message qui la remplace
// un instant (« Le forgeron vous salue »). Aucune règle de jeu ici.

import { T } from './theme';

const DUREE_MESSAGE_MS = 2200;

export interface Invite {
  /** Affiche l'invite, ou la cache avec `null`. */
  afficher(texte: string | null): void;
  /** Affiche un message pendant environ 2 secondes. */
  annoncer(texte: string): void;
}

export function creerInvite(racine: HTMLElement): Invite {
  const style =
    `position:absolute;left:50%;transform:translateX(-50%);padding:6px 20px;border-radius:${T.rayonPanneau};` +
    `font-family:${T.corps};color:${T.texte};background:${T.fond};border:1px solid ${T.filet};white-space:nowrap;` +
    `box-shadow:${T.ombre};backdrop-filter:${T.flou};-webkit-backdrop-filter:${T.flou};user-select:none;pointer-events:none;opacity:0;transition:opacity 0.2s;`;
  const invite = document.createElement('div');
  invite.dataset.role = 'invite';
  invite.style.cssText = `${style}bottom:22%;font-size:18px;font-weight:600;`;
  const message = document.createElement('div');
  message.dataset.role = 'message';
  message.style.cssText = `${style}bottom:30%;font-size:20px;font-weight:700;color:${T.or};`;
  racine.append(invite, message);

  let texteInvite: string | null = null;
  let minuterie: number | undefined;

  return {
    afficher(texte) {
      if (texte === texteInvite) return;
      texteInvite = texte;
      if (texte) invite.textContent = texte;
      invite.style.opacity = texte ? '1' : '0';
    },
    annoncer(texte) {
      message.textContent = texte;
      message.style.opacity = '1';
      if (minuterie !== undefined) window.clearTimeout(minuterie);
      minuterie = window.setTimeout(() => {
        message.style.opacity = '0';
      }, DUREE_MESSAGE_MS);
    },
  };
}
