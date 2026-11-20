// Effets visuels des sorts : boule de feu lumineuse orangée avec traînée, explosion, halo vert
// qui monte autour du joueur pour le soin, et effets tenus dans la main gauche en 1re personne
// (flamme dans la paume, lueur verte). Aucune règle de jeu ici. L'aléatoire de ces effets
// n'a pas besoin d'être reproductible.

import * as THREE from 'three';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface EffetsSorts {
  /** Montre la boule de feu `id` à cette position (la crée au premier appel) et laisse une traînée. */
  deplacerBoule(id: number, x: number, y: number, z: number): void;
  /** Retire la boule de feu (elle a touché quelque chose ou s'est éteinte). */
  retirerBoule(id: number): void;
  /** Explosion centrée en (x, y, z) ; `rayon` est le rayon des dégâts, en mètres. */
  explosion(x: number, y: number, z: number, rayon: number): void;
  /** Halo vert qui monte autour du joueur ; `position` donne ses pieds (il suit le personnage). */
  soin(position: () => Point3D): void;
  /**
   * Dôme bleuté de la barrière autour du joueur, à appeler à chaque image : ses pieds et sa force (0 à 1, il
   * pâlit en s'éteignant), ou `null` quand il n'y a pas de barrière. Matériaux sans éclairage : aucune lumière.
   */
  barriere(etat: (Point3D & { force: number }) | null): void;
  mettreAJour(dt: number): void;
  liberer(): void;
}

const MAX_PARTICULES = 260;
const alea = (min: number, max: number) => min + Math.random() * (max - min);

/** Un élément éphémère : il grossit (ou rétrécit), s'estompe, se déplace et disparaît. */
interface Particule {
  mesh: THREE.Mesh;
  materiau: THREE.MeshBasicMaterial;
  age: number;
  duree: number;
  tailleDebut: number;
  tailleFin: number;
  opacite: number;
  vitesse: THREE.Vector3;
  /** Si présent, la position est `ancre() + decalage + vitesse × age` (le halo suit le joueur) */
  ancre?: () => Point3D;
  /** Position de départ relative à l'ancre */
  decalage: THREE.Vector3;
}

interface Boule {
  groupe: THREE.Group;
  halo: THREE.Mesh;
  derniere: THREE.Vector3;
  /** Secondes depuis le départ : la boule part petite (de la paume) et grossit très vite */
  age: number;
}

// La boule de feu part à cette fraction de sa taille et atteint sa taille normale en ce temps (secondes)
const TAILLE_DEPART_BOULE = 0.3;
const DUREE_CROISSANCE_BOULE = 0.12;

export interface EffetMain {
  /** À placer dans le repère des bras (celui de la caméra), au creux de la paume gauche. */
  objet: THREE.Group;
  /** `flamme` et `lueur` : intensités de 0 (rien) à 1 (flamme pleine dans la paume, lueur verte du soin). */
  mettreAJour(dt: number, flamme: number, lueur: number): void;
}

const ETINCELLES_SOIN = 7;

