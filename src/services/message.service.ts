import { ConversationRepository } from '../repositories/conversation.repository';
import { ClientRepository } from '../repositories/client.repository';
import { ApiError } from '../utils/apiError';

export class MessageService {
  static async getOrCreateConversation(params: {
    userId: number;
    applicationId?: number;
  }) {
    const client = await ClientRepository.findByUserId(params.userId);
    if (!client) {
      throw ApiError.badRequest('Client profile required');
    }

    const conversationId = await ConversationRepository.create(client.id, params.applicationId, params.userId);
    return { conversationId };
  }

  static async sendMessage(params: {
    conversationId: number;
    senderId: number;
    message: string;
    documentId?: number;
  }) {
    const isMember = await ConversationRepository.isParticipant(params.conversationId, params.senderId);
    if (!isMember) {
      // Auto-join if user is authorized to this thread
      await ConversationRepository.addParticipant(params.conversationId, params.senderId);
    }

    const messageId = await ConversationRepository.sendMessage(params);
    return { messageId, ...params };
  }

  static async getMessages(conversationId: number, limit: number, offset: number) {
    return ConversationRepository.getMessages(conversationId, limit, offset);
  }

  static async listConversationsByClient(clientId: number) {
    return ConversationRepository.listByClient(clientId);
  }
}
