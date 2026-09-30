import { WebContentsView, type BrowserWindow } from 'electron';

import { validateBrowserUrl } from './browserUrl';

// Height of the renderer's top bar (`h-14` in App.tsx); the page sits below it.
const TOP_BAR_HEIGHT = 56;

export class BrowserManager {
  private view?: WebContentsView;
  private visible = false;

  constructor(private readonly window: BrowserWindow) {
    window.on('resize', () => this.resize());
    window.on('closed', () => this.close());
  }

  async open(value: unknown): Promise<void> {
    const url = validateBrowserUrl(value);
    if (!this.view) {
      this.view = new WebContentsView({
        webPreferences: {
          partition: 'persist:forkday-jobs',
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });
      const contents = this.view.webContents;
      contents.session.setPermissionRequestHandler(
        (_contents, _permission, callback) => callback(false),
      );
      contents.session.setPermissionCheckHandler(() => false);
      const guardNavigation = (
        event: Electron.Event,
        destination: string,
      ): void => {
        try {
          validateBrowserUrl(destination);
        } catch {
          event.preventDefault();
        }
      };
      contents.on('will-navigate', guardNavigation);
      contents.on('will-redirect', guardNavigation);
      contents.setWindowOpenHandler(({ url }) => {
        void this.open(url).catch(console.error);
        return { action: 'deny' };
      });
      this.window.contentView.addChildView(this.view);
    }
    this.view.setVisible(this.visible);
    this.resize();
    await this.view.webContents.loadURL(url);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.view?.setVisible(visible);
  }

  close(): void {
    const view = this.view;
    this.view = undefined;
    if (!view) return;
    if (!this.window.isDestroyed())
      this.window.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close();
  }

  private resize(): void {
    if (!this.view || this.window.isDestroyed()) return;
    const [width, height] = this.window.getContentSize();
    const sidebar = Math.floor(width / 2);
    this.view.setBounds({
      x: sidebar,
      y: TOP_BAR_HEIGHT,
      width: width - sidebar,
      height: height - TOP_BAR_HEIGHT,
    });
  }
}
