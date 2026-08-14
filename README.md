# PorteJunes

Envoyez et recevez des Ğ1 (monnaie libre, [Duniter](https://duniter.org)) via le Réseau Social
Universel — un "hot wallet" éphémère, créé automatiquement et lié à votre WebID via
`foaf:tipjar`, inspiré de [G1nkgo](https://g1nkgo.comunes.org/).

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

# Terminal 2 -- backend de l'app (port 3011)
cd backend && yarn install && yarn dev

# Terminal 3 -- frontend (port 5173)
cd frontend && yarn install && yarn dev
```

Créez un compte sur le Pod provider de test (http://localhost:5000), puis ouvrez
http://localhost:5173, connectez-vous, et autorisez l'application.

Par défaut, tout pointe vers **Ğ1-Test** (réseau de test Duniter, fausse monnaie) — voir
`backend/.env` / `frontend/.env` pour basculer vers Ğ1 (mainnet, argent réel), à ne faire qu'une
fois l'application testée et prête.

## Structure

- `backend/` — app Moleculer/SemApps (`@activitypods/app` 2.2). `wallet.service.js` gère l'accès
  au secret du portefeuille (lecture seule, création faite côté frontend) ;
  `pay-activity.service.js` gère l'activité `Pay` (c'est là que le virement Ğ1 a réellement lieu,
  via `lib/duniter-client.js`) ; `app.service.js` déclare les besoins d'accès (access needs).
- `frontend/` — app Refine + Antd. `hooks/useWallet.ts` crée le portefeuille au premier lancement
  (clé générée dans le navigateur, jamais stockée en `localStorage`, immédiatement persistée sur
  le Pod) ; `hooks/useDuniter.ts` lit le solde/historique directement depuis le réseau Duniter,
  sans passer par le backend.
- `shapes/` — définitions SHACL/shape-tree de la ressource `g1:WalletSecret` propre à cette app
  (servies statiquement par le frontend, voir `frontend/public/{shapes,shapetrees}`).
