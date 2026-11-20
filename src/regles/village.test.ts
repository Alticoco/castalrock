import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { repousserHorsRectangle } from './deplacement';
import {
  ANGLES_SORTIES,
  APPARITION,
  RAYON_VILLAGE,
  decrireVillage,
  interactionVisee,
  MAISON_JOUEUR,
  interactionsVillage,
  pointPotagerMaison,
  pointPuits,
  niveauSuivant,
  obstaclesElement,
  obstaclesVillage,
  pointLocal,
  porteMaisonJoueur,
  type ElementVillage,
  type NiveauVillage,
  type TypeElementVillage,
} from './village';

const NIVEAUX: NiveauVillage[] = [1, 2, 3];
const RAYON_PERSO = CONFIG.personnage.rayon;

const compter = (niveau: NiveauVillage, ...types: TypeElementVillage[]) =>
  decrireVillage(niveau).elements.filter((e) => types.includes(e.type)).length;

/** Rayon du cercle qui entoure l'emprise d'un élément. */
const rayonEnglobant = (e: ElementVillage) => Math.hypot(e.demiLargeur, e.demiProfondeur);

/** Vrai si un cercle (x, z, rayon) touche un obstacle du village. */
function touche(niveau: NiveauVillage, x: number, z: number, rayon: number): boolean {
  const o = obstaclesVillage(niveau);
  return (
    o.cercles.some((c) => Math.hypot(c.x - x, c.z - z) < c.rayon + rayon) ||
    o.rectangles.some((r) => repousserHorsRectangle(x, z, rayon, r) !== null)
  );
}

