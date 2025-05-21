import Utilisateur from '../models/User.js';

//  Récupérer tous les utilisateurs
export const getUsers = async (req, res) => {
  try {
    const users = await Utilisateur.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

//  Récupérer un utilisateur par ID
export const getUserById = async (req, res) => {
  try {
    const user = await Utilisateur.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

//  Créer un utilisateur
export const createUser = async (req, res) => {
  try {
    const newUser = new Utilisateur(req.body);
    await newUser.save();
    res.status(201).json(newUser);
  } catch (error) {
    res.status(400).json({ message: "Erreur lors de la création de l'utilisateur", error });
  }
};


//  Mettre à jour un utilisateur
export const updateUser = async (req, res) => {
  try {
    const user = await Utilisateur.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

//  Supprimer un utilisateur
export const deleteUser = async (req, res) => {
  try {
    const user = await Utilisateur.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });
    res.json({ message: "Utilisateur supprimé avec succès" });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};
