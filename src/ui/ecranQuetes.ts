// Écran des quêtes : le panneau d'annonces du village (E : accepter, rendre, améliorer le village)
// et le journal (J : quêtes en cours et terminées, en lecture seule). Dans le style des autres écrans.
// Aucune règle de jeu ici : l'écran lit les règles pour dessiner et signale les clics.

import { ameliorationDebloquee, coutAmelioration, messageBlocage, peutAmeliorer, quantiteDisponible } from '../regles/ameliorationVillage';
import { TITRES_ACTES, etapesTerminees, objectifAffiche, recitsTermines, type EtatHistoire, type IdActe } from '../regles/histoire';
import { texteRecompense } from '../regles/dialogues';
import { definitionObjet } from '../regles/inventaire';
import {
  CHAINES,
  conditionsManquantes,
  niveauVillageDebloque,
  progressionQuete,
  quetesDeChaine,
  quetesEnCours,
  quetesTerminees,
  queteSuivante,
  statutQuete,
  uniteObjectif,
  type Chaine,
  type ContexteQuetes,
  type DefinitionQuete,
  type EtatQuetes,
  type PossessionQuetes,
} from '../regles/quetes';
import type { NiveauVillage } from '../regles/village';
import {
  LIGNE,
  PANNEAU_ECRAN,
  SEPARATEUR_HAUT,
  T,
  TITRE_ECRAN,
  TITRE_SECTION,
  VOILE_ECRAN,
  couleurMessage,
  echapper,
  styleBoutonPrincipal,
  styleBoutonSecondaire,
  styleOnglet,
} from './theme';

export type ModeEcranQuetes = 'panneau' | 'journal';

/** Tout ce que l'écran a besoin de connaître pour se dessiner. */
export interface DonneesEcranQuetes {
  readonly etat: EtatQuetes;
  readonly possession: PossessionQuetes;
  readonly niveauVillage: NiveauVillage;
  /** Nœuds de compétence acquis (objectif « apprendre un nœud ») */
  readonly noeuds: readonly string[];
  /** Chaîne principale : objectif actuel et récits des étapes terminées (onglet « Histoire » du journal) */
  readonly histoire: EtatHistoire;
  /** Remplit les indices de direction des textes (voir src/jeu/indices.ts) ; absent : textes tels quels */
  readonly remplir?: (texte: string) => string;
}

export interface MessageQuetes {
  texte: string;
  /** Vrai : réussite (vert) ; faux : refus (rouge) */
  ok: boolean;
}

export interface EcranQuetes {
  readonly ouvert: boolean;
  readonly mode: ModeEcranQuetes | null;
  ouvrir(mode: ModeEcranQuetes): void;
  fermer(): void;
  /** Donne l'état à dessiner (redessine tout de suite si l'écran est ouvert), avec un message de résultat éventuel. */
  afficher(donnees: DonneesEcranQuetes, message?: MessageQuetes): void;
}

function nomObjet(objet: string): string {
  const nom = definitionObjet(objet).nom;
  return nom.charAt(0).toUpperCase() + nom.slice(1);
}

function bouton(texte: string, actif: boolean): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = texte;
  b.disabled = !actif;
  b.style.cssText = styleBoutonPrincipal(actif);
  return b;
}

const STYLE_LIGNE = LIGNE;

