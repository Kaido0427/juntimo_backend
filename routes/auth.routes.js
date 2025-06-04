const express = require('express');
const { register, logOut, login, paypalCancel, paypalSuccess } = require('../controllers/auth.controller');
const validateToken = require('../middlewares/validateTokenHandler');

const router = express.Router();

// === ROUTES PUBLIQUES ===
router.post('/register', register); 
router.post('/login', login);     
router.get('/paypal-success', paypalSuccess); 
router.get('/paypal-cancel', paypalCancel); 

// === ROUTES PROTÉGÉES ===
router.post('/logout', validateToken, logOut); 

module.exports = router;