import Projet from '../models/Projet.js';

// Récupérer tous les projets
export const getProjets = async (req, res) => {
  try {
    const projets = await Projet.find();
    res.json(projets);
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// Récupérer un projet par ID
export const getProjetById = async (req, res) => {
  try {
    const projet = await Projet.findById(req.params.id);
    if (!projet) return res.status(404).json({ message: "Projet non trouvé" });
    res.json(projet);
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// Créer un projet
export const creerProjet = async (req, res) => {
  try {
    const nouveauProjet = new Projet(req.body);
    await nouveauProjet.save();
    res.status(201).json(nouveauProjet);
  } catch (error) {
    res.status(400).json({ message: "Erreur lors de la création du projet", error });
  }
};

// Mettre à jour un projet
export const updateProjet = async (req, res) => {
  try {
    const projet = await Projet.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!projet) return res.status(404).json({ message: "Projet non trouvé" });
    res.json(projet);
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// Supprimer un projet
export const deleteProjet = async (req, res) => {
  try {
    const projet = await Projet.findByIdAndDelete(req.params.id);
    if (!projet) return res.status(404).json({ message: "Projet non trouvé" });
    res.json({ message: "Projet supprimé avec succès" });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};
