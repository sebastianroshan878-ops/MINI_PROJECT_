const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String, default: '' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    orderNumber: { type: String, default: '' },
    type: { type: String, enum: ['order', 'general'], default: 'general' },
    rating: { type: Number, required: [true, 'Please choose a rating'], min: 1, max: 5 },
    comment: { type: String, default: '', maxlength: 500 },
    reply: { type: String, default: '' },
    repliedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Feedback', feedbackSchema);
