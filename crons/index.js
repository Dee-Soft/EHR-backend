const fs = require('fs');
const path = require('path');

function startAllCrons() {
    const cronDir = __dirname;

    fs.readdirSync(cronDir).forEach(file => {
        const fullPath = path.join(cronDir, file);

        if (file !== 'index.js' && path.extname(file) === '.js') {
            console.log(`Starting cron job: ${file}`);
            const cronJob = require(fullPath);
            if (typeof cronJob === 'function') {
                cronJob();
            } else {
                console.warn(`⚠️ Skipped ${file}: Not a function export`);
            }
        }
    });
}

module.exports = startAllCrons;