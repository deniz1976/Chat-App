import { User } from '../../domain/entities/User';

export const toPublicUser = (user: User) => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  profileImage: user.profileImage,
  status: user.status,
  lastSeen: user.lastSeen,
});

export const toPrivateUser = (user: User) => ({
  ...toPublicUser(user),
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
});
