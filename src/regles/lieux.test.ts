import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { chercherEntreeMine, creerTerrainAvecMine } from '../monde/entreeMine';
import { creerGenerateurDecor } from '../monde/decor';
import { creerGenerateurRuines } from '../monde/ruines';
import { creerTerrain, retoucheReplats } from '../monde/terrain';
import { ajouter, compter, creerConteneur } from './inventaire';
import type { ContenantsHistoire } from './histoire';
import {
  NOMS_LIEUX,
  chercherLieux,
  creerEtatLieux,
  creerObstaclesLieux,
  decouvrir,
  decrireAutel,
  decrireCamp,
  inviteAutel,
  lieuxDecouverts,
  lireEtatLieux,
  manqueReforge,
  obstaclesAutel,
  obstaclesCamp,
  prochainLieu,
  reforgerCoeur,
  replatsLieux,
  zonesLibresLieux,
  type Lieux,
} from './lieux';

const L = CONFIG.lieux;
const GRAINES = [CONFIG.graine, 1, 7, 2026];
const eviter = (graine: number) => [chercherEntreeMine(creerTerrain(graine)), CONFIG.habitants.aldric];
const mondes = new Map<number, ReturnType<typeof creerTerrainAvecMine>>();
function monde(graine: number) {
  let m = mondes.get(graine);
  if (!m) {
    m = creerTerrainAvecMine(graine);
    mondes.set(graine, m);
  }
  return m;
}
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe('lieux : positions', () => {
  it('sont toujours les mêmes pour une même graine', () => {
    const a = chercherLieux(creerTerrain(12345), eviter(12345));
    const b = chercherLieux(creerTerrain(12345), eviter(12345));
    expect(a).toEqual(b);
    expect(monde(12345).lieux).toEqual(a);
    expect(chercherLieux(creerTerrain(7), eviter(7))).not.toEqual(a);
  });

  it('le camp est en forêt, à 250-400 m du village ; la forteresse est en montagne, plus haut', () => {
    for (const graine of GRAINES) {
      const brut = creerTerrain(graine);
      const { camp, autel } = monde(graine).lieux;
      const d = Math.hypot(camp.x, camp.z);
      expect(d).toBeGreaterThanOrEqual(L.camp.distanceMin);
      expect(d).toBeLessThanOrEqual(L.camp.distanceMax);
      expect(brut.biomeDominant(camp.x, camp.z).id).toBe('foret');
      expect(brut.biomeDominant(autel.x, autel.z).id).toBe('montagne');
      expect(Math.hypot(autel.x, autel.z)).toBeGreaterThanOrEqual(L.autel.distanceMin);
      expect(Math.hypot(autel.x, autel.z)).toBeLessThanOrEqual(L.autel.distanceMax);
      expect(autel.y).toBeGreaterThan(camp.y);
    }
  });

  it('restent hors de l’eau, loin de l’entrée de la mine, d’Aldric et l’un de l’autre', () => {
    for (const graine of GRAINES) {
      const { terrain, entree, lieux } = monde(graine);
      for (const lieu of [lieux.camp, lieux.autel]) {
        expect(lieu.y).toBeGreaterThan(terrain.niveauEau + 1);
        const mini = lieu === lieux.autel ? L.autel.distanceMiniAutres : L.distanceMiniAutres;
        expect(distance(lieu, entree)).toBeGreaterThanOrEqual(mini);
        expect(distance(lieu, CONFIG.habitants.aldric)).toBeGreaterThanOrEqual(mini);
        // Aucune eau sur le replat ni sur son raccord proche
        for (let a = 0; a < 12; a++) {
          for (const r of [0, 6, 12, 18]) {
            const x = lieu.x + Math.sin((a * Math.PI) / 6) * r;
            const z = lieu.z + Math.cos((a * Math.PI) / 6) * r;
            expect(terrain.estSousEau(x, z)).toBe(false);
          }
        }
      }
      expect(distance(lieux.camp, lieux.autel)).toBeGreaterThanOrEqual(L.distanceMiniEntreLieux);
    }
  });

  it('l’accès regarde vers le village', () => {
    const { camp } = monde(CONFIG.graine).lieux;
    const d = Math.hypot(camp.x, camp.z);
    expect(Math.sin(camp.acces)).toBeCloseTo(-camp.x / d, 6);
    expect(Math.cos(camp.acces)).toBeCloseTo(-camp.z / d, 6);
  });
});

