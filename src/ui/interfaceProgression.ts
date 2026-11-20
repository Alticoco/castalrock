// Interface de la progression : barre de mana, trois icônes de sorts (touches A, X et C) qui se colorient pendant leur recharge,
// barre d'XP avec le gain animé et notification de niveau. Style « Ardoise et laiton » (src/ui/theme.ts).
// Aucune règle de jeu ici : l'interface dessine ce qu'on lui donne.

import { CONFIG } from '../config';
import { INFOS_SORTS, NOMS_SORTS, sortDebloque, type NomSort, type Recharges } from '../regles/sorts';
import { PANNEAU, SUR_DECOR, T, TITRE, colonneBas, jaugeLarge, ligneVitaux } from './theme';

export interface DonneesProgression {
  niveau: number;
  /** XP du niveau en cours et XP nécessaire pour le suivant */
  xp: number;
  xpSuivant: number;
  points: number;
  mana: number;
  manaMax: number;
  /** Nœuds de l'arbre de compétences acquis (ils débloquent les sorts) */
  noeuds: readonly string[];
  recharges: Recharges;
}

export interface InterfaceProgression {
  afficher(d: DonneesProgression): void;
  /** Bandeau « Niveau 3 ! +1 point de compétence », qui s'efface seul. */
  annoncerNiveau(texte: string): void;
}

const ICONES: Readonly<Record<NomSort, string>> = {
  'boule-de-feu':
    '<svg viewBox="0 0 32 32" width="30" height="30"><path d="M16 3c2 5 8 8 8 15a8 8 0 0 1-16 0c0-3 2-5 3-7 1 2 2 3 3 3-1-4 0-8 2-11z" fill="#ff8a2a"/>' +
    '<path d="M16 14c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 2-4 4-8z" fill="#ffd45a"/></svg>',
  soin:
    '<svg viewBox="0 0 32 32" width="30" height="30"><rect x="12" y="5" width="8" height="22" rx="2" fill="#6fcf5a"/>' +
    '<rect x="5" y="12" width="22" height="8" rx="2" fill="#6fcf5a"/><rect x="13.5" y="8" width="5" height="16" rx="1" fill="#c8f5b8"/>' +
    '<rect x="8" y="13.5" width="16" height="5" rx="1" fill="#c8f5b8"/></svg>',
  barriere:
    '<svg viewBox="0 0 32 32" width="30" height="30"><path d="M4 26a12 14 0 0 1 24 0z" fill="#4a8bff" fill-opacity="0.55" stroke="#bfe0ff" stroke-width="2"/>' +
    '<path d="M16 12v14M9 16l7 4 7-4" fill="none" stroke="#bfe0ff" stroke-width="1.5"/><circle cx="16" cy="23" r="2.4" fill="#eaf5ff"/></svg>',
};

const TAILLE_ICONE = 28;

/** Dessin d'un sort, à 28 px (sans cadre). */
function dessin(sort: NomSort): string {
  return ICONES[sort].replace('width="30" height="30"', `width="${TAILLE_ICONE}" height="${TAILLE_ICONE}"`);
}

/** Durées du gain d'XP, en millisecondes : le segment grandit, reste lumineux, puis se fond dans le doré ; le texte reste affiché. */
const GAIN = { croissance: 500, lumiere: 2500, texte: 3000 } as const;

