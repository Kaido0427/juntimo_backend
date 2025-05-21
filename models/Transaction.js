import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  montant: {
    type: Number,
    required: [true, "Le montant est obligatoire"],
    min: [0.01, "Le montant minimum est 0.01"]
  },
  date_transaction: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['dépense', 'revenu', 'remboursement', 'don'],
    required: true
  },
  projetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Projet',
    required: [true, "L'ID du projet est obligatoire"]
  },
  participantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Participant'
  },
  description: {
    type: String,
    maxlength: [200, "Maximum 200 caractères"]
  },
  statut: {
    type: String,
    enum: ['completé', 'en_attente', 'annulé'],
    default: 'en_attente'
  },
  mode_paiement: {
    type: String,
    enum: ['carte', 'virement', 'espèces', 'autre']
  }
}, 
{ 
  timestamps: true, // createdAt et updatedAt automatiques
  toJSON: { virtuals: true } // Pour les calculs virtuels
});

// Calcul virtuel du solde (exemple)
transactionSchema.virtual('solde').get(function() {
  return this.type === 'revenu' ? this.montant : -this.montant;
});

export default mongoose.model('Transaction', transactionSchema);