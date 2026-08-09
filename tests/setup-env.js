// Must run before server modules are imported so db.js / auth.js see the
// test database instead of the development one. dotenv will not override
// already-set variables.
process.env.DB_NAME = 'basud_db_test'
