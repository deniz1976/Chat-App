import { createUser, makeAdmin, setupTestDatabase } from './helpers';

setupTestDatabase();

describe('user authorization', () => {
  it('lets users update only their own profile', async () => {
    const alice = await createUser('alice');
    const bob = await createUser('bob');

    await bob.put(`/users/${alice.id}`, { displayName: 'Hacked' }).expect(403);
    const response = await alice.put(`/users/${alice.id}`, { displayName: 'Alice Cooper' }).expect(200);
    expect(response.body.displayName).toBe('Alice Cooper');
  });

  it('rejects fields that cannot be changed through profile updates', async () => {
    const alice = await createUser('alice');

    for (const body of [
      { role: 'admin' },
      { email: 'x@example.com' },
      { username: 'renamed' },
      { password: 'newpassword' },
    ]) {
      await alice.put(`/users/${alice.id}`, body).expect(400);
    }
    const profile = await alice.get('/users/profile').expect(200);
    expect(profile.body).toMatchObject({ role: 'user', email: alice.email, username: 'alice' });
  });

  it('accepts only https profile image URLs', async () => {
    const alice = await createUser('alice');
    await alice.put(`/users/${alice.id}`, { profileImage: 'javascript:alert(1)' }).expect(400);
    await alice.put(`/users/${alice.id}`, { profileImage: 'https://cdn.example.com/a.png' }).expect(200);
  });

  it('lets users delete only their own account', async () => {
    const alice = await createUser('alice');
    const bob = await createUser('bob');

    await bob.delete(`/users/${alice.id}`).expect(403);
    await alice.get('/users/profile').expect(200);
  });

  it('lets admins manage other accounts and roles', async () => {
    const admin = await createUser('admin');
    const bob = await createUser('bob');
    await makeAdmin(admin);

    await admin.put(`/users/${bob.id}`, { displayName: 'Robert' }).expect(200);
    const role = await admin.put(`/users/${bob.id}/role`, { role: 'admin' }).expect(200);
    expect(role.body.role).toBe('admin');
    await admin.put(`/users/${admin.id}/role`, { role: 'user' }).expect(400);
    await admin.delete(`/users/${bob.id}`).expect(204);
  });

  it('forbids role changes by regular users', async () => {
    const alice = await createUser('alice');
    const bob = await createUser('bob');
    await alice.put(`/users/${bob.id}/role`, { role: 'admin' }).expect(403);
  });

  it('shows the email only to the user and to admins', async () => {
    const alice = await createUser('alice');
    const bob = await createUser('bob');

    expect((await bob.get(`/users/${alice.id}`).expect(200)).body.email).toBeUndefined();
    expect((await alice.get(`/users/${alice.id}`).expect(200)).body.email).toBe(alice.email);

    await makeAdmin(bob);
    expect((await bob.get(`/users/${alice.id}`).expect(200)).body.email).toBe(alice.email);
  });

  it('does not search by email and escapes LIKE wildcards', async () => {
    const alice = await createUser('alice');
    await createUser('bob');

    expect((await alice.get('/users/search?q=example.com').expect(200)).body).toHaveLength(0);
    expect((await alice.get('/users/search?q=_').expect(200)).body).toHaveLength(0);
    expect(
      (await alice.get('/users/search?q=bo').expect(200)).body.map((u: { username: string }) => u.username),
    ).toEqual(['bob']);
    await alice.get('/users/search').expect(400);
  });

  it('validates pagination and route parameters', async () => {
    const alice = await createUser('alice');
    await alice.get('/users?limit=500').expect(400);
    await alice.get('/users?limit=abc').expect(400);
    await alice.get('/users/not-a-uuid').expect(400);
  });

  it('lets users set only their own status', async () => {
    const alice = await createUser('alice');
    const bob = await createUser('bob');

    await bob.put(`/users/${alice.id}/status`, { status: 'away' }).expect(403);
    await alice.put(`/users/${alice.id}/status`, { status: 'invisible' }).expect(400);
    await alice.put(`/users/${alice.id}/status`, { status: 'away' }).expect(200);
    expect((await bob.get(`/users/${alice.id}`)).body.status).toBe('away');
  });
});
