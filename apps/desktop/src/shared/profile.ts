import { z } from 'zod';

export const US_COUNTRY = 'United States of America';
export const US_PHONE_COUNTRY_CODE = 'United States of America (+1)';
const text = z.string().max(2_000).optional();
const month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .optional();
const yesNo = z.enum(['Yes', 'No']).optional();
const disclosure = z.enum(['Yes', 'No', 'Prefer not to answer']).optional();

export const ExperienceSchema = z
  .object({
    id: z.uuid(),
    company: text,
    jobTitle: text,
    location: text,
    startDate: month,
    endDate: month,
    current: z.boolean().optional(),
    description: z.string().max(20_000).optional(),
  })
  .refine(
    (value) =>
      !value.startDate || !value.endDate || value.endDate >= value.startDate,
    {
      message: 'End date must be on or after start date.',
      path: ['endDate'],
    },
  )
  .refine((value) => !value.current || !value.endDate, {
    message: 'A current role cannot have an end date.',
    path: ['endDate'],
  });

export const EducationSchema = z
  .object({
    id: z.uuid(),
    school: text,
    degree: text,
    fieldOfStudy: text,
    startDate: month,
    endDate: month,
  })
  .refine(
    (value) =>
      !value.startDate || !value.endDate || value.endDate >= value.startDate,
    {
      message: 'End date must be on or after start date.',
      path: ['endDate'],
    },
  );

export const ProfileSchema = z.object({
  email: z.email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  preferredName: text,
  phoneDeviceType: z.enum(['Home', 'Mobile']).optional(),
  phoneCountryCode: z.string().optional(),
  phone: z.string().optional(),
  phoneExtension: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: text,
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  linkedinUrl: z.url().optional(),
  githubUrl: z.url().optional(),
  websiteUrl: z.url().optional(),
  resumeText: z.string().max(100_000).optional(),
  workExperience: z.array(ExperienceSchema).max(100).optional(),
  education: z.array(EducationSchema).max(100).optional(),
  skills: z.string().max(10_000).optional(),
  workAuthorizationCountry: text,
  residencyStatus: text,
  citizenshipCountry: text,
  authorizedToWork: yesNo,
  sponsorshipNow: yesNo,
  sponsorshipFuture: yesNo,
  willingToRelocate: yesNo,
  availableStartDate: z.iso.date().optional(),
  noticePeriod: text,
  salaryExpectation: text,
  salaryCurrency: text,
  salaryPeriod: z.enum(['Year', 'Month', 'Hour']).optional(),
  gender: text,
  raceEthnicity: text,
  disability: disclosure,
  protectedVeteran: disclosure,
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
  country: z.literal(US_COUNTRY).default(US_COUNTRY),
  phoneDeviceType: z.literal('Mobile').default('Mobile'),
  phoneExtension: z.undefined().optional(),
});
export type Experience = z.infer<typeof ExperienceSchema>;
export type Education = z.infer<typeof EducationSchema>;

export const ProfileSectionFields = {
  profile: {
    email: true,
    firstName: true,
    lastName: true,
    preferredName: true,
    phoneDeviceType: true,
    phoneCountryCode: true,
    phone: true,
    phoneExtension: true,
    addressLine1: true,
    addressLine2: true,
    city: true,
    state: true,
    postalCode: true,
    country: true,
    linkedinUrl: true,
    githubUrl: true,
    websiteUrl: true,
  },
  resume: {
    resumeText: true,
    skills: true,
    workExperience: true,
    education: true,
  },
  answers: {
    workAuthorizationCountry: true,
    residencyStatus: true,
    authorizedToWork: true,
    sponsorshipNow: true,
    sponsorshipFuture: true,
    willingToRelocate: true,
    availableStartDate: true,
    noticePeriod: true,
    salaryExpectation: true,
    salaryCurrency: true,
    salaryPeriod: true,
  },
  disclosures: {
    gender: true,
    raceEthnicity: true,
    disability: true,
    protectedVeteran: true,
  },
} as const;
export type ProfileSection = keyof typeof ProfileSectionFields;
export const SaveProfileSectionSchema = z.discriminatedUnion('section', [
  z.object({
    section: z.literal('profile'),
    profile: CompleteProfileSchema.pick(ProfileSectionFields.profile).strict(),
  }),
  z.object({
    section: z.literal('resume'),
    profile: ProfileSchema.pick(ProfileSectionFields.resume).strict(),
  }),
  z.object({
    section: z.literal('answers'),
    profile: ProfileSchema.pick(ProfileSectionFields.answers)
      .extend({
        workAuthorizationCountry: z.literal(US_COUNTRY).default(US_COUNTRY),
      })
      .strict(),
  }),
  z.object({
    section: z.literal('disclosures'),
    profile: ProfileSchema.pick(ProfileSectionFields.disclosures).strict(),
  }),
]);
