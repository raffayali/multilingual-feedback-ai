import request from 'supertest';
import { createApp } from '../src/app';
import { MemoryRepo } from '../src/memoryRepo';
import { Label, Predictor, PredictorError } from '../src/types';

/** Fake model: "acha" -> positive, "kharab" -> negative, everything else -> neutral. */
export class FakePredictor implements Predictor {
  readonly modelVersion = 'fake-1.0';
  shouldFail = false;

  async predict(texts: string[]) {
    if (this.shouldFail) throw new PredictorError('down');
    return texts.map((t) => {
      const label: Label = t.includes('acha') ? 'positive' : t.includes('kharab') ? 'negative' : 'neutral';
      const probabilities = { negative: 0.1, neutral: 0.1, positive: 0.1 } as Record<Label, number>;
      probabilities[label] = 0.8;
      return { label, confidence: 0.8, probabilities };
    });
  }
}

export function makeApp() {
  const repo = new MemoryRepo();
  const predictor = new FakePredictor();
  const app = createApp({ repo, predictor, jwtSecret: 'test-secret-test-secret', corsOrigin: 'http://localhost:3000' });
  return { app, repo, predictor };
}

export async function registerUser(app: ReturnType<typeof makeApp>['app'], email = 'ali@example.com') {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123', name: 'Ali' });
  return res.body.token as string;
}
