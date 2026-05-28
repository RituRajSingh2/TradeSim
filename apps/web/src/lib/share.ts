import { toBlob } from 'html-to-image';

export interface ShareOptions {
  fileName?: string;
  shareTitle?: string;
  shareText?: string;
}

/**
 * Captures an HTML element and shares it via the native Web Share API.
 * Falls back to downloading the image if the Share API is unavailable.
 * 
 * @param element The DOM element to capture
 * @param options Customization options for the share payload
 */
export async function shareElementAsImage(
  element: HTMLElement,
  options: ShareOptions = {}
): Promise<void> {
  const {
    fileName = 'tradesim-moment.png',
    shareTitle = 'My Portfolio on TradeSim',
    shareText = 'Check out my simulated portfolio on TradeSim!',
  } = options;

  try {
    // 1. Generate Blob from DOM element using html-to-image
    // We add pixel ratio scaling to ensure high-DPI quality on Retina displays.
    const blob = await toBlob(element, {
      quality: 1,
      pixelRatio: 2, 
      backgroundColor: '#0F0F13', // Matches our dark matte theme base
    });

    if (!blob) {
      throw new Error('Failed to generate image blob');
    }

    const file = new File([blob], fileName, { type: 'image/png' });

    // 2. Try native Web Share API (Safari / Android Chrome)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: shareTitle,
        text: shareText,
      });
      return;
    }

    // 3. Fallback: Download the file (Desktop Chrome / Firefox)
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);

  } catch (error) {
    console.error('Sharing failed:', error);
    throw error;
  }
}
