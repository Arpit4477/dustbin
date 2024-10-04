const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const User = require('./models/User');
const SensorData = require('./models/SensorData');
const Dustbin = require('./models/Dustbin');
const Location = require('./models/Site');
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
        let locationIdsArray = [];

        // If the user is an admin, assign all locations
        if (role === 'admin') {
            const locations = await Location.find(); // Fetch all locations
            locationIdsArray = locations.map(location => location.locationId); // Extract locationId for all locations
        } else {
            locationIdsArray = Array.isArray(locationIds) ? locationIds : [locationIds]; // Use provided locationIds for non-admins
        }

        // Create the new user
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


// Route to serve the add location page
app.get('/addSite', ensureAdmin, (req, res) => {
    console.log("Reached /addSite route");
    res.sendFile(__dirname + '/public/addSite.html');
});

// Route to handle adding location
app.post('/addSite', ensureAdmin, async (req, res) => {
    const { locationId } = req.body;
    try {
        const newLocation = new Location({ locationId });
        await newLocation.save();
        // Find all admin users and update their locationIds to include the new location
        await User.updateMany(
            { role: 'admin' }, // Find all users with role 'admin'
            { $addToSet: { locationIds: locationId } } // Add the new locationId to the locationIds array without duplicates
        );
        res.status(201).send('Location ID added');
    } catch (err) {
        res.status(400).send('Error adding location ID');
    }
});

// Route to get all locations (for dynamically populating location IDs in register form)
app.get('/api/Sites', ensureAuthenticated, async (req, res) => {
    try {
        const locations = await Location.find();
        res.json(locations);
    } catch (err) {
        res.status(500).send('Error fetching locations');
    }
});


// New endpoint for receiving sensor data
app.post('/api/sensor-data', async (req, res) => {
    const { deviceID, sensor1, sensor2, battery, voltage } = req.body;
    try {
        const sensorData = new SensorData({ deviceID, sensor1, sensor2, battery, voltage });
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
        const dustbins = await Dustbin.find({ locationId: { $in: req.user.locationIds } });
        const statusPromises = dustbins.map(async dustbin => {
            const latestSensorData = await SensorData.findOne({ deviceID: dustbin.deviceId }).sort({ createdAt: -1 }).exec();
            if (latestSensorData) {
                const sensors = [latestSensorData.sensor1, latestSensorData.sensor2, latestSensorData.sensor3, latestSensorData.sensor4, latestSensorData.sensor5];
                const maxSensorValue = Math.max(...sensors);
                const fillLevel = maxSensorValue > 20 ? '100%' : maxSensorValue > 15 ? '75%' : maxSensorValue > 10 ? '50%' : '25%';
                return { ...dustbin.toObject(), fillLevel, sensor1: latestSensorData.sensor1, sensor2: latestSensorData.sensor2, sensor3: latestSensorData.sensor3, sensor4: latestSensorData.sensor4, sensor5: latestSensorData.sensor5 };
            } else {
                return { ...dustbin.toObject(), fillLevel: '25%', sensor1: 0, sensor2: 0, sensor3: 0, sensor4: 0, sensor5: 0 };
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

