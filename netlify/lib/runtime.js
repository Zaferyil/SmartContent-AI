/**
 * Where this code is running.
 *
 * This used to be answered with `process.env.NETLIFY`, which is set during a
 * build but *not* inside a deployed function — a deploy's own diagnostics came
 * back with only SITE_ID, SITE_NAME and AWS_LAMBDA_FUNCTION_NAME. Everything
 * that asked "am I deployed?" therefore got "no" in production, which quietly
 * turned off the fail-closed guard on the access check and made the calendar
 * report that automatic publishing was not configured.
 *
 * The signals below are the ones a deployed function actually has. The Netlify
 * CLI sets the Lambda variables too while emulating functions locally, so
 * NETLIFY_DEV is what separates a laptop from the real thing.
 */

/** True inside a real deployed function; false under the CLI and in tests. */
export const isDeployed = () =>
  !process.env.NETLIFY_DEV &&
  Boolean(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.SITE_ID ||
      process.cwd().startsWith('/var/task')
  )
