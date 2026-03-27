import type { JsonPrimitive, JsonValue } from "@runroot/domain";

export type ToolSchemaType =
  | "array"
  | "boolean"
  | "json"
  | "null"
  | "number"
  | "object"
  | "string";

interface ToolSchemaBase {
  readonly description?: string;
  readonly type: ToolSchemaType;
}

export interface ToolArraySchema extends ToolSchemaBase {
  readonly items?: ToolSchema;
  readonly maxItems?: number;
  readonly minItems?: number;
  readonly type: "array";
}

export interface ToolBooleanSchema extends ToolSchemaBase {
  readonly type: "boolean";
}

export interface ToolJsonSchema extends ToolSchemaBase {
  readonly type: "json";
}

export interface ToolNullSchema extends ToolSchemaBase {
  readonly type: "null";
}

export interface ToolNumberSchema extends ToolSchemaBase {
  readonly maximum?: number;
  readonly minimum?: number;
  readonly type: "number";
}

export interface ToolObjectSchema extends ToolSchemaBase {
  readonly additionalProperties?: boolean;
  readonly properties?: Readonly<Record<string, ToolSchema>>;
  readonly required?: readonly string[];
  readonly type: "object";
}

export interface ToolStringSchema extends ToolSchemaBase {
  readonly enum?: readonly JsonPrimitive[];
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly type: "string";
}

export type ToolSchema =
  | ToolArraySchema
  | ToolBooleanSchema
  | ToolJsonSchema
  | ToolNullSchema
  | ToolNumberSchema
  | ToolObjectSchema
  | ToolStringSchema;

export function validateToolValue(
  value: JsonValue,
  schema: ToolSchema,
  path = "input",
): string[] {
  const issues: string[] = [];

  collectSchemaIssues(value, schema, path, issues);

  return issues;
}

function collectSchemaIssues(
  value: JsonValue,
  schema: ToolSchema,
  path: string,
  issues: string[],
): void {
  switch (schema.type) {
    case "json":
      collectJsonIssues(value, path, issues);
      return;
    case "array":
      validateArray(value, schema, path, issues);
      return;
    case "boolean":
      if (typeof value !== "boolean") {
        issues.push(`${path} must be a boolean.`);
      }
      return;
    case "null":
      if (value !== null) {
        issues.push(`${path} must be null.`);
      }
      return;
    case "number":
      validateNumber(value, schema, path, issues);
      return;
    case "object":
      validateObject(value, schema, path, issues);
      return;
    case "string":
      validateString(value, schema, path, issues);
      return;
    default: {
      const exhaustiveCheck: never = schema;

      throw new Error(
        `Unsupported tool schema type: ${String(exhaustiveCheck)}`,
      );
    }
  }
}

function validateArray(
  value: JsonValue,
  schema: ToolArraySchema,
  path: string,
  issues: string[],
): void {
  if (!Array.isArray(value)) {
    issues.push(`${path} must be an array.`);
    return;
  }

  if (schema.minItems !== undefined && value.length < schema.minItems) {
    issues.push(`${path} must contain at least ${schema.minItems} item(s).`);
  }

  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    issues.push(`${path} must contain at most ${schema.maxItems} item(s).`);
  }

  const itemSchema = schema.items;

  if (!itemSchema) {
    return;
  }

  value.forEach((entry, index) => {
    collectSchemaIssues(entry, itemSchema, `${path}[${index}]`, issues);
  });
}

function validateNumber(
  value: JsonValue,
  schema: ToolNumberSchema,
  path: string,
  issues: string[],
): void {
  if (typeof value !== "number" || Number.isNaN(value)) {
    issues.push(`${path} must be a number.`);
    return;
  }

  if (schema.minimum !== undefined && value < schema.minimum) {
    issues.push(`${path} must be greater than or equal to ${schema.minimum}.`);
  }

  if (schema.maximum !== undefined && value > schema.maximum) {
    issues.push(`${path} must be less than or equal to ${schema.maximum}.`);
  }
}

function validateObject(
  value: JsonValue,
  schema: ToolObjectSchema,
  path: string,
  issues: string[],
): void {
  if (!isJsonObject(value)) {
    issues.push(`${path} must be an object.`);
    return;
  }

  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  for (const propertyName of required) {
    if (!(propertyName in value)) {
      issues.push(`${path}.${propertyName} is required.`);
    }
  }

  for (const [propertyName, propertyValue] of Object.entries(value)) {
    const propertySchema = properties[propertyName];

    if (!propertySchema) {
      if (schema.additionalProperties === false) {
        issues.push(`${path}.${propertyName} is not allowed.`);
      }

      continue;
    }

    collectSchemaIssues(
      propertyValue,
      propertySchema,
      `${path}.${propertyName}`,
      issues,
    );
  }
}

function validateString(
  value: JsonValue,
  schema: ToolStringSchema,
  path: string,
  issues: string[],
): void {
  if (typeof value !== "string") {
    issues.push(`${path} must be a string.`);
    return;
  }

  if (schema.minLength !== undefined && value.length < schema.minLength) {
    issues.push(
      `${path} must contain at least ${schema.minLength} character(s).`,
    );
  }

  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    issues.push(
      `${path} must contain at most ${schema.maxLength} character(s).`,
    );
  }

  if (schema.enum && !schema.enum.includes(value)) {
    issues.push(
      `${path} must be one of: ${schema.enum.map((entry) => JSON.stringify(entry)).join(", ")}.`,
    );
  }
}

function isJsonObject(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectJsonIssues(
  value: unknown,
  path: string,
  issues: string[],
): void {
  if (value === null) {
    return;
  }

  if (
    typeof value === "boolean" ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectJsonIssues(entry, `${path}[${index}]`, issues);
    });

    return;
  }

  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);

    if (prototype !== Object.prototype && prototype !== null) {
      issues.push(`${path} must be JSON-serializable.`);
      return;
    }

    for (const [propertyName, propertyValue] of Object.entries(value)) {
      collectJsonIssues(propertyValue, `${path}.${propertyName}`, issues);
    }

    return;
  }

  issues.push(`${path} must be JSON-serializable.`);
}
