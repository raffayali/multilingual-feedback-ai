import mysql, { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
  BatchSummary, DuplicateEmailError, Label, MessageRow, Page, PredictionItem,
  Repo, Stats, User, UserWithHash,
} from './types';

const FINAL = 'COALESCE(m.corrected_label, m.predicted_label)';
const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

function toUser(r: RowDataPacket): User {
  return { id: r.id, email: r.email, name: r.name, createdAt: iso(r.created_at) };
}

function toSummary(r: RowDataPacket): BatchSummary {
  return {
    id: r.id, name: r.name, modelVersion: r.model_version, createdAt: iso(r.created_at),
    total: Number(r.total), negative: Number(r.negative), neutral: Number(r.neutral), positive: Number(r.positive),
  };
}

const SUMMARY_SQL = `
  SELECT b.id, b.name, b.model_version, b.created_at,
         COUNT(m.id) AS total,
         COALESCE(SUM(${FINAL} = 'negative'), 0) AS negative,
         COALESCE(SUM(${FINAL} = 'neutral'), 0)  AS neutral,
         COALESCE(SUM(${FINAL} = 'positive'), 0) AS positive
  FROM batches b
  LEFT JOIN messages m ON m.batch_id = b.id
`;

export class MysqlRepo implements Repo {
  constructor(private readonly pool: Pool) {}

  static createPool(cfg: { host: string; port: number; user: string; password: string; database: string }): Pool {
    return mysql.createPool({ ...cfg, waitForConnections: true, connectionLimit: 10, charset: 'utf8mb4' });
  }

  async createUser(email: string, passwordHash: string, name: string | null): Promise<User> {
    try {
      const [res] = await this.pool.query<ResultSetHeader>(
        'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)', [email, passwordHash, name],
      );
      const user = await this.findUserById(res.insertId);
      if (!user) throw new Error('User was not created');
      return user;
    } catch (err) {
      if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateEmailError();
      throw err;
    }
  }

  async findUserByEmail(email: string): Promise<UserWithHash | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    return rows.length ? { ...toUser(rows[0]), passwordHash: rows[0].password_hash } : null;
  }

  async findUserById(id: number): Promise<User | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    return rows.length ? toUser(rows[0]) : null;
  }

  /** Saves a batch and all its messages in ONE transaction: all or nothing. */
  async createBatchWithMessages(
    userId: number, name: string, modelVersion: string, items: PredictionItem[],
  ): Promise<number> {
    const conn: PoolConnection = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [res] = await conn.query<ResultSetHeader>(
        'INSERT INTO batches (user_id, name, model_version) VALUES (?, ?, ?)', [userId, name, modelVersion],
      );
      const batchId = res.insertId;
      for (let i = 0; i < items.length; i += 500) {
        const rows = items.slice(i, i + 500).map((it) => [
          batchId, it.text, it.label, it.confidence,
          it.probabilities.negative, it.probabilities.neutral, it.probabilities.positive,
        ]);
        await conn.query(
          `INSERT INTO messages
             (batch_id, text, predicted_label, confidence, prob_negative, prob_neutral, prob_positive)
           VALUES ?`,
          [rows],
        );
      }
      await conn.commit();
      return batchId;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async listBatches(userId: number): Promise<BatchSummary[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `${SUMMARY_SQL} WHERE b.user_id = ? GROUP BY b.id ORDER BY b.created_at DESC, b.id DESC`, [userId],
    );
    return rows.map(toSummary);
  }

  async getBatch(userId: number, batchId: number): Promise<BatchSummary | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `${SUMMARY_SQL} WHERE b.user_id = ? AND b.id = ? GROUP BY b.id`, [userId, batchId],
    );
    return rows.length ? toSummary(rows[0]) : null;
  }

  async listMessages(
    userId: number, batchId: number, opts: { label?: Label; page: number; pageSize: number },
  ): Promise<Page<MessageRow>> {
    const where = `b.user_id = ? AND m.batch_id = ?${opts.label ? ` AND ${FINAL} = ?` : ''}`;
    const params: (string | number)[] = [userId, batchId];
    if (opts.label) params.push(opts.label);

    const [countRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM messages m JOIN batches b ON b.id = m.batch_id WHERE ${where}`, params,
    );
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT m.* FROM messages m JOIN batches b ON b.id = m.batch_id
       WHERE ${where} ORDER BY m.id LIMIT ? OFFSET ?`,
      [...params, opts.pageSize, (opts.page - 1) * opts.pageSize],
    );
    const items: MessageRow[] = rows.map((r) => ({
      id: Number(r.id), text: r.text, predictedLabel: r.predicted_label, confidence: Number(r.confidence),
      probabilities: {
        negative: Number(r.prob_negative), neutral: Number(r.prob_neutral), positive: Number(r.prob_positive),
      },
      correctedLabel: r.corrected_label, finalLabel: r.corrected_label ?? r.predicted_label,
    }));
    return { items, total: Number(countRows[0].total), page: opts.page, pageSize: opts.pageSize };
  }

  async correctMessage(userId: number, messageId: number, label: Label): Promise<boolean> {
    const [owned] = await this.pool.query<RowDataPacket[]>(
      'SELECT m.id FROM messages m JOIN batches b ON b.id = m.batch_id WHERE m.id = ? AND b.user_id = ?',
      [messageId, userId],
    );
    if (!owned.length) return false;
    await this.pool.query('UPDATE messages SET corrected_label = ? WHERE id = ?', [label, messageId]);
    return true;
  }

  async stats(userId: number): Promise<Stats> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(m.id) AS total,
              COALESCE(AVG(m.confidence), 0) AS avg_conf,
              COALESCE(SUM(m.confidence < 0.5), 0) AS low,
              COALESCE(SUM(m.corrected_label IS NOT NULL), 0) AS corrected,
              COALESCE(SUM(${FINAL} = 'negative'), 0) AS negative,
              COALESCE(SUM(${FINAL} = 'neutral'), 0)  AS neutral,
              COALESCE(SUM(${FINAL} = 'positive'), 0) AS positive
       FROM messages m JOIN batches b ON b.id = m.batch_id WHERE b.user_id = ?`,
      [userId],
    );
    const r = rows[0];
    return {
      total: Number(r.total), negative: Number(r.negative), neutral: Number(r.neutral),
      positive: Number(r.positive), averageConfidence: Math.round(Number(r.avg_conf) * 10000) / 10000,
      lowConfidence: Number(r.low), corrected: Number(r.corrected),
    };
  }
}
