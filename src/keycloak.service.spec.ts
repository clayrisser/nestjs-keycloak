import { Test, TestingModule } from '@nestjs/testing';
import { KeycloakService } from './keycloak.service';

describe('KeycloakService', () => {
  let service: KeycloakService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KeycloakService],
    }).compile();

    service = module.get<KeycloakService>(KeycloakService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
