// Écran de fabrication : ouvert avec E devant l'établi ou le forgeron. Dans le style de l'écran d'inventaire,
// il liste les recettes du lieu, leurs ingrédients (« possédé / requis », en rouge s'il en manque)
// et un bouton « Fabriquer ». Aucune règle de jeu ici : l'écran dessine et signale les clics.

import {
  NOMS_LIEUX,
  quantitePossedee,
  raisonImpossible,
  recettesDuLieu,
  MESSAGES_FABRICATION,
  messageRefus,
  type EtatFabrication,
  type LieuFabrication,
} from '../regles/fabrication';
import { EMPLACEMENTS_USURE, NOMS_ARMURE, coutReparation, durabiliteMax, type EmplacementUsure } from '../regles/equipement';
import { definitionObjet } from '../regles/inventaire';
import { icone } from './ecranInventaire';
import {
  CASE,
  LIGNE,
  PANNEAU_ECRAN,
  SEPARATEUR_HAUT,
  T,
  TITRE_ECRAN,
  TITRE_SECTION,
  VOILE_ECRAN,
  couleurMessage,
  majuscule,
  styleBoutonPrincipal,
  styleBoutonSecondaire,
} from './theme';

export interface MessageFabrication {
  texte: string;
  /** Vrai : réussite (vert) ; faux : refus (rouge) */
  ok: boolean;
}

export interface EcranFabrication {
  readonly ouvert: boolean;
  readonly lieu: LieuFabrication | null;
  /** `surRepos` : au feu de camp posé, ajoute le choix « Se reposer » à côté de la cuisine */
  ouvrir(lieu: LieuFabrication, surRepos?: () => void): void;
  fermer(): void;
  /** Donne l'état à dessiner (redessine tout de suite si l'écran est ouvert), avec un message de résultat éventuel. */
  afficher(etat: EtatFabrication, message?: MessageFabrication): void;
}

const NOMS_REPARATION: Readonly<Record<EmplacementUsure, string>> = {
  hache: 'Hache',
  pioche: 'Pioche',
  epee: 'Épée',
  armure: 'Armure',
};

/** Nom d'un ingrédient : celui du catalogue d'inventaire, avec une majuscule. */
function nomIngredient(objet: string): string {
  return majuscule(definitionObjet(objet).nom);
}

