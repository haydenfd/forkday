import { useEffect, useState } from 'react';
import type { SavedCredential } from '../../shared/contracts';
import { Eye, EyeOff, KeyRound, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
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
    <section className="mx-auto w-full max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Saved Credentials
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Workday accounts Forkday created or signed in with, encrypted with
            your system keychain.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <label htmlFor="credential-search" className="sr-only">
            Search saved credentials
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground"
          />
          <Input
            id="credential-search"
            type="search"
            placeholder="Search companies or emails…"
            className="pl-9"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setRevealed({});
            }}
            disabled={!credentials || pending !== undefined}
          />
        </div>
      </header>
      {error && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          {error}
        </p>
      )}
      {!error && !credentials && (
        <div role="status" aria-label="Loading" className="mt-6 space-y-2">
          {[0, 1, 2].map((key) => (
            <div key={key} className="skeleton h-12" />
          ))}
        </div>
      )}
      {rows && (
        <Card className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[40rem] table-fixed text-left text-sm">
            <caption className="sr-only">Saved account credentials</caption>
            <colgroup>
              <col className="w-1/4" />
              <col className="w-2/5" />
              <col />
            </colgroup>
            <thead className="border-b bg-secondary/50 text-muted-foreground">
              <tr>
                <th scope="col" className="break-words px-4 py-3 font-medium">
                  Company
                </th>
                <th scope="col" className="break-words px-4 py-3 font-medium">
                  Email
                </th>
                <th scope="col" className="break-words px-4 py-3 font-medium">
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
                    className="border-b last:border-b-0 hover:bg-secondary/40"
                  >
                    <td className="break-words px-4 py-3 font-medium">
                      {credential.company}
                    </td>
                    <td className="break-all px-4 py-3">{credential.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex h-8 min-w-0 items-center gap-2">
                        {password ? (
                          <span className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono">
                            {password}
                          </span>
                        ) : (
                          <span
                            className="min-w-0 flex-1 font-mono"
                            aria-label="Password hidden"
                          >
                            ••••••••••••
                          </span>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground"
                          aria-label={`${password ? 'Hide' : 'Show'} password for ${credential.company} (${credential.email})`}
                          aria-pressed={Boolean(password)}
                          disabled={pending !== undefined}
                          onClick={() => void togglePassword(credential)}
                        >
                          <span
                            className="t-icon-swap"
                            data-state={password ? 'b' : 'a'}
                            aria-hidden
                          >
                            <Eye className="t-icon" data-icon="a" />
                            <EyeOff className="t-icon" data-icon="b" />
                          </span>
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
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    <KeyRound
                      aria-hidden
                      className="mx-auto mb-3 size-6 text-muted-foreground"
                    />
                    {credentials?.length
                      ? 'No matching credentials.'
                      : 'No saved credentials yet. They appear after Forkday signs in to a Workday site.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}
