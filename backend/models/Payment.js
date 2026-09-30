const mongoose = require('mongoose');

// Only safe, masked details are stored. Card numbers and CVV are NEVER saved.
const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    orderNumber: { type: String },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String, default: '' },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['card', 'upi', 'wallet', 'cash'], required: true },
    status: { type: String, enum: ['success', 'failed', 'refunded'], required: true },
    transactionId: { type: String },
    details: {
      cardBrand: String,
      cardLast4: String,
      upiId: String,
      walletName: String,
    },
    failureReason: { type: String },
    paidAt: { type: Date },
    refund: {
      refundId: String,
      amount: Number,
      reason: String,
      at: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
