
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/user.model');
const paypal = require('@paypal/checkout-server-sdk');

// --- Configuration PayPal simplifiée ---
const paypalClient = (() => {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        console.error('❌ PAYPAL_CLIENT_ID ou PAYPAL_CLIENT_SECRET manquant(e)');
        return null;
    }
    const env =
        process.env.PAYPAL_MODE === 'sandbox'
            ? new paypal.core.SandboxEnvironment(clientId, clientSecret)
            : new paypal.core.LiveEnvironment(clientId, clientSecret);
    return new paypal.core.PayPalHttpClient(env);
})();

const signToken = (userId) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET manquant');
    }
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};



// === Inscription (avec paiement PayPal) ===
module.exports.register = asyncHandler(async (req, res) => {
    console.log("🔔 [register] Début de la requête d'inscription");

    // 1) Récupération des champs
    const { nom, prenom, email, mot_de_passe, tel, pays_residence, fraisInscription, devise } = req.body;
    console.log("📥 [register] Données reçues :", {
        nom, prenom, email, tel, pays_residence, fraisInscription, devise
    });

    // 2) Validation des champs requis
    if (!nom || !prenom || !email || !mot_de_passe) {
        console.log("❌ [register] Champs requis manquants");
        return res.status(400).json({ message: "Nom, prénom, email et mot de passe sont requis." });
    }
    console.log("✅ [register] Champs obligatoires présents");

    // 3) Validation du format de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        console.log("❌ [register] Format d'email invalide :", email);
        return res.status(400).json({ message: "Format d'email invalide." });
    }
    console.log("✅ [register] Format d'email valide :", email);

    // 4) Validation du mot de passe
    if (mot_de_passe.length < 8) {
        console.log("❌ [register] Mot de passe trop court (longueur =", mot_de_passe.length, ")");
        return res.status(400).json({ message: "Le mot de passe doit contenir au moins 8 caractères." });
    }
    console.log("✅ [register] Mot de passe accepté (longueur =", mot_de_passe.length, ")");

    // 5) Vérification de la configuration PayPal
    if (!paypalClient) {
        console.log("❌ [register] paypalClient non configuré");
        return res.status(500).json({ message: "Configuration PayPal manquante." });
    }
    console.log("✅ [register] paypalClient configuré");

    try {
        // 6) Vérification de l'unicité de l'email
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        console.log("🔍 [register] Recherche d'utilisateur existant pour l'email :", email.toLowerCase());
        if (existingUser) {
            console.log("❌ [register] Email déjà utilisé par un autre utilisateur");
            return res.status(400).json({ message: "Cet email est déjà utilisé." });
        }
        console.log("✅ [register] Email disponible :", email.toLowerCase());

        // 7) Hashage du mot de passe
        const saltRounds = 12;
        console.log("🔒 [register] Hashage du mot de passe (saltRounds =", saltRounds, ")");
        const hashedPassword = await bcrypt.hash(mot_de_passe, saltRounds);
        console.log("✅ [register] Mot de passe hashé :", hashedPassword);

        // 8) Préparation de la commande PayPal
        const amountValue = fraisInscription || '50.00';
        const currency = devise || 'USD';
        console.log("💰 [register] Montant des frais d'inscription :", amountValue, currency);
        if (isNaN(parseFloat(amountValue)) || parseFloat(amountValue) <= 0) {
            console.log("❌ [register] Montant invalide :", amountValue);
            return res.status(400).json({ message: "Montant des frais invalide." });
        }

        const baseUrl = process.env.BASE_URL;
        const orderRequest = {
            intent: 'CAPTURE',
            purchase_units: [
                {
                    amount: { currency_code: currency, value: amountValue },
                    description: "Frais d'inscription au service JUNTIMO",
                },
            ],
            application_context: {
                brand_name: 'JUNTIMO',
                landing_page: 'LOGIN',
                user_action: 'PAY_NOW',
                return_url: `${baseUrl}/auth/paypalSuccess`,
                cancel_url: `${baseUrl}/auth/paypalCancel`,
            },
        };
        console.log("📦 [register] OrderRequest PayPal préparé :", orderRequest);

        // 9) Création de la commande PayPal
        const request = new paypal.orders.OrdersCreateRequest();
        request.requestBody(orderRequest);
        console.log("🚀 [register] Envoi de la requête de création de commande PayPal");
        const order = await paypalClient.execute(request);
        console.log("✅ [register] Commande PayPal créée :", order.result.id);

        // 10) Sauvegarde dans la session
        if (!req.session) {
            console.log("❌ [register] Problème de session : req.session absent");
            return res.status(500).json({ message: "Erreur de configuration de session." });
        }
        req.session.pendingUser = {
            nom: nom.trim(),
            prenom: prenom.trim(),
            email: email.toLowerCase().trim(),
            mot_de_passe: hashedPassword,
            tel: tel?.trim(),
            pays_residence: pays_residence?.trim(),
            role: 'participant',
            createdAt: new Date(),
        };
        req.session.pendingOrderId = order.result.id;
        console.log("💾 [register] pendingUser et pendingOrderId stockés en session :", {
            pendingUser: req.session.pendingUser,
            pendingOrderId: req.session.pendingOrderId,
        });
        console.log("🔑 [register] SessionID après création :", req.sessionID);

        // 11) Récupération du lien d'approbation
        const approveLink = order.result.links.find((l) => l.rel === 'approve')?.href;
        if (!approveLink) {
            console.log("❌ [register] Lien d'approbation PayPal introuvable dans les links :", order.result.links);
            return res.status(500).json({ message: "Impossible de récupérer le lien PayPal." });
        }
        console.log("✅ [register] Lien d'approbation PayPal obtenu :", approveLink);

        // 12) Réponse au front
        console.log("📤 [register] Réponse envoyée au front avec approveLink et orderId");
        res.status(200).json({
            success: true,
            approveLink,
            orderId: order.result.id,
            message: "Commande PayPal créée. Redirigez l'utilisateur pour le paiement.",
        });


    } catch (error) {
        console.error("❌ [register] Erreur lors de l'inscription :", error);
        return res.status(500).json({ success: false, message: "Erreur interne." });
    }
});

