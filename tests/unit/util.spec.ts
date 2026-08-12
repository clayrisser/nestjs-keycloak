import { describe, expect, it } from 'vitest';
import { getReq, getRes } from '../../src/util';
import { makeContext } from './helpers';

describe('getReq', () => {
  it('returns a plain request untouched', () => {
    const req = { headers: {} } as any;
    expect(getReq(req)).toBe(req);
  });

  it('extracts the request from an http execution context', () => {
    const req = { headers: {} } as any;
    const context = makeContext({ req });
    expect(getReq(context)).toBe(req);
  });

  it('extracts the request from a graphql context object', () => {
    const req = { headers: {} } as any;
    expect(getReq({ req })).toBe(req);
  });

  it('extracts the request from a graphql execution context', () => {
    const req = { headers: {} } as any;
    const context = makeContext({ type: 'graphql', graphqlContext: { req } });
    expect(getReq(context)).toBe(req);
  });

  it('falls back to http when the graphql context has no request', () => {
    const req = { headers: {} } as any;
    const context = makeContext({ req, type: 'graphql', graphqlContext: {} });
    expect(getReq(context)).toBe(req);
  });
});

describe('getRes', () => {
  it('returns a plain response untouched', () => {
    const res = { send: () => undefined } as any;
    expect(getRes(res)).toBe(res);
  });

  it('extracts the response from an http execution context', () => {
    const res = {} as any;
    const context = makeContext({ res });
    expect(getRes(context)).toBe(res);
  });

  it('extracts the response from a graphql context object', () => {
    const res = {} as any;
    expect(getRes({ res })).toBe(res);
  });
});
