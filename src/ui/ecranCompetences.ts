// Écran des compétences (touche K), style « Ardoise et laiton » : une étoile au centre (niveau du joueur),
// six branches qui rayonnent et finissent toutes sur le même cercle extérieur.
// Trois états de nœud : acquis (couleur de la branche), disponible (contour doré, « respire » s'il reste un point),
// verrouillé (sombre). Survol : fiche en bas à gauche ; clic : achat. Molette = zoom, glisser = déplacer.
// Aucune règle de jeu ici : l'écran dessine et signale les clics (règles dans regles/competences.ts).

import { CONFIG } from '../config';
import { BRANCHES, NOMS_BRANCHES, NOEUDS_PAR_ID, etatNoeud, noeudsDeLaBranche, type Branche, type EtatNoeud, type Noeud } from '../regles/competences';
import { ANGLES_BRANCHE, PARAMETRES_ETOILE, positionNoeud } from '../regles/etoileCompetences';
import { xpPourNiveauSuivant, type Progression } from '../regles/progression';
import { BOUTON_ROND, ETIQUETTE, PANNEAU, T, TITRE, losange, styleBoutonSecondaire } from './theme';

export interface EcranCompetences {
  readonly ouvert: boolean;
  ouvrir(): void;
  fermer(): void;
  /** Donne la progression à dessiner (redessine tout de suite si l'écran est ouvert). */
  afficher(p: Progression, message?: { texte: string; ok: boolean }): void;
}

// ---- Valeurs réglables de l'écran ----
const COULEURS_BRANCHE: Readonly<Record<Branche, string>> = {
  combat: '#F2806F',
  defense: '#9DB4D0',
  recolte: '#8FD18B',
  artisanat: '#E8A65A',
  chasse: '#C7A27A',
  magie: '#7CCBF4',
};
const TAILLE_NOEUD = 46;
const LARGEUR_NOM = 58;
/** Distance du centre où s'arrêtent les traits partant de l'étoile */
const RAYON_ETOILE = 44;
/** Distance du centre des étiquettes de branche (au-delà du cercle extérieur) */
const RAYON_ETIQUETTE = PARAMETRES_ETOILE.rayonExterieur + 62;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 2.4;
const PAS_MOLETTE = 0.1;
const PAS_BOUTON = 0.2;
/** Déplacement (px) à partir duquel un appui devient un glissement et non un clic */
const SEUIL_GLISSE = 4;
/** Hauteur et largeur où l'étoile, ses étiquettes et les panneaux de coin tiennent à l'échelle 1 (marge pour les panneaux) */
const HAUTEUR_REFERENCE = 1000;
const LARGEUR_REFERENCE = 1400;
const ECHELLE_MAX = 1.3;
/** Durée (ms) pendant laquelle « Confirmer ? » attend le deuxième clic du bouton Réinitialiser */
const DELAI_CONFIRMATION = 3000;
const RESPIRE = 'animation:ath-respire 2.4s ease-in-out infinite;';

const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));

