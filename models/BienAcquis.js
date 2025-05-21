import mongoose from 'mongoose';

const bienAcquisSchema = new mongoose.Schema({
  projetId: { // Clé étrangère
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Projet', // Référence au modèle Projet
    required: [true, "L'ID du projet est obligatoire"]
  },
  description_bien: {
    type: String,
    required: [true, "La description est obligatoire"],
    maxlength: [500, "Maximum 500 caractères"]
  },
  valeur_bien: {
    type: Number,
    required: [true, "La valeur est obligatoire"],
    min: [0, "La valeur ne peut pas être négative"]
  },
  statut_distribution: {
    type: String,
    enum: ['distribué', 'en_stock', 'en_attente'], // Valeurs autorisées
    default: 'en_stock' // Statut par défaut
  }
}, 
{ timestamps: true }); // Ajoute createdAt et updatedAt automatiquement

export default mongoose.model('BienAcquis', bienAcquisSchema);