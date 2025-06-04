const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        mongoose.set('strictQuery', false);
        await mongoose.connect('mongodb://localhost:27017/juntimo', {
           
        });
        console.log('Vous êtes connecté à la Base de données');
    } catch (err) {
        console.error('Erreur de connexion MongoDB:', err);
        process.exit(1);  
    }
};

module.exports = connectDB;