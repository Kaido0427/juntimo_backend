// controllers/auth.controller.js

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/user.model');

console.log('Test PayPal Configuration...');
console.log('Client ID:', process.env.PAYPAL_CLIENT_ID ? 'OK' : 'MANQUANT');
console.log('Client Secret:', process.env.PAYPAL_CLIENT_SECRET ? 'OK' : 'MANQUANT');
console.log('Mode:', process.env.PAYPAL_MODE);
const paypal = require('@paypal/checkout-server-sdk');

// === Configuration PayPal ===
const paypalClient = (() => {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error('ERREUR: Variables PayPal manquantes dans .env');
        return null;
    }

    const environment =
        process.env.PAYPAL_MODE === 'sandbox'
            ? new paypal.core.LiveEnvironment(clientId, clientSecret)
            : new paypal.core.SandboxEnvironment(clientId, clientSecret);

    return new paypal.core.PayPalHttpClient(environment);
})();

const signToken = (userId) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET manquant dans les variables d\'environnement');
    }
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: '7d',
    });
};

// === Inscription (avec paiement PayPal) ===
module.exports.register = asyncHandler(async (req, res) => {
    const { nom, prenom, email, mot_de_passe, tel, pays_residence } = req.body;

    // Validation des champs requis
    if (!nom || !prenom || !email || !mot_de_passe) {
        return res.status(400).json({
            message: "Nom, prénom, email et mot de passe sont requis."
        });
    }

    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Format d'email invalide." });
    }

    // Validation du mot de passe (minimum 6 caractères)
    if (mot_de_passe.length < 8) {
        return res.status(400).json({
            message: "Le mot de passe doit contenir au moins 6 caractères."
        });
    }

    // Vérification PayPal client
    if (!paypalClient) {
        return res.status(500).json({
            message: "Configuration PayPal manquante. Contactez l'administrateur."
        });
    }

    try {
        // 1) Vérifier qu'aucun utilisateur n'a déjà cet email
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: "Cet email est déjà utilisé." });
        }

        // 2) Hasher le mot de passe
        const saltRounds = 12; // Augmenté pour plus de sécurité
        const hashedPassword = await bcrypt.hash(mot_de_passe, saltRounds);

        // 3) Créer la commande PayPal
        const amountValue = req.body.fraisInscription || '50.00';
        const currency = req.body.devise || 'USD';

        // Validation du montant
        if (isNaN(parseFloat(amountValue)) || parseFloat(amountValue) <= 0) {
            return res.status(400).json({ message: "Montant des frais invalide." });
        }

        const orderRequest = {
            intent: 'CAPTURE',
            purchase_units: [
                {
                    amount: {
                        currency_code: currency,
                        value: amountValue,
                    },
                    description: "Frais d'inscription au service JUNTIMO",
                },
            ],
            application_context: {
                brand_name: 'JUNTIMO',
                landing_page: 'LOGIN',
                user_action: 'PAY_NOW',
                return_url: `${process.env.BASE_URL}/auth/paypalSuccess`,
                cancel_url: `${process.env.BASE_URL}/auth/paypalCancel`,
            },
        };

        const request = new paypal.orders.OrdersCreateRequest();
        request.requestBody(orderRequest);
        const order = await paypalClient.execute(request);

        // 4) Stocker temporairement les données d'inscription en session
        req.session.pendingUser = {
            nom: nom.trim(),
            prenom: prenom.trim(),
            email: email.toLowerCase().trim(),
            mot_de_passe: hashedPassword,
            tel: tel?.trim(),
            pays_residence: pays_residence?.trim(),
            role: 'participant',
            createdAt: new Date()
        };
        req.session.pendingOrderId = order.result.id;

        // 5) Renvoyer l'URL d'approbation PayPal au front
        const approveLink = order.result.links.find((l) => l.rel === 'approve')?.href;

        if (!approveLink) {
            return res.status(500).json({ message: "Erreur lors de la création de la commande PayPal." });
        }

        res.status(200).json({
            approveLink,
            orderId: order.result.id
        });

    } catch (error) {
        console.error('Erreur lors de l\'inscription:', error);
        res.status(500).json({
            message: "Erreur lors du processus d'inscription.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// === Callback PayPal Success ===
module.exports.paypalSuccess = asyncHandler(async (req, res) => {
    const { token: orderId } = req.query;

    if (!orderId) {
        return res.status(400).json({ message: "ID de commande manquant." });
    }

    // 1) Vérifier que l'orderId correspond à ce qui est en session
    if (!req.session.pendingOrderId || req.session.pendingOrderId !== orderId) {
        return res.status(400).json({
            message: "Commande PayPal non reconnue ou expirée."
        });
    }

    // Vérifier l'expiration (ex: 30 minutes)
    const sessionAge = new Date() - new Date(req.session.pendingUser?.createdAt || 0);
    if (sessionAge > 30 * 60 * 1000) { // 30 minutes
        delete req.session.pendingUser;
        delete req.session.pendingOrderId;
        return res.status(400).json({ message: "Session expirée. Veuillez recommencer l'inscription." });
    }

    try {
        // 2) Capturer le paiement
        const captureRequest = new paypal.orders.OrdersCaptureRequest(orderId);
        captureRequest.requestBody({});
        const capture = await paypalClient.execute(captureRequest);

        if (capture.result.status !== 'COMPLETED') {
            return res.status(400).json({
                message: "Le paiement n'a pas été complété."
            });
        }

        // 3) Vérifier encore une fois que l'email n'existe pas
        const { nom, prenom, email, mot_de_passe, tel, pays_residence, role } =
            req.session.pendingUser;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            // Nettoyer la session
            delete req.session.pendingUser;
            delete req.session.pendingOrderId;
            return res.status(400).json({
                message: "Cet email est déjà utilisé."
            });
        }

        // 4) Créer définitivement l'utilisateur en base
        const newUser = await User.create({
            nom,
            prenom,
            email,
            mot_de_passe,
            tel,
            pays_residence,
            role,
            paymentStatus: 'completed',
            paypalOrderId: orderId
        });

        // 5) Nettoyer la session
        delete req.session.pendingUser;
        delete req.session.pendingOrderId;

        // 6) Générer un token JWT et renvoyer la réponse
        const token = signToken(newUser._id);

        res.status(201).json({
            message: "Inscription réussie et paiement validé.",
            user: {
                id: newUser._id,
                nom: newUser.nom,
                prenom: newUser.prenom,
                email: newUser.email,
                role: newUser.role,
            },
            token,
        });

    } catch (error) {
        console.error('Erreur lors de la confirmation PayPal:', error);
        res.status(500).json({
            message: "Erreur lors de la validation du paiement."
        });
    }
});

// === Callback PayPal Cancel ===
module.exports.paypalCancel = (req, res) => {
    // Nettoyer la session
    delete req.session.pendingUser;
    delete req.session.pendingOrderId;

    res.status(200).json({
        message: "Paiement annulé par l'utilisateur."
    });
};

// === Connexion (login) ===
module.exports.login = asyncHandler(async (req, res) => {
    const { email, mot_de_passe } = req.body;

    // Validation des champs
    if (!email || !mot_de_passe) {
        return res.status(400).json({
            message: "Email et mot de passe sont requis."
        });
    }

    try {
        // Rechercher l'utilisateur avec l'email (insensible à la casse)
        const user = await User.findOne({
            email: email.toLowerCase().trim()
        });

        if (!user) {
            return res.status(401).json({
                message: "Email ou mot de passe incorrect."
            });
        }

        // Vérifier le mot de passe
        const isMatch = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
        if (!isMatch) {
            return res.status(401).json({
                message: "Email ou mot de passe incorrect."
            });
        }

        // Générer le token
        const token = signToken(user._id);

        res.status(200).json({
            message: "Authentification réussie.",
            user: {
                id: user._id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                role: user.role,
            },
            token,
        });

    } catch (error) {
        console.error('Erreur lors de la connexion:', error);
        res.status(500).json({
            message: "Erreur lors de l'authentification."
        });
    }
});

// === Déconnexion ===
module.exports.logOut = asyncHandler(async (req, res) => {
    try {
        // Supprimer le cookie s'il existe
        res.clearCookie('access_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'development',
            sameSite: 'strict'
        });

        // Détruire la session
        if (req.session) {
            req.session.destroy((err) => {
                if (err) {
                    console.error('Erreur lors de la destruction de session:', err);
                }
            });
        }

        return res.status(200).json({
            message: 'Déconnexion réussie.'
        });

    } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
        return res.status(500).json({
            message: 'Une erreur est survenue lors de la déconnexion.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});