import { describe, expect, it } from 'vitest';
import { pagesLivreFin } from './fin';

describe('livre de fin', () => {
  it('compte six pages et seule la dernière est la fin', () => {
    const pages = pagesLivreFin({ jours: 14, niveau: 16 });
    expect(pages).toHaveLength(6);
    expect(pages.map((p) => p.fin === true)).toEqual([false, false, false, false, false, true]);
    expect(pages[0]!.titre).toBe('Le Cœur de Castal');
    expect(pages[5]!.titre).toBe('Fin');
  });

  it('affiche le bilan sur la dernière page', () => {
    const texte = pagesLivreFin({ jours: 14, niveau: 16 })[5]!.paragraphes.join(' ');
    expect(texte).toContain('14 jours');
    expect(texte).toContain('niveau 16');
  });

  it('met « jour » au singulier pour un seul jour', () => {
    const texte = pagesLivreFin({ jours: 1, niveau: 3 })[5]!.paragraphes.join(' ');
    expect(texte).toContain('1 jour,');
    expect(texte).not.toContain('1 jours');
  });
});
