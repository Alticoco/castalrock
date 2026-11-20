// Interface de récolte : texte flottant « +3 Bois » près du centre de l'écran à chaque butin (le fil des récoltes),
// et réticule au centre (qui change de couleur sur une cible à portée). La liste des ressources se voit dans l'inventaire.

import { CONFIG } from '../config';
import { NOMS_RESSOURCES, ORDRE_RESSOURCES, type Ressources } from '../regles/recolte';
import { definitionObjet } from '../regles/inventaire';
import { SUR_DECOR, T, echapper, majuscule } from './theme';

export interface CompteurRessources {
  /** Texte flottant « +3 Bois » pour un butin. */
  annoncerButin(butin: Ressources): void;
  /** Texte flottant « +2 Gelée de slime » pour un butin d'objets quelconques (ennemis). */
  annoncerObjets(butin: Readonly<Record<string, number>>): void;
  /** Texte flottant libre (par exemple « Inventaire plein »). */
  annoncerMessage(texte: string): void;
  /** Réticule : `visible` en 1re et 3e personne, `surCible` si un élément récoltable est à portée. */
  definirReticule(visible: boolean, surCible: boolean): void;
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export function creerCompteurRessources(racine: HTMLElement): CompteurRessources {
  // Réticule : un petit rond
  const reticule = document.createElement('div');
  reticule.style.cssText =
    'position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;' +
    'border:2px solid;box-sizing:border-box;box-shadow:0 0 3px rgba(0,0,0,0.8);display:none;' +
    'transition:transform 0.12s,border-color 0.12s;';

  // Zone des textes flottants (le fil des récoltes), juste au-dessus du réticule
  const flottants = document.createElement('div');
  flottants.dataset.role = 'fil-recoltes';
  flottants.style.cssText = 'position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none;';

  racine.append(reticule, flottants);

  /** Un texte flottant : `html` est déjà échappé. Il monte et s'efface. */
  function texteFlottant(html: string): void {
    const texte = document.createElement('div');
    texte.innerHTML = html;
    texte.style.cssText =
      'position:absolute;left:0;top:-40px;transform:translateX(-50%);white-space:nowrap;user-select:none;' +
      `font-family:${T.corps};font-size:16px;font-weight:700;${SUR_DECOR}`;
    flottants.appendChild(texte);
    // Les textes affichés en même temps sont décalés pour ne pas se superposer
    const decalage = flottants.childElementCount * 26;
    const animation = texte.animate(
      [
        { transform: `translate(-50%, ${-decalage}px)`, opacity: 1 },
        { transform: `translate(-50%, ${-decalage - 50}px)`, opacity: 0 },
      ],
      { duration: CONFIG.recolte.dureeTexteButin, easing: 'ease-out' },
    );
    animation.onfinish = () => texte.remove();
  }

  /** « +2 » en blanc gras, puis le nom de la ressource en Cinzel ambre avec une majuscule. */
  function texteButin(quantite: number, nom: string): void {
    texteFlottant(
      `+${quantite} <span style="font-family:${T.titre};font-size:15px;font-weight:600;color:${T.ressource}">${echapper(majuscule(nom))}</span>`,
    );
  }

  let etatReticule = '';

  return {
    annoncerButin(butin) {
      for (const r of ORDRE_RESSOURCES) {
        const n = butin[r] ?? 0;
        if (n > 0) texteButin(n, NOMS_RESSOURCES[r]);
      }
    },

    annoncerObjets(butin) {
      for (const [objet, n] of Object.entries(butin)) {
        if (n > 0) texteButin(n, definitionObjet(objet).nom);
      }
    },

    annoncerMessage(texte) {
      texteFlottant(`<span style="color:${T.texte}">${echapper(texte)}</span>`);
    },

    definirReticule(visible, surCible) {
      const etat = `${visible}${surCible}`;
      if (etat === etatReticule) return;
      etatReticule = etat;
      reticule.style.display = visible ? 'block' : 'none';
      reticule.style.borderColor = hex(surCible ? CONFIG.recolte.couleurReticuleCible : CONFIG.recolte.couleurReticule);
      reticule.style.transform = surCible ? 'scale(1.5)' : 'scale(1)';
    },
  };
}
