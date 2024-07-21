const mongoose = require('mongoose');

const dustbinSchema = new mongoose.Schema({
    lat: {
        type: Number,
        required: true,
    },
    lng: {
        type: Number,
        required: true,
    },
    locationId: {
        type: String,
        required: true,
    },
    deviceId: {
        type: String,
        required: true,
    },
});

const Dustbin = mongoose.model('Dustbin', dustbinSchema);

module.exports = Dustbin;

