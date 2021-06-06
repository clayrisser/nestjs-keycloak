import KeycloakConnect, { Keycloak } from 'keycloak-connect';
import session from 'express-session';
import { FactoryProvider } from '@nestjs/common';
import { Options } from '~/types';
import { KEYCLOAK_OPTIONS } from '.';

export const KEYCLOAK = 'KEYCLOAK';

const KeycloakProvider: FactoryProvider<Keycloak> = {
  provide: KEYCLOAK,
  inject: [KEYCLOAK_OPTIONS],
  useFactory: (options: Options) => {
    const { baseUrl, clientSecret, clientId, realm } = options;
    return new KeycloakConnect({ store: new session.MemoryStore() }, {
      bearerOnly: true,
      clientId,
      realm,
      serverUrl: `${baseUrl}/auth`,
      credentials: {
        ...(clientSecret ? { secret: clientSecret } : {})
      }
    } as unknown as any);
  }
};

export default KeycloakProvider;
