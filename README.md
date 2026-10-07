# Budget à deux

Petit site pour gérer les charges de la maison à deux, au prorata de nos salaires. Chaque mois il reprend nos charges habituelles, on peut les modifier si quelque chose change, et il calcule tout seul le virement à faire pour être quittes.

Le site est hébergé sur GitHub Pages. Les chiffres sont stockés dans Firebase et seuls nos deux comptes Google peuvent les lire ou les modifier.

## Mise en route

1. Créer un projet sur console.firebase.google.com (le plan gratuit suffit).
2. Dans Authentication, activer la connexion Google, puis ajouter le domaine du site GitHub Pages dans les domaines autorisés.
3. Dans Firestore Database, créer une base, puis coller le contenu de firestore.rules dans l'onglet Règles en mettant nos deux adresses Gmail.
4. Dans les paramètres du projet, ajouter une application Web et recopier sa configuration dans firebase-config.js.
5. Sur GitHub, dans Settings puis Pages, choisir la branche main comme source.

## Utilisation

On se connecte avec son compte Google. La première fois, le bouton « Commencer avec nos chiffres » remplit le budget avec nos montants actuels. Ensuite tout se modifie directement sur la page et se met à jour chez l'autre en temps réel.
