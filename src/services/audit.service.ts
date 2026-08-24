import { AuditRepository } from '../repositories/audit.repository';

export class AuditQueryService {
  static async listLogs(params: {
    action?: string;
    entityType?: string;
    search?: string;
    limit: number;
    offset: number;
  }) {
    return AuditRepository.list(params);
  }
}
