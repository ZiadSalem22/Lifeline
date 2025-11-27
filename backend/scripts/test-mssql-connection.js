require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const sql = require('mssql');
const msnodesqlv8 = require('mssql/msnodesqlv8');

const connString = process.env.MSSQL_URL;

const normalizeConnString = (raw) => {
    if (!raw) return raw;
    const trimmed = raw.replace(/;+$/, '');
    if (/driver=/i.test(trimmed)) {
        return trimmed;
    }
    // Prefer modern ODBC Driver 17 which supports LocalDB resolution.
    return `${trimmed};Driver={ODBC Driver 17 for SQL Server};`;
};

if (!connString) {
    console.error('MSSQL_URL not defined');
    process.exit(1);
}

sql.connect({
    driver: msnodesqlv8,
    options: {
        connectionString: normalizeConnString(connString),
        trustedConnection: true,
        trustServerCertificate: true
    }
})
    .then(pool => {
        console.log('Connected OK');
        return pool.request().query('SELECT @@VERSION AS version');
    })
    .then(result => {
        console.log('Query result:', result.recordset[0]);
        return sql.close();
    })
    .catch(err => {
        console.error('Connection failed:', err);
        if (err && err.originalError) {
            console.error('Original error keys:', Object.keys(err.originalError));
            console.error('Original error message:', err.originalError.message);
            console.error('Original error toString:', String(err.originalError));
            console.error('Original error inspect:', require('util').inspect(err.originalError, { depth: null }));
        }
        try {
            console.error('Error JSON:', JSON.stringify(err));
        } catch (jsonErr) {
            console.error('Error stringify failed:', jsonErr.message);
        }
        process.exit(1);
    });
