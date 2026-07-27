# Strapi Plugin: Excel Export

Export **Strapi 5** collections to Excel (`.xlsx`) straight from the Content Manager, with
**per-collection RBAC** and an optional **`createdAt` date-range filter**.

## Features

- Adds an **Export Excel** button to the List View of **every collectionType** (injection zone `listView.actions`).
- Clicking it opens a dialog to pick a **`createdAt` range** (From / To). Both bounds are **optional**: leave both empty to export everything, or fill in only one. Bounds use the browser's local timezone (`From` = start of day, `To` = end of day).
- Exports the collection's records honoring the chosen filter (independent of pagination), paginating internally 100 rows per batch, sorted by `createdAt` ascending.
- Smart formatting: relations (label from `name/title/...`), media (`name (url)`), component/dynamiczone/json (JSON), boolean, dates.
- Skips `password` and `private` fields. Hides `publishedAt` for collections without Draft & Publish.

## Permissions (RBAC)

Each collection gets its own **Export** permission under **Settings › Roles**
(actionId `plugin::excel-export.export`, section `contentTypes`).

- Super Admin has full access by default.
- For other roles: tick the **Export** checkbox on the collection to grant access.
- The button only shows when the user can export that collection; the server re-checks the permission too.

## Installation

```bash
npm install @thinhnd028/strapi-plugin-excel-export
# or
yarn add @thinhnd028/strapi-plugin-excel-export
```

> Published to GitHub Packages. Add this to your project's `.npmrc`:
>
> ```
> @thinhnd028:registry=https://npm.pkg.github.com
> ```

Enable it in `config/plugins.ts` (usually auto-enabled once installed):

```ts
export default () => ({
  'excel-export': { enabled: true },
});
```

Rebuild the admin and restart:

```bash
npm run build && npm run develop
```

## Requirements

- Strapi `^5.0.0`
- Node `>=18 <=22`

## Development

```bash
npm install
npm run build     # strapi-plugin build -> dist/
npm run watch     # rebuild on change
```

## License

MIT
