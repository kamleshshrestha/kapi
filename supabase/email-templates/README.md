# Auth email templates

Paste these into the Supabase dashboard (Authentication > Emails > Templates)
once a custom email provider is set up. Kapi signs learners in with a 6-digit
code, so the emails must show `{{ .Token }}` (not a link).

- "Change Email Address" (used when an email is attached to a saved account): `change-email.html`
- "Magic Link" (used to sign in on another device): `magic-link.html`
