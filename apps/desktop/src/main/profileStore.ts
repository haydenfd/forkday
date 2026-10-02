import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  CompleteProfileSchema,
  ProfileSchema,
  SaveProfileSectionSchema,
  type Profile,
} from '../shared/profile.ts';

export class ProfileStore {
  private readonly file: string;
  private readonly directory: string;
  private pending: Promise<unknown> = Promise.resolve();

  constructor(directory: string) {
    this.directory = directory;
    this.file = path.join(directory, 'profile.json');
  }

  async load(): Promise<Profile> {
    let contents: string;
    try {
      contents = await fs.readFile(this.file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw error;
    }
    try {
      return ProfileSchema.parse(JSON.parse(contents));
    } catch {
      throw new Error(
        `Profile file is invalid: ${this.file}. Repair the file before saving.`,
      );
    }
  }

  async save(value: unknown): Promise<void> {
    const profile = CompleteProfileSchema.parse(value);
    await this.update(() => profile);
  }

  saveSection(value: unknown): Promise<Profile> {
    const input = SaveProfileSectionSchema.parse(value);
    return this.update((current) => ({ ...current, ...input.profile }));
  }

  private update(merge: (current: Profile) => Profile): Promise<Profile> {
    const next = this.pending.then(async () => {
      const profile = merge(await this.load());
      await fs.mkdir(this.directory, { recursive: true });
      const temporary = `${this.file}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporary, JSON.stringify(profile, null, 2), {
          mode: 0o600,
          flag: 'wx',
        });
        await fs.rename(temporary, this.file);
      } finally {
        await fs.rm(temporary, { force: true });
      }
      return profile;
    });
    this.pending = next.catch(() => {});
    return next;
  }
}
