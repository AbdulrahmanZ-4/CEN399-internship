clc;
clear;
close all;

% =================================
% Task 1b: Clean Noisy Drawing
% =================================

% Read noisy image from Task 1a
img = imread('drawing1_noisy.png');

% Convert to grayscale if needed
if size(img, 3) == 3
    gray = rgb2gray(img);
else
    gray = img;
end

% Convert to double
I = im2double(gray);

% -------------------------------------------------
% Step 1: Median Filtering
% Removes salt and pepper noise while preserving edges
% -------------------------------------------------
I_median = medfilt2(I, [3 3]);

% -------------------------------------------------
% Step 2: Wiener Filtering
% Reduces Gaussian noise and smooths small variations
% -------------------------------------------------
I_wiener = wiener2(I_median, [5 5]);

% -------------------------------------------------
% Step 3: Background Correction
% Removes uneven illumination / scanning shadow
% -------------------------------------------------
se = strel('disk', 35);
background = imclose(I_wiener, se);

I_corrected = I_wiener ./ (background + eps);
I_corrected = mat2gray(I_corrected);

% -------------------------------------------------
% Step 4: Contrast Enhancement
% Makes lines and text clearer
% -------------------------------------------------
I_contrast = imadjust(I_corrected);

% -------------------------------------------------
% Step 5: Sharpening
% Enhances walls, lines, and text boundaries
% -------------------------------------------------
I_sharp = imsharpen(I_contrast, ...
    'Radius', 1, ...
    'Amount', 1.2);

% -------------------------------------------------
% Step 6: Adaptive Thresholding
% Converts image to clean black and white drawing
% -------------------------------------------------
BW = imbinarize(I_sharp, 'adaptive', ...
    'ForegroundPolarity', 'dark', ...
    'Sensitivity', 0.45);

% Invert so drawing lines become black on white
clean_binary = ~BW;

% -------------------------------------------------
% Step 7: Morphological Cleaning
% Removes tiny unwanted dots
% -------------------------------------------------
clean_binary = bwareaopen(clean_binary, 20);

% Make final image black lines on white background
final_clean = ~clean_binary;

% Save cleaned image
imwrite(final_clean, 'drawing1_cleaned.png');

% Display all steps
figure;

subplot(2,3,1);
imshow(I);
title('Noisy Image');

subplot(2,3,2);
imshow(I_median);
title('Median Filter');

subplot(2,3,3);
imshow(I_wiener);
title('Wiener Filter');

subplot(2,3,4);
imshow(I_corrected);
title('Background Corrected');

subplot(2,3,5);
imshow(I_sharp);
title('Sharpened');

subplot(2,3,6);
imshow(final_clean);
title('Final Cleaned Drawing');

disp('Task 1b completed: Cleaned image saved as drawing1_cleaned.png');