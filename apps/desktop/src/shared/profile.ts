import { z } from 'zod';

export const US_PHONE_COUNTRY_CODE = 'United States of America (+1)';

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

// Older partial profiles stay readable; saving requires the visible fields.
export const CompleteProfileSchema = ProfileSchema.extend({
  email: z.email(),
  firstName: z.string().trim().min(1, 'Required'),
  lastName: z.string().trim().min(1, 'Required'),
  phoneCountryCode: z
    .literal(US_PHONE_COUNTRY_CODE)
    .default(US_PHONE_COUNTRY_CODE),
  phone: z.string().trim().min(1, 'Required'),
  addressLine1: z.string().trim().min(1, 'Required'),
  city: z.string().trim().min(1, 'Required'),
  state: z.string().trim().min(1, 'Required'),
  postalCode: z.string().trim().min(1, 'Required'),
  country: z.string().trim().min(1, 'Required'),
  phoneDeviceType: z.literal('Mobile').default('Mobile'),
  phoneExtension: z.undefined().optional(),
});
