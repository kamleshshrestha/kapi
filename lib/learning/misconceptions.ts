import type { Misconception } from "./types";

export const misconceptions: Misconception[] = [
  {
    id: "gd-one-step",
    conceptId: "gradient-descent",
    title: "Thinks it jumps straight to the minimum",
    belief: "Gradient descent computes the best parameters in a single update.",
    correction:
      "Each update only takes a small step downhill using local slope information. Reaching a minimum takes many repeated steps.",
    example:
      "Say the loss is w squared, which is smallest at w = 0, and you start at w = 10 with a learning rate of 0.1. The slope at w is 2w, so each step is w - 0.1 * 2w, leaving 0.8 of w. From 10 you get 8, then 6.4, then 5.12. Three steps in you are still nowhere near 0, and only many more steps bring you close.",
  },
  {
    id: "gd-gradient-direction",
    conceptId: "gradient-descent",
    title: "Thinks the gradient points downhill",
    belief:
      "The gradient points toward lower loss, so you move in the gradient's direction.",
    correction:
      "The gradient points in the direction of steepest increase in loss. Gradient descent subtracts it, moving the opposite way.",
    example:
      "Take the loss w squared and stand at w = 3, where the loss is 9. The gradient there is 2 * 3 = 6, a positive number, which means the loss rises as w rises. Move along the gradient with a rate of 0.1 and you land on w = 3.6, where the loss is 12.96: worse. Subtract it instead and you land on w = 2.4, where the loss is 5.76: better.",
  },
  {
    id: "gd-bigger-lr-better",
    conceptId: "gradient-descent",
    title: "Thinks a bigger learning rate is always faster",
    belief:
      "Raising the learning rate always makes training converge sooner, with no downside.",
    correction:
      "A learning rate that is too large overshoots the minimum and can make the loss oscillate or blow up. It has to be tuned.",
    example:
      "With the loss w squared, each step leaves w multiplied by (1 - 2 * learning rate). At a rate of 0.1 that factor is 0.8, so from w = 1 you get 0.8, then 0.64, closing in on 0. At a rate of 1.1 the factor is -1.2, so from w = 1 you get -1.2, then 1.44, then -1.728: the same rule, a bigger rate, and the loss climbs away instead.",
  },
  {
    id: "gd-global-minimum",
    conceptId: "gradient-descent",
    title: "Thinks it always finds the global minimum",
    belief:
      "Once the loss stops decreasing, gradient descent has found the best possible parameters.",
    correction:
      "On non-convex losses it can stall at a local minimum, saddle point or plateau. A flat loss curve does not prove the parameters are optimal.",
    example:
      "Picture a loss curve with two valleys, a shallow one near w = -1 and a deeper one near w = 4. Start at w = -2 and every step takes you downhill into the shallow valley. Once you are at its bottom the slope is zero, so the steps stop and the loss curve goes flat. Nothing about that flat curve tells you the deeper valley at w = 4 exists.",
  },
  {
    id: "bp-updates-weights",
    conceptId: "backpropagation",
    title: "Thinks backpropagation updates the weights",
    belief: "Backpropagation is the step that changes the weights during training.",
    correction:
      "Backpropagation only computes the gradient of the loss with respect to each weight. A separate optimizer step, such as gradient descent, uses those gradients to update the weights.",
    example:
      "A weight sits at w = 5, and the backward pass works out that the loss changes by 2 for each unit of w: that number, 2, is all backpropagation produces. The weight is still 5. Only when the optimizer runs, with a learning rate of 0.1, does it become 5 - 0.1 * 2 = 4.8.",
  },
  {
    id: "bp-same-blame",
    conceptId: "backpropagation",
    title: "Thinks every weight gets the same blame",
    belief:
      "The loss is passed back unchanged, so every weight receives the same error signal.",
    correction:
      "Each weight gets its own gradient. The chain rule multiplies local derivatives along the path from that weight to the loss, so weights with more influence on the loss get larger gradients and some get almost none.",
    example:
      "Take an output that adds two weighted inputs, w1 * x1 + w2 * x2, with x1 = 1 and x2 = 10. Each weight's gradient is the error signal at the output multiplied by its own input, so w2's gradient is ten times w1's. Same error, same layer, same backward pass, and the two weights are told to move by very different amounts.",
  },
  {
    id: "bp-last-layer-only",
    conceptId: "backpropagation",
    title: "Thinks only the last layer learns",
    belief:
      "The loss is measured at the output, so only the output layer's weights receive gradients.",
    correction:
      "The chain rule carries the loss's sensitivity back through every layer, so every weight, including those in early hidden layers, receives a gradient. The gradients can shrink on the way back, but they are still computed for all layers.",
    example:
      "Chain two weights so the output is y = w2 * w1 * x, with x = 1, w1 = 2 and w2 = 3, giving y = 6. If the loss pushes y down with a strength of 6 at the output, then w2's gradient is 6 * (w1 * x) = 12 and w1's is 6 * (w2 * x) = 18. The first weight is two steps from the loss and still gets the larger gradient of the two.",
  },
  {
    id: "bp-per-weight-rerun",
    conceptId: "backpropagation",
    title: "Thinks it needs a separate pass for every weight",
    belief:
      "To get a weight's gradient you nudge that weight and re-run the network to see how the loss changes.",
    correction:
      "That is numerical differentiation, and it would be far too slow for millions of weights. Backpropagation reuses values saved during the forward pass and applies the chain rule, so one backward pass gives every gradient at roughly the cost of the forward pass.",
    example:
      "Take a small network with 1,000,000 weights. Nudging one weight and re-running to see what happens to the loss costs you one forward pass per weight, so 1,000,001 passes to get a single update. Backpropagation reuses what the forward pass already computed and gets all 1,000,000 gradients in one backward pass, at roughly the cost of one more forward pass.",
  },
  {
    id: "of-train-accuracy-proves",
    conceptId: "overfitting",
    title: "Thinks high training accuracy means a good model",
    belief:
      "If a model scores very well on its training data, it has learned the task well.",
    correction:
      "A model can reach near-perfect training accuracy by memorizing the training examples, noise included. Only performance on data it has not seen shows whether it generalizes.",
    example:
      "A model is trained on 1,000 labelled rows and scores 100% when you test it on those same 1,000 rows. Show it 300 rows it has never seen and it gets 62%. The first number only tells you it can reproduce what it was shown; the second is the one that says how it will do tomorrow.",
  },
  {
    id: "of-more-complexity-always-better",
    conceptId: "overfitting",
    title: "Thinks a more complex model is always better",
    belief:
      "More parameters means more power, so a bigger model will always do better on new data too.",
    correction:
      "Extra capacity lets a model fit the noise in a limited dataset, which usually makes it worse on new data. The right complexity depends on how much data you have and how noisy it is.",
    example:
      "Fit 20 noisy points with a straight line and it misses most of them a little. Fit the same 20 points with a wiggly curve flexible enough to pass through nearly every one, and its error on those 20 points drops to almost nothing. Collect 20 fresh points from the same source and the straight line predicts them better, because the curve bent itself to fit noise that will not repeat.",
  },
  {
    id: "of-confused-with-underfit",
    conceptId: "overfitting",
    title: "Confuses overfitting with underfitting",
    belief:
      "If a model does badly on new data, it just has not learned enough yet, so it needs more training.",
    correction:
      "Underfitting is doing badly everywhere because the model has not captured the pattern. Overfitting is doing well on training data but badly on new data, and training longer on the same data usually makes it worse, not better.",
    example:
      "Two failing models. The first scores 55% on its training data and 54% on new data: it has not learned the pattern anywhere, and more training may help. The second scores 99% on training data and 70% on new data. Training the second one longer on the same rows will push 99% towards 100% and leave the 70% where it is or worse.",
  },
  {
    id: "of-any-gap-is-overfit",
    conceptId: "overfitting",
    title: "Thinks any train-test gap means overfitting",
    belief:
      "If test accuracy is lower than training accuracy at all, the model is overfitting.",
    correction:
      "Some gap is normal, because a model always fits the data it trained on slightly better. Overfitting is a large gap, or test performance getting worse while training performance keeps improving.",
    example:
      "A model scoring 93% on training data and 91% on new data has a 2-point gap, which is the ordinary advantage of having seen the data before. A model scoring 99% and 72% has a 27-point gap. Watching across training also tells them apart: in the second, the training score kept climbing while the test score started falling.",
  },
  {
    id: "tts-waste-of-data",
    conceptId: "train-test-split",
    title: "Thinks holding data back is a waste",
    belief:
      "A model's training score already shows how good it is, and setting data aside only gives it less to learn from.",
    correction:
      "A model's score on data it trained on is optimistic, so it cannot show how the model will do on new data. Held-out data is what lets you measure that. Once you have your estimate, you can retrain on all the data if you want.",
    example:
      "You have 1,000 rows. Train on all 1,000 and score the model on those same rows and you get 98%, but you have no idea what that means for new data. Hold back 200, train on the remaining 800, and the held-back rows give 82%. You gave up 200 rows of training and in exchange you learned the thing the first number could not tell you.",
  },
  {
    id: "tts-tune-on-test",
    conceptId: "train-test-split",
    title: "Thinks it's fine to tune on the test set",
    belief:
      "You can check and adjust against the test set as often as you like, since the model was never trained on it.",
    correction:
      "Each time you pick a setting because it scored better on the test set, the test set influences the model and the final score becomes optimistic. Tune on a separate validation set (or with cross-validation) and use the test set once, at the end.",
    example:
      "You try 20 settings and keep the one scoring best on the test set, which reaches 88%. Some of that 88% is the setting genuinely being better and some is it happening to suit those particular rows, and you cannot tell which is which. Score that same model on rows you never looked at and it gets 81%. The 88% was partly a measurement of your own choosing.",
  },
  {
    id: "tts-preprocess-before-split",
    conceptId: "train-test-split",
    title: "Thinks preprocessing can use all the data before splitting",
    belief:
      "Scaling or filling in missing values using the whole dataset is harmless, as long as you split afterwards.",
    correction:
      "Statistics such as the mean or standard deviation computed from all rows include the test rows, so information about the test set leaks into training. Fit preprocessing on the training set only, then apply it to the test set.",
    example:
      "Say 900 training rows average 50 and 100 test rows average 80. Fill in missing values using all 1,000 rows and the average you use is (900 * 50 + 100 * 80) / 1000 = 53, a number the test rows helped set, so every training row is scaled with a trace of the test set in it. Computed on the training rows alone it is 50, and the test rows are then filled in using that 50.",
  },
  {
    id: "tts-random-always-fine",
    conceptId: "train-test-split",
    title: "Thinks a random split is always the right split",
    belief:
      "Shuffling the rows and splitting them randomly gives a fair test set for any dataset.",
    correction:
      "The split has to match how the model will be used. With time-ordered data a random split lets the model train on the future, so split by time. Rows from the same person or group should stay together, and rare classes may need a stratified split.",
    example:
      "You have 365 days of sales and want to predict next month. Shuffle the rows and split them randomly and December days land in the training set while June days land in the test set, so the model forecasts June having already seen December. It will score well and the score will mean nothing, because the real task never lets it see the future.",
  },
  {
    id: "lr-hit-every-point",
    conceptId: "linear-regression",
    title: "Thinks the line should pass through every point",
    belief:
      "A good best-fit line goes through all the data points, and one that misses points is a poor fit.",
    correction:
      "Real data is noisy, so a straight line cannot hit every point. Linear regression picks the line that makes the overall squared error as small as possible, which usually leaves most points slightly off the line.",
    example:
      "Take three points: (1, 2), (2, 4) and (3, 7). No straight line passes through all three. The best-fit line is roughly y = 2.5x - 0.67, which predicts 1.83, 4.33 and 6.83, missing each actual value by about 0.17, 0.33 and 0.17. That line is the right answer, and it still misses every single point.",
  },
  {
    id: "lr-extrapolate-freely",
    conceptId: "linear-regression",
    title: "Thinks the line holds far outside the data",
    belief:
      "Once a line fits the data well, its predictions are just as reliable for any input, however far away.",
    correction:
      "The line only describes the relationship where there was data. Far outside that range the true relationship may bend, level off or change entirely, so predictions there (extrapolation) are much less trustworthy.",
    example:
      "Fit a price line on houses between 50 and 150 square metres and it may describe them well. Ask it about a 600 square metre house and it carries the same straight slope four times past where any data ended. Nothing in the fit says the price keeps rising at that rate out there, and in practice it usually does not.",
  },
  {
    id: "lr-big-coef-important",
    conceptId: "linear-regression",
    title: "Thinks a bigger coefficient always means a more important feature",
    belief: "The feature with the larger coefficient matters more to the prediction.",
    correction:
      "A coefficient depends on the units of its feature: a feature measured in small units needs a large coefficient to have the same effect. To compare importance, put the features on the same scale first, for example by standardizing them.",
    example:
      "Take one feature, a distance, and fit the model twice. Measured in kilometres its coefficient comes out as 5. Measured in metres the same relationship gives a coefficient of 0.005, because a metre moves the prediction a thousandth as much as a kilometre does. The feature did not change importance between those two runs; only the units did.",
  },
  {
    id: "lr-outlier-harmless",
    conceptId: "linear-regression",
    title: "Thinks one outlier barely affects the line",
    belief:
      "With enough points, a single unusual point has little say in where the line goes.",
    correction:
      "Least squares squares each error, so a point far from the trend contributes a very large error and pulls the line toward it. One outlier can noticeably tilt the line, especially when there are few points.",
    example:
      "Take ten points lying exactly on y = 2x, for x from 1 to 10, where the best-fit line has a slope of 2. Now change the last point's y from 20 to 200 and refit. The slope jumps to about 11.8. Nine untouched points were not enough to hold the line down, because squaring that one large error made it dominate the total.",
  },
  {
    id: "lgr-output-is-label",
    conceptId: "logistic-regression",
    title: "Thinks it outputs the class directly",
    belief:
      "Logistic regression outputs a 0 or a 1, so the number it produces is the predicted class.",
    correction:
      "The model outputs a probability between 0 and 1. A class is only chosen afterwards, by comparing that probability with a threshold.",
    example:
      "A model is given one case and returns 0.73. That is not the class: it is a probability. Compare it with a 0.5 cutoff and the case is positive. Compare the same 0.73 with a 0.8 cutoff, which you might use when acting on a positive is expensive, and the same case is negative. The model's number never changed; only the cutoff did.",
  },
  {
    id: "lgr-curved-boundary",
    conceptId: "logistic-regression",
    title: "Thinks the sigmoid makes the decision boundary curved",
    belief:
      "Because the sigmoid is an S-shaped curve, logistic regression separates classes with a curved boundary.",
    correction:
      "The sigmoid only squashes a linear score into a probability. The decision boundary is where that score is zero, which is a straight line (or flat plane) in the feature space, so classes that need a curved boundary cannot be separated without extra features.",
    example:
      "Say the score is 2 * x1 - x2 - 1. The boundary is every point where that score is 0, which is the straight line x2 = 2 * x1 - 1. The point (3, 1) scores 4 and comes out at about 0.98, and (0, 2) scores -3 and comes out at about 0.05, so the probabilities bend smoothly between them. The dividing line itself stays straight.",
  },
  {
    id: "lgr-threshold-always-half",
    conceptId: "logistic-regression",
    title: "Thinks 0.5 is the only sensible threshold",
    belief:
      "A case is positive when its probability is above 0.5, and that cutoff should never change.",
    correction:
      "0.5 is only a default. When one kind of mistake costs more, or when a class is rare, you can move the threshold to trade false positives against false negatives.",
    example:
      "Screen for a condition that 2 in 100 people have. At a 0.5 cutoff the model almost never calls anyone positive, because it is rarely that confident, so most real cases are missed. Drop the cutoff to 0.1 and it catches far more of them, at the price of calling in healthy people too. Which cutoff is right depends on what missing a case costs you.",
  },
  {
    id: "lgr-sigmoid-cosmetic",
    conceptId: "logistic-regression",
    title: "Thinks the sigmoid is only cosmetic",
    belief:
      "Fitting a straight line to 0/1 labels would work just as well, and the sigmoid only tidies up the output.",
    correction:
      "A straight line can predict values below 0 or above 1, which are not valid probabilities, and it is thrown off by extreme points. The sigmoid keeps outputs between 0 and 1 and lets the model be trained with a loss designed for probabilities.",
    example:
      "Fit a straight line to labels that are all 0s and 1s, then feed it a case far along the x axis. It happily returns 1.4, and there is no reading of 1.4 as a probability. The sigmoid cannot do that: however large the score grows, its output creeps towards 1 and never passes it.",
  },
];

export function getMisconception(id: string): Misconception | undefined {
  return misconceptions.find((m) => m.id === id);
}

export function getMisconceptionsForConcept(
  conceptId: string,
): Misconception[] {
  return misconceptions.filter((m) => m.conceptId === conceptId);
}
