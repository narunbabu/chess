// Image utility functions for canvas-based image conversion and loading
// Used by game completion components for share functionality

/**
 * Wait for all images within an element to fully load
 * @param {HTMLElement} element - DOM element containing images
 * @returns {Promise<void>}
 */
export const waitForImagesToLoad = async (element) => {
  console.log('⏳ Waiting for all images to load...');

  const images = Array.from(element.querySelectorAll('img'));
  console.log(`📸 Found ${images.length} images to check`);

  const imageLoadPromises = images.map((img, index) => {
    return new Promise((resolve) => {
      // Check if image is already loaded
      if (img.complete && img.naturalHeight > 0) {
        console.log(`✅ Image ${index + 1} already loaded`);
        resolve();
      } else {
        console.log(`⏳ Waiting for image ${index + 1} to load...`);

        // Wait for image to load
        img.onload = () => {
          console.log(`✅ Image ${index + 1} loaded successfully`);
          resolve();
        };

        // Handle errors - resolve anyway to not block the process
        img.onerror = () => {
          console.warn(`⚠️ Image ${index + 1} failed to load, continuing anyway`);
          resolve();
        };

        // Timeout after 5 seconds to prevent indefinite waiting
        setTimeout(() => {
          console.warn(`⏱️ Timeout waiting for image ${index + 1}, continuing anyway`);
          resolve();
        }, 5000);
      }
    });
  });

  await Promise.all(imageLoadPromises);
  console.log('✅ All images loaded (or timed out)');
};

/**
 * Load an image and convert it to data URL using canvas
 * More reliable than fetch for handling CORS issues
 * @param {string} src - Image source URL
 * @returns {Promise<string>} Data URL of the image
 */
export const loadImageToDataURL = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Use CORS for cross-origin images
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataURL);
        } else {
          reject(new Error('Failed to get canvas context'));
        }
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => {
      reject(new Error(`Failed to load image: ${src}`));
    };
    img.src = src;
  });
};

/**
 * Helper function to escape special regex characters
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
export const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Convert all images within an element to data URLs
 * Handles both <img> tags and CSS background-image properties
 * @param {HTMLElement} element - DOM element to process
 * @returns {Promise<void>}
 */
export const convertImagesToDataURLs = async (element) => {
  console.log('🔄 Converting images to data URLs...');

  // Handle <img> tags
  const images = Array.from(element.querySelectorAll('img'));
  console.log(`📸 Found ${images.length} <img> tags to convert`);

  await Promise.all(
    images.map(async (img, index) => {
      // Don't re-convert if it's already a data URL
      if (img.src.startsWith('data:')) {
        console.log(`✅ Image ${index + 1} already a data URL`);
        return;
      }

      try {
        console.log(`🔄 Converting image ${index + 1}: ${img.src.substring(0, 50)}...`);
        const dataUrl = await loadImageToDataURL(img.src);
        img.src = dataUrl;
        console.log(`✅ Image ${index + 1} converted successfully`);
      } catch (error) {
        console.error(`❌ Could not convert image ${index + 1} (${img.src}) to data URL:`, error);
        // We continue even if one image fails, so the capture process doesn't halt.
      }
    })
  );

  // Handle CSS background-image properties (for logo, etc.)
  const allElements = Array.from(element.querySelectorAll('*'));
  allElements.push(element); // Include the root element itself

  let bgImageCount = 0;
  await Promise.all(
    allElements.map(async (el, elIndex) => {
      const bgImage = window.getComputedStyle(el).backgroundImage;

      // Check if there's a background-image and it's a URL (not 'none' or gradient)
      if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
        bgImageCount++;
        // Extract URL from background-image (handles multiple backgrounds)
        const urlMatches = bgImage.match(/url\(["']?([^"')]+)["']?\)/g);

        if (urlMatches) {
          for (const urlMatch of urlMatches) {
            const url = urlMatch.match(/url\(["']?([^"')]+)["']?\)/)[1];

            // Skip if already a data URL
            if (url.startsWith('data:')) {
              console.log(`✅ Background image already a data URL on element ${elIndex}`);
              continue;
            }

            try {
              console.log(`🔄 Converting background image: ${url.substring(0, 50)}...`);
              const dataUrl = await loadImageToDataURL(url);

              // Replace the URL in the background-image with the data URL
              const newBgImage = bgImage.replace(new RegExp(escapeRegExp(url), 'g'), dataUrl);
              el.style.backgroundImage = newBgImage;
              console.log(`✅ Background image converted successfully on element ${elIndex}`);
            } catch (error) {
              console.error(`❌ Could not convert background image ${url} to data URL on element ${elIndex}:`, error);
              // We continue even if one image fails
            }
          }
        }
      }
    })
  );

  console.log(`✅ Image conversion complete. Found ${bgImageCount} background images.`);
};
