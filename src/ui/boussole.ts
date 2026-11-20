// Boussole en bandeau, en haut au centre de l'écran : les points cardinaux défilent quand le joueur tourne,
// les lieux importants (village, baluchon, repère suivi) sont de petits pictogrammes placés à leur direction.
// Sous le bandeau, le point suivi : son nom et sa distance. Style « Ardoise et laiton » (voir theme.ts).
// Aucune règle de jeu ici : l'appelant donne la direction du regard et la direction et la distance de chaque point.

import { PANNEAU, T, losange } from './theme';

export interface PointBoussole {
  /** Direction absolue du point vu depuis le joueur : Math.atan2(dx, dz), même convention que le lacet du jeu */
  direction: number;
  /** Distance en mètres */
  distance: number;
  nom: string;
  /** Pictogramme : maison dorée (village), baluchon, ou pastille ronde de la couleur donnée (repère du joueur, plus tard) */
  forme: 'village' | 'baluchon' | 'repere';
  couleur?: string;
  /** Point suivi : dessiné en accent ; son nom et sa distance s'écrivent sous le bandeau */
  suivi?: boolean;
}

export interface Boussole {
  /**
   * `lacet` : direction du regard (même convention). `null` : la cache.
   * `cardinaux: false` cache N, NE, E… (sous terre il n'y a pas de nord) ; vrai par défaut.
   */
  afficher(d: { lacet: number; points: readonly PointBoussole[]; cardinaux?: boolean } | null): void;
}

// Taille du bandeau : 560 × 40 px, réduit proportionnellement sous 1400 px de large d'écran
const LARGEUR_MAX = 560;
const LARGEUR_REFERENCE = 1400;
const HAUTEUR = 40;
const HAUT_ECRAN = 18;
/** Demi-champ montré de chaque côté du regard : 97 degrés */
const DEMI_CHAMP = (97 * Math.PI) / 180;
/** Un point qui sort du champ reste collé au bord, à cette distance du bord (px) */
const MARGE_BORD = 20;
const TAILLE_PICTOGRAMME = 18;
const OPACITE_HORS_CHAMP = '0.5';

/** Les 8 points cardinaux : direction absolue `atan2(dx, dz)` (nord = −z, est = +x). */
const CARDINAUX: ReadonlyArray<{ nom: string; direction: number; principal: boolean }> = [
  { nom: 'N', direction: Math.PI, principal: true },
  { nom: 'NE', direction: (3 * Math.PI) / 4, principal: false },
  { nom: 'E', direction: Math.PI / 2, principal: true },
  { nom: 'SE', direction: Math.PI / 4, principal: false },
  { nom: 'S', direction: 0, principal: true },
  { nom: 'SO', direction: -Math.PI / 4, principal: false },
  { nom: 'O', direction: -Math.PI / 2, principal: true },
  { nom: 'NO', direction: (-3 * Math.PI) / 4, principal: false },
];

/** Petites graduations entre les points cardinaux (tous les 45 degrés, décalées de 22,5). */
const GRADUATIONS = Array.from({ length: 8 }, (_, i) => Math.PI / 8 + (i * Math.PI) / 4);

