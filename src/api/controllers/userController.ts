import { Request, Response } from 'express';
import { presenceService, userService } from '../../container';
import { config } from '../../config';
import { BadRequestError } from '../../core/errors';
import { isAdmin } from '../middlewares/auth';
import { toPrivateUser, toPublicUser } from '../presenters/userPresenter';

interface PageQuery {
    q?: string;
    limit: number;
    offset: number;
}

export const getUsers = async (req: Request, res: Response): Promise<void> => {
    const { limit, offset } = res.locals.query as PageQuery;
    const users = await userService.list(limit, offset);
    res.status(200).json(users.map(toPublicUser));
};

export const searchUsers = async (req: Request, res: Response): Promise<void> => {
    const { q, limit, offset } = res.locals.query as PageQuery;
    if (!q) {
        throw new BadRequestError('Search query parameter "q" is required');
    }
    const users = await userService.search(q, limit, offset);
    res.status(200).json(users.map(toPublicUser));
};

export const getUser = async (req: Request, res: Response): Promise<void> => {
    const user = await userService.get(req.params.id);
    const canViewPrivateFields = req.user!.id === user.id || isAdmin(req.user);
    res.status(200).json(canViewPrivateFields ? toPrivateUser(user) : toPublicUser(user));
};

export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
    const user = await userService.get(req.user!.id);
    res.status(200).json(toPrivateUser(user));
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
    const user = await userService.updateProfile(req.params.id, req.body);
    res.status(200).json(toPublicUser(user));
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
    await userService.delete(req.params.id);
    res.status(204).send();
};

export const updateStatus = async (req: Request, res: Response): Promise<void> => {
    if (req.user!.id !== req.params.id) {
        res.status(403).json({ message: 'Forbidden: You can only update your own status' });
        return;
    }
    await presenceService.setStatus(req.params.id, req.body.status);
    res.status(200).json({ status: req.body.status });
};

export const updateRole = async (req: Request, res: Response): Promise<void> => {
    const user = await userService.changeRole(req.user!.id, req.params.id, req.body.role);
    res.status(200).json({ id: user.id, role: user.role });
};

export const updateUserProfileAvatar = async (req: Request, res: Response): Promise<void> => {
    const fileKey = (req.file as Express.MulterS3.File | undefined)?.key;
    if (!fileKey) {
        throw new BadRequestError('No file uploaded or file type is invalid.');
    }
    if (!config.cloudflare.r2PublicBaseUrl) {
        throw new Error('CLOUDFLARE_R2_PUBLIC_HOSTNAME is not configured');
    }

    const user = await userService.updateProfile(req.user!.id, {
        profileImage: `${config.cloudflare.r2PublicBaseUrl}/${fileKey}`,
    });
    res.status(200).json({ message: 'Avatar updated successfully', user: toPrivateUser(user) });
};
