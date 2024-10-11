// models/SensorData.js
const mongoose = require('mongoose');

const SensorDataSchema = new mongoose.Schema({
    ID: {
        type: String,
        required: true
    },
    s1: Number,
    s2: Number,
    b: Number,
    v: Number,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('SensorData', SensorDataSchema);

