// Écran du marchand ambulant : ouvert avec E devant lui. Deux colonnes, « Acheter » et « Vendre » ; chaque ligne montre
// l'icône, le nom, le prix et le stock (ou la quantité possédée), avec un bouton (clic : 1, Maj + clic : 10).
// Dans le style des autres écrans (fabrication, quêtes). Aucune règle de jeu ici : l'écran dessine et signale les clics.

import { icone } from './ecranInventaire';
import {
  CASE,
  LIGNE,
  PANNEAU_ECRAN,
  T,
  TITRE_ECRAN,
  TITRE_SECTION,
  VOILE_ECRAN,
  couleurMessage,
  majuscule,
  SEPARATEUR_HAUT,
  styleBoutonPrincipal,
  styleBoutonSecondaire,
} from './theme';

/** Une ligne de la colonne « Acheter ». */
export interface LigneAchatMarchand {
  objet: string;
  /** Nom affiché (avec la taille du lot : « Flèches ×10 ») */
  nom: string;
  /** Prix d'un lot, en pièces d'or */
  prix: number;
  /** Lots encore en vente */
  stock: number;
  /** Vrai si l'on a assez d'or pour un lot */
  abordable: boolean;
}

/** Une ligne de la colonne « Vendre ». */
export interface LigneVenteMarchand {
  objet: string;
  nom: string;
  /** Prix à la pièce, en pièces d'or */
  prix: number;
  /** Quantité possédée (inventaire porté et sac) */
  possede: number;
}

export interface DonneesMarchand {
  /** Pièces d'or possédées */
  or: number;
  achats: readonly LigneAchatMarchand[];
  ventes: readonly LigneVenteMarchand[];
}

export interface MessageMarchand {
  texte: string;
  /** Vrai : réussite (vert) ; faux : refus (rouge) */
  ok: boolean;
}

export interface EcranMarchand {
  readonly ouvert: boolean;
  /** `salutation` : la réplique du marchand, affichée en haut de l'écran */
  ouvrir(salutation: string): void;
  fermer(): void;
  /** Donne l'état à dessiner (redessine tout de suite si l'écran est ouvert), avec un message de résultat éventuel. */
  afficher(donnees: DonneesMarchand, message?: MessageMarchand): void;
}

const PIECE_OR =
  '<circle cx="24" cy="24" r="17" fill="#f2c230" stroke="#8a6410" stroke-width="3"/><circle cx="24" cy="24" r="11" fill="none" stroke="#b8860b" stroke-width="2"/><path d="M24 15 V33 M19 20 H27 C29 20 29 24 27 24 H21 C19 24 19 28 21 28 H29" stroke="#8a6410" stroke-width="2" fill="none"/>';

const BOUTON_ACTIF = `${styleBoutonPrincipal(true)}padding:6px 16px;`;
const BOUTON_INACTIF = `${styleBoutonPrincipal(false)}padding:6px 16px;`;

