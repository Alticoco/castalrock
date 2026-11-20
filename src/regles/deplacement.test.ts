import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import {
  creerEtatPersonnage,
  pasDeDeplacement,
  repousserHorsRectangle,
  vitesseHorizontale,
  type EntreeDeplacement,
  type EtatPersonnage,
  type MondeDeplacement,
  type ObstacleCercle,
  type ObstacleRectangle,
} from './deplacement';
import { creerEtatFrappe, gesteFrappe, pasDeFrappe } from './frappe';

const P = CONFIG.personnage;
const DT = 1 / 60;

function monde(
  hauteur: (x: number, z: number) => number,
  niveauEau = -100,
  obstacles: ObstacleCercle[] = [],
): MondeDeplacement {
  return { hauteur, niveauEau, obstacles };
}

const entree = (x: number, z: number, extra: Partial<EntreeDeplacement> = {}): EntreeDeplacement => ({
  x,
  z,
  courir: false,
  sauter: false,
  ...extra,
});

/** Avance pendant `secondes` ; `aChaquePas` permet de vérifier une propriété en continu. */
function avancer(
  etat: EtatPersonnage,
  e: EntreeDeplacement,
  secondes: number,
  m: MondeDeplacement,
  aChaquePas?: (etat: EtatPersonnage) => void,
): EtatPersonnage {
  for (let i = 0; i < Math.round(secondes / DT); i++) {
    etat = pasDeDeplacement(etat, e, DT, m);
    aChaquePas?.(etat);
  }
  return etat;
}

