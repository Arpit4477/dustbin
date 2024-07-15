// models/SensorData.js
const mongoose = require('mongoose');

const SensorDataSchema = new mongoose.Schema({
    deviceID: {
        type: String,
        required: true
    },
    sensor1: Number,
    sensor2: Number,
    sensor3: Number,
    sensor4: Number,
    sensor5: Number,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('SensorData', SensorDataSchema);

