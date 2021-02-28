const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
    positionName: {
        type: String,
        required: true
    },
    P: {
        type: Number,
        required: true,
        min: 0,
        max: 2
    },
    T: {
        type: Number,
        required: true,
        min: 0,
        max: 2
    },
    Z: {
        type: Number,
        required: true,
        min: 0,
        max: 2
    },
    stationIP: {
        type: String,
    }
})

const Position = mongoose.model('Position', positionSchema);

module.exports = Position;