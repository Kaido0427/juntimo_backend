const Bien = require('../models/Bien');
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

// Modifier un bien
module.exports.updateBien = asyncHandler(async (req, res) => {
    const bien = await Bien.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });
    if (!bien) {
        res.status(404);
        throw new Error("Bien non trouvé");
    }
    res.status(200).json(bien);
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
