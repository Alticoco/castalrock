// Barre d'outils (en bas, au centre) : six cases numérotées (1 épée, 2 hache, 3 pioche, 4 arc, 5 torche, 6 pousses d'arbre),
// la case tenue en surbrillance (avec le nom de l'outil au-dessus), une pastille de matériau, la quantité et l'usure en fine barre.
// Style « Ardoise et laiton » (src/ui/theme.ts). Aucune règle de jeu ici : l'interface dessine ce qu'on lui donne.

import { CONFIG } from '../config';
import { EMPLACEMENTS_BARRE, estOutil, type EmplacementBarre } from '../regles/barreOutils';
import { etatDurabilite, type NiveauOutil } from '../regles/equipement';
import type { OutilRecolte } from '../regles/recolte';
import { icone } from './icones';
import { CASE, PANNEAU, SUR_DECOR, T, TITRE, colonneBas, couleurUsure } from './theme';

export interface DonneesBarreOutils {
  /** Case tenue */
  actif: EmplacementBarre;
  /** Pousses d'arbre portées (0 : la case 6 est grisée) */
  pousses: number;
  /** Pièges portés (la case 6 montre le piège quand il est tenu) */
  pieges: number;
  /** Arc possédé (sinon la case 4 est grisée) */
  arc: boolean;
  /** Flèches portées (compteur de la case 4) */
  fleches: number;
  niveaux: Readonly<Record<OutilRecolte, NiveauOutil>>;
  /** Durabilité de chaque outil (de 0 à `CONFIG.durabilite.max`) : fine barre en bas de la case */
  durabilites: Readonly<Record<OutilRecolte, number>>;
  /** Durabilité maximale de chaque outil (selon son palier) */
  durabilitesMax: Readonly<Record<OutilRecolte, number>>;
}

export interface BarreOutils {
  afficher(d: DonneesBarreOutils): void;
}

const NOMS: Readonly<Record<EmplacementBarre, string>> = {
  epee: 'Épée',
  hache: 'Hache',
  pioche: 'Pioche',
  pousse: 'Pousses',
  piege: 'Piège',
  torche: 'Torche',
  arc: 'Arc',
};

/** Nom du matériau après « en » (« Hache en bois »). */
const MATERIAUX: Readonly<Record<NiveauOutil, string>> = {
  base: 'bois',
  cuivre: 'cuivre',
  fer: 'fer',
  acier: 'acier',
  cristal: 'cristal',
};

/** Couleur de la pastille de matériau : bois brun clair, puis des teintes proches du métal. */
const COULEURS_MATERIAU: Readonly<Record<NiveauOutil, string>> = {
  base: '#C99A5E',
  cuivre: '#D98A5B',
  fer: '#B5BCC4',
  acier: '#8CA3BD',
  cristal: '#7CE0F0',
};

/** Clignotement léger de la barre d'usure d'un outil très usé (ajouté une seule fois à la page). */
function ajouterStyleClignotement(): void {
  if (document.getElementById('style-jauge-usee')) return;
  const style = document.createElement('style');
  style.id = 'style-jauge-usee';
  style.textContent = '@keyframes jauge-usee{0%,100%{opacity:1}50%{opacity:0.55}}';
  document.head.appendChild(style);
}

