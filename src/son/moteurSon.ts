// Moteur des sons : charge les fichiers du catalogue, les joue « dans la tête » (pas du joueur, coups reçus)
// ou placés dans le monde (on les entend venir de leur direction, plus faibles de loin), et la musique de l'auberge.
// L'oreille est attachée à la caméra (THREE.AudioListener) : elle suit la tête du joueur à chaque image.
// Le navigateur n'autorise le son qu'après un premier clic ou une touche : on le réveille à ce moment-là.
import * as THREE from 'three';
import { CONFIG } from '../config';
import { MUSIQUE_AUBERGE, SONS, fichiersDuCatalogue, type DefinitionSon, type NomSon } from './catalogue';
import { choisirVariante, tirerEntre } from './choix';

export interface PositionSon {
  x: number;
  y: number;
  z: number;
}

export interface OptionsSon {
  /** Position dans le monde ; sans position, le son est joué sans direction */
  position?: PositionSon;
  /** Multiplie le volume du catalogue */
  volume?: number;
  /** Multiplie la hauteur tirée dans le catalogue */
  hauteur?: number;
}

export interface VolumesSon {
  general: number;
  effets: number;
  musique: number;
}

export interface MusiqueAuberge {
  /** Place la source de la musique (l'auberge). */
  placer(position: PositionSon): void;
  /** Lance la musique (montée douce) ou l'arrête (descente douce, puis pause). */
  definirActive(active: boolean): void;
}

export interface MoteurSon {
  jouer(nom: NomSon, options?: OptionsSon): void;
  appliquerVolumes(volumes: VolumesSon): void;
  readonly musiqueAuberge: MusiqueAuberge;
}

// Plus petit pic pris en compte pour la mise au même niveau (évite de trop gonfler un fichier presque muet)
const PIC_MIN = 0.05;

/** Plus grande valeur absolue d'un son, tous canaux confondus. */
function picDe(tampon: AudioBuffer): number {
  let pic = 0;
  for (let c = 0; c < tampon.numberOfChannels; c++) {
    const donnees = tampon.getChannelData(c);
    for (let i = 0; i < donnees.length; i++) {
      const a = Math.abs(donnees[i]);
      if (a > pic) pic = a;
    }
  }
  return pic;
}

function creerPanoramique(ac: AudioContext, modele: DistanceModelType, distanceRef: number, distanceMax: number): PannerNode {
  const p = ac.createPanner();
  p.panningModel = 'HRTF';
  p.distanceModel = modele;
  p.refDistance = distanceRef;
  p.maxDistance = distanceMax;
  p.rolloffFactor = 1;
  return p;
}

function placerPanoramique(p: PannerNode, position: PositionSon): void {
  p.positionX.value = position.x;
  p.positionY.value = position.y;
  p.positionZ.value = position.z;
}

