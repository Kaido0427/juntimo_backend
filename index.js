import { connectDB } from './config/db.js';
import express from 'express';
import mongoose from 'mongoose';
import projetRoutes from './routes/projetRoutes.js';
import userRoutes from './routes/userRoutes.js';

const app = express();

// Middleware
app.use(express.json()); // Pour parser les requêtes JSON

// Ajout des routes projets
app.use('/api/projets', projetRoutes);
app.use('/api/users', userRoutes);

// Connexion à MongoDB et démarrage du serveur
const startServer = async () => {
  try {
    await connectDB();
    console.log(" MongoDB Connecté avec succès");

    // Démarrage du serveur après connexion réussie
    const PORT = 3000;
    app.listen(PORT, () => {
      console.log(` Serveur démarré sur http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("    Erreur de connexion à MongoDB :", error.message);
  }
};

startServer();
