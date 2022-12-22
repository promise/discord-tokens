const { Octokit } = require("@octokit/rest");
const { randomBytes } = require("crypto");

/**
 * @typedef {Object} TokenResetOptions
 * @property {string} token The GitHub token to use when committing found tokens
 * @property {string} repository The repository to commit to
 * @property {string} branch The branch to commit to
 * @property {string} committerName The name of the committer (e.g. "Discord bot")
 * @property {string} committerEmail The email of the committer
 */

const tokenRegex = /[a-zA-Z0-9_-]{23,28}\.[a-zA-Z0-9_-]{6,7}\.[a-zA-Z0-9_-]{27,38}/gmu;

class TokenReset {
  /** @param {TokenResetOptions} options */
  constructor(options) {
    this.options = options;
    this.octokit = new Octokit({ auth: options.token });
  }

  /**
   * @param {string} content The content to scan for tokens
   * @param {boolean} dryRun Will only send the tokens found and not commit them to the repository (default: false)
   * @returns {string[]} The tokens found
   */
  scanContent(content, dryRun = false) {
    const tokens = [...content.matchAll(tokenRegex)].map(match => match[0]);

    if (tokens.length > 0 && !dryRun) {
      this.send(
        `${randomBytes(16).toString("hex")}.json`,
        tokens.map(token => `${token} (${safelyConvertBase64ToText(token) ?? "n/a"})`).join("\n"),
        `Found ${tokens.length} token${tokens.length === 1 ? "" : "s"}`,
      );
    }
    return tokens;
  }

  /**
   * @param {import("discord.js").Message} message The message to scan for tokens
   * @param {boolean} dryRun Will only send the tokens found and not commit them to the repository (default: false)
   * @returns {string[]} The tokens found
   */
  scanMessage(message, dryRun = false) {
    const partsToScan = [
      message.cleanContent,
      message.content,
      ...message.embeds.map(embed => [
        embed.author?.name,
        embed.description,
        ...embed.fields.map(field => [field.name, field.value]).reduce((a, b) => a.concat(b), []),
        embed.footer?.text,
        embed.title,
      ]).reduce((a, b) => a.concat(b), []),
    ]
      .filter(Boolean);

    const tokens = partsToScan
      .map(part => this.scanContent(part, true))
      .reduce((a, b) => a.concat(b), [])
      .filter((token, i, arr) => Boolean(token) && arr.indexOf(token) === i);

    if (tokens.length > 0 && !dryRun) {
      this.send(
        `${message.id}.json`,
        [
          `// Message URL: ${message.url}`,
          `// Sent in guild: ${message.guild ? `${message.guild.name} (${message.guildId})` : "N/A (DMs)"}`,
          `// Sent by: ${message.author.username}#${message.author.discriminator} (${message.author.id})`,
          "",
          ...tokens.map(token => `${token} (${safelyConvertBase64ToText(token) ?? "n/a"})`),
        ].join("\n"),
        `Found ${tokens.length} token${tokens.length === 1 ? "" : "s"} in message ${message.id}`,
      );
    }
  }

  /**
   * @param {string} path The path of the file to upload to (something unique)
   * @param {string} content The content to upload
   * @param {string} message The commit message
   * @returns {Promise<void>}
   */
  async send(path, content, message) {
    await this.octokit.repos.createOrUpdateFileContents({
      content: Buffer.from(content).toString("base64"),
      message,
      path,
      owner: this.options.repository.split("/")[0],
      repo: this.options.repository.split("/")[1],
      branch: this.options.branch,
      committer: {
        name: this.options.committerName,
        email: this.options.committerEmail,
      },
    });
  }

  /**
   * @param {import("discord.js").Client} client The Discord client to listen to
   * @returns {void}
   */
  listenToClient(client) {
    client.on("messageCreate", message => this.scanMessage(message));
    client.on("messageUpdate", (_, message) => {
      if (!message.partial) this.scanMessage(message);
    });
  }
}

module.exports = TokenReset;

function safelyConvertBase64ToText(base64) {
  try {
    return Buffer.from(base64, "base64").toString("utf8");
  } catch {
    return null;
  }
}
