include mkpm.mk
ifneq (,$(MKPM_READY))
include $(MKPM)/gnu
include $(MKPM)/dotenv
include $(MKPM)/envcache

.PHONY: docker/%
docker/%:
	@$(MAKE) -sC docker $(subst docker/,,$@) ARGS=$(ARGS)

endif
