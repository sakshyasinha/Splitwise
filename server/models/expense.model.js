import mongoose from 'mongoose';

const expenseSchema=new mongoose.Schema({
    description:String,
    amount:Number,
    date: {
        type: Date,
        default: () => new Date()
    },
    category: {
        type: String,
        enum: ['Food', 'Travel', 'Events', 'Utilities', 'Shopping', 'General'],
        default: 'General'
    },
    group:{type:mongoose.Schema.Types.ObjectId,ref:'Group'},
    paidBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'},
    splitType: {
        type: String,
        enum: ['equal', 'itemwise', 'percentage', 'custom'],
        default: 'equal'
    },
    splitDetails: mongoose.Schema.Types.Mixed,
    participants:[{
        userId:{type:mongoose.Schema.Types.ObjectId,ref:'User'},
        amount:Number,
        status:{
            type:String,
            enum:['pending','paid'],
            default:'pending'
        }
    }],
},{timestamps:true});

export default mongoose.model('Expense', expenseSchema);