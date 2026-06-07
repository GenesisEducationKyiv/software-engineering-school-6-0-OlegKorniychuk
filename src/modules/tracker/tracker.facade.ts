import type { RepositoryScanner } from './scanner/repository-scanner.service.interface.js';

export class TrackerFacade {
  constructor(private readonly repoScanner: RepositoryScanner) {}

  public async verifyRepository(owner: string, repo: string): Promise<void> {
    await this.repoScanner.verifyRepository(owner, repo);
  }
}
