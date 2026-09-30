const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    name: String,
    emoji: String,
    category: String,
    price: Number, // price of one portion including add-ons
    quantity: Number,
    addOns: [{ name: String, price: Number, _id: false }],
    spiceLevel: String,
    note: String,
    lineTotal: Number,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String, default: 'Walk-in Guest' },
    customerPhone: { type: String, default: '' },
    type: { type: String, enum: ['dine-in', 'parcel', 'delivery'], required: true },
    table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table' },
    reservation: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation' },
    items: [orderItemSchema],

    // Bill amounts (calculated by the server)
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    deliveryCharge: { type: Number, default: 0 },
    total: { type: Number, required: true },

    status: {
      type: String,
      enum: ['placed', 'confirmed', 'preparing', 'ready', 'out-for-delivery', 'completed', 'cancelled'],
      default: 'placed',
    },
    statusHistory: [{ status: String, at: Date, _id: false }],

    deliveryAddress: { type: String, default: '' },
    scheduledFor: { type: Date, default: null }, // delivery / pickup scheduling
    expectedBy: { type: Date }, // used for on-time tracking
    completedAt: { type: Date },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // delivery person
    notes: { type: String, default: '' },

    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },

    pointsEarned: { type: Number, default: 0 },
    pointsRedeemed: { type: Number, default: 0 },
    rewardsReversed: { type: Boolean, default: false },

    cancelReason: { type: String, default: '' },
    cancelledBy: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
