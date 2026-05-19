import Message from '../models/message.model.js';
import User from '../models/user.model.js';

export const getMessagesForExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    if (!expenseId) return res.status(400).json({ message: 'Missing expenseId' });
    const messages = await Message.find({ expenseId }).sort({ createdAt: 1 }).lean();
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to fetch messages' });
  }
};

export const postMessageForExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { text } = req.body;
    if (!expenseId || !text) return res.status(400).json({ message: 'Missing fields' });

    // Resolve sender name from token payload; token currently stores only id
    let senderId = req.user?._id || req.user?.id || null;
    let senderName = 'Unknown';
    if (senderId) {
      // attempt to fetch user record for name/email
      try {
        const u = await User.findById(senderId).lean();
        if (u) senderName = u.name || u.email || 'Unknown';
      } catch (err) {
        // ignore and fall back to token fields
        senderName = req.user?.name || req.user?.email || 'Unknown';
      }
    }

    const message = await Message.create({
      expenseId,
      senderId,
      senderName,
      text,
    });

    // Broadcast new message via Socket.IO
    const io = req.app?.locals?.io;
    if (io) {
      io.of('/messages').to(`expense:${expenseId}`).emit('message-received', {
        _id: message._id,
        expenseId: message.expenseId,
        senderId: message.senderId,
        senderName: message.senderName,
        text: message.text,
        createdAt: message.createdAt,
      });
    }

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to save message' });
  }
};
