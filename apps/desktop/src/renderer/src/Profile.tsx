import { useEffect, useState } from 'react';
import { FileText, Plus, Upload } from 'lucide-react';
import {
  ProfileSectionFields,
  SaveProfileSectionSchema,
  type ProfileSection,
  US_PHONE_COUNTRY_CODE,
  US_COUNTRY,
  type Profile as ProfileData,
} from '../../shared/profile';
import type { Resume } from '../../shared/resume';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import { SaveChangesDialog } from '@/components/ui/save-changes-dialog';

export type { ProfileSection } from '../../shared/profile';
const sectionLabels = {
  profile: 'Profile',
  resume: 'Resume',
  answers: 'Application answers',
  disclosures: 'Disclosures',
};
type FieldName = Exclude<keyof ProfileData, 'workExperience' | 'education'>;
type FieldDefinition = {
  name: FieldName;
  label: string;
  type?: string;
  required?: boolean;
  options?: string[];
  hint?: string;
  wide?: boolean;
  multiline?: boolean;
};
const yesNo = ['Yes', 'No'];
const disclosures = ['Yes', 'No', 'Prefer not to answer'];
const sections: Record<
  ProfileSection,
  { title: string; fields: FieldDefinition[] }[]
> = {
  profile: [
    {
      title: 'Personal details',
      fields: [
        { name: 'firstName', label: 'First name', required: true },
        { name: 'lastName', label: 'Last name', required: true },
        { name: 'preferredName', label: 'Preferred name' },
        { name: 'email', label: 'Email', type: 'email', required: true },
      ],
    },
    {
      title: 'Address',
      fields: [
        { name: 'addressLine1', label: 'Address line 1', required: true },
        { name: 'addressLine2', label: 'Address line 2' },
        { name: 'city', label: 'City', required: true },
        { name: 'state', label: 'State', required: true },
        { name: 'postalCode', label: 'Postal code', required: true },
      ],
    },
    {
      title: 'Phone',
      fields: [
        {
          name: 'phone',
          label: 'Phone Number',
          type: 'tel',
          required: true,
          hint: '+1 US mobile number.',
        },
      ],
    },
    {
      title: 'Links',
      fields: [
        { name: 'linkedinUrl', label: 'LinkedIn URL', type: 'url' },
        { name: 'githubUrl', label: 'GitHub URL', type: 'url' },
        { name: 'websiteUrl', label: 'Website URL', type: 'url', wide: true },
      ],
    },
  ],
  resume: [
    {
      title: 'Resume content',
      fields: [
        {
          name: 'resumeText',
          label: 'Resume text',
          multiline: true,
          wide: true,
          hint: 'Paste the content you want to reuse. Uploading a PDF does not extract or change this text.',
        },
        {
          name: 'skills',
          label: 'Skills',
          multiline: true,
          wide: true,
          hint: 'For example: TypeScript, project management, Spanish.',
        },
      ],
    },
  ],
  answers: [
    {
      title: 'Work authorization',
      fields: [
        {
          name: 'authorizedToWork',
          label: 'Authorized to work in the US?',
          options: yesNo,
        },
        {
          name: 'sponsorshipNow',
          label: 'Need employer sponsorship now?',
          options: yesNo,
        },
        {
          name: 'sponsorshipFuture',
          label: 'Need employer sponsorship in the future?',
          options: yesNo,
        },
        {
          name: 'residencyStatus',
          label: 'Residency / visa status',
          hint: 'Your US residency or visa status.',
        },
      ],
    },
    {
      title: 'Availability & preferences',
      fields: [
        {
          name: 'availableStartDate',
          label: 'Available start date',
          type: 'date',
        },
        {
          name: 'noticePeriod',
          label: 'Notice period',
          hint: 'For example: two weeks.',
        },
        {
          name: 'willingToRelocate',
          label: 'Willing to relocate?',
          options: yesNo,
        },
        {
          name: 'salaryExpectation',
          label: 'Expected salary',
          hint: 'Optional amount or range.',
        },
        {
          name: 'salaryCurrency',
          label: 'Salary currency',
          hint: 'For example: USD.',
        },
        {
          name: 'salaryPeriod',
          label: 'Salary period',
          options: ['Year', 'Month', 'Hour'],
        },
      ],
    },
  ],
  disclosures: [
    {
      title: 'Voluntary self-identification',
      fields: [
        {
          name: 'gender',
          label: 'Gender',
          hint: 'Optional. Enter your response or “Prefer not to answer”. Employer choices vary.',
        },
        {
          name: 'raceEthnicity',
          label: 'Race / ethnicity',
          hint: 'Optional. Enter your response or “Prefer not to answer”. Employer choices vary.',
        },
        {
          name: 'protectedVeteran',
          label: 'US protected veteran status',
          options: disclosures,
          hint: 'Yes means you identify as a protected veteran.',
        },
        {
          name: 'disability',
          label: 'US disability self-identification',
          options: disclosures,
        },
      ],
    },
  ],
};