describe('lieux : terrain aplani', () => {
  it('le sol est plat sur tout le replat, à l’altitude du lieu, et inchangé loin de là', () => {
    for (const graine of GRAINES) {
      const { terrain, lieux } = monde(graine);
      const brut = creerTerrain(graine);
      for (const [lieu, rayon] of [[lieux.camp, L.camp.replat], [lieux.autel, L.autel.replat]] as const) {
        for (let a = 0; a < 16; a++) {
          for (const r of [0, rayon * 0.5, rayon - 2.5]) {
            const x = lieu.x + Math.sin((a * Math.PI) / 8) * r;
            const z = lieu.z + Math.cos((a * Math.PI) / 8) * r;
            expect(terrain.hauteur(x, z)).toBeCloseTo(lieu.y, 4);
          }
        }
        expect(terrain.pente(lieu.x + 3, lieu.z - 2)).toBeCloseTo(0, 5);
      }
      // Loin des lieux et de la mine : exactement le terrain de la graine
      expect(terrain.hauteurBrute(0, 0)).toBe(brut.hauteurBrute(0, 0));
      const loin = { x: lieux.camp.x + 80, z: lieux.camp.z + 80 };
      if (distance(loin, lieux.autel) > L.autel.replat + L.autel.raccord && distance(loin, monde(graine).entree) > 60) {
        expect(terrain.hauteurBrute(loin.x, loin.z)).toBe(brut.hauteurBrute(loin.x, loin.z));
      }
    }
  });

  it('retoucheReplats raccorde progressivement, comme le village', () => {
    const retouche = retoucheReplats([{ x: 100, z: 0, altitude: 10, rayon: 10, raccord: 10 }]);
    expect(retouche(100, 0, 30)).toBe(10);
    expect(retouche(109, 0, 30)).toBe(10);
    expect(retouche(115, 0, 30)).toBeCloseTo(20, 5);
    expect(retouche(120, 0, 30)).toBe(30);
    expect(retouche(300, 40, 30)).toBe(30);
    expect(retoucheReplats(replatsLieux(monde(CONFIG.graine).lieux))(0, 0, 6)).toBe(6);
  });

  it('pour la graine du jeu, on va à pied du village à la porte du camp et à la porte de la forteresse', () => {
    const { terrain, lieux } = monde(CONFIG.graine);
    const cibles = [decrireCamp(lieux.camp).arrivee, decrireAutel(lieux.autel).arrivee];
    // Parcours en largeur sur une grille de 4 m : pas d'eau, pas de marche plus raide que la pente franchissable
    const PAS = 4;
    const DEMI = 160;
    const N = DEMI * 2 + 1;
    const marcheMax = PAS * Math.tan((CONFIG.personnage.penteMaxDegres * Math.PI) / 180) * 0.85;
    const h = new Float32Array(N * N).fill(NaN);
    const hauteur = (c: number) => {
      if (Number.isNaN(h[c])) h[c] = terrain.hauteurBrute(((c % N) - DEMI) * PAS, (Math.floor(c / N) - DEMI) * PAS);
      return h[c];
    };
    const atteint = new Uint8Array(N * N);
    const file = [DEMI * N + DEMI];
    atteint[file[0]] = 1;
    for (let k = 0; k < file.length; k++) {
      const c = file[k];
      const a = c % N;
      const b = Math.floor(c / N);
      for (const [sa, sb] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const na = a + sa;
        const nb = b + sb;
        if (na < 0 || nb < 0 || na >= N || nb >= N) continue;
        const n = nb * N + na;
        if (atteint[n] || hauteur(n) < terrain.niveauEau + 0.2 || Math.abs(hauteur(n) - hauteur(c)) > marcheMax) continue;
        atteint[n] = 1;
        file.push(n);
      }
    }
    for (const p of cibles) {
      const a = Math.round(p.x / PAS) + DEMI;
      const b = Math.round(p.z / PAS) + DEMI;
      expect(atteint[b * N + a]).toBe(1);
    }
  });

  it('aucun décor généré dans le camp ni dans la forteresse', () => {
    const { terrain, lieux } = monde(CONFIG.graine);
    const generateur = creerGenerateurDecor(terrain, zonesLibresLieux(lieux));
    const taille = CONFIG.monde.tailleChunk;
    for (const zone of zonesLibresLieux(lieux)) {
      const cx = Math.floor(zone.x / taille);
      const cz = Math.floor(zone.z / taille);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          for (const e of generateur.chunk(cx + dx, cz + dz)) expect(distance(e, zone)).toBeGreaterThanOrEqual(zone.rayon);
        }
      }
    }
  });

  it('aucune ruine du décor ni petite grotte dans l’emprise de la forteresse', () => {
    for (const graine of GRAINES) {
      const { terrain, lieux } = monde(graine);
      const ruines = creerGenerateurRuines(terrain, zonesLibresLieux(lieux));
      expect(ruines.sitesAutour(lieux.autel.x, lieux.autel.z, L.autel.rayonSansDecor + CONFIG.ruines.margeLieux - 1)).toEqual([]);
    }
  });
});

