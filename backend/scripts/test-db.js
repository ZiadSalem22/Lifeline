require('dotenv').config();
const { AppDataSource } = require('../src/infra/db/data-source');

console.log("Attempting to connect to SQL Express...");
console.log("Host:", process.env.MSSQL_HOST);
console.log("Instance:", process.env.MSSQL_INSTANCE);
console.log("Database:", process.env.MSSQL_DATABASE);
console.log("Port:", process.env.MSSQL_PORT);

AppDataSource.initialize()
    .then(() => {
        console.log("====================================");
        console.log("  ✔ CONNECTED TO SQL EXPRESS SUCCESSFULLY");
        console.log("====================================");
        return AppDataSource.destroy();
    })
    .catch(err => {
        console.log("====================================");
        console.error("❌ CONNECTION FAILED");
        console.error(err);
        console.log("====================================");
    });