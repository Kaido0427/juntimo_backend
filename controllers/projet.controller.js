const Projet = require('../models/Projet');
const asyncHandler = require('express-async-handler');

// Créer un projet
module.exports.creerProjet = asyncHandler(async (req, res) => {
  const projet = new Projet(req.body);
  const nouveauProjet = await projet.save();
  res.status(201).json(nouveauProjet);
});

// Obtenir tous les projets
module.exports.getProjets = asyncHandler(async (req, res) => {
  const projets = await Projet.find();
  res.status(200).json(projets);
});

// Obtenir un projet par ID
module.exports.getProjetById = asyncHandler(async (req, res) => {
  const projet = await Projet.findById(req.params.id);
  if (!projet) {
    res.status(404);
    throw new Error("Projet non trouvé");
  }
  res.status(200).json(projet);
});

// Modifier un projet
module.exports.updateProjet = asyncHandler(async (req, res) => {
  const projet = await Projet.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!projet) {
    res.status(404);
    throw new Error("Projet non trouvé");
  }
  res.status(200).json(projet);
});

// Supprimer un projet
module.exports.deleteProjet = asyncHandler(async (req, res) => {
  const projet = await Projet.findByIdAndDelete(req.params.id);
  if (!projet) {
    res.status(404);
    throw new Error("Projet non trouvé");
  }
  res.status(200).json({ message: "Projet supprimé avec succès" });
});
