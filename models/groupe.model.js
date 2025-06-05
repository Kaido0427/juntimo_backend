const mongoose = require('mongoose');

const groupeSchema = new mongoose.Schema({
  projetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Projet',
    required: [true, "Le Projet associé est obligatoire"]
  },

  participantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, "Le participant est obligatoire"]
  },

  statut: {
    type: String,
    enum: ['actif', 'inactif'],
    default: 'actif'
  }

}, {
  timestamps: true
});

module.exports = mongoose.model('Groupe', groupeSchema);
