export class ValidationError extends Error {}

export function classifyRequestError(error, log = () => {}) {
  if (error instanceof ValidationError) return {status:400,message:'Invalid request. Check the values and try again.'};
  log('Robot Alerts request failed unexpectedly.');
  return {status:500,message:'The server could not complete the request.'};
}
