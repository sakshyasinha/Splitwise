import mongoose from 'mongoose';

const userSchema =new mongoose.Schema({
    name:{ type:String, required:true, trim:true },
    email:{ type:String, unique:true, required:true, trim:true, lowercase:true },
    password:{ type:String, required:true },
}, { timestamps: true });

export default mongoose.model('User',userSchema);