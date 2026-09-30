import type { DiagnosticQuestion } from "./types";

export const diagnosticQuestions: DiagnosticQuestion[] = [
  {
    id: "gd-q1-single-update",
    conceptId: "gradient-descent",
    prompt: "What does a single gradient descent update do?",
    options: [
      {
        id: "a",
        text: "Moves the parameters directly to the values that minimize the loss.",
        correct: false,
        misconceptionId: "gd-one-step",
      },
      {
        id: "b",
        text: "Adds the gradient to the parameters.",
        correct: false,
        misconceptionId: "gd-gradient-direction",
      },
      {
        id: "c",
        text: "Nudges the parameters a small step in the direction that reduces the loss.",
        correct: true,
      },
    ],
  },
  {
    id: "gd-q2-gradient-sign",
    conceptId: "gradient-descent",
    prompt:
      "The gradient of the loss with respect to a weight w is +3. What should the update do to w?",
    options: [
      {
        id: "a",
        text: "Decrease w, because the gradient points toward higher loss.",
        correct: true,
      },
      {
        id: "b",
        text: "Increase w, because the gradient points toward lower loss.",
        correct: false,
        misconceptionId: "gd-gradient-direction",
      },
      {
        id: "c",
        text: "Leave w alone, because a positive gradient means the loss is already minimal.",
        correct: false,
      },
    ],
  },
  {
    id: "gd-q3-learning-rate",
    conceptId: "gradient-descent",
    prompt:
      "You raise the learning rate from 0.01 to 10 and the loss shoots up to NaN. What is the most likely explanation?",
    options: [
      {
        id: "a",
        text: "A larger learning rate always converges faster, so the bug must be somewhere else.",
        correct: false,
        misconceptionId: "gd-bigger-lr-better",
      },
      {
        id: "b",
        text: "Gradient descent cannot work with numbers that large.",
        correct: false,
      },
      {
        id: "c",
        text: "The steps are so large they overshoot the minimum and the loss diverges.",
        correct: true,
      },
    ],
  },
  {
    id: "gd-q4-convergence",
    conceptId: "gradient-descent",
    prompt:
      "Training has run long enough that the loss has stopped decreasing. Have you found the best possible parameters?",
    options: [
      {
        id: "a",
        text: "Not necessarily; it may have stalled at a local minimum, saddle point or plateau.",
        correct: true,
      },
      {
        id: "b",
        text: "Yes, gradient descent always finds the global minimum.",
        correct: false,
        misconceptionId: "gd-global-minimum",
      },
      {
        id: "c",
        text: "No, it would keep improving if you used a larger learning rate.",
        correct: false,
        misconceptionId: "gd-bigger-lr-better",
      },
    ],
  },
  {
    id: "bp-q1-what-it-computes",
    conceptId: "backpropagation",
    prompt: "In one training step, what does backpropagation itself compute?",
    options: [
      {
        id: "a",
        text: "The new values of the weights after the step.",
        correct: false,
        misconceptionId: "bp-updates-weights",
      },
      {
        id: "b",
        text: "The network's prediction for the input.",
        correct: false,
      },
      {
        id: "c",
        text: "How much the loss changes with respect to each weight (the gradients).",
        correct: true,
      },
    ],
  },
  {
    id: "bp-q2-who-updates",
    conceptId: "backpropagation",
    prompt: "During training, which step is responsible for actually changing the weights?",
    options: [
      {
        id: "a",
        text: "An optimizer such as gradient descent, which applies an update rule to the weights.",
        correct: true,
      },
      {
        id: "b",
        text: "Backpropagation, which rewrites each weight as it passes backward through the network.",
        correct: false,
        misconceptionId: "bp-updates-weights",
      },
      {
        id: "c",
        text: "The forward pass, which adjusts the weights while it computes predictions.",
        correct: false,
      },
    ],
  },
  {
    id: "bp-q3-which-layers",
    conceptId: "backpropagation",
    prompt:
      "A network has an input layer, two hidden layers and an output layer, and the loss is measured at the output. Which weights get a gradient from backpropagation?",
    options: [
      {
        id: "a",
        text: "Only the output layer's weights, since that is where the loss is measured.",
        correct: false,
        misconceptionId: "bp-last-layer-only",
      },
      {
        id: "b",
        text: "Weights in every layer, because the chain rule carries each weight's effect on the loss back through the network.",
        correct: true,
      },
      {
        id: "c",
        text: "Every weight gets the same gradient, since they all share the blame for one loss value.",
        correct: false,
        misconceptionId: "bp-same-blame",
      },
    ],
  },
  {
    id: "bp-q4-cost",
    conceptId: "backpropagation",
    prompt:
      "A network has 1,000,000 weights. To get the gradient of the loss for every weight on one example, how many passes does backpropagation need?",
    options: [
      {
        id: "a",
        text: "About one per layer, each pass handling one layer's weights.",
        correct: false,
      },
      {
        id: "b",
        text: "About one million, one per weight: nudge the weight, re-run the network and see how the loss changes.",
        correct: false,
        misconceptionId: "bp-per-weight-rerun",
      },
      {
        id: "c",
        text: "One forward pass and one backward pass, which together give every gradient.",
        correct: true,
      },
    ],
  },
  {
    id: "of-q1-train-vs-test",
    conceptId: "overfitting",
    prompt:
      "A model gets 99% accuracy on its training data but only 70% on new data. What does this most likely mean?",
    options: [
      {
        id: "a",
        text: "It is a strong model, and the drop on new data is probably just random noise in the test set.",
        correct: false,
        misconceptionId: "of-train-accuracy-proves",
      },
      {
        id: "b",
        text: "It has memorized details of the training data instead of learning patterns that generalize.",
        correct: true,
      },
      {
        id: "c",
        text: "It has not been trained for long enough yet, so more training should close the gap.",
        correct: false,
        misconceptionId: "of-confused-with-underfit",
      },
    ],
  },
  {
    id: "of-q2-complexity",
    conceptId: "overfitting",
    prompt:
      "You have a small dataset. You swap a simple model for one with 100 times more parameters, and its training error drops to zero. What should you expect on new data?",
    options: [
      {
        id: "a",
        text: "Possibly worse performance, because the extra capacity may be fitting noise in the small dataset.",
        correct: true,
      },
      {
        id: "b",
        text: "Better performance, because a model with more parameters can capture the underlying pattern more precisely.",
        correct: false,
        misconceptionId: "of-more-complexity-always-better",
      },
      {
        id: "c",
        text: "The same performance, because new data comes from the same source as the training data.",
        correct: false,
      },
    ],
  },
  {
    id: "of-q3-validation-rising",
    conceptId: "overfitting",
    prompt:
      "During training, the loss on the training set keeps falling, but the loss on a held-out validation set has started to rise. What is the most sensible response?",
    options: [
      {
        id: "a",
        text: "Keep training, because the validation loss will come back down once the model has learned enough about the data.",
        correct: false,
        misconceptionId: "of-confused-with-underfit",
      },
      {
        id: "b",
        text: "Trust the training loss, because that is the data the model actually learns from, not the validation set.",
        correct: false,
        misconceptionId: "of-train-accuracy-proves",
      },
      {
        id: "c",
        text: "Stop earlier or add regularization, because the model has started fitting the training data too closely.",
        correct: true,
      },
    ],
  },
  {
    id: "of-q4-small-gap",
    conceptId: "overfitting",
    prompt: "A model scores 96% on training data and 94% on test data. What is the best reading?",
    options: [
      {
        id: "a",
        text: "Overfitting, because the model scores lower on the test data than on the training data.",
        correct: false,
        misconceptionId: "of-any-gap-is-overfit",
      },
      {
        id: "b",
        text: "Healthy generalization; a small gap between training and test scores is completely normal.",
        correct: true,
      },
      {
        id: "c",
        text: "Underfitting, because neither the training score nor the test score is 100%.",
        correct: false,
      },
    ],
  },
  {
    id: "tts-q1-why-holdout",
    conceptId: "train-test-split",
    prompt: "Why do we evaluate a model on data it was not trained on?",
    options: [
      {
        id: "a",
        text: "We don't really need to: the training score already shows how good the model is, and holding data back only wastes it.",
        correct: false,
        misconceptionId: "tts-waste-of-data",
      },
      {
        id: "b",
        text: "Performance on data the model has never seen estimates how it will do on new data in real use.",
        correct: true,
      },
      {
        id: "c",
        text: "Training finishes faster when the model sees less data, which saves compute.",
        correct: false,
      },
    ],
  },
  {
    id: "tts-q2-tuning",
    conceptId: "train-test-split",
    prompt:
      "You try 20 hyperparameter settings, keep the one with the best score on the test set, and report that score as the model's expected performance. What is wrong with this?",
    options: [
      {
        id: "a",
        text: "Nothing: the test set was never used to train the weights, so the score is an honest estimate of real performance.",
        correct: false,
        misconceptionId: "tts-tune-on-test",
      },
      {
        id: "b",
        text: "The model would have scored higher if it had also been trained on the test data, so holding it back was a mistake.",
        correct: false,
        misconceptionId: "tts-waste-of-data",
      },
      {
        id: "c",
        text: "Picking the best of 20 by test score lets the test set influence the result; tune on a separate validation set instead.",
        correct: true,
      },
    ],
  },
  {
    id: "tts-q3-scaling",
    conceptId: "train-test-split",
    prompt:
      "Before splitting, you standardize every feature using the mean and standard deviation of the whole dataset, then split into train and test sets. Is that a problem?",
    options: [
      {
        id: "a",
        text: "Yes: the test rows helped set the mean and standard deviation, which leaks information; fit it on the training set only.",
        correct: true,
      },
      {
        id: "b",
        text: "No: scaling only changes units, so it cannot affect the evaluation, as long as the split happens before training.",
        correct: false,
        misconceptionId: "tts-preprocess-before-split",
      },
      {
        id: "c",
        text: "Yes, because features should never be standardized when the model will be trained on the result.",
        correct: false,
      },
    ],
  },
  {
    id: "tts-q4-time-order",
    conceptId: "train-test-split",
    prompt:
      "You want to predict next month's sales from three years of monthly records. You shuffle all the rows, use 80% for training and 20% for testing, and get a great test score. What should you conclude?",
    options: [
      {
        id: "a",
        text: "It is a trustworthy estimate, because a random split is always the fairest way to build a test set, whatever the data.",
        correct: false,
        misconceptionId: "tts-random-always-fine",
      },
      {
        id: "b",
        text: "The shuffle lets the model train on months after the ones it is tested on, which leaks the future; split by time.",
        correct: true,
      },
      {
        id: "c",
        text: "The test set is too small; a test set should be at least half of the data so the estimate is stable.",
        correct: false,
      },
    ],
  },
  {
    id: "lr-q1-best-fit",
    conceptId: "linear-regression",
    prompt:
      "A scatter plot shows a rough upward trend with some scatter around it. What does the best-fit line from linear regression do?",
    options: [
      {
        id: "a",
        text: "It should pass through every point, and a line that misses points is simply a poor fit for the data.",
        correct: false,
        misconceptionId: "lr-hit-every-point",
      },
      {
        id: "b",
        text: "It keeps the overall squared distance to the points as small as possible, even if most points miss it.",
        correct: true,
      },
      {
        id: "c",
        text: "It passes through the first and last points and takes the average of the ones in between.",
        correct: false,
      },
    ],
  },
  {
    id: "lr-q2-extrapolation",
    conceptId: "linear-regression",
    prompt:
      "A line fitted to house sizes between 50 and 150 m² predicts prices well in that range. A colleague uses it to price a 2,000 m² warehouse. What is the best view?",
    options: [
      {
        id: "a",
        text: "Fine: the line describes how size relates to price, so the same relationship should hold at any size.",
        correct: false,
        misconceptionId: "lr-extrapolate-freely",
      },
      {
        id: "b",
        text: "Risky, because a linear model can only output prices that it has already seen in the training data.",
        correct: false,
      },
      {
        id: "c",
        text: "Risky: it was fitted to sizes from 50 to 150 m², and the relationship may change far outside that range.",
        correct: true,
      },
    ],
  },
  {
    id: "lr-q3-coefficients",
    conceptId: "linear-regression",
    prompt:
      "A model predicts salary from years of experience and from annual sales in dollars. The experience coefficient is 3,000 and the sales coefficient is 0.002. What can you conclude?",
    options: [
      {
        id: "a",
        text: "Not yet: the coefficients depend on the units, so compare features only after putting them on the same scale.",
        correct: true,
      },
      {
        id: "b",
        text: "Experience matters far more than sales, because its coefficient is thousands of times larger than the sales coefficient.",
        correct: false,
        misconceptionId: "lr-big-coef-important",
      },
      {
        id: "c",
        text: "The model must be wrong, because the coefficients for different features should always be about the same size.",
        correct: false,
      },
    ],
  },
  {
    id: "lr-q4-outlier",
    conceptId: "linear-regression",
    prompt:
      "You fit a line to 20 points that follow a clear trend, then add one extra point far above the trend and refit. What happens to the line?",
    options: [
      {
        id: "a",
        text: "It barely changes, because one point out of 21 has very little say in where the line goes.",
        correct: false,
        misconceptionId: "lr-outlier-harmless",
      },
      {
        id: "b",
        text: "It tilts noticeably toward the extra point, because squared error gives a far-off point a large pull.",
        correct: true,
      },
      {
        id: "c",
        text: "It bends so that it passes through the extra point as well, because the fitted line should hit every point.",
        correct: false,
        misconceptionId: "lr-hit-every-point",
      },
    ],
  },
  {
    id: "lgr-q1-output",
    conceptId: "logistic-regression",
    prompt:
      "A trained logistic regression model is given a new email. What does the model itself output?",
    options: [
      {
        id: "a",
        text: "A probability between 0 and 1 that the email is spam; a threshold then turns it into a class.",
        correct: true,
      },
      {
        id: "b",
        text: "The class itself, spam or not spam, given directly as a 1 or a 0 with no probability involved.",
        correct: false,
        misconceptionId: "lgr-output-is-label",
      },
      {
        id: "c",
        text: "Any real number, the same way linear regression outputs a price, which is then rounded to a class.",
        correct: false,
      },
    ],
  },
  {
    id: "lgr-q2-boundary",
    conceptId: "logistic-regression",
    prompt:
      "Two classes form a ring in a plot of two features: class A sits inside a circle and class B surrounds it. Logistic regression is fitted on just those two features. What will most likely happen?",
    options: [
      {
        id: "a",
        text: "It will draw a circular boundary, because the sigmoid is a curve and can bend around the inner class.",
        correct: false,
        misconceptionId: "lgr-curved-boundary",
      },
      {
        id: "b",
        text: "It will separate them poorly, because its decision boundary is a straight line in this feature space.",
        correct: true,
      },
      {
        id: "c",
        text: "It will separate them perfectly, because it always finds the best boundary whatever the data look like.",
        correct: false,
      },
    ],
  },
  {
    id: "lgr-q3-threshold",
    conceptId: "logistic-regression",
    prompt:
      "A model screens for a serious disease that affects 1 in 100 patients. Missing a sick patient is far worse than a false alarm. What should you do about the 0.5 threshold?",
    options: [
      {
        id: "a",
        text: "Keep it at 0.5, because a probability above 0.5 is the only sensible definition of a positive case.",
        correct: false,
        misconceptionId: "lgr-threshold-always-half",
      },
      {
        id: "b",
        text: "There is no threshold to change: the model outputs the class directly, so the only fix is more data.",
        correct: false,
        misconceptionId: "lgr-output-is-label",
      },
      {
        id: "c",
        text: "Consider lowering it so more patients get flagged, accepting extra false alarms to miss fewer sick ones.",
        correct: true,
      },
    ],
  },
  {
    id: "lgr-q4-why-sigmoid",
    conceptId: "logistic-regression",
    prompt:
      "Why not simply fit an ordinary straight line to the 0/1 labels instead of using a sigmoid?",
    options: [
      {
        id: "a",
        text: "A line can output values below 0 or above 1, which are not valid probabilities; the sigmoid keeps outputs in 0 to 1.",
        correct: true,
      },
      {
        id: "b",
        text: "You could: the line would work equally well, and the sigmoid only makes the output look tidier and easier to read.",
        correct: false,
        misconceptionId: "lgr-sigmoid-cosmetic",
      },
      {
        id: "c",
        text: "A straight line cannot be fitted to labels that are only 0 and 1, because fitting needs continuous labels.",
        correct: false,
      },
    ],
  },
];

export function getQuestionsForConcept(
  conceptId: string,
): DiagnosticQuestion[] {
  return diagnosticQuestions.filter((q) => q.conceptId === conceptId);
}
