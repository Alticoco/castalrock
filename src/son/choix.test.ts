import { describe, expect, it } from 'vitest';
import { SONS, fichiersDuCatalogue } from './catalogue';
import {
  SON_DE_COURSE,
  SON_DU_SOL,
  choisirVariante,
  delaiAppel,
  estAuCalme,
  momentDuChangement,
  pasFranchi,
  solSousLesPieds,
  sonCreature,
  type LieuDesPas,
} from './choix';
import { TYPES_ANIMAL, TYPES_ENNEMI } from '../regles/combat';
import { CONFIG } from '../config';

/** Hasard rejoué : renvoie les valeurs données, en boucle. */
const suite = (...valeurs: number[]) => {
  let i = 0;
  return () => valeurs[i++ % valeurs.length];
};

describe('choisirVariante', () => {
  it('renvoie 0 quand il n’y a qu’une variante', () => {
    expect(choisirVariante(1, 0, suite(0.9))).toBe(0);
  });

  it('tire librement la première fois', () => {
    expect(choisirVariante(4, -1, suite(0))).toBe(0);
    expect(choisirVariante(4, -1, suite(0.99))).toBe(3);
  });

  it('ne rejoue jamais la même variante deux fois de suite', () => {
    for (let derniere = 0; derniere < 5; derniere++) {
      for (const a of [0, 0.2, 0.5, 0.79, 0.999]) {
        const i = choisirVariante(5, derniere, suite(a));
        expect(i).not.toBe(derniere);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(5);
      }
    }
  });

  it('peut atteindre toutes les autres variantes', () => {
    const vues = new Set([0, 0.3, 0.6, 0.99].map((a) => choisirVariante(4, 1, suite(a))));
    expect([...vues].sort()).toEqual([0, 2, 3]);
  });
});

describe('pasFranchi', () => {
  it('compte un pas quand les jambes sont le plus écartées (π/2, 3π/2…)', () => {
    expect(pasFranchi(1.5, 1.6)).toBe(true);
    expect(pasFranchi(4.6, 4.8)).toBe(true);
    expect(pasFranchi(2.0, 4.0)).toBe(false);
    // Jambes qui se croisent (π) : pas de bruit
    expect(pasFranchi(3.0, 3.3)).toBe(false);
  });

  it('reste muet à l’arrêt', () => {
    expect(pasFranchi(4.5, 4.5)).toBe(false);
  });
});

describe('solSousLesPieds', () => {
  const dehors: LieuDesPas = { dansMaison: false, dansMine: false, piedsDansEau: false, dansVillage: false, biome: 'prairie' };

  it('suit le biome dehors', () => {
    expect(solSousLesPieds(dehors)).toBe('terre');
    expect(solSousLesPieds({ ...dehors, biome: 'foret' })).toBe('foret');
    expect(solSousLesPieds({ ...dehors, biome: 'montagne' })).toBe('pierre');
    expect(solSousLesPieds({ ...dehors, biome: 'marais' })).toBe('mouille');
  });

  it('donne la priorité à la maison, puis la mine, puis l’eau, puis le village', () => {
    expect(solSousLesPieds({ ...dehors, dansMaison: true, dansMine: true })).toBe('bois');
    expect(solSousLesPieds({ ...dehors, dansMine: true, piedsDansEau: true })).toBe('pierre');
    expect(solSousLesPieds({ ...dehors, piedsDansEau: true, dansVillage: true })).toBe('mouille');
    expect(solSousLesPieds({ ...dehors, dansVillage: true, biome: 'foret' })).toBe('terre');
  });
});

describe('pas de course', () => {
  it('prend des pas plus légers dehors, les mêmes qu’en marchant dans l’eau et sur le plancher', () => {
    expect(SON_DE_COURSE.terre).toBe('course-terre');
    expect(SON_DE_COURSE.foret).toBe('course-terre');
    expect(SON_DE_COURSE.pierre).toBe('course-pierre');
    expect(SON_DE_COURSE.mouille).toBe(SON_DU_SOL.mouille);
    expect(SON_DE_COURSE.bois).toBe(SON_DU_SOL.bois);
  });
});

