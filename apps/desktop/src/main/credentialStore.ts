import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { SafeStorage } from 'electron';
import { z } from 'zod';
import type { SavedCredential } from '../shared/contracts.ts';

const CredentialSchema = z.object({
  company: z.string().min(1).max(200),
  origin: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('.myworkdayjobs.com') &&
      url.origin === value
    );
  }),
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});
type Credential = z.infer<typeof CredentialSchema>;

export class CredentialStorageError extends Error {}

export class CredentialStore {
  private readonly file: string;
  private writing: Promise<unknown> = Promise.resolve();

  private readonly directory: string;
  private readonly encryption: Pick<
    SafeStorage,
    | 'isEncryptionAvailable'
    | 'getSelectedStorageBackend'
    | 'encryptString'
    | 'decryptString'
  >;

  constructor(directory: string, encryption: CredentialStore['encryption']) {
    this.directory = directory;
    this.encryption = encryption;
    this.file = path.join(directory, 'credentials.enc');
  }

  private requireEncryption(): void {
    if (
      !this.encryption.isEncryptionAvailable() ||
      (process.platform === 'linux' &&
        ['basic_text', 'unknown'].includes(
          this.encryption.getSelectedStorageBackend(),
        ))
    )
      throw new CredentialStorageError(
        'Secure credential storage is unavailable. Unlock your system keychain and retry.',
      );
  }

  private async load(): Promise<Credential[]> {
    this.requireEncryption();
    let encrypted: Buffer;
    try {
      encrypted = await fs.readFile(this.file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw new CredentialStorageError('Could not read saved credentials.');
    }
    try {
      return z
        .array(CredentialSchema)
        .parse(JSON.parse(this.encryption.decryptString(encrypted)));
    } catch {
      throw new CredentialStorageError(
        'Could not unlock saved credentials. The existing file has been preserved.',
      );
    }
  }

  async list(): Promise<SavedCredential[]> {
    await this.writing;
    return (await this.load()).map(({ company, origin, email }) => ({
      company,
      origin,
      email,
    }));
  }

  async find(origin: string, email: string): Promise<Credential | undefined> {
    await this.writing;
    return (await this.load()).find(
      (record) =>
        record.origin === origin &&
        record.email.toLowerCase() === email.toLowerCase(),
    );
  }

  async revealPassword(value: unknown): Promise<string> {
    const parsed = CredentialSchema.pick({
      origin: true,
      email: true,
    }).safeParse(value);
    if (!parsed.success)
      throw new CredentialStorageError('Invalid credential selection.');
    const record = await this.find(parsed.data.origin, parsed.data.email);
    if (!record)
      throw new CredentialStorageError('Saved credential not found.');
    return record.password;
  }

  async save(value: Credential): Promise<void> {
    // Serialize read/replace writes so different companies cannot overwrite each other.
    const operation = this.writing.then(async () => {
      const parsed = CredentialSchema.safeParse(value);
      if (!parsed.success)
        throw new CredentialStorageError(
          'Invalid credential record. Nothing was saved.',
        );
      const record = parsed.data;
      const records = await this.load();
      const existing = records.find(
        (entry) =>
          entry.origin === record.origin &&
          entry.email.toLowerCase() === record.email.toLowerCase(),
      );
      if (existing) return; // Never replace a password that may already belong to an account.
      records.push(record);
      this.requireEncryption();
      let encrypted: Buffer;
      try {
        encrypted = this.encryption.encryptString(JSON.stringify(records));
      } catch {
        throw new CredentialStorageError(
          'Could not encrypt credentials. Nothing was saved.',
        );
      }
      await fs.mkdir(this.directory, { recursive: true });
      const temporary = `${this.file}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporary, encrypted, { mode: 0o600, flag: 'wx' });
        await fs.rename(temporary, this.file);
      } catch {
        throw new CredentialStorageError(
          'Could not save credentials. The existing file has been preserved.',
        );
      } finally {
        await fs.rm(temporary, { force: true });
      }
    });
    this.writing = operation.catch(() => {});
    await operation;
  }
}
