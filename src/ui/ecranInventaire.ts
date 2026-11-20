// Écran d'inventaire (touche Tab ou I, ou touche E devant le coffre du village), style « Ardoise et laiton ».
// Le sac, le sac magique et (avec le coffre) le coffre se rangent à la main par glisser-déposer ; onglets,
// fiche de l'objet survolé, personnage qui tient l'objet de la case choisie dans la barre d'outils.
// Icônes : src/ui/icones.ts. Aucune règle de jeu ici : l'écran ne fait que dessiner et signaler (voir `ActionsInventaire`).

import {
  NOMS_ARMURE,
  NOMS_BOUCLIER,
  NOMS_CASQUE,
  OBJETS_ARMURE,
  OBJETS_CASQUE,
  durabiliteMax,
  efficacite,
  reductionArmure,
  reductionCasque,
  typeArmureDeObjet,
  typeCasqueDeObjet,
  type Equipement,
  type NiveauOutil,
} from '../regles/equipement';
import { EMPLACEMENTS_BARRE, estOutil, type EmplacementBarre } from '../regles/barreOutils';
import {
  ONGLETS,
  classementObjet,
  dansOnglet,
  descriptionEmplacement,
  descriptionObjet,
  type OngletInventaire,
} from '../regles/descriptions';
import { compter, definitionObjet, type Conteneur, type Pile } from '../regles/inventaire';
import { icone } from './icones';
import { CASE, ETIQUETTE, PANNEAU_FORT, T, TITRE, TOUCHE, couleurUsure, losange, majuscule } from './theme';

// Les icônes sont dans src/ui/icones.ts ; `icone` reste exportée d'ici pour les autres écrans
export { icone };

export type NomConteneur = 'inventaire' | 'sac' | 'coffre';

export interface EcranInventaire {
  readonly ouvert: boolean;
  /** Vrai si l'écran est ouvert avec le coffre du village */
  readonly avecCoffre: boolean;
  /** `avecCoffre` : montre aussi le coffre du village (ouvert depuis le coffre). */
  ouvrir(avecCoffre?: boolean): void;
  fermer(): void;
  /** Donne le contenu à dessiner (redessine tout de suite si l'écran est ouvert). `emplacement` : case choisie dans la barre d'outils. */
  afficher(inventaire: Conteneur, sac: Conteneur, coffre?: Conteneur, equipement?: Equipement, emplacement?: EmplacementBarre): void;
}

// ---- Écran (style « Ardoise et laiton », lot 6 de la refonte) ----

// Valeurs réglables de l'écran
const LARGEUR_PANNEAU = 1300;
/** Marge gardée autour du panneau quand la fenêtre est trop petite (le panneau est alors réduit pour tenir). */
const MARGE_FENETRE = 24;
const COLONNES_GRILLE = 8;
const TAILLE_CASE = 62;
const TAILLE_ICONE = 42;
const ECART_CASES = 8;
const FLOU_FOND = 'blur(5px)';
const FOND_SAC_MAGIQUE = 'rgba(124,203,244,0.08)';
const BORD_SAC_MAGIQUE = 'rgba(124,203,244,0.35)';
const HALO_DEPOT = '0 0 0 3px rgba(124,203,244,0.18)';
const OPACITE_ESTOMPE = 0.22;
const OPACITE_GLISSE = 0.35;
const BALANCEMENT = 'ath-balance 3.4s ease-in-out infinite';

/** Une case d'un conteneur. */
export interface CaseConteneur {
  readonly conteneur: NomConteneur;
  readonly indice: number;
}

/** Ce que l'écran signale à l'appelant (`src/jeu/inventaireJeu.ts`) : il applique les règles puis redessine. */
export interface ActionsInventaire {
  /** Pile glissée d'une case vers une autre (même conteneur ou non) */
  deposer(de: CaseConteneur, vers: CaseConteneur): void;
  /** Armure de l'inventaire glissée sur l'emplacement Armure */
  equiperArmure(de: CaseConteneur): void;
  /** Armure portée glissée vers une case de l'inventaire (`vers` absent : première case libre) */
  retirerArmure(vers?: CaseConteneur): void;
  /** Casque de l'inventaire glissé sur l'emplacement Casque (il échange avec celui qui est porté) */
  equiperCasque(de: CaseConteneur): void;
  /** Casque porté glissé vers une case de l'inventaire (`vers` absent : première case libre) */
  retirerCasque(vers?: CaseConteneur): void;
  /** Maj + clic : la pile passe dans l'autre conteneur */
  envoyer(de: CaseConteneur): void;
  /** Clic droit : manger, équiper une armure... */
  utiliser(de: CaseConteneur): void;
  /** Clic sur une case de la barre d'outils : elle devient la case choisie */
  choisirBarre(emplacement: EmplacementBarre): void;
  fermer(): void;
}

