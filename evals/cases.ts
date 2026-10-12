/**
 * Evaluation cases for the diagnosis step: 24 learner explanations, four per
 * concept (two with a known gap, one strong, one tricky). `acceptable` lists
 * the misconception ids that count as a correct diagnosis; an empty list means
 * a strong explanation, where the right answer is "no gap" (null). The labels
 * were reviewed by hand; change them only with the same care.
 */
export type EvalCase = {
  id: number;
  conceptId: string;
  kind: "gap" | "strong" | "tricky";
  explanation: string;
  acceptable: string[];
};

export const evalCases: EvalCase[] = [
  // Gradient descent
  { id: 1, conceptId: "gradient-descent", kind: "gap", acceptable: ["gd-global-minimum"],
    explanation: "Gradient descent keeps updating the weights, and once the loss stops going down I know it has found the best possible weights, the global minimum, so I can stop and trust them." },
  { id: 2, conceptId: "gradient-descent", kind: "gap", acceptable: ["gd-bigger-lr-better"],
    explanation: "The learning rate controls how fast it learns, so the best thing to do is set it as high as possible so training finishes sooner. There's no real downside." },
  { id: 3, conceptId: "gradient-descent", kind: "strong", acceptable: [],
    explanation: "Gradient descent trains a model by repeatedly measuring the gradient of the loss with respect to the parameters, which points toward steepest increase, then stepping the opposite way scaled by the learning rate. Too small a rate wastes time, too large overshoots or diverges. In practice we use mini-batches to estimate the gradient, which adds noise but makes each step cheaper." },
  { id: 4, conceptId: "gradient-descent", kind: "tricky", acceptable: ["gd-gradient-direction", "gd-bigger-lr-better"],
    explanation: "You take the gradient of the loss and move along it to reduce the error. A large learning rate means fewer steps, so it is always better to use a big one." },

  // Backpropagation
  { id: 5, conceptId: "backpropagation", kind: "gap", acceptable: ["bp-same-blame"],
    explanation: "Backpropagation sends the final error backwards through the network, and each weight gets the same error value, so every weight is told to change by the same amount." },
  { id: 6, conceptId: "backpropagation", kind: "gap", acceptable: ["bp-per-weight-rerun"],
    explanation: "To find how each weight should change, backpropagation nudges one weight a tiny bit, runs the network again to see how the loss changes, and repeats this for every weight." },
  { id: 7, conceptId: "backpropagation", kind: "strong", acceptable: [],
    explanation: "Backpropagation applies the chain rule to compute the gradient of the loss with respect to every weight in one backward pass, reusing intermediate results from the forward pass. An optimiser like SGD then uses those gradients to update the weights; backprop itself only computes them." },
  { id: 8, conceptId: "backpropagation", kind: "tricky", acceptable: ["bp-last-layer-only", "bp-updates-weights"],
    explanation: "Backpropagation is how the network learns: the error at the output layer is computed and that's what gets the weights fixed, mostly the last layer since that's where the error is." },

  // Overfitting
  { id: 9, conceptId: "overfitting", kind: "gap", acceptable: ["of-more-complexity-always-better"],
    explanation: "A bigger model with more parameters is more powerful, so it will do better on new data as well. To get better results you should always make the model more complex." },
  { id: 10, conceptId: "overfitting", kind: "gap", acceptable: ["of-confused-with-underfit"],
    explanation: "If my model scores badly on the test set it means it hasn't learned enough yet, so I should keep training it for longer until the test score goes up." },
  { id: 11, conceptId: "overfitting", kind: "strong", acceptable: [],
    explanation: "Overfitting means the model has learned noise and quirks of the training set, so it generalises poorly. You check by holding out validation data or using cross-validation, and the signature is validation error that stops improving or rises while training error keeps falling. More data, regularisation, early stopping or a simpler model help. Some gap between the two scores is normal." },
  { id: 12, conceptId: "overfitting", kind: "tricky", acceptable: ["of-any-gap-is-overfit"],
    explanation: "Overfitting is when the model does well on the training data but badly on new data. The best sign is that training accuracy is higher than test accuracy, so any difference at all means I should simplify the model." },

  // Train/test split
  { id: 13, conceptId: "train-test-split", kind: "gap", acceptable: ["tts-waste-of-data"],
    explanation: "Splitting data wastes examples, because the model could learn from them. The training score already tells me how good the model is, so I would rather train on everything." },
  { id: 14, conceptId: "train-test-split", kind: "gap", acceptable: ["tts-preprocess-before-split"],
    explanation: "I standardise the whole dataset first, and fill in missing values using the average of all rows, and then split into train and test. Splitting afterwards means the preprocessing is the same for both." },
  { id: 15, conceptId: "train-test-split", kind: "strong", acceptable: [],
    explanation: "A train/test split holds back data the model never sees during training, so the test score estimates performance on new data. Hyperparameters are tuned on a separate validation set or with cross-validation, and the test set is used once at the end. Preprocessing statistics are fitted on the training data only, to avoid leakage." },
  { id: 16, conceptId: "train-test-split", kind: "tricky", acceptable: ["tts-random-always-fine"],
    explanation: "I shuffle the rows randomly and take 80% for training and 20% for testing. This works for any dataset, including patient records where the same person appears in many rows, or data collected over time." },

  // Linear regression
  { id: 17, conceptId: "linear-regression", kind: "gap", acceptable: ["lr-extrapolate-freely"],
    explanation: "My line fits house prices for 50 to 150 square metres really well, so I can use it to predict a 1000 square metre mansion just as reliably." },
  { id: 18, conceptId: "linear-regression", kind: "gap", acceptable: ["lr-big-coef-important"],
    explanation: "In my model the coefficient for number of rooms is 20000 and for house age it is 150, so the number of rooms matters much more than age." },
  { id: 19, conceptId: "linear-regression", kind: "strong", acceptable: [],
    explanation: "Linear regression fits a line by minimising the sum of squared residuals. The line usually won't hit every point, since the residuals reflect noise. Because errors are squared, outliers can pull the line hard, so I check residuals. Predictions are only trustworthy within the range of the training data, and coefficient sizes depend on feature scales." },
  { id: 20, conceptId: "linear-regression", kind: "tricky", acceptable: ["lr-outlier-harmless"],
    explanation: "I have 1000 points and one is wildly off. With so many points one outlier hardly matters to where the line goes, so I just leave it in." },

  // Logistic regression
  { id: 21, conceptId: "logistic-regression", kind: "gap", acceptable: ["lgr-curved-boundary"],
    explanation: "Because the sigmoid is an S-shaped curve, logistic regression draws a curved boundary between the classes, which is why it handles circular patterns well." },
  { id: 22, conceptId: "logistic-regression", kind: "gap", acceptable: ["lgr-threshold-always-half"],
    explanation: "Logistic regression gives a probability, and anything above 0.5 is positive. That cutoff is fixed, even for something like cancer screening." },
  { id: 23, conceptId: "logistic-regression", kind: "strong", acceptable: [],
    explanation: "Logistic regression models the log-odds of the positive class as a linear function of the features, and the sigmoid turns that into a probability between 0 and 1. The decision boundary is where the probability equals the threshold, which is a straight line in feature space. The 0.5 default can be moved depending on the cost of false positives and negatives." },
  { id: 24, conceptId: "logistic-regression", kind: "tricky", acceptable: ["lgr-sigmoid-cosmetic"],
    explanation: "Logistic regression is just linear regression on 0/1 labels followed by a sigmoid to tidy the output. Fitting a straight line directly would work about as well." },
];
