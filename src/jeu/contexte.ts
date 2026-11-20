// Services du jeu : tout ce qui est créé une fois au démarrage (rendu, monde, personnage, interface)
// et qui ne change plus ensuite. L'état qui change pendant la partie est dans partie.ts.
import { CONFIG } from '../config';
import { creerRendu } from '../scene/rendu';
import { creerLumieres } from '../scene/lumiere';
import { creerPersonnage, creerBrasPremierePersonne } from '../scene/personnage';
import { creerEffetsRecolte } from '../scene/effetsRecolte';
import { creerEffetsSorts } from '../scene/effetsSorts';
import { creerEffetsCombat } from '../scene/effetsCombat';
import { creerCameras, creerMasquage } from '../scene/cameras';
import { creerCycleJour } from '../scene/cycleJour';
import { creerRenduVillage } from '../scene/modelesVillage';
import { creerRenduHabitants } from '../scene/modelesHabitants';
import { creerModelesDecor } from '../scene/modelesDecor';
import { creerEntrees } from '../moteur/entrees';
import { creerTerrainAvecMine, zoneLibreEntree } from '../monde/entreeMine';
import { creerObstaclesLieux, decrireAutel, decrireCamp, zonesLibresLieux } from '../regles/lieux';
import { creerGestionnaireChunks } from '../monde/chunks';
import { creerEau } from '../monde/eau';
import { creerRenduDecor } from '../monde/renduDecor';
import { creerRenduRuines } from '../monde/renduRuines';
import { creerMine } from '../mine/mine';
import { creerMaison, mineAvecMaison } from '../maison/maison';
import { creerPlanMaison } from '../maison/plan';
import { creerAideVue } from '../ui/aideVue';
import { creerAide } from '../ui/aide';
import { creerHorloge } from '../ui/horloge';
import { creerMiniCarte } from '../ui/miniCarte';
import { remplirTuile } from '../monde/carte';
import { creerCompteurImages } from '../ui/compteurImages';
import { creerGraphismes } from './graphismes';
import { creerMoteurSon } from '../son/moteurSon';
import { volumesSon } from '../moteur/reglages';
import { creerCompteurRessources } from '../ui/compteurRessources';
import { creerInterfaceCombat } from '../ui/interfaceCombat';
import { creerInterfaceProgression } from '../ui/interfaceProgression';
import { creerBarreOutils } from '../ui/barreOutils';
import { creerBoussole } from '../ui/boussole';
import { creerSuiviQuetes } from '../ui/suiviQuetes';
import { creerInvite } from '../ui/invite';
import { installerTheme } from '../ui/theme';
import type { DonneesPartie } from '../regles/sauvegarde';

// Rayon dans lequel les arbres et rochers sont donnés comme obstacles au déplacement, en mètres
export const RAYON_OBSTACLES = 4;

