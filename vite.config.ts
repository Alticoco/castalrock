import { defineConfig } from 'vite';

export default defineConfig({
  // Chemins relatifs : la version construite marche à la racine d'un site comme dans un sous-dossier (page GitHub)
  base: './',
  server: {
    port: 5175,
    strictPort: true,
  },
  // Configuration de Vitest (tests des règles et du monde, sans navigateur)
  test: {
    environment: 'node',
    // Les copies de travail des agents (.claude/worktrees) ne doivent pas être testées en double
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
  },
});
