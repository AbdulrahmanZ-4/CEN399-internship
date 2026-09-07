# ================================
# AI DRAWING CLASSIFIER - PREDICT ONE FILE
# Google Colab Full Code
# ================================

from google.colab import drive
drive.mount('/content/drive')

!pip install pymupdf -q

import os
import fitz
import numpy as np
import tensorflow as tf
from google.colab import files
from tensorflow.keras.preprocessing import image

# ================================
# Paths
# ================================

MODEL_PATH = "/content/drive/MyDrive/drawing_classifier_model.keras"
LABELS_PATH = "/content/drive/MyDrive/drawing_labels.txt"

IMG_SIZE = 224

# ================================
# Load model and labels
# ================================

model = tf.keras.models.load_model(MODEL_PATH)

with open(LABELS_PATH, "r") as f:
    labels = [line.strip() for line in f.readlines()]

print("Labels:", labels)

# ================================
# Upload file
# ================================

uploaded = files.upload()

file_name = list(uploaded.keys())[0]
print("\nUploaded file:", file_name)

# ================================
# If PDF, convert first page to image
# ================================

if file_name.lower().endswith(".pdf"):
    pdf_document = fitz.open(file_name)
    page = pdf_document[0]
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
    image_path = "uploaded_pdf_page.png"
    pix.save(image_path)
    pdf_document.close()
else:
    image_path = file_name

# ================================
# Load image and predict
# ================================

img = image.load_img(image_path, target_size=(IMG_SIZE, IMG_SIZE))
img_array = image.img_to_array(img)
img_array = np.expand_dims(img_array, axis=0)

prediction = model.predict(img_array)[0]

predicted_index = np.argmax(prediction)
predicted_label = labels[predicted_index]
confidence = prediction[predicted_index] * 100

print("\n==============================")
print("Prediction Result")
print("==============================")
print("Predicted drawing type:", predicted_label)
print("Confidence:", round(confidence, 2), "%")

print("\nAll probabilities:")
for i in range(len(labels)):
    print(labels[i], ":", round(prediction[i] * 100, 2), "%")