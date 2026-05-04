import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  // Basic Information
  description: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 500
  },

  // Currency Handling - Use Decimal.js precision
  amount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    min: 0
  },

  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD', 'AED', 'CNY'],
    required: false // Made optional for backward compatibility
  },

  // Date and Time
  date: {
    type: Date,
    default: () => new Date(),
    required: true
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
    required: false, // Made optional to support quick expenses without groups
    index: true
  },

  // Legacy field for backward compatibility
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Made optional for backward compatibility
  },

  // Created By
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Made optional for backward compatibility
  },

  // MULTI-PAYER SUPPORT - Multiple people can contribute
  payers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0
    },
    paidAt: {
      type: Date,
      default: () => new Date()
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'bank_transfer', 'other'],
      default: 'cash'
    }
  }],

  // ADVANCED SPLIT TYPES
  splitType: {
    type: String,
    enum: ['equal', 'percentage', 'shares', 'itemized', 'adjustment', 'custom', 'payment'],
    required: true,
    default: 'equal'
  },

  // Split Details - Structure varies by splitType
  splitDetails: {
    // For 'equal' split: no details needed (auto-calculated)

    // For 'percentage' split:
    percentages: {
      type: Map,
      of: Number, // userId -> percentage (0-100)
      validate: {
        validator: function(v) {
          if (this.splitType !== 'percentage') return true;
          const total = Array.from(v.values()).reduce((sum, val) => sum + val, 0);
          return Math.abs(total - 100) < 0.01; // Allow small floating point errors
        },
        message: 'Percentages must sum to 100%'
      }
    },

    // For 'shares' split:
    shares: {
      type: Map,
      of: Number, // userId -> share count (positive integers)
      validate: {
        validator: function(v) {
          if (this.splitType !== 'shares') return true;
          return Array.from(v.values()).every(val => val > 0 && Number.isInteger(val));
        },
        message: 'Shares must be positive integers'
      }
    },

    // For 'itemized' split:
    items: [{
      name: String,
      amount: mongoose.Schema.Types.Decimal128,
      assignedTo: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }]
    }],

    // For 'adjustment' split:
    adjustments: {
      type: Map,
      of: mongoose.Schema.Types.Decimal128, // userId -> adjustment amount
      validate: {
        validator: function(v) {
          if (this.splitType !== 'adjustment') return true;
          const total = Array.from(v.values())
            .reduce((sum, val) => sum + Number(val), 0);
          return Math.abs(total - Number(this.amount)) < 0.01;
        },
        message: 'Adjustments must sum to total amount'
      }
    },

    // For 'custom' split:
    customAmounts: {
      type: Map,
      of: mongoose.Schema.Types.Decimal128, // userId -> exact amount
      validate: {
        validator: function(v) {
          if (this.splitType !== 'custom') return true;
          const total = Array.from(v.values())
            .reduce((sum, val) => sum + Number(val), 0);
          return Math.abs(total - Number(this.amount)) < 0.01;
        },
        message: 'Custom amounts must sum to total amount'
      }
    }
  },

  // Participants - Who is involved in this expense
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    // Calculated share based on splitType
    shareAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: false, // Made optional for backward compatibility
      default: undefined, // Will be set during expense creation
      min: 0
    },
    // How much this participant has paid (from payers array)
    paidAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      min: 0
    },
    // Balance: paidAmount - shareAmount (positive = overpaid, negative = owes)
    balance: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0
    },
    // Payment status
    status: {
      type: String,
      enum: ['pending', 'partial', 'settled'],
      default: 'pending'
    },
    // Last settlement timestamp
    settledAt: Date
  }],

  // Metadata
  notes: {
    type: String,
    maxlength: 1000,
    trim: true
  },

  receiptUrl: String,
  images: [String],
  tags: [String],

  // Location data
  location: {
    name: String,
    address: String,
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    }
  },

  // AUDIT TRAIL - Track all changes
  auditLog: [{
    action: {
      type: String,
      enum: ['created', 'updated', 'deleted', 'settled', 'split_changed', 'payer_added', 'payer_removed'],
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

  // Soft delete support
  isDeleted: {
    type: Boolean,
    default: false
  },

  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  deletedAt: Date,

  // Settlement tracking
  isSettled: {
    type: Boolean,
    default: false
  },

  settledAt: Date,

  // Computed fields (for performance)
  totalPayers: {
    type: Number,
    default: 0
  },

  totalParticipants: {
    type: Number,
    default: 0
  },

  // Indexes for performance
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
expenseSchema.index({ group: 1, date: -1 });
expenseSchema.index({ createdBy: 1, date: -1 });
expenseSchema.index({ 'payers.userId': 1 });
expenseSchema.index({ 'participants.userId': 1 });
expenseSchema.index({ isDeleted: 1, date: -1 });
expenseSchema.index({ splitType: 1 });

// Virtuals
expenseSchema.virtual('totalPaid').get(function() {
  if (!this.payers || !Array.isArray(this.payers)) return 0;
  return this.payers.reduce((sum, payer) => {
    const payerAmount = payer.amount ? Number(payer.amount) : 0;
    return sum + payerAmount;
  }, 0);
});

expenseSchema.virtual('totalOwed').get(function() {
  if (!this.participants || !Array.isArray(this.participants)) return 0;
  return this.participants.reduce((sum, participant) => {
    const shareAmount = participant.shareAmount ? Number(participant.shareAmount) : 0;
    return sum + shareAmount;
  }, 0);
});

// Pre-save middleware to validate and compute derived fields
expenseSchema.pre('save', function(next) {
  try {
    // Validate total payers amount equals expense amount (only if payers exist)
    if (this.payers && Array.isArray(this.payers) && this.payers.length > 0) {
      const totalPaid = this.payers.reduce((sum, payer) => {
        const payerAmount = payer.amount ? Number(payer.amount) : 0;
        return sum + payerAmount;
      }, 0);

      const expenseAmount = this.amount ? Number(this.amount) : 0;

      if (expenseAmount > 0 && Math.abs(totalPaid - expenseAmount) > 0.01) {
        return next(new Error('Total payer amounts must equal expense amount'));
      }
    }

    // Update computed fields (with defensive checks)
    this.totalPayers = (this.payers && Array.isArray(this.payers)) ? this.payers.length : 0;
    this.totalParticipants = (this.participants && Array.isArray(this.participants)) ? this.participants.length : 0;

    next();
  } catch (error) {
    next(error);
  }
});

// Static methods
expenseSchema.statics.findByUser = function(userId, options = {}) {
  return this.find({
    $or: [
      { 'payers.userId': userId },
      { 'participants.userId': userId }
    ],
    isDeleted: false,
    ...options
  }).populate('payers.userId', 'name email avatar')
    .populate('participants.userId', 'name email avatar')
    .populate('createdBy', 'name email avatar')
    .sort({ date: -1 });
};

expenseSchema.statics.findByGroup = function(groupId, options = {}) {
  return this.find({
    group: groupId,
    isDeleted: false,
    ...options
  }).populate('payers.userId', 'name email avatar')
    .populate('participants.userId', 'name email avatar')
    .populate('createdBy', 'name email avatar')
    .sort({ date: -1 });
};

// Instance methods
expenseSchema.methods.addAuditLog = function(action, changedBy, changes = {}, previousValues = {}, reason = '') {
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

expenseSchema.methods.calculateShares = function() {
  // This will be implemented in the service layer
  // Schema just defines the structure
  throw new Error('Use ExpenseService.calculateShares() instead');
};

expenseSchema.methods.getBalanceForUser = function(userId) {
  if (!this.participants || !Array.isArray(this.participants)) return 0;
  const participant = this.participants.find(p => {
    const participantId = p.userId ? p.userId.toString() : '';
    return participantId === userId.toString();
  });
  if (!participant) return 0;
  return participant.balance ? Number(participant.balance) : 0;
};

expenseSchema.methods.softDelete = function(deletedBy, reason = '') {
  this.isDeleted = true;
  this.deletedBy = deletedBy;
  this.deletedAt = new Date();
  return this.addAuditLog('deleted', deletedBy, {}, { isDeleted: false }, reason);
};

export default mongoose.model('Expense', expenseSchema);
