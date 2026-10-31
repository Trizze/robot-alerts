import { ValidationError } from "./errors.js";
export async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > 32768) throw new ValidationError("Request too large.");
    chunks.push(bytes);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new ValidationError("Invalid JSON.");
    throw error;
  }
}
