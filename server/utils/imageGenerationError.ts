// An image generation failure that carries the HTTP status and message the
// route should answer with. Thrown by the generator functions shared between
// the /generate-image* routes and the server-side plugin backend, so both
// report the same error for the same failure.
export class ImageGenerationError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: string,
  ) {
    super(message);
    this.name = "ImageGenerationError";
  }
}

export const errorMessageOf = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";
