const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    passwordHash: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['SOVEREIGN', 'GUEST'],
        default: 'GUEST'
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    // Sessions issued before this moment are refused. Changing the password bumps it,
    // which logs out every other device without needing a token blocklist.
    passwordChangedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', UserSchema);
