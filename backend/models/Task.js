const mongoose = require('mongoose');

// A job given to a staff member (e.g. "Clean the outdoor tables")
const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Task title is required'], trim: true },
    description: { type: String, default: '' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['pending', 'in-progress', 'done'], default: 'pending' },
    dueAt: { type: Date },
    completedAt: { type: Date },
    rating: { type: Number, min: 1, max: 5 }, // manager rates a finished task (used for performance)
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
