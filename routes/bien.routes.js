const express = require('express');
const router = express.Router();
const { creerBien, getBiens, getBienById, updateBien, deleteBien } = require('../controllers/bien.controller');
const validateToken = require('../middlewares/validateTokenHandler');

router.use(validateToken);
router.post('/create', creerBien);
router.get('/allGoods', getBiens);
router.get('/oneGood/:id', getBienById);
router.put('/update/:id', updateBien);
router.delete('/delete/:id', deleteBien);

module.exports = router;
