import type {
  ModelRequest,
  ModelResponse,
  ProviderHealth,
  ProviderId,
} from '../../shared/contracts';

export interface ModelProvider {
  readonly id: ProviderId;
  healthcheck(): Promise<ProviderHealth>;
  complete(request: ModelRequest): Promise<ModelResponse>;
}
