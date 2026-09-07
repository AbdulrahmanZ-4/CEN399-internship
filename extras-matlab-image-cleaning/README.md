# Extra — MATLAB Scanned-Drawing Cleaning

A smaller exercise, outside the seven main activities, in restoring a scanned
drawing degraded by noise.

- `task1a_add_noise.m` — adds controlled noise to a clean drawing, to give a known
  ground truth to measure against.
- `task1b_clean_drawing.m` — filters the noise back out and compares the result with
  the original.

This is where the image-processing intuition behind Activity 1's preprocessing came
from: knowing which artefacts a filter can remove, and which it cannot.

## Running it

Open either file in MATLAB and run it. Sample drawings are not committed.
