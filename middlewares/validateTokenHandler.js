const asyncHandler = require("express-async-handler");
const jwt = require('jsonwebtoken');

const validateToken = asyncHandler(async (req, res, next) => {
    let token;
    const authHeader = req.headers.Authorization || req.headers.authorization;
    
    if (authHeader && authHeader.startsWith("Bearer")) {
        token = authHeader.split(" ")[1];
        
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(401).json({ 
                    message: "Token invalide ou expiré!" 
                });
            }
           
            req.user = { id: decoded.id }; 
            next();
        });
    } else {
        return res.status(401).json({ 
            message: "Utilisateur non autorisé ou jeton de connexion manquant!" 
        });
    }
});

module.exports = validateToken;