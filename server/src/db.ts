import Database from 'better-sqlite3';
import { AppError, type GoLink } from './types.js';
import type { CreateLinkInput } from './schemas.js';

interface LinkRow {
  id: number;
  slug: string;
  target_url: string;
  description: string;
  clicks: number;
  created_at: string;
  last_accessed_at: string | null;
}

function mapRowToGoLink(row: LinkRow): GoLink {
  return {
    id: row.id,
    slug: row.slug,
    targetUrl: row.target_url,
    description: row.description,
    clicks: row.clicks,
    createdAt: row.created_at,
    lastAccessedAt: row.last_accessed_at,
  };
}

const DEFAULT_SEED_LINKS: Array<CreateLinkInput & { clicks: number }> = [
  {
    slug: 'design-system',
    targetUrl: 'https://m3.material.io/',
    description: 'Core UI components, design tokens, and accessibility guidelines',
    clicks: 42,
  },
  {
    slug: 'oncall',
    targetUrl: 'https://www.pagerduty.com/',
    description: 'Primary engineering on-call rotation schedule and incident runbooks',
    clicks: 28,
  },
  {
    slug: 'payroll',
    targetUrl: 'https://gusto.com/',
    description: 'Employee payroll portal, benefits administration, and tax documents',
    clicks: 19,
  },
];

export class LinkRepository {
  private readonly db: Database.Database;

  constructor(dbPath = 'golinks.db', seedDefaults = true) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
    if (seedDefaults) {
      this.seedIfEmpty();
    }
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
        target_url TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        clicks INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        last_accessed_at TEXT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_links_slug ON links(slug);
    `);
  }

  private seedIfEmpty(): void {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM links').get() as { count: number };
    if (row.count > 0) {
      return;
    }

    const now = new Date().toISOString();
    const insertStmt = this.db.prepare(`
      INSERT INTO links (slug, target_url, description, clicks, created_at, last_accessed_at)
      VALUES (@slug, @targetUrl, @description, @clicks, @createdAt, @lastAccessedAt)
    `);

    const seedTx = this.db.transaction(() => {
      for (const item of DEFAULT_SEED_LINKS) {
        insertStmt.run({
          slug: item.slug,
          targetUrl: item.targetUrl,
          description: item.description,
          clicks: item.clicks,
          createdAt: now,
          lastAccessedAt: now,
        });
      }
    });

    seedTx();
  }

  public healthCheck(): boolean {
    const row = this.db.prepare('SELECT 1 as ok').get() as { ok: number } | undefined;
    return row?.ok === 1;
  }

  public list(searchQuery = ''): GoLink[] {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      const rows = this.db
        .prepare(
          `SELECT id, slug, target_url, description, clicks, created_at, last_accessed_at
           FROM links
           ORDER BY clicks DESC, id DESC`,
        )
        .all() as LinkRow[];
      return rows.map(mapRowToGoLink);
    }

    const pattern = `%${trimmed.replace(/^go\/+/i, '')}%`;
    const rows = this.db
      .prepare(
        `SELECT id, slug, target_url, description, clicks, created_at, last_accessed_at
         FROM links
         WHERE slug LIKE @pattern
            OR description LIKE @pattern
            OR target_url LIKE @pattern
         ORDER BY clicks DESC, id DESC`,
      )
      .all({ pattern }) as LinkRow[];

    return rows.map(mapRowToGoLink);
  }

  public findBySlug(slug: string): GoLink | null {
    const row = this.db
      .prepare(
        `SELECT id, slug, target_url, description, clicks, created_at, last_accessed_at
         FROM links
         WHERE slug = ?`,
      )
      .get(slug) as LinkRow | undefined;

    return row ? mapRowToGoLink(row) : null;
  }

  public create(input: CreateLinkInput): GoLink {
    const existing = this.findBySlug(input.slug);
    if (existing) {
      throw new AppError(
        409,
        'SLUG_ALREADY_EXISTS',
        `The shortcut 'go/${input.slug}' already exists.`,
        { slug: [`Shortcut 'go/${input.slug}' is already registered`] },
      );
    }

    const now = new Date().toISOString();
    const info = this.db
      .prepare(
        `INSERT INTO links (slug, target_url, description, clicks, created_at, last_accessed_at)
         VALUES (@slug, @targetUrl, @description, 0, @createdAt, NULL)`,
      )
      .run({
        slug: input.slug,
        targetUrl: input.targetUrl,
        description: input.description,
        createdAt: now,
      });

    const row = this.db
      .prepare(
        `SELECT id, slug, target_url, description, clicks, created_at, last_accessed_at
         FROM links
         WHERE id = ?`,
      )
      .get(info.lastInsertRowid) as LinkRow;

    return mapRowToGoLink(row);
  }

  public recordVisitAndGetTarget(slug: string): GoLink | null {
    const now = new Date().toISOString();
    const visitTx = this.db.transaction((targetSlug: string): GoLink | null => {
      const existing = this.findBySlug(targetSlug);
      if (!existing) {
        return null;
      }

      this.db
        .prepare(
          `UPDATE links
           SET clicks = clicks + 1,
               last_accessed_at = @now
           WHERE id = @id`,
        )
        .run({ id: existing.id, now });

      return {
        ...existing,
        clicks: existing.clicks + 1,
        lastAccessedAt: now,
      };
    });

    return visitTx(slug);
  }

  public deleteById(id: number): boolean {
    const result = this.db.prepare('DELETE FROM links WHERE id = ?').run(id);
    return result.changes > 0;
  }

  public close(): void {
    this.db.close();
  }
}
