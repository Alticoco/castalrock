// Fondu au noir court (repos à l'auberge ou au feu de camp). Aucune règle de jeu ici.

export interface Fondu {
  /** Noircit l'écran, appelle `auMilieu` quand il est noir, puis le rouvre. Ignoré si un fondu est en cours. */
  jouer(auMilieu: () => void): void;
}

export function creerFondu(racine: HTMLElement, dureeMs: number): Fondu {
  const voile = document.createElement('div');
  voile.dataset.role = 'fondu';
  voile.style.cssText =
    'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:40;' +
    `transition:opacity ${dureeMs}ms ease-in-out;`;
  racine.appendChild(voile);

  let enCours = false;
  return {
    jouer(auMilieu) {
      if (enCours) return;
      enCours = true;
      voile.style.opacity = '1';
      window.setTimeout(() => {
        auMilieu();
        voile.style.opacity = '0';
        window.setTimeout(() => {
          enCours = false;
        }, dureeMs);
      }, dureeMs);
    },
  };
}
