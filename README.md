# Budget à deux

Petit site pour gérer les charges de la maison à deux, au prorata de nos salaires. Chaque mois il reprend nos charges habituelles, on peut les modifier si quelque chose change, et il calcule tout seul le virement à faire pour être quittes.

Le site est hébergé sur GitHub Pages. Les chiffres sont stockés dans Firebase et seuls nos deux comptes Google peuvent les lire ou les modifier.

## Mise en route

1. Créer un projet sur console.firebase.google.com (le plan gratuit suffit).
2. Dans Authentication, activer la connexion Google, puis ajouter le domaine du site GitHub Pages dans les domaines autorisés.
3. Dans Firestore Database, créer une base, puis coller le contenu de firestore.rules dans l'onglet Règles en mettant nos deux adresses Gmail.
4. Dans les paramètres du projet, ajouter une application Web et recopier sa configuration dans firebase-config.js.
5. Sur GitHub, dans Settings puis Pages, choisir la branche main comme source.

## Sur le téléphone

Le site s'installe comme une appli. Sur iPhone, on l'ouvre dans Safari, on appuie sur Partager puis sur Sur l'écran d'accueil. Sur Android, Chrome propose de l'installer, sinon c'est dans le menu avec les trois points puis Installer l'application. Il s'ouvre ensuite en plein écran avec sa propre icône et garde les derniers chiffres pour s'afficher même avec peu de réseau.

## Rappel du virement

Le 1er de chaque mois vers 9h, GitHub envoie un mail à nous deux avec le montant à virer pour le mois qui vient de se finir. Si le virement est déjà coché dans l'appli, ou s'il n'y a rien à virer, aucun mail ne part. Le script est dans le dossier rappel et la tâche dans .github/workflows/rappel.yml. Il a besoin de quatre secrets dans les réglages du dépôt : FIREBASE_SERVICE_ACCOUNT, GMAIL_USER, GMAIL_APP_PASSWORD et MAIL_TO.

## Utilisation

On se connecte avec son compte Google. La première fois, le bouton « Commencer avec nos chiffres » remplit le budget avec nos montants actuels. Ensuite tout se modifie directement sur la page et se met à jour chez l'autre en temps réel.
