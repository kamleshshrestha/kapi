import Link from "next/link";

const link = "py-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-3xl flex-wrap gap-x-6 px-6 py-6 text-sm text-foreground/60">
      <Link href="/feedback" className={link}>
        Send feedback
      </Link>
      <Link href="/privacy" className={link}>
        Privacy
      </Link>
      <Link href="/impressum" className={link}>
        Impressum
      </Link>
    </footer>
  );
}
