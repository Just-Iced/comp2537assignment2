require('dotenv').config();

const express = require('express');
const { MongoClient } = require('mongodb');
const MongoStore = require('connect-mongo');
const session = require('express-session');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const saltRounds = 12;

const expireAge = 60 * 60 * 1000; //60 minutes * 60 seconds * 1000 milliseconds

const app = express();
app.use(express.static(__dirname + "/public"));
const client = new MongoClient(process.env.MONGO_URI);
const users = client.db("test").collection("users");
client.connect()
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((err) => {
        console.error('Error connecting to MongoDB:', err);
    });
const mongoStore = MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    autoRemove: 'interval',
    autoRemoveInterval: 1,
    crypto: {
        secret: process.env.MONGO_SESSION_SECRET,
    }
});

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: false,
    store: mongoStore,
    cookie: {
        maxAge: expireAge
    },
}));

app.get("/", (req, res) => {
    if (req.session.user) {
        return res.sendFile(__dirname + "/public/loggedIn.html");
    } else {
        return res.sendFile(__dirname + "/public/loggedOut.html");
    }
});

app.get("/logout", (req, res) => {
    req.session.cookie.expires = new Date(Date.now() - 1);
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send("<h1>Error logging out</h1><br><a href='/'>Go back</a>");
        }
        
        res.status(200).redirect("/");
    });
});

app.get("/login", (req, res) => {
    res.sendFile(__dirname + "/public/login.html");
});

app.post("/loginUser", (req, res) => {
    const { email, password } = req.body;
    const schema = Joi.object({
        email: Joi.string().email().max(40).required(),
        password: Joi.string().min(6).max(20).required()
    });
    const err = schema.validate({ email, password });
    if (err.error) {
        return res.status(400).send(err.error.details[0].message);
    }
    users.findOne({ email })
        .then(user => {
            if (!user) {
                return res.status(400).send("User not found");
            }
            bcrypt.compare(password, user.password, (err, result) => {
                if (err) {
                    return res.status(500).send(`<h1>${err.error.details[0].message}</h1> <br><a href='/login'>Try again</a>`);
                }
                if (result) {
                    req.session.user = user;
                    req.session.cookie.maxAge = expireAge;
                    req.session.cookie.expires = new Date(Date.now() + expireAge);
                    return res.status(200).redirect("/");
                } else {
                    return res.status(400).send("<h1>Invalid email/password</h1><br><a href='/login'>Try again</a>");
                }
            });
        })
        .catch(err => {
            console.error(err);
            res.status(500).send("Internal server error");
        });
});

app.get("/register", (req, res) => {
    res.sendFile(__dirname + "/public/signup.html");
});

app.post("/registerUser", (req, res) => {
    const {email, name, password, password2} = req.body;
    const schema = Joi.object({
        email: Joi.string().email().max(40).required(),
        name: Joi.string().min(3).max(20).required(),
        password: Joi.string().min(6).max(20).required(),
        password2: Joi.string().valid(Joi.ref('password')).required()
    });
    const err = schema.validate({ email, name, password, password2 });
    if (err.error) {
        return res.status(400).send(`<h1>${err.error.details[0].message}</h1> <br><a href='/register'>Try again</a>`);
    }
    const newUser = {
        email,
        name,
        password: bcrypt.hashSync(password, saltRounds)
    };
    users.insertOne(newUser).then(() => {
        req.session.user = newUser;
        res.status(200).redirect("/members");
    });
    
});

app.get("/members", (req, res) => {
    if (req.session.user) {
        res.sendFile(__dirname + "/public/members.html");
    } else {
        res.status(401).redirect("/");
    }
});

app.post("/getUserName", (req, res) => {
    if (req.session.user) {
        console.log(req.session.user);
        res.status(200).send({name: req.session.user.name});
    } else {
        res.status(401).send("Unauthorized");
    }
});

app.use((req, res, next) => {
    res.status(404).send("Page not found. <br><a href='/'>Go back</a>");
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});