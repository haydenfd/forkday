import { z } from 'zod';

export const MAX_RESUME_BYTES = 10 * 1024 * 1024;
export const ResumeSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_RESUME_BYTES),
  importedAt: z.iso.datetime(),
});
export type Resume = z.infer<typeof ResumeSchema>;
