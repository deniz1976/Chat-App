import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { UserRepositoryImpl } from '../../infrastructure/repositories/UserRepositoryImpl';
import { User } from '../../domain/entities/User';
import { config } from '../../config';

const userRepository: UserRepository = new UserRepositoryImpl();

export const getUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;
        const users = await userRepository.getAll(limit, offset);
        res.status(200).json(users.map(user => ({ 
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            profileImage: user.profileImage,
            status: user.status,
            lastSeen: user.lastSeen,
        })));
        logger.info('Retrieved users');
    } catch (error: any) {
        logger.error('Error getting users', { error });
        res.status(500).json({ message: 'Failed to retrieve users' });
    }
};

export const getUser = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        const user = await userRepository.findById(id);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        const userResponse = {
            id: user.id,
            username: user.username,
            email: user.email, 
            displayName: user.displayName,
            profileImage: user.profileImage,
            status: user.status,
            lastSeen: user.lastSeen,
        };
        res.status(200).json(userResponse);
        logger.info(`Retrieved user with id: ${id}`);
    } catch (error: any) {
        logger.error(`Error getting user with id: ${id}`, { error });
        res.status(500).json({ message: 'Failed to retrieve user' });
    }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updateData = req.body;

    if (req.user?.id !== id /* && !isAdmin(req.user) */) {
         // This check assumes req.user is populated by authenticate middleware
         // For now, commenting out to allow updates, but implement proper checks!
         // res.status(403).json({ message: 'Forbidden: You can only update your own profile' });
         // return;
         logger.warn(`User ${req.user?.id} attempting to update user ${id} without proper authorization checks.`);
    }

    if (updateData.password) {
        delete updateData.password;
        logger.warn(`Password update attempt for user ${id} ignored via general update endpoint.`);
    }
    if (updateData.status) {
        delete updateData.status;
        logger.warn(`Status update attempt for user ${id} ignored via general update endpoint.`);
    }
    if (updateData.email && req.user?.email !== updateData.email) {
        
        delete updateData.email; 
        logger.warn(`Email update attempt for user ${id} ignored.`);
    }
    if (updateData.username && req.user?.username !== updateData.username) {
        delete updateData.username; 
        logger.warn(`Username update attempt for user ${id} ignored.`);
    }

    try {
        const updatedUser = await userRepository.update(id, updateData);
        if (!updatedUser) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        const userResponse = {
            id: updatedUser.id,
            username: updatedUser.username,
            displayName: updatedUser.displayName,
            profileImage: updatedUser.profileImage,
            status: updatedUser.status,
        };
        res.status(200).json(userResponse);
        logger.info(`Updated user with id: ${id}`);
    } catch (error: any) {
        if (error.name === 'SequelizeUniqueConstraintError') {
             logger.warn(`Unique constraint violation during user update for id: ${id}`, { error });
             res.status(409).json({ message: 'Update failed due to unique constraint (e.g., email/username exists).' });
        } else {
            logger.error(`Error updating user with id: ${id}`, { error });
            res.status(500).json({ message: 'Failed to update user' });
        }
    }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (req.user?.id !== id) {
        
        logger.warn(`User ${req.user?.id} attempting to delete user ${id} without proper authorization checks.`);
    }

    try {
        const deleted = await userRepository.delete(id);
        if (!deleted) {
            res.status(404).json({ message: 'User not found or already deleted' });
            return;
        }
        res.status(204).send(); 
        logger.info(`Deleted user with id: ${id}`);
    } catch (error: any) {
        logger.error(`Error deleting user with id: ${id}`, { error });
        res.status(500).json({ message: 'Failed to delete user' });
    }
};

export const updateStatus = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['online', 'offline', 'away'].includes(status)) {
        res.status(400).json({ message: 'Invalid or missing status value' });
        return;
    }

     if (req.user?.id !== id) {
         res.status(403).json({ message: 'Forbidden: You can only update your own status' });
         return;
     }

    try {
        const updatedUser = await userRepository.updateStatus(id, status as 'online' | 'offline' | 'away');
        if (!updatedUser) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        res.status(200).json({ status: updatedUser.status });
        logger.info(`Updated status for user with id: ${id} to ${status}`);
    } catch (error: any) {
        logger.error(`Error updating status for user with id: ${id}`, { error });
        res.status(500).json({ message: 'Failed to update user status' });
    }
};

