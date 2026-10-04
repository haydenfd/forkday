export type Toast = {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
};

let next = 0;

/** Show a short confirmation in the corner; errors stay up longer. */
export function toast(message: string, tone: Toast['tone'] = 'success'): void {
  window.dispatchEvent(
    new CustomEvent<Toast>('forkday:toast', {
      detail: { id: ++next, message, tone },
    }),
  );
}
