const { Pool } = require("pg");
require("dotenv").config();
 
const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: false, // o Neon usa um certificado que o Node não reconhece por defeito
    },
});
 
module.exports = pool;
 