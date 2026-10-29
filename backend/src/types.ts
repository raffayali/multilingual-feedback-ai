export type Label = 'negative' | 'neutral' | 'positive';
export const LABELS: Label[] = ['negative', 'neutral', 'positive'];

export function isLabel(value: unknown): value is Label {
  return typeof value === 'string' && (LABELS as string[]).includes(value);
}

export interface User {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface UserWithHash extends User {
  passwordHash: string;
}

export interface PredictionItem {
  text: string;
  label: Label;
  confidence: number;
  probabilities: Record<Label, number>;
}

export interface BatchSummary {
  id: number;
  name: string;
  modelVersion: string;
  createdAt: string;
  total: number;
  negative: number;
  neutral: number;
  positive: number;
}

export interface MessageRow {
  id: number;
  text: string;
  predictedLabel: Label;
  confidence: number;
  probabilities: Record<Label, number>;
  correctedLabel: Label | null;
  finalLabel: Label;
}

export interface Stats {
  total: number;
  negative: number;
  neutral: number;
  positive: number;
  averageConfidence: number;
  lowConfidence: number; // predictions with confidence below 0.5
  corrected: number; // messages fixed by a human
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export class DuplicateEmailError extends Error {
  constructor() {
    super('Email already registered');
  }
}

export interface Repo {
  createUser(email: string, passwordHash: string, name: string | null): Promise<User>;
  findUserByEmail(email: string): Promise<UserWithHash | null>;
  findUserById(id: number): Promise<User | null>;
  createBatchWithMessages(
    userId: number,
    name: string,
    modelVersion: string,
    items: PredictionItem[],
  ): Promise<number>;
  listBatches(userId: number): Promise<BatchSummary[]>;
  getBatch(userId: number, batchId: number): Promise<BatchSummary | null>;
  listMessages(
    userId: number,
    batchId: number,
    opts: { label?: Label; page: number; pageSize: number },
  ): Promise<Page<MessageRow>>;
  correctMessage(userId: number, messageId: number, label: Label): Promise<boolean>;
  stats(userId: number): Promise<Stats>;
}

export interface Predictor {
  readonly modelVersion: string;
  predict(texts: string[]): Promise<Omit<PredictionItem, 'text'>[]>;
}

export class PredictorError extends Error {}
