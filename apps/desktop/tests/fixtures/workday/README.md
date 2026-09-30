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
`createAccountSubmitButton`. The last three are never activated by the filler.
