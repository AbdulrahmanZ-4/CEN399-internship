clc;
clear;
close all;

% ==============================
% Task 1a: Add Noise to Drawing
% ==============================

% Read original architectural drawing
img = imread('drawing1.png');

% Convert to grayscale if image is RGB
if size(img, 3) == 3
    gray = rgb2gray(img);
else
    gray = img;
end

% Convert to double for processing
gray_double = im2double(gray);

% -------------------------------------------------
% 1. Add Gaussian noise
% This simulates scanner sensor noise
% -------------------------------------------------
gaussian_noisy = imnoise(gray_double, 'gaussian', 0, 0.0015);

% -------------------------------------------------
% 2. Add salt and pepper noise
% This simulates black/white scanning dots
% -------------------------------------------------
sp_noisy = imnoise(gaussian_noisy, 'salt & pepper', 0.015);

% -------------------------------------------------
% 3. Add uneven illumination / scanning shadow
% This simulates non-uniform scanner brightness
% -------------------------------------------------
[rows, cols] = size(sp_noisy);
[x, y] = meshgrid(1:cols, 1:rows);

shadow = 0.15 * mat2gray(x + y);    % diagonal light variation
shadowed_img = sp_noisy - shadow;

% Keep pixel values between 0 and 1
noisy_img = mat2gray(shadowed_img);

% Save noisy image
imwrite(noisy_img, 'drawing1_noisy.png');

% Display results
figure;

subplot(1,2,1);
imshow(gray);
title('Original Drawing');

subplot(1,2,2);
imshow(noisy_img);
title('Noisy Scanned Drawing');

disp('Task 1a completed: Noisy image saved as drawing1_noisy.png');