const AuditLog = require('../models/AuditLog');
const { Parser } = require('json2csv');
const archiver = require('archiver');
const crypto = require('crypto');

// Function to get audit logs
exports.getAuditLogs = async (req, res) => {
    try {
        const logs = await AuditLog.find().sort({ timestamp: -1 });
        res.status(200).json(logs);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to retrieve audit logs' });
    }
};

// Function to export audit logs as CSV
exports.exportAuditLogs = async (req, res) => {
    try {
        const logs = await AuditLog.find().lean();

        const csvParser = new Parser({
            fields: ['action', 'actorId', 'targetId', 'targetType', 'details', 'timestamp'],});
        const csv = csvParser.parse(logs);

        res.header('Content-Type', 'text/csv');
        res.attachment('audit-logs.csv');
        res.status(200).send(csv);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to export audit logs' });
    }
};

// Function to export audit logs as a ZIP file
exports.exportAuditLogsZip = async (req, res) => {
    try {
        const logs = await AuditLog.find().lean();

        const csvParser = new Parser({
            fields: ['action', 'actorId', 'targetId', 'targetType', 'details', 'timestamp'],
        });
        const csv = csvParser.parse(logs);

        const adminId = req.user.id;
        const password = crypto.createHash('sha256')
        .update(adminId + process.env.AUDIT_LOG_SALT)
        .digest('hex')
        .slice(0, 32); // Generate a random password for the ZIP file

        const key = crypto.scryptSync(password, 'audit_salt', 32);
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        const encrypted = Buffer.concat([cipher.update(csv, 'utf8'), cipher.final()]);

        const dycryptScript = `
const fs = require('fs');
const crypto = require('crypto');

const enc = fs.readFileSync('audit-logs.csv.enc');
const iv = Buffer.from(fs.readFileSync('iv.txt', 'utf8'), 'hex');
const password = '${password}';

const key = crypto.scryptSync(password, 'audit_salt', 32);
const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
const decrypted = Buffer.concat([decipher.update(enc), decipher.final()]);
fs.writeFileSync('decrypted.csv', decrypted);
console.log('Decryption complete. Check decrypted.csv');
        `;

        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': 'attachment; filename=audit-logs-encrypted.zip',
        });

        const archive = archiver('zip');
        archive.pipe(res);
        archive.append(encrypted, { name: 'audit-logs.csv.enc' });
        archive.append(iv.toString('hex'), { name: 'iv.txt' });
        archive.append(dycryptScript, { name: 'decrypt.js' });
        await archive.finalize();
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to export audit logs as ZIP' });
    }
};