describe('lieux : plan du camp', () => {
  const lieux: Lieux = { camp: { x: 300, z: -40, y: 12, acces: 0.7 }, autel: { x: -200, z: 500, y: 40, acces: 2 } };
  const camp = decrireCamp(lieux.camp);
  const versPorte = { x: Math.sin(lieux.camp.acces), z: Math.cos(lieux.camp.acces) };

  it('a une palissade en cercle, 3 tentes, un feu au centre, des caisses, une tour et 4 postes de garde', () => {
    expect(camp.pieux.length).toBeGreaterThan(80);
    for (const p of camp.pieux) expect(distance(p, lieux.camp)).toBeCloseTo(L.camp.rayonPalissade, 5);
    expect(camp.tentes).toHaveLength(3);
    expect(distance(camp.feu, lieux.camp)).toBeCloseTo(0, 6);
    expect(camp.caisses.length).toBeGreaterThanOrEqual(6);
    expect(camp.postesGardes).toHaveLength(4);
    expect(camp.postesRenforts).toHaveLength(CONFIG.chefs.morvan.renforts);
    // Tout tient dans la palissade
    for (const p of [...camp.tentes, camp.tour, camp.ratelier, camp.drapeau, ...camp.caisses, camp.posteMorvan, ...camp.postesGardes, ...camp.postesRenforts]) {
      expect(distance(p, lieux.camp)).toBeLessThan(L.camp.rayonPalissade - 1);
    }
  });

  it('la palissade est fermée, sauf l’ouverture du côté du village', () => {
    const cercles = obstaclesCamp(camp);
    const rayonJoueur = CONFIG.personnage.rayon;
    const libre = (x: number, z: number) => cercles.every((c) => Math.hypot(x - c.x, z - c.z) >= c.rayon + rayonJoueur);
    // Par la porte : on passe du dehors au dedans en ligne droite
    for (let d = L.camp.rayonPalissade + 4; d >= L.camp.rayonPalissade - 3; d -= 0.25) {
      expect(libre(lieux.camp.x + versPorte.x * d, lieux.camp.z + versPorte.z * d)).toBe(true);
    }
    // Partout ailleurs, le cercle de pieux arrête le joueur
    for (let k = 0; k < 360; k++) {
      const phi = lieux.camp.acces + (k * Math.PI) / 180;
      const ecart = Math.abs(Math.atan2(Math.sin(phi - lieux.camp.acces), Math.cos(phi - lieux.camp.acces)));
      if (ecart < 0.3) continue;
      expect(libre(lieux.camp.x + Math.sin(phi) * L.camp.rayonPalissade, lieux.camp.z + Math.cos(phi) * L.camp.rayonPalissade)).toBe(false);
    }
  });

  it('Morvan, ses gardes et les renforts ne sont pas dans un obstacle, et l’arrivée de test est dehors, devant la porte', () => {
    const cercles = obstaclesCamp(camp);
    for (const p of [camp.posteMorvan, ...camp.postesGardes, ...camp.postesRenforts, camp.arrivee]) {
      for (const c of cercles) expect(distance(p, c)).toBeGreaterThan(c.rayon + 0.5);
    }
    expect(distance(camp.arrivee, lieux.camp)).toBeGreaterThan(L.camp.rayonPalissade + 3);
    expect(distance(camp.arrivee, lieux.camp)).toBeLessThan(L.camp.replat + L.camp.raccord);
    // Face au camp
    expect(Math.sin(camp.arrivee.orientation)).toBeCloseTo(-versPorte.x, 6);
    expect(Math.cos(camp.arrivee.orientation)).toBeCloseTo(-versPorte.z, 6);
  });

  it('a 3 coffres de butin, hors des collisions et du chemin de la porte au feu, Morvan à côté de sa tente', () => {
    expect(camp.coffres.map((c) => c.id)).toEqual(['camp:coffre:0', 'camp:coffre:1', 'camp:coffre:2']);
    const autres = obstaclesCamp({ ...camp, coffres: [] });
    const rayonCoffre = CONFIG.ruines.coffre.rayon;
    for (const c of camp.coffres) {
      for (const o of autres) expect(distance(c, o)).toBeGreaterThan(o.rayon + rayonCoffre);
      for (const p of [camp.posteMorvan, ...camp.postesGardes]) expect(distance(c, p)).toBeGreaterThan(rayonCoffre + 0.5);
      // Loin de l'axe porte - feu (distance du point au segment)
      const dx = c.x - lieux.camp.x;
      const dz = c.z - lieux.camp.z;
      const t = Math.min(L.camp.rayonPalissade, Math.max(0, dx * versPorte.x + dz * versPorte.z));
      expect(Math.hypot(dx - versPorte.x * t, dz - versPorte.z * t)).toBeGreaterThan(2);
      expect(distance(c, lieux.camp)).toBeLessThan(L.camp.rayonPalissade - 2);
    }
    for (const c of camp.coffres.slice(1)) expect(distance(c, camp.coffres[0])).toBeGreaterThan(3);
    // Le coffre de Morvan est devant sa tente (la tente 0, au fond du camp)
    expect(distance(camp.coffres[0], camp.tentes[0])).toBeLessThan(5);
    expect(obstaclesCamp(camp)).toHaveLength(autres.length + 3);
  });

  it('les obstacles ne sont donnés que près d’un lieu', () => {
    const obstacles = creerObstaclesLieux(camp, decrireAutel(lieux.autel));
    expect(obstacles(0, 0, 4)).toEqual([]);
    expect(obstacles(lieux.camp.x + 60, lieux.camp.z, 4)).toEqual([]);
    const pieu = camp.pieux[10];
    const proches = obstacles(pieu.x, pieu.z, 1);
    expect(proches.length).toBeGreaterThanOrEqual(1);
    expect(proches.length).toBeLessThan(10);
  });
});

