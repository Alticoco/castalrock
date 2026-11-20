// Combat : ennemis présents, apparitions, dégâts reçus et infligés, mort d'un ennemi, tremblement de caméra.
import * as THREE from 'three';
import { CONFIG } from '../config';
import { compter } from '../regles/inventaire';
import { ID_ECLAT_COEUR, mettreAAbri, pilesDuButin, repartirButin } from '../regles/butin';
import type { Pile } from '../regles/inventaire';
import { facteurDegats, reductionTotale } from '../regles/equipement';
import {
  bonusReductionArmure,
  facteurDegatsEpee,
  manaMax,
  pasMana,
  pvMax,
  secondSouffleDisponible,
  utiliserSecondSouffle,
  xpEnnemi,
  xpPourNiveauSuivant,
} from '../regles/progression';
import { absorberDegats, barriereActive, pasBarriere, pasRecharges } from '../regles/sorts';
import { aLeNoeud } from '../regles/competences';
import { apresParadeReussie, consommerRiposte, estDeFace, facteurRiposte, resoudreParade } from '../regles/bouclier';
import { facteurCoupEpee } from '../regles/frappe';
import type { EvenementQuete } from '../regles/quetes';
import { heureDuJeu, phaseDeLHeure } from '../regles/temps';
import { INFOS_ANIMAUX, estAnimal, pasAnimal } from '../regles/animaux';
import { butinDepeceur } from '../regles/arc';
import { estBanditAttaque, pasBanditAttaque } from '../regles/attaques';
import { estChef } from '../regles/chef';
import { crierCreature } from './sons';
import type { MondeDeplacement } from '../regles/deplacement';
import {
  INFOS_ENNEMIS,
  RAYON_VILLAGE_ENNEMIS,
  blesserJoueur,
  creerEnnemi,
  degatsAvecOutil,
  degatsRecus,
  ennemiVise,
  etourdirEnnemi,
  frapperEnnemi,
  pasEnnemi,
  pasVieJoueur,
  progressionAnticipation,
  progressionSaut,
  tirerButinEnnemi,
  type ContexteEnnemi,
  type EtatEnnemi,
  type ResultatPasEnnemi,
  type TypeChef,
} from '../regles/combat';
import {
  choisirApparitions,
  chunksAutour,
  estPointAnimal,
  oublierMorts,
  pointsAnimauxDuChunk,
  pointsDuChunk,
  type MondeApparition,
  type PointApparition,
} from '../regles/apparitions';
import { zonesLibresLieux } from '../regles/lieux';
import { COULEURS_ENNEMIS, aUnModele, creerModeleEnnemi, type ModeleEnnemi } from '../scene/modelesEnnemis';
import { creerModeleAnimal } from '../scene/modelesAnimaux';
import type { BarreEnnemi } from '../ui/interfaceCombat';
import { RAYON_OBSTACLES, type Contexte } from './contexte';
import type { EnnemiPresent, EtatJeu } from './partie';
import type { OutilEnMain } from './outilEnMain';

export interface DependancesCombat {
  outil: OutilEnMain;
  surMort: () => void;
  rafraichirInventaire: () => void;
  donnerXp: (quantite: number) => void;
  signalerQuete: (ev: EvenementQuete) => void;
  /** Laisse au sol (petit sac) le butin qui ne rentre ni dans l'inventaire ni dans le sac */
  deposerButin: (x: number, y: number, z: number, contenu: readonly Pile[]) => void;
  /** Avancée des boules de feu (dans l'ordre de la frame : après les recharges, avant la chute) */
  mettreAJourBoules: (dt: number) => void;
  /** Compte à rebours de l'écran de chute */
  mettreAJourChute: (dt: number) => void;
}

