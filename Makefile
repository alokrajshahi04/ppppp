.PHONY: help dev up down build logs clean test lint seed shell-backend shell-ai shell-db shell-minio restart status install install-frontend install-backend install-ai install-contracts

COMPOSE = docker compose

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: install-contracts install-backend install-frontend install-ai ## Install all workspace deps

install-contracts:
	cd contracts && npm install

install-backend:
	cd backend && npm install

install-frontend:
	cd frontend && npm install

install-ai:
	cd ai-engine && pip install -e .

dev: ## Start all services with logs (foreground)
	$(COMPOSE) up --build

up: ## Start all services in background
	$(COMPOSE) up -d --build

down: ## Stop all services
	$(COMPOSE) down

restart: ## Restart all services
	$(COMPOSE) restart

build: ## Build all docker images
	$(COMPOSE) build

logs: ## Tail logs from all services
	$(COMPOSE) logs -f

status: ## Show service status
	$(COMPOSE) ps

clean: ## Stop services and remove volumes
	$(COMPOSE) down -v

seed: ## Run database seed (manual)
	@echo "Seeding runs automatically on first postgres boot via init scripts."

shell-backend: ## Open shell in backend container
	$(COMPOSE) exec backend sh

shell-ai: ## Open shell in ai-engine container
	$(COMPOSE) exec ai-engine bash

shell-db: ## Open psql in postgres container
	$(COMPOSE) exec postgres psql -U ${POSTGRES_USER:-tolti} -d ${POSTGRES_DB:-tolti}

shell-minio: ## Open mc shell in minio-init container
	$(COMPOSE) run --rm minio-init /bin/sh

test: ## Run the 45-check API E2E suite
	./scripts/api-test.sh

lint: ## Run linters (placeholder)
	@echo "Linters will be wired in a later wave."
