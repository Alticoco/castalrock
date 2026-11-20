// Entrées du joueur : clavier, souris, molette.
// Les touches sont lues par position physique (event.code) : ZQSD en AZERTY = KeyW/A/S/D.
// Souris : mouvements relatifs, le pointeur est verrouillé en jeu (hors menus et écrans).

import { creerFiltreSouris, sensibilite } from './reglages';

export interface Entrees {
  /** Vrai si l'une des touches est enfoncée */
  appuye(...codes: string[]): boolean;
  /** Vrai seulement pendant l'image où la touche vient d'être enfoncée */
  vientDAppuyer(code: string): boolean;
  /** ZQSD ou flèches : avant (+1) / arrière (-1), droite (+1) / gauche (-1) */
  axes(): { avant: number; cote: number };
  readonly courir: boolean;
  readonly sauter: boolean;
  /** Clic gauche maintenu */
  readonly clicGauche: boolean;
  /** Vrai seulement pendant l'image où le clic gauche vient d'être enfoncé (un clic qui reverrouille la souris ne compte pas) */
  readonly clicGaucheDebut: boolean;
  /** Un clic qui vient de servir à fermer quelque chose ne compte pas aussi comme une frappe dans la même image */
  consommerClic(): void;
  /** Vrai seulement pendant l'image où le clic droit vient d'être enfoncé */
  readonly clicDroit: boolean;
  /** Clic droit maintenu (bouclier) */
  readonly clicDroitMaintenu: boolean;
  /** Mouvement de la souris depuis la dernière image, en pixels (pointeur verrouillé seulement) */
  readonly dx: number;
  readonly dy: number;
  /** Crans de molette depuis la dernière image (positif = vers soi) */
  readonly molette: number;
  readonly pointeurVerrouille: boolean;
  /** Indique si le pointeur doit être verrouillé (faux : il est libéré, pour les menus et écrans) */
  definirVerrouillage(voulu: boolean): void;
  /** Redemande le verrouillage du pointeur s'il est voulu (à appeler depuis un geste du joueur : clic, touche). */
  verrouiller(): void;
  /** À appeler à la fin de chaque image : remet à zéro les mouvements accumulés */
  finImage(): void;
  liberer(): void;
}

