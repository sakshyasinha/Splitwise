import express from "express";
import multer from "multer";

import { scanReceipt } from "../controllers/receipt.controller.js";

const router = express.Router();

const upload = multer({
  dest: "uploads/",
});

router.post(
  "/scan",
  upload.single("receipt"),
  scanReceipt
);

export default router;