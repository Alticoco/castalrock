// Panneau d'aide des touches (touche H). Affiché seul au tout premier lancement
// (retenu dans le navigateur), jusqu'au premier mouvement ou au bout de quelques secondes.

import { CONFIG } from '../config';
import { OUTILS_DE_TEST } from '../moteur/modeTest';
import { PANNEAU_FORT, T, TITRE } from './theme';

const CLE_VU = 'castalrock.aideVue';

interface Groupe {
  readonly titre: string;
  readonly lignes: ReadonlyArray<readonly [string, string]>;
}

// Deux colonnes de groupes par thème : l'aide tient sur un écran sans défiler
const COLONNES: ReadonlyArray<readonly Groupe[]> = [
  [
    {
      titre: 'Déplacement',
      lignes: [
        ['Z Q S D', 'se déplacer'],
        ['Shift', 'courir'],
        ['Espace', 'sauter'],
        ['Espace maintenu face à une paroi', 'grimper'],
        ['V', 'changer de vue'],
        ['F', 'caméra libre'],
      ],
    },
    {
      titre: 'Actions',
      lignes: [
        ['Clic', 'frapper, récolter, combattre (maintenu : répéter)'],
        ['Clic maintenu 1 s (épée)', 'coup puissant, au relâchement (compétence Coup puissant)'],
        ['Clic droit', "planter une pousse d'arbre"],
        ['Clic droit maintenu (épée)', 'lever le bouclier (compétence Parade et bouclier fabriqué)'],
        ['E', 'interagir (coffre, établi, forgeron, panneau, auberge, feu, butin)'],
        ['G', 'poser un feu de camp (kit de feu de camp)'],
        ['R', 'boire une potion de soin'],
        ['P', 'pilote automatique : récolte et combat seul dans 25 m'],
      ],
    },
  ],
  [
    {
      titre: 'Outils et sorts',
      lignes: [
        ['1 2 3 4 5 6', "épée / hache / pioche / arc / torche / objets posables"],
        ['Clic maintenu (arc)', "tendre l'arc ; relâcher pour tirer (une flèche par tir)"],
        ['6 (de nouveau)', "passer de la pousse d'arbre au piège (clic gauche : poser)"],
        ['Molette', 'case suivante / précédente'],
        ['A / X / C', 'sorts : boule de feu / soin / barrière'],
      ],
    },
    {
      titre: 'Écrans',
      lignes: [
        ['Tab / I', 'inventaire et sac magique'],
        ['K', 'compétences'],
        ['J', 'quêtes'],
        ['M', 'carte (agrandir / refermer)'],
        ['H', 'afficher / masquer cette aide'],
        ['Échap', 'menu (pause, sauvegarde, graphismes)'],
      ],
    },
    {
      titre: OUTILS_DE_TEST ? 'Outils de test' : 'Affichage',
      lignes: [
        ['F3', 'images par seconde'],
        // Seulement quand le jeu tourne en développement (src/moteur/modeTest.ts)
        ...(OUTILS_DE_TEST
          ? ([
              ['T', 'accélérer le temps (maintenu)'],
              ['F6', 'niveau de village suivant'],
              ['F7', 'lancer une attaque de bandits'],
              ['F8', "aller au prochain lieu de l'histoire (camp, puis ruines de Castalrock)"],
            ] as [string, string][])
          : []),
      ],
    },
  ],
];

export interface Aide {
  /** Affiche ou masque le panneau (touche H). */
  basculer(): void;
  /** Affiche ou masque le panneau directement (menu pause). */
  afficher(visible: boolean): void;
  /** À appeler à chaque image : ferme l'affichage automatique après un délai ou au premier mouvement. */
  mettreAJour(dt: number, aBouge: boolean): void;
}

export function creerAide(racine: HTMLElement): Aide {
  const panneau = document.createElement('div');
  panneau.style.cssText =
    `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(780px,94vw);padding:20px 26px;${PANNEAU_FORT}` +
    `backdrop-filter:${T.flou};-webkit-backdrop-filter:${T.flou};font-family:${T.corps};font-size:15px;` +
    `color:${T.texte};user-select:none;opacity:0;transition:opacity 0.3s;z-index:30;`;
  const titre = `<div style="${TITRE}font-size:22px;font-weight:700;letter-spacing:0.04em;color:${T.or};margin-bottom:12px">Touches</div>`;
  const groupe = (g: Groupe) =>
    '<div style="margin-bottom:12px">' +
    `<div style="${TITRE}font-size:15px;letter-spacing:0.04em;color:${T.accent};border-bottom:1px solid ${T.filetCase};padding-bottom:3px;margin-bottom:5px">${g.titre}</div>` +
    // Touche au-dessus de son effet si elle est longue (plus de 12 caractères), sinon côte à côte dans une colonne de 92 px
    g.lignes
      .map(([touche, effet]) =>
        touche.length > 12
          ? '<div style="margin:5px 0;font-size:15px">' +
            `<div style="font-weight:700;color:${T.or}">${touche}</div><div style="color:${T.texte}">${effet}</div></div>`
          : '<div style="display:grid;grid-template-columns:92px 1fr;gap:12px;margin:3px 0;font-size:15px">' +
            `<b style="color:${T.or}">${touche}</b><span style="color:${T.texte}">${effet}</span></div>`,
      )
      .join('') +
    '</div>';
  const colonnes =
    '<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:28px">' +
    COLONNES.map((c) => `<div>${c.map(groupe).join('')}</div>`).join('') +
    '</div>';
  panneau.innerHTML = titre + colonnes;
  racine.appendChild(panneau);

  let visible = false;
  // Affichage automatique : seulement si l'aide n'a jamais été montrée dans ce navigateur
  let auto = false;
  let resteAuto = 0;

  function afficher(v: boolean): void {
    visible = v;
    panneau.style.opacity = v ? '1' : '0';
  }

  try {
    if (!window.localStorage.getItem(CLE_VU)) {
      window.localStorage.setItem(CLE_VU, '1');
      auto = true;
      resteAuto = CONFIG.aide.dureeAutoSecondes;
      afficher(true);
    }
  } catch {
    // Stockage indisponible : l'aide reste accessible avec H
  }

  return {
    afficher(v) {
      auto = false;
      afficher(v);
    },
    basculer() {
      auto = false;
      afficher(!visible);
    },
    mettreAJour(dt, aBouge) {
      if (!auto) return;
      resteAuto -= dt;
      if (aBouge || resteAuto <= 0) {
        auto = false;
        afficher(false);
      }
    },
  };
}
