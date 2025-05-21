import express from 'express';
import {
  getProjets,
  getProjetById,
  creerProjet,
  updateProjet,
  deleteProjet
} from '../controllers/ProjetController.js';

const router = express.Router();

router.get('/', getProjets);
router.get('/:id', getProjetById);
router.post('/', creerProjet);
router.put('/:id', updateProjet);
router.delete('/:id', deleteProjet);

export default router;
