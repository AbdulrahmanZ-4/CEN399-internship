# ================================
# AI DRAWING CLASSIFIER - TRAINING
# Google Colab Full Code
# ================================

from google.colab import drive
drive.mount('/content/drive')

import os
import numpy as np
import tensorflow as tf
import matplotlib.pyplot as plt

# ================================
# Paths
# ================================

DATASET_PATH = "/content/drive/MyDrive/drawings_dataset"
MODEL_PATH = "/content/drive/MyDrive/drawing_classifier_model.keras"
LABELS_PATH = "/content/drive/MyDrive/drawing_labels.txt"

IMG_SIZE = 224
BATCH_SIZE = 16
EPOCHS = 15

print("Dataset path:", DATASET_PATH)

# ================================
# Check folders and images
# ================================

allowed_extensions = (".jpg", ".jpeg", ".png")

labels = []

print("\nChecking dataset folders...\n")

for folder_name in sorted(os.listdir(DATASET_PATH)):
    folder_path = os.path.join(DATASET_PATH, folder_name)

    if os.path.isdir(folder_path):
        images = [
            f for f in os.listdir(folder_path)
            if f.lower().endswith(allowed_extensions)
        ]

        labels.append(folder_name)
        print(folder_name, ":", len(images), "images")

print("\nLabels found:", labels)

if len(labels) < 2:
    raise Exception("You need at least 2 folders/classes in the dataset.")

# ================================
# Load dataset
# ================================

train_data = tf.keras.utils.image_dataset_from_directory(
    DATASET_PATH,
    validation_split=0.2,
    subset="training",
    seed=42,
    image_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE
)

val_data = tf.keras.utils.image_dataset_from_directory(
    DATASET_PATH,
    validation_split=0.2,
    subset="validation",
    seed=42,
    image_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE
)

labels = train_data.class_names

print("\nFinal labels:", labels)

# ================================
# Improve performance
# ================================

AUTOTUNE = tf.data.AUTOTUNE

train_data = train_data.cache().shuffle(1000).prefetch(buffer_size=AUTOTUNE)
val_data = val_data.cache().prefetch(buffer_size=AUTOTUNE)

# ================================
# Build model
# ================================

base_model = tf.keras.applications.MobileNetV2(
    input_shape=(IMG_SIZE, IMG_SIZE, 3),
    include_top=False,
    weights="imagenet"
)

base_model.trainable = False

model = tf.keras.Sequential([
    tf.keras.layers.RandomRotation(0.03),
    tf.keras.layers.RandomZoom(0.10),
    tf.keras.layers.RandomContrast(0.20),

    tf.keras.layers.Rescaling(1./127.5, offset=-1),

    base_model,

    tf.keras.layers.GlobalAveragePooling2D(),
    tf.keras.layers.Dropout(0.30),
    tf.keras.layers.Dense(len(labels), activation="softmax")
])

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"]
)

model.summary()

# ================================
# Train model
# ================================

history = model.fit(
    train_data,
    validation_data=val_data,
    epochs=EPOCHS
)

# ================================
# Plot accuracy
# ================================

plt.figure(figsize=(8, 5))
plt.plot(history.history["accuracy"], label="Training Accuracy")
plt.plot(history.history["val_accuracy"], label="Validation Accuracy")
plt.xlabel("Epoch")
plt.ylabel("Accuracy")
plt.title("Training vs Validation Accuracy")
plt.legend()
plt.grid()
plt.show()

# ================================
# Plot loss
# ================================

plt.figure(figsize=(8, 5))
plt.plot(history.history["loss"], label="Training Loss")
plt.plot(history.history["val_loss"], label="Validation Loss")
plt.xlabel("Epoch")
plt.ylabel("Loss")
plt.title("Training vs Validation Loss")
plt.legend()
plt.grid()
plt.show()

# ================================
# Save model and labels
# ================================

model.save(MODEL_PATH)

with open(LABELS_PATH, "w") as f:
    for label in labels:
        f.write(label + "\n")

print("\nTraining finished.")
print("Model saved to:", MODEL_PATH)
print("Labels saved to:", LABELS_PATH)