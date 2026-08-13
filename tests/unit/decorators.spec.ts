import { describe, expect, it } from 'vitest';
import { AUTHORIZED, Authorized } from '../../src/decorators/authorized.decorator';
import { PUBLIC, Public } from '../../src/decorators/public.decorator';
import { REDIRECT_UNAUTHORIZED, RedirectUnauthorized } from '../../src/decorators/redirectUnauthorized.decorator';
import { RESOURCE, Resource } from '../../src/decorators/resource.decorator';
import { SCOPES, Scopes } from '../../src/decorators/scopes.decorator';

describe('Authorized', () => {
  it('sets roles metadata on a method', () => {
    class TestController {
      @Authorized('admin', ['editor', 'reviewer'])
      handler() {}
    }
    expect(Reflect.getMetadata(AUTHORIZED, TestController.prototype.handler)).toEqual([
      'admin',
      ['editor', 'reviewer'],
    ]);
  });

  it('sets empty roles metadata when called without arguments', () => {
    class TestController {
      @Authorized()
      handler() {}
    }
    expect(Reflect.getMetadata(AUTHORIZED, TestController.prototype.handler)).toEqual([]);
  });

  it('sets roles metadata on a class', () => {
    @Authorized('realm:admin')
    class TestController {}
    expect(Reflect.getMetadata(AUTHORIZED, TestController)).toEqual(['realm:admin']);
  });
});

describe('Public', () => {
  it('sets public metadata on a method', () => {
    class TestController {
      @Public()
      handler() {}
    }
    expect(Reflect.getMetadata(PUBLIC, TestController.prototype.handler)).toBe(true);
  });
});

describe('Resource', () => {
  it('sets resource metadata on a class', () => {
    @Resource('cats')
    class TestController {}
    expect(Reflect.getMetadata(RESOURCE, TestController)).toBe('cats');
  });
});

describe('Scopes', () => {
  it('sets scopes metadata on a method', () => {
    class TestController {
      @Scopes('read', 'write')
      handler() {}
    }
    expect(Reflect.getMetadata(SCOPES, TestController.prototype.handler)).toEqual(['read', 'write']);
  });
});

describe('RedirectUnauthorized', () => {
  it('sets redirect metadata on a method', () => {
    class TestController {
      @RedirectUnauthorized('https://example.com/login', 302)
      handler() {}
    }
    expect(Reflect.getMetadata(REDIRECT_UNAUTHORIZED, TestController.prototype.handler)).toEqual({
      url: 'https://example.com/login',
      status: 302,
    });
  });

  it('sets false to disable redirects', () => {
    class TestController {
      @RedirectUnauthorized(false)
      handler() {}
    }
    expect(Reflect.getMetadata(REDIRECT_UNAUTHORIZED, TestController.prototype.handler)).toBe(false);
  });
});