export function creerEcranMarchand(
  racine: HTMLElement,
  /** Clic sur « Acheter » : nombre de lots demandé (1, ou 10 avec Maj) ; l'appelant échange puis redonne l'état avec `afficher` */
  surAchat: (objet: string, lots: number) => void,
  /** Clic sur « Vendre » : quantité demandée (1, ou 10 avec Maj) */
  surVente: (objet: string, quantite: number) => void,
  /** Clic sur « Fermer » */
  surFermeture: () => void,
): EcranMarchand {
  const voile = document.createElement('div');
  voile.dataset.role = 'ecran-marchand';
  voile.style.cssText = VOILE_ECRAN;
  const panneau = document.createElement('div');
  panneau.style.cssText = `${PANNEAU_ECRAN}width:min(900px,94vw);overflow:visible;`;
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
  let salutation = '';
  let donnees: DonneesMarchand | null = null;
  let message: MessageMarchand | undefined;

  function ligne(role: string, objet: string, nom: string, detail: string, prix: number, bouton: HTMLButtonElement): HTMLElement {
    const el = document.createElement('div');
    el.dataset[role] = objet;
    el.style.cssText = `${LIGNE}gap:10px;padding:6px 10px;`;
    const cadre = document.createElement('div');
    cadre.style.cssText = `${CASE}flex:none;width:44px;height:44px;`;
    cadre.innerHTML = `<div style="position:absolute;inset:3px">${icone(objet)}</div>`;
    const texte = document.createElement('div');
    texte.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:2px;min-width:0;';
    const titre = document.createElement('div');
    titre.textContent = majuscule(nom);
    titre.style.cssText = `font-size:16px;font-weight:700;color:${T.texte};`;
    const info = document.createElement('div');
    info.textContent = detail;
    info.style.cssText = `font-size:13.5px;color:${T.doux};`;
    texte.append(titre, info);
    const montant = document.createElement('div');
    montant.dataset.role = 'prix';
    montant.textContent = `${prix} or`;
    montant.style.cssText = `flex:none;font-weight:700;color:${T.ressource};min-width:46px;text-align:right;`;
    el.append(cadre, texte, montant, bouton);
    return el;
  }

  function colonne(titre: string, lignes: HTMLElement[], vide: string): HTMLElement {
    const col = document.createElement('div');
    col.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:8px;min-width:0;';
    const t = document.createElement('div');
    t.textContent = titre;
    t.style.cssText = TITRE_SECTION;
    const liste = document.createElement('div');
    liste.dataset.role = 'liste-marchand';
    liste.style.cssText = 'display:flex;flex-direction:column;gap:6px;overflow-y:auto;max-height:52vh;padding-right:4px;';
    if (lignes.length === 0) {
      const rien = document.createElement('div');
      rien.textContent = vide;
      rien.style.cssText = `font-size:14px;color:${T.doux};`;
      liste.appendChild(rien);
    } else {
      liste.append(...lignes);
    }
    col.append(t, liste);
    return col;
  }

  function dessiner(): void {
    if (!ouvert || !donnees) return;
    // Les listes gardent leur défilement quand un échange redessine l'écran
    const defilements = Array.from(panneau.querySelectorAll<HTMLElement>('[data-role="liste-marchand"]'), (l) => l.scrollTop);
    const entete = document.createElement('div');
    entete.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:20px;';
    const titre = document.createElement('div');
    titre.textContent = 'Marchand ambulant';
    titre.style.cssText = TITRE_ECRAN;
    const or = document.createElement('div');
    or.dataset.role = 'or-possede';
    or.style.cssText = `display:flex;align-items:center;gap:6px;font-size:17px;font-weight:700;color:${T.ressource};`;
    or.innerHTML = `<span style="display:inline-block;width:26px;height:26px"><svg viewBox="0 0 48 48" width="100%" height="100%">${PIECE_OR}</svg></span>`;
    or.append(`${donnees.or} or`);
    entete.append(titre, or);

    const parole = document.createElement('div');
    parole.dataset.role = 'parole-marchand';
    parole.textContent = `« ${salutation} »`;
    parole.style.cssText = `font-size:15px;font-style:italic;color:${T.doux};padding:8px 14px;border-radius:${T.rayonCase};background:${T.fondCase};border:1px solid ${T.filetCase};`;

    const achats = donnees.achats.map((a) => {
      const bouton = document.createElement('button');
      bouton.dataset.acheter = a.objet;
      bouton.textContent = a.stock < 1 ? 'Épuisé' : 'Acheter';
      const actif = a.stock >= 1 && a.abordable;
      bouton.disabled = !actif;
      bouton.style.cssText = actif ? BOUTON_ACTIF : BOUTON_INACTIF;
      return ligne('achat', a.objet, a.nom, `Stock : ${a.stock}`, a.prix, bouton);
    });
    const ventes = donnees.ventes.map((v) => {
      const bouton = document.createElement('button');
      bouton.dataset.vendre = v.objet;
      bouton.textContent = 'Vendre';
      bouton.disabled = v.possede < 1;
      bouton.style.cssText = v.possede >= 1 ? BOUTON_ACTIF : BOUTON_INACTIF;
      return ligne('vente', v.objet, v.nom, `Tu en as : ${v.possede}`, v.prix, bouton);
    });
    const colonnes = document.createElement('div');
    colonnes.style.cssText = 'display:flex;gap:20px;align-items:flex-start;';
    colonnes.append(colonne('Acheter', achats, 'Il ne vend plus rien'), colonne('Vendre', ventes, "Il n'achète rien"));

    const pied = document.createElement('div');
    pied.style.cssText = `display:flex;justify-content:space-between;align-items:center;gap:20px;font-size:14px;margin-top:4px;${SEPARATEUR_HAUT}`;
    const info = document.createElement('span');
    info.dataset.role = 'message-marchand';
    info.style.cssText = `font-weight:700;min-height:20px;color:${message ? couleurMessage(message.ok) : T.doux};`;
    info.textContent = message?.texte ?? "Maj + clic : 10 d'un coup. Ce que tu portes est pris dans l'inventaire, puis dans le sac";
    const fermer = document.createElement('button');
    fermer.textContent = 'Fermer (E)';
    fermer.style.cssText = styleBoutonSecondaire();
    fermer.addEventListener('click', surFermeture);
    pied.append(info, fermer);

    panneau.replaceChildren(entete, parole, colonnes, pied);
    panneau.querySelectorAll<HTMLElement>('[data-role="liste-marchand"]').forEach((l, i) => {
      l.scrollTop = defilements[i] ?? 0;
    });
  }

  panneau.addEventListener('click', (e) => {
    const cible = e.target as HTMLElement;
    const quantite = e.shiftKey ? 10 : 1;
    const a = cible.closest<HTMLButtonElement>('button[data-acheter]');
    if (a && !a.disabled) surAchat(a.dataset.acheter as string, quantite);
    const v = cible.closest<HTMLButtonElement>('button[data-vendre]');
    if (v && !v.disabled) surVente(v.dataset.vendre as string, quantite);
  });

  return {
    get ouvert() {
      return ouvert;
    },
    ouvrir(parole) {
      ouvert = true;
      salutation = parole;
      message = undefined;
      voile.style.display = 'flex';
      dessiner();
    },
    fermer() {
      ouvert = false;
      voile.style.display = 'none';
    },
    afficher(d, m) {
      donnees = d;
      message = m;
      dessiner();
    },
  };
}
