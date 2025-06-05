require('dotenv').config();

const express = require('express');
const connectDB = require('./config/db');
const { sessionMiddleware, sessionDebugMiddleware } = require('./middlewares/sessionHandler');
const errorHandler = require("./middlewares/errorHandler");

const app = express();
const port = process.env.PORT || 5000;

// Connexion à la base de données
connectDB();

// Middlewares de base
app.use(express.json());
app.use(express.urlencoded({ extended: false }));


app.use(sessionMiddleware);

// Middlewares de session (développement uniquement)
if (process.env.NODE_ENV === 'development') {
  app.use(sessionDebugMiddleware);
}

// Routes
app.get('/', (req, res) => {
  res.send("Bienvenue sur l'API de JUNTIMO !!!");
});


// Routes principales
app.use('/auth', require('./routes/auth.routes'));


app.use(errorHandler);


app.listen(port, () => {
  console.log(`🚀 Le serveur a démarré au port ${port}`);
  console.log(`📊 Sessions stockées en MongoDB: ${process.env.MONGODB_URI ? '✅' : '❌'}`);
  console.log(`🔐 Session secret configuré: ${process.env.SESSION_SECRET ? '✅' : '❌ (utilise le défaut)'}`);
});