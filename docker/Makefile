.POSIX:
ROOTDIR ?= $(eval ROOTDIR := $(shell git rev-parse --show-toplevel))$(ROOTDIR)
include $(ROOTDIR)/make.mk

.DEFAULT_GOAL := up

.PHONY: up
up: FORCE
	@$(COMPOSE) up

.PHONY: up-d
up-d: FORCE
	@$(COMPOSE) up -d --wait

.PHONY: down
down: FORCE
	@$(COMPOSE) down --volumes --remove-orphans

.PHONY: logs
logs: FORCE
	@$(COMPOSE) logs -f

.PHONY: ps
ps: FORCE
	@$(COMPOSE) ps
