// Déplacement du personnage : règles pures (aucun rendu, aucun import de three).
// Le sol est une fonction de hauteur, les obstacles sont des cercles (troncs, rochers)
// ou des rectangles orientés (murs des bâtiments du village).
// Convention d'orientation : lacet en radians, l'avant du personnage est (sin(lacet), cos(lacet)).

import { CONFIG } from '../config';

export interface ObstacleCercle {
  x: number;
  z: number;
  rayon: number;
}

/**
 * Rectangle orienté, vu de dessus (mur, bâtiment, meuble). `angle` : lacet en radians, même convention
 * que le personnage : l'axe « profondeur » du rectangle pointe vers (sin(angle), cos(angle)).
 */
export interface ObstacleRectangle {
  /** Centre */
  x: number;
  z: number;
  /** Demi-taille le long de l'axe « largeur » (perpendiculaire à l'angle) */
  demiLargeur: number;
  /** Demi-taille le long de l'axe « profondeur » (direction de l'angle) */
  demiProfondeur: number;
  angle: number;
}

/**
 * Sort un cercle (centre cx, cz) d'un rectangle orienté. Renvoie `null` s'ils ne se touchent pas,
 * sinon le centre corrigé et la normale de sortie (longueur 1), qui sert à faire glisser la vitesse.
 */
export function repousserHorsRectangle(
  cx: number,
  cz: number,
  rayon: number,
  o: ObstacleRectangle,
): { x: number; z: number; nx: number; nz: number } | null {
  const c = Math.cos(o.angle);
  const s = Math.sin(o.angle);
  // Position du cercle dans le repère du rectangle (lx : largeur, lz : profondeur)
  const dx = cx - o.x;
  const dz = cz - o.z;
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  // Point du rectangle le plus proche du centre du cercle
  const px = Math.max(-o.demiLargeur, Math.min(o.demiLargeur, lx));
  const pz = Math.max(-o.demiProfondeur, Math.min(o.demiProfondeur, lz));
  let ex = lx - px;
  let ez = lz - pz;
  const d2 = ex * ex + ez * ez;
  if (d2 >= rayon * rayon) return null;
  let sx: number;
  let sz: number;
  if (d2 > 1e-12) {
    // Centre dehors : on recule le long de la droite qui le relie au point le plus proche
    const d = Math.sqrt(d2);
    ex /= d;
    ez /= d;
    sx = px + ex * rayon;
    sz = pz + ez * rayon;
  } else {
    // Centre dans le rectangle : on sort par le côté le plus proche
    const margeX = o.demiLargeur - Math.abs(lx);
    const margeZ = o.demiProfondeur - Math.abs(lz);
    if (margeX < margeZ) {
      ex = lx >= 0 ? 1 : -1;
      ez = 0;
      sx = ex * (o.demiLargeur + rayon);
      sz = lz;
    } else {
      ex = 0;
      ez = lz >= 0 ? 1 : -1;
      sx = lx;
      sz = ez * (o.demiProfondeur + rayon);
    }
  }
  // Retour dans le repère du monde
  return {
    x: o.x + sx * c + sz * s,
    z: o.z - sx * s + sz * c,
    nx: ex * c + ez * s,
    nz: -ex * s + ez * c,
  };
}

/** Ce que le déplacement a besoin de savoir du monde. */
export interface MondeDeplacement {
  /** Altitude du sol en (x, z) */
  hauteur(x: number, z: number): number;
  /** Altitude de la surface de l'eau */
  niveauEau: number;
  /** Obstacles infranchissables (troncs, rochers…) */
  obstacles: readonly ObstacleCercle[];
  /** Obstacles rectangulaires (murs, bâtiments) ; absent = aucun */
  rectangles?: readonly ObstacleRectangle[];
}

