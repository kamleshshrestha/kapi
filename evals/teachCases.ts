/**
 * Evaluation cases for teach-it-back: 12 scripted three-message explanations,
 * two per concept, four each of solid, partial and shaky. The learner messages
 * and the beginner's two questions in between are fixed text, so the run
 * measures the assessor, not a conversation that drifts. `acceptable` lists
 * the verdicts that count as correct. The labels follow the prompt's own
 * definitions (solid: accurate and covers the core; partial: one clear error,
 * a dodged question or a missing core idea; shaky: a clear misunderstanding)
 * and were written by hand; change them only with the same care.
 */
export type TeachVerdict = "solid" | "partial" | "shaky";

export type TeachCase = {
  id: number;
  conceptId: string;
  expected: TeachVerdict;
  /** The learner's three messages. */
  learner: [string, string, string];
  /** What the beginner asked after message 1 and after message 2. */
  beginner: [string, string];
};

export const teachCases: TeachCase[] = [
  { id: 1, conceptId: "gradient-descent", expected: "solid",
    learner: [
      "Gradient descent is how a model trains. You have a loss that says how wrong the model is, and you compute its gradient with respect to the parameters. The gradient points toward steepest increase, so you step in the opposite direction, a little at a time, and the loss goes down.",
      "The learning rate is the size of each step. If it is too small training takes forever, and if it is too large you overshoot the bottom and the loss can bounce around or even blow up.",
      "No, it does not jump to the answer in one move. It takes many small steps, and on a bumpy loss surface it can settle in a local minimum, so stopping when the loss flattens does not prove it found the global best.",
    ],
    beginner: [
      "Okay, so it steps downhill. How big is each step, and does that matter?",
      "So can it just jump straight to the best answer in one go?",
    ] },
  { id: 2, conceptId: "gradient-descent", expected: "shaky",
    learner: [
      "Gradient descent finds the best weights for a model. It looks at the gradient and updates the weights, and after that update the weights are the best they can be.",
      "The learning rate is just how fast it learns, so the bigger the better. A huge learning rate means it finishes quickly and there is no downside.",
      "Yes, one update is enough to get the best parameters, the later steps only polish it. And you move along the gradient to make the loss smaller.",
    ],
    beginner: [
      "So how many times does it update the weights?",
      "What does the learning rate do, and is there a best one to pick?",
    ] },

  { id: 3, conceptId: "backpropagation", expected: "partial",
    learner: [
      "Backpropagation is how a neural network learns. It uses the chain rule to work out how much each weight contributed to the final error, going backwards from the output through the layers.",
      "Each weight gets its own gradient, because each one affects the loss in a different way, so the blame is not shared out equally. Weights closer to the output are not the only ones that get a share, earlier layers do too.",
      "Backpropagation is the part that changes the weights. Once it has the gradients it updates every weight to make the error smaller, so backprop is the learning step itself.",
    ],
    beginner: [
      "Does every weight get told to change by the same amount?",
      "And once it has worked all that out, what actually changes the weights?",
    ] },
  { id: 4, conceptId: "backpropagation", expected: "solid",
    learner: [
      "A network makes a prediction in a forward pass, and we measure the error with a loss. Backpropagation then goes backwards and uses the chain rule to compute the gradient of the loss with respect to every weight, reusing numbers from the forward pass.",
      "It is efficient because one backward pass gives the gradient for all the weights at once. Nudging each weight and re-running the network would need a new forward pass per weight, which is far too slow for millions of weights.",
      "Backprop only computes the gradients. An optimiser such as gradient descent then uses them to update the weights. Every weight in every layer gets its own gradient, not just the last layer.",
    ],
    beginner: [
      "Why not just nudge each weight a bit and see if the error goes down?",
      "So what actually changes the weights, and is it only the last layer?",
    ] },

  { id: 5, conceptId: "overfitting", expected: "solid",
    learner: [
      "Overfitting is when a model learns the noise and quirks of its training data instead of the real pattern. It looks great on the training data but does worse on new data it has not seen.",
      "You spot it by comparing training and validation performance. If training error keeps falling while validation error stops improving or rises, that is overfitting. A small gap is normal and not a problem on its own.",
      "To reduce it you can get more data, simplify the model, add regularisation or stop training early. A more complex model is not automatically better, because it has more room to memorise noise.",
    ],
    beginner: [
      "How would I even know my model is doing that?",
      "So should I make the model as big and powerful as I can?",
    ] },
  { id: 6, conceptId: "overfitting", expected: "shaky",
    learner: [
      "Overfitting is when your model is not good enough yet. If the model scores badly on the test set it just has not learned enough, so you train it for longer.",
      "A model with more parameters is more powerful, so more complexity always gives better results on new data too. The bigger the better.",
      "A very high training accuracy proves the model is good, so if the training score is high I know it will work on anything else.",
    ],
    beginner: [
      "What should I do if the test score is bad?",
      "Is it a good idea to keep making the model bigger?",
    ] },

  { id: 7, conceptId: "train-test-split", expected: "partial",
    learner: [
      "A train/test split keeps some data hidden from the model during training. The model learns on the training part, and the test part tells us how it does on data it has never seen, which is what we care about.",
      "You need the hidden part because the training score is flattering: the model has already seen those examples, so it says little about new data.",
      "I try a few model settings, look at the test score for each, and keep the setting with the best test score. Then I report that test score as the final result, since it is still test data.",
    ],
    beginner: [
      "Why not just check how good the model is on the data it learned from?",
      "And how do you pick between different settings of the model?",
    ] },
  { id: 8, conceptId: "train-test-split", expected: "solid",
    learner: [
      "A train/test split holds back a part of the data that the model never sees while training. The test score then estimates how the model will do on new data, which is the real goal.",
      "If I want to compare settings I use a separate validation set, or cross-validation, so the test set stays untouched. I look at the test set once at the end for the final number.",
      "Things like scaling or filling in missing values must be fitted on the training data only and then applied to the test data. Computing them on everything first leaks information from the test set into training.",
    ],
    beginner: [
      "If I tune the model, which data do I tune it on?",
      "Is there anything I should be careful about when I clean the data?",
    ] },

  { id: 9, conceptId: "linear-regression", expected: "partial",
    learner: [
      "Linear regression fits a straight line through the data by minimising the sum of the squared differences between the line and the points. Those differences are called residuals.",
      "The line will not go through every point, because real data has noise and the line is a simple summary. The residuals are the part the line does not explain.",
      "Once the line fits well in the range I have, say houses between 50 and 150 square metres, I can use it for a 1000 square metre mansion just as reliably. A line keeps going, so it works everywhere.",
    ],
    beginner: [
      "Does the line have to touch all the points?",
      "Can I use the line to predict for values far outside the data I fitted it on?",
    ] },
  { id: 10, conceptId: "linear-regression", expected: "shaky",
    learner: [
      "Linear regression draws a line that goes through all the points. If the line misses any point then it is a bad fit and you should adjust it until it hits every one.",
      "If one point is far off it hardly matters when there are many points, so you can leave the outlier in. It will not move the line much.",
      "The bigger a coefficient is, the more important that feature is. A coefficient of 20000 always matters more than one of 150, whatever the features measure.",
    ],
    beginner: [
      "What if one point is way off from the others?",
      "How do I tell which feature matters most?",
    ] },

  { id: 11, conceptId: "logistic-regression", expected: "partial",
    learner: [
      "Logistic regression is for classification. It computes a linear combination of the features, and a sigmoid squeezes that into a probability between 0 and 1 for the positive class.",
      "The decision boundary comes out as a straight line, or a flat plane in more dimensions, because the thing inside the sigmoid is linear. The S-shaped curve is only how the score becomes a probability, not the shape of the boundary.",
      "The cutoff is always 0.5, above that it is positive. That is fixed for every problem, even for something like cancer screening.",
    ],
    beginner: [
      "Is the boundary between the classes curved because of the S shape?",
      "How does it turn the probability into a yes or no?",
    ] },
  { id: 12, conceptId: "logistic-regression", expected: "shaky",
    learner: [
      "Logistic regression gives you the class directly: the output is the label, zero or one, so there is no probability involved.",
      "Because of the S-shaped sigmoid the boundary between classes is curved, which is why it handles circular patterns well.",
      "It is basically linear regression on the zeros and ones with a sigmoid added to make it look tidier. Fitting a plain line would work about as well.",
    ],
    beginner: [
      "What does the output look like, a label or a number?",
      "What shape does the boundary between the classes have?",
    ] },
];
