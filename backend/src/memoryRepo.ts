import {
  BatchSummary, DuplicateEmailError, Label, MessageRow, Page, PredictionItem,
  Repo, Stats, User, UserWithHash,
} from './types';

interface StoredMessage extends MessageRow {
  batchId: number;
}
interface StoredBatch {
  id: number;
  userId: number;
  name: string;
  modelVersion: string;
  createdAt: string;
}

/** In-memory repository used by the automated tests (no database needed). */
export class MemoryRepo implements Repo {
  private users: UserWithHash[] = [];
  private batches: StoredBatch[] = [];
  private messages: StoredMessage[] = [];
  private nextUserId = 1;
  private nextBatchId = 1;
  private nextMessageId = 1;

  async createUser(email: string, passwordHash: string, name: string | null): Promise<User> {
    if (this.users.some((u) => u.email === email)) throw new DuplicateEmailError();
    const user: UserWithHash = {
      id: this.nextUserId++, email, name, passwordHash, createdAt: new Date().toISOString(),
    };
    this.users.push(user);
    return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
  }

  async findUserByEmail(email: string): Promise<UserWithHash | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async findUserById(id: number): Promise<User | null> {
    const u = this.users.find((x) => x.id === id);
    return u ? { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt } : null;
  }

  async createBatchWithMessages(
    userId: number, name: string, modelVersion: string, items: PredictionItem[],
  ): Promise<number> {
    const id = this.nextBatchId++;
    this.batches.push({ id, userId, name, modelVersion, createdAt: new Date().toISOString() });
    for (const it of items) {
      this.messages.push({
        id: this.nextMessageId++, batchId: id, text: it.text, predictedLabel: it.label,
        confidence: it.confidence, probabilities: it.probabilities,
        correctedLabel: null, finalLabel: it.label,
      });
    }
    return id;
  }

  private summarize(b: StoredBatch): BatchSummary {
    const msgs = this.messages.filter((m) => m.batchId === b.id);
    const count = (l: Label) => msgs.filter((m) => m.finalLabel === l).length;
    return {
      id: b.id, name: b.name, modelVersion: b.modelVersion, createdAt: b.createdAt,
      total: msgs.length, negative: count('negative'), neutral: count('neutral'), positive: count('positive'),
    };
  }

  async listBatches(userId: number): Promise<BatchSummary[]> {
    return this.batches
      .filter((b) => b.userId === userId)
      .sort((a, b) => b.id - a.id)
      .map((b) => this.summarize(b));
  }

  async getBatch(userId: number, batchId: number): Promise<BatchSummary | null> {
    const b = this.batches.find((x) => x.id === batchId && x.userId === userId);
    return b ? this.summarize(b) : null;
  }

  async listMessages(
    userId: number, batchId: number, opts: { label?: Label; page: number; pageSize: number },
  ): Promise<Page<MessageRow>> {
    const batch = this.batches.find((x) => x.id === batchId && x.userId === userId);
    if (!batch) return { items: [], total: 0, page: opts.page, pageSize: opts.pageSize };
    let msgs = this.messages.filter((m) => m.batchId === batchId);
    if (opts.label) msgs = msgs.filter((m) => m.finalLabel === opts.label);
    const start = (opts.page - 1) * opts.pageSize;
    const items = msgs.slice(start, start + opts.pageSize).map(({ batchId: _b, ...rest }) => rest);
    return { items, total: msgs.length, page: opts.page, pageSize: opts.pageSize };
  }

  async correctMessage(userId: number, messageId: number, label: Label): Promise<boolean> {
    const m = this.messages.find((x) => x.id === messageId);
    if (!m) return false;
    const b = this.batches.find((x) => x.id === m.batchId);
    if (!b || b.userId !== userId) return false;
    m.correctedLabel = label;
    m.finalLabel = label;
    return true;
  }

  async stats(userId: number): Promise<Stats> {
    const ids = new Set(this.batches.filter((b) => b.userId === userId).map((b) => b.id));
    const msgs = this.messages.filter((m) => ids.has(m.batchId));
    const count = (l: Label) => msgs.filter((m) => m.finalLabel === l).length;
    const avg = msgs.length ? msgs.reduce((s, m) => s + m.confidence, 0) / msgs.length : 0;
    return {
      total: msgs.length, negative: count('negative'), neutral: count('neutral'), positive: count('positive'),
      averageConfidence: Math.round(avg * 10000) / 10000,
      lowConfidence: msgs.filter((m) => m.confidence < 0.5).length,
      corrected: msgs.filter((m) => m.correctedLabel !== null).length,
    };
  }
}