export interface EtatPersonnage {
  /** Position des pieds */
  x: number;
  y: number;
  z: number;
  /** Vitesse, en m/s */
  vx: number;
  vy: number;
  vz: number;
  /** Vrai si les pieds touchent le sol */
  auSol: boolean;
  /** Vrai si le personnage nage à la surface */
  nage: boolean;
  /** Vrai s'il glisse sur une pente trop raide */
  glisse: boolean;
  /** Vrai s'il escalade une paroi (Espace maintenu face à une pente trop raide) */
  grimpe: boolean;
  /** Vrai après une escalade tant qu'Espace n'a pas été relâché : on ne saute pas en arrivant en haut */
  sautBloque: boolean;
  /** Lacet, en radians */
  orientation: number;
}

export interface EntreeDeplacement {
  /** Direction voulue dans le monde (longueur 0 à 1) */
  x: number;
  z: number;
  courir: boolean;
  sauter: boolean;
  /** Espace maintenu pour escalader (à laisser faux là où l'escalade est interdite : mine, maison, pilote) ; faux si absent */
  grimper?: boolean;
  /** Facteur sur la vitesse de marche et de course (bouclier levé : moins vite) ; 1 si absent */
  facteurVitesse?: number;
  /** Lacet imposé (visée) ; sinon le personnage se tourne vers sa direction de marche */
  orientationVisee?: number;
}

export function creerEtatPersonnage(x: number, y: number, z: number, orientation = 0): EtatPersonnage {
  return { x, y, z, vx: 0, vy: 0, vz: 0, auSol: true, nage: false, glisse: false, grimpe: false, sautBloque: false, orientation };
}

/** Vitesse horizontale, en m/s. */
export function vitesseHorizontale(etat: EtatPersonnage): number {
  return Math.hypot(etat.vx, etat.vz);
}

/** Pente du sol mesurée sur une petite distance : dérivées de la hauteur selon x et z. */
function gradient(monde: MondeDeplacement, x: number, z: number): { gx: number; gz: number } {
  const d = CONFIG.personnage.baseMesurePente / 2;
  return {
    gx: (monde.hauteur(x + d, z) - monde.hauteur(x - d, z)) / (2 * d),
    gz: (monde.hauteur(x, z + d) - monde.hauteur(x, z - d)) / (2 * d),
  };
}

/** Sort le personnage des obstacles (cercles puis rectangles) : il est repoussé dehors et sa vitesse ne garde que sa part le long de l'obstacle. */
function sortirDesObstacles(
  cx: number,
  cz: number,
  vx: number,
  vz: number,
  monde: MondeDeplacement,
): { x: number; z: number; vx: number; vz: number } {
  const P = CONFIG.personnage;
  for (let passe = 0; passe < 2; passe++) {
    for (const o of monde.obstacles) {
      const ox = cx - o.x;
      const oz = cz - o.z;
      const mini = o.rayon + P.rayon;
      const d2 = ox * ox + oz * oz;
      if (d2 >= mini * mini) continue;
      const d = Math.sqrt(d2);
      // Au centre exact : on sort du côté d'où l'on vient
      const nx = d > 1e-6 ? ox / d : 1;
      const nz = d > 1e-6 ? oz / d : 0;
      cx = o.x + nx * mini;
      cz = o.z + nz * mini;
      const vers = vx * nx + vz * nz;
      if (vers < 0) {
        vx -= vers * nx;
        vz -= vers * nz;
      }
    }
    // Rectangles (murs) : même principe, la vitesse ne garde que sa part le long du mur
    for (const o of monde.rectangles ?? []) {
      const sortie = repousserHorsRectangle(cx, cz, P.rayon, o);
      if (!sortie) continue;
      cx = sortie.x;
      cz = sortie.z;
      const vers = vx * sortie.nx + vz * sortie.nz;
      if (vers < 0) {
        vx -= vers * sortie.nx;
        vz -= vers * sortie.nz;
      }
    }
  }
  return { x: cx, z: cz, vx, vz };
}

// --- Escalade ---

