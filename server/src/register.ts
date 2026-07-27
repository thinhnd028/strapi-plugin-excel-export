import type { Core } from '@strapi/strapi';
import { PLUGIN_ID, EXPORT_ACTION_UID } from './constants';
import { getExportableContentTypes } from './utils';

/**
 * Registers the RBAC action "Export" for every collectionType.
 *
 * Because the action lives in the `contentTypes` section and carries a list of
 * `subjects`, Strapi renders it as an "Export" checkbox inside each collection's
 * permission matrix (Settings > Roles). Super Admins always have full access.
 */
const register = async ({ strapi }: { strapi: Core.Strapi }) => {
  const subjects = getExportableContentTypes(strapi).map((ct: any) => ct.uid);

  if (subjects.length === 0) {
    strapi.log.warn('[excel-export] No collectionType found to register the export permission.');
    return;
  }

  const actionProvider = (strapi.service('admin::permission') as any)?.actionProvider;

  if (!actionProvider) {
    strapi.log.error('[excel-export] Could not access the admin permission actionProvider.');
    return;
  }

  await actionProvider.registerMany([
    {
      section: 'contentTypes',
      displayName: 'Export',
      uid: EXPORT_ACTION_UID,
      pluginName: PLUGIN_ID,
      subjects,
    },
  ]);

  strapi.log.info(`[excel-export] Registered export permission for ${subjects.length} collection(s).`);
};

export default register;
