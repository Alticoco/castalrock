// Affichage des ruines et des petites grottes, chunk par chunk : chaque site apparaît et disparaît avec le chunk de
// terrain qui porte son centre (une géométrie par site, matériau partagé). Tient aussi le registre des sites affichés
// (coffres, cristaux des grottes) et anime le couvercle des coffres. Les collisions et les emprises viennent du
// générateur (src/monde/ruines.ts) : elles ne dépendent pas de ce qui est affiché.

import * as THREE from 'three';
import { CONFIG } from '../config';
import type { ObstacleCercle } from '../regles/deplacement';
import { creerModelesRuines, type ModeleCoffre } from '../scene/modelesRuines';
import type { ElementDecor } from './decor';
import { creerGenerateurRuines, type Site } from './ruines';
import type { Terrain } from './terrain';

export interface RenduRuines {
  /** Appelés par le gestionnaire de chunks quand un chunk de terrain apparaît ou disparaît. */
  ajouterChunk(cx: number, cz: number): void;
  retirerChunk(cx: number, cz: number): void;
  /** Cercles de collision (murs, colonnes, parois, coffres) à moins de `rayon` mètres de (x, z). */
  obstaclesAutour(x: number, z: number, rayon: number): ObstacleCercle[];
  /** Vrai si (x, z) est sous une pièce de ruine ou dans une grotte : le décor n'y pousse pas. */
  dansEmprise(x: number, z: number): boolean;
  /** Cristal de grotte d'après son identifiant (null s'il n'existe pas). */
  cristal(id: string): ElementDecor | null;
  /** Sites actuellement affichés. */
  sitesCharges(): Iterable<Site>;
  /** Coffres déjà ouverts (partie chargée) : ils sont montrés couvercle levé. */
  definirCoffresOuverts(ids: Iterable<string>): void;
  /** Ouvre un coffre : son couvercle se lève. */
  ouvrirCoffre(id: string): void;
  /** À chaque image : animation des couvercles. */
  mettreAJour(dt: number): void;
  /** Nombre de sites affichés. */
  nombreSites(): number;
  liberer(): void;
}

interface SiteAffiche {
  site: Site;
  meshes: THREE.Mesh[];
  coffre: ModeleCoffre | null;
  /** Ouverture actuelle du couvercle, de 0 à 1 */
  ouverture: number;
}

const cle = (cx: number, cz: number) => `${cx},${cz}`;

export function creerRenduRuines(
  scene: THREE.Scene,
  terrain: Terrain,
  /** Disques déjà occupés (entrée de la mine, campement d'Aldric, lieux de l'histoire) : aucun site autour */
  zones: ReadonlyArray<{ x: number; z: number; rayon: number }> = [],
): RenduRuines {
  const generateur = creerGenerateurRuines(terrain, zones);
  const modeles = creerModelesRuines();
  const chunks = new Map<string, SiteAffiche[]>();
  const affiches = new Map<string, SiteAffiche>();
  const ouverts = new Set<string>();
  // Coffres dont le couvercle est en train de se lever
  const enMouvement = new Set<SiteAffiche>();

  function creerMesh(geometrie: THREE.BufferGeometry, materiau: THREE.Material, site: Site, ombre: boolean): THREE.Mesh {
    const mesh = new THREE.Mesh(geometrie, materiau);
    mesh.position.set(site.x, site.y, site.z);
    mesh.matrixAutoUpdate = false; // les ruines ne bougent jamais
    mesh.updateMatrix();
    mesh.castShadow = ombre;
    mesh.receiveShadow = ombre;
    mesh.name = `${site.genre} ${site.id}`;
    scene.add(mesh);
    return mesh;
  }

  function ajouterChunk(cx: number, cz: number): void {
    const k = cle(cx, cz);
    if (chunks.has(k)) return;
    const liste: SiteAffiche[] = [];
    for (const site of generateur.sitesDuChunk(cx, cz)) {
      // (le sol sert à l'habillage : herbes et pierres tombées posées sur le terrain)
      const g = modeles.geometries(site.blocs, (x, z) => terrain.hauteur(site.x + x, site.z + z) - site.y);
      const meshes = [creerMesh(g.solide, modeles.materiau, site, true)];
      if (g.lumineux) meshes.push(creerMesh(g.lumineux, modeles.materiauLumineux, site, false));
      let coffre: ModeleCoffre | null = null;
      if (site.coffre) {
        coffre = modeles.creerCoffre();
        coffre.objet.position.set(site.coffre.x, site.coffre.y, site.coffre.z);
        coffre.objet.rotation.y = site.coffre.lacet;
        scene.add(coffre.objet);
      }
      const ouverture = site.coffre && ouverts.has(site.coffre.id) ? 1 : 0;
      coffre?.definirOuverture(ouverture);
      const affiche: SiteAffiche = { site, meshes, coffre, ouverture };
      liste.push(affiche);
      affiches.set(site.id, affiche);
    }
    chunks.set(k, liste);
  }

  function retirerChunk(cx: number, cz: number): void {
    const k = cle(cx, cz);
    const liste = chunks.get(k);
    if (!liste) return;
    for (const a of liste) {
      for (const mesh of a.meshes) {
        scene.remove(mesh);
        mesh.geometry.dispose(); // la géométrie est propre au site ; les matériaux sont partagés
      }
      if (a.coffre) scene.remove(a.coffre.objet); // (géométries du coffre partagées : rien à libérer)
      affiches.delete(a.site.id);
      enMouvement.delete(a);
    }
    chunks.delete(k);
  }

  function* sitesCharges(): Iterable<Site> {
    for (const a of affiches.values()) yield a.site;
  }

  function trouverCoffre(id: string): SiteAffiche | null {
    for (const a of affiches.values()) if (a.site.coffre?.id === id) return a;
    return null;
  }

  return {
    ajouterChunk,
    retirerChunk,
    obstaclesAutour: generateur.obstaclesAutour,
    dansEmprise: generateur.dansEmprise,
    cristal: generateur.cristal,
    sitesCharges,
    definirCoffresOuverts(ids) {
      ouverts.clear();
      for (const id of ids) ouverts.add(id);
      for (const a of affiches.values()) {
        if (!a.site.coffre || !a.coffre) continue;
        a.ouverture = ouverts.has(a.site.coffre.id) ? 1 : 0;
        a.coffre.definirOuverture(a.ouverture);
      }
    },
    ouvrirCoffre(id) {
      ouverts.add(id);
      const a = trouverCoffre(id);
      if (a) enMouvement.add(a);
    },
    mettreAJour(dt) {
      for (const a of enMouvement) {
        a.ouverture = Math.min(1, a.ouverture + dt / CONFIG.ruines.coffre.dureeOuverture);
        // Départ vif, arrivée douce
        a.coffre?.definirOuverture(1 - (1 - a.ouverture) ** 2);
        if (a.ouverture >= 1) enMouvement.delete(a);
      }
    },
    nombreSites: () => affiches.size,
    liberer() {
      for (const liste of [...chunks.values()]) {
        for (const a of liste) {
          for (const mesh of a.meshes) {
            scene.remove(mesh);
            mesh.geometry.dispose();
          }
          if (a.coffre) scene.remove(a.coffre.objet);
        }
      }
      chunks.clear();
      affiches.clear();
      enMouvement.clear();
      modeles.liberer();
    },
  };
}
