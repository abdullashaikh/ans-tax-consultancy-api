import { Request } from 'express';
import { RoleName } from '../constants/roles';
import { PermissionName } from '../constants/permissions';
import { ApiError } from '../utils/apiError';
import { ErrorCodes } from '../constants/errorCodes';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2/promise';

/**
 * Object-Level Authorization Helper (IDOR / BOLA Prevention)
 *
 * Verifies that the authenticated user has legitimate ownership or assigned
 * consultant access to the target resource, unless they have administrative overrides.
 */
export class ObjectAuth {
  /**
   * Validates access to an Application by public_id or internal id.
   */
  static async checkApplicationAccess(req: Request, appIdentifier: string): Promise<{ appId: number; clientId: number }> {
    const user = req.user;
    if (!user) {
      throw ApiError.unauthorized();
    }

    const numericId = !isNaN(Number(appIdentifier)) ? Number(appIdentifier) : -1;

    // 1. Fetch application details with ownership and assignment
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.id, a.client_id, a.assigned_consultant_id, c.user_id AS client_user_id
       FROM applications a
       INNER JOIN clients c ON c.id = a.client_id
       WHERE a.public_id = ? OR a.id = ?
       LIMIT 1`,
      [appIdentifier, numericId]
    );

    if (rows.length === 0) {
      throw ApiError.notFound('Application not found', ErrorCodes.APPLICATION_NOT_FOUND);
    }

    const app = rows[0]!;
    const isOwner =
      Number(app['client_user_id']) === Number(user.id) ||
      (user.clientId && Number(app['client_id']) === Number(user.clientId));
    const isAssignedConsultant =
      app['assigned_consultant_id'] != null &&
      Number(app['assigned_consultant_id']) === Number(user.id);
    const isSuperAdmin = user.roles.includes(RoleName.SUPER_ADMIN);
    const isAdmin = user.roles.includes(RoleName.ADMIN);
    const hasViewAllPerm = user.permissions?.includes(PermissionName.APPLICATION_VIEW);

    // If client: MUST be the owner
    if (user.roles.includes(RoleName.CLIENT) && !isOwner) {
      throw ApiError.forbidden('You do not have permission to access this application', ErrorCodes.IDOR_VIOLATION);
    }

    // If consultant: must be assigned OR have administrative VIEW permission
    if (user.roles.includes(RoleName.CONSULTANT) && !isAssignedConsultant && !isAdmin && !isSuperAdmin && !hasViewAllPerm) {
      throw ApiError.forbidden('You are not assigned to this application', ErrorCodes.IDOR_VIOLATION);
    }

    return { appId: app['id'], clientId: app['client_id'] };
  }

  /**
   * Validates access to a Document by public_id or internal id.
   */
  static async checkDocumentAccess(req: Request, docIdentifier: string): Promise<{ docId: number; clientId: number; objectKey: string; storageProvider: string; mimeType: string; originalFileName: string }> {
    const user = req.user;
    if (!user) {
      throw ApiError.unauthorized();
    }

    const numericId = !isNaN(Number(docIdentifier)) ? Number(docIdentifier) : -1;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT d.id, d.client_id, d.application_id, d.storage_provider, d.storage_object_key,
              d.mime_type, d.original_file_name, c.user_id AS client_user_id,
              a.assigned_consultant_id
       FROM documents d
       INNER JOIN clients c ON c.id = d.client_id
       LEFT  JOIN applications a ON a.id = d.application_id
       WHERE (d.public_id = ? OR d.id = ?) AND d.deleted_at IS NULL
       LIMIT 1`,
      [docIdentifier, numericId]
    );

    if (rows.length === 0) {
      throw ApiError.notFound('Document not found', ErrorCodes.DOCUMENT_NOT_FOUND);
    }

    const doc = rows[0]!;
    const isOwner =
      Number(doc['client_user_id']) === Number(user.id) ||
      (user.clientId && Number(doc['client_id']) === Number(user.clientId));
    const isAssignedConsultant =
      doc['assigned_consultant_id'] != null &&
      Number(doc['assigned_consultant_id']) === Number(user.id);
    const isSuperAdmin = user.roles.includes(RoleName.SUPER_ADMIN);
    const isAdmin = user.roles.includes(RoleName.ADMIN);
    const hasDocViewPerm = user.permissions?.includes(PermissionName.DOCUMENT_VIEW);

    if (user.roles.includes(RoleName.CLIENT) && !isOwner) {
      throw ApiError.forbidden('You do not have permission to access this document', ErrorCodes.IDOR_VIOLATION);
    }

    if (user.roles.includes(RoleName.CONSULTANT) && !isAssignedConsultant && !isAdmin && !isSuperAdmin && !hasDocViewPerm) {
      throw ApiError.forbidden('You are not authorized to view documents for this client', ErrorCodes.IDOR_VIOLATION);
    }

    return {
      docId: doc['id'],
      clientId: doc['client_id'],
      objectKey: doc['storage_object_key'],
      storageProvider: doc['storage_provider'],
      mimeType: doc['mime_type'],
      originalFileName: doc['original_file_name'],
    };
  }

  /**
   * Validates access to a Client profile by public_id or internal id.
   */
  static async checkClientAccess(req: Request, clientIdentifier: string): Promise<number> {
    const user = req.user;
    if (!user) {
      throw ApiError.unauthorized();
    }

    const numericId = !isNaN(Number(clientIdentifier)) ? Number(clientIdentifier) : -1;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, user_id FROM clients WHERE (public_id = ? OR id = ?) AND deleted_at IS NULL LIMIT 1`,
      [clientIdentifier, numericId]
    );

    if (rows.length === 0) {
      throw ApiError.notFound('Client profile not found', ErrorCodes.CLIENT_NOT_FOUND);
    }

    const client = rows[0]!;
    const isOwner = Number(client['user_id']) === Number(user.id);
    const isSuperAdmin = user.roles.includes(RoleName.SUPER_ADMIN);
    const isAdmin = user.roles.includes(RoleName.ADMIN);
    const hasClientViewPerm = user.permissions?.includes(PermissionName.CLIENT_VIEW);

    if (user.roles.includes(RoleName.CLIENT) && !isOwner) {
      throw ApiError.forbidden('Access denied to client profile', ErrorCodes.IDOR_VIOLATION);
    }

    if (!isOwner && !isSuperAdmin && !isAdmin && !hasClientViewPerm) {
      throw ApiError.forbidden('Insufficient permissions to access this client profile', ErrorCodes.IDOR_VIOLATION);
    }

    return client['id'];
  }
}
