import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  expenseId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  senderName: { type: String, required: true },
  text: { type: String, required: true },
}, { timestamps: true });

const Message = mongoose.model('Message', MessageSchema);
export default Message;
