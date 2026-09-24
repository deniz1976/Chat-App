import { Op } from 'sequelize';
import { Chat } from '../../domain/entities/Chat';
import { User, UserStatus } from '../../domain/entities/User';

export const setUserStatus = async (userId: string, status: UserStatus): Promise<void> => {
    await User.update({ status, lastSeen: new Date() }, { where: { id: userId } });
};

export const resetAllUserStatuses = async (): Promise<void> => {
    await User.update({ status: 'offline' }, { where: { status: { [Op.ne]: 'offline' } } });
};

export const getContactIds = async (userId: string): Promise<string[]> => {
    const chats = await Chat.findAll({
        where: { participants: { [Op.contains]: [userId] } },
        attributes: ['participants'],
    });
    const contactIds = new Set<string>(chats.flatMap(chat => chat.participants));
    contactIds.delete(userId);
    return Array.from(contactIds);
};
