const cron = require('node-cron');
const rotateKeys = require('../scripts/rotateKeys');

function startKeyRotation() {
    console.log('Setting up key rotation cron job...');
    // Run daily at 3 AM
    cron.schedule('0 3 * * *', () => {
        console.log('Running scheduled key rotation (3 AM daily)...');
        rotateKeys();
    });
}

module.exports = startKeyRotation;
