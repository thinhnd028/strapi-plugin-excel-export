// Admin-type routes are mounted at /excel-export/... and require admin auth.
export default {
  admin: {
    type: 'admin',
    routes: [
      {
        method: 'GET',
        path: '/export',
        handler: 'export.export',
        config: {
          // Admin JWT auth by default; fine-grained RBAC is checked in the controller.
          policies: [],
        },
      },
    ],
  },
};
