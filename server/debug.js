import mongoose from 'mongoose';
import Expense from './models/expense.model.js';
import User from './models/user.model.js';

mongoose.connect('mongodb://localhost:27017/splitwise');

const debug = async () => {
  try {
    const users = await User.find({}, 'name email');
    console.log('=== USERS ===');
    users.forEach(u => console.log(`${u.name} (${u.email})`));
    
    const expenses = await Expense.find({})
      .populate('paidBy', 'name email')
      .populate('createdBy', 'name email')
      .populate('participants.userId', 'name email')
      .sort({ createdAt: -1 });
    
    console.log('\n=== EXPENSES (last 5) ===');
    expenses.slice(0, 5).forEach(e => {
      console.log(`\n"${e.description}" [${e.splitType}]`);
      console.log(`  PaidBy: ${e.paidBy?.name || 'N/A'}, Amount: ${e.amount}`);
      (e.participants || []).forEach(p => {
        console.log(`    ${p.userId?.name}: status=${p.status}, amount=${p.amount}, balance=${p.balance}`);
      });
    });
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
};

debug();
