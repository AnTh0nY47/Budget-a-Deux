# Chez nous

Petite appli pour la maison, à deux. Côté budget, elle partage les charges au prorata de nos salaires. Chaque mois elle reprend nos charges habituelles, on peut les modifier si quelque chose change, et elle calcule toute seule le virement à faire pour être quittes.

Le site est hébergé sur GitHub Pages. Les chiffres sont stockés dans Firebase et seuls nos deux comptes Google peuvent les lire ou les modifier.

## Mise en route

1. Créer un projet sur console.firebase.google.com (le plan gratuit suffit).
2. Dans Authentication, activer la connexion Google, puis ajouter le domaine du site GitHub Pages dans les domaines autorisés.
3. Dans Firestore Database, créer une base, puis coller le contenu de firestore.rules dans l'onglet Règles en mettant nos deux adresses Gmail.
4. Dans les paramètres du projet, ajouter une application Web et recopier sa configuration dans firebase-config.js.
5. Sur GitHub, dans Settings puis Pages, choisir la branche main comme source.

## Le résumé du jour

À chaque ouverture de l'appli, une fenêtre résume la journée : le ménage à faire, le virement s'il n'est pas encore fait, ce qu'il y a sur la liste de courses et les réparations urgentes. On la ferme d'un geste ou on touche une ligne pour aller au bon onglet. Le code est dans resume.js.

## Le suivi

En bas du virement, un graphique montre mois par mois ce qui part dans les charges (aides déduites), dans les courses et dans les autres dépenses communes, sur les six derniers mois. On touche une barre pour voir le détail, et le même détail existe en tableau.

## Sur le téléphone

Le site s'installe comme une appli. Sur iPhone, on l'ouvre dans Safari, on appuie sur Partager puis sur Sur l'écran d'accueil. Sur Android, Chrome propose de l'installer, sinon c'est dans le menu avec les trois points puis Installer l'application. Il s'ouvre ensuite en plein écran avec sa propre icône et garde les derniers chiffres pour s'afficher même avec peu de réseau.

## Le ménage

L'onglet Ménage garde la liste des tâches de la maison avec leur fréquence. Il montre ce qui est à faire maintenant, ce qui arrive dans la semaine, et quand chaque chose a été faite pour la dernière fois et par qui. Un appui sur C'est fait et la prochaine date se recalcule. Chaque tâche peut revenir tous les X jours, semaines ou mois, ou certains jours précis de la semaine, pratique pour les poubelles. Avant de partir, le bouton Partir en vacances met le ménage et ses rappels en pause. Au retour, chaque tâche reprend avec le temps qu'il lui restait au départ. Une tâche peut avoir un ou plusieurs produits associés, comme la lessive et l'adoucissant pour la machine : sous la tâche, on touche ce qui manque et ça part dans la liste de courses.

Chaque soir à 18h, une tâche GitHub regarde ce qui est à faire et envoie une notification sur les téléphones qui l'ont activée. Le 1er du mois, puis tous les trois jours tant qu'il n'est pas coché, elle rappelle aussi le virement à faire avec son montant. Le script est dans le dossier rappel. Il a besoin du secret FIREBASE_SERVICE_ACCOUNT dans les réglages du dépôt, et la clé Web Push du projet doit être mise dans firebase-config.js.

## Sans réseau

L'appli marche sans réseau, en magasin par exemple. Les pages sont gardées sur le téléphone, et si ça capte mal elle n'attend pas plus de trois secondes avant de les afficher. Firebase garde aussi les données sur le téléphone : on peut ajouter, cocher et terminer les courses hors connexion, tout part dès que le réseau revient. Un petit bandeau prévient quand il n'y a plus de réseau.

## Les courses

L'onglet Courses est une liste partagée. On tape ce qui manque et l'appli le range tout seul par rayon. En magasin on coche ce qu'on met dans le panier, l'autre le voit en direct. À la fin, on indique le montant du ticket et qui a payé : il part dans les dépenses du mois du budget. Les articles achetés souvent sont proposés pour les rajouter d'un geste.

## À réparer

L'onglet À réparer garde les petits travaux de la maison : l'ampoule grillée, le robinet qui fuit, l'étagère à monter. Chaque chose a une urgence, une précision si besoin, et on voit depuis quand elle attend. Une fois réglée, on la coche et elle part dans l'historique avec le nom de celui qui s'en est occupé.

## Sauvegardes

L'appli se sauvegarde toute seule une fois par semaine, à la première ouverture, et garde les huit dernières sauvegardes dans Firebase. En bas de l'onglet Budget, on peut sauvegarder à la main, restaurer une sauvegarde ou télécharger toutes les données dans un fichier. Avant chaque restauration, l'état actuel est sauvegardé pour pouvoir revenir en arrière. Le code est dans sauvegarde.js.

## Utilisation

On se connecte avec son compte Google. La première fois, le bouton « Commencer un budget » crée un budget vide à remplir. Ensuite tout se modifie directement sur la page et se met à jour chez l'autre en temps réel.
