// models/Admin.js
import Utilisateur from './User.js';
import bcrypt from 'bcrypt';

const adminSchema = new mongoose.Schema({
  mot_de_passe: {
    type: String,
    required: [true, "Le mot de passe est obligatoire"],
    minlength: [8, "Minimum 8 caractères"]
  },
  rôle: {
    type: String,
    enum: ['superadmin', 'gestionnaire'],
    default: 'gestionnaire'
  }
});

// Cryptage du mot de passe avant sauvegarde
adminSchema.pre('save', async function(next) {
  if (this.isModified('mot_de_passe')) {
    this.mot_de_passe = await bcrypt.hash(this.mot_de_passe, 10);
  }
  next();
});

export default Utilisateur.discriminator('Admin', adminSchema);