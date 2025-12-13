require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const sql = require('mssql');

const config = {
    user: process.env.MSSQL_USERNAME,
    password: process.env.MSSQL_PASSWORD,
    server: process.env.MSSQL_SERVER,
    database: process.env.MSSQL_DATABASE,
    port: parseInt(process.env.MSSQL_PORT || '1433', 10),
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

console.log('Testing connection with config:', {
    ...config,
    password: '****'
});

async function testConnection() {
    try {
        await sql.connect(config);
        console.log('Successfully connected to the database!');
        await sql.close();
        process.exit(0);
    } catch (err) {
        console.error('Connection failed:', err);
        process.exit(1);
    }
}

testConnection();
