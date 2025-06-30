const express = require('express');
const router = express.Router();
const {
  createProjet,
  getProjets,
  getProjet,
  updateProjet,
  deleteProjet
} = require('../controllers/projet.controller');

const validateToken = require('../middlewares/validateTokenHandler');
 
router.use(validateToken);

// Routes protégées
router.post('/create', createProjet);
router.get('/allProjects', getProjets);
router.get('/oneProject/:id', getProjet);
router.put('/update/:id', updateProjet);
router.delete('/delete/:id', deleteProjet);

module.exports = router;
