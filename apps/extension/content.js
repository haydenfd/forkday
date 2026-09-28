const promptId = 'forkday-workday-prompt';

if (!document.getElementById(promptId)) {
  const host = document.createElement('div');
  host.id = promptId;
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');

  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>
      :host {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 2147483647;
        color: #18202d;
        font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      aside {
        width: 280px;
        border: 1px solid #dbe1e8;
        border-radius: 12px;
        padding: 16px;
        background: #fff;
        box-shadow: 0 14px 40px rgb(20 30 45 / 18%);
      }
      strong, span { display: block; }
      strong { margin-bottom: 4px; font-size: 16px; }
      span { color: #5f6878; }
      button {
        margin-top: 12px;
        border: 1px solid #cbd2dc;
        border-radius: 7px;
        padding: 7px 10px;
        color: #263043;
        background: #fff;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      button:focus-visible { outline: 3px solid #9eb9ff; outline-offset: 2px; }
    </style>
    <aside aria-label="Forkday detected a Workday page">
      <strong>Forkday detected this Workday page</strong>
      <span>Desktop handoff is coming next.</span>
      <button type="button">Dismiss</button>
    </aside>
  `;

  shadow.querySelector('button').addEventListener('click', () => host.remove());
  document.documentElement.append(host);
}