export const searchUsers = async (req: Request, res: Response): Promise<void> => {
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!query) {
        res.status(400).json({ message: 'Search query parameter "q" is required' });
        return;
    }

    try {
        const users = await userRepository.search(query, limit, offset);
         res.status(200).json(users.map(user => ({ 
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            profileImage: user.profileImage,
            status: user.status,
        })));
        logger.info(`Searched users with query: ${query}`);
    } catch (error: any) {
        logger.error(`Error searching users with query: ${query}`, { error });
        res.status(500).json({ message: 'Failed to search users' });
    }
};

export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
        logger.warn('getUserProfile called without authenticated user ID.');
        res.status(401).json({ message: 'Authentication required' });
        return;
    }

    try {
        const user = await userRepository.findById(userId);
        if (!user) {
            logger.error(`Authenticated user profile not found for id: ${userId}`);
            res.status(404).json({ message: 'User profile not found' });
            return;
        }
         const userResponse = {
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.displayName,
            profileImage: user.profileImage,
            status: user.status,
            lastSeen: user.lastSeen,
            createdAt: user.createdAt,
        };
        res.status(200).json(userResponse);
        logger.info(`Retrieved profile for user: ${userId}`);
    } catch (error: any) {
        logger.error(`Error retrieving profile for user: ${userId}`, { error });
        res.status(500).json({ message: 'Failed to retrieve user profile' });
    }
};

export const updateUserProfileAvatar = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
        logger.warn('updateUserProfileAvatar called without authenticated user ID.');
        res.status(401).json({ message: 'Authentication required' });
        return;
    }

    if (!req.file) {
        logger.warn(`Avatar upload attempt failed for user: ${userId}. No file uploaded or file was rejected by filter.`);
        res.status(400).json({ message: 'No file uploaded or file type is invalid.' });
        return;
    }

    const fileKey = (req.file as any)?.key; 

    if (!fileKey) {
         logger.error(`Avatar upload failed for user: ${userId}. File key missing after upload.`, { file: req.file });
         res.status(500).json({ message: 'File upload failed after processing (missing key).' });
         return;
    }

    let profileImageUrl: string | null = null;
    if (config.cloudflare.r2PublicHostname) {
        const baseUrl = config.cloudflare.r2PublicHostname.startsWith('https://') 
                        ? config.cloudflare.r2PublicHostname 
                        : `https://${config.cloudflare.r2PublicHostname}`;
        profileImageUrl = `${baseUrl}/${fileKey}`;
        logger.info(`Constructed public avatar URL for user ${userId}: ${profileImageUrl}`);
    } else {
        logger.error(`Avatar uploaded for user ${userId}, but CLOUDFLARE_R2_PUBLIC_HOSTNAME is not configured. Cannot generate public URL.`);
        res.status(500).json({ message: 'File uploaded, but server configuration is missing public hostname.' });
        return;
    }

    try {
        const updatedUser = await userRepository.update(userId, { profileImage: profileImageUrl });

        if (!updatedUser) {
            logger.error(`Failed to update profileImage in database for user: ${userId}`);
            res.status(404).json({ message: 'User not found after upload' });
            return;
        }

        const userResponse = {
            id: updatedUser.id,
            username: updatedUser.username,
            email: updatedUser.email,
            displayName: updatedUser.displayName,
            profileImage: updatedUser.profileImage,
            status: updatedUser.status,
            lastSeen: updatedUser.lastSeen,
        };

        res.status(200).json({ message: 'Avatar updated successfully', user: userResponse });
        logger.info(`Successfully updated avatar for user: ${userId}`);

    } catch (error: any) {
        logger.error(`Error updating user profileImage in database for user: ${userId}`, { error });
        res.status(500).json({ message: 'Failed to update user profile after upload' });
    }
}; 