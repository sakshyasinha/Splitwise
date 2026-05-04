import mongoose from 'mongoose';

const userSchema =new mongoose.Schema({
    name:{ type:String, required:true, trim:true },
    email:{ type:String, unique:true, required:true, trim:true, lowercase:true },
    password:{ type:String, required:true },
    isTemporary:{ type:Boolean, default:false } // Flag for users created via quick expense
}, { timestamps: true });

export default mongoose.model('User',userSchema);