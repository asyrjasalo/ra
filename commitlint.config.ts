import type { UserConfig } from '@commitlint/cli';

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allow longer body lines (e.g. full sentences) without manual wrapping.
    'body-max-line-length': [0],
  },
};

export default config;
