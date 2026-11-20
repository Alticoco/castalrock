// Interface du combat : barre de vie du joueur (en bas, au centre), petites barres de vie au-dessus
// des ennemis touchés, chiffres de dégâts flottants, voile rouge quand le joueur est touché,
// et écran « Vous êtes tombé… ».

import { CONFIG } from '../config';
import { SUR_DECOR, T, TITRE, jaugeLarge, ligneVitaux } from './theme';

export interface BarreEnnemi {
  id: string;
  /** Position à l'écran, en pixels */
  x: number;
  y: number;
  /** Vie restante, de 0 à 1 */
  ratio: number;
}

export interface InterfaceCombat {
  /** Barre de vie du joueur et nombre de potions portées. */
  /** `barriere` : part restante de la barrière magique (0 à 1 ; 0 : pas de barrière), montrée par une fine barre bleue. */
  afficherVie(pv: number, max: number, potions: number, barriere?: number): void;
  /** Chiffre flottant à cette position de l'écran (pixels). */
  chiffre(x: number, y: number, texte: string, couleur?: string): void;
  /** Barres de vie des ennemis à afficher pour cette image (les autres disparaissent). */
  afficherBarres(barres: readonly BarreEnnemi[]): void;
  /** Voile rouge bref sur les bords de l'écran. */
  toucher(): void;
  /** Affiche ou masque l'écran « Vous êtes tombé… ». */
  montrerChute(visible: boolean): void;
}

const OMBRE = 'text-shadow:0 1px 3px rgba(0,0,0,0.75);';
const POLICE = 'font-family:system-ui,sans-serif;';

export function creerInterfaceCombat(racine: HTMLElement): InterfaceCombat {
  // Barre de vie du joueur : à gauche de la ligne « vie, sorts, mana » (colonne du bas, voir theme.ts)
  const bloc = document.createElement('div');
  bloc.dataset.role = 'barre-vie';
  bloc.style.cssText = `position:relative;order:1;flex-shrink:0;${SUR_DECOR}`;
  const { cadre, remplissage: jauge, valeur: texteVie } = jaugeLarge(T.vie, 'Vie');
  // Potions portées : petit texte discret sous la vie
  const textePotions = document.createElement('span');
  textePotions.style.cssText =
    `position:absolute;left:9px;top:calc(100% + 2px);white-space:nowrap;font-size:11px;font-weight:700;color:${T.doux};opacity:0.95;`;
  // Barrière magique : fine barre bleue au-dessus de la vie, visible seulement quand elle est active
  const cadreBarriere = document.createElement('div');
  cadreBarriere.dataset.role = 'barre-barriere';
  cadreBarriere.style.cssText =
    `position:absolute;left:6px;right:6px;top:-6px;height:3px;border-radius:2px;background:${T.fondJauge};overflow:hidden;` +
    `box-shadow:0 0 0 1px rgba(140,195,255,0.7),0 0 6px rgba(90,160,255,0.7);display:none;`;
  const jaugeBarriere = document.createElement('div');
  jaugeBarriere.style.cssText = `height:100%;width:100%;background:${T.accent};transition:width 0.18s;`;
  cadreBarriere.appendChild(jaugeBarriere);
  bloc.append(cadreBarriere, cadre, textePotions);
  ligneVitaux(racine).appendChild(bloc);

  // Barres des ennemis et chiffres flottants
  const calque = document.createElement('div');
  calque.style.cssText = 'position:absolute;inset:0;overflow:hidden;';

  // Voile rouge (joueur touché)
  const voile = document.createElement('div');
  voile.style.cssText = 'position:absolute;inset:0;box-shadow:inset 0 0 140px rgba(210,40,30,0.75);opacity:0;';

  // Écran de chute
  const chute = document.createElement('div');
  chute.style.cssText =
    `position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;` +
    `background:radial-gradient(circle at 50% 50%,rgba(16,19,24,0.80) 0px,rgba(8,10,14,0.94) 520px);font-family:${T.corps};color:${T.texte};` +
    `opacity:0;transition:opacity 0.5s;z-index:40;pointer-events:none;backdrop-filter:${T.flou};-webkit-backdrop-filter:${T.flou};`;
  chute.innerHTML =
    `<div style="${TITRE}font-size:40px;font-weight:700;letter-spacing:0.05em;color:${T.or};text-shadow:${T.ombreTexte}">Vous êtes tombé…</div>` +
    `<div style="width:120px;height:1px;background:${T.filet};margin:4px 0"></div>` +
    `<div style="font-size:19px;color:${T.doux}">Vous reprenez vos esprits au village.</div>`;

  racine.append(calque, voile, chute);

  const barres = new Map<string, { element: HTMLElement; jauge: HTMLElement }>();
  let dernierEtat = '';

  return {
    afficherVie(pv, max, potions, barriere = 0) {
      const points = Math.ceil(pv);
      const etat = `${points}/${max}/${potions}/${Math.ceil(barriere * 100)}`;
      if (etat === dernierEtat) return;
      dernierEtat = etat;
      cadreBarriere.style.display = barriere > 0 ? 'block' : 'none';
      jaugeBarriere.style.width = `${Math.max(0, Math.min(1, barriere)) * 100}%`;
      const ratio = Math.max(0, Math.min(1, pv / max));
      jauge.style.width = `${ratio * 100}%`;
      texteVie.textContent = `${points} / ${max}`;
      textePotions.textContent = potions > 0 ? `R · potion ×${potions}` : '';
    },

    chiffre(x, y, texte, couleur = '#fff') {
      const element = document.createElement('div');
      element.textContent = texte;
      element.style.cssText =
        `position:absolute;left:${x}px;top:${y}px;white-space:nowrap;${POLICE}font-size:17px;font-weight:700;` +
        `color:${couleur};${OMBRE}`;
      calque.appendChild(element);
      const derive = (Math.random() - 0.5) * 30;
      const animation = element.animate(
        [
          { transform: 'translate(-50%, -50%) scale(1.25)', opacity: 1 },
          { transform: `translate(calc(-50% + ${derive}px), calc(-50% - 46px)) scale(0.9)`, opacity: 0 },
        ],
        { duration: CONFIG.combat.dureeChiffreMs, easing: 'ease-out' },
      );
      animation.onfinish = () => element.remove();
    },

    afficherBarres(liste) {
      const vus = new Set<string>();
      for (const b of liste) {
        vus.add(b.id);
        let barre = barres.get(b.id);
        if (!barre) {
          const element = document.createElement('div');
          element.style.cssText =
            'position:absolute;left:0;top:0;width:46px;height:5px;margin:-3px 0 0 -23px;border-radius:3px;' +
            'background:rgba(20,20,24,0.6);overflow:hidden;box-shadow:0 0 0 1px rgba(0,0,0,0.35);';
          const j = document.createElement('div');
          j.style.cssText = 'height:100%;background:#e0584a;transition:width 0.15s;';
          element.appendChild(j);
          calque.appendChild(element);
          barre = { element, jauge: j };
          barres.set(b.id, barre);
        }
        barre.element.style.transform = `translate(${Math.round(b.x)}px, ${Math.round(b.y)}px)`;
        barre.jauge.style.width = `${Math.max(0, Math.min(1, b.ratio)) * 100}%`;
      }
      for (const [id, barre] of barres) {
        if (vus.has(id)) continue;
        barre.element.remove();
        barres.delete(id);
      }
    },

    toucher() {
      voile.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, easing: 'ease-out' });
    },

    montrerChute(visible) {
      chute.style.opacity = visible ? '1' : '0';
    },
  };
}
