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
app.set("view engine", "ejs");

const loggedInMiddleware = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }
    app.locals.pages = [{ pageTitle: "Home", pageLink: "/" }, { pageTitle: "Members", pageLink: "/members" }, { pageTitle: "Logout", pageLink: "/logout" }];
    if (req.session.user.userType === "admin") {
        app.locals.pages.push({ pageTitle: "Admin", pageLink: "/admin" });
    }
    app.locals.userType = req.session.user ? req.session.user.userType : null;
    next();
};

const logInMiddleware = (req, res, next) => {
    if (req.session.user) {
        return res.redirect("/");
    }
    app.locals.pages = [{ pageTitle: "Home", pageLink: "/" }, { pageTitle: "Login", pageLink: "/login" }, { pageTitle: "Sign Up", pageLink: "/register" }];
    app.locals.userType = req.session.user ? req.session.user.userType : null;
    next();
};

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
        app.locals.pages = [{ pageTitle: "Home", pageLink: "/" }, { pageTitle: "Members", pageLink: "/members" }, { pageTitle: "Logout", pageLink: "/logout" }];
        if (req.session.user.userType === "admin") {
            app.locals.pages.push({ pageTitle: "Admin", pageLink: "/admin" });
            app.locals.userType = req.session.user.userType;
        }
        return res.render("index", { name: req.session.user.name });
    } else {
        app.locals.pages = [{ pageTitle: "Home", pageLink: "/" }, { pageTitle: "Login", pageLink: "/login" }, { pageTitle: "Sign Up", pageLink: "/register" }];
        return res.render("index", { name: null });
    }
    
});

app.get("/logout", (req, res) => {
    req.session.cookie.expires = new Date(Date.now() - 1);
    req.session.user = null;
    app.locals.userType = null;
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).redirect("/logoutFailed");
        }
        res.status(200).redirect("/");
    });
});

app.get("/login", logInMiddleware, (req, res) => {
    return res.render("login");
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

app.get("/register", logInMiddleware, (req, res) => {
    res.render("register");
});

app.post("/registerUser", (req, res) => {
    const { email, name, password, password2 } = req.body;
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
        password: bcrypt.hashSync(password, saltRounds),
        userType: "user",
    };
    users.insertOne(newUser).then(() => {
        req.session.user = newUser;
        res.status(200).redirect("/members");
    });

});

app.get("/members", loggedInMiddleware, (req, res) => {
    res.render("members", { name: req.session.user.name });
});

app.get("/admin", loggedInMiddleware, (req, res) => {
    users.findOne({ email: req.session.user.email })
        .then(async user => {
            if (!user) {
                return res.status(401).redirect("/");
            }
            if (user.userType === "admin") {
                return res.render("admin", { name: req.session.user.name, users: await users.find().toArray() });
            } else {
                return res.status(401).redirect("/");
            }
        })
        .catch(err => {
            console.error(err);
            res.status(500).send("Internal server error");
        });
});
app.post("/changeUserType", (req, res) => {
    if (req.session.user && req.session.user.userType === "admin") {
        console.log(req.body);
        const { email, userType } = req.body;
        const schema = Joi.object({
            email: Joi.string().email().max(40).required(),
            userType: Joi.string().valid("user", "admin").required()
        });
        const err = schema.validate({ email, userType });
        if (err.error) {
            console.log(err.error.details[0].message);
            return res.status(400).send(err.error.details[0].message);
        }
        users.updateOne({ email }, { $set: { userType } })
            .then(() => {
                console.log("User type updated");
                return res.status(200).send("User set as " + userType);
            })
            .catch(err => {
                console.error(err);
                return res.status(500).send("Internal server error");
            });
    } else {
        return res.status(401).send("Unauthorized");
    }
});
app.post("/deleteUser", (req, res) => {
    if (req.session.user && req.session.user.userType === "admin") {
        const { email } = req.body;
        users.deleteOne({ email })
            .then(() => {
                res.status(200).send("User deleted");
            })
            .catch(err => {
                console.error(err);
                res.status(500).send("Internal server error");
            });
    } else {
        res.status(401).send("Unauthorized");
    }
});

app.use((req, res, next) => {
    res.status(404).render("404");
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});