describe('lieux : ruines de la forteresse de Castalrock', () => {
  const lieux: Lieux = { camp: { x: 300, z: -40, y: 12, acces: 0.7 }, autel: { x: -200, z: 500, y: 40, acces: 2 } };
  const F = L.autel.forteresse;
  const autel = decrireAutel(lieux.autel);
  const cercles = obstaclesAutel(autel);
  const rayonJoueur = CONFIG.personnage.rayon;
  const libre = (x: number, z: number) => cercles.every((c) => Math.hypot(x - c.x, z - c.z) >= c.rayon + rayonJoueur);
  const versPorte = { x: Math.sin(lieux.autel.acces), z: Math.cos(lieux.autel.acces) };
  /** Point du monde à `avant` mètres du centre vers la porte et `droite` mètres sur le côté. */
  const point = (avant: number, droite: number) => ({ x: lieux.autel.x + versPorte.x * avant + versPorte.z * droite, z: lieux.autel.z + versPorte.z * avant - versPorte.x * droite });

  it('s’appelle « Ruines de Castalrock » et est toujours la même', () => {
    expect(NOMS_LIEUX.autel).toBe('Ruines de Castalrock');
    expect(decrireAutel(lieux.autel)).toEqual(autel);
  });

  it('est grande (50 à 70 m d’emprise), haute, tient sur le replat et reste légère', () => {
    let rayon = 0;
    let sommet = 0;
    for (const b of autel.blocs) {
      rayon = Math.max(rayon, Math.hypot(b.x, b.z));
      sommet = Math.max(sommet, b.y + b.ly / 2);
    }
    expect(rayon * 2).toBeGreaterThanOrEqual(50);
    expect(rayon * 2).toBeLessThanOrEqual(74);
    expect(rayon).toBeLessThan(L.autel.replat);
    expect(L.autel.rayonSansDecor).toBeGreaterThan(rayon);
    // Une tour encore haute, et des créneaux quelque part
    expect(sommet).toBeGreaterThan(F.hauteurGrandeTour);
    // Une seule géométrie fondue : le nombre de blocs reste raisonnable
    expect(autel.blocs.length).toBeGreaterThan(800);
    expect(autel.blocs.length).toBeLessThan(3500);
    // De la pierre surtout, avec de la mousse et du lierre
    const matieres = new Set(autel.blocs.map((b) => b.matiere));
    for (const m of ['pierre', 'dalle', 'mousse', 'lierre']) expect(matieres.has(m as never)).toBe(true);
    for (const c of autel.murs) expect(distance(c, lieux.autel)).toBeLessThan(L.autel.replat);
  });

  it('on entre par la porte en arche : tout droit de l’arrivée de test jusqu’au berceau du cristal', () => {
    const dPorte = distance(autel.porte, lieux.autel);
    const dArrivee = distance(autel.arrivee, lieux.autel);
    expect(dPorte).toBeCloseTo(F.rayonEnceinte * Math.cos(Math.PI / 6), 5);
    // L'arrivée est dehors, devant la porte, sur le replat, face à la forteresse
    expect(dArrivee).toBeGreaterThan(dPorte + 4);
    expect(dArrivee).toBeLessThan(L.autel.replat);
    expect(Math.sin(autel.arrivee.orientation)).toBeCloseTo(-versPorte.x, 6);
    expect(Math.cos(autel.arrivee.orientation)).toBeCloseTo(-versPorte.z, 6);
    for (let d = dArrivee; d >= autel.rayonBerceau + rayonJoueur + 0.05; d -= 0.25) {
      for (const cote of [-1.2, 0, 1.2]) expect(libre(point(d, cote).x, point(d, cote).z)).toBe(true);
    }
    // Le berceau arrête le joueur : c'est là, face au cristal, que se fait l'interaction
    expect(libre(point(autel.rayonBerceau - 0.2, 0).x, point(autel.rayonBerceau - 0.2, 0).z)).toBe(false);
    expect(libre(lieux.autel.x, lieux.autel.z)).toBe(false);
  });

  it('les remparts de part et d’autre de la porte, les tours et les piliers d’angle arrêtent le joueur', () => {
    const dPorte = distance(autel.porte, lieux.autel);
    for (const cote of [-11, -8, -5, 5, 8, 11]) expect(libre(point(dPorte, cote).x, point(dPorte, cote).z)).toBe(false);
    // Angles de l'enceinte : tour pleine (devant à droite, au fond à gauche) ou gros pilier ; la souche, devant à
    // gauche, est ouverte
    for (const k of [0, 1, 2, 3, 4]) {
      const phi = Math.PI / 6 + (k * Math.PI) / 3;
      const p = point(Math.cos(phi) * F.rayonEnceinte, Math.sin(phi) * F.rayonEnceinte);
      expect(libre(p.x, p.z)).toBe(false);
    }
    // La cour reste dégagée : la plupart des points entre le berceau et les murs sont libres
    let libres = 0;
    let total = 0;
    for (let a = 0; a < 36; a++) {
      for (const d of [7, 10, 13, 16, 19]) {
        total++;
        if (libre(lieux.autel.x + Math.sin((a * Math.PI) / 18) * d, lieux.autel.z + Math.cos((a * Math.PI) / 18) * d)) libres++;
      }
    }
    expect(libres / total).toBeGreaterThan(0.75);
  });

  it('a 4 touffes de petits cristaux autour du berceau, hors du chemin de la porte', () => {
    expect(autel.petitsCristaux).toHaveLength(4);
    for (const p of autel.petitsCristaux) {
      expect(distance(p, lieux.autel)).toBeGreaterThan(autel.rayonBerceau);
      expect(distance(p, lieux.autel)).toBeLessThan(autel.rayonBerceau + 3);
    }
  });

  it('ses obstacles sont donnés dans toute l’enceinte, et seulement là', () => {
    const obstacles = creerObstaclesLieux(decrireCamp(lieux.camp), autel);
    expect(obstacles(autel.arrivee.x, autel.arrivee.z, 0.4)).toEqual([]);
    expect(obstacles(lieux.autel.x, lieux.autel.z, 0.4).length).toBeGreaterThan(0);
    const coin = point(Math.cos(Math.PI / 6) * F.rayonEnceinte, Math.sin(Math.PI / 6) * F.rayonEnceinte);
    expect(obstacles(coin.x, coin.z, 1).length).toBeGreaterThan(0);
    expect(obstacles(lieux.autel.x + L.autel.replat + 20, lieux.autel.z, 4)).toEqual([]);
  });
});