export function creerEntrees(element: HTMLElement): Entrees {
  const touches = new Set<string>();
  const nouvelles = new Set<string>();
  let clicGauche = false;
  let clicGaucheDebut = false;
  let clicDroit = false;
  let clicDroitMaintenu = false;
  let dx = 0;
  let dy = 0;
  let molette = 0;
  let verrouillageVoulu = false;
  const filtreSouris = creerFiltreSouris();

  const estVerrouille = () => document.pointerLockElement === element;

  function demanderVerrouillage(): void {
    if (estVerrouille()) return;
    try {
      // Mouvement brut de la souris (sans l'accélération de Windows) quand le navigateur le permet ;
      // selon le navigateur : renvoie une promesse ou rien ; un refus n'est pas grave
      const verrouiller = element.requestPointerLock as (options?: { unadjustedMovement?: boolean }) => unknown;
      const promesse = verrouiller.call(element, { unadjustedMovement: true });
      if (promesse instanceof Promise) {
        // Mouvement brut refusé (non pris en charge) : verrouillage ordinaire
        promesse.catch(() => {
          try {
            const p = element.requestPointerLock() as unknown;
            if (p instanceof Promise) p.catch(() => {});
          } catch {
            // Un nouveau clic réessaiera
          }
        });
      }
    } catch {
      // Refus du navigateur (par exemple juste après Échap) : un nouveau clic réessaiera
    }
  }

  const auClavierBas = (e: KeyboardEvent) => {
    if (!e.repeat) nouvelles.add(e.code);
    touches.add(e.code);
    // Pas de défilement de la page, et Tab (inventaire) ne déplace pas le focus du navigateur
    if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
  };
  const auClavierHaut = (e: KeyboardEvent) => touches.delete(e.code);
  const auPerteFocus = () => {
    touches.clear();
    clicGauche = false;
    clicDroitMaintenu = false;
  };
  const auClicBas = (e: MouseEvent) => {
    if (e.button === 2) {
      clicDroit = true;
      clicDroitMaintenu = true;
    }
    if (e.button !== 0) return;
    // Le clic qui (re)verrouille la souris ne compte pas comme une frappe
    if (verrouillageVoulu && !estVerrouille()) {
      demanderVerrouillage();
      return;
    }
    clicGauche = true;
    clicGaucheDebut = true;
  };
  const auClicHaut = (e: MouseEvent) => {
    if (e.button === 0) clicGauche = false;
    if (e.button === 2) clicDroitMaintenu = false;
  };
  const auMouvement = (e: MouseEvent) => {
    if (estVerrouille()) {
      // Saut faux envoyé par le navigateur (voir CONFIG.cameras.sautSourisMax) : ignoré
      if (!filtreSouris.accepter(e.movementX, e.movementY)) return;
      const s = sensibilite();
      dx += e.movementX * s;
      dy += e.movementY * s;
    }
  };
  const aLaMolette = (e: WheelEvent) => {
    molette += Math.sign(e.deltaY);
    e.preventDefault();
  };
  const auMenu = (e: Event) => e.preventDefault();

  window.addEventListener('keydown', auClavierBas);
  window.addEventListener('keyup', auClavierHaut);
  window.addEventListener('blur', auPerteFocus);
  element.addEventListener('mousedown', auClicBas);
  window.addEventListener('mouseup', auClicHaut);
  window.addEventListener('mousemove', auMouvement);
  element.addEventListener('wheel', aLaMolette, { passive: false });
  element.addEventListener('contextmenu', auMenu);

  const appuye = (...codes: string[]) => codes.some((c) => touches.has(c));

  return {
    appuye,
    vientDAppuyer: (code) => nouvelles.has(code),
    axes() {
      let avant = 0;
      let cote = 0;
      if (appuye('KeyW', 'ArrowUp')) avant += 1;
      if (appuye('KeyS', 'ArrowDown')) avant -= 1;
      if (appuye('KeyD', 'ArrowRight')) cote += 1;
      if (appuye('KeyA', 'ArrowLeft')) cote -= 1;
      return { avant, cote };
    },
    get courir() {
      return appuye('ShiftLeft', 'ShiftRight');
    },
    get sauter() {
      return appuye('Space');
    },
    get clicGauche() {
      return clicGauche;
    },
    get clicGaucheDebut() {
      return clicGaucheDebut;
    },
    consommerClic() {
      clicGauche = false;
      clicGaucheDebut = false;
    },
    get clicDroit() {
      return clicDroit;
    },
    get clicDroitMaintenu() {
      return clicDroitMaintenu;
    },
    get dx() {
      return dx;
    },
    get dy() {
      return dy;
    },
    get molette() {
      return molette;
    },
    get pointeurVerrouille() {
      return estVerrouille();
    },
    definirVerrouillage(voulu) {
      verrouillageVoulu = voulu;
      if (!voulu && estVerrouille()) document.exitPointerLock();
    },
    verrouiller() {
      if (verrouillageVoulu) demanderVerrouillage();
    },
    finImage() {
      nouvelles.clear();
      clicGaucheDebut = false;
      clicDroit = false;
      dx = 0;
      dy = 0;
      molette = 0;
    },
    liberer() {
      window.removeEventListener('keydown', auClavierBas);
      window.removeEventListener('keyup', auClavierHaut);
      window.removeEventListener('blur', auPerteFocus);
      element.removeEventListener('mousedown', auClicBas);
      window.removeEventListener('mouseup', auClicHaut);
      window.removeEventListener('mousemove', auMouvement);
      element.removeEventListener('wheel', aLaMolette);
      element.removeEventListener('contextmenu', auMenu);
    },
  };
}
