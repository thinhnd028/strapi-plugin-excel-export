import type { Core } from '@strapi/strapi';

/**
 * Returns the list of collectionType content-types a user can export.
 * Only collectionTypes shown in the Content Manager (visible !== false),
 * excluding single types, components and internal admin content-types.
 */
export const getExportableContentTypes = (strapi: Core.Strapi) => {
  return Object.values(strapi.contentTypes).filter((ct: any) => {
    if (!ct || ct.kind !== 'collectionType') return false;
    // Skip internal admin content-types (admin::user, admin::role, ...).
    if (ct.uid.startsWith('admin::')) return false;
    // Respect the "hidden from Content Manager" option.
    const visible = ct.pluginOptions?.['content-manager']?.visible;
    if (visible === false) return false;
    return true;
  });
};
