require('dotenv').config();
const express = require('express');
const {urlencoded} = require('body-parser');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const auth = require('./auth');
const email = require('./email')
const db = require('./db');
const msgs = require('./msgs');
const jwt = require('jwt-simple');
const pug = require('pug');

const app = express();
const getMSG = req => req.query.msg?msgs[req.query.msg*1]||null:null;

const router = new express.Router();
const apiRouter = new express.Router();


app.use(urlencoded({extended: true}));
app.use(cookieParser());

router.use(require('express-session')({ secret: process.env.SESSION_SECRET, resave: true, saveUninitialized: true }));
router.use(passport.initialize());
router.use(passport.session());


app.set('view engine', 'pug')


router.get('/', (req, res) => {
    if(req.user){
        var c = typeof req.cookies.counter==="undefined"?0:req.cookies.counter*1+1;
        res.cookie("counter", c);
    }
    res.render('index', { user: req.user||null,  msg: getMSG(req), counter: c  })
});
router.get('/login', (req, res)=>{
    if(req.user){ return res.redirect('/'); }
    res.render('login', { msg: getMSG(req) });
});
router.get('/logout', (req, res)=>{
    req.logout();
    res.redirect('/');
})
router.post('/login', passport.authenticate('local', { failureRedirect: '/login?msg=4' }),
  function(req, res) {
    res.redirect('/');
});

router.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));

router.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
});

router.get('/auth/google',
 passport.authenticate('google', { scope: [ 'email', 'profile' ] }
));

router.get( '/auth/google/callback',
   passport.authenticate( 'google', {
       successRedirect: '/',
       failureRedirect: '/login',
       scope: [ 'email', 'profile' ]
}));

router.post('/register', (req, res, next)=>{
    if(req.body.password !==req.body.password2) return res.redirect('/login?msg=1')
    auth.hash(req.body.password)
        .then(hash=>db.users.insertOne({
            email: req.body.email,
            pass: hash
        }))
        .then(()=>{
            res.redirect(`/login?msg=0`);
        })
        .catch((e)=>{
            res.redirect(`/login?msg=${e.code===11000?"2":"3"}`)
        });
})
router.post('/password-change', (req, res)=>{
   const preffix = req.user?'/?':`/password-reset?t=${req.body.token}&`;
   let user = req.user;
   if(req.body.next !== req.body.next2) return res.redirect(preffix+'msg=1');
    (req.user?
        auth.login(req.user.email, req.body.current)
        :new Promise((res, rej)=>{
            const decoded = jwt.decode(req.body.token, process.env.JWT_SECRET);
            if(decoded.expiresAt < new Date()*1) throw new Error('token expired')
            db.users.findOne({ _id: db.id(decoded._id) })
                .then(user=>user?.resetToken === req.body.token?user:rej())
                .then(_user=>user=_user)
                .then(res)
                .catch(rej);
        })
    )
        .then(()=>auth.hash(req.body.next))
        .then(hash=>db.users.updateOne({ _id: db.id(user._id) }, { $set: { pass: hash, resetToken: null }  }))
        .then(({result})=>res.redirect(req.user?`${preffix}msg=${result.nModified?5:3}`:`/login?msg=${result.nModified?5:3}`))
        .catch((err)=>{
            res.redirect(`${preffix}msg=${err?3:4}`)
            if(err) console.log(err);
        });
});

router.route('/password-reset')
    .get((req, res)=>{
        db.users.findOne({ resetToken: req.query.t })
        .then(user=>{
            if(user){
                res.render('passResetPage', {...user, msg: getMSG(req)})
            }
            else {
                res.redirect(`/login?msg=${req.query.msg||7}`)
            }
        })
        .catch(console.log);
    })
    .post((req, res)=>{
        db.users.findOne({ email: req.body.email })
        .then(user=>{ if(!user) throw new Error('no user'); return user })
        .then(user=>({ user, expiresAt: new Date()*1+process.env.RESET_TOKEN_TIME*1000, host: req.headers.host }))
        .then(o=>({...o,  token: jwt.encode({ _id: o.user._id, expiresAt: o.expiresAt }, process.env.JWT_SECRET)}))
        .then(o=>new Promise((res, rej)=>db.users.updateOne(
                { _id: db.id(o.user._id) }, 
                { $set: { resetToken: o.token } 
            }).then(d=>res(o)).catch(rej)
        ))
        .then((o)=>email('resetowanie hasła - lab ai 185icb 21709', pug.renderFile('./views/passResetEmail.pug', o), o.user.email))
        .then(()=>res.redirect('/login?msg=6'))
        .catch(console.log)
    })


router.use(express.static('public'))


apiRouter.use(passport.initialize());
apiRouter.post('/login', (req, res, next)=>{
    auth.login(req.body.email, req.body.pass)
        .then(user=>res.send(jwt.encode(user, process.env.JWT_SECRET)))
        .catch(err=>res.sendStatus(401));
    
});
apiRouter.get('/me', passport.authenticate('jwt', {session: false}), (req, res, next)=>{
    res.json(req.user);
})





app.use('/api', apiRouter);
app.use('/', router);


app.listen(process.env.PORT);