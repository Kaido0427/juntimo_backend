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
 
router.get('/allProjects', getProjets);
router.use(validateToken);

// Routes protégées
router.post('/create', createProjet);

router.get('/oneProject/:id', getProjet);
router.put('/update/:id', updateProjet);
router.delete('/delete/:id', deleteProjet);

module.exports = router;
