import { extractReceiptText } from "../services/ocr.service.js";
import { parseReceipt } from "../utils/receiptParser.js";

export const scanReceipt = async (req, res) => {
  try {
    const text = await extractReceiptText(req.file.path);

    const data = parseReceipt(text);

    res.json({
      success: true,
      rawText: text,
      extracted: data,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};