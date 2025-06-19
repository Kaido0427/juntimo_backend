const express = require('express');
const { register, logOut, login, paypalCancel, paypalSuccess, createAdmin, joinProject } = require('../controllers/auth.controller');
const validateToken = require('../middlewares/validateTokenHandler');

const router = express.Router();

// === ROUTES PUBLIQUES ===
router.post('/register', register); 
router.post('/joinProject', joinProject); 
router.post('/register/admin', createAdmin); 
router.post('/login', login);     
router.get('/paypalSuccess', paypalSuccess); 
router.get('/paypalCancel', paypalCancel); 

// === ROUTES PROTÉGÉES ===
router.post('/logout', validateToken, logOut); 

module.exports = router;