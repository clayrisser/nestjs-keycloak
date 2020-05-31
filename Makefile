include node_modules/gnumake/gnumake.mk

COLLECT_COVERAGE_FROM := ["src/**/*.{js,jsx,ts,tsx}"]

.PHONY: all
all: build

.PHONY: install
install: node_modules
node_modules: package.json
	@$(NPM) install

.PHONY: prepare
prepare:
	@

.PHONY: format
format: install
	-@eslint --fix --ext .js,.jsx,.ts,.tsx . 2>$(NULL)
	@prettier --write ./**/*.{json,md,scss,yaml,yml,js,jsx,ts,tsx} --ignore-path .gitignore
	@$(MKDIRP) node_modules/.make && $(TOUCH) -m node_modules/.make/format
node_modules/.make/format: $(shell $(GIT) ls-files | $(GREP) "\.(j|t)sx?$$")
	@$(MAKE) -s format

.PHONY: spellcheck
spellcheck: node_modules/.make/format
	-@cspell --config .cspellrc src/**/*.ts
	@$(MKDIRP) node_modules/.make && $(TOUCH) -m node_modules/.make/spellcheck
node_modules/.make/spellcheck: $(shell $(GIT) ls-files | $(GREP) "\.(j|t)sx?$$")
	-@$(MAKE) -s spellcheck

.PHONY: lint
lint: node_modules/.make/spellcheck
	# @lockfile-lint --type npm --path package-lock.json --validate-https
	-@tsc --allowJs --noEmit
	-@eslint -f json -o node_modules/.tmp/eslintReport.json --ext .js,.jsx,.ts,.tsx . 2>$(NULL)
	@eslint --ext .js,.jsx,.ts,.tsx .
node_modules/.tmp/eslintReport.json: $(shell $(GIT) ls-files | $(GREP) "\.(j|t)sx?$$")
	-@$(MAKE) -s lint

.PHONY: test
test: node_modules/.tmp/eslintReport.json
	@jest --json --outputFile=node_modules/.tmp/jestTestResults.json --coverage --coverageDirectory=node_modules/.tmp/coverage --testResultsProcessor=jest-sonar-reporter --collectCoverageFrom='$(COLLECT_COVERAGE_FROM)' $(ARGS)
node_modules/.tmp/coverage/lcov.info: $(shell $(GIT) ls-files | $(GREP) "\.(j|t)sx?$$")
	-@$(MAKE) -s test

.PHONY: coverage
coverage: node_modules/.tmp/eslintReport.json
	@jest --coverage --collectCoverageFrom='$(COLLECT_COVERAGE_FROM)' $(ARGS)

.PHONY: test-ui
test-ui: node_modules/.tmp/eslintReport.json node_modules
	@majestic $(ARGS)

.PHONY: test-watch
test-watch: node_modules/.tmp/eslintReport.json node_modules
	@jest --watch $(ARGS)

.PHONY: clean
clean:
	-@jest --clearCache
ifeq ($(PLATFORM), win32)
	@$(GIT) clean -fXd -e !/node_modules -e !/node_modules/**/* -e !/yarn.lock -e !/pnpm-lock.yaml -e !/package-lock.json
else
	@$(GIT) clean -fXd -e \!/node_modules -e \!/node_modules/**/* -e \!/yarn.lock -e \!/pnpm-lock.yaml -e \!/package-lock.json
endif
	-@$(RM) -rf node_modules/.cache
	-@$(RM) -rf node_modules/.make
	-@$(RM) -rf node_modules/.tmp

.PHONY: build
build: lib
lib: node_modules/.tmp/coverage/lcov.info $(shell $(GIT) ls-files)
	-@$(RM) -r lib node_modules/.tmp/lib 2>$(NULL) || $(TRUE)
	# @babel src -d lib --extensions '.ts,.tsx' --source-maps inline
	# @tsc -d --emitDeclarationOnly
	@tsc
	@$(CP) -r node_modules/.tmp/lib/src/. lib

.PHONY: start
start:
	@babel-node --extensions '.ts,.tsx' src $(ARGS)

.PHONY: purge
purge: clean
	@$(GIT) clean -fXd

.PHONY: report
report: spellcheck lint test
	@

%:
	@
