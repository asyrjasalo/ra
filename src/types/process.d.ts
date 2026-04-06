// Augment NodeJS.ProcessEnv to include PORT so dot notation works with
// noPropertyAccessFromIndexSignature enabled.

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT?: string;
    }
  }
}

export {};
