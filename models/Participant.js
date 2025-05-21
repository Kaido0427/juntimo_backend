// models/Participant.js
import Utilisateur from './User.js';

const participantSchema = new mongoose.Schema({
  date_inscription: {
    type: Date,
    default: Date.now
  },
  groupeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Groupe'
  },
  statut: {
    type: String,
    enum: ['actif', 'inactif', 'en_attente'],
    default: 'actif'
  }
});

export default Utilisateur.discriminator('Participant', participantSchema);