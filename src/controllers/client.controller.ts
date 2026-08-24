import { Request, Response, NextFunction } from 'express';
import { ClientService } from '../services/client.service';
import { ResponseFormatter } from '../utils/apiResponse';
import { PaginationUtil } from '../utils/pagination';

export class ClientController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, offset, search } = PaginationUtil.parseQuery(req.query);
      const clientType = req.query['clientType'] as string | undefined;
      const status = req.query['status'] as string | undefined;

      const { clients, total } = await ClientService.listClients({ clientType, status, search, limit, offset });
      const meta = PaginationUtil.buildMeta(page, limit, total);

      ResponseFormatter.success(res, clients, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = await ClientService.getClientByPublicId(req.params['id']!);
      ResponseFormatter.success(res, client);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await ClientService.updateClient(req.params['id']!, req.body, req.user!.id);
      ResponseFormatter.success(res, updated, 'Client profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async addAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const address = await ClientService.addAddress(req.params['id']!, req.body);
      ResponseFormatter.created(res, address, 'Address added successfully');
    } catch (error) {
      next(error);
    }
  }
}