export function creerEcranFabrication(
  racine: HTMLElement,
  /** Clic sur « Fabriquer » : l'appelant fabrique puis redonne l'état avec `afficher` */
  surFabrication: (idRecette: string) => void,
  /** Clic sur « Fermer » */
  surFermeture: () => void,
  /** Clic sur « Réparer » (forge) : l'appelant répare puis redonne l'état avec `afficher` */
  surReparation: (emplacement: EmplacementUsure) => void = () => {},
): EcranFabrication {
  const voile = document.createElement('div');
  voile.dataset.role = 'ecran-fabrication';
  voile.style.cssText = VOILE_ECRAN;
  const panneau = document.createElement('div');
  panneau.style.cssText = `${PANNEAU_ECRAN}min-width:600px;max-width:720px;`;
  voile.appendChild(panneau);
  racine.appendChild(voile);

  let ouvert = false;
  let lieu: LieuFabrication | null = null;
  let etat: EtatFabrication | null = null;
  let message: MessageFabrication | undefined;
  let reposPossible: (() => void) | null = null;

  /** Section « Réparer » de la forge : équipement abîmé, coût proportionnel à l'usure, bouton de réparation. */
  function sectionReparation(e: EtatFabrication): HTMLElement {
    const section = document.createElement('div');
    section.dataset.role = 'reparation';
    section.style.cssText = `display:flex;flex-direction:column;gap:8px;margin-top:4px;${SEPARATEUR_HAUT}`;
    const titreSection = document.createElement('div');
    titreSection.textContent = 'Réparer';
    titreSection.style.cssText = TITRE_SECTION;
    section.appendChild(titreSection);
    let nombre = 0;
    for (const emplacement of EMPLACEMENTS_USURE) {
      const cout = coutReparation(e.equipement, emplacement, e.facteurCoutReparation);
      if (!cout) continue;
      nombre += 1;
      const possede = quantitePossedee(e, cout.objet);
      const assez = possede >= cout.quantite;
      const ligne = document.createElement('div');
      ligne.dataset.reparation = emplacement;
      ligne.style.cssText = LIGNE;
      const nom = document.createElement('div');
      nom.style.cssText = 'flex:1;font-weight:700;font-size:16px;';
      const niveau = emplacement !== 'armure' ? e.equipement.outils[emplacement] : 'base';
      const libelle =
        emplacement === 'armure' ? NOMS_ARMURE[e.equipement.armure ?? 'fibres'] : `${NOMS_REPARATION[emplacement]} en ${niveau === 'base' ? 'bois' : niveau}`;
      nom.textContent = `${libelle} : ${Math.round(e.equipement.durabilite[emplacement])} / ${durabiliteMax(e.equipement, emplacement)}`;
      const prix = document.createElement('span');
      prix.dataset.manque = assez ? '0' : '1';
      prix.textContent = `${nomIngredient(cout.objet)} ${possede} / ${cout.quantite}`;
      prix.style.cssText = assez ? `color:${T.usureBonne};font-weight:600;` : `color:${T.ennemi};font-weight:700;`;
      const bouton = document.createElement('button');
      bouton.dataset.reparer = emplacement;
      bouton.textContent = 'Réparer';
      bouton.disabled = !assez;
      bouton.style.cssText = styleBoutonPrincipal(assez);
      ligne.append(nom, prix, bouton);
      section.appendChild(ligne);
    }
    if (nombre === 0) {
      const rien = document.createElement('div');
      rien.textContent = 'Tout votre équipement est en bon état';
      rien.style.cssText = `font-size:14px;color:${T.doux};`;
      section.appendChild(rien);
    }
    return section;
  }

  function dessiner(): void {
    if (!ouvert || !lieu || !etat) return;
    const titre = document.createElement('div');
    titre.textContent = NOMS_LIEUX[lieu];
    titre.style.cssText = TITRE_ECRAN;

    const liste = document.createElement('div');
    liste.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    for (const recette of recettesDuLieu(lieu)) {
      const raison = raisonImpossible(etat, recette);
      const ligne = document.createElement('div');
      ligne.dataset.recette = recette.id;
      ligne.style.cssText = LIGNE;

      const cadre = document.createElement('div');
      cadre.style.cssText = `${CASE}flex:none;width:56px;height:56px;`;
      cadre.innerHTML = `<div style="position:absolute;inset:5px">${icone(recette.icone)}</div>`;

      const texte = document.createElement('div');
      texte.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:3px;';
      const nom = document.createElement('div');
      nom.textContent = recette.nom;
      nom.style.cssText = `${TITRE_SECTION}font-size:16px;`;
      const description = document.createElement('div');
      description.textContent = recette.description;
      description.style.cssText = `font-size:14px;color:${T.doux};`;
      const ingredients = document.createElement('div');
      ingredients.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px 14px;font-size:14px;';
      for (const ing of recette.ingredients) {
        const possede = quantitePossedee(etat, ing.objet);
        const manque = possede < ing.quantite;
        const el = document.createElement('span');
        el.dataset.ingredient = ing.objet;
        el.dataset.manque = manque ? '1' : '0';
        el.textContent = `${nomIngredient(ing.objet)} ${possede} / ${ing.quantite}`;
        el.style.cssText = manque ? `color:${T.ennemi};font-weight:700;` : `color:${T.usureBonne};font-weight:600;`;
        ingredients.appendChild(el);
      }
      texte.append(nom, description, ingredients);
      // Conditions autres que les ingrédients : niveau de village, étape d'histoire, palier de l'outil possédé
      if (raison === 'village-insuffisant' || raison === 'palier-precedent' || raison === 'histoire-manquante') {
        const condition = document.createElement('div');
        condition.dataset.role = 'condition-recette';
        condition.textContent = messageRefus(recette, raison);
        condition.style.cssText = `font-size:14px;font-weight:700;color:${T.ennemi};`;
        texte.appendChild(condition);
      }

      const bouton = document.createElement('button');
      bouton.dataset.fabriquer = recette.id;
      bouton.textContent = raison === 'deja-possede' ? MESSAGES_FABRICATION[raison] : lieu === 'feu' ? 'Cuisiner' : 'Fabriquer';
      bouton.disabled = raison !== null;
      bouton.style.cssText = styleBoutonPrincipal(raison === null);

      ligne.append(cadre, texte, bouton);
      liste.appendChild(ligne);
    }

    const reparations = lieu === 'forge' ? sectionReparation(etat) : null;

    const pied = document.createElement('div');
    pied.style.cssText = `display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:14px;margin-top:4px;${SEPARATEUR_HAUT}`;
    const info = document.createElement('span');
    info.dataset.role = 'message-fabrication';
    info.style.cssText = `flex:1;font-weight:700;min-height:20px;color:${message ? couleurMessage(message.ok) : T.doux};`;
    info.textContent = message?.texte ?? 'Ingrédients pris dans ton inventaire, puis dans le coffre du village';
    const fermer = document.createElement('button');
    fermer.textContent = 'Fermer (E)';
    fermer.style.cssText = styleBoutonSecondaire();
    fermer.addEventListener('click', surFermeture);
    if (lieu === 'feu' && reposPossible) {
      const repos = document.createElement('button');
      repos.dataset.role = 'repos-au-feu';
      repos.textContent = 'Se reposer';
      repos.style.cssText = `${styleBoutonSecondaire()}color:${T.accent};border-color:${T.accent};font-weight:700;`;
      repos.addEventListener('click', () => reposPossible?.());
      pied.append(info, repos, fermer);
    } else {
      pied.append(info, fermer);
    }

    panneau.replaceChildren(...(reparations ? [titre, liste, reparations, pied] : [titre, liste, pied]));
  }

  // Clic sur le voile sombre lui-même (pas sur le panneau) : ferme l'écran. L'appui doit aussi avoir commencé sur le
  // voile : la barre de défilement de la liste relâchée à côté du panneau ne ferme rien
  let appuiSurVoile = false;
  voile.addEventListener('mousedown', (e) => {
    appuiSurVoile = e.button === 0 && e.target === voile;
  });
  voile.addEventListener('click', (e) => {
    const valide = appuiSurVoile && e.target === voile;
    appuiSurVoile = false;
    if (valide) surFermeture();
  });

  panneau.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-fabriquer]');
    if (b && !b.disabled) surFabrication(b.dataset.fabriquer as string);
    const r = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-reparer]');
    if (r && !r.disabled) surReparation(r.dataset.reparer as EmplacementUsure);
  });

  return {
    get ouvert() {
      return ouvert;
    },
    get lieu() {
      return ouvert ? lieu : null;
    },
    ouvrir(l, surRepos) {
      ouvert = true;
      lieu = l;
      reposPossible = surRepos ?? null;
      message = undefined;
      voile.style.display = 'flex';
      dessiner();
    },
    fermer() {
      ouvert = false;
      voile.style.display = 'none';
    },
    afficher(e, m) {
      etat = e;
      message = m;
      dessiner();
    },
  };
}
