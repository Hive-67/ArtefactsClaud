# Tétriste 🎮

Un jeu de **Tetris** moderne, complet et fluide — jouable au clavier sur ordinateur comme au tactile sur téléphone. Aucune dépendance, aucun build : c'est du HTML/CSS/JavaScript pur.

## Lancer le jeu

Ouvre simplement `index.html` dans un navigateur, ou sers le dossier :

```bash
cd tetris
python3 -m http.server 8000
# puis ouvre http://localhost:8000
```

## Fonctionnalités

- **Moteur complet** : 7 tetrominoes, rotation **SRS** avec *wall kicks*, sac de 7 (7-bag), pièce **fantôme**, **réserve** (hold), file des 5 pièces suivantes, *hard drop* / *soft drop*.
- **25 niveaux** (jusqu'à 30 en mode Marathon) : la vitesse de chute augmente à chaque palier de 10 lignes.
- **Scoring avancé** : simples/doubles/triples, **Tetris**, **T-spins**, combos et bonus **back-to-back**.
- **Audio 100% procédural** (Web Audio API) : effets sonores + **5 musiques** de fond au choix, aucun fichier externe.
- **Responsive** : interface adaptée desktop et mobile.
- **Contrôles tactiles repositionnables** : déplace, redimensionne et règle l'opacité des boutons. Gestes (swipe) également disponibles.
- **Paramètres complets** : volumes, choix de musique, 5 thèmes de couleurs, ghost, grille, particules, secousse d'écran, DAS/ARR, vibration.
- **Sauvegarde locale** des réglages et des records.

## Contrôles clavier

| Touche | Action |
| --- | --- |
| ← → | Déplacer |
| ↓ | Descente douce |
| Espace | Chute instantanée |
| ↑ / X | Rotation horaire |
| Z / Ctrl | Rotation anti-horaire |
| C / Maj | Réserve (hold) |
| P / Échap | Pause |

## Mobile

Boutons tactiles à l'écran (repositionnables via *Paramètres → Boutons*) ou gestes : glisser pour déplacer, glisser vers le bas pour la chute rapide, taper pour tourner.