export function creerInterfaceProgression(racine: HTMLElement): InterfaceProgression {
  const colonne = colonneBas(racine);
  const ligne = ligneVitaux(racine);

  // Sorts, entre la vie (order 1) et le mana (order 3)
  const blocSorts = document.createElement('div');
  blocSorts.dataset.role = 'sorts';
  blocSorts.style.cssText = 'order:2;display:flex;gap:8px;';
  const icones = new Map<NomSort, { cadre: HTMLElement; gris: HTMLElement; couleur: HTMLElement; etat: string; enRecharge: boolean }>();
  for (const sort of NOMS_SORTS) {
    const infos = INFOS_SORTS[sort];
    const el = document.createElement('div');
    el.dataset.sort = sort;
    el.style.cssText = 'width:30px;display:flex;flex-direction:column;align-items:center;gap:1px;';
    const cadre = document.createElement('div');
    cadre.style.cssText = `position:relative;width:${TAILLE_ICONE}px;height:${TAILLE_ICONE}px;`;
    // Version grise dessous, version en couleur dessus (qui se colorie de bas en haut pendant la recharge)
    const gris = document.createElement('div');
    gris.style.cssText = 'position:absolute;inset:0;filter:grayscale(1) brightness(0.85);opacity:0.35;';
    gris.innerHTML = dessin(sort);
    const couleur = document.createElement('div');
    couleur.dataset.role = 'sort-couleur';
    couleur.style.cssText = 'position:absolute;inset:0;clip-path:inset(100% 0 0 0);';
    couleur.innerHTML = dessin(sort);
    cadre.append(gris, couleur);
    const touche = document.createElement('span');
    touche.textContent = infos.touche;
    touche.style.cssText = `font-size:10px;font-weight:700;color:rgba(255,255,255,0.85);${SUR_DECOR}`;
    el.append(cadre, touche);
    blocSorts.appendChild(el);
    icones.set(sort, { cadre, gris, couleur, etat: '', enRecharge: false });
  }

  // Mana, à droite de la ligne
  const { cadre: cadreMana, remplissage: jaugeMana, valeur: texteMana } = jaugeLarge(T.mana, 'Mana');
  cadreMana.dataset.role = 'barre-mana';
  cadreMana.style.order = '3';
  ligne.append(blocSorts, cadreMana);

  // Ligne d'XP : niveau en rond, fine barre dorée, points de compétence à dépenser
  const ligneXp = document.createElement('div');
  ligneXp.dataset.role = 'barre-xp';
  ligneXp.style.cssText = `order:4;align-self:stretch;display:flex;align-items:center;gap:10px;${SUR_DECOR}`;
  const rondNiveau = document.createElement('div');
  rondNiveau.dataset.role = 'xp-niveau';
  rondNiveau.style.cssText =
    `${TITRE}width:30px;height:30px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;` +
    `background:${T.fondFort};border:1px solid ${T.or};border-radius:${T.rayonRond};box-sizing:border-box;text-shadow:none;`;
  const zoneXp = document.createElement('div');
  zoneXp.style.cssText = 'position:relative;flex:1;height:7px;';
  const cadreXp = document.createElement('div');
  cadreXp.style.cssText =
    `position:absolute;inset:0;border-radius:4px;background:${T.fondJauge};border:1px solid rgba(214,182,110,0.3);overflow:hidden;`;
  const jaugeXp = document.createElement('div');
  jaugeXp.dataset.role = 'xp-jauge';
  jaugeXp.style.cssText = `position:absolute;left:0;top:0;bottom:0;width:0;background:${T.xp};transition:width 0.25s;`;
  // Gain d'XP : segment clair et lumineux posé au bout de la partie déjà acquise
  const segmentGain = document.createElement('div');
  segmentGain.dataset.role = 'xp-gain';
  segmentGain.style.cssText =
    `position:absolute;top:0;bottom:0;left:0;width:0;background:${T.xpGain};box-shadow:0 0 8px rgba(255,236,170,0.9);` +
    'transform-origin:left center;opacity:0;';
  cadreXp.append(jaugeXp, segmentGain);
  const texteGain = document.createElement('div');
  texteGain.dataset.role = 'xp-gain-texte';
  texteGain.style.cssText =
    'position:absolute;left:0;top:11px;transform:translateX(-50%);white-space:nowrap;font-size:12px;font-weight:700;opacity:0;';
  const texteGainPlus = document.createElement('span');
  texteGainPlus.style.cssText = 'color:#FFE7A3;';
  const texteGainTotal = document.createElement('span');
  texteGainTotal.style.cssText = 'opacity:0.85;';
  texteGain.append(texteGainPlus, texteGainTotal);
  zoneXp.append(cadreXp, texteGain);
  const textePoints = document.createElement('div');
  textePoints.dataset.role = 'xp-points';
  textePoints.style.cssText =
    `font-size:12px;font-weight:700;color:${T.encre};background:${T.accent};border-radius:10px;padding:2px 9px;text-shadow:none;display:none;`;
  ligneXp.append(rondNiveau, zoneXp, textePoints);
  colonne.appendChild(ligneXp);

  // Notification de niveau
  const bandeau = document.createElement('div');
  bandeau.dataset.role = 'notification-niveau';
  bandeau.style.cssText =
    `${PANNEAU}${TITRE}position:absolute;left:50%;top:22%;transform:translateX(-50%);padding:12px 28px;` +
    `font-size:24px;color:${T.or};white-space:nowrap;opacity:0;user-select:none;pointer-events:none;z-index:25;`;
  racine.appendChild(bandeau);

  let dernier = '';
  // Gain d'XP : valeurs précédentes (null au chargement : pas de gain) et gain en cours d'affichage
  let avant: { niveau: number; xp: number; xpSuivant: number } | null = null;
  let gainTotal = 0;
  let partDepart = 0;
  let partActuelle = 0;
  let minuteurLumiere: ReturnType<typeof setTimeout> | undefined;
  let minuteurTexte: ReturnType<typeof setTimeout> | undefined;

  const partDe = (xp: number, xpSuivant: number) => (xpSuivant > 0 && Number.isFinite(xpSuivant) ? Math.max(0, Math.min(1, xp / xpSuivant)) : 0);

  /** Relance une animation CSS depuis le début. */
  function relancer(el: HTMLElement, animation: string): void {
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = animation;
  }

  /** Montre le gain : segment lumineux de `depart` à `fin` (parts de 0 à 1) et texte « +24 XP · 108 / 200 ». */
  function montrerGain(depart: number, fin: number, xp: number, xpSuivant: number, niveauChange: boolean): void {
    // Plusieurs gains rapprochés : le segment garde son point de départ, sauf si on vient de passer de niveau
    if (minuteurLumiere === undefined || niveauChange) partDepart = depart;
    segmentGain.style.transition = 'none';
    segmentGain.style.opacity = '1';
    segmentGain.style.left = `${partDepart * 100}%`;
    segmentGain.style.width = `${Math.max(0, fin - partDepart) * 100}%`;
    relancer(segmentGain, `ath-xp-gain ${GAIN.croissance}ms ease-out`);
    jaugeXp.style.width = `${partDepart * 100}%`;
    clearTimeout(minuteurLumiere);
    minuteurLumiere = setTimeout(() => {
      minuteurLumiere = undefined;
      jaugeXp.style.width = `${partActuelle * 100}%`;
      segmentGain.style.transition = 'opacity 0.5s';
      segmentGain.style.opacity = '0';
    }, GAIN.lumiere);

    texteGainPlus.textContent = `+${gainTotal} XP`;
    texteGainTotal.textContent = ` · ${xp} / ${xpSuivant}`;
    texteGain.style.left = `${Math.max(12, Math.min(88, fin * 100))}%`;
    relancer(texteGain, `ath-xp-texte ${GAIN.texte}ms ease-out forwards`);
    clearTimeout(minuteurTexte);
    minuteurTexte = setTimeout(() => {
      minuteurTexte = undefined;
      gainTotal = 0;
    }, GAIN.texte);
  }

  return {
    afficher(d) {
      const cle = [
        d.niveau,
        d.xp,
        d.xpSuivant,
        d.points,
        Math.floor(d.mana * 10),
        d.manaMax,
        d.noeuds.join(','),
        ...NOMS_SORTS.map((s) => Math.ceil(d.recharges[s] * 10)),
      ].join('/');
      if (cle === dernier) return;
      dernier = cle;

      rondNiveau.textContent = String(d.niveau);
      textePoints.style.display = d.points > 0 ? 'block' : 'none';
      textePoints.textContent = `K · ${d.points} point${d.points > 1 ? 's' : ''}`;

      // XP : un gain apparaît quand l'XP monte (pas à la première valeur reçue : c'est un chargement)
      partActuelle = partDe(d.xp, d.xpSuivant);
      let gain = 0;
      let depart = 0;
      let niveauChange = false;
      if (avant) {
        if (d.niveau === avant.niveau && d.xp > avant.xp) {
          gain = d.xp - avant.xp;
          depart = partDe(avant.xp, avant.xpSuivant);
        } else if (d.niveau > avant.niveau) {
          // Passage de niveau : l'XP du niveau repart de 0, le gain part de 0
          gain = Math.max(0, avant.xpSuivant - avant.xp) + d.xp;
          niveauChange = true;
        }
      }
      avant = { niveau: d.niveau, xp: d.xp, xpSuivant: d.xpSuivant };
      if (gain > 0) {
        gainTotal += gain;
        montrerGain(depart, partActuelle, d.xp, d.xpSuivant, niveauChange);
      } else if (minuteurLumiere === undefined) {
        jaugeXp.style.width = `${partActuelle * 100}%`;
      }

      jaugeMana.style.width = `${Math.max(0, Math.min(1, d.mana / d.manaMax)) * 100}%`;
      texteMana.textContent = `${Math.floor(d.mana)} / ${d.manaMax}`;

      for (const sort of NOMS_SORTS) {
        const icone = icones.get(sort);
        if (!icone) continue;
        const infos = INFOS_SORTS[sort];
        const appris = sortDebloque(d.noeuds, sort);
        const reste = d.recharges[sort];
        const assez = d.mana >= infos.cout;
        // Éteinte (grise) si pas assez de mana ; plus discrète encore si non débloquée ; colorée de bas en haut pendant la recharge
        let masque = 'inset(100% 0 0 0)';
        if (appris && reste > 0) masque = `inset(${Math.max(0, Math.min(1, reste / infos.recharge)) * 100}% 0 0 0)`;
        else if (appris && assez) masque = 'inset(0)';
        const etat = `${appris}|${masque}`;
        if (etat !== icone.etat) {
          icone.etat = etat;
          icone.couleur.style.clipPath = masque;
          icone.gris.style.opacity = appris ? '0.35' : '0.15';
        }
        // La recharge vient de finir et le sort est utilisable : l'icône brille une fois (pas si la mana manque)
        if (appris && icone.enRecharge && reste <= 0 && assez) relancer(icone.cadre, 'ath-sort-pret 0.6s ease-out');
        icone.enRecharge = appris && reste > 0;
      }
    },

    annoncerNiveau(texte) {
      bandeau.textContent = texte;
      bandeau.animate(
        [
          { opacity: 0, transform: 'translateX(-50%) translateY(10px)' },
          { opacity: 1, transform: 'translateX(-50%) translateY(0)', offset: 0.1 },
          { opacity: 1, transform: 'translateX(-50%) translateY(0)', offset: 0.8 },
          { opacity: 0, transform: 'translateX(-50%) translateY(-8px)' },
        ],
        { duration: CONFIG.progression.dureeNotificationMs, fill: 'forwards' },
      );
    },
  };
}
