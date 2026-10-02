# Workday account fixtures

Captured September 29, 2026 from this public job:
https://workday.wd5.myworkdayjobs.com/en-US/Workday/job/USA-IL-Chicago/Principal---Senior-Partner-Solution-Architect--Workday-Wellness_JR-0109178

Inspection path: Apply → Apply Manually → Sign in with email → Create Account
(the last click opens the form, not its submit button). No credentials were
entered and no form was submitted during capture.

These are the actual `signInContent` panels with scripts, CSS, links, SVGs,
site-specific introductory copy, the honeypot, and unrelated content removed.
Inputs are empty. Labels, roles, headings, and automation IDs are preserved.

Observed selectors: `applyManually`, `SignInWithEmailButton`, `email`, `password`,
`verifyPassword`, `createAccountCheckbox`, `signInSubmitButton`, and
`createAccountSubmitButton`. Filling leaves consent and submission untouched;
the separate submit helper checks consent for account creation and activates
Workday's visible submit overlay with Enter.

## My Information: Phone

Inspected and independently rechecked September 29, 2026 in Forkday's Chromium view after signing in to
Workday with an existing saved account. No application fields were filled and
Save and Continue was not clicked.

The automation IDs below belong to field wrappers; the inputs themselves have
HTML IDs and accessible labels. Scope locators to the wrapper before finding
its input or button.

| Profile property   | Field wrapper automation ID  | Control HTML ID                 |
| ------------------ | ---------------------------- | ------------------------------- |
| `phoneDeviceType`  | `formField-phoneType`        | `phoneNumber--phoneType`        |
| `phoneCountryCode` | `formField-countryPhoneCode` | `phoneNumber--countryPhoneCode` |
| `phone`            | `formField-phoneNumber`      | `phoneNumber--phoneNumber`      |
| `phoneExtension`   | `formField-extension`        | `phoneNumber--extension`        |

Observed device choices: Home and Mobile. The country-code control is a
searchable prompt, not a plain text field; its selected label was
`United States of America (+1)`. Profile stores this label separately from the
address country and the national phone number. Profile exposes a disabled
`🇺🇸 +1 US` country field and a number field; saving supplies
`United States of America (+1)`, Mobile, and no extension. Numbers are stored as
entered without automatic formatting.

Use the device button's `aria-controls` to scope its listbox: a global
`[role=option]` locator also matches the selected country-code pill. The country
code's searchable prompt has `multiSelectContainer`, `selectedItemList`,
`selectedItem`, and `promptOption` automation IDs. The search input's value is
empty even when a country is selected; read the selected `promptOption` label.

## My Information: remaining controls

The same live inspection confirmed these field wrappers. Country and State
are dropdown buttons; State options depend on the selected country. Inputs use
the wrappers below rather than generated radio IDs or CSS classes.

| Field                         | Field wrapper automation ID           |
| ----------------------------- | ------------------------------------- |
| How Did You Hear About Us?    | `formField-source`                    |
| Previously worked for Workday | `formField-candidateIsPreviousWorker` |
| Country / Territory           | `formField-country`                   |
| First Name                    | `formField-legalName--firstName`      |
| Middle Name                   | `formField-legalName--middleName`     |
| Last Name                     | `formField-legalName--lastName`       |
| I have a preferred name       | `formField-preferredCheck`            |
| Address Line 1                | `formField-addressLine1`              |
| City                          | `formField-city`                      |
| State                         | `formField-countryRegion`             |
| Postal Code                   | `formField-postalCode`                |

Referral source and previous employment need the user's actual answers; do not
infer them from page defaults. Country-dependent name and address layouts need
inspection for each supported country. This change prepares phone storage and
documents selectors; it does not fill My Information or advance the application.
