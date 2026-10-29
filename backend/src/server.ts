import { createApp } from './app';
import { config } from './config';
import { HttpPredictor } from './predictor';
import { MysqlRepo } from './mysqlRepo';

const pool = MysqlRepo.createPool(config.db);
const app = createApp({
  repo: new MysqlRepo(pool),
  predictor: new HttpPredictor(config.modelServiceUrl),
  jwtSecret: config.jwtSecret,
  corsOrigin: config.corsOrigin,
});

app.listen(config.port, () => {
  console.log(`API running on http://localhost:${config.port}`);
});