/** Tourne `orientation` vers `cible` en douceur (par le plus court chemin). */
function tournerVers(orientation: number, cible: number, dt: number): number {
  let diff = (cible - orientation) % (2 * Math.PI);
  if (diff > Math.PI) diff -= 2 * Math.PI;
  if (diff < -Math.PI) diff += 2 * Math.PI;
  return orientation + diff * (1 - Math.exp(-CONFIG.personnage.vitesseRotation * dt));
}

/**
 * Paroi que le personnage peut escalader : une pente trop raide pour marcher, sous ses pieds ou juste devant lui,
 * et à laquelle il fait face. Renvoie la direction de la montée vue de dessus (longueur 1), ou `null`.
 * Déjà accroché, il ne lâche que s'il lui tourne le dos, et il reste « en escalade » le temps de passer le bord.
 */
function paroiAEscalader(monde: MondeDeplacement, etat: EtatPersonnage, tanMax: number): { mx: number; mz: number } | null {
  const P = CONFIG.personnage;
  const E = P.escalade;
  const ax = Math.sin(etat.orientation);
  const az = Math.cos(etat.orientation);
  const paroiEn = (distance: number, faceMin: number): { mx: number; mz: number } | null => {
    const g = gradient(monde, etat.x + ax * distance, etat.z + az * distance);
    const raideur = Math.hypot(g.gx, g.gz);
    if (raideur <= tanMax) return null;
    const mx = g.gx / raideur;
    const mz = g.gz / raideur;
    return mx * ax + mz * az >= faceMin ? { mx, mz } : null;
  };
  return (
    paroiEn(0, etat.grimpe ? E.faceLacher : E.faceMin) ??
    paroiEn(E.portee / 2, E.faceMin) ??
    paroiEn(E.portee, E.faceMin) ??
    // En haut : la paroi est passée derrière les pieds, on finit de se hisser sur le bord
    (etat.grimpe ? paroiEn(-P.rayon, E.faceMin) : null)
  );
}

/**
 * Un pas d'escalade : le personnage reste collé au relief et monte à vitesse verticale constante (lente).
 * Reculer fait redescendre, aller de côté déplace le long de la paroi. (dx, dz) : direction voulue, longueur 1 au plus.
 */
function pasEscalade(
  etat: EtatPersonnage,
  dx: number,
  dz: number,
  orientationVisee: number | undefined,
  dt: number,
  monde: MondeDeplacement,
  paroi: { mx: number; mz: number },
): EtatPersonnage {
  const E = CONFIG.personnage.escalade;
  const { mx, mz } = paroi;
  // Part de la commande vers la paroi et le long de la paroi (le côté est (-mz, mx))
  const versParoi = dx * mx + dz * mz;
  const cote = -dx * mz + dz * mx;
  let sens = versParoi < -0.3 ? -1 : 1;
  if (sens > 0 && Math.abs(cote) > 0.7 && versParoi < 0.3) sens = 0;
  const vVerticale = sens > 0 ? E.vitesseMontee : sens < 0 ? E.vitesseDescente : 0;
  // Plus c'est raide, moins on avance à l'horizontale pour une même montée ; au pied et sur le bord, on avance au pas
  const g = gradient(monde, etat.x, etat.z);
  const pente = Math.max(1, g.gx * mx + g.gz * mz);
  let vx = (mx * sens * vVerticale) / pente - mz * cote * E.vitesseCote;
  let vz = (mz * sens * vVerticale) / pente + mx * cote * E.vitesseCote;
  // Relief plus raide que mesuré : le pas est raccourci pour ne pas dépasser la vitesse verticale
  // (en quelques passes : le relief n'est pas droit, un pas plus court ne monte pas forcément d'autant moins)
  const deniveleMax = Math.max(vVerticale, E.vitesseCote) * dt;
  for (let passe = 0; passe < 3; passe++) {
    const denivele = Math.abs(monde.hauteur(etat.x + vx * dt, etat.z + vz * dt) - etat.y);
    if (denivele <= deniveleMax) break;
    vx *= deniveleMax / denivele;
    vz *= deniveleMax / denivele;
  }
  const sortie = sortirDesObstacles(etat.x + vx * dt, etat.z + vz * dt, vx, vz, monde);
  let { x, z } = sortie;
  ({ vx, vz } = sortie);
  let y = monde.hauteur(x, z);
  // On ne descend pas dans l'eau en escaladant : on reste accroché au-dessus
  if (y < monde.niveauEau) {
    ({ x, z } = etat);
    y = etat.y;
    vx = 0;
    vz = 0;
  }
  // Le corps fait face à la paroi (ou suit la visée, en 1re personne)
  const orientation = tournerVers(etat.orientation, orientationVisee ?? Math.atan2(mx, mz), dt);
  return { x, y, z, vx, vy: 0, vz, auSol: true, nage: false, glisse: false, grimpe: true, sautBloque: true, orientation };
}

