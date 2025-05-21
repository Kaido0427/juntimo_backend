import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    await mongoose.connect("mongodb+srv://derrickstack:del7F%40%2FQ%2C%7D2jk%21@cluster0.dxp1z6c.mongodb.net/ma-base", {
      
    });
    console.log(" Connecté à MongoDB avec succès");
  } catch (err) {
    console.error(" Erreur de connexion MongoDB :", err.message);
    process.exit(1); // Arrête l'application si la connexion échoue
  }
};