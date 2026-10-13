/**
 * Optional sign-in with an email and a 6-digit code (EmailAccount). Off until
 * the Supabase side is ready (manual linking, a custom sender with its own
 * domain, the code templates), because the default sender allows only a couple
 * of mails an hour. Turn it on by setting NEXT_PUBLIC_EMAIL_SIGNIN=on in
 * `.env.local` and Vercel and redeploying. Read at call time so tests can set it.
 */
export function isEmailSignInEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EMAIL_SIGNIN === "on";
}
