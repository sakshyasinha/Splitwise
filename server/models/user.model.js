import mongoose from 'mongoose';

const userSchema =new mongoose.Schema({
    name:{ type:String, required:true, trim:true },
    email:{ type:String, unique:true, required:true, trim:true, lowercase:true },
    password:{ type:String },
    authProvider:{ type:String, enum:['local','google'], default:'local' },
    googleId:{ type:String, trim:true, sparse:true },
    avatarUrl:{ type:String, trim:true },
    isTemporary:{ type:Boolean, default:false } // Flag for users created via quick expense
}, { timestamps: true });

export default mongoose.model('User',userSchema);