describe('pasDeDeplacement', () => {
  it('démarre en douceur puis atteint la vitesse de marche, et la course est plus rapide', () => {
    const plat = monde(() => 0);
    let etat = pasDeDeplacement(creerEtatPersonnage(0, 0, 0), entree(1, 0), DT, plat);
    expect(vitesseHorizontale(etat)).toBeLessThan(1);
    etat = avancer(etat, entree(1, 0), 2, plat);
    expect(vitesseHorizontale(etat)).toBeCloseTo(P.vitesseMarche, 5);
    etat = avancer(etat, entree(1, 0, { courir: true }), 2, plat);
    expect(vitesseHorizontale(etat)).toBeCloseTo(P.vitesseCourse, 5);
    // Freinage progressif : pas d'arrêt net
    etat = pasDeDeplacement(etat, entree(0, 0), DT, plat);
    expect(vitesseHorizontale(etat)).toBeGreaterThan(P.vitesseCourse - 1);
    etat = avancer(etat, entree(0, 0), 2, plat);
    expect(vitesseHorizontale(etat)).toBe(0);
  });

  it('suit le sol en montée comme en descente, sans décoller sur les bosses', () => {
    const h = (x: number) => 0.5 * Math.sin(x * 0.8) + 2 * Math.sin(x * 0.1);
    const bosses = monde(h);
    const fin = avancer(creerEtatPersonnage(0, h(0), 0), entree(1, 0, { courir: true }), 10, bosses, (e) => {
      expect(e.auSol).toBe(true);
      expect(e.y).toBeCloseTo(h(e.x), 9);
    });
    expect(fin.x).toBeGreaterThan(60);
  });

  it('monte une pente douce', () => {
    const h = (x: number) => 0.5 * Math.max(0, x); // environ 27°
    const fin = avancer(creerEtatPersonnage(-1, 0, 0), entree(1, 0), 5, monde(h));
    expect(fin.x).toBeGreaterThan(15);
    expect(fin.y).toBeCloseTo(h(fin.x), 9);
    expect(fin.auSol).toBe(true);
  });

  it('ne monte pas une marche de falaise', () => {
    // Sol plat, puis mur à environ 72° à partir de x = 10, haut de 12 m
    const h = (x: number) => Math.min(12, Math.max(0, (x - 10) * 3));
    const falaise = monde(h);
    let fin = avancer(creerEtatPersonnage(0, 0, 0), entree(1, 0, { courir: true }), 5, falaise);
    expect(fin.x).toBeLessThan(10.5);
    expect(fin.y).toBeLessThan(1);
    // Même en sautant contre la paroi
    fin = avancer(fin, entree(1, 0, { courir: true, sauter: true }), 5, falaise);
    expect(fin.x).toBeLessThan(10.6);
    // On peut la longer
    const avant = fin.z;
    fin = avancer(fin, entree(0.7, 0.7), 2, falaise);
    expect(fin.z - avant).toBeGreaterThan(3);
    expect(fin.x).toBeLessThan(10.6);
  });

  it('glisse vers le bas sur une pente trop raide et tombe du bord d’une falaise', () => {
    const raide = monde((x) => -2 * x); // environ 63°
    const fin = avancer(creerEtatPersonnage(0, 0, 0), entree(0, 0), 1, raide);
    expect(fin.glisse).toBe(true);
    expect(fin.x).toBeGreaterThan(1);

    const bord = monde((x) => (x < 5 ? 10 : 0));
    let enLAir = false;
    const bas = avancer(creerEtatPersonnage(0, 10, 0), entree(1, 0), 4, bord, (e) => {
      if (!e.auSol) enLAir = true;
    });
    expect(enLAir).toBe(true);
    expect(bas.y).toBe(0);
    expect(bas.auSol).toBe(true);
  });

  it('bute contre un cercle et glisse le long', () => {
    const obstacle = { x: 5, z: 0, rayon: 1 };
    const m = monde(() => 0, -100, [obstacle]);
    const fin = avancer(creerEtatPersonnage(0, 0, 0.3), entree(1, 0), 3, m, (e) => {
      const d = Math.hypot(e.x - obstacle.x, e.z - obstacle.z);
      expect(d).toBeGreaterThanOrEqual(obstacle.rayon + P.rayon - 1e-9);
    });
    expect(fin.x).toBeGreaterThan(6); // il l'a contourné
    expect(fin.z).toBeGreaterThan(0.3);
  });

  it('nage lentement à la surface en eau profonde, sans sauter', () => {
    const lac = monde(() => -5, 0);
    const fin = avancer(creerEtatPersonnage(0, -5, 0), entree(1, 0, { courir: true, sauter: true }), 3, lac);
    expect(fin.nage).toBe(true);
    expect(fin.y).toBeCloseTo(-P.enfoncementNage, 3);
    expect(vitesseHorizontale(fin)).toBeCloseTo(P.vitesseNage, 5);

    // Eau peu profonde : on marche au fond, ralenti
    const gue = monde(() => -0.6, 0);
    const aPied = avancer(creerEtatPersonnage(0, -0.6, 0), entree(1, 0), 2, gue);
    expect(aPied.nage).toBe(false);
    expect(aPied.y).toBe(-0.6);
    expect(vitesseHorizontale(aPied)).toBeLessThan(P.vitesseMarche);
    expect(vitesseHorizontale(aPied)).toBeGreaterThan(P.vitesseNage);
  });

  it('sort de l’eau en rejoignant la rive', () => {
    const h = (x: number) => Math.min(2, -3 + 0.3 * x); // rive en pente douce
    const fin = avancer(creerEtatPersonnage(0, -P.enfoncementNage, 0), entree(1, 0), 8, monde(h, 0));
    expect(fin.nage).toBe(false);
    expect(fin.auSol).toBe(true);
    expect(fin.y).toBeCloseTo(h(fin.x), 9);
    expect(fin.y).toBeGreaterThan(0);
  });

  it('saute puis retombe au sol', () => {
    const plat = monde(() => 0);
    let sommet = 0;
    let etat = pasDeDeplacement(creerEtatPersonnage(0, 0, 0), entree(0, 0, { sauter: true }), DT, plat);
    expect(etat.auSol).toBe(false);
    etat = avancer(etat, entree(0, 0), 2, plat, (e) => {
      sommet = Math.max(sommet, e.y);
    });
    expect(sommet).toBeGreaterThan(0.7);
    expect(sommet).toBeLessThan(2);
    expect(etat.auSol).toBe(true);
    expect(etat.y).toBe(0);
  });

  it('se tourne vers sa direction de marche, ou vers la visée si elle est imposée', () => {
    const plat = monde(() => 0);
    let etat = avancer(creerEtatPersonnage(0, 0, 0), entree(1, 0), 1, plat);
    expect(etat.orientation).toBeCloseTo(Math.PI / 2, 3);
    etat = avancer(etat, entree(1, 0, { orientationVisee: 0 }), 1, plat);
    expect(etat.orientation).toBeCloseTo(0, 3);
  });
});

