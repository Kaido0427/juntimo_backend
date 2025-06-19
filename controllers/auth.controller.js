
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/user.model');
const Projet=require('../models/projet.model');
const Groupe=require('../models/groupe.model');
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

// ===== API 1: INSCRIPTION NORMALE (nouvel utilisateur) =====
module.exports.register = asyncHandler(async (req, res) => {
    const {
        nom, prenom, email, mot_de_passe,
        tel, pays_residence,
        fraisInscription, devise,
        projetId
    } = req.body;

    // 🧪 Validation de base
    if (!nom || !prenom || !email || !mot_de_passe || !projetId) {
        return res.status(400).json({ message: "Champs requis manquants." });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Format d'email invalide." });
    }

    if (mot_de_passe.length < 8) {
        return res.status(400).json({ message: "Mot de passe trop court." });
    }

    const projet = await Projet.findById(projetId);
    if (!projet) {
        return res.status(404).json({ message: "Projet introuvable." });
    }

    // 🔍 Vérifier si l'utilisateur existe DÉJÀ
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
        return res.status(400).json({ 
            message: "Cet email est déjà utilisé. Connectez-vous et utilisez 'Rejoindre le projet'.",
            userExists: true
        });
    }

    // 💰 Paiement requis
    if (!paypalClient) {
        return res.status(500).json({ message: "Client PayPal non configuré." });
    }

    const amountValue = fraisInscription || '50.00';
    const currency = devise || 'USD';
    if (isNaN(parseFloat(amountValue)) || parseFloat(amountValue) <= 0) {
        return res.status(400).json({ message: "Montant invalide." });
    }

    // ✅ Hash mot de passe
    const hashedPassword = await bcrypt.hash(mot_de_passe, 12);

    // 📦 Créer commande PayPal
    const orderRequest = {
        intent: 'CAPTURE',
        purchase_units: [{
            amount: { currency_code: currency, value: amountValue },
            description: `Inscription et participation au projet "${projet.titre}"`,
        }],
        application_context: {
            brand_name: 'JUNTIMO',
            landing_page: 'LOGIN',
            user_action: 'PAY_NOW',
            return_url: `${process.env.BASE_URL}/auth/paypalSuccess`,
            cancel_url: `${process.env.BASE_URL}/auth/paypalCancel`,
        },
    };

    const paypalRequest = new paypal.orders.OrdersCreateRequest();
    paypalRequest.requestBody(orderRequest);
    const order = await paypalClient.execute(paypalRequest);

    const approveLink = order.result.links.find(l => l.rel === 'approve')?.href;
    if (!approveLink) {
        return res.status(500).json({ message: "Lien PayPal introuvable." });
    }

    // 🧠 Enregistrer les données dans la session (NOUVEL UTILISATEUR)
    req.session.pendingOrderId = order.result.id;
    req.session.pendingProjetId = projetId;
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

    return res.status(200).json({
        success: true,
        approveLink,
        orderId: order.result.id,
        message: "Paiement requis pour l'inscription et rejoindre le projet.",
        type: 'register'
    });
});