const NOMS_OUTILS: Readonly<Record<EmplacementBarre, string>> = {
  epee: 'Épée',
  hache: 'Hache',
  pioche: 'Pioche',
  pousse: 'Pousse d’arbre',
  piege: 'Piège',
  torche: 'Torche',
  arc: 'Arc',
};
const MATERIAUX: Readonly<Record<NiveauOutil, string>> = { base: 'bois', cuivre: 'cuivre', fer: 'fer', acier: 'acier', cristal: 'cristal' };
const NOMS_CATEGORIES: Readonly<Record<'ressources' | 'nourriture' | 'objets', string>> = {
  ressources: 'Ressource',
  nourriture: 'Nourriture',
  objets: 'Objet',
};

/** Ce qu'on montre dans la fiche et ce que tient le personnage. */
interface InfosObjet {
  /** Clé de l'icône (`icone()`) */
  readonly icone: string;
  readonly nom: string;
  readonly categorie: string;
  readonly detail: string;
  readonly description: string;
}

/** Ce qu'on est en train de glisser. */
interface Glisse {
  readonly conteneur: NomConteneur | 'armure' | 'casque';
  readonly indice: number;
  readonly objet: string;
  readonly element: HTMLElement;
}

function el<K extends keyof HTMLElementTagNameMap>(balise: K, css: string, texte?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(balise);
  e.style.cssText = css;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

/** Étiquette dorée en capitales (« SAC »), avec un texte discret à droite et une puce en losange au besoin. */
function etiquette(texte: string, droite: string, couleur: string = T.or, puce = false): HTMLElement {
  const ligne = el('div', `${ETIQUETTE}display:flex;justify-content:space-between;align-items:center;color:${couleur};`);
  const gauche = el('span', 'display:flex;align-items:center;gap:8px;');
  if (puce) gauche.innerHTML = losange(10, couleur);
  gauche.append(document.createTextNode(texte));
  ligne.append(gauche, el('span', `letter-spacing:0;font-weight:500;font-size:13px;text-transform:none;color:${T.doux};`, droite));
  return ligne;
}

function caseOccupees(c: Conteneur): number {
  return c.cases.filter((p) => p !== null).length;
}

export function creerEcranInventaire(racine: HTMLElement, actions: ActionsInventaire): EcranInventaire {
  const voile = el(
    'div',
    'position:absolute;inset:0;display:none;align-items:center;justify-content:center;pointer-events:auto;z-index:20;user-select:none;' +
      `background:${T.voile};backdrop-filter:${FLOU_FOND};-webkit-backdrop-filter:${FLOU_FOND};font-family:${T.corps};color:${T.texte};`,
  );
  voile.dataset.role = 'ecran-inventaire';
  const panneau = el(
    'div',
    `${PANNEAU_FORT}width:${LARGEUR_PANNEAU}px;flex-shrink:0;padding:26px 28px 20px;display:flex;flex-direction:column;gap:20px;transform-origin:center;`,
  );
  voile.appendChild(panneau);
  racine.appendChild(voile);

  let inventaire: Conteneur = { cases: [] };
  let sac: Conteneur = { cases: [] };
  let coffre: Conteneur = { cases: [] };
  let equipement: Equipement | null = null;
  let emplacementChoisi: EmplacementBarre = 'epee';
  let ouvert = false;
  let avecCoffre = false;
  let onglet: OngletInventaire = 'tout';
  /** Case dont la fiche est montrée (`inventaire:3`, `equip:hache`, `barre:epee`) */
  let survolCle = '';
  let glisse: Glisse | null = null;
  let cibleDepot: HTMLElement | null = null;

  // Le personnage est créé une fois : son balancement ne repart pas de zéro à chaque redessin
  const personnage = el(
    'div',
    `position:absolute;left:0;top:0;width:290px;height:350px;transform-origin:145px 342px;animation:${BALANCEMENT};pointer-events:none;`,
  );
  personnage.dataset.role = 'personnage';
  personnage.innerHTML =
    '<svg width="140" height="300" viewBox="0 0 140 300" style="position:absolute;left:75px;top:50px;opacity:0.85" aria-hidden="true">' +
    '<polygon points="52,10 88,10 96,34 88,58 52,58 44,34" fill="#E3A97F"/><polygon points="52,10 88,10 70,34" fill="#F0BE96"/>' +
    '<polygon points="36,66 104,66 112,150 28,150" fill="#5E7FA3"/><polygon points="36,66 70,66 70,150 28,150" fill="#7194BA"/>' +
    '<polygon points="18,72 34,68 30,150 16,146" fill="#4E6C8E"/><polygon points="106,68 122,72 124,146 110,150" fill="#4E6C8E"/>' +
    '<polygon points="34,150 68,150 66,270 40,270" fill="#6B5240"/><polygon points="72,150 106,150 100,270 74,270" fill="#5A4433"/>' +
    '<polygon points="36,270 68,270 68,292 30,292" fill="#3E2E22"/><polygon points="72,270 104,270 110,292 72,292" fill="#3E2E22"/></svg>';
  const objetTenu = el(
    'div',
    'position:absolute;left:62px;top:130px;width:72px;height:72px;transform:scaleX(-1) rotate(8deg);transform-origin:50% 92%;' +
      'filter:drop-shadow(0 4px 6px rgba(0,0,0,0.5));pointer-events:none;',
  );
  objetTenu.dataset.role = 'objet-tenu';
  personnage.appendChild(objetTenu);

  // ---- Informations sur les objets ----

  /** Infos d'une case de la barre d'outils (ou de l'équipement) : outil, pousses, piège, torche, arc. */
  function infosEmplacement(e: Equipement, emplacement: EmplacementBarre): (InfosObjet & { vide: boolean; quantite: number | null }) | null {
    if (estOutil(emplacement)) {
      const niveau = e.outils[emplacement];
      const max = durabiliteMax(e, emplacement);
      return {
        icone: niveau === 'base' ? emplacement : `${emplacement}-${niveau}`,
        nom: `${NOMS_OUTILS[emplacement]} en ${MATERIAUX[niveau]}`,
        categorie: emplacement === 'epee' ? 'Arme' : 'Outil',
        detail: `Usure ${Math.round(e.durabilite[emplacement])} / ${max}`,
        description: descriptionEmplacement(emplacement),
        vide: false,
        quantite: null,
      };
    }
    if (emplacement === 'pousse' || emplacement === 'piege') {
      const objet = emplacement === 'pousse' ? 'pousse-arbre' : 'piege';
      const n = compter(inventaire, objet);
      return {
        icone: objet,
        nom: NOMS_OUTILS[emplacement],
        categorie: emplacement === 'pousse' ? 'Ressource' : 'Objet',
        detail: `Quantité : ${n}`,
        description: descriptionObjet(objet),
        vide: n < 1,
        quantite: n,
      };
    }
    if (emplacement === 'arc') {
      const n = compter(inventaire, 'fleche');
      return {
        icone: 'arc',
        nom: NOMS_OUTILS.arc,
        categorie: 'Arme',
        detail: `Flèches : ${n}`,
        description: descriptionObjet('arc'),
        vide: !e.arc,
        quantite: n,
      };
    }
    return { icone: 'torche', nom: NOMS_OUTILS.torche, categorie: 'Outil', detail: '', description: descriptionEmplacement('torche'), vide: false, quantite: null };
  }

  /** Emplacement de la barre dont la case 6 montre le piège quand il est tenu. */
  function emplacementAffiche(emplacement: EmplacementBarre): EmplacementBarre {
    return emplacement === 'pousse' && emplacementChoisi === 'piege' ? 'piege' : emplacement;
  }

  function infosPile(pile: Pile): InfosObjet {
    const def = definitionObjet(pile.objet);
    return {
      icone: pile.objet,
      nom: majuscule(def.nom),
      categorie: NOMS_CATEGORIES[classementObjet(pile.objet)],
      detail: `Quantité : ${pile.quantite}`,
      description: descriptionObjet(pile.objet),
    };
  }

  /** Infos de la case désignée par une clé (`inventaire:3`, `equip:armure`, `barre:hache`), ou `null` si elle est vide. */
  function infosPourCle(cle: string): InfosObjet | null {
    const [genre, valeur] = cle.split(':');
    if (genre === 'inventaire' || genre === 'sac' || genre === 'coffre') {
      const conteneur = genre === 'inventaire' ? inventaire : genre === 'sac' ? sac : coffre;
      const pile = conteneur.cases[Number(valeur)];
      return pile ? infosPile(pile) : null;
    }
    if (!equipement) return null;
    if (genre === 'barre' || (genre === 'equip' && (valeur === 'epee' || valeur === 'hache' || valeur === 'pioche'))) {
      const infos = infosEmplacement(equipement, emplacementAffiche(valeur as EmplacementBarre));
      return infos && !infos.vide ? infos : null;
    }
    if (genre === 'equip' && valeur === 'armure' && equipement.armure) {
      // Part de l'armure seule (le casque a sa propre fiche), usure comprise
      const reduction = Math.round(reductionArmure(equipement.armure) * efficacite(equipement, 'armure') * 100);
      const objet = OBJETS_ARMURE[equipement.armure];
      return {
        icone: objet,
        nom: NOMS_ARMURE[equipement.armure],
        categorie: 'Armure portée',
        detail: `Usure ${Math.round(equipement.durabilite.armure)} / ${durabiliteMax(equipement, 'armure')} · −${reduction} % de dégâts`,
        description: descriptionObjet(objet),
      };
    }
    if (genre === 'equip' && valeur === 'casque' && equipement.casque) {
      const objet = OBJETS_CASQUE[equipement.casque];
      const reduction = Math.round(reductionCasque(equipement.casque) * 100);
      return { icone: objet, nom: NOMS_CASQUE[equipement.casque], categorie: 'Casque', detail: `−${reduction} % de dégâts`, description: descriptionObjet(objet) };
    }
    if (genre === 'equip' && valeur === 'bouclier' && equipement.bouclier) {
      const objet = `bouclier-${equipement.bouclier}`;
      return { icone: objet, nom: NOMS_BOUCLIER[equipement.bouclier], categorie: 'Bouclier', detail: '', description: descriptionObjet(objet) };
    }
    return null;
  }

  // ---- Cases ----

  function icone42(cle: string, opacite = 1): HTMLElement {
    const d = el('div', `width:${TAILLE_ICONE}px;height:${TAILLE_ICONE}px;pointer-events:none;opacity:${opacite};`);
    d.innerHTML = icone(cle);
    return d;
  }

  function quantiteSur(c: HTMLElement, texte: string, bas = 3): void {
    c.appendChild(
      el('span', `position:absolute;right:5px;bottom:${bas}px;font-size:13px;font-weight:700;color:#FFFFFF;text-shadow:0 1px 2px rgba(0,0,0,0.8);pointer-events:none;`, texte),
    );
  }

  function barreUsure(c: HTMLElement, valeur: number, max: number): void {
    const part = max > 0 ? Math.max(0, Math.min(1, valeur / max)) : 0;
    const fond = el('span', 'position:absolute;left:6px;right:6px;bottom:3px;height:3px;border-radius:2px;background:rgba(255,255,255,0.12);overflow:hidden;pointer-events:none;');
    fond.dataset.role = 'usure';
    fond.dataset.usure = String(Math.round(valeur));
    fond.appendChild(el('span', `display:block;height:3px;width:${part * 100}%;background:${couleurUsure(part)};`));
    c.appendChild(fond);
  }

  /** Case d'une grille (inventaire, sac magique ou coffre). */
  function caseConteneur(pile: Pile | null, nom: NomConteneur, indice: number): HTMLElement {
    const c = el(
      'div',
      `${CASE}width:${TAILLE_CASE}px;height:${TAILLE_CASE}px;display:flex;align-items:center;justify-content:center;cursor:${pile ? 'grab' : 'default'};`,
    );
    c.dataset.role = 'case';
    c.dataset.conteneur = nom;
    c.dataset.indice = String(indice);
    c.dataset.depot = nom;
    c.dataset.cle = `${nom}:${indice}`;
    if (pile) {
      const def = definitionObjet(pile.objet);
      c.draggable = true;
      c.dataset.plein = '1';
      c.dataset.objet = pile.objet;
      c.dataset.nom = majuscule(def.nom);
      c.dataset.quantite = String(pile.quantite);
      c.title = `${majuscule(def.nom)} (${pile.quantite})`;
      c.appendChild(icone42(pile.objet, dansOnglet(pile.objet, onglet) ? 1 : OPACITE_ESTOMPE));
      if (pile.quantite > 1) quantiteSur(c, String(pile.quantite));
    }
    return c;
  }

  function grille(conteneur: Conteneur, nom: NomConteneur): HTMLElement {
    const g = el('div', `display:grid;grid-template-columns:repeat(${COLONNES_GRILLE},${TAILLE_CASE}px);gap:${ECART_CASES}px;`);
    conteneur.cases.forEach((pile, indice) => g.appendChild(caseConteneur(pile, nom, indice)));
    return g;
  }

  /** Case de la barre d'outils : lecture seule (icône, chiffre, usure, quantité), un clic la choisit. */
  function caseBarre(e: Equipement, emplacement: EmplacementBarre, numero: number): HTMLElement {
    const affiche = emplacementAffiche(emplacement);
    const infos = infosEmplacement(e, affiche);
    const actif = emplacement === emplacementChoisi || (emplacement === 'pousse' && emplacementChoisi === 'piege');
    const c = el('div', `${CASE}width:${TAILLE_CASE}px;height:${TAILLE_CASE}px;display:flex;align-items:center;justify-content:center;cursor:pointer;`);
    c.dataset.role = 'case-barre';
    c.dataset.emplacement = emplacement;
    c.dataset.cle = `barre:${emplacement}`;
    c.dataset.actif = actif ? '1' : '0';
    if (infos) {
      c.title = infos.nom;
      c.appendChild(icone42(infos.icone, infos.vide ? 0.35 : 1));
      if (estOutil(affiche)) {
        barreUsure(c, e.durabilite[affiche], durabiliteMax(e, affiche));
      } else if (infos.quantite !== null && (infos.quantite > 0 || (affiche === 'arc' && e.arc))) {
        quantiteSur(c, `×${infos.quantite}`, 6);
      }
    }
    c.prepend(el('span', `position:absolute;left:5px;top:3px;font-size:11px;font-weight:700;color:${T.doux};pointer-events:none;`, String(numero)));
    return c;
  }

  /** Emplacement d'équipement autour du personnage : case, nom dessous (et palier). */
  function emplacementEquipement(
    cle: 'epee' | 'hache' | 'pioche' | 'armure' | 'casque' | 'bouclier',
    libelle: string,
    palier: string,
    x: number,
    y: number,
    contenu: { icone: string; usure?: { valeur: number; max: number } } | null,
    fantome?: string,
  ): HTMLElement {
    const c = el(
      'div',
      `${CASE}position:absolute;left:${x}px;top:${y}px;width:${TAILLE_CASE}px;height:${TAILLE_CASE}px;display:flex;align-items:center;justify-content:center;` +
        `${contenu ? '' : `border-style:dashed;`}`,
    );
    c.dataset.role = 'emplacement-equipement';
    c.dataset.equipement = cle;
    c.dataset.cle = `equip:${cle}`;
    if (cle === 'armure' || cle === 'casque') c.dataset.depot = cle;
    if (contenu) {
      c.dataset.plein = '1';
      c.appendChild(icone42(contenu.icone));
      if (contenu.usure) barreUsure(c, contenu.usure.valeur, contenu.usure.max);
      if (cle === 'armure' || cle === 'casque') {
        c.draggable = true;
        c.style.cursor = 'grab';
      }
    } else if (fantome) {
      c.appendChild(icone42(fantome, 0.2));
    }
    const nom = el('span', `position:absolute;left:-14px;right:-14px;bottom:-18px;text-align:center;font-size:11px;color:${T.doux};pointer-events:none;`, libelle);
    c.appendChild(nom);
    if (palier) c.appendChild(el('span', `position:absolute;left:-14px;right:-14px;bottom:-31px;text-align:center;font-size:11px;color:${T.or};pointer-events:none;`, palier));
    return c;
  }

  /** Colonne de gauche : personnage, objet tenu, emplacements d'équipement. */
  function colonneEquipement(): HTMLElement {
    const colonne = el('div', 'width:290px;flex-shrink:0;display:flex;flex-direction:column;gap:10px;');
    colonne.appendChild(etiquette('Équipement', ''));
    const zone = el('div', 'position:relative;width:290px;height:430px;');
    const tenu = equipement ? infosEmplacement(equipement, emplacementChoisi) : null;
    const enMain = tenu && !tenu.vide ? tenu : null;
    objetTenu.innerHTML = enMain ? icone(enMain.icone) : '';
    objetTenu.style.display = enMain ? 'block' : 'none';
    objetTenu.dataset.objet = enMain ? enMain.icone : '';
    zone.appendChild(personnage);
    const enMainTexte = el('div', `position:absolute;left:0;right:0;top:362px;text-align:center;font-size:13px;color:${T.doux};`, 'En main : ');
    enMainTexte.dataset.role = 'en-main';
    enMainTexte.appendChild(el('span', `font-family:${T.titre};font-weight:600;color:${T.texte};`, enMain ? enMain.nom : 'mains nues'));
    zone.appendChild(enMainTexte);

    if (equipement) {
      const e = equipement;
      const palier = (o: 'epee' | 'hache' | 'pioche') => MATERIAUX[e.outils[o]];
      const usure = (o: 'epee' | 'hache' | 'pioche' | 'armure') => ({ valeur: e.durabilite[o], max: durabiliteMax(e, o) });
      const outil = (o: 'epee' | 'hache' | 'pioche') => ({
        icone: e.outils[o] === 'base' ? o : `${o}-${e.outils[o]}`,
        usure: usure(o),
      });
      zone.append(
        emplacementEquipement('armure', 'Armure', e.armure ? NOMS_ARMURE[e.armure].replace('Armure de ', '') : '', 4, 40,
          e.armure ? { icone: OBJETS_ARMURE[e.armure], usure: usure('armure') } : null, 'armure-cuir'),
        emplacementEquipement('hache', 'Hache', palier('hache'), 4, 140, outil('hache')),
        emplacementEquipement('pioche', 'Pioche', palier('pioche'), 4, 240, outil('pioche')),
        emplacementEquipement('epee', 'Arme', palier('epee'), 224, 40, outil('epee')),
        emplacementEquipement('bouclier', 'Bouclier', '', 224, 140,
          e.bouclier ? { icone: `bouclier-${e.bouclier}` } : null, 'bouclier-bois'),
        emplacementEquipement('casque', 'Casque', '', 224, 240,
          e.casque ? { icone: OBJETS_CASQUE[e.casque] } : null, 'casque-cuir'),
      );
    }
    colonne.appendChild(zone);
    return colonne;
  }

  // ---- Fiche de l'objet survolé ----

  function remplirFiche(zone: HTMLElement): void {
    const infos = infosPourCle(survolCle);
    zone.dataset.role = 'fiche';
    zone.dataset.fiche = survolCle;
    if (!infos) {
      zone.replaceChildren(el('p', `margin:0;font-size:15px;color:${T.doux};`, 'Survole un objet pour voir sa fiche.'));
      return;
    }
    const tete = el('div', 'display:flex;align-items:center;gap:16px;');
    const grande = el(
      'div',
      `width:92px;height:92px;flex-shrink:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box;border-radius:${T.rayonCase};` +
        `background:rgba(255,255,255,0.05);border:1px solid ${T.filetCase};`,
    );
    const dessin = el('div', 'width:70px;height:70px;');
    dessin.innerHTML = icone(infos.icone);
    grande.appendChild(dessin);
    const texte = el('div', 'display:flex;flex-direction:column;gap:4px;min-width:0;');
    const categorie = el('div', ETIQUETTE, infos.categorie);
    categorie.dataset.role = 'fiche-categorie';
    const nom = el('div', `${TITRE}font-size:22px;line-height:1.15;`, majuscule(infos.nom));
    nom.dataset.role = 'fiche-nom';
    const detail = el('div', `font-size:14px;color:${T.doux};`, infos.detail);
    detail.dataset.role = 'fiche-detail';
    texte.append(categorie, nom, detail);
    tete.append(grande, texte);
    const description = el('p', `margin:0;font-size:15px;line-height:1.5;color:${T.doux};`, infos.description);
    description.dataset.role = 'fiche-description';
    zone.replaceChildren(tete, description);
  }

  function colonneFiche(): HTMLElement {
    const colonne = el(
      'div',
      `flex:1;min-width:0;display:flex;flex-direction:column;gap:14px;padding:20px;box-sizing:border-box;background:${T.fondCase};` +
        `border:1px solid ${T.filetCase};border-radius:${T.rayonCase};`,
    );
    const zone = el('div', 'display:flex;flex-direction:column;gap:14px;');
    remplirFiche(zone);
    const lignes: ReadonlyArray<readonly [string, string]> = [
      ['Glisser', 'Ranger où tu veux'],
      ['Clic droit', 'Utiliser ou manger'],
      ['Maj + clic', "Vers l'autre sac"],
      [avecCoffre ? 'E' : 'Tab', 'Fermer'],
    ];
    const liste = el('div', `display:flex;flex-direction:column;gap:8px;font-size:14px;color:${T.doux};`);
    liste.dataset.role = 'actions';
    for (const [touche, action] of lignes) {
      const ligne = el('div', 'display:flex;align-items:center;gap:10px;');
      ligne.append(el('span', `${TOUCHE}min-width:74px;`, touche), el('span', '', action));
      liste.appendChild(ligne);
    }
    colonne.append(zone, el('div', 'flex:1;'), el('div', `height:1px;background:${T.filet};opacity:0.5;`), liste);
    return colonne;
  }

  // ---- Assemblage ----

  function colonneMilieu(): HTMLElement {
    const colonne = el('div', `width:${COLONNES_GRILLE * TAILLE_CASE + (COLONNES_GRILLE - 1) * ECART_CASES}px;flex-shrink:0;display:flex;flex-direction:column;gap:10px;`);
    if (avecCoffre) {
      const bloc = el('div', 'display:flex;flex-direction:column;gap:10px;margin-bottom:6px;');
      bloc.dataset.role = 'coffre';
      bloc.append(
        etiquette('Coffre du village', `${caseOccupees(coffre)} / ${coffre.cases.length} cases`),
        grille(coffre, 'coffre'),
      );
      colonne.appendChild(bloc);
    }
    colonne.append(etiquette('Sac', `${caseOccupees(inventaire)} / ${inventaire.cases.length} cases`), grille(inventaire, 'inventaire'));

    const entete = etiquette('Sac magique', 'Gardé si tu tombes au combat', T.accent, true);
    entete.style.marginTop = '10px';
    const magique = el(
      'div',
      `padding:8px;margin:0 -8px;border-radius:${T.rayonCase};background:${FOND_SAC_MAGIQUE};border:1px solid ${BORD_SAC_MAGIQUE};`,
    );
    magique.dataset.role = 'sac-magique';
    magique.appendChild(grille(sac, 'sac'));
    colonne.append(entete, magique);

    const titreBarre = etiquette("Barre d'outils", '');
    titreBarre.style.marginTop = '10px';
    const barre = el('div', `display:flex;gap:${ECART_CASES}px;`);
    barre.dataset.role = 'barre-outils';
    if (equipement) EMPLACEMENTS_BARRE.forEach((emp, i) => barre.appendChild(caseBarre(equipement as Equipement, emp, i + 1)));
    colonne.append(titreBarre, barre);
    return colonne;
  }

  function entete(): HTMLElement {
    const ligne = el('div', 'display:flex;align-items:center;gap:28px;');
    ligne.appendChild(el('h1', `${TITRE}margin:0;font-size:30px;letter-spacing:0.02em;`, 'Inventaire'));
    const onglets = el('div', 'display:flex;gap:6px;flex:1;');
    for (const o of ONGLETS) {
      const actif = o.id === onglet;
      const b = el(
        'button',
        `min-height:36px;padding:0 16px;font-family:${T.corps};font-size:15px;font-weight:${actif ? 700 : 500};cursor:pointer;` +
          `color:${actif ? T.encre : T.texte};background:${actif ? T.or : 'transparent'};border:1px solid ${actif ? T.or : T.filetCase};border-radius:${T.rayonPetit};`,
        o.nom,
      );
      b.type = 'button';
      b.dataset.role = 'onglet';
      b.dataset.onglet = o.id;
      b.dataset.actif = actif ? '1' : '0';
      onglets.appendChild(b);
    }
    const or = el('div', `display:flex;align-items:center;gap:8px;font-family:${T.titre};font-size:20px;font-weight:600;color:${T.ressource};`);
    or.dataset.role = 'or';
    const piece = el('div', 'width:30px;height:30px;');
    piece.innerHTML = icone('or');
    or.append(piece, document.createTextNode(String(compter(inventaire, 'or'))));
    const fermer = el(
      'button',
      `width:36px;height:36px;padding:0;font-family:${T.corps};font-size:18px;font-weight:700;cursor:pointer;color:${T.texte};background:${T.fondCase};` +
        `border:1px solid ${T.filetCase};border-radius:${T.rayonRond};`,
      '✕',
    );
    fermer.type = 'button';
    fermer.dataset.role = 'fermer';
    fermer.title = avecCoffre ? 'Fermer (E)' : 'Fermer (Tab)';
    ligne.append(onglets, or, fermer);
    return ligne;
  }

  /** Bordure d'une case selon son état : dépôt en cours, fiche affichée, case choisie de la barre, ou normale. */
  function appliquerBordures(): void {
    for (const c of panneau.querySelectorAll<HTMLElement>('[data-cle]')) {
      const plein = c.dataset.plein === '1' || c.dataset.role === 'case-barre';
      if (c === cibleDepot) {
        c.style.border = `2px dashed ${T.accent}`;
        c.style.boxShadow = HALO_DEPOT;
      } else {
        c.style.boxShadow = '';
        if (plein && c.dataset.cle === survolCle) c.style.border = `2px solid ${T.or}`;
        else if (c.dataset.actif === '1') c.style.border = `2px solid ${T.accent}`;
        else c.style.border = `1px ${c.dataset.plein === '1' || c.dataset.role !== 'emplacement-equipement' ? 'solid' : 'dashed'} ${T.filetCase}`;
      }
    }
  }

  /** Réduit le panneau si la fenêtre est trop petite pour le contenir. */
  function ajuster(): void {
    if (!ouvert) return;
    panneau.style.transform = '';
    const l = panneau.offsetWidth;
    const h = panneau.offsetHeight;
    const echelle = Math.min(1, (voile.clientWidth - MARGE_FENETRE) / l, (voile.clientHeight - MARGE_FENETRE) / h);
    if (echelle > 0 && echelle < 1) panneau.style.transform = `scale(${echelle})`;
  }

  function dessiner(): void {
    if (!ouvert) return;
    glisse = null;
    cibleDepot = null;
    const corps = el('div', 'display:flex;gap:28px;');
    corps.append(colonneEquipement(), colonneMilieu(), colonneFiche());
    panneau.replaceChildren(entete(), corps);
    appliquerBordures();
    ajuster();
  }

  // ---- Glisser-déposer ----

  function origineDe(c: HTMLElement): Glisse | null {
    const objet =
      c.dataset.objet ??
      (c.dataset.equipement === 'armure' && equipement?.armure
        ? OBJETS_ARMURE[equipement.armure]
        : c.dataset.equipement === 'casque' && equipement?.casque
          ? OBJETS_CASQUE[equipement.casque]
          : '');
    if (!objet) return null;
    if (c.dataset.equipement === 'armure') return { conteneur: 'armure', indice: 0, objet, element: c };
    if (c.dataset.equipement === 'casque') return { conteneur: 'casque', indice: 0, objet, element: c };
    if (!c.dataset.conteneur) return null;
    return { conteneur: c.dataset.conteneur as NomConteneur, indice: Number(c.dataset.indice), objet, element: c };
  }

  /** Peut-on déposer ce qu'on glisse sur cette zone ? (la barre d'outils n'a pas de `data-depot` : toujours refusé) */
  function depotPossible(zone: HTMLElement): boolean {
    if (!glisse) return false;
    const depot = zone.dataset.depot;
    if (depot === 'armure') return glisse.conteneur === 'inventaire' && typeArmureDeObjet(glisse.objet) !== null;
    if (depot === 'casque') return glisse.conteneur === 'inventaire' && typeCasqueDeObjet(glisse.objet) !== null;
    if (depot !== 'inventaire' && depot !== 'sac' && depot !== 'coffre') return false;
    if (glisse.conteneur === 'armure' || glisse.conteneur === 'casque') return depot === 'inventaire';
    return !(glisse.conteneur === depot && glisse.indice === Number(zone.dataset.indice));
  }

  function definirCible(zone: HTMLElement | null): void {
    if (zone === cibleDepot) return;
    cibleDepot = zone;
    appliquerBordures();
  }

  function finirGlisse(): void {
    if (glisse) glisse.element.style.opacity = '';
    glisse = null;
    definirCible(null);
  }

  panneau.addEventListener('dragstart', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('[draggable="true"]');
    const origine = c ? origineDe(c) : null;
    if (!c || !origine) {
      e.preventDefault();
      return;
    }
    glisse = origine;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', `${origine.conteneur}:${origine.indice}`);
    }
    // Après le dragstart : l'image qui suit la souris garde ses couleurs
    setTimeout(() => {
      if (glisse === origine) c.style.opacity = String(OPACITE_GLISSE);
    }, 0);
  });
  panneau.addEventListener('dragover', (e) => {
    const zone = (e.target as HTMLElement).closest<HTMLElement>('[data-depot]');
    if (zone && depotPossible(zone)) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      definirCible(zone);
    } else {
      definirCible(null);
    }
  });
  panneau.addEventListener('drop', (e) => {
    const zone = (e.target as HTMLElement).closest<HTMLElement>('[data-depot]');
    const origine = glisse;
    if (!zone || !origine || !depotPossible(zone)) {
      finirGlisse();
      return;
    }
    e.preventDefault();
    finirGlisse();
    const depot = zone.dataset.depot;
    if (depot === 'casque') {
      actions.equiperCasque({ conteneur: origine.conteneur as NomConteneur, indice: origine.indice });
      return;
    }
    if (depot === 'armure') {
      actions.equiperArmure({ conteneur: origine.conteneur as NomConteneur, indice: origine.indice });
      return;
    }
    const vers: CaseConteneur = { conteneur: depot as NomConteneur, indice: Number(zone.dataset.indice) };
    if (origine.conteneur === 'armure') actions.retirerArmure(vers);
    else if (origine.conteneur === 'casque') actions.retirerCasque(vers);
    else actions.deposer({ conteneur: origine.conteneur, indice: origine.indice }, vers);
  });
  panneau.addEventListener('dragend', finirGlisse);

  // ---- Clics et survol ----

  // Un clic sur le voile (à côté du panneau) ferme l'écran. Il faut que l'appui ET le relâchement aient eu lieu sur le voile :
  // un appui dans le panneau relâché dehors, ou un glisser-déposer d'objet, ne ferme rien.
  let appuiSurVoile = false;
  voile.addEventListener('mousedown', (e) => {
    appuiSurVoile = e.button === 0 && e.target === voile;
  });
  voile.addEventListener('click', (e) => {
    const valide = appuiSurVoile && e.target === voile && !glisse;
    appuiSurVoile = false;
    if (valide) actions.fermer();
  });

  panneau.addEventListener('click', (e) => {
    const cible = e.target as HTMLElement;
    const onglet2 = cible.closest<HTMLElement>('[data-role="onglet"]');
    if (onglet2) {
      onglet = onglet2.dataset.onglet as OngletInventaire;
      dessiner();
      return;
    }
    if (cible.closest('[data-role="fermer"]')) {
      actions.fermer();
      return;
    }
    const barre = cible.closest<HTMLElement>('[data-role="case-barre"]');
    if (barre) {
      actions.choisirBarre(barre.dataset.emplacement as EmplacementBarre);
      return;
    }
    // Un clic simple ne range plus rien : seule Maj + clic envoie la pile dans l'autre conteneur
    if (!e.shiftKey) return;
    if (cible.closest('[data-equipement="armure"]')) {
      if (equipement?.armure) actions.retirerArmure();
      return;
    }
    if (cible.closest('[data-equipement="casque"]')) {
      if (equipement?.casque) actions.retirerCasque();
      return;
    }
    const c = cible.closest<HTMLElement>('[data-role="case"][data-plein="1"]');
    if (c) actions.envoyer({ conteneur: c.dataset.conteneur as NomConteneur, indice: Number(c.dataset.indice) });
  });
  panneau.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const cible = e.target as HTMLElement;
    if (cible.closest('[data-equipement="armure"]')) {
      if (equipement?.armure) actions.retirerArmure();
      return;
    }
    if (cible.closest('[data-equipement="casque"]')) {
      if (equipement?.casque) actions.retirerCasque();
      return;
    }
    const c = cible.closest<HTMLElement>('[data-role="case"][data-plein="1"]');
    if (c) actions.utiliser({ conteneur: c.dataset.conteneur as NomConteneur, indice: Number(c.dataset.indice) });
  });
  // La fiche suit la dernière case occupée survolée (elle reste affichée quand la souris en sort)
  panneau.addEventListener('mouseover', (e) => {
    if (glisse) return;
    const c = (e.target as HTMLElement).closest<HTMLElement>('[data-cle]');
    if (!c || c.dataset.cle === survolCle) return;
    const infos = infosPourCle(c.dataset.cle ?? '');
    if (!infos) return;
    survolCle = c.dataset.cle ?? '';
    const zone = panneau.querySelector<HTMLElement>('[data-role="fiche"]');
    if (zone) remplirFiche(zone);
    appliquerBordures();
  });
  window.addEventListener('resize', ajuster);

  return {
    get ouvert() {
      return ouvert;
    },
    get avecCoffre() {
      return ouvert && avecCoffre;
    },
    ouvrir(coffreVisible = false) {
      ouvert = true;
      avecCoffre = coffreVisible;
      voile.style.display = 'flex';
      dessiner();
    },
    fermer() {
      ouvert = false;
      survolCle = '';
      glisse = null;
      cibleDepot = null;
      voile.style.display = 'none';
    },
    afficher(i, s, c, e, emplacement) {
      inventaire = i;
      sac = s;
      if (c) coffre = c;
      if (e) equipement = e;
      if (emplacement) emplacementChoisi = emplacement;
      dessiner();
    },
  };
}
