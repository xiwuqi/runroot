export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateError";
  }
}

export class TemplateNotFoundError extends TemplateError {
  constructor(templateId: string) {
    super(`Template "${templateId}" was not found.`);
    this.name = "TemplateNotFoundError";
  }
}
