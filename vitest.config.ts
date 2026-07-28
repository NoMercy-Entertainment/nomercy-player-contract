import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],

    // Building the contract parses all three web packages with ts-morph, which
    // takes several seconds warm and longer on a cold runner. Four tests do it
    // for real rather than against a fixture — deliberately, because a contract
    // built from a stub proves nothing about the contract — and vitest 4's
    // five-second default turned every one of them red as a timeout.
    //
    // The assertions are unchanged. What was wrong was the clock.
    testTimeout: 60_000,
  },
});