export function creerEcranQuetes(
  racine: HTMLElement,
  surAcceptation: (id: string) => void,
  surRendu: (id: string) => void,
  surAmelioration: () => void,
  surFermeture: () => void,
): EcranQuetes {
  const voile = document.createElement('div');
  voile.dataset.role = 'ecran-quetes';
  voile.style.cssText = VOILE_ECRAN;
  const panneau = document.createElement('div');
  panneau.style.cssText = `${PANNEAU_ECRAN}min-width:600px;max-width:720px;`;
  voile.appendChild(panneau);
  racine.appendChild(voile);

  // Un clic sur le voile (à côté du panneau) ferme l'écran ; l'appui doit aussi avoir commencé sur le voile
  let appuiSurVoile = false;
  voile.addEventListener('mousedown', (e) => {
    appuiSurVoile = e.button === 0 && e.target === voile;
  });
  voile.addEventListener('click', (e) => {
    const valide = appuiSurVoile && e.target === voile;
    appuiSurVoile = false;
    if (valide) surFermeture();
  });

  let ouvert = false;
  let mode: ModeEcranQuetes = 'panneau';
  let onglet: 'annonces' | 'village' | 'quetes' | 'histoire' = 'annonces';
  let donnees: DonneesEcranQuetes | null = null;
  let message: MessageQuetes | undefined;

  function contexte(d: DonneesEcranQuetes): ContexteQuetes {
    return { niveauVillage: d.niveauVillage, noeuds: d.noeuds, etapesTerminees: etapesTerminees(d.histoire) };
  }

  function ligneQuete(q: DefinitionQuete, d: DonneesEcranQuetes, avecBoutons: boolean): HTMLElement {
    const statut = statutQuete(d.etat, q.id, contexte(d));
    const ligne = document.createElement('div');
    ligne.dataset.quete = q.id;
    ligne.dataset.statut = statut;
    ligne.style.cssText = STYLE_LIGNE + (statut === 'terminee' ? 'opacity:0.65;' : '');

    const texte = document.createElement('div');
    texte.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:3px;';
    const titre = document.createElement('div');
    titre.textContent = q.titre;
    titre.style.cssText = `${TITRE_SECTION}font-size:17px;`;
    const auteur = document.createElement('div');
    // Le villageois en vert (mot-clé personnage), la demande en texte doux : le texte lu reste « Auteur : « description » »
    auteur.innerHTML = `<span style="color:${T.personnage};font-weight:700">${echapper(q.auteur)}</span> : « ${echapper(d.remplir ? d.remplir(q.description) : q.description)} »`;
    auteur.style.cssText = `font-size:14px;color:${T.doux};`;
    const recompense = document.createElement('div');
    recompense.textContent = `Récompense : ${texteRecompense(q.recompense)}`;
    recompense.style.cssText = `font-size:14px;font-weight:600;color:${T.ressource};`;
    texte.append(titre, auteur);

    let prete = false;
    if (statut === 'en-cours') {
      const p = progressionQuete(d.etat, q, d.possession, contexte(d));
      prete = p.prete;
      const avancement = document.createElement('div');
      avancement.dataset.role = 'avancement';
      avancement.textContent = `Progression : ${p.actuel} / ${p.requis}${q.objectif.type === 'rapporter' ? ` ${uniteObjectif(q.objectif, (id) => definitionObjet(id).nom)}` : ''}`;
      avancement.style.cssText = `font-size:14px;font-weight:700;color:${prete ? T.usureBonne : T.texte};`;
      texte.appendChild(avancement);
    }
    texte.appendChild(recompense);
    if (statut === 'verrouillee') {
      for (const manque of conditionsManquantes(d.etat, q, contexte(d))) {
        const cond = document.createElement('div');
        cond.dataset.role = 'condition';
        cond.textContent = manque;
        cond.style.cssText = `font-size:14px;font-weight:700;color:${T.ennemi};`;
        texte.appendChild(cond);
      }
      ligne.style.opacity = '0.8';
    }
    ligne.appendChild(texte);

    if (statut === 'terminee') {
      const fait = document.createElement('span');
      fait.textContent = 'Terminée';
      fait.style.cssText = `font-weight:700;color:${T.usureBonne};`;
      ligne.appendChild(fait);
    } else if (avecBoutons && statut === 'proposee') {
      const b = bouton('Accepter', true);
      b.dataset.accepter = q.id;
      ligne.appendChild(b);
    } else if (avecBoutons && statut === 'en-cours') {
      const b = bouton('Rendre', prete);
      b.dataset.rendre = q.id;
      ligne.appendChild(b);
    }
    return ligne;
  }

  /** Une chaîne : le villageois, son avancement, et sa prochaine quête (ou la fin de la chaîne). */
  function groupeChaine(c: Chaine, d: DonneesEcranQuetes): HTMLElement {
    const groupe = document.createElement('div');
    groupe.dataset.chaine = c.id;
    groupe.style.cssText = 'display:flex;flex-direction:column;gap:5px;';
    const toutes = quetesDeChaine(c.id);
    const faites = toutes.filter((q) => d.etat.terminees.includes(q.id)).length;
    const entete = document.createElement('div');
    entete.textContent = `${c.nom} : ${c.titre} (${faites}/${toutes.length})`;
    entete.style.cssText = `${TITRE_SECTION}font-size:15px;color:${T.or};`;
    groupe.appendChild(entete);
    const suivante = queteSuivante(d.etat, c.id);
    if (suivante) {
      groupe.appendChild(ligneQuete(suivante, d, true));
    } else {
      const fin = document.createElement('div');
      fin.textContent = 'Plus rien à te demander pour le moment…';
      fin.style.cssText = `font-size:14px;color:${T.doux};`;
      groupe.appendChild(fin);
    }
    return groupe;
  }

  function sectionVillage(d: DonneesEcranQuetes): HTMLElement {
    const section = document.createElement('div');
    section.dataset.role = 'section-village';
    section.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    const cout = coutAmelioration(d.niveauVillage);
    const etat = document.createElement('div');
    etat.textContent = `Le village est au niveau ${d.niveauVillage}`;
    etat.style.cssText = `${TITRE_SECTION}font-size:17px;`;
    section.appendChild(etat);
    if (!cout) {
      const max = document.createElement('div');
      max.textContent = 'Le village a atteint son niveau maximal.';
      section.appendChild(max);
      return section;
    }
    const ligne = document.createElement('div');
    ligne.style.cssText = STYLE_LIGNE;
    const texte = document.createElement('div');
    texte.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:4px;';
    const titre = document.createElement('div');
    titre.textContent = `Passer au niveau ${d.niveauVillage + 1}`;
    titre.style.cssText = `${TITRE_SECTION}font-size:17px;`;
    const ingredients = document.createElement('div');
    ingredients.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px 14px;font-size:14px;';
    for (const ing of cout) {
      const possede = quantiteDisponible(d.possession, ing.objet);
      const manque = possede < ing.quantite;
      const el = document.createElement('span');
      el.dataset.ingredient = ing.objet;
      el.dataset.manque = manque ? '1' : '0';
      el.textContent = `${nomObjet(ing.objet)} ${possede} / ${ing.quantite}`;
      el.style.cssText = manque ? `color:${T.ennemi};font-weight:700;` : `color:${T.usureBonne};font-weight:600;`;
      ingredients.appendChild(el);
    }
    texte.append(titre, ingredients);
    const etatAmelioration = { niveau: d.niveauVillage, ...d.possession, niveauDebloque: niveauVillageDebloque(d.etat, d.niveauVillage) };
    if (!ameliorationDebloquee(etatAmelioration)) {
      const blocage = document.createElement('div');
      blocage.dataset.role = 'blocage-village';
      blocage.textContent = messageBlocage(d.niveauVillage + 1);
      blocage.style.cssText = `font-size:14px;font-weight:700;color:${T.ennemi};`;
      texte.appendChild(blocage);
    }
    const b = bouton('Améliorer', peutAmeliorer(etatAmelioration));
    b.dataset.ameliorer = '1';
    ligne.append(texte, b);
    section.appendChild(ligne);
    return section;
  }

  /** Journal de l'histoire : l'objectif en cours, puis les récits des étapes terminées, acte par acte. */
  function sectionHistoire(d: DonneesEcranQuetes): HTMLElement {
    const section = document.createElement('div');
    section.dataset.role = 'section-histoire';
    section.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    const objectif = objectifAffiche(d.histoire, d.remplir);
    const actuel = document.createElement('div');
    actuel.dataset.role = 'objectif-histoire';
    actuel.textContent = objectif ?? 'Le Cœur de Castal bat de nouveau. La vallée est à toi.';
    actuel.style.cssText = `${STYLE_LIGNE}font-size:16px;font-weight:700;color:${T.texte};`;
    section.appendChild(actuel);
    const recits = recitsTermines(d.histoire);
    if (recits.length === 0) {
      const rien = document.createElement('div');
      rien.textContent = 'Ton histoire ne fait que commencer.';
      rien.style.cssText = `font-size:14px;color:${T.doux};`;
      section.appendChild(rien);
    }
    let acte: IdActe | null = null;
    for (const r of recits) {
      if (r.acte !== acte) {
        acte = r.acte;
        const titre = document.createElement('div');
        titre.dataset.acte = r.acte;
        titre.textContent = TITRES_ACTES[r.acte];
        titre.style.cssText = `${TITRE_SECTION}font-size:15px;color:${T.or};margin-top:6px;${SEPARATEUR_HAUT}`;
        section.appendChild(titre);
      }
      const para = document.createElement('div');
      para.dataset.role = 'recit';
      para.textContent = r.recit;
      para.style.cssText = `font-size:15px;line-height:1.45;color:${T.texte};`;
      section.appendChild(para);
    }
    return section;
  }

  function dessiner(): void {
    if (!ouvert || !donnees) return;
    const d = donnees;
    const elements: HTMLElement[] = [];

    const titre = document.createElement('div');
    titre.textContent = mode === 'panneau' ? "Panneau d'annonces" : 'Journal';
    titre.style.cssText = TITRE_ECRAN;
    elements.push(titre);

    {
      const onglets = document.createElement('div');
      onglets.style.cssText = 'display:flex;gap:8px;';
      const liste =
        mode === 'panneau'
          ? ([['annonces', 'Annonces'], ['village', 'Village']] as const)
          : ([['quetes', 'Quêtes'], ['histoire', 'Histoire']] as const);
      for (const [id, nom] of liste) {
        const b = document.createElement('button');
        b.dataset.onglet = id;
        b.textContent = nom;
        const actif = onglet === id;
        b.style.cssText = styleOnglet(actif);
        onglets.appendChild(b);
      }
      elements.push(onglets);
    }

    if (mode === 'panneau' && onglet === 'village') {
      elements.push(sectionVillage(d));
    } else if (mode === 'journal' && onglet === 'histoire') {
      elements.push(sectionHistoire(d));
    } else {
      const liste = document.createElement('div');
      liste.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
      if (mode === 'panneau') {
        for (const c of CHAINES) if (!c.enPersonne) liste.appendChild(groupeChaine(c, d));
      } else {
        const enCours = quetesEnCours(d.etat);
        for (const q of enCours) liste.appendChild(ligneQuete(q, d, false));
        if (enCours.length === 0) {
          const rien = document.createElement('div');
          rien.textContent = 'Aucune quête en cours. Lisez le panneau d’annonces sur la place.';
          rien.style.cssText = `font-size:14px;color:${T.doux};`;
          liste.appendChild(rien);
        }
      }
      elements.push(liste);
      const finies = quetesTerminees(d.etat);
      if (finies.length > 0) {
        const t = document.createElement('div');
        t.textContent = `Terminées (${finies.length})`;
        t.style.cssText = `${TITRE_SECTION}font-size:15px;margin-top:6px;${SEPARATEUR_HAUT}`;
        const l = document.createElement('div');
        l.style.cssText = `display:flex;flex-direction:column;gap:3px;font-size:14px;color:${T.usureBonne};font-weight:600;`;
        for (const q of finies) {
          const ligne = document.createElement('div');
          ligne.dataset.quete = q.id;
          ligne.dataset.statut = 'terminee';
          ligne.textContent = `✓ ${q.titre} (${q.auteur})`;
          l.appendChild(ligne);
        }
        elements.push(t, l);
      }
    }

    const pied = document.createElement('div');
    pied.style.cssText = `display:flex;justify-content:space-between;align-items:center;gap:20px;font-size:14px;margin-top:4px;${SEPARATEUR_HAUT}`;
    const info = document.createElement('span');
    info.dataset.role = 'message-quetes';
    info.style.cssText = `font-weight:700;min-height:20px;color:${message ? couleurMessage(message.ok) : T.doux};`;
    info.textContent =
      message?.texte ??
      (mode === 'panneau' ? 'Les objets demandés sont pris dans ton inventaire, puis dans le coffre du village' : 'Rends tes quêtes au panneau d’annonces');
    const fermer = document.createElement('button');
    fermer.textContent = mode === 'panneau' ? 'Fermer (E)' : 'Fermer (J)';
    fermer.style.cssText = styleBoutonSecondaire();
    fermer.addEventListener('click', surFermeture);
    pied.append(info, fermer);
    elements.push(pied);

    panneau.replaceChildren(...elements);
  }

  panneau.addEventListener('click', (e) => {
    const cible = e.target as HTMLElement;
    const o = cible.closest<HTMLButtonElement>('button[data-onglet]');
    if (o) {
      onglet = o.dataset.onglet as typeof onglet;
      message = undefined;
      dessiner();
      return;
    }
    const a = cible.closest<HTMLButtonElement>('button[data-accepter]');
    if (a && !a.disabled) surAcceptation(a.dataset.accepter as string);
    const r = cible.closest<HTMLButtonElement>('button[data-rendre]');
    if (r && !r.disabled) surRendu(r.dataset.rendre as string);
    const v = cible.closest<HTMLButtonElement>('button[data-ameliorer]');
    if (v && !v.disabled) surAmelioration();
  });

  return {
    get ouvert() {
      return ouvert;
    },
    get mode() {
      return ouvert ? mode : null;
    },
    ouvrir(m) {
      ouvert = true;
      mode = m;
      onglet = m === 'panneau' ? 'annonces' : 'quetes';
      message = undefined;
      voile.style.display = 'flex';
      dessiner();
    },
    fermer() {
      ouvert = false;
      voile.style.display = 'none';
    },
    afficher(nouvelles, m) {
      donnees = nouvelles;
      message = m;
      dessiner();
    },
  };
}
