import { describe, expect, it } from 'vitest';
import { HttpPredictor } from '../src/predictor';
import { PredictorError } from '../src/types';

const okResult = { label: 'neutral', confidence: 0.6, probabilities: { negative: 0.2, neutral: 0.6, positive: 0.2 } };

function fakeFetch(handler: (body: { texts: string[] }) => Response | Promise<Response>): typeof fetch {
  return (async (_url: unknown, init?: RequestInit) => handler(JSON.parse(String(init?.body)))) as typeof fetch;
}

describe('HttpPredictor', () => {
  it('splits large inputs into chunks of 200 and keeps order', async () => {
    const calls: number[] = [];
    const p = new HttpPredictor('http://x', fakeFetch((body) => {
      calls.push(body.texts.length);
      return new Response(JSON.stringify({ results: body.texts.map(() => okResult) }), { status: 200 });
    }));
    const out = await p.predict(Array(450).fill('a'));
    expect(out).toHaveLength(450);
    expect(calls).toEqual([200, 200, 50]);
  });

  it('throws PredictorError when the service is unreachable', async () => {
    const p = new HttpPredictor('http://x', (async () => { throw new Error('ECONNREFUSED'); }) as typeof fetch);
    await expect(p.predict(['a'])).rejects.toBeInstanceOf(PredictorError);
  });

  it('throws PredictorError on non-200 and on wrong result count', async () => {
    const bad = new HttpPredictor('http://x', fakeFetch(() => new Response('{}', { status: 500 })));
    await expect(bad.predict(['a'])).rejects.toBeInstanceOf(PredictorError);
    const short = new HttpPredictor('http://x', fakeFetch(() => new Response(JSON.stringify({ results: [] }), { status: 200 })));
    await expect(short.predict(['a'])).rejects.toBeInstanceOf(PredictorError);
  });
});
