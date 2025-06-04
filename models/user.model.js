import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: [true, "Le nom est obligatoire"]
  },
  prénom: {
    type: String,
    required: [true, "Le prénom est obligatoire"]
  },
  email: {
    type: String,
    unique: true,
    required: [true, "L'email est obligatoire"],
    match: [/^\S+@\S+\.\S+$/, "Email invalide"] // Validation format email
  },
  pays_residence: {
    type: String,
    required: [true, "Le pays est obligatoire"]
  },
  numéro_téléphone: {
    type: String,
    match: [/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/, "Numéro invalide"]
  }
});

// MongoDB crée automatiquement un '_id' unique (clé primaire)
export default mongoose.model('Utilisateur', userSchema);