describe('pasDeFrappe', () => {
  it('un clic bref donne un seul impact, puis le geste se termine', () => {
    let etat = creerEtatFrappe();
    let impacts = 0;
    for (let i = 0; i < 120; i++) {
      const r = pasDeFrappe(etat, i === 0, DT);
      etat = r.etat;
      if (r.impact) impacts++;
    }
    expect(impacts).toBe(1);
    expect(etat.progression).toBe(-1);
  });

  it('se répète tant que le clic est maintenu', () => {
    let etat = creerEtatFrappe();
    let impacts = 0;
    const pas = Math.round((P.frappe.duree * 3.2) / DT);
    for (let i = 0; i < pas; i++) {
      const r = pasDeFrappe(etat, true, DT);
      etat = r.etat;
      if (r.impact) impacts++;
    }
    expect(impacts).toBe(3);
  });

  it('le geste part de la pose normale et y revient', () => {
    expect(gesteFrappe(-1).poids).toBe(0);
    expect(gesteFrappe(0).poids).toBe(0);
    expect(gesteFrappe(P.frappe.instantImpact)).toEqual({ poids: 1, abattement: 1 });
    expect(gesteFrappe(1).poids).toBe(0);
  });
});

describe('obstacles rectangles orientés', () => {
  const mondeMur = (rectangles: ObstacleRectangle[]): MondeDeplacement => ({
    hauteur: () => 0,
    niveauEau: -100,
    obstacles: [],
    rectangles,
  });

  it('ne touche pas un cercle éloigné et repousse un cercle qui mord sur un côté', () => {
    const mur: ObstacleRectangle = { x: 0, z: 0, demiLargeur: 2, demiProfondeur: 1, angle: 0 };
    expect(repousserHorsRectangle(5, 0, 0.35, mur)).toBeNull();
    const sortie = repousserHorsRectangle(2.2, 0, 0.35, mur)!;
    expect(sortie.x).toBeCloseTo(2.35);
    expect(sortie.z).toBeCloseTo(0);
    expect(sortie.nx).toBeCloseTo(1);
    expect(sortie.nz).toBeCloseTo(0);
  });

  it('sort par le côté le plus proche quand le centre est dans le rectangle', () => {
    const mur: ObstacleRectangle = { x: 10, z: 10, demiLargeur: 3, demiProfondeur: 2, angle: 0 };
    const sortie = repousserHorsRectangle(10.5, 11.5, 0.35, mur)!;
    expect(sortie.x).toBeCloseTo(10.5);
    expect(sortie.z).toBeCloseTo(12.35);
    expect(sortie.nz).toBeCloseTo(1);
  });

  it("respecte l'angle : la profondeur suit (sin, cos) de l'angle", () => {
    // Tourné d'un quart de tour : la profondeur (1 m) est le long de x, la largeur (4 m) le long de z
    const mur: ObstacleRectangle = { x: 0, z: 0, demiLargeur: 4, demiProfondeur: 1, angle: Math.PI / 2 };
    expect(repousserHorsRectangle(0, 3.5, 0.35, mur)).not.toBeNull();
    expect(repousserHorsRectangle(1.5, 0, 0.35, mur)).toBeNull();
    const sortie = repousserHorsRectangle(1.2, 3, 0.35, mur)!;
    expect(sortie.x).toBeCloseTo(1.35);
    expect(sortie.z).toBeCloseTo(3);
  });

  it('arrête le personnage contre un mur sans le traverser', () => {
    const mur: ObstacleRectangle = { x: 0, z: 5, demiLargeur: 4, demiProfondeur: 0.15, angle: 0 };
    const fin = avancer(creerEtatPersonnage(0, 0, 0), entree(0, 1, { courir: true }), 3, mondeMur([mur]), (e) => {
      expect(e.z).toBeLessThanOrEqual(5 - 0.15 - P.rayon + 1e-6);
    });
    expect(fin.z).toBeCloseTo(5 - 0.15 - P.rayon, 3);
    expect(vitesseHorizontale(fin)).toBeLessThan(0.01);
  });

  it('fait glisser le long du mur quand on arrive en biais', () => {
    const mur: ObstacleRectangle = { x: 0, z: 5, demiLargeur: 30, demiProfondeur: 0.5, angle: 0 };
    const fin = avancer(creerEtatPersonnage(0, 0, 3), entree(0.7, 0.7), 2, mondeMur([mur]));
    expect(fin.z).toBeCloseTo(5 - 0.5 - P.rayon, 3);
    expect(fin.x).toBeGreaterThan(4);
  });

  it("glisse aussi le long d'un mur en biais et contourne son coin", () => {
    const mur: ObstacleRectangle = { x: 0, z: 6, demiLargeur: 3, demiProfondeur: 0.5, angle: Math.PI / 4 };
    const m = mondeMur([mur]);
    const fin = avancer(creerEtatPersonnage(0, 0, 0), entree(0, 1), 6, m, (e) => {
      expect(repousserHorsRectangle(e.x, e.z, P.rayon - 1e-3, mur)).toBeNull();
    });
    // Le mur est contourné : le personnage finit bien au-delà
    expect(fin.z).toBeGreaterThan(10);
  });

  it('expulse un personnage qui se retrouve dans un bâtiment (sauvegarde ancienne, village agrandi)', () => {
    const maison: ObstacleRectangle = { x: 0, z: 0, demiLargeur: 3, demiProfondeur: 2.5, angle: 0.4 };
    const fin = avancer(creerEtatPersonnage(0.2, 0, 0.3), entree(0, 0), 0.1, mondeMur([maison]));
    expect(repousserHorsRectangle(fin.x, fin.z, P.rayon - 1e-3, maison)).toBeNull();
  });

  it('garde les cercles et les rectangles ensemble', () => {
    const m: MondeDeplacement = {
      hauteur: () => 0,
      niveauEau: -100,
      obstacles: [{ x: 0, z: 3, rayon: 0.5 }],
      rectangles: [{ x: 0, z: 8, demiLargeur: 10, demiProfondeur: 0.3, angle: 0 }],
    };
    const fin = avancer(creerEtatPersonnage(0.05, 0, 0), entree(0, 1), 4, m);
    expect(fin.z).toBeCloseTo(8 - 0.3 - P.rayon, 3);
    expect(Math.hypot(fin.x, fin.z - 3)).toBeGreaterThanOrEqual(0.5 + P.rayon - 1e-6);
  });
});

