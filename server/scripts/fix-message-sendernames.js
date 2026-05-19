#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dir, '../.env') });
dotenv.config({ path: path.resolve(__dir, '../../.env') });

import connectDB from '../config/db.js';
import Message from '../models/message.model.js';
import User from '../models/user.model.js';

(async function run() {
  try {
    await connectDB();
    const msgs = await Message.find({ senderName: 'Unknown', senderId: { $exists: true, $ne: null } }).lean();
    console.log('Found', msgs.length, 'messages to update');
    let updated = 0;
    for (const m of msgs) {
      try {
        const u = await User.findById(m.senderId).lean();
        if (u && (u.name || u.email)) {
          await Message.updateOne({ _id: m._id }, { $set: { senderName: u.name || u.email } });
          updated++;
        }
      } catch (e) {
        // skip
      }
    }
    console.log('Updated', updated, 'messages');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
