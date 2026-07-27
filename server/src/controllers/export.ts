import type { Core } from '@strapi/strapi';
import { PLUGIN_ID, EXPORT_ACTION_ID } from '../constants';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const exportController = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * GET /excel-export/export?uid=api::xxx.xxx&createdAtFrom=...&createdAtTo=...
   * Exports the records of a collection to a .xlsx file.
   * Requires the plugin::excel-export.export permission on that collection.
   */
  async export(ctx: any) {
    const uid = ctx.query.uid as string;

    if (!uid || typeof uid !== 'string') {
      return ctx.badRequest('Missing "uid" parameter.');
    }

    const contentType: any = strapi.contentType(uid as any);
    if (!contentType || contentType.kind !== 'collectionType') {
      return ctx.badRequest(`Invalid content-type: ${uid}`);
    }

    // RBAC: userAbility is set by the admin auth middleware.
    const { userAbility } = ctx.state;
    if (!userAbility || !userAbility.can(EXPORT_ACTION_ID, uid)) {
      return ctx.forbidden('You are not allowed to export this collection.');
    }

    const { createdAtFrom, createdAtTo } = ctx.query;

    let result;
    try {
      result = await strapi
        .plugin(PLUGIN_ID)
        .service('export')
        .generate(uid, { createdAtFrom, createdAtTo });
    } catch (err: any) {
      strapi.log.error(`[excel-export] Failed to export ${uid}: ${err?.message}`);
      return ctx.throw(500, 'Could not generate the Excel file.');
    }

    ctx.set('Content-Type', XLSX_MIME);
    ctx.set('Content-Disposition', `attachment; filename="${result.filename}"`);
    ctx.set('X-Export-Count', String(result.count));
    ctx.body = result.buffer;
  },
});

export default exportController;
