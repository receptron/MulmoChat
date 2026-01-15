/* global FileReader */
/**
 * Utility function for loading blank image for aspect ratio reference
 */

// Convert URL to base64 (without data URL prefix)
async function urlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove "data:image/png;base64," prefix
      const base64Data = base64.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Load blank.png and convert to base64 (without data URL prefix)
export async function loadBlankImageBase64(): Promise<string> {
  return urlToBase64("/blank.png");
}
