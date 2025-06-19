// models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  montant: {
    type: Number,
    required: [true, "Le montant est obligatoire"],
  },
  date_transaction: {
    type: Date,
    default: Date.now
  },
  groupeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Groupe',
    required: [true, "L'ID du groupe  est obligatoire"]
  },
  participantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  statut: {
    type: String,
    required: false
  }
},
  {
    timestamps: true,
  });


module.exports = mongoose.model('Transaction', transactionSchema);
