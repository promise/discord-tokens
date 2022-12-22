import type { Client, Message } from "discord.js";

export interface TokenResetOptions {
  token: string;
  repository: string;
  branch: string;
  committerName: string;
  committerEmail: string;
}

export default class TokenReset {
  constructor(options: TokenResetOptions);
  scanContent(content: string, dryRun?: true): string[];
  scanMessage(message: Message, dryRun?: true): string[];
  send(path: string, content: string, message: string): Promise<void>;
  listenToClient(client: Client): void;
}
