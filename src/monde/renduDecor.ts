// Affichage du décor, chunk par chunk : un InstancedMesh par modèle et par chunk (une seule
// commande de dessin pour tous les sapins d'un chunk, par exemple), créé et libéré avec le
// chunk de terrain. Tient aussi le registre des éléments affichés : obstacles pour le
// déplacement, élément visé et retrait d'un élément pour la récolte (étape 4).

import * as THREE from 'three';
import { CONFIG } from '../config';
import type { ObstacleCercle } from '../regles/deplacement';
import type { ModeleDecor, ModelesDecor } from '../scene/modelesDecor';
import { creerGenerateurDecor, INFOS_DECOR, type ElementDecor } from './decor';
import type { Terrain, Vecteur3 } from './terrain';

export interface RenduDecor {
  /** Appelés par le gestionnaire de chunks quand un chunk de terrain apparaît ou disparaît. */
  ajouterChunk(cx: number, cz: number): void;
  retirerChunk(cx: number, cz: number): void;
  /** Chunk où se trouve le joueur : règle la distance d'affichage des herbes et petits éléments. */
  definirCentre(cx: number, cz: number): void;
  /** Cercles de collision (arbres, rochers) à moins de `rayon` mètres de (x, z). */
  obstaclesAutour(x: number, z: number, rayon: number): ObstacleCercle[];
  /** Éléments récoltables (tout sauf l'herbe décorative) à moins de `rayon` mètres de (x, z). */
  elementsAutour(x: number, z: number, rayon: number): ElementDecor[];
  /** Premier élément touché par un rayon (origine, direction de longueur 1) à moins de `portee` mètres. */
  elementVise(origine: Vecteur3, direction: Vecteur3, portee: number): ElementDecor | null;
  /** Retire un élément du monde (il ne reviendra pas au rechargement du chunk). Faux s'il est inconnu. */
  retirer(id: string): boolean;
  /** Identifiants des éléments retirés (à sauvegarder), et leur restauration au chargement. */
  retires(): string[];
  definirRetires(ids: Iterable<string>): void;
  /** Retrouve un élément généré par son identifiant `d:gx:gz`, même hors d'un chunk chargé (null si inconnu). */
  chercher(id: string): ElementDecor | null;
  /** Remet un élément retiré à sa place (repousse). Faux s'il n'était pas retiré. */
  restaurer(id: string): boolean;
  /**
   * Ajoute un élément hors génération (arbre planté, buisson cueilli), affiché à part.
   * `facteur` : part de l'échelle de l'élément (croissance) ; `recoltable` : faux = on ne peut pas le viser.
   * Il garde son identifiant ; `retirer(id)` le supprime.
   */
  ajouterDynamique(element: ElementDecor, facteur: number, recoltable: boolean): void;
  /** Change le stade d'un élément dynamique : échelle affichée, récoltable ou non ; collision seulement s'il est récoltable. */
  definirStade(id: string, facteur: number, recoltable: boolean): void;
  /** Nombre d'éléments affichés (herbes comprises). */
  nombreElements(): number;
  liberer(): void;
}

interface Emplacement {
  element: ElementDecor;
  cle: string;
  mesh: THREE.InstancedMesh;
  indice: number;
}

interface ChunkDecor {
  cx: number;
  cz: number;
  meshes: THREE.InstancedMesh[];
  /** Éléments récoltables encore présents */
  elements: ElementDecor[];
  nombre: number;
}

interface Dynamique {
  element: ElementDecor;
  mesh: THREE.Mesh;
  recoltable: boolean;
  /** Rayon de collision de l'élément à maturité */
  rayonCollision: number;
}

const cle = (cx: number, cz: number) => `${cx},${cz}`;

