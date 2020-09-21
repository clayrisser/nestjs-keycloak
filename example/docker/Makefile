NAME := $(shell node -e "console.log(require('../package.json').name)")
REGISTRY := $(shell node -e "console.log(require('../package.json').docker.registry)")
VERSION := $(shell node -e "console.log(require('../package.json').version)")
IMAGE := $(REGISTRY)/$(NAME)

include docker.mk

.PHONY: postgres
postgres:
	@docker-compose up $(ARGS) postgres

.PHONY: keycloak
keycloak:
	@docker-compose up $(ARGS) keycloak

.PHONY: redis
redis:
	@docker-compose up $(ARGS) redis

.PHONY: deps
deps:
	@docker-compose up $(ARGS) deps

%:
	@
