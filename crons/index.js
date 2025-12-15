const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

function startAllCrons() {
    const cronDir = __dirname;

    fs.readdirSync(cronDir).forEach(file => {
        const fullPath = path.join(cronDir, file);

        if (file !== 'index.js' && path.extname(file) === '.js') {
            logger.info(`Starting cron job: ${file}`);
            const cronJob = require(fullPath);
            if (typeof cronJob === 'function') {
                cronJob();
            } else {
                logger.warn(`Skipped ${file}: Not a function export`);
            }
        }
    });
}

module.exports = startAllCrons;