/** Fait avancer le personnage de dt secondes. Ne modifie pas `etat` : renvoie le nouvel état. */
export function pasDeDeplacement(
  etat: EtatPersonnage,
  entree: EntreeDeplacement,
  dt: number,
  monde: MondeDeplacement,
): EtatPersonnage {
  const P = CONFIG.personnage;
  if (!(dt > 0)) return etat;
  const tanMax = Math.tan((P.penteMaxDegres * Math.PI) / 180);

  // Direction voulue, ramenée à une longueur de 1 au plus
  let dx = entree.x;
  let dz = entree.z;
  const longueur = Math.hypot(dx, dz);
  if (longueur > 1) {
    dx /= longueur;
    dz /= longueur;
  }
  const aUneDirection = longueur > 1e-3;

  const solIci = monde.hauteur(etat.x, etat.z);
  const profondeurIci = monde.niveauEau - solIci;
  const nageait = etat.nage;

  // Escalade : Espace maintenu face à une paroi trop raide, les pieds au sol et hors de l'eau
  if (entree.grimper && etat.auSol && !nageait && profondeurIci <= 0) {
    const paroi = paroiAEscalader(monde, etat, tanMax);
    if (paroi) return pasEscalade(etat, dx, dz, entree.orientationVisee, dt, monde, paroi);
  }
  // Après une escalade, Espace doit être relâché avant de sauter (sinon on sauterait en arrivant en haut)
  const sautBloque = (etat.grimpe || etat.sautBloque) && entree.sauter;

  // Vitesse visée : marche, course, ralentie dans l'eau, lente à la nage
  let vMax = entree.courir ? P.vitesseCourse : P.vitesseMarche;
  if (nageait) vMax = P.vitesseNage;
  else if (profondeurIci > 0) vMax *= 1 - P.freinEau * Math.min(1, profondeurIci / P.profondeurNage);
  if (!nageait) vMax *= entree.facteurVitesse ?? 1;

  // Accélération et freinage doux vers la vitesse visée
  let taux = aUneDirection ? P.acceleration : P.freinage;
  if (!etat.auSol && !nageait) taux *= P.controleEnAir;
  let vx = etat.vx;
  let vz = etat.vz;
  const ex = dx * vMax - vx;
  const ez = dz * vMax - vz;
  const ecart = Math.hypot(ex, ez);
  if (ecart > 0) {
    const pas = Math.min(ecart, taux * dt);
    vx += (ex / ecart) * pas;
    vz += (ez / ecart) * pas;
  }

  // Pente trop raide sous les pieds : on glisse vers le bas et on ne peut pas remonter
  let glisse = false;
  let gvx = 0;
  let gvz = 0;
  if (etat.auSol && !nageait && profondeurIci <= 0) {
    const g = gradient(monde, etat.x, etat.z);
    const raideur = Math.hypot(g.gx, g.gz);
    if (raideur > tanMax) {
      glisse = true;
      const mx = g.gx / raideur; // direction de la montée
      const mz = g.gz / raideur;
      gvx = -mx * P.vitesseGlissade;
      gvz = -mz * P.vitesseGlissade;
      const montee = vx * mx + vz * mz;
      if (montee > 0) {
        vx -= montee * mx;
        vz -= montee * mz;
      }
    }
  }

  let px = (vx + gvx) * dt;
  let pz = (vz + gvz) * dt;
  let cx = etat.x + px;
  let cz = etat.z + pz;

  // Le point visé est plus haut et trop raide : on retire la part du mouvement qui monte
  // (le personnage longe la falaise au lieu de l'escalader). Dans l'eau, rien ne bloque la sortie.
  const solVise = monde.hauteur(cx, cz);
  if (solVise > etat.y + 1e-4 && solVise > monde.niveauEau) {
    const g = gradient(monde, cx, cz);
    const raideur = Math.hypot(g.gx, g.gz);
    if (raideur > tanMax) {
      const mx = g.gx / raideur;
      const mz = g.gz / raideur;
      const montee = px * mx + pz * mz;
      if (montee > 0) {
        px -= montee * mx;
        pz -= montee * mz;
        const monteeV = vx * mx + vz * mz;
        if (monteeV > 0) {
          vx -= monteeV * mx;
          vz -= monteeV * mz;
        }
      }
      cx = etat.x + px;
      cz = etat.z + pz;
      // Sécurité : si le point corrigé grimpe encore une pente trop raide, on reste sur place
      const sol2 = monde.hauteur(cx, cz);
      if (sol2 > etat.y + 1e-4 + Math.hypot(px, pz) * tanMax) {
        const g2 = gradient(monde, cx, cz);
        if (Math.hypot(g2.gx, g2.gz) > tanMax) {
          cx = etat.x;
          cz = etat.z;
          px = 0;
          pz = 0;
        }
      }
    }
  }

  // Obstacles : on est repoussé hors du cercle, ce qui fait glisser le long
  ({ x: cx, z: cz, vx, vz } = sortirDesObstacles(cx, cz, vx, vz, monde));

  // Vertical : nage, suivi du sol, saut et chute
  const sol = monde.hauteur(cx, cz);
  const yNage = monde.niveauEau - P.enfoncementNage;
  const eauProfonde = monde.niveauEau - sol > P.profondeurNage;
  let y = etat.y;
  let vy = etat.vy;
  let auSol = etat.auSol;
  let nage = false;

  if (eauProfonde && (auSol || nageait || y <= yNage)) {
    // Nage : on flotte à la surface, pas de saut
    nage = true;
    auSol = false;
    vy = 0;
    y += (yNage - y) * Math.min(1, P.vitesseFlottaison * dt);
  } else if (auSol || nageait) {
    if (entree.sauter && auSol && !glisse && !sautBloque) {
      vy = P.vitesseSaut;
      auSol = false;
      y = Math.max(y, sol) + vy * dt;
    } else {
      // Suivi du sol : on monte toujours avec lui ; en descente on reste collé
      // sauf si le vide est trop grand (bord de falaise) : là on tombe
      const chute = y - sol;
      const parcouru = Math.hypot(cx - etat.x, cz - etat.z);
      if (chute <= parcouru * P.penteAccroche + P.margeAccroche) {
        y = sol;
        vy = 0;
        auSol = true;
      } else {
        auSol = false;
        vy = 0;
      }
    }
  } else {
    // En l'air
    vy -= P.gravite * dt;
    y += vy * dt;
    if (y <= sol) {
      y = sol;
      vy = 0;
      auSol = true;
    }
  }

  // Orientation : vers la visée si elle est imposée, sinon vers la direction de marche
  let orientation = etat.orientation;
  const cible = entree.orientationVisee ?? (aUneDirection ? Math.atan2(dx, dz) : undefined);
  if (cible !== undefined) {
    let diff = (cible - orientation) % (2 * Math.PI);
    if (diff > Math.PI) diff -= 2 * Math.PI;
    if (diff < -Math.PI) diff += 2 * Math.PI;
    orientation += diff * (1 - Math.exp(-P.vitesseRotation * dt));
  }

  return { x: cx, y, z: cz, vx, vy, vz, auSol, nage, glisse, grimpe: false, sautBloque, orientation };
}
