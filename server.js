require('dotenv').config();

const express = require('express');
const connectDB = require('./config/db');

const app = express();
const port = process.env.PORT || 5000;


connectDB();


app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/', (req, res) => {
  res.send("Bienvenue sur l'API de JUNTIMO !!!");
});

app.use('/auth', require('./routes/auth.routes'));

// 4. Démarrage du serveur
app.listen(port, () => {
  console.log(`Le serveur a démarré au port ${port}`);
});
