// Menu pause (touche Échap) : Reprendre, Sauvegarder, Aide, Parties (trois emplacements : charger, commencer une nouvelle
// partie, recommencer ou effacer, chaque effacement demandant une confirmation en deux clics),
// un clic à côté du panneau = Reprendre, le réglage de la sensibilité de la souris, les volumes des sons et les options graphiques (distance de vue, ombres, images par seconde).
// Aucune règle de jeu ici : le menu appelle les actions que main.ts lui donne.

import { CONFIG } from '../config';
import {
  definirBruitsDePas,
  definirDistanceVue,
  definirVolume,
  definirImagesParSeconde,
  definirMiniCarteTourne,
  definirMiniCarteVisible,
  definirTailleMiniCarte,
  definirQualiteOmbres,
  definirSensibilite,
  distanceVue,
  imagesParSeconde,
  miniCarteTourne,
  miniCarteVisible,
  qualiteOmbres,
  sensibilite,
  tailleMiniCarte,
  volumesSon,
  bruitsDePas,
  type CanalVolume,
} from '../moteur/reglages';
import { OUTILS_DE_TEST } from '../moteur/modeTest';
import { effacerSauvegarde, emplacementActif, lireSauvegarde } from '../moteur/stockage';
import type { DistanceVue, QualiteOmbres } from '../regles/affichage';
import { NOMBRE_EMPLACEMENTS, resumeEmplacement } from '../regles/emplacements';
import {
  PANNEAU_ECRAN,
  SEPARATEUR_HAUT,
  T,
  TITRE_ECRAN,
  TITRE_SECTION,
  VOILE_ECRAN,
  caseACocher,
  couleurMessage,
  curseur as creerCurseur,
  styleBoutonChoix,
  styleBoutonPrincipal,
  styleBoutonSecondaire,
} from './theme';

export interface ActionsMenu {
  reprendre(): void;
  /** Sauvegarde la partie ; renvoie faux si le navigateur refuse. */
  sauvegarder(): boolean;
  /** Affiche ou masque l'aide des touches. */
  aide(visible: boolean): void;
  /** Applique les options graphiques qui viennent de changer (sans recharger la page). */
  appliquerGraphismes(): void;
  /** Applique les volumes des sons qui viennent de changer. */
  appliquerVolumes(): void;
  /** Joue un bruitage, pour entendre le volume choisi. */
  essayerBruitage(): void;
  /** « Je suis coincé » : ramène au bord du trou. Renvoie un message si c'est refusé (le menu reste ouvert), sinon null. */
  coince(): string | null;
  /** « Retour au village » (aide aux tests) : ramène sur la place. Renvoie un message si c'est refusé, sinon null. */
  village(): string | null;
  /** Recommence : efface la partie de l'emplacement actif et recharge. */
  nouvellePartie(): void;
  /** Passe à un autre emplacement (charge sa partie, ou en commence une si vide) : sauvegarde l'actuel puis recharge. */
  changerEmplacement(numero: number): void;
  /** Vrai une fois le livre de fin refermé : le menu propose alors de le relire. */
  finDisponible(): boolean;
  /** Rouvre le livre de fin (le menu se ferme, le jeu reste figé tant que le livre est ouvert). */
  relireFin(): void;
}

export interface MenuPause {
  readonly ouvert: boolean;
  ouvrir(): void;
  /** Ferme le menu sans rien déclencher (la reprise du jeu est faite par l'appelant). */
  fermer(): void;
}

