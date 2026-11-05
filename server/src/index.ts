import { LinkRepository } from './db.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3001);
const DB_PATH = process.env.DB_PATH ?? 'golinks.db';

const repository = new LinkRepository(DB_PATH, true);
const app = createApp(repository);

const server = app.listen(PORT, () => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Go Links server listening on http://localhost:${PORT}`,
      dbPath: DB_PATH,
    }),
  );
});

const shutdown = () => {
  server.close(() => {
    repository.close();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
