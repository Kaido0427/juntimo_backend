import mongoose from 'mongoose';

const projetSchema = new mongoose.Schema({
  titre: {
    type: String,
    required: [true, "Le titre est obligatoire"],
    maxlength: [100, "Maximum 100 caractères"]
  },
  description: {
    type: String,
    required: [true, "La description est obligatoire"]
  },
  secteur: {
    type: String,
    required: true,
    enum: ['technologie', 'agriculture', 'santé', 'éducation', 'autre'] // Exemples
  },
  bénéfices_annuels: {
    type: Number,
    min: [0, "Les bénéfices ne peuvent pas être négatifs"]
  },
  statut: {
    type: String,
    enum: ['actif', 'en pause', 'terminé', 'abandonné'],
    default: 'actif'
  }
}, 
{ timestamps: true }); // Ajoute created_at et updated_at automatiquement

export default mongoose.model('Projet', projetSchema);