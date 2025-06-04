// models/Bien.js
const mongoose = require('mongoose');


const preuveSchema = new mongoose.Schema({
  libelle: {
    type: String,
    required: [true, "Le libellé de la preuve est obligatoire"],
    trim: true
  },
  document: {
    type: String,
    required: false,
    trim: true
  
  }
}, { _id: false });

const bienSchema = new mongoose.Schema({
  libelle: {
    type: String,
    required: [true, "Le libellé du bien est obligatoire"],
    trim: true
  },
  description: {
    type: String,
    required: [true, "La description du bien est obligatoire"],
    trim: true
  },
  type_bien: {
    type: String,
    required: [true, "Le type de bien est obligatoire"],
    trim: true
 
  },
  proprietaire: {
    nom: {
      type: String,
      required: [true, "Le nom du propriétaire est obligatoire"],
      trim: true
    },
    prenom: {
      type: String,
      required: [true, "Le prénom du propriétaire est obligatoire"],
      trim: true
    },
    telephone: {
      type: String,
      required: [true, "Le téléphone du propriétaire est obligatoire"],
      trim: true
    },
    document: {
      type: String,
      required: false,
      trim: true
   
    }
  },

  preuves: {
    type: [preuveSchema],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Bien', bienSchema);