/** Tache ronde aux bords fondus, pour les lueurs (dessinée une fois, sans fichier image). */
function creerTextureLueur(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const dessin = canvas.getContext('2d');
  if (dessin) {
    const degrade = dessin.createRadialGradient(32, 32, 0, 32, 32, 32);
    degrade.addColorStop(0, 'rgba(255, 255, 255, 1)');
    degrade.addColorStop(0.35, 'rgba(255, 255, 255, 0.45)');
    degrade.addColorStop(1, 'rgba(255, 255, 255, 0)');
    dessin.fillStyle = degrade;
    dessin.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(canvas);
}

/**
 * Effets tenus dans la main gauche en 1re personne : petite flamme qui grossit dans la paume (boule
 * de feu) et lueur verte avec des étincelles qui montent (soin). Aucune lumière three : seulement
 * des matériaux lumineux par eux-mêmes et des sprites.
 */
export function creerEffetMain(): EffetMain {
  const objet = new THREE.Group();
  objet.visible = false;
  const texture = creerTextureLueur();
  const sphere = new THREE.IcosahedronGeometry(1, 1);
  const eclat = new THREE.OctahedronGeometry(1);
  const additif = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };

  // Flamme : cœur clair, enveloppe orangée étirée vers le haut, lueur diffuse autour
  const flamme = new THREE.Group();
  const coeur = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0xffe08a }));
  const enveloppe = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0xff7a20, opacity: 0.6, ...additif }));
  const lueurFeu = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, color: 0xff8a2a, opacity: 0.8, ...additif }));
  enveloppe.renderOrder = 5;
  lueurFeu.renderOrder = 5;
  flamme.add(coeur, enveloppe, lueurFeu);
  objet.add(flamme);

  // Soin : lueur verte autour de la main, étincelles qui montent en boucle
  const soin = new THREE.Group();
  const materiauLueurSoin = new THREE.SpriteMaterial({ map: texture, color: 0x6fe05a, ...additif });
  const lueurSoin = new THREE.Sprite(materiauLueurSoin);
  lueurSoin.renderOrder = 5;
  soin.add(lueurSoin);
  const etincelles: Array<{ mesh: THREE.Mesh; materiau: THREE.MeshBasicMaterial; phase: number; angle: number; rayon: number }> = [];
  for (let i = 0; i < ETINCELLES_SOIN; i++) {
    const materiau = new THREE.MeshBasicMaterial({ color: i % 2 ? 0x8cf07a : 0xc8ffb8, ...additif });
    const mesh = new THREE.Mesh(eclat, materiau);
    mesh.renderOrder = 5;
    soin.add(mesh);
    etincelles.push({ mesh, materiau, phase: i / ETINCELLES_SOIN, angle: alea(0, Math.PI * 2), rayon: alea(0.03, 0.09) });
  }
  objet.add(soin);

  let temps = 0;

  return {
    objet,
    mettreAJour(dt, intensiteFlamme, intensiteLueur) {
      temps += dt;
      flamme.visible = intensiteFlamme > 0.001;
      soin.visible = intensiteLueur > 0.001;
      objet.visible = flamme.visible || soin.visible;
      if (flamme.visible) {
        // La flamme tremble en grossissant
        const f = intensiteFlamme * (1 + 0.1 * Math.sin(temps * 43));
        coeur.scale.setScalar(0.026 * f);
        enveloppe.scale.set(0.046 * f, 0.062 * f * (1 + 0.12 * Math.sin(temps * 31)), 0.046 * f);
        enveloppe.position.y = 0.016 * f;
        lueurFeu.scale.setScalar(0.3 * f);
      }
      if (soin.visible) {
        lueurSoin.scale.setScalar(0.42 * (0.85 + 0.15 * Math.sin(temps * 9)));
        materiauLueurSoin.opacity = 0.6 * intensiteLueur;
        for (const e of etincelles) {
          e.phase = (e.phase + dt * 1.5) % 1;
          e.mesh.position.set(Math.cos(e.angle) * e.rayon, -0.04 + 0.26 * e.phase, Math.sin(e.angle) * e.rayon);
          e.mesh.scale.setScalar(0.011 * (1 - 0.5 * e.phase));
          e.materiau.opacity = 0.95 * intensiteLueur * Math.sin(Math.PI * e.phase);
        }
      }
    },
  };
}

