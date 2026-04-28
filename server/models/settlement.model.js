import mongoose from 'mongoose';

const settlementSchema = new mongoose.Schema({
    expenseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Expense',
        required: true
    },
    from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    description: String,
    settlementProof: String,
    settledAt: {
        type: Date,
        default: () => new Date()
    }
}, { timestamps: true });

export default mongoose.model('Settlement', settlementSchema);
