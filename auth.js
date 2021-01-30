const passport = require('passport');
const bcrypt = require('bcryptjs');
const db = require('./db');
const LocalStrategy = require('passport-local').Strategy
const GoogleStrategy = require( 'passport-google-oauth2' ).Strategy;
const FacebookStrategy = require('passport-facebook');

const passportJWT = require("passport-jwt");
const JWTStrategy   = passportJWT.Strategy;
const ExtractJWT = passportJWT.ExtractJwt;


const checkPass = async (provided, userPass)=>bcrypt.compare(provided, userPass);


const local = function(email, pass, done) {
    db.users.findOne({ email })
    .then(user=>{
        if(!user) return done(null, false)
        checkPass(pass, user.pass)
            .then(bool=>done(null, bool?{...user, pass: 'hidden'}:false))
            .catch(err=>done(err))
    })
    .catch(err=>done(err))
}


passport.use(new LocalStrategy(local));

passport.serializeUser(function(user, done) {
    done(null, JSON.stringify(user));
});
   
passport.deserializeUser(function(user, done) {
    done(null, JSON.parse(user));
});


passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/callback",
    profileFields: ['id', 'emails']
  },
  function(accessToken, refreshToken, profile, cb){
      db.users.findOne({ email: { $in: profile.emails.map(email=>email.value)  } })
        .then(user=>cb(null, user))
        .catch(err=>cb(err, null))
  }
));

passport.use(new GoogleStrategy({
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback",
    passReqToCallback   : true
  },
  function(request, accessToken, refreshToken, profile, done) {
    db.users.findOne({ email: profile.email })
    .then(user=>done(null, user))
    .catch(err=>done(err, null))
  }
));


passport.use(new JWTStrategy({
    jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET
  },
  function (jwtPayload, done) {
    db.users.findOne({ email: jwtPayload.email })
    .then(user=>done(null, user))
    .catch(err=>done(err, null))
  }
));


module.exports = {
    checkPass,
    hash: pass=>bcrypt.hash(pass, process.env.HASH_ROUNDS*1||8),
    login: (email, pass)=>new Promise((res, rej)=>local(email, pass, (err, user)=>{ (err||!user)?rej(err||"no user"):res(user) })),
    onlyLogged: (req, res, next)=>{ if(!req.user) return res.redirect('/login'); next(); }
}