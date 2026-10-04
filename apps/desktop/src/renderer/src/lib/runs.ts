import { useEffect, useState } from 'react';
import type { Run, RunStep } from '../../../shared/contracts';

export const runSteps: Record<
  RunStep,
  { label: string; variant: 'secondary' | 'active' | 'success' | 'warning' }
> = {
  queued: { label: 'In line', variant: 'secondary' },
  opening: { label: 'Opening', variant: 'active' },
  signing_in: { label: 'Signing in', variant: 'active' },
  filling: { label: 'Filling', variant: 'active' },
  review: { label: 'Ready for review', variant: 'success' },
  attention: { label: 'Needs you', variant: 'warning' },
};

export const isWorking = (run: Run): boolean =>
  ['opening', 'signing_in', 'filling'].includes(run.step);

/** Live list of runs, pushed from main whenever one changes. */
export function useRuns(): Run[] {
  const [runs, setRuns] = useState<Run[]>([]);
  useEffect(() => {
    void window.forkday.listRuns().then(setRuns);
    return window.forkday.onRunsChanged(setRuns);
  }, []);
  return runs;
}
