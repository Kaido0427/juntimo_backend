const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: [true, "Le nom est obligatoire"],
    trim: true
  },
  prenom: {
    type: String,
    required: [true, "Le prénom est obligatoire"],
    trim: true
  },
  email: {
    type: String,
    unique: true,
    required: [true, "L'email est obligatoire"],
    trim: true,
    lowercase: true,
    match: [/.+@.+\..+/, "Format d'email invalide"]
  },
  mot_de_passe: {
    type: String,
    required: [true, "Le mot de passe est obligatoire"]

  },
  pays_residence: {
    type: String,
    trim: true,
    default: null
  },
  tel: {
    type: String,
    required: [true, "Numéro de téléphone requis"],
    trim: true

  },
  role: {
    type: String,
    enum: ['participant', 'admin'],
    required: [true, "Le rôle est obligatoire"],
    default: 'participant'
  }
}, {
  timestamps: true
});


module.exports = mongoose.model("User", userSchema);