// === Callback PayPal Success ===
module.exports.paypalSuccess = asyncHandler(async (req, res) => {
    console.log("🔔 [paypalSuccess] Début du callback PayPal Success");
    console.log("🔑 [paypalSuccess] SessionID reçue :", req.sessionID);


    // 1) Récupération des paramètres PayPal
    const orderId = req.query.token || req.query.paymentId || req.query.orderID || req.query.id;
    console.log("📥 [paypalSuccess] Paramètres reçus :", req.query);
    console.log("🎯 [paypalSuccess] orderId extrait :", orderId);

    if (!orderId) {
        console.log("❌ [paypalSuccess] orderId manquant dans les paramètres PayPal");
        return res.status(400).json({
            message: "ID de commande manquant.",
            receivedParams: req.query,
            expectedParams: ['token', 'paymentId', 'orderID', 'id'],
        });
    }

    // 2) Vérification de la session et de l'orderId en session
    console.log("🔍 [paypalSuccess] Vérification de la session et pendingOrderId en session");
    if (!req.session || !req.session.pendingOrderId) {
        console.log("❌ [paypalSuccess] Session expirée ou pendingOrderId manquant :", {
            hasSession: !!req.session,
            hasPendingOrder: !!req.session?.pendingOrderId,
            hasPendingUser: !!req.session?.pendingUser
        });
        return res.status(400).json({
            message: "Session expirée ou commande non trouvée. Veuillez recommencer l'inscription.",
            sessionData: {
                hasSession: !!req.session,
                hasPendingOrder: !!req.session?.pendingOrderId,
                hasPendingUser: !!req.session?.pendingUser,
            },
        });
    }
    if (req.session.pendingOrderId !== orderId) {
        console.log("❌ [paypalSuccess] orderId reçu ne correspond pas à celui en session :", {
            attendu: req.session.pendingOrderId,
            reçu: orderId
        });
        return res.status(400).json({
            message: "Commande PayPal non reconnue.",
            expected: req.session.pendingOrderId,
            received: orderId,
        });
    }
    console.log("✅ [paypalSuccess] orderId correspond à la session");

    // 3) Vérification de l'âge de la session (30 min max)
    const sessionAge = new Date() - new Date(req.session.pendingUser?.createdAt || 0);
    console.log("⏱️ [paypalSuccess] Âge de la session (ms) :", sessionAge);
    if (sessionAge > 30 * 60 * 1000) {
        console.log("❌ [paypalSuccess] Session expirée (>30min), age :", sessionAge);
        delete req.session.pendingUser;
        delete req.session.pendingOrderId;
        return res.status(400).json({
            message: "Session expirée. Veuillez recommencer l'inscription.",
            sessionAge: Math.round(sessionAge / 1000) + ' secondes',
        });
    }
    console.log("✅ [paypalSuccess] Session toujours valide (age <30min)");

    // 4) Capture du paiement PayPal
    if (!paypalClient) {
        console.log("❌ [paypalSuccess] paypalClient non configuré");
        return res.status(500).json({ message: "Configuration PayPal manquante." });
    }
    try {
        console.log("🚀 [paypalSuccess] Envoi de la requête de capture du paiement pour orderId :", orderId);
        const captureRequest = new paypal.orders.OrdersCaptureRequest(orderId);
        captureRequest.requestBody({});
        const capture = await paypalClient.execute(captureRequest);
        console.log("📦 [paypalSuccess] Résultat de la capture PayPal :", capture.result);

        if (capture.result.status !== 'COMPLETED') {
            console.log("❌ [paypalSuccess] Statut de capture invalide :", capture.result.status);
            return res.status(400).json({
                message: "Le paiement n'a pas été complété.",
                status: capture.result.status,
                details: capture.result,
            });
        }
        console.log("✅ [paypalSuccess] Paiement PayPal COMPLETED");

        // 5) Création finale de l'utilisateur
        const { nom, prenom, email, mot_de_passe, tel, pays_residence, role } = req.session.pendingUser;
        console.log("🔍 [paypalSuccess] Dernière vérification d'unicité de l'email :", email);
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log("❌ [paypalSuccess] Email déjà utilisé (après capture) :", email);
            delete req.session.pendingUser;
            delete req.session.pendingOrderId;
            return res.status(400).json({ message: "Cet email est déjà utilisé." });
        }
        console.log("✅ [paypalSuccess] Email toujours disponible :", email);

        const newUser = await User.create({
            nom,
            prenom,
            email,
            mot_de_passe,
            tel,
            pays_residence,
            role,
            paymentStatus: 'completed',
            paypalOrderId: orderId,
            paypalCaptureId: capture.result.purchase_units?.[0]?.payments?.captures?.[0]?.id,
        });
        console.log("💾 [paypalSuccess] Nouvel utilisateur créé :", {
            id: newUser._id,
            email: newUser.email,
            paypalOrderId: newUser.paypalOrderId,
            paypalCaptureId: newUser.paypalCaptureId
        });

        // 6) Nettoyage de la session
        delete req.session.pendingUser;
        delete req.session.pendingOrderId;
        console.log("🧹 [paypalSuccess] Session nettoyée (pendingUser et pendingOrderId supprimés)");

        // 7) Génération du token JWT et réponse
        const token = signToken(newUser._id);
        console.log("🔑 [paypalSuccess] Token JWT généré :", token);
        const paymentCapture = capture.result.purchase_units?.[0]?.payments?.captures?.[0];
        return res.status(201).json({
            success: true,
            message: "Inscription réussie et paiement validé.",
            user: {
                id: newUser._id,
                nom: newUser.nom,
                prenom: newUser.prenom,
                email: newUser.email,
                role: newUser.role,
                paymentStatus: newUser.paymentStatus,
            },
            token,
            paymentDetails: {
                orderId: orderId,
                captureId: paymentCapture?.id,
                amount: paymentCapture?.amount,
                status: capture.result.status,
            },
        });
    } catch (error) {
        console.error("❌ [paypalSuccess] Erreur lors de la capture PayPal :", error);
        return res.status(500).json({ success: false, message: "Erreur lors de la validation du paiement." });
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

module.exports.createAdmin = asyncHandler(async (req, res) => {
    const defaultEmail = process.env.DEFAULT_ADMIN_EMAIL;
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD;

    const adminEmail = defaultEmail.trim().toLowerCase();

    // Si l’admin existe déjà, on ne fait rien
    const existing = await User.findOne({ email: defaultEmail });
    if (existing) {
        return;
    }

    // Sinon, on le crée avec le rôle "admin"
    const hashed = await bcrypt.hash(defaultPassword, 12);
    await User.create({
        nom: 'Admin',
        prenom: 'Juntimo',
        email: adminEmail,
        mot_de_passe: hashed,
        tel: '010000000',
        pays_residence: "juntimo",
        role: 'admin',
        createdAt: new Date(),
    });
    console.log(`🔐 Administrateur par défaut créé : ${defaultEmail}`);
    return res.status(201).json({
        success: true,
        message: 'Administrateur créé avec succès.',
    });
}
);

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