describe('lieux : état de la partie', () => {
  const lieux: Lieux = { camp: { x: 300, z: 0, y: 12, acces: 0 }, autel: { x: -200, z: 500, y: 40, acces: 0 } };

  it('rien n’est découvert au départ ; s’approcher découvre le lieu, une seule fois', () => {
    const neuf = creerEtatLieux();
    expect(lieuxDecouverts(neuf)).toEqual([]);
    expect(decouvrir(neuf, lieux, 0, 0).etat).toBe(neuf);
    expect(decouvrir(neuf, lieux, 300 - L.camp.distanceDecouverte - 5, 0).nouveaux).toEqual([]);
    const r = decouvrir(neuf, lieux, 300 - L.camp.distanceDecouverte + 5, 0);
    expect(r.nouveaux).toEqual(['camp']);
    expect(lieuxDecouverts(r.etat)).toEqual(['camp']);
    expect(decouvrir(r.etat, lieux, 300, 0).etat).toBe(r.etat);
    const autel = decouvrir(r.etat, lieux, -200, 490);
    expect(autel.nouveaux).toEqual(['autel']);
    expect(lieuxDecouverts(autel.etat)).toEqual(['camp', 'autel']);
  });

  it('le prochain lieu de l’histoire (F8) : le camp, puis l’autel une fois Morvan vaincu', () => {
    expect(prochainLieu(creerEtatLieux())).toBe('camp');
    expect(prochainLieu({ ...creerEtatLieux(), campDecouvert: true })).toBe('camp');
    expect(prochainLieu({ ...creerEtatLieux(), morvanVaincu: true })).toBe('autel');
  });

  it('lit un état valide, refuse un état abîmé', () => {
    const e = { campDecouvert: true, autelDecouvert: false, morvanVaincu: true, coeurReforge: false };
    expect(lireEtatLieux(e)).toEqual(e);
    for (const mauvais of [null, 3, [], {}, { ...e, coeurReforge: 'oui' }, { campDecouvert: true }]) expect(lireEtatLieux(mauvais)).toBeNull();
  });
});