export function creerRenduDecor(
  scene: THREE.Scene,
  terrain: Terrain,
  modeles: ModelesDecor,
  /** Disques où rien n'est généré (devant le portail de la mine) */
  zonesLibres: ReadonlyArray<{ x: number; z: number; rayon: number }> = [],
  /** Vrai là où rien n'est généré non plus (sous les ruines et dans les grottes) */
  exclu?: (x: number, z: number) => boolean,
): RenduDecor {
  const D = CONFIG.decor;
  const taille = CONFIG.monde.tailleChunk;
  const generateur = creerGenerateurDecor(terrain, zonesLibres, exclu);
  const materiauDe = (m: ModeleDecor) => (m.lumineux ? modeles.materiauLumineux : m.grand ? modeles.materiauGrand : modeles.materiauPetit);
  const chunks = new Map<string, ChunkDecor>();
  const emplacements = new Map<string, Emplacement>();
  const dejaRetires = new Set<string>();
  // Éléments retirés dont le chunk est encore chargé : permet de les remettre sans reconstruire le chunk
  const retiresCharges = new Map<string, Emplacement>();
  const dynamiques = new Map<string, Dynamique>();
  const trouves = new Map<string, ElementDecor | null>();
  let centreCx = 0;
  let centreCz = 0;

  // Objets de travail réutilisés
  const matrice = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const echelle = new THREE.Vector3();
  const axeY = new THREE.Vector3(0, 1, 0);
  const couleur = new THREE.Color();
  const matriceVide = new THREE.Matrix4().makeScale(0, 0, 0);

  function reglerVisibilite(c: ChunkDecor): void {
    const d2 = (c.cx - centreCx) ** 2 + (c.cz - centreCz) ** 2;
    for (const mesh of c.meshes) {
      const rayon = mesh.userData.rayonAffichage as number;
      mesh.visible = d2 <= rayon * rayon;
    }
  }

  function ajouterChunk(cx: number, cz: number): void {
    const k = cle(cx, cz);
    if (chunks.has(k)) return;
    const tous = generateur.chunk(cx, cz).filter((e) => !dejaRetires.has(e.id));

    // Un groupe par modèle (type + variante)
    const groupes = new Map<string, ElementDecor[]>();
    for (const e of tous) {
      const g = `${e.type}:${e.variante}`;
      const liste = groupes.get(g);
      if (liste) liste.push(e);
      else groupes.set(g, [e]);
    }

    const c: ChunkDecor = { cx, cz, meshes: [], elements: [], nombre: tous.length };
    const x0 = cx * taille;
    const z0 = cz * taille;
    for (const liste of groupes.values()) {
      const type = liste[0].type;
      const modele = modeles.modele(type, liste[0].variante);
      const mesh = new THREE.InstancedMesh(
        modele.geometrie,
        materiauDe(modele),
        liste.length,
      );
      liste.forEach((e, i) => {
        position.set(e.x - x0, e.y, e.z - z0);
        rotation.setFromAxisAngle(axeY, e.rotation);
        echelle.setScalar(e.echelle);
        mesh.setMatrixAt(i, matrice.compose(position, rotation, echelle));
        // Variation de teinte : luminosité, et un peu plus jaune ou plus bleu pour la végétation
        const lum = 1 + (e.teinte - 0.5) * 2 * D.variationTeinte;
        const chaud = INFOS_DECOR[type].vegetal ? (((e.teinte * 7.13) % 1) - 0.5) * D.variationTeinte : 0;
        mesh.setColorAt(i, couleur.setRGB(lum * (1 + chaud), lum, lum * (1 - chaud)));
        if (type !== 'herbe') {
          emplacements.set(e.id, { element: e, cle: k, mesh, indice: i });
          c.elements.push(e);
        }
      });
      mesh.position.set(x0, 0, z0);
      mesh.matrixAutoUpdate = false; // le décor ne bouge jamais
      mesh.updateMatrix();
      mesh.computeBoundingSphere(); // pour ne pas dessiner les chunks hors du champ de vision
      mesh.castShadow = modele.grand;
      mesh.receiveShadow = true;
      mesh.userData.rayonAffichage = modele.grand ? Infinity : type === 'herbe' ? D.rayonHerbe : D.rayonPetits;
      mesh.name = `décor ${type} ${k}`;
      scene.add(mesh);
      c.meshes.push(mesh);
    }
    reglerVisibilite(c);
    chunks.set(k, c);
  }

  function retirerChunk(cx: number, cz: number): void {
    const k = cle(cx, cz);
    const c = chunks.get(k);
    if (!c) return;
    for (const mesh of c.meshes) {
      scene.remove(mesh);
      mesh.dispose(); // les géométries et matériaux sont partagés : on ne libère que les instances
    }
    for (const e of c.elements) emplacements.delete(e.id);
    for (const [id, emplacement] of retiresCharges) if (emplacement.cle === k) retiresCharges.delete(id);
    chunks.delete(k);
  }

  /** Appelle `visiter` pour chaque élément récoltable à moins de `rayon` de (x, z). */
  function parcourir(x: number, z: number, rayon: number, visiter: (e: ElementDecor, d2: number) => void): void {
    // Marge : un gros rocher du chunk voisin peut déborder
    const marge = rayon + 3;
    const cx0 = Math.floor((x - marge) / taille);
    const cx1 = Math.floor((x + marge) / taille);
    const cz0 = Math.floor((z - marge) / taille);
    const cz1 = Math.floor((z + marge) / taille);
    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = chunks.get(cle(cx, cz));
        if (!c) continue;
        for (const e of c.elements) {
          const dx = e.x - x;
          const dz = e.z - z;
          const d2 = dx * dx + dz * dz;
          const portee = rayon + e.rayonCollision;
          if (d2 <= portee * portee) visiter(e, d2);
        }
      }
    }
    for (const { element: e } of dynamiques.values()) {
      const dx = e.x - x;
      const dz = e.z - z;
      const portee = rayon + e.rayonCollision;
      if (dx * dx + dz * dz <= portee * portee) visiter(e, dx * dx + dz * dz);
    }
  }

  function obstaclesAutour(x: number, z: number, rayon: number): ObstacleCercle[] {
    const obstacles: ObstacleCercle[] = [];
    parcourir(x, z, rayon, (e) => {
      if (e.rayonCollision > 0) obstacles.push({ x: e.x, z: e.z, rayon: e.rayonCollision });
    });
    return obstacles;
  }

  function elementsAutour(x: number, z: number, rayon: number): ElementDecor[] {
    const proches: ElementDecor[] = [];
    parcourir(x, z, rayon, (e) => proches.push(e));
    return proches;
  }

  function elementVise(origine: Vecteur3, direction: Vecteur3, portee: number): ElementDecor | null {
    // On avance le long du rayon par petits pas : le premier élément dont la zone visée
    // (un cylindre vertical) contient le point est la cible
    const candidats = elementsAutour(origine.x, origine.z, portee + 2).filter((e) => dynamiques.get(e.id)?.recoltable !== false);
    if (candidats.length === 0) return null;
    const pas = 0.15;
    for (let d = 0; d <= portee; d += pas) {
      const x = origine.x + direction.x * d;
      const y = origine.y + direction.y * d;
      const z = origine.z + direction.z * d;
      for (const e of candidats) {
        const infos = INFOS_DECOR[e.type];
        const r = infos.rayonVisee * e.echelle;
        if (y < e.y - 0.2 || y > e.y + infos.hauteurVisee * e.echelle + infos.enfoncement * e.echelle) continue;
        if ((e.x - x) ** 2 + (e.z - z) ** 2 <= r * r) return e;
      }
    }
    return null;
  }

  function retirer(id: string): boolean {
    const dyn = dynamiques.get(id);
    if (dyn) {
      scene.remove(dyn.mesh);
      dynamiques.delete(id);
      return true;
    }
    const emplacement = emplacements.get(id);
    dejaRetires.add(id);
    if (!emplacement) return false;
    // L'instance est réduite à un point : elle n'est plus dessinée et ne projette plus d'ombre
    emplacement.mesh.setMatrixAt(emplacement.indice, matriceVide);
    emplacement.mesh.instanceMatrix.needsUpdate = true;
    const c = chunks.get(emplacement.cle);
    if (c) {
      c.elements = c.elements.filter((e) => e.id !== id);
      c.nombre--;
    }
    emplacements.delete(id);
    retiresCharges.set(id, emplacement);
    return true;
  }

  function restaurer(id: string): boolean {
    if (!dejaRetires.delete(id)) return false;
    const emplacement = retiresCharges.get(id);
    retiresCharges.delete(id);
    const c = emplacement ? chunks.get(emplacement.cle) : undefined;
    if (emplacement && c) {
      // Le chunk est toujours là : l'instance masquée reprend sa place
      const e = emplacement.element;
      position.set(e.x - c.cx * taille, e.y, e.z - c.cz * taille);
      rotation.setFromAxisAngle(axeY, e.rotation);
      echelle.setScalar(e.echelle);
      emplacement.mesh.setMatrixAt(emplacement.indice, matrice.compose(position, rotation, echelle));
      emplacement.mesh.instanceMatrix.needsUpdate = true;
      c.elements.push(e);
      c.nombre++;
      emplacements.set(id, emplacement);
    }
    // Sinon le chunk était déchargé : l'élément reviendra à sa prochaine construction
    return true;
  }

  function chercher(id: string): ElementDecor | null {
    if (trouves.has(id)) return trouves.get(id) ?? null;
    let resultat: ElementDecor | null = null;
    const m = /^d:(-?\d+):(-?\d+)$/.exec(id);
    if (m) {
      // Case de décor -> chunk qui la contient
      const n = Math.round(taille / D.tailleCase);
      const cx = Math.floor(Number(m[1]) / n);
      const cz = Math.floor(Number(m[2]) / n);
      resultat = generateur.chunk(cx, cz).find((e) => e.id === id) ?? null;
    }
    trouves.set(id, resultat);
    return resultat;
  }

  function ajouterDynamique(element: ElementDecor, facteur: number, recoltable: boolean): void {
    const ancien = dynamiques.get(element.id);
    if (ancien) scene.remove(ancien.mesh);
    const modele = modeles.modele(element.type, element.variante);
    const mesh = new THREE.Mesh(modele.geometrie, materiauDe(modele));
    mesh.position.set(element.x, element.y, element.z);
    mesh.rotation.y = element.rotation;
    mesh.castShadow = modele.grand;
    mesh.receiveShadow = true;
    mesh.name = `décor ${element.type} ${element.id}`;
    scene.add(mesh);
    const dyn: Dynamique = { element, mesh, recoltable, rayonCollision: element.rayonCollision };
    dynamiques.set(element.id, dyn);
    definirStade(element.id, facteur, recoltable);
  }

  function definirStade(id: string, facteur: number, recoltable: boolean): void {
    const dyn = dynamiques.get(id);
    if (!dyn) return;
    dyn.recoltable = recoltable;
    dyn.element.rayonCollision = recoltable ? dyn.rayonCollision : 0;
    dyn.mesh.scale.setScalar(dyn.element.echelle * facteur);
  }

  return {
    ajouterChunk,
    retirerChunk,
    definirCentre(cx, cz) {
      if (cx === centreCx && cz === centreCz) return;
      centreCx = cx;
      centreCz = cz;
      for (const c of chunks.values()) reglerVisibilite(c);
    },
    obstaclesAutour,
    elementsAutour,
    elementVise,
    retirer,
    chercher,
    restaurer,
    ajouterDynamique,
    definirStade,
    retires: () => [...dejaRetires],
    definirRetires(ids) {
      for (const id of ids) retirer(id);
    },
    nombreElements() {
      let n = 0;
      for (const c of chunks.values()) n += c.nombre;
      return n;
    },
    liberer() {
      for (const c of [...chunks.values()]) retirerChunk(c.cx, c.cz);
      for (const d of dynamiques.values()) scene.remove(d.mesh);
      dynamiques.clear();
    },
  };
}
