include mkpm.mk
ifneq (,$(MKPM_READY))
include $(MKPM)/gnu
include $(MKPM)/dotenv
include $(MKPM)/envcache

TS_NODE ?= node_modules/.bin/ts-node

.PHONY: docker/%
docker/%:
	@$(MAKE) -sC docker $(subst docker/,,$@) ARGS=$(ARGS)

.PHONY: start
start:
	@$(TS_NODE) src/index.ts		
#	@$(TS_NODE) src/methods/index.ts

endif
