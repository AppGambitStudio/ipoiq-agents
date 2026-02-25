import {
  unstable_v2_createSession,
  type SDKSession,
  type SDKMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { type TeammateConfig } from "./teammates.js";

type TaskResult = {
  teammate: string;
  result: string;
  error?: string;
};

type Teammate = {
  config: TeammateConfig;
  session: SDKSession;
};

export class Coordinator {
  private teammates = new Map<string, Teammate>();
  private model: string;

  constructor(model: string) {
    this.model = model;
  }

  /** Spin up persistent sessions for all teammates */
  async initTeammates(configs: TeammateConfig[]): Promise<void> {
    for (const config of configs) {
      const session = unstable_v2_createSession({
        model: this.model,
        ...config.sessionOptions,
      });

      // Send the system prompt as the first message to set context
      await session.send(
        `Your role: ${config.systemPrompt}\n\nAcknowledge your role briefly and wait for tasks.`
      );

      // Drain the acknowledgement
      for await (const msg of session.stream()) {
        if (msg.type === "result") break;
      }

      this.teammates.set(config.name, { config, session });
      console.log(`  [+] ${config.name} ready`);
    }
  }

  /** Send a task to a specific teammate and collect the result */
  async assignTask(teammateName: string, task: string): Promise<TaskResult> {
    const teammate = this.teammates.get(teammateName);
    if (!teammate) {
      return { teammate: teammateName, result: "", error: `Unknown teammate: ${teammateName}` };
    }

    await teammate.session.send(task);

    let result = "";
    for await (const msg of teammate.session.stream()) {
      if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          if (block.type === "text") {
            result += block.text;
          }
        }
      } else if (msg.type === "result") {
        if (msg.subtype === "success") {
          result = msg.result || result;
        } else {
          return { teammate: teammateName, result: "", error: msg.errors?.join(", ") };
        }
        break;
      }
    }

    return { teammate: teammateName, result };
  }

  /** Send tasks to multiple teammates in parallel */
  async assignParallel(
    assignments: { teammate: string; task: string }[]
  ): Promise<TaskResult[]> {
    return Promise.all(
      assignments.map(({ teammate, task }) => this.assignTask(teammate, task))
    );
  }

  /** Get list of available teammates and their descriptions */
  getTeammateDescriptions(): string {
    return Array.from(this.teammates.values())
      .map((t) => `- **${t.config.name}**: ${t.config.description}`)
      .join("\n");
  }

  /** Shut down all teammate sessions */
  async shutdown(): Promise<void> {
    for (const [name, teammate] of this.teammates) {
      teammate.session.close();
      console.log(`  [-] ${name} shut down`);
    }
    this.teammates.clear();
  }
}
