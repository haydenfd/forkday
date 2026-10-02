import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  MAX_RESUME_BYTES,
  ResumeSchema,
  type Resume,
} from '../shared/resume.ts';

export class ResumeStore {
  private readonly directory: string;
  private readonly manifest: string;
  private importing = false;

  constructor(directory: string) {
    this.directory = path.join(directory, 'resume');
    this.manifest = path.join(this.directory, 'resume.json');
  }

  async load(): Promise<Resume | null> {
    let contents: string;
    try {
      contents = await fs.readFile(this.manifest, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
    try {
      const resume = ResumeSchema.parse(JSON.parse(contents));
      const file = await fs.stat(this.filePath(resume));
      if (!file.isFile() || file.size !== resume.size)
        throw new Error('Missing PDF');
      return resume;
    } catch {
      throw new Error(
        'The saved resume is missing or invalid. Repair the local resume folder before replacing it.',
      );
    }
  }

  filePath(resume: Resume): string {
    return path.join(this.directory, `${ResumeSchema.parse(resume).id}.pdf`);
  }

  async import(source: string): Promise<Resume> {
    if (this.importing)
      throw new Error('A resume upload is already in progress.');
    this.importing = true;
    let copied: string | undefined;
    const temporary = `${this.manifest}.${randomUUID()}.tmp`;
    let saved = false;
    try {
      const previous = await this.load();
      const sourceFile = await fs.open(source, 'r');
      let contents: Buffer;
      try {
        const stat = await sourceFile.stat();
        if (!stat.isFile() || stat.size > MAX_RESUME_BYTES)
          throw new Error('Choose a PDF smaller than 10 MB.');
        contents = Buffer.alloc(stat.size);
        const { bytesRead } = await sourceFile.read(contents, 0, stat.size, 0);
        if (bytesRead !== stat.size)
          throw new Error(
            'The PDF changed while it was being imported. Try again.',
          );
      } finally {
        await sourceFile.close();
      }
      if (
        path.extname(source).toLowerCase() !== '.pdf' ||
        contents.subarray(0, 5).toString() !== '%PDF-'
      ) {
        throw new Error('Choose a valid PDF resume.');
      }
      const resume = ResumeSchema.parse({
        id: randomUUID(),
        name: path.basename(source),
        size: contents.length,
        importedAt: new Date().toISOString(),
      });
      await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
      copied = this.filePath(resume);
      await fs.writeFile(copied, contents, { mode: 0o600, flag: 'wx' });
      await fs.writeFile(temporary, JSON.stringify(resume, null, 2), {
        mode: 0o600,
        flag: 'wx',
      });
      await fs.rename(temporary, this.manifest);
      saved = true;
      if (previous)
        await fs.rm(this.filePath(previous), { force: true }).catch(() => {});
      return resume;
    } finally {
      this.importing = false;
      await fs.rm(temporary, { force: true });
      if (copied && !saved) await fs.rm(copied, { force: true });
    }
  }
}
