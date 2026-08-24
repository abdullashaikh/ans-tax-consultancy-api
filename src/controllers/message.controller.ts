import { Request, Response, NextFunction } from 'express';
import { MessageService } from '../services/message.service';
import { ResponseFormatter } from '../utils/apiResponse';
import { PaginationUtil } from '../utils/pagination';

export class MessageController {
  static async createConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MessageService.getOrCreateConversation({
        userId: req.user!.id,
        applicationId: req.body.applicationId,
      });
      ResponseFormatter.created(res, result, 'Conversation initiated');
    } catch (error) {
      next(error);
    }
  }

  static async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const conversationId = parseInt(req.params['id']!, 10);
      const result = await MessageService.sendMessage({
        conversationId,
        senderId: req.user!.id,
        message: req.body.message,
        documentId: req.body.documentId,
      });
      ResponseFormatter.created(res, result, 'Message sent');
    } catch (error) {
      next(error);
    }
  }

  static async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const conversationId = parseInt(req.params['id']!, 10);
      const { limit, offset } = PaginationUtil.parseQuery(req.query);
      const messages = await MessageService.getMessages(conversationId, limit, offset);
      ResponseFormatter.success(res, messages);
    } catch (error) {
      next(error);
    }
  }

  static async listConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user!.clientId) {
        ResponseFormatter.success(res, []);
        return;
      }
      const conversations = await MessageService.listConversationsByClient(req.user!.clientId);
      ResponseFormatter.success(res, conversations);
    } catch (error) {
      next(error);
    }
  }
}
