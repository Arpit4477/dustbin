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

// Serve the dustbin data page with EJS
app.get('/dustbin-data', ensureAuthenticated, (req, res) => {
    res.render('dustbin-data', { user: req.user });
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
        res.status(400).send('400');
    }
});

// Route to get the current user
app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json(req.user);
    } else {
        res.status(401).send('401');
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
        // Check if the location already exists
        const existingLocation = await Location.findOne({ locationId });
        if (existingLocation) {
            return res.status(400).send('400');
        }

        // If it doesn't exist, create a new location
        const newLocation = new Location({ locationId });
        await newLocation.save();

        // Update all admin users to include the new location in their locationIds
        await User.updateMany(
            { role: 'admin' }, // Find all admin users
            { $addToSet: { locationIds: locationId } } // Add new location to their locationIds array
        );

        res.status(201).send('201');
    } catch (err) {
        res.status(400).send('400');
    }
});


// Route to get all locations (for dynamically populating location IDs in register form)
app.get('/api/Sites', ensureAuthenticated, async (req, res) => {
    try {
        const locations = await Location.find();
        res.json(locations);
    } catch (err) {
        res.status(500).send('500');
    }
});


// GET route to handle query parameters
app.get('/api/sensor-data', async (req, res) => {
    const { ID, s1, s2, b, v } = req.query; // Extract data from query params
    try {
        const sensorData = new SensorData({ ID, s1, s2, b, v });
        await sensorData.save();
        res.status(201).send('201');
    } catch (err) {
        res.status(400).send('400');
    }
});

// Fetch the last 5 sensor entries for a specific dustbin
app.get('/api/sensors/:ID', async (req, res) => {
    const { ID } = req.params;
    try {
        const sensorData = await SensorData.find({ ID })
            .sort({ createdAt: -1 }) // Sort by createdAt in descending order
            .limit(5); // Limit to 5 entries
        res.json(sensorData);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch sensor data' });
    }
});

app.get('/api/sensors/all/:ID', async (req, res) => {
    const { ID } = req.params;
    try {
        const sensorData = await SensorData.find({ ID });
        res.json(sensorData);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching sensor data' });
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

// DELETE route to remove a site by its ID
app.delete('/api/sites/:siteId', async (req, res) => {
    const { siteId } = req.params;

    try {
        // Find and remove the site by its ID
        const deletedSite = await Location.findByIdAndDelete(siteId);

        if (deletedSite) {
            res.status(200).send(`Site with ID ${siteId} deleted successfully`);
        } else {
            res.status(404).send('404');
        }
    } catch (err) {
        res.status(500).send('500');
    }
});

// Import your Dustbin model (adjust the path as necessary)
const Dustbin = require('./models/dustbin');

// DELETE request to delete a dustbin by deviceId
app.delete('/api/dustbins/delete/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;

        // Find and delete the dustbin by deviceId
        const deletedDustbin = await Dustbin.findOneAndDelete({ deviceId });

        if (deletedDustbin) {
            res.status(200).json({ message: 'Dustbin deleted successfully.' });
        } else {
            res.status(404).json({ message: 'Dustbin not found.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error. Could not delete dustbin.', error });
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
            const latestSensorData = await SensorData.findOne({ ID: dustbin.deviceId }).sort({ createdAt: -1 }).exec();
            if (latestSensorData) {
                const sensors = [latestSensorData.s1, latestSensorData.s2];
                const maxSensorValue = Math.max(...sensors);
                const fillLevel = maxSensorValue > 20 ? '100%' : maxSensorValue > 15 ? '75%' : maxSensorValue > 10 ? '50%' : '25%';
                return { ...dustbin.toObject(), fillLevel, s1: latestSensorData.s1, s2: latestSensorData.s2, b: latestSensorData.b, v: latestSensorData.v };
            } else {
                return { ...dustbin.toObject(), fillLevel: '25%', s1: 0, s2: 0, b: 0, v: 0 };
            }
        });
        const statuses = await Promise.all(statusPromises);
        res.json(statuses);
    } catch (err) {
        res.status(500).send('500');
    }
});




app.use(express.static('public'));

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});

