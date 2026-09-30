import { z } from 'zod';

export const ProfileSchema = z.object({
  email: z.email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phoneDeviceType: z.enum(['Home', 'Mobile']).optional(),
  phoneCountryCode: z.string().optional(),
  phone: z.string().optional(),
  phoneExtension: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  linkedinUrl: z.url().optional(),
  githubUrl: z.url().optional(),
  websiteUrl: z.url().optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;