describe('village', () => {
  it('contient ce que le cahier des charges prévoit à chaque niveau', () => {
    expect(compter(1, 'maison-chaume', 'maison-tuiles', 'maison-joueur')).toBe(2);
    for (const n of NIVEAUX) expect(compter(n, 'maison-joueur')).toBe(1);
    for (const type of ['forge', 'forgeron', 'coffre', 'etabli', 'puits', 'feu-camp'] as const) {
      for (const n of NIVEAUX) expect(compter(n, type)).toBe(1);
    }
    expect(compter(1, 'auberge', 'cloture', 'muret', 'potager', 'tour-guet')).toBe(0);
    expect(decrireVillage(1).chemins.length).toBeGreaterThanOrEqual(3);

    expect(compter(2, 'maison-chaume', 'maison-tuiles', 'maison-joueur')).toBe(3);
    expect(compter(2, 'auberge')).toBe(1);
    expect(compter(2, 'potager')).toBe(1);
    expect(compter(2, 'cloture')).toBeGreaterThan(20);

    expect(compter(3, 'maison-chaume', 'maison-tuiles', 'maison-joueur')).toBe(5);
    expect(compter(3, 'tour-guet')).toBe(1);
    expect(compter(3, 'muret')).toBeGreaterThan(20);
    expect(decrireVillage(3).revetement).toBe('paves');
    expect(decrireVillage(1).revetement).toBe('terre');
    expect(compter(3, 'lanterne')).toBeGreaterThan(compter(2, 'lanterne'));
    expect(compter(2, 'lanterne')).toBeGreaterThan(compter(1, 'lanterne'));
  });

  it('garde les éléments des niveaux précédents à la même place', () => {
    const cle = (e: ElementVillage) => `${e.id}:${e.type}:${e.x.toFixed(3)}:${e.z.toFixed(3)}`;
    const n1 = decrireVillage(1).elements.map(cle);
    const n2 = decrireVillage(2).elements.map(cle);
    const n3 = decrireVillage(3).elements.map(cle);
    for (const c of n1) expect(n2).toContain(c);
    // Du niveau 2 au 3, seule l'enceinte change de nature (clôture -> muret)
    for (const c of n2.filter((c) => !c.includes('enceinte'))) expect(n3).toContain(c);
  });

  it('a des identifiants uniques et tient dans le disque aplani', () => {
    for (const n of NIVEAUX) {
      const d = decrireVillage(n);
      expect(new Set(d.elements.map((e) => e.id)).size).toBe(d.elements.length);
      for (const e of d.elements) {
        expect(Math.hypot(e.x, e.z) + rayonEnglobant(e)).toBeLessThanOrEqual(CONFIG.monde.village.rayon);
      }
      for (const c of d.chemins) {
        expect(Math.hypot(c.x1, c.z1)).toBeLessThanOrEqual(RAYON_VILLAGE + 1e-9);
        expect(Math.hypot(c.x2, c.z2)).toBeLessThanOrEqual(RAYON_VILLAGE + 1e-9);
      }
    }
  });

  it('ne superpose aucun bâtiment ni objet (hors forgeron, qui est sous le toit de la forge)', () => {
    for (const n of NIVEAUX) {
      const elements = decrireVillage(n).elements.filter((e) => e.type !== 'forgeron');
      for (let i = 0; i < elements.length; i++) {
        for (let j = i + 1; j < elements.length; j++) {
          const a = elements[i];
          const b = elements[j];
          // Deux tronçons voisins de l'enceinte se touchent par construction
          if (a.id.startsWith('enceinte') && b.id.startsWith('enceinte')) continue;
          const ecart = Math.hypot(a.x - b.x, a.z - b.z) - rayonEnglobant(a) - rayonEnglobant(b);
          expect(ecart, `${a.id} / ${b.id} au niveau ${n}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('laisse trois passages larges vers l\'extérieur', () => {
    for (const n of NIVEAUX) {
      for (const angle of ANGLES_SORTIES) {
        const sx = Math.sin((angle * Math.PI) / 180);
        const sz = Math.cos((angle * Math.PI) / 180);
        // Couloir de 4 m de large, du bord de la place jusqu'au bord du village
        for (let r = 9.5; r <= 40; r += 0.5) {
          for (const cote of [-1.65, 0, 1.65]) {
            const x = sx * r + sz * cote;
            const z = sz * r - sx * cote;
            expect(touche(n, x, z, RAYON_PERSO), `sortie ${angle}°, r=${r}, niveau ${n}`).toBe(false);
          }
        }
      }
    }
  });

  it('fait apparaître le personnage sur la place, loin de tout obstacle', () => {
    for (const n of NIVEAUX) {
      expect(touche(n, APPARITION.x, APPARITION.z, RAYON_PERSO + 1)).toBe(false);
      const place = decrireVillage(n).place;
      expect(Math.hypot(APPARITION.x - place.x, APPARITION.z - place.z)).toBeLessThan(place.rayon);
    }
  });

  it('laisse la porte de chaque bâtiment accessible', () => {
    for (const n of NIVEAUX) {
      for (const e of decrireVillage(n).elements) {
        if (!['maison-chaume', 'maison-tuiles', 'maison-joueur', 'auberge'].includes(e.type)) continue;
        const devant = pointLocal(e, e.type === 'maison-joueur' ? MAISON_JOUEUR.porteX : 0, e.demiProfondeur + 1);
        expect(touche(n, devant.x, devant.z, RAYON_PERSO), `${e.id} au niveau ${n}`).toBe(false);
        // La façade regarde le centre
        expect(Math.hypot(devant.x, devant.z)).toBeLessThan(Math.hypot(e.x, e.z));
      }
    }
  });

  it('convertit le repère local : la façade suit (sin, cos) de l\'orientation', () => {
    const e = { x: 10, z: 5, orientation: Math.PI / 2 };
    const p = pointLocal(e, 0, 2);
    expect(p.x).toBeCloseTo(12);
    expect(p.z).toBeCloseTo(5);
    const q = pointLocal({ x: 0, z: 0, orientation: 0 }, 1, 2);
    expect(q).toEqual({ x: 1, z: 2 });
  });

  it('donne à la forge un intérieur ouvert, avec l\'enclume et le forgeron devant le foyer', () => {
    const d = decrireVillage(1);
    const forge = d.elements.find((e) => e.type === 'forge')!;
    const forgeron = d.elements.find((e) => e.type === 'forgeron')!;
    const o = obstaclesElement(forge);
    expect(o.rectangles.length).toBeGreaterThan(0);
    // Un point à l'entrée de la forge reste libre
    const entree = pointLocal(forge, -1.5, 2.2);
    expect(touche(1, entree.x, entree.z, RAYON_PERSO)).toBe(false);
    // Le forgeron est sous le toit et regarde l'enclume
    const enclume = o.cercles[o.cercles.length - 1];
    const distance = Math.hypot(enclume.x - forgeron.x, enclume.z - forgeron.z);
    expect(distance).toBeGreaterThan(0.7);
    expect(distance).toBeLessThan(1.3);
    expect(Math.sin(forgeron.orientation) * (enclume.x - forgeron.x) + Math.cos(forgeron.orientation) * (enclume.z - forgeron.z)).toBeCloseTo(distance);
  });

  it('passe au niveau suivant en boucle', () => {
    expect(niveauSuivant(1)).toBe(2);
    expect(niveauSuivant(2)).toBe(3);
    expect(niveauSuivant(3)).toBe(1);
  });
});

describe('interactions du village', () => {
  const points = interactionsVillage(1);
  const coffre = points.find((p) => p.type === 'coffre')!;
  const portee = CONFIG.village.porteeInteraction;
  const angle = (CONFIG.village.angleRegardDegres * Math.PI) / 180;

  it("propose le coffre, l'établi, le forgeron, le panneau, le feu de la place (cuisine) et la porte de la maison du joueur à tous les niveaux", () => {
    expect(interactionsVillage(1).map((p) => p.type).sort()).toEqual(['cheminee', 'coffre', 'etabli', 'forgeron', 'maison', 'panneau']);
    expect(coffre.invite).toBe('ouvrir le coffre');
  });

  it("ajoute le repos et un second accès au coffre à l'auberge, dès le niveau 2", () => {
    for (const n of [2, 3] as const) {
      const types = interactionsVillage(n).map((p) => p.type).sort();
      expect(types).toEqual(['auberge', 'cheminee', 'coffre', 'coffre', 'etabli', 'forgeron', 'maison', 'panneau']);
    }
  });

  it('fait entrer dans la maison du joueur par sa porte, et en ressortir devant, à un endroit libre', () => {
    for (const n of NIVEAUX) {
      const maison = decrireVillage(n).elements.find((e) => e.type === 'maison-joueur')!;
      const porte = interactionsVillage(n).find((p) => p.type === 'maison')!;
      expect(porte.invite).toBe('entrer chez vous');
      // Le point d'interaction est sur la façade, à la porte
      const surFacade = pointLocal(maison, MAISON_JOUEUR.porteX, maison.demiProfondeur);
      expect(Math.hypot(porte.x - surFacade.x, porte.z - surFacade.z)).toBeLessThan(0.3);
      // La sortie : devant la porte, hors de tout obstacle, dos à la maison, à portée de la porte pour rentrer
      const sortie = porteMaisonJoueur(n, CONFIG.maison.distanceSortie)!;
      expect(touche(n, sortie.x, sortie.z, RAYON_PERSO)).toBe(false);
      expect(sortie.orientation).toBe(maison.orientation);
      expect(Math.hypot(sortie.x, sortie.z)).toBeLessThan(Math.hypot(maison.x, maison.z));
      expect(interactionVisee([porte], sortie.x, sortie.z, sortie.orientation + Math.PI, portee, angle)).toBe(porte);
    }
  });

  it('entoure la maison du joueur de son potager et de son tas de bûches, comme obstacles', () => {
    const maison = decrireVillage(1).elements.find((e) => e.type === 'maison-joueur')!;
    const o = obstaclesElement(maison);
    expect(o.rectangles).toHaveLength(3);
    for (const zone of [MAISON_JOUEUR.potager, MAISON_JOUEUR.buches]) {
      const centre = pointLocal(maison, zone.x, zone.z);
      expect(touche(1, centre.x, centre.z, RAYON_PERSO)).toBe(true);
    }
  });

  it('demande d\'être assez près et de regarder l\'objet', () => {
    // À 2 m au sud du coffre, en le regardant (vers -z : lacet pi)
    expect(interactionVisee(points, coffre.x, coffre.z + 2, Math.PI, portee, angle)?.type).toBe('coffre');
    // Dos tourné
    expect(interactionVisee(points, coffre.x, coffre.z + 2, 0, portee, angle)).toBeNull();
    // Trop loin
    expect(interactionVisee(points, coffre.x, coffre.z + 3.5, Math.PI, portee, angle)).toBeNull();
  });

  it('choisit l\'objet le mieux centré quand deux sont à portée', () => {
    const deux = [
      { type: 'coffre' as const, x: 1, z: 2, rayon: 0.4, invite: 'a' },
      { type: 'etabli' as const, x: -0.2, z: 2, rayon: 0.4, invite: 'b' },
    ];
    expect(interactionVisee(deux, 0, 0, 0, portee, angle)?.type).toBe('etabli');
    expect(interactionVisee(deux, 0, 0, 0.5, portee, angle)?.type).toBe('coffre');
  });

  it('chaque point d\'interaction peut être approché à portée sans entrer dans un obstacle', () => {
    for (const n of NIVEAUX) {
      for (const p of interactionsVillage(n)) {
        let accessible = false;
        for (let a = 0; a < Math.PI * 2 && !accessible; a += Math.PI / 12) {
          const x = p.x + Math.sin(a) * (p.rayon + 1.2);
          const z = p.z + Math.cos(a) * (p.rayon + 1.2);
          accessible = !touche(n, x, z, RAYON_PERSO);
        }
        expect(accessible, `${p.type} au niveau ${n}`).toBe(true);
      }
    }
  });
});

describe('village : puits et potager de la maison', () => {
  it("le puits et le potager sont des points d'interaction à chaque niveau", () => {
    for (const n of [1, 2, 3] as const) {
      expect(pointPuits(n)?.type).toBe('puits');
      const potager = pointPotagerMaison(n);
      expect(potager?.type).toBe('potager');
      const maison = decrireVillage(n).elements.find((el) => el.type === 'maison-joueur')!;
      expect(Math.hypot(potager!.x - maison.x, potager!.z - maison.z)).toBeLessThan(6);
    }
  });
});
