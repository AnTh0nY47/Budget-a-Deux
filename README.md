# Chez nous

Petite appli pour la maison, à deux. Côté budget, elle partage les charges au prorata de nos salaires. Chaque mois elle reprend nos charges habituelles, on peut les modifier si quelque chose change, et elle calcule toute seule le virement à faire pour être quittes.

Le site est hébergé sur GitHub Pages. Les chiffres sont stockés dans Firebase et seuls nos deux comptes Google peuvent les lire ou les modifier.

## Mise en route

1. Créer un projet sur console.firebase.google.com (le plan gratuit suffit).
2. Dans Authentication, activer la connexion Google, puis ajouter le domaine du site GitHub Pages dans les domaines autorisés.
3. Dans Firestore Database, créer une base, puis coller le contenu de firestore.rules dans l'onglet Règles en mettant nos deux adresses Gmail.
4. Dans les paramètres du projet, ajouter une application Web et recopier sa configuration dans firebase-config.js.
5. Sur GitHub, dans Settings puis Pages, choisir la branche main comme source.

## Sur le téléphone

Le site s'installe comme une appli. Sur iPhone, on l'ouvre dans Safari, on appuie sur Partager puis sur Sur l'écran d'accueil. Sur Android, Chrome propose de l'installer, sinon c'est dans le menu avec les trois points puis Installer l'application. Il s'ouvre ensuite en plein écran avec sa propre icône et garde les derniers chiffres pour s'afficher même avec peu de réseau.

## Le ménage

L'onglet Ménage garde la liste des tâches de la maison avec leur fréquence. Il montre ce qui est à faire maintenant, ce qui arrive dans la semaine, et quand chaque chose a été faite pour la dernière fois et par qui. Un appui sur C'est fait et la prochaine date se recalcule. Chaque tâche peut revenir tous les X jours, semaines ou mois, ou certains jours précis de la semaine, pratique pour les poubelles.

Chaque soir à 18h, une tâche GitHub regarde ce qui est à faire et envoie une notification sur les téléphones qui l'ont activée. Le script est dans le dossier rappel. Il a besoin du secret FIREBASE_SERVICE_ACCOUNT dans les réglages du dépôt, et la clé Web Push du projet doit être mise dans firebase-config.js.

## Les courses

L'onglet Courses est une liste partagée. On tape ce qui manque et l'appli le range tout seul par rayon. En magasin on coche ce qu'on met dans le panier, l'autre le voit en direct. À la fin, on indique le montant du ticket et qui a payé : il part dans les dépenses du mois du budget. Les articles achetés souvent sont proposés pour les rajouter d'un geste.

## Utilisation

On se connecte avec son compte Google. La première fois, le bouton « Commencer un budget » crée un budget vide à remplir. Ensuite tout se modifie directement sur la page et se met à jour chez l'autre en temps réel.
