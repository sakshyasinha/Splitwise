import tesseract from 'tesseract.js';

export const extractTextFromImage = async (imageBuffer) => {
  const { data: { text } } = await tesseract.recognize(imageBuffer, 'eng');
  return text;
};