export function creerEffetsSorts(scene: THREE.Scene): EffetsSorts {
  const racine = new THREE.Group();
  scene.add(racine);

  const sphere = new THREE.IcosahedronGeometry(1, 1);
  const eclat = new THREE.OctahedronGeometry(1);
  const anneau = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
  const particules: Particule[] = [];
  const boules = new Map<number, Boule>();

  const materiauNoyau = new THREE.MeshBasicMaterial({ color: 0xffe08a });
  const materiauHalo = new THREE.MeshBasicMaterial({
    color: 0xff7a20,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  /** Matériau lumineux (additif, translucide) propre à une particule. */
  function lumineux(couleur: number, opacite: number, deuxFaces = false): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      color: couleur,
      transparent: true,
      opacity: opacite,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: deuxFaces ? THREE.DoubleSide : THREE.FrontSide,
    });
  }

  function retirerParticule(p: Particule): void {
    racine.remove(p.mesh);
    p.materiau.dispose();
  }

  function ajouter(p: Particule): void {
    if (particules.length >= MAX_PARTICULES) {
      const vieille = particules.shift();
      if (vieille) retirerParticule(vieille);
    }
    racine.add(p.mesh);
    particules.push(p);
  }

  function creer(
    geometrie: THREE.BufferGeometry,
    couleur: number,
    opacite: number,
    pos: Point3D,
    duree: number,
    tailleDebut: number,
    tailleFin: number,
    vitesse = new THREE.Vector3(),
    options: { ancre?: () => Point3D; deuxFaces?: boolean } = {},
  ): THREE.Mesh {
    const materiau = lumineux(couleur, opacite, options.deuxFaces);
    const mesh = new THREE.Mesh(geometrie, materiau);
    mesh.scale.setScalar(tailleDebut);
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.renderOrder = 5;
    const base = options.ancre ? options.ancre() : { x: 0, y: 0, z: 0 };
    ajouter({
      mesh,
      materiau,
      age: 0,
      duree,
      tailleDebut,
      tailleFin,
      opacite,
      vitesse,
      ancre: options.ancre,
      decalage: new THREE.Vector3(pos.x - base.x, pos.y - base.y, pos.z - base.z),
    });
    return mesh;
  }

  // Barrière : coque translucide, trame de facettes et éclats qui tournent autour du joueur
  const RAYON_BARRIERE = 1.35;
  const dome = new THREE.Group();
  dome.visible = false;
  // Couleurs pleines et translucides (pas d'addition : sur un ciel clair, elle virerait au blanc)
  const bleute = (couleur: number, opacite: number, deuxFaces = false) =>
    new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: opacite, depthWrite: false, side: deuxFaces ? THREE.DoubleSide : THREE.FrontSide });
  const materiauCoque = bleute(0x3f8cff, 0.13, true);
  const materiauTrame = bleute(0x2f7df0, 0.3);
  materiauTrame.wireframe = true;
  const materiauEclat = bleute(0x9fd0ff, 0.85, true);
  const coque = new THREE.Mesh(sphere, materiauCoque);
  coque.scale.setScalar(RAYON_BARRIERE);
  const trame = new THREE.Mesh(sphere, materiauTrame);
  trame.scale.setScalar(RAYON_BARRIERE);
  coque.renderOrder = 5;
  trame.renderOrder = 5;
  dome.add(coque, trame);
  const eclatsBarriere: THREE.Mesh[] = [];
  for (let k = 0; k < 7; k++) {
    const m = new THREE.Mesh(eclat, materiauEclat);
    m.renderOrder = 5;
    eclatsBarriere.push(m);
    dome.add(m);
  }
  racine.add(dome);
  let forceBarriere = 0;

  let temps = 0;

  return {
    deplacerBoule(id, x, y, z) {
      let boule = boules.get(id);
      if (!boule) {
        const groupe = new THREE.Group();
        const noyau = new THREE.Mesh(sphere, materiauNoyau);
        noyau.scale.setScalar(0.17);
        const halo = new THREE.Mesh(sphere, materiauHalo);
        halo.scale.setScalar(0.4);
        halo.renderOrder = 5;
        groupe.add(noyau, halo);
        groupe.position.set(x, y, z);
        groupe.scale.setScalar(TAILLE_DEPART_BOULE);
        racine.add(groupe);
        boule = { groupe, halo, derniere: new THREE.Vector3(x, y, z), age: 0 };
        boules.set(id, boule);
      }
      boule.groupe.position.set(x, y, z);
      const tailleTrainee = 0.22 * boule.groupe.scale.x;
      // Traînée : une petite flamme tous les 30 cm, qui rétrécit en s'éteignant
      while (boule.derniere.distanceTo(boule.groupe.position) > 0.3) {
        const dir = boule.groupe.position.clone().sub(boule.derniere).normalize();
        boule.derniere.addScaledVector(dir, 0.3);
        creer(
          sphere,
          Math.random() < 0.5 ? 0xff8a2a : 0xffc04a,
          0.6,
          { x: boule.derniere.x + alea(-0.05, 0.05), y: boule.derniere.y + alea(-0.05, 0.05), z: boule.derniere.z + alea(-0.05, 0.05) },
          alea(0.25, 0.4),
          tailleTrainee,
          0.04,
          new THREE.Vector3(alea(-0.3, 0.3), alea(0.2, 0.7), alea(-0.3, 0.3)),
        );
      }
    },

    retirerBoule(id) {
      const boule = boules.get(id);
      if (!boule) return;
      racine.remove(boule.groupe);
      boules.delete(id);
    },

    explosion(x, y, z, rayon) {
      const centre = { x, y, z };
      // Boule de feu qui gonfle, noyau blanc-jaune plus court, puis étincelles projetées
      creer(sphere, 0xff6a1a, 0.7, centre, 0.4, 0.4, rayon * 0.9);
      creer(sphere, 0xffe8a0, 0.9, centre, 0.25, 0.3, rayon * 0.45);
      for (let i = 0; i < 16; i++) {
        const angle = alea(0, Math.PI * 2);
        const force = alea(3, 7);
        creer(
          eclat,
          Math.random() < 0.5 ? 0xff8a2a : 0xffd45a,
          0.9,
          centre,
          alea(0.35, 0.65),
          alea(0.08, 0.16),
          0.01,
          new THREE.Vector3(Math.sin(angle) * force, alea(1, 5), Math.cos(angle) * force),
        );
      }
    },

    soin(position) {
      const pieds = position();
      // Colonne de lumière verte qui monte le long du corps
      creer(anneau, 0x6fe05a, 0.55, pieds, 1, 0.9, 0.9, new THREE.Vector3(0, 1.5, 0), { ancre: position, deuxFaces: true }).scale.set(0.9, 0.5, 0.9);
      // Petites étincelles qui montent autour
      for (let i = 0; i < 14; i++) {
        const angle = alea(0, Math.PI * 2);
        const r = alea(0.35, 0.8);
        creer(
          eclat,
          Math.random() < 0.5 ? 0x8cf07a : 0xc8ffb8,
          0.85,
          { x: pieds.x + Math.sin(angle) * r, y: pieds.y + alea(0, 0.8), z: pieds.z + Math.cos(angle) * r },
          alea(0.7, 1.1),
          alea(0.06, 0.12),
          0.02,
          new THREE.Vector3(0, alea(1, 1.8), 0),
          { ancre: position },
        );
      }
    },

    barriere(etat) {
      if (!etat) {
        dome.visible = false;
        return;
      }
      if (!dome.visible) {
        // Apparition : une onde bleue qui gonfle jusqu'au dôme
        creer(sphere, 0x6ab6ff, 0.55, { x: etat.x, y: etat.y + 1, z: etat.z }, 0.45, 0.3, RAYON_BARRIERE * 1.15);
      }
      dome.visible = true;
      dome.position.set(etat.x, etat.y + 1, etat.z);
      forceBarriere = etat.force;
    },

    mettreAJour(dt) {
      temps += dt;
      if (dome.visible) {
        const palpite = 0.85 + 0.15 * Math.sin(temps * 3.2);
        materiauCoque.opacity = 0.13 * palpite * forceBarriere;
        materiauTrame.opacity = 0.3 * palpite * forceBarriere;
        materiauEclat.opacity = 0.85 * forceBarriere;
        trame.rotation.y = temps * 0.25;
        for (let k = 0; k < eclatsBarriere.length; k++) {
          const angle = temps * 1.3 + (k * Math.PI * 2) / eclatsBarriere.length;
          const m = eclatsBarriere[k];
          m.position.set(Math.sin(angle) * 1.2, 0.15 + 0.45 * Math.sin(temps * 1.7 + k * 1.9), Math.cos(angle) * 1.2);
          m.rotation.set(temps * 2 + k, temps * 1.4, 0);
          m.scale.set(0.02, 0.05, 0.02);
        }
      }
      for (const boule of boules.values()) {
        // Le halo palpite
        boule.halo.scale.setScalar(0.4 + 0.06 * Math.sin(temps * 30));
        boule.age += dt;
        const croissance = Math.min(1, boule.age / DUREE_CROISSANCE_BOULE);
        boule.groupe.scale.setScalar(TAILLE_DEPART_BOULE + (1 - TAILLE_DEPART_BOULE) * croissance);
      }
      for (let i = particules.length - 1; i >= 0; i--) {
        const p = particules[i];
        p.age += dt;
        if (p.age >= p.duree) {
          retirerParticule(p);
          particules.splice(i, 1);
          continue;
        }
        const k = p.age / p.duree;
        const taille = p.tailleDebut + (p.tailleFin - p.tailleDebut) * k;
        if (p.mesh.geometry === anneau) p.mesh.scale.set(taille, 0.5, taille);
        else p.mesh.scale.setScalar(taille);
        p.materiau.opacity = p.opacite * (1 - k);
        if (p.ancre) {
          const base = p.ancre();
          p.mesh.position.set(
            base.x + p.decalage.x + p.vitesse.x * p.age,
            base.y + p.decalage.y + p.vitesse.y * p.age,
            base.z + p.decalage.z + p.vitesse.z * p.age,
          );
        } else {
          p.mesh.position.addScaledVector(p.vitesse, dt);
          p.vitesse.multiplyScalar(Math.exp(-2 * dt));
        }
      }
    },

    liberer() {
      scene.remove(racine);
      for (const p of particules) p.materiau.dispose();
      particules.length = 0;
      boules.clear();
      sphere.dispose();
      eclat.dispose();
      anneau.dispose();
      materiauNoyau.dispose();
      materiauHalo.dispose();
      materiauCoque.dispose();
      materiauTrame.dispose();
      materiauEclat.dispose();
    },
  };
}
