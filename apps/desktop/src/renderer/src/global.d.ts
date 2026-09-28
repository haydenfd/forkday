import type { ForkdayApi } from '../../shared/contracts';

declare global {
  interface Window {
    forkday: ForkdayApi;
  }
}

export {};
