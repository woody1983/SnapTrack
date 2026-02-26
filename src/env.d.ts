/// <reference types="astro/client" />

type Runtime = import('@astrojs/cloudflare').Runtime;

interface Env {
  DB: D1Database;
  AI: {
    run(model: string, inputs: unknown): Promise<unknown>;
  };
}

declare global {
  namespace App {
    interface Locals extends Runtime {
      runtime: {
        env: Env;
      };
    }
  }
}

export {};
