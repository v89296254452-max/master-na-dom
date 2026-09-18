import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "leads.db");

let dbInstance: Database.Database | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function db(): Database.Database {
  if (dbInstance) return dbInstance;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const d = new Database(DB_PATH);
  d.pragma("journal_mode = WAL");
  d.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      createdAt TEXT NOT NULL,
      name TEXT,
      phone TEXT,
      city TEXT,
      service TEXT,
      slug TEXT,
      source TEXT,
      offerId INTEGER,
      cityId INTEGER,
      partnerSent INTEGER DEFAULT 0,
      partnerStatus INTEGER,
      partnerError TEXT,
      partnerDuplicate INTEGER DEFAULT 0,
      sheetsOk INTEGER DEFAULT 0,
      status TEXT DEFAULT 'new',
      orderId TEXT,
      leadIdPartner TEXT,
      commission TEXT,
      postbackAt TEXT,
      clickid TEXT,
      campaign TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_leads_createdAt ON leads(createdAt);
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  `);
  // Миграция для уже существующих БД (CREATE TABLE не добавляет колонки).
  for (const [col, type] of [["clickid", "TEXT"], ["campaign", "TEXT"]] as const) {
    try { d.exec(`ALTER TABLE leads ADD COLUMN ${col} ${type}`); } catch { /* колонка уже есть */ }
  }
  dbInstance = d;
  return d;
}

/** Маскирует телефон для отображения в UI (последние 4 цифры видны). */
export function maskPhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}

export interface LeadRecord {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  city: string;
  service: string;
  slug: string;
  source: string;
  offerId: number | null;
  cityId: number | null;
  partnerSent: boolean;
  partnerStatus: number | null;
  partnerError: string | null;
  partnerDuplicate: boolean;
  sheetsOk: boolean;
  status: string; // new | approved | rejected
  orderId: string | null;
  leadIdPartner: string | null;
  commission: string | null;
  postbackAt: string | null;
  clickid: string | null;
  campaign: string | null;
}

export function insertLead(input: {
  id: string;
  name: string;
  phone: string;
  city: string;
  service: string;
  slug: string;
  source: string;
  offerId?: number;
  cityId?: number;
  partnerSent: boolean;
  partnerStatus?: number;
  partnerError?: string;
  partnerDuplicate?: boolean;
  sheetsOk: boolean;
  clickid?: string;
  campaign?: string;
}): void {
  db()
    .prepare(
      `INSERT INTO leads (id, createdAt, name, phone, city, service, slug, source, offerId, cityId, partnerSent, partnerStatus, partnerError, partnerDuplicate, sheetsOk, clickid, campaign, status)
       VALUES (@id, @createdAt, @name, @phone, @city, @service, @slug, @source, @offerId, @cityId, @partnerSent, @partnerStatus, @partnerError, @partnerDuplicate, @sheetsOk, @clickid, @campaign, 'new')`
    )
    .run({
      id: input.id,
      createdAt: nowIso(),
      name: input.name,
      phone: input.phone,
      city: input.city,
      service: input.service,
      slug: input.slug,
      source: input.source,
      offerId: input.offerId ?? null,
      cityId: input.cityId ?? null,
      partnerSent: input.partnerSent ? 1 : 0,
      partnerStatus: input.partnerStatus ?? null,
      partnerError: input.partnerError ?? null,
      partnerDuplicate: input.partnerDuplicate ? 1 : 0,
      clickid: input.clickid ?? null,
      campaign: input.campaign ?? null,
      sheetsOk: input.sheetsOk ? 1 : 0,
    });
}

/** Применить постбэк (статус/комиссия) к лиду по внутреннему id (sub_id1). */
export function applyPostback(id: string, patch: {
  status?: string;
  orderId?: string;
  leadIdPartner?: string;
  commission?: string;
}): boolean {
  const row = db().prepare("SELECT id FROM leads WHERE id = ?").get(id);
  if (!row) return false;
  db()
    .prepare(
      `UPDATE leads SET
        status = COALESCE(@status, status),
        orderId = COALESCE(@orderId, orderId),
        leadIdPartner = COALESCE(@leadIdPartner, leadIdPartner),
        commission = COALESCE(@commission, commission),
        postbackAt = @postbackAt
       WHERE id = @id`
    )
    .run({
      id,
      status: patch.status ?? null,
      orderId: patch.orderId ?? null,
      leadIdPartner: patch.leadIdPartner ?? null,
      commission: patch.commission ?? null,
      postbackAt: nowIso(),
    });
  return true;
}

export interface LeadsQuery {
  status?: string;
  service?: string;
  city?: string;
  limit?: number;
  offset?: number;
}

function rowToLead(row: Record<string, unknown>): LeadRecord {
  return {
    id: String(row.id),
    createdAt: String(row.createdAt),
    name: String(row.name ?? ""),
    phone: maskPhone(String(row.phone ?? "")),
    city: String(row.city ?? ""),
    service: String(row.service ?? ""),
    slug: String(row.slug ?? ""),
    source: String(row.source ?? ""),
    offerId: row.offerId != null ? Number(row.offerId) : null,
    cityId: row.cityId != null ? Number(row.cityId) : null,
    partnerSent: !!row.partnerSent,
    partnerStatus: row.partnerStatus != null ? Number(row.partnerStatus) : null,
    partnerError: row.partnerError ? String(row.partnerError) : null,
    partnerDuplicate: !!row.partnerDuplicate,
    sheetsOk: !!row.sheetsOk,
    status: String(row.status ?? "new"),
    orderId: row.orderId ? String(row.orderId) : null,
    leadIdPartner: row.leadIdPartner ? String(row.leadIdPartner) : null,
    commission: row.commission ? String(row.commission) : null,
    postbackAt: row.postbackAt ? String(row.postbackAt) : null,
    clickid: row.clickid ? String(row.clickid) : null,
    campaign: row.campaign ? String(row.campaign) : null,
  };
}

export function listLeads(q: LeadsQuery = {}): { items: LeadRecord[]; total: number } {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (q.status) { where.push("status = @status"); params.status = q.status; }
  if (q.service) { where.push("service = @service"); params.service = q.service; }
  if (q.city) { where.push("city = @city"); params.city = q.city; }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = (db().prepare(`SELECT COUNT(*) as c FROM leads ${whereSql}`).get(params) as { c: number }).c;
  const limit = Math.min(q.limit ?? 50, 200);
  const offset = q.offset ?? 0;
  const rows = db()
    .prepare(`SELECT * FROM leads ${whereSql} ORDER BY createdAt DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset }) as Record<string, unknown>[];

  return { items: rows.map(rowToLead), total };
}

