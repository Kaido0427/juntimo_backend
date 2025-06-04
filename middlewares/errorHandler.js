// Middleware de gestion des erreurs
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);

    // Réponse en JSON avec le type et le message de l'erreur
    res.status(err.status || 500).json({
        type: err.name || 'Erreur serveur',
        message: err.message || 'Une erreur est survenue'
    });
};

module.exports = errorHandler;