// ===== API 2: REJOINDRE UN PROJET (utilisateur connecté) =====
module.exports.joinProject = asyncHandler(async (req, res) => {
    const {
        projetId,
        fraisInscription,
        devise
    } = req.body;

    // 🔐 Vérifier que l'utilisateur est connecté (middleware auth requis)
    if (!req.user || !req.user.id) {
        return res.status(401).json({ message: "Utilisateur non connecté." });
    }

    // 🧪 Validation
    if (!projetId) {
        return res.status(400).json({ message: "ID du projet requis." });
    }

    const projet = await Projet.findById(projetId);
    if (!projet) {
        return res.status(404).json({ message: "Projet introuvable." });
    }

    // 👤 Récupérer l'utilisateur connecté
    const user = await User.findById(req.user.id);
    if (!user) {
        return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    // 🔍 Vérifier si déjà inscrit au projet
    const existingGroupe = await Groupe.findOne({
        projetId: projetId,
        participantId: user._id
    });

    if (existingGroupe) {
        return res.status(400).json({ 
            message: "Vous êtes déjà inscrit à ce projet.",
            alreadyRegistered: true 
        });
    }

    // 💰 Paiement requis
    if (!paypalClient) {
        return res.status(500).json({ message: "Client PayPal non configuré." });
    }

    const amountValue = fraisInscription || '50.00';
    const currency = devise || 'USD';
    if (isNaN(parseFloat(amountValue)) || parseFloat(amountValue) <= 0) {
        return res.status(400).json({ message: "Montant invalide." });
    }

    // 📦 Créer commande PayPal
    const orderRequest = {
        intent: 'CAPTURE',
        purchase_units: [{
            amount: { currency_code: currency, value: amountValue },
            description: `Participation au projet "${projet.titre}"`,
        }],
        application_context: {
            brand_name: 'JUNTIMO',
            landing_page: 'LOGIN',
            user_action: 'PAY_NOW',
            return_url: `${process.env.BASE_URL}/auth/paypalSuccess`,
            cancel_url: `${process.env.BASE_URL}/auth/paypalCancel`,
        },
    };

    const paypalRequest = new paypal.orders.OrdersCreateRequest();
    paypalRequest.requestBody(orderRequest);
    const order = await paypalClient.execute(paypalRequest);

    const approveLink = order.result.links.find(l => l.rel === 'approve')?.href;
    if (!approveLink) {
        return res.status(500).json({ message: "Lien PayPal introuvable." });
    }

    // 🧠 Enregistrer les données dans la session (UTILISATEUR EXISTANT)
    req.session.pendingOrderId = order.result.id;
    req.session.pendingProjetId = projetId;
    req.session.existingUserId = user._id;

    return res.status(200).json({
        success: true,
        approveLink,
        orderId: order.result.id,
        message: "Paiement requis pour rejoindre le projet.",
        type: 'joinProject',
        user: {
            nom: user.nom,
            prenom: user.prenom,
            email: user.email
        }
    });
});


/*
module.exports.register = asyncHandler(async (req, res) => {
    const {
        nom, prenom, email, mot_de_passe,
        tel, pays_residence,
        fraisInscription, devise,
        projetId
    } = req.body;

    // 🧪 Validation de base
    if (!nom || !prenom || !email || !mot_de_passe || !projetId) {
        return res.status(400).json({ message: "Champs requis manquants." });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Format d'email invalide." });
    }

    if (mot_de_passe.length < 8) {
        return res.status(400).json({ message: "Mot de passe trop court." });
    }

    const projet = await Projet.findById(projetId);
    if (!projet) {
        return res.status(404).json({ message: "Projet introuvable." });
    }

    // 💰 Paiement requis à chaque participation
    if (!paypalClient) {
        return res.status(500).json({ message: "Client PayPal non configuré." });
    }

    const amountValue = fraisInscription || '50.00';
    const currency = devise || 'USD';
    if (isNaN(parseFloat(amountValue)) || parseFloat(amountValue) <= 0) {
        return res.status(400).json({ message: "Montant invalide." });
    }

    // 🔍 Vérifier si l'utilisateur existe
    const existingUser = await User.findOne({ email: email.toLowerCase() });

    // ✅ Hash mot de passe (même si inutilisé si existant)
    const hashedPassword = await bcrypt.hash(mot_de_passe, 12);

    // 📦 Créer commande PayPal
    const orderRequest = {
        intent: 'CAPTURE',
        purchase_units: [{
            amount: { currency_code: currency, value: amountValue },
            description: `Participation au projet "${projet.titre}"`,
        }],

        application_context: {
            brand_name: 'JUNTIMO',
            landing_page: 'LOGIN',
            user_action: 'PAY_NOW',
            return_url: `${process.env.BASE_URL}/auth/paypalSuccess`,
            cancel_url: `${process.env.BASE_URL}/auth/paypalCancel`,
        },
    };

    const paypalRequest = new paypal.orders.OrdersCreateRequest();
    paypalRequest.requestBody(orderRequest);
    const order = await paypalClient.execute(paypalRequest);

    const approveLink = order.result.links.find(l => l.rel === 'approve')?.href;
    if (!approveLink) {
        return res.status(500).json({ message: "Lien PayPal introuvable." });
    }

    // 🧠 Enregistrer les données dans la session (sera finalisé après paiement)
    req.session.pendingOrderId = order.result.id;
    req.session.pendingProjetId = projetId;

    if (existingUser) {
        req.session.existingUserId = existingUser._id;
    } else {
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
    }

    return res.status(200).json({
        success: true,
        approveLink,
        orderId: order.result.id,
        message: "Paiement requis pour rejoindre le projet.",
    });
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
});*/

// Fonction utilitaire pour calculer les mensualités
const calculerMensualites = (valeurTotale, dureeMois, participants) => {
    if (!dureeMois || participants <= 0) return 0;
    return valeurTotale / participants / dureeMois;
};

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
    if (!req.session || !req.session.pendingOrderId || !req.session.pendingProjetId) {
        console.log("❌ [paypalSuccess] Session expirée ou données manquantes :", {
            hasSession: !!req.session,
            hasPendingOrder: !!req.session?.pendingOrderId,
            hasPendingProjet: !!req.session?.pendingProjetId,
            hasExistingUser: !!req.session?.existingUserId,
            hasPendingUser: !!req.session?.pendingUser
        });
        return res.status(400).json({
            message: "Session expirée ou commande non trouvée. Veuillez recommencer l'inscription.",
            sessionData: {
                hasSession: !!req.session,
                hasPendingOrder: !!req.session?.pendingOrderId,
                hasPendingProjet: !!req.session?.pendingProjetId,
                hasExistingUser: !!req.session?.existingUserId,
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
    const sessionCreatedAt = req.session.pendingUser?.createdAt || req.session.createdAt || new Date();
    const sessionAge = new Date() - new Date(sessionCreatedAt);
    console.log("⏱️ [paypalSuccess] Âge de la session (ms) :", sessionAge);
    if (sessionAge > 30 * 60 * 1000) {
        console.log("❌ [paypalSuccess] Session expirée (>30min), age :", sessionAge);
        delete req.session.pendingUser;
        delete req.session.pendingOrderId;
        delete req.session.pendingProjetId;
        delete req.session.existingUserId;
        return res.status(400).json({
            message: "Session expirée. Veuillez recommencer l'inscription.",
            sessionAge: Math.round(sessionAge / 1000) + ' secondes',
        });
    }
    console.log("✅ [paypalSuccess] Session toujours valide (age <30min)");

    // 4) Vérification que le projet existe toujours
    const projet = await Projet.findById(req.session.pendingProjetId);
    if (!projet) {
        console.log("❌ [paypalSuccess] Projet introuvable :", req.session.pendingProjetId);
        return res.status(404).json({ message: "Projet introuvable." });
    }
    console.log("✅ [paypalSuccess] Projet trouvé :", projet.titre);

    // 5) Capture du paiement PayPal
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

        let finalUser;
        let isNewUser = false;

        // 6) Gestion utilisateur existant vs nouveau
        if (req.session.existingUserId) {
            // CAS 1: Utilisateur existant
            console.log("👤 [paypalSuccess] Traitement utilisateur existant :", req.session.existingUserId);
            finalUser = await User.findById(req.session.existingUserId);
            if (!finalUser) {
                console.log("❌ [paypalSuccess] Utilisateur existant introuvable :", req.session.existingUserId);
                return res.status(404).json({ message: "Utilisateur introuvable." });
            }
            console.log("✅ [paypalSuccess] Utilisateur existant récupéré :", finalUser.email);
            
        } else if (req.session.pendingUser) {
            // CAS 2: Nouvel utilisateur
            console.log("🆕 [paypalSuccess] Création nouvel utilisateur");
            const { nom, prenom, email, mot_de_passe, tel, pays_residence, role } = req.session.pendingUser;
            
            // Vérification finale d'unicité
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                console.log("❌ [paypalSuccess] Email déjà utilisé (après capture) :", email);
                return res.status(400).json({ message: "Cet email est déjà utilisé." });
            }

            finalUser = await User.create({
                nom,
                prenom,
                email,
                mot_de_passe,
                tel,
                pays_residence,
                role
            });
            isNewUser = true;
            console.log("💾 [paypalSuccess] Nouvel utilisateur créé :", {
                id: finalUser._id,
                email: finalUser.email
            });
        } else {
            console.log("❌ [paypalSuccess] Aucune donnée utilisateur trouvée en session");
            return res.status(400).json({ message: "Données utilisateur manquantes." });
        }

        // 7) Vérifier si l'utilisateur est déjà dans le groupe du projet
        const existingGroupe = await Groupe.findOne({
            projetId: req.session.pendingProjetId,
            participantId: finalUser._id
        });

        if (existingGroupe) {
            console.log("⚠️ [paypalSuccess] Utilisateur déjà inscrit au projet");
            // Nettoyage session
            delete req.session.pendingUser;
            delete req.session.pendingOrderId;
            delete req.session.pendingProjetId;
            delete req.session.existingUserId;
            
            return res.status(400).json({
                message: "Vous êtes déjà inscrit à ce projet.",
                alreadyRegistered: true
            });
        }

        // 8) Ajouter l'utilisateur au groupe du projet
        const nouveauGroupe = await Groupe.create({
            projetId: req.session.pendingProjetId,
            participantId: finalUser._id,
            statut: 'actif'
        });
        console.log("👥 [paypalSuccess] Utilisateur ajouté au groupe :", {
            projetId: req.session.pendingProjetId,
            participantId: finalUser._id,
            groupeId: nouveauGroupe._id
        });

        // 9) Mettre à jour le projet : participants + recalcul mensualités
        const projetMisAJour = await Projet.findByIdAndUpdate(
            req.session.pendingProjetId,
            { $inc: { participantsActuels: 1 } },
            { new: true }
        );
        
        // Recalcul des mensualités avec le nouveau nombre de participants
        const nouveauxParticipants = projetMisAJour.participantsActuels;
        const nouvelleMensualiteParParticipant = calculerMensualites(
            projetMisAJour.valeurTotaleProjet, 
            projetMisAJour.duree, 
            nouveauxParticipants
        );
        const nouvelleMensualiteTotale = nouvelleMensualiteParParticipant * nouveauxParticipants;
        
        // Mise à jour finale du projet avec les nouvelles mensualités
        await Projet.findByIdAndUpdate(
            req.session.pendingProjetId,
            {
                mensualiteParParticipant: nouvelleMensualiteParParticipant,
                mensualiteTotaleAPayer: nouvelleMensualiteTotale
            }
        );
        
        console.log("📊 [paypalSuccess] Projet mis à jour :", {
            participantsActuels: nouveauxParticipants,
            mensualiteParParticipant: nouvelleMensualiteParParticipant,
            mensualiteTotaleAPayer: nouvelleMensualiteTotale
        });

        // 10) Nettoyage de la session
        delete req.session.pendingUser;
        delete req.session.pendingOrderId;
        delete req.session.pendingProjetId;
        delete req.session.existingUserId;
        console.log("🧹 [paypalSuccess] Session nettoyée");

        // 11) Génération du token JWT et réponse
        const token = signToken(finalUser._id);
        console.log("🔑 [paypalSuccess] Token JWT généré");
        
        const paymentCapture = capture.result.purchase_units?.[0]?.payments?.captures?.[0];
        
        return res.status(200).json({
            success: true,
            message: isNewUser ? "Inscription réussie et ajouté au projet." : "Participation au projet confirmée.",
            user: {
                id: finalUser._id,
                nom: finalUser.nom,
                prenom: finalUser.prenom,
                email: finalUser.email,
                role: finalUser.role,
                isNewUser: isNewUser
            },
            projet: {
                id: projet._id,
                titre: projet.titre,
                participantsActuels: projet.participantsActuels + 1
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
        return res.status(500).json({ 
            success: false, 
            message: "Erreur lors de la validation du paiement.",
            error: error.message 
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