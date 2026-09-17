# PorteJunes

Envoyez et recevez des Ğ1 (monnaie libre, [Duniter](https://duniter.org)) via le Réseau Social
Universel — un "hot wallet" éphémère, généré à la demande de l'utilisateur et lié à votre WebID
via `foaf:tipjar`, inspiré de [G1nkgo](https://g1nkgo.comunes.org/).

Compatible [ActivityPods](https://activitypods.org/) 2.2, construit avec
[Refine](https://refine.dev/) + [Ant Design](https://ant.design/) et
[`@activitypods/refine-providers`](https://github.com/activitypods/refine-providers).

## Statut

Travail en cours — voir le plan d'implémentation pour le détail des choix techniques et des
risques encore ouverts (en particulier : l'historique des transactions dépend d'un indexeur
communautaire expérimental, et le comportement exact de Duniter sur les transferts wallet-à-wallet
fraîchement créés reste à vérifier).

Implémenté : scaffold backend (Moleculer/SemApps) + frontend (Refine/Antd), création de
portefeuille, activité `Pay` (émission + réception), écrans Payer/Recevoir/Opérations/Contacts.

Pas encore testé de bout en bout avec deux vrais comptes Pod.

## Développement

```bash
# Terminal 1 -- infrastructure (Fuseki, Redis, un Pod provider ActivityPods de test)
docker compose -f docker-compose-dev.yml up

# Terminal 2 -- backend de l'app (port 3004)
cd backend && yarn install && yarn dev

# Terminal 3 -- frontend (port 4004)
cd frontend && yarn install && yarn dev
```

Le backend cible un Pod provider ActivityPods **2.3** (branche `next`) : `@activitypods/app` doit être
en 2.3.x et `@semapps/*` en 1.2.x, les 2.2/1.1 publiés attendent encore les `interop:DataGrant` que
2.3 a supprimés (sinon l'enregistrement de l'app échoue silencieusement côté backend, l'app n'écoute
pas l'inbox et le frontend affiche « L'application n'écoute pas … »). Pour développer sur le framework
lui-même, `yarn link-packages` lie `@activitypods/app` à `activitypods/app-framework/app` (`yarn link`
lancé là-bas au préalable) ; ce dépôt étant en TypeScript, `yarn dev` passe par `tsx`. Retour aux
paquets npm : `yarn unlink-packages`.

Créez un compte sur le Pod provider de test (http://localhost:5000), puis ouvrez
http://localhost:4004, connectez-vous, et autorisez l'application.

Par défaut, tout pointe vers **Ğ1-Test** (réseau de test Duniter, fausse monnaie) — voir
`backend/.env` / `frontend/.env` pour basculer vers Ğ1 (mainnet, argent réel), à ne faire qu'une
fois l'application testée et prête.

## Structure

- `backend/` — app Moleculer/SemApps (`@activitypods/app` 2.2). `pay-activity.service.js` ne fait
  qu'écouter la réception de l'activité `Pay` (`onReceive`) pour notifier le destinataire — le
  virement Ğ1 lui-même a déjà eu lieu côté frontend à ce stade, voir plus bas ; `app.service.js`
  déclare les besoins d'accès (access needs).
- `frontend/` — app Refine + Antd. Tant que le compte n'a pas de portefeuille, `PageLayout`
  affiche `pages/WalletSetupPage.tsx` à la place de tous les écrans : elle explique ce qu'est un
  hot wallet et où il est stocké, et c'est le bouton "Générer" qui appelle
  `hooks/useWallet.ts#createWallet()` (clé générée dans le navigateur, jamais stockée en
  `localStorage`, immédiatement persistée sur le Pod) — la création n'est volontairement plus
  automatique. `useWallet` expose aussi `pay()` : le virement Ğ1 est signé et diffusé sur la chaîne directement depuis
  le navigateur (`hooks/useDuniter.ts`), pas par le backend — délibérément, pour qu'aucune autre
  app du Réseau Social Universel ne puisse déclencher un virement en postant simplement une
  activité `Offer{g1:Payment}` dans l'outbox (ce qui était le cas avant : n'importe quelle app
  disposant du droit générique `apods:PostOutbox` pouvait faire bouger de l'argent réel, sans
  consentement spécifique au paiement). Une autre app qui veut permettre un paiement redirige donc
  vers cette app (`?to=<WebID ou adresse Ğ1>&amount=<Ğ1>&comment=<texte>` sur `/`, voir
  `PayerPage.tsx`) plutôt que de poster l'activité elle-même ; l'utilisateur n'a plus qu'à cliquer
  sur "Envoyer". `hooks/useDuniter.ts` lit aussi le solde/historique directement depuis le réseau
  Duniter, sans passer par le backend.
- Shapes — la ressource `g1:WalletSecret` propre à cette app (namespace
  `https://portejunes.com/ns/core#`) est publiée sur https://shapes.activitypods.org/ comme les
  shapes standard (source dans le dépôt [activitypods/shapes](https://github.com/activitypods/shapes),
  `packages/shape-definitions/source/{shapes,shapetrees}/g1/WalletSecret.ttl`). Ni le backend ni
  le frontend ne pourraient l'héberger eux-mêmes : l'enregistrement des access needs par
  `app.service.js` va chercher ce shapetree via `ldp.remote.get`, qui refuse toute URL sous le
  `SEMAPPS_HOME_URL` du backend (protection contre l'auto-référencement, voir `isRemote` dans
  `@semapps/ldp`).
