.DEFAULT_GOAL := help
.PHONY: start stop restart config upgrade attach-pod-provider logs install backend frontend shapes shapes-stop help

DOCKER_COMPOSE_DEV=docker compose -f docker-compose-dev.yml --env-file .env
DOCKER_COMPOSE_SHAPES=docker compose -f docker-compose-shapes.yml

# Infra (Fuseki, Redis, a local ActivityPods Pod provider for testing)

start: ## Start the dev infra (Fuseki, Redis, Pod provider)
	$(DOCKER_COMPOSE_DEV) up -d

stop: ## Stop and remove the dev infra containers
	$(DOCKER_COMPOSE_DEV) kill
	$(DOCKER_COMPOSE_DEV) rm -fv

restart: stop start ## Restart the dev infra

config: ## Print the resolved docker-compose config
	$(DOCKER_COMPOSE_DEV) config

upgrade: ## Pull latest images and restart
	$(DOCKER_COMPOSE_DEV) pull
	$(DOCKER_COMPOSE_DEV) up -d

logs: ## Tail the dev infra logs
	$(DOCKER_COMPOSE_DEV) logs -f

attach-pod-provider: ## Attach to the Pod provider's pm2 process (Ctrl+C to detach)
	$(DOCKER_COMPOSE_DEV) exec activitypods-backend pm2 attach 0

# App (runs directly on the host, not dockerized -- see README)

install: ## Install backend + frontend dependencies
	cd backend && yarn install
	cd frontend && yarn install

backend: ## Run the app backend (moleculer, hot reload)
	cd backend && yarn dev

frontend: ## Run the app frontend (vite)
	cd frontend && yarn dev

shapes: ## Serve this app's own shapetree (g1:WalletSecret) on its own origin, required for the backend to start
	$(DOCKER_COMPOSE_SHAPES) up -d

shapes-stop: ## Stop the shapes static file server
	$(DOCKER_COMPOSE_SHAPES) kill
	$(DOCKER_COMPOSE_SHAPES) rm -fv

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "\033[36m%-22s\033[0m %s\n", $$1, $$2}'
