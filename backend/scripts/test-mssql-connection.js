require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const sql = require('mssql');

// Extract components from your MSSQL_URL
// Example MSSQL_URL:
//  SERVER=myserver;DATABASE=mydb;USER=user;PASSWORD=pass;PORT=1433
const parseConnString = (connString) => {
    const parts = connString.split(';').filter(Boolean);
    const config = {};

    for (const part of parts) {
        const [key, value] = part.split('=');
        config[key.trim().toUpperCase()] = value.trim();
    }

    return {
        user: config.USER,
        password: config.PASSWORD,
        server: config.SERVER,
        database: config.DATABASE,
        port: config.PORT ? parseInt(config.PORT) : 1433,
        options: {
            encrypt: true,               // change to true if using Azure SQL
            trustServerCertificate: true  // allow self-signed certs
        }
    };
};

const connString = process.env.MSSQL_URL;

if (!connString) {
    console.error('MSSQL_URL is not defined in .env');
    process.exit(1);
}

const dbConfig = parseConnString(connString);

let connectionPool;

async function getPool() {
    if (!connectionPool) {
        try {
            connectionPool = await sql.connect(dbConfig);
            console.log('Connected to SQL Server successfully.');
        } catch (error) {
            console.error('SQL Connection Error:', error);
            process.exit(1);
        }
    }
    return connectionPool;
}

module.exports = {
    sql,
    getPool
};
