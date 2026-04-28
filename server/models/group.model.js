import mongoose from "mongoose";

const groupSchema=new mongoose.Schema({
    name:String,
    type: {
        type: String,
        enum: ["trip", "home", "couple", "office", "friends", "other"],
        default: "other",
    },
    members:[{type:mongoose.Schema.Types.ObjectId,ref:'User'}],
    createdBy:[{type:mongoose.Schema.Types.ObjectId,ref:'User'}],
    archived: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

export default mongoose.model('Group',groupSchema);

