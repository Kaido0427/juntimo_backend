// models/Projet.js
const mongoose = require('mongoose');

const projetSchema = new mongoose.Schema({
  titre: {
    type: String,
    required: [true, "Le titre du projet est obligatoire"],
    trim: true
  },
  description: {
    type: String,
    required: [true, "La description est obligatoire"],
    trim: true
  },
  secteur: {
    type: String,
    required: [true, "Le secteur est obligatoire"],
    trim: true
  },
  statut: {
    type: String,
    enum: ['actif', 'terminé', 'abandonné'],
    default: 'actif'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Projet', projetSchema);
