const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({
    locationId: {
        type: String,
        required: true,
        unique: true
    }
});

module.exports = mongoose.model('Location', LocationSchema);
