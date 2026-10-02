import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  CompleteProfileSchema,
  US_PHONE_COUNTRY_CODE,
  type Profile as ProfileData,
} from '../../shared/profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const sections: {
  title: string;
  fields: {
    name: keyof ProfileData;
    label: string;
    type?: string;
    wide?: boolean;
    placeholder?: string;
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
        name: 'phoneCountryCode',
        label: 'Country / Territory Phone Code',
      },
      {
        name: 'phone',
        label: 'Phone Number',
        type: 'tel',
        placeholder: '2025550123',
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
    const parsed = CompleteProfileSchema.safeParse({
      ...profile,
      phoneDeviceType: 'Mobile',
      phoneCountryCode: US_PHONE_COUNTRY_CODE,
      phoneExtension: undefined,
    });
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
        Required fields are marked *. Links are optional.
      </p>
      <form
        className="mt-8 grid gap-6 @4xl:grid-cols-2"
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
              {fields.map(({ name, label, type, wide, placeholder }) => (
                <div
                  key={name}
                  className={
                    wide && title !== 'Links'
                      ? 'min-w-0 space-y-2 sm:col-span-2'
                      : 'min-w-0 space-y-2'
                  }
                >
                  <label
                    className="text-sm font-medium"
                    htmlFor={`profile-${name}`}
                  >
                    {label}
                    {type !== 'url' && <span aria-hidden="true"> *</span>}
                  </label>
                  {name === 'phoneCountryCode' ? (
                    <Button
                      id={`profile-${name}`}
                      type="button"
                      variant="outline"
                      disabled
                      className="w-full justify-between px-3 font-normal"
                    >
                      <span>🇺🇸 +1 US</span>
                      <ChevronDown aria-hidden="true" />
                    </Button>
                  ) : (
                    <Input
                      id={`profile-${name}`}
                      type={type ?? 'text'}
                      placeholder={placeholder}
                      required={type !== 'url'}
                      value={profile[name] ?? ''}
                      onChange={(event) => {
                        setProfile({
                          ...profile,
                          [name]: event.target.value || undefined,
                        });
                        setMessage(undefined);
                      }}
                    />
                  )}
                </div>
              ))}
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
