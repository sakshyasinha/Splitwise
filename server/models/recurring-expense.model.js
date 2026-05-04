import mongoose from 'mongoose';

const recurringExpenseSchema = new mongoose.Schema({
  // Basic Information
  description: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 500
  },

  // Amount and Currency
  amount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    min: 0
  },

  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD', 'AED', 'CNY']
  },

  // Category
  category: {
    type: String,
    enum: ['Food', 'Travel', 'Events', 'Utilities', 'Shopping', 'General', 'Rent', 'Transport', 'Entertainment', 'Healthcare', 'Education', 'Other'],
    default: 'General'
  },

  // Group Association
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: false,
    index: true
  },

  // Created By
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Payer (who pays each time)
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Split Configuration
  splitType: {
    type: String,
    enum: ['equal', 'percentage', 'shares', 'custom'],
    required: true,
    default: 'equal'
  },

  splitDetails: {
    percentages: {
      type: Map,
      of: Number
    },
    shares: {
      type: Map,
      of: Number
    },
    customAmounts: {
      type: Map,
      of: mongoose.Schema.Types.Decimal128
    }
  },

  // Participants
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],

  // Recurrence Configuration
  recurrence: {
    type: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom'],
      required: true
    },
    interval: {
      type: Number,
      default: 1, // Every X days/weeks/months
      min: 1
    },
    dayOfWeek: {
      type: Number, // 0-6 (Sunday-Saturday)
      min: 0,
      max: 6
    },
    dayOfMonth: {
      type: Number, // 1-31
      min: 1,
      max: 31
    },
    monthOfYear: {
      type: Number, // 1-12
      min: 1,
      max: 12
    },
    customDays: [Number], // For custom recurrence patterns
    endDate: {
      type: Date,
      required: false
    },
    endAfterOccurrences: {
      type: Number,
      min: 1,
      required: false
    }
  },

  // Schedule Tracking
  nextOccurrence: {
    type: Date,
    required: true
  },

  lastOccurrence: {
    type: Date
  },

  occurrenceCount: {
    type: Number,
    default: 0
  },

  totalOccurrences: {
    type: Number,
    required: false
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  isPaused: {
    type: Boolean,
    default: false
  },

  // Generated Expenses Tracking
  generatedExpenses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expense'
  }],

  // Metadata
  notes: {
    type: String,
    maxlength: 1000,
    trim: true
  },

  // Audit Trail
  auditLog: [{
    action: {
      type: String,
      enum: ['created', 'updated', 'deleted', 'paused', 'resumed', 'occurrence_generated'],
      required: true
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    changedAt: {
      type: Date,
      default: () => new Date()
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    previousValues: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    reason: String
  }],

  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },

  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  deletedAt: Date

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
recurringExpenseSchema.index({ createdBy: 1, isActive: 1 });
recurringExpenseSchema.index({ group: 1, isActive: 1 });
recurringExpenseSchema.index({ nextOccurrence: 1, isActive: 1 });
recurringExpenseSchema.index({ isDeleted: 1 });

// Virtuals
recurringExpenseSchema.virtual('remainingOccurrences').get(function() {
  if (this.recurrence.endAfterOccurrences) {
    return this.recurrence.endAfterOccurrences - this.occurrenceCount;
  }
  if (this.recurrence.endDate) {
    return null; // Can't calculate exact remaining without complex logic
  }
  return null; // Infinite
});

// Pre-save middleware
recurringExpenseSchema.pre('save', function(next) {
  try {
    // Validate recurrence configuration
    if (this.recurrence.type === 'weekly' && this.recurrence.dayOfWeek === undefined) {
      return next(new Error('dayOfWeek is required for weekly recurrence'));
    }
    if (this.recurrence.type === 'monthly' && this.recurrence.dayOfMonth === undefined) {
      return next(new Error('dayOfMonth is required for monthly recurrence'));
    }
    if (this.recurrence.type === 'yearly' && (this.recurrence.dayOfMonth === undefined || this.recurrence.monthOfYear === undefined)) {
      return next(new Error('dayOfMonth and monthOfYear are required for yearly recurrence'));
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Static methods
recurringExpenseSchema.statics.findActive = function() {
  return this.find({
    isActive: true,
    isPaused: false,
    isDeleted: false,
    nextOccurrence: { $lte: new Date() }
  }).populate('createdBy', 'name email')
    .populate('paidBy', 'name email')
    .populate('participants.userId', 'name email')
    .populate('group', 'name');
};

recurringExpenseSchema.statics.findByUser = function(userId) {
  return this.find({
    $or: [
      { createdBy: userId },
      { paidBy: userId },
      { 'participants.userId': userId }
    ],
    isDeleted: false
  }).populate('createdBy', 'name email')
    .populate('paidBy', 'name email')
    .populate('participants.userId', 'name email')
    .populate('group', 'name')
    .sort({ createdAt: -1 });
};

// Instance methods
recurringExpenseSchema.methods.addAuditLog = function(action, changedBy, changes = {}, previousValues = {}, reason = '') {
  this.auditLog.push({
    action,
    changedBy,
    changedAt: new Date(),
    changes,
    previousValues,
    reason
  });
  return this.save();
};

recurringExpenseSchema.methods.calculateNextOccurrence = function() {
  const now = new Date();
  const next = new Date(this.nextOccurrence || now);
  const { type, interval, dayOfWeek, dayOfMonth, monthOfYear } = this.recurrence;

  switch (type) {
    case 'daily':
      next.setDate(next.getDate() + interval);
      break;
    case 'weekly':
      next.setDate(next.getDate() + (7 * interval));
      if (dayOfWeek !== undefined) {
        next.setDate(next.getDate() + (dayOfWeek - next.getDay() + 7) % 7);
      }
      break;
    case 'biweekly':
      next.setDate(next.getDate() + (14 * interval));
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + interval);
      if (dayOfMonth !== undefined) {
        next.setDate(Math.min(dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      }
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + (3 * interval));
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + interval);
      if (monthOfYear !== undefined) {
        next.setMonth(monthOfYear - 1);
      }
      if (dayOfMonth !== undefined) {
        next.setDate(Math.min(dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      }
      break;
    case 'custom':
      // For custom patterns, advance by interval days
      next.setDate(next.getDate() + interval);
      break;
    default:
      next.setDate(next.getDate() + 1);
  }

  return next;
};

recurringExpenseSchema.methods.shouldGenerateNextOccurrence = function() {
  if (!this.isActive || this.isPaused || this.isDeleted) {
    return false;
  }

  const now = new Date();
  if (this.nextOccurrence > now) {
    return false;
  }

  // Check end conditions
  if (this.recurrence.endDate && this.nextOccurrence > this.recurrence.endDate) {
    return false;
  }

  if (this.recurrence.endAfterOccurrences && this.occurrenceCount >= this.recurrence.endAfterOccurrences) {
    return false;
  }

  return true;
};

recurringExpenseSchema.methods.markOccurrenceGenerated = function(expenseId) {
  this.lastOccurrence = this.nextOccurrence;
  this.nextOccurrence = this.calculateNextOccurrence();
  this.occurrenceCount += 1;
  this.generatedExpenses.push(expenseId);

  // Check if we should deactivate
  if (this.recurrence.endDate && this.nextOccurrence > this.recurrence.endDate) {
    this.isActive = false;
  }
  if (this.recurrence.endAfterOccurrences && this.occurrenceCount >= this.recurrence.endAfterOccurrences) {
    this.isActive = false;
  }

  return this.save();
};

recurringExpenseSchema.methods.pause = function(userId, reason = '') {
  this.isPaused = true;
  return this.addAuditLog('paused', userId, { isPaused: true }, { isPaused: false }, reason);
};

recurringExpenseSchema.methods.resume = function(userId, reason = '') {
  this.isPaused = false;
  return this.addAuditLog('resumed', userId, { isPaused: false }, { isPaused: true }, reason);
};

recurringExpenseSchema.methods.softDelete = function(deletedBy, reason = '') {
  this.isDeleted = true;
  this.deletedBy = deletedBy;
  this.deletedAt = new Date();
  this.isActive = false;
  return this.addAuditLog('deleted', deletedBy, {}, { isDeleted: false }, reason);
};

export default mongoose.model('RecurringExpense', recurringExpenseSchema);