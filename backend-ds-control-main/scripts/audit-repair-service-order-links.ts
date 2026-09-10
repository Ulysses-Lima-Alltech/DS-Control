import 'dotenv/config';

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';

type LinkRow = {
  linkId: string;
  serviceOrderId: string;
  plotId: string;
  plotName: string;
  hectare: string;
  plotDeletedAt: Date | null;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  completedAt: Date | null;
  completedBy: string | null;
  manualOverride: boolean;
  overrideReason: string | null;
  updatedAt: Date;
  activeApplicationCount: number;
};

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

const serviceOrderNumber = Number(option('service-order-number'));
const expectedFinalArea = Number(option('expected-final-area'));
const apply = process.argv.includes('--apply');
const removeDeletedLinks = process.argv.includes('--remove-deleted-links');
const confirmation = option('confirm');

if (!Number.isInteger(serviceOrderNumber)) {
  throw new Error('Use --service-order-number=<number>.');
}

if (apply && (!removeDeletedLinks || confirmation !== `OS-${serviceOrderNumber}`)) {
  throw new Error(`Apply requires --remove-deleted-links and --confirm=OS-${serviceOrderNumber}.`);
}

if (apply && !Number.isFinite(expectedFinalArea)) {
  throw new Error('Apply requires --expected-final-area=<hectares>.');
}

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function main(): Promise<void> {
  const artifactsDirectory = resolve(process.cwd(), 'artifacts');
  mkdirSync(artifactsDirectory, { recursive: true });
  const outputPath = resolve(
    artifactsDirectory,
    `service-order-${serviceOrderNumber}-link-audit-${Date.now()}.json`,
  );
  const writeAudit = (audit: Record<string, unknown>): void => {
    writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  };

  await client.connect();

  let audit: Record<string, unknown> | undefined;

  try {
    await client.query('BEGIN');
    if (!apply) await client.query('SET TRANSACTION READ ONLY');

    const serviceOrderResult = await client.query<{
      id: string;
      number: number;
      status: string;
    }>(
      `SELECT id, number, status
       FROM service_orders
      WHERE number = $1
      ${apply ? 'FOR UPDATE' : ''}`,
      [serviceOrderNumber],
    );
    const serviceOrder = serviceOrderResult.rows[0];
    if (!serviceOrder) throw new Error(`OS ${serviceOrderNumber} was not found.`);

    const linksResult = await client.query<LinkRow>(
      `SELECT sop.id AS "linkId", sop.service_order_id AS "serviceOrderId",
            p.id AS "plotId", p.name AS "plotName",
            p.hectare, p.deleted_at AS "plotDeletedAt", sop.status,
            sop.completed_at AS "completedAt", sop.completed_by AS "completedBy",
            sop.manual_override AS "manualOverride", sop.override_reason AS "overrideReason",
            sop.updated_at AS "updatedAt",
            COUNT(a.id) FILTER (WHERE a.deleted_at IS NULL)::int AS "activeApplicationCount"
       FROM service_order_plots sop
       JOIN plots p ON p.id = sop.plot_id
       LEFT JOIN applications a ON a.plot_id = p.id
      WHERE sop.service_order_id = $1
      GROUP BY sop.id, p.id
      ORDER BY p.deleted_at NULLS FIRST, p.name, p.id`,
      [serviceOrder.id],
    );

    const candidates = removeDeletedLinks
      ? linksResult.rows.filter((link) => link.plotDeletedAt !== null)
      : [];
    const blockedCandidates = candidates.filter((link) => link.activeApplicationCount > 0);
    const currentArea = linksResult.rows.reduce((sum, link) => sum + Number(link.hectare), 0);
    const removedArea = candidates.reduce((sum, link) => sum + Number(link.hectare), 0);
    const projectedArea = currentArea - removedArea;
    const applicationsBefore = await client.query<{
      count: number;
      hectares: string;
    }>(
      `SELECT COUNT(*)::int AS count,
              ROUND(COALESCE(SUM(hectares), 0)::numeric, 2)::text AS hectares
         FROM applications
        WHERE service_order_id = $1 AND deleted_at IS NULL`,
      [serviceOrder.id],
    );

    audit = {
      generatedAt: new Date().toISOString(),
      mode: apply ? 'apply' : 'dry-run',
      transactionStatus: apply ? 'not-started' : 'read-only',
      serviceOrder,
      before: {
        links: linksResult.rows.length,
        activePlotLinks: linksResult.rows.filter((link) => link.plotDeletedAt === null).length,
        deletedPlotLinks: linksResult.rows.filter((link) => link.plotDeletedAt !== null).length,
        registeredAreaHa: currentArea.toFixed(2),
        applications: applicationsBefore.rows[0],
      },
      proposal: {
        strategy: removeDeletedLinks ? 'remove-soft-deleted-plot-links' : 'audit-only',
        candidateLinks: candidates.length,
        candidateAreaHa: removedArea.toFixed(2),
        projectedLinks: linksResult.rows.length - candidates.length,
        projectedAreaHa: projectedArea.toFixed(2),
        expectedFinalAreaHa: Number.isFinite(expectedFinalArea)
          ? expectedFinalArea.toFixed(2)
          : null,
        blockedByApplications: blockedCandidates.map((link) => ({
          linkId: link.linkId,
          plotId: link.plotId,
          activeApplicationCount: link.activeApplicationCount,
        })),
        readyToApply:
          candidates.length > 0 &&
          blockedCandidates.length === 0 &&
          Number.isFinite(expectedFinalArea) &&
          Math.abs(projectedArea - expectedFinalArea) <= 0.005,
      },
      restoreRows: candidates.map(({ activeApplicationCount: _, ...link }) => link),
    };

    if (apply) {
      if (blockedCandidates.length > 0) {
        throw new Error('Repair refused: at least one candidate plot has an active application.');
      }
      if (Math.abs(projectedArea - expectedFinalArea) > 0.005) {
        throw new Error(
          `Repair refused: projected area ${projectedArea.toFixed(2)} differs from expected ${expectedFinalArea.toFixed(2)}.`,
        );
      }
      if (candidates.length === 0)
        throw new Error('Repair refused: no candidate links were found.');

      audit.transactionStatus = 'backup-written';
      writeAudit(audit);

      const deletion = await client.query(
        `DELETE FROM service_order_plots WHERE id = ANY($1::uuid[])`,
        [candidates.map((link) => link.linkId)],
      );
      if (deletion.rowCount !== candidates.length) {
        throw new Error(
          `Repair refused: expected to delete ${candidates.length} links, deleted ${deletion.rowCount}.`,
        );
      }

      const afterResult = await client.query<{
        links: number;
        distinctPlots: number;
        deletedPlotLinks: number;
        registeredAreaHa: string;
      }>(
        `SELECT COUNT(*)::int AS links,
                COUNT(DISTINCT sop.plot_id)::int AS "distinctPlots",
                COUNT(*) FILTER (WHERE p.deleted_at IS NOT NULL)::int AS "deletedPlotLinks",
                ROUND(COALESCE(SUM(p.hectare), 0)::numeric, 2)::text AS "registeredAreaHa"
           FROM service_order_plots sop
           JOIN plots p ON p.id = sop.plot_id
          WHERE sop.service_order_id = $1`,
        [serviceOrder.id],
      );
      const applicationsAfter = await client.query<{ count: number; hectares: string }>(
        `SELECT COUNT(*)::int AS count,
                ROUND(COALESCE(SUM(hectares), 0)::numeric, 2)::text AS hectares
           FROM applications
          WHERE service_order_id = $1 AND deleted_at IS NULL`,
        [serviceOrder.id],
      );
      const after = afterResult.rows[0];
      const expectedLinks = linksResult.rows.length - candidates.length;
      if (
        after.links !== expectedLinks ||
        after.distinctPlots !== expectedLinks ||
        after.deletedPlotLinks !== 0 ||
        Math.abs(Number(after.registeredAreaHa) - expectedFinalArea) > 0.005
      ) {
        throw new Error(`Repair refused: post-delete relationship validation failed.`);
      }
      if (
        applicationsAfter.rows[0].count !== applicationsBefore.rows[0].count ||
        applicationsAfter.rows[0].hectares !== applicationsBefore.rows[0].hectares
      ) {
        throw new Error('Repair refused: application totals changed unexpectedly.');
      }

      await client.query(`UPDATE service_orders SET updated_at = NOW() WHERE id = $1`, [
        serviceOrder.id,
      ]);
      audit.after = { ...after, applications: applicationsAfter.rows[0] };
      audit.transactionStatus = 'validated-before-commit';
      writeAudit(audit);
      await client.query('COMMIT');
      audit.transactionStatus = 'committed';
      audit.committedAt = new Date().toISOString();
      writeAudit(audit);
    } else {
      await client.query('ROLLBACK');
      writeAudit(audit);
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (audit) {
      audit.transactionStatus = 'rolled-back';
      audit.error = error instanceof Error ? error.message : String(error);
      writeAudit(audit);
    }
    throw error;
  } finally {
    await client.end();
  }

  console.log(
    JSON.stringify(
      {
        outputPath,
        mode: audit.mode,
        transactionStatus: audit.transactionStatus,
        before: audit.before,
        proposal: audit.proposal,
        after: audit.after,
      },
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
