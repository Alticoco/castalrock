// Carte agrandie (touche M) : voile flou, carte ronde au centre avec son anneau de boussole, pastilles des repères
// du joueur, bulle d'un repère ouvert, petit menu (zoom, types de repères, village) et ligne d'aide.
// Le terrain lui-même est dessiné par src/ui/miniCarte.ts dans un canvas qui vient se loger dans `disque`.
// Aucune règle de jeu ici : poser, retirer et suivre sont demandés à l'extérieur (`ActionsReperes`) ; la carte
// reçoit à chaque image les repères du joueur et ce qui est suivi.

import { CONFIG } from '../config';
import { CAP_NORD, deprojeter, projeter } from '../regles/miniCarte';
import { MAX_REPERES, NOMS_TYPES_REPERE, TYPES_REPERE, type RepereJoueur, type Suivi, type TypeRepereJoueur } from '../regles/reperes';
import { COULEURS_REPERES } from './couleursReperes';
import { texteDistance } from './boussole';
import { PANNEAU, ETIQUETTE, T, TITRE } from './theme';

/** Ce que la carte demande au jeu quand le joueur agit sur les repères. */
export interface ActionsReperes {
  poser(type: TypeRepereJoueur, x: number, z: number): void;
  retirer(id: number): void;
  suivre(cible: Suivi): void;
}

/** Ce que la carte agrandie doit montrer à cette image. */
export interface DonneesGrande {
  /** Diamètre du disque en pixels CSS */
  diametre: number;
  /** Rayon de monde montré (mètres), nord en haut, joueur au centre */
  rayon: number;
  x: number;
  z: number;
  reperes: readonly RepereJoueur[];
  suivi: Suivi;
  /** Faux dans la mine et la maison : pas de pose, menu des types caché */
  posable: boolean;
}

export interface CarteAgrandie {
  /** Zoom actuel (de zoomMin à zoomMax) */
  readonly zoom: number;
  /** Cercle où le canvas du terrain est placé */
  readonly disque: HTMLElement;
  brancher(actions: ActionsReperes): void;
  afficher(visible: boolean): void;
  mettreAJour(donnees: DonneesGrande): void;
}

/** Espace entre le disque et l'anneau, en pixels (la place des lettres E, S, O) */
const BANDE = 20;
const PASTILLE = 42;
/** Hauteur de la pastille avec son triangle : la pointe du triangle marque l'endroit du repère */
const HAUTEUR_REPERE = 50;

const AIDE = ['Clic : poser le repère choisi', 'Clic sur un repère : voir, suivre ou retirer', 'Molette : zoom', 'M : fermer'];

/** Icône provisoire d'un type de repère (SVG de 24 × 24), dans la couleur du type. */
function icone(type: TypeRepereJoueur | 'village', couleur: string, taille: number): string {
  const trait = `fill="none" stroke="${couleur}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"`;
  const plein = `fill="${couleur}" stroke="${couleur}" stroke-width="1.2" stroke-linejoin="round"`;
  let corps = '';
  switch (type) {
    case 'filon':
      // Pioche : tête courbe et manche
      corps = `<path d="M3 11 C6 4.5 18 4.5 21 11" ${trait}/><path d="M12 6.5 V21" ${trait}/>`;
      break;
    case 'cueillette':
      // Feuille et sa nervure
      corps = `<path d="M5 19 C5 9 11 4 20 4 C20 13 15 19 5 19 Z" ${plein}/><path d="M5 19 L14 10" fill="none" stroke="#14181E" stroke-width="1.6" stroke-linecap="round"/>`;
      break;
    case 'danger':
      // Point d'exclamation
      corps = `<path d="M12 4 V14" ${trait} stroke-width="3.4"/><circle cx="12" cy="19.2" r="2" fill="${couleur}"/>`;
      break;
    case 'tresor': {
      // Étoile à cinq branches
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 9.5 : 4;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12.6 + r * Math.sin(a)).toFixed(2)}`);
      }
      corps = `<polygon points="${pts.join(' ')}" ${plein}/>`;
      break;
    }
    case 'lieu':
      // Drapeau sur son mât
      corps = `<path d="M7 3.5 V21" ${trait}/><path d="M7 5 H19 L15.5 9 L19 13 H7 Z" ${plein}/>`;
      break;
    case 'village':
      // Maison
      corps = `<path d="M3 12 L12 4 L21 12" ${trait}/><path d="M6 10.5 V20 H18 V10.5" ${trait}/>`;
      break;
  }
  return `<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" aria-hidden="true" style="pointer-events:none;display:block">${corps}</svg>`;
}

