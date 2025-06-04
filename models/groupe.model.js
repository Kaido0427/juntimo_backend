const mongoose = require('mongoose');


const beneficeAnnuelSchema = new mongoose.Schema({
  annee: {
    type: Number,
    required: [true, "L'année du bénéfice est obligatoire"]
  },
  montant: {
    type: Number,
    required: [true, "Le montant du bénéfice est obligatoire"]
  }
}, { _id: false });

const groupeSchema = new mongoose.Schema({
  projetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Projet',
    required: [true, "Le Projet associé est obligatoire"]
  },

  // Préfinancement personnel versé par le porteur de projet au lancement de ce groupe
  prefinancementPersonnel: {
    type: Number,
    default: 0
  },

  // Montant que chaque participant du groupe doit payer mensuellement
  mensualite: {
    type: Number,
    required: [true, "La mensualité (avant pénalité) est obligatoire"],
    min: [0, "La mensualité ne peut pas être négative"]
  },

  // Somme déjà payée par les participants (cumul de tous les paiements reçus)
  mensualiteDejaPayee: {
    type: Number,
    default: 0,
    min: [0, "Le montant déjà payé ne peut pas être négatif"]
  },

  // Montant total à payer par le groupe (ex : mensualité × nombre de mois)
  mensualiteTotaleAPayer: {
    type: Number,
    required: [true, "Le total des mensualités à payer est obligatoire"],
    min: [0, "Le montant total à payer ne peut pas être négatif"]
  },

  // Commission IMMO-INVEST 
  commissionImmoInvest: {
    type: Number,
    default: 0.01,
    min: [0, "La commission ne peut pas être négative"]
  },

  // Pénalité appliquée en cas de retard de paiement
  penalite: {
    type: Number,
    default: 0.25,
    min: [0, "Le pourcentage de pénalité ne peut pas être négatif"]
  },

  // Date de démarrage de la vente à crédit pour ce groupe
  dateDebut: {
    type: Date,
    required: [true, "La date de début est obligatoire"]
  },

  duree: {
    type: Number,
    required: [true, "La durée en mois est obligatoire"],
    min: [1, "La durée doit être au moins 1 mois"]
  },

 
  beneficesAnnuels: {
    type: [beneficeAnnuelSchema],
    default: []
  },

  // Somme totale des bénéfices reçus 
  totalBeneficesRecus: {
    type: Number,
    default: 0,
    min: [0, "Le total des bénéfices ne peut pas être négatif"]
  },


  participantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
