// controllers/projetController.js

const Projet = require('../models/projet.model');
const Bien = require('../models/bien.model');
const Groupe = require('../models/groupe.model');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

// Calculer la mensualité par participant (sera utile plus tard, par exemple lors de l'enregistrement des paiements)
const calculerMensualites = (valeurTotale, dureeMois, participants) => {
  if (!dureeMois || participants <= 0) return 0;
  return valeurTotale / participants / dureeMois;
};

// CREATE Projet
module.exports.createProjet = asyncHandler(async (req, res) => {
  const {
    bienId,
    titre,
    description,
    secteur,
    statut,
    prefinancementPersonnel,
    valeurTotaleProjet,
    commissionImmoInvest,
    penalite,
    dateDebut,
    duree,
    totalBeneficesRecus
  } = req.body;

  // 1) Validation minimale des champs obligatoires
  if (!bienId || !mongoose.Types.ObjectId.isValid(bienId)) {
    return res.status(400).json({
      success: false,
      message: 'Le champ "bienId" est requis et doit être un ObjectId valide.'
    });
  }
  if (
    !titre ||
    !description ||
    !secteur ||
    !dateDebut ||
    valeurTotaleProjet === undefined ||
    duree === undefined
  ) {
    return res.status(400).json({
      success: false,
      message: 'Champs requis manquants.'
    });
  }

  // 2) Vérifier que le Bien existe
  const bienExistant = await Bien.findById(bienId);
  if (!bienExistant) {
    return res.status(404).json({
      success: false,
      message: `Aucun bien trouvé pour l'ID ${bienId}.`
    });
  }

  // 3) Création du projet sans initier de bénéfices ni mensualités (sera géré ultérieurement)
  const projet = await Projet.create({
    bienId,                                // <-- on stocke le ObjectId du Bien ici
    titre: titre.trim(),
    description: description.trim(),
    secteur: secteur.trim(),
    statut: statut || 'actif',
    prefinancementPersonnel: prefinancementPersonnel ?? 0,
    valeurTotaleProjet,
    mensualiteTotaleAPayer: 0,            // on laisse à 0 pour l'instant
    commissionImmoInvest: commissionImmoInvest ?? 0.01,
    penalite: penalite ?? 0.25,
    dateDebut: new Date(dateDebut),
    duree,
    totalBeneficesRecus: totalBeneficesRecus ?? 0
    // participantsActuels, mensualiteParParticipant et beneficesAnnuels
    // sont gérés par défaut dans le schéma (valeurs par défaut 0 ou []).
  });

  res.status(201).json({ success: true, data: projet });
});

// GET ALL Projets
module.exports.getProjets = asyncHandler(async (req, res) => {
  // On récupère tous les projets et on populates la référence "bienId"
  const projets = await Projet.find({})
    .populate('bienId')
    .lean();

  // Pour chaque projet, on peut recalculer participantsActuels et mensualitéParParticipant
  const projetsAvecCalcul = await Promise.all(
    projets.map(async (proj) => {
      const countActifs = await Groupe.countDocuments({
        projetId: proj._id,
        statut: 'actif'
      });

      return {
        ...proj,
        participantsActuels: countActifs,
        mensualiteParParticipant: calculerMensualites(
          proj.valeurTotaleProjet,
          proj.duree,
          countActifs
        )
      };
    })
  );

  res.status(200).json({
    success: true,
    count: projetsAvecCalcul.length,
    data: projetsAvecCalcul
  });
});

// GET un Projet par ID
module.exports.getProjet = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'ID de projet invalide.'
    });
  }

  // On retrouve le projet et on popule "bienId"
  const projet = await Projet.findById(id)
    .populate('bienId')
    .lean();

  if (!projet) {
    return res.status(404).json({
      success: false,
      message: 'Projet non trouvé.'
    });
  }

  // Recalculer le nombre de participants actifs
  const countActifs = await Groupe.countDocuments({
    projetId: projet._id,
    statut: 'actif'
  });

  projet.participantsActuels = countActifs;
  projet.mensualiteParParticipant = calculerMensualites(
    projet.valeurTotaleProjet,
    projet.duree,
    countActifs
  );

  res.status(200).json({ success: true, data: projet });
});

// UPDATE Projet
module.exports.updateProjet = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'ID de projet invalide.'
    });
  }

  const projet = await Projet.findById(id);
  if (!projet) {
    return res.status(404).json({
      success: false,
      message: 'Projet non trouvé.'
    });
  }

  // 1) Si on souhaite changer le "bienId", on vérifie son existence
  if (req.body.bienId !== undefined) {
    if (!mongoose.Types.ObjectId.isValid(req.body.bienId)) {
      return res.status(400).json({
        success: false,
        message: 'Le champ "bienId" doit être un ObjectId valide.'
      });
    }
    const bienExistant = await Bien.findById(req.body.bienId);
    if (!bienExistant) {
      return res.status(404).json({
        success: false,
        message: `Aucun bien trouvé pour l'ID ${req.body.bienId}.`
      });
    }
    projet.bienId = req.body.bienId;
  }

  // 2) Mettre à jour tous les champs passés dans req.body, SAUF :
  //    - les champs calculés : participantsActuels, mensualiteParParticipant, mensualiteTotaleAPayer
  //    - le champ "beneficesAnnuels" (géré ultérieurement)
  const champsAExclure = [
    'participantsActuels',
    'mensualiteParParticipant',
    'mensualiteTotaleAPayer',
    'beneficesAnnuels'
  ];

  Object.keys(req.body).forEach((key) => {
    if (
      !champsAExclure.includes(key) &&
      key !== 'valeurTotaleProjet' &&
      key !== 'duree' &&
      key !== 'bienId'
    ) {
      if (typeof req.body[key] === 'string') {
        projet[key] = req.body[key].trim();
      } else {
        projet[key] = req.body[key];
      }
    }
  });

  // 3) Gérer spécifiquement changement de valeurTotaleProjet ou de durée
  if (req.body.valeurTotaleProjet !== undefined || req.body.duree !== undefined) {
    const nouvelleValeur = req.body.valeurTotaleProjet ?? projet.valeurTotaleProjet;
    const nouvelleDuree = req.body.duree ?? projet.duree;

    projet.valeurTotaleProjet = nouvelleValeur;
    projet.duree = nouvelleDuree;
    // On ne calcule pas encore la mensualité ici ; ce sera fait plus loin.
  }

  // 4) (Optionnel) Gérer le champ "totalBeneficesRecus" si besoin
  if (req.body.totalBeneficesRecus !== undefined) {
    projet.totalBeneficesRecus = req.body.totalBeneficesRecus;
  }

  // 5) Recalculer participantsActuels et mensualitéParParticipant via Groupe
  const countActifs = await Groupe.countDocuments({
    projetId: projet._id,
    statut: 'actif'
  });
  projet.participantsActuels = countActifs;
  projet.mensualiteParParticipant = calculerMensualites(
    projet.valeurTotaleProjet,
    projet.duree,
    countActifs
  );

  const updatedProjet = await projet.save();

  // On renvoie ensuite la version complète avec "bienId" peuplé
  const projetPopulated = await Projet.findById(updatedProjet._id).populate('bienId');
  res.status(200).json({ success: true, data: projetPopulated });
});

// DELETE Projet
module.exports.deleteProjet = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'ID de projet invalide.'
    });
  }

  const projet = await Projet.findById(id);
  if (!projet) {
    return res.status(404).json({
      success: false,
      message: 'Projet non trouvé.'
    });
  }

  await projet.remove();
  res.status(200).json({ success: true, message: 'Projet supprimé.' });
});