describe('lieux : reforge du Cœur', () => {
  const vide: ContenantsHistoire = { inventaire: creerConteneur(10), coffre: creerConteneur(10), sac: creerConteneur(10) };
  const tout: ContenantsHistoire = {
    inventaire: ajouter(ajouter(creerConteneur(10), 'eclat-coeur', 1).conteneur, 'cristal-bleu', 6).conteneur,
    coffre: ajouter(creerConteneur(10), 'cristal-bleu', 7).conteneur,
    sac: ajouter(creerConteneur(10), 'lingot-acier', 8).conteneur,
  };

  it('demande l’Éclat du Cœur, 10 cristaux bleus et 5 lingots d’acier', () => {
    expect(L.autel.cout).toEqual([
      { objet: 'eclat-coeur', quantite: 1 },
      { objet: 'cristal-bleu', quantite: 10 },
      { objet: 'lingot-acier', quantite: 5 },
    ]);
    expect(manqueReforge(vide)).toHaveLength(3);
    expect(manqueReforge(tout)).toEqual([]);
  });

  it('sans l’Éclat (Morvan pas encore vaincu), dit ce qu’il manque et ne prend rien', () => {
    const sansEclat = { ...tout, inventaire: ajouter(creerConteneur(10), 'cristal-bleu', 6).conteneur };
    const r = reforgerCoeur(creerEtatLieux(), sansEclat);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain('Éclat du Cœur');
      expect(r.message).not.toContain('cristal');
    }
  });

  it('avec tout, prend les objets (inventaire, puis coffre, puis sac) et le Cœur reste reforgé', () => {
    const r = reforgerCoeur(creerEtatLieux(), tout);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.etat.coeurReforge).toBe(true);
    expect(compter(r.contenants.inventaire, 'eclat-coeur')).toBe(0);
    expect(compter(r.contenants.inventaire, 'cristal-bleu')).toBe(0);
    expect(compter(r.contenants.coffre, 'cristal-bleu')).toBe(3);
    expect(compter(r.contenants.sac, 'lingot-acier')).toBe(3);
    expect(inviteAutel(creerEtatLieux())).toBe('reforger le Cœur');
    expect(inviteAutel(r.etat)).not.toBe('reforger le Cœur');
    // Une seconde fois : rien n'est repris
    const encore = reforgerCoeur(r.etat, tout);
    expect(encore.ok).toBe(false);
  });
});

describe('Aldric : loin du camp des bandits', () => {
  it('pour la graine du jeu : à 200 m ou plus du camp, 130 m des ruines, dans une autre direction (90 degrés au moins)', () => {
    const { lieux } = monde(CONFIG.graine);
    const A = CONFIG.habitants.aldric;
    const dist = Math.hypot(A.x, A.z);
    expect(dist).toBeGreaterThanOrEqual(200);
    expect(dist).toBeLessThanOrEqual(300);
    expect(distance(A, lieux.camp)).toBeGreaterThanOrEqual(200);
    expect(distance(A, lieux.autel)).toBeGreaterThanOrEqual(130);
    const ecart = Math.abs(Math.atan2(A.x, -A.z) - Math.atan2(lieux.camp.x, -lieux.camp.z));
    expect(Math.min(ecart, 2 * Math.PI - ecart)).toBeGreaterThanOrEqual(Math.PI / 2);
  });
});