describe('escalade', () => {
  const E = P.escalade;
  // Paroi de 12 m à environ 72° : elle monte vers +x entre x = 0 et x = 4, plat en bas et en haut
  const HAUT = 12;
  const paroi = (x: number) => Math.max(0, Math.min(4, x)) * 3;
  const FACE = Math.PI / 2; // le personnage regarde vers +x
  const auPied = () => creerEtatPersonnage(-0.3, 0, 0, FACE);
  const grimper = (x = 0, z = 0) => entree(x, z, { sauter: true, grimper: true });

  it("commence à grimper avec Espace face à une pente trop raide, au lieu de sauter", () => {
    const m = monde(paroi);
    const etat = avancer(auPied(), grimper(), 1, m, (e) => {
      expect(e.grimpe).toBe(true);
      expect(e.auSol).toBe(true);
      expect(e.glisse).toBe(false);
      expect(e.y).toBeCloseTo(paroi(e.x), 6);
    });
    expect(etat.y).toBeGreaterThan(0.5);
  });

  it("sans Espace, la paroi reste infranchissable ; dos à la paroi ou sur le plat, Espace fait sauter", () => {
    const m = monde(paroi);
    const sans = avancer(auPied(), entree(1, 0), 3, m);
    expect(sans.grimpe).toBe(false);
    expect(sans.y).toBeLessThan(1.5);
    const dos = pasDeDeplacement(creerEtatPersonnage(-0.3, 0, 0, -FACE), grimper(), DT, m);
    expect(dos.grimpe).toBe(false);
    expect(dos.auSol).toBe(false);
    const plat = pasDeDeplacement(creerEtatPersonnage(-20, 0, 0, FACE), grimper(), DT, m);
    expect(plat.grimpe).toBe(false);
    expect(plat.vy).toBeGreaterThan(0);
  });

  it('monte lentement, à la vitesse verticale réglée', () => {
    const m = monde(paroi);
    const depart = avancer(auPied(), grimper(), 1.5, m);
    const fin = avancer(depart, grimper(), 2, m, (e) => expect(e.grimpe).toBe(true));
    expect((fin.y - depart.y) / 2).toBeCloseTo(E.vitesseMontee, 2);
    expect(E.vitesseMontee).toBeLessThan(P.vitesseMarche / 2);
  });

  it('redescend en reculant, et se déplace de côté le long de la paroi', () => {
    const m = monde(paroi);
    const depart = avancer(auPied(), grimper(), 3, m);
    const bas = avancer(depart, grimper(-1, 0), 1, m);
    expect(bas.grimpe).toBe(true);
    expect((depart.y - bas.y) / 1).toBeCloseTo(E.vitesseDescente, 2);
    const cote = avancer(depart, grimper(0, 1), 1, m);
    expect(cote.grimpe).toBe(true);
    expect(Math.abs(cote.z - depart.z)).toBeCloseTo(E.vitesseCote, 2);
    expect(cote.y).toBeCloseTo(depart.y, 2);
  });

  it('glisse vers le bas quand on lâche Espace', () => {
    const m = monde(paroi);
    const depart = avancer(auPied(), grimper(), 3, m);
    const fin = avancer(depart, entree(0, 0), 0.5, m);
    expect(fin.grimpe).toBe(false);
    expect(fin.y).toBeLessThan(depart.y - 1);
  });

  it('passe le bord en haut, reprend la marche et ne saute pas tant qu’Espace reste appuyé', () => {
    const m = monde(paroi);
    const fin = avancer(auPied(), grimper(), HAUT / E.vitesseMontee + 3, m, (e) => {
      // Jamais de saut ni de chute pendant la montée et le passage du bord
      expect(e.auSol).toBe(true);
      expect(e.y).toBeLessThanOrEqual(HAUT + 1e-6);
    });
    expect(fin.grimpe).toBe(false);
    expect(fin.glisse).toBe(false);
    expect(fin.y).toBeCloseTo(HAUT, 6);
    // Hissé sur le plat, au-delà du bord
    expect(fin.x).toBeGreaterThan(4.2);
    // La marche normale reprend, puis le saut une fois Espace relâché
    const marche = avancer(fin, entree(1, 0), 1, m);
    expect(marche.x).toBeGreaterThan(fin.x + 3);
    const saut = pasDeDeplacement(marche, entree(0, 0, { sauter: true }), DT, m);
    expect(saut.auSol).toBe(false);
  });

  it("refuse l'escalade dans l'eau et à la nage", () => {
    // Les pieds dans l'eau au pied de la paroi (eau à 0,5 m)
    const pataugeoire = monde(paroi, 0.5);
    // (Espace y garde son effet habituel : un saut, qui ne fait pas monter la paroi)
    const pieds = avancer(auPied(), grimper(), 3, pataugeoire, (e) => expect(e.grimpe).toBe(false));
    expect(pieds.y).toBeLessThan(P.vitesseSaut ** 2 / (2 * P.gravite) + 0.5);
    // À la nage contre une paroi qui plonge sous l'eau
    const lac = monde((x) => paroi(x) - 6, 0);
    const nageur = avancer(creerEtatPersonnage(-0.3, -P.enfoncementNage, 0, FACE), grimper(), 1, lac, (e) => {
      expect(e.grimpe).toBe(false);
    });
    expect(nageur.nage).toBe(true);
  });

  it("ne descend pas dans l'eau en reculant", () => {
    const m = monde((x) => paroi(x) - 3, 0);
    const depart = avancer(creerEtatPersonnage(2, paroi(2) - 3, 0, FACE), grimper(), 0.5, m);
    expect(depart.grimpe).toBe(true);
    const fin = avancer(depart, grimper(-1, 0), 5, m);
    expect(fin.y).toBeGreaterThanOrEqual(0);
  });

  it('ne grimpe pas sans la permission (mine, maison, pilote : `grimper` absent)', () => {
    const m = monde(paroi);
    const etat = pasDeDeplacement(auPied(), entree(0, 0, { sauter: true }), DT, m);
    expect(etat.grimpe).toBe(false);
    expect(etat.auSol).toBe(false);
  });
});
