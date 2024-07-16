const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const bodyParser = require('body-parser');
const User = require('./models/User');
const SensorData = require('./models/SensorData');
const Dustbin = require('./models/Dustbin');
const passportConfig = require('./config/passportConfig');

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Express session
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

passportConfig(passport);

mongoose.connect('mongodb://localhost:27017/dustbinMap', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Middleware to check if user is authenticated
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// Middleware to check if user is admin
function ensureAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.role === 'admin') {
        return next();
    }
    res.status(403).send('Forbidden');
}

// Routes
app.get('/login', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/');
    }
    res.sendFile(__dirname + '/public/login.html');
});

app.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: false
}));

app.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/login');
    });
});

app.get('/register', ensureAdmin, (req, res) => {
    res.sendFile(__dirname + '/public/register.html');
});

app.post('/register', ensureAdmin, async (req, res) => {
    const { username, password, role, locationIds } = req.body;
    try {
        // Convert locationIds string to an array
        const locationIdsArray = locationIds.split(',').map(id => id.trim());
        const newUser = new User({ username, password, role, locationIds: locationIdsArray });
        await newUser.save();
        res.status(201).send('User registered');
    } catch (err) {
        res.status(400).send('Error registering user');
    }
});

// Apply ensureAuthenticated to the homepage route
app.get('/', ensureAuthenticated, (req, res) => {
    res.sendFile(__dirname + '/public/inde.html');
});

app.get('/api/dustbins', ensureAuthenticated, async (req, res) => {
    const user = req.user;
    const dustbins = await Dustbin.find({ locationId: { $in: user.locationIds } });
    res.json(dustbins);
});

app.post('/api/dustbins', ensureAdmin, async (req, res) => {
    const { lat, lng, locationId } = req.body;
    const dustbin = new Dustbin({ lat, lng, locationId });
    await dustbin.save();
    res.status(201).json(dustbin);
});

// Route to get the current user
app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json(req.user);
    } else {
        res.status(401).send('Unauthorized');
    }
});

// New endpoint for receiving sensor data
app.post('/api/sensor-data', async (req, res) => {
    const { deviceID, sensor1, sensor2, sensor3, sensor4, sensor5 } = req.body;
    try {
        const sensorData = new SensorData({ deviceID, sensor1, sensor2, sensor3, sensor4, sensor5 });
        await sensorData.save();
        res.status(201).json(sensorData);
    } catch (err) {
        res.status(400).send('Error saving sensor data');
    }
});

// API to fetch and display sensor data
app.get('/api/sensor', ensureAuthenticated, async (req, res) => {
    const sensorData = await SensorData.find();
    res.json(sensorData);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});

