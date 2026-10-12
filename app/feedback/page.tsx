import type { Metadata } from "next";
import Link from "next/link";
import FeedbackForm from "@/components/v2/FeedbackForm";

export const metadata: Metadata = {
  title: "Feedback — Kapi",
  description: "Tell us what worked and what didn't.",
};

export default function FeedbackPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <Link href="/" className="text-sm text-foreground/60 hover:text-foreground py-2 -my-2">
        ← Back
      </Link>
      <h1 className="text-4xl font-semibold tracking-tight">Feedback</h1>
      <FeedbackForm />
    </main>
  );
}