/** Ramène un angle entre −PI et PI. */
function normaliser(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function pictogramme(p: PointBoussole): string {
  const t = TAILLE_PICTOGRAMME;
  const ouvert = `<svg width="${t}" height="${t}" viewBox="0 0 18 18" aria-hidden="true" style="display:block">`;
  if (p.suivi) {
    return `${ouvert}<polygon points="9,1 17,9 9,17 1,9" fill="${T.accent}" stroke="${T.encre}" stroke-width="1"/></svg>`;
  }
  if (p.forme === 'village') {
    return `${ouvert}<polygon points="2,9 9,3 16,9 16,16 2,16" fill="${T.or}" stroke="${T.encre}" stroke-width="1" stroke-linejoin="round"/></svg>`;
  }
  if (p.forme === 'baluchon') {
    return (
      `${ouvert}<circle cx="9" cy="11" r="6" fill="#B98A5A" stroke="${T.encre}" stroke-width="1"/>` +
      `<rect x="6" y="2.5" width="6" height="4.5" rx="1" fill="#D79BFF" stroke="${T.encre}" stroke-width="1"/></svg>`
    );
  }
  return `${ouvert}<circle cx="9" cy="9" r="6" fill="${p.couleur ?? T.texte}" stroke="${T.encre}" stroke-width="1.2"/></svg>`;
}

/** Distance lisible : « 240 m », « 1,2 km ». */
export function texteDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(metres)} m`;
}

export function creerBoussole(racine: HTMLElement): Boussole {
  const bloc = document.createElement('div');
  bloc.dataset.role = 'boussole';
  bloc.style.cssText =
    `position:absolute;left:50%;top:${HAUT_ECRAN}px;transform:translateX(-50%);display:none;flex-direction:column;align-items:center;gap:8px;` +
    'pointer-events:none;user-select:none;';

  const bandeau = document.createElement('div');
  bandeau.dataset.role = 'boussole-bandeau';
  bandeau.style.cssText = `${PANNEAU}position:relative;height:${HAUTEUR}px;border-radius:30px;overflow:hidden;`;

  // Graduations, puis points cardinaux, puis pictogrammes, puis trait central doré (le dernier dessiné est dessus)
  const graduations = GRADUATIONS.map(() => {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;top:26px;width:1px;height:8px;margin-left:-0.5px;background:${T.filet};display:none;`;
    return el;
  });
  const cardinaux = CARDINAUX.map((c) => {
    const el = document.createElement('div');
    el.dataset.role = 'boussole-cardinal';
    el.textContent = c.nom;
    el.style.cssText =
      `position:absolute;top:0;line-height:${HAUTEUR - 2}px;transform:translateX(-50%);font-family:${T.titre};white-space:nowrap;display:none;` +
      (c.nom === 'N'
        ? `font-size:18px;font-weight:700;color:${T.or};`
        : c.principal
          ? `font-size:18px;font-weight:600;color:${T.texte};`
          : `font-size:14px;color:${T.doux};`);
    return el;
  });
  const zonePoints = document.createElement('div');
  zonePoints.style.cssText = 'position:absolute;inset:0;';
  const traitCentral = document.createElement('div');
  traitCentral.style.cssText = `position:absolute;left:50%;top:0;width:2px;height:100%;margin-left:-1px;background:${T.or};opacity:0.9;`;
  bandeau.append(...graduations, ...cardinaux, zonePoints, traitCentral);

  // Point suivi : losange accent, nom en Cinzel et distance, sous le bandeau
  const suivi = document.createElement('div');
  suivi.dataset.role = 'boussole-texte';
  suivi.style.cssText =
    `display:none;align-items:center;gap:8px;font-family:${T.corps};font-size:15px;color:#FFFFFF;text-shadow:${T.ombreTexte};white-space:nowrap;`;
  const nomSuivi = document.createElement('span');
  nomSuivi.style.cssText = `font-family:${T.titre};font-weight:600;letter-spacing:0.02em;`;
  const distanceSuivi = document.createElement('span');
  distanceSuivi.style.cssText = 'opacity:0.85;';
  suivi.innerHTML = losange(12, T.accent);
  suivi.append(nomSuivi, distanceSuivi);

  bloc.append(bandeau, suivi);
  racine.appendChild(bloc);

  let largeur = 0;
  /** Valeurs déjà écrites dans le DOM : on ne touche le DOM que si elles changent. */
  let visible = false;
  let cardinauxVisibles = true;
  const xCardinaux = CARDINAUX.map(() => Number.NaN);
  const xGraduations = GRADUATIONS.map(() => Number.NaN);
  let structure = '';
  let elementsPoints: HTMLElement[] = [];
  let xPoints: number[] = [];
  let horsChamp: boolean[] = [];
  let texteNom = '';
  let texteDistanceSuivi = '';
  let suiviVisible = false;

  function calculerLargeur(): number {
    return Math.round(Math.min(LARGEUR_MAX, (LARGEUR_MAX * window.innerWidth) / LARGEUR_REFERENCE)) || LARGEUR_MAX;
  }

  function appliquerLargeur(): void {
    const l = calculerLargeur();
    if (l === largeur) return;
    largeur = l;
    bandeau.style.width = `${l}px`;
    // Les positions dépendent de la largeur : tout est reposé à l'image suivante
    xCardinaux.fill(Number.NaN);
    xGraduations.fill(Number.NaN);
    xPoints = xPoints.map(() => Number.NaN);
  }
  window.addEventListener('resize', appliquerLargeur);
  appliquerLargeur();

  /** Écrit la position d'un élément du bandeau (en px, arrondie), ou le cache s'il sort du champ. */
  function placer(el: HTMLElement, cache: number[], i: number, decalage: number, demi: number, limite: number): void {
    const dehors = Math.abs(decalage) > limite;
    const x = dehors ? Number.NEGATIVE_INFINITY : Math.round(demi + decalage);
    if (cache[i] === x) return;
    cache[i] = x;
    if (dehors) {
      el.style.display = 'none';
    } else {
      el.style.display = 'block';
      el.style.left = `${x}px`;
    }
  }

  function reconstruirePoints(points: readonly PointBoussole[]): void {
    zonePoints.replaceChildren();
    elementsPoints = points.map((p) => {
      const el = document.createElement('div');
      el.dataset.role = p.suivi ? 'boussole-point-suivi' : 'boussole-point';
      el.title = p.nom;
      el.style.cssText =
        `position:absolute;top:${(HAUTEUR - 2 - TAILLE_PICTOGRAMME) / 2}px;width:${TAILLE_PICTOGRAMME}px;height:${TAILLE_PICTOGRAMME}px;` +
        `margin-left:${-TAILLE_PICTOGRAMME / 2}px;z-index:${p.suivi ? 2 : 1};`;
      el.innerHTML = pictogramme(p);
      zonePoints.appendChild(el);
      return el;
    });
    xPoints = points.map(() => Number.NaN);
    horsChamp = points.map(() => false);
  }

  return {
    afficher(d) {
      if (!d) {
        if (visible) bloc.style.display = 'none';
        visible = false;
        return;
      }
      if (!visible) bloc.style.display = 'flex';
      visible = true;

      const demi = largeur / 2;
      const pxParRadian = demi / DEMI_CHAMP;

      // Points cardinaux et graduations : positifs à gauche (même convention que le lacet), donc le décalage s'inverse
      const montrerCardinaux = d.cardinaux !== false;
      if (montrerCardinaux !== cardinauxVisibles) {
        cardinauxVisibles = montrerCardinaux;
        xCardinaux.fill(Number.NaN);
        xGraduations.fill(Number.NaN);
        if (!montrerCardinaux) for (const el of [...cardinaux, ...graduations]) el.style.display = 'none';
      }
      if (montrerCardinaux) {
        CARDINAUX.forEach((c, i) => placer(cardinaux[i], xCardinaux, i, -normaliser(c.direction - d.lacet) * pxParRadian, demi, demi - 6));
        GRADUATIONS.forEach((g, i) => placer(graduations[i], xGraduations, i, -normaliser(g - d.lacet) * pxParRadian, demi, demi - 6));
      }

      // Pictogrammes : au bord, à demi transparents, quand ils sortent du champ
      const cle = d.points.map((p) => `${p.forme}|${p.couleur ?? ''}|${p.suivi ? 1 : 0}|${p.nom}`).join(';');
      if (cle !== structure) {
        structure = cle;
        reconstruirePoints(d.points);
      }
      const limite = demi - MARGE_BORD;
      d.points.forEach((p, i) => {
        const brut = -normaliser(p.direction - d.lacet) * pxParRadian;
        const dehors = Math.abs(brut) > limite;
        const x = Math.round(demi + Math.max(-limite, Math.min(limite, brut)));
        const el = elementsPoints[i];
        if (xPoints[i] !== x) {
          xPoints[i] = x;
          el.style.left = `${x}px`;
        }
        if (horsChamp[i] !== dehors) {
          horsChamp[i] = dehors;
          el.style.opacity = dehors ? OPACITE_HORS_CHAMP : '1';
        }
      });

      // Texte sous le bandeau : le premier point suivi
      const cible = d.points.find((p) => p.suivi);
      if (!cible) {
        if (suiviVisible) suivi.style.display = 'none';
        suiviVisible = false;
        return;
      }
      if (!suiviVisible) suivi.style.display = 'flex';
      suiviVisible = true;
      if (cible.nom !== texteNom) {
        texteNom = cible.nom;
        nomSuivi.textContent = cible.nom;
      }
      const dist = `· ${texteDistance(cible.distance)}`;
      if (dist !== texteDistanceSuivi) {
        texteDistanceSuivi = dist;
        distanceSuivi.textContent = dist;
      }
    },
  };
}
