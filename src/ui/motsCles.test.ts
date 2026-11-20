import { describe, expect, it } from 'vitest';
import { colorerMotsCles, dictionnaireMotsCles, typeDuMot } from './motsCles';
import { T } from './theme';

describe('mots-clés colorés', () => {
  it('connaît les habitants, ressources, ennemis et lieux du jeu', () => {
    expect(typeDuMot('Marthe')).toBe('personnage');
    expect(typeDuMot('minerai de fer')).toBe('ressource');
    expect(typeDuMot('slime')).toBe('ennemi');
    expect(typeDuMot('Camp du Balafré')).toBe('lieu');
    expect(dictionnaireMotsCles().size).toBeGreaterThan(20);
  });

  it('colore un mot au pluriel, sans tenir compte de la casse', () => {
    const html = colorerMotsCles('Débarrasse le village de 5 slimes');
    expect(html).toContain(`<span style="color:${T.ennemi};font-weight:700">slimes</span>`);
    expect(html).toContain(`color:${T.lieu}`);
  });

  it('ne colore que des mots entiers', () => {
    expect(colorerMotsCles('Le ferment de la minerve')).not.toContain('<span');
  });

  it('choisit le nom le plus long', () => {
    const html = colorerMotsCles('Rapporte du minerai de fer');
    expect(html).toContain('>minerai de fer</span>');
    expect(html.match(/<span/g)).toHaveLength(1);
  });

  it('accepte les deux apostrophes et échappe le HTML', () => {
    expect(colorerMotsCles('Des pousses d’arbre')).toContain('>pousses d’arbre</span>');
    expect(colorerMotsCles('<b>Marthe</b>')).toContain('&lt;b&gt;');
  });
});
