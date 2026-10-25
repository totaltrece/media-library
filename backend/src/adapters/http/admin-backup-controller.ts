import type { FastifyInstance, FastifyReply } from "fastify";

import type { BackupCatalogUseCase } from "../../application/backup-catalog.js";
import { BackupNotSupportedError } from "../../application/backup-not-supported-error.js";

export function registerAdminBackupRoutes(app: FastifyInstance, backupCatalogUseCase: BackupCatalogUseCase): void {
  app.post("/admin/backup", async (_request, reply) => {
    try {
      return await backupCatalogUseCase.execute();
    } catch (error: unknown) {
      return sendBackupError(reply, error);
    }
  });
}

function sendBackupError(reply: FastifyReply, error: unknown) {
  if (error instanceof BackupNotSupportedError) {
    return reply.status(409).send({
      error: {
        message: error.message,
      },
    });
  }

  const message = error instanceof Error ? error.message : "Unable to create the SQLite backup";

  return reply.status(500).send({
    error: {
      message,
    },
  });
}