export function creerMoteurSon(camera: THREE.Camera): MoteurSon {
  const C = CONFIG.sons;
  const ecouteur = new THREE.AudioListener();
  camera.add(ecouteur);
  const ac = ecouteur.context;
  // Deux voies, chacune avec son curseur de volume ; le volume général est celui de l'oreille
  const voieEffets = ac.createGain();
  voieEffets.connect(ecouteur.getInput());
  const voieMusique = ac.createGain();
  voieMusique.connect(ecouteur.getInput());
  // Compresseur en sortie : plusieurs sons forts ensemble (arbre abattu, cris, parade) ne saturent pas
  ecouteur.setFilter(ac.createDynamicsCompressor());

  // Sons décodés, avec le gain qui ramène leur pic à 1 (chemins relatifs à la page)
  const tampons = new Map<string, { tampon: AudioBuffer; gain: number }>();
  const dernieresVariantes = new Map<NomSon, number>();
  // Instant (horloge du son) où chaque son a été joué pour la dernière fois
  const derniersInstants = new Map<NomSon, number>();
  let voix = 0;
  const oreille = new THREE.Vector3();

  async function charger(fichier: string): Promise<void> {
    try {
      const reponse = await fetch(`sons/${fichier}`);
      if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
      const tampon = await ac.decodeAudioData(await reponse.arrayBuffer());
      tampons.set(fichier, { tampon, gain: 1 / Math.max(picDe(tampon), PIC_MIN) });
    } catch (erreur) {
      // Fichier absent ou illisible : cette variante restera muette (les autres la remplacent)
      console.warn(`Son non chargé : sons/${fichier}`, erreur);
    }
  }
  for (const fichier of fichiersDuCatalogue()) void charger(fichier);

  function jouer(nom: NomSon, options: OptionsSon = {}): void {
    if (ac.state !== 'running' || voix >= C.voixMax) return;
    // Le même son à l'instant près (une meute qui crie ensemble) : un seul suffit
    if (ac.currentTime - (derniersInstants.get(nom) ?? -Infinity) < C.ecartMemeSon) return;
    const def: DefinitionSon = SONS[nom];
    const { position } = options;
    if (position) {
      ecouteur.getWorldPosition(oreille);
      if (Math.hypot(position.x - oreille.x, position.y - oreille.y, position.z - oreille.z) > C.portee) return;
    }
    let i = choisirVariante(def.fichiers.length, dernieresVariantes.get(nom) ?? -1, Math.random);
    // Variante tirée pas (encore) chargée : la première qui l'est la remplace
    if (!tampons.has(def.fichiers[i])) i = def.fichiers.findIndex((f) => tampons.has(f));
    const charge = i >= 0 ? tampons.get(def.fichiers[i]) : undefined;
    if (!charge) return;
    dernieresVariantes.set(nom, i);
    derniersInstants.set(nom, ac.currentTime);

    const source = ac.createBufferSource();
    source.buffer = charge.tampon;
    source.playbackRate.value = tirerEntre(def.hauteur[0], def.hauteur[1], Math.random) * (options.hauteur ?? 1);
    const gain = ac.createGain();
    gain.gain.value = def.volume * charge.gain * (options.volume ?? 1);
    source.connect(gain);
    let sortie: AudioNode = gain;
    if (position) {
      const panoramique = creerPanoramique(ac, 'inverse', C.distanceRef, C.portee);
      placerPanoramique(panoramique, position);
      gain.connect(panoramique);
      sortie = panoramique;
    }
    sortie.connect(voieEffets);
    voix++;
    source.onended = () => {
      voix--;
      source.disconnect();
      gain.disconnect();
      if (sortie !== gain) sortie.disconnect();
    };
    source.start();
  }

  // --- Musique de l'auberge : lue au fil de l'eau par un élément <audio>, branchée sur une source placée ---
  const M = C.musiqueAuberge;
  const lecteur = new Audio(`sons/${MUSIQUE_AUBERGE}`);
  lecteur.loop = true;
  lecteur.preload = 'auto';
  const fonduMusique = ac.createGain();
  fonduMusique.gain.value = 0;
  const panoramiqueMusique = creerPanoramique(ac, 'linear', M.distanceRef, M.distanceMax);
  ac.createMediaElementSource(lecteur).connect(fonduMusique).connect(panoramiqueMusique).connect(voieMusique);
  let musiqueActive = false;
  let arretPrevu: number | undefined;

  function lancerLecteur(): void {
    if (musiqueActive && lecteur.paused && ac.state === 'running') lecteur.play().catch(() => {});
  }

  const musiqueAuberge: MusiqueAuberge = {
    placer: (position) => placerPanoramique(panoramiqueMusique, position),
    definirActive(active) {
      if (active === musiqueActive) return;
      musiqueActive = active;
      const t = ac.currentTime;
      fonduMusique.gain.cancelScheduledValues(t);
      fonduMusique.gain.setValueAtTime(fonduMusique.gain.value, t);
      fonduMusique.gain.linearRampToValueAtTime(active ? 1 : 0, t + M.fondu);
      window.clearTimeout(arretPrevu);
      if (active) {
        lancerLecteur();
      } else {
        arretPrevu = window.setTimeout(() => {
          if (!musiqueActive) lecteur.pause();
        }, M.fondu * 1000 + 100);
      }
    },
  };

  // Réveil du son au premier geste du joueur (et aux suivants si le navigateur l'a rendormi)
  function reveiller(): void {
    if (ac.state !== 'running') ac.resume().then(lancerLecteur, () => {});
    else lancerLecteur();
  }
  window.addEventListener('pointerdown', reveiller, true);
  window.addEventListener('keydown', reveiller, true);
  // Onglet caché : le jeu s'arrête, le son aussi (sinon la musique de l'auberge tournerait sans fin)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void ac.suspend().catch(() => {});
    else reveiller();
  });

  return {
    jouer,
    appliquerVolumes(volumes) {
      ecouteur.setMasterVolume(volumes.general);
      voieEffets.gain.value = volumes.effets;
      voieMusique.gain.value = volumes.musique;
    },
    musiqueAuberge,
  };
}