export function creerCombat(jeu: EtatJeu, ctx: Contexte, dep: DependancesCombat) {
  const { scene, camera, renderer, terrain, decor, mine, vues, compteur, interfaceCombat, interfaceProgression, effetsCombat, effetsSorts } = ctx;
  const { ennemis } = jeu;
  // Instant de mort (temps de jeu) des ennemis tués, pour le délai de réapparition
  let mortsEnnemis: Record<string, number> = {};
  const pointsParChunk = new Map<string, PointApparition[]>();
  const pointsAnimauxParChunk = new Map<string, PointApparition[]>();
  // Position du joueur à l'image précédente : sa vitesse dit aux animaux craintifs s'il approche discrètement
  let joueurPrecedent: { x: number; z: number } | null = null;
  let delaiApparitions = 0;
  // Tremblement de la caméra : secondes restantes, et décalage appliqué à l'image précédente
  let tremblement = 0;
  const decalageCamera = new THREE.Vector3();
  const projection = new THREE.Vector3();

  const mondeApparition: MondeApparition = {
    biome: (x, z) => terrain.biomeDominant(x, z).id,
    hauteur: (x, z) => terrain.hauteur(x, z),
    niveauEau: terrain.niveauEau,
    pente: (x, z) => terrain.pente(x, z),
    // Le camp des bandits et l'autel ont leurs propres occupants : pas d'ennemi ordinaire autour
    zonesSansEnnemi: zonesLibresLieux(ctx.lieux).map((z) => ({ ...z, rayon: z.rayon + CONFIG.apparitions.margeLieux })),
  };
  // Ce que les ennemis voient du monde (obstacles et joueur : mis à jour à chaque image)
  const mondeEnnemis: MondeDeplacement = {
    hauteur: (x, z) => terrain.hauteur(x, z),
    niveauEau: terrain.niveauEau,
    obstacles: [],
  };
  const contexteEnnemis: ContexteEnnemi = {
    joueur: { x: jeu.etat.x, z: jeu.etat.z, vivant: true },
    monde: mondeEnnemis,
    rayonVillage: RAYON_VILLAGE_ENNEMIS,
  };

  /** Position à l'écran (pixels) d'un point du monde, ou null s'il est derrière la caméra. */
  function versEcran(x: number, y: number, z: number): { x: number; y: number } | null {
    projection.set(x, y, z).project(camera);
    if (projection.z > 1 || projection.z < -1) return null;
    return {
      x: (projection.x * 0.5 + 0.5) * renderer.domElement.clientWidth,
      y: (-projection.y * 0.5 + 0.5) * renderer.domElement.clientHeight,
    };
  }

  function ajouterEnnemi(p: PointApparition): void {
    if (ennemis.has(p.id)) return;
    if (!estAnimal(p.type) && !aUnModele(p.type)) return;
    const modele = estAnimal(p.type) ? creerModeleAnimal(p.type) : creerModeleEnnemi(p.type);
    scene.add(modele.objet);
    ennemis.set(p.id, {
      etat: creerEnnemi(p.id, p.type, p.x, p.z, terrain.hauteur(p.x, p.z)),
      modele,
      depuisCoup: Infinity,
      fumee: false,
    });
  }

  function retirerEnnemi(id: string): void {
    const present = ennemis.get(id);
    if (!present) return;
    scene.remove(present.modele.objet);
    present.modele.liberer();
    ennemis.delete(id);
  }

  /** Fait apparaître un bandit d'une attaque du village (identifiant `attaque:...`) ; il marche vers la place. */
  function ajouterBanditAttaque(id: string, x: number, z: number): void {
    ajouterEnnemi({ id, type: 'bandit', x, z, nuitSeulement: false });
  }

  /**
   * Fait apparaître un ennemi hors des points d'apparition (occupants du camp des bandits). `modele` : son modèle s'il
   * n'est pas celui de son type (chef) ; `pas` : son comportement s'il n'est pas celui des ennemis ordinaires.
   */
  function ajouterEnnemiSpecial(
    id: string,
    type: 'bandit' | TypeChef,
    x: number,
    z: number,
    options: { modele?: ModeleEnnemi; pas?: (etat: EtatEnnemi, ctx: ContexteEnnemi, dt: number) => ResultatPasEnnemi } = {},
  ): void {
    if (ennemis.has(id)) return;
    const modele = options.modele ?? (aUnModele(type) ? creerModeleEnnemi(type) : null);
    if (!modele) return;
    scene.add(modele.objet);
    ennemis.set(id, { etat: creerEnnemi(id, type, x, z, terrain.hauteur(x, z)), modele, depuisCoup: Infinity, fumee: false, pas: options.pas });
  }

  /** Environ une fois par seconde : les ennemis trop loin disparaissent, les points libres à bonne distance se remplissent. */
  function verifierApparitions(): void {
    const { etat, tempsJeu } = jeu;
    const A = CONFIG.apparitions;
    for (const [id, present] of ennemis) {
      // Les bandits d'une attaque du village restent là tant que l'attaque dure, où que soit le joueur
      if (estBanditAttaque(id)) continue;
      if (Math.hypot(present.etat.x - etat.x, present.etat.z - etat.z) > A.distanceDisparition) retirerEnnemi(id);
    }
    mortsEnnemis = oublierMorts(mortsEnnemis, tempsJeu);
    // Dans la mine : ennemis à points fixes, pas ceux des chunks
    if (mine.contient(etat.x, etat.z)) {
      mine.ennemisAFaireApparaitre(new Set(ennemis.keys()), mortsEnnemis, tempsJeu, { x: etat.x, z: etat.z }).forEach(ajouterEnnemi);
      return;
    }
    const points: PointApparition[] = [];
    const pointsAnimaux: PointApparition[] = [];
    for (const { cx, cz } of chunksAutour(etat.x, etat.z, A.distanceActivation)) {
      const cle = `${cx}:${cz}`;
      let liste = pointsParChunk.get(cle);
      if (!liste) {
        if (pointsParChunk.size > 400) pointsParChunk.clear();
        liste = pointsDuChunk(CONFIG.graine, cx, cz, mondeApparition);
        pointsParChunk.set(cle, liste);
      }
      points.push(...liste);
      let animaux = pointsAnimauxParChunk.get(cle);
      if (!animaux) {
        if (pointsAnimauxParChunk.size > 400) pointsAnimauxParChunk.clear();
        animaux = pointsAnimauxDuChunk(CONFIG.graine, cx, cz, mondeApparition);
        pointsAnimauxParChunk.set(cle, animaux);
      }
      pointsAnimaux.push(...animaux);
    }
    // Ennemis et animaux présents sont comptés à part : chacun a sa limite
    const presents = [...ennemis.keys()];
    const nuit = phaseDeLHeure(heureDuJeu(tempsJeu, CONFIG.temps), CONFIG.temps) === 'nuit';
    const choisis = choisirApparitions({
      points,
      actifs: new Set(presents.filter((id) => !estPointAnimal(id))),
      morts: mortsEnnemis,
      joueur: { x: etat.x, z: etat.z },
      temps: tempsJeu,
      nuit,
    });
    choisis.forEach(ajouterEnnemi);
    choisirApparitions(
      {
        points: pointsAnimaux,
        actifs: new Set(presents.filter(estPointAnimal)),
        morts: mortsEnnemis,
        joueur: { x: etat.x, z: etat.z },
        temps: tempsJeu,
        nuit,
      },
      A.animaux.limiteActifs,
    ).forEach(ajouterEnnemi);
  }

  /** Direction dans laquelle le joueur frappe : le regard (centre de l'écran). */
  function regardCombat(): number {
    // Le pilote automatique frappe dans la direction du personnage, pas dans celle de la caméra
    return jeu.pilote !== null ? jeu.etat.orientation : (vues.lacetVisee ?? jeu.etat.orientation);
  }

  /** Ennemi que l'épée toucherait maintenant, ou null. */
  function ennemiAPortee(): EtatEnnemi | null {
    if (ennemis.size === 0) return null;
    const etats = [...ennemis.values()].map((present) => present.etat);
    return ennemiVise(etats, jeu.etat.x, jeu.etat.z, regardCombat());
  }

  /** À l'impact d'une frappe : touche l'ennemi à portée s'il y en a un. Renvoie vrai si un ennemi a été touché. */
  function frapperEnnemiVise(): boolean {
    const cible = ennemiAPortee();
    const present = cible ? ennemis.get(cible.id) : undefined;
    if (!cible || !present) return false;
    dep.outil.prendreEpee();
    // L'outil en main frappe : l'épée à pleins dégâts, la hache ou la pioche beaucoup moins (mais elles touchent)
    const outil = jeu.outilActuel;
    let degats = degatsAvecOutil(outil, facteurDegats(jeu.equipement, outil) * facteurDegatsEpee(jeu.progression));
    // Épée : coup puissant (×2,5) et riposte après une parade réussie (×2), qui ne sert qu'une fois
    let renforce = false;
    if (outil === 'epee') {
      const riposte = facteurRiposte(jeu.garde);
      const facteur = facteurCoupEpee(jeu.coupPuissant, riposte);
      renforce = facteur > 1;
      degats *= facteur;
      if (riposte > 1) {
        jeu.garde = consommerRiposte(jeu.garde);
        compteur.annoncerMessage('Riposte !');
      } else if (jeu.coupPuissant) {
        compteur.annoncerMessage('Coup puissant !');
      }
      jeu.coupPuissant = false;
    }
    ctx.sons.jouer('epee-touche', { position: { x: cible.x, y: cible.y + present.modele.hauteur * 0.5, z: cible.z }, volume: renforce ? 1.4 : 1 });
    infligerDegatsEnnemi(present, degats, jeu.etat.x, jeu.etat.z, renforce ? '#ffb347' : outil === 'epee' ? '#ffe9a0' : '#d8d0c0');
    dep.outil.userEquipement(outil);
    return true;
  }

  /** Un ennemi reçoit des dégâts venus de (depuisX, depuisZ) : recul, flash, éclaboussures, chiffre, et mort éventuelle. */
  function infligerDegatsEnnemi(present: EnnemiPresent, degats: number, depuisX: number, depuisZ: number, couleur: string): void {
    const cible = present.etat;
    if (cible.phase === 'mort') return;
    const coup = frapperEnnemi(cible, degats, depuisX, depuisZ);
    present.etat = coup.etat;
    present.depuisCoup = 0;
    present.modele.flash();
    // Éclaboussures de gelée pour le slime, quelques éclats clairs pour les autres
    const slime = cible.type === 'slime';
    effetsCombat.eclaboussures(
      cible.x,
      cible.y + present.modele.hauteur * 0.45,
      cible.z,
      slime ? COULEURS_ENNEMIS.slime : 0xf4ead0,
      slime ? 9 : 4,
    );
    const ecran = versEcran(cible.x, cible.y + present.modele.hauteur, cible.z);
    if (ecran) interfaceCombat.chiffre(ecran.x, ecran.y - 16, `${Math.round(degats)}`, couleur);
    crierCreature(ctx.sons, present, coup.mort ? 'mort' : 'douleur');
    if (coup.mort) tuerEnnemi(present);
  }

  /** Un ennemi vient de mourir : délai de réapparition, effets, butin (inventaire, puis sac magique, puis au sol s'il ne rentre pas). */
  function tuerEnnemi(present: EnnemiPresent): void {
    const e = present.etat;
    mortsEnnemis = { ...mortsEnnemis, [e.id]: jeu.tempsJeu };
    if (e.type === 'slime') effetsCombat.eclaboussures(e.x, e.y + 0.3, e.z, COULEURS_ENNEMIS.slime, 16);
    const tire = tirerButinEnnemi(e.type, `${e.id}:${Math.floor(jeu.tempsJeu)}`);
    // Dépeceur : un animal donne un peu plus de viande (ou de cuir)
    const butin = estAnimal(e.type) && aLeNoeud(jeu.progression, 'depeceur') ? butinDepeceur(tire) : tire;
    // L'Éclat du Cœur ne tombe jamais au sol : inventaire, sinon coffre du village
    const eclat = butin[ID_ECLAT_COEUR] ?? 0;
    const { [ID_ECLAT_COEUR]: _eclat, ...autresButins } = butin;
    let messageAbri = '';
    if (eclat > 0) {
      const abri = mettreAAbri(jeu.inventaire, jeu.coffre, ID_ECLAT_COEUR);
      jeu.inventaire = abri.inventaire;
      jeu.coffre = abri.coffre;
      // Effet seulement : l'Éclat jaillit du corps et vole vers le joueur
      effetsCombat.eclatVersJoueur(e.x, e.y + 1.2, e.z, () => jeu.etat);
      if (abri.lieu === 'coffre') messageAbri = 'L’Éclat du Cœur a été mis à l’abri dans le coffre du village';
    }
    const r = repartirButin(jeu.inventaire, jeu.sac, pilesDuButin(autresButins));
    jeu.inventaire = r.inventaire;
    jeu.sac = r.sac;
    dep.rafraichirInventaire();
    if (messageAbri) compteur.annoncerMessage(messageAbri);
    compteur.annoncerObjets(r.obtenu);
    if (r.reste.length > 0) {
      dep.deposerButin(e.x, e.y, e.z, r.reste);
      compteur.annoncerMessage('Inventaire plein : le reste est tombé au sol');
    }
    // Un animal n'est pas un ennemi : il a son propre événement de quête
    if (estAnimal(e.type)) {
      dep.donnerXp(INFOS_ANIMAUX[e.type].xp);
      dep.signalerQuete({ type: 'animalTue', animal: e.type });
    } else {
      dep.donnerXp(xpEnnemi(e.type));
      dep.signalerQuete({ type: 'ennemiTue', ennemi: e.type });
    }
  }

  /**
   * Le joueur reçoit un coup de `present` : bouclier levé (coups de face), armure, barrière magique, puis voile rouge,
   * tremblement de caméra, et chute si la vie tombe à zéro.
   */
  function blesser(brut: number, present: EnnemiPresent): void {
    const { etat, equipement } = jeu;
    const attaquant = present.etat;
    const largeurEcran = renderer.domElement.clientWidth;
    const hauteurEcran = renderer.domElement.clientHeight;
    const surJoueur = vues.vue === 'premiere' ? null : versEcran(etat.x, etat.y + 2, etat.z);
    const chiffreJoueur = (texte: string, couleur: string, decalage = 0): void =>
      interfaceCombat.chiffre(surJoueur?.x ?? largeurEcran / 2, (surJoueur?.y ?? hauteurEcran * 0.62) + decalage, texte, couleur);

    // Bouclier levé : il retire sa part aux coups venus de face ; levé juste avant le coup, il étourdit l'ennemi
    const parade = resoudreParade({
      brut,
      garde: jeu.garde,
      deFace: estDeFace(etat, regardCombat(), attaquant),
      bouclier: equipement.bouclier,
      solide: aLeNoeud(jeu.progression, 'bouclier-solide'),
      attaquant: attaquant.type,
    });
    if (parade.pare) ctx.sons.jouer('parade', { volume: parade.reussie ? 1.2 : 0.8 });
    if (parade.pare) {
      const dx = attaquant.x - etat.x;
      const dz = attaquant.z - etat.z;
      const d = Math.hypot(dx, dz) || 1;
      effetsCombat.etincelles(etat.x + (dx / d) * 0.6, etat.y + 1.25, etat.z + (dz / d) * 0.6, parade.reussie ? 18 : 7);
    }
    if (parade.reussie) {
      present.etat = etourdirEnnemi(attaquant);
      const riposte = aLeNoeud(jeu.progression, 'riposte');
      jeu.garde = apresParadeReussie(jeu.garde, riposte);
      compteur.annoncerMessage(riposte ? 'Parade réussie ! Riposte prête' : 'Parade réussie !');
    }
    if (parade.brut <= 0) {
      chiffreJoueur('Bloqué', '#d8e2f0');
      return;
    }
    // Armure + casque + Peau dure, plafonnés (l'usure de l'armure ne touche que sa part : voir `reductionTotale`)
    const reduction = reductionTotale(equipement, bonusReductionArmure(jeu.progression));
    const apresArmure = degatsRecus(parade.brut, reduction);
    // Barrière magique : elle prend les dégâts tant qu'il lui reste des points
    const absorption = absorberDegats(jeu.barriere, apresArmure);
    jeu.barriere = absorption.barriere;
    if (absorption.absorbe > 0) {
      chiffreJoueur(`-${Math.round(absorption.absorbe)}`, '#7ab8ff', -22);
      if (!barriereActive(jeu.barriere)) compteur.annoncerMessage('La barrière se brise');
    }
    if (absorption.passe <= 0) return;
    const r = blesserJoueur(jeu.vie, absorption.passe, 0);
    jeu.vie = r.vie;
    // Second souffle : une fois par jour de jeu, un coup mortel laisse à 1 PV
    if (r.mort && secondSouffleDisponible(jeu.progression, jeu.tempsJeu)) {
      jeu.progression = utiliserSecondSouffle(jeu.progression, jeu.tempsJeu);
      jeu.vie = { ...r.vie, pv: 1 };
      compteur.annoncerMessage('Second souffle : vous survivez à 1 PV !');
      r.mort = false;
    }
    if (r.degats <= 0) return;
    ctx.sons.jouer('joueur-blesse');
    if (jeu.equipement.armure) dep.outil.userEquipement('armure');
    tremblement = CONFIG.combat.tremblement.duree;
    interfaceCombat.toucher();
    chiffreJoueur(`-${r.degats}`, '#ff8a7a');
    if (r.mort) dep.surMort();
  }

  /** Ennemis, vie du joueur, effets et interface du combat. `fige` : un écran est ouvert, rien ne bouge. */
  function mettreAJour(dt: number, fige: boolean): void {
    camera.updateMatrixWorld();
    if (!fige) {
      jeu.vie = pasVieJoueur(jeu.vie, dt, pvMax(jeu.progression));
      jeu.progression = pasMana(jeu.progression, dt);
      jeu.recharges = pasRecharges(jeu.recharges, dt);
      jeu.barriere = pasBarriere(jeu.barriere, dt);
      dep.mettreAJourBoules(dt);
      dep.mettreAJourChute(dt);
      delaiApparitions -= dt;
      if (delaiApparitions <= 0) {
        delaiApparitions = CONFIG.apparitions.intervalleVerification;
        verifierApparitions();
      }
    }
    contexteEnnemis.joueur.x = jeu.etat.x;
    contexteEnnemis.joueur.z = jeu.etat.z;
    contexteEnnemis.joueur.vivant = jeu.vie.pv > 0;
    if (!fige && dt > 0) {
      contexteEnnemis.joueur.vitesse = joueurPrecedent ? Math.hypot(jeu.etat.x - joueurPrecedent.x, jeu.etat.z - joueurPrecedent.z) / dt : 0;
      joueurPrecedent = { x: jeu.etat.x, z: jeu.etat.z };
    }

    const barres: BarreEnnemi[] = [];
    const presents = [...ennemis.values()];
    for (const present of presents) {
      const avant = present.etat;
      if (!fige) {
        // Obstacles : décor proche (inutile au repos) et autres ennemis, pour qu'ils ne se superposent pas
        const obstacles = avant.phase === 'repos' || avant.phase === 'mort' ? [] : decor.obstaclesAutour(avant.x, avant.z, RAYON_OBSTACLES);
        for (const autre of presents) {
          const a = autre.etat;
          if (autre === present || a.phase === 'mort' || Math.hypot(a.x - avant.x, a.z - avant.z) > 3) continue;
          obstacles.push({ x: a.x, z: a.z, rayon: INFOS_ENNEMIS[a.type].rayon });
        }
        // Dans la mine : murs et poteaux
        const obstaclesMineEnnemi = mine.obstacles(avant.x, avant.z);
        obstacles.push(...obstaclesMineEnnemi.cercles);
        // Lieux de l'histoire : palissade et tentes du camp, menhirs de l'autel
        obstacles.push(...ctx.obstaclesLieux(avant.x, avant.z, RAYON_OBSTACLES));
        // Ruines et petites grottes (inutile au repos)
        if (avant.phase !== 'repos' && avant.phase !== 'mort' && !mine.contient(avant.x, avant.z)) obstacles.push(...ctx.ruines.obstaclesAutour(avant.x, avant.z, RAYON_OBSTACLES));
        mondeEnnemis.obstacles = obstacles;
        mondeEnnemis.rectangles = obstaclesMineEnnemi.rectangles;
        const r = present.pas
          ? present.pas(avant, contexteEnnemis, dt)
          : estAnimal(avant.type)
          ? pasAnimal(avant, contexteEnnemis, dt)
          : estBanditAttaque(avant.id)
            ? pasBanditAttaque(avant, contexteEnnemis, dt)
            : pasEnnemi(avant, contexteEnnemis, dt);
        present.etat = r.etat;
        present.depuisCoup += dt;
        if (r.degats > 0) blesser(r.degats, present);
      }
      const e = present.etat;
      if (e.phase === 'mort') {
        // Le gobelin disparaît dans un petit nuage de fumée (le slime s'affaisse en flaque)
        if (!present.fumee && e.type !== 'slime' && e.tempsPhase > CONFIG.combat.dureeMortEnnemi * 0.5) {
          present.fumee = true;
          effetsCombat.fumee(e.x, e.y, e.z);
        }
        if (e.tempsPhase >= CONFIG.combat.dureeMortEnnemi) {
          retirerEnnemi(e.id);
          continue;
        }
      }
      present.modele.mettreAJour(fige ? 0 : dt, {
        x: e.x,
        y: e.y,
        z: e.z,
        orientation: e.orientation,
        phase: e.phase,
        tempsPhase: e.tempsPhase,
        saut: progressionSaut(e),
        anticipation: progressionAnticipation(e),
        enMouvement: Math.hypot(e.x - avant.x, e.z - avant.z) > dt * 0.3,
      });
      // (un chef a sa propre barre, en haut de l'écran : voir chef.ts)
      if (e.phase !== 'mort' && !estChef(e.type) && present.depuisCoup < CONFIG.combat.dureeBarreEnnemi) {
        const ecran = versEcran(e.x, e.y + present.modele.hauteur, e.z);
        if (ecran) barres.push({ id: e.id, x: ecran.x, y: ecran.y, ratio: e.pv / INFOS_ENNEMIS[e.type].pv });
      }
    }
    interfaceCombat.afficherBarres(barres);
    const barriere = barriereActive(jeu.barriere) && jeu.vie.pv > 0;
    interfaceCombat.afficherVie(
      jeu.vie.pv,
      pvMax(jeu.progression),
      compter(jeu.inventaire, 'potion-soin'),
      barriere ? jeu.barriere.reste / CONFIG.progression.arbre.barriere.absorbe : 0,
    );
    // Dôme de la barrière autour du joueur ; il pâlit pendant sa dernière seconde
    effetsSorts.barriere(barriere ? { x: jeu.etat.x, y: jeu.etat.y, z: jeu.etat.z, force: Math.min(1, jeu.barriere.temps) } : null);
    interfaceProgression.afficher({
      niveau: jeu.progression.niveau,
      xp: jeu.progression.xp,
      xpSuivant: xpPourNiveauSuivant(jeu.progression.niveau),
      points: jeu.progression.points,
      mana: jeu.progression.mana,
      manaMax: manaMax(jeu.progression),
      noeuds: jeu.progression.noeuds,
      recharges: jeu.recharges,
    });
    effetsCombat.mettreAJour(fige ? 0 : dt);
    effetsSorts.mettreAJour(fige ? 0 : dt);
  }

  /** Le tremblement de l'image précédente est retiré avant que la caméra ne soit replacée. */
  function retirerTremblement(): void {
    camera.position.sub(decalageCamera);
    decalageCamera.set(0, 0, 0);
  }

  /** Petit tremblement quand le joueur vient d'être touché (il s'éteint tout seul). */
  function appliquerTremblement(dt: number): void {
    if (tremblement > 0) {
      tremblement = Math.max(0, tremblement - dt);
      const T = CONFIG.combat.tremblement;
      const amplitude = (T.amplitude * tremblement) / T.duree;
      const hasard = () => (Math.random() * 2 - 1) * amplitude;
      decalageCamera.set(hasard(), hasard(), hasard());
      camera.position.add(decalageCamera);
    }
  }

  return { ennemiAPortee, ajouterBanditAttaque, ajouterEnnemiSpecial, retirerEnnemi, frapperEnnemiVise, infligerDegatsEnnemi, mettreAJour, retirerTremblement, appliquerTremblement };
}

export type Combat = ReturnType<typeof creerCombat>;
