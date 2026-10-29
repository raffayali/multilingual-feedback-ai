import { PredictionItem, Predictor, PredictorError } from './types';

type FetchFn = typeof fetch;
const CHUNK_SIZE = 200;

/** Calls the FastAPI model service (POST /predict). */
export class HttpPredictor implements Predictor {
  readonly modelVersion = 'tfidf-svm-1.0';

  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  async predict(texts: string[]): Promise<Omit<PredictionItem, 'text'>[]> {
    const out: Omit<PredictionItem, 'text'>[] = [];
    for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
      const chunk = texts.slice(i, i + CHUNK_SIZE);
      let res: Response;
      try {
        res = await this.fetchFn(`${this.baseUrl}/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: chunk }),
        });
      } catch {
        throw new PredictorError('Model service is not reachable');
      }
      if (!res.ok) throw new PredictorError(`Model service returned status ${res.status}`);
      const data = (await res.json()) as { results?: Omit<PredictionItem, 'text'>[] };
      if (!Array.isArray(data.results) || data.results.length !== chunk.length) {
        throw new PredictorError('Model service returned an unexpected response');
      }
      out.push(...data.results);
    }
    return out;
  }
}
