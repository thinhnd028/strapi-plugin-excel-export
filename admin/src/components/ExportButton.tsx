import * as React from 'react';
import { useParams } from 'react-router-dom';
import { Button, Modal, Field, DatePicker, Flex, Typography } from '@strapi/design-system';
import { Download } from '@strapi/icons';
import { useFetchClient, useNotification, useRBAC } from '@strapi/strapi/admin';
import { EXPORT_ACTION_ID } from '../pluginId';

const startOfDay = (d: Date): string => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
};

const endOfDay = (d: Date): string => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.toISOString();
};

/**
 * "Export Excel" button injected into the Content Manager List View actions zone.
 * Clicking it opens a dialog to pick an optional createdAt date range
 * ("from" and "to" are both optional) before downloading the file.
 */
const ExportButton = () => {
  const { slug } = useParams<{ slug: string }>();
  const { get } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [open, setOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [from, setFrom] = React.useState<Date | undefined>(undefined);
  const [to, setTo] = React.useState<Date | undefined>(undefined);

  const permissions = React.useMemo(
    () => (slug ? [{ action: EXPORT_ACTION_ID, subject: slug }] : []),
    [slug]
  );
  const { isLoading: isLoadingRBAC, allowedActions } = useRBAC(permissions);
  const canExport = (allowedActions as Record<string, boolean>)?.canExport;

  // Only show on a collectionType list view (slug present) and when allowed.
  if (!slug || isLoadingRBAC || !canExport) {
    return null;
  }

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ uid: slug });
      if (from) params.set('createdAtFrom', startOfDay(from));
      if (to) params.set('createdAtTo', endOfDay(to));

      const response = await get(`/excel-export/export?${params.toString()}`, {
        responseType: 'blob',
      });

      const blob = response.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const name = slug.split('.').pop() || 'export';
      link.download = `${name}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      const headers: any = response.headers;
      const count =
        typeof headers?.get === 'function' ? headers.get('x-export-count') : headers?.['x-export-count'];
      toggleNotification({
        type: 'success',
        message: count ? `Export succeeded (${count} records).` : 'Export succeeded.',
      });
      setOpen(false);
    } catch (err) {
      toggleNotification({
        type: 'danger',
        message: 'Export failed. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal.Root open={open} onOpenChange={setOpen}>
      <Modal.Trigger>
        <Button variant="secondary" startIcon={<Download />}>
          Export Excel
        </Button>
      </Modal.Trigger>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>Export Excel</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Typography variant="omega" textColor="neutral600">
              Pick a <b>createdAt</b> range. Leave both empty to export everything; you can also
              fill in only one of them.
            </Typography>

            <Field.Root name="createdAtFrom">
              <Field.Label>From date (createdAt)</Field.Label>
              <DatePicker
                value={from}
                onChange={(date) => setFrom(date)}
                onClear={() => setFrom(undefined)}
                clearLabel="Clear"
                maxDate={to}
              />
            </Field.Root>

            <Field.Root name="createdAtTo">
              <Field.Label>To date (createdAt)</Field.Label>
              <DatePicker
                value={to}
                onChange={(date) => setTo(date)}
                onClear={() => setTo(undefined)}
                clearLabel="Clear"
                minDate={from}
              />
            </Field.Root>
          </Flex>
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary" disabled={isLoading}>
              Cancel
            </Button>
          </Modal.Close>
          <Button startIcon={<Download />} loading={isLoading} onClick={handleExport}>
            Export
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
};

export default ExportButton;
