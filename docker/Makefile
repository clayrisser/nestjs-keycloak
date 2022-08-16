include ../mkpm.mk
ifneq (,$(MKPM_READY))
include $(MKPM)/gnu

export DOCKER_COMPOSE := docker-compose
export CONTEXT := .
export NAME := age-poc
export VERSION := 0.0.1

include $(MKPM)/docker

endif
