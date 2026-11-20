// Livre de fin : les pages qui racontent la suite de l'histoire. Règles pures, aucun import de three.

export interface PageLivre {
  readonly titre?: string;
  readonly paragraphes: readonly string[];
  /** Dernière page : « Fin » et félicitations */
  readonly fin?: boolean;
}

/** Ce que le joueur a vécu, repris sur la dernière page. */
export interface BilanPartie {
  readonly jours: number;
  readonly niveau: number;
}

/** Les six pages du livre de fin (la dernière affiche le bilan). */
export function pagesLivreFin(bilan: BilanPartie): readonly PageLivre[] {
  const jours = `${bilan.jours} ${bilan.jours === 1 ? 'jour' : 'jours'}`;
  return [
    { titre: 'Le Cœur de Castal', paragraphes: ['Chronique de la vallée, telle qu’on la raconte encore.'] },
    {
      paragraphes: [
        'Ainsi s’achève l’histoire de l’étranger venu un matin au hameau, une hache prêtée à la main.',
        'Il coupa du bois, forgea le cuivre puis l’acier, et releva les toits que les pillards avaient jetés bas.',
      ],
    },
    {
      paragraphes: [
        'Morvan le Balafré tomba dans son camp, au sud. L’Éclat qu’il gardait fut porté jusqu’aux ruines, et le Cœur de Castal battit de nouveau.',
        'Cette nuit-là, dit-on, toute la vallée vit sa lueur bleue.',
      ],
    },
    {
      paragraphes: [
        'Dans les années qui suivirent, on revint. Des familles d’abord, puis des artisans, puis des marchands.',
        'Pierre après pierre, la forteresse de Castalrock fut relevée autour du Cœur. Aldric y finit ses jours, gardien du cristal.',
      ],
    },
    {
      paragraphes: [
        'Le hameau devint un bourg, et le bourg une ville.',
        'On raconte qu’aujourd’hui Castalrock est la capitale d’un royaume prospère, et qu’au-dessus de sa plus haute tour brille encore une lumière bleue.',
      ],
    },
    {
      titre: 'Fin',
      fin: true,
      paragraphes: [
        'Félicitations : tu as terminé Castalrock.',
        `Ton aventure a duré ${jours}, et tu as atteint le niveau ${bilan.niveau}.`,
        'Merci d’avoir joué.',
      ],
    },
  ];
}
