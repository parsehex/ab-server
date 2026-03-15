import fs from 'fs';
import path from 'path';
import { BROADCAST_CHAT_SERVER_PUBLIC, TIMELINE_GAME_START } from '../../events';
import { System } from '../system';

export default class GameUpdateNotifier extends System {
  constructor({ app }) {
    super({ app });

    this.listeners = {
      [TIMELINE_GAME_START]: this.onGameStart,
    };
  }

  onGameStart(): void {
    this.checkSummary();

    setTimeout(() => {
      this.checkSummary();
    }, 30000);
  }

  private checkSummary(): void {
    const summaryPath = path.resolve(__dirname, '../../../update-summary.json');

    if (fs.existsSync(summaryPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
        const projects = data.rebuiltProjects || [];
        let newHash = data.newHash || null;
        if (newHash?.length > 7) {
          newHash = newHash.substring(0, 7);
        }
        const link = newHash ? `https://github.com/parsehex/airbattle-hosting/commit/${newHash}` : '';

        if (projects.length > 0) {
          const message = `Update complete, parts updated: ${projects.join(', ')}. ${link}`;

          this.emit(BROADCAST_CHAT_SERVER_PUBLIC, message);
        }

        fs.unlinkSync(summaryPath);
      } catch (err) {
        this.log.error('Failed to process update-summary.json', err);
      }
    }
  }
}
