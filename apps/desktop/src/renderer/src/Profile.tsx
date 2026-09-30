import { useEffect, useState } from 'react';
import {
  ProfileSchema,
  type Profile as ProfileData,
} from '../../shared/profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatPhoneNumber } from '../../shared/phone';

const sections: {
  title: string;
  fields: {
    name: keyof ProfileData;
    label: string;
    type?: string;
    wide?: boolean;
    options?: string[];
    placeholder?: string;
    hint?: string;
  }[];
}[] = [
  {
    title: 'Personal details',
    fields: [
      { name: 'firstName', label: 'First name' },
      { name: 'lastName', label: 'Last name' },
      { name: 'email', label: 'Email', type: 'email' },
    ],
  },
  {
    title: 'Address',
    fields: [
      { name: 'addressLine1', label: 'Address line 1', wide: true },
      { name: 'city', label: 'City' },
      { name: 'state', label: 'State' },
      { name: 'postalCode', label: 'Postal code' },
      { name: 'country', label: 'Country' },
    ],
  },
  {
    title: 'Phone',
    fields: [
      {
        name: 'phoneDeviceType',
        label: 'Phone Device Type',
        options: ['Home', 'Mobile'],
      },
      {
        name: 'phoneCountryCode',
        label: 'Country / Territory Phone Code',
        placeholder: 'United States of America (+1)',
        hint: 'Use the country label and calling code shown in Workday.',
      },
      {
        name: 'phone',
        label: 'Phone Number',
        type: 'tel',
        placeholder: '(202) 555-0123',
        hint: 'Formatting is automatic; the country calling code is saved separately.',
      },
      {
        name: 'phoneExtension',
        label: 'Phone Extension',
        type: 'tel',
        hint: 'Optional.',
      },
    ],
  },
  {
    title: 'Links',
    fields: [
      { name: 'linkedinUrl', label: 'LinkedIn URL', type: 'url', wide: true },
      { name: 'githubUrl', label: 'GitHub URL', type: 'url', wide: true },
      { name: 'websiteUrl', label: 'Website URL', type: 'url', wide: true },
    ],
  },
];

export default function Profile(): React.JSX.Element {
  const [profile, setProfile] = useState<ProfileData>({});
  const [busy, setBusy] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    void window.forkday
      .getProfile()
      .then(setProfile)
      .catch((error: unknown) => {
        setLoadFailed(true);
        setMessage(error instanceof Error ? error.message : String(error));
      })
      .finally(() => setBusy(false));
  }, []);

  const save = async (): Promise<void> => {
    setMessage(undefined);
    const parsed = ProfileSchema.safeParse(profile);
    if (!parsed.success) {
      setMessage(
        parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; '),
      );
      return;
    }
    setBusy(true);
    try {
      await window.forkday.saveProfile(parsed.data);
      setMessage('Saved');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="w-full">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your details saved on this computer.
      </p>
      <form
        className="mt-8 grid gap-6 @4xl:grid-cols-2"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {sections.map(({ title, fields }) => (
          <fieldset
            key={title}
            disabled={busy || loadFailed}
            className={
              title === 'Links' || title === 'Phone'
                ? 'rounded-xl border bg-card p-5 @4xl:col-span-2'
                : 'rounded-xl border bg-card p-5'
            }
          >
            <legend className="px-2 text-base font-semibold">{title}</legend>
            <div
              className={
                title === 'Links'
                  ? 'grid gap-4 @4xl:grid-cols-3'
                  : 'grid gap-4 sm:grid-cols-2'
              }
            >
              {fields.map(
                ({ name, label, type, wide, options, placeholder, hint }) => (
                  <div
                    key={name}
                    className={
                      wide && title !== 'Links'
                        ? 'space-y-2 sm:col-span-2'
                        : 'space-y-2'
                    }
                  >
                    <label
                      className="text-sm font-medium"
                      htmlFor={`profile-${name}`}
                    >
                      {label}
                    </label>
                    {options ? (
                      <select
                        id={`profile-${name}`}
                        className="h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-50"
                        value={profile[name] ?? ''}
                        onChange={(event) => {
                          setProfile({
                            ...profile,
                            [name]: event.target.value || undefined,
                          });
                          setMessage(undefined);
                        }}
                      >
                        <option value="">Select One</option>
                        {options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id={`profile-${name}`}
                        type={type ?? 'text'}
                        placeholder={placeholder}
                        aria-describedby={
                          hint ? `profile-${name}-hint` : undefined
                        }
                        value={
                          name === 'phone'
                            ? formatPhoneNumber(profile.phone ?? '')
                            : (profile[name] ?? '')
                        }
                        onChange={(event) => {
                          setProfile({
                            ...profile,
                            [name]:
                              (name === 'phone'
                                ? event.target.value.replace(/\D/g, '')
                                : event.target.value) || undefined,
                          });
                          setMessage(undefined);
                        }}
                      />
                    )}
                    {hint && (
                      <p
                        id={`profile-${name}-hint`}
                        className="text-xs text-muted-foreground"
                      >
                        {hint}
                      </p>
                    )}
                  </div>
                ),
              )}
            </div>
          </fieldset>
        ))}
        <div className="flex items-center justify-end gap-4 @4xl:col-span-2">
          <Button type="submit" disabled={busy || loadFailed}>
            {busy ? 'Loading…' : 'Save'}
          </Button>
          {message && (
            <p
              className="text-sm"
              role={message === 'Saved' ? 'status' : 'alert'}
            >
              {message}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