describe('sons des créatures', () => {
  it('donne un cri de mort à chaque ennemi', () => {
    for (const type of TYPES_ENNEMI) expect(sonCreature(type, 'mort')).not.toBeNull();
  });

  it('fait détaler les animaux dans un froissement', () => {
    for (const type of TYPES_ANIMAL.filter((t) => t !== 'sanglier')) {
      expect(sonCreature(type, 'fuite')?.nom).toBe('froissement');
    }
  });

  it('fait parler les chefs comme les bandits, en plus grave', () => {
    for (const chef of Object.keys(CONFIG.chefs) as (keyof typeof CONFIG.chefs)[]) {
      const son = sonCreature(chef, 'douleur');
      expect(son?.nom).toBe('bandit');
      expect(son!.hauteur).toBeLessThan(1);
    }
  });

  it('n’utilise que des sons du catalogue', () => {
    const moments = ['appel', 'alerte', 'attaque', 'douleur', 'mort', 'fuite'] as const;
    for (const type of [...TYPES_ENNEMI, ...TYPES_ANIMAL]) {
      for (const m of moments) {
        const son = sonCreature(type, m);
        if (son) expect(SONS[son.nom]).toBeDefined();
      }
    }
  });
});

describe('momentDuChangement', () => {
  it('pousse un cri quand la créature repère le joueur', () => {
    expect(momentDuChangement('errance', 'poursuite')).toBe('alerte');
    expect(momentDuChangement('repos', 'poursuite')).toBe('alerte');
  });

  it('ne recrie pas en reprenant la poursuite après une attaque', () => {
    expect(momentDuChangement('recul', 'poursuite')).toBeNull();
    expect(momentDuChangement('attaque', 'poursuite')).toBeNull();
  });

  it('joue l’attaque une seule fois, à l’élan', () => {
    expect(momentDuChangement('poursuite', 'anticipation')).toBe('attaque');
    expect(momentDuChangement('anticipation', 'attaque')).toBeNull();
    expect(momentDuChangement('poursuite', 'attaque')).toBe('attaque');
  });

  it('signale la fuite et laisse la mort au combat', () => {
    expect(momentDuChangement('errance', 'fuite')).toBe('fuite');
    expect(momentDuChangement('poursuite', 'mort')).toBeNull();
    expect(momentDuChangement('fuite', 'fuite')).toBeNull();
  });
});

describe('cris au calme', () => {
  it('seulement au repos ou en errance', () => {
    expect(estAuCalme('repos')).toBe(true);
    expect(estAuCalme('errance')).toBe(true);
    expect(estAuCalme('poursuite')).toBe(false);
  });

  it('espacés de quelques secondes', () => {
    expect(delaiAppel(suite(0))).toBe(CONFIG.sons.appels.min);
    expect(delaiAppel(suite(0.999))).toBeLessThanOrEqual(CONFIG.sons.appels.max);
  });
});

describe('catalogue', () => {
  it('chaque son a au moins un fichier et un volume entre 0 et 1', () => {
    for (const def of Object.values(SONS)) {
      expect(def.fichiers.length).toBeGreaterThan(0);
      expect(def.volume).toBeGreaterThan(0);
      expect(def.volume).toBeLessThanOrEqual(1);
      expect(def.hauteur[0]).toBeLessThanOrEqual(def.hauteur[1]);
    }
  });

  it('liste chaque fichier une seule fois, sans mot bloqué par les bloqueurs de pubs', () => {
    const fichiers = fichiersDuCatalogue();
    expect(new Set(fichiers).size).toBe(fichiers.length);
    for (const f of fichiers) expect(f).not.toMatch(/pub|ads|banner|tracking|analytics/i);
  });
});
