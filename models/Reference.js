import mongoose from 'mongoose';

const referenceSchema = new mongoose.Schema({
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    title: { type: String, required: true },
    keywords: [String],
    memo: String,
    resources: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
});

const Reference = mongoose.model('Reference', referenceSchema);

export default Reference;