export interface LeadsStats {
  total: number;
  today: number;
  last7d: number;
  approved: number;
  rejected: number;
  pending: number;
  totalCommission: number;
  /** Заявки, которые НЕ ушли в партнёрскую CRM (ошибка отправки) — требуют внимания. */
  partnerErrors: number;
}

export function getLeadsStats(): LeadsStats {
  const d = db();
  const total = (d.prepare("SELECT COUNT(*) c FROM leads").get() as { c: number }).c;
  const today = (
    d.prepare("SELECT COUNT(*) c FROM leads WHERE createdAt >= @d").get({ d: nowIso().slice(0, 10) }) as { c: number }
  ).c;
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const last7d = (d.prepare("SELECT COUNT(*) c FROM leads WHERE createdAt >= @d").get({ d: weekAgo }) as { c: number }).c;
  const approved = (d.prepare("SELECT COUNT(*) c FROM leads WHERE status = 'approved'").get() as { c: number }).c;
  const rejected = (d.prepare("SELECT COUNT(*) c FROM leads WHERE status = 'rejected'").get() as { c: number }).c;
  const pending = total - approved - rejected;
  const commissionRows = d.prepare("SELECT commission FROM leads WHERE commission IS NOT NULL").all() as { commission: string }[];
  const totalCommission = commissionRows.reduce((sum, r) => sum + (parseFloat(r.commission) || 0), 0);
  const partnerErrors = (d.prepare("SELECT COUNT(*) c FROM leads WHERE partnerSent = 0").get() as { c: number }).c;
  return { total, today, last7d, approved, rejected, pending, totalCommission, partnerErrors };
}

export interface CampaignRow {
  key: string; // отображаемый ключ (кампания или источник)
  source: string;
  campaign: string;
  total: number;
  sent: number;
  approved: number;
  rejected: number;
  pending: number;
  commission: number;
  /** Средний доход на принятую заявку — ориентир доходности кампании. */
  revenuePerApproved: number;
}

/** ROI по кампаниям/источникам: заявки, выкуп, доход. Числитель окупаемости —
 *  расход (стоимость Директа) знает рекламодатель, делит на это сам. */
export function getCampaignStats(): { rows: CampaignRow[] } {
  const d = db();
  // группируем по (source, campaign); пустую кампанию показываем как «(без кампании)»
  const raw = d
    .prepare(
      `SELECT
         COALESCE(NULLIF(source,''),'—') AS source,
         COALESCE(NULLIF(campaign,''),'') AS campaign,
         COUNT(*) AS total,
         SUM(CASE WHEN partnerSent=1 THEN 1 ELSE 0 END) AS sent,
         SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approved,
         SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) AS rejected,
         SUM(CASE WHEN commission IS NOT NULL THEN CAST(commission AS REAL) ELSE 0 END) AS commission
       FROM leads
       GROUP BY source, campaign
       ORDER BY commission DESC, total DESC`
    )
    .all() as Array<Record<string, number | string>>;

  const rows: CampaignRow[] = raw.map((r) => {
    const source = String(r.source);
    const campaign = String(r.campaign);
    const total = Number(r.total);
    const approved = Number(r.approved);
    const rejected = Number(r.rejected);
    const commission = Number(r.commission) || 0;
    return {
      key: campaign || source,
      source,
      campaign: campaign || "(без кампании)",
      total,
      sent: Number(r.sent),
      approved,
      rejected,
      pending: total - approved - rejected,
      commission,
      revenuePerApproved: approved > 0 ? Math.round(commission / approved) : 0,
    };
  });
  return { rows };
}