export default function Profile({
  section = 'profile',
}: {
  section?: ProfileSection;
}): React.JSX.Element {
  const [profile, setProfile] = useState<ProfileData>({});
  const [busy, setBusy] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [message, setMessage] = useState<string>();
  const [savedProfile, setSavedProfile] = useState<ProfileData>({});
  const [destination, setDestination] = useState<string>();
  const sectionFields = Object.keys(
    ProfileSectionFields[section],
  ) as (keyof ProfileData)[];
  const dirty = sectionFields.some(
    (name) =>
      JSON.stringify(profile[name]) !== JSON.stringify(savedProfile[name]),
  );
  const [resume, setResume] = useState<Resume | null>(null);
  const [resumeBusy, setResumeBusy] = useState(true);
  const [resumeError, setResumeError] = useState<string>();

  useEffect(() => {
    void window.forkday
      .getProfile()
      .then((loaded) => {
        const normalized = normalizeUSAnswers(loaded);
        setProfile(normalized);
        setSavedProfile(normalized);
      })
      .catch((error: unknown) => {
        setLoadFailed(true);
        setMessage(errorMessage(error));
      })
      .finally(() => setBusy(false));
    void window.forkday
      .getResume()
      .then(setResume)
      .catch((error: unknown) => {
        setResumeError(errorMessage(error));
      })
      .finally(() => setResumeBusy(false));
  }, []);

  const navigate = useUnsavedChanges(dirty, (next) => {
    const nextSection =
      next === '#/profile' || next === '#/settings'
        ? 'profile'
        : next.split('/')[2];
    if (
      (next.startsWith('#/settings') || next === '#/profile') &&
      nextSection === section
    )
      return true;
    setDestination(next);
    return false;
  });
  useEffect(() => {
    setMessage(undefined);
  }, [section]);

  const change = (patch: Partial<ProfileData>): void => {
    setProfile((current) => ({ ...current, ...patch }));
    setMessage(undefined);
  };
  const save = async (): Promise<string | undefined> => {
    setMessage(undefined);
    const draft: ProfileData = {
      ...profile,
      ...(section === 'profile'
        ? {
            phoneDeviceType: 'Mobile',
            phoneCountryCode: US_PHONE_COUNTRY_CODE,
            country: US_COUNTRY,
            phoneExtension: undefined,
          }
        : {}),
      ...(section === 'answers'
        ? { workAuthorizationCountry: US_COUNTRY }
        : {}),
    };
    const payload = Object.fromEntries(
      sectionFields.map((name) => [name, draft[name]]),
    );
    const parsed = SaveProfileSectionSchema.safeParse({
      section,
      profile: payload,
    });
    if (!parsed.success) {
      const error = parsed.error.issues
        .map((issue) => `${issue.path.slice(1).join('.')}: ${issue.message}`)
        .join('; ');
      setMessage(error);
      return error;
    }
    setBusy(true);
    try {
      const saved = await window.forkday.saveProfileSection(
        section,
        parsed.data.profile,
      );
      const normalized = normalizeUSAnswers(saved);
      setProfile(normalized);
      setSavedProfile(normalized);
      setMessage('Saved');
    } catch (error) {
      const message = errorMessage(error);
      setMessage(message);
      return message;
    } finally {
      setBusy(false);
    }
  };
  const upload = async (): Promise<void> => {
    setResumeBusy(true);
    setResumeError(undefined);
    try {
      const imported = await window.forkday.uploadResume();
      if (imported) setResume(imported);
    } catch (error) {
      setResumeError(errorMessage(error));
    } finally {
      setResumeBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-end gap-3">
        {message && (
          <p
            role={message === 'Saved' ? 'status' : 'alert'}
            className={`min-w-0 text-sm ${message === 'Saved' ? 'text-success' : 'text-destructive'}`}
          >
            {message}
          </p>
        )}
        <Button
          type="submit"
          form="profile-form"
          disabled={busy || loadFailed || !dirty}
        >
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {section === 'resume' && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="rounded-lg bg-brand-soft p-3 text-brand-strong">
              <FileText />
            </div>
            <div className="min-w-0">
              <h2 className="break-all font-semibold">
                {resume?.name ?? 'Your resume PDF'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {resume
                  ? `${Math.ceil(resume.size / 1024)} KB · Saved ${new Date(resume.importedAt).toLocaleDateString()}`
                  : 'Choose a PDF up to 10 MB. The original file stays where it is.'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {resume && (
              <Button
                type="button"
                variant="outline"
                disabled={resumeBusy}
                onClick={() =>
                  void window.forkday
                    .openResume()
                    .catch((error: unknown) =>
                      setResumeError(errorMessage(error)),
                    )
                }
              >
                Open PDF
              </Button>
            )}
            <Button
              type="button"
              disabled={resumeBusy}
              onClick={() => void upload()}
            >
              <Upload />
              {resumeBusy ? 'Loading…' : resume ? 'Replace PDF' : 'Upload PDF'}
            </Button>
          </div>
          {resumeError && (
            <p className="w-full text-sm text-destructive" role="alert">
              {resumeError}
            </p>
          )}
        </Card>
      )}
      <form
        id="profile-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy || loadFailed} className="min-w-0 space-y-6">
          <div className="grid items-start gap-6 @4xl:grid-cols-2">
            {sections[section].map(({ title, fields }) => (
              <fieldset
                key={title}
                className={`min-w-0 rounded-xl border bg-card p-5 ${section === 'resume' || section === 'disclosures' ? '@4xl:col-span-2' : ''}`}
              >
                <legend className="px-2 text-base font-semibold">
                  {title}
                </legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map(({ name, ...field }) => (
                    <Field
                      key={name}
                      id={`profile-${name}`}
                      {...field}
                      value={profile[name] ?? ''}
                      onChange={(value) =>
                        change({ [name]: value || undefined })
                      }
                    />
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          {section === 'resume' && (
            <>
              <section
                className="space-y-4"
                aria-labelledby="experience-heading"
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 id="experience-heading" className="text-lg font-semibold">
                    Work experience
                  </h2>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={(profile.workExperience?.length ?? 0) >= 100}
                    onClick={() =>
                      change({
                        workExperience: [
                          ...(profile.workExperience ?? []),
                          { id: crypto.randomUUID() },
                        ],
                      })
                    }
                  >
                    <Plus />
                    Add role
                  </Button>
                </div>
                {!profile.workExperience?.length && (
                  <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                    Add your current and previous roles, starting with the most
                    recent.
                  </p>
                )}
                {profile.workExperience?.map((role, index) => {
                  const update = (patch: Partial<typeof role>): void =>
                    change({
                      workExperience: profile.workExperience?.map((item) =>
                        item.id === role.id ? { ...item, ...patch } : item,
                      ),
                    });
                  return (
                    <Card key={role.id} className="p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="font-semibold">
                          {role.jobTitle || `Role ${index + 1}`}
                        </h3>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            change({
                              workExperience: profile.workExperience?.filter(
                                (item) => item.id !== role.id,
                              ),
                            })
                          }
                          aria-label={`Remove role ${index + 1}`}
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {(
                          [
                            'jobTitle',
                            'company',
                            'location',
                            'startDate',
                            'endDate',
                            'description',
                          ] as const
                        ).map((name) => (
                          <Field
                            key={name}
                            id={`${role.id}-${name}`}
                            label={
                              {
                                jobTitle: 'Job title',
                                company: 'Company',
                                location: 'Location',
                                startDate: 'Start date',
                                endDate: 'End date',
                                description: 'Responsibilities & achievements',
                              }[name]
                            }
                            type={name.endsWith('Date') ? 'month' : undefined}
                            disabled={name === 'endDate' && role.current}
                            multiline={name === 'description'}
                            wide={name === 'description'}
                            value={role[name] ?? ''}
                            onChange={(value) =>
                              update({ [name]: value || undefined })
                            }
                          />
                        ))}
                        <label className="flex items-center gap-2 text-sm sm:col-span-2">
                          <input
                            type="checkbox"
                            className="size-4 accent-brand"
                            checked={role.current ?? false}
                            onChange={(event) =>
                              update({
                                current: event.target.checked,
                                endDate: event.target.checked
                                  ? undefined
                                  : role.endDate,
                              })
                            }
                          />
                          I currently work here
                        </label>
                      </div>
                    </Card>
                  );
                })}
              </section>
              <section
                className="space-y-4"
                aria-labelledby="education-heading"
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 id="education-heading" className="text-lg font-semibold">
                    Education
                  </h2>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={(profile.education?.length ?? 0) >= 100}
                    onClick={() =>
                      change({
                        education: [
                          ...(profile.education ?? []),
                          { id: crypto.randomUUID() },
                        ],
                      })
                    }
                  >
                    <Plus />
                    Add education
                  </Button>
                </div>
                {!profile.education?.length && (
                  <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                    Save your schools, degrees, and dates. Omit anything you do
                    not need.
                  </p>
                )}
                {profile.education?.map((education, index) => (
                  <Card key={education.id} className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-semibold">
                        {education.school || `Education ${index + 1}`}
                      </h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          change({
                            education: profile.education?.filter(
                              (item) => item.id !== education.id,
                            ),
                          })
                        }
                        aria-label={`Remove education ${index + 1}`}
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {(
                        [
                          'school',
                          'degree',
                          'fieldOfStudy',
                          'startDate',
                          'endDate',
                        ] as const
                      ).map((name) => (
                        <Field
                          key={name}
                          id={`${education.id}-${name}`}
                          label={
                            {
                              school: 'School / university',
                              degree: 'Degree',
                              fieldOfStudy: 'Field of study',
                              startDate: 'Start date',
                              endDate: 'End date',
                            }[name]
                          }
                          type={name.endsWith('Date') ? 'month' : undefined}
                          value={education[name] ?? ''}
                          onChange={(value) =>
                            change({
                              education: profile.education?.map((item) =>
                                item.id === education.id
                                  ? { ...item, [name]: value || undefined }
                                  : item,
                              ),
                            })
                          }
                        />
                      ))}
                    </div>
                  </Card>
                ))}
              </section>
            </>
          )}
        </fieldset>
      </form>
      {destination !== undefined && (
        <SaveChangesDialog
          section={sectionLabels[section]}
          onCancel={() => setDestination(undefined)}
          onDiscard={() => {
            setProfile(savedProfile);
            setDestination(undefined);
            navigate(destination);
          }}
          onSave={async () => {
            const error = await save();
            if (!error) {
              setDestination(undefined);
              navigate(destination);
            }
            return error;
          }}
        />
      )}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required,
  options,
  hint,
  wide,
  multiline,
  disabled,
}: Omit<FieldDefinition, 'name'> & {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}): React.JSX.Element {
  const props = {
    id,
    value,
    required,
    disabled,
    'aria-describedby': hint ? `${id}-hint` : undefined,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(event.target.value),
  };
  return (
    <div className={`min-w-0 space-y-2 ${wide ? 'sm:col-span-2' : ''}`}>
      <label className="block text-sm font-medium" htmlFor={id}>
        {label}
        {required && <span aria-hidden> *</span>}
      </label>
      {options ? (
        <Select
          id={id}
          value={value}
          onValueChange={onChange}
          required={required}
          disabled={disabled}
          aria-describedby={hint ? `${id}-hint` : undefined}
          options={[
            { value: '', label: 'Not set' },
            ...options.map((option) => ({ value: option, label: option })),
          ]}
        />
      ) : multiline ? (
        <textarea
          {...props}
          rows={id === 'profile-resumeText' ? 10 : 3}
          className="field-control min-h-24 resize-y"
        />
      ) : (
        <Input {...props} type={type} />
      )}
      {hint && (
        <p
          id={`${id}-hint`}
          className="text-xs leading-relaxed text-muted-foreground"
        >
          {hint}
        </p>
      )}
    </div>
  );
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeUSAnswers(profile: ProfileData): ProfileData {
  // Legacy answers saved for another country must not become US answers.
  if (
    !profile.workAuthorizationCountry ||
    ['United States', US_COUNTRY, 'US', 'USA'].includes(
      profile.workAuthorizationCountry,
    )
  )
    return profile;
  return {
    ...profile,
    authorizedToWork: undefined,
    sponsorshipNow: undefined,
    sponsorshipFuture: undefined,
    residencyStatus: undefined,
  };
}
