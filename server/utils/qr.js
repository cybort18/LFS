import QRCode from 'qrcode';

/**
 * Generates a QR Code as a Data URL (image/png) for rendering in web browsers.
 * @param {string} text URL or text to encode
 * @returns {Promise<string>} Base64 Data URL string
 */
export async function generateQrDataUrl(text) {
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 8,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
    return dataUrl;
  } catch (err) {
    console.error('Error generating QR Data URL:', err);
    throw err;
  }
}
