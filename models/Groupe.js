import mongoose from 'mongoose';

const groupeSchema = new mongoose.Schema({
  projetId: {
    type: mongoose.Schema.Types.ObjectId, // Clé étrangère
    ref: 'Projet', // Référence au modèle Projet
    required: [true, "L'ID du projet est obligatoire"]
  },
  nombre_participants: {
    type: Number,
    required: [true, "Le nombre de participants est obligatoire"],
    min: [0, "Le nombre ne peut pas être négatif"]
  },
  statut: {
    type: String,
    enum: ['actif', 'inactif', 'archivé'], // Valeurs autorisées
    default: 'actif' // Statut par défaut
  }
}, 
{ timestamps: true }); // Ajoute automatiquement createdAt/updatedAt

// MongoDB crée automatiquement 'id' (clé primaire _id)
export default mongoose.model('Groupe', groupeSchema);