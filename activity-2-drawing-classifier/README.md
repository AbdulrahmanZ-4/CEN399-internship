# Activity 2 — Drawing-Type Classifier

Classifies an architectural drawing as a floor plan, elevation, section or site plan.

## How it works

`train_classifier_colab.py` uses transfer learning. The convolutional base of MobileNetV2,
pre-trained on ImageNet, is frozen and a small classification head is trained on top
of it for fifteen epochs. Training a network of that depth from scratch was not
realistic on the dataset available.

`predict_drawing_colab.py` loads the saved model and reports the predicted class along
with the probability assigned to each of the four classes.

## Result, and its limit

Final training accuracy reached 100% and validation accuracy about 95%. On an
unseen floor plan the model predicted correctly with 95.6% confidence.

**That figure is not a measure of general accuracy.** No held-out test set was
built, so validation accuracy is the number training was tuned against rather than
an unbiased estimate, and one confident prediction on one image establishes nothing.
This is recorded as a failed test case in the report, not as a success.

The fix is a larger, better-balanced dataset with a portion held back untouched,
reported as a confusion matrix.

## Running it

Both files are **Google Colab notebooks exported as `.py`**, which is where the
training was actually run — the free GPU made fifteen epochs practical. They mount
Google Drive for the dataset and the saved model, and the prediction script uses
the `!pip` cell magic, so neither is a plain Python module and neither will run
under `python file.py` unchanged.

To use them, open a new Colab notebook, paste the file in, and adjust the three
Drive paths at the top:

```python
DATASET_PATH = "/content/drive/MyDrive/drawings_dataset"
MODEL_PATH   = "/content/drive/MyDrive/drawing_classifier_model.keras"
LABELS_PATH  = "/content/drive/MyDrive/drawing_labels.txt"
```

The dataset is one folder per class: `floor_plan`, `elevation`, `section`,
`site_plan`. Neither the dataset nor the trained weights are committed.
