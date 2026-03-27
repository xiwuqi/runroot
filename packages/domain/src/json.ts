export type JsonPrimitive = boolean | null | number | string;

export interface JsonObject {
  [key: string]: JsonValue;
}

export type JsonArray = JsonValue[];

export type JsonValue = JsonArray | JsonObject | JsonPrimitive;
