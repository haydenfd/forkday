import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  ApplicationSchema,
  ApplicationUpdateSchema,
  NewApplicationSchema,
  type Application,
} from '../shared/applications.ts';

export class ApplicationStore {
  private readonly file: string;
  private readonly directory: string;
  private pending: Promise<unknown> = Promise.resolve();

  constructor(directory: string) {
    this.directory = directory;
    this.file = path.join(directory, 'applications.json');
  }

  async list(): Promise<Application[]> {
    let contents: string;
    try {
      contents = await fs.readFile(this.file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    try {
      return z.array(ApplicationSchema).parse(JSON.parse(contents));
    } catch {
      throw new Error(
        'Saved applications are invalid. Repair applications.json before making changes.',
      );
    }
  }

  add(value: unknown): Promise<Application[]> {
    const input = NewApplicationSchema.parse(value);
    input.url = new URL(input.url).href;
    return this.change((applications) => {
      if (applications.some((application) => application.url === input.url)) {
        throw new Error('This job is already in your queue.');
      }
      const timestamp = new Date().toISOString();
      applications.unshift({
        id: randomUUID(),
        url: input.url,
        title: input.title || new URL(input.url).hostname,
        company: input.company || new URL(input.url).hostname,
        status: 'waiting',
        notes: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
  }

  update(value: unknown): Promise<Application[]> {
    const input = ApplicationUpdateSchema.parse(value);
    return this.change((applications) => {
      const application = applications.find((item) => item.id === input.id);
      if (!application) throw new Error('Application not found.');
      Object.assign(
        application,
        Object.fromEntries(
          Object.entries(input).filter(([, value]) => value !== undefined),
        ),
        { updatedAt: new Date().toISOString() },
      );
      ApplicationSchema.parse(application);
    });
  }

  private change(
    mutate: (applications: Application[]) => void,
  ): Promise<Application[]> {
    const next = this.pending.then(async () => {
      const applications = await this.list();
      mutate(applications);
      await fs.mkdir(this.directory, { recursive: true });
      const temporary = `${this.file}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporary, JSON.stringify(applications, null, 2), {
          mode: 0o600,
          flag: 'wx',
        });
        await fs.rename(temporary, this.file);
      } finally {
        await fs.rm(temporary, { force: true });
      }
      return applications;
    });
    this.pending = next.catch(() => {});
    return next;
  }
}
