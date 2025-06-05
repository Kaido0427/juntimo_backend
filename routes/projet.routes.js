const express = require('express');
const router = express.Router();
const {
  creerProjet,
  getProjets,
  getProjetById,
  updateProjet,
  deleteProjet
} = require('../controllers/projet.controller');

const validateToken = require('../middlewares/validateTokenHandler');

router.use(validateToken);

// Routes protégées
router.post('/create', creerProjet);
router.get('/allProjects', getProjets);
router.get('/oneProject/:id', getProjetById);
router.put('/update/:id', updateProjet);
router.delete('/delete/:id', deleteProjet);

module.exports = router;
