const mongoose = require('mongoose');

const beneficeAnnuelSchema = new mongoose.Schema({
  annee: {
    type: Number,
    required: true
  },
  montant: {
    type: Number,
    required: true
  }
}, { _id: false });

const projetSchema = new mongoose.Schema({
  titre: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  secteur: {
    type: String,
    required: true,
    trim: true
  },
  statut: {
    type: String,
    enum: ['actif', 'terminé', 'abandonné'],
    default: 'actif'
  },

  // ✅ CONDITIONS DE FINANCEMENT
  prefinancementPersonnel: {
    type: Number,
    default: 0
  },
  mensualite: {
    type: Number,
    required: true,
    min: 0
  },
  mensualiteTotaleAPayer: {
    type: Number,
    required: true,
    min: 0
  },
  commissionImmoInvest: {
    type: Number,
    default: 0.01,
    min: 0
  },
  penalite: {
    type: Number,
    default: 0.25,
    min: 0
  },
  dateDebut: {
    type: Date,
    required: true
  },
  duree: {
    type: Number,
    required: true,
    min: 1
  },

  beneficesAnnuels: {
    type: [beneficeAnnuelSchema],
    default: []
  },

  totalBeneficesRecus: {
    type: Number,
    default: 0,
    min: 0
  }

}, {
  timestamps: true
});

module.exports = mongoose.model('Projet', projetSchema);
