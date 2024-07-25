const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const User = require('./models/User');
const SensorData = require('./models/SensorData');
const Dustbin = require('./models/Dustbin');
const passportConfig = require('./config/passportConfig');

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


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
        const locationIdsArray = Array.isArray(locationIds) ? locationIds : [locationIds];
        const newUser = new User({ username, password, role, locationIds: locationIdsArray });
        await newUser.save();
        res.status(201).send('User registered');
    } catch (err) {
        res.status(400).send('Error registering user');
    }
});

// Apply ensureAuthenticated to the homepage route
app.get('/', ensureAuthenticated, (req, res) => {
    res.render('index', { user: req.user });
});

// Route to serve the add button page
app.get('/add', ensureAdmin, (req, res) => {
    res.sendFile(__dirname + '/public/add.html'); // You need to create add.html
});

app.get('/api/dustbins', ensureAuthenticated, async (req, res) => {
    const user = req.user;
    const dustbins = await Dustbin.find({ locationId: { $in: user.locationIds } });
    res.json(dustbins);
});

app.post('/api/dustbins', ensureAdmin, async (req, res) => {
    const { lat, lng, locationId, deviceId } = req.body;
    const dustbin = new Dustbin({ lat, lng, locationId, deviceId });
    try {
        await dustbin.save();
        res.status(201).json(dustbin);
    } catch (err) {
        res.status(400).send('Error saving dustbin');
    }
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

// Route to get all users (admin only)
app.get('/api/users', ensureAdmin, async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (err) {
        res.status(500).send('Error fetching users');
    }
});

// Route to update user location IDs (admin only)
app.put('/api/users/:id', ensureAdmin, async (req, res) => {
    const { id } = req.params;
    const { locationIds } = req.body;

    try {
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).send('User not found');
        }

        user.locationIds = Array.isArray(locationIds) ? locationIds : [locationIds];
        await user.save();
        res.send('User updated successfully');
    } catch (err) {
        res.status(400).send('Error updating user');
    }
});

// Route to serve the admin page
app.get('/admin', ensureAdmin, (req, res) => {
    res.sendFile(__dirname + '/public/admin.html');
});

// API to fetch and display sensor data
app.get('/api/sensor', ensureAuthenticated, async (req, res) => {
    const sensorData = await SensorData.find();
    res.json(sensorData);
});


// New endpoint to get the latest sensor data for each dustbin
app.get('/api/dustbin-status', ensureAuthenticated, async (req, res) => {
    try {
        const dustbins = await Dustbin.find();
        const statusPromises = dustbins.map(async dustbin => {
            const latestSensorData = await SensorData.findOne({ deviceID: dustbin.deviceId }).sort({ createdAt: -1 }).exec();
            if (latestSensorData) {
                let fillLevel = '25%';
                const sensors = [latestSensorData.sensor1, latestSensorData.sensor2, latestSensorData.sensor3, latestSensorData.sensor4, latestSensorData.sensor5];
                if (sensors.some(sensor => sensor > 20)) {
                    fillLevel = '100%';
                } else if (sensors.some(sensor => sensor > 15)) {
                    fillLevel = '75%';
                } else if (sensors.some(sensor => sensor > 10)) {
                    fillLevel = '50%';
                }
                return { ...dustbin.toObject(), fillLevel };
            } else {
                return { ...dustbin.toObject(), fillLevel: 'unknown' };
            }
        });
        const statuses = await Promise.all(statusPromises);
        res.json(statuses);
    } catch (err) {
        res.status(500).send('Error fetching dustbin statuses');
    }
});



app.use(express.static('public'));

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});