interface Pastille {
  repere: RepereJoueur;
  element: HTMLElement;
  bulle: HTMLElement | null;
  distance: HTMLElement | null;
}

export function creerCarteAgrandie(racine: HTMLElement): CarteAgrandie {
  const C = CONFIG.miniCarte;
  let actions: ActionsReperes | null = null;
  let zoom = 1;
  let typeChoisi: TypeRepereJoueur = TYPES_REPERE[0];
  let ouvert: number | null = null;
  let derniere: DonneesGrande | null = null;
  let signature = '';
  let pastilles: Pastille[] = [];

  // --- Voile : le jeu flou derrière, tous les clics s'arrêtent ici (rien ne frappe, rien ne se récolte) ---
  const voile = document.createElement('div');
  voile.dataset.role = 'carte-voile';
  voile.style.cssText =
    'position:absolute;inset:0;display:none;z-index:35;pointer-events:auto;user-select:none;' +
    'background:rgba(10,12,16,0.42);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);';
  // Pas de focus sur les boutons : la barre d'espace (saut) ne doit pas les déclencher
  voile.addEventListener('mousedown', (e) => e.preventDefault());
  voile.addEventListener('contextmenu', (e) => e.preventDefault());
  voile.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      changerZoom(e.deltaY < 0 ? C.zoomPas : -C.zoomPas);
    },
    { passive: false },
  );

  // --- Cadre : anneau, encoche N, lettres, disque ---
  const cadre = document.createElement('div');
  cadre.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);';
  const anneau = document.createElement('div');
  anneau.style.cssText =
    `position:absolute;inset:0;box-sizing:border-box;border-radius:50%;border:1px solid ${T.filet};` +
    `box-shadow:0 0 0 6px ${T.fondFort},0 0 0 7px ${T.filetCase},0 16px 48px rgba(0,0,0,0.45);pointer-events:none;`;
  const encoche = document.createElement('div');
  encoche.dataset.role = 'carte-nord';
  encoche.style.cssText = 'position:absolute;left:50%;top:-18px;width:32px;height:36px;margin-left:-16px;pointer-events:none;';
  encoche.innerHTML =
    '<svg width="32" height="36" viewBox="0 0 32 36" aria-hidden="true" style="position:absolute;left:0;top:0">' +
    `<polygon points="16,1 31,9 31,25 16,35 1,25 1,9" fill="${T.fondFort}" stroke="${T.or}" stroke-width="2"/></svg>` +
    `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:${T.titre};font-weight:700;font-size:17px;color:${T.or}">N</div>`;
  const lettre = (texte: string, place: string) => {
    const el = document.createElement('div');
    el.textContent = texte;
    el.style.cssText =
      `position:absolute;${place}width:${BANDE}px;text-align:center;font-family:${T.titre};font-weight:600;font-size:15px;` +
      `line-height:${BANDE}px;height:${BANDE}px;color:${T.doux};pointer-events:none;`;
    return el;
  };
  const disque = document.createElement('div');
  disque.dataset.role = 'carte-disque';
  disque.style.cssText = `position:absolute;left:${BANDE}px;top:${BANDE}px;border-radius:50%;overflow:hidden;background:#${C.couleurs.fond.toString(16).padStart(6, '0')};cursor:crosshair;`;
  const couche = document.createElement('div');
  couche.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
  disque.addEventListener('click', (e) => {
    if (ouvert !== null) {
      // Un clic ailleurs ferme la bulle sans poser de repère
      ouvert = null;
      signature = '';
      if (derniere) mettreAJour(derniere);
      return;
    }
    if (!derniere || !derniere.posable || !actions) return;
    const r = disque.getBoundingClientRect();
    const rayonPx = r.width / 2;
    const ox = e.clientX - (r.left + rayonPx);
    const oy = e.clientY - (r.top + rayonPx);
    if (Math.hypot(ox, oy) > rayonPx) return;
    const m = deprojeter((ox / rayonPx) * derniere.rayon, (oy / rayonPx) * derniere.rayon, CAP_NORD);
    actions.poser(typeChoisi, Math.round(derniere.x + m.dx), Math.round(derniere.z + m.dz));
  });
  cadre.append(
    anneau,
    encoche,
    lettre('E', 'right:0;top:50%;margin-top:-10px;'),
    lettre('S', 'bottom:0;left:50%;margin-left:-10px;'),
    lettre('O', 'left:0;top:50%;margin-top:-10px;'),
    disque,
  );
  disque.appendChild(couche);

  // --- Menu à droite ---
  const menu = document.createElement('div');
  menu.dataset.role = 'carte-menu';
  menu.style.cssText =
    `position:absolute;left:calc(100% + 40px);top:50%;transform:translateY(-50%);width:64px;display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 0;${PANNEAU}border-radius:20px;`;
  const boutonRond = (role: string, aria: string, contenu: string): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.role = role;
    b.setAttribute('aria-label', aria);
    b.title = aria;
    b.innerHTML = contenu;
    b.style.cssText =
      `width:44px;height:44px;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;box-sizing:border-box;` +
      `font-family:${T.corps};font-size:22px;font-weight:700;color:${T.texte};background:${T.fondCase};border:1px solid ${T.filetCase};border-radius:50%;`;
    return b;
  };
  const plus = boutonRond('carte-zoom-plus', 'Zoomer', '+');
  const moins = boutonRond('carte-zoom-moins', 'Dézoomer', '−');
  plus.addEventListener('click', () => changerZoom(C.zoomPas));
  moins.addEventListener('click', () => changerZoom(-C.zoomPas));
  const valeurZoom = document.createElement('span');
  valeurZoom.dataset.role = 'carte-zoom-valeur';
  valeurZoom.style.cssText = `font-family:${T.corps};font-size:15px;font-weight:700;color:${T.doux};`;
  const filet = () => {
    const f = document.createElement('div');
    f.style.cssText = `width:36px;height:1px;margin:4px 0;background:${T.filet};`;
    return f;
  };
  const groupeTypes = document.createElement('div');
  groupeTypes.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;';
  const boutonsTypes = new Map<TypeRepereJoueur, HTMLButtonElement>();
  for (const type of TYPES_REPERE) {
    const b = boutonRond('carte-type', NOMS_TYPES_REPERE[type], icone(type, COULEURS_REPERES[type], 26));
    b.dataset.type = type;
    b.addEventListener('click', () => {
      typeChoisi = type;
      signature = '';
      if (derniere) mettreAJour(derniere);
    });
    boutonsTypes.set(type, b);
    groupeTypes.appendChild(b);
  }
  const boutonVillage = boutonRond('carte-village', 'Suivre le village', icone('village', T.texte, 26));
  boutonVillage.addEventListener('click', () => {
    if (!derniere || !actions) return;
    actions.suivre(derniere.suivi === 'village' ? null : 'village');
  });
  menu.append(plus, valeurZoom, moins, filet(), groupeTypes, boutonVillage);

  // --- Bloc « repère choisi » ---
  const bloc = document.createElement('div');
  bloc.dataset.role = 'carte-repere-choisi';
  bloc.style.cssText =
    `position:absolute;left:calc(100% + 120px);top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:3px;font-family:${T.corps};font-size:13px;color:${T.doux};white-space:nowrap;pointer-events:none;`;
  const blocEtiquette = document.createElement('span');
  blocEtiquette.style.cssText = ETIQUETTE;
  blocEtiquette.textContent = 'Repère choisi';
  const blocNom = document.createElement('span');
  blocNom.style.cssText = `${TITRE}font-size:16px;`;
  const blocCompte = document.createElement('span');
  blocCompte.dataset.role = 'carte-compte';
  bloc.append(blocEtiquette, blocNom, blocCompte);
  cadre.append(menu, bloc);

  // --- Ligne d'aide en bas ---
  const aide = document.createElement('div');
  aide.style.cssText =
    `position:absolute;left:0;right:0;bottom:14px;display:flex;justify-content:center;gap:20px;font-family:${T.corps};font-size:13px;` +
    `color:#FFFFFF;text-shadow:${T.ombreTexte};pointer-events:none;`;
  for (const t of AIDE) {
    const s = document.createElement('span');
    s.textContent = t;
    aide.appendChild(s);
  }

  voile.append(cadre, aide);
  racine.appendChild(voile);

  function changerZoom(delta: number): void {
    const z = Math.max(C.zoomMin, Math.min(C.zoomMax, Math.round((zoom + delta) * 10) / 10));
    if (z === zoom) return;
    zoom = z;
    signature = '';
  }

  /** Bulle d'un repère ouvert : nom, distance, Suivre / Ne plus suivre, Retirer. */
  function creerBulle(r: RepereJoueur, suivi: boolean): { bulle: HTMLElement; distance: HTMLElement } {
    const bulle = document.createElement('div');
    bulle.dataset.role = 'carte-bulle';
    bulle.dataset.id = String(r.id);
    bulle.style.cssText =
      `position:absolute;display:flex;align-items:center;gap:8px;padding:6px 8px 6px 12px;white-space:nowrap;cursor:default;` +
      `background:${T.fondFort};border:1px solid ${T.filet};border-radius:${T.rayonPetit};box-shadow:0 6px 18px rgba(0,0,0,0.35);`;
    bulle.addEventListener('click', (e) => e.stopPropagation());
    const textes = document.createElement('span');
    textes.style.cssText = 'display:flex;flex-direction:column;';
    const nom = document.createElement('span');
    nom.textContent = NOMS_TYPES_REPERE[r.type];
    nom.style.cssText = `${TITRE}font-size:14px;`;
    const distance = document.createElement('span');
    distance.style.cssText = `font-family:${T.corps};font-size:12px;color:${T.doux};`;
    textes.append(nom, distance);
    const bouton = (role: string, texte: string, surClic: () => void, couleur: string) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.role = role;
      b.textContent = texte;
      b.style.cssText =
        `height:32px;padding:0 10px;cursor:pointer;font-family:${T.corps};font-size:13px;font-weight:700;color:${T.texte};background:transparent;` +
        `border:1px solid ${couleur};border-radius:${T.rayonPetit};`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        surClic();
      });
      return b;
    };
    bulle.append(
      textes,
      bouton('carte-suivre', suivi ? 'Ne plus suivre' : 'Suivre', () => actions?.suivre(suivi ? null : r.id), suivi ? T.accent : T.filetCase),
      bouton(
        'carte-retirer',
        'Retirer',
        () => {
          ouvert = null;
          actions?.retirer(r.id);
        },
        T.filetCase,
      ),
    );
    return { bulle, distance };
  }

  /** Refait les pastilles, le menu et le bloc quand quelque chose a changé (et non à chaque image : un clic doit rester sur le même élément). */
  function reconstruire(d: DonneesGrande): void {
    couche.replaceChildren();
    pastilles = [];
    if (ouvert !== null && !d.reperes.some((r) => r.id === ouvert)) ouvert = null;
    if (d.posable) {
      for (const r of d.reperes) {
        const couleur = COULEURS_REPERES[r.type];
        const estSuivi = d.suivi === r.id;
        const estOuvert = ouvert === r.id;
        const el = document.createElement('div');
        el.dataset.role = 'carte-repere';
        el.dataset.id = String(r.id);
        el.dataset.type = r.type;
        el.style.cssText = `position:absolute;width:${PASTILLE}px;height:${HAUTEUR_REPERE}px;cursor:pointer;pointer-events:auto;z-index:${estOuvert ? 5 : 1};`;
        const rond = document.createElement('div');
        rond.style.cssText =
          `width:${PASTILLE}px;height:${PASTILLE}px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border-radius:50%;` +
          `background:rgba(16,19,24,0.92);border:3px solid ${couleur};box-shadow:0 0 0 1px #14181E,0 4px 10px rgba(0,0,0,0.4)` +
          `${estSuivi ? `,0 0 0 4px ${T.accent}` : ''}${estOuvert ? ',0 0 0 5px rgba(255,255,255,0.25)' : ''};`;
        rond.innerHTML = icone(r.type, couleur, 24);
        const pointe = document.createElement('div');
        pointe.innerHTML = `<svg width="14" height="9" viewBox="0 0 14 9" aria-hidden="true" style="display:block"><polygon points="0,0 14,0 7,9" fill="${couleur}"/></svg>`;
        pointe.style.cssText = `position:absolute;left:${PASTILLE / 2 - 7}px;top:${PASTILLE - 1}px;pointer-events:none;`;
        el.append(rond, pointe);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          ouvert = ouvert === r.id ? null : r.id;
          signature = '';
          if (derniere) mettreAJour(derniere);
        });
        let bulle: HTMLElement | null = null;
        let distance: HTMLElement | null = null;
        if (estOuvert) {
          ({ bulle, distance } = creerBulle(r, estSuivi));
          el.appendChild(bulle);
        }
        couche.appendChild(el);
        pastilles.push({ repere: r, element: el, bulle, distance });
      }
    }
    // Menu : types (seulement quand on peut poser), repère choisi, village
    menu.style.display = 'flex';
    groupeTypes.style.display = d.posable ? 'flex' : 'none';
    boutonVillage.style.display = d.posable ? 'flex' : 'none';
    bloc.style.display = d.posable ? 'flex' : 'none';
    for (const [type, b] of boutonsTypes) {
      const actif = type === typeChoisi;
      b.style.background = actif ? 'rgba(255,255,255,0.08)' : T.fondCase;
      b.style.border = actif ? `2px solid ${COULEURS_REPERES[type]}` : `1px solid ${T.filetCase}`;
    }
    const village = d.suivi === 'village';
    boutonVillage.style.border = village ? `2px solid ${T.accent}` : `1px solid ${T.filetCase}`;
    boutonVillage.title = village ? 'Ne plus suivre le village' : 'Suivre le village';
    blocNom.textContent = NOMS_TYPES_REPERE[typeChoisi];
    blocNom.style.color = COULEURS_REPERES[typeChoisi];
    blocCompte.textContent = `${d.reperes.length} / ${MAX_REPERES} posés`;
    valeurZoom.textContent = `×${zoom.toFixed(1)}`;
  }

  function mettreAJour(d: DonneesGrande): void {
    derniere = d;
    const taille = `${d.diametre}px`;
    if (disque.style.width !== taille) {
      disque.style.width = taille;
      disque.style.height = taille;
      cadre.style.width = `${d.diametre + 2 * BANDE}px`;
      cadre.style.height = `${d.diametre + 2 * BANDE}px`;
    }
    const sig = `${d.reperes.map((r) => `${r.id}${r.type}`).join(',')}|${d.suivi}|${ouvert}|${typeChoisi}|${d.posable}|${zoom}`;
    if (sig !== signature) {
      signature = sig;
      reconstruire(d);
    }
    // Position des pastilles : à chaque image (le joueur bouge), taille constante quel que soit le zoom
    const R = d.diametre / 2;
    for (const p of pastilles) {
      const m = projeter(p.repere.x - d.x, p.repere.z - d.z, CAP_NORD);
      const sx = R + (m.x / d.rayon) * R;
      const sy = R + (m.y / d.rayon) * R;
      const dedans = Math.hypot(sx - R, sy - R) <= R * 0.97;
      p.element.style.display = dedans ? 'block' : 'none';
      p.element.style.left = `${Math.round(sx - PASTILLE / 2)}px`;
      p.element.style.top = `${Math.round(sy - HAUTEUR_REPERE)}px`;
      if (p.bulle && p.distance) {
        const texte = texteDistance(Math.hypot(p.repere.x - d.x, p.repere.z - d.z));
        if (p.distance.textContent !== texte) p.distance.textContent = texte;
        // La bulle s'ouvre sous le repère (au-dessus dans la moitié basse) et reste dans le disque
        const b = p.bulle.style;
        const bas = sy > R;
        b.top = bas ? '' : `${HAUTEUR_REPERE + 4}px`;
        b.bottom = bas ? `${HAUTEUR_REPERE + 4}px` : '';
        const gauche = sx < d.diametre * 0.3;
        const droite = sx > d.diametre * 0.7;
        b.left = gauche ? '0' : droite ? '' : '50%';
        b.right = droite ? '0' : '';
        b.transform = gauche || droite ? '' : 'translateX(-50%)';
      }
    }
  }

  return {
    get zoom() {
      return zoom;
    },
    disque,
    brancher(a) {
      actions = a;
    },
    afficher(visible) {
      voile.style.display = visible ? 'block' : 'none';
      if (!visible) {
        ouvert = null;
        signature = '';
      }
    },
    mettreAJour,
  };
}
