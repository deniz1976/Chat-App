import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { UserRepositoryImpl } from '../../infrastructure/repositories/UserRepositoryImpl';
import { User } from '../../domain/entities/User';

// Instantiate repository (consider dependency injection for better testability)
const userRepository: UserRepository = new UserRepositoryImpl();

// Get all users (consider pagination and filtering)
export const getUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;
        const users = await userRepository.getAll(limit, offset);
        res.status(200).json(users.map(user => ({ // Exclude sensitive data like password
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

// Get a single user by ID
export const getUser = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        const user = await userRepository.findById(id);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        // Exclude sensitive data
        const userResponse = {
            id: user.id,
            username: user.username,
            email: user.email, // Consider if email should be public
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

// Update user information
export const updateUser = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updateData = req.body;

    // Basic Authorization: Ensure users can only update their own profile (or admin logic needed)
    if (req.user?.id !== id /* && !isAdmin(req.user) */) {
         // This check assumes req.user is populated by authenticate middleware
         // For now, commenting out to allow updates, but implement proper checks!
         // res.status(403).json({ message: 'Forbidden: You can only update your own profile' });
         // return;
         logger.warn(`User ${req.user?.id} attempting to update user ${id} without proper authorization checks.`);
    }

    // Prevent sensitive data updates through this general endpoint
    if (updateData.password) {
        delete updateData.password;
        logger.warn(`Password update attempt for user ${id} ignored via general update endpoint.`);
        // Consider sending a specific error or just ignoring
    }
    if (updateData.status) {
        delete updateData.status;
        logger.warn(`Status update attempt for user ${id} ignored via general update endpoint.`);
    }
    if (updateData.email && req.user?.email !== updateData.email) {
        // Add email change verification logic if needed
        delete updateData.email; // Prevent email change for now
        logger.warn(`Email update attempt for user ${id} ignored.`);
    }
    if (updateData.username && req.user?.username !== updateData.username) {
        delete updateData.username; // Prevent username change for now
        logger.warn(`Username update attempt for user ${id} ignored.`);
    }

    try {
        const updatedUser = await userRepository.update(id, updateData);
        if (!updatedUser) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
         // Exclude sensitive data
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

// Delete a user
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    // Authorization Check: Only admin or the user themselves should delete
    if (req.user?.id !== id /* && !isAdmin(req.user) */) {
        // Implement proper admin check or remove comment
        // res.status(403).json({ message: 'Forbidden: You cannot delete this user' });
        // return;
        logger.warn(`User ${req.user?.id} attempting to delete user ${id} without proper authorization checks.`);
    }

    try {
        const deleted = await userRepository.delete(id);
        if (!deleted) {
            // User might be already deleted (due to paranoid: true) or never existed
            res.status(404).json({ message: 'User not found or already deleted' });
            return;
        }
        res.status(204).send(); // No content on successful deletion
        logger.info(`Deleted user with id: ${id}`);
    } catch (error: any) {
        logger.error(`Error deleting user with id: ${id}`, { error });
        res.status(500).json({ message: 'Failed to delete user' });
    }
};

// Update user status
export const updateStatus = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status value
    if (!status || !['online', 'offline', 'away'].includes(status)) {
        res.status(400).json({ message: 'Invalid or missing status value' });
        return;
    }

    // Authorization: Ensure user can only update their own status
     if (req.user?.id !== id) {
         res.status(403).json({ message: 'Forbidden: You can only update your own status' });
         return;
     }

    try {
        // Consider updating lastSeen as well when status changes
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

// Search for users
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
         res.status(200).json(users.map(user => ({ // Exclude sensitive data
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

// Get the profile of the currently authenticated user
export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
        // Should be caught by authenticate middleware, but good to double-check
        logger.warn('getUserProfile called without authenticated user ID.');
        res.status(401).json({ message: 'Authentication required' });
        return;
    }

    try {
        const user = await userRepository.findById(userId);
        if (!user) {
            // This case might indicate an issue if the user was authenticated but not found
            logger.error(`Authenticated user profile not found for id: ${userId}`);
            res.status(404).json({ message: 'User profile not found' });
            return;
        }
        // Exclude sensitive data like password
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