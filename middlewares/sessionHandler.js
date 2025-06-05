// sessions.js

const session = require('express-session');
const MongoStore = require('connect-mongo');

const sessionMiddleware = session({
  name: 'juntimo.sid',
  secret: process.env.SESSION_SECRET ,
  resave: false,
  saveUninitialized: false,

  // --- Persistons la session dans MongoDB ---
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 7 * 24 * 60 * 60,    // 7 jours
    touchAfter: 24 * 3600,    // mettre à jour la session au maximum toutes les 24h
    autoRemove: 'native',
    stringify: false,
  }),

  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // en prod HTTPS=true, en dev HTTP=false
    sameSite: 'lax',     // <— impératif pour qu’un GET externe (PayPal) renvoie le cookie
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
  },
});

const sessionDebugMiddleware = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Session Debug:', {
      route: req.path,
      method: req.method,
      sessionID: req.sessionID,
      hasSession: !!req.session,
      pendingUser: !!req.session?.pendingUser,
      pendingOrderId: req.session?.pendingOrderId,
      cookieHeader: req.headers.cookie ? 'présent' : 'absent',
    });
  }
  next();
};

module.exports = {
  sessionMiddleware,
  sessionDebugMiddleware,
};
