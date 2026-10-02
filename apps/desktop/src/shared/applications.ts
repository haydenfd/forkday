import { z } from 'zod';

export const ApplicationStatusSchema = z.enum([
  'waiting',
  'continuing',
  'rejected',
  'completed',
  'stopped',
]);
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;
export const ApplicationSchema = z.object({
  id: z.uuid(),
  url: z
    .url()
    .max(8_192)
    .refine((value) => {
      const url = new URL(value);
      return (
        ['http:', 'https:'].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    }, 'Use an HTTP or HTTPS URL without embedded credentials.'),
  title: z.string().trim().min(1).max(500),
  company: z.string().trim().max(500),
  status: ApplicationStatusSchema,
  notes: z.string().max(20_000),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const NewApplicationSchema = ApplicationSchema.pick({
  url: true,
}).extend({
  title: z.string().trim().max(500).optional(),
  company: z.string().trim().max(500).optional(),
});
export const ApplicationUpdateSchema = ApplicationSchema.pick({
  id: true,
  status: true,
  notes: true,
  title: true,
  company: true,
})
  .partial({ status: true, notes: true, title: true, company: true })
  .strict();
export type Application = z.infer<typeof ApplicationSchema>;
export type NewApplication = z.infer<typeof NewApplicationSchema>;
export type ApplicationUpdate = z.infer<typeof ApplicationUpdateSchema>;