export function creerMenuPause(racine: HTMLElement, actions: ActionsMenu): MenuPause {
  const voile = document.createElement('div');
  voile.style.cssText = VOILE_ECRAN;
  const panneau = document.createElement('div');
  panneau.style.cssText = `${PANNEAU_ECRAN}gap:10px;min-width:300px;max-height:calc(100vh - 24px);`;
  voile.appendChild(panneau);
  racine.appendChild(voile);

  let ouvert = false;
  let aideVisible = false;
  let minuterie: number | undefined;

  const message = document.createElement('div');
  message.style.cssText = 'min-height:20px;text-align:center;font-size:14px;font-weight:700;';

  function bouton(texte: string, action: () => void, principal = false): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = texte;
    b.style.cssText = `${principal ? styleBoutonPrincipal() : styleBoutonSecondaire()}width:100%;font-size:16px;padding:9px 18px;`;
    b.addEventListener('click', action);
    return b;
  }

  /** Curseur « Sensibilité de la souris » : appliqué tout de suite et gardé dans le navigateur. */
  function reglageSensibilite(): HTMLElement {
    const { min, max, pas } = CONFIG.cameras.reglageSensibilite;
    const bloc = document.createElement('label');
    bloc.style.cssText = 'display:flex;flex-direction:column;gap:4px;font-size:15px;margin-top:4px;';
    const ligne = document.createElement('div');
    ligne.style.cssText = 'display:flex;justify-content:space-between;';
    const nom = document.createElement('span');
    nom.textContent = 'Sensibilité de la souris';
    const valeur = document.createElement('b');
    valeur.style.color = T.or;
    const curseur = creerCurseur();
    curseur.min = String(min);
    curseur.max = String(max);
    curseur.step = String(pas);
    curseur.value = String(sensibilite());
    const montrer = (v: number) => {
      valeur.textContent = `× ${v.toFixed(1)}`;
    };
    montrer(sensibilite());
    curseur.addEventListener('input', () => montrer(definirSensibilite(Number(curseur.value))));
    ligne.append(nom, valeur);
    bloc.append(ligne, curseur);
    return bloc;
  }

  /** Volumes des sons : général, effets, musique (curseurs en %), appliqués tout de suite et gardés dans le navigateur. */
  function reglagesSons(): HTMLElement {
    const bloc = document.createElement('div');
    bloc.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:6px;' + SEPARATEUR_HAUT;
    const titre = document.createElement('div');
    titre.textContent = 'Sons';
    titre.style.cssText = TITRE_SECTION;
    bloc.appendChild(titre);
    const canaux: ReadonlyArray<readonly [CanalVolume, string]> = [
      ['general', 'Volume général'],
      ['effets', 'Bruitages'],
      ['musique', 'Musique'],
    ];
    const actuels = volumesSon();
    for (const [canal, texte] of canaux) {
      const ligneBloc = document.createElement('label');
      ligneBloc.style.cssText = 'display:flex;flex-direction:column;gap:2px;font-size:15px;';
      const ligne = document.createElement('div');
      ligne.style.cssText = 'display:flex;justify-content:space-between;';
      const nom = document.createElement('span');
      nom.textContent = texte;
      const valeur = document.createElement('b');
      valeur.style.color = T.or;
      const curseur = creerCurseur();
      curseur.min = '0';
      curseur.max = '100';
      curseur.step = '5';
      curseur.value = String(Math.round(actuels[canal] * 100));
      const montrer = (v: number) => {
        valeur.textContent = v <= 0 ? 'coupé' : `${Math.round(v * 100)} %`;
      };
      montrer(actuels[canal]);
      curseur.addEventListener('input', () => {
        montrer(definirVolume(canal, Number(curseur.value) / 100));
        actions.appliquerVolumes();
      });
      // Curseur relâché : un petit bruit pour entendre le résultat (la musique, elle, ne s'entend qu'à l'auberge)
      if (canal !== 'musique') curseur.addEventListener('change', () => actions.essayerBruitage());
      ligne.append(nom, valeur);
      ligneBloc.append(ligne, curseur);
      bloc.appendChild(ligneBloc);
    }
    // Les pas à part : on peut les couper sans perdre les autres bruitages
    const { ligne: pas, case_: casePas } = caseACocher('Entendre mes pas', bruitsDePas());
    casePas.addEventListener('change', () => definirBruitsDePas(casePas.checked));
    bloc.appendChild(pas);
    return bloc;
  }

  /** Ligne « titre + choix à boutons » : le choix actuel est mis en avant, le changement est appliqué et gardé tout de suite. */
  function reglageChoix<V extends string>(
    titre: string,
    choix: ReadonlyArray<readonly [V, string]>,
    courant: V,
    changer: (valeur: V) => void,
  ): HTMLElement {
    const bloc = document.createElement('div');
    bloc.style.cssText = 'display:flex;flex-direction:column;gap:4px;font-size:15px;';
    const nom = document.createElement('span');
    nom.textContent = titre;
    const rangee = document.createElement('div');
    rangee.style.cssText = 'display:flex;gap:6px;';
    const boutons = choix.map(([valeur, texte]) => {
      const b = document.createElement('button');
      b.textContent = texte;
      b.style.cssText = styleBoutonChoix(false);
      b.addEventListener('click', () => {
        changer(valeur);
        marquer(valeur);
      });
      rangee.appendChild(b);
      return [valeur, b] as const;
    });
    function marquer(valeur: V): void {
      for (const [v, b] of boutons) {
        const actif = v === valeur;
        b.style.cssText = styleBoutonChoix(actif);
      }
    }
    marquer(courant);
    bloc.append(nom, rangee);
    return bloc;
  }

  /** Taille de la mini-carte : trois choix rapides (Petite / Normale / Grande) et un curseur fin ; appliqué tout de suite. */
  function reglageTailleCarte(): HTMLElement {
    const C = CONFIG.miniCarte;
    const choix = [
      ['Petite', C.diametrePetite],
      ['Normale', C.diametre],
      ['Grande', C.diametreGrande],
    ] as const;
    const bloc = document.createElement('div');
    bloc.style.cssText = 'display:flex;flex-direction:column;gap:4px;font-size:15px;';
    const ligne = document.createElement('div');
    ligne.style.cssText = 'display:flex;justify-content:space-between;';
    const nom = document.createElement('span');
    nom.textContent = 'Taille de la mini-carte';
    const valeur = document.createElement('b');
    valeur.style.color = T.or;
    ligne.append(nom, valeur);
    const rangee = document.createElement('div');
    rangee.style.cssText = 'display:flex;gap:6px;';
    const curseur = creerCurseur();
    curseur.min = String(C.diametreMin);
    curseur.max = String(C.diametreMax);
    curseur.step = String(C.diametrePas);
    const boutons = choix.map(([texte, diametre]) => {
      const b = document.createElement('button');
      b.textContent = texte;
      b.style.cssText = styleBoutonChoix(false);
      b.addEventListener('click', () => montrer(definirTailleMiniCarte(diametre)));
      rangee.appendChild(b);
      return [diametre, b] as const;
    });
    // Met en avant le choix qui correspond à la taille actuelle (aucun si le curseur est entre deux)
    function montrer(taille: number): void {
      valeur.textContent = `${taille} px`;
      curseur.value = String(taille);
      for (const [d, b] of boutons) {
        const actif = d === taille;
        b.style.cssText = styleBoutonChoix(actif);
      }
    }
    curseur.addEventListener('input', () => montrer(definirTailleMiniCarte(Number(curseur.value))));
    montrer(tailleMiniCarte());
    bloc.append(ligne, rangee, curseur);
    return bloc;
  }

  /** Options graphiques : distance de vue, ombres, images par seconde. */
  function reglagesGraphiques(): HTMLElement {
    const bloc = document.createElement('div');
    bloc.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:6px;' + SEPARATEUR_HAUT;
    const titre = document.createElement('div');
    titre.textContent = 'Graphismes';
    titre.style.cssText = TITRE_SECTION;
    const vue = reglageChoix<DistanceVue>(
      'Distance de vue (effet à la reprise)',
      [
        ['courte', 'Courte'],
        ['moyenne', 'Moyenne'],
        ['longue', 'Longue'],
      ],
      distanceVue(),
      (v) => {
        definirDistanceVue(v);
        actions.appliquerGraphismes();
      },
    );
    const ombres = reglageChoix<QualiteOmbres>(
      'Ombres',
      [
        ['aucune', 'Aucune'],
        ['moyennes', 'Moyennes'],
        ['hautes', 'Hautes'],
      ],
      qualiteOmbres(),
      (v) => {
        definirQualiteOmbres(v);
        actions.appliquerGraphismes();
      },
    );
    const { ligne: images, case_ } = caseACocher('Afficher les images par seconde (F3)', imagesParSeconde());
    case_.addEventListener('change', () => {
      definirImagesParSeconde(case_.checked);
      actions.appliquerGraphismes();
    });
    // Mini-carte : affichée ou non, orientée nord en haut ou tournant avec le joueur (lus à chaque image par la carte)
    const caseCarte = (texte: string, valeur: boolean, changer: (v: boolean) => void): HTMLElement => {
      const { ligne, case_: c } = caseACocher(texte, valeur);
      c.addEventListener('change', () => changer(c.checked));
      return ligne;
    };
    const carte = caseCarte('Afficher la mini-carte (M : agrandir)', miniCarteVisible(), definirMiniCarteVisible);
    const carteTourne = caseCarte('La mini-carte tourne avec moi', miniCarteTourne(), definirMiniCarteTourne);
    bloc.append(titre, vue, ombres, images, carte, carteTourne, reglageTailleCarte());
    return bloc;
  }

  function afficherMessage(texte: string, ok = false): void {
    message.textContent = texte;
    message.style.color = couleurMessage(ok);
    if (minuterie !== undefined) window.clearTimeout(minuterie);
    minuterie = window.setTimeout(() => {
      message.textContent = '';
    }, CONFIG.sauvegarde.dureeMessage);
  }

  function basculerAide(visible: boolean): void {
    aideVisible = visible;
    actions.aide(visible);
    // L'aide est centrée comme le menu : on cache le menu tant qu'elle est ouverte (un clic la ferme)
    panneau.style.display = visible ? 'none' : 'flex';
  }

  function dessinerPrincipal(): void {
    const titre = document.createElement('div');
    titre.textContent = 'Pause';
    titre.style.cssText = `${TITRE_ECRAN}text-align:center;margin-bottom:4px;`;
    panneau.replaceChildren(
      titre,
      bouton(
        'Reprendre',
        () => {
          fermer();
          actions.reprendre();
        },
        true,
      ),
      bouton('Sauvegarder', () => {
        const reussi = actions.sauvegarder();
        afficherMessage(reussi ? 'Partie sauvegardée' : 'Sauvegarde impossible', reussi);
      }),
      bouton('Aide', () => basculerAide(true)),
      bouton('Je suis coincé', () => {
        const refus = actions.coince();
        if (refus) {
          afficherMessage(refus);
          return;
        }
        fermer();
        actions.reprendre();
      }),
      ...(OUTILS_DE_TEST
        ? [
            bouton('Retour au village', () => {
              const refus = actions.village();
              if (refus) {
                afficherMessage(refus);
                return;
              }
              fermer();
              actions.reprendre();
            }),
          ]
        : []),
      bouton('Parties', dessinerParties),
      ...(actions.finDisponible()
        ? [
            bouton('Relire la fin', () => {
              fermer();
              actions.relireFin();
            }),
          ]
        : []),
      reglageSensibilite(),
      reglagesSons(),
      reglagesGraphiques(),
      message,
    );
  }

  /** Bouton qui demande deux clics : le premier le change en « Confirmer ? », le second lance l'action. */
  function boutonDeuxClics(texte: string, action: () => void): HTMLButtonElement {
    const b = bouton(texte, () => {
      if (b.textContent !== 'Confirmer ?') {
        b.textContent = 'Confirmer ?';
        return;
      }
      action();
    });
    b.style.width = 'auto';
    b.style.flex = '1';
    return b;
  }

  /** Bouton d'une ligne d'emplacement (moins large que ceux du menu principal). */
  function boutonLigne(texte: string, action: () => void): HTMLButtonElement {
    const b = bouton(texte, action);
    b.style.width = 'auto';
    b.style.flex = '1';
    return b;
  }

  /** Les trois emplacements de partie : charger, commencer, recommencer, effacer. */
  function dessinerParties(): void {
    const titre = document.createElement('div');
    titre.textContent = 'Parties';
    titre.style.cssText = `${TITRE_ECRAN}text-align:center;margin-bottom:4px;`;
    const actif = emplacementActif();
    const lignes: HTMLElement[] = [];
    for (let n = 1; n <= NOMBRE_EMPLACEMENTS; n++) {
      const resume = resumeEmplacement(lireSauvegarde(n), CONFIG.graine);
      const ligne = document.createElement('div');
      ligne.style.cssText = `display:flex;flex-direction:column;gap:6px;padding:8px 0;${SEPARATEUR_HAUT}`;
      const entete = document.createElement('div');
      entete.style.cssText = 'display:flex;justify-content:space-between;gap:12px;font-size:15px;';
      const nom = document.createElement('b');
      nom.textContent = n === actif ? `Partie ${n} (en cours)` : `Partie ${n}`;
      nom.style.color = T.or;
      const etat = document.createElement('span');
      etat.textContent = resume ?? 'Emplacement vide';
      etat.style.color = T.doux;
      entete.append(nom, etat);
      const rangee = document.createElement('div');
      rangee.style.cssText = 'display:flex;gap:6px;';
      if (n === actif) {
        rangee.appendChild(boutonDeuxClics('Recommencer', actions.nouvellePartie));
      } else if (resume !== null) {
        rangee.append(
          boutonLigne('Charger', () => actions.changerEmplacement(n)),
          boutonDeuxClics('Effacer', () => {
            effacerSauvegarde(n);
            dessinerParties();
          }),
        );
      } else {
        rangee.appendChild(boutonLigne('Nouvelle partie', () => actions.changerEmplacement(n)));
      }
      ligne.append(entete, rangee);
      lignes.push(ligne);
    }
    panneau.replaceChildren(titre, ...lignes, bouton('Retour', dessinerPrincipal, true));
  }

  // Un clic sur le voile (à côté du panneau) referme l'aide si elle est affichée, sinon fait comme « Reprendre »
  // L'appui doit aussi avoir commencé sur le voile : un curseur de réglage relâché à côté du panneau ne ferme rien
  let appuiSurVoile = false;
  voile.addEventListener('mousedown', (e) => {
    appuiSurVoile = e.button === 0 && e.target === voile;
  });
  voile.addEventListener('click', (e) => {
    // Le clic sur le bouton « Aide » lui-même (cible = bouton) ne doit pas refermer l'aide aussitôt
    const valide = appuiSurVoile && e.target === voile;
    appuiSurVoile = false;
    if (!valide) return;
    if (aideVisible) {
      basculerAide(false);
      return;
    }
    fermer();
    actions.reprendre();
  });

  function fermer(): void {
    if (aideVisible) basculerAide(false);
    ouvert = false;
    message.textContent = '';
    voile.style.display = 'none';
  }

  return {
    get ouvert() {
      return ouvert;
    },
    ouvrir() {
      if (ouvert) return;
      ouvert = true;
      aideVisible = false;
      panneau.style.display = 'flex';
      dessinerPrincipal();
      voile.style.display = 'flex';
    },
    fermer,
  };
}
