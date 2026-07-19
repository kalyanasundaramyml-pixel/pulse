const EmbeddedPostgres = require('embedded-postgres').default;

const pg = new EmbeddedPostgres({
  databaseDir: 'C:/pgtest/data',
  user: 'feedback',
  password: 'feedback',
  port: 5432,
  persistent: true,
});

const fs = require('fs');

(async () => {
  if (!fs.existsSync('C:/pgtest/data/PG_VERSION')) {
    await pg.initialise();
  }
  await pg.start();
  await pg.createDatabase('feedback').catch(() => {});
  console.log('READY');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
