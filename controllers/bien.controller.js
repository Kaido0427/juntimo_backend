const Bien = require('../models/bien.model');
const asyncHandler = require('express-async-handler');

// Créer un bien
module.exports.creerBien = asyncHandler(async (req, res) => {
    const bien = new Bien(req.body);
    const bienCree = await bien.save();
    res.status(201).json(bienCree);
});

// Obtenir tous les biens
module.exports.getBiens = asyncHandler(async (req, res) => {
    const biens = await Bien.find();
    res.status(200).json(biens);
});

// Obtenir un bien par ID
module.exports.getBienById = asyncHandler(async (req, res) => {
    const bien = await Bien.findById(req.params.id);
    if (!bien) {
        res.status(404);
        throw new Error("Bien non trouvé");
    }
    res.status(200).json(bien);
});


module.exports.updateBien = asyncHandler(async (req, res) => {
    const bien = await Bien.findById(req.params.id);
    if (!bien) {
        return res.status(404).json({
            success: false,
            message: "Bien non trouvé"
        });
    }

    // Mise à jour des champs de premier niveau
    if (req.body.libelle !== undefined) bien.libelle = req.body.libelle;
    if (req.body.description !== undefined) bien.description = req.body.description;
    if (req.body.type_bien !== undefined) bien.type_bien = req.body.type_bien;

    // Mise à jour partielle du propriétaire
    if (req.body.proprietaire) {
        if (req.body.proprietaire.nom !== undefined) bien.proprietaire.nom = req.body.proprietaire.nom;
        if (req.body.proprietaire.prenom !== undefined) bien.proprietaire.prenom = req.body.proprietaire.prenom;
        if (req.body.proprietaire.telephone !== undefined) bien.proprietaire.telephone = req.body.proprietaire.telephone;
        if (req.body.proprietaire.document !== undefined) bien.proprietaire.document = req.body.proprietaire.document;
    }

    // Mise à jour des preuves (remplacement complet du tableau)
    if (req.body.preuves !== undefined) {
        bien.preuves = req.body.preuves;
    }

    const bienMisAJour = await bien.save();

    res.status(200).json({
        success: true,
        data: bienMisAJour
    });
});


// Supprimer un bien
module.exports.deleteBien = asyncHandler(async (req, res) => {
    const bien = await Bien.findByIdAndDelete(req.params.id);
    if (!bien) {
        res.status(404);
        throw new Error("Bien non trouvé");
    }
    res.status(200).json({ message: "Bien supprimé avec succès" });
});
