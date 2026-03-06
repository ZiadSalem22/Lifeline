require('dotenv').config();
async function main() {
  console.log('Legacy migration history marking is obsolete in the PostgreSQL-only Phase 3 runtime.');
  console.log('Use `npm run reset-db` followed by `npm run migration:run` if you need to recreate the target schema.');
}

main();
