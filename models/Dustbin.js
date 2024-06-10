// models/Dustbin.js
const mongoose = require('mongoose');

const DustbinSchema = new mongoose.Schema({
    lat: {
        type: Number,
        required: true
    },
    lng: {
        type: Number,
        required: true
    },
    locationId: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('Dustbin', DustbinSchema);

