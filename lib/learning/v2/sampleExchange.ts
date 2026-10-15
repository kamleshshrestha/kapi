import type { ChatMessage } from "./types";

/**
 * A short worked example for the landing page. A user said they wanted "a
 * short explanation or an example of how to use the app on the home page";
 * the three-step intro was already there, so what was missing was not more
 * description but something concrete. The hard part for a new learner is the
 * empty box: they do not know that a rough, half-right answer in their own
 * words is exactly what Kapi wants, so the example shows one.
 *
 * It is deliberately an imperfect explanation with a real gap, and Kapi's
 * reply names that gap rather than re-explaining the concept. Static copy,
 * never sent to the model. Draft copy: reword freely.
 */
export const SAMPLE_EXCHANGE: ChatMessage[] = [
  {
    role: "kapi",
    text: "Overfitting — pretend I've never heard of it. How would you describe it?",
  },
  {
    role: "learner",
    text: "It's when the model gets too good at the training data, so it just memorises it instead of learning.",
  },
  {
    role: "kapi",
    text: "You've got the memorising part, and that's the heart of it. But you've not said how you would ever notice it happening — what would you look at to tell a model that memorised from one that learned?",
  },
];

/**
 * The toggle's label. It has to say what is behind it well enough that someone
 * wondering how the app works opens it, since it starts closed.
 */
export const SAMPLE_EXCHANGE_HEADING = "See what a session looks like";