function creer(balise: string, style: string, texte?: string): HTMLElement {
  const e = document.createElement(balise);
  e.style.cssText = style;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

/** Étiquette dorée avec son losange (« ARBRE DE COMPÉTENCES »). */
function enteteDoree(texte: string): HTMLElement {
  const e = creer('div', `display:flex;align-items:center;gap:8px;${ETIQUETTE}`);
  e.innerHTML = `${losange(10)}`;
  e.append(texte);
  return e;
}

export function creerEcranCompetences(
  racine: HTMLElement,
  /** Clic sur un nœud : l'appelant dépense le point puis redonne la progression avec `afficher` */
  surAchat: (id: string) => void,
  /** Clic sur le fond de l'écran (hors nœuds, panneaux et glissement du plan) */
  surFermeture: () => void,
  /** Réinitialisation confirmée : l'appelant rend les points, applique les effets puis redonne la progression avec `afficher` */
  surReinitialisation: () => void,
): EcranCompetences {
  // Voile sombre par-dessus le jeu, jeu flouté derrière
  const voile = creer(
    'div',
    'position:absolute;inset:0;display:none;pointer-events:auto;overflow:hidden;user-select:none;z-index:20;' +
      `font-family:${T.corps};color:${T.texte};` +
      'background:radial-gradient(circle at 50% 50%,rgba(16,19,24,0.80) 0px,rgba(10,12,16,0.93) 480px);' +
      `backdrop-filter:${T.flou};-webkit-backdrop-filter:${T.flou};`,
  );
  voile.dataset.role = 'ecran-competences';

  // Plan zoomable : reçoit les appuis pour le glissement ; le calque est placé au centre de la fenêtre
  const plan = creer('div', 'position:absolute;inset:0;cursor:grab;');
  plan.dataset.role = 'arbre-competences';
  const calque = creer('div', 'position:absolute;left:50%;top:50%;width:0;height:0;transform-origin:0 0;');
  calque.dataset.role = 'calque-competences';
  plan.appendChild(calque);

  // ---- Blocs fixes ----
  const entete = creer('div', `position:absolute;left:40px;top:40px;width:300px;display:flex;flex-direction:column;gap:8px;padding:16px 20px;${PANNEAU}`);
  const titreEntete = creer('h1', `margin:0;font-size:24px;${TITRE}`, 'Compétences');
  const phrase = creer('p', `margin:0;font-size:14px;line-height:1.45;color:${T.doux};`, 'Chaque branche part de l’étoile. Plus tu t’éloignes du centre, plus la compétence est avancée.');
  // Bouton « Réinitialiser » : deux clics (le premier demande « Confirmer ? », valable DELAI_CONFIRMATION ms)
  const boutonReinit = document.createElement('button');
  boutonReinit.type = 'button';
  boutonReinit.dataset.role = 'reinitialiser-competences';
  boutonReinit.style.cssText = `${styleBoutonSecondaire()}align-self:flex-start;margin-top:4px;`;
  entete.append(enteteDoree('ARBRE DE COMPÉTENCES'), titreEntete, phrase, boutonReinit);

  const blocPoints = creer('div', `position:absolute;right:40px;top:40px;width:300px;display:flex;flex-direction:column;gap:10px;padding:16px 20px;${PANNEAU}`);
  blocPoints.dataset.role = 'bloc-points-competence';

  const fiche = creer('div', `position:absolute;left:40px;bottom:40px;width:400px;display:flex;flex-direction:column;gap:8px;padding:16px 18px;${PANNEAU}border-radius:${T.rayonGrand};`);
  fiche.dataset.role = 'fiche-competence';

  const message = creer(
    'div',
    `position:absolute;left:50%;bottom:40px;transform:translateX(-50%);display:none;padding:8px 18px;font-size:15px;font-weight:700;${PANNEAU}border-radius:30px;`,
  );
  message.dataset.role = 'message-competences';

  // Légende (bas droite, à gauche des boutons de zoom)
  const legende = creer('div', `position:absolute;right:124px;bottom:40px;display:flex;flex-direction:column;gap:8px;font-size:13px;color:${T.doux};`);
  const ligneLegende = (puce: string, texte: string): HTMLElement => {
    const l = creer('span', 'display:flex;align-items:center;gap:10px;');
    l.append(creer('span', `width:16px;height:16px;box-sizing:border-box;border-radius:50%;${puce}`), texte);
    return l;
  };
  legende.append(
    ligneLegende(`background:${T.or};`, 'Acquise'),
    ligneLegende(`border:2px solid ${T.or};box-shadow:0 0 8px rgba(217,184,113,0.6);`, 'Disponible : clic pour l’apprendre'),
    ligneLegende(`border:1px solid ${T.filetCase};opacity:0.6;`, 'Pas encore accessible'),
    creer('span', 'margin-top:4px;font-size:12px;', 'Molette : zoom · Glisser : déplacer · K : fermer'),
  );

  // Boutons de zoom et recentrer
  const boutons = creer('div', `position:absolute;right:40px;bottom:40px;width:64px;display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 0;${PANNEAU}border-radius:20px;`);
  const bouton = (role: string, etiquette: string, contenu: string): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.role = role;
    b.setAttribute('aria-label', etiquette);
    b.style.cssText = BOUTON_ROND;
    b.innerHTML = contenu;
    return b;
  };
  const boutonPlus = bouton('zoom-plus', 'Zoomer', '+');
  const boutonMoins = bouton('zoom-moins', 'Dézoomer', '−');
  const boutonCentrer = bouton(
    'recentrer',
    'Recentrer',
    `<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="6" fill="none" stroke="${T.or}" stroke-width="1.8"/><circle cx="11" cy="11" r="2" fill="${T.or}"/>` +
      `<g stroke="${T.or}" stroke-width="1.8" stroke-linecap="round"><line x1="11" y1="1" x2="11" y2="4"/><line x1="11" y1="18" x2="11" y2="21"/><line x1="1" y1="11" x2="4" y2="11"/><line x1="18" y1="11" x2="21" y2="11"/></g></svg>`,
  );
  const valeurZoom = creer('span', `font-size:15px;font-weight:700;color:${T.doux};`);
  valeurZoom.dataset.role = 'zoom-valeur';
  boutons.append(boutonPlus, valeurZoom, boutonMoins, boutonCentrer);

  voile.append(plan, entete, blocPoints, fiche, message, legende, boutons);
  racine.appendChild(voile);

  // ---- État ----
  let ouvert = false;
  let progression: Progression | null = null;
  let texteMessage: { texte: string; ok: boolean } | undefined;
  let survole: string | null = null;
  let zoom = 1;
  let dx = 0;
  let dy = 0;
  let echelleBase = 1;
  let enConfirmation = false;
  let minuteConfirmation: ReturnType<typeof setTimeout> | undefined;
  /** Éléments des nœuds, pour changer le survol sans tout redessiner */
  const ronds = new Map<string, HTMLElement>();

  // ---- Réinitialisation de l'arbre ----
  function annulerConfirmation(): void {
    enConfirmation = false;
    if (minuteConfirmation !== undefined) clearTimeout(minuteConfirmation);
    minuteConfirmation = undefined;
  }
  function dessinerBoutonReinit(p: Progression): void {
    const aDesNoeuds = p.noeuds.length > 0;
    if (!aDesNoeuds) annulerConfirmation();
    boutonReinit.disabled = !aDesNoeuds;
    boutonReinit.textContent = enConfirmation ? 'Confirmer ?' : 'Réinitialiser';
    boutonReinit.title = aDesNoeuds ? 'Oublier toutes les compétences et récupérer tous les points (gratuit)' : 'Aucune compétence à oublier';
    boutonReinit.style.opacity = aDesNoeuds ? '1' : '0.45';
    boutonReinit.style.cursor = aDesNoeuds ? 'pointer' : 'not-allowed';
    boutonReinit.style.borderColor = enConfirmation ? T.or : '';
    boutonReinit.style.color = enConfirmation ? T.or : T.texte;
  }
  boutonReinit.addEventListener('click', () => {
    if (!progression || progression.noeuds.length === 0) return;
    if (!enConfirmation) {
      enConfirmation = true;
      minuteConfirmation = setTimeout(() => {
        enConfirmation = false;
        minuteConfirmation = undefined;
        if (progression) dessinerBoutonReinit(progression);
      }, DELAI_CONFIRMATION);
      dessinerBoutonReinit(progression);
      return;
    }
    annulerConfirmation();
    surReinitialisation();
  });

  // ---- Zoom et déplacement (transform sur le calque, sans rien redessiner) ----
  function calculerEchelleBase(): void {
    echelleBase = Math.min(ECHELLE_MAX, window.innerHeight / HAUTEUR_REFERENCE, window.innerWidth / LARGEUR_REFERENCE);
  }
  function appliquerTransform(): void {
    calque.style.transform = `translate(${dx}px,${dy}px) scale(${echelleBase * zoom})`;
    valeurZoom.textContent = `×${zoom.toFixed(1)}`;
  }
  function zoomer(pas: number): void {
    zoom = clamp(Math.round((zoom + pas) * 10) / 10, ZOOM_MIN, ZOOM_MAX);
    appliquerTransform();
  }
  function recentrer(): void {
    zoom = 1;
    dx = 0;
    dy = 0;
    appliquerTransform();
  }
  boutonPlus.addEventListener('click', () => zoomer(PAS_BOUTON));
  boutonMoins.addEventListener('click', () => zoomer(-PAS_BOUTON));
  boutonCentrer.addEventListener('click', recentrer);
  voile.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoomer(e.deltaY < 0 ? PAS_MOLETTE : -PAS_MOLETTE);
    },
    { passive: false },
  );

  let depart: { x: number; y: number; dx: number; dy: number } | null = null;
  let aBouge = false;
  // Un clic sur le fond nu (le plan lui-même, pas un nœud) qui n'a pas servi à glisser ferme l'écran
  let appuiSurFond = false;
  plan.addEventListener('mousedown', (e) => {
    depart = { x: e.clientX, y: e.clientY, dx, dy };
    aBouge = false;
    appuiSurFond = e.button === 0 && e.target === plan;
  });
  plan.addEventListener('click', (e) => {
    const valide = appuiSurFond && e.target === plan && !aBouge;
    appuiSurFond = false;
    if (valide) surFermeture();
  });
  plan.addEventListener('mousemove', (e) => {
    if (!depart) return;
    const mx = e.clientX - depart.x;
    const my = e.clientY - depart.y;
    if (!aBouge && Math.abs(mx) + Math.abs(my) > SEUIL_GLISSE) {
      aBouge = true;
      plan.style.cursor = 'grabbing';
    }
    if (aBouge) {
      dx = depart.dx + mx;
      dy = depart.dy + my;
      appliquerTransform();
    }
  });
  const relacher = (): void => {
    if (!depart) return;
    depart = null;
    plan.style.cursor = 'grab';
    // Le clic qui suit le relâchement doit encore voir `aBouge` ; on le remet à zéro juste après
    setTimeout(() => {
      aBouge = false;
    }, 0);
  };
  plan.addEventListener('mouseup', relacher);
  plan.addEventListener('mouseleave', relacher);
  window.addEventListener('resize', () => {
    if (!ouvert) return;
    calculerEchelleBase();
    appliquerTransform();
  });

  // ---- Dessin ----
  const couleurBranche = (n: Noeud): string => COULEURS_BRANCHE[n.branche];

  function styleRond(n: Noeud, etat: EtatNoeud, aDesPoints: boolean, vu: boolean): string {
    const c = position(n);
    let fond = 'rgba(14,17,22,0.95)';
    let bord = `1px solid ${T.filetCase}`;
    let couleur: string = T.doux;
    let opacite = 0.55;
    let ombre = 'none';
    let anim = '';
    if (etat === 'acquis') {
      fond = couleurBranche(n);
      bord = `2px solid ${couleurBranche(n)}`;
      couleur = T.encre;
      opacite = 1;
      ombre = `0 0 14px ${couleurBranche(n)}66`;
    } else if (etat === 'disponible') {
      bord = `2px solid ${T.or}`;
      couleur = T.or;
      opacite = 1;
      ombre = '0 0 0 4px rgba(217,184,113,0.16)';
      if (aDesPoints) anim = RESPIRE;
    }
    if (vu) {
      ombre = `0 0 0 3px ${T.accent}`;
      anim = '';
    }
    return (
      `position:absolute;left:${c.x - TAILLE_NOEUD / 2}px;top:${c.y - TAILLE_NOEUD / 2}px;width:${TAILLE_NOEUD}px;height:${TAILLE_NOEUD}px;padding:0;` +
      `border-radius:50%;box-sizing:border-box;cursor:${etat === 'verrouille' ? 'inherit' : 'pointer'};font-family:${T.titre};font-size:18px;font-weight:700;` +
      `color:${couleur};background:${fond};border:${bord};box-shadow:${ombre};opacity:${opacite};${anim}`
    );
  }

  const position = (n: Noeud): { x: number; y: number } => positionNoeud(n);

  /** Trait fin entre deux points, un `div` tourné (comme dans la maquette). */
  function trait(a: { x: number; y: number }, b: { x: number; y: number }, couleur: string, opacite: number): HTMLElement {
    const longueur = Math.hypot(b.x - a.x, b.y - a.y);
    const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    return creer(
      'div',
      `position:absolute;left:${a.x}px;top:${a.y - 1}px;width:${longueur}px;height:2px;transform-origin:0 50%;` +
        `transform:rotate(${angle}deg);background:${couleur};opacity:${opacite};border-radius:2px;pointer-events:none;`,
    );
  }

  function dessinerCalque(p: Progression): void {
    const aDesPoints = p.points > 0;
    const acquis = (id: string): boolean => p.noeuds.includes(id);
    const elements: HTMLElement[] = [];
    ronds.clear();

    // Anneaux en pointillés : cercle intérieur, intermédiaire, extérieur
    const { rayonInterieur: r0, rayonExterieur: r1 } = PARAMETRES_ETOILE;
    [r0, (r0 + r1) / 2, r1].forEach((r, i) => {
      elements.push(
        creer(
          'div',
          `position:absolute;left:${-r}px;top:${-r}px;width:${2 * r}px;height:${2 * r}px;box-sizing:border-box;border-radius:50%;` +
            `border:1px dashed rgba(217,184,113,${[0.16, 0.08, 0.16][i]});pointer-events:none;`,
        ),
      );
    });

    // Traits : de l'étoile vers les nœuds de départ, et de chaque prérequis vers son nœud
    for (const n of BRANCHES.flatMap((b) => noeudsDeLaBranche(b))) {
      const fin = position(n);
      if (n.parents.length === 0) {
        const a = (ANGLES_BRANCHE[n.branche] * Math.PI) / 180;
        const depart0 = { x: RAYON_ETOILE * Math.cos(a), y: RAYON_ETOILE * Math.sin(a) };
        elements.push(trait(depart0, fin, acquis(n.id) ? couleurBranche(n) : T.or, acquis(n.id) ? 0.9 : 0.25));
      }
      for (const idParent of n.parents) {
        const parent = NOEUDS_PAR_ID.get(idParent);
        if (!parent) continue;
        const allume = acquis(parent.id) && acquis(n.id);
        elements.push(trait(position(parent), fin, allume ? couleurBranche(n) : T.or, allume ? 0.9 : 0.22));
      }
    }

    // Étoile centrale : 12 branches, « NIV. » et le niveau
    const etoile = creer('div', 'position:absolute;left:-50px;top:-50px;width:100px;height:100px;pointer-events:none;');
    etoile.innerHTML =
      `<svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true" style="position:absolute;left:0;top:0">` +
      `<polygon points="50,2 61,32 92,24 70,48 92,76 61,68 50,98 39,68 8,76 30,48 8,24 39,32" fill="${T.fondFort}" stroke="${T.or}" stroke-width="2" stroke-linejoin="round"/>` +
      `<polygon points="50,20 57,40 78,36 64,50 78,64 57,60 50,80 43,60 22,64 36,50 22,36 43,40" fill="${T.or}" opacity="0.18"/></svg>`;
    const niveau = creer('div', 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;');
    niveau.append(
      creer('span', `font-size:10px;letter-spacing:0.14em;font-weight:700;color:${T.doux};`, 'NIV.'),
      creer('span', `font-family:${T.titre};font-size:26px;font-weight:700;color:${T.or};`, String(p.niveau)),
    );
    niveau.dataset.role = 'niveau-competences';
    etoile.appendChild(niveau);
    elements.push(etoile);

    // Étiquettes de branches, au-delà du cercle extérieur
    for (const b of BRANCHES) {
      const liste = noeudsDeLaBranche(b);
      const a = (ANGLES_BRANCHE[b] * Math.PI) / 180;
      const x = RAYON_ETIQUETTE * Math.cos(a);
      const y = RAYON_ETIQUETTE * Math.sin(a);
      const e = creer('div', `position:absolute;left:${x - 80}px;top:${y - 22}px;width:160px;display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none;`);
      e.append(
        creer('span', `font-family:${T.titre};font-size:20px;font-weight:600;color:${COULEURS_BRANCHE[b]};`, NOMS_BRANCHES[b]),
        creer('span', `font-size:12px;color:${T.doux};`, `${liste.filter((n) => acquis(n.id)).length} / ${liste.length}`),
      );
      elements.push(e);
    }

    // Nœuds et leur nom
    for (const b of BRANCHES) {
      for (const n of noeudsDeLaBranche(b)) {
        const etat = etatNoeud(p.noeuds, n.id);
        const c = position(n);
        const rond = document.createElement('button');
        rond.type = 'button';
        rond.dataset.role = 'noeud-competence';
        rond.dataset.noeud = n.id;
        rond.dataset.etat = etat;
        rond.setAttribute('aria-label', n.nom);
        rond.textContent = n.nom.charAt(0);
        rond.style.cssText = styleRond(n, etat, aDesPoints, survole === n.id);
        ronds.set(n.id, rond);
        const visible = etat !== 'verrouille';
        const nom = creer(
          'div',
          `position:absolute;left:${c.x - LARGEUR_NOM / 2}px;top:${c.y + TAILLE_NOEUD / 2 + 3}px;width:${LARGEUR_NOM}px;text-align:center;font-size:11px;line-height:1.15;` +
            `color:${visible ? T.texte : T.doux};opacity:${visible ? 1 : 0.6};text-shadow:0 1px 3px rgba(0,0,0,0.9);pointer-events:none;`,
          n.nom,
        );
        elements.push(rond, nom);
      }
    }
    calque.replaceChildren(...elements);
  }

  function dessinerPoints(p: Progression): void {
    const aDesPoints = p.points > 0;
    const nombre = creer(
      'span',
      `font-family:${T.titre};font-size:46px;font-weight:700;line-height:1;min-width:34px;text-align:center;color:${aDesPoints ? T.or : T.doux};` +
        `opacity:${aDesPoints ? 1 : 0.5};${aDesPoints ? 'animation:ath-lueur 2.4s ease-in-out infinite;' : ''}`,
      String(p.points),
    );
    nombre.dataset.role = 'points-competence';
    const libelle = aDesPoints ? (p.points > 1 ? 'points à dépenser' : 'point à dépenser') : 'Aucun point';
    const texte = creer('span', 'display:flex;flex-direction:column;gap:2px;');
    texte.append(
      creer('span', `font-family:${T.titre};font-size:17px;font-weight:600;`, libelle),
      creer('span', `font-size:13px;color:${T.doux};`, aDesPoints ? 'Les compétences qui brillent sont prêtes.' : 'Gagne de l’XP pour en obtenir.'),
    );
    const haut = creer('div', 'display:flex;align-items:center;gap:16px;');
    haut.append(nombre, texte);

    const filet = creer('div', `height:1px;background:${T.filet};opacity:0.5;`);
    const max = p.niveau >= CONFIG.progression.niveauMax;
    const suivant = xpPourNiveauSuivant(p.niveau);
    const part = max ? 1 : clamp(p.xp / Math.max(1, suivant), 0, 1);
    const ligneXp = creer('div', `display:flex;justify-content:space-between;font-size:13px;color:${T.doux};`);
    ligneXp.append(
      creer('span', '', max ? `Niveau ${p.niveau} (maximum)` : `Prochain point au niveau ${p.niveau + 1}`),
      creer('span', `color:${T.texte};font-weight:700;`, max ? '' : `${p.xp} / ${suivant} XP`),
    );
    const barre = creer('div', 'height:6px;border-radius:3px;background:rgba(255,255,255,0.1);overflow:hidden;');
    barre.appendChild(creer('div', `width:${Math.round(part * 100)}%;height:6px;background:${T.or};`));
    blocPoints.replaceChildren(enteteDoree('POINTS DE COMPÉTENCE'), haut, filet, ligneXp, barre);
  }

  function dessinerFiche(p: Progression): void {
    const n = survole ? NOEUDS_PAR_ID.get(survole) : undefined;
    if (!n) {
      fiche.replaceChildren(
        creer('div', `font-size:15px;line-height:1.45;color:${T.doux};`, 'Survole une compétence pour lire son effet ; clique sur une compétence disponible pour la prendre.'),
      );
      return;
    }
    const couleur = couleurBranche(n);
    const etat = etatNoeud(p.noeuds, n.id);
    let texteEtat: string;
    let couleurEtat: string = T.doux;
    if (etat === 'acquis') {
      texteEtat = 'Acquise';
      couleurEtat = couleur;
    } else if (etat === 'disponible') {
      texteEtat = p.points >= n.cout ? `Disponible · clic pour l’apprendre (${n.cout} point${n.cout > 1 ? 's' : ''})` : 'Disponible · plus de point';
      couleurEtat = T.or;
    } else {
      texteEtat = `Pas encore accessible · demande ${n.parents.map((id) => NOEUDS_PAR_ID.get(id)?.nom ?? id).join(' ou ')}`;
    }
    const pastille = creer(
      'div',
      `width:40px;height:40px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border-radius:50%;font-family:${T.titre};font-size:18px;font-weight:700;color:${T.encre};background:${couleur};`,
      n.nom.charAt(0),
    );
    const noms = creer('div', 'display:flex;flex-direction:column;gap:2px;');
    noms.append(
      creer('span', `font-size:11px;letter-spacing:0.14em;font-weight:700;color:${couleur};`, NOMS_BRANCHES[n.branche].toUpperCase()),
      creer('span', `font-family:${T.titre};font-size:20px;font-weight:600;`, n.nom),
    );
    const tete = creer('div', 'display:flex;align-items:center;gap:12px;');
    tete.append(pastille, noms);
    fiche.replaceChildren(
      tete,
      creer('div', `font-size:15px;line-height:1.45;color:${T.doux};`, n.description),
      creer('div', `font-size:14px;font-weight:700;color:${T.texte};`, `Effet : ${n.effet}`),
      creer('div', `font-size:14px;font-weight:700;color:${couleurEtat};`, texteEtat),
    );
  }

  function dessinerMessage(): void {
    message.style.display = texteMessage?.texte ? 'block' : 'none';
    message.textContent = texteMessage?.texte ?? '';
    message.style.color = texteMessage?.ok ? T.usureBonne : T.usureMauvaise;
  }

  function dessiner(): void {
    if (!ouvert || !progression) return;
    dessinerCalque(progression);
    dessinerPoints(progression);
    dessinerFiche(progression);
    dessinerBoutonReinit(progression);
    dessinerMessage();
    appliquerTransform();
  }

  // ---- Clics et survol ----
  const idSous = (e: Event): string | undefined => (e.target as HTMLElement).closest<HTMLElement>('[data-noeud]')?.dataset.noeud;

  calque.addEventListener('click', (e) => {
    if (aBouge) return;
    const id = idSous(e);
    if (id) surAchat(id);
  });
  calque.addEventListener('mouseover', (e) => {
    const id = idSous(e);
    if (depart || id === undefined || id === survole || !progression) return;
    const ancien = survole;
    survole = id;
    // Seuls l'ancien et le nouveau nœud changent de style ; la fiche est refaite
    for (const cle of [ancien, id]) {
      const n = cle ? NOEUDS_PAR_ID.get(cle) : undefined;
      const el = cle ? ronds.get(cle) : undefined;
      if (n && el) el.style.cssText = styleRond(n, etatNoeud(progression.noeuds, n.id), progression.points > 0, cle === survole);
    }
    dessinerFiche(progression);
  });

  return {
    get ouvert() {
      return ouvert;
    },
    ouvrir() {
      ouvert = true;
      annulerConfirmation();
      texteMessage = undefined;
      survole = null;
      zoom = 1;
      dx = 0;
      dy = 0;
      voile.style.display = 'block';
      calculerEchelleBase();
      dessiner();
    },
    fermer() {
      ouvert = false;
      annulerConfirmation();
      depart = null;
      voile.style.display = 'none';
    },
    afficher(p, m) {
      progression = p;
      texteMessage = m;
      dessiner();
    },
  };
}
