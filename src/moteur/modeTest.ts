// Outils de test (F6, F7, F8, T pour accélérer le temps, « Retour au village ») : disponibles seulement
// quand le jeu est lancé avec `npm run dev`. La version construite (`npm run build`), celle qu'on publie, ne les a pas.
export const OUTILS_DE_TEST: boolean = import.meta.env.DEV;
