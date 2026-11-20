// Boîte de dialogue : en bas au centre, au-dessus de la barre d'outils, dans le style « Ardoise et laiton » des autres écrans.
// Le nom de l'habitant en titre, sa réplique, puis soit « E ou clic : continuer », soit des choix numérotés (1, 2, 3…).
// Aucune règle de jeu ici : l'écran dessine ce qu'on lui donne et signale les clics.

import { PANNEAU_FORT, T, TITRE } from './theme';

export interface OptionAffichee {
  libelle: string;
}

export interface DonneesDialogue {
  nom: string;
  texte: string;
  /** Petite ligne sous la réplique (titre et récompense d'une quête, progression…) */
  note?: string;
  /** Vrai : le joueur passe à la suite avec E ou un clic ; faux : il doit choisir une option */
  peutContinuer: boolean;
  options: readonly OptionAffichee[];
}

export interface BoiteDialogue {
  readonly ouvert: boolean;
  afficher(donnees: DonneesDialogue): void;
  fermer(): void;
}

/** Distance au bas de l'écran : au-dessus de la barre d'outils (case + jauge + marge), en pixels */
const BAS = 112;

export function creerEcranDialogue(racine: HTMLElement, surContinuer: () => void, surChoix: (rang: number) => void): BoiteDialogue {
  const boite = document.createElement('div');
  boite.dataset.role = 'dialogue';
  boite.style.cssText =
    `position:absolute;left:50%;bottom:${BAS}px;transform:translateX(-50%);display:none;flex-direction:column;gap:8px;` +
    `width:min(720px,92vw);padding:28px 26px 14px;${PANNEAU_FORT}color:${T.texte};` +
    `backdrop-filter:${T.flou};-webkit-backdrop-filter:${T.flou};` +
    `z-index:15;pointer-events:auto;user-select:none;font-family:${T.corps};`;

  // Le nom : une étiquette dorée qui dépasse du haut de la boîte
  const nom = document.createElement('div');
  nom.dataset.role = 'dialogue-nom';
  nom.style.cssText =
    `${TITRE}position:absolute;left:24px;top:-18px;padding:4px 20px;border-radius:999px;background:${T.or};color:${T.encre};` +
    'font-size:16px;font-weight:700;letter-spacing:0.06em;box-shadow:0 4px 10px rgba(0,0,0,0.35);';
  const texte = document.createElement('div');
  texte.dataset.role = 'dialogue-texte';
  texte.style.cssText = `font-size:19px;line-height:1.45;min-height:28px;color:${T.texte};`;
  const note = document.createElement('div');
  note.dataset.role = 'dialogue-note';
  note.style.cssText = `font-size:14px;font-weight:700;color:${T.ressource};`;
  const choix = document.createElement('div');
  choix.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:2px;';
  const aide = document.createElement('div');
  aide.style.cssText = `font-size:13px;color:${T.doux};text-align:right;`;
  boite.append(nom, texte, note, choix, aide);
  racine.appendChild(boite);

  let ouvert = false;
  let continuer = false;

  // Un clic sur la boîte passe à la suite (les boutons de choix ont leur propre clic)
  boite.addEventListener('click', () => {
    if (ouvert && continuer) surContinuer();
  });

  return {
    get ouvert() {
      return ouvert;
    },
    afficher(donnees) {
      ouvert = true;
      continuer = donnees.peutContinuer;
      boite.style.display = 'flex';
      nom.textContent = donnees.nom;
      texte.textContent = `« ${donnees.texte} »`;
      note.textContent = donnees.note ?? '';
      note.style.display = donnees.note ? 'block' : 'none';
      choix.replaceChildren();
      donnees.options.forEach((option, rang) => {
        const bouton = document.createElement('button');
        bouton.dataset.role = 'dialogue-choix';
        bouton.textContent = `${rang + 1}. ${option.libelle}`;
        bouton.style.cssText =
          `text-align:left;padding:8px 16px;border-radius:${T.rayonCase};border:1px solid ${T.filet};background:${T.fondCase};color:${T.texte};` +
          `font-family:${T.corps};font-size:17px;font-weight:500;cursor:pointer;`;
        bouton.addEventListener('mouseenter', () => (bouton.style.background = 'rgba(214,182,110,0.22)'));
        bouton.addEventListener('mouseleave', () => (bouton.style.background = T.fondCase));
        bouton.addEventListener('click', (e) => {
          e.stopPropagation();
          surChoix(rang);
        });
        choix.appendChild(bouton);
      });
      aide.textContent = donnees.peutContinuer ? 'E ou clic : continuer   |   Échap ou clic à côté : partir' : 'Touches 1 à 9 ou clic : choisir   |   Échap ou clic à côté : partir';
    },
    fermer() {
      ouvert = false;
      boite.style.display = 'none';
    },
  };
}
