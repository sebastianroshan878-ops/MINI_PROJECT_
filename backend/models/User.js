const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Everyone who can log in: customers and staff (the role field decides what they may do)
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    password: { type: String, required: true, minlength: [6, 'Password must be at least 6 characters'] },
    role: { type: String, enum: ['customer', 'admin', 'manager', 'waiter', 'chef', 'delivery'], default: 'customer' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Hash the password before saving (we never store plain passwords)
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
