require('dotenv').config();

const express = require('express');
const connectDB = require('./config/db');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const errorHandler = require("./middlewares/errorHandler");

const app = express();
const port = process.env.PORT || 5000;

// Connexion à la base de données
connectDB();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(errorHandler);

// Routes
app.get('/', (req, res) => {
  res.send("Bienvenue sur l'API de JUNTIMO !!!");
});

app.use('/auth', require('./routes/auth.routes'));

// Démarrage du serveur
app.listen(port, () => {
  console.log(`Le serveur a démarré au port ${port}`);
});   