import { useEffect, useState } from 'react';
import type { SavedCredential } from '../../shared/contracts';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SavedCredentials(): React.JSX.Element {
  const [credentials, setCredentials] = useState<SavedCredential[]>();
  const [error, setError] = useState<string>();
  const [search, setSearch] = useState('');
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string>();
  const query = search.trim().toLowerCase();
  const rows = credentials?.filter((credential) =>
    `${credential.company} ${credential.email}`.toLowerCase().includes(query),
  );

  useEffect(() => {
    void window.forkday
      .listCredentials()
      .then(setCredentials)
      .catch(() => {
        setError(
          'Could not load saved credentials. Unlock your system keychain and retry.',
        );
      });
  }, []);

  const togglePassword = async (credential: SavedCredential): Promise<void> => {
    const key = `${credential.origin}:${credential.email}`;
    if (revealed[key]) {
      setRevealed((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
      return;
    }
    setPending(key);
    setError(undefined);
    try {
      const password = await window.forkday.revealCredentialPassword(
        credential.origin,
        credential.email,
      );
      setRevealed((previous) => ({ ...previous, [key]: password }));
    } catch {
      setError(
        'Could not reveal password. Unlock your system keychain and retry.',
      );
    } finally {
      setPending(undefined);
    }
  };

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">
        Saved Credentials
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Account details saved securely on this computer. Use the eye icon to
        reveal a password.
      </p>
      <label htmlFor="credential-search" className="sr-only">
        Search saved credentials
      </label>
      <Input
        id="credential-search"
        type="search"
        placeholder="Search companies or emails…"
        className="mt-6 max-w-sm"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setRevealed({});
        }}
        disabled={!credentials || pending !== undefined}
      />
      {error && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          {error}
        </p>
      )}
      {!error && !credentials && (
        <p role="status" className="mt-6 text-sm">
          Loading…
        </p>
      )}
      {rows && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Saved account credentials</caption>
            <thead className="border-y bg-secondary/50 text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Company
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Email
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Password
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((credential) => {
                const key = `${credential.origin}:${credential.email}`;
                const password = revealed[key];
                return (
                  <tr
                    key={`${credential.origin}:${credential.email}`}
                    className="border-b hover:bg-secondary/40"
                  >
                    <td className="px-4 py-3 font-medium">
                      {credential.company}
                    </td>
                    <td className="px-4 py-3">{credential.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {password ? (
                          <span className="font-mono">{password}</span>
                        ) : (
                          <span aria-label="Password hidden">••••••••••••</span>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground"
                          aria-label={`${password ? 'Hide' : 'Show'} password for ${credential.company} (${credential.email})`}
                          aria-pressed={Boolean(password)}
                          disabled={pending !== undefined}
                          onClick={() => void togglePassword(credential)}
                        >
                          {password ? <EyeOff /> : <Eye />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {credentials?.length
                      ? 'No matching credentials.'
                      : 'No saved credentials yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
