export class DuplicateEntityError extends Error {
  constructor(entity: string) {
    super(`${entity} already exists`);
    this.name = 'DuplicateEntityError';
  }
}