export function creerBarreOutils(racine: HTMLElement): BarreOutils {
  const B = CONFIG.commandes.barreOutils;
  ajouterStyleClignotement();
  const colonne = colonneBas(racine);

  // Nom de l'outil tenu et son usure, au-dessus de la ligne de vie
  const ligneNom = document.createElement('div');
  ligneNom.style.cssText = `order:1;display:flex;align-items:baseline;gap:10px;min-height:22px;${SUR_DECOR}`;
  const nomOutil = document.createElement('span');
  nomOutil.dataset.role = 'outil-nom';
  nomOutil.style.cssText = `${TITRE}color:#FFFFFF;font-size:17px;`;
  const usureOutil = document.createElement('span');
  usureOutil.dataset.role = 'outil-usure';
  usureOutil.style.cssText = 'font-size:13px;opacity:0.9;';
  ligneNom.append(nomOutil, usureOutil);

  const bloc = document.createElement('div');
  bloc.dataset.role = 'barre-outils';
  bloc.style.cssText = `order:3;display:flex;gap:${B.ecart}px;padding:8px;${PANNEAU}`;

  const cases = new Map<EmplacementBarre, { racine: HTMLElement; icone: HTMLElement; pastille: HTMLElement; compte: HTMLElement; usure: HTMLElement; remplissage: HTMLElement }>();
  EMPLACEMENTS_BARRE.forEach((emplacement, i) => {
    const el = document.createElement('div');
    el.dataset.emplacement = emplacement;
    el.style.cssText = `${CASE}width:${B.tailleCase}px;height:${B.tailleCase}px;transition:transform 0.12s;`;
    const dessin = document.createElement('div');
    dessin.style.cssText = 'position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;';
    const chiffre = document.createElement('span');
    chiffre.textContent = String(i + 1);
    chiffre.style.cssText = `position:absolute;left:5px;top:3px;font-size:11px;font-weight:700;color:${T.doux};`;
    // Pastille de matériau : petit losange (carré tourné), seulement pour les outils
    const pastille = document.createElement('span');
    pastille.style.cssText = 'position:absolute;right:5px;top:5px;width:7px;height:7px;transform:rotate(45deg);border-radius:1px;display:none;';
    const compte = document.createElement('span');
    compte.style.cssText = `position:absolute;right:5px;bottom:8px;font-size:11px;font-weight:700;${SUR_DECOR}`;
    // Usure : fine barre de 3 px tout en bas (seulement pour les outils qui s'usent)
    const usure = document.createElement('span');
    usure.style.cssText =
      'position:absolute;left:6px;right:6px;bottom:4px;height:3px;border-radius:2px;background:rgba(255,255,255,0.12);overflow:hidden;display:none;';
    const remplissage = document.createElement('span');
    remplissage.style.cssText = 'display:block;height:3px;width:0;';
    usure.appendChild(remplissage);
    el.append(dessin, chiffre, pastille, compte, usure);
    bloc.appendChild(el);
    cases.set(emplacement, { racine: el, icone: dessin, pastille, compte, usure, remplissage });
  });
  colonne.append(ligneNom, bloc);

  let dernier = '';

  return {
    afficher(d) {
      const cle = [d.actif, d.pousses, d.pieges, d.arc, d.fleches, d.niveaux.epee, d.niveaux.hache, d.niveaux.pioche, Math.round(d.durabilites.epee), Math.round(d.durabilites.hache), Math.round(d.durabilites.pioche), d.durabilitesMax.epee, d.durabilitesMax.hache, d.durabilitesMax.pioche].join('/');
      if (cle === dernier) return;
      dernier = cle;
      for (const emplacement of EMPLACEMENTS_BARRE) {
        const c = cases.get(emplacement);
        if (!c) continue;
        const actif = emplacement === d.actif || (emplacement === 'pousse' && d.actif === 'piege');
        const niveau = estOutil(emplacement) ? d.niveaux[emplacement] : null;
        // La case 6 montre le piège quand il est tenu, sinon les pousses d'arbre
        const piege = emplacement === 'pousse' && d.actif === 'piege';
        // Absent : pas de pousse (ou de piège) en case 6, pas d'arc en case 4
        const vide = emplacement === 'arc' ? !d.arc : emplacement === 'pousse' && (piege ? d.pieges < 1 : d.pousses < 1);
        c.icone.innerHTML = icone(piege ? 'piege' : emplacement === 'pousse' ? 'pousse-arbre' : niveau && niveau !== 'base' ? `${emplacement}-${niveau}` : emplacement);
        c.pastille.style.display = niveau ? 'block' : 'none';
        if (niveau) c.pastille.style.background = COULEURS_MATERIAU[niveau];
        if (estOutil(emplacement)) {
          const dura = d.durabilites[emplacement];
          const max = d.durabilitesMax[emplacement];
          const part = max > 0 ? Math.max(0, Math.min(1, dura / max)) : 0;
          c.usure.style.display = 'block';
          c.remplissage.style.width = `${part * 100}%`;
          c.remplissage.style.background = couleurUsure(part);
          c.usure.style.animation = etatDurabilite(dura, max) === 'use' ? 'jauge-usee 1.2s ease-in-out infinite' : '';
        }
        const nombre = emplacement === 'arc' ? d.fleches : emplacement !== 'pousse' ? 0 : piege ? d.pieges : d.pousses;
        // L'arc possédé montre toujours son compteur de flèches, même à zéro
        c.compte.textContent = nombre > 0 || (emplacement === 'arc' && d.arc) ? `×${nombre}` : '';
        c.icone.style.opacity = vide ? '0.35' : '1';
        c.racine.style.borderWidth = actif ? '2px' : '1px';
        c.racine.style.borderColor = actif ? T.accent : T.filetCase;
        c.racine.style.boxShadow = actif ? '0 0 0 3px rgba(124,203,244,0.22)' : '';
        c.racine.style.transform = actif ? 'translateY(-6px)' : '';
        if (actif) {
          // Nom de l'outil tenu (avec son matériau) et usure en chiffres
          const nomBase = piege ? NOMS.piege : NOMS[emplacement];
          nomOutil.textContent = niveau ? `${nomBase} en ${MATERIAUX[niveau]}` : nomBase;
          usureOutil.textContent = estOutil(emplacement) ? `Usure ${Math.round(d.durabilites[emplacement])} / ${d.durabilitesMax[emplacement]}` : '';
        }
      }
    },
  };
}
