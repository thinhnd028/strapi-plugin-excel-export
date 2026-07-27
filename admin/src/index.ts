import { PLUGIN_ID } from './pluginId';
import ExportButton from './components/ExportButton';

export default {
  register(app: any) {
    // Register the plugin (no menu link — it only extends the Content Manager).
    app.registerPlugin({
      id: PLUGIN_ID,
      name: PLUGIN_ID,
      initializer: () => null,
      isReady: true,
    });
  },

  bootstrap(app: any) {
    // Inject the Export button into the Content Manager List View actions zone.
    const contentManager = app.getPlugin('content-manager');
    if (contentManager && typeof contentManager.injectComponent === 'function') {
      contentManager.injectComponent('listView', 'actions', {
        name: `${PLUGIN_ID}-export-button`,
        Component: ExportButton,
      });
    }
  },

  async registerTrads() {
    return [];
  },
};
