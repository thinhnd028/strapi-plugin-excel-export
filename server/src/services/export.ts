import ExcelJS from 'exceljs';
import type { Core } from '@strapi/strapi';

// Attribute types never exported (sensitive or meaningless in a spreadsheet).
const SKIPPED_TYPES = new Set(['password']);

// System fields laid out at the start/end of the sheet.
const LEADING_FIELDS = ['id', 'documentId'];
const TRAILING_FIELDS = ['createdAt', 'updatedAt', 'publishedAt', 'locale'];
// System fields removed from the data area (handled separately or too noisy).
const SYSTEM_FIELDS = new Set([
  ...LEADING_FIELDS,
  ...TRAILING_FIELDS,
  'createdBy',
  'updatedBy',
  'localizations',
]);

// Priority order when picking a display label for a relation/media target.
const LABEL_FIELD_PRIORITY = [
  'name',
  'title',
  'fullName',
  'displayName',
  'label',
  'username',
  'email',
  'slug',
];

const PAGE_SIZE = 100;
const MAX_CELL_LENGTH = 32000; // safe bound for a single Excel cell (~32767)
const MAX_COL_WIDTH = 60;

export interface ExportOptions {
  createdAtFrom?: string;
  createdAtTo?: string;
}

const exportService = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Builds a .xlsx buffer with the records of one collectionType.
   *
   * @param uid e.g. 'api::contact-request.contact-request'
   * @param options optional createdAt range filter (both bounds optional)
   */
  async generate(uid: string, options: ExportOptions = {}) {
    const contentType: any = strapi.contentType(uid as any);
    if (!contentType || contentType.kind !== 'collectionType') {
      throw new Error(`Invalid content-type or not a collectionType: ${uid}`);
    }

    const filters = this.buildCreatedAtFilter(options);
    const attributes = contentType.attributes || {};

    // 1. Data columns (schema order), skipping hidden/private/sensitive fields.
    const dataFields = Object.keys(attributes).filter((key) => {
      const attr = attributes[key];
      if (!attr) return false;
      if (SYSTEM_FIELDS.has(key)) return false;
      if (SKIPPED_TYPES.has(attr.type)) return false;
      if (attr.private === true) return false;
      return true;
    });

    const hasDraftAndPublish = contentType.options?.draftAndPublish === true;
    const columns = [
      ...LEADING_FIELDS,
      ...dataFields,
      ...TRAILING_FIELDS.filter((f) => {
        if (f === 'publishedAt' && !hasDraftAndPublish) return false;
        return f in attributes;
      }),
    ];

    // 2. Populate object for relational fields.
    const populate = this.buildPopulate(attributes);

    // 3. Fetch all records (paginated to avoid memory spikes).
    const rows: any[] = [];
    let start = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batch: any[] = await strapi.documents(uid as any).findMany({
        populate,
        filters,
        sort: 'createdAt:asc',
        limit: PAGE_SIZE,
        start,
      } as any);
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      start += PAGE_SIZE;
    }

    // 4. Build the workbook.
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Strapi Excel Export';
    workbook.created = new Date();

    const sheetName = this.sanitizeSheetName(
      contentType.info?.displayName || contentType.info?.pluralName || 'Data'
    );
    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.columns = columns.map((key) => ({
      header: this.columnHeader(key),
      key,
      width: 20,
    }));
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle' };

    const colWidths = columns.map((key) => this.columnHeader(key).length);
    for (const entry of rows) {
      const rowValues: Record<string, any> = {};
      columns.forEach((key, idx) => {
        const value = this.formatValue(attributes[key], entry[key]);
        rowValues[key] = value;
        const len = value == null ? 0 : String(value).length;
        if (len > colWidths[idx]) colWidths[idx] = len;
      });
      worksheet.addRow(rowValues);
    }

    worksheet.columns.forEach((col, idx) => {
      col.width = Math.min(MAX_COL_WIDTH, Math.max(12, colWidths[idx] + 2));
    });

    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = this.buildFilename(contentType);

    return { buffer: Buffer.from(buffer as ArrayBuffer), filename, count: rows.length };
  },

  /**
   * Builds a createdAt range filter. Both bounds are optional.
   * Returns {} when no valid bound is provided.
   */
  buildCreatedAtFilter({ createdAtFrom, createdAtTo }: ExportOptions = {}) {
    const createdAt: Record<string, string> = {};
    const from = this.parseDate(createdAtFrom);
    const to = this.parseDate(createdAtTo);
    if (from) createdAt.$gte = from.toISOString();
    if (to) createdAt.$lte = to.toISOString();
    return Object.keys(createdAt).length ? { createdAt } : {};
  },

  parseDate(value?: string): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  },

  buildPopulate(attributes: Record<string, any>) {
    const populate: Record<string, true> = {};
    for (const [key, attr] of Object.entries(attributes)) {
      if (!attr) continue;
      if (['relation', 'media', 'component', 'dynamiczone'].includes(attr.type)) {
        populate[key] = true;
      }
    }
    return populate;
  },

  formatValue(attr: any, value: any): string | number {
    if (value === null || value === undefined) return '';
    const type = attr?.type;

    switch (type) {
      case 'relation':
        return this.truncate(this.formatRelation(attr, value));
      case 'media':
        return this.truncate(this.formatMedia(value));
      case 'component':
      case 'dynamiczone':
      case 'json':
        return this.truncate(this.safeJson(value));
      case 'boolean':
        return value ? 'true' : 'false';
      case 'date':
      case 'datetime':
      case 'timestamp':
      case 'time':
        return String(value);
      case 'integer':
      case 'biginteger':
      case 'decimal':
      case 'float':
        return typeof value === 'number' ? value : Number(value) || String(value);
      default:
        if (typeof value === 'object') return this.truncate(this.safeJson(value));
        return this.truncate(String(value));
    }
  },

  formatRelation(attr: any, value: any): string {
    const targetAttrs = (strapi.contentType(attr.target) as any)?.attributes || {};
    const labelField = this.pickLabelField(targetAttrs);
    const toLabel = (item: any): string => {
      if (item == null) return '';
      if (typeof item !== 'object') return String(item);
      const label = item[labelField];
      if (label !== undefined && label !== null && label !== '') return String(label);
      return item.documentId || item.id || '';
    };

    if (Array.isArray(value)) {
      return value.map(toLabel).filter(Boolean).join(', ');
    }
    return toLabel(value);
  },

  formatMedia(value: any): string {
    const toLabel = (file: any): string => {
      if (file == null) return '';
      if (typeof file !== 'object') return String(file);
      return file.url ? `${file.name || file.hash || 'file'} (${file.url})` : file.name || '';
    };
    if (Array.isArray(value)) {
      return value.map(toLabel).filter(Boolean).join(', ');
    }
    return toLabel(value);
  },

  pickLabelField(targetAttrs: Record<string, any>): string {
    for (const candidate of LABEL_FIELD_PRIORITY) {
      if (
        targetAttrs[candidate] &&
        ['string', 'text', 'email', 'uid'].includes(targetAttrs[candidate].type)
      ) {
        return candidate;
      }
    }
    const firstString = Object.keys(targetAttrs).find((k) =>
      ['string', 'text', 'email', 'uid'].includes(targetAttrs[k]?.type)
    );
    return firstString || 'documentId';
  },

  safeJson(value: any): string {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  },

  truncate(str: any): string {
    if (str == null) return '';
    const s = String(str);
    return s.length > MAX_CELL_LENGTH ? `${s.slice(0, MAX_CELL_LENGTH)}…` : s;
  },

  columnHeader(key: string): string {
    return key;
  },

  sanitizeSheetName(name: string): string {
    // Excel forbids : \ / ? * [ ] and caps at 31 chars.
    const cleaned = String(name).replace(/[\\/?*[\]:]/g, ' ').trim() || 'Data';
    return cleaned.slice(0, 31);
  },

  buildFilename(contentType: any): string {
    const base = contentType.info?.pluralName || contentType.info?.singularName || 'export';
    const safe = String(base).replace(/[^a-zA-Z0-9-_]/g, '_');
    return `${safe}.xlsx`;
  },
});

export default exportService;