/** Crée le rendu, le monde, le personnage et les éléments d'interface permanents. `partie` : partie chargée ou null. */
export function creerContexte(partie: DonneesPartie | null) {
  const conteneur = document.getElementById('jeu');
  if (!conteneur) throw new Error('Élément #jeu introuvable');
  const ui = document.getElementById('ui');
  if (!ui) throw new Error('Élément #ui introuvable');
  // Thème « Ardoise et laiton » : polices, variables et animations de l'interface (avant tout écran)
  installerTheme(ui);

  const { renderer, scene, camera } = creerRendu(conteneur);
  const lumieres = creerLumieres(scene);

  // Terrain de la graine, avec le replat devant l'entrée de la mine, la zone intérieure de la mine
  // et les replats des lieux de l'histoire (camp des bandits, autel du Cœur)
  const { terrain, entree: entreeMine, plan: planMine, lieux } = creerTerrainAvecMine(CONFIG.graine);
  const planCamp = decrireCamp(lieux.camp);
  const planAutel = decrireAutel(lieux.autel);
  // Collisions des lieux (pieux, tentes, menhirs…) autour d'un point, pour le joueur et les ennemis
  const obstaclesLieux = creerObstaclesLieux(planCamp, planAutel);
  const eau = creerEau(scene, terrain.niveauEau);
  const modelesDecor = creerModelesDecor();
  // (le campement d'Aldric, dans la forêt, est lui aussi dégagé du décor)
  const campAldric = { x: CONFIG.habitants.aldric.x, z: CONFIG.habitants.aldric.z, rayon: CONFIG.habitants.aldric.rayonSansDecor };
  // Ruines et petites grottes semées par la graine (session 3b), hors des lieux déjà occupés ; le décor n'y pousse pas
  const ruines = creerRenduRuines(scene, terrain, [zoneLibreEntree(entreeMine), campAldric, ...zonesLibresLieux(lieux)]);
  const decor = creerRenduDecor(scene, terrain, modelesDecor, [zoneLibreEntree(entreeMine), campAldric, ...zonesLibresLieux(lieux)], ruines.dansEmprise);
  const chunks = creerGestionnaireChunks(scene, terrain, { eau, decor, ruines });
  // Mine : portail dehors, galeries dans une zone à part (src/mine/)
  // Maison du joueur : son intérieur est une autre zone à part (src/maison/). Pour le reste du jeu,
  // « la mine » répond aussi pour la maison (obstacles, caméra, zone sans chunks ni ennemis).
  const maison = creerMaison(scene, lumieres, creerPlanMaison());
  const mine = mineAvecMaison(creerMine(scene, decor, lumieres, entreeMine, planMine), maison);

  // Village fixe au centre du monde
  const village = creerRenduVillage(scene, terrain.altitudeVillage);
  // Habitants : modèles créés une fois, placés et animés par src/jeu/habitants.ts
  const habitants = creerRenduHabitants();
  const personnage = creerPersonnage();
  scene.add(personnage.objet);

  // Les bras de la 1re personne sont attachés à la caméra, qui doit donc être dans la scène
  scene.add(camera);
  // Sons : l'oreille suit la caméra ; volumes gardés appliqués dès le lancement, puis à chaque changement (menu pause)
  const sons = creerMoteurSon(camera);
  const appliquerVolumes = () => sons.appliquerVolumes(volumesSon());
  appliquerVolumes();
  const bras = creerBrasPremierePersonne();
  bras.objet.visible = false;
  camera.add(bras.objet);

  const entrees = creerEntrees(renderer.domElement);
  const vues = creerCameras(camera, (x, z) => Math.max(terrain.hauteur(x, z), terrain.niveauEau), mine.distanceCamera);
  const masquage = creerMasquage(scene, camera, modelesDecor);
  const aide = creerAideVue(ui);
  const aideTouches = creerAide(ui);
  const horloge = creerHorloge(ui);
  const miniCarte = creerMiniCarte(ui, { remplirTuile: (ti, tj, donnees) => remplirTuile(terrain, ti, tj, donnees), planMine });
  const compteurImages = creerCompteurImages(ui);
  const cycleJour = creerCycleJour(scene, lumieres, eau);
  const compteur = creerCompteurRessources(ui);
  const effets = creerEffetsRecolte(scene, modelesDecor, (x, z) => terrain.hauteur(x, z));
  if (partie) {
    vues.definirVue(partie.vue);
  }
  entrees.definirVerrouillage(true);
  aide.annoncer(vues.titre);

  const interfaceCombat = creerInterfaceCombat(ui);
  const effetsCombat = creerEffetsCombat(scene, (x, z) => terrain.hauteur(x, z));
  const effetsSorts = creerEffetsSorts(scene);
  const interfaceProgression = creerInterfaceProgression(ui);
  const barreOutils = creerBarreOutils(ui);
  const boussole = creerBoussole(ui);
  const suiviQuetes = creerSuiviQuetes(ui);
  const invite = creerInvite(ui);
  // Options graphiques gardées : appliquées dès le lancement, puis à chaque changement dans le menu pause
  const appliquerGraphismes = creerGraphismes({ scene, camera, lumieres, chunks, compteurImages, dansLaMine: () => mine.dedans });

  return {
    ui,
    renderer,
    scene,
    camera,
    lumieres,
    terrain,
    lieux,
    planCamp,
    planAutel,
    obstaclesLieux,
    planMine,
    eau,
    modelesDecor,
    decor,
    ruines,
    chunks,
    mine,
    maison,
    village,
    habitants,
    personnage,
    bras,
    entrees,
    vues,
    masquage,
    aide,
    aideTouches,
    horloge,
    miniCarte,
    compteurImages,
    cycleJour,
    compteur,
    effets,
    interfaceCombat,
    effetsCombat,
    effetsSorts,
    interfaceProgression,
    barreOutils,
    boussole,
    suiviQuetes,
    invite,
    appliquerGraphismes,
    sons,
    appliquerVolumes,
  };
}

export type Contexte = ReturnType<typeof creerContexte>;
